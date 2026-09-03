/**
 * smartbox-bay-detector.ts
 *
 * Dynamiczny detektor wnęki (Cabinet Bay) w przestrzeni 3D CAD.
 * Bada przestrzeń z punktu wewnątrz korpusu w 5 kierunkach (-X, +X, -Z, +Z, -Y),
 * wykrywając 5 otaczających ścian formatki oraz wyznaczając płaszczyznę lica (przód +Y).
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { PanelModel, type FaceName } from '../A4_smartpanel/panel-model.js';
import { nmToMm, mmToNm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';

export interface FaceHitRef {
    nodeId: string;
    nodeName: string;
    face: FaceName;
    faceName?: FaceName;
    worldPointMm: { x: number; y: number; z: number };
    planeCoordMm: number; // np. X dla boków, Z dla wieńców, Y dla pleców
}

export interface DetectedBay {
    boundsMm: {
        width: number;  // X: od lewego do prawego boku
        height: number; // Z: od dna do góry
        depth: number;  // Y: od pleców do lica przodu
    };
    boundsNm: {
        width: number;
        height: number;
        depth: number;
    };
    centerWorldMm: {
        x: number;
        y: number;
        z: number;
    };
    parentCabinetId?: string;
    boundary: {
        left: FaceHitRef;
        right: FaceHitRef;
        bottom: FaceHitRef;
        top: FaceHitRef;
        back: FaceHitRef;
        front: FaceHitRef;
        frontPlaneYMm: number;
    };
}

interface PanelFaceInfo {
    node: CADNode;
    panel: PanelModel;
    face: FaceName;
    worldCenterMm: Vec3;
    worldNormal: Vec3;
    minBoundsMm: Vec3;
    maxBoundsMm: Vec3;
}

/**
 * Uniwersalnie zbiera wszystkie 6 ścian dla każdej formatki meblowej w scenie.
 * Zgodnie ze standardem LCS z AGENTS.md:
 * - Formatka ma lokalny środek (0, 0, 0) w środku geometrycznym.
 * - Pozycje i orientacje ścian w świecie są liczone w 100% matematycznie
 *   przez macierz świata node.getWorldMatrix() (bez zgadywania ról i bez zamiany osi).
 */
function collectScenePanelFaces(document: ProjectDocument): PanelFaceInfo[] {
    const list: PanelFaceInfo[] = [];
    if (!document) return list;

    const allNodes: CADNode[] = [];
    const traverse = (node: CADNode) => {
        allNodes.push(node);
        for (const child of node.children) traverse(child);
    };
    traverse(document.rootNode);

    for (const node of allNodes) {
        const d = node.domainData;
        if (!d || (d.type !== 'panel' && d.type !== 'part')) continue;
        const panel = d as PanelModel;

        // Pomiń elementy samego SmartBoxa
        const parent = node.parent;
        const gp = (parent?.domainData as any)?.generatorParams;
        if (gp && (String(gp.type || '').startsWith('smartbox_') || gp.boxType)) continue;

        const wNm = panel.width || mmToNm(800);
        const hNm = panel.height || mmToNm(600);
        const tNm = panel.thickness || mmToNm(18);
        const worldMat = node.getWorldMatrix();

        const facesConfig: Array<{ face: FaceName; centerLocal: Vec3; normalLocal: Vec3; cornersLocal: Vec3[] }> = [
            // FACE_Z_PLUS (wewnętrzna formatki)
            {
                face: 'FACE_Z_PLUS',
                centerLocal: new Vec3(0, 0, tNm / 2),
                normalLocal: new Vec3(0, 0, 1),
                cornersLocal: [
                    new Vec3(-wNm / 2, -hNm / 2, tNm / 2),
                    new Vec3(wNm / 2, -hNm / 2, tNm / 2),
                    new Vec3(wNm / 2, hNm / 2, tNm / 2),
                    new Vec3(-wNm / 2, hNm / 2, tNm / 2)
                ]
            },
            // FACE_Z_MINUS (zewnętrzna formatki)
            {
                face: 'FACE_Z_MINUS',
                centerLocal: new Vec3(0, 0, -tNm / 2),
                normalLocal: new Vec3(0, 0, -1),
                cornersLocal: [
                    new Vec3(-wNm / 2, -hNm / 2, -tNm / 2),
                    new Vec3(wNm / 2, -hNm / 2, -tNm / 2),
                    new Vec3(wNm / 2, hNm / 2, -tNm / 2),
                    new Vec3(-wNm / 2, hNm / 2, -tNm / 2)
                ]
            },
            // FACE_X_PLUS (krawędź +X)
            {
                face: 'FACE_X_PLUS',
                centerLocal: new Vec3(wNm / 2, 0, 0),
                normalLocal: new Vec3(1, 0, 0),
                cornersLocal: [
                    new Vec3(wNm / 2, -hNm / 2, -tNm / 2),
                    new Vec3(wNm / 2, hNm / 2, -tNm / 2),
                    new Vec3(wNm / 2, hNm / 2, tNm / 2),
                    new Vec3(wNm / 2, -hNm / 2, tNm / 2)
                ]
            },
            // FACE_X_MINUS (krawędź -X)
            {
                face: 'FACE_X_MINUS',
                centerLocal: new Vec3(-wNm / 2, 0, 0),
                normalLocal: new Vec3(-1, 0, 0),
                cornersLocal: [
                    new Vec3(-wNm / 2, -hNm / 2, -tNm / 2),
                    new Vec3(-wNm / 2, hNm / 2, -tNm / 2),
                    new Vec3(-wNm / 2, hNm / 2, tNm / 2),
                    new Vec3(-wNm / 2, -hNm / 2, tNm / 2)
                ]
            },
            // FACE_Y_PLUS (krawędź +Y)
            {
                face: 'FACE_Y_PLUS',
                centerLocal: new Vec3(0, hNm / 2, 0),
                normalLocal: new Vec3(0, 1, 0),
                cornersLocal: [
                    new Vec3(-wNm / 2, hNm / 2, -tNm / 2),
                    new Vec3(wNm / 2, hNm / 2, -tNm / 2),
                    new Vec3(wNm / 2, hNm / 2, tNm / 2),
                    new Vec3(-wNm / 2, hNm / 2, tNm / 2)
                ]
            },
            // FACE_Y_MINUS (krawędź -Y)
            {
                face: 'FACE_Y_MINUS',
                centerLocal: new Vec3(0, -hNm / 2, 0),
                normalLocal: new Vec3(0, -1, 0),
                cornersLocal: [
                    new Vec3(-wNm / 2, -hNm / 2, -tNm / 2),
                    new Vec3(wNm / 2, -hNm / 2, -tNm / 2),
                    new Vec3(wNm / 2, -hNm / 2, tNm / 2),
                    new Vec3(-wNm / 2, -hNm / 2, tNm / 2)
                ]
            }
        ];

        for (const fc of facesConfig) {
            const worldCenterNm = worldMat.transformPoint(fc.centerLocal);
            const worldNormal = worldMat.transformDirection(fc.normalLocal).normalize();
            const cornersWorld = fc.cornersLocal.map(c => worldMat.transformPoint(c));

            const minX = nmToMm(Math.min(...cornersWorld.map(c => c.x)));
            const maxX = nmToMm(Math.max(...cornersWorld.map(c => c.x)));
            const minY = nmToMm(Math.min(...cornersWorld.map(c => c.y)));
            const maxY = nmToMm(Math.max(...cornersWorld.map(c => c.y)));
            const minZ = nmToMm(Math.min(...cornersWorld.map(c => c.z)));
            const maxZ = nmToMm(Math.max(...cornersWorld.map(c => c.z)));

            list.push({
                node,
                panel,
                face: fc.face,
                worldCenterMm: new Vec3(nmToMm(worldCenterNm.x), nmToMm(worldCenterNm.y), nmToMm(worldCenterNm.z)),
                worldNormal,
                minBoundsMm: new Vec3(minX, minY, minZ),
                maxBoundsMm: new Vec3(maxX, maxY, maxZ)
            });
        }
    }

    return list;
}

/**
 * Wykrywa wnękę wokół punktu `probePointMm` w przestrzeni CAD:
 * - Oś X: lewo/prawo (szerokość)
 * - Oś Y: przód/tył (głębokość: przód = -D/2, tył = +D/2)
 * - Oś Z: dół/góra (wysokość: spód = 0, góra = +H)
 */
export function probeBayFromCADPoint(
    document: ProjectDocument,
    probePointMm: { x: number; y: number; z: number },
    options?: { maxDistanceMm?: number }
): DetectedBay | null {
    const maxDist = options?.maxDistanceMm || 3000;
    const px = probePointMm.x;
    const py = probePointMm.y;
    const pz = probePointMm.z;

    const faces = collectScenePanelFaces(document);
    if (faces.length === 0) return null;

    let hitLeft: { info: PanelFaceInfo; dist: number } | null = null;
    let hitRight: { info: PanelFaceInfo; dist: number } | null = null;
    let hitBottom: { info: PanelFaceInfo; dist: number } | null = null;
    let hitTop: { info: PanelFaceInfo; dist: number } | null = null;
    let hitBack: { info: PanelFaceInfo; dist: number } | null = null;
    let hitFront: { info: PanelFaceInfo; dist: number } | null = null;

    const tol = 100; // mm tolerancji zasięgu w poprzek

    for (const f of faces) {
        // 1. Lewy bok (szukamy na lewo: X <= px + 20, normalna skierowana w prawo: normal.x > 0.5)
        if (f.worldNormal.x > 0.5 && f.worldCenterMm.x <= px + 20) {
            const dist = Math.max(0, px - f.worldCenterMm.x);
            if (dist < maxDist &&
                py >= f.minBoundsMm.y - tol && py <= f.maxBoundsMm.y + tol &&
                pz >= f.minBoundsMm.z - tol && pz <= f.maxBoundsMm.z + tol) {
                if (!hitLeft || dist < hitLeft.dist) {
                    hitLeft = { info: f, dist };
                }
            }
        }

        // 2. Prawy bok (szukamy na prawo: X >= px - 20, normalna skierowana w lewo: normal.x < -0.5)
        if (f.worldNormal.x < -0.5 && f.worldCenterMm.x >= px - 20) {
            const dist = Math.max(0, f.worldCenterMm.x - px);
            if (dist < maxDist &&
                py >= f.minBoundsMm.y - tol && py <= f.maxBoundsMm.y + tol &&
                pz >= f.minBoundsMm.z - tol && pz <= f.maxBoundsMm.z + tol) {
                if (!hitRight || dist < hitRight.dist) {
                    hitRight = { info: f, dist };
                }
            }
        }

        // 3. Dno / wieniec dolny / półka (szukamy poniżej: Z <= pz + 20, normalna w górę: normal.z > 0.5)
        if (f.worldNormal.z > 0.5 && f.worldCenterMm.z <= pz + 20) {
            const dist = Math.max(0, pz - f.worldCenterMm.z);
            if (dist < maxDist &&
                px >= f.minBoundsMm.x - tol && px <= f.maxBoundsMm.x + tol &&
                py >= f.minBoundsMm.y - tol && py <= f.maxBoundsMm.y + tol) {
                if (!hitBottom || dist < hitBottom.dist) {
                    hitBottom = { info: f, dist };
                }
            }
        }

        // 4. Góra / wieniec górny / półka nad (szukamy powyżej: Z >= pz - 20, normalna w dół: normal.z < -0.5)
        if (f.worldNormal.z < -0.5 && f.worldCenterMm.z >= pz - 20) {
            const dist = Math.max(0, f.worldCenterMm.z - pz);
            if (dist < maxDist &&
                px >= f.minBoundsMm.x - tol && px <= f.maxBoundsMm.x + tol &&
                py >= f.minBoundsMm.y - tol && py <= f.maxBoundsMm.y + tol) {
                if (!hitTop || dist < hitTop.dist) {
                    hitTop = { info: f, dist };
                }
            }
        }

        // 5. Tył / plecy (szukamy z tyłu w CAD: Y >= py - 20, normalna skierowana do przodu szafy: normal.y < -0.5)
        if (f.worldNormal.y < -0.5 && f.worldCenterMm.y >= py - 20) {
            const dist = Math.max(0, f.worldCenterMm.y - py);
            if (dist < maxDist &&
                px >= f.minBoundsMm.x - tol && px <= f.maxBoundsMm.x + tol &&
                pz >= f.minBoundsMm.z - tol && pz <= f.maxBoundsMm.z + tol) {
                if (!hitBack || dist < hitBack.dist) {
                    hitBack = { info: f, dist };
                }
            }
        }

        // 6. Przód / front (normalna skierowana w stronę tyłu szafy: normal.y > 0.5, Y <= py + 20)
        if (f.worldNormal.y > 0.5 && f.worldCenterMm.y <= py + 20) {
            const dist = Math.max(0, py - f.worldCenterMm.y);
            if (dist < maxDist &&
                px >= f.minBoundsMm.x - tol && px <= f.maxBoundsMm.x + tol &&
                pz >= f.minBoundsMm.z - tol && pz <= f.maxBoundsMm.z + tol) {
                if (!hitFront || dist < hitFront.dist) {
                    hitFront = { info: f, dist };
                }
            }
        }
    }

    if (!hitLeft || !hitRight || !hitBottom || !hitTop) {
        return null; // Wnęka musi być co najmniej ograniczona z 4 stron (lewo, prawo, dół, góra)
    }

    const leftX = hitLeft.info.worldCenterMm.x;
    const rightX = hitRight.info.worldCenterMm.x;
    const bottomZ = hitBottom.info.worldCenterMm.z;
    const topZ = hitTop.info.worldCenterMm.z;

    // W CAD: Przód szafy to mniejsze Y (-D/2), Tył to większe Y (+D/2)
    const frontPlaneY = hitFront
        ? hitFront.info.worldCenterMm.y
        : Math.min(hitLeft.info.minBoundsMm.y, hitRight.info.minBoundsMm.y, hitBottom.info.minBoundsMm.y);

    const backY = hitBack
        ? hitBack.info.worldCenterMm.y
        : Math.max(hitLeft.info.maxBoundsMm.y, hitRight.info.maxBoundsMm.y, hitBottom.info.maxBoundsMm.y);

    const width = Math.max(10, rightX - leftX);
    const height = Math.max(10, topZ - bottomZ);
    const depth = Math.max(10, backY - frontPlaneY);

    const centerX = (leftX + rightX) / 2;
    const centerY = (frontPlaneY + backY) / 2;
    const centerZ = (bottomZ + topZ) / 2;

    // Znajdź wspólnego rodzica korpusu
    let parentCabinetId: string | undefined = undefined;
    let curr: CADNode | null = hitLeft.info.node.parent;
    while (curr && curr.id !== document.rootNode.id) {
        if (curr.domainData?.type === 'container' || (curr.domainData as any)?.generatorParams) {
            parentCabinetId = curr.id;
            break;
        }
        curr = curr.parent;
    }

    const frontRefNode = hitFront ? hitFront.info.node : hitLeft.info.node;
    const backRefNode = hitBack ? hitBack.info.node : hitLeft.info.node;

    return {
        boundsMm: { width, height, depth },
        boundsNm: { width: mmToNm(width), height: mmToNm(height), depth: mmToNm(depth) },
        centerWorldMm: { x: centerX, y: centerY, z: centerZ },
        parentCabinetId,
        boundary: {
            left: {
                nodeId: hitLeft.info.node.id,
                nodeName: hitLeft.info.node.name,
                face: hitLeft.info.face,
                faceName: hitLeft.info.face,
                worldPointMm: { x: leftX, y: centerY, z: centerZ },
                planeCoordMm: leftX
            },
            right: {
                nodeId: hitRight.info.node.id,
                nodeName: hitRight.info.node.name,
                face: hitRight.info.face,
                faceName: hitRight.info.face,
                worldPointMm: { x: rightX, y: centerY, z: centerZ },
                planeCoordMm: rightX
            },
            bottom: {
                nodeId: hitBottom.info.node.id,
                nodeName: hitBottom.info.node.name,
                face: hitBottom.info.face,
                faceName: hitBottom.info.face,
                worldPointMm: { x: centerX, y: centerY, z: bottomZ },
                planeCoordMm: bottomZ
            },
            top: {
                nodeId: hitTop.info.node.id,
                nodeName: hitTop.info.node.name,
                face: hitTop.info.face,
                faceName: hitTop.info.face,
                worldPointMm: { x: centerX, y: centerY, z: topZ },
                planeCoordMm: topZ
            },
            back: {
                nodeId: backRefNode.id,
                nodeName: hitBack ? hitBack.info.node.name : 'Tylna krawędź',
                face: hitBack ? hitBack.info.face : 'FACE_Z_PLUS',
                faceName: hitBack ? hitBack.info.face : 'FACE_Z_PLUS',
                worldPointMm: { x: centerX, y: backY, z: centerZ },
                planeCoordMm: backY
            },
            front: {
                nodeId: frontRefNode.id,
                nodeName: hitFront ? hitFront.info.node.name : 'Przednia krawędź',
                face: hitFront ? hitFront.info.face : 'FACE_Y_MINUS',
                faceName: hitFront ? hitFront.info.face : 'FACE_Y_MINUS',
                worldPointMm: { x: centerX, y: frontPlaneY, z: centerZ },
                planeCoordMm: frontPlaneY
            },
            frontPlaneYMm: frontPlaneY
        }
    };
}

/**
 * Wykrywa wnękę meblową za pomocą bezpośredniego raycastingu 3D na fizycznej geometrii w scenie Babylon.js.
 * Wypuszcza promienie z punktu kliknięcia w 6 kierunkach:
 * - Lewo (-X) / Prawo (+X)
 * - Dół (-Y) / Góra (+Y)
 * - Tył (+Z) / Przód (-Z)
 * 
 * Działa w 100% na geometrii siatek 3D (bez zgadywania ról i bez modeli matematycznych).
 */
export function probeBayFromSceneRay(
    scene: any,
    pickResult: any,
    document: ProjectDocument
): DetectedBay | null {
    const B = typeof (window as any).BABYLON !== 'undefined' ? (window as any).BABYLON : (globalThis as any).BABYLON;
    if (!scene || !pickResult || !pickResult.hit || !pickResult.pickedPoint || !B) return null;

    const p = pickResult.pickedPoint.clone();
    let norm = pickResult.getNormal ? pickResult.getNormal(true) : null;
    if (!norm || norm.length() < 0.1) {
        norm = new B.Vector3(0, 1, 0);
    } else {
        norm = norm.normalize();
    }

    // Odsunięcie punktu startowego o 6 mm w stronę wnętrza wnęki (wzdłuż normalnej trafienia)
    let origin = p.add(norm.scale(6));

    const predicate = (m: any) => {
        if (!m || !m.isPickable || !m.isVisible) return false;
        const name = m.name || '';
        if (
            name.includes('ground') ||
            name.includes('grid') ||
            name.includes('smartbox_plane') ||
            name.includes('smartbox_bay') ||
            name.includes('gizmo') ||
            name.includes('helper') ||
            name.includes('axis') ||
            name.includes('highlight') ||
            name.includes('preview')
        ) {
            return false;
        }
        if (name.endsWith('_SB') || name.includes('smartbox')) {
            return false;
        }
        return true;
    };

    const maxDist = 3500;
    let hitLeft = scene.pickWithRay(new B.Ray(origin, new B.Vector3(-1, 0, 0), maxDist), predicate, false);
    let hitRight = scene.pickWithRay(new B.Ray(origin, new B.Vector3(1, 0, 0), maxDist), predicate, false);
    let hitBottom = scene.pickWithRay(new B.Ray(origin, new B.Vector3(0, -1, 0), maxDist), predicate, false);
    let hitTop = scene.pickWithRay(new B.Ray(origin, new B.Vector3(0, 1, 0), maxDist), predicate, false);
    let hitBack = scene.pickWithRay(new B.Ray(origin, new B.Vector3(0, 0, 1), maxDist), predicate, false);
    let hitFront = scene.pickWithRay(new B.Ray(origin, new B.Vector3(0, 0, -1), maxDist), predicate, false);

    // Fallback gdy punkt leżał na dnie lub ściance i odsunięcie poszło w stronę ściany
    if (!hitBottom?.hit || !hitTop?.hit || !hitLeft?.hit || !hitRight?.hit) {
        const altOrigin = p.subtract(norm.scale(6));
        const altHitLeft = !hitLeft?.hit ? scene.pickWithRay(new B.Ray(altOrigin, new B.Vector3(-1, 0, 0), maxDist), predicate, false) : hitLeft;
        const altHitRight = !hitRight?.hit ? scene.pickWithRay(new B.Ray(altOrigin, new B.Vector3(1, 0, 0), maxDist), predicate, false) : hitRight;
        const altHitBottom = !hitBottom?.hit ? scene.pickWithRay(new B.Ray(altOrigin, new B.Vector3(0, -1, 0), maxDist), predicate, false) : hitBottom;
        const altHitTop = !hitTop?.hit ? scene.pickWithRay(new B.Ray(altOrigin, new B.Vector3(0, 1, 0), maxDist), predicate, false) : hitTop;

        if (altHitLeft?.hit) hitLeft = altHitLeft;
        if (altHitRight?.hit) hitRight = altHitRight;
        if (altHitBottom?.hit) hitBottom = altHitBottom;
        if (altHitTop?.hit) hitTop = altHitTop;
    }

    // Wnęka musi być co najmniej ograniczona z 4 stron (lewo, prawo, dół, góra)
    if (!hitLeft?.hit || !hitRight?.hit || !hitBottom?.hit || !hitTop?.hit) {
        return null;
    }

    const leftX = hitLeft.pickedPoint.x;
    const rightX = hitRight.pickedPoint.x;
    const bottomY = hitBottom.pickedPoint.y;
    const topY = hitTop.pickedPoint.y;

    const refMesh = hitLeft.pickedMesh || hitRight.pickedMesh;
    const refBb = refMesh?.getBoundingInfo()?.boundingBox;

    let backZ = hitBack?.hit ? hitBack.pickedPoint.z : (refBb ? refBb.maximumWorld.z : p.z + 300);
    let frontZ = hitFront?.hit ? hitFront.pickedPoint.z : (refBb ? refBb.minimumWorld.z : p.z - 300);

    if (frontZ > backZ) {
        const tmp = frontZ;
        frontZ = backZ;
        backZ = tmp;
    }

    const width = Math.max(10, Math.abs(rightX - leftX));
    const height = Math.max(10, Math.abs(topY - bottomY));
    const depth = Math.max(10, Math.abs(backZ - frontZ));

    const centerX = (leftX + rightX) / 2;
    const centerY = (bottomY + topY) / 2; // Babylon Y = CAD Z (wysokość)
    const centerZ = (frontZ + backZ) / 2; // Babylon Z = CAD Y (głębokość)

    const resolveNode = (hit: any, fallbackFace: FaceName): { id: string; name: string; face: FaceName } => {
        if (!hit || !hit.hit || !hit.pickedMesh) {
            return { id: '', name: '', face: fallbackFace };
        }
        const m = hit.pickedMesh;
        let id = '';
        let name = '';
        let face: FaceName = fallbackFace;

        if (m.metadata?.panelModel && document) {
            const node = document.findNode(m.metadata.panelModel.id);
            if (node) {
                id = node.id;
                name = node.name;
            } else {
                id = m.metadata.panelModel.id;
                name = m.metadata.panelModel.name || '';
            }
        }
        if (!id && m.parent) {
            name = m.parent.name || '';
            if (document) {
                const allPanels = typeof (document as any).getPanels === 'function' ? (document as any).getPanels() : [];
                const found = allPanels.find((n: any) => n.name === name || n.id === name);
                if (found) id = found.id;
            }
        }
        if (m.metadata?.faceName) {
            face = m.metadata.faceName as FaceName;
        }
        return { id: id || m.id || '', name: name || m.name || '', face };
    };

    const leftInfo = resolveNode(hitLeft, 'FACE_Z_PLUS');
    const rightInfo = resolveNode(hitRight, 'FACE_Z_PLUS');
    const bottomInfo = resolveNode(hitBottom, 'FACE_Z_PLUS');
    const topInfo = resolveNode(hitTop, 'FACE_Z_MINUS');
    const backInfo = resolveNode(hitBack, 'FACE_Z_PLUS');
    const frontInfo = resolveNode(hitFront, 'FACE_Y_MINUS');

    // Znajdź kontener korpusu nadrzędnego
    let parentCabinetId: string | undefined = undefined;
    if (document) {
        const testNodeId = leftInfo.id || bottomInfo.id;
        let curr: CADNode | null = testNodeId ? document.findNode(testNodeId) : null;
        while (curr && curr.id !== document.rootNode.id) {
            if (curr.domainData?.type === 'container' || (curr.domainData as any)?.generatorParams) {
                parentCabinetId = curr.id;
                break;
            }
            curr = curr.parent;
        }
    }

    return {
        boundsMm: { width, height, depth },
        boundsNm: { width: mmToNm(width), height: mmToNm(height), depth: mmToNm(depth) },
        centerWorldMm: { x: centerX, y: centerZ, z: centerY },
        parentCabinetId,
        boundary: {
            left: {
                nodeId: leftInfo.id,
                nodeName: leftInfo.name || 'Bok Lewy',
                face: leftInfo.face,
                faceName: leftInfo.face,
                worldPointMm: { x: leftX, y: centerZ, z: centerY },
                planeCoordMm: leftX
            },
            right: {
                nodeId: rightInfo.id,
                nodeName: rightInfo.name || 'Bok Prawy',
                face: rightInfo.face,
                faceName: rightInfo.face,
                worldPointMm: { x: rightX, y: centerZ, z: centerY },
                planeCoordMm: rightX
            },
            bottom: {
                nodeId: bottomInfo.id,
                nodeName: bottomInfo.name || 'Dół',
                face: bottomInfo.face,
                faceName: bottomInfo.face,
                worldPointMm: { x: centerX, y: centerZ, z: bottomY },
                planeCoordMm: bottomY
            },
            top: {
                nodeId: topInfo.id,
                nodeName: topInfo.name || 'Góra',
                face: topInfo.face,
                faceName: topInfo.face,
                worldPointMm: { x: centerX, y: centerZ, z: topY },
                planeCoordMm: topY
            },
            back: {
                nodeId: backInfo.id || leftInfo.id,
                nodeName: backInfo.name || 'Tył',
                face: backInfo.face,
                faceName: backInfo.face,
                worldPointMm: { x: centerX, y: backZ, z: centerY },
                planeCoordMm: backZ
            },
            front: {
                nodeId: frontInfo.id || leftInfo.id,
                nodeName: frontInfo.name || 'Przód',
                face: frontInfo.face,
                faceName: frontInfo.face,
                worldPointMm: { x: centerX, y: frontZ, z: centerY },
                planeCoordMm: frontZ
            },
            frontPlaneYMm: frontZ
        }
    };
}
