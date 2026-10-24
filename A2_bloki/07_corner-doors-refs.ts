/**
 * Referencje drzwi narożnych — jeden domyślny układ (wcięcie L wieńca).
 */
import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import type { FaceName } from '../A4_smartpanel/panel-model.js';
import { classifyOutlineSegmentEdge } from '../A4_smartpanel/native_core/polygon-extrusion.js';
import { getPanelFaceDominantAxis } from './01_bloki-core.js';

export type CornerAt = 'innerL_wieniec';

export type CornerDoorsRefSlot = {
    partKey: string;
    face: FaceName;
    panelId: string;
};

export type CornerDoorsCustomReferences = {
    xMin?: CornerDoorsRefSlot;
    xMax: CornerDoorsRefSlot;
    yMin: CornerDoorsRefSlot;
    yMax?: CornerDoorsRefSlot;
    zMin: CornerDoorsRefSlot;
    zMax: CornerDoorsRefSlot;
};

function isBlokiSubtree(node: CADNode): boolean {
    const d = node.domainData as any;
    const gp = d?.generatorParams;
    return Boolean(
        d?.type === 'bloki' ||
        d?.type === 'bloki_container' ||
        String(gp?.type ?? '').startsWith('bloki') ||
        Boolean(gp?.boxType)
    );
}

function findRogowyPanel(cabinetNode: CADNode, ...keySuffixes: string[]): CADNode | null {
    for (const keySuffix of keySuffixes) {
        let found: CADNode | null = null;
        const suffix = keySuffix.toUpperCase();
        const walk = (node: CADNode) => {
            if (found) return;
            if (isBlokiSubtree(node)) return;
            const d = node.domainData as any;
            if (d && (d.type === 'panel' || d.type === 'part')) {
                const key = String(d.key || node.name || '').toUpperCase();
                if (key === suffix || key.endsWith(`_${suffix}`) || key.endsWith(suffix)) {
                    found = node;
                    return;
                }
            }
            for (const child of node.children) walk(child);
        };
        walk(cabinetNode);
        if (found) return found;
    }
    return null;
}

export function isRogowy90Cabinet(node: CADNode): boolean {
    const gp = (node.domainData as any)?.generatorParams;
    const t = String(gp?.type || '').toLowerCase();
    return t === 'korpus_rogowy90' || t.includes('rogowy90') || t.includes('rogowy_90');
}

function makeRef(panelNode: CADNode, face: FaceName = 'FACE_Z_PLUS'): CornerDoorsRefSlot {
    return {
        partKey: panelNode.name,
        face,
        panelId: panelNode.id,
    };
}

function isVerticalSegment(a: number[], b: number[]): boolean {
    return Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1]);
}

/**
 * Ścianki wcięcia L wieńca.
 *
 * Priorytet: dokładnie jeden wierzchołek wklęsły (refleksyjny) — jego pionowa
 * krawędź → xMin, pozioma → yMax. To geometria samego wcięcia, odporna na skalę
 * i dodatkowe wycięcia obrysu.
 *
 * Fallback: segmenty sklasyfikowane jako NOTCH — dokładnie po jednym na oś.
 */
function findNotchWallRefs(
    wieniec: CADNode,
    cabinetNode: CADNode
): { xMin: CornerDoorsRefSlot; yMax: CornerDoorsRefSlot } | null {
    const panel = wieniec.domainData as any;
    const outlineRaw = panel?.custom_properties?.outline2d || panel?.outline2d;
    if (!Array.isArray(outlineRaw) || outlineRaw.length < 3) return null;
    const outline: number[][] = outlineRaw
        .map((pt: any) => (Array.isArray(pt) ? [Number(pt[0]), Number(pt[1])] : [Number(pt?.x), Number(pt?.y)]))
        .filter((pt: number[]) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
    if (outline.length < 3) return null;

    const n = outline.length;
    let area2 = 0;
    for (let i = 0; i < n; i++) {
        const [x0, y0] = outline[i];
        const [x1, y1] = outline[(i + 1) % n];
        area2 += x0 * y1 - x1 * y0;
    }
    if (Math.abs(area2) > 1e-9) {
        const ccw = area2 > 0;
        const reflex: number[] = [];
        for (let i = 0; i < n; i++) {
            const prev = outline[(i - 1 + n) % n];
            const curr = outline[i];
            const next = outline[(i + 1) % n];
            const cross =
                (curr[0] - prev[0]) * (next[1] - curr[1]) -
                (curr[1] - prev[1]) * (next[0] - curr[0]);
            const scale =
                Math.hypot(curr[0] - prev[0], curr[1] - prev[1]) *
                Math.hypot(next[0] - curr[0], next[1] - curr[1]);
            if (scale < 1e-9) continue;
            if ((ccw && cross < 0) || (!ccw && cross > 0)) reflex.push(i);
        }

        if (reflex.length === 1) {
            const corner = reflex[0];
            const prevIdx = (corner - 1 + n) % n;
            const a = outline[prevIdx];
            const b = outline[corner];
            const c = outline[(corner + 1) % n];
            const edgePrevVertical = isVerticalSegment(a, b);
            const edgeNextVertical = isVerticalSegment(b, c);
            if (edgePrevVertical !== edgeNextVertical) {
                const verticalIdx = edgePrevVertical ? prevIdx : corner;
                const horizontalIdx = edgePrevVertical ? corner : prevIdx;
                return {
                    xMin: makeRef(wieniec, `OUTLINE_SIDE_${verticalIdx}` as FaceName),
                    yMax: makeRef(wieniec, `OUTLINE_SIDE_${horizontalIdx}` as FaceName),
                };
            }
        }
    }

    const plateW = nmToMm(panel.width || 0);
    const plateD = nmToMm(panel.height || 0);

    const xWalls: CornerDoorsRefSlot[] = [];
    const yWalls: CornerDoorsRefSlot[] = [];
    for (let i = 0; i < outline.length; i++) {
        const [u0, v0] = outline[i];
        const [u1, v1] = outline[(i + 1) % outline.length];
        if (classifyOutlineSegmentEdge(u0, v0, u1, v1, plateW, plateD) !== 'NOTCH') continue;
        const face = `OUTLINE_SIDE_${i}` as FaceName;
        const axis = getPanelFaceDominantAxis(panel, wieniec, cabinetNode, face);
        if (axis === 'x') xWalls.push(makeRef(wieniec, face));
        else if (axis === 'y') yWalls.push(makeRef(wieniec, face));
    }

    if (xWalls.length !== 1 || yWalls.length !== 1) return null;
    return { xMin: xWalls[0], yMax: yWalls[0] };
}

/**
 * Domyślne referencje (4+2):
 * - 4 referencje automatyczne: dół, góra, bok prawy, bok lewy.
 * - 2 referencje wcięcia L (xMin, yMax): automatycznie ze ścianek NOTCH wieńca
 *   (WIENIEC_D, fallback WIENIEC_G); przy braku — manualnie w 3D.
 */
export function buildRogowy90CornerDoorsReferences(
    cabinetNode: CADNode
): CornerDoorsCustomReferences | null {
    if (!isRogowy90Cabinet(cabinetNode)) return null;

    const bokL = findRogowyPanel(cabinetNode, 'BOK_L', 'BOK_Y');
    const bokP = findRogowyPanel(cabinetNode, 'BOK_P', 'BOK_X');
    const bottom = findRogowyPanel(cabinetNode, 'WIENIEC_D') || findRogowyPanel(cabinetNode, 'BOTTOM');
    const top = findRogowyPanel(cabinetNode, 'WIENIEC_G') || findRogowyPanel(cabinetNode, 'TOP');
    if (!bokL || !bokP || !bottom || !top) return null;

    const notchRefs =
        findNotchWallRefs(bottom, cabinetNode) ||
        findNotchWallRefs(top, cabinetNode);

    return {
        xMin: notchRefs?.xMin,
        xMax: makeRef(bokP),
        yMin: makeRef(bokL),
        yMax: notchRefs?.yMax,
        zMin: makeRef(bottom),
        // FACE_Z_PLUS = INNER spód wieńca góry (do wnętrza); FACE_Z_MINUS = OUTER dach
        zMax: makeRef(top, 'FACE_Z_PLUS'),
    };
}

/** Stosuje domyślne referencje + cornerAt. */
export function applyCornerDoorsDefaultRefs(
    cabinetNode: CADNode
): { customReferences: CornerDoorsCustomReferences; cornerAt: CornerAt } | null {
    const customReferences = buildRogowy90CornerDoorsReferences(cabinetNode);
    if (!customReferences) return null;
    return {
        customReferences,
        cornerAt: 'innerL_wieniec',
    };
}

/**
 * Łączy automatyczne refy narożne z parametrami istniejącego bloku (np. przy
 * zmianie modułu na CORNER_DOORS w UI). Nadpisuje tylko refy, które udało się
 * wyznaczyć, i zdejmuje blokadę disabledReferences dla nich.
 */
export function buildCornerDoorsAutoRefsPatch(
    container: any,
    document: any
): { customReferences: Record<string, CornerDoorsRefSlot>; disabledReferences: Record<string, boolean> } | null {
    const gp = container?.generatorParams || {};
    const parentId = gp.parentContainerId;
    const parentCabinet = parentId && typeof document?.findNode === 'function'
        ? document.findNode(parentId)
        : null;
    if (!parentCabinet) return null;

    const applied = applyCornerDoorsDefaultRefs(parentCabinet);
    if (!applied) return null;

    const customReferences: Record<string, CornerDoorsRefSlot> = {
        ...(gp.customReferences || {}),
    };
    const disabledReferences: Record<string, boolean> = {
        ...(gp.disabledReferences || {}),
    };
    for (const [side, ref] of Object.entries(applied.customReferences)) {
        if (!ref) continue;
        customReferences[side] = ref as CornerDoorsRefSlot;
        delete disabledReferences[side];
    }
    return { customReferences, disabledReferences };
}

/** @deprecated Użyj applyCornerDoorsDefaultRefs */
export function applyCornerDoorsTrialPreset(
    cabinetNode: CADNode,
    _presetIndex?: number
): { customReferences: CornerDoorsCustomReferences; cornerAt: CornerAt; presetIndex: number } | null {
    const applied = applyCornerDoorsDefaultRefs(cabinetNode);
    if (!applied) return null;
    return { ...applied, presetIndex: 0 };
}
