/**
 * C1_cnc/exporters/panel-html-preview.ts
 * 
 * Generator profesjonalnego rysunku technicznego i karty warsztatowej formatki w formacie HTML
 * z wektorowym, interaktywnym rzutem SVG (Zoom & Pan kółkiem myszy i przeciąganiem).
 * 
 * Standard rysunku technicznego:
 * - Punkt zerowy (0, 0) dla boków korpusu: ZAWSZE NA DOLE I Z PRZODU (Dół = Y0, Przód = X0)
 * - Pełne zwymiarowanie operacji REWIZJI (położenie X i Y od bazy oraz wymiary szerokość × wysokość wycięcia)
 * - Formatka z rysunkiem jako główny, dominujący element widoku (pełna wysokość)
 * - Wymiarowanie bazowe: liczby wymiarowe umieszczone PRZY GROCIE strzałki (standard ISO)
 * - Brak zasłaniającej tabliczki w rogu rzutu formatki
 * - Zwarty jednoliniowy nagłówek formatki z parametrami i kontrolkami
 * - Dyskretny, mały pasek tytułowy strony
 * - Punkt zerowy bazy odniesienia (0, 0) z osiami X i Y (bez maszynowych kodów G55)
 * - Równoległe linie odsunięte okleinowania krawędzi z grubością obrzeża (ABS)
 * - Płynny interaktywny Zoom & Pan wokół kursora oraz przyciski kontrolne [+], [-], [100%]
 * - Pobieranie DXF na żądanie (przycisk w nagłówku każdej formatki)
 */

import { nmToMm } from '../../A1_core/cad-math/units.js';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { normalizeFaceName } from '../../A4_smartpanel/panel-model.js';
import { generatePanelDxf, getPanelDimensionsMm, resolvePanelOutline2D } from './dxf-panel-exporter.js';
import { WcsRulesMapper } from '../wcs/wcs-rules-mapper.js';
import { WcsManager } from '../wcs/wcs-manager.js';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';

export interface PanelHolePreviewItem {
    id: string;
    index: number;
    x: number;
    y: number;
    diameter: number;
    depth: number;
    isThrough: boolean;
    face: string;
    isBack: boolean;
    isEdge: boolean;
    label: string;
}

export interface PanelGroovePreviewItem {
    id: string;
    width: number;
    depth: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isBack: boolean;
    purpose?: string;
}

export interface PanelCutoutPreviewItem {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
    isThrough: boolean;
    points: Array<[number, number]>;
}

export interface PanelEdgePreviewItem {
    edgeKey: string;      // '-X' | '+X' | '-Y' | '+Y'
    label: string;        // 'Przód' | 'Tył' | 'Dół' | 'Góra' itp.
    lengthMm: number;
    active: boolean;
    name: string;
    thicknessMm: number;
    colorHex: string;
}

export interface PanelPreviewData {
    id: string;
    name: string;
    role?: string;
    isSidePanel: boolean;
    containerName?: string;
    dimensions: { width: number; height: number; thickness: number };
    materialName?: string;
    wcsName: string;
    wcsOriginLabel: string;
    dxfWidth: number;
    dxfHeight: number;
    dxfThickness: number;
    outline: Array<[number, number]>;
    holes: PanelHolePreviewItem[];
    grooves: PanelGroovePreviewItem[];
    cutouts: PanelCutoutPreviewItem[];
    edges: PanelEdgePreviewItem[];
    dxfContent: string;
    dxfFilename: string;
}

/**
 * Sprawdza, czy dana rola / nazwa reprezentuje pionowy bok korpusu meblowego.
 */
export function isSidePanelRole(role?: string, name?: string): boolean {
    const r = (role || '').toUpperCase();
    const n = (name || '').toUpperCase();
    return (
        r === 'LEFT_SIDE_PANEL' || r === 'RIGHT_SIDE_PANEL' ||
        r === 'SIDE_LEFT' || r === 'SIDE_RIGHT' ||
        r === 'BOK_L' || r === 'BOK_P' ||
        r === 'DOL_BOK_L' || r === 'DOL_BOK_P' ||
        r === 'GOR_BOK_L' || r === 'GOR_BOK_P' ||
        n.includes('BOK') || n.includes('SIDE')
    );
}

/**
 * Ekstrahuje znormalizowane dane formatki na potrzeby rysunku technicznego.
 * Formatki boków korpusu są układane PŁASKO (dłuższy wymiar w poziomie, jak na stole CNC / DXF):
 * - Punkt zerowy (0, 0) w lewym-dolnym rogu: DÓŁ-PRZÓD
 * - Oś pozioma = długość/wysokość formatki (0 = dół, rośnie w prawo do góry korpusu)
 * - Oś pionowa = głębokość formatki (0 = przód/front, rośnie w górę do pleców)
 */
export function extractPanelPreviewData(panel: any, containerName?: string): PanelPreviewData {
    const { width: rawW, height: rawH, thickness: rawT } = getPanelDimensionsMm(panel);
    const p = panel?.domainData || panel;
    const role = String(p?.role || panel?.role || 'PANEL');
    const isSide = isSidePanelRole(role, p?.name);

    let W = rawW;
    let H = rawH;
    const T = rawT;

    // Dla boku szafki układamy formatkę PŁASKO (jak na maszynie CNC / DXF):
    // Oś pozioma rysunku to długość/wysokość korpusu (W_draw = max(rawW, rawH)),
    // Oś pionowa rysunku to głębokość korpusu (H_draw = min(rawW, rawH)).
    if (isSide) {
        W = Math.max(rawW, rawH);
        H = Math.min(rawW, rawH);
    }

    const originLabel = isSide ? 'Narożnik dół-przód (0, 0)' : 'Lewy-dolny narożnik (0, 0)';

    const holes: PanelHolePreviewItem[] = [];
    const grooves: PanelGroovePreviewItem[] = [];
    const cutouts: PanelCutoutPreviewItem[] = [];

    const rule = role ? WcsRulesMapper.getRuleForRole(role) : null;
    let wcs: WcsManager | null = null;
    if (rule) {
        wcs = new WcsManager('G55');
        wcs.updateForPanelDimensions(rawW, rawH, rawT);
        wcs.setRule(rule);
    }

    const corners = [
        { x: -rawW / 2, y: -rawH / 2, z: -rawT / 2 },
        { x: rawW / 2, y: -rawH / 2, z: -rawT / 2 },
        { x: rawW / 2, y: rawH / 2, z: -rawT / 2 },
        { x: -rawW / 2, y: rawH / 2, z: -rawT / 2 },
        { x: -rawW / 2, y: -rawH / 2, z: rawT / 2 },
        { x: rawW / 2, y: -rawH / 2, z: rawT / 2 },
        { x: rawW / 2, y: rawH / 2, z: rawT / 2 },
        { x: -rawW / 2, y: rawH / 2, z: rawT / 2 },
    ];
    let minWcsX = 0, minWcsY = 0;
    let dxfSpanW = W, dxfSpanH = H;
    if (wcs) {
        const wcsCorners = corners.map(c => wcs!.toWcsCoordinates(c));
        let cMinX = Infinity, cMaxX = -Infinity;
        let cMinY = Infinity, cMaxY = -Infinity;
        for (const c of wcsCorners) {
            if (c.x < cMinX) cMinX = c.x;
            if (c.x > cMaxX) cMaxX = c.x;
            if (c.y < cMinY) cMinY = c.y;
            if (c.y > cMaxY) cMaxY = c.y;
        }
        minWcsX = cMinX;
        minWcsY = cMinY;
        dxfSpanW = Math.round((cMaxX - cMinX) * 100) / 100;
        dxfSpanH = Math.round((cMaxY - cMinY) * 100) / 100;
    }

    const flipX = wcs ? (minWcsX < -1e-4 && Math.abs(dxfSpanW + minWcsX) < 1e-3) : false;
    const shiftX = wcs && !flipX && minWcsX < -1e-4;
    const flipY = wcs ? (minWcsY < -1e-4 && Math.abs(dxfSpanH + minWcsY) < 1e-3) : false;
    const shiftY = wcs && !flipY && minWcsY < -1e-4;

    const mapToDxf = (pt: { x: number; y: number }): { x: number; y: number } => {
        if (!wcs) return { x: pt.x, y: pt.y };
        const x = flipX ? -pt.x : (shiftX ? pt.x - minWcsX : pt.x);
        const y = flipY ? -pt.y : (shiftY ? pt.y - minWcsY : pt.y);
        return { x, y };
    };

    if (wcs) {
        const camFeatures = (new GeometryDataExtractor().extractPanelFeatures(panel, wcs).features || []);
        let hIdx = 1;

        for (const f of camFeatures) {
            if ('positions' in f || 'diameter' in f) {
                const hf = f as any;
                const diameter = Number(hf.diameter || 8);
                const depth = Number(hf.depth || 12);
                const isThrough = Boolean(hf.through || depth >= T - 0.51);
                const normFace = normalizeFaceName(hf.face || 'FACE_Z_PLUS');
                const isBack = normFace === 'FACE_Z_MINUS';
                const isEdge = String(hf.face || '').includes('FACE_X') || String(hf.face || '').includes('FACE_Y');

                const positions = hf.positions && Array.isArray(hf.positions) && hf.positions.length > 0
                    ? hf.positions
                    : [hf.position];

                for (const pos of positions) {
                    const m = mapToDxf(pos);
                    const drawX = m.x;
                    const drawY = m.y;
                    holes.push({
                        id: hf.featureId || `hole_${hIdx}`,
                        index: hIdx++,
                        x: Math.round(drawX * 10) / 10,
                        y: Math.round(drawY * 10) / 10,
                        diameter,
                        depth,
                        isThrough,
                        face: normFace,
                        isBack,
                        isEdge,
                        label: isThrough ? `⌀${diameter}` : `⌀${diameter}×${depth}`
                    });
                }
            } else if ('startPoint' in f && 'endPoint' in f) {
                const gf = f as any;
                const m1 = mapToDxf(gf.startPoint);
                const m2 = mapToDxf(gf.endPoint);
                grooves.push({
                    id: gf.featureId || `groove_${grooves.length + 1}`,
                    width: Number(gf.width || 4),
                    depth: Number(gf.depth || 8),
                    x1: Math.round(m1.x * 10) / 10,
                    y1: Math.round(m1.y * 10) / 10,
                    x2: Math.round(m2.x * 10) / 10,
                    y2: Math.round(m2.y * 10) / 10,
                    isBack: normalizeFaceName(gf.face) === 'FACE_Z_MINUS',
                    purpose: gf.purpose || 'GENERIC'
                });
            } else if ('points' in f && Array.isArray((f as any).points)) {
                const cf = f as any;
                const pts = cf.points.map((pt: any) => {
                    const m = mapToDxf(pt);
                    return [m.x, m.y];
                }) as Array<[number, number]>;
                const minX = Math.min(...pts.map(p => p[0]));
                const maxX = Math.max(...pts.map(p => p[0]));
                const minY = Math.min(...pts.map(p => p[1]));
                const maxY = Math.max(...pts.map(p => p[1]));
                const widthMm = maxX - minX;
                const heightMm = maxY - minY;
                const depth = Number(cf.depth || T);
                const isThrough = Boolean(cf.isInnerContour || depth >= T - 0.51);
                const isRewizja = String(cf.featureId || '').toLowerCase().includes('rewizja');
                const name = isRewizja
                    ? 'Wycięcie'
                    : (cf.name ? String(cf.name) : 'Wycięcie');

                cutouts.push({
                    id: cf.featureId || `cutout_${cutouts.length + 1}`,
                    name,
                    x: Math.round(minX * 10) / 10,
                    y: Math.round(minY * 10) / 10,
                    width: Math.round(widthMm * 10) / 10,
                    height: Math.round(heightMm * 10) / 10,
                    depth,
                    isThrough,
                    points: pts
                });
            }
        }
    } else {
        // Fallback dla formatek bez WCS
        const rotateFlatSide = isSide && rawW < rawH;
        const rawFeatures = Array.isArray(p?.features) ? p.features : [];
        let holeIdx = 1;
        for (const feat of rawFeatures) {
            const featType = (feat.type || '').toLowerCase();
            const params = feat.params || {};

            if (featType === 'hole' || featType === 'drill') {
                const diameter = Number(params.diameter ?? params.dia ?? 8);
                const depth = Number(params.depth ?? 12);
                const rawU = Number(params.u !== undefined ? params.u : (params.u_nm ? nmToMm(params.u_nm) : 0));
                const rawV = Number(params.v !== undefined ? params.v : (params.v_nm ? nmToMm(params.v_nm) : 0));
                const drawX = rotateFlatSide ? rawV : rawU;
                const drawY = rotateFlatSide ? rawU : rawV;
                const isThrough = Boolean(params.through || depth >= T - 0.51);
                const normFace = normalizeFaceName(feat.face || 'FACE_Z_PLUS');
                holes.push({
                    id: feat.id || `hole_${holeIdx}`,
                    index: holeIdx++,
                    x: Math.round(drawX * 10) / 10,
                    y: Math.round(drawY * 10) / 10,
                    diameter,
                    depth,
                    isThrough,
                    face: normFace,
                    isBack: normFace === 'FACE_Z_MINUS',
                    isEdge: String(feat.face || '').includes('FACE_X') || String(feat.face || '').includes('FACE_Y'),
                    label: isThrough ? `⌀${diameter}` : `⌀${diameter}×${depth}`
                });
            } else if (featType === 'groove' || featType === 'nut') {
                const gp = getGrooveParamsMm(params);
                const u1 = gp.u;
                const v1 = gp.v;
                const u2 = gp.u + (gp.width > 0 ? gp.length : 0);
                const v2 = gp.v + (gp.width > 0 ? 0 : gp.length);
                grooves.push({
                    id: feat.id || `groove_${grooves.length + 1}`,
                    width: Number(gp.width || 4),
                    depth: Number(gp.depth || 8),
                    x1: Math.round((rotateFlatSide ? v1 : u1) * 10) / 10,
                    y1: Math.round((rotateFlatSide ? u1 : v1) * 10) / 10,
                    x2: Math.round((rotateFlatSide ? v2 : u2) * 10) / 10,
                    y2: Math.round((rotateFlatSide ? u2 : v2) * 10) / 10,
                    isBack: normalizeFaceName(feat.face) === 'FACE_Z_MINUS',
                    purpose: feat.purpose || 'GENERIC'
                });
            } else if (featType === 'cutout' || featType === 'pocket' || featType === 'rewizja') {
                const rawWidthMm = Number(params.width || params.w || 120);
                const rawHeightMm = Number(params.length || params.height || params.h || 80);
                const rawCutU = Number(params.u !== undefined ? params.u : (params.u_ref ?? 100));
                const rawCutV = Number(params.v !== undefined ? params.v : (params.v_ref ?? 80));
                const cutX = rotateFlatSide ? rawCutV : rawCutU;
                const cutY = rotateFlatSide ? rawCutU : rawCutV;
                const widthMm = rotateFlatSide ? rawHeightMm : rawWidthMm;
                const heightMm = rotateFlatSide ? rawWidthMm : rawHeightMm;
                const depth = Number(params.depth || T);
                const isThrough = Boolean(params.through || (params as any).kind === 'THROUGH' || depth >= T - 0.51);
                cutouts.push({
                    id: feat.id || `cutout_${cutouts.length + 1}`,
                    name: 'Wycięcie',
                    x: Math.round(cutX * 10) / 10,
                    y: Math.round(cutY * 10) / 10,
                    width: Math.round(widthMm * 10) / 10,
                    height: Math.round(heightMm * 10) / 10,
                    depth,
                    isThrough,
                    points: [
                        [cutX, cutY],
                        [cutX + widthMm, cutY],
                        [cutX + widthMm, cutY + heightMm],
                        [cutX, cutY + heightMm]
                    ]
                });
            }
        }
    }

    // Obrys formatki w układzie rysunku (z WCS identyczny jak w DXF, czyli dla boków leży PŁASKO)
    const { outline } = resolvePanelOutline2D(panel, rawW, rawH, rawT);
    let finalOutline: Array<[number, number]>;
    if (wcs && outline && outline.length >= 3) {
        finalOutline = outline.map(([u, v]) => {
            const ptWcs = wcs!.toWcsCoordinates({ x: -rawW / 2 + u, y: -rawH / 2 + v, z: rawT / 2 });
            const m = mapToDxf(ptWcs);
            return [Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10];
        });
        W = dxfSpanW;
        H = dxfSpanH;
    } else if (isSide && rawW < rawH && outline && outline.length >= 3) {
        finalOutline = outline.map(([u, v]) => [Math.round(v * 10) / 10, Math.round(u * 10) / 10]);
    } else {
        finalOutline = (outline && outline.length >= 3)
            ? outline.map(([u, v]) => [Math.round(u * 10) / 10, Math.round(v * 10) / 10])
            : [[0, 0], [W, 0], [W, H], [0, H]];
    }

    // Okleinowanie krawędzi (SSOT: panel.edgeBanding / custom_properties.edge_banding)
    // Gdy bok korpusu leży PŁASKO (W = długość/wysokość, H = głębokość):
    // - Y=0 (dolna krawędź rysunku, '-Y') = PRZÓD
    // - Y=H (górna krawędź rysunku, '+Y') = TYŁ
    // - X=0 (lewa krawędź rysunku, '-X') = DÓŁ
    // - X=W (prawa krawędź rysunku, '+X') = GÓRA
    const eb = p?.edgeBanding || p?.custom_properties?.edge_banding || {};
    const getEb = (k: '+X' | '-X' | '+Y' | '-Y') => {
        const faceMap: Record<'+X' | '-X' | '+Y' | '-Y', string> = {
            '+X': 'FACE_X_PLUS',
            '-X': 'FACE_X_MINUS',
            '+Y': 'FACE_Y_PLUS',
            '-Y': 'FACE_Y_MINUS',
        };
        return eb[k] ?? eb[faceMap[k]];
    };

    const roleUpper = role.toUpperCase();
    const isLeftSide = roleUpper === 'LEFT_SIDE_PANEL' || roleUpper === 'BOK_L' || roleUpper === 'DOL_BOK_L' || roleUpper === 'GOR_BOK_L' || roleUpper === 'SIDE_LEFT';

    let ebMapByDrawEdge: Record<'-X' | '+X' | '-Y' | '+Y', any>;
    if (wcs) {
        const edgeCenters: Array<{ localKey: '+X' | '-X' | '+Y' | '-Y'; pt: { x: number; y: number; z: number } }> = [
            { localKey: '+X', pt: { x: rawW / 2, y: 0, z: 0 } },
            { localKey: '-X', pt: { x: -rawW / 2, y: 0, z: 0 } },
            { localKey: '+Y', pt: { x: 0, y: rawH / 2, z: 0 } },
            { localKey: '-Y', pt: { x: 0, y: -rawH / 2, z: 0 } },
        ];
        const resolved: Partial<Record<'-X' | '+X' | '-Y' | '+Y', any>> = {};
        for (const item of edgeCenters) {
            const m = mapToDxf(wcs.toWcsCoordinates(item.pt));
            const cfg = getEb(item.localKey);
            if (Math.abs(m.x) <= 1 && Math.abs(m.y - H / 2) <= H * 0.4) resolved['-X'] = cfg;
            else if (Math.abs(m.x - W) <= 1 && Math.abs(m.y - H / 2) <= H * 0.4) resolved['+X'] = cfg;
            else if (Math.abs(m.y) <= 1 && Math.abs(m.x - W / 2) <= W * 0.4) resolved['-Y'] = cfg;
            else if (Math.abs(m.y - H) <= 1 && Math.abs(m.x - W / 2) <= W * 0.4) resolved['+Y'] = cfg;
        }
        ebMapByDrawEdge = {
            '-X': resolved['-X'] ?? getEb('-Y'),
            '+X': resolved['+X'] ?? getEb('+Y'),
            '-Y': resolved['-Y'] ?? (isSide ? (isLeftSide ? getEb('+X') : getEb('-X')) : getEb('-Y')),
            '+Y': resolved['+Y'] ?? (isSide ? (isLeftSide ? getEb('-X') : getEb('+X')) : getEb('+Y')),
        };
    } else if (isSide) {
        ebMapByDrawEdge = {
            '-X': getEb('-Y'),
            '+X': getEb('+Y'),
            '-Y': isLeftSide ? getEb('+X') : getEb('-X'),
            '+Y': isLeftSide ? getEb('-X') : getEb('+X'),
        };
    } else {
        ebMapByDrawEdge = {
            '-X': getEb('-X'),
            '+X': getEb('+X'),
            '-Y': getEb('-Y'),
            '+Y': getEb('+Y'),
        };
    }

    const buildEdgeItem = (edgeKey: '-X' | '+X' | '-Y' | '+Y', label: string, lengthMm: number, cfg: any): PanelEdgePreviewItem => {
        const active = isEdgeBandingActive(cfg);
        const thicknessMm = active ? resolveEdgeThicknessMm(cfg) : 0;
        return {
            edgeKey,
            label,
            lengthMm,
            active,
            name: cfg?.name || (active ? `ABS ${thicknessMm} mm` : 'Brak'),
            thicknessMm,
            colorHex: resolveEdgeColor(thicknessMm)
        };
    };

    const edges: PanelEdgePreviewItem[] = isSide ? [
        buildEdgeItem('-X', 'Dół', H, ebMapByDrawEdge['-X']),
        buildEdgeItem('+X', 'Góra', H, ebMapByDrawEdge['+X']),
        buildEdgeItem('-Y', 'Przód', W, ebMapByDrawEdge['-Y']),
        buildEdgeItem('+Y', 'Tył', W, ebMapByDrawEdge['+Y']),
    ] : [
        buildEdgeItem('-X', 'Lewa (-X)', H, ebMapByDrawEdge['-X']),
        buildEdgeItem('+X', 'Prawa (+X)', H, ebMapByDrawEdge['+X']),
        buildEdgeItem('-Y', 'Dolna (-Y)', W, ebMapByDrawEdge['-Y']),
        buildEdgeItem('+Y', 'Górna (+Y)', W, ebMapByDrawEdge['+Y']),
    ];

    const rawName = p?.name ?? panel?.name;
    const fallbackId = p?.id ?? panel?.id ?? 'formatka';
    const panelName = rawName || fallbackId;
    const safeName = panelName.replace(/[^a-zA-Z0-9_\-\u00C0-\u017F]/g, '_');
    const dxfFilename = `${safeName}.dxf`;
    const dxfContent = generatePanelDxf(panel, { fileName: dxfFilename, includeDimensions: true });

    return {
        id: String(p?.id || panel?.id || 'panel'),
        name: panelName,
        role,
        isSidePanel: isSide,
        containerName: containerName || p?.parentContainerName || '',
        dimensions: { width: W, height: H, thickness: T },
        materialName: p?.materialId || p?.material || 'Płyta laminowana 18mm',
        wcsName: 'WCS',
        wcsOriginLabel: originLabel,
        dxfWidth: W,
        dxfHeight: H,
        dxfThickness: T,
        outline: finalOutline,
        holes,
        grooves,
        cutouts,
        edges,
        dxfContent,
        dxfFilename
    };
}

function resolveEdgeThicknessMm(edgeCfg: any): number {
    if (!edgeCfg || edgeCfg.active === false) return 0;
    const typeId = String(edgeCfg.type_id || '').trim();
    if (typeId.toLowerCase() === 'none') return 0;
    if (typeof edgeCfg.thickness_mm === 'number' && Number.isFinite(edgeCfg.thickness_mm) && edgeCfg.thickness_mm > 0) {
        return edgeCfg.thickness_mm;
    }
    const lower = typeId.toLowerCase();
    // Legacy format reguł korpusów (np. "0.008x0.022" -> 0.8 mm, "0.002x0.022" -> 2.0 mm)
    if (lower.startsWith('0.008')) return 0.8;
    if (lower.startsWith('0.004')) return 0.4;
    if (lower.startsWith('0.002') || lower.startsWith('0.02')) return 2.0;
    if (lower.startsWith('0.001') || lower.startsWith('0.01')) return 1.0;
    const match = lower.match(/(\d+(?:[.,]\d+)?)/);
    if (match) {
        const parsed = parseFloat(match[1].replace(',', '.'));
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return edgeCfg.active === true ? 0.8 : 0;
}

function isEdgeBandingActive(edgeCfg: any): boolean {
    if (!edgeCfg || edgeCfg.active === false) return false;
    const typeId = String(edgeCfg.type_id || '').trim().toLowerCase();
    if (typeId === 'none') return false;
    if (edgeCfg.active === true) return true;
    return resolveEdgeThicknessMm(edgeCfg) > 0;
}

function resolveEdgeColor(thicknessMm?: number): string {
    const t = Number(thicknessMm || 0);
    if (t >= 1.8) return '#d97706'; // Bursztynowy / pomarańczowy dla 2mm
    if (t >= 0.9) return '#0284c7'; // Błękit techniczny dla 1mm
    if (t > 0.1) return '#059669';  // Szmaragdowy dla 0.4-0.8mm
    return '#64748b';               // Szary gdy brak
}

interface DimPlacement {
    val: number;
    tier: number;
    textAfterArrow: boolean;
}

/**
 * Przydziela liniom wymiarowym kolejne poziomy odsunięcia (tory) tak,
 * aby żadne teksty wymiarowe na tym samym torze nie zachodziły na siebie.
 */
function packDimensionTiers(
    values: number[],
    panelSpan: number,
    fontPx: number,
    sqrtScale: number
): { placements: DimPlacement[]; tierCount: number } {
    const valid = values.filter(v => v > 0 && v < panelSpan);
    const lanes: Array<Array<[number, number]>> = [];
    const pad = 10 * sqrtScale;

    const placements: DimPlacement[] = valid.map(val => {
        const label = String(val);
        const textSpan = Math.max(24 * sqrtScale, label.length * fontPx * 0.68 + 8 * sqrtScale);
        const textAfterArrow = val < textSpan + 12 * sqrtScale;

        const minSpan = textAfterArrow ? (val - 4 * sqrtScale) : (val - 6 * sqrtScale - textSpan);
        const maxSpan = textAfterArrow ? (val + 6 * sqrtScale + textSpan) : (val + 4 * sqrtScale);

        let chosenTier = 0;
        while (true) {
            if (!lanes[chosenTier]) lanes[chosenTier] = [];
            const overlaps = lanes[chosenTier].some(([a, b]) => !(maxSpan + pad <= a || minSpan - pad >= b));
            if (!overlaps) {
                lanes[chosenTier].push([minSpan, maxSpan]);
                break;
            }
            chosenTier++;
        }

        return { val, tier: chosenTier, textAfterArrow };
    });

    return { placements, tierCount: Math.max(1, lanes.length) };
}

interface LabelBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

function boxesOverlap(a: LabelBox, b: LabelBox, pad: number = 2): boolean {
    return !(a.x2 + pad <= b.x1 || a.x1 - pad >= b.x2 || a.y2 + pad <= b.y1 || a.y1 - pad >= b.y2);
}

/**
 * Renderuje rzut wektorowy SVG formatki w standardzie profesjonalnego rysunku technicznego:
 * - Zewnętrzna przerywana linia równoległa dla okleinowania krawędzi
 * - Automatyczne rozsunięcie torów wymiarowych eliminujące nakładanie tekstów
 * - Wymiarowanie otworów przy grocie strzałki (standard ISO)
 * - Czysty symbol bazy odniesienia (0, 0)
 */
export function renderPanelSvg(data: PanelPreviewData): string {
    const W = data.dxfWidth;
    const H = data.dxfHeight;
    const maxDim = Math.max(W, H);

    const scaleFactor = Math.max(1, maxDim / 650);
    const sqrtScale = Math.sqrt(scaleFactor);

    const fontGabaryt = Math.round(Math.max(13, 12 * sqrtScale));
    const fontHoleDim = Math.round(Math.max(11, 10 * sqrtScale));
    const fontHoleLabel = Math.round(Math.max(10, 9.5 * sqrtScale));
    const fontEdge = Math.round(Math.max(11, 10 * sqrtScale));

    // Strefa zewnętrznego oznaczenia obrzeża (linia przerywana + napis na zewnątrz obrysu)
    const edgeOffset = Math.max(6, Math.round(6 * sqrtScale));
    const edgeZone = edgeOffset + fontEdge + Math.round(10 * sqrtScale);

    // Wstępne wyliczenie torów wymiarowych X i Y, aby marginesy arkusza mieściły wszystkie linie
    const allXCoords = [
        ...data.holes.map(h => Math.round(h.x * 10) / 10),
        ...data.cutouts.flatMap(c => [Math.round(c.x * 10) / 10, Math.round((c.x + c.width) * 10) / 10])
    ];
    const uniqueXs = Array.from(new Set(allXCoords)).sort((a, b) => a - b);
    const xPack = packDimensionTiers(uniqueXs, W, fontHoleDim, sqrtScale);

    const allYCoords = [
        ...data.holes.map(h => Math.round(h.y * 10) / 10),
        ...data.cutouts.flatMap(c => [Math.round(c.y * 10) / 10, Math.round((c.y + c.height) * 10) / 10])
    ];
    const uniqueYs = Array.from(new Set(allYCoords)).sort((a, b) => a - b);
    const yPack = packDimensionTiers(uniqueYs, H, fontHoleDim, sqrtScale);

    const baseDimStartY = edgeZone + Math.round(Math.max(20, 18 * sqrtScale));
    const tierStepY = Math.round(Math.max(24, fontHoleDim * 1.9));
    const dimGabarytBottom = baseDimStartY + xPack.tierCount * tierStepY + Math.round(Math.max(22, 18 * sqrtScale));

    const baseDimStartX = Math.max(edgeZone + Math.round(Math.max(20, 18 * sqrtScale)), Math.round(Math.max(52, 46 * sqrtScale)));
    const tierStepX = Math.round(Math.max(24, fontHoleDim * 1.8));
    const dimGabarytLeft = baseDimStartX + yPack.tierCount * tierStepX + Math.round(Math.max(24, 20 * sqrtScale));

    const marginX_left = dimGabarytLeft + Math.round(Math.max(36, 30 * sqrtScale));
    const marginX_right = edgeZone + Math.round(Math.max(28, 24 * sqrtScale));
    const marginY_bottom = dimGabarytBottom + Math.round(Math.max(36, 30 * sqrtScale));
    const marginY_top = edgeZone + Math.round(Math.max(28, 24 * sqrtScale));

    const svgW = W + marginX_left + marginX_right;
    const svgH = H + marginY_bottom + marginY_top;

    const toSvgX = (x: number) => marginX_left + x;
    const toSvgY = (y: number) => marginY_top + (H - y);

    const parts: string[] = [];

    parts.push(`
        <defs>
            <style>
                .tech-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace; font-weight: 700; }
                .tech-dim { fill: #0369a1; }
                .tech-line { stroke: #0284c7; stroke-width: ${Math.max(0.9, 0.8 * sqrtScale)}; }
                .tech-ext { stroke: #94a3b8; stroke-width: ${Math.max(0.6, 0.5 * sqrtScale)}; stroke-dasharray: 3 3; }
                .tech-halo { stroke: #ffffff; stroke-width: ${Math.max(3.5, 3 * sqrtScale)}; paint-order: stroke fill; stroke-linejoin: round; }
            </style>
            <pattern id="grid_${data.id}" width="${Math.max(20, Math.round(20 * sqrtScale))}" height="${Math.max(20, Math.round(20 * sqrtScale))}" patternUnits="userSpaceOnUse">
                <path d="M ${Math.max(20, Math.round(20 * sqrtScale))} 0 L 0 0 0 ${Math.max(20, Math.round(20 * sqrtScale))}" fill="none" stroke="#f1f5f9" stroke-width="0.8"/>
            </pattern>
            <marker id="arr_${data.id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="${Math.max(6, 5 * sqrtScale)}" markerHeight="${Math.max(6, 5 * sqrtScale)}" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="#0284c7" />
            </marker>
            <marker id="arr_red_${data.id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="${Math.max(6, 5 * sqrtScale)}" markerHeight="${Math.max(6, 5 * sqrtScale)}" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="#dc2626" />
            </marker>
            <marker id="arr_x_${data.id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="#dc2626" />
            </marker>
            <marker id="arr_y_${data.id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="#16a34a" />
            </marker>
        </defs>

        <!-- Tło arkusza rysunkowego -->
        <rect width="${svgW}" height="${svgH}" fill="#ffffff" />
        <rect x="${marginX_left}" y="${marginY_top}" width="${W}" height="${H}" fill="url(#grid_${data.id})" />

        <!-- Ramka zewnętrzna arkusza technicznego -->
        <rect x="6" y="6" width="${svgW - 12}" height="${svgH - 12}" fill="none" stroke="#cbd5e1" stroke-width="1.0" />
    `);

    // 1. Obrys formatki
    const outlinePts = data.outline.map(([x, y]) => `${toSvgX(x)},${toSvgY(y)}`).join(' ');
    parts.push(`
        <!-- OBRYS FORMATKI -->
        <polygon points="${outlinePts}" fill="#f8fafc" stroke="#0f172a" stroke-width="${Math.max(1.8, 1.6 * sqrtScale)}" />
    `);

    // 2. Okleinowanie krawędzi (linia przerywana równoległa NA ZEWNĄTRZ krawędzi formatki)
    const edgeDash = `${Math.round(10 * sqrtScale)} ${Math.round(5 * sqrtScale)}`;
    const edgeStrokeW = Math.max(2, 1.8 * sqrtScale);

    // Dolna krawędź (-Y) / PRZÓD dla boków
    const eBottom = data.edges.find(e => e.edgeKey === '-Y');
    if (eBottom?.active && eBottom.thicknessMm > 0) {
        parts.push(`
            <line data-edge-banding="-Y" x1="${toSvgX(0)}" y1="${toSvgY(-edgeOffset)}" x2="${toSvgX(W)}" y2="${toSvgY(-edgeOffset)}" 
                  stroke="${eBottom.colorHex}" stroke-width="${edgeStrokeW}" stroke-dasharray="${edgeDash}" />
            <text x="${toSvgX(W / 2)}" y="${toSvgY(-edgeOffset) + fontEdge + 2}" fill="${eBottom.colorHex}" font-size="${fontEdge}" class="tech-text tech-halo" text-anchor="middle">
                ${data.isSidePanel ? 'PRZÓD: ' : ''}ABS ${eBottom.thicknessMm} mm
            </text>
        `);
    }

    // Górna krawędź (+Y) / TYŁ dla boków
    const eTop = data.edges.find(e => e.edgeKey === '+Y');
    if (eTop?.active && eTop.thicknessMm > 0) {
        parts.push(`
            <line data-edge-banding="+Y" x1="${toSvgX(0)}" y1="${toSvgY(H + edgeOffset)}" x2="${toSvgX(W)}" y2="${toSvgY(H + edgeOffset)}" 
                  stroke="${eTop.colorHex}" stroke-width="${edgeStrokeW}" stroke-dasharray="${edgeDash}" />
            <text x="${toSvgX(W / 2)}" y="${toSvgY(H + edgeOffset) - 4}" fill="${eTop.colorHex}" font-size="${fontEdge}" class="tech-text tech-halo" text-anchor="middle">
                ${data.isSidePanel ? 'TYŁ: ' : ''}ABS ${eTop.thicknessMm} mm
            </text>
        `);
    }

    // Lewa krawędź (-X) / DÓŁ dla boków
    const eLeft = data.edges.find(e => e.edgeKey === '-X');
    if (eLeft?.active && eLeft.thicknessMm > 0) {
        const leftTextX = toSvgX(-edgeOffset) - 5;
        const leftTextY = toSvgY(H / 2);
        parts.push(`
            <line data-edge-banding="-X" x1="${toSvgX(-edgeOffset)}" y1="${toSvgY(0)}" x2="${toSvgX(-edgeOffset)}" y2="${toSvgY(H)}" 
                  stroke="${eLeft.colorHex}" stroke-width="${edgeStrokeW}" stroke-dasharray="${edgeDash}" />
            <text x="${leftTextX}" y="${leftTextY}" fill="${eLeft.colorHex}" font-size="${fontEdge}" class="tech-text tech-halo" text-anchor="middle" transform="rotate(-90 ${leftTextX} ${leftTextY})">
                ${data.isSidePanel ? 'DÓŁ: ' : ''}ABS ${eLeft.thicknessMm} mm
            </text>
        `);
    }

    // Prawa krawędź (+X) / GÓRA dla boków
    const eRight = data.edges.find(e => e.edgeKey === '+X');
    if (eRight?.active && eRight.thicknessMm > 0) {
        const rightTextX = toSvgX(W + edgeOffset) + 5;
        const rightTextY = toSvgY(H / 2);
        parts.push(`
            <line data-edge-banding="+X" x1="${toSvgX(W + edgeOffset)}" y1="${toSvgY(0)}" x2="${toSvgX(W + edgeOffset)}" y2="${toSvgY(H)}" 
                  stroke="${eRight.colorHex}" stroke-width="${edgeStrokeW}" stroke-dasharray="${edgeDash}" />
            <text x="${rightTextX}" y="${rightTextY}" fill="${eRight.colorHex}" font-size="${fontEdge}" class="tech-text tech-halo" text-anchor="middle" transform="rotate(90 ${rightTextX} ${rightTextY})">
                ${data.isSidePanel ? 'GÓRA: ' : ''}ABS ${eRight.thicknessMm} mm
            </text>
        `);
    }

    // 3. Wymiary gabarytowe formatki (odsunięte poza wszystkie tory wymiarowe i obrzeża)
    parts.push(`
        <!-- Wymiar gabarytowy poziomy -->
        <g>
            <line x1="${toSvgX(0)}" y1="${toSvgY(0)}" x2="${toSvgX(0)}" y2="${toSvgY(-dimGabarytBottom)}" class="tech-ext" />
            <line x1="${toSvgX(W)}" y1="${toSvgY(0)}" x2="${toSvgX(W)}" y2="${toSvgY(-dimGabarytBottom)}" class="tech-ext" />
            <line x1="${toSvgX(0)}" y1="${toSvgY(-dimGabarytBottom)}" x2="${toSvgX(W)}" y2="${toSvgY(-dimGabarytBottom)}" 
                  class="tech-line" marker-start="url(#arr_${data.id})" marker-end="url(#arr_${data.id})" />
            <text x="${toSvgX(W / 2)}" y="${toSvgY(-dimGabarytBottom) - 5}" class="tech-text tech-dim tech-halo" font-size="${fontGabaryt}" text-anchor="middle">
                ${W} mm
            </text>
        </g>
    `);

    parts.push(`
        <!-- Wymiar gabarytowy pionowy -->
        <g>
            <line x1="${toSvgX(0)}" y1="${toSvgY(0)}" x2="${toSvgX(-dimGabarytLeft)}" y2="${toSvgY(0)}" class="tech-ext" />
            <line x1="${toSvgX(0)}" y1="${toSvgY(H)}" x2="${toSvgX(-dimGabarytLeft)}" y2="${toSvgY(H)}" class="tech-ext" />
            <line x1="${toSvgX(-dimGabarytLeft)}" y1="${toSvgY(0)}" x2="${toSvgX(-dimGabarytLeft)}" y2="${toSvgY(H)}" 
                  class="tech-line" marker-start="url(#arr_${data.id})" marker-end="url(#arr_${data.id})" />
            <text x="${toSvgX(-dimGabarytLeft) - 6}" y="${toSvgY(H / 2)}" class="tech-text tech-dim tech-halo" font-size="${fontGabaryt}" text-anchor="middle" transform="rotate(-90 ${toSvgX(-dimGabarytLeft) - 6} ${toSvgY(H / 2)})">
                ${H} mm
            </text>
        </g>
    `);

    const placedLabelBoxes: LabelBox[] = [];

    // 4. Rowki / Nuty
    for (const g of data.grooves) {
        const gx1 = toSvgX(g.x1);
        const gy1 = toSvgY(g.y1);
        const gx2 = toSvgX(g.x2);
        const gy2 = toSvgY(g.y2);
        const gLabel = `Nuta ${g.width}×${g.depth} mm ${g.isBack ? '(SPÓD)' : ''}`.trim();
        const lw = gLabel.length * fontHoleLabel * 0.62;
        const lx = (gx1 + gx2) / 2;
        const ly = (gy1 + gy2) / 2 - 6;
        placedLabelBoxes.push({ x1: lx - lw / 2, y1: ly - fontHoleLabel, x2: lx + lw / 2, y2: ly + 2 });
        parts.push(`
            <line x1="${gx1}" y1="${gy1}" x2="${gx2}" y2="${gy2}" stroke="#ea580c" stroke-width="${Math.max(g.width, 3)}" stroke-linecap="round" stroke-dasharray="${g.isBack ? '6 3' : 'none'}" />
            <text x="${lx}" y="${ly}" fill="#ea580c" font-size="${fontHoleLabel}" class="tech-text tech-halo" text-anchor="middle">
                ${gLabel}
            </text>
        `);
    }

    // 5. WYCIĘCIA — ZWYMIAROWANIE TECHNICZNE BEZ OPISÓW SŁOWNYCH
    for (const c of data.cutouts) {
        const cx = toSvgX(c.x);
        const cy = toSvgY(c.y + c.height); // W SVG Y idzie w dół, więc lewy-górny róg to y + height
        const cw = c.width;
        const ch = c.height;

        // Jeśli wycięcie leży blisko górnej/prawej krawędzi, wymiar rysujemy do wewnątrz lub po przeciwnej stronie, aby nie kolidował z obrzeżem
        const putWBelow = c.y + ch + 18 * sqrtScale > H && c.y > 18 * sqrtScale;
        const dimWY = putWBelow ? (c.y - 10 * sqrtScale) : (c.y + ch + 10 * sqrtScale);
        const extWY = putWBelow ? (c.y - 14 * sqrtScale) : (c.y + ch + 14 * sqrtScale);
        const baseWY = putWBelow ? c.y : (c.y + ch);
        const wTextY = putWBelow ? (toSvgY(dimWY) + fontHoleDim + 2) : (toSvgY(dimWY) - 3);

        const putHLeft = c.x + cw + 24 * sqrtScale > W && c.x > 24 * sqrtScale;
        const dimHX = putHLeft ? (c.x - 10 * sqrtScale) : (c.x + cw + 10 * sqrtScale);
        const extHX = putHLeft ? (c.x - 14 * sqrtScale) : (c.x + cw + 14 * sqrtScale);
        const baseHX = putHLeft ? c.x : (c.x + cw);
        const hTextX = putHLeft ? (toSvgX(dimHX) - 4) : (toSvgX(dimHX) + 4);
        const hAnchor = putHLeft ? 'end' : 'start';

        const cwW = String(cw).length * fontHoleDim * 0.68;
        placedLabelBoxes.push({ x1: toSvgX(c.x + cw / 2) - cwW / 2, y1: wTextY - fontHoleDim, x2: toSvgX(c.x + cw / 2) + cwW / 2, y2: wTextY + 2 });
        const chW = String(ch).length * fontHoleDim * 0.68;
        const chY = toSvgY(c.y + ch / 2) + 4;
        placedLabelBoxes.push({
            x1: putHLeft ? hTextX - chW : hTextX,
            y1: chY - fontHoleDim,
            x2: putHLeft ? hTextX : hTextX + chW,
            y2: chY + 2
        });

        parts.push(`
            <!-- Obrys wycięcia -->
            <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" 
                  fill="rgba(239, 68, 68, 0.12)" stroke="#dc2626" stroke-width="${Math.max(1.6, 1.4 * sqrtScale)}" stroke-dasharray="4 2" />

            <!-- Wymiar szerokości wycięcia (W) -->
            <line x1="${toSvgX(c.x)}" y1="${toSvgY(baseWY)}" x2="${toSvgX(c.x)}" y2="${toSvgY(extWY)}" class="tech-ext" />
            <line x1="${toSvgX(c.x + cw)}" y1="${toSvgY(baseWY)}" x2="${toSvgX(c.x + cw)}" y2="${toSvgY(extWY)}" class="tech-ext" />
            <line x1="${toSvgX(c.x)}" y1="${toSvgY(dimWY)}" x2="${toSvgX(c.x + cw)}" y2="${toSvgY(dimWY)}" 
                  class="tech-line" marker-start="url(#arr_red_${data.id})" marker-end="url(#arr_red_${data.id})" />
            <text x="${toSvgX(c.x + cw / 2)}" y="${wTextY}" fill="#dc2626" font-size="${fontHoleDim}" class="tech-text tech-halo" text-anchor="middle">
                ${cw}
            </text>

            <!-- Wymiar wysokości wycięcia (H) -->
            <line x1="${toSvgX(baseHX)}" y1="${toSvgY(c.y)}" x2="${toSvgX(extHX)}" y2="${toSvgY(c.y)}" class="tech-ext" />
            <line x1="${toSvgX(baseHX)}" y1="${toSvgY(c.y + ch)}" x2="${toSvgX(extHX)}" y2="${toSvgY(c.y + ch)}" class="tech-ext" />
            <line x1="${toSvgX(dimHX)}" y1="${toSvgY(c.y)}" x2="${toSvgX(dimHX)}" y2="${toSvgY(c.y + ch)}" 
                  class="tech-line" marker-start="url(#arr_red_${data.id})" marker-end="url(#arr_red_${data.id})" />
            <text x="${hTextX}" y="${chY}" fill="#dc2626" font-size="${fontHoleDim}" class="tech-text tech-halo" text-anchor="${hAnchor}">
                ${ch}
            </text>
        `);
    }

    // 6. Otwory (z unikaniem kolizji etykiet między blisko położonymi otworami)
    for (const h of data.holes) {
        const sx = toSvgX(h.x);
        const sy = toSvgY(h.y);
        const r = Math.max(h.diameter / 2, 2.5);
        const crossLen = Math.max(r + 3, (r + 2) * sqrtScale);
        const holeColor = h.isBack ? '#9333ea' : (h.isThrough ? '#dc2626' : '#059669');
        const holeLabelText = `${h.isThrough ? `⌀${h.diameter}` : `⌀${h.diameter}×${h.depth}`}${h.isBack ? ' (SPÓD)' : ''}`;
        const labelW = Math.max(24, holeLabelText.length * fontHoleLabel * 0.65);
        const labelH = fontHoleLabel * 1.1;

        const candidates: Array<{ x: number; y: number; anchor: 'start' | 'middle' | 'end'; box: LabelBox }> = [
            {
                x: sx + r + 4, y: sy + 4, anchor: 'start',
                box: { x1: sx + r + 4, y1: sy + 4 - labelH, x2: sx + r + 4 + labelW, y2: sy + 6 }
            },
            {
                x: sx, y: sy - r - 5, anchor: 'middle',
                box: { x1: sx - labelW / 2, y1: sy - r - 5 - labelH, x2: sx + labelW / 2, y2: sy - r - 3 }
            },
            {
                x: sx, y: sy + r + fontHoleLabel + 3, anchor: 'middle',
                box: { x1: sx - labelW / 2, y1: sy + r + 3, x2: sx + labelW / 2, y2: sy + r + fontHoleLabel + 5 }
            },
            {
                x: sx - r - 4, y: sy + 4, anchor: 'end',
                box: { x1: sx - r - 4 - labelW, y1: sy + 4 - labelH, x2: sx - r - 4, y2: sy + 6 }
            },
            {
                x: sx + r + 4, y: sy - labelH - 2, anchor: 'start',
                box: { x1: sx + r + 4, y1: sy - labelH * 2 - 2, x2: sx + r + 4 + labelW, y2: sy - labelH }
            },
            {
                x: sx + r + 4, y: sy + labelH + 6, anchor: 'start',
                box: { x1: sx + r + 4, y1: sy + 6, x2: sx + r + 4 + labelW, y2: sy + labelH + 8 }
            },
        ];

        const chosen = candidates.find(c => !placedLabelBoxes.some(b => boxesOverlap(b, c.box, 3))) || candidates[0];
        placedLabelBoxes.push(chosen.box);

        parts.push(`
            <!-- Otwór: ${h.label} na (${h.x}, ${h.y}) -->
            <circle cx="${sx}" cy="${sy}" r="${r}" fill="${holeColor}" fill-opacity="${h.isBack ? '0.15' : '0.25'}" stroke="${holeColor}" stroke-width="${Math.max(1.2, 1.0 * sqrtScale)}" stroke-dasharray="${h.isBack ? '3 2' : 'none'}" />
            <line x1="${sx - crossLen}" y1="${sy}" x2="${sx + crossLen}" y2="${sy}" stroke="#64748b" stroke-width="0.6" />
            <line x1="${sx}" y1="${sy - crossLen}" x2="${sx}" y2="${sy + crossLen}" stroke="#64748b" stroke-width="0.6" />
            <text x="${chosen.x}" y="${chosen.y}" fill="${holeColor}" font-size="${fontHoleLabel}" class="tech-text tech-halo" text-anchor="${chosen.anchor}">
                ${holeLabelText}
            </text>
        `);
    }

    // 7. Wymiarowanie bazowe od punktu odniesienia (0, 0) — tory bez nakładania tekstów
    xPack.placements.forEach(({ val: xVal, tier, textAfterArrow }) => {
        const matchingHoles = data.holes.filter(h => Math.abs(h.x - xVal) < 0.2);
        const matchingCutouts = data.cutouts.filter(c => Math.abs(c.x - xVal) < 0.2 || Math.abs(c.x + c.width - xVal) < 0.2);
        const minYFromHoles = matchingHoles.length > 0 ? Math.min(...matchingHoles.map(h => h.y)) : Infinity;
        const minYFromCutouts = matchingCutouts.length > 0 ? Math.min(...matchingCutouts.map(c => c.y)) : Infinity;
        const minY = Math.min(minYFromHoles, minYFromCutouts);
        const validMinY = Number.isFinite(minY) ? minY : 0;

        const lineY = -(baseDimStartY + tier * tierStepY);
        const textX = textAfterArrow
            ? toSvgX(xVal) + Math.max(6, 5 * sqrtScale)
            : toSvgX(xVal) - Math.max(6, 5 * sqrtScale);
        const textAnchor = textAfterArrow ? 'start' : 'end';

        parts.push(`
            <!-- Wymiar bazowy X=${xVal} przy grocie -->
            <line x1="${toSvgX(xVal)}" y1="${toSvgY(validMinY)}" x2="${toSvgX(xVal)}" y2="${toSvgY(lineY - 4)}" class="tech-ext" />
            <line x1="${toSvgX(0)}" y1="${toSvgY(lineY)}" x2="${toSvgX(xVal)}" y2="${toSvgY(lineY)}" class="tech-line" marker-end="url(#arr_${data.id})" />
            <text x="${textX}" y="${toSvgY(lineY) - Math.max(4, 3 * sqrtScale)}" class="tech-text tech-dim tech-halo" font-size="${fontHoleDim}" text-anchor="${textAnchor}">
                ${xVal}
            </text>
        `);
    });

    // Współrzędne Y (otwory + wycięcia) — tekst obrócony równolegle do linii wymiarowej w swoim torze
    yPack.placements.forEach(({ val: yVal, tier, textAfterArrow }) => {
        const matchingHoles = data.holes.filter(h => Math.abs(h.y - yVal) < 0.2);
        const matchingCutouts = data.cutouts.filter(c => Math.abs(c.y - yVal) < 0.2 || Math.abs(c.y + c.height - yVal) < 0.2);
        const minXFromHoles = matchingHoles.length > 0 ? Math.min(...matchingHoles.map(h => h.x)) : Infinity;
        const minXFromCutouts = matchingCutouts.length > 0 ? Math.min(...matchingCutouts.map(c => c.x)) : Infinity;
        const minX = Math.min(minXFromHoles, minXFromCutouts);
        const validMinX = Number.isFinite(minX) ? minX : 0;

        const lineX = -(baseDimStartX + tier * tierStepX);
        const textX = toSvgX(lineX) - Math.max(4, 3 * sqrtScale);
        const textY = textAfterArrow
            ? toSvgY(yVal) - Math.max(6, 5 * sqrtScale)
            : toSvgY(yVal) + Math.max(6, 5 * sqrtScale);
        const textAnchor = textAfterArrow ? 'start' : 'end';

        parts.push(`
            <!-- Wymiar bazowy Y=${yVal} przy grocie -->
            <line x1="${toSvgX(validMinX)}" y1="${toSvgY(yVal)}" x2="${toSvgX(lineX - 4)}" y2="${toSvgY(yVal)}" class="tech-ext" />
            <line x1="${toSvgX(lineX)}" y1="${toSvgY(0)}" x2="${toSvgX(lineX)}" y2="${toSvgY(yVal)}" class="tech-line" marker-end="url(#arr_${data.id})" />
            <text x="${textX}" y="${textY}" class="tech-text tech-dim tech-halo" font-size="${fontHoleDim}" text-anchor="${textAnchor}" transform="rotate(-90 ${textX} ${textY})">
                ${yVal}
            </text>
        `);
    });

    // 8. Czysty symbol bazy odniesienia (0, 0)
    const originX = toSvgX(0);
    const originY = toSvgY(0);
    const axisLen = Math.round(Math.max(34, 30 * sqrtScale));
    const hAxisLabel = data.isSidePanel ? '+Y' : '+X';
    const vAxisLabel = data.isSidePanel ? '+X' : '+Y';
    const hAxisColor = data.isSidePanel ? '#16a34a' : '#dc2626';
    const vAxisColor = data.isSidePanel ? '#dc2626' : '#16a34a';
    const hArrowEnd = data.isSidePanel ? `url(#arr_y_${data.id})` : `url(#arr_x_${data.id})`;
    const vArrowEnd = data.isSidePanel ? `url(#arr_x_${data.id})` : `url(#arr_y_${data.id})`;
    parts.push(`
        <!-- BAZA ODNIESIENIA (0, 0): ${data.wcsOriginLabel} -->
        <g id="datum_marker">
            <!-- Oś pozioma (${hAxisLabel}) -->
            <line x1="${originX}" y1="${originY}" x2="${originX + axisLen}" y2="${originY}" stroke="${hAxisColor}" stroke-width="${Math.max(2, 1.8 * sqrtScale)}" marker-end="${hArrowEnd}" />
            <text x="${originX + axisLen + 4}" y="${originY + 4}" fill="${hAxisColor}" font-size="${fontGabaryt}" class="tech-text tech-halo">${hAxisLabel}</text>

            <!-- Oś pionowa (${vAxisLabel}) -->
            <line x1="${originX}" y1="${originY}" x2="${originX}" y2="${originY - axisLen}" stroke="${vAxisColor}" stroke-width="${Math.max(2, 1.8 * sqrtScale)}" marker-end="${vArrowEnd}" />
            <text x="${originX - 4}" y="${originY - axisLen - 4}" fill="${vAxisColor}" font-size="${fontGabaryt}" class="tech-text tech-halo" text-anchor="end">${vAxisLabel}</text>

            <!-- Znak bazy rysunkowej (koło z zaciemnionymi ćwiartkami) -->
            <circle cx="${originX}" cy="${originY}" r="${Math.max(7, 6 * sqrtScale)}" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />
            <path d="M ${originX} ${originY} L ${originX + Math.max(7, 6 * sqrtScale)} ${originY} A ${Math.max(7, 6 * sqrtScale)} ${Math.max(7, 6 * sqrtScale)} 0 0 1 ${originX} ${originY + Math.max(7, 6 * sqrtScale)} Z" fill="#0f172a" />
            <path d="M ${originX} ${originY} L ${originX - Math.max(7, 6 * sqrtScale)} ${originY} A ${Math.max(7, 6 * sqrtScale)} ${Math.max(7, 6 * sqrtScale)} 0 0 1 ${originX} ${originY - Math.max(7, 6 * sqrtScale)} Z" fill="#0f172a" />
            <circle cx="${originX}" cy="${originY}" r="${Math.max(1.5, 1.5 * sqrtScale)}" fill="#dc2626" />

            <!-- Podpis bazy: (0, 0) umieszczony w pustym narożniku poza liniami obrzeża -->
            <text x="${originX - Math.max(10, 8 * sqrtScale)}" y="${originY + Math.max(18, 16 * sqrtScale)}" fill="#0f172a" font-size="${fontHoleDim}" class="tech-text tech-halo" text-anchor="end">
                (0, 0)
            </text>
        </g>
    `);

    return `
        <svg id="svg_${data.id}" data-orig-viewbox="0 0 ${svgW} ${svgH}" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%" style="display: block; width: 100%; height: 100%; touch-action: none; user-select: none;">
            ${parts.join('\n')}
        </svg>
    `;
}

/**
 * Generuje kompletny dokument HTML profesjonalnych kart warsztatowych dla jednej lub wielu formatek.
 * Zawiera zwarty jednoliniowy nagłówek parametrów oraz wbudowany skrypt Zoom & Pan.
 */
export function generatePanelsHtmlPreview(panelsData: PanelPreviewData[], projectTitle: string = 'Rysunki Techniczne Formatek'): string {
    const panelsCardsHtml = panelsData.map((data, idx) => {
        const svg = renderPanelSvg(data);
        const dxfBase64 = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(data.dxfContent))) : '';

        const activeEdges = data.edges.filter(e => e.active);
        const edgeSummary = activeEdges.length > 0 
            ? activeEdges.map(e => `${e.label.split(' ')[0]}: ABS ${e.thicknessMm}mm`).join(', ')
            : 'Brak';

        const cutoutsSummary = data.cutouts.length > 0
            ? `<span class="detail-pill">Wycięcia: <strong class="text-orange">${data.cutouts.length} szt.</strong></span>`
            : '';

        return `
            <div class="panel-card" id="card_${data.id}">
                <!-- ZWARTY JEDNOLINIOWY NAGŁÓWEK PARAMETRÓW FORMATKI -->
                <div class="panel-header-compact">
                    <div class="panel-info-inline">
                        <span class="badge-num">${idx + 1}</span>
                        <strong class="panel-name-text">${data.name}</strong>
                        <span class="panel-dim-badge">${data.dimensions.width} × ${data.dimensions.height} × ${data.dimensions.thickness} mm</span>
                        <span class="detail-pill">Baza: <strong class="text-blue">${data.wcsOriginLabel}</strong></span>
                        <span class="detail-pill">Otwory: <strong class="text-green">${data.holes.length} szt.</strong></span>
                        ${cutoutsSummary}
                        <span class="detail-pill">Obrzeża: <strong>${edgeSummary}</strong></span>
                        ${data.materialName ? `<span class="detail-pill">Materiał: <strong>${data.materialName}</strong></span>` : ''}
                        ${data.containerName ? `<span class="detail-pill">Korpus: <strong>${data.containerName}</strong></span>` : ''}
                    </div>

                    <div class="panel-actions-inline">
                        <div class="zoom-toolbar" data-target="svg_${data.id}">
                            <button class="btn-tool btn-zoom-in" title="Powiększ (+)">➕</button>
                            <button class="btn-tool btn-zoom-out" title="Pomniejsz (-)">➖</button>
                            <button class="btn-tool btn-zoom-reset" title="Dopasuj do widoku (100%)">⛶ 100%</button>
                            <span class="zoom-level-badge">100%</span>
                        </div>
                        <a href="data:application/dxf;base64,${dxfBase64}" download="${data.dxfFilename}" class="btn-dxf-compact" title="Pobierz plik DXF">
                            ⬇ DXF
                        </a>
                    </div>
                </div>

                <!-- DOMINUJĄCY WIDOK FORMATKI Z RYSUNKIEM SVG -->
                <div class="svg-viewport" id="viewport_${data.id}">
                    ${svg}
                </div>
            </div>
        `;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectTitle}</title>
    <style>
        :root {
            --bg-page: #0b1120;
            --bg-card: #131c31;
            --border-card: #22304d;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --primary: #0284c7;
            --primary-hover: #0369a1;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: var(--bg-page);
            color: var(--text-main);
            padding: 8px 12px;
            line-height: 1.4;
        }
        .topbar-compact {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: 6px;
            padding: 6px 14px;
            margin-bottom: 8px;
        }
        .topbar-left {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .topbar-title {
            font-size: 13px;
            font-weight: 700;
            color: #38bdf8;
        }
        .topbar-sep {
            color: #475569;
            font-size: 11px;
        }
        .topbar-sub {
            font-size: 12px;
            color: var(--text-muted);
        }
        .btn-print-mini {
            background: #1e293b;
            color: #cbd5e1;
            border: 1px solid #334155;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s;
        }
        .btn-print-mini:hover {
            background: #334155;
            color: #ffffff;
        }

        .panel-card {
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: 6px;
            padding: 8px 10px 10px 10px;
            margin-bottom: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
        }

        .panel-header-compact {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 6px;
            margin-bottom: 6px;
            border-bottom: 1px solid var(--border-card);
            gap: 12px;
            flex-wrap: nowrap;
            overflow-x: auto;
        }
        .panel-info-inline {
            display: flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
        }
        .badge-num {
            background: #0284c7;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 4px;
        }
        .panel-name-text {
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
        }
        .panel-dim-badge {
            background: #090d16;
            border: 1px solid #334155;
            color: #38bdf8;
            font-size: 12px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            font-family: Consolas, monospace;
        }
        .detail-pill {
            font-size: 11px;
            color: var(--text-muted);
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid #1e293b;
            padding: 2px 7px;
            border-radius: 4px;
        }
        .detail-pill strong {
            color: #e2e8f0;
        }
        .text-green { color: #4ade80 !important; }
        .text-blue { color: #38bdf8 !important; }
        .text-orange { color: #fb923c !important; }

        .panel-actions-inline {
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            margin-left: auto;
        }
        .zoom-toolbar {
            display: flex;
            align-items: center;
            gap: 2px;
            background: #090d16;
            border: 1px solid #22304d;
            border-radius: 4px;
            padding: 2px 4px;
        }
        .btn-tool {
            background: transparent;
            border: none;
            color: #cbd5e1;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: 700;
            border-radius: 3px;
            cursor: pointer;
        }
        .btn-tool:hover {
            background: #1e293b;
            color: #38bdf8;
        }
        .zoom-level-badge {
            font-size: 10px;
            font-weight: 700;
            color: #38bdf8;
            min-width: 36px;
            text-align: center;
            font-family: monospace;
        }
        .btn-dxf-compact {
            background: #0284c7;
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 4px;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: background 0.15s;
        }
        .btn-dxf-compact:hover {
            background: #0369a1;
        }

        .svg-viewport {
            width: 100%;
            height: calc(100vh - 90px);
            min-height: 600px;
            background: #ffffff;
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid #cbd5e1;
            position: relative;
            cursor: grab;
            box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.05);
        }
        .svg-viewport.dragging {
            cursor: grabbing;
        }

        @media print {
            body { background: #ffffff; color: #000000; padding: 0; }
            .topbar-compact { display: none; }
            .panel-card { border: none; padding: 0; margin-bottom: 0; page-break-after: always; box-shadow: none; background: #ffffff; }
            .panel-actions-inline { display: none; }
            .panel-header-compact { border-bottom: 1px solid #000000; padding-bottom: 4px; }
            .badge-num { background: #000000; }
            .panel-name-text { color: #000000; }
            .panel-dim-badge { border-color: #000000; color: #000000; }
            .detail-pill { border: 1px solid #999999; color: #000000; background: #ffffff; }
            .detail-pill strong { color: #000000; }
            .svg-viewport { height: 92vh; border: none; }
        }
    </style>
</head>
<body>
    <div class="topbar-compact">
        <div class="topbar-left">
            <span class="topbar-title">${projectTitle}</span>
            <span class="topbar-sep">•</span>
            <span class="topbar-sub">${panelsData.length} ${panelsData.length === 1 ? 'formatka' : 'formatek'} | Baza boków: Narożnik dół-przód (0, 0)</span>
        </div>
        <div class="topbar-right">
            <button onclick="window.print()" class="btn-print-mini">🖨 Drukuj / PDF</button>
        </div>
    </div>

    ${panelsCardsHtml}

    <script>
        document.querySelectorAll('.panel-card').forEach(card => {
            const viewport = card.querySelector('.svg-viewport');
            const svg = card.querySelector('svg');
            if (!viewport || !svg) return;

            const origBoxStr = svg.getAttribute('data-orig-viewbox') || svg.getAttribute('viewBox');
            const [baseX, baseY, baseW, baseH] = origBoxStr.split(' ').map(Number);

            let currentView = { x: baseX, y: baseY, w: baseW, h: baseH };
            let isDragging = false;
            let startPointer = { x: 0, y: 0 };
            let startView = { ...currentView };

            const badge = card.querySelector('.zoom-level-badge');

            function updateViewBox() {
                svg.setAttribute('viewBox', \`\${currentView.x} \${currentView.y} \${currentView.w} \${currentView.h}\`);
                if (badge) {
                    const zoomPercent = Math.round((baseW / currentView.w) * 100);
                    badge.textContent = \`\${zoomPercent}%\`;
                }
            }

            function zoomAt(factor, clientX, clientY) {
                const rect = viewport.getBoundingClientRect();
                const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

                const pointX = currentView.x + relX * currentView.w;
                const pointY = currentView.y + relY * currentView.h;

                const newW = currentView.w * factor;
                const newH = currentView.h * factor;

                if (newW > baseW * 4 || newW < baseW / 30) return;

                currentView.w = newW;
                currentView.h = newH;
                currentView.x = pointX - relX * newW;
                currentView.y = pointY - relY * newH;

                updateViewBox();
            }

            function resetZoom() {
                currentView = { x: baseX, y: baseY, w: baseW, h: baseH };
                updateViewBox();
            }

            viewport.addEventListener('wheel', (e) => {
                e.preventDefault();
                const factor = e.deltaY < 0 ? 0.85 : 1.15;
                zoomAt(factor, e.clientX, e.clientY);
            }, { passive: false });

            viewport.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                isDragging = true;
                viewport.classList.add('dragging');
                viewport.setPointerCapture(e.pointerId);
                startPointer = { x: e.clientX, y: e.clientY };
                startView = { ...currentView };
            });

            viewport.addEventListener('pointermove', (e) => {
                if (!isDragging) return;
                const rect = viewport.getBoundingClientRect();
                const dxPx = e.clientX - startPointer.x;
                const dyPx = e.clientY - startPointer.y;

                const scaleX = currentView.w / rect.width;
                const scaleY = currentView.h / rect.height;

                currentView.x = startView.x - dxPx * scaleX;
                currentView.y = startView.y - dyPx * scaleY;
                updateViewBox();
            });

            const stopDrag = (e) => {
                if (!isDragging) return;
                isDragging = false;
                viewport.classList.remove('dragging');
                try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
            };

            viewport.addEventListener('pointerup', stopDrag);
            viewport.addEventListener('pointercancel', stopDrag);

            viewport.addEventListener('dblclick', (e) => {
                e.preventDefault();
                resetZoom();
            });

            const btnIn = card.querySelector('.btn-zoom-in');
            const btnOut = card.querySelector('.btn-zoom-out');
            const btnReset = card.querySelector('.btn-zoom-reset');

            if (btnIn) {
                btnIn.addEventListener('click', () => {
                    const rect = viewport.getBoundingClientRect();
                    zoomAt(0.75, rect.left + rect.width / 2, rect.top + rect.height / 2);
                });
            }
            if (btnOut) {
                btnOut.addEventListener('click', () => {
                    const rect = viewport.getBoundingClientRect();
                    zoomAt(1.33, rect.left + rect.width / 2, rect.top + rect.height / 2);
                });
            }
            if (btnReset) {
                btnReset.addEventListener('click', () => resetZoom());
            }
        });
    </script>
</body>
</html>`;
}

/**
 * Otwiera podgląd HTML w nowej karcie przeglądarki.
 */
export function openPanelsHtmlPreview(panelsData: PanelPreviewData[], projectTitle?: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const title = projectTitle || (panelsData.length === 1 ? `Rysunek: ${panelsData[0].name}` : `Rysunki Techniczne Formatek (${panelsData.length})`);
    const html = generatePanelsHtmlPreview(panelsData, title);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}
