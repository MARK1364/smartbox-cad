/**
 * A5_smartparts / handles — handle-visualizer.ts
 * Wizualizator zarysu formatki i podglądu uchwytu (Handle Visualizer).
 *
 * Rysuje neonowy obrys formatki (zarys formatki) oraz półprzezroczysty podgląd
 * położenia uchwytu w czasie rzeczywistym podczas przeciągania.
 */

import { type DetectedPanelSurface } from './handle-detector.js';
import { type HandleParamsMm, DEFAULT_HANDLE_PARAMS } from './handle-types.js';
import { computeHandleLayout } from './handle-engine.js';

const PANEL_HIGHLIGHT_MESH_NAME = '__handle_panel_outline_highlight';
const HANDLE_GHOST_MESH_NAME = '__handle_ghost_preview';

/**
 * Podświetla zarys formatki i wyświetla podgląd uchwytu na jej powierzchni.
 */
export function highlightPanelSurface(
    scene: any,
    surface: DetectedPanelSurface,
    handleParams: Partial<HandleParamsMm> = {}
): void {
    const B = typeof (window as any).BABYLON !== 'undefined' ? (window as any).BABYLON : (globalThis as any).BABYLON;
    if (!scene || !surface || !B) return;

    clearPanelHighlight(scene);

    const mergedParams: HandleParamsMm = {
        ...DEFAULT_HANDLE_PARAMS,
        ...handleParams,
        placementPreset: handleParams.placementPreset || surface.suggestedPreset,
    };

    const targetMesh = surface.panelRootMesh || surface.pickedMesh?.parent || surface.pickedMesh;
    if (!targetMesh) return;

    // 1. Zarys formatki (neonowa ramka wokół całej płyty)
    const outlineBox = B.MeshBuilder.CreateBox(PANEL_HIGHLIGHT_MESH_NAME, {
        width: surface.widthMm + 2,
        height: surface.heightMm + 2,
        depth: surface.thicknessMm + 2,
    }, scene);

    outlineBox.parent = targetMesh;
    outlineBox.position.set(0, 0, 0);
    outlineBox.rotation.set(0, 0, 0);
    outlineBox.isPickable = false;

    const outlineMat = new B.StandardMaterial(`${PANEL_HIGHLIGHT_MESH_NAME}_mat`, scene);
    outlineMat.diffuseColor = new B.Color3(0.1, 0.6, 1.0); // Błękit / Cyan
    outlineMat.emissiveColor = new B.Color3(0.05, 0.4, 0.8);
    outlineMat.alpha = 0.15;
    outlineMat.backFaceCulling = false;
    outlineMat.disableLighting = true;
    outlineBox.material = outlineMat;

    outlineBox.enableEdgesRendering();
    outlineBox.edgesWidth = 3.0;
    outlineBox.edgesColor = new B.Color4(0.2, 0.8, 1.0, 0.95);

    // 2. Podgląd uchwytu (ghost) w sugerowanym miejscu
    const layout = computeHandleLayout(mergedParams, surface.widthMm, surface.heightMm);
    const isHoriz = layout.orientation === 'HORIZONTAL';

    const barW = isHoriz ? mergedParams.totalLengthMm : mergedParams.thicknessMm;
    const barH = isHoriz ? mergedParams.thicknessMm : mergedParams.totalLengthMm;
    const barD = mergedParams.thicknessMm;

    const ghostMesh = B.MeshBuilder.CreateBox(HANDLE_GHOST_MESH_NAME, {
        width: barW,
        height: barH,
        depth: barD,
    }, scene);

    ghostMesh.parent = targetMesh;
    // Odsunięcie ghosta na zewnątrz lica formatki
    const handleZ = surface.faceZ + surface.normalZ * (mergedParams.depthMm - barD / 2);
    ghostMesh.position.set(layout.center.x, layout.center.y, handleZ);
    ghostMesh.rotation.set(0, 0, 0);
    ghostMesh.isPickable = false;

    const ghostMat = new B.StandardMaterial(`${HANDLE_GHOST_MESH_NAME}_mat`, scene);
    ghostMat.diffuseColor = new B.Color3(0.9, 0.95, 1.0);
    ghostMat.emissiveColor = new B.Color3(0.4, 0.7, 1.0);
    ghostMat.alpha = 0.65;
    ghostMat.disableLighting = true;
    ghostMesh.material = ghostMat;

    ghostMesh.enableEdgesRendering();
    ghostMesh.edgesWidth = 2.0;
    ghostMesh.edgesColor = new B.Color4(0.1, 0.9, 1.0, 1.0);
}

/**
 * Usuwa podświetlenie zarysu formatki i podgląd uchwytu ze sceny.
 */
export function clearPanelHighlight(scene?: any): void {
    const s = scene || (typeof (window as any).BABYLON !== 'undefined' ? (window as any).__cad_scene : null);
    if (!s) return;

    const outline = s.getMeshByName(PANEL_HIGHLIGHT_MESH_NAME);
    if (outline) {
        try { outline.dispose(); } catch {}
    }

    const ghost = s.getMeshByName(HANDLE_GHOST_MESH_NAME);
    if (ghost) {
        try { ghost.dispose(); } catch {}
    }
}
