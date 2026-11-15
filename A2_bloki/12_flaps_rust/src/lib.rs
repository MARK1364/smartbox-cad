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
pub struct WasmFlapsParams {
    pub kierunek_klapy: String, // "TOP" | "BOTTOM"
    pub grubosc_frontu_mm: f64,
    pub nalozenie_gora_mm: f64,
    pub nalozenie_dol_mm: f64,
    pub nalozenie_lewe_mm: f64,
    pub nalozenie_prawe_mm: f64,
    pub odsuniecie_zawiasu_lewe_mm: f64,
    pub odsuniecie_zawiasu_prawe_mm: f64,
    pub zawias_srodkowy: bool,
    pub szablon_zawiasu_domyslny: String,
    pub szablon_zawiasu_lewy: Option<String>,
    pub szablon_zawiasu_prawy: Option<String>,
    pub szablon_zawiasu_srodkowy: Option<String>,
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
pub struct WasmHoleFeature {
    pub id: String,
    pub target_node_id: String,
    pub face: String,
    pub u: f64,
    pub v: f64,
    pub diameter: f64,
    pub depth: f64,
    pub rule: String, // "cup", "screw"
    pub hinge_key: String,
    pub hinge_id: String,
    pub side: String,
    pub is_cup: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmHardware {
    pub id: String,
    pub name: String,
    pub hardware_type: String,
    pub hardware_id: String,
    pub side: String,
    pub loc: WasmLoc,
    pub hinge_key: String,
    pub is_top: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmFlapsPlanResult {
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

fn get_hinge_holes_mm(hinge_id: &str) -> Vec<HingeHoleDef> {
    match hinge_id {
        s if s.starts_with("BLUM") => vec![
            HingeHoleDef { edge_dist: 21.5, y_offset: 0.0, dia: 35.0, depth: 13.0, is_cup: true, name: "cup" },
            HingeHoleDef { edge_dist: 27.5, y_offset: 9.5, dia: 2.0, depth: 11.5, is_cup: false, name: "s1" },
            HingeHoleDef { edge_dist: 27.5, y_offset: -9.5, dia: 2.0, depth: 11.5, is_cup: false, name: "s2" },
        ],
        s if s.starts_with("HETTICH") => vec![
            HingeHoleDef { edge_dist: 21.5, y_offset: 0.0, dia: 35.0, depth: 12.8, is_cup: true, name: "cup" },
            HingeHoleDef { edge_dist: 27.0, y_offset: 13.0, dia: 2.0, depth: 11.0, is_cup: false, name: "s1" },
            HingeHoleDef { edge_dist: 27.0, y_offset: -13.0, dia: 2.0, depth: 11.0, is_cup: false, name: "s2" },
        ],
        _ => vec![
            HingeHoleDef { edge_dist: 21.5, y_offset: 0.0, dia: 35.0, depth: 12.5, is_cup: true, name: "cup" },
            HingeHoleDef { edge_dist: 27.0, y_offset: 10.0, dia: 2.0, depth: 11.0, is_cup: false, name: "s1" },
            HingeHoleDef { edge_dist: 27.0, y_offset: -10.0, dia: 2.0, depth: 11.0, is_cup: false, name: "s2" },
        ]
    }
}

// ─── Główna Funkcja Obliczeniowa Eksportowana do WASM ─────────────────────────

#[wasm_bindgen]
pub fn calculate_flaps_plan_wasm(dims_val: JsValue, params_val: JsValue) -> Result<JsValue, JsValue> {
    let dims: WasmDimensionsMm = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmFlaps] Błąd deserializacji dims: {}", e)))?;
    let params: WasmFlapsParams = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmFlaps] Błąd deserializacji params: {}", e)))?;

    let is_top = params.kierunek_klapy != "BOTTOM";

    let flap_width_mm = (dims.width_mm + params.nalozenie_lewe_mm + params.nalozenie_prawe_mm).max(10.0);
    let flap_height_mm = (dims.height_mm + params.nalozenie_gora_mm + params.nalozenie_dol_mm).max(10.0);

    let pos_x_mm = (params.nalozenie_prawe_mm - params.nalozenie_lewe_mm) / 2.0;
    let pos_z_mm = dims.height_mm / 2.0 + (params.nalozenie_gora_mm - params.nalozenie_dol_mm) / 2.0;
    let pos_y_mm = -(dims.depth_mm / 2.0 + params.grubosc_frontu_mm / 2.0);

    let mut parts = Vec::new();
    let mut hardware = Vec::new();
    let mut features = Vec::new();

    // Formatka klapy
    parts.push(WasmPart {
        name: "Klapa".to_string(),
        role: "FLAP".to_string(),
        node_type: "PART".to_string(),
        dim: WasmDim {
            x: flap_width_mm,
            y: params.grubosc_frontu_mm,
            z: flap_height_mm,
        },
        loc: WasmLoc {
            x: pos_x_mm,
            y: pos_y_mm,
            z: pos_z_mm,
        },
    });

    let resolve_hinge_id = |side: &str| -> String {
        if side == "left" {
            if let Some(ref id) = params.szablon_zawiasu_lewy { return id.clone(); }
        }
        if side == "right" {
            if let Some(ref id) = params.szablon_zawiasu_prawy { return id.clone(); }
        }
        if side == "center" {
            if let Some(ref id) = params.szablon_zawiasu_srodkowy { return id.clone(); }
        }
        let base_id = &params.szablon_zawiasu_domyslny;
        if base_id == "BLUM_71B3550" || base_id == "BLUM_71T3550" {
            if side == "right" { return "BLUM_71T3550".to_string(); }
            return "BLUM_71B3550".to_string();
        }
        base_id.clone()
    };

    let hinge_u_center = |side: &str| -> f64 {
        if side == "left" {
            params.nalozenie_lewe_mm + params.odsuniecie_zawiasu_lewe_mm
        } else if side == "right" {
            flap_width_mm - params.nalozenie_prawe_mm - params.odsuniecie_zawiasu_prawe_mm
        } else {
            flap_width_mm / 2.0 - (params.nalozenie_prawe_mm - params.nalozenie_lewe_mm) / 2.0
        }
    };

    let mut active_hinges = Vec::new();
    if is_top {
        active_hinges.push(("HINGE_TL", "left"));
        active_hinges.push(("HINGE_TR", "right"));
        if params.zawias_srodkowy {
            active_hinges.push(("HINGE_TC", "center"));
        }
    } else {
        active_hinges.push(("HINGE_BL", "left"));
        active_hinges.push(("HINGE_BR", "right"));
        if params.zawias_srodkowy {
            active_hinges.push(("HINGE_BC", "center"));
        }
    }

    for (hinge_key, side) in active_hinges {
        let u_center = hinge_u_center(side);
        let hinge_id = resolve_hinge_id(side);
        let front_holes = get_hinge_holes_mm(&hinge_id);

        for hole in &front_holes {
            let is_cup = hole.is_cup;
            let v = if is_top {
                flap_height_mm - hole.edge_dist
            } else {
                hole.edge_dist
            };
            let u = if is_cup { u_center } else { u_center + hole.y_offset };
            let rule = if is_cup { "cup" } else { "screw" };
            let hole_id = if is_cup {
                format!("flap_cup_{}", hinge_key)
            } else {
                format!("flap_screw_{}_{}", hinge_key, hole.name)
            };

            features.push(WasmHoleFeature {
                id: hole_id,
                target_node_id: "Klapa".to_string(),
                face: "FACE_Z_PLUS".to_string(),
                u,
                v,
                diameter: hole.dia,
                depth: hole.depth,
                rule: rule.to_string(),
                hinge_key: hinge_key.to_string(),
                hinge_id: hinge_id.clone(),
                side: side.to_string(),
                is_cup,
            });
        }

        // Sprzęt / okucie
        let cup_hole = front_holes.iter().find(|h| h.is_cup);
        let cup_edge_dist = cup_hole.map(|h| h.edge_dist).unwrap_or(21.5);
        let v_center = if is_top { flap_height_mm - cup_edge_dist } else { cup_edge_dist };

        let hw_x = pos_x_mm - flap_width_mm / 2.0 + u_center;
        let hw_z = pos_z_mm - flap_height_mm / 2.0 + v_center;

        hardware.push(WasmHardware {
            id: format!("hinge_{}", hinge_key.to_lowercase()),
            name: format!("Zawias Klapy ({}) [{}]", if side == "left" { "Lewy" } else if side == "right" { "Prawy" } else { "Środkowy" }, hinge_id),
            hardware_type: "HINGE".to_string(),
            hardware_id: hinge_id,
            side: side.to_string(),
            loc: WasmLoc { x: hw_x, y: pos_y_mm, z: hw_z },
            hinge_key: hinge_key.to_string(),
            is_top,
        });
    }

    let result = WasmFlapsPlanResult {
        parts,
        hardware,
        features,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("[WasmFlaps] Błąd serializacji wyniku: {}", e)))
}

