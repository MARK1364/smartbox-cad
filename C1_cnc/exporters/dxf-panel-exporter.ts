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
    /** Opcjonalna lista wyekstrahowanych cech do wyeksportowania */
    features?: any[];
    /** Czy dołączyć wymiary otworów od bazy WCS (0,0) na warstwie WYMIARY_OTWORY */
    includeDimensions?: boolean;
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
        if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0 ||
            typeof height !== 'number' || !Number.isFinite(height) || height <= 0 ||
            typeof thickness !== 'number' || !Number.isFinite(thickness) || thickness <= 0) {
            throw new Error(`[dxf-panel-exporter] Opcja dimensionsMm zawiera niepoprawne wymiary fizyczne (W=${width}, H=${height}, T=${thickness}).`);
        }
        return { width, height, thickness };
    }

    if (!panel) {
        throw new Error('[dxf-panel-exporter] Brak referencji do formatki (panel is null/undefined).');
    }

    const p = panel.domainData || panel;

    const rawW = p.width ?? p.length ?? p.dim?.x ?? p.dim_nm?.x;
    const rawH = p.height ?? p.depth ?? p.dim?.y ?? p.dim_nm?.y;
    const rawT = p.thickness ?? p.dim?.z ?? p.dim_nm?.z;

    if (typeof rawW !== 'number' || !Number.isFinite(rawW) || rawW <= 0 ||
        typeof rawH !== 'number' || !Number.isFinite(rawH) || rawH <= 0 ||
        typeof rawT !== 'number' || !Number.isFinite(rawT) || rawT <= 0) {
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
    const includeDimensions = Boolean(options.includeDimensions);

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

    const flipWcsX = wcs ? (minX < -1e-4 && Math.abs(dxfW + minX) < 1e-3) : false;
    const shiftWcsX = wcs && !flipWcsX && minX < -1e-4;
    const flipWcsY = wcs ? (minY < -1e-4 && Math.abs(dxfH + minY) < 1e-3) : false;
    const shiftWcsY = wcs && !flipWcsY && minY < -1e-4;

    const toDxfCoords = (pt: { x: number; y: number }): { x: number; y: number } => {
        if (!wcs) return { x: pt.x, y: pt.y };
        const x = flipWcsX ? -pt.x : (shiftWcsX ? pt.x - minX : pt.x);
        const y = flipWcsY ? -pt.y : (shiftWcsY ? pt.y - minY : pt.y);
        return { x, y };
    };

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
            const m = toDxfCoords(ptWcs);
            return [m.x, m.y];
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
        // Ścieżka WCS: używamy przekazanych cech CAM lub wyliczamy je za pomocą GeometryDataExtractor
        const camFeatures = (options.features && Array.isArray(options.features) && options.features.length > 0)
            ? options.features
            : (new GeometryDataExtractor().extractPanelFeatures(panel, wcs).features || []);

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
                    const { x, y } = toDxfCoords(pos);
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

                    if (includeDimensions && !isEdge) {
                        registerLayer('WYMIARY_OTWORY', 4);
                        const txtX = x + radius + 1.2;
                        const txtY = y + radius + 1.2;
                        const diaLabel = `%%C${diameter}x${depth}`;
                        const labelText = `X=${x.toFixed(1)} Y=${y.toFixed(1)} (${diaLabel})`;
                        entities.push([
                            '0', 'TEXT',
                            '5', nextHandle(),
                            '100', 'AcDbEntity',
                            '8', 'WYMIARY_OTWORY',
                            '100', 'AcDbText',
                            '10', txtX.toFixed(3),
                            '20', txtY.toFixed(3),
                            '30', '0.0',
                            '40', '3.5',
                            '1', labelText
                        ].join('\n'));

                        const crossArm = Math.max(radius + 1.5, 3.5);
                        entities.push([
                            '0', 'LINE',
                            '5', nextHandle(),
                            '100', 'AcDbEntity',
                            '8', 'WYMIARY_OTWORY',
                            '100', 'AcDbLine',
                            '10', (x - crossArm).toFixed(3),
                            '20', y.toFixed(3),
                            '30', '0.0',
                            '11', (x + crossArm).toFixed(3),
                            '21', y.toFixed(3),
                            '31', '0.0'
                        ].join('\n'));
                        entities.push([
                            '0', 'LINE',
                            '5', nextHandle(),
                            '100', 'AcDbEntity',
                            '8', 'WYMIARY_OTWORY',
                            '100', 'AcDbLine',
                            '10', x.toFixed(3),
                            '20', (y - crossArm).toFixed(3),
                            '30', '0.0',
                            '11', x.toFixed(3),
                            '21', (y + crossArm).toFixed(3),
                            '31', '0.0'
                        ].join('\n'));
                    }

                    if (isEdge) {
                        const dirX = hf.axis?.x ?? (hf.face === 'FACE_X_MINUS' ? 1 : hf.face === 'FACE_X_PLUS' ? -1 : 0);
                        const dirY = hf.axis?.y ?? (hf.face === 'FACE_Y_MINUS' ? 1 : hf.face === 'FACE_Y_PLUS' ? -1 : 0);
                        const norm = Math.hypot(dirX, dirY);
                        if (norm > 1e-4) {
                            const nx = dirX / norm;
                            const ny = dirY / norm;
                            entities.push([
                                '0', 'LINE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', layerName,
                                '100', 'AcDbLine',
                                '10', x.toFixed(3),
                                '20', y.toFixed(3),
                                '30', '0.0',
                                '11', (x + nx * depth).toFixed(3),
                                '21', (y + ny * depth).toFixed(3),
                                '31', '0.0'
                            ].join('\n'));
                        }
                    }
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

                const { x: x1, y: y1 } = toDxfCoords(gf.startPoint);
                const { x: x2, y: y2 } = toDxfCoords(gf.endPoint);

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
                const pts = pf.boundaryPoints.map((pt: any) => {
                    const m = toDxfCoords(pt);
                    return [m.x, m.y];
                });
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
                const pts = cf.points.map((pt: any) => {
                    const m = toDxfCoords(pt);
                    return [m.x, m.y];
                });
                const ptsStr = pts.map(([px, py]: [number, number]) => `10\n${px.toFixed(3)}\n20\n${py.toFixed(3)}`).join('\n');
                const dStartEnd = pts.length >= 2
                    ? Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1])
                    : 0;
                const isClosed = cf.closed !== undefined
                    ? Boolean(cf.closed)
                    : (isCutout || (pts.length >= 3 && dStartEnd < 0.01));
                entities.push([
                    '0', 'LWPOLYLINE',
                    '5', nextHandle(),
                    '100', 'AcDbEntity',
                    '8', layerName,
                    '100', 'AcDbPolyline',
                    '90', String(pts.length),
                    '70', isClosed ? '1' : '0',
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
            const faceName = normalizeFaceName(rawFace);

            const params = feat.params || {};

            if (featType === 'hole' || featType === 'drill') {
                const rawDia = params.diameter ?? params.dia ?? 8;
                const diameter = Number(rawDia);
                if (!Number.isFinite(diameter) || diameter <= 0) {
                    throw new Error(`[dxf-panel-exporter] Średnica otworu musi być skończoną liczbą dodatnią dla cechy "${feat.id || 'hole'}" (diameter=${rawDia}).`);
                }
                const rawDepth = params.depth ?? 12;
                const depth = Number(rawDepth);
                if (!Number.isFinite(depth) || Math.abs(depth) < 1e-4) {
                    throw new Error(`[dxf-panel-exporter] Głębokość wiercenia musi być niezerową skończoną liczbą dla cechy "${feat.id || 'hole'}" (depth=${rawDepth}).`);
                }
                const radius = diameter / 2;

                const baseU = Number(params.u !== undefined ? params.u : (params.u_nm !== undefined ? nmToMm(params.u_nm) : (params.x ?? 0)));
                const baseV = Number(params.v !== undefined ? params.v : (params.v_nm !== undefined ? nmToMm(params.v_nm) : (params.y ?? 0)));
                if (!Number.isFinite(baseU) || !Number.isFinite(baseV)) {
                    throw new Error(`[dxf-panel-exporter] Współrzędne otworu (u, v) muszą być liczbami skończonymi dla cechy "${feat.id || 'hole'}" (u=${baseU}, v=${baseV}).`);
                }

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

                        if (includeDimensions) {
                            registerLayer('WYMIARY_OTWORY', 4);
                            const txtX = u + radius + 1.2;
                            const txtY = v + radius + 1.2;
                            const diaLabel = `%%C${diameter}x${depth}`;
                            const labelText = `X=${u.toFixed(1)} Y=${v.toFixed(1)} (${diaLabel})`;
                            entities.push([
                                '0', 'TEXT',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', 'WYMIARY_OTWORY',
                                '100', 'AcDbText',
                                '10', txtX.toFixed(3),
                                '20', txtY.toFixed(3),
                                '30', '0.0',
                                '40', '3.5',
                                '1', labelText
                            ].join('\n'));

                            const crossArm = Math.max(radius + 1.5, 3.5);
                            entities.push([
                                '0', 'LINE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', 'WYMIARY_OTWORY',
                                '100', 'AcDbLine',
                                '10', (u - crossArm).toFixed(3),
                                '20', v.toFixed(3),
                                '30', '0.0',
                                '11', (u + crossArm).toFixed(3),
                                '21', v.toFixed(3),
                                '31', '0.0'
                            ].join('\n'));
                            entities.push([
                                '0', 'LINE',
                                '5', nextHandle(),
                                '100', 'AcDbEntity',
                                '8', 'WYMIARY_OTWORY',
                                '100', 'AcDbLine',
                                '10', u.toFixed(3),
                                '20', (v - crossArm).toFixed(3),
                                '30', '0.0',
                                '11', u.toFixed(3),
                                '21', (v + crossArm).toFixed(3),
                                '31', '0.0'
                            ].join('\n'));
                        }

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
                const hasExplicitWidth = params.width !== undefined || params.width_nm !== undefined;
                const hasExplicitDepth = params.depth !== undefined || params.depth_nm !== undefined;
                const hasExplicitLength = params.length !== undefined || params.length_nm !== undefined;
                const width = hasExplicitWidth ? Number(gp.width) : 4;
                if (!Number.isFinite(width) || width <= 0) {
                    throw new Error(`[dxf-panel-exporter] Szerokość wpustu musi być dodatnią liczbą skończoną dla cechy "${feat.id || 'groove'}" (width=${width}).`);
                }
                const rawDepth = hasExplicitDepth ? Number(gp.depth) : 8;
                if (!Number.isFinite(rawDepth) || Math.abs(rawDepth) < 1e-4) {
                    throw new Error(`[dxf-panel-exporter] Głębokość wpustu nie może być zerowa ani nieskończona dla cechy "${feat.id || 'groove'}" (depth=${rawDepth}).`);
                }
                const depth = Math.abs(rawDepth);
                const length = hasExplicitLength ? Number(gp.length) : (width > 0 ? W : H);
                if (!Number.isFinite(length) || length <= 0) {
                    throw new Error(`[dxf-panel-exporter] Długość wpustu musi być dodatnią liczbą skończoną dla cechy "${feat.id || 'groove'}" (length=${length}).`);
                }
                if (!Number.isFinite(gp.u) || !Number.isFinite(gp.v)) {
                    throw new Error(`[dxf-panel-exporter] Współrzędne wpustu (u, v) muszą być liczbami skończonymi dla cechy "${feat.id || 'groove'}" (u=${gp.u}, v=${gp.v}).`);
                }

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
                const gp = getGrooveParamsMm(params);
                const hasExplicitDepth = params.depth !== undefined || params.depth_nm !== undefined;
                const rawDepth = hasExplicitDepth ? Number(gp.depth) : 3;
                if (!Number.isFinite(rawDepth) || Math.abs(rawDepth) < 1e-4) {
                    throw new Error(`[dxf-panel-exporter] Głębokość kieszeni musi być niezerową skończoną liczbą dla cechy "${feat.id || 'pocket'}" (depth=${rawDepth}).`);
                }
                const depth = rawDepth;
                const u = Number(params.u !== undefined ? params.u : (params.u_nm !== undefined ? nmToMm(params.u_nm) : (params.x ?? 0)));
                const v = Number(params.v !== undefined ? params.v : (params.v_nm !== undefined ? nmToMm(params.v_nm) : (params.y ?? 0)));
                const hasExplicitWidth = params.width !== undefined || params.width_nm !== undefined;
                const width = hasExplicitWidth ? Number(gp.width) : 0;
                const length = (params.length !== undefined || params.length_nm !== undefined) ? Number(gp.length) : Number(params.height ?? 0);
                if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(length) || length <= 0) {
                    throw new Error(`[dxf-panel-exporter] Wymiary kieszeni (width, length) muszą być skończonymi liczbami dodatnimi dla cechy "${feat.id || 'pocket'}" (width=${width}, length=${length}).`);
                }
                if (!Number.isFinite(u) || !Number.isFinite(v)) {
                    throw new Error(`[dxf-panel-exporter] Współrzędne kieszeni (u, v) muszą być liczbami skończonymi dla cechy "${feat.id || 'pocket'}" (u=${u}, v=${v}).`);
                }

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
                const gp = getGrooveParamsMm(params);
                const u = Number(params.u !== undefined ? params.u : (params.u_nm !== undefined ? nmToMm(params.u_nm) : (params.x ?? 0)));
                const v = Number(params.v !== undefined ? params.v : (params.v_nm !== undefined ? nmToMm(params.v_nm) : (params.y ?? 0)));
                const hasExplicitWidth = params.width !== undefined || params.width_nm !== undefined;
                const width = hasExplicitWidth ? Number(gp.width) : 0;
                const length = (params.length !== undefined || params.length_nm !== undefined) ? Number(gp.length) : Number(params.height ?? 0);
                if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(length) || length <= 0) {
                    throw new Error(`[dxf-panel-exporter] Wymiary wycięcia (width, length) muszą być skończonymi liczbami dodatnimi dla cechy "${feat.id || 'cutout'}" (width=${width}, length=${length}).`);
                }
                if (!Number.isFinite(u) || !Number.isFinite(v)) {
                    throw new Error(`[dxf-panel-exporter] Współrzędne wycięcia (u, v) muszą być liczbami skończonymi dla cechy "${feat.id || 'cutout'}" (u=${u}, v=${v}).`);
                }

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
            } else if (featType === 'contour' || featType === 'profile') {
                const depth = Number(params.depth !== undefined ? params.depth : (params.depth_nm !== undefined ? nmToMm(params.depth_nm) : T));
                const isInner = Boolean(params.isInnerContour);
                const isCutout = isInner || (depth >= T - 0.51);
                const layerName = isCutout ? 'CUTOUT' : `CONTOUR_Z${depth}`;
                registerLayer(layerName, isCutout ? 1 : 5);
                const rawPoints: any[] = Array.isArray(params.points) ? params.points : [];
                if (rawPoints.length >= 2) {
                    const pts = rawPoints.map(pt => [Number(pt.x ?? 0), Number(pt.y ?? 0)]);
                    const dStartEnd = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
                    const isClosed = params.closed !== undefined ? Boolean(params.closed) : (isCutout || dStartEnd < 0.01);
                    const ptsStr = pts.map(([px, py]) => `10\n${px.toFixed(3)}\n20\n${py.toFixed(3)}`).join('\n');
                    entities.push([
                        '0', 'LWPOLYLINE',
                        '5', nextHandle(),
                        '100', 'AcDbEntity',
                        '8', layerName,
                        '100', 'AcDbPolyline',
                        '90', String(pts.length),
                        '70', isClosed ? '1' : '0',
                        ptsStr
                    ].join('\n'));
                }
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
    const opts: DxfExportOptions = { includeDimensions: true, ...options };
    const content = generatePanelDxf(panel, opts);
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
