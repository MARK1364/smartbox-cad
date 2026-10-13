/**
 * bloki-bay-controller.ts
 *
 * Scentralizowany kontroler stanu interakcji wstawiania modułów Bloki do wnęki / na zewnątrz korpusu.
 * Zastępuje właściwości na obiekcie globalnym window (__isBlokiBayPickerActive,
 * __draggedBlokType, __pendingBlokType).
 */

import { type DetectedBay, probeBayFromSceneRay } from './bloki-bay-detector.js';
import { highlightBayInScene, clearBayHighlight } from './bloki-bay-visualizer.js';
import { probePanelSurfaceFromRay, type DetectedPanelSurface } from './handles/handle-detector.js';
import { highlightPanelSurface, clearPanelHighlight } from './handles/handle-visualizer.js';
import { ContextManager } from '../A1_core/context-manager.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { PerformanceConfigManager } from '../A1_core/performance-config.js';
import type { HandleParamsMm } from './handles/handle-types.js';

export type BlokiPickerMode = 'internal' | 'external' | 'panel';
export type BayPickerListener = (isActive: boolean, mode?: BlokiPickerMode) => void;
export type BayDetectedListener = (bay: DetectedBay) => void;
export type PanelDetectedListener = (surface: DetectedPanelSurface) => void;

export class BlokiBayController {
    private _isPickerActive: boolean = false;
    private _pickerMode: BlokiPickerMode = 'internal';
    private _draggedBlokType: string | null = null;
    private _pendingBlokType: string | null = null;
    private _lastDetectedBay: DetectedBay | null = null;
    private _lastDetectedSurface: DetectedPanelSurface | null = null;
    private _activeHandleTemplate: Partial<HandleParamsMm> | null = null;

    private _pickerSubscribers: Set<BayPickerListener> = new Set();
    private _bayDetectedSubscribers: Set<BayDetectedListener> = new Set();
    private _panelDetectedSubscribers: Set<PanelDetectedListener> = new Set();

    // ─── Stan pickera ─────────────────────────────────────────────

    get activeHandleTemplate(): Partial<HandleParamsMm> | null {
        return this._activeHandleTemplate;
    }

    setActiveHandleTemplate(tpl: Partial<HandleParamsMm> | null): void {
        this._activeHandleTemplate = tpl;
    }

    setPickerMode(mode: BlokiPickerMode): void {
        this._pickerMode = mode;
        this._notifyPickerState();
    }

    get isPickerActive(): boolean {
        return this._isPickerActive;
    }

    get pickerMode(): BlokiPickerMode {
        return this._pickerMode;
    }

    get lastDetectedBay(): DetectedBay | null {
        return this._lastDetectedBay;
    }

    setLastDetectedBay(bay: DetectedBay | null): void {
        this._lastDetectedBay = bay;
    }

    get lastDetectedSurface(): DetectedPanelSurface | null {
        return this._lastDetectedSurface;
    }

    setLastDetectedSurface(surface: DetectedPanelSurface | null): void {
        this._lastDetectedSurface = surface;
    }

    startPicker(pendingType?: string, mode?: BlokiPickerMode): void {
        this._isPickerActive = true;
        if (mode) {
            this._pickerMode = mode;
        } else if (pendingType === 'HANDLES') {
            this._pickerMode = 'panel';
        } else if (pendingType === 'PANELS') {
            this._pickerMode = 'external';
        } else {
            this._pickerMode = 'internal';
        }

        if (pendingType) {
            this._pendingBlokType = pendingType;
        } else {
            this._pendingBlokType = this._pickerMode === 'external' ? 'PANELS' : this._pickerMode === 'panel' ? 'HANDLES' : 'EMPTY';
        }
        this._notifyPickerState();
    }

    stopPicker(keepHighlight: boolean = false): void {
        if (!this._isPickerActive) return;
        this._isPickerActive = false;
        if (!keepHighlight) {
            clearBayHighlight();
            const scene = ContextManager.instance?.viewport?.scene;
            if (scene) clearPanelHighlight(scene);
        }
        this._notifyPickerState();
    }

    togglePicker(pendingType?: string, mode: BlokiPickerMode = 'internal'): void {
        if (this._isPickerActive && this._pickerMode === mode) {
            this.stopPicker();
        } else {
            this.startPicker(pendingType, mode);
        }
    }

    subscribePicker(callback: BayPickerListener): () => void {
        this._pickerSubscribers.add(callback);
        callback(this._isPickerActive, this._pickerMode);
        return () => this._pickerSubscribers.delete(callback);
    }

    private _notifyPickerState(): void {
        for (const sub of this._pickerSubscribers) {
            try { sub(this._isPickerActive, this._pickerMode); } catch (err) { console.error(err); }
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bloki-bay-picker-state', {
                detail: {
                    isActive: this._isPickerActive,
                    mode: this._pickerMode
                }
            }));
        }
    }

    // ─── Stan przeciągania (Drag & Drop) ──────────────────────────

    get draggedBlokType(): string | null {
        return this._draggedBlokType;
    }

    get pendingBlokType(): string | null {
        return this._pendingBlokType;
    }

    get isDragging(): boolean {
        return this.isBayDrag();
    }

    startDrag(blokType: string = 'EMPTY', mode?: BlokiPickerMode): void {
        this._draggedBlokType = blokType;
        if (mode) {
            this._pickerMode = mode;
        } else if (blokType === 'HANDLES') {
            this._pickerMode = 'panel';
        } else if (blokType === 'PANELS') {
            this._pickerMode = 'external';
        } else {
            this._pickerMode = 'internal';
        }
    }

    endDrag(keepHighlight: boolean = false): void {
        this._draggedBlokType = null;
        if (!keepHighlight) {
            clearBayHighlight();
            const scene = ContextManager.instance?.viewport?.scene;
            if (scene) clearPanelHighlight(scene);
        }
        this._lastDetectedSurface = null;
    }

    setPendingBlokType(type: string | null): void {
        this._pendingBlokType = type;
    }

    private _lastPointerMoveTime: number = 0;

    isBayDrag(): boolean {
        return !!this._draggedBlokType;
    }

    onPointerMoveOnScene(scene: any, pointerX: number, pointerY: number, doc: ProjectDocument): DetectedBay | null {
        if (!scene || !doc) return null;
        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const throttleMs = PerformanceConfigManager.instance.getThrottleHoverMs();
        if (now - this._lastPointerMoveTime < throttleMs && (this._lastDetectedBay || this._lastDetectedSurface)) {
            return this._lastDetectedBay;
        }
        this._lastPointerMoveTime = now;

        const isPanelMode = this._draggedBlokType === 'HANDLES' || this._pendingBlokType === 'HANDLES' || this._pickerMode === 'panel';

        if (isPanelMode) {
            const pick = scene.pick(pointerX, pointerY, (m: any) => {
                if (!m?.isPickable || !m.isVisible) return false;
                const name = String(m.name || '');
                if (name.includes('ground') || name.includes('grid') || name.includes('__handle') || name.includes('blok_bay') || name.includes('blok_plane')) return false;
                if (name.startsWith('handle_mesh_') || m.metadata?.type === 'smartpart_handle') return false;
                return true;
            });
            if (pick && pick.hit && pick.pickedMesh) {
                const surface = probePanelSurfaceFromRay(scene, pick, doc);
                if (surface) {
                    highlightPanelSurface(scene, surface, this._activeHandleTemplate || {});
                    this._lastDetectedSurface = surface;
                    return null;
                }
            }
            if (this._lastDetectedSurface) {
                clearPanelHighlight(scene);
                this._lastDetectedSurface = null;
            }
            return null;
        }

        const pick = scene.pick(pointerX, pointerY, (m: any) =>
            m.isPickable && m.isVisible && !m.name?.includes('ground') && !m.name?.includes('grid') && !m.name?.includes('blok_plane') && !m.name?.includes('blok_bay')
        );

        if (pick && pick.hit && pick.pickedPoint) {
            const mode = (this._draggedBlokType === 'PANELS' || this._draggedBlokType === 'LED_EXTERNAL' || this._pickerMode === 'external') ? 'external' : 'internal';
            const bay = probeBayFromSceneRay(scene, pick, doc, mode);
            if (bay) {
                highlightBayInScene(scene, bay);
                this._lastDetectedBay = bay;
                return bay;
            }
        }
        return null;
    }

    onDropOnScene(): void {
        const isPanelMode = this._draggedBlokType === 'HANDLES' || this._pendingBlokType === 'HANDLES' || this._pickerMode === 'panel';
        if (isPanelMode && this._lastDetectedSurface) {
            this.notifyPanelDetected(this._lastDetectedSurface);
            this.endDrag();
            this._lastDetectedSurface = null;
            return;
        }

        const bay = this._lastDetectedBay;
        const optType = this._pendingBlokType || this._draggedBlokType || 'EMPTY';
        const keepHighlight = optType === 'EMPTY';
        if (bay) {
            this.notifyBayDetected(bay, keepHighlight);
        }
        this.endDrag(keepHighlight);
        this._lastDetectedBay = null;
    }

    // ─── Wykryta wnęka ────────────────────────────────────────────

    notifyBayDetected(bay: DetectedBay, keepHighlight: boolean = false): void {
        this.stopPicker(keepHighlight);
        if (!keepHighlight) {
            clearBayHighlight();
        }
        for (const sub of this._bayDetectedSubscribers) {
            try { sub(bay); } catch (err) { console.error(err); }
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bloki-bay-detected', { detail: bay }));
        }
    }

    subscribeBayDetected(callback: BayDetectedListener): () => void {
        this._bayDetectedSubscribers.add(callback);
        return () => this._bayDetectedSubscribers.delete(callback);
    }

    // ─── Wykryty panel / formatka ─────────────────────────────────

    notifyPanelDetected(surface: DetectedPanelSurface): void {
        this.stopPicker(false);
        const scene = ContextManager.instance?.viewport?.scene;
        if (scene) clearPanelHighlight(scene);

        for (const sub of this._panelDetectedSubscribers) {
            try { sub(surface); } catch (err) { console.error(err); }
        }
        if (typeof window !== 'undefined') {
            const detail = Object.assign(surface, { surface, handleParams: this._activeHandleTemplate });
            window.dispatchEvent(new CustomEvent('bloki-panel-detected', { detail }));
        }
    }

    subscribePanelDetected(callback: PanelDetectedListener): () => void {
        this._panelDetectedSubscribers.add(callback);
        return () => this._panelDetectedSubscribers.delete(callback);
    }
}

