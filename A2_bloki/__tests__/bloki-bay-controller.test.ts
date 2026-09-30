import { describe, expect, it, vi } from 'vitest';
import { BlokiBayController } from '../bloki-bay-controller.js';
import type { DetectedBay } from '../bloki-bay-detector.js';

describe('BlokiBayController', () => {
    it('manages picker state and notifies subscribers', () => {
        const controller = new BlokiBayController();
        const listener = vi.fn();

        const unsubscribe = controller.subscribePicker(listener);
        // Pierwsze wywołanie natychmiast przy subskrypcji
        expect(listener).toHaveBeenCalledWith(false, 'internal');

        controller.startPicker('DRAWERS');
        expect(controller.isPickerActive).toBe(true);
        expect(controller.pendingBlokType).toBe('DRAWERS');
        expect(listener).toHaveBeenCalledWith(true, 'internal');

        controller.stopPicker();
        expect(controller.isPickerActive).toBe(false);
        expect(listener).toHaveBeenCalledWith(false, 'internal');

        controller.togglePicker();
        expect(controller.isPickerActive).toBe(true);

        controller.togglePicker();
        expect(controller.isPickerActive).toBe(false);

        unsubscribe();
        controller.startPicker();
        expect(listener).toHaveBeenCalledTimes(5);
    });

    it('manages drag and drop state for bloki templates', () => {
        const controller = new BlokiBayController();

        expect(controller.isBayDrag()).toBe(false);
        expect(controller.draggedBlokType).toBeNull();

        controller.startDrag('SHELVES');
        expect(controller.isBayDrag()).toBe(true);
        expect(controller.draggedBlokType).toBe('SHELVES');

        controller.setPendingBlokType('DOORS');
        expect(controller.pendingBlokType).toBe('DOORS');

        controller.endDrag();
        expect(controller.isBayDrag()).toBe(false);
        expect(controller.draggedBlokType).toBeNull();
    });

    it('notifies bay detected listeners and stops picker', () => {
        const controller = new BlokiBayController();
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

    it('preserves highlight when dropping EMPTY bloki', () => {
        const controller = new BlokiBayController();
        const fakeBay: DetectedBay = {
            boundsMm: { width: 764, height: 1964, depth: 600 },
            boundsNm: { width: 764000000, height: 1964000000, depth: 600000000 },
            centerWorldMm: { x: 0, y: 0, z: 1000 },
            boundary: {} as any
        };
        controller.startDrag('EMPTY');
        controller.setLastDetectedBay(fakeBay);

        const listener = vi.fn();
        controller.subscribeBayDetected(listener);

        controller.onDropOnScene();
        expect(listener).toHaveBeenCalledWith(fakeBay);
        expect(controller.isDragging).toBe(false);
    });
});
