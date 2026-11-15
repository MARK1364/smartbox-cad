import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { SmartWallDragController } from '../smartwall-drag-controller.js';

describe('S4 SmartWall drag controller', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        ['SmartWall', (controller: SmartWallDragController) => controller.startDrag({ preset: 'rect' })],
        ['SmartFloor', (controller: SmartWallDragController) => controller.startDragFloor({})],
    ])('emituje jedno zdarzenie po upuszczeniu %s', (_kind, startDrag) => {
        const dispatchEvent = vi.fn();
        const rebuildGeometry = vi.fn();
        const listeners = new Map<string, Set<(event: Event) => void>>();
        vi.stubGlobal('window', {
            document: { dispatchEvent },
            __rebuildGeometry: rebuildGeometry,
            addEventListener: (type: string, listener: (event: Event) => void) => {
                const handlers = listeners.get(type) ?? new Set();
                handlers.add(listener);
                listeners.set(type, handlers);
            },
            removeEventListener: (type: string, listener: (event: Event) => void) => {
                listeners.get(type)?.delete(listener);
            },
        });
        vi.stubGlobal('document', { activeElement: null });
        vi.stubGlobal('CustomEvent', class {
            constructor(public type: string) {}
        });

        const controller = new SmartWallDragController();
        const document = new ProjectDocument();
        startDrag(controller);

        expect(controller.onDropOnScene(document)).toBe(true);
        expect(dispatchEvent).toHaveBeenCalledTimes(1);
        expect(dispatchEvent.mock.calls[0][0]).toMatchObject({ type: 'bloki-project-changed' });
        expect(rebuildGeometry).toHaveBeenCalledTimes(1);
    });
});
