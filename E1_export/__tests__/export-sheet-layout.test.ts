import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { ExportEngine } from '../export-engine.js';

describe('ExportEngine calculateSheetLayout', () => {
    const origWindow = globalThis.window;
    const origDocument = globalThis.document;

    beforeEach(() => {
        (globalThis as any).window = {
            innerWidth: 1920,
            innerHeight: 1080,
            addEventListener: () => {},
            removeEventListener: () => {},
        };
        (globalThis as any).document = {
            getElementById: () => null,
            querySelector: () => null,
        };
    });

    afterEach(() => {
        (globalThis as any).window = origWindow;
        (globalThis as any).document = origDocument;
    });

    it('centers the sheet horizontally in the open scene between left tree and right edit panel', () => {
        const engine = new ExportEngine();
        engine.setPaperFormat('A4_LANDSCAPE');

        // Default layout when DOM elements are not found:
        // leftBoundary = 296, rightBoundary = 1920 - 362 = 1558
        // usableLeft = 296 + 24 = 320, usableRight = 1558 - 24 = 1534
        // usableWidth = 1214
        const layout = engine.calculateSheetLayout();

        expect(layout.sheetPixelW).toBeGreaterThan(0);
        expect(layout.sheetPixelH).toBeGreaterThan(0);

        // Expected center of open viewport between boundaries
        const expectedCenterSceneX = (320 + 1534) / 2; // 927
        const sheetCenterX = layout.sheetPixelX + layout.sheetPixelW / 2;

        expect(sheetCenterX).toBeCloseTo(expectedCenterSceneX, 1);
        // Previously sheetPixelX was at ~30 (behind tree panel), now shifted to the right into the open scene
        expect(layout.sheetPixelX).toBeGreaterThanOrEqual(320);

        // In portrait mode, sheetPixelW < usableWidth, so sheetPixelX is strictly centered inside usableWidth
        engine.setPaperFormat('A4_PORTRAIT');
        const portraitLayout = engine.calculateSheetLayout();
        const portraitCenterX = portraitLayout.sheetPixelX + portraitLayout.sheetPixelW / 2;
        expect(portraitCenterX).toBeCloseTo(expectedCenterSceneX, 1);
        expect(portraitLayout.sheetPixelX).toBeGreaterThan(320);
    });

    it('adapts sheet center when tree panel or edit panel is collapsed or resized', () => {
        const engine = new ExportEngine();
        engine.setPaperFormat('A4_LANDSCAPE');

        (globalThis as any).document.getElementById = (id: string) => {
            if (id === 'drzewo-obiektow') {
                return {
                    getBoundingClientRect: () => ({ width: 0, right: 0 }),
                    classList: { contains: (cls: string) => cls === 'is-collapsed' },
                };
            }
            if (id === 'panel-edycji') {
                return {
                    getBoundingClientRect: () => ({ width: 0, left: 0 }),
                    classList: { contains: (cls: string) => cls === 'is-collapsed' },
                };
            }
            return null;
        };

        const layoutCollapsed = engine.calculateSheetLayout();
        const sheetCenterX = layoutCollapsed.sheetPixelX + layoutCollapsed.sheetPixelW / 2;

        // Both collapsed (48px left, 1920 - 48 = 1872 right)
        // Center should be roughly 1920 / 2 = 960
        expect(sheetCenterX).toBeCloseTo(960, 1);
    });
});
