/**
 * A2_bloki / sinks — sink-mesh.ts
 * Wizualizacja 3D zlewu: parametryczne bryły kołnierza i komory wpuszczanej.
 *
 * Kołnierz zewnętrzny: prostopadłościan o szerokości W, głębokości D, wysokości np. 30 mm leżący na płycie (Z >= 0).
 * Komora wpuszczana: mniejszy prostopadłościan schowany w płycie i poniżej niej (Z < 0).
 */

import type { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { findPanelRootMesh } from '../handles/handle-mesh.js';
import type { SinkParamsMm, SinkComputedLayoutMm } from './sink-types.js';
import { computeSinkLocalCoords, normalizeSinkParams, computeSinkLayout, SMARTPART_SINK_TYPE } from './sink-types.js';

export function disposeSinkVisual(scene: any, cntNodeId: string): void {
    if (!scene) return;
    const meshName = `sink_mesh_${cntNodeId}`;
    const existingMesh = scene.getMeshByName?.(meshName);
    if (existingMesh) existingMesh.dispose();

    const tnName = `sink_root_${cntNodeId}`;
    const existingTn = scene.getTransformNodeByName?.(tnName);
    if (existingTn) existingTn.dispose();

    const flange = scene.getMeshByName?.(`sink_flange_${cntNodeId}`);
    if (flange) flange.dispose();

    const basin = scene.getMeshByName?.(`sink_basin_${cntNodeId}`);
    if (basin) basin.dispose();
}

function getSinkScene(): any {
    return ContextManager.instance?.viewport?.scene || (typeof window !== 'undefined' ? (window as any)?.__cad_scene : null) || (globalThis as any)?.__cad_scene;
}

/**
 * Buduje parametryczną reprezentację 3D zlewu (kołnierz + komora) w silniku Babylon.js.
 */
export function buildSinkParametricMesh(
    cntNode: CADNode,
    params: SinkParamsMm,
    layout: SinkComputedLayoutMm,
    faceZ: number = 0,
    normalZ: number = 1
): void {
    const scene = getSinkScene();
    if (!scene) return;

    const B = (typeof window !== 'undefined' && (window as any).BABYLON) ? (window as any).BABYLON : (globalThis as any).BABYLON;
    if (!B || typeof B.TransformNode !== 'function' || !B.MeshBuilder) return;

    disposeSinkVisual(scene, cntNode.id);

    const genParams = (cntNode.domainData as any)?.generatorParams || {};
    const isModelVis = (cntNode.domainData as any)?.visible !== false;
    const parentPanelId = genParams.targetPanelId || cntNode.parent?.id;
    const doc = ContextManager.instance?.document || (typeof window !== 'undefined' ? (window as any)?.__cad_document : null);
    const parentNode = parentPanelId ? doc?.findNode(parentPanelId) : null;
    const isParentVis = (parentNode?.domainData as any)?.visible !== false;
    const isEnabled = isModelVis && isParentVis;

    if (!isEnabled) {
        return;
    }

    const rootTn = new B.TransformNode(`sink_root_${cntNode.id}`, scene);
    rootTn.metadata = { nodeId: cntNode.id, isSink: true, type: 'smartpart_sink' };

    const panelRoot = findPanelRootMesh(scene, parentPanelId);
    const containerViews = (ContextManager.instance as any)?.containerViews;
    const cView = cntNode.domainData ? containerViews?.get(cntNode.domainData) : null;
    const containerRoot = cView?.rootNode;

    const panelWMm = genParams.panelWidthMm || (layout.kolnierzWidthMm * 2);
    const panelHMm = genParams.panelHeightMm || (layout.kolnierzDepthMm * 2);
    const face = params.face || (normalZ > 0 ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS');

    const { localX, localY } = computeSinkLocalCoords(params.u_mm, params.v_mm, panelWMm, panelHMm, face);

    if (containerRoot) {
        rootTn.parent = containerRoot;
        rootTn.position.set(0, 0, 0);
        rootTn.rotation.set(0, 0, 0);
    } else if (panelRoot) {
        rootTn.parent = panelRoot;
        rootTn.position.set(localX, localY, faceZ);
    } else {
        rootTn.position.set(localX, localY, faceZ);
    }

    const {
        kolnierzWidthMm,
        kolnierzDepthMm,
        kolnierzHeightMm,
        komoraWidthMm,
        komoraDepthMm,
        komoraHeightMm,
    } = layout;

    // 1. Kołnierz zewnętrzny (wystaje ponad płytę w stronę normalnej normalZ)
    const flangeMesh = B.MeshBuilder.CreateBox(`sink_flange_${cntNode.id}`, {
        width: kolnierzWidthMm,
        height: kolnierzDepthMm,
        depth: kolnierzHeightMm,
    }, scene);

    flangeMesh.position.set(0, 0, normalZ * (kolnierzHeightMm / 2));
    flangeMesh.parent = rootTn;

    const flangeMat = new B.StandardMaterial(`sink_flange_mat_${cntNode.id}`, scene);
    flangeMat.diffuseColor = B.Color3.FromHexString(params.colorKolnierzHex || '#94a3b8');
    flangeMesh.material = flangeMat;

    const meshMeta = {
        nodeId: cntNode.id,
        containerId: cntNode.id,
        isSink: true,
        type: 'smartpart_sink',
        model: cntNode.domainData,
    };
    flangeMesh.metadata = meshMeta;
    flangeMesh.isPickable = true;

    // 2. Komora wpuszczana (schowana w głąb płyty i poniżej)
    const basinMesh = B.MeshBuilder.CreateBox(`sink_basin_${cntNode.id}`, {
        width: komoraWidthMm,
        height: komoraDepthMm,
        depth: komoraHeightMm,
    }, scene);

    basinMesh.position.set(0, 0, -normalZ * (komoraHeightMm / 2));
    basinMesh.parent = rootTn;

    const basinMat = new B.StandardMaterial(`sink_basin_mat_${cntNode.id}`, scene);
    basinMat.diffuseColor = B.Color3.FromHexString(params.colorKomoraHex || '#64748b');
    basinMesh.material = basinMat;
    basinMesh.metadata = meshMeta;
    basinMesh.isPickable = true;
}

/**
 * Przebudowuje i synchronizuje siatki 3D wszystkich zlewów w dokumencie CAD.
 */
export function syncSinkMeshesFromDocument(document: any): void {
    if (!document?.rootNode) return;
    const stack: any[] = [document.rootNode];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (Array.isArray(node.children)) {
            for (const ch of node.children) stack.push(ch);
        }

        const model = node.domainData;
        if (!model) continue;
        const isSink = model.role === 'SMARTPART_SINK' || model.generatorParams?.type === SMARTPART_SINK_TYPE;
        if (!isSink) continue;

        if (model.visible === false) {
            const scene = getSinkScene();
            disposeSinkVisual(scene, node.id);
            continue;
        }

        const gp = model.generatorParams || {};
        const faceZ = gp.faceZ ?? 0;
        const normalZ = gp.normalZ ?? 1;
        const panelWMm = gp.panelWidthMm || 1000;
        const panelHMm = gp.panelHeightMm || 600;
        const params = normalizeSinkParams(gp, panelWMm, panelHMm);
        const layout = computeSinkLayout(params);

        buildSinkParametricMesh(node, params, layout, faceZ, normalZ);
    }
}
