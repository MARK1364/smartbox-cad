use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Deserialize)]
pub struct CabinetDimsInput {
    pub szerokosc_mm: f64,
    pub wysokosc_mm: f64,
    pub glebokosc_mm: f64,
}

#[derive(Deserialize)]
pub struct CabinetParamsInput {
    pub typ_korpusu: Option<String>,
    pub liczba_stref: Option<u32>,
    pub wysokosc_strefy_dolnej_mm: Option<f64>,
    pub wysokosc_strefy_srodkowej_mm: Option<f64>,
    pub cofniecie_plecow_mm: Option<f64>,
    pub grubosc_plecow_mm: Option<f64>,
    pub wpuszczenie_plecow_mm: Option<f64>,
    pub tryb_wienca_gornego: Option<String>,
    pub szerokosc_trawersu_mm: Option<f64>,
    pub szerokosc_blendy_mm: Option<f64>,
    pub strona_blendy: Option<String>,
    pub glebokosc_boku_lewego_mm: Option<f64>,
    pub glebokosc_boku_prawego_mm: Option<f64>,
    pub szerokosc_listwy_naroznej_mm: Option<f64>,
    pub typ_listwy_naroznej: Option<String>,
    pub wysokosc_przod_mm: Option<f64>,
    pub wysokosc_tyl_mm: Option<f64>,
    pub wysokosc_lewy_mm: Option<f64>,
    pub wysokosc_prawy_mm: Option<f64>,
    pub grubosc_plyty_mm: Option<f64>,
    pub offsets: Option<HashMap<String, f64>>,
}

const BACK_OVERLAP_EPS_MM: f64 = 0.001;

fn strip_zone_prefix_upper(s: &str) -> &str {
    for pfx in ["DOL_", "SRODEK_", "GORA_", "B_", "M_", "T_"] {
        if let Some(rest) = s.strip_prefix(pfx) {
            return rest;
        }
    }
    s
}

fn strip_numeric_suffix(s: &str) -> &str {
    for sep in ['.', '_'] {
        if let Some(pos) = s.rfind(sep) {
            let tail = &s[pos + 1..];
            if !tail.is_empty() && tail.bytes().all(|b| b.is_ascii_digit()) {
                return &s[..pos];
            }
        }
    }
    s
}

fn strip_numeric_before_edge_upper(s: &str) -> String {
    for suf in ["_+X", "_-X", "_+Y", "_-Y"] {
        if let Some(stem) = s.strip_suffix(suf) {
            let clean = strip_numeric_suffix(stem);
            return format!("{}{}", clean, suf);
        }
    }
    s.to_string()
}

fn find_in_offsets(offsets: &HashMap<String, f64>, key: &str) -> Option<f64> {
    if let Some(&v) = offsets.get(key) {
        if v.is_finite() {
            return Some(v);
        }
    }
    let key_upper = key.to_uppercase();
    let clean_key = strip_numeric_before_edge_upper(&key_upper);
    for (k, &v) in offsets {
        if !v.is_finite() {
            continue;
        }
        let k_upper = k.to_uppercase();
        let clean_k = strip_numeric_before_edge_upper(&k_upper);
        if k_upper == key_upper || clean_k == key_upper || k_upper == clean_key || clean_k == clean_key {
            return Some(v);
        }
    }
    None
}

fn read_panel_offset(offsets: &HashMap<String, f64>, names: &[&str], suffix: &str) -> Option<f64> {
    if offsets.is_empty() {
        return None;
    }
    for name in names {
        let exact = format!("{}_{}", name, suffix);
        if let Some(&v) = offsets.get(&exact) {
            if v.is_finite() {
                return Some(v);
            }
        }
    }
    let suffix_upper = format!("_{}", suffix).to_uppercase();
    let mut candidate_stems: HashSet<String> = HashSet::new();
    for name in names {
        let u = name.to_uppercase();
        if u.is_empty() {
            continue;
        }
        candidate_stems.insert(u.clone());
        candidate_stems.insert(strip_zone_prefix_upper(&u).to_string());
        let no_num = strip_numeric_suffix(&u);
        candidate_stems.insert(no_num.to_string());
        candidate_stems.insert(strip_numeric_suffix(strip_zone_prefix_upper(&u)).to_string());
    }
    candidate_stems.remove("");

    for (k, &v) in offsets {
        if !v.is_finite() {
            continue;
        }
        let k_upper = k.to_uppercase();
        if !k_upper.ends_with(&suffix_upper) {
            continue;
        }
        let key_stem = &k_upper[..k_upper.len() - suffix_upper.len()];
        let clean_stem = strip_zone_prefix_upper(strip_numeric_suffix(key_stem));
        if candidate_stems.contains(key_stem) || candidate_stems.contains(clean_stem) {
            return Some(v);
        }
    }
    None
}

fn build_zone_shift_keys(zone_prefix: &str, panel_name: &str, stems: &[&str], shift_suffix: &str) -> Vec<String> {
    let name_upper = panel_name.to_uppercase();
    let pfx_upper = zone_prefix.to_uppercase();
    let is_m = pfx_upper.starts_with('M') || name_upper.starts_with("M_") || name_upper.starts_with("SRODEK");
    let is_t = pfx_upper.starts_with('T') || name_upper.starts_with("T_") || name_upper.starts_with("GORA");
    let mut keys = Vec::new();
    if is_m {
        for s in stems {
            keys.push(format!("Srodek_{}_{}", s, shift_suffix));
            keys.push(format!("M_{}_{}", s, shift_suffix));
        }
    } else if is_t {
        for s in stems {
            keys.push(format!("Gora_{}_{}", s, shift_suffix));
            keys.push(format!("T_{}_{}", s, shift_suffix));
        }
    } else {
        for s in stems {
            keys.push(format!("Dol_{}_{}", s, shift_suffix));
            keys.push(format!("B_{}_{}", s, shift_suffix));
        }
        for s in stems {
            keys.push(format!("{}_{}", s, shift_suffix));
        }
    }
    keys
}

fn read_surrounding_panel_inward_shift(
    offsets: &HashMap<String, f64>,
    suffix: &str,
    zone_prefix: &str,
    panel_name: &str,
) -> f64 {
    if offsets.is_empty() {
        return 0.0;
    }
    let (stems, shift_suffix): (&[&str], &str) = match suffix {
        "-Y" => (&["Wieniec_D", "WIENIEC_D", "BOTTOM_PANEL", "BOTTOM"], "shiftZ"),
        "+Y" => (&["Wieniec_G", "WIENIEC_G", "TOP_PANEL", "TOP"], "shiftZ"),
        "-X" => (&["Bok_L", "BOK_L", "LEFT_SIDE_PANEL", "SIDE_LEFT"], "shiftX"),
        "+X" => (&["Bok_P", "BOK_P", "RIGHT_SIDE_PANEL", "SIDE_RIGHT"], "shiftX"),
        _ => return 0.0,
    };
    for k in build_zone_shift_keys(zone_prefix, panel_name, stems, shift_suffix) {
        if let Some(v) = find_in_offsets(offsets, &k) {
            return -v;
        }
    }
    0.0
}

fn read_back_edge_offset(
    offsets: &HashMap<String, f64>,
    panel_name: &str,
    suffix: &str,
    default_mm: f64,
    zone_prefix: &str,
) -> f64 {
    if offsets.is_empty() {
        return default_mm;
    }
    if let Some(v) = find_in_offsets(offsets, &format!("{}_{}", panel_name, suffix)) {
        return v;
    }
    let name_upper = panel_name.to_uppercase();
    let clean_name = strip_zone_prefix_upper(&name_upper);
    if let Some(v) = find_in_offsets(offsets, &format!("{}_{}", clean_name, suffix)) {
        return v;
    }
    let name_upper = panel_name.to_uppercase();
    let pfx_upper = zone_prefix.to_uppercase();
    if pfx_upper.starts_with('M') || name_upper.starts_with("M_") || name_upper.starts_with("SRODEK") {
        for stem in ["Srodek_Plecy", "M_Plecy", "M_BACK"] {
            if let Some(v) = find_in_offsets(offsets, &format!("{}_{}", stem, suffix)) {
                return v;
            }
        }
        return default_mm + read_surrounding_panel_inward_shift(offsets, suffix, "M_", panel_name);
    }
    if pfx_upper.starts_with('T') || name_upper.starts_with("T_") || name_upper.starts_with("GORA") {
        for stem in ["Gora_Plecy", "T_Plecy", "T_BACK"] {
            if let Some(v) = find_in_offsets(offsets, &format!("{}_{}", stem, suffix)) {
                return v;
            }
        }
        return default_mm + read_surrounding_panel_inward_shift(offsets, suffix, "T_", panel_name);
    }
    for stem in ["Dol_Plecy", "B_Plecy", "B_BACK", "Plecy", "BACK_PANEL", "BACK"] {
        if let Some(v) = find_in_offsets(offsets, &format!("{}_{}", stem, suffix)) {
            return v;
        }
    }
    default_mm + read_surrounding_panel_inward_shift(offsets, suffix, zone_prefix, panel_name)
}

fn read_back_shift_y(offsets: &HashMap<String, f64>, zone_prefix: &str) -> f64 {
    if offsets.is_empty() {
        return 0.0;
    }
    let pfx_plecy = format!("{}Plecy_shiftY", zone_prefix);
    let pfx_back = format!("{}BACK_PANEL_shiftY", zone_prefix);
    let candidates = [
        pfx_plecy.as_str(),
        pfx_back.as_str(),
        "Dol_Plecy_shiftY",
        "B_Plecy_shiftY",
        "Plecy_shiftY",
        "BACK_PANEL_shiftY",
    ];
    for k in candidates {
        if let Some(&v) = offsets.get(k) {
            if v.is_finite() {
                return v;
            }
        }
    }
    0.0
}

#[derive(Serialize, Default)]
pub struct WasmDim {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Serialize, Default)]
pub struct WasmLoc {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Serialize)]
pub struct WasmZoneLayout {
    pub zone_key: String,
    pub size: f64,
    pub base_offset: f64,
}

#[derive(Serialize, Clone)]
pub struct WasmEdgeBandEntry {
    pub active: bool,
    pub type_id: String,
    #[serde(rename = "cutAngle", skip_serializing_if = "Option::is_none")]
    pub cut_angle: Option<f64>,
    #[serde(rename = "cutAnchor", skip_serializing_if = "Option::is_none")]
    pub cut_anchor: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct WasmEdgeBandingMap {
    #[serde(rename = "+X")]
    pub x_plus: WasmEdgeBandEntry,
    #[serde(rename = "-X")]
    pub x_minus: WasmEdgeBandEntry,
    #[serde(rename = "+Y")]
    pub y_plus: WasmEdgeBandEntry,
    #[serde(rename = "-Y")]
    pub y_minus: WasmEdgeBandEntry,
}

#[derive(Serialize, Clone)]
pub struct WasmBackGrooveTrapezoid {
    #[serde(rename = "hF")]
    pub h_f: f64,
    #[serde(rename = "hB")]
    pub h_b: f64,
    #[serde(rename = "D")]
    pub d: f64,
    pub thickness: f64,
    #[serde(rename = "backOffset")]
    pub back_offset: f64,
    #[serde(rename = "shiftY")]
    pub shift_y: f64,
    pub grubosc_plecow_mm: f64,
    pub margines_gorny_plecow_mm: f64,
}

#[derive(Serialize, Default)]
pub struct WasmCabinetPart {
    pub key: String,
    pub name: String,
    pub role: String,
    pub material: String,
    pub material_name: String,
    pub material_code: String,
    pub thickness: f64,
    pub dim: WasmDim,
    pub loc: WasmLoc,
    pub zone_prefix: String,
    pub zone_id: String,
    pub outline2d: Option<Vec<[f64; 2]>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shape: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lcs_rotation: Option<[f64; 3]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edge_banding: Option<WasmEdgeBandingMap>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub back_groove_trapezoid: Option<WasmBackGrooveTrapezoid>,
}

#[derive(Serialize)]
pub struct CabinetPlanWasmOutput {
    pub parts: Vec<WasmCabinetPart>,
    pub zones: Vec<WasmZoneLayout>,
}

pub fn compute_zones(
    liczba_stref: u32,
    height: f64,
    h_bottom: f64,
    h_middle: f64,
) -> Vec<WasmZoneLayout> {
    match liczba_stref {
        1 => vec![WasmZoneLayout {
            zone_key: "SEKCJA_B".to_string(),
            size: height,
            base_offset: 0.0,
        }],
        2 => {
            let top_size = (height - h_bottom).max(0.0);
            vec![
                WasmZoneLayout {
                    zone_key: "SEKCJA_B".to_string(),
                    size: h_bottom,
                    base_offset: 0.0,
                },
                WasmZoneLayout {
                    zone_key: "SEKCJA_T".to_string(),
                    size: top_size,
                    base_offset: h_bottom,
                },
            ]
        }
        _ => {
            let top_size = (height - h_bottom - h_middle).max(0.0);
            vec![
                WasmZoneLayout {
                    zone_key: "SEKCJA_B".to_string(),
                    size: h_bottom,
                    base_offset: 0.0,
                },
                WasmZoneLayout {
                    zone_key: "SEKCJA_M".to_string(),
                    size: h_middle,
                    base_offset: h_bottom,
                },
                WasmZoneLayout {
                    zone_key: "SEKCJA_T".to_string(),
                    size: top_size,
                    base_offset: h_bottom + h_middle,
                },
            ]
        }
    }
}

#[wasm_bindgen]
pub fn calculate_cabinet_plan_wasm(
    dims_val: JsValue,
    params_val: JsValue,
) -> Result<JsValue, JsValue> {
    let dims: CabinetDimsInput = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid dims: {}", e)))?;
    let params: CabinetParamsInput = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

    let w = dims.szerokosc_mm;
    let h = dims.wysokosc_mm;
    let d = dims.glebokosc_mm;

    let typ = params.typ_korpusu.as_deref().unwrap_or("korpus3").to_lowercase();
    let liczba_stref = params.liczba_stref.unwrap_or(1);
    let tryb_wienca = params.tryb_wienca_gornego.as_deref().unwrap_or("FULL");
    let strona_blendy = params.strona_blendy.as_deref().unwrap_or("LEFT");
    let cofniecie_plecow = params.cofniecie_plecow_mm.unwrap_or(15.0);
    let grubosc_plecow = params.grubosc_plecow_mm.unwrap_or(3.0);
    // W TS standard-geometry.ts:422 domyślna zakładka pleców wynosi zawsze 11.0 mm (chyba że przekazano offsets)
    let wpuszczenie_plecow = 11.0;
    let szerokosc_trawersu = params.szerokosc_trawersu_mm.unwrap_or(100.0);

    let t = params.grubosc_plyty_mm.unwrap_or(18.0);
    let t_back = grubosc_plecow;
    let def_mat = "W1100_ST9_18".to_string();
    let def_mat_name = "Biały Alpejski".to_string();
    let def_mat_code = "W1100 ST9".to_string();

    let def_back_mat = "HDF_BIALY_3".to_string();
    let def_back_name = "HDF Biały 3mm".to_string();
    let def_back_code = "HDF_WHITE_3".to_string();

    let mut parts = Vec::new();

    let empty_offsets: HashMap<String, f64> = HashMap::new();
    let offsets = params.offsets.as_ref().unwrap_or(&empty_offsets);
    let groove_default = wpuszczenie_plecow;

    // -------------------------------------------------------------
    // PRZYPADEK 1: KORPUS ROGOWY 90° (L-SHAPE 90°)
    // -------------------------------------------------------------
    if typ.contains("rogowy90") || typ.contains("rogowy_90") {
        let zones = vec![WasmZoneLayout {
            zone_key: "SEKCJA_B".to_string(),
            size: h,
            base_offset: 0.0,
        }];

        let min_bok = 100.0;
        let max_bok_l = (w - min_bok).max(min_bok);
        let max_bok_p = (d - min_bok).max(min_bok);
        let bok_l = params.glebokosc_boku_lewego_mm.unwrap_or(600.0).clamp(min_bok, max_bok_l);
        let bok_p = params.glebokosc_boku_prawego_mm.unwrap_or(600.0).clamp(min_bok, max_bok_p);
        let nailer_w = params.szerokosc_listwy_naroznej_mm.unwrap_or(100.0);
        let typ_listwy = params.typ_listwy_naroznej.as_deref().unwrap_or("POJEDYNCZA");

        let read_back_inset = |stem: &str, shift_suf: &str| -> f64 {
            for cand in [format!("B_{}", stem), stem.to_string()] {
                if let Some(v) = find_in_offsets(offsets, &format!("{}_{}", cand, shift_suf)) {
                    return v;
                }
            }
            cofniecie_plecow
        };
        let inset_x = read_back_inset("PLECY_X", "shiftX");
        let inset_y = read_back_inset("PLECY_Y", "shiftY");

        let read_c90 = |names: &[&str]| -> (f64, f64, f64, f64, f64, f64, f64) {
            let py_plus = read_panel_offset(offsets, names, "+Y").unwrap_or(0.0);
            let py_minus = read_panel_offset(offsets, names, "-Y").unwrap_or(0.0);
            let px_minus = read_panel_offset(offsets, names, "-X").unwrap_or(0.0);
            let px_plus = read_panel_offset(offsets, names, "+X").unwrap_or(0.0);
            let sx = read_panel_offset(offsets, names, "shiftX").unwrap_or(0.0);
            let sy = read_panel_offset(offsets, names, "shiftY").unwrap_or(0.0);
            let sz = read_panel_offset(offsets, names, "shiftZ").unwrap_or(0.0);
            (py_plus, py_minus, px_minus, px_plus, sx, sy, sz)
        };

        // 1. Bok Prawy (w osi YZ przy +X)
        {
            let (py_p, py_m, px_m, px_p, sx, sy, sz) = read_c90(&["Bok_P", "BOK_P", "BOK_X", "RIGHT_SIDE_PANEL"]);
            let overlap_right_y = read_back_edge_offset(offsets, "PLECY_Y", "+X", groove_default, "");
            let cut_y = if overlap_right_y >= t - BACK_OVERLAP_EPS_MM { inset_y } else { 0.0 };
            let eff_bok_p = bok_p - cut_y;
            parts.push(WasmCabinetPart {
                key: "BOK_P".to_string(),
                name: "Bok_P".to_string(),
                role: "RIGHT_SIDE_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim {
                    x: (h + py_p + py_m).max(1.0),
                    y: (eff_bok_p + px_m + px_p).max(1.0),
                    z: t,
                },
                loc: WasmLoc {
                    x: w / 2.0 - t / 2.0 + sx,
                    y: (d / 2.0 - cut_y) - eff_bok_p / 2.0 + (px_p - px_m) / 2.0 + sy,
                    z: h / 2.0 + (py_p - py_m) / 2.0 + sz,
                },
                zone_prefix: String::new(),
                zone_id: String::new(),
                outline2d: None,
                ..Default::default()
            });
        }

        // 2. Bok Lewy (w osi XZ przy -Y)
        {
            let (py_p, py_m, px_m, px_p, sx, sy, sz) = read_c90(&["Bok_L", "BOK_L", "BOK_Y", "LEFT_SIDE_PANEL"]);
            let overlap_front_x = read_back_edge_offset(offsets, "PLECY_X", "-X", groove_default, "");
            let cut_x = if overlap_front_x >= t - BACK_OVERLAP_EPS_MM { inset_x } else { 0.0 };
            let eff_bok_l = bok_l - cut_x;
            parts.push(WasmCabinetPart {
                key: "BOK_L".to_string(),
                name: "Bok_L".to_string(),
                role: "LEFT_SIDE_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim {
                    x: (eff_bok_l + px_m + px_p).max(1.0),
                    y: t,
                    z: (h + py_p + py_m).max(1.0),
                },
                loc: WasmLoc {
                    x: (-w / 2.0 + cut_x) + eff_bok_l / 2.0 + (px_p - px_m) / 2.0 + sx,
                    y: -d / 2.0 + t / 2.0 + sy,
                    z: h / 2.0 + (py_p - py_m) / 2.0 + sz,
                },
                zone_prefix: String::new(),
                zone_id: String::new(),
                outline2d: None,
                ..Default::default()
            });
        }

        // 3. Plecy Y (ściana tylna +Y w osi XZ)
        {
            let (_py_p, _py_m, _px_m, _px_p, sx, _sy, sz) = read_c90(&["Plecy_Y", "PLECY_Y", "BACK_Y"]);
            let overlap_left = read_back_edge_offset(offsets, "PLECY_Y", "-X", 0.0, "");
            let overlap_right = read_back_edge_offset(offsets, "PLECY_Y", "+X", groove_default, "");
            let overlap_bottom = read_back_edge_offset(offsets, "PLECY_Y", "-Y", groove_default, "");
            let overlap_top = read_back_edge_offset(offsets, "PLECY_Y", "+Y", groove_default, "");

            let inward_bottom = read_surrounding_panel_inward_shift(offsets, "-Y", "", "PLECY_Y");
            let inward_top = read_surrounding_panel_inward_shift(offsets, "+Y", "", "PLECY_Y");
            let z_bottom_inner = t + inward_bottom;

            let inner_w = (w - inset_x - t).max(1.0);
            let inner_h = (h - 2.0 * t) - inward_bottom - inward_top;
            let back_y_w = inner_w + overlap_left + overlap_right;
            let back_y_h = (inner_h + overlap_bottom + overlap_top).max(1.0);
            let mid_x = (-w / 2.0 + inset_x + w / 2.0 - t) / 2.0;

            parts.push(WasmCabinetPart {
                key: "PLECY_Y".to_string(),
                name: "Plecy_Y".to_string(),
                role: "BACK_PANEL".to_string(),
                material: def_back_mat.clone(),
                material_name: def_back_name.clone(),
                material_code: def_back_code.clone(),
                thickness: t_back,
                dim: WasmDim { x: back_y_w, y: t_back, z: back_y_h },
                loc: WasmLoc {
                    x: mid_x + (overlap_right - overlap_left) / 2.0 + sx,
                    y: d / 2.0 + t_back / 2.0 - inset_y,
                    z: z_bottom_inner - overlap_bottom + back_y_h / 2.0 + sz,
                },
                zone_prefix: String::new(),
                zone_id: String::new(),
                outline2d: None,
                ..Default::default()
            });
        }

        // 4. Plecy X (ściana boczna -X w osi YZ)
        {
            let (_py_p, _py_m, _px_m, _px_p, _sx, sy, sz) = read_c90(&["Plecy_X", "PLECY_X", "BACK_X"]);
            let overlap_bottom = read_back_edge_offset(offsets, "PLECY_X", "-Y", groove_default, "");
            let overlap_top = read_back_edge_offset(offsets, "PLECY_X", "+Y", groove_default, "");
            let overlap_front = read_back_edge_offset(offsets, "PLECY_X", "-X", groove_default, "");
            let overlap_back = read_back_edge_offset(offsets, "PLECY_X", "+X", 0.0, "");

            let inward_bottom = read_surrounding_panel_inward_shift(offsets, "-Y", "", "PLECY_X");
            let inward_top = read_surrounding_panel_inward_shift(offsets, "+Y", "", "PLECY_X");
            let z_bottom_inner = t + inward_bottom;

            let inner_h = (h - 2.0 * t) - inward_bottom - inward_top;
            let inner_d = (d - inset_y - t).max(1.0);
            let back_x_h = (inner_h + overlap_bottom + overlap_top).max(1.0);
            let back_x_d = inner_d + overlap_front + overlap_back;
            let mid_y = (-d / 2.0 + t + d / 2.0 - inset_y) / 2.0;

            parts.push(WasmCabinetPart {
                key: "PLECY_X".to_string(),
                name: "Plecy_X".to_string(),
                role: "BACK_PANEL".to_string(),
                material: def_back_mat.clone(),
                material_name: def_back_name.clone(),
                material_code: def_back_code.clone(),
                thickness: t_back,
                dim: WasmDim { x: back_x_h, y: back_x_d, z: t_back },
                loc: WasmLoc {
                    x: -w / 2.0 - t_back / 2.0 + inset_x,
                    y: mid_y + (overlap_back - overlap_front) / 2.0 + sy,
                    z: z_bottom_inner - overlap_bottom + back_x_h / 2.0 + sz,
                },
                zone_prefix: String::new(),
                zone_id: String::new(),
                outline2d: None,
                ..Default::default()
            });
        }

        let inner_h = (h - 2.0 * t).max(1.0);

        // 5. Listwa narożna 1
        {
            let (py_p, py_m, px_m, px_p, sx, sy, sz) = read_c90(&["Listwa_Narozna", "LISTWA_NAROZNA", "KOTWICA_ROG", "CORNER_NAILER"]);
            let loc_nailer_x = if typ_listwy == "KATOWA_90" {
                -w / 2.0 + inset_x + nailer_w - t / 2.0 + sx
            } else {
                -w / 2.0 + inset_x + t / 2.0 + sx
            };
            parts.push(WasmCabinetPart {
                key: "LISTWA_NAROZNA".to_string(),
                name: "Listwa_Narozna".to_string(),
                role: "CORNER_NAILER".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim {
                    x: inner_h + py_p + py_m,
                    y: nailer_w + px_m + px_p,
                    z: t,
                },
                loc: WasmLoc {
                    x: loc_nailer_x,
                    y: d / 2.0 - inset_y - nailer_w / 2.0 + (px_p - px_m) / 2.0 + sy,
                    z: t + inner_h / 2.0 + (py_p - py_m) / 2.0 + sz,
                },
                zone_prefix: String::new(),
                zone_id: String::new(),
                outline2d: None,
                ..Default::default()
            });
        }

        // 6. Listwa narożna 2 (KATOWA_90)
        if typ_listwy == "KATOWA_90" {
            let (py_p, py_m, px_m, px_p, sx, sy, sz) = read_c90(&["Listwa_Narozna_2", "LISTWA_NAROZNA_2", "KOTWICA_ROG_2", "CORNER_NAILER_2"]);
            let nailer_len_x = (nailer_w - t).max(1.0);
            parts.push(WasmCabinetPart {
                key: "LISTWA_NAROZNA_2".to_string(),
                name: "Listwa_Narozna_2".to_string(),
                role: "CORNER_NAILER".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim {
                    x: nailer_len_x + px_m + px_p,
                    y: t,
                    z: inner_h + py_p + py_m,
                },
                loc: WasmLoc {
                    x: -w / 2.0 + inset_x + nailer_len_x / 2.0 + (px_p - px_m) / 2.0 + sx,
                    y: d / 2.0 - inset_y - nailer_w + t / 2.0 + sy,
                    z: t + inner_h / 2.0 + (py_p - py_m) / 2.0 + sz,
                },
                zone_prefix: String::new(),
                zone_id: String::new(),
                outline2d: None,
                ..Default::default()
            });
        }

        // 7. Wieniec Dolny i Górny L (kontur L_NOTCH)
        let build_l_plate = |is_bottom: bool| -> WasmCabinetPart {
            let names: &[&str] = if is_bottom {
                &["Wieniec_D", "WIENIEC_D", "BOTTOM", "BOTTOM_PANEL"]
            } else {
                &["Wieniec_G", "WIENIEC_G", "TOP", "TOP_PANEL"]
            };
            let (py_p, py_m, px_m, px_p, sx, sy, sz) = read_c90(names);
            let plate_w = (w + py_m + py_p).max(1.0);
            let plate_d = (d + px_m + px_p).max(1.0);
            let loc_x = (py_p - py_m) / 2.0 + sx;
            let loc_y = (px_p - px_m) / 2.0 + sy;
            let base_x0 = -w / 2.0 + sx;
            let base_x1 = w / 2.0 + sx;
            let base_y0 = -d / 2.0 + sy;
            let base_y1 = d / 2.0 + sy;

            let edge_suf = if is_bottom { "-Y" } else { "+Y" };
            let overlap_y = read_back_edge_offset(offsets, "PLECY_Y", edge_suf, groove_default, "");
            let overlap_x = read_back_edge_offset(offsets, "PLECY_X", edge_suf, groove_default, "");
            let mut cut_y = if overlap_y >= t - BACK_OVERLAP_EPS_MM { inset_y } else { 0.0 };
            let mut cut_x = if overlap_x >= t - BACK_OVERLAP_EPS_MM { inset_x } else { 0.0 };
            if cut_y > 0.0 || cut_x > 0.0 {
                cut_y = inset_y;
                cut_x = inset_x;
            }

            let eff_x0 = base_x0 + cut_x - py_m;
            let eff_x1 = base_x1 - t + py_p;
            let eff_y0 = base_y0 + t - px_m;
            let eff_y1 = base_y1 - cut_y + px_p;
            let notch_x = base_x0 + bok_l;
            let notch_y = base_y1 - bok_p;

            let world_l = [
                [eff_x0, eff_y0],
                [notch_x, eff_y0],
                [notch_x, notch_y],
                [eff_x1, notch_y],
                [eff_x1, eff_y1],
                [eff_x0, eff_y1],
            ];

            let flip_u = is_bottom;
            let mut outline_uv: Vec<[f64; 2]> = world_l
                .iter()
                .map(|[wx, wy]| {
                    let u = if flip_u {
                        loc_x + plate_w / 2.0 - wx
                    } else {
                        wx - loc_x + plate_w / 2.0
                    };
                    let v = wy - loc_y + plate_d / 2.0;
                    [u, v]
                })
                .collect();
            if is_bottom {
                outline_uv.reverse();
            }

            let loc_z = if is_bottom { t / 2.0 - sz } else { h - t / 2.0 + sz };
            WasmCabinetPart {
                key: if is_bottom { "WIENIEC_D".to_string() } else { "WIENIEC_G".to_string() },
                name: if is_bottom { "Wieniec_D".to_string() } else { "Wieniec_G".to_string() },
                role: if is_bottom { "BOTTOM_PANEL".to_string() } else { "TOP_PANEL".to_string() },
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim { x: plate_w, y: plate_d, z: t },
                loc: WasmLoc { x: loc_x, y: loc_y, z: loc_z },
                zone_prefix: if is_bottom { "B_".to_string() } else { "T_".to_string() },
                zone_id: if is_bottom { "SEKCJA_B".to_string() } else { "SEKCJA_T".to_string() },
                outline2d: Some(outline_uv),
                ..Default::default()
            }
        };

        parts.push(build_l_plate(true));
        parts.push(build_l_plate(false));

        let output = CabinetPlanWasmOutput { parts, zones };
        return serde_wasm_bindgen::to_value(&output)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)));
    }

    // -------------------------------------------------------------
    // PRZYPADEK 2: KORPUSY SKOŚNE (SKOS PODDASZA: PRZÓD/TYŁ LUB LEWY/PRAWY)
    // -------------------------------------------------------------
    if typ.contains("skosny") {
        let zones = vec![WasmZoneLayout {
            zone_key: "SEKCJA_B".to_string(),
            size: h,
            base_offset: 0.0,
        }];

        let inner_w = w - 2.0 * t;
        let overlap_left = read_back_edge_offset(&offsets, "Plecy", "-X", wpuszczenie_plecow, "B_");
        let overlap_right = read_back_edge_offset(&offsets, "Plecy", "+X", wpuszczenie_plecow, "B_");
        let overlap_bottom = read_back_edge_offset(&offsets, "Plecy", "-Y", wpuszczenie_plecow, "B_");
        let overlap_top = read_back_edge_offset(&offsets, "Plecy", "+Y", wpuszczenie_plecow, "B_");
        let back_shift_y = read_back_shift_y(&offsets, "B_");
        let shortened_d = d - cofniecie_plecow + back_shift_y;
        let shortened_loc_y = (-cofniecie_plecow + back_shift_y) / 2.0;

        let make_band = |active: bool, cut_angle: Option<f64>, cut_anchor: Option<&str>| -> WasmEdgeBandEntry {
            WasmEdgeBandEntry {
                active,
                type_id: if active { "0.008x0.022".to_string() } else { "none".to_string() },
                cut_angle,
                cut_anchor: cut_anchor.map(|s| s.to_string()),
            }
        };

        let is_lr = typ.contains("lr");
        if is_lr {
            let is_uc = typ.contains("uc");
            let h_l = params.wysokosc_lewy_mm.unwrap_or(1000.0).max(1.0);
            let h_p = params.wysokosc_prawy_mm.unwrap_or(h).max(1.0);

            let (bok_l_names, bok_p_names, wd_names, wg_names, back_names) = (
                ["BOK_L", "SIDE_LEFT", "LEFT_SIDE_PANEL", "Bok_L"],
                ["BOK_P", "SIDE_RIGHT", "RIGHT_SIDE_PANEL", "Bok_P"],
                ["WIENIEC_D", "BOTTOM", "BOTTOM_PANEL", "Wieniec_D", "B_WIENIEC_D", "B_Wieniec_D", "Dol_Wieniec_D"],
                ["WIENIEC_G", "TOP", "TOP_PANEL", "Wieniec_G", "T_WIENIEC_G", "T_Wieniec_G", "Gora_Wieniec_G"],
                ["PLECY", "BACK", "BACK_PANEL", "Plecy", "B_PLECY", "B_Plecy", "Dol_Plecy"],
            );

            let (p_y_plus_l, p_y_minus_l, p_x_minus_l, p_x_plus_l, shift_x_l, shift_y_l, shift_z_l) = (
                read_panel_offset(&offsets, &bok_l_names, "+Y").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_l_names, "-Y").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_l_names, "-X").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_l_names, "+X").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_l_names, "shiftX").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_l_names, "shiftY").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_l_names, "shiftZ").unwrap_or(0.0),
            );
            let (p_y_plus_p, p_y_minus_p, p_x_minus_p, p_x_plus_p, shift_x_p, shift_y_p, shift_z_p) = (
                read_panel_offset(&offsets, &bok_p_names, "+Y").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_p_names, "-Y").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_p_names, "-X").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_p_names, "+X").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_p_names, "shiftX").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_p_names, "shiftY").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_p_names, "shiftZ").unwrap_or(0.0),
            );
            let (p_y_plus_d, p_y_minus_d, p_x_minus_d, p_x_plus_d, shift_z_d) = (
                read_panel_offset(&offsets, &wd_names, "+Y").unwrap_or(0.0),
                read_panel_offset(&offsets, &wd_names, "-Y").unwrap_or(0.0),
                read_panel_offset(&offsets, &wd_names, "-X").unwrap_or(0.0),
                read_panel_offset(&offsets, &wd_names, "+X").unwrap_or(0.0),
                read_panel_offset(&offsets, &wd_names, "shiftZ").unwrap_or(0.0),
            );
            let (p_y_plus_back, p_y_minus_back, p_x_minus_back, p_x_plus_back, shift_x_back, shift_y_back, shift_z_back) = (
                read_panel_offset(&offsets, &back_names, "+Y").unwrap_or(overlap_top),
                read_panel_offset(&offsets, &back_names, "-Y").unwrap_or(overlap_bottom),
                read_panel_offset(&offsets, &back_names, "-X").unwrap_or(overlap_left),
                read_panel_offset(&offsets, &back_names, "+X").unwrap_or(overlap_right),
                read_panel_offset(&offsets, &back_names, "shiftX").unwrap_or(0.0),
                read_panel_offset(&offsets, &back_names, "shiftY").unwrap_or(0.0),
                read_panel_offset(&offsets, &back_names, "shiftZ").unwrap_or(0.0),
            );
            let _ = &wg_names;

            let tan_beta = if is_uc {
                if w != 0.0 { (h_p - h_l) / w } else { 0.0 }
            } else {
                (h_p - h_l) / inner_w
            };
            let beta_rad = if is_uc {
                tan_beta.atan()
            } else {
                (h_p - h_l).atan2(inner_w)
            };
            let beta_deg = beta_rad * 180.0 / std::f64::consts::PI;
            let cut_angle_deg = if beta_deg.abs() < 0.05 { 0.0 } else { beta_deg };
            let abs_cut_angle_deg = cut_angle_deg.abs();

            let uskok_lewy = if is_uc { t * tan_beta } else { 0.0 };
            let uskok_prawy = if is_uc { t * tan_beta } else { 0.0 };
            let h_fmt_l = if is_uc { h_l + uskok_lewy.max(0.0) } else { h_l };
            let h_fmt_p = if is_uc { h_p + (-uskok_prawy).max(0.0) } else { h_p };
            let left_anchor = if tan_beta >= 0.0 { "Z_PLUS" } else { "Z_MINUS" };
            let right_anchor = if tan_beta >= 0.0 { "Z_MINUS" } else { "Z_PLUS" };

            // 1. Bok Lewy
            let is_short_l = overlap_left >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d_l = if is_short_l { shortened_d } else { d };
            let target_loc_y_l = if is_short_l { shortened_loc_y } else { 0.0 };
            let eb_l = Some(WasmEdgeBandingMap {
                x_plus: make_band(true, None, None),
                x_minus: make_band(false, None, None),
                y_plus: make_band(true, if abs_cut_angle_deg != 0.0 { Some(abs_cut_angle_deg) } else { None }, if abs_cut_angle_deg != 0.0 { Some(left_anchor) } else { None }),
                y_minus: make_band(true, None, None),
            });
            parts.push(WasmCabinetPart {
                key: "BOK_L".to_string(),
                name: "Bok_L".to_string(),
                role: "LEFT_SIDE_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim { x: h_fmt_l + p_y_plus_l + p_y_minus_l, y: target_d_l + p_x_minus_l + p_x_plus_l, z: t },
                loc: WasmLoc {
                    x: -w / 2.0 + t / 2.0 + shift_x_l,
                    y: (p_x_plus_l - p_x_minus_l) / 2.0 + target_loc_y_l + shift_y_l,
                    z: h_fmt_l / 2.0 + (p_y_plus_l - p_y_minus_l) / 2.0 + shift_z_l,
                },
                zone_prefix: String::new(),
                zone_id: String::new(),
                edge_banding: eb_l,
                ..Default::default()
            });

            // 2. Bok Prawy
            let is_short_p = overlap_right >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d_p = if is_short_p { shortened_d } else { d };
            let target_loc_y_p = if is_short_p { shortened_loc_y } else { 0.0 };
            let eb_p = Some(WasmEdgeBandingMap {
                x_plus: make_band(false, None, None),
                x_minus: make_band(true, None, None),
                y_plus: make_band(true, if abs_cut_angle_deg != 0.0 { Some(abs_cut_angle_deg) } else { None }, if abs_cut_angle_deg != 0.0 { Some(right_anchor) } else { None }),
                y_minus: make_band(true, None, None),
            });
            parts.push(WasmCabinetPart {
                key: "BOK_P".to_string(),
                name: "Bok_P".to_string(),
                role: "RIGHT_SIDE_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim { x: h_fmt_p + p_y_plus_p + p_y_minus_p, y: target_d_p + p_x_minus_p + p_x_plus_p, z: t },
                loc: WasmLoc {
                    x: w / 2.0 - t / 2.0 + shift_x_p,
                    y: (p_x_plus_p - p_x_minus_p) / 2.0 + target_loc_y_p + shift_y_p,
                    z: h_fmt_p / 2.0 + (p_y_plus_p - p_y_minus_p) / 2.0 + shift_z_p,
                },
                zone_prefix: String::new(),
                zone_id: String::new(),
                edge_banding: eb_p,
                ..Default::default()
            });

            // 3. Wieniec Dolny
            let is_short_d = overlap_bottom >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d_d = if is_short_d { shortened_d } else { d };
            let target_loc_y_d = if is_short_d { shortened_loc_y } else { 0.0 };
            parts.push(WasmCabinetPart {
                key: "WIENIEC_D".to_string(),
                name: "Wieniec_D".to_string(),
                role: "BOTTOM_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim { x: inner_w + p_y_minus_d + p_y_plus_d, y: target_d_d + p_x_minus_d + p_x_plus_d, z: t },
                loc: WasmLoc {
                    x: (p_y_plus_d - p_y_minus_d) / 2.0,
                    y: (p_x_plus_d - p_x_minus_d) / 2.0 + target_loc_y_d,
                    z: t / 2.0 - shift_z_d,
                },
                zone_prefix: "B_".to_string(),
                zone_id: "SEKCJA_B".to_string(),
                ..Default::default()
            });

            // 4. Wieniec Górny skośny
            let is_short_g = overlap_top >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d_g = if is_short_g { shortened_d } else { d };
            let target_loc_y_g = if is_short_g { shortened_loc_y } else { 0.0 };
            let slope_len = if is_uc {
                inner_w.hypot(inner_w * tan_beta)
            } else {
                inner_w.hypot(h_p - h_l)
            };
            let z_top_center = (h_l + h_p) / 2.0;
            let eb_g = Some(WasmEdgeBandingMap {
                x_plus: make_band(false, if cut_angle_deg != 0.0 { Some(cut_angle_deg) } else { None }, if cut_angle_deg != 0.0 { Some("Z_MINUS") } else { None }),
                x_minus: make_band(false, if cut_angle_deg != 0.0 { Some(-cut_angle_deg) } else { None }, if cut_angle_deg != 0.0 { Some("Z_MINUS") } else { None }),
                y_plus: make_band(false, None, None),
                y_minus: make_band(true, None, None),
            });
            parts.push(WasmCabinetPart {
                key: "WIENIEC_G".to_string(),
                name: "Wieniec_G".to_string(),
                role: "TOP_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim { x: slope_len, y: target_d_g, z: t },
                loc: WasmLoc {
                    x: (t / 2.0) * beta_rad.sin(),
                    y: target_loc_y_g,
                    z: z_top_center - (t / 2.0) * beta_rad.cos(),
                },
                zone_prefix: "T_".to_string(),
                zone_id: "SEKCJA_T".to_string(),
                lcs_rotation: Some([-90.0, 0.0, -beta_deg]),
                edge_banding: eb_g,
                ..Default::default()
            });

            // 5. Plecy (trapez w płaszczyźnie XZ)
            let back_w = inner_w + p_x_minus_back + p_x_plus_back;
            let z_bottom = t - p_y_minus_back;
            let cos_beta = beta_rad.cos();
            let roof_thick_vert = if cos_beta.abs() > 1e-6 { t / cos_beta } else { t };
            let (right_roof_abs_ext, left_roof_abs_ext, margin_top_vert) = if is_uc {
                (
                    h_p - uskok_prawy + p_x_plus_back * tan_beta,
                    h_l + uskok_lewy - p_x_minus_back * tan_beta,
                    if cos_beta.abs() > 1e-6 { p_y_plus_back / cos_beta } else { p_y_plus_back },
                )
            } else {
                (
                    h_p + p_x_plus_back * tan_beta,
                    h_l - p_x_minus_back * tan_beta,
                    p_y_plus_back,
                )
            };
            let right_roof_rel = (right_roof_abs_ext - roof_thick_vert) - z_bottom;
            let left_roof_rel = (left_roof_abs_ext - roof_thick_vert) - z_bottom;
            let max_roof_rel = right_roof_rel.max(left_roof_rel);
            let back_h = max_roof_rel + margin_top_vert;
            let v_right_roof = max_roof_rel - right_roof_rel;
            let v_left_roof = max_roof_rel - left_roof_rel;
            let trap_back = vec![
                [0.0, back_h],
                [back_w, back_h],
                [back_w, v_right_roof],
                [0.0, v_left_roof],
            ];
            let back_y = d / 2.0 + t_back / 2.0 - cofniecie_plecow + shift_y_back;

            parts.push(WasmCabinetPart {
                key: "PLECY".to_string(),
                name: "Plecy".to_string(),
                role: "BACK_PANEL".to_string(),
                material: def_back_mat.clone(),
                material_name: def_back_name.clone(),
                material_code: def_back_code.clone(),
                thickness: t_back,
                dim: WasmDim { x: back_w, y: t_back, z: back_h },
                loc: WasmLoc {
                    x: (p_x_plus_back - p_x_minus_back) / 2.0 + shift_x_back,
                    y: back_y,
                    z: z_bottom + back_h / 2.0 + shift_z_back,
                },
                zone_prefix: "B_".to_string(),
                zone_id: "SEKCJA_B".to_string(),
                outline2d: Some(trap_back),
                shape: Some("skos_back".to_string()),
                ..Default::default()
            });
        } else {
            // Skos Przód / Tył: korpus_skosny i korpus_skosny_dach
            let h_f = params.wysokosc_przod_mm.unwrap_or(1000.0).max(100.0);
            let h_b = params.wysokosc_tyl_mm.unwrap_or(2200.0).max(100.0);
            let max_h = h_f.max(h_b);
            let side_shape = if typ == "korpus_skosny_dach" { "skos_dach_side" } else { "skos_side" };

            let (bok_l_names, bok_p_names, wg_names, back_names) = (
                ["BOK_L", "SIDE_LEFT", "LEFT_SIDE_PANEL", "Bok_L"],
                ["BOK_P", "SIDE_RIGHT", "RIGHT_SIDE_PANEL", "Bok_P"],
                ["WIENIEC_G", "TOP", "TOP_PANEL", "Wieniec_G", "T_WIENIEC_G", "T_Wieniec_G", "Gora_Wieniec_G"],
                ["PLECY", "BACK", "BACK_PANEL", "Plecy", "B_PLECY", "B_Plecy", "Dol_Plecy"],
            );

            let (shift_x_l, shift_y_l, shift_z_l) = (
                read_panel_offset(&offsets, &bok_l_names, "shiftX").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_l_names, "shiftY").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_l_names, "shiftZ").unwrap_or(0.0),
            );
            let (shift_x_p, shift_y_p, shift_z_p) = (
                read_panel_offset(&offsets, &bok_p_names, "shiftX").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_p_names, "shiftY").unwrap_or(0.0),
                read_panel_offset(&offsets, &bok_p_names, "shiftZ").unwrap_or(0.0),
            );
            let (shift_y_g, shift_z_g) = (
                read_panel_offset(&offsets, &wg_names, "shiftY").unwrap_or(0.0),
                read_panel_offset(&offsets, &wg_names, "shiftZ").unwrap_or(0.0),
            );
            let (p_y_plus_back, p_y_minus_back, p_x_minus_back, p_x_plus_back, shift_x_back, shift_y_back, shift_z_back) = (
                read_panel_offset(&offsets, &back_names, "+Y").unwrap_or(overlap_top),
                read_panel_offset(&offsets, &back_names, "-Y").unwrap_or(overlap_bottom),
                read_panel_offset(&offsets, &back_names, "-X").unwrap_or(overlap_left),
                read_panel_offset(&offsets, &back_names, "+X").unwrap_or(overlap_right),
                read_panel_offset(&offsets, &back_names, "shiftX").unwrap_or(0.0),
                read_panel_offset(&offsets, &back_names, "shiftY").unwrap_or(0.0),
                read_panel_offset(&offsets, &back_names, "shiftZ").unwrap_or(0.0),
            );

            // 1. Bok Lewy
            let is_short_l = overlap_left >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d_l = if is_short_l { shortened_d } else { d };
            let target_loc_y_l = if is_short_l { shortened_loc_y } else { 0.0 };
            let h_cut_l = h_b + target_d_l * (h_f - h_b) / d;
            let outline_l = vec![
                [0.0, 0.0],
                [target_d_l, 0.0],
                [target_d_l, h_cut_l],
                [0.0, h_b],
            ];
            parts.push(WasmCabinetPart {
                key: "BOK_L".to_string(),
                name: "Bok_L".to_string(),
                role: "LEFT_SIDE_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim { x: max_h, y: target_d_l, z: t },
                loc: WasmLoc {
                    x: -w / 2.0 + t / 2.0 + shift_x_l,
                    y: target_loc_y_l + shift_y_l,
                    z: max_h / 2.0 + shift_z_l,
                },
                zone_prefix: String::new(),
                zone_id: String::new(),
                outline2d: Some(outline_l),
                shape: Some(side_shape.to_string()),
                ..Default::default()
            });

            // 2. Bok Prawy
            let is_short_p = overlap_right >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d_p = if is_short_p { shortened_d } else { d };
            let target_loc_y_p = if is_short_p { shortened_loc_y } else { 0.0 };
            let h_cut_p = h_f + target_d_p * (h_b - h_f) / d;
            let outline_r = vec![
                [0.0, 0.0],
                [target_d_p, 0.0],
                [target_d_p, h_cut_p],
                [0.0, h_f],
            ];
            parts.push(WasmCabinetPart {
                key: "BOK_P".to_string(),
                name: "Bok_P".to_string(),
                role: "RIGHT_SIDE_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim { x: max_h, y: target_d_p, z: t },
                loc: WasmLoc {
                    x: w / 2.0 - t / 2.0 + shift_x_p,
                    y: target_loc_y_p + shift_y_p,
                    z: max_h / 2.0 + shift_z_p,
                },
                zone_prefix: String::new(),
                zone_id: String::new(),
                outline2d: Some(outline_r),
                shape: Some(side_shape.to_string()),
                ..Default::default()
            });

            // 3. Wieniec Dolny
            let is_short_d = overlap_bottom >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d_d = if is_short_d { shortened_d } else { d };
            let target_loc_y_d = if is_short_d { shortened_loc_y } else { 0.0 };
            parts.push(WasmCabinetPart {
                key: "WIENIEC_D".to_string(),
                name: "Wieniec_D".to_string(),
                role: "BOTTOM_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim { x: inner_w, y: target_d_d, z: t },
                loc: WasmLoc { x: 0.0, y: target_loc_y_d, z: t / 2.0 },
                zone_prefix: "B_".to_string(),
                zone_id: "SEKCJA_B".to_string(),
                ..Default::default()
            });

            // 4. Wieniec Górny skośny
            let is_short_g = overlap_top >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d_g = if is_short_g { shortened_d } else { d };
            let target_loc_y_g = if is_short_g { shortened_loc_y } else { 0.0 };
            let beta_deg = (h_b - h_f).atan2(d) * 180.0 / std::f64::consts::PI;
            let beta = beta_deg * std::f64::consts::PI / 180.0;
            let h_cut_g = h_f + target_d_g * (h_b - h_f) / d;
            let slope_len = target_d_g.hypot(h_cut_g - h_f);
            let cut_angle_deg = ((h_f - h_b).atan2(d) * 180.0 / std::f64::consts::PI).abs();
            let top_end_cut = if cut_angle_deg.abs() < 0.05 { 0.0 } else { cut_angle_deg };

            let eb_g = WasmEdgeBandingMap {
                x_plus: make_band(false, None, None),
                x_minus: make_band(false, None, None),
                y_minus: make_band(true, if top_end_cut != 0.0 { Some(top_end_cut) } else { None }, if top_end_cut != 0.0 { Some("Z_MINUS") } else { None }),
                y_plus: make_band(false, if top_end_cut != 0.0 { Some(-top_end_cut) } else { None }, if top_end_cut != 0.0 { Some("Z_MINUS") } else { None }),
            };

            let back_groove_trap = if !is_short_g {
                let eff_overlap = overlap_top + shift_z_g;
                if eff_overlap > BACK_OVERLAP_EPS_MM {
                    Some(WasmBackGrooveTrapezoid {
                        h_f,
                        h_b,
                        d,
                        thickness: t,
                        back_offset: cofniecie_plecow,
                        shift_y: shift_y_g,
                        grubosc_plecow_mm: t_back,
                        margines_gorny_plecow_mm: eff_overlap,
                    })
                } else {
                    None
                }
            } else {
                None
            };

            parts.push(WasmCabinetPart {
                key: "WIENIEC_G".to_string(),
                name: "Wieniec_G".to_string(),
                role: "TOP_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim { x: inner_w, y: slope_len, z: t },
                loc: WasmLoc {
                    x: 0.0,
                    y: target_loc_y_g + beta.sin() * t / 2.0,
                    z: (h_f + h_cut_g) / 2.0 - beta.cos() * t / 2.0,
                },
                zone_prefix: "T_".to_string(),
                zone_id: "SEKCJA_T".to_string(),
                lcs_rotation: Some([beta_deg - 90.0, 0.0, 0.0]),
                edge_banding: Some(eb_g),
                back_groove_trapezoid: back_groove_trap,
                ..Default::default()
            });

            // 5. Plecy proste
            let roof_angle = (h_b - h_f).atan2(d);
            let cos_roof = if roof_angle.cos().abs() > 1e-6 { roof_angle.cos() } else { 1.0 };
            let tan_roof = roof_angle.tan();
            let y_plecy_front = d - cofniecie_plecow + shift_y_back;
            let z_ceil_at_plecy = h_f - t / cos_roof + y_plecy_front * tan_roof;
            let z_top = z_ceil_at_plecy + p_y_plus_back;
            let z_bottom = t - p_y_minus_back;
            let back_h = (z_top - z_bottom).max(10.0);
            let back_w = inner_w + p_x_minus_back + p_x_plus_back;
            let back_y = d / 2.0 + t_back / 2.0 - cofniecie_plecow + shift_y_back;

            parts.push(WasmCabinetPart {
                key: "PLECY".to_string(),
                name: "Plecy".to_string(),
                role: "BACK_PANEL".to_string(),
                material: def_back_mat.clone(),
                material_name: def_back_name.clone(),
                material_code: def_back_code.clone(),
                thickness: t_back,
                dim: WasmDim { x: back_w, y: t_back, z: back_h },
                loc: WasmLoc {
                    x: (p_x_plus_back - p_x_minus_back) / 2.0 + shift_x_back,
                    y: back_y,
                    z: (z_bottom + z_top) / 2.0 + shift_z_back,
                },
                zone_prefix: "B_".to_string(),
                zone_id: "SEKCJA_B".to_string(),
                ..Default::default()
            });
        }

        let output = CabinetPlanWasmOutput { parts, zones };
        return serde_wasm_bindgen::to_value(&output)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)));
    }

            // -------------------------------------------------------------
    // PRZYPADEK 3: KORPUS STANDARDOWY (KORPUS3) ORAZ ROGOWY 1 (PROSTY Z BLENDĄ)
    // -------------------------------------------------------------
    let h_bottom = params.wysokosc_strefy_dolnej_mm.unwrap_or(300.0);
    let h_middle = params.wysokosc_strefy_srodkowej_mm.unwrap_or(300.0);
    let zones = compute_zones(liczba_stref, h, h_bottom, h_middle);

    let inner_w = (w - 2.0 * t).max(10.0);

    for z in &zones {
        // Klucze w TS: dla 1 strefy brak prefiksu (""), dla wielu stref: "B_", "M_", "T_"
        let (pfx, is_top_zone) = if zones.len() == 1 {
            ("", true)
        } else {
            match z.zone_key.as_str() {
                "SEKCJA_B" => ("B_", false),
                "SEKCJA_M" => ("M_", false),
                "SEKCJA_T" => ("T_", true),
                _ => ("", true),
            }
        };

        let zh = z.size;
        let z_offset = z.base_offset;

        let back_shift_y = read_back_shift_y(offsets, pfx);
        let shortened_d = d - cofniecie_plecow + back_shift_y;
        let shortened_loc_y = (-cofniecie_plecow + back_shift_y) / 2.0;

        let overlap_left = read_back_edge_offset(offsets, "Plecy", "-X", groove_default, pfx);
        let overlap_right = read_back_edge_offset(offsets, "Plecy", "+X", groove_default, pfx);
        let overlap_bottom = read_back_edge_offset(offsets, "Plecy", "-Y", groove_default, pfx);
        let overlap_top = read_back_edge_offset(offsets, "Plecy", "+Y", groove_default, pfx);

        let read_std = |names: &[&str]| -> (f64, f64, f64, f64, f64, f64, f64) {
            let py_plus = read_panel_offset(offsets, names, "+Y").unwrap_or(0.0);
            let py_minus = read_panel_offset(offsets, names, "-Y").unwrap_or(0.0);
            let px_minus = read_panel_offset(offsets, names, "-X").unwrap_or(0.0);
            let px_plus = read_panel_offset(offsets, names, "+X").unwrap_or(0.0);
            let sx = read_panel_offset(offsets, names, "shiftX").unwrap_or(0.0);
            let sy = read_panel_offset(offsets, names, "shiftY").unwrap_or(0.0);
            let sz = read_panel_offset(offsets, names, "shiftZ").unwrap_or(0.0);
            (py_plus, py_minus, px_minus, px_plus, sx, sy, sz)
        };

        // 1. Bok Lewy danej strefy: dim { x: zh, y: d, z: t }
        {
            let pfx_key = format!("{}BOK_L", pfx);
            let (py_p, py_m, px_m, px_p, sx, sy, sz) = read_std(&["Bok_L", "BOK_L", &pfx_key, "LEFT_SIDE_PANEL"]);
            let is_short = overlap_left >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d = if is_short { shortened_d } else { d };
            let target_loc_y = if is_short { shortened_loc_y } else { 0.0 };
            parts.push(WasmCabinetPart {
                key: pfx_key,
                name: "Bok_L".to_string(),
                role: "LEFT_SIDE_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim {
                    x: (zh + py_p + py_m).max(1.0),
                    y: (target_d + px_m + px_p).max(1.0),
                    z: t,
                },
                loc: WasmLoc {
                    x: -w / 2.0 + t / 2.0 - sx,
                    y: target_loc_y + (px_p - px_m) / 2.0 + sy,
                    z: z_offset + zh / 2.0 + (py_p - py_m) / 2.0 + sz,
                },
                zone_prefix: pfx.to_string(),
                zone_id: z.zone_key.clone(),
                outline2d: None,
                ..Default::default()
            });
        }

        // 2. Bok Prawy danej strefy: dim { x: zh, y: d, z: t }
        {
            let pfx_key = format!("{}BOK_P", pfx);
            let (py_p, py_m, px_m, px_p, sx, sy, sz) = read_std(&["Bok_P", "BOK_P", &pfx_key, "RIGHT_SIDE_PANEL"]);
            let is_short = overlap_right >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d = if is_short { shortened_d } else { d };
            let target_loc_y = if is_short { shortened_loc_y } else { 0.0 };
            parts.push(WasmCabinetPart {
                key: pfx_key,
                name: "Bok_P".to_string(),
                role: "RIGHT_SIDE_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim {
                    x: (zh + py_p + py_m).max(1.0),
                    y: (target_d + px_m + px_p).max(1.0),
                    z: t,
                },
                loc: WasmLoc {
                    x: w / 2.0 - t / 2.0 + sx,
                    y: target_loc_y + (px_p - px_m) / 2.0 + sy,
                    z: z_offset + zh / 2.0 + (py_p - py_m) / 2.0 + sz,
                },
                zone_prefix: pfx.to_string(),
                zone_id: z.zone_key.clone(),
                outline2d: None,
                ..Default::default()
            });
        }

        // 3. Wieniec Dolny danej strefy: dim { x: inner_w, y: d, z: t }
        {
            let pfx_key = format!("{}WIENIEC_D", pfx);
            let (py_p, py_m, px_m, px_p, _sx, _sy, sz) = read_std(&["Wieniec_D", "WIENIEC_D", &pfx_key, "BOTTOM_PANEL"]);
            let is_short = overlap_bottom >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
            let target_d = if is_short { shortened_d } else { d };
            let target_loc_y = if is_short { shortened_loc_y } else { 0.0 };
            parts.push(WasmCabinetPart {
                key: pfx_key,
                name: "Wieniec_D".to_string(),
                role: "BOTTOM_PANEL".to_string(),
                material: def_mat.clone(),
                material_name: def_mat_name.clone(),
                material_code: def_mat_code.clone(),
                thickness: t,
                dim: WasmDim {
                    x: (inner_w + py_m + py_p).max(1.0),
                    y: (target_d + px_m + px_p).max(1.0),
                    z: t,
                },
                loc: WasmLoc {
                    x: (py_p - py_m) / 2.0,
                    y: target_loc_y + (px_p - px_m) / 2.0,
                    z: z_offset + t / 2.0 - sz,
                },
                zone_prefix: pfx.to_string(),
                zone_id: z.zone_key.clone(),
                outline2d: None,
                ..Default::default()
            });
        }

        // 4. Wieniec Górny strefy (dla stref pośrednich zawsze pełny; dla najwyższej wg trybu)
        let z_top_mode = if is_top_zone { tryb_wienca } else { "FULL" };
        let top_occupy = match z_top_mode {
            "TRAVERSE_V" => szerokosc_trawersu,
            _ => t,
        };

        match z_top_mode {
            "TRAVERSE_H" => {
                let tr_w = szerokosc_trawersu;
                {
                    let pfx_key = format!("{}WIENIEC_G_FRONT", pfx);
                    let (py_p, py_m, px_m, px_p, _sx, _sy, sz) = read_std(&["Trawers_G_Przod", "Wieniec_G", &pfx_key, "TOP_TRAVERSE_FRONT", "TOP_PANEL"]);
                    parts.push(WasmCabinetPart {
                        key: pfx_key,
                        name: "Trawers_G_Przod".to_string(),
                        role: "TOP_TRAVERSE_FRONT".to_string(),
                        material: def_mat.clone(),
                        material_name: def_mat_name.clone(),
                        material_code: def_mat_code.clone(),
                        thickness: t,
                        dim: WasmDim {
                            x: (inner_w + py_m + py_p).max(1.0),
                            y: (tr_w + px_m + px_p).max(1.0),
                            z: t,
                        },
                        loc: WasmLoc {
                            x: (py_p - py_m) / 2.0,
                            y: -d / 2.0 + tr_w / 2.0 + (px_p - px_m) / 2.0,
                            z: z_offset + zh - t / 2.0 + sz,
                        },
                        zone_prefix: pfx.to_string(),
                        zone_id: z.zone_key.clone(),
                        outline2d: None,
                        ..Default::default()
                    });
                }
                {
                    let pfx_key = format!("{}WIENIEC_G_BACK", pfx);
                    let (py_p, py_m, px_m, px_p, _sx, _sy, sz) = read_std(&["Trawers_G_Tyl", "Wieniec_G_T2", &pfx_key, "TOP_TRAVERSE_BACK", "TOP_PANEL"]);
                    let is_rear_short = overlap_top >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
                    let rear_back_y = if is_rear_short { -d / 2.0 + shortened_d } else { d / 2.0 };
                    parts.push(WasmCabinetPart {
                        key: pfx_key,
                        name: "Trawers_G_Tyl".to_string(),
                        role: "TOP_TRAVERSE_BACK".to_string(),
                        material: def_mat.clone(),
                        material_name: def_mat_name.clone(),
                        material_code: def_mat_code.clone(),
                        thickness: t,
                        dim: WasmDim {
                            x: (inner_w + py_m + py_p).max(1.0),
                            y: (tr_w + px_m + px_p).max(1.0),
                            z: t,
                        },
                        loc: WasmLoc {
                            x: (py_p - py_m) / 2.0,
                            y: rear_back_y - tr_w / 2.0 + (px_p - px_m) / 2.0,
                            z: z_offset + zh - t / 2.0 + sz,
                        },
                        zone_prefix: pfx.to_string(),
                        zone_id: z.zone_key.clone(),
                        outline2d: None,
                        ..Default::default()
                    });
                }
            }
            "TRAVERSE_V" => {
                let tr_w = szerokosc_trawersu;
                {
                    let pfx_key = format!("{}WIENIEC_G_FRONT", pfx);
                    let (py_p, py_m, px_m, px_p, _sx, sy, sz) = read_std(&["Trawers_G_Przod_V", "Wieniec_G", &pfx_key, "TOP_TRAVERSE_FRONT", "TOP_PANEL"]);
                    parts.push(WasmCabinetPart {
                        key: pfx_key,
                        name: "Trawers_G_Przod_V".to_string(),
                        role: "TOP_TRAVERSE_FRONT".to_string(),
                        material: def_mat.clone(),
                        material_name: def_mat_name.clone(),
                        material_code: def_mat_code.clone(),
                        thickness: t,
                        dim: WasmDim {
                            x: (inner_w + py_m + py_p).max(1.0),
                            y: t,
                            z: (tr_w + px_m + px_p).max(1.0),
                        },
                        loc: WasmLoc {
                            x: (py_p - py_m) / 2.0,
                            y: -d / 2.0 + t / 2.0 + sy,
                            z: z_offset + zh - tr_w / 2.0 + sz + (px_p - px_m) / 2.0,
                        },
                        zone_prefix: pfx.to_string(),
                        zone_id: z.zone_key.clone(),
                        outline2d: None,
                        ..Default::default()
                    });
                }
                {
                    let pfx_key = format!("{}WIENIEC_G_BACK", pfx);
                    let (py_p, py_m, px_m, px_p, _sx, sy, sz) = read_std(&["Trawers_G_Tyl_V", "Wieniec_G_T2", &pfx_key, "TOP_TRAVERSE_BACK", "TOP_PANEL"]);
                    let is_rear_short = overlap_top >= tr_w - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
                    let rear_back_y = if is_rear_short { -d / 2.0 + shortened_d } else { d / 2.0 };
                    parts.push(WasmCabinetPart {
                        key: pfx_key,
                        name: "Trawers_G_Tyl_V".to_string(),
                        role: "TOP_TRAVERSE_BACK".to_string(),
                        material: def_mat.clone(),
                        material_name: def_mat_name.clone(),
                        material_code: def_mat_code.clone(),
                        thickness: t,
                        dim: WasmDim {
                            x: (inner_w + py_m + py_p).max(1.0),
                            y: t,
                            z: (tr_w + px_m + px_p).max(1.0),
                        },
                        loc: WasmLoc {
                            x: (py_p - py_m) / 2.0,
                            y: rear_back_y - t / 2.0 + sy,
                            z: z_offset + zh - tr_w / 2.0 + sz + (px_p - px_m) / 2.0,
                        },
                        zone_prefix: pfx.to_string(),
                        zone_id: z.zone_key.clone(),
                        outline2d: None,
                        ..Default::default()
                    });
                }
            }
            _ => {
                // FULL: dim { x: inner_w, y: d, z: t }
                let pfx_key = format!("{}WIENIEC_G", pfx);
                let (py_p, py_m, px_m, px_p, _sx, _sy, sz) = read_std(&["Wieniec_G", "WIENIEC_G", &pfx_key, "TOP_PANEL"]);
                let is_short = overlap_top >= t - BACK_OVERLAP_EPS_MM && shortened_d > 0.0;
                let target_d = if is_short { shortened_d } else { d };
                let target_loc_y = if is_short { shortened_loc_y } else { 0.0 };
                parts.push(WasmCabinetPart {
                    key: pfx_key,
                    name: "Wieniec_G".to_string(),
                    role: "TOP_PANEL".to_string(),
                    material: def_mat.clone(),
                    material_name: def_mat_name.clone(),
                    material_code: def_mat_code.clone(),
                    thickness: t,
                    dim: WasmDim {
                        x: (inner_w + py_m + py_p).max(1.0),
                        y: (target_d + px_m + px_p).max(1.0),
                        z: t,
                    },
                    loc: WasmLoc {
                        x: (py_p - py_m) / 2.0,
                        y: target_loc_y + (px_p - px_m) / 2.0,
                        z: z_offset + zh - t / 2.0 + sz,
                    },
                    zone_prefix: pfx.to_string(),
                    zone_id: z.zone_key.clone(),
                    outline2d: None,
                    ..Default::default()
                });
            }
        }

        // 5. Plecy danej strefy: dim { x: back_w, y: t_back, z: back_h }
        let back_pfx_key = format!("{}PLECY", pfx);
        let back_shift = read_panel_offset(offsets, &["Plecy", "PLECY", &back_pfx_key, "BACK_PANEL"], "shiftY").unwrap_or(0.0);
        let inward_left = read_surrounding_panel_inward_shift(offsets, "-X", pfx, "Plecy");
        let inward_right = read_surrounding_panel_inward_shift(offsets, "+X", pfx, "Plecy");
        let inward_bottom = read_surrounding_panel_inward_shift(offsets, "-Y", pfx, "Plecy");
        let inward_top = read_surrounding_panel_inward_shift(offsets, "+Y", pfx, "Plecy");

        let effective_inner_w = inner_w - inward_left - inward_right;
        let effective_mid_x = (inward_left - inward_right) / 2.0;
        let effective_inner_h = (zh - t - top_occupy) - inward_bottom - inward_top;
        let z_bottom_inner = z_offset + t + inward_bottom;

        let back_w = (effective_inner_w + overlap_left + overlap_right).max(1.0);
        let back_h = (effective_inner_h + overlap_bottom + overlap_top).max(1.0);
        let back_y = d / 2.0 + t_back / 2.0 - cofniecie_plecow + back_shift;
        let back_z = z_bottom_inner - overlap_bottom + back_h / 2.0;

        parts.push(WasmCabinetPart {
            key: back_pfx_key,
            name: "Plecy".to_string(),
            role: "BACK_PANEL".to_string(),
            material: def_back_mat.clone(),
            material_name: def_back_name.clone(),
            material_code: def_back_code.clone(),
            thickness: t_back,
            dim: WasmDim { x: back_w, y: t_back, z: back_h },
            loc: WasmLoc {
                x: effective_mid_x + (overlap_right - overlap_left) / 2.0,
                y: back_y,
                z: back_z,
            },
            zone_prefix: pfx.to_string(),
            zone_id: z.zone_key.clone(),
            outline2d: None,
            ..Default::default()
        });
    }

    // 6. Blenda (jeśli korpus narożny z blendą)
    if typ.contains("rogowy") && !typ.contains("rogowy90") && !typ.contains("rogowy_90") {
        let top_occupy = match tryb_wienca {
            "TRAVERSE_V" => szerokosc_trawersu,
            _ => t,
        };
        let inner_h = (h - t - top_occupy).max(1.0);
        let min_blind = 50.0;
        let max_blind = (inner_w - 1.0).max(min_blind);
        let blind_w = params.szerokosc_blendy_mm.unwrap_or(400.0).clamp(min_blind, max_blind);

        let blenda_names = ["Blenda", "BLENDA", "PANEL_ZASLEPIAJACY", "BLIND", "BLIND_PANEL"];
        let py_p = read_panel_offset(offsets, &blenda_names, "+Y").unwrap_or(0.0);
        let py_m = read_panel_offset(offsets, &blenda_names, "-Y").unwrap_or(0.0);
        let px_m = read_panel_offset(offsets, &blenda_names, "-X").unwrap_or(0.0);
        let px_p = read_panel_offset(offsets, &blenda_names, "+X").unwrap_or(0.0);
        let sx = read_panel_offset(offsets, &blenda_names, "shiftX").unwrap_or(0.0);
        let sy = read_panel_offset(offsets, &blenda_names, "shiftY").unwrap_or(0.0);
        let sz = read_panel_offset(offsets, &blenda_names, "shiftZ").unwrap_or(0.0);

        let blenda_x = if strona_blendy == "RIGHT" {
            w / 2.0 - t - blind_w / 2.0 + sx
        } else {
            -w / 2.0 + t + blind_w / 2.0 + sx
        };
        let blenda_y = -d / 2.0 + t / 2.0 + sy;
        let blenda_z = t + inner_h / 2.0 + sz;

        parts.push(WasmCabinetPart {
            key: "BLENDA".to_string(),
            name: "Blenda".to_string(),
            role: "BLIND_PANEL".to_string(),
            material: def_mat.clone(),
            material_name: def_mat_name.clone(),
            material_code: def_mat_code.clone(),
            thickness: t,
            dim: WasmDim {
                x: (blind_w + px_m + px_p).max(1.0),
                y: t,
                z: (inner_h + py_m + py_p).max(1.0),
            },
            loc: WasmLoc {
                x: blenda_x + (px_p - px_m) / 2.0,
                y: blenda_y,
                z: blenda_z + (py_p - py_m) / 2.0,
            },
            zone_prefix: String::new(),
            zone_id: String::new(),
            outline2d: None,
            ..Default::default()
        });
    }

    let output = CabinetPlanWasmOutput { parts, zones };
    serde_wasm_bindgen::to_value(&output)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
