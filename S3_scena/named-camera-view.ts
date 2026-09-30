/**
 * Nazwane rzuty kostki (przód/góra/…). SSOT kątów ArcRotateCamera.
 *
 * Widok z góry/dołu: beta ≈ 0 / π z up = +Y (ArcRotate wymaga tego układu).
 * Odsunięcie od bieguna 0.00001 rad (~0.00057°) daje parallax ortho poniżej 0.007 mm
 * na wysokości 700 mm — eliminuje rozdwojenie krawędzi w rzucie ortogonalnym.
 */

export type NamedSceneView = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

export type CameraUp = { x: number; y: number; z: number };

export const WORLD_Y_UP: CameraUp = { x: 0, y: 1, z: 0 };

/** Prawie pion z góry — stabilne dla ArcRotate z up=Y. Parallax ~0.007 mm. */
export const TOP_BETA = 0.00001;
/** Prawie pion od dołu. */
export const BOTTOM_BETA = Math.PI - 0.00001;

export function namedCameraView(view: string): { alpha: number; beta: number; up: CameraUp } {
    switch (String(view || '').toLowerCase()) {
        case 'front':
            return { alpha: -Math.PI / 2, beta: Math.PI / 2, up: WORLD_Y_UP };
        case 'back':
            return { alpha: Math.PI / 2, beta: Math.PI / 2, up: WORLD_Y_UP };
        case 'left':
            return { alpha: Math.PI, beta: Math.PI / 2, up: WORLD_Y_UP };
        case 'right':
            return { alpha: 0, beta: Math.PI / 2, up: WORLD_Y_UP };
        case 'top':
            return { alpha: -Math.PI / 2, beta: TOP_BETA, up: WORLD_Y_UP };
        case 'bottom':
            return { alpha: -Math.PI / 2, beta: BOTTOM_BETA, up: WORLD_Y_UP };
        default:
            return { alpha: -Math.PI / 4, beta: Math.PI / 3, up: WORLD_Y_UP };
    }
}

/** Przesunięcie rzutu ortho [mm] przy nachyleniu od pionu. */
export function orthoParallaxMm(heightDeltaMm: number, betaFromVerticalRad: number): number {
    return heightDeltaMm * Math.tan(betaFromVerticalRad);
}