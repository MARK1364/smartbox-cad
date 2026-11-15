/**
 * SmartPanel Web — QuickPick Raycast Detector
 * 
 * Wykrywa i sortuje wszystkie płaszczyzny leżące wzdłuż promienia widoku pod kursorem (od najbliższej do najdalszej).
 */

import { normalizeFaceName } from '../face-name.js';
import type { QuickPickCandidate } from './quick-pick-types.js';

function isMeshHierarchicallyEnabled(mesh: any): boolean {
    let curr = mesh;
    while (curr) {
        if (curr.isEnabled && !curr.isEnabled()) return false;
        curr = curr.parent;
    }
    return true;
}

export function formatFaceLabels(rawFaceName: string): { label: string; badge: string } {
    let canonical = '';
    try {
        canonical = normalizeFaceName(rawFaceName || '');
    } catch {
        /* nierozpoznana nazwa → etykieta surowa poniżej */
    }

    switch (canonical) {
        case 'FACE_Z_PLUS':
            return { label: 'Front / Płaszczyzna przednia', badge: '+Z' };
        case 'FACE_Z_MINUS':
            return { label: 'Tył / Płaszczyzna tylna', badge: '-Z' };
        case 'FACE_Y_PLUS':
            return { label: 'Góra / Krawędź górna', badge: '+Y' };
        case 'FACE_Y_MINUS':
            return { label: 'Dół / Krawędź dolna', badge: '-Y' };
        case 'FACE_X_PLUS':
            return { label: 'Prawa / Krawędź prawa', badge: '+X' };
        case 'FACE_X_MINUS':
            return { label: 'Lewa / Krawędź lewa', badge: '-X' };
        default:
            return { label: rawFaceName || 'Płaszczyzna', badge: 'Face' };
    }
}

export function findFacesAlongRay(scene: any, pointerX: number, pointerY: number): QuickPickCandidate[] {
    if (!scene || typeof scene.multiPick !== 'function') {
        return [];
    }

    const filter = (mesh: any) => {
        if (!mesh || !isMeshHierarchicallyEnabled(mesh) || !mesh.metadata || !mesh.metadata.faceName) {
            return false;
        }
        if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
        if (mesh.isVisible === false) return false;
        if (mesh.metadata.visible === false) return false;
        const pVis = mesh.metadata.panelModel ? mesh.metadata.panelModel.visible !== false : true;
        const mVis = mesh.metadata.model ? mesh.metadata.model.visible !== false : true;
        return pVis && mVis;
    };

    let faceHits = scene.multiPick(pointerX, pointerY, filter);
    let validHits = faceHits ? faceHits.filter((h: any) => h.hit && h.pickedMesh && h.pickedMesh.metadata?.faceName) : [];

    // Fallback: jeśli kliknięto tuż obok wąskiego paska (np. 1-4px w pustą przestrzeń obok mebla)
    if (validHits.length === 0) {
        const ring = [
            [-3, 0], [3, 0], [0, -3], [0, 3],
            [-6, 0], [6, 0], [0, -6], [0, 6],
            [-3, -3], [3, 3], [-3, 3], [3, -3]
        ];
        for (const [dx, dy] of ring) {
            const hits = scene.multiPick(pointerX + dx, pointerY + dy, filter);
            const v = hits ? hits.filter((h: any) => h.hit && h.pickedMesh && h.pickedMesh.metadata?.faceName) : [];
            if (v.length > 0) {
                validHits = v;
                break;
            }
        }
    }

    if (validHits.length === 0) {
        return [];
    }

    // Sortuj rosnąco wg dystansu od oka kamery
    validHits.sort((a: any, b: any) => a.distance - b.distance);

    // Deduplikacja: wiele trójkątów tej samej ściany lub mesh z podwójnym trafieniem
    const seenKeys = new Set<string>();
    const candidates: QuickPickCandidate[] = [];

    for (const hit of validHits) {
        const mesh = hit.pickedMesh;
        const meta = mesh.metadata;
        const faceName = meta.faceName;
        const panelModel = meta.panelModel || meta.model;
        const smartId = meta.smartId || null;
        const panelId = panelModel?.id || mesh.uniqueId || 'unknown';
        const key = `${panelId}:${faceName}`;

        if (seenKeys.has(key)) {
            continue;
        }
        seenKeys.add(key);

        const wp = hit.pickedPoint ? { x: hit.pickedPoint.x, y: hit.pickedPoint.y, z: hit.pickedPoint.z } : { x: 0, y: 0, z: 0 };
        const norm = hit.getNormal ? hit.getNormal(true) : null;
        const wn = norm ? { x: norm.x, y: norm.y, z: norm.z } : null;

        const { label, badge } = formatFaceLabels(faceName);
        const panelName = panelModel?.name || panelModel?.key || (panelModel?.generatorParams?.type ? `Formatka (${panelModel.generatorParams.type})` : 'Formatka');

        const distMm = Math.round(hit.distance * 10) / 10;
        const prevCandidate = candidates.length > 0 ? candidates[candidates.length - 1] : null;
        const deltaMm = prevCandidate ? Math.round((distMm - prevCandidate.distanceMm) * 10) / 10 : 0;

        candidates.push({
            index: candidates.length,
            mesh,
            distanceMm: distMm,
            deltaDistanceMm: deltaMm,
            worldPoint: wp,
            worldNormal: wn,
            faceName,
            faceLabel: label,
            axisBadge: badge,
            panelModel,
            panelName,
            smartId,
            isObscured: candidates.length > 0,
        });
    }

    return candidates;
}

export interface HiddenEntityHit {
    type: 'part' | 'container' | 'hardware' | 'hardware_subpart';
    id: string;
    uuid?: string;
    name: string;
    distance: number;
    entity: any;
    subType?: string;
    hwNode?: any;
    parentContainerId?: string;
}

/**
 * Wykrywa ukryte elementy (formatki, korpusy, okucia) leżące wzdłuż promienia pod kursorem myszy.
 * Używane dla przycisku "Pokaż" w menu kontekstowym PPM oraz skrótu Shift+Tab (SolidWorks style).
 */
export function findHiddenEntityAlongRay(
    scene: any,
    pointerX: number,
    pointerY: number,
    doc: any,
    panelViews: Map<any, any>,
    hardwareViews?: Map<string, any>
): HiddenEntityHit | null {
    if (!scene || !scene.activeCamera) return null;
    const ray = typeof scene.createPickingRay === 'function'
        ? scene.createPickingRay(pointerX, pointerY, null, scene.activeCamera)
        : null;
    if (!ray || typeof ray.intersectsMesh !== 'function') return null;

    const hits: HiddenEntityHit[] = [];
    const seenIds = new Set<string>();

    // 1. Sprawdź ukryte formatki (panele)
    if (panelViews && panelViews.size > 0) {
        for (const [panelOrId, view] of panelViews.entries()) {
            const panel = view?.model || (typeof panelOrId === 'object' ? panelOrId : null)
                || (typeof panelOrId === 'string' && doc?.findNode ? doc.findNode(panelOrId)?.domainData : null);
            if (!panel || !view || seenIds.has(panel.id)) continue;

            const node = doc?.findNode ? doc.findNode(panel.id) : null;
            const parentContainerNode = node?.parent;
            const isParentHidden = parentContainerNode?.domainData && parentContainerNode.domainData.visible === false;
            const isPanelHidden = panel.visible === false || isParentHidden;

            if (!isPanelHidden) continue;

            const faceMeshes = view.faceMeshes ? Object.values(view.faceMeshes) : [];
            const meshesToTest = faceMeshes.length > 0
                ? faceMeshes
                : (view.root?.getChildMeshes ? view.root.getChildMeshes() : []);

            for (const mesh of meshesToTest as any[]) {
                if (!mesh) continue;
                try {
                    mesh.computeWorldMatrix?.(true);
                    const hit = ray.intersectsMesh(mesh, false);
                    if (hit && hit.hit && typeof hit.distance === 'number') {
                        seenIds.add(panel.id);
                        hits.push({
                            type: 'part',
                            id: panel.id,
                            uuid: panel.id,
                            name: panel.name || 'Formatka',
                            distance: hit.distance,
                            entity: panel,
                            parentContainerId: parentContainerNode?.id,
                        });
                        break;
                    }
                } catch {
                    // ignoruj pojedyncze błędy geometrii
                }
            }
        }
    }

    // 2. Sprawdź ukryte okucia (hardware) oraz ich pod-elementy (boczek, mocowanie, prowadnica)
    if (hardwareViews && hardwareViews.size > 0 && doc?.getNodesByType) {
        const hwNodes = doc.getNodesByType('HARDWARE') || [];
        for (const hwNode of hwNodes) {
            const hw = hwNode.domainData;
            if (!hw) continue;
            const isParentHidden = hwNode.parent?.domainData && hwNode.parent.domainData.visible === false;
            const isHwHidden = hw.visible === false || hwNode.visible === false || isParentHidden;

            const hiddenSubparts: string[] = [
                ...(Array.isArray(hw.hiddenSubparts) ? hw.hiddenSubparts : []),
                ...(Array.isArray(hw.params?.hiddenSubparts) ? hw.params.hiddenSubparts : []),
            ];
            const hasHiddenSubparts = hiddenSubparts.length > 0;

            if (!isHwHidden && !hasHiddenSubparts) continue;

            const hwView = hardwareViews.get(hwNode.id);
            if (!hwView) continue;
            const rootMesh = hwView.rootNode || hwView;

            const meshes = typeof rootMesh.getChildMeshes === 'function'
                ? rootMesh.getChildMeshes()
                : (rootMesh.subMeshes ? Object.values(rootMesh.subMeshes) : [rootMesh]);

            for (const mesh of meshes) {
                if (!mesh) continue;
                const subType = mesh.metadata?.subType;
                const isSubHidden = isHwHidden || (subType && hiddenSubparts.includes(subType));
                if (!isSubHidden) continue;

                const targetId = (subType && !isHwHidden) ? (mesh.metadata?.id || `${hwNode.id}_${subType}`) : hwNode.id;
                if (seenIds.has(targetId)) continue;

                try {
                    mesh.computeWorldMatrix?.(true);
                    const hit = ray.intersectsMesh(mesh, false);
                    if (hit && hit.hit && typeof hit.distance === 'number') {
                        seenIds.add(targetId);
                        hits.push({
                            type: subType && !isHwHidden ? 'hardware_subpart' : 'hardware',
                            id: targetId,
                            uuid: targetId,
                            name: (subType && !isHwHidden)
                                ? (mesh.metadata?.subName || `${hwNode.name} - ${subType}`)
                                : (hwNode.name || hw.name || 'Okucie'),
                            distance: hit.distance,
                            entity: hw,
                            subType: subType && !isHwHidden ? subType : undefined,
                            hwNode,
                            parentContainerId: hwNode.parent?.id,
                        } as any);
                        if (isHwHidden) break;
                    }
                } catch {
                    // ignoruj
                }
            }
        }
    }

    if (hits.length === 0) return null;

    // Najbliższy trafiony element (najmniejszy dystans od kamery)
    hits.sort((a, b) => a.distance - b.distance);
    return hits[0];
}
