use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct HangersDimsInput {
    pub width_mm: f64,
    pub height_mm: f64,
    pub depth_mm: f64,
}

#[derive(Deserialize)]
pub struct HangerPartInput {
    pub id: Option<String>,
    pub name: Option<String>,
    pub width_mm: f64,
    pub height_mm: f64,
    pub depth_mm: f64,
    pub ref_x: String,
    pub ref_y: String,
    pub ref_z: String,
    pub offset_x_mm: f64,
    pub offset_y_mm: f64,
    pub offset_z_mm: f64,
    pub frozen: Option<bool>,
}

#[derive(Deserialize)]
pub struct HangersParamsInput {
    pub szablon_id: String,
    pub zestaw_id: String,
    pub odsuniecie_bok_mm: f64,
    pub odsuniecie_tyl_mm: f64,
    pub odsuniecie_gora_mm: f64,
    pub parts: Vec<HangerPartInput>,
}

#[derive(Serialize)]
pub struct WasmDim {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Serialize)]
pub struct WasmLoc {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Serialize)]
pub struct WasmHangerHardware {
    pub id: String,
    pub name: String,
    pub part_id: String,
    pub dim: WasmDim,
    pub loc: WasmLoc,
}

#[derive(Serialize)]
pub struct HangersPlanWasmOutput {
    pub hardware: Vec<WasmHangerHardware>,
}

#[wasm_bindgen]
pub fn calculate_hangers_plan_wasm(
    dims_val: JsValue,
    params_val: JsValue,
) -> Result<JsValue, JsValue> {
    let dims: HangersDimsInput = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid dims: {}", e)))?;
    let params: HangersParamsInput = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

    let w = dims.width_mm;
    let h = dims.height_mm;
    let d = dims.depth_mm;

    let mut hardware = Vec::new();

    for (i, part) in params.parts.iter().enumerate() {
        if part.frozen == Some(true) {
            continue;
        }

        let part_w = part.width_mm.max(1.0);
        let part_h = part.height_mm.max(1.0);
        let part_d = part.depth_mm.max(1.0);

        let ref_x = part.ref_x.to_uppercase();
        let ref_y = part.ref_y.to_uppercase();
        let ref_z = part.ref_z.to_uppercase();

        let off_x = part.offset_x_mm + params.odsuniecie_bok_mm;
        let off_y = part.offset_y_mm + params.odsuniecie_tyl_mm;
        let off_z = part.offset_z_mm + params.odsuniecie_gora_mm;

        let bay_x = match ref_x.as_str() {
            "LEFT" => off_x,
            "RIGHT" => w - off_x,
            _ => w / 2.0 + off_x,
        };
        let bay_d = match ref_y.as_str() {
            "BACK" => off_y,
            "FRONT" => d - off_y,
            _ => d / 2.0 + off_y,
        };
        let bay_h = match ref_z.as_str() {
            "BOTTOM" => off_z,
            "TOP" => h - off_z,
            _ => h / 2.0 + off_z,
        };

        let loc_x = ((bay_x - w / 2.0) * 100.0).round() / 100.0;
        let loc_y = ((d / 2.0 - bay_d) * 100.0).round() / 100.0;
        let loc_z = (bay_h * 100.0).round() / 100.0;

        let part_id = part.id.clone().unwrap_or_else(|| format!("part_{}", i + 1));
        let part_name = part.name.clone().unwrap_or_else(|| format!("Zawieszka_{}", i + 1));
        let hw_id = format!("hanger_{}_{}_{}", params.zestaw_id, part_id, i);

        hardware.push(WasmHangerHardware {
            id: hw_id,
            name: part_name,
            part_id,
            dim: WasmDim { x: part_w, y: part_d, z: part_h },
            loc: WasmLoc { x: loc_x, y: loc_y, z: loc_z },
        });
    }

    let output = HangersPlanWasmOutput { hardware };
    serde_wasm_bindgen::to_value(&output)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

