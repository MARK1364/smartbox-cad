/**
 * SmartPanel Web — SceneSyncAdapter
 *
 * Most między domeną CAD (CADNode, Z-up) a silnikiem renderowania (Babylon.js, Y-up).
 *
 * STRATEGIA: adapter ustawia LOCAL matrix meshu w Babylonie.
 * Babylon odtwarza hierarchię parent-child i liczy worldMatrix sam.
 * Dzięki temu nie ma podwójnego zastosowania transformacji.
 *
 * Przepływ:
 *   CADNode.localMatrix zmieniona
 *     → _syncLocalToMesh(node, mesh)
 *     → konwersja CAD→Babylon przez coord-system
 *     → mesh.position / mesh.rotationQuaternion / mesh.scaling
 *
 * Odwrotny przepływ (po gizmo drag):
 *   mesh zmieniony przez gizmo
 *     → syncFromMesh(mesh)
 *     → konwersja Babylon→CAD
 *     → node.setLocalMatrix(localMatrix)
 *
 * Zero zależności od Babylon.js w czasie kompilacji (deklaracja `declare const BABYLON`).
 */

import { CADNode } from './cad-node.js';
import { Mat4 } from '../cad-math/mat4.js';
import { Vec3 } from '../cad-math/vec3.js';
import { Quat } from '../cad-math/quat.js';
import {
    cadMatrixToRenderMatrix,
    renderMatrixToCADMatrix,
    cadToRender,
    renderToCAD
} from '../cad-math/coord-system.js';
import { nmToMm, mmToNm } from '../cad-math/units.js';

declare const BABYLON: any;

// ─── Typy ────────────────────────────────────────────────────────────────────

interface Binding {
    node: CADNode;
    mesh: any;           // BABYLON.TransformNode
    unsubscribe: () => void;
}

// ─── SceneSyncAdapter ─────────────────────────────────────────────────────────

export class SceneSyncAdapter {
    /** CADNode.id → Binding */
    private nodeBindings: Map<string, Binding> = new Map();
    /** mesh → CADNode (do syncFromMesh) */
    private meshToNode: Map<any, CADNode> = new Map();

    // ─── Bind / Unbind ────────────────────────────────────────

    /**
     * Podłącza CADNode do TransformNode Babylona.
     * Przy każdej zmianie localMatrix w CADNode — mesh jest aktualizowany.
     *
     * @param node  Węzeł domenowy CAD
     * @param mesh  BABYLON.TransformNode lub BABYLON.AbstractMesh
     */
    bind(node: CADNode, mesh: any): void {
        this.unbind(node);

        // Synchronizacja rodzica w silniku graficznym Babylon.js
        if (node.parent) {
            const parentBinding = this.nodeBindings.get(node.parent.id);
            if (parentBinding && parentBinding.mesh && mesh.parent !== parentBinding.mesh) {
                mesh.parent = parentBinding.mesh;
            }
        }

        // Synchronizacja dzieci (jeśli powiązano rodzica po dziecku)
        for (const childNode of node.children) {
            const childBinding = this.nodeBindings.get(childNode.id);
            if (childBinding && childBinding.mesh && childBinding.mesh.parent !== mesh) {
                childBinding.mesh.parent = mesh;
            }
        }

        // Subskrybujemy zmiany worldMatrix, ale synchronizujemy LOCAL matrix meshu.
        const unsubscribe = node.onWorldMatrixChanged(() => {
            this._syncLocalToMesh(node, mesh);
        });

        this.nodeBindings.set(node.id, { node, mesh, unsubscribe });
        this.meshToNode.set(mesh, node);

        // Wymuś pierwszą synchronizację
        this._syncLocalToMesh(node, mesh);
    }

    /**
     * Wypisuje porównawcze drzewo domenowe CADNode oraz drzewo silnika graficznego Babylon.js.
     */
    debugDumpTrees(): string {
        let output = '=== DRZEWO DOMENOWE CAD (CADNode) ===\n';

        const formatCADNode = (n: CADNode, depth: number = 0): string => {
            const indent = '  '.repeat(depth);
            const { translation } = n.localMatrix.decompose();
            const posX = Math.round(nmToMm(translation.x));
            const posY = Math.round(nmToMm(translation.y));
            const posZ = Math.round(nmToMm(translation.z));
            let str = `${indent}├─ [${n.nodeType}] ${n.name} (id: ${n.id}) -> LocalPos: (${posX}, ${posY}, ${posZ}) mm, Children: ${n.children.length}\n`;
            for (const child of n.children) {
                str += formatCADNode(child, depth + 1);
            }
            return str;
        };

        const doc = typeof (window as any).ContextManager !== 'undefined' ? (window as any).ContextManager.instance?.document : null;
        if (doc && doc.rootNode) {
            output += formatCADNode(doc.rootNode, 0);
        } else {
            const roots: CADNode[] = [];
            for (const binding of this.nodeBindings.values()) {
                if (!binding.node.parent) {
                    roots.push(binding.node);
                }
            }
            for (const r of roots) {
                output += formatCADNode(r, 0);
            }
        }

        output += '\n=== DRZEWO GRAFICZNE (Babylon.js) ===\n';
        
        const allMeshes = Array.from(this.nodeBindings.values()).map(b => b.mesh);
        const formatBabylonMesh = (m: any, depth: number = 0): string => {
            const indent = '  '.repeat(depth);
            const parentName = m.parent ? (m.parent.name || m.parent.id || 'Parent') : 'ROOT';
            const px = m.position ? Math.round(m.position.x) : 0;
            const py = m.position ? Math.round(m.position.y) : 0;
            const pz = m.position ? Math.round(m.position.z) : 0;
            let str = `${indent}├─ Mesh "${m.name || 'Mesh'}" (Parent: ${parentName}) -> LocalPos: (${px}, ${py}, ${pz})\n`;

            // Dzieci mesha podłączone w Babylonie
            const children = allMeshes.filter(child => child.parent === m);
            for (const c of children) {
                str += formatBabylonMesh(c, depth + 1);
            }
            return str;
        };

        const rootMeshes = allMeshes.filter(m => !m.parent || !allMeshes.includes(m.parent));
        if (rootMeshes.length > 0) {
            for (const rm of rootMeshes) {
                output += formatBabylonMesh(rm, 0);
            }
        } else {
            for (const m of allMeshes) {
                const px = m.position ? Math.round(m.position.x) : 0;
                const py = m.position ? Math.round(m.position.y) : 0;
                const pz = m.position ? Math.round(m.position.z) : 0;
                output += `├─ Mesh "${m.name}" -> LocalPos: (${px}, ${py}, ${pz})\n`;
            }
        }

        console.log('%c[CAD & Babylon SceneTree Inspector]', 'color: #4af; font-weight: bold; font-size: 14px;');
        console.log(output);
        return output;
    }

    unbind(node: CADNode): void {
        const binding = this.nodeBindings.get(node.id);
        if (!binding) return;
        binding.unsubscribe();
        this.meshToNode.delete(binding.mesh);
        this.nodeBindings.delete(node.id);
    }

    unbindAll(): void {
        for (const b of this.nodeBindings.values()) b.unsubscribe();
        this.nodeBindings.clear();
        this.meshToNode.clear();
    }

    // ─── Sync domena → render (local matrix) ─────────────────

    /**
     * Przelicza localMatrix z CADNode i zapisuje do meshu Babylona
     * jako position / rotationQuaternion / scaling.
     *
     * Babylon sam liczy worldMatrix przez swoje drzewo parent-child.
     * Nie używamy freezeWorldMatrix — zapobiega to podwójnej transformacji.
     */
    private _syncLocalToMesh(node: CADNode, mesh: any): void {
        if (!mesh) return;

        const { translation, rotation, scale } = node.localMatrix.decompose();

        // Konwersja CAD (Z-up, nm) → Babylon (Y-up, mm)
        const translationMm = new Vec3(nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z));
        const bPos = cadToRender(translationMm);
        mesh.position.set(bPos.x, bPos.y, bPos.z);

        // Rotacja: przeliczamy kwaternion przez macierz zmiany bazy
        const rotMat = cadMatrixToRenderMatrix(Mat4.fromQuaternion(rotation));
        const { rotation: bRot } = rotMat.decompose();
        if (typeof BABYLON !== 'undefined' && BABYLON.Quaternion) {
            mesh.rotationQuaternion = new BABYLON.Quaternion(bRot.x, bRot.y, bRot.z, bRot.w);
        } else {
            mesh.rotationQuaternion = { x: bRot.x, y: bRot.y, z: bRot.z, w: bRot.w };
        }

        // Skala nie zmienia się przy zamianie osi (izotropowa)
        mesh.scaling.set(scale.x, scale.y, scale.z);
    }

    // ─── Sync render → domena ─────────────────────────────────

    /**
     * Odczytuje lokalną transformację z meshu Babylona i zapisuje do CADNode.
     * Wywołuj po zakończeniu przeciągania gizmo (onDragEnd).
     */
    syncFromMesh(mesh: any): void {
        const node = this.meshToNode.get(mesh);
        if (!node) return;

        // Odczytujemy LOCAL transformację (w mm) z Babylona i konwertujemy do nm
        const bPos = new Vec3(mesh.position.x, mesh.position.y, mesh.position.z);
        const cadPosMm = renderToCAD(bPos);
        const cadPosNm = new Vec3(mmToNm(cadPosMm.x), mmToNm(cadPosMm.y), mmToNm(cadPosMm.z));

        // Quaternion z Babylona → konwersja przez odwrotną zmianę bazy
        const defaultBq = (typeof BABYLON !== 'undefined' && BABYLON.Quaternion) ? BABYLON.Quaternion.Identity() : { x: 0, y: 0, z: 0, w: 1 };
        const bq = mesh.rotationQuaternion || defaultBq;
        const bRotMat = this._babylonQuatToMat4(bq);
        const cadRotMat = renderMatrixToCADMatrix(bRotMat);
        const { rotation: cadRot } = cadRotMat.decompose();

        const s = mesh.scaling;
        const cadScale = new Vec3(s.x, s.y, s.z);

        node.setLocalTransform(cadPosNm, cadRot, cadScale);
    }

    /** CADNode → mesh (po klamrowaniu więzów, gdy gizmo wyprzedziło domenę). */
    syncNodeToMesh(nodeOrId: CADNode | string): void {
        const node =
            typeof nodeOrId === 'string'
                ? this.nodeBindings.get(nodeOrId)?.node ?? null
                : nodeOrId;
        if (!node) {
            return;
        }
        const binding = this.nodeBindings.get(node.id);
        if (!binding?.mesh) {
            return;
        }
        node.getWorldMatrix();
        this._syncLocalToMesh(node, binding.mesh);
    }

    // ─── Pomocnicze ──────────────────────────────────────────

    /**
     * Babylon Quaternion → Mat4 (column-major) — tylko część rotacyjna.
     */
    private _babylonQuatToMat4(bq: any): Mat4 {
        return Mat4.fromQuaternion(new Quat(bq.x, bq.y, bq.z, bq.w));
    }


}
