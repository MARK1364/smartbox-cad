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
pub struct WasmShelvesParams {
    pub liczba_polek: u32,
    pub grubosc_polki_mm: f64,
    pub odsuniecie_przod_mm: f64,
    pub luz_boczny_mm: f64,
    pub wzor_nawiercen: String, // "NONE", "SINGLE", "TRIPLE", "ROW", "SYSTEM_32"
    pub odstep_otworow_przod_mm: f64,
    pub odstep_otworow_tyl_mm: f64,
    pub otwory_przod_aktywne: bool,
    pub przesuniecie_otworow_przod_x_mm: f64,
    pub otwory_tyl_aktywne: bool,
    pub przesuniecie_otworow_tyl_x_mm: f64,
    pub rozstaw_potrojny_z_mm: f64,
    pub rozstaw_system32_mm: f64,
    pub start_system32_z_mm: f64,
    pub liczba_otworow_system32: u32,
    pub podporka_id: String,
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
    pub shelf_index: u32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmHoleFeature {
    pub id: String,
    pub name: String,
    pub face: String,
    pub u_mm: f64,
    pub v_mm: f64,
    pub diameter_mm: f64,
    pub depth_mm: f64,
    pub shelf_index: u32,
    pub hw_suffix: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmHardware {
    pub id: String,
    pub name: String,
    pub hardware_type: String,
    pub hardware_id: String,
    pub loc: WasmLoc,
    pub shelf_index: u32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmShelvesPlanResult {
    pub parts: Vec<WasmPart>,
    pub hardware: Vec<WasmHardware>,
    pub features: Vec<WasmHoleFeature>,
}

// ─── Czyste Funkcje Matematyczne w Rust ───────────────────────────────────────

pub fn equal_shelf_bay(wysokosc_strefy_mm: f64, liczba_polek: u32, grubosc_polki_mm: f64) -> f64 {
    if liczba_polek == 0 {
        return wysokosc_strefy_mm;
    }
    (wysokosc_strefy_mm - (liczba_polek as f64) * grubosc_polki_mm) / ((liczba_polek + 1) as f64)
}

pub fn equal_shelf_center_z(
    wysokosc_strefy_mm: f64,
    liczba_polek: u32,
    grubosc_polki_mm: f64,
    indeks_polki: u32,
) -> f64 {
    let bay_mm = equal_shelf_bay(wysokosc_strefy_mm, liczba_polek, grubosc_polki_mm);
    (indeks_polki as f64) * bay_mm
        + ((indeks_polki - 1) as f64) * grubosc_polki_mm
        + grubosc_polki_mm / 2.0
}

// ─── Główna Funkcja Obliczeniowa Eksportowana do WASM ─────────────────────────

#[wasm_bindgen]
pub fn calculate_shelves_plan_wasm(dims_val: JsValue, params_val: JsValue) -> Result<JsValue, JsValue> {
    let dims: WasmDimensionsMm = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmShelves] Błąd deserializacji dims: {}", e)))?;
    let params: WasmShelvesParams = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmShelves] Błąd deserializacji params: {}", e)))?;

    let mut parts = Vec::new();
    let mut hardware = Vec::new();
    let mut features = Vec::new();

    let szerokosc_strefy_mm = dims.width_mm;
    let wysokosc_strefy_mm = dims.height_mm;
    let glebokosc_strefy_mm = dims.depth_mm;

    let efektywna_szerokosc_mm = (szerokosc_strefy_mm - 2.0 * params.luz_boczny_mm).max(10.0);
    let efektywna_glebokosc_mm = (glebokosc_strefy_mm - params.odsuniecie_przod_mm).max(10.0);
    let pozycja_y_mm = params.odsuniecie_przod_mm / 2.0;

    let srednica_otworu_mm = 5.0;
    let glebokosc_otworu_mm = 12.0;
    let promien_otworu_mm = srednica_otworu_mm / 2.0;

    let pozycja_otworu_tyl_v_mm = params.odstep_otworow_tyl_mm;
    let pozycja_otworu_przod_v_mm = params.odstep_otworow_tyl_mm.max(efektywna_glebokosc_mm - params.odstep_otworow_przod_mm);

    for i in 1..=params.liczba_polek {
        let srodek_z_mm = equal_shelf_center_z(
            wysokosc_strefy_mm,
            params.liczba_polek,
            params.grubosc_polki_mm,
            i,
        );

        // Formatka półki
        parts.push(WasmPart {
            name: format!("Polka_{}", i),
            key: format!("SHELF_{}", i),
            role: "SHELF_PANEL".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: efektywna_szerokosc_mm,
                y: efektywna_glebokosc_mm,
                z: params.grubosc_polki_mm,
            },
            loc: WasmLoc {
                x: 0.0,
                y: pozycja_y_mm,
                z: srodek_z_mm,
            },
            shelf_index: i,
        });

        // Otwory pod podpórki
        if params.wzor_nawiercen == "SINGLE" || params.wzor_nawiercen == "TRIPLE" {
            let u_under_left = -promien_otworu_mm;
            let u_under_right = params.grubosc_polki_mm + promien_otworu_mm;

            // 4 narożne podpórki (LF, LB, RF, RB)
            let add_hole = |id: String, name: String, face: &str, u: f64, v: f64, hw_suffix: Option<&str>, feats: &mut Vec<WasmHoleFeature>| {
                feats.push(WasmHoleFeature {
                    id,
                    name,
                    face: face.to_string(),
                    u_mm: u,
                    v_mm: v,
                    diameter_mm: srednica_otworu_mm,
                    depth_mm: glebokosc_otworu_mm,
                    shelf_index: i,
                    hw_suffix: hw_suffix.map(|s| s.to_string()),
                });
            };

            add_hole(format!("hole_shelf_{}_left_front", i), "Lewy przód".to_string(), "FACE_X_MINUS", u_under_left, pozycja_otworu_przod_v_mm, Some("LF"), &mut features);
            add_hole(format!("hole_shelf_{}_left_back", i), "Lewy tył".to_string(), "FACE_X_MINUS", u_under_left, pozycja_otworu_tyl_v_mm, Some("LB"), &mut features);
            add_hole(format!("hole_shelf_{}_right_front", i), "Prawy przód".to_string(), "FACE_X_PLUS", u_under_right, pozycja_otworu_przod_v_mm, Some("RF"), &mut features);
            add_hole(format!("hole_shelf_{}_right_back", i), "Prawy tył".to_string(), "FACE_X_PLUS", u_under_right, pozycja_otworu_tyl_v_mm, Some("RB"), &mut features);

            if params.wzor_nawiercen == "TRIPLE" {
                add_hole(format!("hole_shelf_{}_left_front_top", i), "Lewy przód góra".to_string(), "FACE_X_MINUS", u_under_left + params.rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, Some("LF"), &mut features);
                add_hole(format!("hole_shelf_{}_left_front_bottom", i), "Lewy przód dół".to_string(), "FACE_X_MINUS", u_under_left - params.rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, Some("LF"), &mut features);
                add_hole(format!("hole_shelf_{}_left_back_top", i), "Lewy tył góra".to_string(), "FACE_X_MINUS", u_under_left + params.rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, Some("LB"), &mut features);
                add_hole(format!("hole_shelf_{}_left_back_bottom", i), "Lewy tył dół".to_string(), "FACE_X_MINUS", u_under_left - params.rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, Some("LB"), &mut features);

                add_hole(format!("hole_shelf_{}_right_front_top", i), "Prawy przód góra".to_string(), "FACE_X_PLUS", u_under_right - params.rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, Some("RF"), &mut features);
                add_hole(format!("hole_shelf_{}_right_front_bottom", i), "Prawy przód dół".to_string(), "FACE_X_PLUS", u_under_right + params.rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, Some("RF"), &mut features);
                add_hole(format!("hole_shelf_{}_right_back_top", i), "Prawy tył góra".to_string(), "FACE_X_PLUS", u_under_right - params.rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, Some("RB"), &mut features);
                add_hole(format!("hole_shelf_{}_right_back_bottom", i), "Prawy tył dół".to_string(), "FACE_X_PLUS", u_under_right + params.rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, Some("RB"), &mut features);
            }
        }

        // Okucia fizyczne (4 podpórki pod półką)
        let pin_z = srodek_z_mm - params.grubosc_polki_mm / 2.0;
        let left_x = -szerokosc_strefy_mm / 2.0;
        let right_x = szerokosc_strefy_mm / 2.0;
        let front_y = glebokosc_strefy_mm / 2.0 - pozycja_otworu_przod_v_mm;
        let back_y = glebokosc_strefy_mm / 2.0 - pozycja_otworu_tyl_v_mm;

        let mut add_pin = |suffix: &str, name_pl: &str, x: f64, y: f64| {
            hardware.push(WasmHardware {
                id: format!("shelf_{}_pin_{}", i, suffix),
                name: format!("Podpórka półki {} ({})", i, name_pl),
                hardware_type: "SHELF_PIN".to_string(),
                hardware_id: params.podporka_id.clone(),
                loc: WasmLoc { x, y, z: pin_z },
                shelf_index: i,
            });
        };

        add_pin("LF", "lewy przód", left_x, front_y);
        add_pin("LB", "lewy tył", left_x, back_y);
        add_pin("RF", "prawy przód", right_x, front_y);
        add_pin("RB", "prawy tył", right_x, back_y);
    }

    let result = WasmShelvesPlanResult {
        parts,
        hardware,
        features,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("[WasmShelves] Błąd serializacji wyniku: {}", e)))
}

