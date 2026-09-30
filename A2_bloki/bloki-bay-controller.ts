/**
 * bloki-bay-controller.ts
 *
 * Scentralizowany kontroler stanu interakcji wstawiania modułów Bloki do wnęki / na zewnątrz korpusu.
 * Zastępuje właściwości na obiekcie globalnym window (__isBlokiBayPickerActive,
 * __draggedBlokType, __pendingBlokType).
 */

import { type DetectedBay, probeBayFromSceneRay } from './bloki-bay-detector.js';
import { highlightBayInScene, clearBayHighlight } from './bloki-bay-visualizer.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { PerformanceConfigManager } from '../A1_core/performance-config.js';

export type BlokiPickerMode = 'internal' | 'external';
export type BayPickerListener = (isActive: boolean, mode?: BlokiPickerMode) => void;
export type BayDetectedListener = (bay: DetectedBay) => void;

export class BlokiBayController {
    private _isPickerActive: boolean = false;
    private _pickerMode: BlokiPickerMode = 'internal';
    private _draggedBlokType: string | null = null;
    private _pendingBlokType: string | null = null;
    private _lastDetectedBay: DetectedBay | null = null;

    private _pickerSubscribers: Set<BayPickerListener> = new Set();
    private _bayDetectedSubscribers: Set<BayDetectedListener> = new Set();

    // ─── Stan pickera ─────────────────────────────────────────────

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

    startPicker(pendingType?: string, mode: BlokiPickerMode = 'internal'): void {
        this._isPickerActive = true;
        this._pickerMode = mode;
        if (pendingType) {
            this._pendingBlokType = pendingType;
        } else {
            this._pendingBlokType = mode === 'external' ? 'PANELS' : 'EMPTY';
        }
        this._notifyPickerState();
    }

    stopPicker(keepHighlight: boolean = false): void {
        if (!this._isPickerActive) return;
        this._isPickerActive = false;
        if (!keepHighlight) {
            clearBayHighlight();
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
        }
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
        if (now - this._lastPointerMoveTime < throttleMs && this._lastDetectedBay) {
            return this._lastDetectedBay;
        }
        this._lastPointerMoveTime = now;

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
}

