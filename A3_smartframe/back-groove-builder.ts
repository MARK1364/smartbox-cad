/**
 * Wpusty pod plecy — geometria w CAD (Z-up): X=szerokość, Y=głębokość, Z=wysokość.
 *
 * PanelModel trzyma LCS (width×height×thickness), ale rotacje LCS w JSON są pod Y-up /
 * Babylon i nie dają poprawnego OBB w przestrzeni CAD. Dlatego bryły liczymy z
 * translacji + zmapowanych wymiarów i osi grubości (z pozycji / roli), a UV rowka
 * jak w Korpus3 (web-84): na FACE_Z_PLUS hosta.
 */

import { Mat4 } from '../A1_core/cad-math/mat4.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { GrooveIntent } from './groove-intent.js';
import { defaultBackOverlapNm } from './back-overlap.js';

export interface PanelState {
    id: string;
    role: string;
    key?: string;
    name?: string;
    isCornerNailer?: boolean;
    customProperties?: Record<string, any>;
    /** LCS po mapowaniu: x=width, y=height, z=thickness */
    dim_nm: { x: number; y: number; z: number };
    localMatrix: Mat4;
    zonePrefix?: string;
    backMarginsNm?: { left?: number; right?: number; top?: number; bottom?: number };
    /** Mapowanie LCS z silnika — tylko do detekcji TRAVERSE_V (Y←z, Z←y). */
    lcsMapping?: { X?: string; Y?: string; Z?: string };
}

function isCornerNailer(panel: PanelState): boolean {
    if (panel.isCornerNailer) return true;
    if (panel.customProperties?.corner_nailer) return true;
    const tag = `${panel.id || ''}|${panel.key || ''}|${panel.name || ''}`;
    return /NAROZ|KOTWICA|NAILER/i.test(tag);
}

const EPS = 50_000; // 0.05 mm

type Axis = 'X' | 'Y' | 'Z';

interface WorldBox {
    x0: number; x1: number;
    y0: number; y1: number;
    z0: number; z1: number;
}

function translationOf(panel: PanelState): Vec3 {
    return panel.localMatrix.decompose().translation;
}

function roleUpper(panel: PanelState): string {
    return String(panel.role || '').toUpperCase();
}

/** Oś grubości pleców w CAD: ściana ±Y → Y, ściana ±X → X. */
function backThicknessAxis(back: PanelState): Axis {
    const t = translationOf(back);
    return Math.abs(t.x) >= Math.abs(t.y) ? 'X' : 'Y';
}

/**
 * OBB pleców w CAD: LCS [W,H,T] — dla ściany Y: W∥X, H∥Z, T∥Y;
 * dla ściany X: W∥Y, H∥Z, T∥X.
 */
function backWorldBox(back: PanelState): WorldBox {
    const t = translationOf(back);
    const w = back.dim_nm.x;
    const h = back.dim_nm.y;
    const th = back.dim_nm.z;
    const axis = backThicknessAxis(back);
    if (axis === 'X') {
        return {
            x0: t.x - th / 2, x1: t.x + th / 2,
            y0: t.y - w / 2, y1: t.y + w / 2,
            z0: t.z - h / 2, z1: t.z + h / 2
        };
    }
    return {
        x0: t.x - w / 2, x1: t.x + w / 2,
        y0: t.y - th / 2, y1: t.y + th / 2,
        z0: t.z - h / 2, z1: t.z + h / 2
    };
}

function isHorizontalHost(role: string): boolean {
    return (
        role.includes('TOP') ||
        role.includes('BOTTOM') ||
        role.includes('SHELF') ||
        role.includes('WIENIEC') ||
        role.includes('HORIZONTAL')
    );
}

function isVerticalHost(role: string): boolean {
    return (
        role.includes('SIDE') ||
        role.includes('BOK') ||
        role.includes('DIVIDER') ||
        role.includes('PARTITION') ||
        role.includes('PRZEGRODA') ||
        role.includes('FRONT') ||
        role === 'MANUAL_PANEL'
    );
}

function isGrooveHost(role: string): boolean {
    if (role === 'BACK_PANEL' || role === 'BLIND_PANEL') return false;
    return isHorizontalHost(role) || isVerticalHost(role);
}

/** Host pionowy: cienki w X lub Y; LCS [D,H,T] z D wzdłuż drugiej osi poziomej. */
function verticalHostBox(panel: PanelState): WorldBox {
    const t = translationOf(panel);
    const depthOrSpan = panel.dim_nm.x;
    const h = panel.dim_nm.y;
    const th = panel.dim_nm.z;
    const thinX = Math.abs(t.x) >= Math.abs(t.y);
    if (thinX) {
        return {
            x0: t.x - th / 2, x1: t.x + th / 2,
            y0: t.y - depthOrSpan / 2, y1: t.y + depthOrSpan / 2,
            z0: t.z - h / 2, z1: t.z + h / 2
        };
    }
    return {
        x0: t.x - depthOrSpan / 2, x1: t.x + depthOrSpan / 2,
        y0: t.y - th / 2, y1: t.y + th / 2,
        z0: t.z - h / 2, z1: t.z + h / 2
    };
}

/** Wieniec / półka: LCS [W,D,T], cienki w Z. */
function horizontalHostBox(panel: PanelState): WorldBox {
    const t = translationOf(panel);
    const w = panel.dim_nm.x;
    const d = panel.dim_nm.y;
    const th = panel.dim_nm.z;
    return {
        x0: t.x - w / 2, x1: t.x + w / 2,
        y0: t.y - d / 2, y1: t.y + d / 2,
        z0: t.z - th / 2, z1: t.z + th / 2
    };
}

function hostWorldBox(panel: PanelState): WorldBox {
    return isHorizontalHost(roleUpper(panel))
        ? horizontalHostBox(panel)
        : verticalHostBox(panel);
}

function boxesOverlap(a: WorldBox, b: WorldBox): boolean {
    return (
        Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS &&
        Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > EPS &&
        Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > EPS
    );
}

function pickMarginNm(back: PanelState, target: PanelState): number {
    const fallback = defaultBackOverlapNm();
    const m = back.backMarginsNm;
    if (!m) return fallback;
    const bt = translationOf(back);
    const tt = translationOf(target);
    const role = roleUpper(target);

    if (isHorizontalHost(role)) {
        return tt.z < bt.z ? (m.bottom ?? fallback) : (m.top ?? fallback);
    }

    const axis = backThicknessAxis(back);
    if (axis === 'Y') {
        // Lewy/prawy bok względem pleców na ścianie Y
        return tt.x < bt.x ? (m.left ?? fallback) : (m.right ?? fallback);
    }
    // Plecy na ścianie X: „lewo/prawo” = −Y / +Y wzdłuż głębokości
    return tt.y < bt.y ? (m.left ?? fallback) : (m.right ?? fallback);
}

/** OBB pleców prostopadłych do `back` (ta sama strefa) — styk narożny Rogowy90. */
function perpendicularBackBoxes(back: PanelState, allPanels?: PanelState[]): WorldBox[] {
    if (!allPanels) return [];
    const axis = backThicknessAxis(back);
    const zone = back.zonePrefix || '';
    return allPanels
        .filter((p) => p !== back && p.role === 'BACK_PANEL')
        .filter((p) => (p.zonePrefix || '') === zone)
        .filter((p) => backThicknessAxis(p) !== axis)
        .map(backWorldBox);
}

function clipGroove(
    u_nm: number,
    v_nm: number,
    width_nm: number,
    length_nm: number,
    faceW: number,
    faceH: number
): { u_nm: number; v_nm: number; width_nm: number; length_nm: number } | null {
    const u0 = Math.max(0, u_nm);
    const u1 = Math.min(faceW, u_nm + width_nm);
    const v0 = Math.max(0, v_nm);
    const v1 = Math.min(faceH, v_nm + length_nm);
    if (u1 - u0 <= EPS || v1 - v0 <= EPS) return null;
    return { u_nm: u0, v_nm: v0, width_nm: u1 - u0, length_nm: v1 - v0 };
}

/**
 * Wpust na pionowym hoście (bok / listwa / front):
 * LCS U = rozpiętość pozioma (dim.x), V = wysokość (dim.y); szczelina ≈ grubość pleców.
 */
function grooveOnVertical(
    back: PanelState,
    target: PanelState,
    backBox: WorldBox,
    depth_nm: number
): GrooveIntent | null {
    const t = translationOf(target);
    const faceW = target.dim_nm.x;
    const faceH = target.dim_nm.y;
    const backTh = back.dim_nm.z;
    const backAxis = backThicknessAxis(back);
    const hostThinX = Math.abs(t.x) >= Math.abs(t.y);

    let u_nm: number;
    let width_nm: number;

    if (hostThinX) {
        // U wzdłuż Y (głębokość). Lewy: u=0 od +Y; prawy: u=0 od −Y.
        if (backAxis === 'Y') {
            // Korpus3 / PLECY_Y: cienki pasek w Y
            width_nm = backTh;
            if (t.x < 0) {
                u_nm = (t.y + faceW / 2) - backBox.y1;
            } else {
                u_nm = backBox.y0 - (t.y - faceW / 2);
            }
        } else {
            // Host∩PLECY_X (np. listwa): styk wzdłuż Y
            const y0 = Math.max(t.y - faceW / 2, backBox.y0);
            const y1 = Math.min(t.y + faceW / 2, backBox.y1);
            if (t.x < 0) {
                u_nm = (t.y + faceW / 2) - y1;
            } else {
                u_nm = y0 - (t.y - faceW / 2);
            }
            width_nm = y1 - y0;
        }
    } else {
        // Host cienki w Y (BOK_Y): U wzdłuż X
        const hostX0 = t.x - faceW / 2;
        if (backAxis === 'X') {
            const midX = (backBox.x0 + backBox.x1) / 2;
            u_nm = midX - backTh / 2 - hostX0;
            width_nm = backTh;
        } else {
            const x0 = Math.max(hostX0, backBox.x0);
            const x1 = Math.min(t.x + faceW / 2, backBox.x1);
            u_nm = x0 - hostX0;
            width_nm = x1 - x0;
        }
    }

    const v_nm = backBox.z0 - (t.z - faceH / 2);
    const length_nm = backBox.z1 - backBox.z0;

    const clipped = clipGroove(u_nm, v_nm, width_nm, length_nm, faceW, faceH);
    if (!clipped) return null;

    return {
        targetNodeId: target.id,
        feature: {
            type: 'groove',
            face: '+Z',
            params: { ...clipped, depth_nm: Math.min(depth_nm, target.dim_nm.z) }
        }
    };
}

/**
 * Wpust na wieńcu / półce: LCS U=szerokość (X), V=głębokość (Y); jeden wymiar ≈ T pleców.
 *
 * V na FACE_Z_PLUS rośnie z mesh +Y (= CAD +Z po mapowaniu). Po BOTTOM [90,180,0]
 * CAD +Z → świat +Y (tył), więc v=0 = przód — jak na górze [−90,0,0].
 * Stary BOTTOM [90,0,0] miał CAD +Z → −Y (przód), stąd osobna gałąź isBottom.
 */
function horizontalMeshVPointsToWorldBack(target: PanelState): boolean {
    const { rotation } = target.localMatrix.decompose();
    // CAD +Z (głębokość panelu w LCS [W,D,T]→mesh) w świecie
    const cadZ = rotation.rotateVec3(new Vec3(0, 0, 1));
    return cadZ.y > 0.5;
}

function horizontalMeshUPointsToWorldRight(target: PanelState): boolean {
    const { rotation } = target.localMatrix.decompose();
    const cadX = rotation.rotateVec3(new Vec3(1, 0, 0));
    return cadX.x > 0.5;
}

function grooveOnHorizontal(
    back: PanelState,
    target: PanelState,
    backBox: WorldBox,
    depth_nm: number,
    allPanels?: PanelState[]
): GrooveIntent | null {
    const t = translationOf(target);
    const faceW = target.dim_nm.x;
    const faceD = target.dim_nm.y;
    const backTh = back.dim_nm.z;
    const axis = backThicknessAxis(back);
    const vZeroAtBack = !horizontalMeshVPointsToWorldBack(target);
    const uZeroAtRight = !horizontalMeshUPointsToWorldRight(target);

    let u_nm: number;
    let width_nm: number;
    let v_nm: number;
    let length_nm: number;

    const verticalSides = allPanels
        ? allPanels.filter((p) => {
            const r = roleUpper(p);
            if (!isVerticalHost(r)) return false;
            if (isCornerNailer(p)) return false;
            return true;
        })
        : [];

    const targetZ = t.z;
    const targetHalfTh = target.dim_nm.z / 2;

    if (axis === 'Y') {
        const hostX0 = t.x - faceW / 2;
        const hostX1 = t.x + faceW / 2;

        let x0 = Math.max(hostX0, backBox.x0);
        let x1 = Math.min(hostX1, backBox.x1);

        let hasLeftLimitingSide = false;
        let hasRightLimitingSide = false;

        for (const side of verticalSides) {
            const sBox = verticalHostBox(side);
            const inZ = sBox.z1 > targetZ - targetHalfTh - EPS && sBox.z0 < targetZ + targetHalfTh + EPS;
            if (!inZ) continue;

            const overlapsY = sBox.y0 <= backBox.y1 + 25_000_000 && sBox.y1 >= backBox.y0 - 25_000_000;
            if (!overlapsY) continue;

            const isRightOuter = sBox.x1 >= hostX1 - 5_000_000;
            const isLeftOuter = sBox.x0 <= hostX0 + 5_000_000;

            // Boczki zewnętrzne ograniczają wieniec zawsze (wieniec kończy się na ich wewnętrznym licu),
            // nawet jeśli boczek został skrócony w Y przez plecy (Option 3):
            if (isRightOuter) {
                hasRightLimitingSide = true;
                x1 = Math.min(x1, sBox.x0);
            } else if (isLeftOuter) {
                hasLeftLimitingSide = true;
                x0 = Math.max(x0, sBox.x1);
            } else {
                // Wewnętrzna przegroda:
                if (sBox.x0 < x1 && sBox.x1 >= x1 - EPS) {
                    x1 = Math.min(x1, sBox.x0);
                }
                if (sBox.x1 > x0 && sBox.x0 <= x0 + EPS) {
                    x0 = Math.max(x0, sBox.x1);
                }
            }
        }

        // Styk narożny z plecami prostopadłymi (Rogowy90): wpust na wieńcu (piła na przestrzał)
        // przechodzi przez całą szerokość do krawędzi formatki (skrzyżowanie w narożu).
        const perp = perpendicularBackBoxes(back, allPanels);
        for (const pb of perp) {
            if (Math.abs(pb.x1 - x0) <= EPS) { x0 = pb.x0; }
            if (Math.abs(pb.x0 - x1) <= EPS) { x1 = pb.x1; }
        }

        if (!hasLeftLimitingSide && (perp.length > 0 || Math.abs(x0 - hostX0) < 50_000_000)) {
            x0 = hostX0;
        }
        if (!hasRightLimitingSide && Math.abs(x1 - hostX1) < 50_000_000) {
            x1 = hostX1;
        }

        x0 = Math.max(x0, hostX0);
        x1 = Math.min(x1, hostX1);
        if (x1 - x0 <= EPS) return null;

        u_nm = x0 - hostX0;
        width_nm = x1 - x0;
        length_nm = backTh;
        if (vZeroAtBack) {
            v_nm = (t.y + faceD / 2) - backBox.y1;
        } else {
            v_nm = backBox.y0 - (t.y - faceD / 2);
        }
    } else {
        const midX = (backBox.x0 + backBox.x1) / 2;
        u_nm = midX - backTh / 2 - (t.x - faceW / 2);
        width_nm = backTh;

        const hostY0 = t.y - faceD / 2;
        const hostY1 = t.y + faceD / 2;

        let y0 = Math.max(hostY0, backBox.y0);
        let y1 = Math.min(hostY1, backBox.y1);

        let hasBottomLimitingSide = false;
        let hasTopLimitingSide = false;

        for (const side of verticalSides) {
            const sBox = verticalHostBox(side);
            const inZ = sBox.z1 > targetZ - targetHalfTh - EPS && sBox.z0 < targetZ + targetHalfTh + EPS;
            if (!inZ) continue;

            const overlapsX = sBox.x0 <= backBox.x1 + 25_000_000 && sBox.x1 >= backBox.x0 - 25_000_000;
            if (!overlapsX) continue;

            const isBottomOuter = sBox.y0 <= hostY0 + 5_000_000;
            const isTopOuter = sBox.y1 >= hostY1 - 5_000_000;

            // Boczki zewnętrzne ograniczają wieniec zawsze (wieniec kończy się na ich wewnętrznym licu),
            // nawet jeśli boczek został skrócony w X przez plecy:
            if (isBottomOuter) {
                hasBottomLimitingSide = true;
                y0 = Math.max(y0, sBox.y1);
            } else if (isTopOuter) {
                hasTopLimitingSide = true;
                y1 = Math.min(y1, sBox.y0);
            } else {
                if (sBox.y1 > y0 && sBox.y0 <= y0 + EPS) {
                    y0 = Math.max(y0, sBox.y1);
                }
                if (sBox.y0 < y1 && sBox.y1 >= y1 - EPS) {
                    y1 = Math.min(y1, sBox.y0);
                }
            }
        }

        const perp = perpendicularBackBoxes(back, allPanels);
        for (const pb of perp) {
            if (Math.abs(pb.y1 - y0) <= EPS) { y0 = pb.y0; }
            if (Math.abs(pb.y0 - y1) <= EPS) { y1 = pb.y1; }
        }

        if (!hasBottomLimitingSide && Math.abs(y0 - hostY0) < 50_000_000) {
            y0 = hostY0;
        }
        if (!hasTopLimitingSide && (perp.length > 0 || Math.abs(y1 - hostY1) < 50_000_000)) {
            y1 = hostY1;
        }

        y0 = Math.max(y0, hostY0);
        y1 = Math.min(y1, hostY1);

        if (y1 - y0 <= EPS) return null;

        length_nm = y1 - y0;
        v_nm = vZeroAtBack
            ? (t.y + faceD / 2) - y1
            : y0 - (t.y - faceD / 2);
    }

    if (uZeroAtRight) {
        u_nm = faceW - u_nm - width_nm;
    }

    const clipped = clipGroove(u_nm, v_nm, width_nm, length_nm, faceW, faceD);

    if (!clipped) return null;

    return {
        targetNodeId: target.id,
        feature: {
            type: 'groove',
            face: '+Z',
            params: { ...clipped, depth_nm: Math.min(depth_nm, target.dim_nm.z) }
        }
    };
}

/** TRAVERSE_V: LCS Y←z, Z←y (rotacja [180,0,0] — nie zmieniać). */
function isTraverseVTop(panel: PanelState): boolean {
    const role = roleUpper(panel);
    if (!role.includes('TOP') && !role.includes('WIENIEC_G')) return false;
    const m = panel.lcsMapping;
    if (!m) return false;
    const y = String(m.Y || '').replace(/[+-]/g, '').toUpperCase();
    const z = String(m.Z || '').replace(/[+-]/g, '').toUpperCase();
    return y === 'Z' && z === 'Y';
}

/** Tylny trawers = T2 w id albo loc.y > 0. */
function isRearTraverseV(panel: PanelState): boolean {
    if (!isTraverseVTop(panel)) return false;
    const id = String(panel.id || '');
    if (/T2|_T2/i.test(id)) return true;
    return translationOf(panel).y > 0;
}

/**
 * OBB „stojący” tylko do styku z plecami: dim.y → Z, dim.z → Y.
 * Nie zmienia horizontalHostBox dla FULL / TRAVERSE_H / boczków.
 */
function standingTraverseVHostBox(panel: PanelState): WorldBox {
    const t = translationOf(panel);
    const w = panel.dim_nm.x;
    const h = panel.dim_nm.y;
    const th = panel.dim_nm.z;
    return {
        x0: t.x - w / 2, x1: t.x + w / 2,
        y0: t.y - th / 2, y1: t.y + th / 2,
        z0: t.z - h / 2, z1: t.z + h / 2
    };
}

function isGrooveOpenToEdge(
    u_nm: number,
    v_nm: number,
    width_nm: number,
    length_nm: number,
    faceW: number,
    faceH: number
): boolean {
    return (
        u_nm <= EPS ||
        v_nm <= EPS ||
        u_nm + width_nm >= faceW - EPS ||
        v_nm + length_nm >= faceH - EPS
    );
}

/**
 * Wcięcie tylko na tylnym TRAVERSE_V (rotacji nie zmieniać: [180,0,0]).
 * OUTER FACE_Z_MINUS — ściana W×100; V przy przeciwległej krawędzi lica;
 * szczelina V = zakładka (11), głębokość = grubość pleców (3).
 */
function grooveOnRearTraverseV(
    back: PanelState,
    target: PanelState,
    backBox: WorldBox,
    depth_nm: number
): GrooveIntent | null {
    const t = translationOf(target);
    const faceW = target.dim_nm.x;
    const faceH = target.dim_nm.y; // 100 mm
    const maxDepth = target.dim_nm.z; // 18 mm
    const backTh = back.dim_nm.z;
    const axis = backThicknessAxis(back);

    let u_nm: number;
    let width_nm: number;
    if (axis === 'Y') {
        u_nm = backBox.x0 - (t.x - faceW / 2);
        width_nm = backBox.x1 - backBox.x0;
    } else {
        const midX = (backBox.x0 + backBox.x1) / 2;
        u_nm = midX - backTh / 2 - (t.x - faceW / 2);
        width_nm = backTh;
    }

    const length_nm = Math.min(depth_nm, faceH);
    const cutDepth_nm = Math.min(backTh, maxDepth);
    const v_nm = faceH - length_nm;

    const clipped = clipGroove(u_nm, v_nm, width_nm, length_nm, faceW, faceH);
    if (!clipped) return null;

    const open = isGrooveOpenToEdge(
        clipped.u_nm, clipped.v_nm, clipped.width_nm, clipped.length_nm, faceW, faceH
    );
    return {
        targetNodeId: target.id,
        feature: {
            type: 'groove',
            face: '-Z',
            params: {
                ...clipped,
                depth_nm: cutDepth_nm,
                ...(open ? { isEdgeNotch: true } : {})
            }
        }
    };
}

export function buildBackGrooves(panels: PanelState[]): GrooveIntent[] {
    const intents: GrooveIntent[] = [];
    const backs = panels.filter((p) => p.role === 'BACK_PANEL');
    if (backs.length === 0) return intents;

    const hosts = panels.filter((p) => isGrooveHost(roleUpper(p)));

    for (const back of backs) {
        const backZone = back.zonePrefix || '';
        const backBox = backWorldBox(back);

        for (const target of hosts) {
            const targetZone = target.zonePrefix || '';
            if (targetZone !== '' && backZone !== '' && targetZone !== backZone) continue;

            const depth_nm = pickMarginNm(back, target);

            // Gdy margines pleców osiąga pełną grubość formatki (np. 18 mm):
            // formatka jest skrócona jednym cięciem do lica pleców, plecy są nakładane na krawędź
            // i nie wykonuje się frezowania wpustu ani wręgu.
            if (depth_nm >= target.dim_nm.z - EPS) continue;

            // W korpusie rogowym: jeśli prostopadłe plecy w tej samej strefie mają odcięcie tego wieńca,
            // to wieniec w narożniku został skrócony na obu ramionach – brak wpustu także dla bieżących pleców.
            if (isHorizontalHost(roleUpper(target))) {
                const perps = backs
                    .filter((p) => p !== back && (p.zonePrefix || '') === backZone)
                    .filter((p) => backThicknessAxis(p) !== backThicknessAxis(back));
                const perpCut = perps.some((p) => pickMarginNm(p, target) >= target.dim_nm.z - EPS);
                if (perpCut) continue;
            }

            if (isRearTraverseV(target)) {
                const hostBox = standingTraverseVHostBox(target);
                if (!boxesOverlap(backBox, hostBox)) continue;
                const intent = grooveOnRearTraverseV(back, target, backBox, depth_nm);
                if (intent) intents.push(intent);
                continue;
            }

            // Przedni TRAVERSE_V: bez wpustu (nie styka się z plecami)
            if (isTraverseVTop(target)) continue;

            const hostBox = hostWorldBox(target);
            if (!boxesOverlap(backBox, hostBox)) continue;

            const intent = isHorizontalHost(roleUpper(target))
                ? grooveOnHorizontal(back, target, backBox, depth_nm, panels)
                : grooveOnVertical(back, target, backBox, depth_nm);
            if (intent) intents.push(intent);
        }
    }

    return intents;
}
