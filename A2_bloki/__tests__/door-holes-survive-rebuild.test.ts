import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { probeBayFromCADPoint } from '../02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../02_bloki-bay-actions.js';
import { registerBlokiModule } from '../01_register.js';
import { ContainerModel } from '../../A1_core/container-model.js';

function doorHoleCounts(doc: ProjectDocument): number[] {
    return doc.getPanels()
        .map((n) => n.domainData as any)
        .filter((d) => /SIDE/.test(String(d.role || '')))
        .map((d) => (d.features || []).filter((f: any) => f.params?.isDoorDrilling).length);
}

describe('Otwory zawiasow drzwi przezywaja przebudowe korpusu', () => {
    beforeEach(() => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
        registerBlokiModule();
    });

    it('SyncSkosneDoorsDrillingsCommand nie kasuje otworow zwyklych drzwi po zmianie wymiaru korpusu', () => {
        const doc = ContextManager.instance.document as ProjectDocument;
        const cabinet = doc.createAssembly({ name: 'Szafa' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        const opt = BLOKI_INTERNAL_OPTIONS.find((o) => o.id === 'DOORS')!;
        createBlokInDetectedBay(doc, bay, opt, { rodzaj_drzwi: 'DOUBLE' });
        const before = doorHoleCounts(doc);
        expect(before.every((n) => n > 0)).toBe(true);

        runEngineAndApply(cabinet, 900, 2000, 600, 1, 0, 0, 0);
        expect(doorHoleCounts(doc)).toEqual(before);
    });

    it('ukrycie bloku drzwi (visible=false) nie usuwa otworow zawiasow z bokow, a zamrozenie (frozen=true) je usuwa', () => {
        const doc = ContextManager.instance.document as ProjectDocument;
        const cabinet = doc.createAssembly({ name: 'Szafa' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        const opt = BLOKI_INTERNAL_OPTIONS.find((o) => o.id === 'DOORS')!;
        const sbNode = createBlokInDetectedBay(doc, bay, opt, { rodzaj_drzwi: 'DOUBLE' })!;
        const sbContainer = sbNode.domainData as ContainerModel;
        const initialCounts = doorHoleCounts(doc);
        expect(initialCounts.every((n) => n > 0)).toBe(true);

        // 1. Ukrycie bloku (np. zeby zajrzec do wnetrza szafki) -> otwory zostaja!
        sbContainer.visible = false;
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);
        expect(doorHoleCounts(doc)).toEqual(initialCounts);

        // 2. Zamrozenie bloku -> otwory sa usuwane z bokow
        sbContainer.frozen = true;
        sbNode.frozen = true;
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);
        expect(doorHoleCounts(doc)).toEqual([0, 0]);
    });
});
