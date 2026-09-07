/**
 * smartbox-bay-visualizer.ts
 *
 * Wizualizator 3D podświetlający wykrytą wnękę mebla:
 * Podświetla ściany ograniczające wnękę (left, right, bottom, top, back)
 * za pomocą wyraźnych płaszczyzn bazowych, bez zbędnej bryły/kontenera w środku.
 */

import type { DetectedBay } from './smartbox-bay-detector.js';

declare const BABYLON: any;

let offsetPlaneMeshes: any[] = [];

function _clearOffsetPlanes(): void {
    for (const p of offsetPlaneMeshes) {
        if (p && !p.isDisposed()) {
            p.dispose();
        }
    }
    offsetPlaneMeshes = [];
}

/**
 * Podświetla przestrzeń wykrytej wnęki za pomocą płaszczyzn ścian ograniczających.
 */
export function highlightBayInScene(scene: any, bay: DetectedBay): void {
    const B = typeof BABYLON !== 'undefined' ? BABYLON : (globalThis as any).BABYLON;
    if (!scene || !bay || !B) return;

    _clearOffsetPlanes();

    // Płaszczyzny ścian ograniczających wnękę (left, right, bottom, top, back, front)
    if (bay.boundary) {
        const planeMat = new B.StandardMaterial('smartbox_bay_plane_mat', scene);
        planeMat.diffuseColor = new B.Color3(1.0, 0.1, 0.85); // Wyrazista Magenta / Fiolet
        planeMat.emissiveColor = new B.Color3(0.65, 0.05, 0.55);
        planeMat.alpha = 0.45;
        planeMat.backFaceCulling = true;

        const makePlane = (name: string, width: number, height: number, posX: number, posY: number, posZ: number, rotX: number, rotY: number) => {
            const p = B.MeshBuilder.CreatePlane(name, { width: Math.max(1, width), height: Math.max(1, height) }, scene);
            p.material = planeMat;
            p.isPickable = false;
            p.position.x = posX;
            p.position.y = posY;
            p.position.z = posZ;
            p.rotation.x = rotX;
            p.rotation.y = rotY;
            offsetPlaneMeshes.push(p);
        };

        const cx = bay.centerWorldMm.x;
        const cy = bay.centerWorldMm.y;
        const cz = bay.centerWorldMm.z;
        const bw = Math.max(1, bay.boundsMm.width - 2);
        const bh = Math.max(1, bay.boundsMm.height - 2);
        const bd = Math.max(1, bay.boundsMm.depth - 2);

        // Dół (Bottom) — normalna skierowana w górę (+Y w Babylon)
        if (bay.boundary.bottom?.planeCoordMm !== undefined) {
            makePlane('smartbox_plane_bottom', bw, bd, cx, bay.boundary.bottom.planeCoordMm + 1.5, cy, Math.PI / 2, 0);
        }

        // Góra (Top) — normalna skierowana w dół (-Y w Babylon)
        if (bay.boundary.top?.planeCoordMm !== undefined) {
            makePlane('smartbox_plane_top', bw, bd, cx, bay.boundary.top.planeCoordMm - 1.5, cy, -Math.PI / 2, 0);
        }

        // Bok Lewy (Left) — normalna skierowana w prawo (+X w Babylon, do wnętrza szafy)
        if (bay.boundary.left?.planeCoordMm !== undefined) {
            makePlane('smartbox_plane_left', bd, bh, bay.boundary.left.planeCoordMm + 1.5, cz, cy, 0, -Math.PI / 2);
        }

        // Bok Prawy (Right) — normalna skierowana w lewo (-X w Babylon, do wnętrza szafy)
        if (bay.boundary.right?.planeCoordMm !== undefined) {
            makePlane('smartbox_plane_right', bd, bh, bay.boundary.right.planeCoordMm - 1.5, cz, cy, 0, Math.PI / 2);
        }

        // Plecy (Back) — normalna skierowana do przodu (-Z w Babylon, do wnętrza szafy)
        if (bay.boundary.back?.planeCoordMm !== undefined) {
            makePlane('smartbox_plane_back', bw, bh, cx, cz, bay.boundary.back.planeCoordMm - 1.5, 0, 0);
        }

        // Przód (Front) — normalna skierowana do tyłu (+Z w Babylon, do wnętrza szafy)
        if (bay.boundary.frontPlaneYMm !== undefined) {
            makePlane('smartbox_plane_front', bw, bh, cx, cz, bay.boundary.frontPlaneYMm + 1.5, 0, Math.PI);
        }
    }
}

/**
 * Całkowicie wyłącza podświetlenie wnęki i usuwa płaszczyzny podglądu ze sceny.
 */
export function clearBayHighlight(scene?: any): void {
    _clearOffsetPlanes();
}
