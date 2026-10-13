import { describe, it, expect } from 'vitest';
import {
    assertValidSmartPartParams,
    defaultSmartPartParamValues,
    initialSmartPartParamValues,
    syncParameterDefaultsFromBindings,
    resolveSmartPartParams,
    addNumberParameter,
    upsertPartFieldBinding,
    getPartFieldBinding,
    type SmartPartPackageDefinition,
} from '../../S5_studio/index.js';

function nozkaDef(): SmartPartPackageDefinition {
    const part = (id: string, refX: 'LEFT' | 'RIGHT', refY: 'FRONT' | 'BACK') => ({
        id, name: id, widthMm: 50, depthMm: 50, heightMm: 100,
        xMm: 0, yMm: 0, zMm: 0,
        refX, offsetX_mm: 50, refY, offsetY_mm: 60, refZ: 'BOTTOM' as const, offsetZ_mm: 0,
        colorHex: '#aaa', glbPath: 'a.glb',
    });
    return {
        id: 'sp:Nozka', name: 'Nozka', units: 'mm', version: '1.0', type: 'CUSTOM',
        mainContainer: { widthMm: 600, depthMm: 560, heightMm: 100 },
        parts: [part('lp', 'LEFT', 'FRONT'), part('pp', 'RIGHT', 'FRONT'), part('lt', 'LEFT', 'BACK')],
        cuts: [],
        updatedAt: 0,
        parameters: [
            { key: 'offset_lewy_mm', type: 'number', default_mm: 50, min_mm: 0, max_mm: 300 },
            { key: 'typ_nozki', type: 'list', default: 'A', options: [
                { key: 'A', glbPath: 'a.glb' }, { key: 'B', glbPath: 'b.glb' },
            ] },
        ],
        bindings: [
            { paramKey: 'offset_lewy_mm', partId: 'lp', field: 'offsetX_mm' },
            { paramKey: 'offset_lewy_mm', partId: 'lt', field: 'offsetX_mm' },
            { paramKey: 'typ_nozki', partId: 'lp', field: 'glbPath' },
            { paramKey: 'typ_nozki', partId: 'pp', field: 'glbPath' },
        ],
    };
}

describe('A5_smartparts / studio — parametry SmartParta', () => {
    it('pakiet bez powiązań zwracany bez zmian (zawieszki / Camaro nietknięte)', () => {
        const def = nozkaDef();
        delete def.bindings;
        expect(resolveSmartPartParams(def, { offset_lewy_mm: 99 })).toBe(def);
    });

    it('wartości domyślne z parametrów', () => {
        expect(defaultSmartPartParamValues(nozkaDef())).toEqual({ offset_lewy_mm: 50, typ_nozki: 'A' });
    });

    it('initialSmartPartParamValues bierze offset z geometrii gdy default parametru jest stale', () => {
        const def = nozkaDef();
        // Part lp ma offsetX=50, ale ktoś zmienił default parametru na 10
        (def.parameters![0] as { default_mm: number }).default_mm = 10;
        expect(initialSmartPartParamValues(def).offset_lewy_mm).toBe(50);
        const synced = syncParameterDefaultsFromBindings(def);
        expect((synced.parameters![0] as { default_mm: number }).default_mm).toBe(50);
    });

    it('jeden parametr przesuwa wiele partów (obie lewe nóżki)', () => {
        const out = resolveSmartPartParams(nozkaDef(), { offset_lewy_mm: 70 });
        const lp = out.parts.find((p) => p.id === 'lp')!;
        const lt = out.parts.find((p) => p.id === 'lt')!;
        const pp = out.parts.find((p) => p.id === 'pp')!;
        expect(lp.offsetX_mm).toBe(70);
        expect(lt.offsetX_mm).toBe(70);
        expect(lp.xMm).toBe(-300 + 70);
        expect(lt.xMm).toBe(-300 + 70);
        expect(pp.offsetX_mm).toBe(50); // niepowiązany nie rusza
    });

    it('nie mutuje wejścia', () => {
        const def = nozkaDef();
        const snapshot = JSON.stringify(def);
        resolveSmartPartParams(def, { offset_lewy_mm: 120, typ_nozki: 'B' });
        expect(JSON.stringify(def)).toBe(snapshot);
    });

    it('lista podmienia GLB w powiązanych partach', () => {
        const out = resolveSmartPartParams(nozkaDef(), { typ_nozki: 'B' });
        expect(out.parts.find((p) => p.id === 'lp')!.glbPath).toBe('b.glb');
        expect(out.parts.find((p) => p.id === 'pp')!.glbPath).toBe('b.glb');
        expect(out.parts.find((p) => p.id === 'lt')!.glbPath).toBe('a.glb');
    });

    it('liczby są ograniczane do min/max', () => {
        const out = resolveSmartPartParams(nozkaDef(), { offset_lewy_mm: 9999 });
        expect(out.parts.find((p) => p.id === 'lp')!.offsetX_mm).toBe(300);
    });

    it('fail-fast: nieznany parametr w powiązaniu', () => {
        const def = nozkaDef();
        def.bindings!.push({ paramKey: 'nie_ma', partId: 'lp', field: 'offsetY_mm' });
        expect(() => assertValidSmartPartParams(def)).toThrow(/nieznany parametr/);
    });

    it('fail-fast: nieznany part w powiązaniu', () => {
        const def = nozkaDef();
        def.bindings!.push({ paramKey: 'offset_lewy_mm', partId: 'zzz', field: 'offsetX_mm' });
        expect(() => assertValidSmartPartParams(def)).toThrow(/nieznany part/);
    });

    it('fail-fast: zły typ parametru dla pola', () => {
        const def = nozkaDef();
        def.bindings!.push({ paramKey: 'typ_nozki', partId: 'lp', field: 'offsetX_mm' });
        expect(() => assertValidSmartPartParams(def)).toThrow(/wymaga parametru typu number/);
    });

    it('wysokość nóżki: jeden parametr dla wszystkich, krawędź przy ścianie BOTTOM', () => {
        const def = nozkaDef();
        def.mainContainer.heightMm = 200;
        def.parameters!.push({ key: 'wysokosc_mm', type: 'number', default_mm: 100, min_mm: 100, max_mm: 150 });
        for (const id of ['lp', 'pp', 'lt']) {
            def.bindings!.push({ paramKey: 'wysokosc_mm', partId: id, field: 'heightMm' });
        }
        const out = resolveSmartPartParams(def, { wysokosc_mm: 150 });
        for (const p of out.parts) {
            expect(p.heightMm).toBe(150);
            expect(p.offsetZ_mm).toBe(75);
            // dolna krawędź = -100 (dół kontenera 200): środek -100 + 75
            expect(p.zMm).toBe(-25);
        }
    });

    it('fail-fast: nieznana opcja listy', () => {
        expect(() => resolveSmartPartParams(nozkaDef(), { typ_nozki: 'ZZZ' })).toThrow(/nieznana opcja/);
    });

    it('upsertPartFieldBinding i addNumberParameter (Studio 🔗)', () => {
        let def = nozkaDef();
        delete def.bindings;
        delete def.parameters;
        def = addNumberParameter(def, { key: 'offset_lewy_mm', label: 'Offset lewy', default_mm: 55, min_mm: 0, max_mm: 300 });
        def = upsertPartFieldBinding(def, 'lp', 'offsetX_mm', 'offset_lewy_mm');
        expect(getPartFieldBinding(def, 'lp', 'offsetX_mm')?.paramKey).toBe('offset_lewy_mm');
        const out = resolveSmartPartParams(def, { offset_lewy_mm: 77 });
        expect(out.parts.find((p) => p.id === 'lp')!.offsetX_mm).toBe(77);
    });

    it('parametr steruje średnicą i odsunięciem walca (CUT: diameterMm, offsetX_mm)', () => {
        let def = nozkaDef();
        def.cuts = [
            {
                id: 'hole_1',
                name: 'Otwór montażowy',
                type: 'HOLE',
                diameterMm: 8,
                lengthMm: 30,
                xMm: 0,
                yMm: 0,
                zMm: 0,
                refX: 'LEFT',
                offsetX_mm: 15,
                refY: 'FRONT',
                offsetY_mm: 20,
                refZ: 'BOTTOM',
                offsetZ_mm: 10,
                axis: 'Z',
                direction: 1,
                partId: 'lp',
            },
        ];
        def = addNumberParameter(def, { key: 'srednica_otworu_mm', label: 'Średnica Ø', default_mm: 8, min_mm: 3, max_mm: 35 });
        def = addNumberParameter(def, { key: 'odsuniecie_otworu_mm', label: 'Odsunięcie X', default_mm: 15, min_mm: 0, max_mm: 100 });

        def.bindings!.push(
            { paramKey: 'srednica_otworu_mm', targetType: 'CUT', targetId: 'hole_1', field: 'diameterMm' },
            { paramKey: 'odsuniecie_otworu_mm', targetType: 'CUT', targetId: 'hole_1', field: 'offsetX_mm' },
        );

        const out = resolveSmartPartParams(def, {
            srednica_otworu_mm: 12,
            odsuniecie_otworu_mm: 25,
        });

        const cut = out.cuts[0] as any;
        expect(cut.diameterMm).toBe(12);
        expect(cut.offsetX_mm).toBe(25);
        // Part lp ma szerokość 50 mm (halfW = 25 mm). Od ściany LEFT (-25 mm) + 25 mm = 0 mm!
        expect(cut.xMm).toBe(0);
    });

    it('parametr steruje gabarytem kontenera głównego (MAIN: widthMm)', () => {
        let def = nozkaDef();
        def = addNumberParameter(def, { key: 'szerokosc_korpusu_mm', label: 'Szerokość korpusu', default_mm: 600, min_mm: 300, max_mm: 1200 });
        def.bindings!.push({
            paramKey: 'szerokosc_korpusu_mm',
            targetType: 'MAIN',
            targetId: 'main_container',
            field: 'widthMm',
        });

        const out = resolveSmartPartParams(def, { szerokosc_korpusu_mm: 800 });
        expect(out.mainContainer.widthMm).toBe(800);
        // Pozycja partu lp (LEFT, offsetX 50): -400 + 50 = -350
        const lp = out.parts.find((p) => p.id === 'lp')!;
        expect(lp.xMm).toBe(-350);
    });
});

