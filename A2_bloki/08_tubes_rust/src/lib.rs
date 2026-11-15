use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// ─── Struktury Wejściowe (DTO) ───────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDimensionsMm {
    pub width_mm: f64,
    pub height_mm: f64,
    pub depth_mm: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmTubesParams {
    pub odstep_gora_mm: f64,
    pub pokaz_polke: bool,
    pub przestrzen_nad_polka_mm: f64,
    pub grubosc_polki_mm: f64,
    pub srednica_drazka_mm: f64,
}

// ─── Struktury Wyjściowe (DTO) ───────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmLoc {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDim {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmPart {
    pub name: String,
    pub role: String,
    pub node_type: String,
    pub dim: WasmDim,
    pub loc: WasmLoc,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmHardware {
    pub id: String,
    pub name: String,
    pub role: String,
    pub hardware_type: String,
    pub hardware_id: String,
    pub side: Option<String>,
    pub dim: WasmDim,
    pub loc: WasmLoc,
    pub is_cylinder: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmTubesPlanResult {
    pub parts: Vec<WasmPart>,
    pub hardware: Vec<WasmHardware>,
    pub srodek_drazka_z_mm: f64,
}

// ─── Główna Funkcja Obliczeniowa Eksportowana do WASM ─────────────────────────

#[wasm_bindgen]
pub fn calculate_tubes_plan_wasm(dims_val: JsValue, params_val: JsValue) -> Result<JsValue, JsValue> {
    let dims: WasmDimensionsMm = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmTubes] Błąd deserializacji dims: {}", e)))?;
    let params: WasmTubesParams = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmTubes] Błąd deserializacji params: {}", e)))?;

    let szerokosc_strefy_mm = dims.width_mm;
    let wysokosc_strefy_mm = dims.height_mm;
    let glebokosc_strefy_mm = dims.depth_mm;

    let mut parts = Vec::new();
    let mut hardware = Vec::new();

    let srodek_drazka_z_mm = if params.pokaz_polke {
        let srodek_polki_z_mm = wysokosc_strefy_mm - params.przestrzen_nad_polka_mm - (params.grubosc_polki_mm / 2.0);
        let drazek_z = srodek_polki_z_mm - (params.grubosc_polki_mm / 2.0) - params.odstep_gora_mm;

        let szerokosc_polki_mm = (szerokosc_strefy_mm - 4.0).max(10.0);
        let glebokosc_polki_mm = (glebokosc_strefy_mm - 10.0).max(10.0);

        parts.push(WasmPart {
            name: "Polka_Nad_Drazkiem".to_string(),
            role: "SHELF_PANEL".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: szerokosc_polki_mm,
                y: glebokosc_polki_mm,
                z: params.grubosc_polki_mm,
            },
            loc: WasmLoc {
                x: 0.0,
                y: 5.0,
                z: srodek_polki_z_mm,
            },
        });

        drazek_z
    } else {
        wysokosc_strefy_mm - params.odstep_gora_mm
    };

    let srednica_uchwytu_mm = 45.0;
    let grubosc_uchwytu_mm = 5.0;
    let dlugosc_drazka_mm = (szerokosc_strefy_mm - 2.0).max(10.0);

    // Drążek
    hardware.push(WasmHardware {
        id: format!("tube_rod_{}", szerokosc_strefy_mm),
        name: format!("Drazek_fi{}", params.srednica_drazka_mm),
        role: "TUBE_ROD".to_string(),
        hardware_type: "TUBE".to_string(),
        hardware_id: "DRAZEK_FI25".to_string(),
        side: None,
        dim: WasmDim {
            x: dlugosc_drazka_mm,
            y: params.srednica_drazka_mm,
            z: params.srednica_drazka_mm,
        },
        loc: WasmLoc {
            x: 0.0,
            y: 0.0,
            z: srodek_drazka_z_mm,
        },
        is_cylinder: true,
    });

    // Rozeta lewa
    hardware.push(WasmHardware {
        id: "tube_holder_left".to_string(),
        name: "Uchwyt_Lewy".to_string(),
        role: "HOLDER".to_string(),
        hardware_type: "TUBE".to_string(),
        hardware_id: "ROZETA_FI25".to_string(),
        side: Some("left".to_string()),
        dim: WasmDim {
            x: grubosc_uchwytu_mm,
            y: srednica_uchwytu_mm,
            z: srednica_uchwytu_mm,
        },
        loc: WasmLoc {
            x: -szerokosc_strefy_mm / 2.0 + grubosc_uchwytu_mm / 2.0,
            y: 0.0,
            z: srodek_drazka_z_mm,
        },
        is_cylinder: true,
    });

    // Rozeta prawa
    hardware.push(WasmHardware {
        id: "tube_holder_right".to_string(),
        name: "Uchwyt_Prawy".to_string(),
        role: "HOLDER".to_string(),
        hardware_type: "TUBE".to_string(),
        hardware_id: "ROZETA_FI25".to_string(),
        side: Some("right".to_string()),
        dim: WasmDim {
            x: grubosc_uchwytu_mm,
            y: srednica_uchwytu_mm,
            z: srednica_uchwytu_mm,
        },
        loc: WasmLoc {
            x: szerokosc_strefy_mm / 2.0 - grubosc_uchwytu_mm / 2.0,
            y: 0.0,
            z: srodek_drazka_z_mm,
        },
        is_cylinder: true,
    });

    let result = WasmTubesPlanResult {
        parts,
        hardware,
        srodek_drazka_z_mm,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("[WasmTubes] Błąd serializacji wyniku: {}", e)))
}

