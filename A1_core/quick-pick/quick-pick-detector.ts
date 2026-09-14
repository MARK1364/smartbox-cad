/**
 * SmartPanel Web — QuickPick Raycast Detector
 * 
 * Wykrywa i sortuje wszystkie płaszczyzny leżące wzdłuż promienia widoku pod kursorem (od najbliższej do najdalszej).
 */

import { normalizeFaceName } from '../../A4_smartpanel/panel-model.js';
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
    let canonical = rawFaceName || '';
    try {
        canonical = normalizeFaceName(canonical);
    } catch {
        /* zachowaj oryginalną */
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

    const faceHits = scene.multiPick(
        pointerX,
        pointerY,
        (mesh: any) => {
            if (!mesh || !isMeshHierarchicallyEnabled(mesh) || !mesh.metadata || !mesh.metadata.faceName) {
                return false;
            }
            const pVis = mesh.metadata.panelModel ? mesh.metadata.panelModel.visible !== false : true;
            const mVis = mesh.metadata.model ? mesh.metadata.model.visible !== false : true;
            return pVis && mVis;
        }
    );

    if (!faceHits || faceHits.length === 0) {
        return [];
    }

    const validHits = faceHits.filter((h: any) => h.hit && h.pickedMesh && h.pickedMesh.metadata?.faceName);
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
