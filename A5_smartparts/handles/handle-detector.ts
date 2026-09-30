/**
 * A5_smartparts / handles — handle-detector.ts
 * Detektor zarysu formatki (Panel Surface Detector).
 *
 * Wykrywa formatkę (PanelModel) pod promieniem kursora myszy podczas przeciągania uchwytu,
 * wyznacza jej zarys, wymiary, ścianę montażową oraz sugerowany preset położenia.
 */

import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { type HandlePlacementPreset } from './handle-types.js';

export interface DetectedPanelSurface {
    panelNode: CADNode;
    panelModel: any;
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
    suggestedPreset: HandlePlacementPreset;
    localCoordMm: { x: number; y: number };
    faceZ: number;
    normalZ: number;
    worldCenterMm: { x: number; y: number; z: number };
    pickedMesh: any;
    panelRootMesh: any;
}

/**
 * Wykrywa formatkę meblową pod promieniem kursora myszy.
 */
export function probePanelSurfaceFromRay(
    scene: any,
    pickResult: any,
    document: ProjectDocument
): DetectedPanelSurface | null {
    if (!scene || !pickResult || !pickResult.hit || !pickResult.pickedMesh || !document) {
        return null;
    }

    const pickedMesh = pickResult.pickedMesh;
    const meta = pickedMesh.metadata || {};

    // 1. Zlokalizuj obiekt PanelModel
    let panelModel = meta.panelModel || meta.model;
    let panelNode: CADNode | null = null;

    if (panelModel && panelModel.id) {
        panelNode = document.findNode(panelModel.id);
    }

    // Fallback: szukanie po ID w drzewie
    if (!panelNode && pickedMesh.name) {
        const directNode = document.findNode(pickedMesh.name);
        if (directNode && directNode.domainData?.width && directNode.domainData?.height) {
            panelNode = directNode;
            panelModel = directNode.domainData;
        }
    }

    if (!panelNode || !panelModel) {
        return null;
    }

    // Wyklucz obiekty niebędące formatkami (np. podłoga, kontener wnęki, siatki pomocnicze)
    if (pickedMesh.name?.includes('ground') || pickedMesh.name?.includes('grid') || pickedMesh.name?.includes('blok_bay')) {
        return null;
    }

    const widthMm = Math.round(nmToMm(panelModel.width));
    const heightMm = Math.round(nmToMm(panelModel.height));
    const thicknessMm = Math.round(nmToMm(panelModel.thickness));

    if (widthMm <= 10 || heightMm <= 10) return null;

    // 2. Znajdź główny węzeł formatki w Babylonie (this.root w PanelView)
    const panelRoot = pickedMesh.parent || pickedMesh;

    const B = typeof (window as any).BABYLON !== 'undefined' ? (window as any).BABYLON : (globalThis as any).BABYLON;
    let localX = 0;
    let localY = 0;
    let faceZ = -thicknessMm / 2;
    let normalZ = -1;

    if (pickResult.pickedPoint && B && panelRoot) {
        if (typeof panelRoot.computeWorldMatrix === 'function') {
            panelRoot.computeWorldMatrix(true);
        }
        const invWorldMat = panelRoot.getWorldMatrix().clone().invert();
        const localHit = B.Vector3.TransformCoordinates(pickResult.pickedPoint, invWorldMat);
        localX = Math.round(localHit.x * 10) / 10;
        localY = Math.round(localHit.y * 10) / 10;

        // Rozpoznanie lica formatki: czy trafiono przód Z- czy tył Z+
        if (localHit.z > 0) {
            faceZ = thicknessMm / 2;
            normalZ = 1;
        } else {
            faceZ = -thicknessMm / 2;
            normalZ = -1;
        }
    }

    // 3. Rozpoznaj strefę formatki i zasugeruj najwygodniejszy preset
    const halfW = widthMm / 2;
    const halfH = heightMm / 2;

    const normX = halfW > 0 ? localX / halfW : 0; // -1 (lewa) do +1 (prawa)
    const normY = halfH > 0 ? localY / halfH : 0; // -1 (dół) do +1 (góra)

    let suggestedPreset: HandlePlacementPreset = 'TOP_CENTER';

    if (normY > 0.35) {
        // Górna strefa formatki
        if (normX < -0.4) {
            suggestedPreset = 'TOP_LEFT';
        } else if (normX > 0.4) {
            suggestedPreset = 'TOP_RIGHT';
        } else {
            suggestedPreset = 'TOP_CENTER';
        }
    } else if (normY < -0.35) {
        // Dolna strefa formatki
        if (normX < -0.4) {
            suggestedPreset = 'BOTTOM_LEFT';
        } else if (normX > 0.4) {
            suggestedPreset = 'BOTTOM_RIGHT';
        } else {
            suggestedPreset = 'BOTTOM_CENTER';
        }
    } else {
        // Strefa środkowa
        suggestedPreset = 'CENTER';
    }

    const nodeTrans = panelNode.getWorldMatrix().decompose().translation;

    return {
        panelNode,
        panelModel,
        widthMm,
        heightMm,
        thicknessMm,
        suggestedPreset,
        localCoordMm: { x: localX, y: localY },
        faceZ,
        normalZ,
        worldCenterMm: {
            x: nmToMm(nodeTrans.x),
            y: nmToMm(nodeTrans.y),
            z: nmToMm(nodeTrans.z),
        },
        pickedMesh,
        panelRootMesh: panelRoot,
    };
}
