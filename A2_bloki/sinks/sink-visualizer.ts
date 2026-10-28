/**
 * A2_bloki / sinks — sink-visualizer.ts
 *
 * Wizualizacja i podgląd (ghost) zlewu podczas wskazywania 3D lub przeciągania na formatkę/blat.
 */

import type { DetectedPanelSurface } from '../handles/handle-detector.js';
import type { SinkParamsMm } from './sink-types.js';
import { DEFAULT_SINK_PARAMS, normalizeSinkParams, computeSinkLayout } from './sink-types.js';

export const SINK_HIGHLIGHT_PANEL_NAME = '__sink_panel_highlight';
export const SINK_FLANGE_GHOST_NAME = '__sink_flange_ghost';
export const SINK_BASIN_GHOST_NAME = '__sink_basin_ghost';

/**
 * Podświetla zarys formatki i wyświetla realistyczny podgląd zlewu (kołnierz + komora wycięcia) w miejscu kursora.
 */
export function highlightSinkSurface(
    scene: any,
    surface: DetectedPanelSurface,
    sinkParams: Partial<SinkParamsMm> = {}
): void {
    const B = (typeof window !== 'undefined' && (window as any).BABYLON) ? (window as any).BABYLON : (globalThis as any).BABYLON;
    if (!scene || !surface || !B) return;

    clearSinkHighlight(scene);

    const targetMesh = surface.panelRootMesh || surface.pickedMesh?.parent || surface.pickedMesh;
    if (!targetMesh) return;

    const params = normalizeSinkParams({ ...DEFAULT_SINK_PARAMS, ...sinkParams });
    const layout = computeSinkLayout(params);

    // 1. Zarys formatki (błękitna neonowa ramka)
    const outlineBox = B.MeshBuilder.CreateBox(SINK_HIGHLIGHT_PANEL_NAME, {
        width: surface.widthMm + 2,
        height: surface.heightMm + 2,
        depth: surface.thicknessMm + 2,
    }, scene);

    outlineBox.parent = targetMesh;
    outlineBox.position.set(0, 0, 0);
    outlineBox.rotation.set(0, 0, 0);
    outlineBox.isPickable = false;

    const outlineMat = new B.StandardMaterial(`${SINK_HIGHLIGHT_PANEL_NAME}_mat`, scene);
    outlineMat.diffuseColor = new B.Color3(0.1, 0.6, 1.0);
    outlineMat.emissiveColor = new B.Color3(0.05, 0.4, 0.8);
    outlineMat.alpha = 0.15;
    outlineMat.backFaceCulling = false;
    outlineMat.disableLighting = true;
    outlineBox.material = outlineMat;

    outlineBox.enableEdgesRendering();
    outlineBox.edgesWidth = 2.5;
    outlineBox.edgesColor = new B.Color4(0.2, 0.8, 1.0, 0.9);

    // 2. Pozycja ghosta zlewu: w punkcie trafienia kursora myszy lub na środku formatki
    const posX = surface.localCoordMm ? surface.localCoordMm.x : 0;
    const posY = surface.localCoordMm ? surface.localCoordMm.y : 0;

    // 3. Podgląd kołnierza zewnętrznego (wystaje nad płytę)
    const flangeGhost = B.MeshBuilder.CreateBox(SINK_FLANGE_GHOST_NAME, {
        width: layout.kolnierzWidthMm,
        height: layout.kolnierzDepthMm,
        depth: layout.kolnierzHeightMm,
    }, scene);

    flangeGhost.parent = targetMesh;
    const flangeZ = surface.faceZ + surface.normalZ * (layout.kolnierzHeightMm / 2);
    flangeGhost.position.set(posX, posY, flangeZ);
    flangeGhost.rotation.set(0, 0, 0);
    flangeGhost.isPickable = false;

    const flangeMat = new B.StandardMaterial(`${SINK_FLANGE_GHOST_NAME}_mat`, scene);
    flangeMat.diffuseColor = new B.Color3(0.6, 0.75, 0.9);
    flangeMat.emissiveColor = new B.Color3(0.2, 0.45, 0.7);
    flangeMat.alpha = 0.6;
    flangeMat.disableLighting = true;
    flangeGhost.material = flangeMat;

    flangeGhost.enableEdgesRendering();
    flangeGhost.edgesWidth = 2.0;
    flangeGhost.edgesColor = new B.Color4(0.2, 0.8, 1.0, 1.0);

    // 4. Podgląd komory wpuszczanej / wycięcia w płycie (pomarańczowo-czerwony zarys cięcia)
    const basinGhost = B.MeshBuilder.CreateBox(SINK_BASIN_GHOST_NAME, {
        width: layout.komoraWidthMm,
        height: layout.komoraDepthMm,
        depth: layout.komoraHeightMm,
    }, scene);

    basinGhost.parent = targetMesh;
    const basinZ = surface.faceZ - surface.normalZ * (layout.komoraHeightMm / 2);
    basinGhost.position.set(posX, posY, basinZ);
    basinGhost.rotation.set(0, 0, 0);
    basinGhost.isPickable = false;

    const basinMat = new B.StandardMaterial(`${SINK_BASIN_GHOST_NAME}_mat`, scene);
    basinMat.diffuseColor = new B.Color3(1.0, 0.4, 0.2);
    basinMat.emissiveColor = new B.Color3(0.8, 0.2, 0.1);
    basinMat.alpha = 0.35;
    basinMat.disableLighting = true;
    basinGhost.material = basinMat;

    basinGhost.enableEdgesRendering();
    basinGhost.edgesWidth = 2.0;
    basinGhost.edgesColor = new B.Color4(1.0, 0.4, 0.1, 0.95);
}

/**
 * Usuwa podświetlenie zarysu formatki i podgląd zlewu ze sceny.
 */
export function clearSinkHighlight(scene?: any): void {
    const s = scene || (typeof window !== 'undefined' ? (window as any).__cad_scene : null);
    if (!s) return;

    for (const name of [SINK_HIGHLIGHT_PANEL_NAME, SINK_FLANGE_GHOST_NAME, SINK_BASIN_GHOST_NAME]) {
        const mesh = s.getMeshByName?.(name);
        if (mesh) {
            try { mesh.dispose(); } catch {}
        }
    }
}
