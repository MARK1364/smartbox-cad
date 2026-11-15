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
pub struct WasmFrontHoleSpec {
    pub side: Option<String>,
    pub z_from_bottom: f64,
    pub edge_dist: Option<f64>,
    pub dia: Option<f64>,
    pub depth: Option<f64>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmSlotSpec {
    pub index: u32,
    pub front_h: f64,
    pub z_front_bottom: f64,
    pub z_internal_bottom: f64,
    pub z_front_center: f64,
    pub length_mm: f64,
    pub rail_id: String,
    pub rail_name: String,
    pub rail_width: f64,
    pub rail_height: f64,
    pub corpus_height: f64,
    pub is_system_drawer: bool,
    pub bottom_thickness: f64,
    pub bottom_width_offset: f64,
    pub bottom_length_offset: f64,
    pub back_thickness: f64,
    pub back_width_offset: f64,
    pub back_height: f64,
    pub shelf_y: f64,
    pub art_no: Option<String>,
    pub front_holes_x_offset: f64,
    pub drill_id: String,
    pub drill_dia: f64,
    pub drill_depth: f64,
    pub front_hole_entries: Option<Vec<WasmFrontHoleSpec>>,
    pub legacy_z_positions: Vec<f64>,
    #[serde(default)]
    pub internal: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDrawersParams {
    pub liczba_szuflad: u32,
    pub grubosc_frontu_mm: f64,
    pub nalozenie_gora_mm: f64,
    pub nalozenie_dol_mm: f64,
    pub nalozenie_lewe_mm: f64,
    pub nalozenie_prawe_mm: f64,
    pub dystans_lewy_mm: f64,
    pub dystans_prawy_mm: f64,
    pub auto_wysokosc_frontu: bool,
    pub szczelina_wspolna_mm: f64,
    pub domyslny_system_prowadnic_id: String,
    pub wysokosci_frontow_mm: Vec<f64>,
    pub szczeliny_indywidualne_mm: Vec<f64>,
    #[serde(default)]
    pub slot_specs: Option<Vec<WasmSlotSpec>>,
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
pub struct WasmFrontHole {
    pub id: String,
    pub name: String,
    pub u_mm: f64,
    pub v_mm: f64,
    pub diameter_mm: f64,
    pub depth_mm: f64,
    pub rail_node_id: String,
    pub template_id: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmPart {
    pub id: String,
    pub name: String,
    pub role: String, // "FRONT", "DRAWER_BOTTOM", "DRAWER_BACK", "BOX", "SPACER"
    pub node_type: String,
    pub width: f64,
    pub height: f64,
    pub depth: f64,
    pub dim: WasmDim,
    pub loc: WasmLoc,
    pub drawer_index: u32,
    pub front_holes: Vec<WasmFrontHole>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmHardware {
    pub id: String,
    pub name: String,
    pub role: String,
    pub hardware_type: String,
    pub hardware_id: String,
    pub side: String,
    pub drawer_index: u32,
    pub rail_id: String,
    pub length_mm: f64,
    pub corpus_height: f64,
    pub z_internal_bottom: f64,
    pub art_no: Option<String>,
    pub internal: bool,
    pub loc: WasmLoc,
    pub dim: WasmDim,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDrawerSlot {
    pub index: u32,
    pub front_h: f64,
    pub z_front_bottom: f64,
    pub z_front_center: f64,
    pub z_internal_bottom: f64,
    pub length_mm: f64,
    pub rail_id: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDrawersPlanResult {
    pub parts: Vec<WasmPart>,
    pub slots: Vec<WasmDrawerSlot>,
    pub hardware: Vec<WasmHardware>,
}

// ─── Główna Funkcja Obliczeniowa Eksportowana do WASM ─────────────────────────

#[wasm_bindgen]
pub fn calculate_drawers_plan_wasm(dims_val: JsValue, params_val: JsValue) -> Result<JsValue, JsValue> {
    let dims: WasmDimensionsMm = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmDrawers] Błąd deserializacji dims: {}", e)))?;
    let params: WasmDrawersParams = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmDrawers] Błąd deserializacji params: {}", e)))?;

    let szerokosc_strefy_mm = dims.width_mm;
    let wysokosc_strefy_mm = dims.height_mm;
    let glebokosc_strefy_mm = dims.depth_mm;

    let swiatlo_wewnetrzne_mm = (szerokosc_strefy_mm - params.dystans_lewy_mm - params.dystans_prawy_mm).max(10.0);
    let przesuniecie_x_mm = (params.dystans_lewy_mm - params.dystans_prawy_mm) / 2.0;

    let calkowita_szerokosc_frontu_mm = (swiatlo_wewnetrzne_mm + params.nalozenie_lewe_mm + params.nalozenie_prawe_mm).max(10.0);
    let front_pos_x_mm = przesuniecie_x_mm + (params.nalozenie_prawe_mm - params.nalozenie_lewe_mm) / 2.0;
    let front_pos_y_mm = -(glebokosc_strefy_mm / 2.0 + params.grubosc_frontu_mm / 2.0);

    let mut parts = Vec::new();
    let mut slots = Vec::new();
    let mut hardware = Vec::new();

    // 1. Dystanse boczne (jeśli zdefiniowane)
    if params.dystans_lewy_mm > 0.5 {
        let spacer_x = -szerokosc_strefy_mm / 2.0 + params.dystans_lewy_mm / 2.0;
        parts.push(WasmPart {
            id: "DRAWER_SPACER_L".to_string(),
            name: "Dystans_L".to_string(),
            role: "SPACER".to_string(),
            node_type: "PART".to_string(),
            width: params.dystans_lewy_mm,
            height: wysokosc_strefy_mm,
            depth: glebokosc_strefy_mm,
            dim: WasmDim { x: wysokosc_strefy_mm, y: glebokosc_strefy_mm, z: params.dystans_lewy_mm },
            loc: WasmLoc { x: spacer_x, y: 0.0, z: wysokosc_strefy_mm / 2.0 },
            drawer_index: 0,
            front_holes: Vec::new(),
        });
    }

    if params.dystans_prawy_mm > 0.5 {
        let spacer_x = szerokosc_strefy_mm / 2.0 - params.dystans_prawy_mm / 2.0;
        parts.push(WasmPart {
            id: "DRAWER_SPACER_R".to_string(),
            name: "Dystans_P".to_string(),
            role: "SPACER".to_string(),
            node_type: "PART".to_string(),
            width: params.dystans_prawy_mm,
            height: wysokosc_strefy_mm,
            depth: glebokosc_strefy_mm,
            dim: WasmDim { x: wysokosc_strefy_mm, y: glebokosc_strefy_mm, z: params.dystans_prawy_mm },
            loc: WasmLoc { x: spacer_x, y: 0.0, z: wysokosc_strefy_mm / 2.0 },
            drawer_index: 0,
            front_holes: Vec::new(),
        });
    }

    // 2. Budowa listy slotów (z jawnej specyfikacji lub domyślny Antaro)
    let resolved_specs: Vec<WasmSlotSpec> = if let Some(specs) = &params.slot_specs {
        specs.clone()
    } else {
        let mut out = Vec::new();
        for i in 1..=params.liczba_szuflad {
            let (front_h, z_front_bottom) = if params.auto_wysokosc_frontu {
                let total_h = wysokosc_strefy_mm + params.nalozenie_dol_mm + params.nalozenie_gora_mm;
                let total_gaps = if params.liczba_szuflad > 1 {
                    (params.liczba_szuflad - 1) as f64 * params.szczelina_wspolna_mm
                } else {
                    0.0
                };
                let h = if params.liczba_szuflad > 0 {
                    ((total_h - total_gaps) / params.liczba_szuflad as f64 * 100.0).round() / 100.0
                } else {
                    0.0
                };
                let z_bot = -params.nalozenie_dol_mm + (i - 1) as f64 * (h + params.szczelina_wspolna_mm);
                (h, z_bot)
            } else {
                let mut h = *params.wysokosci_frontow_mm.get((i - 1) as usize).unwrap_or(&0.0);
                if h <= 0.0 {
                    h = if params.liczba_szuflad > 0 {
                        wysokosc_strefy_mm / params.liczba_szuflad as f64
                    } else {
                        wysokosc_strefy_mm
                    };
                }
                let prev_h: f64 = params.wysokosci_frontow_mm.iter().take((i - 1) as usize).sum();
                let prev_g: f64 = params.szczeliny_indywidualne_mm.iter().take((i - 1) as usize).sum();
                let z_bot = -params.nalozenie_dol_mm + prev_h + prev_g;
                (h, z_bot)
            };

            let z_internal_bottom = if i == 1 { 0.0 } else { z_front_bottom };
            let z_front_center = z_front_bottom + front_h / 2.0;
            let length_mm = if glebokosc_strefy_mm >= 500.0 {
                500.0
            } else if glebokosc_strefy_mm >= 450.0 {
                450.0
            } else if glebokosc_strefy_mm >= 400.0 {
                400.0
            } else if glebokosc_strefy_mm >= 350.0 {
                350.0
            } else if glebokosc_strefy_mm >= 300.0 {
                300.0
            } else {
                250.0
            };

            out.push(WasmSlotSpec {
                index: i,
                front_h,
                z_front_bottom,
                z_internal_bottom,
                z_front_center,
                length_mm,
                rail_id: params.domyslny_system_prowadnic_id.clone(),
                rail_name: params.domyslny_system_prowadnic_id.clone(),
                rail_width: 12.7,
                rail_height: 45.0,
                corpus_height: 84.0,
                is_system_drawer: true,
                bottom_thickness: 16.0,
                bottom_width_offset: -75.0,
                bottom_length_offset: -24.0,
                back_thickness: 16.0,
                back_width_offset: -87.0,
                back_height: 84.0,
                shelf_y: 9.0,
                art_no: None,
                front_holes_x_offset: 31.0,
                drill_id: "STANDARD_DRAWER_DRILL".to_string(),
                drill_dia: 3.0,
                drill_depth: 10.0,
                front_hole_entries: None,
                legacy_z_positions: Vec::new(),
                internal: false,
            });
        }
        out
    };

    // 3. Wyliczanie formatek, otworów frontowych i okuć dla każdego slotu
    for spec in &resolved_specs {
        let i = spec.index;
        slots.push(WasmDrawerSlot {
            index: i,
            front_h: spec.front_h,
            z_front_bottom: spec.z_front_bottom,
            z_front_center: spec.z_front_center,
            z_internal_bottom: spec.z_internal_bottom,
            length_mm: spec.length_mm,
            rail_id: spec.rail_id.clone(),
        });

        // Otwory montażowe frontu
        let mut front_holes = Vec::new();
        let box_from_front_bottom = spec.z_internal_bottom - spec.z_front_bottom;
        let mut push_hole = |side: &str, z_raw: f64, edge_dist: Option<f64>, dia_opt: Option<f64>, depth_opt: Option<f64>, idx: usize| {
            let dia = dia_opt.unwrap_or(spec.drill_dia);
            let depth = depth_opt.unwrap_or(spec.drill_depth);
            let v = box_from_front_bottom + z_raw;
            if v < dia / 2.0 || v > spec.front_h - dia / 2.0 {
                return;
            }
            let x_off = edge_dist.unwrap_or(spec.front_holes_x_offset);
            let u = if side == "L" { x_off } else { calkowita_szerokosc_frontu_mm - x_off };
            let rail_node_id = format!("drawer_{}_rail_{}", i, side);
            front_holes.push(WasmFrontHole {
                id: format!("drawer_{}_front_{}_{}", i, side, idx),
                name: format!("Otwór montażowy szuflady {} ({})", i + 1, side),
                u_mm: u,
                v_mm: v,
                diameter_mm: dia,
                depth_mm: depth,
                rail_node_id,
                template_id: if spec.drill_id.is_empty() {
                    "STANDARD_DRAWER_DRILL".to_string()
                } else {
                    spec.drill_id.clone()
                },
            });
        };

        if let Some(entries) = &spec.front_hole_entries {
            for (idx, entry) in entries.iter().enumerate() {
                if entry.enabled == Some(false) || !entry.z_from_bottom.is_finite() {
                    continue;
                }
                match entry.side.as_deref() {
                    Some("L") => push_hole("L", entry.z_from_bottom, entry.edge_dist, entry.dia, entry.depth, idx),
                    Some("R") => push_hole("R", entry.z_from_bottom, entry.edge_dist, entry.dia, entry.depth, idx),
                    _ => {
                        push_hole("L", entry.z_from_bottom, entry.edge_dist, entry.dia, entry.depth, idx);
                        push_hole("R", entry.z_from_bottom, entry.edge_dist, entry.dia, entry.depth, idx);
                    }
                }
            }
        } else {
            for (idx, &z_raw) in spec.legacy_z_positions.iter().enumerate() {
                push_hole("L", z_raw, None, None, None, idx);
                push_hole("R", z_raw, None, None, None, idx);
            }
        }

        // A. Formatka Frontu szuflady (pomijana dla szuflad wewnętrznych)
        if !spec.internal {
            parts.push(WasmPart {
                id: format!("DRAWER_{}_FRONT", i),
                name: format!("Front_{}", i),
                role: "FRONT".to_string(),
                node_type: "PART".to_string(),
                width: calkowita_szerokosc_frontu_mm,
                height: spec.front_h,
                depth: params.grubosc_frontu_mm,
                dim: WasmDim {
                    x: calkowita_szerokosc_frontu_mm,
                    y: params.grubosc_frontu_mm,
                    z: spec.front_h,
                },
                loc: WasmLoc {
                    x: front_pos_x_mm,
                    y: front_pos_y_mm,
                    z: spec.z_front_center,
                },
                drawer_index: i,
                front_holes,
            });
        }

        let rail_len = spec.length_mm.min((glebokosc_strefy_mm - 2.0).max(10.0));

        if spec.is_system_drawer {
            let bottom_w = (swiatlo_wewnetrzne_mm + spec.bottom_width_offset).max(10.0);
            let bottom_l = (spec.length_mm + spec.bottom_length_offset).max(10.0);

            parts.push(WasmPart {
                id: format!("DRAWER_{}_BOTTOM", i),
                name: format!("Dno_{}", i),
                role: "DRAWER_BOTTOM".to_string(),
                node_type: "PART".to_string(),
                width: bottom_w,
                height: bottom_l,
                depth: spec.bottom_thickness,
                dim: WasmDim {
                    x: bottom_w,
                    y: bottom_l,
                    z: spec.bottom_thickness,
                },
                loc: WasmLoc {
                    x: przesuniecie_x_mm,
                    y: -(glebokosc_strefy_mm / 2.0) + bottom_l / 2.0,
                    z: spec.z_internal_bottom + spec.shelf_y + spec.bottom_thickness / 2.0,
                },
                drawer_index: i,
                front_holes: Vec::new(),
            });

            let back_w = (swiatlo_wewnetrzne_mm + spec.back_width_offset).max(10.0);
            parts.push(WasmPart {
                id: format!("DRAWER_{}_BACK", i),
                name: format!("Plecy_{}", i),
                role: "DRAWER_BACK".to_string(),
                node_type: "PART".to_string(),
                width: back_w,
                height: spec.back_height,
                depth: spec.back_thickness,
                dim: WasmDim {
                    x: back_w,
                    y: spec.back_thickness,
                    z: spec.back_height,
                },
                loc: WasmLoc {
                    x: przesuniecie_x_mm,
                    y: -(glebokosc_strefy_mm / 2.0) + bottom_l + spec.back_thickness / 2.0,
                    z: spec.z_internal_bottom + spec.shelf_y + spec.back_height / 2.0,
                },
                drawer_index: i,
                front_holes: Vec::new(),
            });
        } else {
            let box_w = (swiatlo_wewnetrzne_mm - spec.rail_width * 2.0).max(10.0);
            parts.push(WasmPart {
                id: format!("DRAWER_{}_BOX", i),
                name: format!("Skrzynka_{}", i),
                role: "BOX".to_string(),
                node_type: "PART".to_string(),
                width: box_w,
                height: rail_len,
                depth: spec.corpus_height,
                dim: WasmDim {
                    x: box_w,
                    y: rail_len,
                    z: spec.corpus_height,
                },
                loc: WasmLoc {
                    x: przesuniecie_x_mm,
                    y: -(glebokosc_strefy_mm / 2.0) + rail_len / 2.0,
                    z: spec.z_internal_bottom + spec.corpus_height / 2.0,
                },
                drawer_index: i,
                front_holes: Vec::new(),
            });
        }

        // Okucia prowadnic (L i R)
        let rail_z = spec.z_internal_bottom;
        let rail_y = -(glebokosc_strefy_mm / 2.0);
        let rail_x_left = -szerokosc_strefy_mm / 2.0 + params.dystans_lewy_mm;
        let rail_x_right = szerokosc_strefy_mm / 2.0 - params.dystans_prawy_mm;
        let rail_id_upper = spec.rail_id.to_uppercase();
        let hw_model_id = if rail_id_upper.starts_with("BLUM_MERIVO") || rail_id_upper.starts_with("MR") {
            "merivobox".to_string()
        } else {
            "BLUM_ANTARO_M_L".to_string()
        };

        for (side_code, side_label, rail_x) in [
            ("L", "left", rail_x_left),
            ("R", "right", rail_x_right),
        ] {
            let side_suffix = if side_code == "L" { "L" } else { "P" };
            hardware.push(WasmHardware {
                id: format!("drawer_{}_rail_{}", i, side_code),
                name: format!("Prowadnica {}{} [{}]", i, side_suffix, spec.rail_name),
                role: "PROWADNICA".to_string(),
                hardware_type: "RAIL".to_string(),
                hardware_id: hw_model_id.clone(),
                side: side_label.to_string(),
                drawer_index: i,
                rail_id: spec.rail_id.clone(),
                length_mm: spec.length_mm,
                corpus_height: spec.corpus_height,
                z_internal_bottom: spec.z_internal_bottom,
                art_no: spec.art_no.clone(),
                internal: spec.internal,
                loc: WasmLoc { x: rail_x, y: rail_y, z: rail_z },
                dim: WasmDim { x: spec.rail_width, y: rail_len, z: spec.rail_height },
            });
        }
    }

    let result = WasmDrawersPlanResult {
        parts,
        slots,
        hardware,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("[WasmDrawers] Błąd serializacji wyniku: {}", e)))
}
