use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct PanelsDimsInput {
    pub width_mm: f64,
    pub height_mm: f64,
    pub depth_mm: f64,
}

#[derive(Deserialize)]
pub struct PanelsParamsInput {
    pub grubosc_blendy_mm: f64,
    pub tryb_paneli_bocznych: String,
    pub wlacz_lewy: bool,
    pub wlacz_prawy: bool,
    pub wlacz_gorny: bool,
    pub wlacz_dolny: bool,
    pub auto_glebokosc_lewy: bool,
    pub auto_glebokosc_prawy: bool,
    pub auto_glebokosc_gorny: bool,
    pub glebokosc_blendy_lewa_mm: f64,
    pub glebokosc_blendy_prawa_mm: f64,
    pub glebokosc_blendy_gora_mm: f64,
    pub wysokosc_cokolu_mm: f64,
    pub szczelina_cokolu_mm: f64,
    pub cofniecie_cokolu_mm: f64,
    pub luz_lewy_mm: f64,
    pub luz_prawy_mm: f64,
    pub luz_gorny_mm: f64,
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
pub struct WasmPanelPart {
    pub name: String,
    pub key: String,
    pub role: String,
    pub node_type: String,
    pub dim: WasmDim,
    pub loc: WasmLoc,
}

#[derive(Serialize)]
pub struct PanelsPlanWasmOutput {
    pub parts: Vec<WasmPanelPart>,
}

fn calc_side_span(
    mode: &str,
    height_mm: f64,
    plinth_h_mm: f64,
    plinth_gap_mm: f64,
    top_thick_mm: f64,
) -> (f64, f64) {
    let mut z_bottom = 0.0;
    let mut z_top = height_mm;

    match mode {
        "FULL" => {
            z_bottom = -plinth_gap_mm - plinth_h_mm;
            z_top = height_mm + top_thick_mm;
        }
        "KORPUS_BLENDA_G" => {
            z_bottom = 0.0;
            z_top = height_mm + top_thick_mm;
        }
        "COKOL_KORPUS" => {
            z_bottom = -plinth_h_mm - plinth_gap_mm;
            z_top = height_mm;
        }
        _ => {
            // KORPUS lub domyślny
            z_bottom = 0.0;
            z_top = height_mm;
        }
    }

    let side_h = z_top - z_bottom;
    let z_center = (z_bottom + z_top) / 2.0;
    (side_h, z_center)
}

#[wasm_bindgen]
pub fn calculate_panels_plan_wasm(
    dims_val: JsValue,
    params_val: JsValue,
) -> Result<JsValue, JsValue> {
    let dims: PanelsDimsInput = serde_wasm_bindgen::from_value(dims_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid dims: {}", e)))?;
    let params: PanelsParamsInput = serde_wasm_bindgen::from_value(params_val)
        .map_err(|e| JsValue::from_str(&format!("Invalid params: {}", e)))?;

    let width_mm = dims.width_mm;
    let height_mm = dims.height_mm;
    let depth_mm = dims.depth_mm;
    let grubosc_blendy_mm = params.grubosc_blendy_mm;

    let depth_left_mm = if params.auto_glebokosc_lewy {
        depth_mm
    } else {
        params.glebokosc_blendy_lewa_mm
    }.max(10.0);

    let depth_right_mm = if params.auto_glebokosc_prawy {
        depth_mm
    } else {
        params.glebokosc_blendy_prawa_mm
    }.max(10.0);

    let depth_top_mm = if params.auto_glebokosc_gorny {
        depth_mm
    } else {
        params.glebokosc_blendy_gora_mm
    }.max(10.0);

    let (side_h, z_center) = calc_side_span(
        &params.tryb_paneli_bocznych,
        height_mm,
        params.wysokosc_cokolu_mm,
        params.szczelina_cokolu_mm,
        grubosc_blendy_mm,
    );

    let mut parts = Vec::new();

    // 1. Blenda lewa
    if params.wlacz_lewy {
        let pos_y = if params.auto_glebokosc_lewy {
            0.0
        } else {
            -(depth_mm / 2.0) + depth_left_mm / 2.0
        };
        parts.push(WasmPanelPart {
            name: "Blenda_lewa".to_string(),
            key: "PANEL_LEFT".to_string(),
            role: "LEFT_SIDE_PANEL".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: side_h,
                y: depth_left_mm,
                z: grubosc_blendy_mm,
            },
            loc: WasmLoc {
                x: -width_mm / 2.0 - grubosc_blendy_mm / 2.0 - params.luz_lewy_mm,
                y: pos_y,
                z: z_center,
            },
        });
    }

    // 2. Blenda prawa
    if params.wlacz_prawy {
        let pos_y = if params.auto_glebokosc_prawy {
            0.0
        } else {
            -(depth_mm / 2.0) + depth_right_mm / 2.0
        };
        parts.push(WasmPanelPart {
            name: "Blenda_prawa".to_string(),
            key: "PANEL_RIGHT".to_string(),
            role: "RIGHT_SIDE_PANEL".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: side_h,
                y: depth_right_mm,
                z: grubosc_blendy_mm,
            },
            loc: WasmLoc {
                x: width_mm / 2.0 + grubosc_blendy_mm / 2.0 + params.luz_prawy_mm,
                y: pos_y,
                z: z_center,
            },
        });
    }

    // 3. Blenda górna
    if params.wlacz_gorny {
        let mut left_edge = -width_mm / 2.0;
        let mut right_edge = width_mm / 2.0;
        if params.tryb_paneli_bocznych == "KORPUS" || params.tryb_paneli_bocznych == "COKOL_KORPUS" {
            if params.wlacz_lewy {
                left_edge -= grubosc_blendy_mm;
            }
            if params.wlacz_prawy {
                right_edge += grubosc_blendy_mm;
            }
        }
        let top_w = right_edge - left_edge;
        let pos_y = if params.auto_glebokosc_gorny {
            0.0
        } else {
            -(depth_mm / 2.0) + depth_top_mm / 2.0
        };
        parts.push(WasmPanelPart {
            name: "Blenda_gora".to_string(),
            key: "PANEL_TOP".to_string(),
            role: "TOP_PANEL".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: top_w,
                y: depth_top_mm,
                z: grubosc_blendy_mm,
            },
            loc: WasmLoc {
                x: (left_edge + right_edge) / 2.0,
                y: pos_y,
                z: height_mm + grubosc_blendy_mm / 2.0 + params.luz_gorny_mm,
            },
        });
    }

    // 4. Panel cokołu (dolny)
    if params.wlacz_dolny {
        let mut left_edge = -width_mm / 2.0;
        let mut right_edge = width_mm / 2.0;
        if params.tryb_paneli_bocznych == "KORPUS_BLENDA_G" || params.tryb_paneli_bocznych == "KORPUS" {
            if params.wlacz_lewy {
                left_edge -= grubosc_blendy_mm;
            }
            if params.wlacz_prawy {
                right_edge += grubosc_blendy_mm;
            }
        }
        let cokol_w = right_edge - left_edge;
        parts.push(WasmPanelPart {
            name: "Panel_Cokol".to_string(),
            key: "PANEL_BOTTOM".to_string(),
            role: "BOTTOM_PANEL".to_string(),
            node_type: "PART".to_string(),
            dim: WasmDim {
                x: cokol_w,
                y: grubosc_blendy_mm,
                z: params.wysokosc_cokolu_mm,
            },
            loc: WasmLoc {
                x: (left_edge + right_edge) / 2.0,
                y: -(depth_mm / 2.0) + params.cofniecie_cokolu_mm + grubosc_blendy_mm / 2.0,
                z: -params.szczelina_cokolu_mm - params.wysokosc_cokolu_mm / 2.0,
            },
        });
    }

    let output = PanelsPlanWasmOutput { parts };
    serde_wasm_bindgen::to_value(&output)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

