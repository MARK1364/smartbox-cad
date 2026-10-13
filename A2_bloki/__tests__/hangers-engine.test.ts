/**
 * A2_bloki/__tests__/hangers-engine.test.ts
 *
 * Testy dedykowanego silnika zawieszek (HangersEngine) w Blokach.
 * Sprawdza obsługę formatu pojedynczego (TT2.json) oraz formatu wielozestawowego (sets: [...]).
 */

import { describe, it, expect } from 'vitest';
import { calculateHangersPlan, normalizeHangersParams } from '../hangers-engine.js';
import { extractHangerSets, resolveActiveHangerSet } from '../hangers-types.js';
import { SmartModuleRegistry } from '../core/smart-module-registry.js';
import { registerAllBlokiModules } from '../bootstrap-bloki-modules.js';

describe('HangersEngine & HangersTypes', () => {
    const singlePackageMock = {
        id: 'sp:TT2',
        name: 'TT2',
        units: 'mm',
        type: 'CUSTOM',
        mainContainer: {
            widthMm: 564,
            heightMm: 600,
            depthMm: 330,
        },
        parts: [
            {
                id: 'part_1',
                name: 'Part Lewy',
                widthMm: 20,
                heightMm: 40,
                depthMm: 70,
                refX: 'LEFT',
                offsetX_mm: 10,
                refY: 'BACK',
                offsetY_mm: 35,
                refZ: 'TOP',
                offsetZ_mm: 20,
            },
            {
                id: 'part_2',
                name: 'Part Prawy',
                widthMm: 20,
                heightMm: 40,
                depthMm: 70,
                refX: 'RIGHT',
                offsetX_mm: 10,
                refY: 'BACK',
                offsetY_mm: 35,
                refZ: 'TOP',
                offsetZ_mm: 20,
            },
        ],
        cuts: [
            {
                id: 'walec_1',
                name: 'Otwór boczny L',
                type: 'HOLE',
                diameterMm: 8,
                lengthMm: 24,
                refX: 'LEFT',
                axis: 'X',
                direction: -1,
                partId: 'part_1',
            },
        ],
        parameters: [
            { key: 'zamroz_otwor', type: 'check', label: 'Zamroź otwór', default: false },
        ],
        bindings: [
            { paramKey: 'zamroz_otwor', targetType: 'CUT', targetId: 'walec_1', field: 'frozen' },
        ],
    };

    const multiSetPackageMock = {
        units: 'mm',
        version: '1.0',
        category: 'HANGERS',
        sets: [
            {
                id: 'camaro_807',
                name: 'Camaro 807 (Standard)',
                parts: [
                    {
                        id: 'camaro_L',
                        name: 'Camaro Lewa',
                        widthMm: 20,
                        heightMm: 38,
                        depthMm: 70,
                        refX: 'LEFT',
                        offsetX_mm: 12,
                        refY: 'BACK',
                        offsetY_mm: 30,
                        refZ: 'TOP',
                        offsetZ_mm: 25,
                    },
                ],
                cuts: [],
            },
            {
                id: 'blum_48',
                name: 'Blum 48N',
                parts: [
                    {
                        id: 'blum_L',
                        name: 'Blum Lewa',
                        widthMm: 22,
                        heightMm: 45,
                        depthMm: 65,
                        refX: 'LEFT',
                        offsetX_mm: 15,
                        refY: 'BACK',
                        offsetY_mm: 40,
                        refZ: 'TOP',
                        offsetZ_mm: 30,
                    },
                ],
                cuts: [],
            },
        ],
    };

    it('poprawnie wyciąga zestaw z pliku pojedynczego', () => {
        const sets = extractHangerSets(singlePackageMock, 'TT2');
        expect(sets.length).toBe(1);
        expect(sets[0].id).toBe('sp:TT2');
        expect(sets[0].name).toBe('TT2');
        expect(sets[0].parts.length).toBe(2);
        expect(sets[0].cuts?.length).toBe(1);
    });

    it('poprawnie wyciąga wiele zestawów z pliku wielozestawowego', () => {
        const sets = extractHangerSets(multiSetPackageMock, 'katalog');
        expect(sets.length).toBe(2);
        expect(sets[0].id).toBe('camaro_807');
        expect(sets[0].name).toBe('Camaro 807 (Standard)');
        expect(sets[1].id).toBe('blum_48');
        expect(sets[1].name).toBe('Blum 48N');
    });

    it('resolveActiveHangerSet zwraca wybrany zestaw lub domyślny pierwszy', () => {
        const set1 = resolveActiveHangerSet(multiSetPackageMock, 'blum_48');
        expect(set1?.id).toBe('blum_48');

        const defaultSet = resolveActiveHangerSet(multiSetPackageMock);
        expect(defaultSet?.id).toBe('camaro_807');
    });

    it('wylicza pozycje okuć L i R we wnęce o zadanych wymiarach', () => {
        const dims = { width_mm: 800, height_mm: 720, depth_mm: 350 };
        const plan = calculateHangersPlan(dims, { szablon_id: 'TT2' }, singlePackageMock);

        expect(plan.hardware).toBeDefined();
        expect(plan.hardware?.length).toBe(2);

        const partL = plan.hardware?.find((h) => h.name.includes('Lewy'));
        const partR = plan.hardware?.find((h) => h.name.includes('Prawy'));
        expect(partL).toBeDefined();
        expect(partR).toBeDefined();

        // Lewa zawieszka: 10 mm od lewego boku (W=800, więc -400 + 10 = -390)
        expect(partL?.loc.x).toBe(-390);
        // Prawa zawieszka: 10 mm od prawego boku (W=800, więc +400 - 10 = +390)
        expect(partR?.loc.x).toBe(390);

        // Wysokość: od góry H=720, offsetZ=20 -> 720 - 20 = 700
        expect(partL?.loc.z).toBe(700);
        expect(partR?.loc.z).toBe(700);

        // Głębokość: od pleców D=350, offsetY=35 -> 350/2 - 35 = 140
        expect(partL?.loc.y).toBe(140);
        expect(partR?.loc.y).toBe(140);
    });

    it('rozsuwa zawieszki przy zmianie szerokości korpusu (np. do 1200 mm)', () => {
        const dimsWide = { width_mm: 1200, height_mm: 720, depth_mm: 350 };
        const plan = calculateHangersPlan(dimsWide, { szablon_id: 'TT2' }, singlePackageMock);

        const partL = plan.hardware?.find((h) => h.name.includes('Lewy'));
        const partR = plan.hardware?.find((h) => h.name.includes('Prawy'));

        // Przy szerokości 1200: lewa = -600 + 10 = -590, prawa = +600 - 10 = +590
        expect(partL?.loc.x).toBe(-590);
        expect(partR?.loc.x).toBe(590);
    });

    it('uwzględnia korekty odsunięcia z parametrów użytkownika', () => {
        const dims = { width_mm: 800, height_mm: 720, depth_mm: 350 };
        const plan = calculateHangersPlan(
            dims,
            { szablon_id: 'TT2', odsuniecie_gora_mm: 10, odsuniecie_bok_mm: 5 },
            singlePackageMock
        );

        const partL = plan.hardware?.find((h) => h.name.includes('Lewy'));
        // Z bazowe = 700 - 10 = 690
        expect(partL?.loc.z).toBe(690);
        // X bazowe = -390 + 5 = -385
        expect(partL?.loc.x).toBe(-385);
    });

    it('hangersPlugin jest poprawnie zarejestrowany w SmartModuleRegistry', () => {
        registerAllBlokiModules();
        const plugin = SmartModuleRegistry.get('HANGERS');
        expect(plugin).toBeDefined();
        expect(plugin?.meta.label).toBe('Zawieszki');
        expect(typeof plugin?.buildPlan).toBe('function');
        expect(typeof plugin?.syncDrillings).toBe('function');
    });
});
