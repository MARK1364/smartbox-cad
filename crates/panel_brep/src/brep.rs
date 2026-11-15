//! Lekka, jawna struktura B-Rep: wierzchołki, krawędzie (pary wierzchołków),
//! half-edges (pętle ścian) oraz ściany z tagami pochodzenia.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::geom::Vec3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct VertexId(pub usize);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct EdgeId(pub usize);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopologySummary {
    pub vertices: usize,
    pub edges: usize,
    pub half_edges: usize,
    pub faces: usize,
    pub loops: usize,
    pub watertight: bool,
    pub boundary_edges: usize,
    pub non_manifold_edges: usize,
    pub degenerate_faces: usize,
    pub volume: f64,
}

impl Default for TopologySummary {
    fn default() -> Self {
        Self {
            vertices: 0,
            edges: 0,
            half_edges: 0,
            faces: 0,
            loops: 0,
            watertight: false,
            boundary_edges: 0,
            non_manifold_edges: 0,
            degenerate_faces: 0,
            volume: 0.0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct BrepFace {
    pub tag: String,
    pub normal: Vec3,
    pub loops: Vec<Vec<VertexId>>,
    pub area: f64,
}

#[derive(Debug, Clone, Default)]
pub struct BRep {
    pub vertices: Vec<Vec3>,
    pub faces: Vec<BrepFace>,
    pub edges: Vec<(VertexId, VertexId)>,
    pub summary: TopologySummary,
}

#[derive(Default)]
pub struct BRepBuilder {
    vertices: Vec<Vec3>,
    vertex_map: HashMap<(i64, i64, i64), usize>,
    faces: Vec<BrepFace>,
}

fn key_for(p: Vec3) -> (i64, i64, i64) {
    const SCALE: f64 = 10_000.0; // 0.1 µm
    (
        (p.x * SCALE).round() as i64,
        (p.y * SCALE).round() as i64,
        (p.z * SCALE).round() as i64,
    )
}

impl BRepBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    fn vertex_id(&mut self, p: Vec3) -> VertexId {
        let key = key_for(p);
        if let Some(&idx) = self.vertex_map.get(&key) {
            return VertexId(idx);
        }
        let idx = self.vertices.len();
        self.vertices.push(p);
        self.vertex_map.insert(key, idx);
        VertexId(idx)
    }

    /// Dodaje ścianę. Każda pętla jest listą punktów (bez powtórzonego końca).
    pub fn add_face(&mut self, tag: &str, loops: Vec<Vec<Vec3>>, normal: Vec3) {
        let mut vloops: Vec<Vec<VertexId>> = Vec::new();
        let mut area = 0.0;
        for pts in loops {
            let mut cleaned: Vec<Vec3> = Vec::with_capacity(pts.len());
            for p in pts {
                if let Some(last) = cleaned.last() {
                    if (last.x - p.x).abs() < 1e-8
                        && (last.y - p.y).abs() < 1e-8
                        && (last.z - p.z).abs() < 1e-8
                    {
                        continue;
                    }
                }
                cleaned.push(p);
            }
            if cleaned.len() > 1 {
                let first = cleaned[0];
                let last = cleaned[cleaned.len() - 1];
                if (first.x - last.x).abs() < 1e-8
                    && (first.y - last.y).abs() < 1e-8
                    && (first.z - last.z).abs() < 1e-8
                {
                    cleaned.pop();
                }
            }
            if cleaned.len() < 3 {
                continue;
            }
            area += polygon_area_3d(&cleaned);
            vloops.push(cleaned.into_iter().map(|p| self.vertex_id(p)).collect());
        }
        if vloops.is_empty() {
            return;
        }
        self.faces.push(BrepFace {
            tag: tag.to_string(),
            normal,
            loops: vloops,
            area,
        });
    }

    pub fn build(self) -> BRep {
        // Usuwamy T-junctions: każdą krawędź pętli dzielimy we wszystkich
        // istniejących wierzchołkach, które leżą na niej ściśle wewnątrz.
        // Dzięki temu krawędzie współdzielone przez sąsiednie ściany mają
        // identyczny podział i topologia może być domknięta.
        let mut faces = self.faces;
        let split_index = SplitIndex::new(&self.vertices);
        for face in &mut faces {
            for lp in &mut face.loops {
                *lp = split_index.split_loop(&self.vertices, lp);
            }
        }

        let mut edge_uses: HashMap<(usize, usize), (usize, i32)> = HashMap::new();
        let mut half_edges = 0usize;
        let mut loops = 0usize;
        let mut degenerate_faces = 0usize;

        for face in &faces {
            if face.area.abs() < 1e-9 {
                degenerate_faces += 1;
            }
            for lp in &face.loops {
                loops += 1;
                for i in 0..lp.len() {
                    let a = lp[i].0;
                    let b = lp[(i + 1) % lp.len()].0;
                    if a == b {
                        degenerate_faces += 1;
                        continue;
                    }
                    half_edges += 1;
                    let key = if a < b { (a, b) } else { (b, a) };
                    let balance = if a < b { 1 } else { -1 };
                    let entry = edge_uses.entry(key).or_insert((0, 0));
                    entry.0 += 1;
                    entry.1 += balance;
                }
            }
        }

        let mut boundary_edges = 0usize;
        let mut non_manifold_edges = 0usize;
        let mut edges = Vec::with_capacity(edge_uses.len());
        for (key, (count, balance)) in &edge_uses {

            edges.push((VertexId(key.0), VertexId(key.1)));
            if *count == 1 {
                boundary_edges += 1;
            } else if *count > 2 {
                non_manifold_edges += 1;
            } else if *balance != 0 {
                // Dwie użycia w tej samej orientacji — nieszczelna orientacja.
                non_manifold_edges += 1;
            }
        }

        let volume = compute_volume(&self.vertices, &faces);
        let watertight = boundary_edges == 0 && non_manifold_edges == 0 && degenerate_faces == 0;
        let face_count = faces.len();

        BRep {
            vertices: self.vertices.clone(),
            faces,
            edges,
            summary: TopologySummary {
                vertices: self.vertices.len(),
                edges: edge_uses.len(),
                half_edges,
                faces: face_count,
                loops,
                watertight,
                boundary_edges,
                non_manifold_edges,
                degenerate_faces,
                volume,
            },
        }
    }
}

/// Indeks wierzchołków pozwalający szybko znaleźć kandydatów do podziału
/// osiowo wyrównanej krawędzi (T-junction).
struct SplitIndex {
    /// Współliniowe krawędzie pionowe: (x, y) -> wierzchołki.
    columns: HashMap<(i64, i64), Vec<usize>>,
    /// Krawędzie wzdłuż X: (y, z) -> wierzchołki.
    along_x: HashMap<(i64, i64), Vec<usize>>,
    /// Krawędzie wzdłuż Y: (x, z) -> wierzchołki.
    along_y: HashMap<(i64, i64), Vec<usize>>,
}

const SPLIT_SCALE: f64 = 10_000.0;

fn split_key(a: f64, b: f64) -> (i64, i64) {
    (
        (a * SPLIT_SCALE).round() as i64,
        (b * SPLIT_SCALE).round() as i64,
    )
}

impl SplitIndex {
    fn new(vertices: &[Vec3]) -> Self {
        let mut columns: HashMap<(i64, i64), Vec<usize>> = HashMap::new();
        let mut along_x: HashMap<(i64, i64), Vec<usize>> = HashMap::new();
        let mut along_y: HashMap<(i64, i64), Vec<usize>> = HashMap::new();
        for (i, p) in vertices.iter().enumerate() {
            columns.entry(split_key(p.x, p.y)).or_default().push(i);
            along_x.entry(split_key(p.y, p.z)).or_default().push(i);
            along_y.entry(split_key(p.x, p.z)).or_default().push(i);
        }
        Self {
            columns,
            along_x,
            along_y,
        }
    }

    /// Wstawia w pętlę wierzchołki leżące ściśle na jej osiowych krawędziach.
    /// Eliminuje to T-junctions bez zmiany geometrii ściany.
    fn split_loop(&self, vertices: &[Vec3], lp: &[VertexId]) -> Vec<VertexId> {
        if lp.len() < 2 {
            return lp.to_vec();
        }
        const EPS: f64 = 1e-9;
        let mut out: Vec<VertexId> = Vec::with_capacity(lp.len());
        for i in 0..lp.len() {
            let a = lp[i];
            let b = lp[(i + 1) % lp.len()];
            out.push(a);

            let pa = vertices[a.0];
            let pb = vertices[b.0];
            let dx = (pb.x - pa.x).abs() <= EPS;
            let dy = (pb.y - pa.y).abs() <= EPS;
            let dz = (pb.z - pa.z).abs() <= EPS;

            let candidates: Option<(&Vec<usize>, u8)> = if dx && dy {
                self.columns
                    .get(&split_key(pa.x, pa.y))
                    .map(|v| (v, 2))
            } else if dy && dz {
                self.along_x.get(&split_key(pa.y, pa.z)).map(|v| (v, 0))
            } else if dx && dz {
                self.along_y.get(&split_key(pa.x, pa.z)).map(|v| (v, 1))
            } else {
                None
            };
            let Some((candidates, axis)) = candidates else {
                continue;
            };

            let (lo, hi) = match axis {
                0 => (pa.x.min(pb.x), pa.x.max(pb.x)),
                1 => (pa.y.min(pb.y), pa.y.max(pb.y)),
                _ => (pa.z.min(pb.z), pa.z.max(pb.z)),
            };
            let mut splits: Vec<(f64, usize)> = Vec::new();
            for &vi in candidates {
                if vi == a.0 || vi == b.0 {
                    continue;
                }
                let p = vertices[vi];
                let value = match axis {
                    0 => p.x,
                    1 => p.y,
                    _ => p.z,
                };
                if value <= lo + 1e-9 || value >= hi - 1e-9 {
                    continue;
                }
                splits.push((value, vi));
            }
            if splits.is_empty() {
                continue;
            }
            splits.sort_by(|x, y| x.0.partial_cmp(&y.0).unwrap_or(std::cmp::Ordering::Equal));
            for (_, vi) in splits {
                if let Some(&last) = out.last() {
                    if last.0 != vi {
                        out.push(VertexId(vi));
                    }
                }
            }
        }
        out
    }
}

fn polygon_area_3d(poly: &[Vec3]) -> f64 {
    if poly.len() < 3 {
        return 0.0;
    }
    let mut acc = Vec3::new(0.0, 0.0, 0.0);
    for i in 0..poly.len() {
        let a = poly[i];
        let b = poly[(i + 1) % poly.len()];
        let c = a.cross(b);
        acc.x += c.x;
        acc.y += c.y;
        acc.z += c.z;
    }
    acc.length() * 0.5
}

fn compute_volume(vertices: &[Vec3], faces: &[BrepFace]) -> f64 {
    // Objętość z fan-triangulacji każdej pętli (twierdzenie o dywergencji).
    let mut vol = 0.0;
    for face in faces {
        for lp in &face.loops {
            if lp.len() < 3 {
                continue;
            }
            let a = vertices[lp[0].0];
            for i in 1..lp.len() - 1 {
                let b = vertices[lp[i].0];
                let c = vertices[lp[i + 1].0];
                vol += a.x * (b.y * c.z - b.z * c.y)
                    - a.y * (b.x * c.z - b.z * c.x)
                    + a.z * (b.x * c.y - b.y * c.x);
            }
        }
    }
    (vol / 6.0).abs()
}
