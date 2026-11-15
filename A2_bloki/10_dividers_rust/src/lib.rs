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
pub struct WasmDividersParams {
    pub liczba_przegrod: u32,
    pub grubosc_przegrody_mm: f64,
    pub tryb_rozstawu: String, // "EQUAL" | "CUSTOM"
    pub szerokosci_wnek_mm: Vec<f64>,
    #[serde(default)]
    pub dach_kat_deg: f64,
    #[serde(default)]
    pub przesuniecie_strefy_x_mm: f64,
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
    pub key: String,
    pub role: String,
    pub node_type: String,
    pub dim: WasmDim,
    pub loc: WasmLoc,
    pub divider_index: u32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDividerSlot {
    pub index: u32,
    pub x_center: f64,
    pub bay_before: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDividersPlanResult {
    pub parts: Vec<WasmPart>,
    pub slots: Vec<WasmDividerSlot>,
    pub ostatnia_wneka_mm: f64,
    pub ostatnia_wneka_poza_panelem: bool,
}

// ─── Czyste Funkcje Matematyczne w Rust ───────────────────────────────────────

pub fn equal_bay_width(
    szerokosc_strefy_mm: f64,
    liczba_przegrod: u32,
    grubosc_przegrody_mm: f64,
) -> f64 {
    if liczba_przegrod == 0 {
        return szerokosc_strefy_mm;
    }
    let remaining_mm = szerokosc_strefy_mm - (liczba_przegrod as f64) * grubosc_przegrody_mm;
    ((remaining_mm / ((liczba_przegrod + 1) as f64)) * 100.0).round() / 100.0
}

// ─── Główna Funkcja Obliczeniowa Eksportowana do WASM ─────────────────────────

#[wasm_bindgen]
pub fn calculate_dividers_plan_wasm(dims_val: JsValue, params_val: JsValue) -> Result<JsValue, JsValue> {
    let dims: WasmDimensionsMm = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmDividers] Błąd deserializacji dims: {}", e)))?;
    let params: WasmDividersParams = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmDividers] Błąd deserializacji params: {}", e)))?;

    let szerokosc_mm = dims.width_mm;
    let wysokosc_mm = dims.height_mm;
    let glebokosc_mm = dims.depth_mm;

    let bays: Vec<f64> = if params.liczba_przegrod == 0 {
        Vec::new()
    } else if params.tryb_rozstawu == "CUSTOM" {
        params.szerokosci_wnek_mm.iter().map(|v| (v * 100.0).round() / 100.0).collect()
    } else {
        let eq = equal_bay_width(szerokosc_mm, params.liczba_przegrod, params.grubosc_przegrody_mm);
        vec![eq; params.liczba_przegrod as usize]
    };

    let used_mm: f64 = bays.iter().sum::<f64>() + (params.liczba_przegrod as f64) * params.grubosc_przegrody_mm;
    let last_bay_mm = ((szerokosc_mm - used_mm) * 100.0).round() / 100.0;
    let ostatnia_wneka_poza_panelem = params.liczba_przegrod > 0 && last_bay_mm < 10.0;

    let mut slots = Vec::new();
    let mut parts = Vec::new();

    let is_sloped = params.dach_kat_deg.is_finite() && params.dach_kat_deg.abs() >= 0.05;
    let tan_beta = if is_sloped {
        (params.dach_kat_deg * std::f64::consts::PI / 180.0).tan()
    } else {
        0.0
    };

    let mut current_x = -szerokosc_mm / 2.0;
    for i in 0..params.liczba_przegrod {
        let bay_before = *bays.get(i as usize).unwrap_or(&0.0);
        current_x += bay_before;
        let x_center = current_x + params.grubosc_przegrody_mm / 2.0;
        let divider_idx = i + 1;

        let part_h_mm = if is_sloped {
            let x_cab = x_center + params.przesuniecie_strefy_x_mm;
            let center_roof_z = wysokosc_mm + x_cab * tan_beta;
            let half_thick_rise = (params.grubosc_przegrody_mm / 2.0) * tan_beta.abs();
            (center_roof_z + half_thick_rise).max(10.0)
        } else {
            wysokosc_mm
        };

        slots.push(WasmDividerSlot {
            index: divider_idx,
            x_center,
            bay_before,
        });

        parts.push(WasmPart {
            name: format!("Przegroda_{}", divider_idx),
            key: format!("DIVIDERS_{}", divider_idx),
            role: "DIVIDER_PLATE".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: part_h_mm,
                y: glebokosc_mm,
                z: params.grubosc_przegrody_mm,
            },
            loc: WasmLoc {
                x: x_center,
                y: 0.0,
                z: part_h_mm / 2.0,
            },
            divider_index: divider_idx,
        });

        current_x += params.grubosc_przegrody_mm;
    }

    let result = WasmDividersPlanResult {
        parts,
        slots,
        ostatnia_wneka_mm: last_bay_mm,
        ostatnia_wneka_poza_panelem,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("[WasmDividers] Błąd serializacji wyniku: {}", e)))
}

