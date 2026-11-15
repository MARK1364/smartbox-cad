//! Natywna geometria ramek aluminiowych ze szkłem (ALU_FRAME) w Rust.
//! Obsługuje zarówno ramki jednolite z zaokrągleniami (profil 2D z promieniami r),
//! jak i tradycyjne ramki z 4 profili ciętych pod kątem 45 stopni.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::geom::{discretize_polygon_with_fillets, ensure_ccw, signed_area, P2};
use crate::{CadEdgeData, FaceMeshData, PanelMeshOutput};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AluFrameInput {
    pub w_mm: f64,
    pub h_mm: f64,
    pub t_mm: f64,
    pub pw_mm: f64,
    pub glass_t_mm: f64,
    pub lip_depth_mm: f64,
    pub clearance_mm: f64,
    pub fillet_mm: Option<f64>,
    pub inner_fillet_mm: Option<f64>,
    pub frame_type: Option<String>,
}

fn push_tri(pos: &mut Vec<f32>, idx: &mut Vec<u32>, a: [f64; 3], b: [f64; 3], c: [f64; 3]) {
    let base = (pos.len() / 3) as u32;
    pos.extend_from_slice(&[
        a[0] as f32, a[1] as f32, a[2] as f32,
        b[0] as f32, b[1] as f32, b[2] as f32,
        c[0] as f32, c[1] as f32, c[2] as f32,
    ]);
    idx.extend_from_slice(&[base, base + 1, base + 2]);
}

fn push_quad(pos: &mut Vec<f32>, idx: &mut Vec<u32>, a: [f64; 3], b: [f64; 3], c: [f64; 3], d: [f64; 3]) {
    let base = (pos.len() / 3) as u32;
    pos.extend_from_slice(&[
        a[0] as f32, a[1] as f32, a[2] as f32,
        b[0] as f32, b[1] as f32, b[2] as f32,
        c[0] as f32, c[1] as f32, c[2] as f32,
        d[0] as f32, d[1] as f32, d[2] as f32,
    ]);
    idx.extend_from_slice(&[base, base + 1, base + 2, base, base + 2, base + 3]);
}

fn edge_pt(p: [f64; 3]) -> Vec<f32> {
    vec![p[0] as f32, p[1] as f32, p[2] as f32]
}

fn build_profiled_alu_frame(input: &AluFrameInput) -> Result<PanelMeshOutput, String> {
    let w = input.w_mm;
    let h = input.h_mm;
    let t = input.t_mm;
    let pw = input.pw_mm;
    let glass_t = input.glass_t_mm;
    let lip_depth = input.lip_depth_mm;
    let clearance = input.clearance_mm;

    let hw = w * 0.5;
    let hh = h * 0.5;
    let ht = t * 0.5;

    let r_ext = (input.fillet_mm.unwrap_or(0.0).max(0.0)).min((hw - 0.5).min(hh - 0.5));
    let default_r_int = if r_ext > pw { r_ext - pw } else { 0.0 };
    let r_int = match input.inner_fillet_mm {
        Some(v) => v.max(0.0).min((hw - pw - 0.5).min(hh - pw - 0.5)),
        None => default_r_int,
    };

    let outer_base: Vec<P2> = vec![[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    let inner_base: Vec<P2> = vec![
        [-hw + pw, -hh + pw],
        [hw - pw, -hh + pw],
        [hw - pw, hh - pw],
        [-hw + pw, hh - pw],
    ];

    let outer_pts = if r_ext > 0.05 {
        discretize_polygon_with_fillets(&outer_base, r_ext, None)
    } else {
        outer_base
    };
    let inner_pts = if r_int > 0.05 {
        discretize_polygon_with_fillets(&inner_base, r_int, None)
    } else {
        inner_base
    };

    let mut outer_ccw = outer_pts;
    ensure_ccw(&mut outer_ccw);
    let mut inner_ccw = inner_pts.clone();
    ensure_ccw(&mut inner_ccw);
    let mut inner_cw = inner_pts;
    if signed_area(&inner_cw) > 0.0 {
        inner_cw.reverse();
    }

    let mut flat_verts: Vec<f64> = Vec::with_capacity((outer_ccw.len() + inner_cw.len()) * 2);
    for p in &outer_ccw {
        flat_verts.push(p[0]);
        flat_verts.push(p[1]);
    }
    let hole_idx = outer_ccw.len();
    for p in &inner_cw {
        flat_verts.push(p[0]);
        flat_verts.push(p[1]);
    }

    let tris = earcutr::earcut(&flat_verts, &[hole_idx], 2)
        .map_err(|e| format!("Błąd triangulacji ramki ALU: {:?}", e))?;

    let mut frame_pos: Vec<f32> = Vec::new();
    let mut frame_idx: Vec<u32> = Vec::new();

    let n_total = outer_ccw.len() + inner_cw.len();
    let front_verts: Vec<[f64; 3]> = (0..n_total)
        .map(|i| [flat_verts[i * 2], flat_verts[i * 2 + 1], ht])
        .collect();
    let back_verts: Vec<[f64; 3]> = (0..n_total)
        .map(|i| [flat_verts[i * 2], flat_verts[i * 2 + 1], -ht])
        .collect();

    for tri in tris.chunks_exact(3) {
        push_tri(&mut frame_pos, &mut frame_idx, front_verts[tri[0]], front_verts[tri[1]], front_verts[tri[2]]);
        push_tri(&mut frame_pos, &mut frame_idx, back_verts[tri[0]], back_verts[tri[2]], back_verts[tri[1]]);
    }

    for i in 0..outer_ccw.len() {
        let next = (i + 1) % outer_ccw.len();
        let a = [outer_ccw[i][0], outer_ccw[i][1], ht];
        let b = [outer_ccw[next][0], outer_ccw[next][1], ht];
        let c = [outer_ccw[next][0], outer_ccw[next][1], -ht];
        let d = [outer_ccw[i][0], outer_ccw[i][1], -ht];
        push_quad(&mut frame_pos, &mut frame_idx, a, d, c, b);
    }

    for i in 0..inner_ccw.len() {
        let next = (i + 1) % inner_ccw.len();
        let a = [inner_ccw[i][0], inner_ccw[i][1], ht];
        let b = [inner_ccw[next][0], inner_ccw[next][1], ht];
        let c = [inner_ccw[next][0], inner_ccw[next][1], -ht];
        let d = [inner_ccw[i][0], inner_ccw[i][1], -ht];
        push_quad(&mut frame_pos, &mut frame_idx, a, d, c, b);
    }

    // Tafla szkła
    let gw = (w - 2.0 * (pw - lip_depth) - 2.0 * clearance).max(10.0);
    let gh = (h - 2.0 * (pw - lip_depth) - 2.0 * clearance).max(10.0);
    let half_gw = gw * 0.5;
    let half_gh = gh * 0.5;
    let half_glass_t = glass_t * 0.5;
    let glass_fillet = (r_int + lip_depth - clearance).max(0.0);

    let glass_base: Vec<P2> = vec![
        [-half_gw, -half_gh],
        [half_gw, -half_gh],
        [half_gw, half_gh],
        [-half_gw, half_gh],
    ];
    let mut glass_ccw = if glass_fillet > 0.05 {
        discretize_polygon_with_fillets(&glass_base, glass_fillet, None)
    } else {
        glass_base
    };
    ensure_ccw(&mut glass_ccw);

    let mut glass_flat: Vec<f64> = Vec::with_capacity(glass_ccw.len() * 2);
    for p in &glass_ccw {
        glass_flat.push(p[0]);
        glass_flat.push(p[1]);
    }
    let glass_tris = earcutr::earcut(&glass_flat, &[], 2)
        .map_err(|e| format!("Błąd triangulacji szkła ALU: {:?}", e))?;

    let mut glass_pos: Vec<f32> = Vec::new();
    let mut glass_idx: Vec<u32> = Vec::new();
    let g_front: Vec<[f64; 3]> = glass_ccw.iter().map(|p| [p[0], p[1], half_glass_t]).collect();
    let g_back: Vec<[f64; 3]> = glass_ccw.iter().map(|p| [p[0], p[1], -half_glass_t]).collect();

    for tri in glass_tris.chunks_exact(3) {
        push_tri(&mut glass_pos, &mut glass_idx, g_front[tri[0]], g_front[tri[1]], g_front[tri[2]]);
        push_tri(&mut glass_pos, &mut glass_idx, g_back[tri[0]], g_back[tri[2]], g_back[tri[1]]);
    }
    for i in 0..glass_ccw.len() {
        let next = (i + 1) % glass_ccw.len();
        let a = [glass_ccw[i][0], glass_ccw[i][1], half_glass_t];
        let b = [glass_ccw[next][0], glass_ccw[next][1], half_glass_t];
        let c = [glass_ccw[next][0], glass_ccw[next][1], -half_glass_t];
        let d = [glass_ccw[i][0], glass_ccw[i][1], -half_glass_t];
        push_quad(&mut glass_pos, &mut glass_idx, a, d, c, b);
    }

    // Krawędzie B-Rep
    let mut edges: Vec<CadEdgeData> = Vec::new();
    let classify_alias = |p0: P2, p1: P2, tol: f64, ref_x: f64, ref_y: f64, prefix: &str| -> Option<String> {
        let dx = p1[0] - p0[0];
        let dy = p1[1] - p0[1];
        if (p0[1] + ref_y).abs() < tol && (p1[1] + ref_y).abs() < tol && dx.abs() > 1.0 {
            Some(format!("{}dol_przod", prefix))
        } else if (p0[1] - ref_y).abs() < tol && (p1[1] - ref_y).abs() < tol && dx.abs() > 1.0 {
            Some(format!("{}gora_przod", prefix))
        } else if (p0[0] + ref_x).abs() < tol && (p1[0] + ref_x).abs() < tol && dy.abs() > 1.0 {
            Some(format!("{}przod_lewo", prefix))
        } else if (p0[0] - ref_x).abs() < tol && (p1[0] - ref_x).abs() < tol && dy.abs() > 1.0 {
            Some(format!("{}przod_prawo", prefix))
        } else {
            None
        }
    };

    for i in 0..outer_ccw.len() {
        let next = (i + 1) % outer_ccw.len();
        let p0 = outer_ccw[i];
        let p1 = outer_ccw[next];
        let alias = classify_alias(p0, p1, 0.2, hw, hh, "");
        edges.push(CadEdgeData {
            key: format!("alu_outer_top_{}", i),
            alias,
            points: vec![edge_pt([p0[0], p0[1], ht]), edge_pt([p1[0], p1[1], ht])],
            edge_key: None,
            faces: None,
        });
        edges.push(CadEdgeData {
            key: format!("alu_outer_bot_{}", i),
            alias: None,
            points: vec![edge_pt([p0[0], p0[1], -ht]), edge_pt([p1[0], p1[1], -ht])],
            edge_key: None,
            faces: None,
        });
    }

    for i in 0..inner_ccw.len() {
        let next = (i + 1) % inner_ccw.len();
        let q0 = inner_ccw[i];
        let q1 = inner_ccw[next];
        let alias = classify_alias(q0, q1, 0.2, hw - pw, hh - pw, "inner_");
        edges.push(CadEdgeData {
            key: format!("alu_inner_top_{}", i),
            alias,
            points: vec![edge_pt([q0[0], q0[1], ht]), edge_pt([q1[0], q1[1], ht])],
            edge_key: None,
            faces: None,
        });
        edges.push(CadEdgeData {
            key: format!("alu_inner_bot_{}", i),
            alias: None,
            points: vec![edge_pt([q0[0], q0[1], -ht]), edge_pt([q1[0], q1[1], -ht])],
            edge_key: None,
            faces: None,
        });
    }

    edges.push(CadEdgeData {
        key: "glass_dol".to_string(),
        alias: None,
        points: vec![edge_pt([-half_gw, -half_gh, half_glass_t]), edge_pt([half_gw, -half_gh, half_glass_t])],
        edge_key: None,
        faces: None,
    });
    edges.push(CadEdgeData {
        key: "glass_gora".to_string(),
        alias: None,
        points: vec![edge_pt([-half_gw, half_gh, half_glass_t]), edge_pt([half_gw, half_gh, half_glass_t])],
        edge_key: None,
        faces: None,
    });

    let vertices = vec![
        vec![-hw as f32, -hh as f32, ht as f32],
        vec![hw as f32, -hh as f32, ht as f32],
        vec![hw as f32, hh as f32, ht as f32],
        vec![-hw as f32, hh as f32, ht as f32],
        vec![-hw as f32, -hh as f32, -ht as f32],
        vec![hw as f32, -hh as f32, -ht as f32],
        vec![hw as f32, hh as f32, -ht as f32],
        vec![-hw as f32, hh as f32, -ht as f32],
    ];

    let mut face_meshes = HashMap::new();
    face_meshes.insert("alu_frame".to_string(), FaceMeshData {
        positions: frame_pos,
        indices: frame_idx,
        edge_key: None,
    });
    face_meshes.insert("alu_glass".to_string(), FaceMeshData {
        positions: glass_pos,
        indices: glass_idx,
        edge_key: None,
    });

    Ok(PanelMeshOutput {
        face_meshes,
        edges,
        vertices,
    })
}

fn build_prism_mesh(outer: &[P2; 4], inner: &[P2; 4], ht: f64) -> FaceMeshData {
    let mut pos: Vec<f32> = Vec::new();
    let mut idx: Vec<u32> = Vec::new();

    // Front (+ht) & Back (-ht)
    let f_pts: Vec<[f64; 3]> = outer.iter().map(|p| [p[0], p[1], ht]).collect();
    let b_pts: Vec<[f64; 3]> = inner.iter().map(|p| [p[0], p[1], -ht]).collect();

    push_quad(&mut pos, &mut idx, f_pts[0], f_pts[1], f_pts[2], f_pts[3]);
    push_quad(&mut pos, &mut idx, b_pts[3], b_pts[2], b_pts[1], b_pts[0]);

    for i in 0..4 {
        let next = (i + 1) % 4;
        push_quad(&mut pos, &mut idx, f_pts[i], b_pts[i], b_pts[next], f_pts[next]);
    }

    FaceMeshData {
        positions: pos,
        indices: idx,
        edge_key: None,
    }
}

fn build_mitered_alu_frame(input: &AluFrameInput) -> Result<PanelMeshOutput, String> {
    let w = input.w_mm;
    let h = input.h_mm;
    let t = input.t_mm;
    let pw = input.pw_mm;
    let glass_t = input.glass_t_mm;
    let lip_depth = input.lip_depth_mm;
    let clearance = input.clearance_mm;

    let hw = w * 0.5;
    let hh = h * 0.5;
    let ht = t * 0.5;

    let x0 = -hw;
    let x1 = -hw + pw;
    let x2 = hw - pw;
    let x3 = hw;

    let y0 = -hh;
    let y1 = -hh + pw;
    let y2 = hh - pw;
    let y3 = hh;

    let mut face_meshes = HashMap::new();
    face_meshes.insert("alu_prof_bottom".to_string(), build_prism_mesh(&[[x0, y0], [x3, y0], [x2, y1], [x1, y1]], &[[x0, y0], [x3, y0], [x2, y1], [x1, y1]], ht));
    face_meshes.insert("alu_prof_top".to_string(), build_prism_mesh(&[[x1, y2], [x2, y2], [x3, y3], [x0, y3]], &[[x1, y2], [x2, y2], [x3, y3], [x0, y3]], ht));
    face_meshes.insert("alu_prof_left".to_string(), build_prism_mesh(&[[x0, y0], [x1, y1], [x1, y2], [x0, y3]], &[[x0, y0], [x1, y1], [x1, y2], [x0, y3]], ht));
    face_meshes.insert("alu_prof_right".to_string(), build_prism_mesh(&[[x2, y1], [x3, y0], [x3, y3], [x2, y2]], &[[x2, y1], [x3, y0], [x3, y3], [x2, y2]], ht));

    let gw = (w - 2.0 * (pw - lip_depth) - 2.0 * clearance).max(10.0);
    let gh = (h - 2.0 * (pw - lip_depth) - 2.0 * clearance).max(10.0);
    let hgw = gw * 0.5;
    let hgh = gh * 0.5;
    let hgt = glass_t * 0.5;
    face_meshes.insert("alu_glass".to_string(), build_prism_mesh(&[[-hgw, -hgh], [hgw, -hgh], [hgw, hgh], [-hgw, hgh]], &[[-hgw, -hgh], [hgw, -hgh], [hgw, hgh], [-hgw, hgh]], hgt));

    let edges = vec![
        CadEdgeData { key: "dol_przod".to_string(), alias: Some("dol_przod".to_string()), points: vec![edge_pt([x0, y0, ht]), edge_pt([x3, y0, ht])], edge_key: None, faces: None },
        CadEdgeData { key: "gora_przod".to_string(), alias: Some("gora_przod".to_string()), points: vec![edge_pt([x0, y3, ht]), edge_pt([x3, y3, ht])], edge_key: None, faces: None },
        CadEdgeData { key: "przod_lewo".to_string(), alias: Some("przod_lewo".to_string()), points: vec![edge_pt([x0, y0, ht]), edge_pt([x0, y3, ht])], edge_key: None, faces: None },
        CadEdgeData { key: "przod_prawo".to_string(), alias: Some("przod_prawo".to_string()), points: vec![edge_pt([x3, y0, ht]), edge_pt([x3, y3, ht])], edge_key: None, faces: None },
    ];

    let vertices = vec![
        vec![x0 as f32, y0 as f32, ht as f32],
        vec![x3 as f32, y0 as f32, ht as f32],
        vec![x3 as f32, y3 as f32, ht as f32],
        vec![x0 as f32, y3 as f32, ht as f32],
        vec![x0 as f32, y0 as f32, -ht as f32],
        vec![x3 as f32, y0 as f32, -ht as f32],
        vec![x3 as f32, y3 as f32, -ht as f32],
        vec![x0 as f32, y3 as f32, -ht as f32],
    ];

    Ok(PanelMeshOutput {
        face_meshes,
        edges,
        vertices,
    })
}

pub fn build_alu_frame(input: &AluFrameInput) -> Result<PanelMeshOutput, String> {
    let fillet = input.fillet_mm.unwrap_or(0.0);
    let is_profile = fillet > 0.05 || input.frame_type.as_deref() == Some("PROFILE");
    if is_profile {
        build_profiled_alu_frame(input)
    } else {
        build_mitered_alu_frame(input)
    }
}
