import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { probeBayFromCADPoint } from '../bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../bloki-bay-actions.js';
import { registerBlokiModule } from '../register.js';
import { resolveCarcassRoofAngle, resolveCarcassRails } from '../skosne-doors-adapter.js';
import { update_bloki_core } from '../bloki-core.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

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
        const rise = 14 * cosBeta;
        const xL = -bay.boundsMm.width / 2 - 16;
        const xP = +bay.boundsMm.width / 2 + 16;

        expect(outline[3][1]).toBeCloseTo(bay.boundsMm.height + xL * tanBeta + 15 + rise, 6);
        expect(outline[2][1]).toBeCloseTo(bay.boundsMm.height + xP * tanBeta + 15 + rise, 6);
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

    function createBlokiGeneratorParamsProxy(bay: any, opt: any) {
        return createBlokInDetectedBay(doc, bay, opt)!;
    }
});