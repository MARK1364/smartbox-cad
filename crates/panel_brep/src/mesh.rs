//! Triangulacja i akumulacja siatek per ściana.

use crate::geom::{signed_area, P2};

#[derive(Debug, Clone, Default)]
pub struct FaceMesh {
    pub positions: Vec<f32>,
    pub indices: Vec<u32>,
}

impl FaceMesh {
    pub fn is_empty(&self) -> bool {
        self.positions.is_empty() || self.indices.is_empty()
    }

    pub fn add_triangle(&mut self, a: [f64; 3], b: [f64; 3], c: [f64; 3], ccw: bool) {
        let (b, c) = if ccw { (b, c) } else { (c, b) };
        // Odrzucamy zdegenerowane trójkąty.
        let ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        let ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let cross = [
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        ];
        let len = (cross[0] * cross[0] + cross[1] * cross[1] + cross[2] * cross[2]).sqrt();
        if len < 1e-9 {
            return;
        }
        let offset = (self.positions.len() / 3) as u32;
        for p in [a, b, c] {
            self.positions.push(p[0] as f32);
            self.positions.push(p[1] as f32);
            self.positions.push(p[2] as f32);
        }
        self.indices.push(offset);
        self.indices.push(offset + 1);
        self.indices.push(offset + 2);
    }

    pub fn add_quad(&mut self, a: [f64; 3], b: [f64; 3], c: [f64; 3], d: [f64; 3], ccw: bool) {
        self.add_triangle(a, b, c, ccw);
        self.add_triangle(a, c, d, ccw);
    }
}

/// Triangulacja prostego wielokąta (bez otworów). Zwraca trójkąty jako indeksy.
pub fn triangulate(poly: &[P2]) -> Vec<[usize; 3]> {
    if poly.len() < 3 {
        return Vec::new();
    }
    let loops = vec![poly.to_vec()];
    triangulate_loops(&loops)
}

/// Triangulacja wielokąta z otworami. `loops[0]` = obrys zewnętrzny (CCW),
/// kolejne = otwory (CW). Indeksy odnoszą się do współrzędnych w `flat`.
pub fn triangulate_loops(loops: &[Vec<P2>]) -> Vec<[usize; 3]> {
    if loops.is_empty() || loops[0].len() < 3 {
        return Vec::new();
    }
    let mut flat: Vec<f64> = Vec::new();
    let mut hole_indices: Vec<usize> = Vec::new();
    for (li, lp) in loops.iter().enumerate() {
        if lp.len() < 3 {
            continue;
        }
        if li > 0 {
            hole_indices.push(flat.len() / 2);
        }
        for p in lp {
            flat.push(p[0]);
            flat.push(p[1]);
        }
    }
    if flat.len() < 6 {
        return Vec::new();
    }
    let indices = match earcutr::earcut(&flat, &hole_indices, 2) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let point_count = flat.len() / 2;
    let point_at = |idx: usize| -> P2 { [flat[idx * 2], flat[idx * 2 + 1]] };
    let ccw = signed_area(&loops[0]) >= 0.0;
    let mut tris = Vec::with_capacity(indices.len() / 3);
    for chunk in indices.chunks_exact(3) {
        let (a, b, c) = (chunk[0], chunk[1], chunk[2]);
        if a >= point_count || b >= point_count || c >= point_count || a == b || b == c || a == c {
            continue;
        }
        let pa = point_at(a);
        let pb = point_at(b);
        let pc = point_at(c);
        let area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]);
        if area.abs() < 1e-9 {
            continue;
        }
        if (area > 0.0) == ccw {
            tris.push([a, b, c]);
        } else {
            tris.push([a, c, b]);
        }
    }
    tris
}

/// Dodaje płaski wielokąt (z otworami) na wysokości `z`. `up = true` → normalna +Z.
/// Centruje punkty w lokalnym układzie formatki: X ∈ [-w/2, +w/2], Y ∈ [-h/2, +h/2].
pub fn add_flat_cell(mesh: &mut FaceMesh, loops: &[Vec<P2>], z: f64, up: bool, w: f64, h: f64) {
    let hw = w * 0.5;
    let hh = h * 0.5;
    let mut flat: Vec<P2> = Vec::new();
    for lp in loops {
        if lp.len() < 3 {
            continue;
        }
        flat.extend_from_slice(lp);
    }
    let tris = triangulate_loops(loops);
    for [a, b, c] in tris {
        if a >= flat.len() || b >= flat.len() || c >= flat.len() {
            continue;
        }
        mesh.add_triangle(
            [flat[a][0] - hw, flat[a][1] - hh, z],
            [flat[b][0] - hw, flat[b][1] - hh, z],
            [flat[c][0] - hw, flat[c][1] - hh, z],
            up,
        );
    }
}

/// Dodaje płaski wielokąt na wysokości `z`. `up = true` → normalna +Z, inaczej -Z.
pub fn add_flat_polygon(mesh: &mut FaceMesh, poly: &[P2], z: f64, up: bool, w: f64, h: f64) {
    let loops = vec![poly.to_vec()];
    add_flat_cell(mesh, &loops, z, up, w, h);
}

/// Dodaje pionowy czworokąt wzdłuż skierowanego odcinka (a→b), od z0 do z1.
/// Przy dodatnim z1-z0 normalna jest po prawej stronie kierunku a→b.
/// Centruje punkty w lokalnym układzie formatki: X ∈ [-w/2, +w/2], Y ∈ [-h/2, +h/2].
pub fn add_vertical_quad(mesh: &mut FaceMesh, a: P2, b: P2, z0: f64, z1: f64, w: f64, h: f64) {
    if z1 - z0 <= 1e-9 {
        return;
    }
    let hw = w * 0.5;
    let hh = h * 0.5;
    mesh.add_quad(
        [a[0] - hw, a[1] - hh, z0],
        [b[0] - hw, b[1] - hh, z0],
        [b[0] - hw, b[1] - hh, z1],
        [a[0] - hw, a[1] - hh, z1],
        true,
    );
}
