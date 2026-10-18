/**
 * A5_smartparts / hangers — smartpart-bay-placement.ts
 *
 * Parametryczne osadzenie SmartParta (ze Studio) we wnęce korpusu.
 *
 * Kontener Główny SmartParta ze Studio ↔ wnęka korpusu (DetectedBay).
 * Każdy part / cut ma ściany referencyjne (refX/refY/refZ) i offsety [mm] —
 * pozycja jest liczona od AKTUALNYCH ścian wnęki, więc po zmianie wymiarów
 * korpusu wystarczy przeliczyć ramkę (frame) i wszystko „jedzie” za ścianami.
 *
 * Układ Studio = CAD (Z-up):
 *   X = szerokość (LEFT / RIGHT)
 *   Y = głębokość (BACK / FRONT) — w świecie CAD przód zwykle −Y
 *   Z = wysokość (BOTTOM / TOP)
 *
 * Semantyka jak `computeAbsoluteFromReference` w Studio:
 *   LEFT/BACK/BOTTOM  → ściana + offset
 *   RIGHT/FRONT/TOP   → ściana − offset
 *   CENTER            → środek + offset
 * Offset dotyczy ŚRODKA bryły / cięcia.
 *
 * Jednostki: wejście/wyjście w mm (brzeg domeny: mmToNm / nmToMm z units.ts).
 */

import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { computeFaceData, localTo3D, point3DToFaceUV } from '../../A4_smartpanel/native_core/face-lcs.js';
import type { DetectedBay } from '../../A2_bloki/02_bloki-bay-detector.js';
import {
    computeAbsoluteFromReference,
    cutOrientFromRefs,
} from '../../S5_studio/smartpart-studio-types.js';

export type BaySide = 'left' | 'right' | 'bottom' | 'top' | 'back' | 'front';

export const BAY_SIDES: readonly BaySide[] = ['left', 'right', 'bottom', 'top', 'back', 'front'];

/** Referencja ściany wnęki zapisywana w generatorParams (tożsamość = nodeId). */
export interface BayWallRef {
    nodeId: string;
    face: string;
    planeCoordMm: number;
}

export type BayWallRefs = Partial<Record<BaySide, BayWallRef>>;

/** Ramka wnęki w świecie CAD [mm]. */
export interface SmartPartBayFrameMm {
    xL: number;
    xR: number;
    zBottom: number;
    zTop: number;
    backY: number;
    frontY: number;
    /** Zwrot osi Y od pleców do frontu (+1 / −1) */
    backToFront: 1 | -1;
    widthMm: number;
    heightMm: number;
    depthMm: number;
    refs: BayWallRefs;
}

/** Element pozycjonowany od ścian (part albo cut ze Studio). */
export interface StudioPlacedItem {
    widthMm?: number;
    heightMm?: number;
    depthMm?: number;
    xMm?: number;
    yMm?: number;
    zMm?: number;
    refX?: string;
    refY?: string;
    refZ?: string;
    offsetX_mm?: number;
    offsetY_mm?: number;
    offsetZ_mm?: number;
}

/** Pozycja w układzie wnęki: x od boku lewego, h od dna, d od pleców (w stronę frontu). */
export interface BayLocalMm {
    x: number;
    h: number;
    d: number;
}

function buildFrame(
    leftX: number, rightX: number,
    bottomZ: number, topZ: number,
    backY: number, frontY: number,
    refs: BayWallRefs,
): SmartPartBayFrameMm {
    const xL = Math.min(leftX, rightX);
    const xR = Math.max(leftX, rightX);
    const zBottom = Math.min(bottomZ, topZ);
    const zTop = Math.max(bottomZ, topZ);
    const backToFront: 1 | -1 = frontY - backY >= 0 ? 1 : -1;
    return {
        xL, xR, zBottom, zTop, backY, frontY, backToFront,
        widthMm: xR - xL,
        heightMm: zTop - zBottom,
        depthMm: Math.abs(frontY - backY),
        refs,
    };
}

/** Ramka z wykrytej wnęki (w chwili wstawienia). */
export function bayFrameFromDetectedBay(bay: DetectedBay): SmartPartBayFrameMm {
    const c = bay.centerWorldMm;
    const hw = bay.boundsMm.width / 2;
    const hh = bay.boundsMm.height / 2;
    const hd = bay.boundsMm.depth / 2;
    const b: any = bay.boundary || {};

    const leftX = b.left?.planeCoordMm ?? (c.x - hw);
    const rightX = b.right?.planeCoordMm ?? (c.x + hw);
    // bloki-bay-detector: przód = mniejszy Y, plecy = większy Y
    const backY = b.back?.planeCoordMm ?? (c.y + hd);
    const frontY = b.front?.planeCoordMm ?? b.frontPlaneYMm ?? (c.y - hd);
    const bottomZ = b.bottom?.planeCoordMm ?? (c.z - hh);
    const topZ = b.top?.planeCoordMm ?? (c.z + hh);

    const refs: BayWallRefs = {};
    for (const side of BAY_SIDES) {
        const r = b[side];
        if (r?.nodeId && r?.face) {
            refs[side] = { nodeId: r.nodeId, face: r.face, planeCoordMm: Number(r.planeCoordMm) };
        }
    }
    return buildFrame(leftX, rightX, bottomZ, topZ, backY, frontY, refs);
}

function isPanelLike(dd: any): boolean {
    if (!dd) return false;
    const t = Number(dd.thickness);
    const w = Number(dd.width ?? dd.length);
    const h = Number(dd.height ?? dd.depth);
    return t > 0 && w > 0 && h > 0;
}

/**
 * Współrzędna (w osi `axis`) środka danej ściany formatki w świecie [mm].
 * Zwraca null, gdy węzeł nie jest formatką (brak grubości / wymiarów).
 */
export function panelFacePlaneCoordMm(node: any, face: string, axis: 'x' | 'y' | 'z'): number | null {
    const dd = node?.domainData;
    if (!isPanelLike(dd)) return null;
    const w = nmToMm(Number(dd.width ?? dd.length));
    const h = nmToMm(Number(dd.height ?? dd.depth));
    const t = nmToMm(Number(dd.thickness));
    let fd: ReturnType<typeof computeFaceData>;
    try {
        fd = computeFaceData(face, w, h, t);
    } catch {
        return null;
    }
    const local = localTo3D(fd, fd.width / 2, fd.height / 2, 0);
    const localNm = new Vec3(mmToNm(local[0]), mmToNm(local[1]), mmToNm(local[2]));
    const mat = typeof node.getWorldMatrix === 'function' ? node.getWorldMatrix() : node.localMatrix;
    const worldNm = mat ? mat.transformPoint(localNm) : localNm;
    return nmToMm(worldNm[axis]);
}

const SIDE_AXIS: Record<BaySide, 'x' | 'y' | 'z'> = {
    left: 'x', right: 'x', bottom: 'z', top: 'z', back: 'y', front: 'y',
};

const PANEL_FACE_NAMES = [
    'FACE_X_MINUS', 'FACE_X_PLUS',
    'FACE_Y_MINUS', 'FACE_Y_PLUS',
    'FACE_Z_MINUS', 'FACE_Z_PLUS',
] as const;

/**
 * Skrajna współrzędna świata po osi — min/max po środkach wszystkich 6 ścian formatki.
 * Dla boku (grubość ‖ X): min Y = czoło wnęki, max Y = tył boku.
 */
export function panelExtremeWorldCoordMm(
    node: any,
    axis: 'x' | 'y' | 'z',
    which: 'min' | 'max',
): number | null {
    if (!node || !isPanelLike(node.domainData)) return null;
    let best: number | null = null;
    for (const face of PANEL_FACE_NAMES) {
        const v = panelFacePlaneCoordMm(node, face, axis);
        if (v === null || !Number.isFinite(v)) continue;
        best = best === null ? v : (which === 'min' ? Math.min(best, v) : Math.max(best, v));
    }
    return best;
}

/**
 * Live plane ≈ środek odcinka [a,b] zamiast końca — typowy objaw złej ściany
 * (np. lico boku zamiast wieńca → obie bryły „na środku” wysokości).
 */
export function liveLooksLikeMidSpan(live: number, endA: number, endB: number): boolean {
    const span = Math.abs(endA - endB);
    if (!(span > 50)) return false;
    const mid = (endA + endB) / 2;
    return Math.abs(live - mid) < span * 0.25;
}

/**
 * Live top/bottom zepsuły wysokość (refZ TOP ląduje „na środku”) → przywróć Z z DetectedBay.
 * Nie rusza X/Y (LEFT/FRONT zwykle OK). Nie blokuje realnego powiększenia wnęki (live H ≥ detected).
 */
export function recoverCollapsedBayHeightMm(
    live: SmartPartBayFrameMm,
    detected: SmartPartBayFrameMm,
): SmartPartBayFrameMm {
    if (!(detected.heightMm > 50)) return live;
    const ratio = live.heightMm / detected.heightMm;
    // Powiększenie / pełna wysokość — live jest wiarygodny
    if (ratio >= 0.95) return live;

    const topBad = liveLooksLikeMidSpan(live.zTop, detected.zBottom, detected.zTop);
    const bottomBad = liveLooksLikeMidSpan(live.zBottom, detected.zBottom, detected.zTop);
    const severelyShort = ratio <= 0.55;
    // Skrócenie + jedna płaszczyzna w środku spanu detekcji = typowy collapse po złej ścianie
    const collapsed = severelyShort || ((ratio < 0.85) && (topBad || bottomBad));
    if (!collapsed) return live;

    const zBottom = bottomBad || severelyShort ? detected.zBottom : live.zBottom;
    const zTop = topBad || severelyShort ? detected.zTop : live.zTop;
    const zLo = Math.min(zBottom, zTop);
    const zHi = Math.max(zBottom, zTop);
    return {
        ...live,
        zBottom: zLo,
        zTop: zHi,
        heightMm: zHi - zLo,
    };
}

/**
 * Ramka przeliczona z AKTUALNEJ geometrii formatek granicznych (po zmianie korpusu).
 * Brak formatki → zostaje zapamiętana płaszczyzna (jawny fallback do stanu z chwili wstawienia).
 *
 * Uwaga (przód): detektor często zapisuje `front.face = FACE_X_PLUS` (domyślna) i
 * `front.nodeId = korpus|bok`. Liczenie Y z FACE_X_* boku daje środek głębokości
 * (~połowa wnęki, np. 229 mm zamiast ~560) — stąd po edycji parametru kontener
 * „ucinał” się do pół głębokości. Czoło = skraj −Y boku lewego.
 */
export function bayFrameFromDocument(document: any, refs: BayWallRefs): SmartPartBayFrameMm | null {
    if (!document || !refs) return null;
    const coord = (side: BaySide): number | null => {
        const r = refs[side];
        if (!r) return null;
        const node = document.findNode?.(r.nodeId);
        const axis = SIDE_AXIS[side];
        let v: number | null = null;

        if (side === 'front') {
            const leftNode = refs.left ? document.findNode?.(refs.left.nodeId) : null;
            const live = panelExtremeWorldCoordMm(leftNode, 'y', 'min')
                ?? panelExtremeWorldCoordMm(node, 'y', 'min');
            const stored = Number.isFinite(r.planeCoordMm) ? r.planeCoordMm : null;
            const backStored = refs.back && Number.isFinite(refs.back.planeCoordMm)
                ? refs.back.planeCoordMm
                : null;
            // Błąd FACE_X_* / środka płyty: live ≈ środek wnęki → głębokość ~½ (np. 229).
            // Wtedy trzymaj planeCoordMm z chwili detekcji.
            if (live !== null && stored !== null && backStored !== null) {
                const depthStored = Math.abs(backStored - stored);
                const depthLive = Math.abs(backStored - live);
                const mid = (stored + backStored) / 2;
                const liveLooksLikeCenter = Math.abs(live - mid) < Math.abs(stored - mid) * 0.35;
                // Extreme po złej osi (np. wysokość boku zamiast głębokości) → depthLive ≫ zapis
                const liveExplodesDepth = depthStored > 50 && depthLive > depthStored * 1.35;
                v = (liveLooksLikeCenter || liveExplodesDepth) ? stored : live;
            } else {
                v = live ?? stored;
            }
        } else if (side === 'back') {
            v = node ? panelFacePlaneCoordMm(node, r.face, 'y') : null;
            if (v === null) v = panelExtremeWorldCoordMm(node, 'y', 'max');
        } else if (side === 'top' || side === 'bottom') {
            // Lico wskazanej ściany. Skraj AABB wieńca (oś w płaszczyźnie płyty) wypychał
            // kontener ~połowę głębokości poza górę i dół korpusu.
            const live = node ? panelFacePlaneCoordMm(node, r.face, 'z') : null;
            const stored = Number.isFinite(r.planeCoordMm) ? r.planeCoordMm : null;
            const otherSide = side === 'top' ? refs.bottom : refs.top;
            const other = otherSide && Number.isFinite(otherSide.planeCoordMm)
                ? otherSide.planeCoordMm
                : null;
            if (live !== null && stored != null && other != null) {
                const spanStored = Math.abs(stored - other);
                const spanLive = Math.abs(live - other);
                const midCollapse = liveLooksLikeMidSpan(live, stored, other);
                const explodes = spanStored > 50 && spanLive > spanStored * 1.35;
                const halfSpan = spanStored > 50 && spanLive < spanStored * 0.55;
                v = (midCollapse || explodes || halfSpan) ? stored : live;
            } else {
                v = live ?? stored;
            }
        } else {
            v = node ? panelFacePlaneCoordMm(node, r.face, axis) : null;
        }

        if (v === null && Number.isFinite(r.planeCoordMm)) v = r.planeCoordMm;
        return v;
    };
    const leftX = coord('left');
    const rightX = coord('right');
    const bottomZ = coord('bottom');
    const topZ = coord('top');
    const backY = coord('back');
    const frontY = coord('front');
    if ([leftX, rightX, bottomZ, topZ, backY, frontY].some((v) => v === null || !Number.isFinite(v))) {
        return null;
    }
    return buildFrame(leftX!, rightX!, bottomZ!, topZ!, backY!, frontY!, refs);
}

/** customReferences Bloku (xMin/xMax/…) z DetectedBay — ten sam schemat co createBlokInDetectedBay. */
export function customReferencesFromDetectedBay(bay: DetectedBay): Record<string, {
    partKey: string;
    face: string;
    panelId: string;
}> {
    const b = bay.boundary || ({} as DetectedBay['boundary']);
    const leftRef = b.left;
    const rightRef = b.right;
    const bottomRef = b.bottom;
    const topRef = b.top;
    const backRef = b.back;
    const frontRef = b.front || leftRef;
    const faceOf = (r: any, fallback: string) =>
        String(r?.face || r?.faceName || fallback);
    return {
        xMin: {
            partKey: leftRef?.nodeName || 'Bok Lewy',
            face: faceOf(leftRef, 'FACE_Z_PLUS'),
            panelId: leftRef?.nodeId,
        },
        xMax: {
            partKey: rightRef?.nodeName || 'Bok Prawy',
            face: faceOf(rightRef, 'FACE_Z_PLUS'),
            panelId: rightRef?.nodeId,
        },
        zMin: {
            partKey: bottomRef?.nodeName || 'Dół',
            face: faceOf(bottomRef, 'FACE_Z_PLUS'),
            panelId: bottomRef?.nodeId,
        },
        zMax: {
            partKey: topRef?.nodeName || 'Góra',
            face: faceOf(topRef, 'FACE_Z_MINUS'),
            panelId: topRef?.nodeId,
        },
        yMin: {
            partKey: frontRef?.nodeName || 'Przód',
            face: faceOf(frontRef, 'FACE_Y_MINUS'),
            panelId: frontRef?.nodeId,
        },
        yMax: {
            partKey: backRef?.nodeName || 'Tył',
            face: faceOf(backRef, 'FACE_Z_PLUS'),
            panelId: backRef?.nodeId,
        },
    };
}

const CUSTOM_REF_TO_SIDE: Record<string, BaySide> = {
    xMin: 'left',
    xMax: 'right',
    yMin: 'front',
    yMax: 'back',
    zMin: 'bottom',
    zMax: 'top',
};

/**
 * BayWallRefs z customReferences Bloku (+ zachowanie planeCoordMm z poprzedniej ramki).
 * Używane po edycji „Ściany referencyjne” w BlokiUI.
 */
export function bayWallRefsFromCustomReferences(
    document: any,
    customRefs: Record<string, { panelId?: string; face?: string; partKey?: string }> | null | undefined,
    prev?: BayWallRefs | null,
): BayWallRefs {
    const out: BayWallRefs = { ...(prev || {}) };
    if (!customRefs) return out;
    for (const [key, side] of Object.entries(CUSTOM_REF_TO_SIDE)) {
        const cr = customRefs[key];
        if (!cr?.panelId) continue;
        const face = String(cr.face || '');
        const node = document?.findNode?.(cr.panelId);
        const axis = SIDE_AXIS[side];
        let plane = node && face ? panelFacePlaneCoordMm(node, face, axis) : null;
        const stored = prev?.[side] && Number.isFinite(prev[side]!.planeCoordMm)
            ? prev[side]!.planeCoordMm
            : null;

        // Przód: unikaj środka boku (FACE_X_*) — skraj −Y albo poprzedni plane
        if (side === 'front' && node) {
            const extreme = panelExtremeWorldCoordMm(node, 'y', 'min');
            const backStored = prev?.back?.planeCoordMm;
            if (extreme !== null && stored != null && backStored != null) {
                plane = liveLooksLikeMidSpan(extreme, stored, backStored) ? stored : extreme;
            } else if (extreme !== null) {
                plane = extreme;
            } else if (stored != null) {
                plane = stored;
            }
        }

        // Góra / dół: lico ściany, nie skraj AABB (wieniec bez rotacji w macierzy psuje Z o ~D/2)
        if ((side === 'top' || side === 'bottom') && plane !== null && stored != null) {
            const other = side === 'top' ? prev?.bottom?.planeCoordMm : prev?.top?.planeCoordMm;
            if (other != null) {
                const spanStored = Math.abs(stored - other);
                const spanLive = Math.abs(plane - other);
                const explodes = spanStored > 50 && spanLive > spanStored * 1.35;
                const halfSpan = spanStored > 50 && spanLive < spanStored * 0.55;
                if (liveLooksLikeMidSpan(plane, stored, other) || explodes || halfSpan) {
                    plane = stored;
                }
            }
        }

        if (plane === null && stored != null) plane = stored;
        if (plane === null || !Number.isFinite(plane)) continue;
        out[side] = {
            nodeId: cr.panelId,
            face: face || prev?.[side]?.face || 'FACE_Z_PLUS',
            planeCoordMm: plane,
        };
    }
    return out;
}

function upper(v: unknown): string {
    return typeof v === 'string' ? v.toUpperCase() : 'CENTER';
}

function wallOffsetMm(offset: unknown, abs: unknown, wallRef: string): number {
    const o = Number(offset);
    if (Number.isFinite(o)) return o;
    // Przy ścianie (LEFT/TOP/…) nie wolno brać xMm/yMm/zMm — to pozycja ze środka Studio, nie offset od ściany.
    if (wallRef === 'LEFT' || wallRef === 'RIGHT' || wallRef === 'BACK' || wallRef === 'FRONT'
        || wallRef === 'BOTTOM' || wallRef === 'TOP') {
        return 0;
    }
    const a = Number(abs);
    return Number.isFinite(a) ? a : 0;
}

/**
 * Pozycja środka elementu w układzie wnęki (x od boku lewego, h od dna, d od pleców).
 * Gdy brak ref → CENTER; offset ze ściany tylko z offset*_mm (JSON Studio).
 */
export function resolveStudioPlacementLocalMm(frame: SmartPartBayFrameMm, item: StudioPlacedItem): BayLocalMm {
    const W = frame.widthMm;
    const H = frame.heightMm;
    const D = frame.depthMm;

    const refX = upper(item.refX);
    const refY = upper(item.refY);
    const refZ = upper(item.refZ);
    const offX = wallOffsetMm(item.offsetX_mm, item.xMm, refX);
    const offY = wallOffsetMm(item.offsetY_mm, item.yMm, refY);
    const offZ = wallOffsetMm(item.offsetZ_mm, item.zMm, refZ);

    // CAD: Y = głębokość (d), Z = wysokość (h)
    const x = refX === 'LEFT' ? offX : refX === 'RIGHT' ? W - offX : W / 2 + offX;
    const d = refY === 'BACK' ? offY : refY === 'FRONT' ? D - offY : D / 2 + offY;
    const h = refZ === 'BOTTOM' ? offZ : refZ === 'TOP' ? H - offZ : H / 2 + offZ;
    return { x, h, d };
}

export function bayLocalToWorldMm(frame: SmartPartBayFrameMm, p: BayLocalMm): { x: number; y: number; z: number } {
    return {
        x: frame.xL + p.x,
        y: frame.backY + frame.backToFront * p.d,
        z: frame.zBottom + p.h,
    };
}

export function resolveStudioPlacementWorldMm(frame: SmartPartBayFrameMm, item: StudioPlacedItem) {
    return bayLocalToWorldMm(frame, resolveStudioPlacementLocalMm(frame, item));
}

/**
 * Oblicza pozycję środka bryły (Parta) SmartParta w lokalnym układzie kontenera wnęki (jak Bloki).
 * Kontener wnęki (groupNode):
 *   X = 0 to środek szerokości wnęki [-W/2, +W/2]
 *   Y = 0 to środek głębokości wnęki [-D/2, +D/2] (przód = -D/2, tył = +D/2)
 *   Z = 0 to spód wnęki (dno) [0, H] (góra = H)
 */
export function resolveStudioPlacementInContainerMm(
    dims: { widthMm: number; heightMm: number; depthMm: number },
    item: StudioPlacedItem
): { x: number; y: number; z: number } {
    const W = dims.widthMm;
    const H = dims.heightMm;
    const D = dims.depthMm;
    const p = resolveStudioPlacementLocalMm({ widthMm: W, heightMm: H, depthMm: D } as any, item);
    return {
        x: p.x - W / 2,
        y: D / 2 - p.d,
        z: p.h,
    };
}

/**
 * Pozycja klasycznego okucia (np. Camaro 806 bez parts[]) w układzie kontenera wnęki.
 * Montaż w tylnych górnych rogach:
 *   X: lewy = -W/2 + fromSide, prawy = +W/2 - fromSide
 *   Y: tył = +D/2 - fromBack
 *   Z: góra = H - fromTop
 */
export function resolveClassicHangerInContainerMm(
    dims: { widthMm: number; heightMm: number; depthMm: number },
    template: { fromSideMm?: number; fromBackMm?: number; fromTopMm?: number },
    side: 'L' | 'R'
): { x: number; y: number; z: number } {
    const W = dims.widthMm;
    const H = dims.heightMm;
    const D = dims.depthMm;
    const fromSide = Math.max(0, Number(template.fromSideMm) || 0);
    const fromBack = Math.max(0, Number(template.fromBackMm) || 0);
    const fromTop = Math.max(0, Number(template.fromTopMm) || 0);

    const x = side === 'L' ? -W / 2 + fromSide : W / 2 - fromSide;
    const y = D / 2 - fromBack;
    const z = H - fromTop;
    return { x, y, z };
}

/**
 * Pozycja cięcia w świecie CAD: Part we wnęce + lokalne LCS Parta (cut.x/y/z).
 */
export function resolveCutWorldMm(
    frame: SmartPartBayFrameMm,
    part: StudioPlacedItem | null | undefined,
    cut: StudioPlacedItem,
): { x: number; y: number; z: number } {
    if (!part) return resolveStudioPlacementWorldMm(frame, cut);
    const partWorld = resolveStudioPlacementWorldMm(frame, part);
    return {
        x: partWorld.x + Number(cut.xMm || 0),
        y: partWorld.y + Number(cut.yMm || 0),
        z: partWorld.z + Number(cut.zMm || 0),
    };
}

/**
 * Oblicza pozycję cechy (walec HOLE / sześcian POCKET) w układzie lokalnym Parta (LCS Parta).
 * Cecha jest referowana do ścianek swojego Parta (refX/refY/refZ + offsety).
 */
export function resolveCutPlacementInPartLcsMm(
    part: StudioPlacedItem | null | undefined,
    cut: any,
): { xMm: number; yMm: number; zMm: number } {
    if (!cut) return { xMm: 0, yMm: 0, zMm: 0 };
    const partW = Math.max(1, Number(part?.widthMm) || 18);
    const partH = Math.max(1, Number(part?.heightMm) || 38);
    const partD = Math.max(1, Number(part?.depthMm) || 68);
    const dims = { widthMm: partW, heightMm: partH, depthMm: partD };

    const refX = (cut.refX || 'CENTER') as any;
    const refY = (cut.refY || 'CENTER') as any;
    const refZ = (cut.refZ || 'CENTER') as any;

    const hasRefX = cut.refX !== undefined && cut.refX !== null;
    const hasRefY = cut.refY !== undefined && cut.refY !== null;
    const hasRefZ = cut.refZ !== undefined && cut.refZ !== null;

    const offX = Number.isFinite(Number(cut.offsetX_mm))
        ? Number(cut.offsetX_mm)
        : (hasRefX ? 0 : Number(cut.xMm || 0));
    const offY = Number.isFinite(Number(cut.offsetY_mm))
        ? Number(cut.offsetY_mm)
        : (hasRefY ? 0 : Number(cut.yMm || 0));
    const offZ = Number.isFinite(Number(cut.offsetZ_mm))
        ? Number(cut.offsetZ_mm)
        : (hasRefZ ? 0 : Number(cut.zMm || 0));

    // Jeśli brak jawnych referencji i brak offsetów, zachowaj czyste xMm/yMm/zMm
    if (!hasRefX && !hasRefY && !hasRefZ && cut.offsetX_mm === undefined && cut.offsetY_mm === undefined && cut.offsetZ_mm === undefined) {
        return {
            xMm: Number(cut.xMm || 0),
            yMm: Number(cut.yMm || 0),
            zMm: Number(cut.zMm || 0),
        };
    }

    return computeAbsoluteFromReference(dims, refX, offX, refY, offY, refZ, offZ);
}

/**
 * Pozycja początku cięcia (LCS / utwierdzenie) w układzie wnęki
 * (x od lewego, h od dna, d od pleców w stronę frontu).
 * Part → wnęka; cięcie → Part.
 *
 * CAD Part: +Y = tył, −Y = przód. Bay: d=0 = plecy, +d = w stronę frontu
 * → składowa Y musi być odjęta: d = part.d − cut.yMm.
 */
export function resolveCutPlacementLocalMm(
    frame: SmartPartBayFrameMm,
    part: StudioPlacedItem | null | undefined,
    cut: StudioPlacedItem,
): BayLocalMm {
    if (!part) return resolveStudioPlacementLocalMm(frame, cut);
    const p = resolveStudioPlacementLocalMm(frame, part);
    const cutLcs = resolveCutPlacementInPartLcsMm(part, cut);
    return {
        x: p.x + cutLcs.xMm,
        h: p.h + cutLcs.zMm, // CAD Z = wysokość
        d: p.d - cutLcs.yMm, // CAD +Y (tył) → bay −d
    };
}

/** Środek bryły HOLE/POCKET w układzie wnęki (początek + direction × half wzdłuż osi). */
export function resolveCutCenterLocalMm(
    frame: SmartPartBayFrameMm,
    part: StudioPlacedItem | null | undefined,
    cut: any,
): BayLocalMm {
    let p = resolveCutPlacementLocalMm(frame, part, cut);
    if (cut?.type !== 'HOLE' && cut?.type !== 'POCKET') return p;
    const { axis, direction: dir } = cutOrientFromRefs(cut);
    const half = cut.type === 'HOLE'
        ? Math.max(1, Number(cut.lengthMm) || 0) / 2
        : axis === 'X' ? Math.max(1, Number(cut.widthMm) || 0) / 2
        : axis === 'Y' ? Math.max(1, Number(cut.depthMm) || 0) / 2
        : Math.max(1, Number(cut.heightMm) || 0) / 2;
    if (axis === 'X') return { ...p, x: p.x + dir * half };
    // CAD +Y → bay −d (ten sam znak co w resolveCutPlacementLocalMm)
    if (axis === 'Y') return { ...p, d: p.d - dir * half };
    return { ...p, h: p.h + dir * half };
}

// ─── Cięcia (otwory / rewizje) ───────────────────────────────────────────────

/** Połówki gabarytu cięcia w osiach CAD (x = szer., y = głęb., z = wys.) [mm]. */
function cutHalfExtentsStudio(cut: any): { x: number; y: number; z: number } | null {
    if (cut?.type === 'HOLE') {
        const r = Number(cut.diameterMm) / 2;
        const l = Number(cut.lengthMm) / 2;
        if (!(r > 0) || !(l > 0)) return null;
        const { axis } = cutOrientFromRefs(cut);
        if (axis === 'X') return { x: l, y: r, z: r };
        if (axis === 'Y') return { x: r, y: l, z: r };
        return { x: r, y: r, z: l };
    }
    if (cut?.type === 'POCKET') {
        // width→X, depth→Y, height→Z
        const x = Number(cut.widthMm) / 2;
        const y = Number(cut.depthMm) / 2;
        const z = Number(cut.heightMm) / 2;
        if (!(x > 0) || !(y > 0) || !(z > 0)) return null;
        return { x, y, z };
    }
    return null;
}

/** Strony, na które walec może wejść w materiał — tylko czołem (wzdłuż swojej osi CAD). */
const HOLE_AXIS_SIDES: Record<string, BaySide[]> = {
    X: ['left', 'right'],
    Y: ['back', 'front'],
    Z: ['bottom', 'top'],
};

/**
 * Wystawanie cięcia poza każdą ze ścian wnęki [mm] —
 * zasada Studio: tyle, ile wystaje, tyle materiału wycinamy.
 */
export function computeCutProtrusionInBayMm(
    frame: SmartPartBayFrameMm,
    cut: any,
    part?: StudioPlacedItem | null,
): Record<BaySide, number> | null {
    const e = cutHalfExtentsStudio(cut);
    if (!e) return null;
    // AABB od środka bryły (HOLE/POCKET: początek LCS → środek)
    const p = resolveCutCenterLocalMm(frame, part, cut);
    // e.y = pół-głębokość (CAD Y), e.z = pół-wysokość (CAD Z)
    return {
        left: e.x - p.x,
        right: p.x + e.x - frame.widthMm,
        bottom: e.z - p.h,
        top: p.h + e.z - frame.heightMm,
        back: e.y - p.d,
        front: p.d + e.y - frame.depthMm,
    };
}

export interface SmartPartCutIntent {
    targetNodeId: string;
    feature: any;
}

const PROTRUSION_EPS_MM = 0.01;

/**
 * V otworu na boku (FACE_Z_PLUS).
 * LCS boku: wysokość płyty = lokalne Y, a rotacja węzła mapuje CAD Z na normalną lica.
 * point3DToFaceUV zostawia wtedy V = środek płyty — otwór nie jedzie za Partem ani za offsetem góry SmartParts.
 * Ta sama reguła co nawiercenia zawiasów: V = świat Z − spód boku.
 */
function sidePanelVFromWorldZ(panelNode: any, worldZ: number): number | null {
    const dd = panelNode?.domainData;
    const ph = nmToMm(Number(dd?.height ?? dd?.length ?? 0));
    if (!(ph > 1)) return null;
    let centerZ = 0;
    const translation = panelNode?.getWorldMatrix?.()?.decompose?.()?.translation;
    if (translation && Number.isFinite(translation.z)) {
        centerZ = nmToMm(translation.z);
    } else if (panelNode?.localMatrix?.data) {
        centerZ = nmToMm(Number(panelNode.localMatrix.data[14]) || 0);
    }
    return worldZ - (centerZ - ph / 2);
}

/** Środek formatki w świecie CAD [mm] z macierzy węzła. */
function panelWorldCenterMm(panelNode: any): { x: number; y: number; z: number } | null {
    const translation = panelNode?.getWorldMatrix?.()?.decompose?.()?.translation;
    if (translation
        && Number.isFinite(translation.x)
        && Number.isFinite(translation.y)
        && Number.isFinite(translation.z)) {
        return {
            x: nmToMm(translation.x),
            y: nmToMm(translation.y),
            z: nmToMm(translation.z),
        };
    }
    const d = panelNode?.localMatrix?.data;
    if (d && d.length >= 15) {
        return {
            x: nmToMm(Number(d[12]) || 0),
            y: nmToMm(Number(d[13]) || 0),
            z: nmToMm(Number(d[14]) || 0),
        };
    }
    return null;
}

/**
 * UV na plecach / froncie (płyta w płaszczyźnie XZ).
 * Jak przy boku: point3DToFaceUV po rotacji LCS pleców (Rx=180, mapping Z←y)
 * zostawia V na środku — liczymy ze świata CAD.
 *
 * FACE_Z_PLUS (INNER): u od lewej.
 * FACE_Z_MINUS (OUTER): u od prawej.
 * V: od góry płyty (świat +Z → małe V) — LCS pleców odwraca oś wysokości względem CNC.
 */
function backFrontPanelUvFromWorld(
    panelNode: any,
    faceName: string,
    world: { x: number; y: number; z: number },
): { u: number; v: number } | null {
    const dd = panelNode?.domainData;
    const pw = nmToMm(Number(dd?.width ?? dd?.length ?? 0));
    const ph = nmToMm(Number(dd?.height ?? dd?.depth ?? 0));
    if (!(pw > 1) || !(ph > 1)) return null;
    const c = panelWorldCenterMm(panelNode);
    if (!c) return null;
    const left = c.x - pw / 2;
    const top = c.z + ph / 2;
    const face = String(faceName || '').toUpperCase();
    const u = face.includes('Z_MINUS') || face.includes('Y_MINUS')
        ? (c.x + pw / 2) - world.x
        : world.x - left;
    // Od góry: Part TOP (duże world.z) → małe V na formatce
    const v = top - world.z;
    if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
    return { u, v };
}

/** Lico CNC: plecy BACK_PANEL → INNER (FACE_Z_PLUS), nie OUTER z detektora. */
function resolveCutFaceName(panelNode: any, refFace: string, side: BaySide): string {
    const role = String(panelNode?.domainData?.role || '');
    if ((side === 'back' || side === 'front') && role === 'BACK_PANEL') {
        return 'FACE_Z_PLUS';
    }
    return refFace;
}

function holeUvOnPanel(
    panelNode: any,
    faceName: string,
    world: { x: number; y: number; z: number },
    side: BaySide,
): { u: number; v: number } | null {
    if (side === 'back' || side === 'front') {
        const fixed = backFrontPanelUvFromWorld(panelNode, faceName, world);
        if (fixed) return fixed;
    }
    const uv = point3DToFaceUV(panelNode, faceName, [world.x, world.y, world.z]);
    if (!uv) return null;
    if (side !== 'left' && side !== 'right') return uv;
    const v = sidePanelVFromWorldZ(panelNode, world.z);
    if (v === null || !Number.isFinite(v)) return uv;
    return { u: uv.u, v };
}

/**
 * Wylicza cechy obróbcze (hole / groove) na formatkach granicznych wnęki.
 * Formatka docelowa = ściana, poza którą cięcie wystaje (tożsamość przez nodeId z ramki).
 */
export function computeSmartPartCutIntents(
    document: any,
    frame: SmartPartBayFrameMm,
    definition: any,
    sourceContainerId: string,
): SmartPartCutIntent[] {
    const intents: SmartPartCutIntent[] = [];
    const cuts: any[] = Array.isArray(definition?.cuts) ? definition.cuts : [];
    if (!document || cuts.length === 0) return intents;

    const sideIds = new Set<string>(
        [frame.refs.left?.nodeId, frame.refs.right?.nodeId].filter(Boolean) as string[],
    );

    const parts: any[] = Array.isArray(definition?.parts) && definition.parts.length > 0
        ? definition.parts
        : definition?.partBody
            ? [definition.partBody]
            : [];

    for (let i = 0; i < cuts.length; i++) {
        const cut = cuts[i];
        // Cięcie BEZ Parta lądowałoby refZ CENTER → środek wnęki w Z. Zawsze bierz Part (TOP ze Studia).
        const part = (cut?.partId
            ? parts.find((p: any) => p?.id === cut.partId) || parts.find((p: any) => p?.name && cut.partId.includes?.(p.name))
            : null) || parts[0] || null;
        if (!part) continue;
        // Zamrożone (panel aplikacji → check → frozen): bez CNC / wycięć
        if (cut?.frozen === true || part?.frozen === true) continue;
        const prot = computeCutProtrusionInBayMm(frame, cut, part);
        if (!prot) continue;
        const e = cutHalfExtentsStudio(cut)!;
        // Środek bryły — spójnie z protruzją (nie początek LCS)
        const local = resolveCutCenterLocalMm(frame, part, cut);
        const { axis: cutAxis } = cutOrientFromRefs(cut);
        const allowed: BaySide[] = cut.type === 'HOLE'
            ? (HOLE_AXIS_SIDES[cutAxis] || [])
            : [...BAY_SIDES];

        for (const side of allowed) {
            const depthMm = prot[side];
            if (!(depthMm > PROTRUSION_EPS_MM)) continue;

            const ref = frame.refs[side];
            if (!ref) continue;
            // Plecy/przód wskazujące na bok (brak formatki pleców/frontu) — nie wiercimy w czoło boku
            if ((side === 'back' || side === 'front') && sideIds.has(ref.nodeId)) continue;

            const node = document.findNode?.(ref.nodeId);
            if (!node || !isPanelLike(node.domainData)) continue;
            const faceName = resolveCutFaceName(node, ref.face, side);

            const cutId = String(cut.id ?? i);
            const featureId = `sp_${sourceContainerId}_${cutId}_${side}`;
            const baseParams = {
                depth: Math.round(depthMm * 1000) / 1000,
                isSmartPartFeature: true,
                smartPartId: definition.id,
                sourceContainerId,
                sourceCutId: cutId,
            };

            if (cut.type === 'HOLE') {
                const center = bayLocalToWorldMm(frame, projectOntoSide(frame, local, side));
                const uv = holeUvOnPanel(node, faceName, center, side);
                if (!uv) continue;
                intents.push({
                    targetNodeId: node.id,
                    feature: {
                        id: featureId,
                        type: 'hole',
                        face: faceName,
                        side: faceName,
                        name: cut.name,
                        params: {
                            template_id: 'SINGLE',
                            u: round3(uv.u),
                            v: round3(uv.v),
                            diameter: Number(cut.diameterMm),
                            ...baseParams,
                        },
                    },
                });
            } else {
                // Rewizja: rzut 4 narożników przekroju na lico → prostokąt UV
                const corners = sectionCornersLocal(local, e, side).map((c) =>
                    bayLocalToWorldMm(frame, projectOntoSide(frame, c, side)));
                const uvs = corners
                    .map((c) => holeUvOnPanel(node, faceName, c, side))
                    .filter(Boolean) as Array<{ u: number; v: number }>;
                if (uvs.length !== 4) continue;
                const u0 = Math.min(...uvs.map((p) => p.u));
                const u1 = Math.max(...uvs.map((p) => p.u));
                const v0 = Math.min(...uvs.map((p) => p.v));
                const v1 = Math.max(...uvs.map((p) => p.v));
                intents.push({
                    targetNodeId: node.id,
                    feature: {
                        id: featureId,
                        type: 'groove',
                        face: faceName,
                        name: cut.name,
                        params: {
                            u: round3(u0),
                            v: round3(v0),
                            width: round3(u1 - u0),
                            length: round3(v1 - v0),
                            ...baseParams,
                        },
                    },
                });
            }
        }
    }
    return intents;
}

function round3(v: number): number {
    return Math.round(v * 1000) / 1000;
}

/** Rzut punktu (układ wnęki) na płaszczyznę ściany `side`. */
function projectOntoSide(frame: SmartPartBayFrameMm, p: BayLocalMm, side: BaySide): BayLocalMm {
    switch (side) {
        case 'left': return { ...p, x: 0 };
        case 'right': return { ...p, x: frame.widthMm };
        case 'bottom': return { ...p, h: 0 };
        case 'top': return { ...p, h: frame.heightMm };
        case 'back': return { ...p, d: 0 };
        case 'front': return { ...p, d: frame.depthMm };
    }
}

/** 4 narożniki przekroju prostopadłościanu w płaszczyźnie równoległej do ściany `side`.
 * e.x = pół-szer. (CAD X), e.y = pół-głęb. (CAD Y), e.z = pół-wys. (CAD Z).
 */
function sectionCornersLocal(p: BayLocalMm, e: { x: number; y: number; z: number }, side: BaySide): BayLocalMm[] {
    if (side === 'left' || side === 'right') {
        // ściana YZ: wysokość (h←Z) + głębokość (d←Y)
        return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({
            x: p.x,
            h: p.h + a * e.z,
            d: p.d + b * e.y,
        }));
    }
    if (side === 'bottom' || side === 'top') {
        // ściana XY: szerokość (x←X) + głębokość (d←Y)
        return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({
            x: p.x + a * e.x,
            h: p.h,
            d: p.d + b * e.y,
        }));
    }
    // back / front — ściana XZ: szerokość (x←X) + wysokość (h←Z)
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({
        x: p.x + a * e.x,
        h: p.h + b * e.z,
        d: p.d,
    }));
}

/**
 * Podmienia cechy wygenerowane przez dany SmartPart (sourceContainerId) na formatkach.
 * Idempotentne: zwraca true tylko gdy coś faktycznie się zmieniło.
 */
export function applySmartPartCutIntents(
    document: any,
    sourceContainerId: string,
    candidateNodeIds: Iterable<string>,
    intents: SmartPartCutIntent[],
): boolean {
    const byNode = new Map<string, any[]>();
    for (const it of intents) {
        if (!byNode.has(it.targetNodeId)) byNode.set(it.targetNodeId, []);
        byNode.get(it.targetNodeId)!.push(it.feature);
    }
    const nodeIds = new Set<string>([...candidateNodeIds, ...byNode.keys()]);
    let changed = false;

    for (const id of nodeIds) {
        const node = document.findNode?.(id);
        const panel = node?.domainData;
        if (!panel) continue;
        const existing: any[] = Array.isArray(panel.features) ? panel.features : [];
        const own = existing.filter((f) => f?.params?.sourceContainerId === sourceContainerId);
        const foreign = existing.filter((f) => f?.params?.sourceContainerId !== sourceContainerId);
        const next = byNode.get(id) || [];
        if (JSON.stringify(own) === JSON.stringify(next)) continue;

        const merged = [...foreign, ...next];
        if (typeof panel.setFeatures === 'function') panel.setFeatures(merged);
        else panel.features = merged;
        changed = true;
    }
    return changed;
}
