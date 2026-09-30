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
    /** LCS po mapowaniu: x=width, y=height, z=thickness */
    dim_nm: { x: number; y: number; z: number };
    localMatrix: Mat4;
    zonePrefix?: string;
    backMarginsNm?: { left?: number; right?: number; top?: number; bottom?: number };
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

function grooveOnHorizontal(
    back: PanelState,
    target: PanelState,
    backBox: WorldBox,
    depth_nm: number
): GrooveIntent | null {
    const t = translationOf(target);
    const faceW = target.dim_nm.x;
    const faceD = target.dim_nm.y;
    const backTh = back.dim_nm.z;
    const axis = backThicknessAxis(back);
    // v=0 przy tyle tylko gdy CAD +Z idzie w przód (−Y) — stary LCS dołu
    const vZeroAtBack = !horizontalMeshVPointsToWorldBack(target);

    let u_nm: number;
    let width_nm: number;
    let v_nm: number;
    let length_nm: number;

    if (axis === 'Y') {
        // PLECY_Y: pasek równoległy do X, przy +Y
        u_nm = backBox.x0 - (t.x - faceW / 2);
        width_nm = backBox.x1 - backBox.x0;
        length_nm = backTh;
        if (vZeroAtBack) {
            v_nm = (t.y + faceD / 2) - backBox.y1;
        } else {
            v_nm = backBox.y0 - (t.y - faceD / 2);
        }
    } else {
        // PLECY_X: pasek równoległy do Y, przy −X
        const midX = (backBox.x0 + backBox.x1) / 2;
        u_nm = midX - backTh / 2 - (t.x - faceW / 2);
        width_nm = backTh;
        const y0 = Math.max(t.y - faceD / 2, backBox.y0);
        const y1 = Math.min(t.y + faceD / 2, backBox.y1);
        length_nm = y1 - y0;
        v_nm = vZeroAtBack
            ? (t.y + faceD / 2) - y1
            : y0 - (t.y - faceD / 2);
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

            const hostBox = hostWorldBox(target);
            if (!boxesOverlap(backBox, hostBox)) continue;

            const depth_nm = pickMarginNm(back, target);
            const intent = isHorizontalHost(roleUpper(target))
                ? grooveOnHorizontal(back, target, backBox, depth_nm)
                : grooveOnVertical(back, target, backBox, depth_nm);
            if (intent) intents.push(intent);
        }
    }

    return intents;
}
