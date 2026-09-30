import { describe, it, expect } from 'vitest';
import { normalizePanelsParams, calculatePanelsPlan, assertCanonicalPanelsParams } from '../panels-engine.js';

describe('panels-engine (Functional Core)', () => {
    it('normalizes canonical parameters', () => {
        const norm = normalizePanelsParams({
            grubosc_blendy_mm: 19,
            tryb_paneli_bocznych: 'KORPUS',
            wlacz_lewy: true,
            wlacz_prawy: false,
            wysokosc_cokolu_mm: 100,
            cofniecie_cokolu_mm: 25
        });

        expect(norm.grubosc_blendy_mm).toBe(19);
        expect(norm.tryb_paneli_bocznych).toBe('KORPUS');
        expect(norm.wlacz_lewy).toBe(true);
        expect(norm.wlacz_prawy).toBe(false);
        expect(norm.wysokosc_cokolu_mm).toBe(100);
        expect(norm.cofniecie_cokolu_mm).toBe(25);
    });

    it('odrzuca wycofane aliasy (fail-fast)', () => {
        expect(() => assertCanonicalPanelsParams({ thickness: 18 })).toThrow(/thickness → grubosc_blendy_mm/);
        expect(() => assertCanonicalPanelsParams({ enableLeft: true })).toThrow(/enableLeft → wlacz_lewy/);
        expect(() => assertCanonicalPanelsParams({ sidePanelMode: 'FULL' })).toThrow(/sidePanelMode → tryb_paneli_bocznych/);
        expect(() => assertCanonicalPanelsParams({ wlacz_lewy: true })).not.toThrow();
    });

    it('generates outer side panels, top panel and plinth correctly', () => {
        const dims = { width_mm: 600, height_mm: 720, depth_mm: 500 };
        const params = normalizePanelsParams({
            tryb_paneli_bocznych: 'FULL',
            grubosc_blendy_mm: 18,
            wysokosc_cokolu_mm: 100,
            szczelina_cokolu_mm: 0,
            wlacz_lewy: true,
            wlacz_prawy: true,
            wlacz_gorny: true,
            wlacz_dolny: true,
            auto_glebokosc_lewy: true,
            auto_glebokosc_prawy: true,
            auto_glebokosc_gorny: true
        });

        const plan = calculatePanelsPlan(dims, params);
        expect(plan.parts).toHaveLength(4);

        const left = plan.parts.find(p => p.role === 'LEFT_SIDE_PANEL');
        const right = plan.parts.find(p => p.role === 'RIGHT_SIDE_PANEL');
        const top = plan.parts.find(p => p.role === 'TOP_PANEL');
        const plinth = plan.parts.find(p => p.role === 'BOTTOM_PANEL');

        expect(left).toBeDefined();
        expect(right).toBeDefined();
        expect(top).toBeDefined();
        expect(plinth).toBeDefined();

        // In FULL mode, side panel spans from bottom of plinth (-100) to top of top panel (720 + 18) = 838
        expect(left!.dim.x).toBe(838);
        expect(left!.dim.y).toBe(500); // auto depth = cabinet depth
        expect(left!.dim.z).toBe(18);  // thickness

        // Plinth height
        expect(plinth!.dim.z).toBe(100);
    });
});
