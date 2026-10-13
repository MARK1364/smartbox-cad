/**
 * A5_smartparts / handles — handle-mesh.ts
 * Wizualizacja 3D uchwytu: preferuj statyczny GLB z B1, inaczej mesh parametryczny.
 */

import type { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { HardwareLoader } from '../../B1_biblioteka/hardware-loader.js';
import { handleGlbTemplateId } from '../../B1_biblioteka/uchwyty/handles-from-catalog.js';
import type { HandleParamsMm } from './handle-types.js';
import { resolveHandleGlbFile } from './handle-types.js';
import type { HandleComputedLayoutMm } from './handle-layout.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROTACJA GLB — 3 osobne kroki (kwaterniony, NIE suma Eulerów).
 *
 * Panel lokalnie: X = szerokość, Y = wysokość, Z = normalna lica.
 *
 * 1) BASE_DEG     — przyklej model do lica (stopy na płaszczyźnie)
 * 2) OUTWARD      — wystawianie NA ZEWNĄTRZ (nie do środka szafy)
 * 3) TWIST_IN_PLANE — obrót W PŁASZCZYŹNIE RAMKI wokół normalnej Z
 *                    ← TEGO używasz gdy uchwyt jest pionowy a ramka pozioma
 *
 * Zmieniaj tylko TWIST: HORIZONTAL / VERTICAL o ±90.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const HANDLE_GLB_ORIENT = {
    /** Stałe ułożenie modelu na licu (nie mieszać z poziom/pion) */
    BASE_DEG: { x: 90, y: 0, z: 0 },
    /** Flip gdy normalZ < 0 (FACE_Z_MINUS) — oś Y panelu */
    OUTWARD_Y_DEG_WHEN_NORMAL_NEG: 180,
    /**
     * Obrót wokół Z panelu (w płaszczyźnie ramki SmartParts).
     * Domyślnie HORIZONTAL=90 — GLB „leży” jak pozioma ramka.
     * Jeśli nadal pionowy: spróbuj 0 / -90 / 180.
     */
    TWIST_IN_PLANE_DEG: {
        HORIZONTAL: 90,
        VERTICAL: 0,
    },
} as const;

/** @deprecated — zostawione pod stary import; używaj HANDLE_GLB_ORIENT */
export const HANDLE_GLB_ROTATION_DEG = {
    HORIZONTAL: { ...HANDLE_GLB_ORIENT.BASE_DEG, z: HANDLE_GLB_ORIENT.TWIST_IN_PLANE_DEG.HORIZONTAL },
    VERTICAL: { ...HANDLE_GLB_ORIENT.BASE_DEG, z: HANDLE_GLB_ORIENT.TWIST_IN_PLANE_DEG.VERTICAL },
} as const;

/** @deprecated */
export const HANDLE_GLB_OUTWARD_FLIP_DEG = {
    NEGATIVE_NORMAL: { x: 0, y: HANDLE_GLB_ORIENT.OUTWARD_Y_DEG_WHEN_NORMAL_NEG, z: 0 },
    POSITIVE_NORMAL: { x: 0, y: 0, z: 0 },
} as const;

function degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

/**
 * Składa kwaternion: twist(Z) ∘ outward(Y) ∘ base.
 * Twist jest OSTATNI → zawsze kręci w płaszczyźnie ramki, niezależnie od flipu.
 */
export function buildHandleGlbQuaternion(
    B: any,
    orientation: 'HORIZONTAL' | 'VERTICAL',
    normalZ: number = -1,
): any {
    const { BASE_DEG, OUTWARD_Y_DEG_WHEN_NORMAL_NEG, TWIST_IN_PLANE_DEG } = HANDLE_GLB_ORIENT;
    const qBase = B.Quaternion.FromEulerAngles(
        degToRad(BASE_DEG.x),
        degToRad(BASE_DEG.y),
        degToRad(BASE_DEG.z),
    );
    const outY = normalZ < 0 ? OUTWARD_Y_DEG_WHEN_NORMAL_NEG : 0;
    const qOut = outY
        ? B.Quaternion.RotationAxis(B.Axis.Y, degToRad(outY))
        : B.Quaternion.Identity();
    const twist = orientation === 'VERTICAL'
        ? TWIST_IN_PLANE_DEG.VERTICAL
        : TWIST_IN_PLANE_DEG.HORIZONTAL;
    const qTwist = B.Quaternion.RotationAxis(B.Axis.Z, degToRad(twist));
    // v' = qTwist * qOut * qBase * v
    return qTwist.multiply(qOut).multiply(qBase);
}

/** @deprecated — tylko diagnostyka; preferuj buildHandleGlbQuaternion */
export function resolveHandleGlbRotationRad(
    orientation: 'HORIZONTAL' | 'VERTICAL',
    normalZ: number = -1,
): { x: number; y: number; z: number } {
    const twist = orientation === 'VERTICAL'
        ? HANDLE_GLB_ORIENT.TWIST_IN_PLANE_DEG.VERTICAL
        : HANDLE_GLB_ORIENT.TWIST_IN_PLANE_DEG.HORIZONTAL;
    const outY = normalZ < 0 ? HANDLE_GLB_ORIENT.OUTWARD_Y_DEG_WHEN_NORMAL_NEG : 0;
    return {
        x: degToRad(HANDLE_GLB_ORIENT.BASE_DEG.x),
        y: degToRad(HANDLE_GLB_ORIENT.BASE_DEG.y + outY),
        z: degToRad(HANDLE_GLB_ORIENT.BASE_DEG.z + twist),
    };
}

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

function disposeHandleVisual(scene: any, cntNodeId: string): void {
    const meshName = `handle_mesh_${cntNodeId}`;
    const existingMesh = scene.getMeshByName?.(meshName);
    if (existingMesh) existingMesh.dispose();

    const tnName = `handle_glb_${cntNodeId}`;
    const existingTn = scene.getTransformNodeByName?.(tnName);
    if (existingTn) existingTn.dispose();

    // Stare klony bez stałej nazwy — po metadata.nodeId
    for (const node of scene.transformNodes || []) {
        if (node?.metadata?.type === 'smartpart_handle' && node.metadata.nodeId === cntNodeId) {
            try { node.dispose(); } catch { /* ignore */ }
        }
    }
    for (const mesh of scene.meshes || []) {
        if (mesh?.metadata?.type === 'smartpart_handle' && mesh.metadata.nodeId === cntNodeId) {
            try { mesh.dispose(); } catch { /* ignore */ }
        }
    }
}

function resolveGlbId(params: HandleParamsMm): string | null {
    const fromPath = handleGlbTemplateId(params.glbModelPath);
    if (fromPath) return fromPath;
    const file = resolveHandleGlbFile(params.seriesId, params.holeDistanceMm, params.handleType);
    return handleGlbTemplateId(file);
}

function applyHandleColorToTree(root: any, params: HandleParamsMm, B: any): void {
    if (!root || !params?.color || !B) return;
    const { r, g, b } = params.color;
    const nodes = [root, ...(typeof root.getDescendants === 'function' ? root.getDescendants(false) : [])];
    for (const node of nodes) {
        const mat = (node as any).material;
        if (!mat) continue;
        if (!(node as any).metadata) (node as any).metadata = {};
        if (!(node as any).metadata.handleColorCloned && typeof mat.clone === 'function') {
            (node as any).material = mat.clone(`${mat.name || 'handle'}_tint`);
            (node as any).metadata.handleColorCloned = true;
        }
        const m = (node as any).material;
        if (m.diffuseColor) m.diffuseColor = new B.Color3(r, g, b);
        if (m.albedoColor) m.albedoColor = new B.Color3(r, g, b);
        if (m.emissiveColor) m.emissiveColor = new B.Color3(r * 0.15, g * 0.15, b * 0.15);
        if (m.specularColor) m.specularColor = new B.Color3(0.35, 0.35, 0.38);
    }
}

function placeHandleRoot(
    root: any,
    cntNode: CADNode,
    params: HandleParamsMm,
    layout: HandleComputedLayoutMm,
    faceZ: number,
    normalZ: number,
    genParams: any,
    B?: any,
): void {
    root.name = `handle_glb_${cntNode.id}`;
    root.metadata = {
        type: 'smartpart_handle',
        nodeId: cntNode.id,
        params,
        layout,
        glb: true,
        normalZ,
    };

    const parentPanelId = genParams.targetPanelId;
    const scene = root.getScene?.() || ContextManager.instance?.viewport?.scene;
    const panelRoot = findPanelRootMesh(scene, parentPanelId);
    const babylon = B || (typeof window !== 'undefined' ? (window as any).BABYLON : null);

    if (panelRoot && babylon?.Quaternion) {
        root.parent = panelRoot;
        // Origin GLB = środek C-C na licu
        root.position.set(layout.center.x, layout.center.y, faceZ);
        // Kwaternion: baza → na zewnątrz → twist w płaszczyźnie ramki (poziom/pion)
        root.rotationQuaternion = buildHandleGlbQuaternion(babylon, layout.orientation, normalZ);
        root.rotation.set(0, 0, 0); // Euler wyłączony — steruje tylko quaternion
    } else if (panelRoot) {
        root.parent = panelRoot;
        root.position.set(layout.center.x, layout.center.y, faceZ);
        const rot = resolveHandleGlbRotationRad(layout.orientation, normalZ);
        root.rotation.set(rot.x, rot.y, rot.z);
    }

    applyHandleColorToTree(root, params, babylon);
}

/**
 * Buduje wizualizację uchwytu: GLB (async) albo mesh parametryczny (sync).
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

    disposeHandleVisual(scene, cntNode.id);

    const glbId = resolveGlbId(params);
    if (glbId) {
        const loader = HardwareLoader.instance;
        if (loader.hasTemplate(glbId)) {
            const instance = loader.createHandleInstance(glbId, scene);
            if (instance) {
                placeHandleRoot(instance, cntNode, params, layout, faceZ, normalZ, genParams, B);
                return;
            }
        }
        // Parametryczny placeholder, potem podmiana na GLB
        buildProceduralHandleMesh(cntNode, params, layout, faceZ, normalZ, scene, B, genParams);
        loader.loadTemplate(glbId, scene).then((tpl) => {
            if (!tpl) return;
            // Kontener mógł zniknąć / być przebudowany
            const still = (cntNode.domainData as any)?.generatorParams?.type === 'smartpart_handle'
                || (cntNode.domainData as any)?.generatorParams?.partType === 'HANDLE';
            if (!still && !(cntNode.domainData as any)?.generatorParams) return;

            disposeHandleVisual(scene, cntNode.id);
            const instance = loader.createHandleInstance(glbId, scene);
            if (instance) {
                placeHandleRoot(instance, cntNode, params, layout, faceZ, normalZ, genParams, B);
                ContextManager.instance?.viewport?.requestRender?.(4);
            }
        }).catch((err) => {
            console.warn('[SmartParts Handle] GLB niedostępny, zostaje mesh parametryczny:', glbId, err);
        });
        return;
    }

    buildProceduralHandleMesh(cntNode, params, layout, faceZ, normalZ, scene, B, genParams);
}

function buildProceduralHandleMesh(
    cntNode: CADNode,
    params: HandleParamsMm,
    layout: HandleComputedLayoutMm,
    faceZ: number,
    normalZ: number,
    scene: any,
    B: any,
    genParams: any,
): void {
    const meshName = `handle_mesh_${cntNode.id}`;
    const { totalLengthMm, depthMm, thicknessMm, footDiameterMm } = params;
    const isHoriz = layout.orientation === 'HORIZONTAL';

    const barWidth = isHoriz ? totalLengthMm : thicknessMm;
    const barHeight = isHoriz ? thicknessMm : totalLengthMm;
    const barDepth = thicknessMm;

    const barMesh = B.MeshBuilder.CreateBox(`${meshName}_bar`, {
        width: barWidth,
        height: barHeight,
        depth: barDepth,
    }, scene);

    barMesh.position.x = 0;
    barMesh.position.y = 0;
    barMesh.position.z = normalZ * (depthMm - barDepth / 2);

    const meshesToMerge: any[] = [barMesh];

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

        foot.rotation.x = Math.PI / 2;
        foot.position.x = hp.x;
        foot.position.y = hp.y;
        foot.position.z = normalZ * (footLen / 2);

        meshesToMerge.push(foot);
    }

    const merged = B.Mesh.MergeMeshes(meshesToMerge, true, true, undefined, false, true);
    if (!merged) return;

    merged.name = meshName;
    merged.isPickable = true;

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

    const parentPanelId = genParams.targetPanelId;
    const panelRoot = findPanelRootMesh(scene, parentPanelId);
    if (panelRoot) {
        merged.parent = panelRoot;
        merged.position.set(layout.center.x, layout.center.y, faceZ);
        merged.rotation.set(0, 0, 0);
    }
}
