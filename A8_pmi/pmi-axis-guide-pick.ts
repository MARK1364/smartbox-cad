/**
 * Wybór prowadnicy odsunięcia w pikselach ekranu.
 *
 * Czysta matematyka 2D — rzut świata na ekran wstrzykuje narzędzie.
 * Histereza trzyma aktywną oś, gdy kursor dryfuje między bliskimi G i L.
 */

declare const BABYLON: any;

import { Vec3, v3Add, v3Scale } from './dimension-solver';
import type { OffsetGuideCandidate } from './pmi-axis-guides';

export const GUIDE_PICK_PX = 14;
export const GUIDE_HOLD_PX = 20;
export const GUIDE_SWITCH_MARGIN_PX = 4;

export interface ScreenPoint {
    x: number;
    y: number;
    visible?: boolean;
}

export type WorldToScreen = (point: Vec3) => ScreenPoint | null;

export interface GuidePickHit {
    candidate: OffsetGuideCandidate;
    distPx: number;
}

export function distancePointToSegment2D(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): number {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const lenSq = vx * vx + vy * vy;
    if (lenSq <= 1e-9) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
    return Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t));
}

function screenDistanceToGuide(
    cand: OffsetGuideCandidate,
    pointerX: number,
    pointerY: number,
    project: WorldToScreen,
): number | null {
    const p0 = v3Add(cand.originWorld, v3Scale(cand.directionWorld, -cand.length));
    const p1 = v3Add(cand.originWorld, v3Scale(cand.directionWorld, cand.length));
    const s0 = project(p0);
    const s1 = project(p1);
    if (!s0 || !s1) return null;
    if (s0.visible === false && s1.visible === false) return null;
    return distancePointToSegment2D(pointerX, pointerY, s0.x, s0.y, s1.x, s1.y);
}

function preferGlobal(a: GuidePickHit, b: GuidePickHit): GuidePickHit {
    if (Math.abs(a.distPx - b.distPx) > 0.5) return a.distPx < b.distPx ? a : b;
    if (a.candidate.space !== b.candidate.space) {
        return a.candidate.space === 'GLOBAL' ? a : b;
    }
    return a.distPx <= b.distPx ? a : b;
}

export function pickOffsetGuide(
    candidates: OffsetGuideCandidate[],
    pointerX: number,
    pointerY: number,
    project: WorldToScreen,
    opts?: {
        pickPx?: number;
        holdPx?: number;
        switchMarginPx?: number;
        stickyId?: string | null;
    },
): GuidePickHit | null {
    const pickPx = opts?.pickPx ?? GUIDE_PICK_PX;
    const holdPx = opts?.holdPx ?? GUIDE_HOLD_PX;
    const switchMargin = opts?.switchMarginPx ?? GUIDE_SWITCH_MARGIN_PX;
    const stickyId = opts?.stickyId ?? null;

    const hits: GuidePickHit[] = [];
    for (const cand of candidates) {
        if (!cand.valid) continue;
        const dist = screenDistanceToGuide(cand, pointerX, pointerY, project);
        if (dist === null) continue;
        hits.push({ candidate: cand, distPx: dist });
    }
    if (!hits.length) return null;

    let nearest = hits[0];
    for (let i = 1; i < hits.length; i++) {
        nearest = preferGlobal(nearest, hits[i]);
    }

    const sticky = stickyId
        ? hits.find(h => h.candidate.id === stickyId) ?? null
        : null;

    if (sticky && sticky.distPx <= holdPx) {
        const clearlyCloser = nearest.candidate.id !== sticky.candidate.id
            && nearest.distPx + switchMargin < sticky.distPx
            && nearest.distPx <= pickPx;
        if (!clearlyCloser) return sticky;
    }

    if (nearest.distPx > pickPx) return null;
    return nearest;
}

export function createWorldToScreen(scene: any): WorldToScreen | null {
    if (!scene || !scene.activeCamera) return null;
    const engine = scene.getEngine?.();
    if (!engine) return null;

    const viewport = scene.activeCamera.viewport.toGlobal(
        engine.getRenderWidth(),
        engine.getRenderHeight(),
    );
    const transform = scene.getTransformMatrix();
    const identity = BABYLON.Matrix.Identity();

    return (point: Vec3) => {
        const projected = BABYLON.Vector3.Project(
            new BABYLON.Vector3(point.x, point.y, point.z),
            identity,
            transform,
            viewport,
        );
        return {
            x: projected.x,
            y: projected.y,
            visible: projected.z >= 0 && projected.z <= 1,
        };
    };
}
