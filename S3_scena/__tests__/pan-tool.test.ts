import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Viewport } from '../viewport.js';

describe('Pan tool — cursor and state management', () => {
    let originalWindow: any;

    beforeEach(() => {
        originalWindow = (globalThis as any).window;
        const listeners: Record<string, Function[]> = {};
        (globalThis as any).window = {
            addEventListener: (event: string, fn: Function) => {
                listeners[event] = listeners[event] || [];
                listeners[event].push(fn);
            },
            removeEventListener: (event: string, fn: Function) => {
                listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
            },
            dispatchEvent: (event: any) => {
                const fns = listeners[event.type] || [];
                fns.forEach((f) => f(event));
                return true;
            }
        };
        (globalThis as any).CustomEvent = class CustomEvent {
            type: string;
            detail: any;
            constructor(type: string, opts?: any) {
                this.type = type;
                this.detail = opts?.detail;
            }
        };
    });

    afterEach(() => {
        (globalThis as any).window = originalWindow;
    });

    it('sets all-scroll (róża wiatrów) cursor and emits cad-pan-tool-changed event when activated', () => {
        const dummyCanvas = { style: { cursor: 'default' } } as any;
        const dummyScene = { defaultCursor: '', hoverCursor: 'pointer' } as any;
        const vp = Object.create(Viewport.prototype);
        vp.canvas = dummyCanvas;
        vp.scene = dummyScene;
        vp.isPanToolActive = false;

        const eventSpy = vi.fn();
        window.addEventListener('cad-pan-tool-changed', eventSpy);

        vp.setPanToolActive(true);

        expect(vp.isPanToolActive).toBe(true);
        expect(dummyCanvas.style.cursor).toBe('all-scroll');
        expect(dummyScene.defaultCursor).toBe('all-scroll');
        expect(dummyScene.hoverCursor).toBe('all-scroll');
        expect(eventSpy).toHaveBeenCalledTimes(1);
        expect(eventSpy.mock.calls[0][0].detail).toEqual({ active: true });

        vp.setPanToolActive(false);

        expect(vp.isPanToolActive).toBe(false);
        expect(dummyCanvas.style.cursor).toBe('default');
        expect(dummyScene.defaultCursor).toBe('');
        expect(dummyScene.hoverCursor).toBe('pointer');
        expect(eventSpy).toHaveBeenCalledTimes(2);
        expect(eventSpy.mock.calls[1][0].detail).toEqual({ active: false });

        window.removeEventListener('cad-pan-tool-changed', eventSpy);
    });

    it('togglePanTool toggles active state and cursor', () => {
        const dummyCanvas = { style: { cursor: 'default' } } as any;
        const vp = Object.create(Viewport.prototype);
        vp.canvas = dummyCanvas;
        vp.isPanToolActive = false;

        const next1 = vp.togglePanTool();
        expect(next1).toBe(true);
        expect(vp.isPanToolActive).toBe(true);
        expect(dummyCanvas.style.cursor).toBe('all-scroll');

        const next2 = vp.togglePanTool();
        expect(next2).toBe(false);
        expect(vp.isPanToolActive).toBe(false);
        expect(dummyCanvas.style.cursor).toBe('default');
    });

    it('Escape key deactivates active pan tool', () => {
        const dummyCanvas = { style: { cursor: 'default' } } as any;
        const dummyScene = { defaultCursor: '', hoverCursor: 'pointer' } as any;
        const vp = Object.create(Viewport.prototype);
        vp.canvas = dummyCanvas;
        vp.scene = dummyScene;
        vp.isPanToolActive = true;

        const keyHandler = (e: any) => {
            if (e.key === 'Escape' && vp.isPanToolActive) {
                vp.setPanToolActive(false);
            }
        };
        window.addEventListener('keydown', keyHandler);

        window.dispatchEvent({ type: 'keydown', key: 'Escape' } as any);

        expect(vp.isPanToolActive).toBe(false);
        expect(dummyCanvas.style.cursor).toBe('default');

        window.removeEventListener('keydown', keyHandler);
    });

    it('Double-click on empty scene deactivates active pan tool', () => {
        const dummyCanvas = { style: { cursor: 'all-scroll' } } as any;
        const dummyScene = {
            defaultCursor: 'all-scroll',
            hoverCursor: 'all-scroll',
            pointerX: 100,
            pointerY: 100,
            pick: vi.fn().mockReturnValue(null) // empty scene, no hit
        } as any;
        const vp = Object.create(Viewport.prototype);
        vp.canvas = dummyCanvas;
        vp.scene = dummyScene;
        vp.isPanToolActive = true;

        // Simulate empty scene dblclick handler
        const pick = vp.scene.pick(vp.scene.pointerX, vp.scene.pointerY);
        if (!pick || !pick.hit || !pick.pickedMesh) {
            if (vp.isPanToolActive) {
                vp.setPanToolActive(false);
            }
        }

        expect(vp.isPanToolActive).toBe(false);
        expect(dummyCanvas.style.cursor).toBe('default');
    });
});
