use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct SkosneDoorsDimsInput {
    pub width_mm: f64,
    pub height_mm: f64,
    pub depth_mm: f64,
}

#[derive(Deserialize, Clone)]
pub struct ActiveHingeInput {
    pub index: u32,
    pub pozycja_lokalna_z_mm: f64,
}

#[derive(Deserialize)]
pub struct SkosneDoorsParamsInput {
    pub rodzaj_drzwi: String,
    pub grubosc_frontu_mm: f64,
    pub szczelina_mm: f64,
    pub nalozenie_gora_mm: f64,
    pub nalozenie_dol_mm: f64,
    pub nalozenie_lewe_mm: f64,
    pub nalozenie_prawe_mm: f64,
    pub dach_kat_deg: f64,
    pub domyslny_zawias_id: String,
    pub aktywne_zawiasy: Vec<ActiveHingeInput>,
    pub aktywne_zawiasy_lewe: Vec<ActiveHingeInput>,
    pub aktywne_zawiasy_prawe: Vec<ActiveHingeInput>,
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
pub struct WasmSkosnePart {
    pub name: String,
    pub role: String,
    pub node_type: String,
    pub dim: WasmDim,
    pub loc: WasmLoc,
    pub outline2d: Vec<[f64; 2]>,
    pub hinge_side: String,
    pub skos_front: String,
    pub vertical_edge: String,
    pub slanted_edge: String,
}

#[derive(Serialize)]
pub struct WasmSkosneHardware {
    pub id: String,
    pub name: String,
    pub hardware_id: String,
    pub side: String,
    pub loc: WasmLoc,
    pub hinge_index: u32,
    pub local_z: f64,
}

#[derive(Serialize)]
pub struct SkosneDoorsPlanWasmOutput {
    pub parts: Vec<WasmSkosnePart>,
    pub hardware: Vec<WasmSkosneHardware>,
}

pub fn skosne_height_at_x(
    x_mm: f64,
    wysokosc_strefy_mm: f64,
    dach_kat_deg: f64,
    nalozenie_gora_mm: f64,
    nalozenie_dol_mm: f64,
) -> f64 {
    let beta_rad = (dach_kat_deg * std::f64::consts::PI) / 180.0;
    let tan_beta = beta_rad.tan();
    let cos_beta = beta_rad.cos();
    let top_rise = if cos_beta.abs() < 1e-6 {
        nalozenie_gora_mm
    } else {
        nalozenie_gora_mm / cos_beta
    };
    wysokosc_strefy_mm + x_mm * tan_beta + nalozenie_dol_mm + top_rise
}

#[wasm_bindgen]
pub fn calculate_skosne_doors_plan_wasm(
    dims_val: JsValue,
    params_val: JsValue,
) -> Result<JsValue, JsValue> {
    let dims: SkosneDoorsDimsInput = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid dims: {}", e)))?;
    let params: SkosneDoorsParamsInput = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

    let width_mm = dims.width_mm;
    let height_mm = dims.height_mm;
    let depth_mm = dims.depth_mm;

    let spod_drzwi_mm = -params.nalozenie_dol_mm;
    let pozycja_y_mm = -(depth_mm / 2.0 + params.grubosc_frontu_mm / 2.0);

    let mut parts = Vec::new();
    let mut hardware = Vec::new();

    let cup_edge_dist = 22.5; // standard Blum/GTV

    let add_hardware_for_side = |
        side: &str,
        door_width_mm: f64,
        door_pos_x_mm: f64,
        hinges: &[ActiveHingeInput],
        out_hw: &mut Vec<WasmSkosneHardware>
    | {
        for hinge in hinges {
            let local_z = hinge.pozycja_lokalna_z_mm;
            let v_center = local_z + params.nalozenie_dol_mm;
            let u = if side == "left" {
                cup_edge_dist
            } else {
                door_width_mm - cup_edge_dist
            };

            let side_pl = if side == "left" { "Lewy" } else { "Prawy" };
            out_hw.push(WasmSkosneHardware {
                id: format!("hinge_{}_{}", side, hinge.index),
                name: format!("Zawias {} ({}) [{}]", hinge.index, side_pl, params.domyslny_zawias_id),
                hardware_id: params.domyslny_zawias_id.clone(),
                side: side.to_string(),
                loc: WasmLoc {
                    x: door_pos_x_mm - door_width_mm / 2.0 + u,
                    y: pozycja_y_mm,
                    z: spod_drzwi_mm + v_center,
                },
                hinge_index: hinge.index,
                local_z,
            });
        }
    };

    if params.rodzaj_drzwi == "DOUBLE" {
        let baza_szerokosc_mm = (width_mm - params.szczelina_mm) / 2.0;
        let szerokosc_lewe_mm = (baza_szerokosc_mm + params.nalozenie_lewe_mm).max(10.0);
        let szerokosc_prawe_mm = (baza_szerokosc_mm + params.nalozenie_prawe_mm).max(10.0);

        let pozycja_lewe_x_mm = -width_mm / 2.0 - params.nalozenie_lewe_mm + szerokosc_lewe_mm / 2.0;
        let pozycja_prawe_x_mm = width_mm / 2.0 + params.nalozenie_prawe_mm - szerokosc_prawe_mm / 2.0;

        let x_lewe_l = -width_mm / 2.0 - params.nalozenie_lewe_mm;
        let x_lewe_p = -params.szczelina_mm / 2.0;
        let h_lewe_l = skosne_height_at_x(x_lewe_l, height_mm, params.dach_kat_deg, params.nalozenie_gora_mm, params.nalozenie_dol_mm);
        let h_lewe_p = skosne_height_at_x(x_lewe_p, height_mm, params.dach_kat_deg, params.nalozenie_gora_mm, params.nalozenie_dol_mm);
        let wysokosc_drzwi_lewe_mm = h_lewe_l.max(h_lewe_p);
        let outline2d_lewe = vec![
            [0.0, 0.0],
            [szerokosc_lewe_mm, 0.0],
            [szerokosc_lewe_mm, h_lewe_p],
            [0.0, h_lewe_l],
        ];
        let pozycja_lewe_z_mm = spod_drzwi_mm + wysokosc_drzwi_lewe_mm / 2.0;

        let x_prawe_l = params.szczelina_mm / 2.0;
        let x_prawe_p = width_mm / 2.0 + params.nalozenie_prawe_mm;
        let h_prawe_l = skosne_height_at_x(x_prawe_l, height_mm, params.dach_kat_deg, params.nalozenie_gora_mm, params.nalozenie_dol_mm);
        let h_prawe_p = skosne_height_at_x(x_prawe_p, height_mm, params.dach_kat_deg, params.nalozenie_gora_mm, params.nalozenie_dol_mm);
        let wysokosc_drzwi_prawe_mm = h_prawe_l.max(h_prawe_p);
        let outline2d_prawe = vec![
            [0.0, 0.0],
            [szerokosc_prawe_mm, 0.0],
            [szerokosc_prawe_mm, h_prawe_p],
            [0.0, h_prawe_l],
        ];
        let pozycja_prawe_z_mm = spod_drzwi_mm + wysokosc_drzwi_prawe_mm / 2.0;

        parts.push(WasmSkosnePart {
            name: "Drzwi_Skosne_Lewe".to_string(),
            role: "FRONT".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: szerokosc_lewe_mm,
                y: params.grubosc_frontu_mm,
                z: wysokosc_drzwi_lewe_mm,
            },
            loc: WasmLoc {
                x: pozycja_lewe_x_mm,
                y: pozycja_y_mm,
                z: pozycja_lewe_z_mm,
            },
            outline2d: outline2d_lewe,
            hinge_side: "left".to_string(),
            skos_front: "DOUBLE".to_string(),
            vertical_edge: "-X".to_string(),
            slanted_edge: "+Y".to_string(),
        });

        parts.push(WasmSkosnePart {
            name: "Drzwi_Skosne_Prawe".to_string(),
            role: "FRONT".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: szerokosc_prawe_mm,
                y: params.grubosc_frontu_mm,
                z: wysokosc_drzwi_prawe_mm,
            },
            loc: WasmLoc {
                x: pozycja_prawe_x_mm,
                y: pozycja_y_mm,
                z: pozycja_prawe_z_mm,
            },
            outline2d: outline2d_prawe,
            hinge_side: "right".to_string(),
            skos_front: "DOUBLE".to_string(),
            vertical_edge: "+X".to_string(),
            slanted_edge: "+Y".to_string(),
        });

        add_hardware_for_side("left", szerokosc_lewe_mm, pozycja_lewe_x_mm, &params.aktywne_zawiasy_lewe, &mut hardware);
        add_hardware_for_side("right", szerokosc_prawe_mm, pozycja_prawe_x_mm, &params.aktywne_zawiasy_prawe, &mut hardware);
    } else {
        let szerokosc_drzwi_mm = (width_mm + params.nalozenie_lewe_mm + params.nalozenie_prawe_mm).max(10.0);
        let pozycja_x_mm = (params.nalozenie_prawe_mm - params.nalozenie_lewe_mm) / 2.0;

        let x_l = -width_mm / 2.0 - params.nalozenie_lewe_mm;
        let x_p = width_mm / 2.0 + params.nalozenie_prawe_mm;
        let h_l = skosne_height_at_x(x_l, height_mm, params.dach_kat_deg, params.nalozenie_gora_mm, params.nalozenie_dol_mm);
        let h_p = skosne_height_at_x(x_p, height_mm, params.dach_kat_deg, params.nalozenie_gora_mm, params.nalozenie_dol_mm);
        let wysokosc_drzwi_mm = h_l.max(h_p);
        let pozycja_z_mm = spod_drzwi_mm + wysokosc_drzwi_mm / 2.0;

        let outline2d = vec![
            [0.0, 0.0],
            [szerokosc_drzwi_mm, 0.0],
            [szerokosc_drzwi_mm, h_p],
            [0.0, h_l],
        ];

        let hinge_side = if params.rodzaj_drzwi == "LEFT" { "left" } else { "right" };
        let name = if params.rodzaj_drzwi == "LEFT" { "Drzwi_Skosne_Lewe" } else { "Drzwi_Skosne_Prawe" };

        parts.push(WasmSkosnePart {
            name: name.to_string(),
            role: "FRONT".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: szerokosc_drzwi_mm,
                y: params.grubosc_frontu_mm,
                z: wysokosc_drzwi_mm,
            },
            loc: WasmLoc {
                x: pozycja_x_mm,
                y: pozycja_y_mm,
                z: pozycja_z_mm,
            },
            outline2d,
            hinge_side: hinge_side.to_string(),
            skos_front: params.rodzaj_drzwi.clone(),
            vertical_edge: if params.rodzaj_drzwi == "LEFT" { "-X".to_string() } else { "+X".to_string() },
            slanted_edge: if params.rodzaj_drzwi == "LEFT" { "+Y".to_string() } else { "-Y".to_string() },
        });

        add_hardware_for_side(hinge_side, szerokosc_drzwi_mm, pozycja_x_mm, &params.aktywne_zawiasy, &mut hardware);
    }

    let output = SkosneDoorsPlanWasmOutput { parts, hardware };
    serde_wasm_bindgen::to_value(&output)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
