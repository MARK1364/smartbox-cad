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

    // Płaszczyzny ścian ograniczających wnękę (left, right, bottom, top, back)
    if (bay.boundary) {
        const planeMat = new B.StandardMaterial('smartbox_bay_plane_mat', scene);
        planeMat.diffuseColor = new B.Color3(1.0, 0.1, 0.85); // Wyraźny Fiolet / Magenta
        planeMat.emissiveColor = new B.Color3(0.6, 0.05, 0.5);
        planeMat.alpha = 0.4;
        planeMat.backFaceCulling = false;

        const makePlane = (name: string, width: number, height: number, posX: number, posY: number, posZ: number, rotX: number, rotY: number) => {
            const p = B.MeshBuilder.CreatePlane(name, { width: Math.max(1, width), height: Math.max(1, height) }, scene);
            p.material = planeMat;
            p.isPickable = false;
            p.position.x = posX;
            p.position.y = posY;
            p.position.z = posZ;
            p.rotation.x = rotX;
            p.rotation.y = rotY;
            p.renderOutline = true;
            p.outlineColor = new B.Color3(1.0, 0.0, 0.8);
            p.outlineWidth = 2.5;
            offsetPlaneMeshes.push(p);
        };

        const cx = bay.centerWorldMm.x;
        const cy = bay.centerWorldMm.y;
        const cz = bay.centerWorldMm.z;
        const bw = bay.boundsMm.width;
        const bh = bay.boundsMm.height;
        const bd = bay.boundsMm.depth;

        // Dół (Bottom) — pozioma płaszczyzna na poziomie planeCoordMm
        if (bay.boundary.bottom?.planeCoordMm !== undefined) {
            makePlane('smartbox_plane_bottom', bw, bd, cx, bay.boundary.bottom.planeCoordMm, cy, Math.PI / 2, 0);
        }

        // Góra (Top) — pozioma płaszczyzna na poziomie planeCoordMm
        if (bay.boundary.top?.planeCoordMm !== undefined) {
            makePlane('smartbox_plane_top', bw, bd, cx, bay.boundary.top.planeCoordMm, cy, Math.PI / 2, 0);
        }

        // Bok Lewy (Left) — pionowa płaszczyzna X = planeCoordMm
        if (bay.boundary.left?.planeCoordMm !== undefined) {
            makePlane('smartbox_plane_left', bd, bh, bay.boundary.left.planeCoordMm, cz, cy, 0, Math.PI / 2);
        }

        // Bok Prawy (Right) — pionowa płaszczyzna X = planeCoordMm
        if (bay.boundary.right?.planeCoordMm !== undefined) {
            makePlane('smartbox_plane_right', bd, bh, bay.boundary.right.planeCoordMm, cz, cy, 0, Math.PI / 2);
        }

        // Plecy (Back) — pionowa płaszczyzna Y = planeCoordMm
        if (bay.boundary.back?.planeCoordMm !== undefined) {
            makePlane('smartbox_plane_back', bw, bh, cx, cz, bay.boundary.back.planeCoordMm, 0, 0);
        }

        // Przód (Front) — pionowa płaszczyzna lica frontowego
        if (bay.boundary.frontPlaneYMm !== undefined) {
            makePlane('smartbox_plane_front', bw, bh, cx, cz, bay.boundary.frontPlaneYMm, 0, 0);
        }
    }
}

/**
 * Całkowicie wyłącza podświetlenie wnęki i usuwa płaszczyzny podglądu ze sceny.
 */
export function clearBayHighlight(scene?: any): void {
    _clearOffsetPlanes();
}
