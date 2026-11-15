use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDimensionsMm {
    pub width_mm: f64,
    pub height_mm: f64,
    pub depth_mm: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmSlidingDoorsParams {
    pub liczba_skrzydel: u32,
    pub grubosc_frontu_mm: f64,
    pub szczelina_mm: f64,
    pub zaklad: f64,
    pub zakladka_mm: f64,
    pub nalozenie_gora_mm: f64,
    pub nalozenie_dol_mm: f64,
    pub nalozenie_lewe_mm: f64,
    pub nalozenie_prawe_mm: f64,
    pub typ_rolki: String,
    pub producent_rolek: String,
    pub roller_id: String,
    pub handle_id: String,
    pub tor_gorny_wysokosc_mm: f64,
    pub tor_gorny_glebokosc_mm: f64,
    pub tor_gorny_cofniecie_mm: f64,
    pub tor_dolny_wysokosc_mm: f64,
    pub tor_dolny_glebokosc_mm: f64,
    pub tor_dolny_cofniecie_mm: f64,
    pub rozstaw_torow_mm: f64,
    pub szerokosc_raczki_mm: f64,
    pub grubosc_raczki_mm: f64,
    pub pokaz_rolki: bool,
    pub pokaz_raczki: bool,
}

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
pub struct WasmSlidingPart {
    pub name: String,
    pub role: String,
    pub node_type: String,
    pub dim: WasmDim,
    pub loc: WasmLoc,
    pub leaf_index: Option<u32>,
    pub track: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmSlidingDoorsPlanResult {
    pub parts: Vec<WasmSlidingPart>,
}

const MIN_DIM_MM: f64 = 1.0;

#[wasm_bindgen]
pub fn calculate_sliding_doors_plan_wasm(
    dims_val: JsValue,
    params_val: JsValue,
) -> Result<JsValue, JsValue> {
    let dims: WasmDimensionsMm = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmSlidingDoors] Błąd dims: {}", e)))?;
    let params: WasmSlidingDoorsParams = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmSlidingDoors] Błąd params: {}", e)))?;

    let w = dims.width_mm;
    let h = dims.height_mm;
    let d = dims.depth_mm;

    let n = params.liczba_skrzydel.max(1);
    let szerokosc_calkowita_mm = w + params.nalozenie_lewe_mm + params.nalozenie_prawe_mm;

    let szerokosc_skrzydla_mm = (szerokosc_calkowita_mm + (n as f64 - 1.0) * params.zakladka_mm) / (n as f64);
    let szerokosc_skrzydla_mm = szerokosc_skrzydla_mm.max(MIN_DIM_MM);

    let ubytek_wysokosci_sevroll_mm = 40.0;
    let calkowita_wysokosc_drzwi_mm = (h - ubytek_wysokosci_sevroll_mm + params.nalozenie_gora_mm + params.nalozenie_dol_mm).max(MIN_DIM_MM);

    let z_dol_skrzydla_mm = -params.nalozenie_dol_mm + 12.0;
    let pozycja_z_mm = z_dol_skrzydla_mm + calkowita_wysokosc_drzwi_mm / 2.0;

    let tor_y_center_mm = -(d / 2.0) + params.tor_gorny_cofniecie_mm + params.tor_gorny_glebokosc_mm / 2.0;
    let track_front_y_mm = tor_y_center_mm - params.rozstaw_torow_mm / 2.0;
    let track_rear_y_mm = tor_y_center_mm + params.rozstaw_torow_mm / 2.0;

    let mut parts = Vec::new();

    // 1. Tor górny podwójny
    let tor_gorny_z_mm = (h + params.nalozenie_gora_mm) - params.tor_gorny_wysokosc_mm / 2.0;
    parts.push(WasmSlidingPart {
        name: "Tor_Gorny".to_string(),
        role: "SLIDING_TRACK".to_string(),
        node_type: "PART".to_string(),
        dim: WasmDim {
            x: w,
            y: params.tor_gorny_glebokosc_mm,
            z: params.tor_gorny_wysokosc_mm,
        },
        loc: WasmLoc { x: 0.0, y: tor_y_center_mm, z: tor_gorny_z_mm },
        leaf_index: None,
        track: Some("TOP".to_string()),
    });

    // 2. Tor dolny podwójny
    let tor_dolny_y_center_mm = -(d / 2.0) + params.tor_dolny_cofniecie_mm + params.tor_dolny_glebokosc_mm / 2.0;
    let tor_dolny_z_mm = -params.nalozenie_dol_mm + params.tor_dolny_wysokosc_mm / 2.0;
    parts.push(WasmSlidingPart {
        name: "Tor_Dolny".to_string(),
        role: "SLIDING_TRACK".to_string(),
        node_type: "PART".to_string(),
        dim: WasmDim {
            x: w,
            y: params.tor_dolny_glebokosc_mm,
            z: params.tor_dolny_wysokosc_mm,
        },
        loc: WasmLoc { x: 0.0, y: tor_dolny_y_center_mm, z: tor_dolny_z_mm },
        leaf_index: None,
        track: Some("BOTTOM".to_string()),
    });

    // 3. Skrzydła z profilami rączek po bokach i rolkami
    let x_start_mm = -w / 2.0 - params.nalozenie_lewe_mm;

    for i in 0..n {
        let is_front_track = (i % 2) == 1;
        let leaf_y_mm = if is_front_track { track_front_y_mm } else { track_rear_y_mm };

        let leaf_left_x_mm = x_start_mm + (i as f64) * (szerokosc_skrzydla_mm - params.zakladka_mm);
        let leaf_right_x_mm = leaf_left_x_mm + szerokosc_skrzydla_mm;
        let leaf_center_x_mm = leaf_left_x_mm + szerokosc_skrzydla_mm / 2.0;

        if params.pokaz_raczki {
            // Rączka lewa
            parts.push(WasmSlidingPart {
                name: format!("Raczka_Lewa_{}", i + 1),
                role: "SLIDING_TRACK".to_string(),
                node_type: "PART".to_string(),
                dim: WasmDim {
                    x: params.szerokosc_raczki_mm,
                    y: params.grubosc_raczki_mm,
                    z: calkowita_wysokosc_drzwi_mm,
                },
                loc: WasmLoc {
                    x: leaf_left_x_mm + params.szerokosc_raczki_mm / 2.0,
                    y: leaf_y_mm,
                    z: pozycja_z_mm,
                },
                leaf_index: Some(i),
                track: None,
            });

            // Rączka prawa
            parts.push(WasmSlidingPart {
                name: format!("Raczka_Prawa_{}", i + 1),
                role: "SLIDING_TRACK".to_string(),
                node_type: "PART".to_string(),
                dim: WasmDim {
                    x: params.szerokosc_raczki_mm,
                    y: params.grubosc_raczki_mm,
                    z: calkowita_wysokosc_drzwi_mm,
                },
                loc: WasmLoc {
                    x: leaf_right_x_mm - params.szerokosc_raczki_mm / 2.0,
                    y: leaf_y_mm,
                    z: pozycja_z_mm,
                },
                leaf_index: Some(i),
                track: None,
            });
        }

        let szerokosc_plyty_mm = (szerokosc_skrzydla_mm - if params.pokaz_raczki { 2.0 * params.szerokosc_raczki_mm } else { 0.0 }).max(MIN_DIM_MM);
        let leaf_name = if n == 1 { "Drzwi_Przesuwne".to_string() } else { format!("Drzwi_Przesuwne_{}", i + 1) };

        parts.push(WasmSlidingPart {
            name: leaf_name,
            role: "SLIDING_DOOR".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: szerokosc_plyty_mm,
                y: params.grubosc_frontu_mm,
                z: calkowita_wysokosc_drzwi_mm,
            },
            loc: WasmLoc {
                x: leaf_center_x_mm,
                y: leaf_y_mm,
                z: pozycja_z_mm,
            },
            leaf_index: Some(i),
            track: Some(if is_front_track { "FRONT".to_string() } else { "REAR".to_string() }),
        });

        if params.pokaz_rolki {
            let roller_w_mm = 24.0;
            let roller_d_mm = 18.0;
            let roller_h_mm = 24.0;
            let roller_inset_mm = (szerokosc_skrzydla_mm / 4.0).min(70.0);

            let mut add_roller = |x: f64, z: f64, suffix: &str, side: &str| {
                parts.push(WasmSlidingPart {
                    name: format!("Rolka_{}_{}", suffix, side),
                    role: "SLIDING_TRACK".to_string(),
                    node_type: "PART".to_string(),
                    dim: WasmDim { x: roller_w_mm, y: roller_d_mm, z: roller_h_mm },
                    loc: WasmLoc { x, y: leaf_y_mm, z },
                    leaf_index: Some(i),
                    track: None,
                });
            };

            let x_roller_l = leaf_left_x_mm + roller_inset_mm;
            let x_roller_r = leaf_right_x_mm - roller_inset_mm;

            if params.typ_rolki == "TOP" || params.typ_rolki == "BOTH" {
                add_roller(x_roller_l, tor_gorny_z_mm, &format!("TG_{}", i + 1), "L");
                add_roller(x_roller_r, tor_gorny_z_mm, &format!("TG_{}", i + 1), "R");
            }

            if params.typ_rolki == "BOTTOM" || params.typ_rolki == "BOTH" {
                add_roller(x_roller_l, tor_dolny_z_mm, &format!("TD_{}", i + 1), "L");
                add_roller(x_roller_r, tor_dolny_z_mm, &format!("TD_{}", i + 1), "R");
            }
        }
    }

    let res = WasmSlidingDoorsPlanResult { parts };
    serde_wasm_bindgen::to_value(&res)
        .map_err(|e| JsValue::from_str(&format!("Błąd serializacji wyniku: {}", e)))
}
