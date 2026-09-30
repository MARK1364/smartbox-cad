import { describe, expect, it } from 'vitest';
import type {
    CornerDoorsPlanParams,
    DoorsPlanParams,
    DrawersPlanParams,
    FlapsPlanParams,
    BlokiGeneratorParams
} from '../bloki-module-types.js';
import { findBlokiInputTypeViolations } from '../../scripts/bloki-input-audit.mjs';

describe('Bloki module input contracts', () => {
    it('audit rejects untyped and anonymous module inputs and any callbacks', () => {
        expect(findBlokiInputTypeViolations(
            'A2_bloki/sample-engine.ts',
            'export function normalizeSampleParams(raw: any = {}) {}'
        )).toHaveLength(1);
        expect(findBlokiInputTypeViolations(
            'A2_bloki/sample-engine.ts',
            'export function buildSamplePlan(params: Record<string, unknown>) {}'
        )).toHaveLength(1);
        expect(findBlokiInputTypeViolations(
            'A2_bloki/sample-adapter.tsx',
            'export function Sample({ triggerUpdate }: { triggerUpdate: (params: any) => void }) {}'
        )).toHaveLength(1);
        expect(findBlokiInputTypeViolations(
            'A2_bloki/sample-engine.ts',
            'export function normalizeSampleParams(raw: SamplePlanParams = {}) {}'
        )).toEqual([]);
    });

    it('accepts canonical params and rejects invalid names and value types', () => {
        const doors: DoorsPlanParams = { rodzaj_drzwi: 'LEFT', grubosc_frontu_mm: 18 };
        const drawers: DrawersPlanParams = { liczba_szuflad: 3, konfiguracje_prowadnic: {} };
        const flaps: FlapsPlanParams = { kierunek_klapy: 'TOP' };
        const cornerDoors: CornerDoorsPlanParams = { grubosc_frontu_mm: 18 };
        const blokDoors: BlokiGeneratorParams = {
            type: 'blok_doors',
            boxType: 'DOORS',
            rodzaj_drzwi: 'LEFT'
        };

        // @ts-expect-error Misspelled keys are outside the canonical contract.
        const invalidDoorKey: DoorsPlanParams = { rodzaj_drzwii: 'LEFT' };
        // @ts-expect-error Numeric fields must not accept strings.
        const invalidDrawerValue: DrawersPlanParams = { liczba_szuflad: '3' };
        // @ts-expect-error Enums are restricted to documented values.
        const invalidFlapValue: FlapsPlanParams = { kierunek_klapy: 'SIDE' };
        // @ts-expect-error Numeric fields must not accept strings.
        const invalidCornerValue: CornerDoorsPlanParams = { grubosc_frontu_mm: '18' };
        // @ts-expect-error The type and boxType tags must identify the same module.
        const invalidBlokiType: BlokiGeneratorParams = { type: 'blok_drawers', boxType: 'DOORS' };

        expect([doors, drawers, flaps, cornerDoors, blokDoors]).toHaveLength(5);
        expect([invalidDoorKey, invalidDrawerValue, invalidFlapValue, invalidCornerValue, invalidBlokiType]).toHaveLength(5);
    });
});
