/**
 * Podgląd płaszczyzny referencji Bloki (Bok Lewy, Przód, Dół…)
 * przy najechaniu na slot w panelu edycji.
 */
import { ContextManager } from '../A1_core/context-manager.js';
import { canonicalizeRefFaceName } from './bloki-core.js';
import { nmToMm } from '../A1_core/cad-math/units.js';

declare const BABYLON: any;

export type BlokiRefSideKey = 'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax';

export const BLOKI_REF_SIDE_LABELS: Record<BlokiRefSideKey, string> = {
    xMin: 'Bok Lewy',
    xMax: 'Bok Prawy',
    yMin: 'Przód',
    yMax: 'Tył',
    zMin: 'Dół',
    zMax: 'Góra',
};

const SIDE_COLORS: Record<BlokiRefSideKey, { diffuse: [number, number, number]; emissive: [number, number, number] }> = {
    xMin: { diffuse: [0.2, 0.55, 1.0], emissive: [0.08, 0.35, 0.85] },
    xMax: { diffuse: [0.15, 0.65, 1.0], emissive: [0.06, 0.4, 0.9] },
    yMin: { diffuse: [0.25, 0.75, 0.95], emissive: [0.1, 0.45, 0.75] },
    yMax: { diffuse: [0.18, 0.5, 0.95], emissive: [0.07, 0.32, 0.8] },
    zMin: { diffuse: [0.3, 0.6, 0.9], emissive: [0.12, 0.38, 0.7] },
    zMax: { diffuse: [0.22, 0.58, 1.0], emissive: [0.09, 0.36, 0.82] },
};

let hintMeshes: any[] = [];
let highlightedPanelMeshes: Array<{ mesh: any; emissive: any; diffuse: any }> = [];

function getBabylon(): any {
    return typeof BABYLON !== 'undefined' ? BABYLON : (globalThis as any).BABYLON;
}

export function clearBlokiRefPlaneHint(): void {
    for (const m of hintMeshes) {
        if (m && !m.isDisposed?.()) m.dispose();
    }
    hintMeshes = [];

    for (const entry of highlightedPanelMeshes) {
        const { mesh, emissive, diffuse } = entry;
        if (!mesh || mesh.isDisposed?.() || !mesh.material) continue;
        mesh.material.emissiveColor = emissive;
        mesh.material.diffuseColor = diffuse;
    }
    highlightedPanelMeshes = [];

    try {
        ContextManager.instance?.viewport?.requestRender(2);
    } catch {
        /* ignore */
    }
}

type FacePlacement = {
    planeW: number;
    planeH: number;
    lx: number;
    ly: number;
    lz: number;
    rx: number;
    ry: number;
};

/** Lokalny układ ContainerView: X=szer., Y=wys., Z=głęb.; spód Y=0. */
export function getBlokiRefFacePlacement(sideKey: BlokiRefSideKey, w: number, h: number, d: number): FacePlacement {
    switch (sideKey) {
        case 'xMin':
            return { planeW: d, planeH: h, lx: -w / 2, ly: h / 2, lz: 0, rx: 0, ry: -Math.PI / 2 };
        case 'xMax':
            return { planeW: d, planeH: h, lx: w / 2, ly: h / 2, lz: 0, rx: 0, ry: Math.PI / 2 };
        case 'yMin':
            return { planeW: w, planeH: h, lx: 0, ly: h / 2, lz: -d / 2, rx: 0, ry: Math.PI };
        case 'yMax':
            return { planeW: w, planeH: h, lx: 0, ly: h / 2, lz: d / 2, rx: 0, ry: 0 };
        case 'zMin':
            return { planeW: w, planeH: d, lx: 0, ly: 0, lz: 0, rx: -Math.PI / 2, ry: 0 };
        case 'zMax':
            return { planeW: w, planeH: d, lx: 0, ly: h, lz: 0, rx: Math.PI / 2, ry: 0 };
        default:
            return { planeW: w, planeH: h, lx: 0, ly: h / 2, lz: 0, rx: 0, ry: 0 };
    }
}

function resolveRefForSide(
    sideKey: BlokiRefSideKey,
    customRefs?: Record<string, any>,
    references?: Record<string, any>
): { partKey?: string; face?: string; panelId?: string } | null {
    const custom = customRefs?.[sideKey];
    if (custom?.partKey || custom?.panelId || custom?.face) return custom;
    const fallback = references?.[sideKey];
    if (fallback?.partKey || fallback?.panelId || fallback?.face || fallback?.faceName) {
        return {
            partKey: fallback.partKey || fallback.panelId,
            face: fallback.face || fallback.faceName,
            panelId: fallback.panelId,
        };
    }
    return null;
}

function highlightAssignedPanelFace(ref: { partKey?: string; face?: string; panelId?: string } | null): void {
    if (!ref) return;
    const doc = ContextManager.instance.document;
    if (!doc) return;

    const pKey = ref.panelId || ref.partKey;
    const pFace = ref.face;
    if (!pKey || !pFace) return;

    const allPanels = typeof (doc as any).getPanels === 'function' ? (doc as any).getPanels() : [];
    const foundNode = allPanels.find((n: any) => {
        const d = n.domainData;
        return n.id === pKey || (d && (d.id === pKey || d.name === pKey || (d as any).key === pKey || d.role === pKey));
    });
    const targetPanel = foundNode ? foundNode.domainData : doc.findNode(pKey)?.domainData || null;
    if (!targetPanel) return;

    const panelViews = ContextManager.instance.panelViews;
    const view = panelViews.get(targetPanel) || panelViews.get(targetPanel.id);
    if (!view?.faceMeshes) return;

    const faceKey = canonicalizeRefFaceName(pFace);
    const mesh = view.faceMeshes[pFace] || view.faceMeshes[faceKey];
    if (!mesh?.material) return;

    highlightedPanelMeshes.push({
        mesh,
        emissive: mesh.material.emissiveColor?.clone?.() || mesh.metadata?.baseColor,
        diffuse: mesh.material.diffuseColor?.clone?.() || mesh.metadata?.baseDiffuse,
    });

    const B = getBabylon();
    if (B?.Color3) {
        mesh.material.emissiveColor = new B.Color3(0.15, 0.55, 0.95);
        mesh.material.diffuseColor = new B.Color3(0.25, 0.65, 1.0);
    }
}

/**
 * Podświetla płaszczyznę granicy Bloki dla danego slotu referencji
 * oraz (jeśli przypisana) ścianę formatki w korpusie.
 */
export function highlightBlokiRefSide(
    container: any,
    sideKey: BlokiRefSideKey,
    options?: {
        customRefs?: Record<string, any>;
        references?: Record<string, any>;
    }
): void {
    const B = getBabylon();
    const scene = ContextManager.instance.viewport?.scene;
    if (!B || !scene || !container) return;

    clearBlokiRefPlaneHint();

    const view = ContextManager.instance.containerViews?.get(container);
    const root = view?.rootNode || view?.mesh;
    if (!root) return;

    const w = Math.max(1, nmToMm(container.width || 0));
    const h = Math.max(1, nmToMm(container.height || 0));
    const d = Math.max(1, nmToMm(container.depth || 0));

    const placement = getBlokiRefFacePlacement(sideKey, w, h, d);
    const colors = SIDE_COLORS[sideKey] || SIDE_COLORS.xMin;

    const mat = new B.StandardMaterial(`sb_ref_hint_${sideKey}`, scene);
    mat.diffuseColor = new B.Color3(colors.diffuse[0], colors.diffuse[1], colors.diffuse[2]);
    mat.emissiveColor = new B.Color3(colors.emissive[0], colors.emissive[1], colors.emissive[2]);
    mat.alpha = 0.42;
    mat.backFaceCulling = false;
    mat.disableLighting = true;

    const plane = B.MeshBuilder.CreatePlane(
        `sb_ref_plane_${sideKey}`,
        { width: placement.planeW, height: placement.planeH },
        scene
    );
    plane.material = mat;
    plane.isPickable = false;
    plane.parent = root;
    plane.position.x = placement.lx;
    plane.position.y = placement.ly;
    plane.position.z = placement.lz;
    plane.rotation.x = placement.rx;
    plane.rotation.y = placement.ry;
    plane.metadata = { type: 'bloki-ref-hint', sideKey };

    hintMeshes.push(plane);

    highlightAssignedPanelFace(
        resolveRefForSide(sideKey, options?.customRefs, options?.references)
    );

    const appApi = ContextManager.instance.appAPI;
    if (appApi?.setStatus) {
        appApi.setStatus(`Podgląd: ${BLOKI_REF_SIDE_LABELS[sideKey]} — niebieska płaszczyzna Bloki`, true);
    }

    try {
        ContextManager.instance.viewport?.requestRender(2);
    } catch {
        /* ignore */
    }
}
