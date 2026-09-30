/**
 * S4_sciany — SmartWallDragController.
 *
 * Przeciąganie ikon (Pokój / Ściana / Podłoga) na scenę 3D,
 * na wzór A3 SmartFrameDragController: ghost-preview na podłodze (Y=0 Babylon,
 * Z=0 CAD) + utworzenie elementu w punkcie upuszczenia przez komendę undo.
 * Podłoga ląduje w osobnym kontenerze SmartFloor pod ROOM (obok SmartWall).
 */

declare const BABYLON: any;

import { ContextManager } from '../A1_core/context-manager.js';
import { CreateSmartWallCommand, type CreateSmartWallParamsMm } from './commands/create-smartwall-command.js';
import { CreateSmartFloorCommand } from './commands/create-smartfloor-command.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import type { SmartWallDragPayload, SmartWallPreset } from './smartwall-types.js';
import type { SmartFloorDragPayload } from './smartfloor-types.js';

export type { SmartWallDragPayload };
export type { SmartFloorDragPayload };

interface GhostDims {
    width: number;
    depth: number;
    height: number;
}

function dimsForPreset(payload: SmartWallDragPayload): GhostDims {
    const h = payload.wallHeight ?? 2700;
    if (payload.preset === 'single' || payload.preset === 'uskok') {
        return { width: payload.singleLength ?? payload.roomWidth ?? 3000, depth: payload.wallThickness ?? 100, height: h };
    }
    if (payload.preset === 'empty') {
        return { width: 200, depth: 200, height: h };
    }
    if (payload.preset === 'skos') {
        const hL = payload.skosHeightLeft ?? 1800;
        const hR = payload.skosHeightRight ?? 900;
        return {
            width: payload.skosLength ?? 2000,
            depth: payload.wallThickness ?? 500,
            height: Math.max(hL, hR),
        };
    }
    return {
        width: payload.roomWidth ?? 4000,
        depth: payload.roomDepth ?? 3000,
        height: h,
    };
}

function dimsForFloor(payload: SmartFloorDragPayload): GhostDims {
    return {
        width: payload.floorWidth ?? 4000,
        depth: payload.floorDepth ?? 3000,
        height: payload.floorThickness ?? 50,
    };
}

export class SmartWallDragController {
    private _isDragging = false;
    private _payload: SmartWallDragPayload | null = null;
    private _floorPayload: SmartFloorDragPayload | null = null;
    private _ghostMesh: any = null;
    private _ghostMaterial: any = null;
    private _lastGroundPointMm: { x: number; y: number } | null = null;

    get isDragging(): boolean {
        return this._isDragging;
    }

    /** 'wall' | 'floor' | null — co aktualnie niesie kursor. */
    get draggedKind(): 'wall' | 'floor' | null {
        if (this._floorPayload) return 'floor';
        if (this._payload) return 'wall';
        return null;
    }

    get draggedPreset(): SmartWallPreset | null {
        return this._payload?.preset ?? null;
    }

    startDrag(payload: SmartWallDragPayload): void {
        this._isDragging = true;
        this._payload = {
            ...payload,
            fills: payload.fills ? payload.fills.map((f) => ({ ...f })) : undefined,
        };
        this._floorPayload = null;
        this._lastGroundPointMm = null;
    }

    startDragFloor(payload: SmartFloorDragPayload): void {
        this._isDragging = true;
        this._floorPayload = { ...payload };
        this._payload = null;
        this._lastGroundPointMm = null;
    }

    endDrag(): void {
        this._isDragging = false;
        this._payload = null;
        this._floorPayload = null;
        this._lastGroundPointMm = null;
        this._disposeGhost();
    }

    private _disposeGhost(): void {
        if (this._ghostMesh) {
            try {
                this._ghostMesh.dispose(false, true);
            } catch { /* ignoruj */ }
            this._ghostMesh = null;
        }
        if (this._ghostMaterial) {
            try {
                this._ghostMaterial.dispose();
            } catch { /* ignoruj */ }
            this._ghostMaterial = null;
        }
    }

    private _ensureGhostMesh(scene: any, dims: GhostDims): any {
        if (this._ghostMesh && !this._ghostMesh.isDisposed()) return this._ghostMesh;
        if (typeof BABYLON === 'undefined') return null;
        const ghost = BABYLON.MeshBuilder.CreateBox('smartwall_drag_ghost', {
            width: Math.max(10, dims.width),
            height: Math.max(10, dims.height),
            depth: Math.max(10, dims.depth),
            updatable: true,
        }, scene);
        ghost.isPickable = false;
        const mat = new BABYLON.StandardMaterial('smartwall_drag_ghost_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(0.55, 0.55, 0.45);
        mat.emissiveColor = new BABYLON.Color3(0.35, 0.33, 0.22);
        mat.alpha = 0.35;
        mat.backFaceCulling = false;
        ghost.material = mat;
        this._ghostMesh = ghost;
        this._ghostMaterial = mat;
        return ghost;
    }

    /**
     * Wywoływane z onDragOver na canvasie — rzut promienia na podłogę Y=0.
     */
    onPointerMoveOnScene(scene: any, pointerX: number, pointerY: number): { x: number; y: number } | null {
        if (!this._isDragging || !scene) return null;
        const camera = scene.activeCamera;
        if (!camera) return null;
        const ray = scene.createPickingRay
            ? scene.createPickingRay(
                pointerX,
                pointerY,
                typeof BABYLON !== 'undefined' && BABYLON.Matrix ? BABYLON.Matrix.Identity() : null,
                camera,
            )
            : null;
        if (!ray || !ray.origin || !ray.direction || Math.abs(ray.direction.y) < 1e-5) return null;
        const t = -ray.origin.y / ray.direction.y;
        if (t <= 0) return null;
        const hitPoint = ray.origin.add(ray.direction.scale(t));
        const floorCadX = Math.round(hitPoint.x);
        const floorCadY = Math.round(hitPoint.z);
        this._lastGroundPointMm = { x: floorCadX, y: floorCadY };

        const isFloor = !!this._floorPayload;
        const dims = isFloor
            ? dimsForFloor(this._floorPayload || {})
            : dimsForPreset(this._payload || { preset: 'rect' });
        const ghost = this._ensureGhostMesh(scene, dims);
        if (ghost) {
            // Ściany: podstawa na Z=0 → środek H/2. Podłoga: góra na Z=0 → środek -T/2.
            ghost.position.set(hitPoint.x, isFloor ? -dims.height / 2 : dims.height / 2, hitPoint.z);
            ghost.isVisible = true;
        }
        return this._lastGroundPointMm;
    }

    /**
     * Wywoływane z onDrop na canvasie — tworzy SmartWall / SmartFloor w punkcie upuszczenia.
     */
    onDropOnScene(docTarget?: any): boolean {
        if (!this._isDragging || (!this._payload && !this._floorPayload)) {
            this.endDrag();
            return false;
        }
        const doc: ProjectDocument = docTarget || ContextManager.instance.document;
        if (!doc) {
            this.endDrag();
            return false;
        }
        const pos = this._lastGroundPointMm || { x: 0, y: 0 };
        const history = ContextManager.instance.commandHistory;
        const runCmd = (cmd: { execute: (d: any) => void }) => {
            if (history && typeof history.execute === 'function') {
                history.execute(cmd as any);
            } else {
                cmd.execute(doc);
            }
        };
        if (this._floorPayload) {
            runCmd(new CreateSmartFloorCommand({
                ...this._floorPayload,
                position: { x: pos.x, y: pos.y, z: 0 },
            }));
        } else if (this._payload) {
            const params: CreateSmartWallParamsMm = {
                ...this._payload,
                fills: this._payload.fills ? this._payload.fills.map((f) => ({ ...f })) : undefined,
                position: { x: pos.x, y: pos.y, z: 0 },
            };
            runCmd(new CreateSmartWallCommand(params));
        }
        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            (window as any).__rebuildGeometry?.('Utworzono SmartWall');
        }
        this.endDrag();
        return true;
    }
}
