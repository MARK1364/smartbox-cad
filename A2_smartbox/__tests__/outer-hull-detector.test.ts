import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { detectCabinetOuterHull, probeBayFromCADPoint } from '../smartbox-bay-detector.js';
import { SmartBoxBayController } from '../smartbox-bay-controller.js';
import { createSmartBoxInDetectedBay } from '../smartbox-bay-actions.js';
import { registerSmartBoxModule } from '../register.js';

describe('SmartBox Outer Hull Detector & External Insertion Tool', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
        registerSmartBoxModule();
    });

    it('detectCabinetOuterHull returns the full outer bounding box (W x H x D)', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 800x2000x600' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        // Wykrycie zewnętrznego gabarytu korpusu
        const outerBay = detectCabinetOuterHull(doc, cabinet.id);

        expect(outerBay).not.toBeNull();
        // Zewnętrzna szerokość to pełne 800 mm (a nie wewnętrzne 764 mm)
        expect(outerBay!.boundsMm.width).toBeCloseTo(800, 0);
        // Zewnętrzna wysokość to pełne 2000 mm (a nie wewnętrzne 1964 mm)
        expect(outerBay!.boundsMm.height).toBeCloseTo(2000, 0);
        // Zewnętrzna głębokość to pełne 600 mm
        expect(outerBay!.boundsMm.depth).toBeCloseTo(600, 0);

        // Ściany referencyjne dla boków to lica zewnętrzne (FACE_Z_MINUS)
        expect(outerBay!.boundary.left.face).toBe('FACE_Z_MINUS');
        expect(outerBay!.boundary.right.face).toBe('FACE_Z_MINUS');
        expect(outerBay!.boundary.left.planeCoordMm).toBeCloseTo(-400, 0);
        expect(outerBay!.boundary.right.planeCoordMm).toBeCloseTo(400, 0);
    });

    it('SmartBoxBayController supports both internal and external picker and drag modes', () => {
        const controller = new SmartBoxBayController();
        const listener = vi.fn();
        controller.subscribePicker(listener);

        // 1. Domyślny start dla wnęki (internal bez typu -> domyślnie EMPTY)
        controller.startPicker(undefined, 'internal');
        expect(controller.isPickerActive).toBe(true);
        expect(controller.pickerMode).toBe('internal');
        expect(controller.pendingSmartBoxType).toBe('EMPTY');
        expect(listener).toHaveBeenCalledWith(true, 'internal');

        // 2. Przełączenie na tryb zewnętrzny (external bez typu -> domyślnie PANELS)
        controller.startPicker(undefined, 'external');
        expect(controller.isPickerActive).toBe(true);
        expect(controller.pickerMode).toBe('external');
        expect(controller.pendingSmartBoxType).toBe('PANELS');
        expect(listener).toHaveBeenCalledWith(true, 'external');

        // 3. Drag & drop w trybie zewnętrznym
        controller.startDrag('PANELS', 'external');
        expect(controller.isBayDrag()).toBe(true);
        expect(controller.draggedSmartBoxType).toBe('PANELS');
        expect(controller.pickerMode).toBe('external');

        controller.endDrag();
        expect(controller.isBayDrag()).toBe(false);

        // 4. Drag & drop domyślny dla wnęki -> EMPTY
        controller.startDrag();
        expect(controller.isBayDrag()).toBe(true);
        expect(controller.draggedSmartBoxType).toBe('EMPTY');
        expect(controller.pickerMode).toBe('internal');
        controller.endDrag();
    });

    it('creates PANELS SmartBox on outer hull with correct references and outer bounds', () => {
        const cabinet = doc.createContainer({ name: 'Korpus Blendy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const outerBay = detectCabinetOuterHull(doc, cabinet.id)!;
        expect(outerBay).toBeDefined();

        const sbNode = createSmartBoxInDetectedBay(doc, outerBay, {
            id: 'PANELS',
            type: 'smartbox_panels',
            label: 'Blendy',
            category: 'external',
            icon: '📦',
            description: 'Blendy i obudowa zewnętrzna'
        });

        expect(sbNode).not.toBeNull();
        const sbData = sbNode!.domainData as any;
        expect(sbData.generatorParams.boxType).toBe('PANELS');
        expect(sbData.generatorParams.side_references_smartbox).toBe('OUTER');
        expect(sbData.generatorParams.targetZone).toBe('FULL');
        expect(sbData.generatorParams.customReferences.xMin.face).toBe('FACE_Z_MINUS');
        expect(sbData.generatorParams.customReferences.xMax.face).toBe('FACE_Z_MINUS');
        expect(nmToMm(sbData.width)).toBeCloseTo(800, 0);
        expect(nmToMm(sbData.height)).toBeCloseTo(2000, 0);
        expect(nmToMm(sbData.depth)).toBeGreaterThanOrEqual(600);
    });
});
