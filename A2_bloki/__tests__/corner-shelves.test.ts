import { describe, it, expect } from 'vitest';
import {
    assertCanonicalCornerShelvesParams,
    normalizeCornerShelvesParams,
    calculateCornerShelvesPlan
} from '../18_corner-shelves-engine.js';
import { buildCornerShelvesPlan } from '../01_module-plans.js';
import { UIController } from '../../A1_core/ui-controller.js';

describe('blok_corner_shelves', () => {
    const baseDims = {
        width_mm: 900,
        height_mm: 720,
        depth_mm: 900
    };

    it('odrzuca wycofane aliasy (fail-fast)', () => {
        expect(() => assertCanonicalCornerShelvesParams({ shelfCount: 2 })).toThrow(/shelfCount → liczba_polek/);
        expect(() => assertCanonicalCornerShelvesParams({ shelfOffsetFrontMm: 15 })).toThrow(/shelfOffsetFrontMm → odsuniecie_przod_mm/);
        expect(() => assertCanonicalCornerShelvesParams({ holePattern: 'TRIPLE' })).toThrow(/holePattern → wzor_nawiercen/);
        expect(() => assertCanonicalCornerShelvesParams({ cutoutNailer: true })).toThrow(/cutoutNailer → wyciecie_listwa_narozna/);
        expect(() => assertCanonicalCornerShelvesParams({ nailerWidth: 100 })).toThrow(/nailerWidth → listwa_narozna_szerokosc_mm/);
        expect(() => assertCanonicalCornerShelvesParams({ liczba_polek: 2 })).not.toThrow();
        expect(() => assertCanonicalCornerShelvesParams({ wyciecie_listwa_narozna: true })).not.toThrow();
        expect(() => assertCanonicalCornerShelvesParams({ shelfCount: undefined })).not.toThrow();
    });

    it('normalizuje parametry z poprawnymi wartościami domyślnymi', () => {
        const norm = normalizeCornerShelvesParams({});
        expect(norm.liczba_polek).toBe(1);
        expect(norm.grubosc_polki_mm).toBe(18);
        expect(norm.odsuniecie_przod_mm).toBe(0);
        expect(norm.luz_boczny_mm).toBe(0);
        expect(norm.wzor_nawiercen).toBe('SINGLE');
        expect(norm.bok_lewy_mm).toBe(600);
        expect(norm.bok_prawy_mm).toBe(600);
    });

    it('generuje 1 półkę w kształcie L z 8 wierzchołkami outline2d (z wcięciem pod listwę)', () => {
        const plan = calculateCornerShelvesPlan(baseDims, normalizeCornerShelvesParams({
            liczba_polek: 1,
            grubosc_polki_mm: 18,
            bok_lewy_mm: 350,
            bok_prawy_mm: 350
        }, baseDims));

        expect(plan.parts).toHaveLength(1);
        const shelf = plan.parts[0];
        expect(shelf.name).toBe('Polka_1');
        expect(shelf.role).toBe('SHELF');
        expect(shelf.report_type).toBe('SHELF');
        expect(shelf.dim.z).toBe(18);

        // Pozycja Z na środku wysokości (720 / 2 = 360)
        expect(shelf.loc.z).toBeCloseTo(360, 1);

        // outline2d
        expect(shelf.customProperties?.outline2d).toBeDefined();
        expect(shelf.customProperties?.outline2d).toHaveLength(8);

        // Wymiary płyty gabarytowej (obejmującej L): plateW x plateD x grubość 18mm
        expect(shelf.dim.x).toBe(900);
        expect(shelf.dim.y).toBe(900);
        expect(shelf.dim.z).toBe(18);
        expect(shelf.customProperties?.shape).toBe('L_NOTCH');
        expect(shelf.lcs?.mapping).toEqual({ X: 'x', Y: 'y', Z: 'z' });
        expect(shelf.lcs?.rotation).toEqual([90, 180, 0]);
    });

    it('generuje w 100% ten sam gabaryt i wierzchołki co wieniec dolny WIENIEC_D bez wycięcia listwy', () => {
        const plan = calculateCornerShelvesPlan(baseDims, normalizeCornerShelvesParams({
            liczba_polek: 1,
            bok_lewy_mm: 350,
            bok_prawy_mm: 350,
            wyciecie_listwa_narozna: false
        }, baseDims));

        const shelf = plan.parts[0];
        const outline2d = shelf.customProperties?.outline2d as [number, number][];
        expect(outline2d).toBeDefined();
        expect(outline2d).toHaveLength(6);

        // 100% kopia WIENIEC_D z corner90-geometry.ts:
        // [effectiveX0, y0 + bokLTh] -> UV [900, 18]
        // [x0 + bok_lewy, y0 + bokLTh] -> UV [550, 18]
        // [x0 + bok_lewy, y1 - bok_prawy] -> UV [550, 550]
        // [x1 - bokPTh, y1 - bok_prawy] -> UV [18, 550]
        // [x1 - bokPTh, effectiveY1] -> UV [18, 900]
        // [effectiveX0, effectiveY1] -> UV [900, 900]
        // reverse():
        expect(outline2d).toEqual([
            [900, 900],
            [18, 900],
            [18, 550],
            [550, 550],
            [550, 18],
            [900, 18]
        ]);
    });

    it('generuje 8-wierzchołkowy obrys z wycięciem pod listwę narożną (domyślnie)', () => {
        const plan = calculateCornerShelvesPlan(baseDims, normalizeCornerShelvesParams({
            liczba_polek: 1,
            bok_lewy_mm: 350,
            bok_prawy_mm: 350,
            wyciecie_listwa_narozna: true,
            listwa_narozna_szerokosc_mm: 100,
            listwa_narozna_grubosc_mm: 18,
            listwa_narozna_luz_mm: 1
        }, baseDims));

        const shelf = plan.parts[0];
        const outline2d = shelf.customProperties?.outline2d as [number, number][];
        expect(outline2d).toBeDefined();
        expect(outline2d).toHaveLength(8);

        // 8 wierzchołków L z wcięciem na listwę narożną w narożniku [effectiveX0, effectiveY1]:
        // cutW = 101, cutTh = 19
        // Punkty zastępujące [900, 900] to wcięcie:
        // [900, 799], [881, 799], [881, 900]
        expect(outline2d).toEqual([
            [900, 799],
            [881, 799],
            [881, 900],
            [18, 900],
            [18, 550],
            [550, 550],
            [550, 18],
            [900, 18]
        ]);
    });

    it('cofa wcięcie L w głąb korpusu o odsuniecie_przod_mm', () => {
        const plan = calculateCornerShelvesPlan(baseDims, normalizeCornerShelvesParams({
            liczba_polek: 1,
            bok_lewy_mm: 350,
            bok_prawy_mm: 350,
            odsuniecie_przod_mm: 10,
            wyciecie_listwa_narozna: false
        }, baseDims));

        const shelf = plan.parts[0];
        const outline2d = shelf.customProperties?.outline2d as [number, number][];
        expect(outline2d).toBeDefined();

        // Przy cofnięciu o 10 mm wcięcie L cofa się o 10 mm w obu osiach (550 -> 560 w UV)
        expect(outline2d).toEqual([
            [900, 900],
            [18, 900],
            [18, 560],
            [560, 560],
            [560, 18],
            [900, 18]
        ]);
    });

    it('cofa krawędzie tylne do wewnętrznego lica pleców bez naruszania geometrii frontu', () => {
        const plan = calculateCornerShelvesPlan(baseDims, normalizeCornerShelvesParams({
            liczba_polek: 1,
            bok_lewy_mm: 350,
            bok_prawy_mm: 350,
            odsuniecie_przod_mm: 10,
            plecy_odsuniecie_x_mm: 16,
            plecy_odsuniecie_y_mm: 16,
            wyciecie_listwa_narozna: false
        }, baseDims));

        const shelf = plan.parts[0];
        const outline2d = shelf.customProperties?.outline2d as [number, number][];
        expect(outline2d).toBeDefined();

        // Krawędzie frontowe i wcięcie L: [18, 560], [560, 560], [560, 18] pozostają identyczne!
        // Tylko krawędzie tylne cofają się z 900 do 900 - 16 = 884:
        expect(outline2d).toEqual([
            [884, 884],
            [18, 884],
            [18, 560],
            [560, 560],
            [560, 18],
            [884, 18]
        ]);
    });

    it('generuje 3 półki równomiernie rozmieszczone w świetle wnęki', () => {
        const plan = buildCornerShelvesPlan({
            liczba_polek: 3,
            grubosc_polki_mm: 18
        }, baseDims);

        expect(plan.parts).toHaveLength(3);
        expect(plan.parts[0].name).toBe('Polka_1');
        expect(plan.parts[1].name).toBe('Polka_2');
        expect(plan.parts[2].name).toBe('Polka_3');

        // Wysokości rosnąco
        expect(plan.parts[0].loc.z).toBeLessThan(plan.parts[1].loc.z);
        expect(plan.parts[1].loc.z).toBeLessThan(plan.parts[2].loc.z);

        // Równe odstępy
        const delta1 = plan.parts[1].loc.z - plan.parts[0].loc.z;
        const delta2 = plan.parts[2].loc.z - plan.parts[1].loc.z;
        expect(delta1).toBeCloseTo(delta2, 1);
    });

    it('generuje otwory pod podpórki półek z rule shelf_pin i ownerTag isShelfDrilling w params', () => {
        const plan = calculateCornerShelvesPlan(baseDims, normalizeCornerShelvesParams({
            liczba_polek: 1,
            wzor_nawiercen: 'SINGLE'
        }, baseDims));

        const shelf = plan.parts[0];
        expect(shelf.features).toBeDefined();
        expect(shelf.features.length).toBeGreaterThanOrEqual(4);

        for (const feat of shelf.features) {
            expect(feat.type).toBe('hole');
            expect(feat.rule).toBe('shelf_pin');
            expect(feat.params.isShelfDrilling).toBe(true);
            expect(feat.params.diameter_mm).toBe(5);
        }
    });

    it('wspiera wzór potrójny (TRIPLE) generując 3 otwory na punkt podparcia', () => {
        const planSingle = calculateCornerShelvesPlan(baseDims, normalizeCornerShelvesParams({
            liczba_polek: 1,
            wzor_nawiercen: 'SINGLE'
        }, baseDims));
        const planTriple = calculateCornerShelvesPlan(baseDims, normalizeCornerShelvesParams({
            liczba_polek: 1,
            wzor_nawiercen: 'TRIPLE'
        }, baseDims));

        expect(planSingle.parts[0].features.length).toBe(4);
        expect(planTriple.parts[0].features.length).toBe(12);
    });

    it('asocjacyjnie dopasowuje geometrię i outline2d przy zmniejszeniu szerokości korpusu do 300 mm i emituje ostrzeżenie', () => {
        let lastStatus: { text: string; active?: boolean; kind?: string } | null = null;
        (UIController as any).instance = {
            setStatus: (text: string, active?: boolean, kind?: string) => {
                lastStatus = { text, active, kind };
            }
        };

        const smallDims = {
            width_mm: 300,
            height_mm: 720,
            depth_mm: 900
        };
        // Nawet jeśli bok_lewy_mm wynosi 600 mm (z poprzedniego rozmiaru szafki):
        const plan = calculateCornerShelvesPlan(smallDims, normalizeCornerShelvesParams({
            liczba_polek: 1,
            bok_lewy_mm: 600,
            bok_prawy_mm: 600,
            wyciecie_listwa_narozna: false
        }, smallDims));

        expect(plan.parts).toHaveLength(1);
        const shelf = plan.parts[0];
        expect(shelf.dim.x).toBe(300);
        expect(shelf.dim.y).toBe(900);

        const outline2d = shelf.customProperties?.outline2d as [number, number][];
        expect(outline2d).toBeDefined();
        expect(outline2d).toHaveLength(6);

        // outline2d nie posiada ujemnych współrzędnych i odpowiada dokładnie clampingowi W - 10 = 290 mm
        for (const [u, v] of outline2d) {
            expect(u).toBeGreaterThanOrEqual(0);
            expect(u).toBeLessThanOrEqual(300);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(900);
        }

        expect(outline2d).toEqual([
            [300, 900],
            [18, 900],
            [18, 300],
            [10, 300],
            [10, 18],
            [300, 18]
        ]);

        expect(lastStatus).not.toBeNull();
        expect(lastStatus!.text).toContain('przekracza gabaryt szafki — zredukowano do 290 mm');
        expect(lastStatus!.kind).toBe('warning');

        (UIController as any).instance = null;
    });

    it('dynamicznie odświeża formatki i okucia przy aktualizacji liczba_polek w scenie', async () => {
        const { ProjectDocument } = await import('../../A1_core/project-document.js');
        const { ContextManager } = await import('../../A1_core/context-manager.js');
        const { ContainerModel } = await import('../../A1_core/container-model.js');
        const { runEngineAndApply } = await import('../../A3_smartframe/smartframe-adapter.js');
        const { probeRogowy90BayFromCADPoint } = await import('../../A3_smartframe/rogowy90-bay.js');
        const { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } = await import('../02_bloki-bay-actions.js');
        const { update_bloki_core } = await import('../01_bloki-core.js');

        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        const cabinet = doc.createAssembly({ name: 'Rogowy90' }) as any;
        cabinet.generatorParams = {
            type: 'korpus_rogowy90',
            liczba_stref: 1,
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600,
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
        };
        runEngineAndApply(cabinet, 900, 720, 900, 1, 0, 0, 0);

        const bay = probeRogowy90BayFromCADPoint(doc, { x: 250, y: 0, z: 360 });
        expect(bay).not.toBeNull();

        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'CORNER_SHELVES')!;
        const blokNode = createBlokInDetectedBay(doc, bay!, opt);
        expect(blokNode).not.toBeNull();

        const container = blokNode!.domainData as any;
        const initialPanels = blokNode!.children.filter((c: any) => c.nodeType === 'PART');
        expect(initialPanels).toHaveLength(1);

        // Zmiana liczby półek na 3
        container.generatorParams.liczba_polek = 3;
        const success = update_bloki_core(container, doc);
        expect(success).toBe(true);

        const updatedPanels = blokNode!.children.filter((c: any) => c.nodeType === 'PART');
        expect(updatedPanels).toHaveLength(3);
        expect(updatedPanels.map((p: any) => p.name)).toEqual(['Polka_1', 'Polka_2', 'Polka_3']);

        const updatedHardware = blokNode!.children.filter((c: any) => c.nodeType === 'HARDWARE');
        expect(updatedHardware).toHaveLength(12); // 4 podpórki na każdą z 3 półek
    });
});
