/**
 * bloki-bay-visualizer.ts
 *
 * Wizualizator 3D podświetlający wykrytą wnękę mebla:
 * Podświetla ściany ograniczające wnękę (left, right, bottom, top, back)
 * za pomocą wyraźnych płaszczyzn bazowych, bez zbędnej bryły/kontenera w środku.
 */

import type { DetectedBay } from './02_bloki-bay-detector.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { cadMatrixToRenderMatrix, cadToRender } from '../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Mat4 } from '../A1_core/cad-math/mat4.js';
import { nmToMm } from '../A1_core/cad-math/units.js';

declare const BABYLON: any;

let offsetPlaneMeshes: any[] = [];

function _clearOffsetPlanes(): void {
    for (const p of offsetPlaneMeshes) {
        if (p && !p.isDisposed()) {
            p.dispose();
        }
    }
    offsetPlaneMeshes = [];
}

/**
 * Podświetla przestrzeń wykrytej wnęki za pomocą płaszczyzn ścian ograniczających.
 */
export function highlightBayInScene(scene: any, bay: DetectedBay): void {
    const B = typeof BABYLON !== 'undefined' ? BABYLON : (globalThis as any).BABYLON;
    if (!scene || !bay || !B) return;

    _clearOffsetPlanes();

    const doc = ContextManager.instance?.document;
    const parentCab = doc && bay.parentCabinetId ? doc.findNode(bay.parentCabinetId) : null;
    const canUseRootNode = !!(parentCab && typeof B.TransformNode === 'function');
    const rootNode = canUseRootNode ? new B.TransformNode('blok_bay_root', scene) : null;
    if (rootNode && parentCab) {
        offsetPlaneMeshes.push(rootNode);
        const { translation, rotation, scale } = parentCab.getWorldMatrix().decompose();
        const translationMm = new Vec3(nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z));
        const bPos = cadToRender(translationMm);
        rootNode.position.set(bPos.x, bPos.y, bPos.z);

        const rotMat = cadMatrixToRenderMatrix(Mat4.fromQuaternion(rotation));
        const { rotation: bRot } = rotMat.decompose();
        if (B.Quaternion) {
            rootNode.rotationQuaternion = new B.Quaternion(bRot.x, bRot.y, bRot.z, bRot.w);
        } else {
            rootNode.rotationQuaternion = { x: bRot.x, y: bRot.y, z: bRot.z, w: bRot.w };
        }
        rootNode.scaling.set(scale.x, scale.y, scale.z);
    }
    const hasCab = !!rootNode;

    const leftX = bay.boundary?.left?.planeCoordMm ?? (bay.centerWorldMm.x - bay.boundsMm.width / 2);
    const rightX = bay.boundary?.right?.planeCoordMm ?? (bay.centerWorldMm.x + bay.boundsMm.width / 2);
    const bottomZ = bay.boundary?.bottom?.planeCoordMm ?? (bay.centerWorldMm.z - bay.boundsMm.height / 2);
    const topZ = bay.boundary?.top?.planeCoordMm ?? (bay.centerWorldMm.z + bay.boundsMm.height / 2);
    const frontY = bay.boundary?.frontPlaneYMm ?? (bay.boundary?.front?.planeCoordMm ?? (bay.centerWorldMm.y - bay.boundsMm.depth / 2));
    const backY = bay.boundary?.back?.planeCoordMm ?? (bay.centerWorldMm.y + bay.boundsMm.depth / 2);

    const cx = hasCab ? (leftX + rightX) / 2 : bay.centerWorldMm.x;
    const cy = hasCab ? (frontY + backY) / 2 : bay.centerWorldMm.y;
    const cz = hasCab ? (bottomZ + topZ) / 2 : bay.centerWorldMm.z;
    const bw = Math.max(1, (hasCab ? Math.abs(rightX - leftX) : bay.boundsMm.width) - 2);
    const bh = Math.max(1, (hasCab ? Math.abs(topZ - bottomZ) : bay.boundsMm.height) - 2);
    const bd = Math.max(1, (hasCab ? Math.abs(backY - frontY) : bay.boundsMm.depth) - 2);

    const roofAngleDeg = bay.roofAngleDeg ?? bay.boundary?.top?.slopeAngleDeg;
    const isSlopedLR = (roofAngleDeg !== undefined && Math.abs(roofAngleDeg) > 0.05) || bay.heightLeftMm !== undefined;
    const tanBeta = roofAngleDeg ? Math.tan(((roofAngleDeg || 0) * Math.PI) / 180) : 0;

    const yBot = bottomZ + 1.5;
    const topZCenter = topZ - 1.5;

    // Wysokości dla skosu lewo-prawo (LR)
    const yTopLeft = bay.heightLeftMm !== undefined
        ? yBot + bay.heightLeftMm
        : (isSlopedLR ? Math.max(yBot + 10, topZCenter - (bw / 2) * tanBeta) : topZCenter);
    const yTopRight = bay.heightRightMm !== undefined
        ? yBot + bay.heightRightMm
        : (isSlopedLR ? Math.max(yBot + 10, topZCenter + (bw / 2) * tanBeta) : topZCenter);
    const bhLeft = isSlopedLR ? Math.max(1, yTopLeft - yBot) : bh;
    const bhRight = isSlopedLR ? Math.max(1, yTopRight - yBot) : bh;
    const czLeft = isSlopedLR ? (yTopLeft + yBot) / 2 : cz;
    const czRight = isSlopedLR ? (yTopRight + yBot) / 2 : cz;

    const x0 = cx - bw / 2;
    const x1 = cx + bw / 2;
    const z0 = cy - bd / 2;
    const z1 = cy + bd / 2;

    // 1. Półprzezroczysta bryła reprezentująca przestrzeń w środku wnęki w kolorze magenty
    const volMat = new B.StandardMaterial('blok_bay_vol_mat', scene);
    volMat.diffuseColor = new B.Color3(1.0, 0.1, 0.85); // Wyrazista Magenta
    volMat.emissiveColor = new B.Color3(0.65, 0.05, 0.55);
    volMat.alpha = 0.28;
    volMat.backFaceCulling = false;
    volMat.disableLighting = true; // Zapewnia widoczność magenty niezależnie od kąta oświetlenia

    if (isSlopedLR && typeof B.VertexData === 'function') {
        const positions = [
            x0, yBot, z0,       // 0
            x1, yBot, z0,       // 1
            x1, yTopRight, z0,  // 2
            x0, yTopLeft, z0,   // 3
            x0, yBot, z1,       // 4
            x1, yBot, z1,       // 5
            x1, yTopRight, z1,  // 6
            x0, yTopLeft, z1    // 7
        ];
        const indices = [
            0, 3, 2, 0, 2, 1, // Front (-Z w Babylon)
            4, 5, 6, 4, 6, 7, // Back (+Z w Babylon)
            4, 7, 3, 4, 3, 0, // Left (-X w Babylon)
            1, 2, 6, 1, 6, 5, // Right (+X w Babylon)
            4, 0, 1, 4, 1, 5, // Bottom (-Y w Babylon)
            3, 7, 6, 3, 6, 2  // Top (+Y skośne)
        ];
        const volumeMesh = new B.Mesh('blok_bay_volume', scene);
        const vertexData = new B.VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        const normals: number[] = [];
        if (typeof B.VertexData?.ComputeNormals === 'function') {
            B.VertexData.ComputeNormals(positions, indices, normals);
            vertexData.normals = normals;
        }
        vertexData.applyToMesh(volumeMesh);
        volumeMesh.parent = rootNode;
        volumeMesh.material = volMat;
        volumeMesh.isPickable = false;
        if (typeof volumeMesh.enableEdgesRendering === 'function') {
            volumeMesh.enableEdgesRendering(0.9999);
            volumeMesh.edgesWidth = 2.5;
            const ColorClass = B.Color4 || B.Color3;
            volumeMesh.edgesColor = new ColorClass(1.0, 0.1, 0.85, 0.95);
            if (volumeMesh.edgesRenderer?.lineShader) {
                volumeMesh.edgesRenderer.lineShader.zOffset = -2.5;
            }
        }
        offsetPlaneMeshes.push(volumeMesh);
    } else if (typeof B.MeshBuilder?.CreateBox === 'function') {
        const volumeBox = B.MeshBuilder.CreateBox('blok_bay_volume', {
            width: bw,
            height: bh,
            depth: bd
        }, scene);
        volumeBox.parent = rootNode;
        volumeBox.material = volMat;
        volumeBox.isPickable = false;
        volumeBox.position.x = cx;
        volumeBox.position.y = cz;
        volumeBox.position.z = cy;
        if (typeof volumeBox.enableEdgesRendering === 'function') {
            volumeBox.enableEdgesRendering(0.9999);
            volumeBox.edgesWidth = 2.5;
            const ColorClass = B.Color4 || B.Color3;
            volumeBox.edgesColor = new ColorClass(1.0, 0.1, 0.85, 0.95);
            if (volumeBox.edgesRenderer?.lineShader) {
                volumeBox.edgesRenderer.lineShader.zOffset = -2.5;
            }
        }
        offsetPlaneMeshes.push(volumeBox);
    }

    // 2. Płaszczyzny ścian ograniczających wnękę (left, right, bottom, top, back, front)
    if (bay.boundary) {
        const planeMat = new B.StandardMaterial('blok_bay_plane_mat', scene);
        planeMat.diffuseColor = new B.Color3(1.0, 0.1, 0.85); // Wyrazista Magenta / Fiolet
        planeMat.emissiveColor = new B.Color3(0.65, 0.05, 0.55);
        planeMat.alpha = 0.45;
        planeMat.backFaceCulling = false;
        planeMat.disableLighting = true;

        const makePlane = (name: string, width: number, height: number, posX: number, posY: number, posZ: number, rotX: number, rotY: number) => {
            const p = B.MeshBuilder.CreatePlane(name, { width: Math.max(1, width), height: Math.max(1, height) }, scene);
            p.parent = rootNode;
            p.material = planeMat;
            p.isPickable = false;
            p.position.x = posX;
            p.position.y = posY;
            p.position.z = posZ;
            p.rotation.x = rotX;
            p.rotation.y = rotY;
            offsetPlaneMeshes.push(p);
        };

        const makeTrapezoidPlane = (name: string, posZ: number) => {
            const positions = [
                x0, yBot, posZ,       // 0 - dół lewo
                x1, yBot, posZ,       // 1 - dół prawo
                x1, yTopRight, posZ,  // 2 - góra prawo (ścięta do skosu)
                x0, yTopLeft, posZ    // 3 - góra lewo (ścięta do skosu)
            ];
            const indices = [
                0, 1, 2, 0, 2, 3,
                0, 2, 1, 0, 3, 2
            ];
            const planeMesh = new B.Mesh(name, scene);
            planeMesh.parent = rootNode;
            const vertexData = new B.VertexData();
            vertexData.positions = positions;
            vertexData.indices = indices;
            const normals: number[] = [];
            if (typeof B.VertexData?.ComputeNormals === 'function') {
                B.VertexData.ComputeNormals(positions, indices, normals);
                vertexData.normals = normals;
            }
            vertexData.applyToMesh(planeMesh);
            planeMesh.material = planeMat;
            planeMesh.isPickable = false;
            offsetPlaneMeshes.push(planeMesh);
        };

        // Dół (Bottom) — normalna skierowana w górę (+Y w Babylon)
        if (bottomZ !== undefined) {
            makePlane('blok_plane_bottom', bw, bd, cx, bottomZ + 1.5, cy, Math.PI / 2, 0);
        }

        // Góra (Top) — normalna skierowana w dół (-Y w Babylon) lub skośna pod kątem dachu
        if (topZ !== undefined) {
            if (isSlopedLR && roofAngleDeg && typeof B.Quaternion?.RotationAxis === 'function') {
                const betaRad = (roofAngleDeg * Math.PI) / 180;
                const cosBeta = Math.abs(Math.cos(betaRad)) || 1;
                const slopeW = bw / cosBeta;
                const p = B.MeshBuilder.CreatePlane('blok_plane_top', { width: Math.max(1, slopeW), height: Math.max(1, bd) }, scene);
                p.parent = rootNode;
                p.material = planeMat;
                p.isPickable = false;
                p.position.x = cx;
                p.position.y = topZ - 1.5;
                p.position.z = cy;
                const qPitch = B.Quaternion.RotationAxis(new B.Vector3(1, 0, 0), -Math.PI / 2);
                const qRoll = B.Quaternion.RotationAxis(new B.Vector3(0, 0, 1), betaRad);
                p.rotationQuaternion = qRoll.multiply(qPitch);
                offsetPlaneMeshes.push(p);
            } else {
                makePlane('blok_plane_top', bw, bd, cx, topZ - 1.5, cy, -Math.PI / 2, 0);
            }
        }

        // Bok Lewy (Left) — normalna skierowana w prawo (+X w Babylon, do wnętrza szafy)
        if (leftX !== undefined) {
            makePlane('blok_plane_left', bd, bhLeft, leftX + 1.5, czLeft, cy, 0, -Math.PI / 2);
        }

        // Bok Prawy (Right) — normalna skierowana w lewo (-X w Babylon, do wnętrza szafy)
        if (rightX !== undefined) {
            makePlane('blok_plane_right', bd, bhRight, rightX - 1.5, czRight, cy, 0, Math.PI / 2);
        }

        // Plecy (Back) — docięte do skosu dachu jako trapez w szafkach skośnych lub prostokąt
        if (backY !== undefined) {
            if (isSlopedLR && typeof B.VertexData === 'function') {
                makeTrapezoidPlane('blok_plane_back', backY - 1.5);
            } else {
                makePlane('blok_plane_back', bw, bh, cx, cz, backY - 1.5, 0, 0);
            }
        }

        // Przód (Front) — docięte do skosu dachu jako trapez w szafkach skośnych lub prostokąt
        if (frontY !== undefined) {
            if (isSlopedLR && typeof B.VertexData === 'function') {
                makeTrapezoidPlane('blok_plane_front', frontY + 1.5);
            } else {
                makePlane('blok_plane_front', bw, bh, cx, cz, frontY + 1.5, 0, Math.PI);
            }
        }
    }

    try {
        ContextManager.instance?.viewport?.requestRender(2);
    } catch {}
}

/**
 * Całkowicie wyłącza podświetlenie wnęki i usuwa płaszczyzny podglądu ze sceny.
 */
export function clearBayHighlight(scene?: any): void {
    _clearOffsetPlanes();
    try {
        ContextManager.instance?.viewport?.requestRender(2);
    } catch {}
}
