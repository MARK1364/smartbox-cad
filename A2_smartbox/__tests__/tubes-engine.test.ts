import { describe, it, expect } from 'vitest';
import { TubesEngine } from '../tubes-engine.js';
import { buildTubesPlan } from '../tubes-adapter.js';

describe('TubesEngine (SmartBox Drążek V1)', () => {
    it('generates tube rod and holders with default parameters', () => {
        const engine = new TubesEngine();
        const plan = engine.plan({
            width: 600,
            depth: 500,
            height: 720
        });

        expect(plan.parts).toHaveLength(3); // ROD, HOLDER_LEFT, HOLDER_RIGHT

        const rod = plan.parts.find((p: any) => p.role === 'TUBE_ROD');
        expect(rod).toBeDefined();
        expect(rod.name).toBe('Drazek_fi25');
        expect(rod.dim.x).toBe(600 - 2); // 598
        expect(rod.dim.y).toBe(25); // fi25
        expect(rod.dim.z).toBe(25);
        expect(rod.loc.z).toBe(720 - 70); // height - offsetTop(70) = 650

        const holderL = plan.parts.find((p: any) => p.name === 'Uchwyt_Lewy');
        expect(holderL).toBeDefined();
        expect(holderL.dim.x).toBe(5); // thickness 5mm
        expect(holderL.dim.y).toBe(45); // diameter 45mm
        expect(holderL.loc.x).toBe(-600 / 2 + 5 / 2); // -297.5
    });

    it('generates top shelf when showShelf is true', () => {
        const plan = buildTubesPlan(
            { show_shelf: true, space_above_shelf: 80, offset_top: 60 },
            { width: 800, depth: 500, height: 1000 }
        );

        expect(plan.parts).toHaveLength(4); // SHELF, ROD, HOLDER_L, HOLDER_R

        const shelf = plan.parts.find((p: any) => p.role === 'SHELF_PANEL');
        expect(shelf).toBeDefined();
        expect(shelf.name).toBe('Polka_Nad_Drazkiem');
        expect(shelf.dim.x).toBe(800 - 4); // 796
        expect(shelf.dim.y).toBe(500 - 10); // 490
        expect(shelf.dim.z).toBe(18); // 18mm
        expect(shelf.loc.z).toBe(1000 - 80 - 18 / 2); // 911
    });
});
