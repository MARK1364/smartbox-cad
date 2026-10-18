import { describe, it, expect } from 'vitest';
import { planCabinet } from '../smartframe-engine.js';
import { korpusDefaultsForTypeMm } from '../korpus-defaults';
import { resolveCabinetType } from '../smartframe-adapter';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';

/**
 * Prototyp korpus_skosny: skos w głąb (przód wysoki / tył niski pod połać dachu).
 * Boki-trapezoidy przez outline2d (osobne obrysy L/P), wieniec górny pochylony,
 * plecy pełne pod wymiar tylnej krawędzi.
 */
function planSkosny() {
    return planCabinet({
        szerokosc_mm: 1200,
        wysokosc_mm: 2200,
        glebokosc_mm: 700,
        liczba_stref: 1,
        typ_korpusu: 'korpus_skosny',
        wysokosc_przod_mm: 2200,
        wysokosc_tyl_mm: 1000,
        cofniecie_plecow_mm: 3
    });
}

/**
 * Róg obrysu (u, v w mm, ramka bbox) → świat CAD.
 * Panel-local (Y-up) → CAD (Z-up) to swap Y↔Z, potem rotacja noda z lcs.
 */
function worldCorner(part: any, u: number, v: number): Vec3 {
    const plateW = part.dim.y; // mapping X:'y' → szerokość = dim.y = D
    const plateH = part.dim.x; // mapping Y:'x' → wysokość = dim.x = maxH
    const local = new Vec3(u - plateW / 2, v - plateH / 2, 0);
    const inCad = new Vec3(local.x, local.z, local.y);
    const [rx, ry, rz] = part.lcs.rotation;
    const q = Quat.fromEulerXYZ((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180);
    const world = Mat4.fromQuaternion(q).transformPoint(inCad);
    return new Vec3(world.x + part.loc.x, world.y + part.loc.y, world.z + part.loc.z);
}

describe('KORPUS_SKOSNY prototyp', () => {
    it('1 strefa, 5 części: 2 boki + dół + góra + plecy', () => {
        const plan = planSkosny();
        expect(plan.zones).toHaveLength(1);
        expect(plan.zones[0].zoneKey).toBe('SEKCJA_B');

        const roles = plan.parts.map((p) => p.role);
        expect(roles).toContain('LEFT_SIDE_PANEL');
        expect(roles).toContain('RIGHT_SIDE_PANEL');
        expect(roles).toContain('BOTTOM_PANEL');
        expect(roles).toContain('TOP_PANEL');
        expect(roles).toContain('BACK_PANEL');
        expect(plan.parts).toHaveLength(5);
    });

    it('boki to trapezoidy w outline2d (profil D × maxH, lustro L/P)', () => {
        const plan = planSkosny();
        const left = plan.parts.find((p) => p.role === 'LEFT_SIDE_PANEL')!;
        const right = plan.parts.find((p) => p.role === 'RIGHT_SIDE_PANEL')!;
        // Prawy: u=0 na froncie (wysoki); lewy: u=0 na tyle (niski) — lustro osi u.
        expect((right.customProperties as any)?.outline2d).toEqual([[0, 0], [700, 0], [700, 1000], [0, 2200]]);
        expect((left.customProperties as any)?.outline2d).toEqual([[0, 0], [700, 0], [700, 2200], [0, 1000]]);
        // bbox: szerokość = głębokość, wysokość = max(przód, tył)
        expect(left.dim.y).toBeCloseTo(700, 0);
        expect(left.dim.x).toBeCloseTo(2200, 0);
        expect(left.loc.x).toBeCloseTo(-600 + 9, 0);
        expect(right.loc.x).toBeCloseTo(600 - 9, 0);
        expect(left.loc.z).toBeCloseTo(1100, 0);
    });

    it('stok obu boków opada do tyłu (wysoki z przodu, niski z tyłu)', () => {
        const plan = planSkosny();
        for (const role of ['LEFT_SIDE_PANEL', 'RIGHT_SIDE_PANEL']) {
            const side = plan.parts.find((p) => p.role === role)!;
            const outline = (side.customProperties as any).outline2d as number[][];
            const byV = [...outline].sort((a, b) => b[1] - a[1]);
            const tall = byV[0];
            const lowTop = byV[1];
            expect(tall[1]).toBe(2200);
            expect(lowTop[1]).toBe(1000);
            const tallW = worldCorner(side, tall[0], tall[1]);
            const lowW = worldCorner(side, lowTop[0], lowTop[1]);
            expect(tallW.y).toBeLessThan(0); // przód: -Y
            expect(lowW.y).toBeGreaterThan(0); // tył: +Y
            expect(tallW.z).toBeCloseTo(2200, 0);
            expect(lowW.z).toBeCloseTo(1000, 0);
        }
    });

    it('wieniec górny pochylony w głąb o β−90° (przód wyżej)', () => {
        const plan = planSkosny();
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;
        const betaRad = Math.atan2(1000 - 2200, 700);
        const betaDeg = (betaRad * 180) / Math.PI;
        expect(top.lcs?.rotation?.[0]).toBeCloseTo(betaDeg - 90, 0);
        expect(top.dim.y).toBeCloseTo(Math.hypot(700, 1200), 0);
        expect(top.dim.x).toBeCloseTo(1200 - 18 - 18, 0);
        expect(top.loc.z).toBeCloseTo(1600 - Math.cos(betaRad) * 9, 1);
        expect(top.loc.y).toBeCloseTo(Math.sin(betaRad) * 9, 1);
    });

    it('plecy HDF mają 3 mm i zakładkę przy dolnym oraz górnym wieńcu', () => {
        const plan = planSkosny();
        const back = plan.parts.find((p) => p.role === 'BACK_PANEL')!;
        const roofAngle = Math.atan2(1000 - 2200, 700);
        const bottomEdge = back.loc.z - back.dim.z / 2;
        const top = back.loc.z + back.dim.z / 2;
        expect(back.thickness).toBeCloseTo(3, 0);
        expect(back.material).toBe('HDF_BIALY_3');
        expect(bottomEdge).toBeCloseTo(18 - 11, 0);
        expect(top).toBeCloseTo(1000 - 18 * Math.cos(roofAngle) + 11, 0);
        expect((back.customProperties as any)?.outline2d).toBeUndefined();
        const bottom = plan.parts.find((p) => p.role === 'BOTTOM_PANEL')!;
        expect(bottom.loc.z).toBeCloseTo(9, 0);
    });

    it('defaults z JSON + resolveCabinetType', () => {
        const defs = korpusDefaultsForTypeMm('korpus_skosny');
        expect(defs.liczba_stref).toBe(1);
        expect(defs.wysokosc_przod_mm).toBe(2200);
        expect(defs.wysokosc_tyl_mm).toBe(1000);
        expect(defs.wysokosc_mm).toBe(2200);
        expect(resolveCabinetType('korpus_skosny')).toBe('korpus_skosny');
        expect(resolveCabinetType('korpus3_2')).toBe('korpus3');
    });
});
