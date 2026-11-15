//! Podstawowa geometria 2D/3D używana przez kernel B-Rep formatki.

pub type P2 = [f64; 2];

/// Tolerancja dla współrzędnych w mm. Wszystkie operacje 2D pracują w mm.
pub const EPS: f64 = 1e-5;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vec3 {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn to_array(self) -> [f64; 3] {
        [self.x, self.y, self.z]
    }

    pub fn to_f32(self) -> [f32; 3] {
        [self.x as f32, self.y as f32, self.z as f32]
    }

    pub fn sub(self, other: Vec3) -> Vec3 {
        Vec3::new(self.x - other.x, self.y - other.y, self.z - other.z)
    }

    pub fn cross(self, other: Vec3) -> Vec3 {
        Vec3::new(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x,
        )
    }

    pub fn length(self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }
}

/// Pole powierzchni ze znakiem (dodatnie = CCW).
pub fn signed_area(poly: &[P2]) -> f64 {
    if poly.len() < 3 {
        return 0.0;
    }
    let mut area = 0.0;
    for i in 0..poly.len() {
        let a = poly[i];
        let b = poly[(i + 1) % poly.len()];
        area += a[0] * b[1] - b[0] * a[1];
    }
    area * 0.5
}

pub fn polygon_area(poly: &[P2]) -> f64 {
    signed_area(poly).abs()
}

pub fn ensure_ccw(poly: &mut Vec<P2>) {
    if signed_area(poly) < 0.0 {
        poly.reverse();
    }
}

/// Usuwa powtórzony punkt zamykający oraz kolejne duplikaty.
pub fn clean_contour(poly: &[P2]) -> Vec<P2> {
    let mut out: Vec<P2> = Vec::with_capacity(poly.len());
    for &p in poly {
        if let Some(&last) = out.last() {
            if (last[0] - p[0]).abs() <= EPS && (last[1] - p[1]).abs() <= EPS {
                continue;
            }
        }
        out.push(p);
    }
    if out.len() > 1 {
        let first = out[0];
        let last = out[out.len() - 1];
        if (first[0] - last[0]).abs() <= EPS && (first[1] - last[1]).abs() <= EPS {
            out.pop();
        }
    }
    out
}

/// Punkt wewnątrz wielokąta (ray casting). Punkty na brzegu traktujemy jako wewnątrz.
pub fn point_in_polygon(p: P2, poly: &[P2]) -> bool {
    if poly.len() < 3 {
        return false;
    }
    let mut inside = false;
    let mut j = poly.len() - 1;
    for i in 0..poly.len() {
        let a = poly[i];
        let b = poly[j];
        if point_on_segment(p, a, b) {
            return true;
        }
        let intersects = ((a[1] > p[1]) != (b[1] > p[1]))
            && (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]);
        if intersects {
            inside = !inside;
        }
        j = i;
    }
    inside
}

pub fn point_on_segment(p: P2, a: P2, b: P2) -> bool {
    let abx = b[0] - a[0];
    let aby = b[1] - a[1];
    let apx = p[0] - a[0];
    let apy = p[1] - a[1];
    let cross = abx * apy - aby * apx;
    if cross.abs() > 1e-7 {
        return false;
    }
    let dot = apx * abx + apy * aby;
    let len_sq = abx * abx + aby * aby;
    dot >= -1e-9 && dot <= len_sq + 1e-9
}

pub fn polygon_bbox(poly: &[P2]) -> Option<(f64, f64, f64, f64)> {
    if poly.is_empty() {
        return None;
    }
    let mut u0 = f64::INFINITY;
    let mut u1 = f64::NEG_INFINITY;
    let mut v0 = f64::INFINITY;
    let mut v1 = f64::NEG_INFINITY;
    for p in poly {
        u0 = u0.min(p[0]);
        u1 = u1.max(p[0]);
        v0 = v0.min(p[1]);
        v1 = v1.max(p[1]);
    }
    Some((u0, u1, v0, v1))
}

/// Zwraca punkt reprezentatywny leżący wewnątrz wielokąta.
pub fn representative_point(poly: &[P2]) -> P2 {
    let bbox = polygon_bbox(poly);
    if let Some((u0, u1, v0, v1)) = bbox {
        let c = [(u0 + u1) * 0.5, (v0 + v1) * 0.5];
        if point_in_polygon(c, poly) {
            return c;
        }
    }

    // Środek pierwszej niezerowej przekątnej/trójkąta.
    for i in 1..poly.len().saturating_sub(1) {
        let a = poly[0];
        let b = poly[i];
        let c = poly[i + 1];
        let area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
        if area.abs() > 1e-9 {
            let p = [(a[0] + b[0] + c[0]) / 3.0, (a[1] + b[1] + c[1]) / 3.0];
            if point_in_polygon(p, poly) {
                return p;
            }
        }
    }

    // Awaryjnie: punkt przesunięty od pierwszej krawędzi w stronę wnętrza.
    if poly.len() >= 3 {
        let a = poly[0];
        let b = poly[1];
        let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
        let dx = b[0] - a[0];
        let dy = b[1] - a[1];
        let len = (dx * dx + dy * dy).sqrt().max(1e-9);
        let n = [-dy / len, dx / len];
        for step in [1e-3, 1e-2, 1e-1, 1.0] {
            let p = [mid[0] + n[0] * step, mid[1] + n[1] * step];
            if point_in_polygon(p, poly) {
                return p;
            }
            let p2 = [mid[0] - n[0] * step, mid[1] - n[1] * step];
            if point_in_polygon(p2, poly) {
                return p2;
            }
        }
        return mid;
    }
    [0.0, 0.0]
}

/// Parametr przecięcia odcinka (a,b) z odcinkiem (c,d), albo None.
pub fn segment_intersection_t(a: P2, b: P2, c: P2, d: P2) -> Option<f64> {
    let r = [b[0] - a[0], b[1] - a[1]];
    let s = [d[0] - c[0], d[1] - c[1]];
    let denom = r[0] * s[1] - r[1] * s[0];
    if denom.abs() < 1e-12 {
        return None;
    }
    let qp = [c[0] - a[0], c[1] - a[1]];
    let t = (qp[0] * s[1] - qp[1] * s[0]) / denom;
    let u = (qp[0] * r[1] - qp[1] * r[0]) / denom;
    if (-1e-9..=1.0 + 1e-9).contains(&t) && (-1e-9..=1.0 + 1e-9).contains(&u) {
        Some(t.clamp(0.0, 1.0))
    } else {
        None
    }
}

/// Dzieli odcinek [a,b] na fragmenty, których środki nie leżą w żadnym z `holes`.
pub fn clip_segment_by_polygons(a: P2, b: P2, holes: &[Vec<P2>]) -> Vec<(P2, P2)> {
    let mut ts = vec![0.0f64, 1.0];
    for poly in holes {
        for i in 0..poly.len() {
            let c = poly[i];
            let d = poly[(i + 1) % poly.len()];
            if let Some(t) = segment_intersection_t(a, b, c, d) {
                ts.push(t);
            }
        }
    }
    ts.sort_by(|x, y| x.partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal));
    ts.dedup_by(|x, y| (*x - *y).abs() < 1e-9);

    let mut out = Vec::new();
    for pair in ts.windows(2) {
        let t0 = pair[0];
        let t1 = pair[1];
        if t1 - t0 < 1e-9 {
            continue;
        }
        let tm = (t0 + t1) * 0.5;
        let p = [a[0] + (b[0] - a[0]) * tm, a[1] + (b[1] - a[1]) * tm];
        if holes.iter().any(|poly| point_in_polygon(p, poly)) {
            continue;
        }
        let q0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
        let q1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
        out.push((q0, q1));
    }
    out
}

/// Dyskretyzuje wielokąt z zaokrągleniami narożników o promieniach `r_per_vertex`.
pub fn discretize_polygon_with_fillets(pts: &[P2], default_fillet: f64, per_vertex: Option<&[f64]>) -> Vec<P2> {
    let n = pts.len();
    if n < 3 {
        return pts.to_vec();
    }
    let mut out = Vec::with_capacity(n * 4);
    for i in 0..n {
        let p_prev = pts[(i + n - 1) % n];
        let p_curr = pts[i];
        let p_next = pts[(i + 1) % n];
        let r = per_vertex.and_then(|v| v.get(i).copied()).unwrap_or(default_fillet);
        if r <= 0.05 {
            out.push(p_curr);
            continue;
        }
        let v1x = p_prev[0] - p_curr[0];
        let v1y = p_prev[1] - p_curr[1];
        let v2x = p_next[0] - p_curr[0];
        let v2y = p_next[1] - p_curr[1];
        let l1 = (v1x * v1x + v1y * v1y).sqrt();
        let l2 = (v2x * v2x + v2y * v2y).sqrt();
        if l1 < 1e-4 || l2 < 1e-4 {
            out.push(p_curr);
            continue;
        }
        let u1x = v1x / l1;
        let u1y = v1y / l1;
        let u2x = v2x / l2;
        let u2y = v2y / l2;
        let dot = (u1x * u2x + u1y * u2y).clamp(-1.0, 1.0);
        let alpha = dot.acos();
        if alpha < 1e-3 || (std::f64::consts::PI - alpha).abs() < 1e-3 {
            out.push(p_curr);
            continue;
        }
        let half_alpha = alpha * 0.5;
        let tan_half = half_alpha.tan();
        let max_dist = (l1 * 0.49).min(l2 * 0.49);
        let dist = (r / tan_half).min(max_dist);
        let actual_r = dist * tan_half;
        if actual_r <= 0.05 {
            out.push(p_curr);
            continue;
        }

        let t1 = [p_curr[0] + u1x * dist, p_curr[1] + u1y * dist];
        let t2 = [p_curr[0] + u2x * dist, p_curr[1] + u2y * dist];
        let bis_x = u1x + u2x;
        let bis_y = u1y + u2y;
        let bis_len = (bis_x * bis_x + bis_y * bis_y).sqrt();
        if bis_len < 1e-6 {
            out.push(p_curr);
            continue;
        }
        let c_dist = actual_r / half_alpha.sin();
        let cx = p_curr[0] + (bis_x / bis_len) * c_dist;
        let cy = p_curr[1] + (bis_y / bis_len) * c_dist;

        let a1 = (t1[1] - cy).atan2(t1[0] - cx);
        let a2 = (t2[1] - cy).atan2(t2[0] - cx);
        let mut da = a2 - a1;
        while da > std::f64::consts::PI {
            da -= std::f64::consts::TAU;
        }
        while da < -std::f64::consts::PI {
            da += std::f64::consts::TAU;
        }
        let steps = ((da.abs() / (std::f64::consts::PI / 18.0)).ceil() as usize).max(4);
        for s in 0..=steps {
            let ang = a1 + da * (s as f64 / steps as f64);
            out.push([cx + actual_r * ang.cos(), cy + actual_r * ang.sin()]);
        }
    }
    out
}
