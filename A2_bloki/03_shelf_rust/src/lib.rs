use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ShelfDimsInput {
    pub width_mm: f64,
    pub height_mm: f64,
    pub depth_mm: f64,
}

#[derive(Deserialize)]
pub struct ShelfParamsInput {
    pub grubosc_wienca_mm: f64,
    pub odsuniecie_przod_mm: f64,
    pub odsuniecie_tyl_mm: f64,
    pub luz_boczny_mm: f64,
    pub baza_odniesienia: String,
    pub odstep_gora_mm: f64,
    pub odstep_dol_mm: f64,
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
pub struct WasmPart {
    pub name: String,
    pub role: String,
    pub node_type: String,
    pub dim: WasmDim,
    pub loc: WasmLoc,
}

#[derive(Serialize)]
pub struct ShelfPlanWasmOutput {
    pub parts: Vec<WasmPart>,
}

#[wasm_bindgen]
pub fn calculate_shelf_plan_wasm(
    dims_val: JsValue,
    params_val: JsValue,
) -> Result<JsValue, JsValue> {
    let dims: ShelfDimsInput = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid dims: {}", e)))?;
    let params: ShelfParamsInput = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

    let srodek_z_mm = if params.baza_odniesienia == "top" {
        dims.height_mm - params.odstep_gora_mm - params.grubosc_wienca_mm / 2.0
    } else {
        params.odstep_dol_mm + params.grubosc_wienca_mm / 2.0
    };

    let efektywna_szerokosc_mm = (dims.width_mm - 2.0 * params.luz_boczny_mm).max(10.0);
    let efektywna_glebokosc_mm = (dims.depth_mm - (params.odsuniecie_przod_mm + params.odsuniecie_tyl_mm)).max(10.0);
    let srodek_y_mm = (params.odsuniecie_przod_mm - params.odsuniecie_tyl_mm) / 2.0;

    let parts = vec![WasmPart {
        name: "Wieniec".to_string(),
        role: "SHELF_BOARD".to_string(),
        node_type: "PART".to_string(),
        dim: WasmDim {
            x: efektywna_szerokosc_mm,
            y: efektywna_glebokosc_mm,
            z: params.grubosc_wienca_mm,
        },
        loc: WasmLoc {
            x: 0.0,
            y: srodek_y_mm,
            z: srodek_z_mm,
        },
    }];

    let output = ShelfPlanWasmOutput { parts };
    serde_wasm_bindgen::to_value(&output)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

