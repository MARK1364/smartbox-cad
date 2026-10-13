/**
 * Drag & drop zawieszek: detekcja wnęki (jak Bloki) → para L/R w górnych rogach.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import type { ProjectDocument } from '../../A1_core/project-document.js';
import type { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { probeBayFromSceneRay, type DetectedBay } from '../../A2_bloki/bloki-bay-detector.js';
import { highlightBayInScene, clearBayHighlight } from '../../A2_bloki/bloki-bay-visualizer.js';
import type { HangerTemplateItem } from './hanger-types.js';
import { createSmartPartHangersInBay } from './hanger-apply.js';

export class HangerDragController {
    private static _instance: HangerDragController | null = null;

    private _isDragging = false;
    private _activeTemplate: HangerTemplateItem | null = null;
    private _lastBay: DetectedBay | null = null;
    private _lastProbeTime = 0;

    public static get instance(): HangerDragController {
        if (!this._instance) this._instance = new HangerDragController();
        return this._instance;
    }

    get isDragging(): boolean {
        return this._isDragging;
    }

    get lastDetectedBay(): DetectedBay | null {
        return this._lastBay;
    }

    startDrag(template: HangerTemplateItem): void {
        this._isDragging = true;
        this._activeTemplate = template;
        this._lastBay = null;
    }

    endDrag(): void {
        this._isDragging = false;
        this._activeTemplate = null;
        this._lastBay = null;
        clearBayHighlight();
    }

    onPointerMoveOnScene(scene: any, x: number, y: number, doc: ProjectDocument): DetectedBay | null {
        if (!this._isDragging || !scene || !doc) return null;

        const now = performance.now();
        if (now - this._lastProbeTime < 40) return this._lastBay;
        this._lastProbeTime = now;

        const pick = scene.pick(x, y, (m: any) =>
            m.isPickable && m.isVisible
            && !m.name?.includes('ground')
            && !m.name?.includes('grid')
            && !m.name?.includes('blok_bay')
            && !m.name?.includes('blok_plane'),
        );

        if (!pick?.hit) {
            if (this._lastBay) {
                clearBayHighlight();
                this._lastBay = null;
            }
            return null;
        }

        const bay = probeBayFromSceneRay(scene, pick, doc);
        if (bay) {
            this._lastBay = bay;
            highlightBayInScene(scene, bay);
            return bay;
        }

        if (this._lastBay) {
            clearBayHighlight();
            this._lastBay = null;
        }
        return null;
    }

    onDropOnScene(doc: ProjectDocument): CADNode | null {
        if (!this._isDragging || !this._activeTemplate || !this._lastBay || !doc) {
            this.endDrag();
            return null;
        }

        const group = createSmartPartHangersInBay(doc, this._lastBay, this._activeTemplate);
        this.endDrag();
        ContextManager.instance?.viewport?.requestRender?.(8);
        return group;
    }
}
