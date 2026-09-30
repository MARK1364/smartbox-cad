import { describe, it, expect } from 'vitest';
import { bevelInsetMm, buildBeveledBox } from '../native_core/edge-bevel.js';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('pochylenie krawędzi formatki', () => {
    it('45° na +X cofa spód o grubość, lico Z+ zostaje', () => {
        expect(bevelInsetMm(18, 45)).toBeCloseTo(18, 6);
        const box = buildBeveledBox(200, 80, 18, { '+X': 45, '-X': 0, '+Y': 0, '-Y': 0 });
        expect(box.top[1][0]).toBeCloseTo(100, 6);
        expect(box.bottom[1][0]).toBeCloseTo(100 - 18, 6);
        expect(box.bottom[0][0]).toBeCloseTo(-100, 6);
        const dx = box.top[1][0] - box.bottom[1][0];
        const dz = box.top[1][2] - box.bottom[1][2];
        expect(dx).toBeCloseTo(18, 6);
        expect(dz).toBeCloseTo(18, 6);
    });

    it('cztery krawędzie 45° — spód mniejszy o grubość z każdej strony (ucios ramki)', () => {
        const box = buildBeveledBox(200, 80, 18, { '+X': 45, '-X': 45, '+Y': 45, '-Y': 45 });
        expect(box.bottom[0][0]).toBeCloseTo(-100 + 18, 6);
        expect(box.bottom[1][0]).toBeCloseTo(100 - 18, 6);
        expect(box.bottom[0][1]).toBeCloseTo(-40 + 18, 6);
        expect(box.bottom[2][1]).toBeCloseTo(40 - 18, 6);
        expect(box.top[2][0]).toBeCloseTo(100, 6);
    });

    it('cutAnchor Z− na +Y: zewnętrzne lico (+Y) zostaje, wewnętrzne skrócone', () => {
        const hy = 40;
        const iy = 18;
        const box = buildBeveledBox(200, 80, 18, {
            '+X': { angle: 0, anchor: 'Z_PLUS' },
            '-X': { angle: 0, anchor: 'Z_PLUS' },
            '+Y': { angle: 45, anchor: 'Z_MINUS' },
            '-Y': { angle: 0, anchor: 'Z_PLUS' },
        });
        expect(box.bottom[2][1]).toBeCloseTo(hy, 6);
        expect(box.top[2][1]).toBeCloseTo(hy - iy, 6);
        expect(box.top[2][1]).toBeLessThan(hy);
    });

    it('mesh formatki czyta cutAngle z obrzeża', () => {
        const mesh = buildMeshFromPanel({
            width: mmToNm(200),
            height: mmToNm(80),
            thickness: mmToNm(18),
            role: 'PANEL',
            edgeBanding: {
                '+X': { active: true, cutAngle: 45 },
                '-X': { active: false, cutAngle: 0 },
                '+Y': { active: false },
                '-Y': { active: false },
            },
        });
        const side = mesh.FACE_X_PLUS.positions as number[];
        const topX = side[0];
        const botX = side[9];
        expect(Math.abs(topX - botX)).toBeCloseTo(18, 4);
    });
});
