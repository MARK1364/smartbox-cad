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
    syncAssociativeMirrors,
    detachMirror,
    detachCutMirror,
    type SmartPartPackageDefinition,
} from '../index.js';

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

    it('mirrorClonePart tworzy symetryczny prawy part i odwraca kierunki nawierceń w boki', async () => {
        const { mirrorClonePart } = await import('../smartpart-params.js');
        const main = { widthMm: 600, heightMm: 720, depthMm: 560 };
        const leftHanger = {
            id: 'hanger_L',
            name: 'Zawieszka (Lewa)',
            widthMm: 20,
            heightMm: 50,
            depthMm: 40,
            xMm: -280,
            yMm: -240,
            zMm: 310,
            refX: 'LEFT' as const,
            offsetX_mm: 20,
            refY: 'BACK' as const,
            offsetY_mm: 40,
            refZ: 'TOP' as const,
            offsetZ_mm: 50,
        };
        const leftHole = {
            id: 'hole_L_1',
            partId: 'hanger_L',
            name: 'Otwór boczny (L)',
            type: 'HOLE' as const,
            diameterMm: 5,
            lengthMm: 12,
            refX: 'LEFT' as const,
            offsetX_mm: 0,
            refY: 'FRONT' as const,
            offsetY_mm: 20,
            refZ: 'TOP' as const,
            offsetZ_mm: 25,
            axis: 'X' as const,
            direction: -1 as const, // wiercenie w lewy bok
            xMm: -10,
            yMm: 0,
            zMm: 0,
        };

        const res = mirrorClonePart(leftHanger, main, [leftHole], 'hanger_R', (i) => `hole_R_${i}`);
        expect(res.mirroredPart.id).toBe('hanger_R');
        expect(res.mirroredPart.name).toContain('Prawa');
        expect(res.mirroredPart.refX).toBe('RIGHT');
        expect(res.mirroredPart.offsetX_mm).toBe(20); // Stały offset od przeciwległej ściany!
        expect(res.mirroredPart.xMm).toBe(280); // Symetryczna pozycja

        expect(res.mirroredCuts).toHaveLength(1);
        const rightHole = res.mirroredCuts[0];
        expect(rightHole.partId).toBe('hanger_R');
        expect(rightHole.refX).toBe('RIGHT');
        expect(rightHole.axis).toBe('X');
        expect(rightHole.direction).toBe(1); // Odwrócony zwrot wiercenia w prawy bok!
    });

    it('syncAssociativeMirrors zachowuje asocjacyjność: aktualizacja wymiarów i dodanie otworu do lewego elementu synchronizuje prawy element', () => {
        const pkg: SmartPartPackageDefinition = {
            id: 'sp:Zawieszka',
            name: 'Zawieszka',
            units: 'mm',
            version: '1.0',
            type: 'CUSTOM',
            mainContainer: { widthMm: 600, depthMm: 500, heightMm: 720 },
            parts: [
                {
                    id: 'hanger_L',
                    name: 'Zawieszka Lewa',
                    widthMm: 20,
                    heightMm: 50,
                    depthMm: 40,
                    xMm: -280,
                    yMm: -240,
                    zMm: 310,
                    refX: 'LEFT',
                    offsetX_mm: 20,
                    refY: 'BACK',
                    offsetY_mm: 40,
                    refZ: 'TOP',
                    offsetZ_mm: 50,
                },
                {
                    id: 'hanger_R',
                    name: 'Zawieszka Prawa',
                    widthMm: 20,
                    heightMm: 50,
                    depthMm: 40,
                    xMm: 280,
                    yMm: -240,
                    zMm: 310,
                    refX: 'RIGHT',
                    offsetX_mm: 20,
                    refY: 'BACK',
                    offsetY_mm: 40,
                    refZ: 'TOP',
                    offsetZ_mm: 50,
                    mirroredFrom: 'hanger_L',
                    mirrorAxis: 'X',
                },
            ],
            cuts: [
                {
                    id: 'cut_L_1',
                    partId: 'hanger_L',
                    name: 'Otwór L1',
                    type: 'HOLE',
                    diameterMm: 5,
                    lengthMm: 12,
                    refX: 'LEFT',
                    offsetX_mm: 0,
                    refY: 'FRONT',
                    offsetY_mm: 15,
                    refZ: 'TOP',
                    offsetZ_mm: 20,
                    axis: 'X',
                    direction: -1,
                    xMm: 0,
                    yMm: 0,
                    zMm: 0,
                },
            ],
            updatedAt: 0,
        };

        // Krok 1: sync synchronizuje prawą część i automatycznie generuje otwór dla prawej części
        const synced1 = syncAssociativeMirrors(pkg);
        expect(synced1.cuts).toHaveLength(2);
        const cutR = synced1.cuts.find((c) => c.partId === 'hanger_R');
        expect(cutR).toBeDefined();
        expect(cutR?.mirroredFrom).toBe('cut_L_1');
        expect(cutR?.refX).toBe('RIGHT');
        expect(cutR?.name).toContain('(P)');

        // Krok 2: Modyfikujemy lewy element (zmiana wymiaru i offsetu) oraz dodajemy drugi otwór
        const modifiedPkg: SmartPartPackageDefinition = {
            ...synced1,
            parts: synced1.parts.map((p) =>
                p.id === 'hanger_L' ? { ...p, widthMm: 35, offsetX_mm: 25 } : p
            ),
            cuts: [
                ...synced1.cuts.filter((c) => c.partId === 'hanger_L'),
                {
                    id: 'cut_L_2',
                    partId: 'hanger_L',
                    name: 'Otwór L2',
                    type: 'HOLE',
                    diameterMm: 8,
                    lengthMm: 15,
                    refX: 'LEFT',
                    offsetX_mm: 0,
                    refY: 'FRONT',
                    offsetY_mm: 35,
                    refZ: 'TOP',
                    offsetZ_mm: 40,
                    axis: 'X',
                    direction: -1,
                    xMm: 0,
                    yMm: 0,
                    zMm: 0,
                },
            ],
        };

        const synced2 = syncAssociativeMirrors(modifiedPkg);
        const partR = synced2.parts.find((p) => p.id === 'hanger_R');
        expect(partR?.widthMm).toBe(35); // Automatycznie zaktualizowana szerokość
        expect(partR?.offsetX_mm).toBe(25); // Automatycznie zaktualizowany offset
        expect(synced2.cuts.filter((c) => c.partId === 'hanger_R')).toHaveLength(2); // 2 otwory na prawej zawieszce!

        // Krok 3: Odłączenie asocjacji (detachMirror)
        const detached = detachMirror(synced2, 'hanger_R');
        const detachedPartR = detached.parts.find((p) => p.id === 'hanger_R');
        expect(detachedPartR?.mirroredFrom).toBeUndefined();
        const detachedCutsR = detached.cuts.filter((c) => c.partId === 'hanger_R');
        expect(detachedCutsR[0].mirroredFrom).toBeUndefined();
    });
});

