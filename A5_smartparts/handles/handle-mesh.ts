/**
 * A5_smartparts / handles — handle-mesh.ts
 * Generowanie wizualizacji 3D uchwytu w silniku Babylon.js.
 *
 * Tworzy belkę główną i stopki montażowe oparte o powierzchnię lica formatki.
 */

import type { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import type { HandleParamsMm } from './handle-types.js';
import type { HandleComputedLayoutMm } from './handle-layout.js';

/**
 * Znajduje główny węzeł formatki w Babylon.js (this.root w PanelView).
 */
export function findPanelRootMesh(scene: any, panelId: string): any | null {
    if (!panelId) return null;
    const syncAdapter = (ContextManager.instance as any)?.sceneSyncAdapter;
    const fromSync = syncAdapter?.getMeshForNodeId?.(panelId);
    if (fromSync) return fromSync;

    const panelViews = (ContextManager.instance as any)?.panelViews;
    if (panelViews) {
        for (const [pModel, pView] of panelViews.entries()) {
            if (pModel?.id === panelId && pView?.root) {
                return pView.root;
            }
        }
    }

    if (scene) {
        const tn = scene.getTransformNodeByName?.(panelId);
        if (tn) return tn;
        const faceM = scene.getMeshByName?.(`face_FACE_Z_MINUS_${panelId}`);
        if (faceM && faceM.parent) return faceM.parent;
    }
    return null;
}

/**
 * Buduje parametryczny model 3D uchwytu w scenie Babylon.js
 * (belka pozioma/pionowa + stopki montażowe oparte o formatkę).
 */
export function buildHandleParametricMesh(
    cntNode: CADNode,
    params: HandleParamsMm,
    layout: HandleComputedLayoutMm,
    faceZParam?: number,
    normalZParam?: number
): void {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    const scene = ContextManager.instance?.viewport?.scene || win?.__cad_scene;
    const B = win?.BABYLON || (typeof (globalThis as any).BABYLON !== 'undefined' ? (globalThis as any).BABYLON : null);
    if (!scene || !B) return;

    const genParams = (cntNode.domainData as any)?.generatorParams || {};
    const defaultThickness = typeof genParams.panelThicknessMm === 'number' && Number.isFinite(genParams.panelThicknessMm)
        ? genParams.panelThicknessMm
        : 0;
    const faceZ = faceZParam ?? genParams.faceZ ?? -defaultThickness / 2;
    const normalZ = normalZParam ?? genParams.normalZ ?? -1;

    const meshName = `handle_mesh_${cntNode.id}`;
    const existingMesh = scene.getMeshByName(meshName);
    if (existingMesh) {
        existingMesh.dispose();
    }

    const { totalLengthMm, depthMm, thicknessMm, footDiameterMm } = params;
    const isHoriz = layout.orientation === 'HORIZONTAL';

    // 1. Belka główna uchwytu (bar)
    const barWidth = isHoriz ? totalLengthMm : thicknessMm;
    const barHeight = isHoriz ? thicknessMm : totalLengthMm;
    const barDepth = thicknessMm;

    const barMesh = B.MeshBuilder.CreateBox(`${meshName}_bar`, {
        width: barWidth,
        height: barHeight,
        depth: barDepth,
    }, scene);

    // Pozycja belki: wysunięta w stronę normalnej zewnętrznej lica
    barMesh.position.x = 0;
    barMesh.position.y = 0;
    barMesh.position.z = normalZ * (depthMm - barDepth / 2);

    const meshesToMerge: any[] = [barMesh];

    // 2. Stopki montażowe (feet) łączące belkę z licem formatki
    const footLen = Math.max(1, depthMm - barDepth);
    const footDiam = Math.max(4, footDiameterMm || 10);

    const holePositions = layout.holes.map(h => ({
        x: h.x - layout.center.x,
        y: h.y - layout.center.y,
    }));

    for (let i = 0; i < holePositions.length; i++) {
        const hp = holePositions[i];
        const foot = B.MeshBuilder.CreateCylinder(`${meshName}_foot_${i}`, {
            height: footLen,
            diameter: footDiam,
            tessellation: 16,
        }, scene);

        // Cylinder w Babylonie stoi pionowo w osi Y -> obracamy o 90 stopni, aby biegł wzdłuż Z
        foot.rotation.x = Math.PI / 2;
        foot.position.x = hp.x;
        foot.position.y = hp.y;
        foot.position.z = normalZ * (footLen / 2);

        meshesToMerge.push(foot);
    }

    // Scalenie elementów uchwytu w jeden zoptymalizowany mesh
    const merged = B.Mesh.MergeMeshes(meshesToMerge, true, true, undefined, false, true);
    if (!merged) return;

    merged.name = meshName;
    merged.isPickable = true;

    // Jasny, estetyczny materiał (szczotkowana stal / chrom / kolor)
    const mat = new B.StandardMaterial(`${meshName}_mat`, scene);
    if (params.color) {
        mat.diffuseColor = new B.Color3(params.color.r, params.color.g, params.color.b);
    }
    mat.emissiveColor = new B.Color3(0.2, 0.22, 0.25);
    mat.specularColor = new B.Color3(0.85, 0.85, 0.88);
    mat.specularPower = 32;
    merged.material = mat;

    merged.enableEdgesRendering();
    merged.edgesWidth = 1.5;
    merged.edgesColor = new B.Color4(0.3, 0.35, 0.4, 0.8);

    merged.metadata = {
        type: 'smartpart_handle',
        nodeId: cntNode.id,
        params,
        layout,
    };

    // Podpięcie pod węzeł rodzica formatki w scenie Babylona
    const parentPanelId = genParams.targetPanelId;
    const panelRoot = findPanelRootMesh(scene, parentPanelId);
    if (panelRoot) {
        merged.parent = panelRoot;
        merged.position.set(layout.center.x, layout.center.y, faceZ);
        merged.rotation.set(0, 0, 0);
    }
}
