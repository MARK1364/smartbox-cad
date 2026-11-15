//! Cienka warstwa nad i_overlay — operacje Boole'a 2D i cięcie aranżacji.

use i_overlay::core::fill_rule::FillRule;
use i_overlay::core::overlay_rule::OverlayRule;
use i_overlay::float::single::SingleFloatOverlay;
use i_overlay::float::slice::FloatSlice;
use i_shape::base::data::Shapes;
use crate::geom::{clean_contour, ensure_ccw, P2};

pub type Contour2 = Vec<P2>;
pub type Shape2 = Vec<Contour2>;
pub type Shapes2 = Shapes<P2>;

pub fn rect_shape(u0: f64, v0: f64, u1: f64, v1: f64) -> Shapes2 {
    vec![vec![vec![[u0, v0], [u1, v0], [u1, v1], [u0, v1]]]]
}

pub fn normalize_shapes(shapes: Shapes2) -> Shapes2 {
    let mut out = Shapes2::new();
    for shape in shapes {
        if shape.is_empty() {
            continue;
        }
        let mut fixed: Shape2 = Vec::new();
        for (idx, contour) in shape.into_iter().enumerate() {
            let mut c = clean_contour(&contour);
            if c.len() < 3 {
                continue;
            }
            if idx == 0 {
                ensure_ccw(&mut c);
            } else if crate::geom::signed_area(&c) > 0.0 {
                // Otwory w i_overlay są CW.
                c.reverse();
            }
            fixed.push(c);
        }
        if !fixed.is_empty() {
            out.push(fixed);
        }
    }
    out
}

pub fn union(a: &Shapes2, b: &Shapes2) -> Shapes2 {
    normalize_shapes(a.overlay(b, OverlayRule::Union, FillRule::NonZero))
}

pub fn difference(a: &Shapes2, b: &Shapes2) -> Shapes2 {
    normalize_shapes(a.overlay(b, OverlayRule::Difference, FillRule::NonZero))
}

pub fn intersection(a: &Shapes2, b: &Shapes2) -> Shapes2 {
    normalize_shapes(a.overlay(b, OverlayRule::Intersect, FillRule::NonZero))
}

/// Dzieli `subject` wszystkimi liniami (zamknięte kontury cech) na komórki aranżacji.
pub fn slice_arrangement(subject: &Shapes2, lines: &[Contour2]) -> Shapes2 {
    if lines.is_empty() {
        return normalize_shapes(subject.clone());
    }
    let mut paths: Vec<Contour2> = Vec::with_capacity(lines.len());
    for line in lines {
        let mut p = clean_contour(line);
        if p.len() < 3 {
            continue;
        }
        // Zamknięcie pętli dla string line.
        let first = p[0];
        let last = p[p.len() - 1];
        if (first[0] - last[0]).abs() > 1e-12 || (first[1] - last[1]).abs() > 1e-12 {
            p.push(first);
        }
        paths.push(p);
    }
    if paths.is_empty() {
        return normalize_shapes(subject.clone());
    }
    normalize_shapes(subject.slice_by(&paths, FillRule::NonZero))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arrangement_splits_rectangle_and_circle() {
        let base = rect_shape(0.0, 0.0, 100.0, 100.0);
        let circle: Contour2 = (0..24)
            .map(|i| {
                let t = i as f64 * std::f64::consts::TAU / 24.0;
                [50.0 + 10.0 * t.cos(), 50.0 + 10.0 * t.sin()]
            })
            .collect();
        let cells = slice_arrangement(&base, &[circle]);
        assert!(cells.len() >= 2, "cells: {}", cells.len());
        let total: f64 = cells
            .iter()
            .map(|s| {
                let mut a = crate::geom::polygon_area(&s[0]);
                for hole in &s[1..] {
                    a -= crate::geom::polygon_area(hole);
                }
                a
            })
            .sum();
        assert!((total - 10000.0).abs() < 1.0, "total: {total}");
    }
}
