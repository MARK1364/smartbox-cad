use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmDimensionsMm {
    pub width_mm: f64,
    pub height_mm: f64,
    pub depth_mm: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmCornerShelvesParams {
    pub liczba_polek: u32,
    pub grubosc_polki_mm: f64,
    pub odsuniecie_przod_mm: f64,
    pub luz_boczny_mm: f64,
    pub bok_lewy_mm: f64,
    pub bok_prawy_mm: f64,
    pub wzor_nawiercen: String,
    pub rozstaw_potrojny_z_mm: f64,
    pub odstep_otworow_przod_mm: f64,
    pub odstep_otworow_tyl_mm: f64,
    pub plecy_odsuniecie_x_mm: f64,
    pub plecy_odsuniecie_y_mm: f64,
    pub wyciecie_listwa_narozna: bool,
    pub listwa_narozna_szerokosc_mm: f64,
    pub listwa_narozna_grubosc_mm: f64,
    pub listwa_narozna_luz_mm: f64,
    pub podporka_id: String,
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
pub struct WasmCornerShelfPart {
    pub name: String,
    pub role: String,
    pub dim: WasmDim,
    pub loc: WasmLoc,
    pub shelf_index: u32,
    pub outline2d: Vec<[f64; 2]>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmCornerShelfHardware {
    pub id: String,
    pub name: String,
    pub hardware_type: String,
    pub hardware_id: String,
    pub side: String,
    pub loc: WasmLoc,
    pub shelf_index: u32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WasmCornerShelvesPlanResult {
    pub parts: Vec<WasmCornerShelfPart>,
    pub hardware: Vec<WasmCornerShelfHardware>,
}

fn equal_shelf_center_z(h: f64, count: u32, th: f64, index: u32) -> f64 {
    if count == 0 {
        return h / 2.0;
    }
    let total_th = (count as f64) * th;
    let bay = (h - total_th) / ((count + 1) as f64);
    let idx = index as f64;
    idx * bay + (idx - 0.5) * th
}

#[wasm_bindgen]
pub fn calculate_corner_shelves_plan_wasm(
    dims_val: JsValue,
    params_val: JsValue,
) -> Result<JsValue, JsValue> {
    let dims: WasmDimensionsMm = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmCornerShelves] Błąd dims: {}", e)))?;
    let params: WasmCornerShelvesParams = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("[WasmCornerShelves] Błąd params: {}", e)))?;

    let w = dims.width_mm;
    let h = dims.height_mm;
    let d = dims.depth_mm;
    let count = params.liczba_polek;

    let mut parts = Vec::new();
    let mut hardware = Vec::new();

    if h <= 0.0 || w <= 0.0 || d <= 0.0 || count == 0 {
        let res = WasmCornerShelvesPlanResult { parts, hardware };
        return serde_wasm_bindgen::to_value(&res)
            .map_err(|e| JsValue::from_str(&format!("Błąd serializacji: {}", e)));
    }

    let bok_l_th = 18.0;
    let bok_p_th = 18.0;
    let plate_w = w;
    let plate_d = d;

    let x0 = -w / 2.0;
    let x1 = w / 2.0;
    let y0 = -d / 2.0;
    let y1 = d / 2.0;

    let safe_plecy_x = params.plecy_odsuniecie_x_mm.max(0.0);
    let safe_plecy_y = params.plecy_odsuniecie_y_mm.max(0.0);
    let eff_x0 = x0 + safe_plecy_x;
    let eff_y1 = y1 - safe_plecy_y;

    let min_bok = 10.0;
    let max_bok_l = w - 10.0;
    let max_bok_p = d - 10.0;
    let eff_bok_l = params.bok_lewy_mm.clamp(min_bok, max_bok_l);
    let eff_bok_p = params.bok_prawy_mm.clamp(min_bok, max_bok_p);

    let max_offset_front = (eff_bok_l - min_bok).min(eff_bok_p - min_bok);
    let safe_offset_front = params.odsuniecie_przod_mm.clamp(0.0, max_offset_front);

    let x_front_l = x0 + eff_bok_l - safe_offset_front;
    let y_front_p = y1 - eff_bok_p + safe_offset_front;

    let safe_luz_boczny = params.luz_boczny_mm.max(0.0);
    let y_bok_l = y0 + bok_l_th + safe_luz_boczny;
    let x_bok_p = x1 - bok_p_th - safe_luz_boczny;

    let has_nailer_cutout = params.wyciecie_listwa_narozna
        && params.listwa_narozna_szerokosc_mm > 0.0
        && params.listwa_narozna_grubosc_mm > 0.0;

    let cut_w = if has_nailer_cutout {
        (params.listwa_narozna_szerokosc_mm + params.listwa_narozna_luz_mm)
            .min((eff_y1 - y_bok_l - 10.0).max(0.0))
    } else {
        0.0
    };

    let cut_th = if has_nailer_cutout {
        (params.listwa_narozna_grubosc_mm + params.listwa_narozna_luz_mm)
            .min((x_bok_p - eff_x0 - 10.0).max(0.0))
    } else {
        0.0
    };

    let mut world_l: Vec<[f64; 2]> = vec![
        [eff_x0, y_bok_l],
        [x_front_l, y_bok_l],
        [x_front_l, y_front_p],
        [x_bok_p, y_front_p],
        [x_bok_p, eff_y1],
    ];

    if has_nailer_cutout && cut_w > 0.0 && cut_th > 0.0 {
        world_l.push([eff_x0 + cut_th, eff_y1]);
        world_l.push([eff_x0 + cut_th, eff_y1 - cut_w]);
        world_l.push([eff_x0, eff_y1 - cut_w]);
    } else {
        world_l.push([eff_x0, eff_y1]);
    }

    let mut outline_uv: Vec<[f64; 2]> = world_l
        .iter()
        .map(|&[wx, wy]| {
            [
                ((plate_w / 2.0 - wx) * 100.0).round() / 100.0,
                ((wy + plate_d / 2.0) * 100.0).round() / 100.0,
            ]
        })
        .collect();
    outline_uv.reverse();
    let outline2d = outline_uv;

    let front_inset = if params.odstep_otworow_przod_mm > 0.0 { params.odstep_otworow_przod_mm } else { 40.0 };
    let back_inset = if params.odstep_otworow_tyl_mm > 0.0 { params.odstep_otworow_tyl_mm } else { 40.0 };
    let hole_dia = 5.0;
    let pin_radius = hole_dia / 2.0;

    for i in 1..=count {
        let srodek_z_mm = equal_shelf_center_z(h, count, params.grubosc_polki_mm, i);
        let pin_center_z = srodek_z_mm - params.grubosc_polki_mm / 2.0 - pin_radius;

        let x_front_hole = x_front_l - front_inset;
        let x_back_hole = eff_x0 + back_inset;
        let y_front_hole = y_front_p + front_inset;
        let y_back_hole = eff_y1 - back_inset;

        if params.wzor_nawiercen != "NONE" {
            let pin_id = if !params.podporka_id.is_empty() {
                params.podporka_id.clone()
            } else {
                "PODPORKA_FI5".to_string()
            };

            hardware.push(WasmCornerShelfHardware {
                id: format!("corner_shelf_{}_pin_LF", i),
                name: format!("Podpórka {} (Lewy Przód)", i),
                hardware_type: "SHELF_PIN".to_string(),
                hardware_id: pin_id.clone(),
                side: "left".to_string(),
                loc: WasmLoc { x: x_front_hole, y: y0 + bok_l_th, z: pin_center_z },
                shelf_index: i,
            });
            hardware.push(WasmCornerShelfHardware {
                id: format!("corner_shelf_{}_pin_LB", i),
                name: format!("Podpórka {} (Lewy Tył)", i),
                hardware_type: "SHELF_PIN".to_string(),
                hardware_id: pin_id.clone(),
                side: "left".to_string(),
                loc: WasmLoc { x: x_back_hole, y: y0 + bok_l_th, z: pin_center_z },
                shelf_index: i,
            });
            hardware.push(WasmCornerShelfHardware {
                id: format!("corner_shelf_{}_pin_RF", i),
                name: format!("Podpórka {} (Prawy Przód)", i),
                hardware_type: "SHELF_PIN".to_string(),
                hardware_id: pin_id.clone(),
                side: "right".to_string(),
                loc: WasmLoc { x: x1 - bok_p_th, y: y_front_hole, z: pin_center_z },
                shelf_index: i,
            });
            hardware.push(WasmCornerShelfHardware {
                id: format!("corner_shelf_{}_pin_RB", i),
                name: format!("Podpórka {} (Prawy Tył)", i),
                hardware_type: "SHELF_PIN".to_string(),
                hardware_id: pin_id,
                side: "right".to_string(),
                loc: WasmLoc { x: x1 - bok_p_th, y: y_back_hole, z: pin_center_z },
                shelf_index: i,
            });
        }

        parts.push(WasmCornerShelfPart {
            name: format!("Polka_{}", i),
            role: "SHELF".to_string(),
            dim: WasmDim {
                x: plate_w,
                y: plate_d,
                z: params.grubosc_polki_mm,
            },
            loc: WasmLoc {
                x: 0.0,
                y: 0.0,
                z: srodek_z_mm,
            },
            shelf_index: i,
            outline2d: outline2d.clone(),
        });
    }

    let res = WasmCornerShelvesPlanResult { parts, hardware };
    serde_wasm_bindgen::to_value(&res)
        .map_err(|e| JsValue::from_str(&format!("Błąd serializacji wyniku: {}", e)))
}

