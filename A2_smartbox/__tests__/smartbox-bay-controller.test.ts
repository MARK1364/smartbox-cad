import { describe, expect, it, vi } from 'vitest';
import { SmartBoxBayController } from '../smartbox-bay-controller.js';
import type { DetectedBay } from '../smartbox-bay-detector.js';

describe('SmartBoxBayController', () => {
    it('manages picker state and notifies subscribers', () => {
        const controller = new SmartBoxBayController();
        const listener = vi.fn();

        const unsubscribe = controller.subscribePicker(listener);
        // Pierwsze wywołanie natychmiast przy subskrypcji
        expect(listener).toHaveBeenCalledWith(false);

        controller.startPicker('DRAWERS');
        expect(controller.isPickerActive).toBe(true);
        expect(controller.pendingSmartBoxType).toBe('DRAWERS');
        expect(listener).toHaveBeenCalledWith(true);

        controller.stopPicker();
        expect(controller.isPickerActive).toBe(false);
        expect(listener).toHaveBeenCalledWith(false);

        controller.togglePicker();
        expect(controller.isPickerActive).toBe(true);

        controller.togglePicker();
        expect(controller.isPickerActive).toBe(false);

        unsubscribe();
        controller.startPicker();
        expect(listener).toHaveBeenCalledTimes(5);
    });

    it('manages drag and drop state for smartbox templates', () => {
        const controller = new SmartBoxBayController();

        expect(controller.isBayDrag()).toBe(false);
        expect(controller.draggedSmartBoxType).toBeNull();

        controller.startDrag('SHELVES');
        expect(controller.isBayDrag()).toBe(true);
        expect(controller.draggedSmartBoxType).toBe('SHELVES');

        controller.setPendingSmartBoxType('DOORS');
        expect(controller.pendingSmartBoxType).toBe('DOORS');

        controller.endDrag();
        expect(controller.isBayDrag()).toBe(false);
        expect(controller.draggedSmartBoxType).toBeNull();
    });

    it('notifies bay detected listeners and stops picker', () => {
        const controller = new SmartBoxBayController();
        controller.startPicker();
        expect(controller.isPickerActive).toBe(true);

        const listener = vi.fn();
        controller.subscribeBayDetected(listener);

        const fakeBay: DetectedBay = {
            boundsMm: { width: 764, height: 1964, depth: 600 },
            boundsNm: { width: 764000000, height: 1964000000, depth: 600000000 },
            centerWorldMm: { x: 0, y: 0, z: 1000 },
            boundary: {} as any
        };

        controller.notifyBayDetected(fakeBay);
        expect(controller.isPickerActive).toBe(false);
        expect(listener).toHaveBeenCalledWith(fakeBay);
    });
});
