/**
 * Testy presetów narzędzi złączy.
 *
 * Uruchom: npx vitest run C2_connectors/__tests__/connector-presets.test.ts  (z katalogu web/)
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
    CONNECTOR_PRESETS_STORAGE_KEY,
    ConnectorPresetStore,
    normalizePositionTypes,
    normalizePositionsActive,
    summarizePresetMask,
} from '../connector-presets.js';
import { ConnectorStore } from '../connector-store.js';
import { countRulePositions, generateConnectors, getPlacementRuleDefinition } from '../connectors-engine.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';

describe('connector-presets', () => {
    beforeEach(() => {
        localStorage.removeItem(CONNECTOR_PRESETS_STORAGE_KEY);
        ConnectorPresetStore.instance.clear();
        ConnectorStore.instance.clear();
    });

    it('normalizePositionsActive dopasowuje długość do reguły', () => {
        const total = countRulePositions(getPlacementRuleDefinition('standard_od_lewej'));
        const mask = normalizePositionsActive('standard_od_lewej', [true, false]);
        expect(mask).toHaveLength(total);
        expect(mask[0]).toBe(true);
        expect(mask[1]).toBe(false);
        expect(mask[2]).toBe(true);
    });

    it('zapisuje i wczytuje preset z maską i typami pozycji', () => {
        const store = ConnectorPresetStore.instance;
        const mask = normalizePositionsActive('standard_od_lewej', null);
        const types = normalizePositionTypes('standard_od_lewej', null);
        mask[0] = true;
        mask[1] = true;
        mask[2] = false;
        types[0] = 'konfirmat_5x50';
        types[1] = 'kolki_d8x35';
        const preset = store.add({
            name: 'Od przodu custom',
            placementRule: 'standard_od_lewej',
            firstOffsetMm: 32,
            positionsActive: mask,
            positionTypes: types,
        });
        expect(store.presets).toHaveLength(1);
        expect(summarizePresetMask(preset)).toMatch(/K\d+/);
        expect(summarizePresetMask(preset)).toMatch(/C\d+/);

        store.presets = [];
        store.load();
        expect(store.get(preset.id)?.name).toBe('Od przodu custom');
        expect(store.get(preset.id)?.positionsActive[2]).toBe(false);
        expect(store.get(preset.id)?.positionTypes[0]).toBe('konfirmat_5x50');
    });

    it('applyPreset ustawia regułę, offset, maskę i typy w ConnectorStore', () => {
        const presets = ConnectorPresetStore.instance;
        const mask = normalizePositionsActive('standard_od_lewej', null);
        const types = normalizePositionTypes('standard_od_lewej', null);
        mask[0] = false;
        types[1] = 'minifix';
        const preset = presets.add({
            name: 'Bez pierwszego',
            placementRule: 'standard_od_lewej',
            firstOffsetMm: 40,
            positionsActive: mask,
            positionTypes: types,
        });
        const store = ConnectorStore.instance;
        store.applyPreset(preset);
        expect(store.placementRule).toBe('standard_od_lewej');
        expect(store.firstOffsetMm).toBe(40);
        expect(store.positionsActive[0]).toBe(false);
        expect(store.positionTypes[1]).toBe('minifix');
        expect(store.activePresetId).toBe(preset.id);
    });

    it('generateConnectors respektuje nadpisanie typu na pozycji', () => {
        const verts = [
            new Vec3(0, 0, 0),
            new Vec3(0, 700, 0),
            new Vec3(0, 700, 18),
            new Vec3(0, 0, 18),
        ];
        const types = normalizePositionTypes('standard_od_lewej', null);
        types[0] = 'konfirmat_5x50';
        const dtos = generateConnectors(verts, new Vec3(1, 0, 0), 'standard_od_lewej', null, null, 32, undefined, types);
        expect(dtos[0]?.type).toBe('konfirmat_5x50');
    });
});
