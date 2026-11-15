use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct LedDimsInput {
    pub width_mm: f64,
    pub height_mm: f64,
    pub depth_mm: f64,
}

#[derive(Deserialize)]
pub struct LedInternalParamsInput {
    pub wariant_led: String,
    pub profil_lewy: bool,
    pub profil_prawy: bool,
    pub profil_tyl: bool,
    pub odsuniecie_od_przodu_lewe_mm: f64,
    pub odsuniecie_od_przodu_prawe_mm: f64,
    pub odsuniecie_tyl_od_srodka_mm: f64,
    pub odsuniecie_od_przodu_mm: f64,
    pub szerokosc_wpustu_mm: f64,
    pub glebokosc_wpustu_mm: f64,
    pub odstep_gora_mm: f64,
    pub odstep_dol_mm: f64,
}

#[derive(Deserialize)]
pub struct LedExternalParamsInput {
    pub odsuniecie_od_przodu_mm: f64,
    pub szerokosc_wpustu_mm: f64,
    pub glebokosc_wpustu_mm: f64,
    pub frezuj_boki: bool,
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
pub struct WasmLedPart {
    pub name: String,
    pub role: String,
    pub report_type: String,
    pub library_id: String,
    pub dim: WasmDim,
    pub loc: WasmLoc,
    pub shape: String,
    pub material: String,
    pub glow_color: [f64; 3],
}

#[derive(Serialize)]
pub struct LedPlanWasmOutput {
    pub parts: Vec<WasmLedPart>,
}

#[wasm_bindgen]
pub fn calculate_led_internal_plan_wasm(
    dims_val: JsValue,
    params_val: JsValue,
) -> Result<JsValue, JsValue> {
    let dims: LedDimsInput = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid dims: {}", e)))?;
    let params: LedInternalParamsInput = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

    let width = dims.width_mm;
    let height = dims.height_mm;
    let depth = dims.depth_mm;

    let offset_left = params.odsuniecie_od_przodu_lewe_mm;
    let offset_right = params.odsuniecie_od_przodu_prawe_mm;
    let offset_back = params.odsuniecie_tyl_od_srodka_mm;
    let offset_front = params.odsuniecie_od_przodu_mm;
    let groove_w = params.szerokosc_wpustu_mm;
    let groove_d = params.glebokosc_wpustu_mm;

    let strip_h = (height - params.odstep_gora_mm - params.odstep_dol_mm).max(10.0);
    let z_center = params.odstep_dol_mm + strip_h / 2.0;

    let mut parts = Vec::new();

    if params.profil_lewy {
        // Profil pionowy LEWY — wpuszczony w wewnętrzne lico lewego boczka
        // dim: x=grooveD (głębokość wpustu ~9mm), y=grooveW (szerokość ~14mm), z=stripH (długość pionowa)
        // loc.x: przy licu wewnętrznym lewego boczka = -(width/2 - grooveD/2)
        // loc.y: odsunięcie od przodu wzdłuż głębokości
        // loc.z: środek profilu wzdłuż wysokości
        let y_pos_left = -depth / 2.0 + offset_left + groove_w / 2.0;
        parts.push(WasmLedPart {
            name: "Profil_LED_Pionowy_Lewy".to_string(),
            role: "LED".to_string(),
            report_type: "akcesoria".to_string(),
            library_id: "LED_PROFILE_WPUSZCZANY".to_string(),
            dim: WasmDim { x: groove_d, y: groove_w, z: strip_h },
            loc: WasmLoc { x: -(width / 2.0 - groove_d / 2.0), y: y_pos_left, z: z_center },
            shape: "BOX".to_string(),
            material: "Aluminium_Czarny_Mat_Opal".to_string(),
            glow_color: [0.65, 0.7, 0.75],
        });
    }

    if params.profil_prawy {
        // Profil pionowy PRAWY — wpuszczony w wewnętrzne lico prawego boczka
        let y_pos_right = -depth / 2.0 + offset_right + groove_w / 2.0;
        parts.push(WasmLedPart {
            name: "Profil_LED_Pionowy_Prawy".to_string(),
            role: "LED".to_string(),
            report_type: "akcesoria".to_string(),
            library_id: "LED_PROFILE_WPUSZCZANY".to_string(),
            dim: WasmDim { x: groove_d, y: groove_w, z: strip_h },
            loc: WasmLoc { x: width / 2.0 - groove_d / 2.0, y: y_pos_right, z: z_center },
            shape: "BOX".to_string(),
            material: "Aluminium_Czarny_Mat_Opal".to_string(),
            glow_color: [0.65, 0.7, 0.75],
        });
    }

    if params.profil_tyl {
        // Profil pionowy TYŁ (plecy) — wpuszczony w wewnętrzne lico ściany tylnej
        // dim: x=grooveW (szerokość), y=grooveD (głębokość wpustu), z=stripH (długość pionowa)
        // loc.y: przy wewnętrznym licu pleców = +(depth/2 - groove_d/2)
        let y_pos_back = depth / 2.0 - groove_d / 2.0;
        parts.push(WasmLedPart {
            name: "Profil_LED_Pionowy_Plecy".to_string(),
            role: "LED".to_string(),
            report_type: "akcesoria".to_string(),
            library_id: "LED_PROFILE_WPUSZCZANY".to_string(),
            dim: WasmDim { x: groove_w, y: groove_d, z: strip_h },
            loc: WasmLoc { x: offset_back, y: y_pos_back, z: z_center },
            shape: "BOX".to_string(),
            material: "Aluminium_Czarny_Mat_Opal".to_string(),
            glow_color: [0.65, 0.7, 0.75],
        });
    }

    if params.wariant_led == "HORIZONTAL_TOP" {
        // Profil poziomy GÓRA — wpuszczony w dolne lico wieńca górnego
        // dim: x=length (szerokość wnęki), y=grooveW (szerokość wpustu ~14mm), z=grooveD (głębokość ~9mm)
        // loc.z: przy dolnym licu wieńca = height - grooveD/2 (cały profil wewnątrz formatki)
        // loc.y: odsunięcie od przodu (wzdłuż głębokości)
        let y_pos_top = -depth / 2.0 + offset_front + groove_w / 2.0;
        parts.push(WasmLedPart {
            name: "Profil_LED_Poziomy_Gora".to_string(),
            role: "LED".to_string(),
            report_type: "akcesoria".to_string(),
            library_id: "LED_PROFILE_WPUSZCZANY".to_string(),
            dim: WasmDim { x: (width - 4.0).max(10.0), y: groove_w, z: groove_d },
            loc: WasmLoc { x: 0.0, y: y_pos_top, z: height - groove_d / 2.0 },
            shape: "BOX".to_string(),
            material: "Aluminium_Czarny_Mat_Opal".to_string(),
            glow_color: [0.65, 0.7, 0.75],
        });
    }

    let output = LedPlanWasmOutput { parts };
    serde_wasm_bindgen::to_value(&output)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn calculate_led_external_plan_wasm(
    dims_val: JsValue,
    params_val: JsValue,
) -> Result<JsValue, JsValue> {
    let dims: LedDimsInput = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid dims: {}", e)))?;
    let params: LedExternalParamsInput = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

    let width = dims.width_mm;
    let depth = dims.depth_mm;

    let offset_front = params.odsuniecie_od_przodu_mm;
    let groove_w = params.szerokosc_wpustu_mm;
    let groove_d = params.glebokosc_wpustu_mm;

    let y_pos = -depth / 2.0 + offset_front + groove_w / 2.0;
    let z_pos = groove_d / 2.0;

    let parts = vec![WasmLedPart {
        name: "Profil_LED_Podszafkowy".to_string(),
        role: "LED".to_string(),
        report_type: "akcesoria".to_string(),
        library_id: "LED_PROFILE_WPUSZCZANY".to_string(),
        dim: WasmDim { x: width.max(10.0), y: groove_d, z: groove_w },
        loc: WasmLoc { x: 0.0, y: y_pos, z: z_pos },
        shape: "BOX".to_string(),
        material: "Aluminium_Anodowane_Opal".to_string(),
        glow_color: [0.65, 0.7, 0.75],
    }];

    let output = LedPlanWasmOutput { parts };
    serde_wasm_bindgen::to_value(&output)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

