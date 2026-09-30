import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { detectCabinetOuterHull, probeBayFromCADPoint } from '../bloki-bay-detector.js';
import { BlokiBayController } from '../bloki-bay-controller.js';
import { createBlokInDetectedBay } from '../bloki-bay-actions.js';
import { registerBlokiModule } from '../register.js';
import { ContainerModel } from '../../A1_core/container-model.js';

describe('Bloki Outer Hull Detector & External Insertion Tool', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
        registerBlokiModule();
    });

    it('detectCabinetOuterHull returns the full outer bounding box (W x H x D)', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus 800x2000x600' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        // Wykrycie zewnÄ™trznego gabarytu korpusu
        const outerBay = detectCabinetOuterHull(doc, cabinet.id);

        expect(outerBay).not.toBeNull();
        // ZewnÄ™trzna szerokoĹ›Ä‡ to peĹ‚ne 800 mm (a nie wewnÄ™trzne 764 mm)
        expect(outerBay!.boundsMm.width).toBeCloseTo(800, 0);
        // ZewnÄ™trzna wysokoĹ›Ä‡ to peĹ‚ne 2000 mm (a nie wewnÄ™trzne 1964 mm)
        expect(outerBay!.boundsMm.height).toBeCloseTo(2000, 0);
        // ZewnÄ™trzna gĹ‚Ä™bokoĹ›Ä‡ to peĹ‚ne 600 mm
        expect(outerBay!.boundsMm.depth).toBeCloseTo(600, 0);

        // Ĺšciany referencyjne dla bokĂłw to lica zewnÄ™trzne (FACE_Z_MINUS)
        expect(outerBay!.boundary.left.face).toBe('FACE_Z_MINUS');
        expect(outerBay!.boundary.right.face).toBe('FACE_Z_MINUS');
        expect(outerBay!.boundary.left.planeCoordMm).toBeCloseTo(-400, 0);
        expect(outerBay!.boundary.right.planeCoordMm).toBeCloseTo(400, 0);
    });

    it('BlokiBayController supports both internal and external picker and drag modes', () => {
        const controller = new BlokiBayController();
        const listener = vi.fn();
        controller.subscribePicker(listener);

        // 1. DomyĹ›lny start dla wnÄ™ki (internal bez typu -> domyĹ›lnie EMPTY)
        controller.startPicker(undefined, 'internal');
        expect(controller.isPickerActive).toBe(true);
        expect(controller.pickerMode).toBe('internal');
        expect(controller.pendingBlokType).toBe('EMPTY');
        expect(listener).toHaveBeenCalledWith(true, 'internal');

        // 2. PrzeĹ‚Ä…czenie na tryb zewnÄ™trzny (external bez typu -> domyĹ›lnie PANELS)
        controller.startPicker(undefined, 'external');
        expect(controller.isPickerActive).toBe(true);
        expect(controller.pickerMode).toBe('external');
        expect(controller.pendingBlokType).toBe('PANELS');
        expect(listener).toHaveBeenCalledWith(true, 'external');

        // 3. Drag & drop w trybie zewnÄ™trznym
        controller.startDrag('PANELS', 'external');
        expect(controller.isBayDrag()).toBe(true);
        expect(controller.draggedBlokType).toBe('PANELS');
        expect(controller.pickerMode).toBe('external');

        controller.endDrag();
        expect(controller.isBayDrag()).toBe(false);

        // 4. Drag & drop domyĹ›lny dla wnÄ™ki -> EMPTY
        controller.startDrag();
        expect(controller.isBayDrag()).toBe(true);
        expect(controller.draggedBlokType).toBe('EMPTY');
        expect(controller.pickerMode).toBe('internal');
        controller.endDrag();
    });

    it('creates PANELS Bloki on outer hull with correct references and outer bounds', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus Blendy' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const outerBay = detectCabinetOuterHull(doc, cabinet.id)!;
        expect(outerBay).toBeDefined();

        const sbNode = createBlokInDetectedBay(doc, outerBay, {
            id: 'PANELS',
            type: 'blok_panels',
            label: 'Blendy',
            category: 'external',
            icon: 'đź“¦',
            description: 'Blendy i obudowa zewnÄ™trzna'
        });

        expect(sbNode).not.toBeNull();
        const sbData = sbNode!.domainData as any;
        expect(sbData.generatorParams.boxType).toBe('PANELS');
        expect(sbData.generatorParams.side_references_bloki).toBe('OUTER');
        expect(sbData.generatorParams.targetZone).toBe('FULL');
        expect(sbData.generatorParams.customReferences.xMin.face).toBe('FACE_Z_MINUS');
        expect(sbData.generatorParams.customReferences.xMax.face).toBe('FACE_Z_MINUS');
        expect(nmToMm(sbData.width)).toBeCloseTo(800, 0);
        expect(nmToMm(sbData.height)).toBeCloseTo(2000, 0);
        expect(nmToMm(sbData.depth)).toBeGreaterThanOrEqual(600);
    });
});
