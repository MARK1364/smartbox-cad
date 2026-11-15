use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmHandleInputParams {
    pub placement_preset: String,
    pub orientation: String, // "HORIZONTAL" | "VERTICAL"
    pub total_length_mm: f64,
    pub hole_distance_mm: f64,
    pub thickness_mm: f64,
    pub depth_mm: f64,
    pub offset_edge_x_mm: f64,
    pub offset_edge_y_mm: f64,
    pub u_mm: Option<f64>,
    pub v_mm: Option<f64>,
    pub u_edge: Option<String>, // "FACE_X_MINUS" | "FACE_X_PLUS"
    pub v_edge: Option<String>, // "FACE_Y_MINUS" | "FACE_Y_PLUS"
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmHandleDimensions {
    pub panel_w_mm: f64,
    pub panel_h_mm: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmPoint2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmBBox2D {
    pub min_x: f64,
    pub max_x: f64,
    pub min_y: f64,
    pub max_y: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmHandleComputedLayout {
    pub center: WasmPoint2D,
    pub holes: Vec<WasmPoint2D>,
    pub overhang_mm: f64,
    pub bbox: WasmBBox2D,
    pub depth_mm: f64,
    pub thickness_mm: f64,
    pub orientation: String,
    pub u_mm: f64,
    pub v_mm: f64,
    pub u_edge: String,
    pub v_edge: String,
}

fn compute_handle_overhang(total_len: f64, hole_dist: f64) -> f64 {
    if hole_dist > 0.0 && total_len > hole_dist {
        ((total_len - hole_dist) / 2.0 * 10.0).round() / 10.0
    } else {
        0.0
    }
}

fn compute_handle_center_mm(
    preset: &str,
    panel_w: f64,
    panel_h: f64,
    offset_x: f64,
    offset_y: f64,
    orientation: &str,
) -> (f64, f64) {
    let half_w = panel_w / 2.0;
    let half_h = panel_h / 2.0;

    match preset {
        "TOP_CENTER" => (offset_x, half_h - offset_y),
        "BOTTOM_CENTER" => (offset_x, -half_h + offset_y),
        "CENTER" | "CENTER_HORIZONTAL" => (0.0, offset_y),
        "CENTER_VERTICAL" => (offset_x, 0.0),
        "TOP_LEFT" => {
            let def_off_x = if offset_x != 0.0 { offset_x } else { 40.0 };
            let def_off_y = if offset_y != 0.0 { offset_y } else if orientation == "VERTICAL" { 100.0 } else { 40.0 };
            (-half_w + def_off_x, half_h - def_off_y)
        }
        "TOP_RIGHT" => {
            let def_off_x = if offset_x != 0.0 { offset_x } else { 40.0 };
            let def_off_y = if offset_y != 0.0 { offset_y } else if orientation == "VERTICAL" { 100.0 } else { 40.0 };
            (half_w - def_off_x, half_h - def_off_y)
        }
        "BOTTOM_LEFT" => {
            let def_off_x = if offset_x != 0.0 { offset_x } else { 40.0 };
            let def_off_y = if offset_y != 0.0 { offset_y } else if orientation == "VERTICAL" { 100.0 } else { 40.0 };
            (-half_w + def_off_x, -half_h + def_off_y)
        }
        "BOTTOM_RIGHT" => {
            let def_off_x = if offset_x != 0.0 { offset_x } else { 40.0 };
            let def_off_y = if offset_y != 0.0 { offset_y } else if orientation == "VERTICAL" { 100.0 } else { 40.0 };
            (half_w - def_off_x, -half_h + def_off_y)
        }
        _ => (offset_x, offset_y),
    }
}

fn compute_uv_from_center(
    x: f64,
    y: f64,
    u_edge: &str,
    v_edge: &str,
    panel_w: f64,
    panel_h: f64,
    orientation: &str,
    hole_dist: f64,
) -> (f64, f64) {
    let half_w = panel_w / 2.0;
    let half_h = panel_h / 2.0;
    let half_hole = hole_dist / 2.0;

    let u_is_main = orientation == "HORIZONTAL";
    let ref_hole_x = if u_is_main {
        if u_edge == "FACE_X_MINUS" { x - half_hole } else { x + half_hole }
    } else {
        x
    };
    let u_mm = if u_edge == "FACE_X_MINUS" { ref_hole_x + half_w } else { half_w - ref_hole_x };

    let v_is_main = orientation == "VERTICAL";
    let ref_hole_y = if v_is_main {
        if v_edge == "FACE_Y_MINUS" { y - half_hole } else { y + half_hole }
    } else {
        y
    };
    let v_mm = if v_edge == "FACE_Y_MINUS" { ref_hole_y + half_h } else { half_h - ref_hole_y };

    (
        (u_mm.max(0.0) * 10.0).round() / 10.0,
        (v_mm.max(0.0) * 10.0).round() / 10.0,
    )
}

fn compute_center_from_uv(
    u_mm: f64,
    v_mm: f64,
    u_edge: &str,
    v_edge: &str,
    panel_w: f64,
    panel_h: f64,
    orientation: &str,
    hole_dist: f64,
) -> (f64, f64) {
    let half_w = panel_w / 2.0;
    let half_h = panel_h / 2.0;
    let half_hole = hole_dist / 2.0;

    let u_is_main = orientation == "HORIZONTAL";
    let ref_hole_x = if u_edge == "FACE_X_MINUS" { -half_w + u_mm } else { half_w - u_mm };
    let x = if u_is_main {
        if u_edge == "FACE_X_MINUS" { ref_hole_x + half_hole } else { ref_hole_x - half_hole }
    } else {
        ref_hole_x
    };

    let v_is_main = orientation == "VERTICAL";
    let ref_hole_y = if v_edge == "FACE_Y_MINUS" { -half_h + v_mm } else { half_h - v_mm };
    let y = if v_is_main {
        if v_edge == "FACE_Y_MINUS" { ref_hole_y + half_hole } else { ref_hole_y - half_hole }
    } else {
        ref_hole_y
    };

    (x, y)
}

#[wasm_bindgen]
pub fn calculate_handle_layout_wasm(
    params_val: JsValue,
    dims_val: JsValue,
) -> Result<JsValue, JsValue> {
    let params: WasmHandleInputParams = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmHandles] Błąd params: {}", e)))?;
    let dims: WasmHandleDimensions = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmHandles] Błąd dims: {}", e)))?;

    let panel_w = dims.panel_w_mm;
    let panel_h = dims.panel_h_mm;

    let (u_edge, v_edge, u_mm, v_mm) = if let (Some(u), Some(v)) = (params.u_mm, params.v_mm) {
        let ue = params.u_edge.unwrap_or_else(|| "FACE_X_MINUS".to_string());
        let ve = params.v_edge.unwrap_or_else(|| "FACE_Y_PLUS".to_string());
        (ue, ve, u, v)
    } else {
        let (init_x, init_y) = compute_handle_center_mm(
            &params.placement_preset,
            panel_w,
            panel_h,
            params.offset_edge_x_mm,
            params.offset_edge_y_mm,
            &params.orientation,
        );
        let ue = params.u_edge.unwrap_or_else(|| if init_x >= 0.0 { "FACE_X_PLUS".to_string() } else { "FACE_X_MINUS".to_string() });
        let ve = params.v_edge.unwrap_or_else(|| if init_y >= 0.0 { "FACE_Y_PLUS".to_string() } else { "FACE_Y_MINUS".to_string() });
        let (uv_u, uv_v) = compute_uv_from_center(
            init_x,
            init_y,
            &ue,
            &ve,
            panel_w,
            panel_h,
            &params.orientation,
            params.hole_distance_mm,
        );
        (ue, ve, uv_u, uv_v)
    };

    let (cx, cy) = compute_center_from_uv(
        u_mm,
        v_mm,
        &u_edge,
        &v_edge,
        panel_w,
        panel_h,
        &params.orientation,
        params.hole_distance_mm,
    );

    let overhang_mm = compute_handle_overhang(params.total_length_mm, params.hole_distance_mm);
    let half_len = params.total_length_mm / 2.0;
    let half_hole_dist = params.hole_distance_mm / 2.0;
    let half_thick = params.thickness_mm / 2.0;

    let mut holes = Vec::new();
    let bbox = if params.orientation == "HORIZONTAL" {
        if params.hole_distance_mm > 0.0 {
            holes.push(WasmPoint2D { x: cx - half_hole_dist, y: cy });
            holes.push(WasmPoint2D { x: cx + half_hole_dist, y: cy });
        } else {
            holes.push(WasmPoint2D { x: cx, y: cy });
        }
        WasmBBox2D {
            min_x: cx - half_len,
            max_x: cx + half_len,
            min_y: cy - half_thick,
            max_y: cy + half_thick,
        }
    } else {
        if params.hole_distance_mm > 0.0 {
            holes.push(WasmPoint2D { x: cx, y: cy - half_hole_dist });
            holes.push(WasmPoint2D { x: cx, y: cy + half_hole_dist });
        } else {
            holes.push(WasmPoint2D { x: cx, y: cy });
        }
        WasmBBox2D {
            min_x: cx - half_thick,
            max_x: cx + half_thick,
            min_y: cy - half_len,
            max_y: cy + half_len,
        }
    };

    let res = WasmHandleComputedLayout {
        center: WasmPoint2D { x: cx, y: cy },
        holes,
        overhang_mm,
        bbox,
        depth_mm: params.depth_mm,
        thickness_mm: params.thickness_mm,
        orientation: params.orientation,
        u_mm,
        v_mm,
        u_edge,
        v_edge,
    };

    serde_wasm_bindgen::to_value(&res)
        .map_err(|e| JsValue::from_str(&format!("Błąd serializacji wyniku layout: {}", e)))
}

