import earcut from 'earcut';
import { isCylindricalPart } from '../../A1_core/cad-node/part-shape.js';
import { AluFrameManager } from '../alu-frame-manager.js';
import { computeFaceData, PANEL_FACE_NAMES } from './face-lcs.js';
import { buildBoxTopology } from './box-topology.js';
import { buildPolygonPanelTopology } from './polygon-extrusion.js';
import { buildBeveledBox, hasEdgeCutConfig, readEdgeCutConfig } from './edge-bevel.js';
import { validatePanelDimensionsNm } from './panel-dimensions.js';
import {
    appendFeatureEdges,
    buildFaceMeshWithFeatures,
    buildProfileMeshWithFeatures,
    collectExtraHoles2D,
    featuresOnFace
} from './cap-machining.js';

export { validatePanelDimensionsNm } from './panel-dimensions.js';

export function buildAluFrameMeshData(model: any) {
    const dims = validatePanelDimensionsNm(model, 'buildAluFrameMeshData');
    const w = dims.widthMm;
    const h = dims.heightMm;

    const tpl = AluFrameManager.instance.getTemplate(model.frameTemplateId);
    const p = tpl.profile;
    const g = tpl.glass;

    const pw = Math.max(5, p.width_mm || 20);
    const t = Math.max(5, p.depth_mm || dims.thicknessMm);
    const lipDepth = p.lip_depth_mm ?? 6;
    const clearance = g.clearance_mm ?? 1.5;
    const glassT = g.thickness_mm ?? 4;

    const halfW = w / 2;
    const halfH = h / 2;
    const halfT = t / 2;

    const x0 = -halfW;
    const x1 = -halfW + pw;
    const x2 = halfW - pw;
    const x3 = halfW;

    const y0 = -halfH;
    const y1 = -halfH + pw;
    const y2 = halfH - pw;
    const y3 = halfH;

    // Obrysy 4 profili (CCW w płaszczyźnie XY)
    const bottomPts: [number, number][] = [
        [x0, y0],
        [x3, y0],
        [x2, y1],
        [x1, y1]
    ];

    const rightPts: [number, number][] = [
        [x3, y0],
        [x3, y3],
        [x2, y2],
        [x2, y1]
    ];

    const topPts: [number, number][] = [
        [x3, y3],
        [x0, y3],
        [x1, y2],
        [x2, y2]
    ];

    const leftPts: [number, number][] = [
        [x0, y3],
        [x0, y0],
        [x1, y1],
        [x1, y2]
    ];

    // Szkło
    const gw = Math.max(10, w - 2 * (pw - lipDepth) - 2 * clearance);
    const gh = Math.max(10, h - 2 * (pw - lipDepth) - 2 * clearance);
    const halfGW = gw / 2;
    const halfGH = gh / 2;
    const halfGlassT = glassT / 2;

    const glassPts: [number, number][] = [
        [-halfGW, -halfGH],
        [halfGW, -halfGH],
        [halfGW, halfGH],
        [-halfGW, halfGH]
    ];

    const features = model.features;

    const bRes = buildProfileMeshWithFeatures({ pts2D: bottomPts, zFront: halfT, zBack: -halfT, features, w, h, t });
    const rRes = buildProfileMeshWithFeatures({ pts2D: rightPts, zFront: halfT, zBack: -halfT, features, w, h, t });
    const tRes = buildProfileMeshWithFeatures({ pts2D: topPts, zFront: halfT, zBack: -halfT, features, w, h, t });
    const lRes = buildProfileMeshWithFeatures({ pts2D: leftPts, zFront: halfT, zBack: -halfT, features, w, h, t });
    const gRes = buildProfileMeshWithFeatures({ pts2D: glassPts, zFront: halfGlassT, zBack: -halfGlassT, features, w, h, t: glassT });

    const result: Record<string, any> = {
        alu_prof_bottom: bRes.mesh,
        alu_prof_right: rRes.mesh,
        alu_prof_top: tRes.mesh,
        alu_prof_left: lRes.mesh,
        alu_glass: gRes.mesh
    };

    // Krawędzie B-rep (edges) z brepPoints (zacięcia 45° i obrysy)
    const edges: Array<{ key: string; points: number[][] }> = [
        // 1. Zacięcia uciosu 45° z przodu (Z = +halfT)
        { key: 'miter_lb_front', points: [[x0, y0, halfT], [x1, y1, halfT]] },
        { key: 'miter_rb_front', points: [[x3, y0, halfT], [x2, y1, halfT]] },
        { key: 'miter_rt_front', points: [[x3, y3, halfT], [x2, y2, halfT]] },
        { key: 'miter_lt_front', points: [[x0, y3, halfT], [x1, y2, halfT]] },

        // 2. Zacięcia uciosu 45° z tyłu (Z = -halfT)
        { key: 'miter_lb_back', points: [[x0, y0, -halfT], [x1, y1, -halfT]] },
        { key: 'miter_rb_back', points: [[x3, y0, -halfT], [x2, y1, -halfT]] },
        { key: 'miter_rt_back', points: [[x3, y3, -halfT], [x2, y2, -halfT]] },
        { key: 'miter_lt_back', points: [[x0, y3, -halfT], [x1, y2, -halfT]] },

        // 3. Obrys zewnętrzny przód (Z = +halfT)
        { key: 'dol_przod', points: [[x0, y0, halfT], [x3, y0, halfT]] },
        { key: 'gora_przod', points: [[x0, y3, halfT], [x3, y3, halfT]] },
        { key: 'przod_lewo', points: [[x0, y0, halfT], [x0, y3, halfT]] },
        { key: 'przod_prawo', points: [[x3, y0, halfT], [x3, y3, halfT]] },

        // 4. Obrys zewnętrzny tył (Z = -halfT)
        { key: 'dol_tyl', points: [[x0, y0, -halfT], [x3, y0, -halfT]] },
        { key: 'gora_tyl', points: [[x0, y3, -halfT], [x3, y3, -halfT]] },
        { key: 'tyl_lewo', points: [[x0, y0, -halfT], [x0, y3, -halfT]] },
        { key: 'tyl_prawo', points: [[x3, y0, -halfT], [x3, y3, -halfT]] },

        // 5. Narożne krawędzie zewn. łączące przód z tyłem
        { key: 'dol_lewo', points: [[x0, y0, -halfT], [x0, y0, halfT]] },
        { key: 'dol_prawo', points: [[x3, y0, -halfT], [x3, y0, halfT]] },
        { key: 'gora_lewo', points: [[x0, y3, -halfT], [x0, y3, halfT]] },
        { key: 'gora_prawo', points: [[x3, y3, -halfT], [x3, y3, halfT]] },

        // 6. Obrys wewnętrzny światła ramy przód (Z = +halfT)
        { key: 'inner_dol_przod', points: [[x1, y1, halfT], [x2, y1, halfT]] },
        { key: 'inner_gora_przod', points: [[x1, y2, halfT], [x2, y2, halfT]] },
        { key: 'inner_przod_lewo', points: [[x1, y1, halfT], [x1, y2, halfT]] },
        { key: 'inner_przod_prawo', points: [[x2, y1, halfT], [x2, y2, halfT]] },

        // 7. Obrys wewnętrzny światła ramy tył (Z = -halfT)
        { key: 'inner_dol_tyl', points: [[x1, y1, -halfT], [x2, y1, -halfT]] },
        { key: 'inner_gora_tyl', points: [[x1, y2, -halfT], [x2, y2, -halfT]] },
        { key: 'inner_tyl_lewo', points: [[x1, y1, -halfT], [x1, y2, -halfT]] },
        { key: 'inner_tyl_prawo', points: [[x2, y1, -halfT], [x2, y2, -halfT]] },

        // 8. Krawędzie naroży wewnętrznych światła
        { key: 'inner_corner_lb', points: [[x1, y1, -halfT], [x1, y1, halfT]] },
        { key: 'inner_corner_rb', points: [[x2, y1, -halfT], [x2, y1, halfT]] },
        { key: 'inner_corner_rt', points: [[x2, y2, -halfT], [x2, y2, halfT]] },
        { key: 'inner_corner_lt', points: [[x1, y2, -halfT], [x1, y2, halfT]] },

        // 9. Krawędzie tafli szkła (przód)
        { key: 'glass_dol', points: [[-halfGW, -halfGH, halfGlassT], [halfGW, -halfGH, halfGlassT]] },
        { key: 'glass_gora', points: [[-halfGW, halfGH, halfGlassT], [halfGW, halfGH, halfGlassT]] },
        { key: 'glass_lewo', points: [[-halfGW, -halfGH, halfGlassT], [-halfGW, halfGH, halfGlassT]] },
        { key: 'glass_prawo', points: [[halfGW, -halfGH, halfGlassT], [halfGW, halfGH, halfGlassT]] }
    ];

    edges.push(...bRes.edges, ...rRes.edges, ...tRes.edges, ...lRes.edges, ...gRes.edges);
    result.edges = edges;

    result.vertices = [
        [x0, y0, -halfT], [x3, y0, -halfT], [x3, y3, -halfT], [x0, y3, -halfT],
        [x0, y0, halfT], [x3, y0, halfT], [x3, y3, halfT], [x0, y3, halfT],
        [x1, y1, -halfT], [x2, y1, -halfT], [x2, y2, -halfT], [x1, y2, -halfT],
        [x1, y1, halfT], [x2, y1, halfT], [x2, y2, halfT], [x1, y2, halfT]
    ];

    return result;
}

export type { OutlineSegmentEdgeKey } from './polygon-extrusion.js';

export function buildMeshFromPanel(model: any) {
    if (model.panelForm === 'ALU_FRAME' || (typeof model.isAluFrame === 'function' && model.isAluFrame())) {
        return buildAluFrameMeshData(model);
    }

    if (model.role === 'DRILLING_PATTERN' || isCylindricalPart(model)) {
        return { edges: [], vertices: [] };
    }

    const outlineRaw = model.custom_properties?.outline2d || model.customProperties?.outline2d;
    const outline2d: number[][] | null = Array.isArray(outlineRaw) && outlineRaw.length >= 3
        ? outlineRaw.map((p: any) => [Number(p[0]) || 0, Number(p[1]) || 0])
        : null;

    const dims = validatePanelDimensionsNm(model, 'buildMeshFromPanel');
    const modelWidth = dims.widthMm;
    const modelHeight = dims.heightMm;
    const modelThickness = dims.thicknessMm;

    // Formatka kształtowa (wieniec L): jedna ekstruzja wielokąta — caps + boki + wpusty
    if (outline2d) {
        return buildPolygonPanelTopology({
            outline2d,
            plateW: modelWidth,
            plateD: modelHeight,
            thickness: modelThickness,
            features: model.features
        });
    }

    const cutConfig = readEdgeCutConfig(model.edgeBanding || model.custom_properties?.edge_banding);
    if (hasEdgeCutConfig(cutConfig)) {
        const box = buildBeveledBox(modelWidth, modelHeight, modelThickness, cutConfig);
        const faceOf = (pts: number[][]) => {
            const positions = pts.flat();
            return { positions, indices: [0, 1, 2, 0, 2, 3] };
        };
        return {
            FACE_Z_PLUS: faceOf(box.top),
            FACE_Z_MINUS: faceOf([...box.bottom].reverse()),
            FACE_X_PLUS: box.sides['+X'],
            FACE_X_MINUS: box.sides['-X'],
            FACE_Y_PLUS: box.sides['+Y'],
            FACE_Y_MINUS: box.sides['-Y'],
            vertices: [...box.top, ...box.bottom],
            edges: box.edges,
        };
    }

    const result: any = {};
    const extraHoles2D = collectExtraHoles2D(model.features, modelWidth, modelHeight, modelThickness);

    for (const face of PANEL_FACE_NAMES) {
        const faceData = computeFaceData(face, modelWidth, modelHeight, modelThickness);
        const outerContour = [
            [0, 0],
            [faceData.width, 0],
            [faceData.width, faceData.height],
            [0, faceData.height]
        ];
        const built = buildFaceMeshWithFeatures({
            faceData,
            outerContour,
            extraHoles: extraHoles2D[face] || [],
            featuresOnFace: featuresOnFace(model.features, face),
            w: modelWidth,
            h: modelHeight,
            t: modelThickness
        });
        result[face] = built.mesh;
        Object.assign(result, built.featureMeshes);
    }

    const boxTopo = buildBoxTopology(modelWidth, modelHeight, modelThickness);
    result['vertices'] = boxTopo.vertices;
    result['edges'] = boxTopo.edges;
    appendFeatureEdges(result['edges'], model.features, modelWidth, modelHeight, modelThickness);

    return result;
}
