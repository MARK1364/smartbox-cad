import { describe, expect, it, vi } from 'vitest';
import { BlokiBayController } from '../02_bloki-bay-controller.js';
import type { DetectedBay } from '../02_bloki-bay-detector.js';

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

    it('manages panel picker mode and active handle template', () => {
        const controller = new BlokiBayController();
        const listener = vi.fn();
        controller.subscribePicker(listener);

        controller.startPicker('HANDLES');
        expect(controller.isPickerActive).toBe(true);
        expect(controller.pickerMode).toBe('panel');
        expect(controller.pendingBlokType).toBe('HANDLES');
        expect(listener).toHaveBeenCalledWith(true, 'panel');

        controller.setActiveHandleTemplate({ totalLengthMm: 160, holeDistanceMm: 128 });
        expect(controller.activeHandleTemplate).toEqual({ totalLengthMm: 160, holeDistanceMm: 128 });

        controller.setPickerMode('internal');
        expect(controller.pickerMode).toBe('internal');
        expect(listener).toHaveBeenCalledWith(true, 'internal');
    });

    it('notifies panel detected listeners and stops picker', () => {
        const controller = new BlokiBayController();
        controller.startPicker('HANDLES');
        expect(controller.isPickerActive).toBe(true);

        const listener = vi.fn();
        controller.subscribePanelDetected(listener);

        const fakeSurface = {
            panelNode: { id: 'panel_front_1' },
            panelModel: { width: 600000000, height: 720000000 },
            widthMm: 600,
            heightMm: 720,
            thicknessMm: 18,
            faceZ: -9,
            normalZ: -1,
        } as any;

        controller.notifyPanelDetected(fakeSurface);
        expect(controller.isPickerActive).toBe(false);
        expect(listener).toHaveBeenCalledWith(fakeSurface);
    });

    it('handles drop in panel mode using lastDetectedSurface', () => {
        const controller = new BlokiBayController();
        const fakeSurface = {
            panelNode: { id: 'panel_front_1' },
            widthMm: 600,
            heightMm: 720,
        } as any;

        controller.startDrag('HANDLES');
        controller.setLastDetectedSurface(fakeSurface);

        const listener = vi.fn();
        controller.subscribePanelDetected(listener);

        controller.onDropOnScene();
        expect(listener).toHaveBeenCalledWith(fakeSurface);
        expect(controller.isDragging).toBe(false);
        expect(controller.lastDetectedSurface).toBeNull();
    });
});
