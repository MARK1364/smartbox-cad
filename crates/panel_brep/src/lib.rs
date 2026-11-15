//! Wejście WASM kernela B-Rep formatek.
//!
//! Cienka warstwa DTO: konwersja nanometrów na milimetry, rozwinięcie szablonów
//! otworów i serializacja wyniku. Cała geometria żyje w modułach `panel`,
//! `overlay`, `mesh`, `brep` i `geom`.

mod alu_frame;
mod brep;
mod geom;
mod mesh;
mod overlay;
mod panel;

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use brep::TopologySummary;
use panel::{build_panel, FeatureInputMm, PanelInputMm};

// ============================================================================
// DTO wejściowe
// ============================================================================

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FeatureInput {
    pub id: String,
    #[serde(rename = "type")]
    pub feature_type: String, // "cutout", "pocket", "groove", "hole"
    pub face: Option<String>,
    pub u_mm: Option<f64>,
    pub v_mm: Option<f64>,
    pub w_mm: Option<f64>,
    pub l_mm: Option<f64>,
    pub depth_mm: Option<f64>,
    pub diameter_mm: Option<f64>,
    pub through: Option<bool>,
    pub template_id: Option<String>,
    pub spacing_mm: Option<f64>,
    pub count: Option<usize>,
    pub polygon: Option<Vec<[f64; 2]>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PanelInput {
    pub width_nm: i64,
    pub height_nm: i64,
    pub thickness_nm: i64,
    pub features: Option<Vec<FeatureInput>>,
    pub outline2d: Option<Vec<[f64; 2]>>,
    pub outline2d_nm: Option<Vec<[f64; 2]>>,
}

// ============================================================================
// DTO wyjściowe
// ============================================================================

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct FaceMeshData {
    pub positions: Vec<f32>,
    pub indices: Vec<u32>,
    #[serde(rename = "edgeKey", skip_serializing_if = "Option::is_none")]
    pub edge_key: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CadEdgeData {
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alias: Option<String>,
    pub points: Vec<Vec<f32>>,
    #[serde(rename = "edgeKey", skip_serializing_if = "Option::is_none")]
    pub edge_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub faces: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PanelMeshOutput {
    #[serde(flatten)]
    pub face_meshes: HashMap<String, FaceMeshData>,
    pub edges: Vec<CadEdgeData>,
    pub vertices: Vec<Vec<f32>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BrepFaceOut {
    pub tag: String,
    pub area: f64,
    /// Pętle ściany jako indeksy wierzchołków.
    pub loops: Vec<Vec<usize>>,
    pub normal: Vec<f32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PanelBrepOutput {
    pub topology: TopologySummary,
    pub faces: Vec<BrepFaceOut>,
    pub vertices: Vec<Vec<f32>>,
    pub mesh_keys: Vec<String>,
}

// ============================================================================
// Konwersja DTO -> model mm
// ============================================================================

fn expand_template(f: &FeatureInput) -> Vec<(String, Option<f64>, Option<f64>)> {
    // (suffix, przesunięcie u, przesunięcie v)
    let template = f.template_id.as_deref().unwrap_or("SINGLE");
    match template {
        "TRIPLE" => {
            let off = f.spacing_mm.unwrap_or(32.0);
            vec![
                (String::new(), None, None),
                ("_t".to_string(), None, Some(off)),
                ("_b".to_string(), None, Some(-off)),
            ]
        }
        "SYSTEM_32" | "ROW" => {
            let count = f.count.unwrap_or(5);
            let sp = f.spacing_mm.unwrap_or(32.0);
            (0..count)
                .map(|i| (format!("_{}", i), None, Some((i as f64) * sp)))
                .collect()
        }
        _ => vec![(String::new(), None, None)],
    }
}

fn build_input_mm(input: &PanelInput) -> Result<PanelInputMm, String> {
    let width = input.width_nm as f64 / 1_000_000.0;
    let height = input.height_nm as f64 / 1_000_000.0;
    let thickness = input.thickness_nm as f64 / 1_000_000.0;
    if width <= 0.0 || height <= 0.0 || thickness <= 0.0 {
        return Err("Niepoprawne wymiary formatki".to_string());
    }

    let mut features: Vec<FeatureInputMm> = Vec::new();
    for f in input.features.as_deref().unwrap_or(&[]) {
        let face = f.face.clone().unwrap_or_else(|| "FACE_Z_PLUS".to_string());
        let is_through = f.through.unwrap_or(false) || f.feature_type == "cutout";
        let u = f.u_mm.unwrap_or(0.0);
        let v = f.v_mm.unwrap_or(0.0);

        if f.feature_type == "hole" {
            let diameter = f.diameter_mm.unwrap_or(35.0);
            let depth = if is_through {
                thickness
            } else {
                f.depth_mm.unwrap_or(12.5)
            };
            for (suffix, du, dv) in expand_template(f) {
                features.push(FeatureInputMm {
                    id: format!("{}{}", f.id, suffix),
                    kind: "hole".to_string(),
                    face: face.clone(),
                    u_mm: u + du.unwrap_or(0.0),
                    v_mm: v + dv.unwrap_or(0.0),
                    w_mm: None,
                    l_mm: None,
                    depth_mm: Some(depth),
                    diameter_mm: Some(diameter),
                    through: is_through,
                    polygon: None,
                });
            }
            continue;
        }

        // Cechy powierzchniowe (cutout / pocket / groove).
        let gw = f.w_mm.unwrap_or(width);
        let gh = f.l_mm.unwrap_or(height);
        let depth = if is_through {
            thickness
        } else {
            f.depth_mm.unwrap_or(3.0)
        };
        features.push(FeatureInputMm {
            id: f.id.clone(),
            kind: f.feature_type.clone(),
            face,
            u_mm: u,
            v_mm: v,
            w_mm: Some(gw),
            l_mm: Some(gh),
            depth_mm: Some(depth),
            diameter_mm: None,
            through: is_through,
            polygon: f.polygon.clone(),
        });
    }

    let outline = if let Some(ref pts_nm) = input.outline2d_nm {
        if pts_nm.len() >= 3 {
            let mut pts: Vec<[f64; 2]> = pts_nm
                .iter()
                .map(|p| [p[0] / 1_000_000.0, p[1] / 1_000_000.0])
                .collect();
            let mut cleaned = geom::clean_contour(&pts);
            geom::ensure_ccw(&mut cleaned);
            if cleaned.len() >= 3 { Some(cleaned) } else { None }
        } else {
            None
        }
    } else if let Some(ref pts_mm) = input.outline2d {
        if pts_mm.len() >= 3 {
            let mut cleaned = geom::clean_contour(pts_mm);
            geom::ensure_ccw(&mut cleaned);
            if cleaned.len() >= 3 { Some(cleaned) } else { None }
        } else {
            None
        }
    } else {
        None
    };

    Ok(PanelInputMm {
        width,
        height,
        thickness,
        features,
        outline,
    })
}

fn box_vertices(width: f64, height: f64, thickness: f64) -> Vec<Vec<f32>> {
    let hw = (width * 0.5) as f32;
    let hh = (height * 0.5) as f32;
    let ht = (thickness * 0.5) as f32;
    vec![
        vec![-hw, -hh, ht],
        vec![hw, -hh, ht],
        vec![hw, hh, ht],
        vec![-hw, hh, ht],
        vec![-hw, -hh, -ht],
        vec![hw, -hh, -ht],
        vec![hw, hh, -ht],
        vec![-hw, hh, -ht],
    ]
}

fn serializer() -> serde_wasm_bindgen::Serializer {
    serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true)
}

// ============================================================================
// Eksporty WASM
// ============================================================================

/// Buduje siatki per ściana oraz krawędzie CAD formatek.
#[wasm_bindgen]
pub fn build_panel_mesh(val: JsValue) -> Result<JsValue, JsValue> {
    let input: PanelInput = serde_wasm_bindgen::from_value(val)
        .map_err(|e| JsValue::from_str(&format!("Błąd parsowania wejścia PanelInput: {}", e)))?;
    let mm = build_input_mm(&input).map_err(|e| JsValue::from_str(&e))?;
    let result = build_panel(&mm).map_err(|e| JsValue::from_str(&e))?;

    let mut face_meshes: HashMap<String, FaceMeshData> = HashMap::new();
    for (key, mesh) in result.meshes {
        if mesh.is_empty() {
            continue;
        }
        let edge_key = result.side_edge_keys.get(&key).cloned();
        face_meshes.insert(
            key,
            FaceMeshData {
                positions: mesh.positions,
                indices: mesh.indices,
                edge_key,
            },
        );
    }

    let edges = result
        .edges
        .into_iter()
        .map(|e| CadEdgeData {
            key: e.key,
            alias: e.alias,
            points: e.points,
            edge_key: e.edge_key,
            faces: e.faces,
        })
        .collect();

    let vertices = if mm.outline.is_some() {
        result.vertices
    } else {
        box_vertices(mm.width, mm.height, mm.thickness)
    };

    let output = PanelMeshOutput {
        face_meshes,
        edges,
        vertices,
    };

    output
        .serialize(&serializer())
        .map_err(|e| JsValue::from_str(&format!("Błąd serializacji wyniku: {}", e)))
}

/// Diagnostyka B-Rep: podsumowanie topologii, ściany i wierzchołki.
#[wasm_bindgen]
pub fn build_panel_brep(val: JsValue) -> Result<JsValue, JsValue> {
    let input: PanelInput = serde_wasm_bindgen::from_value(val)
        .map_err(|e| JsValue::from_str(&format!("Błąd parsowania wejścia PanelInput: {}", e)))?;
    let mm = build_input_mm(&input).map_err(|e| JsValue::from_str(&e))?;
    let result = build_panel(&mm).map_err(|e| JsValue::from_str(&e))?;

    let faces = result
        .brep_faces
        .into_iter()
        .map(|(tag, loops, area)| BrepFaceOut {
            tag,
            area,
            loops,
            normal: vec![0.0, 0.0, 0.0],
        })
        .collect();

    let mesh_keys = result.meshes.keys().cloned().collect();
    let output = PanelBrepOutput {
        topology: result.topology,
        faces,
        vertices: result.vertices,
        mesh_keys,
    };

    output
        .serialize(&serializer())
        .map_err(|e| JsValue::from_str(&format!("Błąd serializacji wyniku: {}", e)))
}

/// Buduje siatki ramki aluminiowej ze szkłem (profil 2D z promieniami r lub ucios 45°).
#[wasm_bindgen]
pub fn build_alu_frame_mesh(val: JsValue) -> Result<JsValue, JsValue> {
    let input: alu_frame::AluFrameInput = serde_wasm_bindgen::from_value(val)
        .map_err(|e| JsValue::from_str(&format!("Błąd parsowania AluFrameInput: {}", e)))?;
    let output = alu_frame::build_alu_frame(&input).map_err(|e| JsValue::from_str(&e))?;
    output
        .serialize(&serializer())
        .map_err(|e| JsValue::from_str(&format!("Błąd serializacji wyniku AluFrame: {}", e)))
}
