/**
 * smartframe-drag-controller.ts
 * Kontroler przeciągania i upuszczania korpusów SmartFrame na podłogę sceny 3D.
 * Obsługuje 1, 2 oraz 3 strefy, rzutowanie na płaszczyznę ziemi (Y=0 w Babylon, Z=0 w CAD)
 * oraz podgląd bryły (ghost) w czasie rzeczywistym.
 */

declare const BABYLON: any;
import { ContextManager } from '../A1_core/context-manager.js';
import { CreateKorpusCommand } from './commands/create-korpus-command.js';
import type { ProjectDocument } from '../A1_core/project-document.js';

export interface DraggedKorpusParams {
    width: number;
    height: number;
    depth: number;
    bottomHeight?: number;
    middleHeight?: number;
    backOffset?: number;
}

export class SmartFrameDragController {
    private _isDragging: boolean = false;
    private _draggedZoneCount: 1 | 2 | 3 | null = null;
    private _draggedParams: DraggedKorpusParams | null = null;
    private _ghostMesh: any = null;
    private _ghostMaterial: any = null;
    private _lastGroundPointMm: { x: number; y: number } | null = null;

    get isDragging(): boolean {
        return this._isDragging;
    }

    get draggedZoneCount(): 1 | 2 | 3 | null {
        return this._draggedZoneCount;
    }

    startDrag(zoneCount: 1 | 2 | 3, params: DraggedKorpusParams): void {
        this._isDragging = true;
        this._draggedZoneCount = zoneCount;
        this._draggedParams = { ...params };
        this._lastGroundPointMm = null;
    }

    endDrag(): void {
        this._isDragging = false;
        this._draggedZoneCount = null;
        this._draggedParams = null;
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

    private _ensureGhostMesh(scene: any, width: number, height: number, depth: number): any {
        if (this._ghostMesh && !this._ghostMesh.isDisposed()) {
            return this._ghostMesh;
        }
        if (typeof BABYLON === 'undefined') return null;

        // Tworzymy przezroczysty sześcian podglądu korpusu
        const ghost = BABYLON.MeshBuilder.CreateBox('smartframe_drag_ghost', {
            width,
            height,
            depth,
            updatable: true
        }, scene);
        ghost.isPickable = false;

        const mat = new BABYLON.StandardMaterial('smartframe_drag_ghost_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(0.18, 0.55, 0.94);
        mat.emissiveColor = new BABYLON.Color3(0.1, 0.35, 0.8);
        mat.alpha = 0.35;
        mat.wireframe = false;
        mat.backFaceCulling = false;

        ghost.material = mat;
        this._ghostMesh = ghost;
        this._ghostMaterial = mat;
        return ghost;
    }

    /**
     * Wywoływane z onDragOver na canvasie — rzuca promień na podłogę Y=0.
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
                camera
            )
            : null;
        if (!ray || !ray.origin || !ray.direction || Math.abs(ray.direction.y) < 1e-5) return null;

        // Przecięcie z płaszczyzną podłogi Y = 0 w Babylonie:
        // ray.origin.y + t * ray.direction.y = 0 => t = -ray.origin.y / ray.direction.y
        const t = -ray.origin.y / ray.direction.y;
        if (t <= 0) return null;

        const hitPoint = ray.origin.add(ray.direction.scale(t));

        // W Babylonie: X = CAD X, Z = CAD Y (głębokość), Y = wysokość (CAD Z).
        const floorCadX = Math.round(hitPoint.x);
        const floorCadY = Math.round(hitPoint.z);

        this._lastGroundPointMm = { x: floorCadX, y: floorCadY };

        // Aktualizacja pozycji podglądu ghosta
        const params = this._draggedParams || { width: 1000, height: 2200, depth: 600 };
        const ghost = this._ensureGhostMesh(scene, params.width, params.height, params.depth);
        if (ghost) {
            // Podstawa szafki opiera się na podłodze (Y = 0), więc środek bryły leży na Y = height / 2
            ghost.position.set(hitPoint.x, params.height / 2, hitPoint.z);
            ghost.isVisible = true;
        }

        return this._lastGroundPointMm;
    }

    /**
     * Wywoływane z onDrop na canvasie — tworzy korpus w docelowym punkcie na ziemi.
     */
    onDropOnScene(docTarget?: any): boolean {
        if (!this._isDragging || !this._draggedZoneCount) {
            this.endDrag();
            return false;
        }

        const doc: ProjectDocument = docTarget || ContextManager.instance.document;
        if (!doc) {
            this.endDrag();
            return false;
        }

        const params = this._draggedParams || { width: 1000, height: 2200, depth: 600 };
        const zoneCount = this._draggedZoneCount;
        const pos = this._lastGroundPointMm || { x: 0, y: 0 };

        let bottomHeight = params.bottomHeight ?? 500;
        let middleHeight = params.middleHeight ?? 1200;

        if (zoneCount === 1) {
            bottomHeight = params.height;
            middleHeight = 0;
        } else if (zoneCount === 2) {
            if (bottomHeight >= params.height || bottomHeight <= 0) {
                bottomHeight = Math.round(params.height / 2);
            }
            middleHeight = 0;
        } else if (zoneCount === 3) {
            if (bottomHeight + middleHeight >= params.height || bottomHeight <= 0 || middleHeight <= 0 || bottomHeight >= params.height) {
                bottomHeight = 500;
                middleHeight = 1200;
                if (bottomHeight + middleHeight >= params.height) {
                    bottomHeight = Math.round(params.height * 0.25);
                    middleHeight = Math.round(params.height * 0.55);
                }
            }
        }

        const cmd = new CreateKorpusCommand({
            width: params.width,
            height: params.height,
            depth: params.depth,
            zoneCount,
            bottomHeight,
            middleHeight,
            backOffset: params.backOffset ?? 3,
            position: { x: pos.x, y: pos.y, z: 0 }
        });

        const history = ContextManager.instance.commandHistory;
        if (history && typeof history.execute === 'function') {
            history.execute(cmd);
        } else {
            cmd.execute(doc);
        }

        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
            (window as any).__rebuildGeometry?.('Utworzono nowy korpus');
        }

        this.endDrag();
        return true;
    }
}
