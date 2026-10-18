import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { probeBayFromCADPoint } from '../02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../02_bloki-bay-actions.js';
import { registerBlokiModule } from '../01_register.js';
import { resolveCarcassRoofAngle, resolveCarcassRails } from '../06_skosne-doors-adapter.js';
import { update_bloki_core } from '../01_bloki-core.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { buildSkosneDoorsDrillings } from '../06_skosne-doors-drilling-builder.js';

/**
 * DRZWI SKOŚNE biorą kąt skosu dachu bezpośrednio z TOP_PANEL korpusu
 * (lcs.rotation[2]).
 */
describe('DRZWI SKOŚNE — automatyczne przejęcie skosu z korpusu', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
        registerBlokiModule();
    });

    function skosnyKorpus(hL: number, hR: number) {
        new CreateKorpusCommand({
            szerokosc_mm: 800,
            wysokosc_mm: Math.max(hL, hR),
            glebokosc_mm: 600,
            typ_korpusu: 'korpus_skosny_lr',
            wysokosc_lewy_mm: hL,
            wysokosc_prawy_mm: hR
        }).execute(doc);
        return doc.getContainers()[0];
    }

    it('skrzydło jest od razu trapezem — z kąta odczytanego z TOP_PANEL', () => {
        skosnyKorpus(1000, 2200);
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 500 })!;
        expect(bay).not.toBeNull();

        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SKOSNE_DOORS')!;
        const sbNode = createBlokiGeneratorParamsProxy(bay, opt);
        const gp = (sbNode.domainData as any).generatorParams;

        // Kąt wzniosu w prawo: tan = 1200 / 764 => ~57.52°
        expect(gp.dach_kat_deg).toBeGreaterThan(50);
        expect(gp.dach_kat_deg).toBeCloseTo(57.52, 1);
        // Prawa krawędź wyższa => krawędź pionowa po prawej => RIGHT
        expect(gp.rodzaj_drzwi).toBe('RIGHT');

        // Skrzydło wygenerowane jako trapez:
        const leaf = sbNode.children.find((c: any) => c.domainData?.role === 'FRONT');
        expect(leaf).toBeDefined();
        const outline = (leaf.domainData as any).custom_properties.outline2d as number[][];
        expect(outline[0]).toEqual([0, 0]);

        const tanBeta = Math.tan((gp.dach_kat_deg * Math.PI) / 180);
        const cosBeta = Math.cos((gp.dach_kat_deg * Math.PI) / 180);
        const rise = 14 / cosBeta;
        const xL = -bay.boundsMm.width / 2 - 16;
        const xP = +bay.boundsMm.width / 2 + 16;

        expect(outline[3][1]).toBeCloseTo(bay.boundsMm.height + xL * tanBeta + 15 + rise, 6);
        expect(outline[2][1]).toBeCloseTo(bay.boundsMm.height + xP * tanBeta + 15 + rise, 6);
    });

    it('nałożenie 18 na wieniec 18 zlicowuje drzwi z górą wieńca (nie wystaje w Z)', () => {
        skosnyKorpus(1000, 2200);
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 500 })!;
        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SKOSNE_DOORS')!;
        const sbNode = createBlokiGeneratorParamsProxy(bay, opt);
        const sbContainer = sbNode.domainData as any;
        // Domyślne nałożenie 14 → ustaw 18 = grubość wieńca górnego (tTop=18)
        sbContainer.generatorParams.nalozenie_gora_mm = 18;
        sbContainer.generatorParams.nalozenie_dol_mm = 15;
        expect(update_bloki_core(sbContainer, doc)).toBe(true);

        const leaf = sbNode.children.find((c: any) => c.domainData?.role === 'FRONT');
        const outline = (leaf.domainData as any).custom_properties.outline2d as number[][];
        const gp = sbContainer.generatorParams;
        const tan_kat_skosu = Math.tan((gp.dach_kat_deg * Math.PI) / 180);
        const cos_kat_skosu = Math.cos((gp.dach_kat_deg * Math.PI) / 180);
        // Niezależny punkt odniesienia (bez bay): szczyt dachu w osi wnęki srednia_wysokosc_dachu_mm = 1600,
        // dół wnęki = tBot = 18, sufit prawdziwy = h_avg − t/cos β, góra wieńca = h_avg.
        // Drzwi od spodu wnęki: dół −15, góra sufitu + n/cos β. Dla n = t = 18 góra drzwi
        // pokrywa się dokładnie z linią dachu szafy (tolerancja 0.5 mm).
        const grubosc_wienca_gornego_mm = 18;
        const srednia_wysokosc_dachu_mm = 1600;
        const bayBottomZ = bay.boundary.bottom.planeCoordMm;
        const pozycja_prawa_krawedz_mm = bay.boundsMm.width / 2 + 16;
        const wysokosc_drzwi_prawa_mm = outline[2][1];
        const wysokosc_dachu_prawa_mm = bay.boundsMm.height + pozycja_prawa_krawedz_mm * tan_kat_skosu + 15 + grubosc_wienca_gornego_mm / cos_kat_skosu;
        expect(Math.abs(wysokosc_drzwi_prawa_mm - wysokosc_dachu_prawa_mm)).toBeLessThan(0.5);
        // Niezależnie: wnęka po korekcie = srednia_wysokosc_dachu_mm − t/cos β − tBot.
        const wysokosc_swiatla_wneki_srodek_mm = srednia_wysokosc_dachu_mm - grubosc_wienca_gornego_mm / cos_kat_skosu - 18;
        expect(Math.abs(bay.boundsMm.height - wysokosc_swiatla_wneki_srodek_mm)).toBeLessThan(0.6);
        expect(bayBottomZ).toBeCloseTo(18, 0);
    });

    it('odwrócony skos (lewa wyższa) daje ujemny kąt i domyślnie LEWE', () => {
        skosnyKorpus(2200, 1000);
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 500 })!;
        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SKOSNE_DOORS')!;
        const sbNode = createBlokiGeneratorParamsProxy(bay, opt);
        const gp = (sbNode.domainData as any).generatorParams;

        expect(gp.dach_kat_deg).toBeLessThan(-50);
        expect(gp.rodzaj_drzwi).toBe('LEFT');
    });

    it('korpus bez wieńca górnego TOP_PANEL → fail-fast, brak zgadywania, brak skrzydła', () => {
        const cmd = new CreateKorpusCommand({
            szerokosc_mm: 800,
            wysokosc_mm: 2000,
            glebokosc_mm: 600,
            typ_korpusu: 'korpus3'
        });
        cmd.execute(doc);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        expect(bay).not.toBeNull();

        const korpus = doc.getContainers()[0];
        const topPanel = korpus.children.find((c: any) => c.domainData?.role === 'TOP_PANEL');
        if (topPanel) {
            korpus.removeChild(topPanel);
        }

        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SKOSNE_DOORS')!;
        const sbNode = createBlokiGeneratorParamsProxy(bay, opt);
        const gp = (sbNode.domainData as any).generatorParams;

        expect(gp.dach_kat_deg).toBeUndefined();
        // Bez kąta dachu silnik nie generuje skrzydła (fail-loud)
        expect(sbNode.children.some((c: any) => c.domainData?.role === 'FRONT')).toBe(false);
    });

    it('resolveCarcassRoofAngle odczytuje kąt z korpusu, a przy braku wieńca górnego zwraca undefined', () => {
        skosnyKorpus(1000, 2200);
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 500 })!;
        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SKOSNE_DOORS')!;
        const sbNode = createBlokiGeneratorParamsProxy(bay, opt);

        const angle = resolveCarcassRoofAngle(sbNode.id);
        expect(angle).toBeDefined();
        expect(angle!).toBeCloseTo(57.52, 1);

        // Usuwamy wieniec górny z korpusu
        const topPanel = sbNode.parent?.children.find((c: any) => c.domainData?.role === 'TOP_PANEL');
        expect(topPanel).toBeDefined();
        sbNode.parent!.removeChild(topPanel!);

        const angleAfter = resolveCarcassRoofAngle(sbNode.id);
        expect(angleAfter).toBeUndefined();
    });

    it('resolveCarcassRails odczytuje wieńce z korpusu dla kompatybilności', () => {
        skosnyKorpus(1000, 2200);
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 500 })!;
        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SKOSNE_DOORS')!;
        const sbNode = createBlokiGeneratorParamsProxy(bay, opt);
        const rails = resolveCarcassRails(sbNode.id);
        expect(rails.tBot).toBe(18);
        expect(rails.tTop).toBe(18);
    });

    it('zmiana gabarytu szafy skośnej aktualizuje kąt dachu, gabaryt i trapez skrzydła drzwi skośnych', () => {
        // 1. Korpus skośny 800 mm, HL=1000, HR=2200
        const korpusNode = skosnyKorpus(1000, 2200);
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 500 })!;
        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SKOSNE_DOORS')!;
        const sbNode = createBlokiGeneratorParamsProxy(bay, opt);
        const sbContainer = sbNode.domainData as any;

        const gpBefore = sbContainer.generatorParams;
        expect(gpBefore.dach_kat_deg).toBeCloseTo(57.52, 1);
        const leafBefore = sbNode.children.find((c: any) => c.domainData?.role === 'FRONT');
        const outlineBefore = (leafBefore.domainData as any).custom_properties.outline2d as number[][];
        const hRightBefore = outlineBefore[2][1];

        // 2. Zmieniamy gabaryt korpusu skośnego (prawa wysokość spada z 2200 na 1600 mm)
        const korpusContainer = korpusNode.domainData as any;
        korpusContainer.generatorParams.wysokosc_prawy_mm = 1600;
        korpusContainer.height = mmToNm(1600);
        runEngineAndApply(
            korpusContainer,
            800,
            1600,
            600,
            1,
            undefined,
            undefined,
            3,
            korpusContainer.generatorParams.offsets || {}
        );

        // 3. update_bloki_core odświeża kontener drzwi skośnych
        const ok = update_bloki_core(sbContainer, doc);
        expect(ok).toBe(true);

        const gpAfter = sbContainer.generatorParams;
        // Kąt w nowym korpusie: tan = (1600 - 1000) / 764 => ~38.14°
        expect(gpAfter.dach_kat_deg).toBeCloseTo(38.14, 1);

        const leafAfter = sbNode.children.find((c: any) => c.domainData?.role === 'FRONT');
        const outlineAfter = (leafAfter.domainData as any).custom_properties.outline2d as number[][];
        const hRightAfter = outlineAfter[2][1];

        expect(hRightAfter).toBeLessThan(hRightBefore);
    });

    it('korpus_skosny_lr_uc: nałożenie 18 licuje dokładnie (różnica 0), a nałożenie 14 daje szczelinę 4 mm prostopadle do skosu', () => {
        new CreateKorpusCommand({
            szerokosc_mm: 800,
            wysokosc_mm: 1800,
            glebokosc_mm: 600,
            typ_korpusu: 'korpus_skosny_lr_uc',
            wysokosc_lewy_mm: 1000,
            wysokosc_prawy_mm: 1800
        }).execute(doc);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 500 })!;
        expect(bay).not.toBeNull();

        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SKOSNE_DOORS')!;
        const sbNode = createBlokInDetectedBay(doc, bay, opt)!;
        const sbContainer = sbNode.domainData as any;

        // Test 1: nalozenie_gora_mm = 18 -> lico z dachem w osi x=0
        sbContainer.generatorParams.nalozenie_gora_mm = 18;
        sbContainer.generatorParams.nalozenie_dol_mm = 18;
        update_bloki_core(sbContainer, doc);

        const gp = sbContainer.generatorParams;
        const cos_kat_skosu = Math.cos((gp.dach_kat_deg * Math.PI) / 180);

        // Kąt dachu w korpus_skosny_lr_uc: tan = (1800 - 1000) / 800 = 1.0 (45°)
        expect(gp.dach_kat_deg).toBeCloseTo(45.0, 1);

        const leaf18 = sbNode.children.find((c: any) => c.domainData?.role === 'FRONT');
        const outline18 = (leaf18.domainData as any).custom_properties.outline2d as number[][];
        // outline2d: [0]: bottom-left, [1]: bottom-right, [2]: top-right, [3]: top-left
        // Wysokość skrzydła w osi x=0 (średnia wysokość skrzydła):
        const srednia_wysokosc_drzwi_18_mm = (outline18[2][1] + outline18[3][1]) / 2;
        // Wierzchołek dachu korpusu w osi x=0: (1000 + 1800) / 2 = 1400 mm
        // Spód drzwi: bayBottom - nalozenie_dol = 18 - 18 = 0 mm
        // Zatem góra drzwi w osi x=0 to: 0 + srednia_wysokosc_drzwi_18_mm
        expect(srednia_wysokosc_drzwi_18_mm).toBeCloseTo(1400.0, 1);

        // Test 2: nalozenie_gora_mm = 14 -> szczelina prostopadła do dachu = dokładnie 4.0 mm
        sbContainer.generatorParams.nalozenie_gora_mm = 14;
        update_bloki_core(sbContainer, doc);

        const leaf14 = sbNode.children.find((c: any) => c.domainData?.role === 'FRONT');
        const outline14 = (leaf14.domainData as any).custom_properties.outline2d as number[][];
        const srednia_wysokosc_drzwi_14_mm = (outline14[2][1] + outline14[3][1]) / 2;

        const szczelina_pionowa_mm = 1400.0 - srednia_wysokosc_drzwi_14_mm;
        const szczelina_prostopadla_mm = szczelina_pionowa_mm * cos_kat_skosu;
        expect(szczelina_prostopadla_mm).toBeCloseTo(4.0, 1);
    });

    it('drzwi skośne DOUBLE w korpusie tworzą dwa skrzydła i nawiercenia w obu bokach', () => {
        skosnyKorpus(1000, 2200);
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 500 })!;
        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SKOSNE_DOORS')!;
        const sbNode = createBlokiGeneratorParamsProxy(bay, opt);
        const sbContainer = sbNode.domainData as any;

        sbContainer.generatorParams.rodzaj_drzwi = 'DOUBLE';
        sbContainer.generatorParams.szczelina_mm = 4;
        sbContainer.generatorParams.uzyj_zawias_1 = true;
        sbContainer.generatorParams.uzyj_zawias_6 = true;
        expect(update_bloki_core(sbContainer, doc)).toBe(true);

        const fronts = sbNode.children.filter((c: any) => c.domainData?.role === 'FRONT');
        expect(fronts).toHaveLength(2);
        expect(fronts.map((f: any) => f.name).sort()).toEqual(['Drzwi_Skosne_Lewe', 'Drzwi_Skosne_Prawe']);

        // Weryfikacja nawierceń w bokach korpusu:
        const intents = buildSkosneDoorsDrillings(doc, sbContainer.parentContainerId);
        expect(intents.length).toBeGreaterThanOrEqual(4); // min. po 2 otwory na zawias po obu stronach

        const korpus = doc.getContainers()[0];
        const leftSide = korpus.children.find((c: any) => c.domainData?.role === 'LEFT_SIDE_PANEL');
        const rightSide = korpus.children.find((c: any) => c.domainData?.role === 'RIGHT_SIDE_PANEL');

        const leftIntents = intents.filter(i => i.targetNodeId === leftSide?.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightSide?.id);
        expect(leftIntents.length).toBeGreaterThan(0);
        expect(rightIntents.length).toBeGreaterThan(0);
    });

    it('drzwi skośne DOUBLE z niezależnym sterowaniem zawiasami generują odpowiednią liczbę nawierceń na lewym i prawym boku', () => {
        skosnyKorpus(1000, 2200);
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 500 })!;
        const opt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SKOSNE_DOORS')!;
        const sbNode = createBlokiGeneratorParamsProxy(bay, opt);
        const sbContainer = sbNode.domainData as any;

        // 4 zawiasy po lewej (indeksy 1..4 z pozycjami mieszczącymi się na boku 1000 mm), 2 zawiasy po prawej (1 i 6)
        sbContainer.generatorParams.rodzaj_drzwi = 'DOUBLE';
        sbContainer.generatorParams.szczelina_mm = 4;
        sbContainer.generatorParams.uzyj_zawias_lewy_1 = true;
        sbContainer.generatorParams.pozycja_zawias_lewy_1_mm = 100;
        sbContainer.generatorParams.uzyj_zawias_lewy_2 = true;
        sbContainer.generatorParams.pozycja_zawias_lewy_2_mm = 300;
        sbContainer.generatorParams.uzyj_zawias_lewy_3 = true;
        sbContainer.generatorParams.pozycja_zawias_lewy_3_mm = 500;
        sbContainer.generatorParams.uzyj_zawias_lewy_4 = true;
        sbContainer.generatorParams.pozycja_zawias_lewy_4_mm = 700;
        sbContainer.generatorParams.uzyj_zawias_lewy_5 = false;
        sbContainer.generatorParams.uzyj_zawias_lewy_6 = false;

        sbContainer.generatorParams.uzyj_zawias_prawy_1 = true;
        sbContainer.generatorParams.pozycja_zawias_prawy_1_mm = 120;
        sbContainer.generatorParams.uzyj_zawias_prawy_2 = false;
        sbContainer.generatorParams.uzyj_zawias_prawy_3 = false;
        sbContainer.generatorParams.uzyj_zawias_prawy_4 = false;
        sbContainer.generatorParams.uzyj_zawias_prawy_5 = false;
        sbContainer.generatorParams.uzyj_zawias_prawy_6 = true;
        sbContainer.generatorParams.pozycja_zawias_prawy_6_mm = 120;

        expect(update_bloki_core(sbContainer, doc)).toBe(true);

        const intents = buildSkosneDoorsDrillings(doc, sbContainer.parentContainerId);
        const korpus = doc.getContainers()[0];
        const leftSide = korpus.children.find((c: any) => c.domainData?.role === 'LEFT_SIDE_PANEL');
        const rightSide = korpus.children.find((c: any) => c.domainData?.role === 'RIGHT_SIDE_PANEL');

        const leftIntents = intents.filter(i => i.targetNodeId === leftSide?.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightSide?.id);

        // Standardowy prowadnik zawiasu generuje 2 otwory na zawias
        // Lewy bok: 4 zawiasy * 2 otwory = 8 otworów
        expect(leftIntents).toHaveLength(8);
        // Prawy bok: 2 zawiasy * 2 otwory = 4 otwory
        expect(rightIntents).toHaveLength(4);
    });

    function createBlokiGeneratorParamsProxy(bay: any, opt: any) {
        return createBlokInDetectedBay(doc, bay, opt)!;
    }
});