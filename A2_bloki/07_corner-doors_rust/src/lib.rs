use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct CornerDoorsDimsInput {
    pub width_mm: f64,
    pub height_mm: f64,
    pub depth_mm: f64,
}

#[derive(Deserialize, Clone)]
pub struct CornerHingeInput {
    pub index: u32,
    pub local_z: f64,
}

#[derive(Deserialize)]
pub struct CornerDoorsParamsInput {
    pub grubosc_frontu_mm: f64,
    pub szczelina_srodkowa_mm: f64,
    pub nalozenie_gora_mm: f64,
    pub nalozenie_dol_mm: f64,
    pub nalozenie_prawe_mm: f64,
    pub nalozenie_lewe_mm: f64,
    pub otwieranie: String,
    pub szablon_zawiasu_domyslny: String,
    pub zawiasy: Vec<CornerHingeInput>,
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
pub struct WasmCornerPart {
    pub name: String,
    pub role: String,
    pub node_type: String,
    pub dim: WasmDim,
    pub loc: WasmLoc,
    pub corner_leaf: String, // "PRAWE" | "LEWE"
    pub hinge_side: String,  // "right" | "left"
    pub gap_sign: f64,
}

#[derive(Serialize)]
pub struct WasmCornerHardware {
    pub id: String,
    pub name: String,
    pub hardware_id: String,
    pub side: String,
    pub loc: WasmLoc,
    pub hinge_index: u32,
    pub local_z: f64,
    pub corner_leaf: String,
}

#[derive(Serialize)]
pub struct CornerDoorsPlanWasmOutput {
    pub parts: Vec<WasmCornerPart>,
    pub hardware: Vec<WasmCornerHardware>,
}

const ODS_WIENIEC_MM: f64 = 1.0;

#[wasm_bindgen]
pub fn calculate_corner_doors_plan_wasm(
    dims_val: JsValue,
    params_val: JsValue,
) -> Result<JsValue, JsValue> {
    let dims: CornerDoorsDimsInput = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid dims: {}", e)))?;
    let params: CornerDoorsParamsInput = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

    let width_mm = dims.width_mm;
    let height_mm = dims.height_mm;
    let depth_mm = dims.depth_mm;

    let grubosc_frontu_mm = params.grubosc_frontu_mm;
    let polowa_szczeliny = params.szczelina_srodkowa_mm / 2.0;

    let x_notch = -width_mm / 2.0;
    let y_notch = depth_mm / 2.0;
    let front_y = -depth_mm / 2.0;

    let drzwi_prawe_szerokosc_0 = (width_mm - polowa_szczeliny + params.nalozenie_prawe_mm).max(1.0);
    let drzwi_lewe_szerokosc_0 = (depth_mm - polowa_szczeliny + params.nalozenie_lewe_mm).max(1.0);

    let drzwi_prawe_szerokosc = (drzwi_prawe_szerokosc_0 - grubosc_frontu_mm).max(1.0);
    let drzwi_lewe_szerokosc = (drzwi_lewe_szerokosc_0 - grubosc_frontu_mm).max(1.0);

    let drzwi_prawe_krawedz_zew = x_notch + polowa_szczeliny + drzwi_prawe_szerokosc_0;
    let drzwi_lewe_krawedz_front = front_y - params.nalozenie_lewe_mm;

    let drzwi_prawe_pos_x = drzwi_prawe_krawedz_zew - drzwi_prawe_szerokosc / 2.0;
    let drzwi_prawe_pos_y = y_notch - grubosc_frontu_mm / 2.0 - ODS_WIENIEC_MM;

    let drzwi_lewe_pos_x = x_notch + grubosc_frontu_mm / 2.0 - ODS_WIENIEC_MM;
    let drzwi_lewe_pos_y = drzwi_lewe_krawedz_front + drzwi_lewe_szerokosc / 2.0;

    let total_door_height_mm = height_mm + params.nalozenie_gora_mm + params.nalozenie_dol_mm;
    let pos_z = height_mm / 2.0 + (params.nalozenie_gora_mm - params.nalozenie_dol_mm) / 2.0;

    let parts = vec![
        WasmCornerPart {
            name: "Drzwi_Prawe".to_string(),
            role: "FRONT".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: drzwi_prawe_szerokosc,
                y: grubosc_frontu_mm,
                z: total_door_height_mm,
            },
            loc: WasmLoc {
                x: drzwi_prawe_pos_x,
                y: drzwi_prawe_pos_y,
                z: pos_z,
            },
            corner_leaf: "PRAWE".to_string(),
            hinge_side: "right".to_string(),
            gap_sign: 1.0,
        },
        WasmCornerPart {
            name: "Drzwi_Lewe".to_string(),
            role: "FRONT".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: drzwi_lewe_szerokosc,
                y: grubosc_frontu_mm,
                z: total_door_height_mm,
            },
            loc: WasmLoc {
                x: drzwi_lewe_pos_x,
                y: drzwi_lewe_pos_y,
                z: pos_z,
            },
            corner_leaf: "LEWE".to_string(),
            hinge_side: "left".to_string(),
            gap_sign: -1.0,
        },
    ];

    let cup_edge_dist = 22.5;
    let mut hardware = Vec::new();

    for hinge in &params.zawiasy {
        let v_center = hinge.local_z + params.nalozenie_dol_mm;
        let hinge_z = pos_z - total_door_height_mm / 2.0 + v_center;

        // Prawy zawias w fudze
        hardware.push(WasmCornerHardware {
            id: format!("hinge_gap_prawe_{}", hinge.index),
            name: format!("Zawias {} (fuga Drzwi_Prawe) [{}]", hinge.index, params.szablon_zawiasu_domyslny),
            hardware_id: params.szablon_zawiasu_domyslny.clone(),
            side: "gap".to_string(),
            loc: WasmLoc {
                x: drzwi_prawe_pos_x + 1.0 * (drzwi_prawe_szerokosc / 2.0 - cup_edge_dist),
                y: drzwi_prawe_pos_y,
                z: hinge_z,
            },
            hinge_index: hinge.index,
            local_z: hinge.local_z,
            corner_leaf: "PRAWE".to_string(),
        });

        // Lewy zawias w fudze
        hardware.push(WasmCornerHardware {
            id: format!("hinge_gap_lewe_{}", hinge.index),
            name: format!("Zawias {} (fuga Drzwi_Lewe) [{}]", hinge.index, params.szablon_zawiasu_domyslny),
            hardware_id: params.szablon_zawiasu_domyslny.clone(),
            side: "gap".to_string(),
            loc: WasmLoc {
                x: drzwi_lewe_pos_x,
                y: drzwi_lewe_pos_y - 1.0 * (drzwi_lewe_szerokosc / 2.0 - cup_edge_dist),
                z: hinge_z,
            },
            hinge_index: hinge.index,
            local_z: hinge.local_z,
            corner_leaf: "LEWE".to_string(),
        });
    }

    let output = CornerDoorsPlanWasmOutput { parts, hardware };
    serde_wasm_bindgen::to_value(&output)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

