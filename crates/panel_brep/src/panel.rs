//! Model 2.5D formatki: płaszczyzny górna/dolna jako pole wysokości,
//! komórki aranżacji 2D, ściany pionowe i tagowanie B-Rep.

use std::collections::HashMap;

use crate::brep::{BRepBuilder, TopologySummary};
use crate::geom::{
    clean_contour, ensure_ccw, point_in_polygon, polygon_bbox, representative_point,
    clip_segment_by_polygons, P2, Vec3,
};
use crate::mesh::{add_flat_cell, add_vertical_quad, FaceMesh};
use crate::overlay::{rect_shape, slice_arrangement, Contour2, Shapes2};

pub const CRIT_EPS: f64 = 1e-4;
const CIRCLE_SEGMENTS: usize = 48;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CutKind {
    Area,
    Hole,
}

#[derive(Debug, Clone)]
pub struct FeatureInputMm {
    pub id: String,
    pub kind: String,
    pub face: String,
    pub u_mm: f64,
    pub v_mm: f64,
    pub w_mm: Option<f64>,
    pub l_mm: Option<f64>,
    pub depth_mm: Option<f64>,
    pub diameter_mm: Option<f64>,
    pub through: bool,
    pub polygon: Option<Vec<P2>>,
}

#[derive(Debug, Clone)]
pub struct CutFeature {
    pub id: String,
    pub kind: CutKind,
    pub top: bool,
    pub face: String,
    /// Głębokość cięcia w mm (T dla przelotowych).
    pub depth: f64,
    /// Poligon w globalnym UV (u = X + W/2, v = Y + H/2), CCW.
    pub global_poly: Vec<P2>,
    /// Prostokąt w lokalnym UV lica (do przypisania ścianek w0..w3).
    pub local_rect: Option<Rect2>,
    /// Lokalny poligon lica (do przycinania krawędzi).
    pub local_poly: Vec<P2>,
    /// Punkt reprezentatywny cechy w globalnym UV (do wyznaczenia poziomu startu otworu).
    pub center: P2,
}

#[derive(Debug, Clone, Copy)]
pub struct Rect2 {
    pub u0: f64,
    pub u1: f64,
    pub v0: f64,
    pub v1: f64,
}

impl Rect2 {
    pub fn contains(&self, u: f64, v: f64, eps: f64) -> bool {
        u >= self.u0 - eps && u <= self.u1 + eps && v >= self.v0 - eps && v <= self.v1 + eps
    }
}

#[derive(Debug, Clone)]
struct Cell {
    /// loops[0] = obrys CCW, kolejne = otwory CW.
    loops: Vec<Vec<P2>>,
    top: f64,
    bot: f64,
    top_feature: Option<usize>,
    bot_feature: Option<usize>,
    material: bool,
}

#[derive(Debug, Clone)]
struct EdgeUse {
    cell: usize,
    a: P2,
    b: P2,
}

#[derive(Debug, Clone)]
pub struct EdgeOutput {
    pub key: String,
    pub alias: Option<String>,
    pub points: Vec<Vec<f32>>,
    pub edge_key: Option<String>,
    pub faces: Option<Vec<String>>,
}

pub struct PanelBuildResult {
    pub meshes: HashMap<String, FaceMesh>,
    pub edges: Vec<EdgeOutput>,
    pub vertices: Vec<Vec<f32>>,
    pub topology: TopologySummary,
    /// (tag, pętle jako indeksy wierzchołków, pole powierzchni)
    pub brep_faces: Vec<(String, Vec<Vec<usize>>, f64)>,
    pub side_edge_keys: HashMap<String, String>,
}

pub struct PanelInputMm {
    pub width: f64,
    pub height: f64,
    pub thickness: f64,
    pub features: Vec<FeatureInputMm>,
    pub outline: Option<Vec<P2>>,
}

fn classify_outline_segment_edge(a: P2, b: P2, w: f64, h: f64) -> &'static str {
    let du = b[0] - a[0];
    let dv = b[1] - a[1];
    let len = (du * du + dv * dv).sqrt();
    if len < CRIT_EPS {
        return "NOTCH";
    }
    let eps = 0.1;
    // Zewnętrzna normalna dla konturu CCW: (dv/len, -du/len)
    let nx = dv / len;
    let ny = -du / len;

    if a[1].abs() <= eps && b[1].abs() <= eps && ny < -0.99 {
        return "-Y";
    }
    if (a[0] - w).abs() <= eps && (b[0] - w).abs() <= eps && nx > 0.99 {
        return "+X";
    }
    if (a[1] - h).abs() <= eps && (b[1] - h).abs() <= eps && ny > 0.99 {
        return "+Y";
    }
    if a[0].abs() <= eps && b[0].abs() <= eps && nx < -0.99 {
        return "-X";
    }
    if du.abs() >= w * 0.7 {
        let v_avg = (a[1] + b[1]) * 0.5;
        if v_avg > h * 0.5 && ny > 0.0 {
            return "+Y";
        }
        if v_avg <= h * 0.5 && ny < 0.0 {
            return "-Y";
        }
    }
    "NOTCH"
}

fn point_on_segment(p: P2, a: P2, b: P2, eps: f64) -> bool {
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    let len_sq = dx * dx + dy * dy;
    if len_sq < 1e-9 {
        return false;
    }
    let len = len_sq.sqrt();
    let cross = ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx).abs() / len;
    if cross > eps {
        return false;
    }
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len_sq;
    t >= -eps / len && t <= 1.0 + eps / len
}

fn find_outline_segment_index(outline: &[P2], a: P2, b: P2) -> Option<usize> {
    let n = outline.len();
    if n < 3 {
        return None;
    }
    let eps = 0.05;
    let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
    for i in 0..n {
        let p0 = outline[i];
        let p1 = outline[(i + 1) % n];
        if point_on_segment(a, p0, p1, eps)
            && point_on_segment(b, p0, p1, eps)
            && point_on_segment(mid, p0, p1, eps)
        {
            return Some(i);
        }
    }
    None
}

fn circle_poly(cx: f64, cy: f64, r: f64) -> Vec<P2> {
    let mut poly = Vec::with_capacity(CIRCLE_SEGMENTS);
    for i in 0..CIRCLE_SEGMENTS {
        let t = (i as f64) * std::f64::consts::TAU / (CIRCLE_SEGMENTS as f64);
        poly.push([cx + r * t.cos(), cy + r * t.sin()]);
    }
    poly
}

fn normalize_face(face: &str) -> String {
    let upper = face.trim().to_uppercase().replace("-", "_");
    if upper.contains("Z_MINUS") || upper == "-Z" {
        "FACE_Z_MINUS".to_string()
    } else if upper.contains("Z_PLUS") || upper == "+Z" {
        "FACE_Z_PLUS".to_string()
    } else if upper.contains("X_MINUS") {
        "FACE_X_MINUS".to_string()
    } else if upper.contains("X_PLUS") {
        "FACE_X_PLUS".to_string()
    } else if upper.contains("Y_MINUS") {
        "FACE_Y_MINUS".to_string()
    } else if upper.contains("Y_PLUS") {
        "FACE_Y_PLUS".to_string()
    } else {
        upper
    }
}

fn rect_local_poly(u0: f64, v0: f64, u1: f64, v1: f64) -> Vec<P2> {
    vec![[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
}

/// Buduje cechy cięcia w globalnym UV. Zwraca też listę nieobsługiwanych cech (np. boki).
pub fn build_features(
    input: &PanelInputMm,
) -> (Vec<CutFeature>, Vec<Contour2>, Vec<String>) {
    let w = input.width;
    let h = input.height;
    let t = input.thickness;
    let mut out: Vec<CutFeature> = Vec::new();
    let mut lines: Vec<Contour2> = Vec::new();
    let mut unsupported: Vec<String> = Vec::new();

    for f in &input.features {
        let face = normalize_face(&f.face);
        if face != "FACE_Z_PLUS" && face != "FACE_Z_MINUS" {
            unsupported.push(f.id.clone());
            continue;
        }
        let top = face == "FACE_Z_PLUS";
        let kind = match f.kind.as_str() {
            "hole" => CutKind::Hole,
            "cutout" | "pocket" | "groove" => CutKind::Area,
            _ => {
                unsupported.push(f.id.clone());
                continue;
            }
        };

        let through = f.through
            || f.kind == "cutout"
            || f.depth_mm.map(|d| d >= t - CRIT_EPS).unwrap_or(false);
        let mut depth = if through {
            t
        } else {
            f.depth_mm.unwrap_or(match kind {
                CutKind::Hole => 10.0,
                CutKind::Area => 0.0,
            })
        };
        if depth < 0.0 {
            depth = depth.abs();
        }
        if depth > t {
            depth = t;
        }
        if depth <= CRIT_EPS && !through {
            continue;
        }

        let mut local_poly: Vec<P2> = Vec::new();
        match kind {
            CutKind::Hole => {
                let r = (f.diameter_mm.unwrap_or(35.0) / 2.0).abs();
                if r <= CRIT_EPS {
                    continue;
                }
                local_poly = circle_poly(f.u_mm, f.v_mm, r);
            }
            CutKind::Area => {
                if let Some(poly) = &f.polygon {
                    let mut p = clean_contour(poly);
                    ensure_ccw(&mut p);
                    local_poly = p;
                } else {
                    let u0 = f.u_mm.min(f.u_mm + f.w_mm.unwrap_or(0.0));
                    let u1 = f.u_mm.max(f.u_mm + f.w_mm.unwrap_or(0.0));
                    let v0 = f.v_mm.min(f.v_mm + f.l_mm.unwrap_or(0.0));
                    let v1 = f.v_mm.max(f.v_mm + f.l_mm.unwrap_or(0.0));
                    let u0 = u0.max(0.0);
                    let u1 = u1.min(w);
                    let v0 = v0.max(0.0);
                    let v1 = v1.min(h);
                    if u1 - u0 <= CRIT_EPS || v1 - v0 <= CRIT_EPS {
                        continue;
                    }
                    local_poly = rect_local_poly(u0, v0, u1, v1);
                }
            }
        }

        if local_poly.len() < 3 || crate::geom::polygon_area(&local_poly) <= CRIT_EPS {
            continue;
        }

        let local_rect = polygon_bbox(&local_poly).map(|(u0, u1, v0, v1)| Rect2 { u0, u1, v0, v1 });

        let mut global_poly: Vec<P2> = if top {
            local_poly.clone()
        } else {
            local_poly.iter().map(|p| [w - p[0], p[1]]).collect()
        };
        ensure_ccw(&mut global_poly);
        if global_poly.len() < 3 {
            continue;
        }

        // Zachowujemy cechy nawet częściowo poza płytą — aranżacja i tak je zetnie.
        let center = if kind == CutKind::Hole {
            if top {
                [f.u_mm, f.v_mm]
            } else {
                [w - f.u_mm, f.v_mm]
            }
        } else {
            representative_point(&global_poly)
        };

        lines.push(global_poly.clone());
        out.push(CutFeature {
            id: f.id.clone(),
            kind,
            top,
            face,
            depth,
            global_poly,
            local_rect,
            local_poly,
            center,
        });
    }

    (out, lines, unsupported)
}

fn max_depth_at(features: &[CutFeature], top: bool, p: P2) -> (f64, Option<usize>) {
    let mut best = 0.0f64;
    let mut best_idx: Option<usize> = None;
    for (idx, f) in features.iter().enumerate() {
        if f.top != top {
            continue;
        }
        if point_in_polygon(p, &f.global_poly) && f.depth > best + 1e-9 {
            best = f.depth;
            best_idx = Some(idx);
        }
    }
    (best, best_idx)
}

fn representative_cell_point(loops: &[Vec<P2>]) -> P2 {
    if loops.is_empty() {
        return [0.0, 0.0];
    }
    let inside_cell = |p: P2| -> bool {
        point_in_polygon(p, &loops[0])
            && !loops[1..].iter().any(|h| point_in_polygon(p, h))
    };
    if let Some((u0, u1, v0, v1)) = polygon_bbox(&loops[0]) {
        let c = [(u0 + u1) * 0.5, (v0 + v1) * 0.5];
        if inside_cell(c) {
            return c;
        }
    }
    // Triangulacja z otworami gwarantuje punkt w materiale komórki.
    let mut flat: Vec<P2> = Vec::new();
    for lp in loops {
        if lp.len() >= 3 {
            flat.extend_from_slice(lp);
        }
    }
    for [a, b, c] in crate::mesh::triangulate_loops(loops) {
        if a < flat.len() && b < flat.len() && c < flat.len() {
            let p = [
                (flat[a][0] + flat[b][0] + flat[c][0]) / 3.0,
                (flat[a][1] + flat[b][1] + flat[c][1]) / 3.0,
            ];
            if inside_cell(p) {
                return p;
            }
        }
    }
    representative_point(&loops[0])
}

fn build_cells(input: &PanelInputMm, features: &[CutFeature], lines: &[Contour2]) -> Vec<Cell> {
    let base: Shapes2 = if let Some(ref poly) = input.outline {
        vec![vec![poly.clone()]]
    } else {
        rect_shape(0.0, 0.0, input.width, input.height)
    };
    let shapes = slice_arrangement(&base, lines);
    let t_half = input.thickness * 0.5;
    let mut cells = Vec::new();

    for shape in shapes {
        if shape.is_empty() {
            continue;
        }
        let mut loops: Vec<Vec<P2>> = Vec::new();
        for (li, contour) in shape.into_iter().enumerate() {
            let mut c = clean_contour(&contour);
            if c.len() < 3 {
                continue;
            }
            if li == 0 {
                ensure_ccw(&mut c);
            } else if crate::geom::signed_area(&c) > 0.0 {
                c.reverse();
            }
            if crate::geom::polygon_area(&c) > CRIT_EPS {
                loops.push(c);
            }
        }
        if loops.is_empty() {
            continue;
        }
        let p = representative_cell_point(&loops);
        let (top_depth, top_feature) = max_depth_at(features, true, p);
        let (bot_depth, bot_feature) = max_depth_at(features, false, p);

        let top = t_half - top_depth;
        let bot = -t_half + bot_depth;
        let material = top > bot + 1e-7;

        cells.push(Cell {
            loops,
            top,
            bot,
            top_feature,
            bot_feature,
            material,
        });
    }

    cells
}

fn edge_key(a: P2, b: P2) -> ((i64, i64), (i64, i64)) {
    const SCALE: f64 = 10_000.0;
    let mut ka = ((a[0] * SCALE).round() as i64, (a[1] * SCALE).round() as i64);
    let mut kb = ((b[0] * SCALE).round() as i64, (b[1] * SCALE).round() as i64);
    if kb < ka {
        std::mem::swap(&mut ka, &mut kb);
    }
    (ka, kb)
}

fn build_shared_edges(cells: &[Cell]) -> HashMap<((i64, i64), (i64, i64)), Vec<EdgeUse>> {
    let mut map: HashMap<((i64, i64), (i64, i64)), Vec<EdgeUse>> = HashMap::new();
    for (ci, cell) in cells.iter().enumerate() {
        for lp in &cell.loops {
            let n = lp.len();
            for i in 0..n {
                let a = lp[i];
                let b = lp[(i + 1) % n];
                let d = edge_key(a, b);
                map.entry(d).or_default().push(EdgeUse { cell: ci, a, b });
            }
        }
    }
    map
}

fn interval_contains(bot: f64, top: f64, z: f64) -> bool {
    z > bot + 1e-7 && z < top - 1e-7
}

fn wall_tag_for_feature(
    feature: &CutFeature,
    a: P2,
    b: P2,
    width: f64,
) -> String {
    if feature.kind == CutKind::Hole {
        // Ścianka walca jest częścią lica, z którego nawiercono otwór — tak jak
        // w poprzednim silniku, gdzie walec scalano z siatką lica.
        return feature.face.clone();
    }
    let eps = 0.05;
    let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
    // Współrzędne lokalne lica cechy.
    let (lu, lv) = if feature.top {
        (mid[0], mid[1])
    } else {
        (width - mid[0], mid[1])
    };
    let (du, dv) = (b[0] - a[0], b[1] - a[1]);
    let rect = feature.local_rect;
    let side_index = if let Some(r) = rect {
        if du.abs() >= dv.abs() {
            // Odcinek poziomy (stałe v).
            let v_mid = if feature.top { lv } else { lv };
            if (v_mid - r.v0).abs() <= eps {
                0
            } else if (v_mid - r.v1).abs() <= eps {
                2
            } else {
                0
            }
        } else {
            // Odcinek pionowy (stałe u).
            if (lu - r.u0).abs() <= eps {
                3
            } else if (lu - r.u1).abs() <= eps {
                1
            } else {
                3
            }
        }
    } else {
        0
    };
    format!("feature_{}_w{}", feature.id, side_index)
}

fn side_face_for_segment(a: P2, b: P2, width: f64, height: f64) -> String {
    let eps = 0.05;
    let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
    if mid[0].abs() <= eps {
        "FACE_X_MINUS".to_string()
    } else if (mid[0] - width).abs() <= eps {
        "FACE_X_PLUS".to_string()
    } else if mid[1].abs() <= eps {
        "FACE_Y_MINUS".to_string()
    } else if (mid[1] - height).abs() <= eps {
        "FACE_Y_PLUS".to_string()
    } else {
        // Krawędź wewnętrzna bez cechy — przypisujemy do lica górnego/dolnego.
        "FACE_Z_PLUS".to_string()
    }
}

fn to3d(face: &str, u: f64, v: f64, z: f64, width: f64, height: f64) -> [f64; 3] {
    let _ = height;
    let x = if face == "FACE_Z_MINUS" {
        width * 0.5 - u
    } else {
        u - width * 0.5
    };
    let y = v - height * 0.5;
    [x, y, z]
}

fn feature_face_z(feature: &CutFeature, thickness: f64, depth: f64) -> f64 {
    let t_half = thickness * 0.5;
    if feature.top {
        t_half - depth
    } else {
        -t_half + depth
    }
}

fn push_edge_full(
    edges: &mut Vec<EdgeOutput>,
    key: String,
    alias: Option<String>,
    pts: Vec<[f32; 3]>,
    edge_key: Option<String>,
    faces: Option<Vec<String>>,
) {
    if pts.len() >= 2 {
        edges.push(EdgeOutput {
            key,
            alias,
            points: pts.into_iter().map(|p| p.to_vec()).collect(),
            edge_key,
            faces,
        });
    }
}

fn push_edge(edges: &mut Vec<EdgeOutput>, key: String, pts: Vec<[f32; 3]>) {
    push_edge_full(edges, key, None, pts, None, None);
}

/// Odejmuje zbiór przedziałów wyciętych od odcinka [0, len], zwracając pozostałe odcinki.
fn subtract_intervals(len: f64, mut cutouts: Vec<(f64, f64)>) -> Vec<(f64, f64)> {
    if cutouts.is_empty() {
        return vec![(0.0, len)];
    }
    cutouts = cutouts
        .into_iter()
        .filter_map(|(a, b)| {
            let s0 = a.max(0.0);
            let s1 = b.min(len);
            if s1 - s0 > CRIT_EPS {
                Some((s0, s1))
            } else {
                None
            }
        })
        .collect();
    if cutouts.is_empty() {
        return vec![(0.0, len)];
    }
    cutouts.sort_by(|x, y| x.0.partial_cmp(&y.0).unwrap());

    let mut merged: Vec<(f64, f64)> = Vec::new();
    for (s0, s1) in cutouts {
        if let Some(last) = merged.last_mut() {
            if s0 <= last.1 + CRIT_EPS {
                last.1 = last.1.max(s1);
                continue;
            }
        }
        merged.push((s0, s1));
    }

    let mut remaining = Vec::new();
    let mut cur = 0.0;
    for (s0, s1) in merged {
        if s0 - cur > CRIT_EPS {
            remaining.push((cur, s0));
        }
        cur = cur.max(s1);
    }
    if len - cur > CRIT_EPS {
        remaining.push((cur, len));
    }
    remaining
}

struct SideHoleMm {
    face: String,
    u_mm: f64,
    v_mm: f64,
    radius_mm: f64,
    depth_mm: f64,
}

fn collect_side_holes(input: &PanelInputMm) -> HashMap<String, Vec<SideHoleMm>> {
    let mut map: HashMap<String, Vec<SideHoleMm>> = HashMap::new();
    for f in &input.features {
        if f.kind != "hole" {
            continue;
        }
        let face = normalize_face(&f.face);
        if !matches!(
            face.as_str(),
            "FACE_X_PLUS" | "FACE_X_MINUS" | "FACE_Y_PLUS" | "FACE_Y_MINUS"
        ) {
            continue;
        }
        let radius = (f.diameter_mm.unwrap_or(8.0) / 2.0).abs();
        let depth = f.depth_mm.unwrap_or(10.0).abs();
        if radius <= CRIT_EPS || depth <= CRIT_EPS {
            continue;
        }
        map.entry(face.clone()).or_default().push(SideHoleMm {
            face,
            u_mm: f.u_mm,
            v_mm: f.v_mm,
            radius_mm: radius,
            depth_mm: depth,
        });
    }
    map
}

fn emit_side_face_with_holes(
    meshes: &mut HashMap<String, FaceMesh>,
    face_tag: &str,
    holes: &[SideHoleMm],
    w: f64,
    h: f64,
    t: f64,
) {
    let hw = w * 0.5;
    let hh = h * 0.5;
    let ht = t * 0.5;
    let (origin, u_axis, v_axis, normal, fw, fh) = match face_tag {
        "FACE_X_MINUS" => ([-hw, -hh, -ht], [0.0, 0.0, 1.0], [0.0, 1.0, 0.0], [-1.0, 0.0, 0.0], t, h),
        "FACE_X_PLUS" => ([hw, -hh, ht], [0.0, 0.0, -1.0], [0.0, 1.0, 0.0], [1.0, 0.0, 0.0], t, h),
        "FACE_Y_PLUS" => ([-hw, hh, ht], [1.0, 0.0, 0.0], [0.0, 0.0, -1.0], [0.0, 1.0, 0.0], w, t),
        "FACE_Y_MINUS" => ([-hw, -hh, -ht], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, -1.0, 0.0], w, t),
        _ => return,
    };

    let to3d_side = |u: f64, v: f64, depth: f64| -> [f64; 3] {
        [
            origin[0] + u * u_axis[0] + v * v_axis[0] - depth * normal[0],
            origin[1] + u * u_axis[1] + v * v_axis[1] - depth * normal[1],
            origin[2] + u * u_axis[2] + v * v_axis[2] - depth * normal[2],
        ]
    };

    let mut loops: Vec<Vec<P2>> = vec![vec![[0.0, 0.0], [fw, 0.0], [fw, fh], [0.0, fh]]];
    let mut hole_polys_ccw: Vec<(Vec<P2>, f64)> = Vec::new();
    for hole in holes {
        let poly_ccw = circle_poly(hole.u_mm, hole.v_mm, hole.radius_mm);
        let mut poly_cw = poly_ccw.clone();
        poly_cw.reverse();
        loops.push(poly_cw);
        hole_polys_ccw.push((poly_ccw, hole.depth_mm));
    }

    let flat: Vec<P2> = loops.iter().flat_map(|l| l.iter().copied()).collect();
    let tris = crate::mesh::triangulate_loops(&loops);
    let fm = meshes.entry(face_tag.to_string()).or_default();
    for [i0, i1, i2] in tris {
        let p0 = flat[i0];
        let p1 = flat[i1];
        let p2 = flat[i2];
        fm.add_triangle(
            to3d_side(p0[0], p0[1], 0.0),
            to3d_side(p1[0], p1[1], 0.0),
            to3d_side(p2[0], p2[1], 0.0),
            true,
        );
    }

    for (poly_ccw, depth) in hole_polys_ccw {
        let n = poly_ccw.len();
        for i in 0..n {
            let a = poly_ccw[i];
            let b = poly_ccw[(i + 1) % n];
            let p0 = to3d_side(a[0], a[1], 0.0);
            let p1 = to3d_side(b[0], b[1], 0.0);
            let p2 = to3d_side(b[0], b[1], depth);
            let p3 = to3d_side(a[0], a[1], depth);
            fm.add_quad(p0, p1, p2, p3, true);
        }
        let bot_tris = crate::mesh::triangulate(&poly_ccw);
        for [i0, i1, i2] in bot_tris {
            let p0 = poly_ccw[i0];
            let p1 = poly_ccw[i1];
            let p2 = poly_ccw[i2];
            fm.add_triangle(
                to3d_side(p0[0], p0[1], depth),
                to3d_side(p1[0], p1[1], depth),
                to3d_side(p2[0], p2[1], depth),
                true,
            );
        }
    }
}

/// Główna budowa: zwraca siatki per ściana, krawędzie i podsumowanie topologii.
pub fn build_panel(input: &PanelInputMm) -> Result<PanelBuildResult, String> {
    let w = input.width;
    let h = input.height;
    let t = input.thickness;
    if w <= 0.0 || h <= 0.0 || t <= 0.0 {
        return Err("Niepoprawne wymiary formatki".to_string());
    }

    let side_holes = if input.outline.is_none() {
        collect_side_holes(input)
    } else {
        HashMap::new()
    };
    let (features, lines, _unsupported) = build_features(input);
    let cells = build_cells(input, &features, &lines);
    let shared = build_shared_edges(&cells);

    let mut meshes: HashMap<String, FaceMesh> = HashMap::new();
    let mut brep = BRepBuilder::new();
    let mut edge_out: Vec<EdgeOutput> = Vec::new();
    let mut side_edge_keys: HashMap<String, String> = HashMap::new();

    // 1. Powierzchnie górne i dolne (płaskie komórki aranżacji).
    for cell in &cells {
        if !cell.material {
            continue;
        }
        let top_tag = match cell.top_feature {
            None => "FACE_Z_PLUS".to_string(),
            Some(idx) => match features[idx].kind {
                CutKind::Area => format!("feature_{}_bottom", features[idx].id),
                CutKind::Hole => {
                    if features[idx].top {
                        "FACE_Z_PLUS".to_string()
                    } else {
                        "FACE_Z_MINUS".to_string()
                    }
                }
            },
        };
        // Powierzchnia górna istnieje tylko, jeśli górna granica jest materiałem.
        if cell.top > cell.bot + 1e-7 {
            let mesh = meshes.entry(top_tag.clone()).or_default();
            add_flat_cell(mesh, &cell.loops, cell.top, true, w, h);
            let mut loops3: Vec<Vec<Vec3>> = Vec::new();
            for lp in &cell.loops {
                let pts: Vec<Vec3> = lp
                    .iter()
                    .map(|p| {
                        let p3 = to3d("FACE_Z_PLUS", p[0], p[1], cell.top, w, h);
                        Vec3::new(p3[0], p3[1], p3[2])
                    })
                    .collect();
                loops3.push(pts);
            }
            if !loops3.is_empty() {
                brep.add_face(&top_tag, loops3, Vec3::new(0.0, 0.0, 1.0));
            }
        }

        let bot_tag = match cell.bot_feature {
            None => "FACE_Z_MINUS".to_string(),
            Some(idx) => match features[idx].kind {
                CutKind::Area => format!("feature_{}_bottom", features[idx].id),
                CutKind::Hole => {
                    if features[idx].top {
                        "FACE_Z_PLUS".to_string()
                    } else {
                        "FACE_Z_MINUS".to_string()
                    }
                }
            },
        };
        if cell.bot < cell.top - 1e-7 {
            let mesh = meshes.entry(bot_tag.clone()).or_default();
            add_flat_cell(mesh, &cell.loops, cell.bot, false, w, h);
            let mut loops3: Vec<Vec<Vec3>> = Vec::new();
            for lp in cell.loops.iter().rev() {
                let pts: Vec<Vec3> = lp
                    .iter()
                    .rev()
                    .map(|p| {
                        let p3 = to3d("FACE_Z_PLUS", p[0], p[1], cell.bot, w, h);
                        Vec3::new(p3[0], p3[1], p3[2])
                    })
                    .collect();
                loops3.push(pts);
            }
            if !loops3.is_empty() {
                brep.add_face(&bot_tag, loops3, Vec3::new(0.0, 0.0, -1.0));
            }
        }
    }

    // 2. Ściany pionowe: różnica symetryczna przedziałów materiału po dwóch stronach krawędzi.
    for (_key, uses) in shared.iter() {
        if uses.is_empty() {
            continue;
        }

        // Przypadek krawędzi zewnętrznej obrysu.
        if uses.len() == 1 {
            let u = &uses[0];
            let cell = &cells[u.cell];
            if !cell.material {
                continue;
            }
            let tag = if let Some(ref poly) = input.outline {
                if let Some(seg_idx) = find_outline_segment_index(poly, u.a, u.b) {
                    let side_tag = format!("OUTLINE_SIDE_{}", seg_idx);
                    let p0 = poly[seg_idx];
                    let p1 = poly[(seg_idx + 1) % poly.len()];
                    let ek = classify_outline_segment_edge(p0, p1, w, h);
                    side_edge_keys.entry(side_tag.clone()).or_insert_with(|| ek.to_string());
                    side_tag
                } else {
                    side_face_for_segment(u.a, u.b, w, h)
                }
            } else {
                side_face_for_segment(u.a, u.b, w, h)
            };
            if side_holes.contains_key(&tag) {
                continue;
            }
            emit_wall(
                &mut meshes,
                &mut brep,
                u.a,
                u.b,
                cell.bot,
                cell.top,
                &tag,
                w,
                h,
                true,
            );
            continue;
        }

        // Krawędź wspólna dwóch komórek. Przy większej liczbie użyć wybieramy dwie
        // pierwsze o różnych interwałach (przypadki współliniowych duplikatów).
        let mut pair: Option<(&EdgeUse, &EdgeUse)> = None;
        for i in 0..uses.len() {
            for j in i + 1..uses.len() {
                let a = &uses[i];
                let b = &uses[j];
                if a.cell != b.cell {
                    pair = Some((a, b));
                    break;
                }
            }
            if pair.is_some() {
                break;
            }
        }
        let Some((ua, ub)) = pair else { continue };
        let ca = &cells[ua.cell];
        let cb = &cells[ub.cell];
        if (ca.top - cb.top).abs() < 1e-7 && (ca.bot - cb.bot).abs() < 1e-7 {
            continue;
        }

        // Zbiór punktów podziału wysokości.
        let mut zs = vec![ca.bot, ca.top, cb.bot, cb.top];
        zs.sort_by(|x, y| x.partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal));
        zs.dedup_by(|x, y| (*x - *y).abs() < 1e-7);

        for zi in 0..zs.len().saturating_sub(1) {
            let z0 = zs[zi];
            let z1 = zs[zi + 1];
            if z1 - z0 < 1e-7 {
                continue;
            }
            let zm = (z0 + z1) * 0.5;
            let has_a = interval_contains(ca.bot, ca.top, zm) && ca.material;
            let has_b = interval_contains(cb.bot, cb.top, zm) && cb.material;
            if has_a == has_b {
                continue;
            }

            let mut tag_face = String::new();
            let mut tag_key: Option<String> = None;
            if (ca.top - cb.top).abs() > 1e-7 {
                let lower = if ca.top < cb.top { ca } else { cb };
                if let Some(idx) = lower.top_feature {
                    let f = &features[idx];
                    if f.kind == CutKind::Hole {
                        tag_face = if f.top {
                            "FACE_Z_PLUS".to_string()
                        } else {
                            "FACE_Z_MINUS".to_string()
                        };
                    } else {
                        tag_key = Some(wall_tag_for_feature(f, ua.a, ua.b, w));
                    }
                }
            } else if (ca.bot - cb.bot).abs() > 1e-7 {
                let higher = if ca.bot > cb.bot { ca } else { cb };
                if let Some(idx) = higher.bot_feature {
                    let f = &features[idx];
                    if f.kind == CutKind::Hole {
                        tag_face = if f.top {
                            "FACE_Z_PLUS".to_string()
                        } else {
                            "FACE_Z_MINUS".to_string()
                        };
                    } else {
                        tag_key = Some(wall_tag_for_feature(f, ua.a, ua.b, w));
                    }
                }
            }

            let key = tag_key.unwrap_or_else(|| {
                if !tag_face.is_empty() {
                    tag_face.clone()
                } else {
                    "FACE_Z_PLUS".to_string()
                }
            });

            if has_a {
                emit_wall(
                    &mut meshes,
                    &mut brep,
                    ua.a,
                    ua.b,
                    z0,
                    z1,
                    &key,
                    w,
                    h,
                    true,
                );
            } else {
                emit_wall(
                    &mut meshes,
                    &mut brep,
                    ub.a,
                    ub.b,
                    z0,
                    z1,
                    &key,
                    w,
                    h,
                    true,
                );
            }
        }
    }

    // 2b. Ściany boczne z otworami (FACE_X_PLUS/MINUS, FACE_Y_PLUS/MINUS).
    for (face_tag, holes) in &side_holes {
        emit_side_face_with_holes(&mut meshes, face_tag, holes, w, h, t);
    }

    // 3. Krawędzie nominalne formatki z przycinaniem przez wycięcia/wpusty.
    let hw = w * 0.5;
    let hh = h * 0.5;
    let ht = t * 0.5;

    if let Some(ref poly) = input.outline {
        let n = poly.len();
        for i in 0..n {
            let p0 = poly[i];
            let p1 = poly[(i + 1) % n];
            let dx = p1[0] - p0[0];
            let dy = p1[1] - p0[1];
            let seg_len = (dx * dx + dy * dy).sqrt();
            if seg_len < CRIT_EPS {
                continue;
            }
            let ek = classify_outline_segment_edge(p0, p1, w, h);
            let side_face = format!("OUTLINE_SIDE_{}", i);

            for (for_top, z_val, z_face, key_prefix) in [
                (true, ht, "FACE_Z_PLUS", "outline_top"),
                (false, -ht, "FACE_Z_MINUS", "outline_bot"),
            ] {
                let alias = match (for_top, ek) {
                    (true, "-Y") => Some("dol_przod".to_string()),
                    (true, "+Y") => Some("gora_przod".to_string()),
                    (true, "-X") => Some("przod_lewo".to_string()),
                    (true, "+X") => Some("przod_prawo".to_string()),
                    (false, "-Y") => Some("dol_tyl".to_string()),
                    (false, "+Y") => Some("gora_tyl".to_string()),
                    (false, "-X") => Some("tyl_lewo".to_string()),
                    (false, "+X") => Some("tyl_prawa".to_string()),
                    _ => None,
                };
                let cut_polys: Vec<Vec<P2>> = features
                    .iter()
                    .filter(|f| {
                        if f.kind == CutKind::Hole {
                            return false;
                        }
                        let is_through = (f.depth - t).abs() <= CRIT_EPS;
                        if for_top { f.top || is_through } else { !f.top || is_through }
                    })
                    .map(|f| f.global_poly.clone())
                    .collect();

                let segs = if cut_polys.is_empty() {
                    vec![(p0, p1)]
                } else {
                    clip_segment_by_polygons(p0, p1, &cut_polys)
                };
                let n_segs = segs.len();
                for (si, (sa, sb)) in segs.into_iter().enumerate() {
                    let key = if n_segs > 1 {
                        format!("{}_{}_{}", key_prefix, i, si + 1)
                    } else {
                        format!("{}_{}", key_prefix, i)
                    };
                    push_edge_full(
                        &mut edge_out,
                        key,
                        alias.clone(),
                        vec![
                            [(sa[0] - hw) as f32, (sa[1] - hh) as f32, z_val as f32],
                            [(sb[0] - hw) as f32, (sb[1] - hh) as f32, z_val as f32],
                        ],
                        Some(ek.to_string()),
                        Some(vec![z_face.to_string(), side_face.clone()]),
                    );
                }
            }

            // Pionowa krawędź narożna w wierzchołku p0
            let prev_idx = (i + n - 1) % n;
            let top_cut = non_hole_depth_at(&features, true, p0, None);
            let bot_cut = non_hole_depth_at(&features, false, p0, None);
            let top_z = ht - top_cut;
            let bot_z = -ht + bot_cut;
            if top_z - bot_z > CRIT_EPS {
                let cx = (p0[0] - hw) as f32;
                let cy = (p0[1] - hh) as f32;
                push_edge_full(
                    &mut edge_out,
                    format!("outline_vert_{}", i),
                    None,
                    vec![[cx, cy, bot_z as f32], [cx, cy, top_z as f32]],
                    Some(ek.to_string()),
                    Some(vec![format!("OUTLINE_SIDE_{}", prev_idx), side_face]),
                );
            }
        }
    } else {
    // Funkcja pomocnicza: zbiera przedziały [s0, s1] wycinające dany bok formatki
    // side_idx: 0 = dol (-Y, v=0), 1 = prawo (+X, u=w), 2 = gora (+Y, v=h), 3 = lewo (-X, u=0)
    let get_side_cutouts = |side_idx: usize, for_top: bool| -> Vec<(f64, f64)> {
        let mut cutouts = Vec::new();
        for f in &features {
            if f.kind == CutKind::Hole {
                continue;
            }
            let is_through = (f.depth - t).abs() <= CRIT_EPS;
            let affects_face = if for_top {
                f.top || is_through
            } else {
                !f.top || is_through
            };
            if !affects_face {
                continue;
            }
            if let Some(r) = f.local_rect {
                match side_idx {
                    0 => {
                        if r.v0 <= CRIT_EPS {
                            cutouts.push((r.u0, r.u1));
                        }
                    }
                    1 => {
                        if r.u1 >= w - CRIT_EPS {
                            cutouts.push((r.v0, r.v1));
                        }
                    }
                    2 => {
                        if r.v1 >= h - CRIT_EPS {
                            cutouts.push((r.u0, r.u1));
                        }
                    }
                    3 => {
                        if r.u0 <= CRIT_EPS {
                            cutouts.push((r.v0, r.v1));
                        }
                    }
                    _ => {}
                }
            }
        }
        cutouts
    };

    // Bok -Y (v = 0, u in [0, w])
    for (for_top, z_val, key_base, z_face) in [
        (true, ht, "dol_przod", "FACE_Z_PLUS"),
        (false, -ht, "dol_tyl", "FACE_Z_MINUS"),
    ] {
        let cuts = get_side_cutouts(0, for_top);
        let segs = subtract_intervals(w, cuts);
        let n_segs = segs.len();
        for (i, (s0, s1)) in segs.into_iter().enumerate() {
            let key = if n_segs > 1 {
                format!("{}_{}", key_base, i + 1)
            } else {
                key_base.to_string()
            };
            let p0 = [(s0 - hw) as f32, -hh as f32, z_val as f32];
            let p1 = [(s1 - hw) as f32, -hh as f32, z_val as f32];
            push_edge_full(
                &mut edge_out,
                key,
                Some(key_base.to_string()),
                vec![p0, p1],
                Some("-Y".to_string()),
                Some(vec![z_face.to_string(), "FACE_Y_MINUS".to_string()]),
            );
        }
    }

    // Bok +X (u = w, v in [0, h])
    for (for_top, z_val, key_base, z_face) in [
        (true, ht, "przod_prawo", "FACE_Z_PLUS"),
        (false, -ht, "tyl_prawo", "FACE_Z_MINUS"),
    ] {
        let cuts = get_side_cutouts(1, for_top);
        let segs = subtract_intervals(h, cuts);
        let n_segs = segs.len();
        for (i, (s0, s1)) in segs.into_iter().enumerate() {
            let key = if n_segs > 1 {
                format!("{}_{}", key_base, i + 1)
            } else {
                key_base.to_string()
            };
            let p0 = [hw as f32, (s0 - hh) as f32, z_val as f32];
            let p1 = [hw as f32, (s1 - hh) as f32, z_val as f32];
            push_edge_full(
                &mut edge_out,
                key,
                Some(key_base.to_string()),
                vec![p0, p1],
                Some("+X".to_string()),
                Some(vec![z_face.to_string(), "FACE_X_PLUS".to_string()]),
            );
        }
    }

    // Bok +Y (v = h, u in [0, w])
    for (for_top, z_val, key_base, z_face) in [
        (true, ht, "gora_przod", "FACE_Z_PLUS"),
        (false, -ht, "gora_tyl", "FACE_Z_MINUS"),
    ] {
        let cuts = get_side_cutouts(2, for_top);
        let segs = subtract_intervals(w, cuts);
        let n_segs = segs.len();
        for (i, (s0, s1)) in segs.into_iter().enumerate() {
            let key = if n_segs > 1 {
                format!("{}_{}", key_base, i + 1)
            } else {
                key_base.to_string()
            };
            let p0 = [(s0 - hw) as f32, hh as f32, z_val as f32];
            let p1 = [(s1 - hw) as f32, hh as f32, z_val as f32];
            push_edge_full(
                &mut edge_out,
                key,
                Some(key_base.to_string()),
                vec![p0, p1],
                Some("+Y".to_string()),
                Some(vec![z_face.to_string(), "FACE_Y_PLUS".to_string()]),
            );
        }
    }

    // Bok -X (u = 0, v in [0, h])
    for (for_top, z_val, key_base, z_face) in [
        (true, ht, "przod_lewo", "FACE_Z_PLUS"),
        (false, -ht, "tyl_lewo", "FACE_Z_MINUS"),
    ] {
        let cuts = get_side_cutouts(3, for_top);
        let segs = subtract_intervals(h, cuts);
        let n_segs = segs.len();
        for (i, (s0, s1)) in segs.into_iter().enumerate() {
            let key = if n_segs > 1 {
                format!("{}_{}", key_base, i + 1)
            } else {
                key_base.to_string()
            };
            let p0 = [-hw as f32, (s0 - hh) as f32, z_val as f32];
            let p1 = [-hw as f32, (s1 - hh) as f32, z_val as f32];
            push_edge_full(
                &mut edge_out,
                key,
                Some(key_base.to_string()),
                vec![p0, p1],
                Some("-X".to_string()),
                Some(vec![z_face.to_string(), "FACE_X_MINUS".to_string()]),
            );
        }
    }

    // Krawędzie pionowe narożników formatki
    let corner_configs = [
        ([0.0, 0.0], -hw, -hh, "dol_lewo", "FACE_X_MINUS", "FACE_Y_MINUS"),
        ([w, 0.0], hw, -hh, "dol_prawo", "FACE_X_PLUS", "FACE_Y_MINUS"),
        ([w, h], hw, hh, "gora_prawo", "FACE_X_PLUS", "FACE_Y_PLUS"),
        ([0.0, h], -hw, hh, "gora_lewo", "FACE_X_MINUS", "FACE_Y_PLUS"),
    ];
    for (uv, cx, cy, key, f1, f2) in corner_configs {
        let top_cut = non_hole_depth_at(&features, true, uv, None);
        let bot_cut = non_hole_depth_at(&features, false, uv, None);
        let top_z = ht - top_cut;
        let bot_z = -ht + bot_cut;
        if top_z - bot_z > CRIT_EPS {
            push_edge_full(
                &mut edge_out,
                key.to_string(),
                Some(key.to_string()),
                vec![
                    [cx as f32, cy as f32, bot_z as f32],
                    [cx as f32, cy as f32, top_z as f32],
                ],
                None,
                Some(vec![f1.to_string(), f2.to_string()]),
            );
        }
    }
    }

    append_feature_edges(&mut edge_out, &features, w, h, t);

    let brep_model = brep.build();
    let vertices = brep_model
        .vertices
        .iter()
        .map(|p| vec![p.x as f32, p.y as f32, p.z as f32])
        .collect();
    let brep_faces = brep_model
        .faces
        .iter()
        .map(|f| {
            let loops = f
                .loops
                .iter()
                .map(|lp| lp.iter().map(|v| v.0).collect::<Vec<usize>>())
                .collect::<Vec<Vec<usize>>>();
            (f.tag.clone(), loops, f.area)
        })
        .collect();

    Ok(PanelBuildResult {
        meshes,
        edges: edge_out,
        vertices,
        topology: brep_model.summary,
        brep_faces,
        side_edge_keys,
    })
}

#[allow(clippy::too_many_arguments)]
fn emit_wall(
    meshes: &mut HashMap<String, FaceMesh>,
    brep: &mut BRepBuilder,
    a: P2,
    b: P2,
    z0: f64,
    z1: f64,
    key: &str,
    w: f64,
    h: f64,
    material_left: bool,
) {
    if z1 - z0 <= 1e-7 {
        return;
    }
    let (mut aa, mut bb) = (a, b);
    if !material_left {
        std::mem::swap(&mut aa, &mut bb);
    }
    let mesh = meshes.entry(key.to_string()).or_default();
    add_vertical_quad(mesh, aa, bb, z0, z1, w, h);

    let p0 = to3d("FACE_Z_PLUS", aa[0], aa[1], z0, w, h);
    let p1 = to3d("FACE_Z_PLUS", bb[0], bb[1], z0, w, h);
    let p2 = to3d("FACE_Z_PLUS", bb[0], bb[1], z1, w, h);
    let p3 = to3d("FACE_Z_PLUS", aa[0], aa[1], z1, w, h);
    let edge1 = Vec3::new(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    let edge2 = Vec3::new(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]);
    let normal = edge1.cross(edge2);
    let len = normal.length().max(1e-12);
    brep.add_face(
        key,
        vec![vec![
            Vec3::new(p0[0], p0[1], p0[2]),
            Vec3::new(p1[0], p1[1], p1[2]),
            Vec3::new(p2[0], p2[1], p2[2]),
            Vec3::new(p3[0], p3[1], p3[2]),
        ]],
        Vec3::new(normal.x / len, normal.y / len, normal.z / len),
    );
}

fn point_feature_depth_at(
    features: &[CutFeature],
    top: bool,
    p: P2,
    exclude: Option<usize>,
) -> f64 {
    let mut best: f64 = 0.0;
    for (idx, f) in features.iter().enumerate() {
        if Some(idx) == exclude || f.top != top {
            continue;
        }
        if point_in_polygon(p, &f.global_poly) {
            best = best.max(f.depth);
        }
    }
    best
}

/// Najgłębsza cecha powierzchniowa (cutout/pocket/groove) w punkcie — bez otworów.
fn non_hole_depth_at(
    features: &[CutFeature],
    top: bool,
    p: P2,
    exclude: Option<usize>,
) -> f64 {
    let mut best: f64 = 0.0;
    for (idx, f) in features.iter().enumerate() {
        if Some(idx) == exclude || f.top != top || f.kind == CutKind::Hole {
            continue;
        }
        if point_in_polygon(p, &f.global_poly) {
            best = best.max(f.depth);
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    fn f(id: &str, kind: &str, face: &str, u: f64, v: f64, w: f64, l: f64, depth: f64, through: bool) -> FeatureInputMm {
        FeatureInputMm {
            id: id.to_string(),
            kind: kind.to_string(),
            face: face.to_string(),
            u_mm: u,
            v_mm: v,
            w_mm: Some(w),
            l_mm: Some(l),
            depth_mm: Some(depth),
            diameter_mm: None,
            through,
            polygon: None,
        }
    }

    fn unbalanced_edges(res: &PanelBuildResult) -> Vec<((usize, usize), (usize, usize))> {
        use std::collections::HashMap;
        let mut map: HashMap<(usize, usize), i32> = HashMap::new();
        for (_, loops, _) in &res.brep_faces {
            for lp in loops {
                for i in 0..lp.len() {
                    let a = lp[i];
                    let b = lp[(i + 1) % lp.len()];
                    *map.entry((a, b)).or_insert(0) += 1;
                }
            }
        }
        let mut out = Vec::new();
        for (&(a, b), &count) in &map {
            let rev = map.get(&(b, a)).copied().unwrap_or(0);
            if count != rev {
                out.push(((a, b), (count as usize, rev as usize)));
            }
        }
        out
    }

    fn xy_area(mesh: &crate::mesh::FaceMesh) -> f64 {
        let mut total = 0.0;
        for tri in mesh.indices.chunks_exact(3) {
            let mut p = [[0.0f64; 2]; 3];
            for (k, &idx) in tri.iter().enumerate() {
                p[k] = [
                    mesh.positions[idx as usize * 3] as f64,
                    mesh.positions[idx as usize * 3 + 1] as f64,
                ];
            }
            total += ((p[1][0] - p[0][0]) * (p[2][1] - p[0][1])
                - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]))
                .abs()
                * 0.5;
        }
        total
    }

    fn z_levels(mesh: &crate::mesh::FaceMesh) -> Vec<f64> {
        let mut zs: Vec<f64> = mesh
            .positions
            .chunks_exact(3)
            .map(|p| (p[2] as f64 * 1000.0).round() / 1000.0)
            .collect();
        zs.sort_by(|a, b| a.partial_cmp(b).unwrap());
        zs.dedup();
        zs
    }

    fn assert_watertight(res: &PanelBuildResult, label: &str) {
        let bad = unbalanced_edges(res);
        for ((a, b), (ca, cb)) in &bad {
            eprintln!(
                "{label}: unbalanced {:?} -> {:?} ({} vs {}), verts {:?} {:?}",
                a, b, ca, cb, res.vertices[*a], res.vertices[*b]
            );
        }
        assert!(bad.is_empty(), "{label}: unbalanced edges: {}", bad.len());
        assert!(res.topology.watertight, "{label}: {:#?}", res.topology);
        assert!(res.topology.degenerate_faces == 0, "{label}: {:#?}", res.topology);
    }

    fn panel(features: Vec<FeatureInputMm>) -> PanelBuildResult {
        build_panel(&PanelInputMm {
            width: 500.0,
            height: 800.0,
            thickness: 18.0,
            features,
            outline: None,
        })
        .expect("panel")
    }

    #[test]
    fn cross_revision_pocket_is_watertight() {
        let res = panel(vec![
            f("feat_rewizja", "cutout", "FACE_Z_PLUS", 100.0, 20.0, 120.0, 140.0, 18.0, true),
            f("feat_ramka", "pocket", "FACE_Z_PLUS", 60.0, 60.0, 380.0, 680.0, 3.0, false),
        ]);
        assert_watertight(&res, "cross");

        assert!((xy_area(&res.meshes["FACE_Z_MINUS"]) - 383200.0).abs() < 1e-3);
        assert!((xy_area(&res.meshes["FACE_Z_PLUS"]) - 136800.0).abs() < 1e-3);
        assert!((xy_area(&res.meshes["feature_feat_ramka_bottom"]) - 246400.0).abs() < 1e-3);
        assert_eq!(z_levels(&res.meshes["feature_feat_rewizja_w3"]), vec![-9.0, 6.0, 9.0]);
    }

    #[test]
    fn inside_revision_pocket_has_expected_areas() {
        let res = panel(vec![
            f("feat_rewizja", "cutout", "FACE_Z_PLUS", 100.0, 80.0, 120.0, 80.0, 18.0, true),
            f("feat_ramka", "pocket", "FACE_Z_PLUS", 60.0, 60.0, 380.0, 680.0, 3.0, false),
        ]);
        assert_watertight(&res, "inside");
        assert!((xy_area(&res.meshes["FACE_Z_PLUS"]) - 141600.0).abs() < 1e-3);
        assert!((xy_area(&res.meshes["FACE_Z_MINUS"]) - 390400.0).abs() < 1e-3);
        assert!((xy_area(&res.meshes["feature_feat_ramka_bottom"]) - 248800.0).abs() < 1e-3);
        for w in ["w0", "w1", "w2", "w3"] {
            assert_eq!(z_levels(&res.meshes[&format!("feature_feat_rewizja_{w}")]), vec![-9.0, 6.0]);
        }
    }

    #[test]
    fn edge_revision_is_watertight_and_matches_areas() {
        let res = panel(vec![
            f("feat_rewizja_edge", "cutout", "FACE_Z_PLUS", 0.0, 80.0, 120.0, 80.0, 18.0, true),
            f("feat_ramka", "pocket", "FACE_Z_PLUS", 60.0, 60.0, 380.0, 680.0, 3.0, false),
        ]);
        assert_watertight(&res, "edge-revision");
        assert!((xy_area(&res.meshes["FACE_Z_PLUS"]) - 136800.0).abs() < 1e-3);
        assert!((xy_area(&res.meshes["feature_feat_ramka_bottom"]) - 253600.0).abs() < 1e-3);
    }

    #[test]
    fn z_minus_features_mirror_top_geometry() {
        let res = panel(vec![
            f("feat_rewizja", "cutout", "FACE_Z_MINUS", 100.0, 20.0, 120.0, 140.0, 18.0, true),
            f("feat_ramka", "pocket", "FACE_Z_MINUS", 60.0, 60.0, 380.0, 680.0, 3.0, false),
        ]);
        assert_watertight(&res, "zminus");
        assert!((xy_area(&res.meshes["FACE_Z_MINUS"]) - 136800.0).abs() < 1e-3);
        assert!((xy_area(&res.meshes["FACE_Z_PLUS"]) - 383200.0).abs() < 1e-3);
        assert!((xy_area(&res.meshes["feature_feat_ramka_bottom"]) - 246400.0).abs() < 1e-3);
        // Lustrzane odbicie: dno kieszeni na Z_MINUS leży na -6.
        assert_eq!(z_levels(&res.meshes["feature_feat_rewizja_w3"]), vec![-9.0, -6.0, 9.0]);
    }

    #[test]
    fn through_and_blind_holes_are_watertight() {
        let mut through = f("h_through", "hole", "FACE_Z_PLUS", 100.0, 100.0, 0.0, 0.0, 18.0, true);
        through.diameter_mm = Some(35.0);
        let mut blind = f("h_blind", "hole", "FACE_Z_PLUS", 300.0, 400.0, 0.0, 0.0, 12.5, false);
        blind.diameter_mm = Some(35.0);
        let res = panel(vec![through, blind]);
        assert_watertight(&res, "holes");

        // Otwór przelotowy nie zostawia dna, ślepy ma dno na Z = -3.5.
        assert_eq!(z_levels(&res.meshes["FACE_Z_PLUS"]), vec![-9.0, -3.5, 9.0]);
        let hole_edges: Vec<_> = res
            .edges
            .iter()
            .filter(|e| e.key.starts_with("e_hole_"))
            .map(|e| e.key.clone())
            .collect();
        assert!(hole_edges.iter().any(|k| k == "e_hole_h_through"));
        assert!(hole_edges.iter().any(|k| k == "e_hole_h_blind"));
    }

    #[test]
    fn blind_hole_inside_pocket_starts_at_pocket_floor() {
        let mut hole = f("h", "hole", "FACE_Z_PLUS", 250.0, 400.0, 0.0, 0.0, 12.5, false);
        hole.diameter_mm = Some(35.0);
        let res = panel(vec![
            f("feat_ramka", "pocket", "FACE_Z_PLUS", 60.0, 60.0, 380.0, 680.0, 3.0, false),
            hole,
        ]);
        assert_watertight(&res, "hole-in-pocket");
        let edge = res
            .edges
            .iter()
            .find(|e| e.key == "e_hole_h")
            .expect("hole edge");
        for p in &edge.points {
            assert!((p[2] - 6.0).abs() < 1e-4, "hole rim z = {}", p[2]);
        }
    }

    #[test]
    fn nested_pockets_are_watertight() {
        let res = panel(vec![
            f("p1", "pocket", "FACE_Z_PLUS", 50.0, 50.0, 300.0, 500.0, 3.0, false),
            f("p2", "pocket", "FACE_Z_PLUS", 100.0, 100.0, 200.0, 400.0, 6.0, false),
            f("p3", "pocket", "FACE_Z_PLUS", 150.0, 200.0, 100.0, 200.0, 9.0, false),
        ]);
        assert_watertight(&res, "nested");
        assert_eq!(z_levels(&res.meshes["FACE_Z_PLUS"]), vec![9.0]);
        assert_eq!(z_levels(&res.meshes["feature_p1_bottom"]), vec![6.0]);
        assert_eq!(z_levels(&res.meshes["feature_p2_bottom"]), vec![3.0]);
        assert_eq!(z_levels(&res.meshes["feature_p3_bottom"]), vec![0.0]);
    }

    #[test]
    fn edge_feature_keeps_key_identity_and_is_watertight() {
        let res = panel(vec![f("g", "groove", "FACE_Z_PLUS", 13.0, 7.0, 3.0, 786.0, 11.0, false)]);
        assert_watertight(&res, "groove");
        let keys: Vec<_> = res.edges.iter().map(|e| e.key.as_str()).collect();
        for suffix in ["t1", "t2", "t3", "t4", "b1", "b2", "b3", "b4", "v1", "v2", "v3", "v4"] {
            assert!(
                keys.contains(&format!("e_groove_g_{suffix}").as_str()),
                "missing e_groove_g_{suffix}"
            );
        }
    }

    #[test]
    fn feature_at_panel_corner_does_not_duplicate_outline_edges() {
        // Kieszeń w narożniku (u=0, v=0) — jej ścianki pokrywają się z obrysem formatki,
        // więc krawędzie t1/t4 i pionowa v1 nie mogą być raportowane jako krawędzie cechy.
        let res = panel(vec![f("g", "pocket", "FACE_Z_PLUS", 0.0, 0.0, 100.0, 100.0, 3.0, false)]);
        assert_watertight(&res, "corner-pocket");
        let keys: Vec<_> = res.edges.iter().map(|e| e.key.as_str()).collect();
        assert!(!keys.contains(&"e_groove_g_t1"), "t1 lies on the outline");
        assert!(!keys.contains(&"e_groove_g_t4"), "t4 lies on the outline");
        assert!(!keys.contains(&"e_groove_g_v1"), "v1 is the panel corner");
        // Przeciwległy narożnik leży wewnątrz materiału — krawędź pionowa pozostaje.
        assert!(keys.contains(&"e_groove_g_v3"));
    }
}

fn on_outer_contour(a: P2, b: P2, w: f64, h: f64) -> bool {
    let eps = 1e-7;
    let horizontal = (a[1] - b[1]).abs() <= eps;
    let vertical = (a[0] - b[0]).abs() <= eps;
    if horizontal {
        a[1].abs() <= eps || (a[1] - h).abs() <= eps
    } else if vertical {
        a[0].abs() <= eps || (a[0] - w).abs() <= eps
    } else {
        false
    }
}

fn split_segment_by_features(
    a: P2,
    b: P2,
    features: &[CutFeature],
    exclude_idx: usize,
) -> Vec<(P2, P2)> {
    let eps = 1e-6;
    let mut ts = vec![0.0f64, 1.0f64];
    let is_horizontal = (a[1] - b[1]).abs() <= eps;
    let is_vertical = (a[0] - b[0]).abs() <= eps;

    let len = ((b[0] - a[0]).powi(2) + (b[1] - a[1]).powi(2)).sqrt();
    if len <= eps {
        return Vec::new();
    }

    for (idx, f) in features.iter().enumerate() {
        if idx == exclude_idx || f.kind == CutKind::Hole {
            continue;
        }
        if let Some(r) = f.local_rect {
            if is_horizontal {
                let y = a[1];
                if y >= r.v0 - eps && y <= r.v1 + eps {
                    for u in [r.u0, r.u1] {
                        let t_val = (u - a[0]) / (b[0] - a[0]);
                        if t_val > eps && t_val < 1.0 - eps {
                            ts.push(t_val);
                        }
                    }
                }
            } else if is_vertical {
                let x = a[0];
                if x >= r.u0 - eps && x <= r.u1 + eps {
                    for v in [r.v0, r.v1] {
                        let t_val = (v - a[1]) / (b[1] - a[1]);
                        if t_val > eps && t_val < 1.0 - eps {
                            ts.push(t_val);
                        }
                    }
                }
            }
        }
    }

    ts.sort_by(|x, y| x.partial_cmp(y).unwrap());
    ts.dedup_by(|x, y| (*x - *y).abs() <= eps);

    let mut segs = Vec::with_capacity(ts.len() - 1);
    for i in 0..ts.len() - 1 {
        let t0 = ts[i];
        let t1 = ts[i + 1];
        let p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
        let p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
        segs.push((p0, p1));
    }
    segs
}

fn append_feature_edges(
    out: &mut Vec<EdgeOutput>,
    features: &[CutFeature],
    w: f64,
    h: f64,
    t: f64,
) {
    // Poligony przelotowe w lokalnym UV każdego lica (do przycinania krawędzi).
    let mut through_local_plus: Vec<Vec<P2>> = Vec::new();
    let mut through_local_minus: Vec<Vec<P2>> = Vec::new();
    for f in features {
        if (f.depth - t).abs() > CRIT_EPS {
            continue;
        }
        if f.top {
            through_local_plus.push(f.local_poly.clone());
            through_local_minus.push(f.local_poly.iter().map(|p| [w - p[0], p[1]]).collect());
        } else {
            through_local_minus.push(f.local_poly.clone());
            through_local_plus.push(f.local_poly.iter().map(|p| [w - p[0], p[1]]).collect());
        }
    }

    for (idx, f) in features.iter().enumerate() {
        if f.kind == CutKind::Hole {
            // Poziom Z początku otworu — jeśli otwór leży wewnątrz kieszeni (ramki),
            // zaczyna się od jej dna, a nie od nominalnego lica Z = +9!
            let start_d = non_hole_depth_at(features, f.top, f.center, Some(idx));
            let face_z = feature_face_z(f, t, start_d);
            let mut pts: Vec<[f32; 3]> = f
                .local_poly
                .iter()
                .map(|p| {
                    let p3 = to3d(&f.face, p[0], p[1], face_z, w, h);
                    [p3[0] as f32, p3[1] as f32, p3[2] as f32]
                })
                .collect();
            if let Some(&first) = pts.first() {
                pts.push(first);
            }
            push_edge(out, format!("e_hole_{}", f.id), pts);
            continue;
        }

        let r = match f.local_rect {
            Some(r) => r,
            None => continue,
        };
        let top_z = feature_face_z(f, t, 0.0);
        let bot_z = feature_face_z(f, t, f.depth);
        let local_through: &[Vec<P2>] = if f.top {
            &through_local_plus
        } else {
            &through_local_minus
        };
        // Nie przycinamy krawędzi własnym poligonem, jeśli cecha jest przelotowa.
        let mut clip_holes: Vec<Vec<P2>> = local_through.to_vec();
        if (f.depth - t).abs() <= CRIT_EPS {
            clip_holes.retain(|poly| {
                !(poly.len() == f.local_poly.len()
                    && poly
                        .iter()
                        .zip(f.local_poly.iter())
                        .all(|(a, b)| (a[0] - b[0]).abs() < 1e-7 && (a[1] - b[1]).abs() < 1e-7))
            });
        }

        let sides: [(&str, P2, P2); 4] = [
            ("t1", [r.u0, r.v0], [r.u1, r.v0]),
            ("t2", [r.u1, r.v0], [r.u1, r.v1]),
            ("t3", [r.u1, r.v1], [r.u0, r.v1]),
            ("t4", [r.u0, r.v1], [r.u0, r.v0]),
        ];
        let bsides: [(&str, P2, P2); 4] = [
            ("b1", [r.u0, r.v0], [r.u1, r.v0]),
            ("b2", [r.u1, r.v0], [r.u1, r.v1]),
            ("b3", [r.u1, r.v1], [r.u0, r.v1]),
            ("b4", [r.u0, r.v1], [r.u0, r.v0]),
        ];
        let through = (f.depth - t).abs() <= CRIT_EPS;
        let on_contour = |a: P2, b: P2| on_outer_contour(a, b, w, h);

        for (name, a, b) in sides {
            // Krawędź na obrysie zewnętrznym to krawędź nominalna, nie cechy.
            if on_contour(a, b) {
                continue;
            }
            let subsegs = split_segment_by_features(a, b, features, idx);
            let mut prev_top_z: Option<f64> = None;
            let mut seg_counter = 0usize;

            for (sa, sb) in subsegs {
                let mid = [(sa[0] + sb[0]) * 0.5, (sa[1] + sb[1]) * 0.5];
                let g_mid = if f.top { mid } else { [w - mid[0], mid[1]] };

                // Jeśli w świetle innej cechy przelotowej - materiał wycięty na wylot
                if clip_holes.iter().any(|poly| point_in_polygon(mid, poly)) {
                    prev_top_z = None;
                    continue;
                }

                let other_d = non_hole_depth_at(features, f.top, g_mid, Some(idx));
                if other_d >= f.depth - CRIT_EPS {
                    // Materiał wybrany przez cechę o równej lub większej głębokości
                    prev_top_z = None;
                    continue;
                }

                let cur_top_z = feature_face_z(f, t, other_d);

                // Pionowy uskok (step) na granicy podziału
                if let Some(pz) = prev_top_z {
                    if (pz - cur_top_z).abs() > CRIT_EPS {
                        let step_pa = to3d(&f.face, sa[0], sa[1], pz, w, h);
                        let step_pb = to3d(&f.face, sa[0], sa[1], cur_top_z, w, h);
                        push_edge(
                            out,
                            format!("e_groove_{}_{}_step{}", f.id, name, seg_counter),
                            vec![
                                [step_pa[0] as f32, step_pa[1] as f32, step_pa[2] as f32],
                                [step_pb[0] as f32, step_pb[1] as f32, step_pb[2] as f32],
                            ],
                        );
                    }
                }
                prev_top_z = Some(cur_top_z);

                let key = if seg_counter == 0 {
                    format!("e_groove_{}_{}", f.id, name)
                } else {
                    format!("e_groove_{}_{}_seg{}", f.id, name, seg_counter + 1)
                };
                seg_counter += 1;

                let pa = to3d(&f.face, sa[0], sa[1], cur_top_z, w, h);
                let pb = to3d(&f.face, sb[0], sb[1], cur_top_z, w, h);
                push_edge(
                    out,
                    key,
                    vec![
                        [pa[0] as f32, pa[1] as f32, pa[2] as f32],
                        [pb[0] as f32, pb[1] as f32, pb[2] as f32],
                    ],
                );
            }
        }

        for (name, a, b) in bsides {
            if through && on_contour(a, b) {
                continue;
            }
            let subsegs = split_segment_by_features(a, b, features, idx);
            let mut seg_counter = 0usize;

            for (sa, sb) in subsegs {
                let mid = [(sa[0] + sb[0]) * 0.5, (sa[1] + sb[1]) * 0.5];
                let g_mid = if f.top { mid } else { [w - mid[0], mid[1]] };

                // Jeśli w świetle innej cechy przelotowej - materiał wycięty na wylot
                if clip_holes.iter().any(|poly| point_in_polygon(mid, poly)) {
                    continue;
                }

                if !through {
                    let other_d = non_hole_depth_at(features, f.top, g_mid, Some(idx));
                    if other_d >= f.depth - CRIT_EPS {
                        // Dno wycięte przez głębszą cechę
                        continue;
                    }
                }

                let key = if seg_counter == 0 {
                    format!("e_groove_{}_{}", f.id, name)
                } else {
                    format!("e_groove_{}_{}_seg{}", f.id, name, seg_counter + 1)
                };
                seg_counter += 1;

                let pa = to3d(&f.face, sa[0], sa[1], bot_z, w, h);
                let pb = to3d(&f.face, sb[0], sb[1], bot_z, w, h);
                push_edge(
                    out,
                    key,
                    vec![
                        [pa[0] as f32, pa[1] as f32, pa[2] as f32],
                        [pb[0] as f32, pb[1] as f32, pb[2] as f32],
                    ],
                );
            }
        }

        // Krawędzie pionowe narożników — tylko jeśli nie leżą w innym przelocie
        // i jeśli nad/pod dnem cechy pozostaje materiał.
        let corners: [(&str, P2); 4] = [
            ("v1", [r.u0, r.v0]),
            ("v2", [r.u1, r.v0]),
            ("v3", [r.u1, r.v1]),
            ("v4", [r.u0, r.v1]),
        ];
        let corner_on_contour = |name: &str, p: P2| -> bool {
            let eps = 1e-7;
            let at_u0 = p[0].abs() <= eps;
            let at_u1 = (p[0] - w).abs() <= eps;
            let at_v0 = p[1].abs() <= eps;
            let at_v1 = (p[1] - h).abs() <= eps;
            match name {
                "v1" => at_u0 && at_v0,
                "v2" => at_u1 && at_v0,
                "v3" => at_u1 && at_v1,
                "v4" => at_u0 && at_v1,
                _ => false,
            }
        };

        for (name, p) in corners {
            // Narożnik leżący na obrysie zewnętrznym to krawędź nominalna, nie cechy —
            // niezależnie od tego, czy cecha jest przelotowa (zgodnie z silnikiem TS).
            if corner_on_contour(name, p) {
                continue;
            }
            if clip_holes.iter().any(|poly| point_in_polygon(p, poly)) {
                continue;
            }
            let global_p = if f.top { p } else { [w - p[0], p[1]] };
            let other_depth = point_feature_depth_at(features, f.top, global_p, Some(idx));
            if other_depth >= f.depth - 1e-6 {
                continue;
            }
            let other_z = if f.top {
                t * 0.5 - other_depth
            } else {
                -t * 0.5 + other_depth
            };
            let (z0, z1) = if f.top {
                (bot_z, other_z)
            } else {
                (other_z, bot_z)
            };
            if (z1 - z0).abs() <= 1e-6 {
                continue;
            }
            let pa = to3d(&f.face, p[0], p[1], z0, w, h);
            let pb = to3d(&f.face, p[0], p[1], z1, w, h);
            push_edge(
                out,
                format!("e_groove_{}_{}", f.id, name),
                vec![
                    [pa[0] as f32, pa[1] as f32, pa[2] as f32],
                    [pb[0] as f32, pb[1] as f32, pb[2] as f32],
                ],
            );
        }
    }
}
