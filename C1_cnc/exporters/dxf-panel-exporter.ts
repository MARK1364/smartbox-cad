/**
 * C1_cnc/exporters/dxf-panel-exporter.ts
 * 
 * Uniwersalny eksporter formatki meblowej do formatu wektorowego AutoCAD ASCII DXF (R2000 / AC1015).
 * Generuje czysty, znormalizowany plik DXF zgodny ze standardem stolarskim (CNC Woodworking Standard):
 * - OBRYS (OUTLINE): zamknięta polilinia 2D (LWPOLYLINE) o dokładnych wymiarach WCS lub wg outline2d
 * - WIERCENIA PIONOWE (DRILL_D{dia}_Z{depth} / DRILL_D{dia}_THROUGH): okręgi (CIRCLE) na licy górnym (FACE_Z_PLUS)
 * - WIERCENIA SPODNIE (DRILL_BACK_D{dia}_Z{depth}): okręgi na licy dolnym (FACE_Z_MINUS)
 * - WIERCENIA KRAWĘDZIOWE (DRILL_EDGE_{LEFT|RIGHT|BOTTOM|TOP}_D{dia}_Z{depth}): punkty wejścia i osie w głąb krawędzi
 * - ROWKI / NUTA (GROOVE_W{w}_Z{d}): oś frezowania (LINE) i prostokątny obrys wpustu (LWPOLYLINE na _OUTLINE)
 * - KIESZENIE (POCKET_Z{d}) i WYCIĘCIA PRZELOTOWE (CUTOUT): zamknięte polilinie
 */

import { nmToMm } from '../../A1_core/cad-math/units.js';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { normalizeFaceName } from '../../A4_smartpanel/panel-model.js';
import { deriveOutlineWithCutouts } from '../../A4_smartpanel/native_core/polygon-extrusion.js';
import { expandHoleCenters } from '../../A4_smartpanel/native_core/hole-generator.js';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';
import { WcsManager } from '../wcs/wcs-manager.js';
import { WcsRulesMapper } from '../wcs/wcs-rules-mapper.js';

export interface DxfExportOptions {
    /** Opcjonalna nazwa pliku (domyślnie generowana z nazwy lub id formatki) */
    fileName?: string;
    /** Czy uwzględniać wiercenia w krawędziach formatki (FACE_X_*, FACE_Y_*) */
    includeEdgeDrills?: boolean;
    /** Czy uwzględniać operacje na spodniej stronie formatki (FACE_Z_MINUS) */
    includeBackFeatures?: boolean;
    /** Jawne wymiary w mm, jeśli obiekt źródłowy nie posiada pól wymiarów w nm */
    dimensionsMm?: { width: number; height: number; thickness: number };
}

interface DxfLayerDef {
    name: string;
    color: number; // AutoCAD Color Index (1=red, 2=yellow, 3=green, 4=cyan, 5=blue, 6=magenta, 7=white, 8=dark gray)
}

/**
 * Zwraca znormalizowane wymiary formatki w milimetrach [mm].
 */
export function getPanelDimensionsMm(panel: any, options?: DxfExportOptions): { width: number; height: number; thickness: number } {
    if (options?.dimensionsMm) {
        const { width, height, thickness } = options.dimensionsMm;
        if (width > 0 && height > 0 && thickness > 0) {
            return { width, height, thickness };
        }
    }

    if (!panel) {
        throw new Error('[dxf-panel-exporter] Brak referencji do formatki (panel is null/undefined).');
    }

    const p = panel.domainData || panel;

    const rawW = p.width ?? p.length ?? p.dim?.x ?? p.dim_nm?.x;
    const rawH = p.height ?? p.depth ?? p.dim?.y ?? p.dim_nm?.y;
    const rawT = p.thickness ?? p.dim?.z ?? p.dim_nm?.z;

    if (typeof rawW !== 'number' || rawW <= 0 ||
        typeof rawH !== 'number' || rawH <= 0 ||
        typeof rawT !== 'number' || rawT <= 0) {
        throw new Error(`[dxf-panel-exporter] Formatka "${p.id || panel.id || 'nieznana'}" nie posiada poprawnych wymiarów fizycznych (W=${rawW}, H=${rawH}, T=${rawT}).`);
    }

    return {
        width: nmToMm(rawW),
        height: nmToMm(rawH),
        thickness: nmToMm(rawT)
    };
}

/**
 * Wyznacza 2D obrys formatki (współrzędne w mm):
 * - z custom_properties.outline2d / outline2d_nm jeśli obecny (np. formatki L, narożne, skosy)
 * - z wycięć krawędziowych za pomocą deriveOutlineWithCutouts
 * - domyślnie: prostokąt [0,0] -> [W,0] -> [W,H] -> [0,H]
 */
export function resolvePanelOutline2D(panel: any, widthMm: number, heightMm: number, thicknessMm: number): {
    outline: Array<[number, number]>;
    consumedFeatures: Set<any>;
} {
    const consumedFeatures = new Set<any>();
    const p = panel?.domainData || panel;

    // 1. Sprawdź custom_properties.outline2d
    const customOutline = p?.custom_properties?.outline2d || p?.outline2d;
    if (Array.isArray(customOutline) && customOutline.length >= 3) {
        const pts: Array<[number, number]> = customOutline.map((pt: any) => {
            if (Array.isArray(pt)) return [Number(pt[0]) || 0, Number(pt[1]) || 0];
            return [Number(pt.u ?? pt.x) || 0, Number(pt.v ?? pt.y) || 0];
        });
        return { outline: pts, consumedFeatures };
    }

    // 2. Sprawdź custom_properties.outline2d_nm
    const customOutlineNm = p?.custom_properties?.outline2d_nm || p?.outline2d_nm;
    if (Array.isArray(customOutlineNm) && customOutlineNm.length >= 3) {
        const pts: Array<[number, number]> = customOutlineNm.map(([unm, vnm]: [number, number]) => [nmToMm(unm), nmToMm(vnm)]);
        return { outline: pts, consumedFeatures };
    }

    // 3. Sprawdź wycięcia krawędziowe modyfikujące obrys formatki
    const features = p?.features;
    if (Array.isArray(features) && features.length > 0) {
        try {
            const derived = deriveOutlineWithCutouts(widthMm, heightMm, thicknessMm, features);
            if (derived && Array.isArray(derived.outline2d) && derived.outline2d.length >= 3) {
                const pts: Array<[number, number]> = derived.outline2d.map(([x, y]) => [x, y]);
                return { outline: pts, consumedFeatures: derived.consumedFeatures || consumedFeatures };
            }
        } catch {
            // w razie nietypowej geometrii fallback do nominalnego prostokąta
        }
    }

    // 4. Nominalny prostokąt
    return {
        outline: [
            [0, 0],
            [widthMm, 0],
            [widthMm, heightMm],
            [0, heightMm]
        ],
        consumedFeatures
    };
}

/**
 * Główna funkcja generująca tekst pliku AutoCAD ASCII DXF (R2000 / AC1015) dla formatki.
 */
export function generatePanelDxf(panel: any, options: DxfExportOptions = {}): string {
    const { width: W, height: H, thickness: T } = getPanelDimensionsMm(panel, options);
    const includeEdgeDrills = options.includeEdgeDrills !== false;
    const includeBackFeatures = options.includeBackFeatures !== false;

    const p = panel?.domainData || panel;
    const role = p?.role || panel?.role;
    const rule = role ? WcsRulesMapper.getRuleForRole(role) : null;

    let dxfW = W;
    let dxfH = H;
    let dxfT = T;
    let minX = 0;
    let minY = 0;

    let wcs: WcsManager | null = null;
    if (rule) {
        wcs = new WcsManager('G55');
        wcs.updateForPanelDimensions(W, H, T);
        wcs.setRule(rule);

        const corners = [
            { x: -W / 2, y: -H / 2, z: -T / 2 },
            { x: W / 2, y: -H / 2, z: -T / 2 },
            { x: W / 2, y: H / 2, z: -T / 2 },
            { x: -W / 2, y: H / 2, z: -T / 2 },
            { x: -W / 2, y: -H / 2, z: T / 2 },
            { x: W / 2, y: -H / 2, z: T / 2 },
            { x: W / 2, y: H / 2, z: T / 2 },
            { x: -W / 2, y: H / 2, z: T / 2 },
        ];
        const wcsCorners = corners.map(c => wcs!.toWcsCoordinates(c));
        let cMinX = Infinity, cMaxX = -Infinity;
        let cMinY = Infinity, cMaxY = -Infinity;
        let cMinZ = Infinity, cMaxZ = -Infinity;
        for (const c of wcsCorners) {
            if (c.x < cMinX) cMinX = c.x;
            if (c.x > cMaxX) cMaxX = c.x;
            if (c.y < cMinY) cMinY = c.y;
            if (c.y > cMaxY) cMaxY = c.y;
            if (c.z < cMinZ) cMinZ = c.z;
            if (c.z > cMaxZ) cMaxZ = c.z;
        }
        minX = cMinX;
        minY = cMinY;
        dxfW = Math.round((cMaxX - cMinX) * 100) / 100;
        dxfH = Math.round((cMaxY - cMinY) * 100) / 100;
        dxfT = Math.round((cMaxZ - cMinZ) * 100) / 100;
    }

    const { outline, consumedFeatures } = resolvePanelOutline2D(panel, W, H, T);

    const layersMap = new Map<string, DxfLayerDef>();
    const registerLayer = (name: string, color: number) => {
        if (!layersMap.has(name)) {
            layersMap.set(name, { name, color });
        }
    };

    // Warstwy bazowe
    registerLayer('0', 7);
    registerLayer('OBRYS', 1); // Czerwony — obrys formatki

    let handleId = 10;
    const nextHandle = (): string => (handleId++).toString(16).toUpperCase();

    const entities: string[] = [];

    // ─── 1. OBRYS FORMATKI (LWPOLYLINE) ───
    let finalOutline: Array<[number, number]>;
    if (wcs) {
        finalOutline = outline.map(([u, v]) => {
            const ptWcs = wcs!.toWcsCoordinates({ x: -W / 2 + u, y: -H / 2 + v, z: T / 2 });
            return [ptWcs.x - minX, ptWcs.y - minY];
        });
    } else {
        finalOutline = outline;
    }

    const outlineVertices = finalOutline.map(([x, y]) => `10\n${x.toFixed(3)}\n20\n${y.toFixed(3)}`).join('\n');
    entities.push([
        '0', 'LWPOLYLINE',
        '5', nextHandle(),
        '100', 'AcDbEntity',
        '8', 'OBRYS',
        '100', 'AcDbPolyline',
        '90', String(finalOutline.length),
        '70', '1', // closed polyline
        outlineVertices
    ].join('\n'));

    // ─── 2. CECHY OBRÓBCZE (WIERCENIA, ROWKI, KIESZENIE, WYCIĘCIA) ───
    if (wcs) {
        // Ścieżka WCS: używamy sprawdzonego GeometryDataExtractor do przeliczenia geometrii na bazę CNC
        const extractor = new GeometryDataExtractor();
        const camData = extractor.extractPanelFeatures(panel, wcs);
        const camFeatures = camData.features || [];

        for (const f of camFeatures) {
            if ('positions' in f || 'diameter' in f) {
                // HoleFeature
                const hf = f as any;
                const diameter = Number(hf.diameter || 8);
                const depth = Number(hf.depth || 12);
                const radius = diameter / 2;
                const isThrough = Boolean(hf.through || depth >= dxfT - 0.51);
                const isBack = hf.face === 'FACE_Z_MINUS';

                if (isBack && !includeBackFeatures) continue;

                const isEdge = String(hf.face || '').includes('FACE_X') || String(hf.face || '').includes('FACE_Y');
                if (isEdge && !includeEdgeDrills) continue;

                let layerName = isThrough ? `DRILL_D${diameter}_THROUGH` : `DRILL_D${diameter}_Z${depth}`;
                if (isBack && !isThrough) {
                    layerName = `DRILL_BACK_D${diameter}_Z${depth}`;
                } else if (isEdge) {
                    layerName = `DRILL_EDGE_D${diameter}_Z${depth}`;
                }
                registerLayer(layerName, isThrough ? 1 : (isBack ? 6 : (isEdge ? 4 : 2)));

                const positions = hf.positions && Array.isArray(hf.positions) && hf.positions.length > 0
                    ? hf.positions
                    : [hf.position];

                for (const pos of positions) {
                    const x = pos.x - minX;
                    const y = pos.y - minY;
                    entities.push([
                        '0', 'CIRCLE',
                        '5', nextHandle(),
                        '100', 'AcDbEntity',
                        '8', layerName,
                        '100', 'AcDbCircle',
                        '10', x.toFixed(3),
                        '20', y.toFixed(3),
                        '30', '0.0',
                        '40', radius.toFixed(3)
                    ].join('\n'));
                }
            } else if ('startPoint' in f && 'endPoint' in f) {
                // GrooveFeature
                const gf = f as any;
                const width = Number(gf.width || 4);
                const depth = Number(gf.depth || 8);
                const isBack = gf.face === 'FACE_Z_MINUS';
                if (isBack && !includeBackFeatures) continue;

                const layerName = isBack ? `GROOVE_BACK_W${width}_Z${depth}` : `GROOVE_W${width}_Z${depth}`;
                registerLayer(layerName, isBack ? 30 : 3);

                const x1 = gf.startPoint.x - minX;
                const y1 = gf.startPoint.y - minY;
                const x2 = gf.endPoint.x - minX;
                const y2 = gf.endPoint.y - minY;

                // Centerline
                entities.push([
                    '0', 'LINE',
                    '5', nextHandle(),
                    '100', 'AcDbEntity',
                    '8', layerName,
                    '100', 'AcDbLine',
                    '10', x1.toFixed(3),
                    '20', y1.toFixed(3),
                    '30', '0.0',
                    '11', x2.toFixed(3),
                    '21', y2.toFixed(3),
                    '31', '0.0'
                ].join('\n'));

                // Obrys prostokątny wpustu na warstwie wpustu
                const boundaryLayer = layerName;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.hypot(dx, dy);
                if (len > 0.001) {
                    const nx = (-dy / len) * (width / 2);
                    const ny = (dx / len) * (width / 2);
                    const rectPts = [
                        [x1 + nx, y1 + ny],
                        [x2 + nx, y2 + ny],
                        [x2 - nx, y2 - ny],
                        [x1 - nx, y1 - ny]
                    ];
                    const ptsStr = rectPts.map(([rx, ry]) => `10\n${rx.toFixed(3)}\n20\n${ry.toFixed(3)}`).join('\n');
                    entities.push([
                        '0', 'LWPOLYLINE',
                        '5', nextHandle(),
                        '100', 'AcDbEntity',
                        '8', boundaryLayer,
                        '100', 'AcDbPolyline',
                        '90', '4',
                        '70', '1',
                        ptsStr
                    ].join('\n'));
                }
            } else if ('boundaryPoints' in f && Array.isArray((f as any).boundaryPoints)) {
                // PocketFeature
                const pf = f as any;
                const depth = Number(pf.depth || 3);
                const layerName = `POCKET_Z${depth}`;
                registerLayer(layerName, 5);
                const pts = pf.boundaryPoints.map((pt: any) => [pt.x - minX, pt.y - minY]);
                const ptsStr = pts.map(([px, py]: [number, number]) => `10\n${px.toFixed(3)}\n20\n${py.toFixed(3)}`).join('\n');
                entities.push([
                    '0', 'LWPOLYLINE',
                    '5', nextHandle(),
                    '100', 'AcDbEntity',
                    '8', layerName,
                    '100', 'AcDbPolyline',
                    '90', String(pts.length),
                    '70', '1',
                    ptsStr
                ].join('\n'));
            } else if ('points' in f && Array.isArray((f as any).points)) {
                // ContourFeature / Cutout
                const cf = f as any;
                const depth = Number(cf.depth || dxfT);
                const isCutout = cf.isInnerContour || (depth >= dxfT - 0.51);
                const layerName = isCutout ? 'CUTOUT' : `CONTOUR_Z${depth}`;
                registerLayer(layerName, isCutout ? 1 : 5);
                const pts = cf.points.map((pt: any) => [pt.x - minX, pt.y - minY]);
                const ptsStr = pts.map(([px, py]: [number, number]) => `10\n${px.toFixed(3)}\n20\n${py.toFixed(3)}`).join('\n');
                entities.push([
                    '0', 'LWPOLYLINE',
                    '5', nextHandle(),
                    '100', 'AcDbEntity',
                    '8', layerName,
                    '100', 'AcDbPolyline',
                    '90', String(pts.length),
                    '70', '1',
                    ptsStr
                ].join('\n'));
            }
        }
    } else {
        // Ścieżka lokalna LCS (dla formatek testowych / bez roli)
        const features: any[] = Array.isArray(p?.features) ? p.features : [];

        for (const feat of features) {
            if (!feat || consumedFeatures.has(feat)) continue;

            if (feat.cam_frozen === true || feat.frozen === true || feat.params?.frozen === true ||
                feat.visible === false || feat.params?.visible === false) {
                continue;
            }

            const featType = (feat.type || '').toLowerCase();
            const rawFace = feat.face || 'FACE_Z_PLUS';
            let faceName: string;
            try {
                faceName = normalizeFaceName(rawFace);
            } catch {
                faceName = 'FACE_Z_PLUS';
            }

            const params = feat.params || {};

            if (featType === 'hole' || featType === 'drill') {
                const diameter = Number(params.diameter || params.dia || 8);
                const depth = Number(params.depth || 12);
                const radius = diameter / 2;

                const baseU = Number(params.u !== undefined ? params.u : (params.u_nm !== undefined ? nmToMm(params.u_nm) : (params.x || 0)));
                const baseV = Number(params.v !== undefined ? params.v : (params.v_nm !== undefined ? nmToMm(params.v_nm) : (params.y || 0)));

                const isThrough = params.through === true || depth >= T - 0.51;

                const centers = expandHoleCenters({ ...params, u: baseU, v: baseV });
                for (const { cx: u, cy: v } of centers) {
                    if (faceName === 'FACE_Z_PLUS') {
                        const layerName = isThrough ? `DRILL_D${diameter}_THROUGH` : `DRILL_D${diameter}_Z${depth}`;
                        registerLayer(layerName, 2);

                        entities.push([
                            '0', 'CIRCLE',
                            '5', nextHandle(),
                            '100', 'AcDbEntity',
                            '8', layerName,
                            '100', 'AcDbCircle',
                            '10', u.toFixed(3),
                            '20', v.toFixed(3),
                            '30', '0.0',
                            '40', radius.toFixed(3)
                        ].join('\n'));

                    } else if (faceName === 'FACE_Z_MINUS') {
                        if (!includeBackFeatures) continue;
                        const xBack = W - u;
                        const layerName = isThrough ? `DRILL_D${diameter}_THROUGH` : `DRILL_BACK_D${diameter}_Z${depth}`;
                        registerLayer(layerName, 6);

                        entities.push([
                            '0', 'CIRCLE',
                            '5', nextHandle(),
                            '100', 'AcDbEntity',
                            '8', layerName,
                            '100', 'AcDbCircle',
                            '10', xBack.toFixed(3),
                            '20', v.toFixed(3),
                            '30', '0.0',
                            '40', radius.toFixed(3)
                        ].join('\n'));

                    } else if (includeEdgeDrills) {
                        if (faceName === 'FACE_X_MINUS') {
                            const layerName = `DRILL_EDGE_LEFT_D${diameter}_Z${depth}`;
                            registerLayer(layerName, 4);

                            entities.push([
                                '0', 'CIRCLE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', layerName,
                                '100', 'AcDbCircle',
                                '10', '0.000',
                                '20', v.toFixed(3),
                                '30', '0.0',
                                '40', radius.toFixed(3)
                            ].join('\n'));

                            entities.push([
                                '0', 'LINE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', layerName,
                                '100', 'AcDbLine',
                                '10', '0.000',
                                '20', v.toFixed(3),
                                '30', '0.0',
                                '11', depth.toFixed(3),
                                '21', v.toFixed(3),
                                '31', '0.0'
                            ].join('\n'));

                        } else if (faceName === 'FACE_X_PLUS') {
                            const layerName = `DRILL_EDGE_RIGHT_D${diameter}_Z${depth}`;
                            registerLayer(layerName, 4);

                            entities.push([
                                '0', 'CIRCLE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', layerName,
                                '100', 'AcDbCircle',
                                '10', W.toFixed(3),
                                '20', v.toFixed(3),
                                '30', '0.0',
                                '40', radius.toFixed(3)
                            ].join('\n'));

                            entities.push([
                                '0', 'LINE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', layerName,
                                '100', 'AcDbLine',
                                '10', W.toFixed(3),
                                '20', v.toFixed(3),
                                '30', '0.0',
                                '11', (W - depth).toFixed(3),
                                '21', v.toFixed(3),
                                '31', '0.0'
                            ].join('\n'));

                        } else if (faceName === 'FACE_Y_MINUS') {
                            const layerName = `DRILL_EDGE_BOTTOM_D${diameter}_Z${depth}`;
                            registerLayer(layerName, 4);

                            entities.push([
                                '0', 'CIRCLE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', layerName,
                                '100', 'AcDbCircle',
                                '10', u.toFixed(3),
                                '20', '0.000',
                                '30', '0.0',
                                '40', radius.toFixed(3)
                            ].join('\n'));

                            entities.push([
                                '0', 'LINE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', layerName,
                                '100', 'AcDbLine',
                                '10', u.toFixed(3),
                                '20', '0.000',
                                '30', '0.0',
                                '11', u.toFixed(3),
                                '21', depth.toFixed(3),
                                '31', '0.0'
                            ].join('\n'));

                        } else if (faceName === 'FACE_Y_PLUS') {
                            const layerName = `DRILL_EDGE_TOP_D${diameter}_Z${depth}`;
                            registerLayer(layerName, 4);

                            entities.push([
                                '0', 'CIRCLE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', layerName,
                                '100', 'AcDbCircle',
                                '10', u.toFixed(3),
                                '20', H.toFixed(3),
                                '30', '0.0',
                                '40', radius.toFixed(3)
                            ].join('\n'));

                            entities.push([
                                '0', 'LINE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', layerName,
                                '100', 'AcDbLine',
                                '10', u.toFixed(3),
                                '20', H.toFixed(3),
                                '30', '0.0',
                                '11', u.toFixed(3),
                                '21', (H - depth).toFixed(3),
                                '31', '0.0'
                            ].join('\n'));
                        }
                    }
                }

            } else if (featType === 'groove' || featType === 'nut') {
                const gp = getGrooveParamsMm(params);
                const width = gp.width || 4;
                const length = gp.length || (width > 0 ? W : H);
                const depth = Math.abs(gp.depth || 8);

                const isBack = faceName === 'FACE_Z_MINUS';
                if (isBack && !includeBackFeatures) continue;

                const layerName = isBack ? `GROOVE_BACK_W${width}_Z${depth}` : `GROOVE_W${width}_Z${depth}`;
                registerLayer(layerName, isBack ? 30 : 3);

                let u0 = Math.min(gp.u, gp.u + width);
                let u1 = Math.max(gp.u, gp.u + width);
                const v0 = Math.min(gp.v, gp.v + length);
                const v1 = Math.max(gp.v, gp.v + length);

                if (isBack) {
                    const mirrorU0 = W - u1;
                    const mirrorU1 = W - u0;
                    u0 = mirrorU0;
                    u1 = mirrorU1;
                }

                const isVertical = (u1 - u0) < (v1 - v0);
                if (isVertical) {
                    const midX = (u0 + u1) / 2;
                    entities.push([
                        '0', 'LINE',
                        '5', nextHandle(),
                        '100', 'AcDbEntity',
                        '8', layerName,
                        '100', 'AcDbLine',
                        '10', midX.toFixed(3),
                        '20', v0.toFixed(3),
                        '30', '0.0',
                        '11', midX.toFixed(3),
                        '21', v1.toFixed(3),
                        '31', '0.0'
                    ].join('\n'));
                } else {
                    const midY = (v0 + v1) / 2;
                    entities.push([
                        '0', 'LINE',
                        '5', nextHandle(),
                        '100', 'AcDbEntity',
                        '8', layerName,
                        '100', 'AcDbLine',
                        '10', u0.toFixed(3),
                        '20', midY.toFixed(3),
                        '30', '0.0',
                        '11', u1.toFixed(3),
                        '21', midY.toFixed(3),
                        '31', '0.0'
                    ].join('\n'));
                }

                // Prostokątny obrys rowka na warstwie wpustu
                const boundaryLayer = layerName;
                const groovePolyVertices = [
                    `10\n${u0.toFixed(3)}\n20\n${v0.toFixed(3)}`,
                    `10\n${u1.toFixed(3)}\n20\n${v0.toFixed(3)}`,
                    `10\n${u1.toFixed(3)}\n20\n${v1.toFixed(3)}`,
                    `10\n${u0.toFixed(3)}\n20\n${v1.toFixed(3)}`
                ].join('\n');

                entities.push([
                    '0', 'LWPOLYLINE',
                    '5', nextHandle(),
                    '100', 'AcDbEntity',
                    '8', boundaryLayer,
                    '100', 'AcDbPolyline',
                    '90', '4',
                    '70', '1',
                    groovePolyVertices
                ].join('\n'));

            } else if (featType === 'pocket') {
                const depth = Number(params.depth || 3);
                const u = Number(params.u !== undefined ? params.u : (params.x || 0));
                const v = Number(params.v !== undefined ? params.v : (params.y || 0));
                const width = Number(params.width || 50);
                const length = Number(params.length || params.height || 50);

                const layerName = `POCKET_Z${depth}`;
                registerLayer(layerName, 5);

                const polyVertices = [
                    `10\n${u.toFixed(3)}\n20\n${v.toFixed(3)}`,
                    `10\n${(u + width).toFixed(3)}\n20\n${v.toFixed(3)}`,
                    `10\n${(u + width).toFixed(3)}\n20\n${(v + length).toFixed(3)}`,
                    `10\n${u.toFixed(3)}\n20\n${(v + length).toFixed(3)}`
                ].join('\n');

                entities.push([
                    '0', 'LWPOLYLINE',
                    '5', nextHandle(),
                    '100', 'AcDbEntity',
                    '8', layerName,
                    '100', 'AcDbPolyline',
                    '90', '4',
                    '70', '1',
                    polyVertices
                ].join('\n'));

            } else if (featType === 'cutout') {
                const u = Number(params.u !== undefined ? params.u : (params.x || 0));
                const v = Number(params.v !== undefined ? params.v : (params.y || 0));
                const width = Number(params.width || 50);
                const length = Number(params.length || params.height || 50);

                const layerName = 'CUTOUT';
                registerLayer(layerName, 1);

                const polyVertices = [
                    `10\n${u.toFixed(3)}\n20\n${v.toFixed(3)}`,
                    `10\n${(u + width).toFixed(3)}\n20\n${v.toFixed(3)}`,
                    `10\n${(u + width).toFixed(3)}\n20\n${(v + length).toFixed(3)}`,
                    `10\n${u.toFixed(3)}\n20\n${(v + length).toFixed(3)}`
                ].join('\n');

                entities.push([
                    '0', 'LWPOLYLINE',
                    '5', nextHandle(),
                    '100', 'AcDbEntity',
                    '8', layerName,
                    '100', 'AcDbPolyline',
                    '90', '4',
                    '70', '1',
                    polyVertices
                ].join('\n'));
            }
        }
    }

    // ─── 3. STRUKTURA PLIKU DXF (HEADER, TABLES, BLOCKS, ENTITIES) ───
    const layerEntries: string[] = [];
    for (const [name, def] of layersMap) {
        layerEntries.push(
            '0', 'LAYER',
            '5', nextHandle(),
            '100', 'AcDbSymbolTableRecord',
            '100', 'AcDbLayerTableRecord',
            '2', name,
            '70', '0',
            '62', String(def.color),
            '6', 'CONTINUOUS'
        );
    }

    const dxfParts: string[] = [
        // ─── HEADER ───
        '0', 'SECTION',
        '2', 'HEADER',
        '9', '$ACADVER',
        '1', 'AC1015',
        '9', '$INSUNITS',
        '70', '4', // Millimeters
        '9', '$EXTMIN',
        '10', '0.000',
        '20', '0.000',
        '30', '0.000',
        '9', '$EXTMAX',
        '10', dxfW.toFixed(3),
        '20', dxfH.toFixed(3),
        '30', dxfT.toFixed(3),
        '0', 'ENDSEC',

        // ─── TABLES ───
        '0', 'SECTION',
        '2', 'TABLES',
        '0', 'TABLE',
        '2', 'LTYPE',
        '5', nextHandle(),
        '100', 'AcDbSymbolTable',
        '70', '1',
        '0', 'LTYPE',
        '5', nextHandle(),
        '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbLinetypeTableRecord',
        '2', 'CONTINUOUS',
        '70', '0',
        '3', 'Solid line',
        '72', '65',
        '73', '0',
        '40', '0.0',
        '0', 'ENDTAB',
        '0', 'TABLE',
        '2', 'LAYER',
        '5', nextHandle(),
        '100', 'AcDbSymbolTable',
        '70', String(layersMap.size),
        ...layerEntries,
        '0', 'ENDTAB',
        '0', 'ENDSEC',

        // ─── BLOCKS ───
        '0', 'SECTION',
        '2', 'BLOCKS',
        '0', 'ENDSEC',

        // ─── ENTITIES ───
        '0', 'SECTION',
        '2', 'ENTITIES',
        ...entities,
        '0', 'ENDSEC',

        // ─── EOF ───
        '0', 'EOF',
        ''
    ];

    return dxfParts.join('\n');
}

/**
 * Generuje plik DXF dla formatki i uruchamia bezpośrednie pobieranie w przeglądarce.
 */
export function downloadPanelDxf(panel: any, options: DxfExportOptions = {}): { filename: string; content: string } {
    const content = generatePanelDxf(panel, options);
    const p = panel?.domainData || panel;
    const rawName = p?.name ?? panel?.name;
    const fallbackId = p?.id ?? panel?.id ?? 'panel';
    const pName = rawName || fallbackId;
    const safeName = pName.replace(/[^a-zA-Z0-9_\-\u00C0-\u017F]/g, '_');
    const filename = options.fileName || `${safeName}.dxf`;

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([content], { type: 'application/dxf;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return { filename, content };
}
