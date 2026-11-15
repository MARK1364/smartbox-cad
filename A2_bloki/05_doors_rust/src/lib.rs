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
pub struct WasmHingeHole {
    pub name: String,
    pub edge_dist: f64,
    pub y_offset: f64,
    pub dia: f64,
    pub depth: f64,
    pub is_cup: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmActiveHinge {
    pub index: u32,
    pub pozycja_lokalna_z_mm: f64,
    #[serde(default)]
    pub hinge_id: Option<String>,
    #[serde(default)]
    pub front_holes: Vec<WasmHingeHole>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDoorsParams {
    pub rodzaj_drzwi: String, // "LEFT", "RIGHT", "DOUBLE"
    pub grubosc_frontu_mm: f64,
    pub szczelina_mm: f64,
    pub nalozenie_gora_mm: f64,
    pub nalozenie_dol_mm: f64,
    pub nalozenie_lewe_mm: f64,
    pub nalozenie_prawe_mm: f64,
    pub domyslny_zawias_id: String,
    pub aktywne_zawiasy: Vec<WasmActiveHinge>,
}

// ─── Struktury Wyjściowe (DTO) ───────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmLoc {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmPart {
    pub id: String,
    pub name: String,
    pub role: String,
    pub node_type: String,
    pub width: f64,
    pub height: f64,
    pub depth: f64,
    pub loc: WasmLoc,
    pub side: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmHoleFeature {
    pub id: String,
    pub target_node_id: String,
    pub face: String,
    pub u: f64,
    pub v: f64,
    pub diameter: f64,
    pub depth: f64,
    pub rule: String, // "cup", "screw"
    pub hinge_index: u32,
    pub hinge_id: String,
    pub side: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmHardware {
    pub id: String,
    pub name: String,
    pub hardware_type: String,
    pub hardware_id: String,
    pub side: String,
    pub loc: WasmLoc,
    pub hinge_index: u32,
    pub local_z: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDoorsPlanResult {
    pub parts: Vec<WasmPart>,
    pub hardware: Vec<WasmHardware>,
    pub features: Vec<WasmHoleFeature>,
}

// ─── Binarne Reguły Okuć (Know-How Zaszyte w Kodzie Maszynowym WASM) ──────────

struct HingeHoleDef {
    edge_dist: f64,
    y_offset: f64,
    dia: f64,
    depth: f64,
    is_cup: bool,
    name: &'static str,
}

/// Zwraca geometrię nawierceń pod puszkę i wkręty dla zadanego modelu zawiasu.
/// W JS te dane wyciągałoby się z JSON-a lub biblioteki — w WASM są one
/// bezpośrednio w pamięci binarnej modułu.
fn get_hinge_holes_mm(hinge_id: &str) -> Vec<HingeHoleDef> {
    match hinge_id {
        // Rezerwowy fallback wyłącznie dla bezpośrednich wywołań testowych WASM bez front_holes z JSON
        s if s.starts_with("BLUM") => vec![
            HingeHoleDef { edge_dist: 21.5, y_offset: 0.0, dia: 35.0, depth: 13.0, is_cup: true, name: "cup" },
            HingeHoleDef { edge_dist: 27.5, y_offset: 9.5, dia: 2.0, depth: 11.5, is_cup: false, name: "s1" },
            HingeHoleDef { edge_dist: 27.5, y_offset: -9.5, dia: 2.0, depth: 11.5, is_cup: false, name: "s2" },
        ],
        // HETTICH Sensys: rozstaw 52mm (offset +/- 13mm)
        s if s.starts_with("HETTICH") => vec![
            HingeHoleDef { edge_dist: 21.5, y_offset: 0.0, dia: 35.0, depth: 12.8, is_cup: true, name: "cup" },
            HingeHoleDef { edge_dist: 27.0, y_offset: 13.0, dia: 2.0, depth: 11.0, is_cup: false, name: "s1" },
            HingeHoleDef { edge_dist: 27.0, y_offset: -13.0, dia: 2.0, depth: 11.0, is_cup: false, name: "s2" },
        ],
        // Domyślny standard (puszka 35mm na k=21.5mm)
        _ => vec![
            HingeHoleDef { edge_dist: 21.5, y_offset: 0.0, dia: 35.0, depth: 12.5, is_cup: true, name: "cup" },
            HingeHoleDef { edge_dist: 27.0, y_offset: 10.0, dia: 2.0, depth: 11.0, is_cup: false, name: "s1" },
            HingeHoleDef { edge_dist: 27.0, y_offset: -10.0, dia: 2.0, depth: 11.0, is_cup: false, name: "s2" },
        ]
    }
}

// ─── Główna Funkcja Obliczeniowa Eksportowana do WASM ─────────────────────────

#[wasm_bindgen]
pub fn calculate_doors_plan_wasm(dims_val: JsValue, params_val: JsValue) -> Result<JsValue, JsValue> {
    let dims: WasmDimensionsMm = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmDoors] Błąd deserializacji dims: {}", e)))?;
    let params: WasmDoorsParams = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmDoors] Błąd deserializacji params: {}", e)))?;

    let mut parts = Vec::new();
    let mut hardware = Vec::new();
    let mut features = Vec::new();

    let szerokosc_strefy_mm = dims.width_mm;
    let wysokosc_strefy_mm = dims.height_mm;
    let glebokosc_strefy_mm = dims.depth_mm;

    let calkowita_wysokosc_drzwi_mm = (wysokosc_strefy_mm + params.nalozenie_gora_mm + params.nalozenie_dol_mm).max(10.0);
    let pozycja_z_mm = wysokosc_strefy_mm / 2.0 + (params.nalozenie_gora_mm - params.nalozenie_dol_mm) / 2.0;
    let pozycja_y_mm = -(glebokosc_strefy_mm / 2.0 + params.grubosc_frontu_mm / 2.0);

    let is_double = params.rodzaj_drzwi == "DOUBLE";
    let is_right = params.rodzaj_drzwi == "RIGHT";

    if is_double {
        // Drzwi podwójne
        let calkowita_szerokosc_mm = (szerokosc_strefy_mm + params.nalozenie_lewe_mm + params.nalozenie_prawe_mm).max(20.0);
        let szerokosc_pojedynczego_skrzydla_mm = ((calkowita_szerokosc_mm - params.szczelina_mm) / 2.0).max(10.0);
        let przesuniecie_strefy_x_mm = (params.nalozenie_prawe_mm - params.nalozenie_lewe_mm) / 2.0;

        let poz_x_lewe = przesuniecie_strefy_x_mm - (szerokosc_pojedynczego_skrzydla_mm / 2.0 + params.szczelina_mm / 2.0);
        let poz_x_prawe = przesuniecie_strefy_x_mm + (szerokosc_pojedynczego_skrzydla_mm / 2.0 + params.szczelina_mm / 2.0);

        // Skrzydło Lewe
        parts.push(WasmPart {
            id: "Drzwi_Lewe".to_string(),
            name: "Drzwi Lewe".to_string(),
            role: "FRONT".to_string(),
            node_type: "PART".to_string(),
            width: szerokosc_pojedynczego_skrzydla_mm,
            height: calkowita_wysokosc_drzwi_mm,
            depth: params.grubosc_frontu_mm,
            loc: WasmLoc { x: poz_x_lewe, y: pozycja_y_mm, z: pozycja_z_mm },
            side: Some("left".to_string()),
        });

        // Skrzydło Prawe
        parts.push(WasmPart {
            id: "Drzwi_Prawe".to_string(),
            name: "Drzwi Prawe".to_string(),
            role: "FRONT".to_string(),
            node_type: "PART".to_string(),
            width: szerokosc_pojedynczego_skrzydla_mm,
            height: calkowita_wysokosc_drzwi_mm,
            depth: params.grubosc_frontu_mm,
            loc: WasmLoc { x: poz_x_prawe, y: pozycja_y_mm, z: pozycja_z_mm },
            side: Some("right".to_string()),
        });

        // Nawierty i okucia Lewe
        generate_hinges_and_features(
            "left",
            szerokosc_pojedynczego_skrzydla_mm,
            poz_x_lewe,
            pozycja_y_mm,
            pozycja_z_mm,
            calkowita_wysokosc_drzwi_mm,
            params.nalozenie_dol_mm,
            &params.domyslny_zawias_id,
            &params.aktywne_zawiasy,
            &mut hardware,
            &mut features,
        );

        // Nawierty i okucia Prawe
        generate_hinges_and_features(
            "right",
            szerokosc_pojedynczego_skrzydla_mm,
            poz_x_prawe,
            pozycja_y_mm,
            pozycja_z_mm,
            calkowita_wysokosc_drzwi_mm,
            params.nalozenie_dol_mm,
            &params.domyslny_zawias_id,
            &params.aktywne_zawiasy,
            &mut hardware,
            &mut features,
        );
    } else {
        // Pojedyncze drzwi (LEFT lub RIGHT)
        let szerokosc_drzwi_mm = (szerokosc_strefy_mm + params.nalozenie_lewe_mm + params.nalozenie_prawe_mm).max(10.0);
        let pozycja_x_mm = (params.nalozenie_prawe_mm - params.nalozenie_lewe_mm) / 2.0;
        let side = if is_right { "right" } else { "left" };
        let part_id = if is_right { "Drzwi_Prawe" } else { "Drzwi_Lewe" };
        let part_name = if is_right { "Drzwi Prawe" } else { "Drzwi Lewe" };

        parts.push(WasmPart {
            id: part_id.to_string(),
            name: part_name.to_string(),
            role: "FRONT".to_string(),
            node_type: "PART".to_string(),
            width: szerokosc_drzwi_mm,
            height: calkowita_wysokosc_drzwi_mm,
            depth: params.grubosc_frontu_mm,
            loc: WasmLoc { x: pozycja_x_mm, y: pozycja_y_mm, z: pozycja_z_mm },
            side: Some(side.to_string()),
        });

        generate_hinges_and_features(
            side,
            szerokosc_drzwi_mm,
            pozycja_x_mm,
            pozycja_y_mm,
            pozycja_z_mm,
            calkowita_wysokosc_drzwi_mm,
            params.nalozenie_dol_mm,
            &params.domyslny_zawias_id,
            &params.aktywne_zawiasy,
            &mut hardware,
            &mut features,
        );
    }

    let result = WasmDoorsPlanResult {
        parts,
        hardware,
        features,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("[WasmDoors] Błąd serializacji wyniku: {}", e)))
}

fn generate_hinges_and_features(
    side: &str,
    szerokosc_drzwi_mm: f64,
    pozycja_drzwi_x_mm: f64,
    pozycja_y_mm: f64,
    pozycja_z_mm: f64,
    calkowita_wysokosc_drzwi_mm: f64,
    nalozenie_dol_mm: f64,
    domyslny_zawias_id: &str,
    aktywne_zawiasy: &[WasmActiveHinge],
    hardware: &mut Vec<WasmHardware>,
    features: &mut Vec<WasmHoleFeature>,
) {
    let target_node_id = if side == "left" { "Drzwi_Lewe" } else { "Drzwi_Prawe" };

    for hinge in aktywne_zawiasy {
        let effective_hinge_id = hinge.hinge_id.as_deref().unwrap_or(domyslny_zawias_id);
        let json_holes: Vec<WasmHingeHole> = if !hinge.front_holes.is_empty() {
            hinge.front_holes.clone()
        } else {
            get_hinge_holes_mm(effective_hinge_id)
                .into_iter()
                .map(|h| WasmHingeHole {
                    name: h.name.to_string(),
                    edge_dist: h.edge_dist,
                    y_offset: h.y_offset,
                    dia: h.dia,
                    depth: h.depth,
                    is_cup: h.is_cup,
                })
                .collect()
        };
        let v_center = hinge.pozycja_lokalna_z_mm + nalozenie_dol_mm;

        // Otwory puszek i wkrętów
        for hole in &json_holes {
            let u = if side == "left" {
                hole.edge_dist
            } else {
                szerokosc_drzwi_mm - hole.edge_dist
            };
            let kind = if hole.is_cup { "cup" } else { "screw" };
            let suffix = if hole.is_cup { "".to_string() } else { format!("_{}", hole.name) };

            features.push(WasmHoleFeature {
                id: format!("hinge_{}_{}_{}{}", kind, side, hinge.index, suffix),
                target_node_id: target_node_id.to_string(),
                face: "FACE_Z_PLUS".to_string(),
                u,
                v: v_center + hole.y_offset,
                diameter: hole.dia,
                depth: hole.depth,
                rule: kind.to_string(),
                hinge_index: hinge.index,
                hinge_id: effective_hinge_id.to_string(),
                side: side.to_string(),
            });
        }

        // Sprzęt / okucie do drzewa sceny
        let cup_hole = json_holes.iter().find(|h| h.is_cup);
        let cup_edge_dist = cup_hole.map(|h| h.edge_dist).unwrap_or(21.5);
        let u_cup = if side == "left" { cup_edge_dist } else { szerokosc_drzwi_mm - cup_edge_dist };

        let hw_x = pozycja_drzwi_x_mm - szerokosc_drzwi_mm / 2.0 + u_cup;
        let hw_z = pozycja_z_mm - calkowita_wysokosc_drzwi_mm / 2.0 + v_center;

        hardware.push(WasmHardware {
            id: format!("hinge_{}_{}", side, hinge.index),
            name: format!("Zawias {} ({}) [{}]", hinge.index, if side == "left" { "Lewy" } else { "Prawy" }, effective_hinge_id),
            hardware_type: "HINGE".to_string(),
            hardware_id: effective_hinge_id.to_string(),
            side: side.to_string(),
            loc: WasmLoc { x: hw_x, y: pozycja_y_mm, z: hw_z },
            hinge_index: hinge.index,
            local_z: hinge.pozycja_lokalna_z_mm,
        });
    }
}

