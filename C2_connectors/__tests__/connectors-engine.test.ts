/**
 * Testy silnika rozmieszczenia złączy — port connectors_2_engine.py.
 *
 * Uruchom: npx vitest run C2_connectors  (z katalogu web/)
 */

import { describe, it, expect } from 'vitest';
import { ConnectorsEngine } from '../connectors-engine.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';

const engine = new ConnectorsEngine();

describe('ConnectorsEngine — reguły JSON', () => {
    it('ładuje typy i reguły z connectors_3_rules.json', () => {
        expect(engine.getConnectorDefinition('kolki_d8x35')?.name).toMatch(/Kołek/);
        expect(engine.getPlacementRuleDefinition('standard_od_lewej')?.sides.length).toBe(1);
        expect(engine.getDefaultPlacementRule()).toBe('standard_od_lewej');
        expect(engine.getPlacementRuleKeys()).not.toContain('symetrycznie2');
        expect(engine.getPlacementRuleDefinition('symetrycznie2')?.name).toMatch(/Symetrycznie/);
        const front = engine.getPlacementRuleDefinition('standard_od_lewej')?.sides[0].positions ?? [];
        expect(front).toHaveLength(19);
        expect(front[front.length - 1]?.offset_mm).toBe(608);
    });
});

describe('ConnectorsEngine — pozycje na płaszczyźnie styku', () => {
    const verts = [
        new Vec3(0, 0, 0),
        new Vec3(400, 0, 0),
        new Vec3(400, 18, 0),
        new Vec3(0, 18, 0),
    ];
    const normal = new Vec3(0, 0, 1);

    it('od przodu: pierwszy kołek 32 mm od min. osi (dominująca +X w tym teście)', () => {
        const dtos = engine.generateConnectors(verts, normal, 'standard_od_lewej');
        expect(dtos.length).toBe(12);
        expect(dtos[0].type).toBe('kolki_d8x35');
        expect(dtos[0].offsetMm).toBe(32);
        expect(dtos[0].side).toBe('front');
        expect(dtos[1].type).toBe('konfirmat_5x50');
        expect(dtos[0].positionMm[0]).toBeCloseTo(32, 5);
        expect(dtos[1].positionMm[0]).toBeCloseTo(64, 5);
    });

    it('odwrotne uzwojenie styku daje ten sam start od −Y formatki', () => {
        const alongY = [
            new Vec3(0, 0, 0),
            new Vec3(0, 400, 0),
            new Vec3(18, 400, 0),
            new Vec3(18, 0, 0),
        ];
        const flipped = [
            new Vec3(0, 400, 0),
            new Vec3(0, 0, 0),
            new Vec3(18, 0, 0),
            new Vec3(18, 400, 0),
        ];
        const a = engine.generateConnectors(alongY, new Vec3(1, 0, 0), 'standard_od_lewej', null, new Vec3(0, 1, 0));
        const b = engine.generateConnectors(flipped, new Vec3(1, 0, 0), 'standard_od_lewej', null, new Vec3(0, 1, 0));
        expect(a[0].positionMm[1]).toBeCloseTo(32, 5);
        expect(b[0].positionMm[1]).toBeCloseTo(32, 5);
        expect(a[0].positionMm[1]).toBeCloseTo(b[0].positionMm[1], 5);
    });

    it('odsunięcie pierwszego otworu przesuwa całą siatkę (22 = dawne Symetrycznie2)', () => {
        const dtos = engine.generateConnectors(verts, normal, 'standard_od_lewej', null, null, 22);
        expect(dtos[0].offsetMm).toBe(22);
        expect(dtos[0].positionMm[0]).toBeCloseTo(22, 5);
        expect(dtos[1].offsetMm).toBe(54);
        expect(dtos[1].positionMm[0]).toBeCloseTo(54, 5);
    });

    it('od tyłu: pierwszy kołek 32 mm od max Y formatki', () => {
        const alongY = [
            new Vec3(0, 0, 0),
            new Vec3(0, 400, 0),
            new Vec3(18, 400, 0),
            new Vec3(18, 0, 0),
        ];
        const dtos = engine.generateConnectors(alongY, new Vec3(1, 0, 0), 'standard_od_prawej', null, new Vec3(0, 1, 0));
        expect(dtos[0].side).toBe('back');
        expect(dtos[0].positionMm[1]).toBeCloseTo(368, 5);
    });

    it('pomija wyłączone pozycje (positions_active)', () => {
        const active = Array(19).fill(true);
        active[0] = false;
        const dtos = engine.generateConnectors(verts, normal, 'standard_od_lewej', active);
        expect(dtos.length).toBe(11);
        expect(dtos[0].index).toBe(1);
        expect(dtos[0].type).toBe('konfirmat_5x50');
    });

    it('nieznana reguła zwraca pustą listę', () => {
        expect(engine.generateConnectors(verts, normal, 'nie_ma_takiej')).toEqual([]);
    });

    it('średnice z JSON (metry) są w mm', () => {
        const dtos = engine.generateConnectors(verts, normal, 'standard_od_lewej');
        expect(dtos[0].diameterMm).toBeCloseTo(8, 5);
        expect(dtos[0].lengthMm).toBeCloseTo(35, 5);
        expect(dtos[1].diameterMm).toBeCloseTo(5, 5);
        expect(dtos[1].lengthMm).toBeCloseTo(50, 5);
    });
});
