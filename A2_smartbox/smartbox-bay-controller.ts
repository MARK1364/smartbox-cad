/**
 * smartbox-bay-controller.ts
 *
 * Scentralizowany kontroler stanu interakcji wstawiania modułów SmartBox do wnęki.
 * Zastępuje właściwości na obiekcie globalnym window (__isSmartBoxBayPickerActive,
 * __draggedSmartBoxType, __pendingSmartBoxType).
 */

import { type DetectedBay, probeBayFromSceneRay } from './smartbox-bay-detector.js';
import { highlightBayInScene, clearBayHighlight } from './smartbox-bay-visualizer.js';
import type { ProjectDocument } from '../A1_core/project-document.js';

export type BayPickerListener = (isActive: boolean) => void;
export type BayDetectedListener = (bay: DetectedBay) => void;

export class SmartBoxBayController {
    private _isPickerActive: boolean = false;
    private _draggedSmartBoxType: string | null = null;
    private _pendingSmartBoxType: string | null = null;
    private _lastDetectedBay: DetectedBay | null = null;

    private _pickerSubscribers: Set<BayPickerListener> = new Set();
    private _bayDetectedSubscribers: Set<BayDetectedListener> = new Set();

    // ─── Stan pickera ─────────────────────────────────────────────

    get isPickerActive(): boolean {
        return this._isPickerActive;
    }

    get lastDetectedBay(): DetectedBay | null {
        return this._lastDetectedBay;
    }

    setLastDetectedBay(bay: DetectedBay | null): void {
        this._lastDetectedBay = bay;
    }

    startPicker(pendingType?: string): void {
        this._isPickerActive = true;
        if (pendingType) {
            this._pendingSmartBoxType = pendingType;
        }
        this._notifyPickerState();
    }

    stopPicker(): void {
        if (!this._isPickerActive) return;
        this._isPickerActive = false;
        clearBayHighlight();
        this._notifyPickerState();
    }

    togglePicker(pendingType?: string): void {
        if (this._isPickerActive) {
            this.stopPicker();
        } else {
            this.startPicker(pendingType);
        }
    }

    subscribePicker(callback: BayPickerListener): () => void {
        this._pickerSubscribers.add(callback);
        callback(this._isPickerActive);
        return () => this._pickerSubscribers.delete(callback);
    }

    private _notifyPickerState(): void {
        for (const sub of this._pickerSubscribers) {
            try { sub(this._isPickerActive); } catch (err) { console.error(err); }
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smartbox-bay-picker-state', { detail: this._isPickerActive }));
        }
    }

    // ─── Stan przeciągania (Drag & Drop) ──────────────────────────

    get draggedSmartBoxType(): string | null {
        return this._draggedSmartBoxType;
    }

    get pendingSmartBoxType(): string | null {
        return this._pendingSmartBoxType;
    }

    get isDragging(): boolean {
        return this.isBayDrag();
    }

    startDrag(smartBoxType: string = 'SHELVES'): void {
        this._draggedSmartBoxType = smartBoxType;
    }

    endDrag(): void {
        this._draggedSmartBoxType = null;
        clearBayHighlight();
    }

    setPendingSmartBoxType(type: string | null): void {
        this._pendingSmartBoxType = type;
    }

    isBayDrag(): boolean {
        return !!this._draggedSmartBoxType;
    }

    onPointerMoveOnScene(scene: any, pointerX: number, pointerY: number, doc: ProjectDocument): DetectedBay | null {
        if (!scene || !doc) return null;
        const pick = scene.pick(pointerX, pointerY, (m: any) =>
            m.isPickable && m.isVisible && !m.name?.includes('ground') && !m.name?.includes('grid') && !m.name?.includes('smartbox_plane') && !m.name?.includes('smartbox_bay')
        );

        if (pick && pick.hit && pick.pickedPoint) {
            const bay = probeBayFromSceneRay(scene, pick, doc);
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
        this.endDrag();
        if (bay) {
            this.notifyBayDetected(bay);
        }
        this._lastDetectedBay = null;
    }

    // ─── Wykryta wnęka ────────────────────────────────────────────

    notifyBayDetected(bay: DetectedBay): void {
        this.stopPicker();
        clearBayHighlight();
        for (const sub of this._bayDetectedSubscribers) {
            try { sub(bay); } catch (err) { console.error(err); }
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smartbox-bay-detected', { detail: bay }));
        }
    }

    subscribeBayDetected(callback: BayDetectedListener): () => void {
        this._bayDetectedSubscribers.add(callback);
        return () => this._bayDetectedSubscribers.delete(callback);
    }
}
