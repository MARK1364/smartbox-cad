import earcut from 'earcut';
import { isCylindricalPart } from '../../A1_core/cad-node/part-shape.js';
import { AluFrameManager } from '../alu-frame-manager.js';
import { buildProfileFrameMesh } from './alu-frame-profile.js';
import { computeFaceData, localTo3D, local3DToFaceUV } from './face-lcs.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { buildPolygonPanelTopology, deriveOutlineWithCutouts, extractGrooveBoxes, splitSegmentByGrooves } from './polygon-extrusion.js';
import { buildBeveledBox, hasEdgeCutConfig, readEdgeCutConfig } from './edge-bevel.js';
import { buildSkosnyRoofWithTrapezoidGroove } from './skosny-roof-groove.js';
import { buildBoxPanelMeshData } from './plate-buffer-builder.js';
import { validatePanelDimensionsNm } from './panel-dimensions.js';
import {
    appendFeatureEdges,
    buildFaceMeshWithFeatures,
    buildProfileMeshWithFeatures,
    collectExtraHoles2D,
    featuresOnFace
} from './cap-machining.js';
import { readFeatureUV } from './feature-uv.js';

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

    const fillet_mm = Number(model.fillet_mm || model.custom_properties?.fillet_mm || (p as any).fillet_mm) || 0;
    const inner_fillet_mm = Number(model.inner_fillet_mm || model.custom_properties?.inner_fillet_mm);

    if (fillet_mm > 0.05 || model.frameType === 'PROFILE' || model.custom_properties?.frame_type === 'PROFILE') {
        const frameRes = buildProfileFrameMesh({
            w,
            h,
            t,
            pw,
            glassT,
            lipDepth,
            clearance,
            fillet_mm,
            inner_fillet_mm: Number.isFinite(inner_fillet_mm) ? inner_fillet_mm : undefined,
            features: model.features
        });
        return {
            alu_frame: frameRes.alu_frame,
            alu_glass: frameRes.alu_glass,
            edges: frameRes.edges,
            vertices: frameRes.vertices
        };
    }

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

    const dims = validatePanelDimensionsNm(model, 'buildMeshFromPanel');
    const modelWidth = dims.widthMm;
    const modelHeight = dims.heightMm;
    const modelThickness = dims.thicknessMm;

    const outlineRaw = model.custom_properties?.outline2d || model.customProperties?.outline2d;
    let outline2d: number[][] | null = Array.isArray(outlineRaw) && outlineRaw.length >= 3
        ? outlineRaw.map((p: any) => [Number(p[0]) || 0, Number(p[1]) || 0])
        : null;

    const outlineNmRaw = model.custom_properties?.outline2d_nm || model.customProperties?.outline2d_nm;
    if (!outline2d && Array.isArray(outlineNmRaw) && outlineNmRaw.length >= 3) {
        outline2d = outlineNmRaw.map(([unm, vnm]: any) => [nmToMm(unm), nmToMm(vnm)]);
    }

    let consumedFeatures: Set<any> | undefined;
    let adjustedFeatures: any[] | undefined;
    if (!outline2d) {
        const derived = deriveOutlineWithCutouts(modelWidth, modelHeight, modelThickness, model.features);
        if (derived) {
            outline2d = derived.outline2d;
            consumedFeatures = derived.consumedFeatures;
            adjustedFeatures = derived.adjustedFeatures;
        }
    }

    // Formatka kształtowa lub z wycięciem brzegowym: jedna ekstruzja wielokąta — caps + boki + wpusty
    if (outline2d) {
        const baseFeatures = adjustedFeatures || model.features || [];
        const activeFeatures = consumedFeatures && consumedFeatures.size > 0
            ? baseFeatures.filter((f: any) => !consumedFeatures!.has(f))
            : baseFeatures;

        return buildPolygonPanelTopology({
            outline2d,
            plateW: modelWidth,
            plateD: modelHeight,
            thickness: modelThickness,
            features: activeFeatures
        });
    }

    const trapezoidSpec = model.customProperties?.backGrooveTrapezoid || model.custom_properties?.backGrooveTrapezoid;
    if (trapezoidSpec && trapezoidSpec.margines_gorny_plecow_mm > 0.05) {
        return buildSkosnyRoofWithTrapezoidGroove(modelWidth, modelHeight, modelThickness, trapezoidSpec);
    }

    const cutConfig = readEdgeCutConfig(model.edgeBanding || model.custom_properties?.edge_banding);
    if (hasEdgeCutConfig(cutConfig)) {
        const box = buildBeveledBox(modelWidth, modelHeight, modelThickness, cutConfig);
        const hasFeatures = Array.isArray(model.features) && model.features.length > 0;

        if (!hasFeatures) {
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

        const faceDataZPlus = computeFaceData('FACE_Z_PLUS', modelWidth, modelHeight, modelThickness);
        const faceDataZMinus = computeFaceData('FACE_Z_MINUS', modelWidth, modelHeight, modelThickness);

        const contourZPlus = box.top.map(p => {
            const uv = local3DToFaceUV(faceDataZPlus, p as [number, number, number]);
            return [uv.u, uv.v];
        });
        const bottomContourZPlus = box.bottom.map(p => {
            const uv = local3DToFaceUV(faceDataZPlus, p as [number, number, number]);
            return [uv.u, uv.v];
        });
        const bottomCcw = [box.bottom[1], box.bottom[0], box.bottom[3], box.bottom[2]];
        const contourZMinus = bottomCcw.map(p => {
            const uv = local3DToFaceUV(faceDataZMinus, p as [number, number, number]);
            return [uv.u, uv.v];
        });
        const topCcwForZMinus = [box.top[1], box.top[0], box.top[3], box.top[2]];
        const bottomContourZMinus = topCcwForZMinus.map(p => {
            const uv = local3DToFaceUV(faceDataZMinus, p as [number, number, number]);
            return [uv.u, uv.v];
        });

        const extraHoles2D = collectExtraHoles2D(model.features, modelWidth, modelHeight, modelThickness);

        const featsZPlus = featuresOnFace(model.features, 'FACE_Z_PLUS');
        const featsZMinus = featuresOnFace(model.features, 'FACE_Z_MINUS');

        const builtZPlus = buildFaceMeshWithFeatures({
            faceData: faceDataZPlus,
            outerContour: contourZPlus,
            bottomContour: bottomContourZPlus,
            extraHoles: extraHoles2D['FACE_Z_PLUS'] || [],
            featuresOnFace: featsZPlus,
            w: modelWidth,
            h: modelHeight,
            t: modelThickness
        });

        const builtZMinus = buildFaceMeshWithFeatures({
            faceData: faceDataZMinus,
            outerContour: contourZMinus,
            bottomContour: bottomContourZMinus,
            extraHoles: extraHoles2D['FACE_Z_MINUS'] || [],
            featuresOnFace: featsZMinus,
            w: modelWidth,
            h: modelHeight,
            t: modelThickness
        });

        let uMinTop = Infinity, uMaxTop = -Infinity, vMinTop = Infinity, vMaxTop = -Infinity;
        for (const [cu, cv] of contourZPlus) {
            if (cu < uMinTop) uMinTop = cu;
            if (cu > uMaxTop) uMaxTop = cu;
            if (cv < vMinTop) vMinTop = cv;
            if (cv > vMaxTop) vMaxTop = cv;
        }
        let uMinBot = Infinity, uMaxBot = -Infinity, vMinBot = Infinity, vMaxBot = -Infinity;
        for (const [cu, cv] of bottomContourZPlus) {
            if (cu < uMinBot) uMinBot = cu;
            if (cu > uMaxBot) uMaxBot = cu;
            if (cv < vMinBot) vMinBot = cv;
            if (cv > vMaxBot) vMaxBot = cv;
        }

        const evalBevelPerimeter3D = (uNom: number, vNom: number, depthFromZPlus: number): [number, number, number] => {
            const s = modelThickness > 1e-6 ? Math.max(0, Math.min(1, depthFromZPlus / modelThickness)) : 0;
            const uMinD = uMinTop + s * (uMinBot - uMinTop);
            const uMaxD = uMaxTop + s * (uMaxBot - uMaxTop);
            const vMinD = vMinTop + s * (vMinBot - vMinTop);
            const vMaxD = vMaxTop + s * (vMaxBot - vMaxTop);
            const EPS = 0.05;
            const duBevel = uNom > modelWidth / 2 ? s * (uMaxBot - uMaxTop) : s * (uMinBot - uMinTop);
            const dvBevel = vNom > modelHeight / 2 ? s * (vMaxBot - vMaxTop) : s * (vMinBot - vMinTop);
            const uEff = uNom <= EPS ? uMinD : (uNom >= modelWidth - EPS ? uMaxD : Math.max(uMinD, Math.min(uMaxD, uNom + duBevel)));
            const vEff = vNom <= EPS ? vMinD : (vNom >= modelHeight - EPS ? vMaxD : Math.max(vMinD, Math.min(vMaxD, vNom + dvBevel)));
            return localTo3D(faceDataZPlus, uEff, vEff, depthFromZPlus) as [number, number, number];
        };

        const grooveBoxes = extractGrooveBoxes(model.features, modelWidth);
        const nominalOutline: Array<[number, number]> = [
            [0, 0],
            [modelWidth, 0],
            [modelWidth, modelHeight],
            [0, modelHeight]
        ];
        const allSubsegs = nominalOutline.map((pt, idx) => {
            const next = (idx + 1) % 4;
            return splitSegmentByGrooves(pt[0], pt[1], nominalOutline[next][0], nominalOutline[next][1], grooveBoxes);
        });

        const result: any = {
            FACE_Z_PLUS: builtZPlus.mesh,
            FACE_Z_MINUS: builtZMinus.mesh,
            vertices: [...box.top, ...box.bottom],
            edges: grooveBoxes.length === 0 ? [...box.edges] : [],
        };

        const sideFacesConfig: Array<{
            face: string;
            edgeKey: '+X' | '-X' | '+Y' | '-Y';
            segIdx: number;
            pts3D: number[][];
            topKey: string;
            botKey: string;
            vertKey: string;
            vertFaces: [string, string];
        }> = [
                {
                    face: 'FACE_Y_MINUS', edgeKey: '-Y', segIdx: 0,
                    pts3D: [box.bottom[0], box.bottom[1], box.top[1], box.top[0]],
                    topKey: 'dol_przod', botKey: 'dol_tyl', vertKey: 'dol_lewo', vertFaces: ['FACE_X_MINUS', 'FACE_Y_MINUS']
                },
                {
                    face: 'FACE_X_PLUS', edgeKey: '+X', segIdx: 1,
                    pts3D: [box.top[1], box.bottom[1], box.bottom[2], box.top[2]],
                    topKey: 'przod_prawo', botKey: 'tyl_prawo', vertKey: 'dol_prawo', vertFaces: ['FACE_X_PLUS', 'FACE_Y_MINUS']
                },
                {
                    face: 'FACE_Y_PLUS', edgeKey: '+Y', segIdx: 2,
                    pts3D: [box.top[3], box.top[2], box.bottom[2], box.bottom[3]],
                    topKey: 'gora_przod', botKey: 'gora_tyl', vertKey: 'gora_prawo', vertFaces: ['FACE_X_PLUS', 'FACE_Y_PLUS']
                },
                {
                    face: 'FACE_X_MINUS', edgeKey: '-X', segIdx: 3,
                    pts3D: [box.bottom[0], box.top[0], box.top[3], box.bottom[3]],
                    topKey: 'przod_lewo', botKey: 'tyl_lewo', vertKey: 'gora_lewo', vertFaces: ['FACE_X_MINUS', 'FACE_Y_PLUS']
                }
            ];

        const sideFaceDataMap: Record<string, any> = {};
        const featuresForEdges = [
            ...featsZPlus,
            ...featsZMinus,
            ...model.features.filter((f: any) => {
                const face = f.face || f.side || '';
                return !String(face).includes('FACE_Z') && face !== '+Z' && face !== '-Z';
            })
        ];

        for (const side of sideFacesConfig) {
            const sideFeatures = featuresOnFace(model.features, side.face);
            const subsegs = allSubsegs[side.segIdx];
            const prevSubsegs = allSubsegs[(side.segIdx + 3) % 4];
            const prevLastSub = prevSubsegs[prevSubsegs.length - 1];

            if (grooveBoxes.length > 0) {
                for (let sIdx = 0; sIdx < subsegs.length; sIdx++) {
                    const sub = subsegs[sIdx];
                    const p0t = evalBevelPerimeter3D(sub.u0, sub.v0, sub.depthPlus);
                    const p1t = evalBevelPerimeter3D(sub.u1, sub.v1, sub.depthPlus);
                    const p0b = evalBevelPerimeter3D(sub.u0, sub.v0, modelThickness - sub.depthMinus);
                    const p1b = evalBevelPerimeter3D(sub.u1, sub.v1, modelThickness - sub.depthMinus);
                    const suffix = subsegs.length > 1 ? `_${sIdx + 1}` : '';

                    result.edges.push({
                        key: `${side.topKey}${suffix}`,
                        alias: side.topKey,
                        points: [p0t, p1t],
                        faces: ['FACE_Z_PLUS', side.face],
                        edgeKey: side.edgeKey
                    });
                    result.edges.push({
                        key: `${side.botKey}${suffix}`,
                        alias: side.botKey,
                        points: [p0b, p1b],
                        faces: ['FACE_Z_MINUS', side.face],
                        edgeKey: side.edgeKey
                    });

                    if (sIdx === 0) {
                        const cornerDepthPlus = prevLastSub ? Math.max(prevLastSub.depthPlus, sub.depthPlus) : sub.depthPlus;
                        const cornerDepthMinus = prevLastSub ? Math.max(prevLastSub.depthMinus, sub.depthMinus) : sub.depthMinus;
                        const pCornert = evalBevelPerimeter3D(sub.u0, sub.v0, cornerDepthPlus);
                        const pCornerb = evalBevelPerimeter3D(sub.u0, sub.v0, modelThickness - cornerDepthMinus);
                        result.edges.push({
                            key: side.vertKey,
                            alias: side.vertKey,
                            points: [pCornerb, pCornert],
                            faces: side.vertFaces,
                            edgeKey: side.edgeKey
                        });
                    } else {
                        const prevSub = subsegs[sIdx - 1];
                        const dPlus0 = Math.min(prevSub.depthPlus, sub.depthPlus);
                        const dPlus1 = Math.max(prevSub.depthPlus, sub.depthPlus);
                        if (dPlus1 - dPlus0 > 0.05) {
                            result.edges.push({
                                key: `outline_step_top_${side.segIdx}_${sIdx}`,
                                points: [
                                    evalBevelPerimeter3D(sub.u0, sub.v0, dPlus0),
                                    evalBevelPerimeter3D(sub.u0, sub.v0, dPlus1)
                                ],
                                faces: ['FACE_Z_PLUS', side.face],
                                edgeKey: side.edgeKey
                            });
                        }
                        const dMinus0 = Math.min(prevSub.depthMinus, sub.depthMinus);
                        const dMinus1 = Math.max(prevSub.depthMinus, sub.depthMinus);
                        if (dMinus1 - dMinus0 > 0.05) {
                            result.edges.push({
                                key: `outline_step_bot_${side.segIdx}_${sIdx}`,
                                points: [
                                    evalBevelPerimeter3D(sub.u0, sub.v0, modelThickness - dMinus0),
                                    evalBevelPerimeter3D(sub.u0, sub.v0, modelThickness - dMinus1)
                                ],
                                faces: ['FACE_Z_MINUS', side.face],
                                edgeKey: side.edgeKey
                            });
                        }
                    }
                }
            }

            if (sideFeatures.length === 0) {
                if (grooveBoxes.length === 0) {
                    result[side.face] = box.sides[side.edgeKey];
                } else {
                    const pos: number[] = [];
                    const ind: number[] = [];
                    let vertOffset = 0;
                    for (const sub of subsegs) {
                        const p0t = evalBevelPerimeter3D(sub.u0, sub.v0, sub.depthPlus);
                        const p1t = evalBevelPerimeter3D(sub.u1, sub.v1, sub.depthPlus);
                        const p0b = evalBevelPerimeter3D(sub.u0, sub.v0, modelThickness - sub.depthMinus);
                        const p1b = evalBevelPerimeter3D(sub.u1, sub.v1, modelThickness - sub.depthMinus);
                        pos.push(...p0t, ...p1t, ...p1b, ...p0b);
                        ind.push(vertOffset, vertOffset + 2, vertOffset + 1, vertOffset, vertOffset + 3, vertOffset + 2);
                        vertOffset += 4;
                    }
                    result[side.face] = { positions: pos, indices: ind };
                }
            } else {
                // Lokalna baza (LCS) skośnej ściany dla nawiertów bocznych (hole)
                const p0 = side.pts3D[0];
                const du = [side.pts3D[1][0] - p0[0], side.pts3D[1][1] - p0[1], side.pts3D[1][2] - p0[2]];
                const lenU = Math.hypot(du[0], du[1], du[2]) || 1;
                const uAxis = [du[0] / lenU, du[1] / lenU, du[2] / lenU];

                const dv = [side.pts3D[3][0] - p0[0], side.pts3D[3][1] - p0[1], side.pts3D[3][2] - p0[2]];
                const nx = uAxis[1] * dv[2] - uAxis[2] * dv[1];
                const ny = uAxis[2] * dv[0] - uAxis[0] * dv[2];
                const nz = uAxis[0] * dv[1] - uAxis[1] * dv[0];
                const lenN = Math.hypot(nx, ny, nz) || 1;
                const normal = [nx / lenN, ny / lenN, nz / lenN];

                const vAxis = [
                    normal[1] * uAxis[2] - normal[2] * uAxis[1],
                    normal[2] * uAxis[0] - normal[0] * uAxis[2],
                    normal[0] * uAxis[1] - normal[1] * uAxis[0],
                ];

                const faceData = {
                    origin: p0,
                    uAxis,
                    vAxis,
                    normal,
                    width: lenU,
                    height: Math.hypot(dv[0], dv[1], dv[2])
                };
                sideFaceDataMap[side.face] = faceData;

                const outerContour = side.pts3D.map(p => {
                    const dx = p[0] - p0[0];
                    const dy = p[1] - p0[1];
                    const dz = p[2] - p0[2];
                    return [
                        dx * uAxis[0] + dy * uAxis[1] + dz * uAxis[2],
                        dx * vAxis[0] + dy * vAxis[1] + dz * vAxis[2]
                    ];
                });

                const nominalFaceData = computeFaceData(side.face, modelWidth, modelHeight, modelThickness);
                const denom = nominalFaceData.normal[0] * faceData.normal[0] +
                    nominalFaceData.normal[1] * faceData.normal[1] +
                    nominalFaceData.normal[2] * faceData.normal[2];

                const mappedSideFeatures = sideFeatures.map(feat => {
                    if (feat.type !== 'hole' || !feat.params) return feat;
                    const { u: uNom, v: vNom } = readFeatureUV(feat.params);
                    const pNominal = localTo3D(nominalFaceData, uNom, vNom, 0);

                    let pSurface = pNominal;
                    if (Math.abs(denom) > 1e-6) {
                        const diff = [
                            pNominal[0] - faceData.origin[0],
                            pNominal[1] - faceData.origin[1],
                            pNominal[2] - faceData.origin[2],
                        ];
                        const dot = diff[0] * faceData.normal[0] + diff[1] * faceData.normal[1] + diff[2] * faceData.normal[2];
                        const s = dot / denom;
                        pSurface = [
                            pNominal[0] - s * nominalFaceData.normal[0],
                            pNominal[1] - s * nominalFaceData.normal[1],
                            pNominal[2] - s * nominalFaceData.normal[2],
                        ];
                    }

                    const dx = pSurface[0] - faceData.origin[0];
                    const dy = pSurface[1] - faceData.origin[1];
                    const dz = pSurface[2] - faceData.origin[2];
                    const uMapped = dx * faceData.uAxis[0] + dy * faceData.uAxis[1] + dz * faceData.uAxis[2];
                    const vMapped = dx * faceData.vAxis[0] + dy * faceData.vAxis[1] + dz * faceData.vAxis[2];

                    const mapped = {
                        ...feat,
                        params: {
                            ...feat.params,
                            u: uMapped,
                            v: vMapped,
                        }
                    };

                    const idx = featuresForEdges.findIndex(f => f.id === feat.id);
                    if (idx >= 0) featuresForEdges[idx] = mapped;

                    return mapped;
                });

                const builtSide = buildFaceMeshWithFeatures({
                    faceData,
                    outerContour,
                    extraHoles: [],
                    featuresOnFace: mappedSideFeatures,
                    w: modelWidth,
                    h: modelHeight,
                    t: modelThickness
                });
                result[side.face] = builtSide.mesh;
                Object.assign(result, builtSide.featureMeshes);
            }
        }

        Object.assign(result, builtZPlus.featureMeshes);
        Object.assign(result, builtZMinus.featureMeshes);
        appendFeatureEdges(
            result.edges,
            featuresForEdges,
            modelWidth,
            modelHeight,
            modelThickness,
            sideFaceDataMap,
            undefined,
            {
                FACE_Z_PLUS: { faceContour: contourZPlus, bottomContour: bottomContourZPlus },
                FACE_Z_MINUS: { faceContour: contourZMinus, bottomContour: bottomContourZMinus }
            }
        );

        return result;
    }

    return buildPolygonPanelTopology({
        outline2d: [
            [0, 0],
            [modelWidth, 0],
            [modelWidth, modelHeight],
            [0, modelHeight]
        ],
        plateW: modelWidth,
        plateD: modelHeight,
        thickness: modelThickness,
        features: model.features
    });
}