import { describe, it, expect, beforeEach } from 'vitest';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { probeBayFromCADPoint } from '../smartbox-bay-detector.js';
import { createSmartBoxInDetectedBay } from '../smartbox-bay-actions.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { registerSmartBoxModule } from '../register.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { cadMatrixToRenderMatrix } from '../../A1_core/cad-math/coord-system.js';

describe('SmartBox bay placement & dimensions verification', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
        registerSmartBoxModule();
    });

    it('creates SmartBox with exact dimensions and position matching clear opening in 1-zone cabinet', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 1-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        expect(bay).not.toBeNull();
        expect(bay.boundsMm.width).toBeCloseTo(764, 0); // 800 - 2*18
        expect(bay.boundsMm.height).toBeCloseTo(1964, 0); // 2000 - 2*18
        expect(bay.boundary.bottom.planeCoordMm).toBeCloseTo(18, 0);
        expect(bay.boundary.top.planeCoordMm).toBeCloseTo(1982, 0);

        const sbNode = createSmartBoxInDetectedBay(doc, bay, { id: 'SHELVES', type: 'smartbox_shelves', category: 'internal', label: 'Półki', icon: '📚', description: 'Półki' })!;
        const sbContainer = sbNode.domainData as any;

        // Wymiary kontenera SmartBox muszą ściśle odpowiadać światłu wnęki (ani 1 mm w głąb formatek)
        expect(nmToMm(sbContainer.width)).toBeCloseTo(764, 0);
        expect(nmToMm(sbContainer.height)).toBeCloseTo(1964, 0);

        // Pozycja lokalna kontenera Z=0 musi zaczynać się na górnym licu wieńca dolnego (Z=18 mm)
        const sbPos = sbNode.localMatrix.decompose().translation;
        expect(nmToMm(sbPos.x)).toBeCloseTo(0, 0);
        expect(nmToMm(sbPos.z)).toBeCloseTo(18, 0);
        // Przód szafy musi być na -300 mm
        expect(bay.boundary.front.planeCoordMm).toBeCloseTo(-300, 0);
        expect(nmToMm(sbPos.y)).toBeCloseTo(0, 0);
        expect(nmToMm(sbContainer.depth)).toBeGreaterThanOrEqual(580);
    });

    it('correctly calculates front reference (-300 mm) and depth in a 2-segment cabinet for bottom and top sections', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 2-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 2 };
        // Wysokość strefy B = 450 mm (< głębokość 600 mm), strefa T = 1550 mm
        runEngineAndApply(cabinet, mmToNm(900), mmToNm(2000), mmToNm(600), 2, mmToNm(450), 0, 0);

        // Strefa Dolna B (H = 450 mm, Z od 0 do 450)
        const bayB = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 220 })!;
        expect(bayB).not.toBeNull();
        expect(bayB.boundary.front.planeCoordMm).toBeCloseTo(-300, 0);
        expect(bayB.boundsMm.depth).toBeGreaterThanOrEqual(580);

        const sbNodeB = createSmartBoxInDetectedBay(doc, bayB, { id: 'SHELVES', type: 'smartbox_shelves', category: 'internal', label: 'Półki B', icon: '📚', description: 'Półki B' })!;
        expect(sbNodeB).not.toBeNull();
        const sbDataB = sbNodeB.domainData as any;
        expect(nmToMm(sbDataB.depth)).toBeGreaterThanOrEqual(580);

        // Półki w sekcji dolnej muszą zaczynać się od lica szafy (-300 mm)
        const shelfPart = sbNodeB.children[0];
        expect(shelfPart).toBeDefined();

        // Strefa Górna T (H = 1550 mm, Z od 450 do 2000)
        const bayT = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1200 })!;
        expect(bayT).not.toBeNull();
        expect(bayT.boundary.front.planeCoordMm).toBeCloseTo(-300, 0);
        expect(bayT.boundsMm.depth).toBeGreaterThanOrEqual(580);

        const sbNodeT = createSmartBoxInDetectedBay(doc, bayT, { id: 'SHELVES', type: 'smartbox_shelves', category: 'internal', label: 'Półki T', icon: '📚', description: 'Półki T' })!;
        expect(sbNodeT).not.toBeNull();
        const sbDataT = sbNodeT.domainData as any;
        expect(nmToMm(sbDataT.depth)).toBeGreaterThanOrEqual(580);
    });

    it('probes and calculates correct dimensions and Z positions for each zone in a 3-zone cabinet', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 3-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 3 };
        runEngineAndApply(cabinet, mmToNm(1000), mmToNm(2400), mmToNm(600), 3, mmToNm(500), mmToNm(1200), 0);

        // Strefa B (Dolna, H=500, Z od 0 do 500)
        const bayB = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 250 })!;
        expect(bayB).not.toBeNull();
        expect(bayB.boundsMm.width).toBeCloseTo(964, 0); // 1000 - 2*18
        expect(bayB.boundsMm.height).toBeCloseTo(464, 0); // 500 - 2*18
        expect(bayB.boundary.bottom.planeCoordMm).toBeCloseTo(18, 0);
        expect(bayB.boundary.top.planeCoordMm).toBeCloseTo(482, 0);
        expect(bayB.boundary.front.planeCoordMm).toBeCloseTo(-300, 0);

        const sbNodeB = createSmartBoxInDetectedBay(doc, bayB, { id: 'SHELVES', type: 'smartbox_shelves', category: 'internal', label: 'Półki B', icon: '📚', description: 'Półki B' })!;
        expect(nmToMm((sbNodeB.domainData as any).width)).toBeCloseTo(964, 0);
        expect(nmToMm((sbNodeB.domainData as any).height)).toBeCloseTo(464, 0);
        expect(nmToMm((sbNodeB.domainData as any).depth)).toBeGreaterThanOrEqual(580);
        expect(nmToMm(sbNodeB.localMatrix.decompose().translation.z)).toBeCloseTo(18, 0);

        // Strefa M (Środkowa, H=1200, Z od 500 do 1700)
        const bayM = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1100 })!;
        expect(bayM).not.toBeNull();
        expect(bayM.boundsMm.width).toBeCloseTo(964, 0);
        expect(bayM.boundsMm.height).toBeCloseTo(1164, 0); // 1200 - 2*18 (wieniec dolny i górny strefy M)
        expect(bayM.boundary.bottom.planeCoordMm).toBeCloseTo(518, 0);
        expect(bayM.boundary.top.planeCoordMm).toBeCloseTo(1682, 0);
        expect(bayM.boundary.front.planeCoordMm).toBeCloseTo(-300, 0);

        const sbNodeM = createSmartBoxInDetectedBay(doc, bayM, { id: 'SHELVES', type: 'smartbox_shelves', category: 'internal', label: 'Półki M', icon: '📚', description: 'Półki M' })!;
        expect(nmToMm((sbNodeM.domainData as any).width)).toBeCloseTo(964, 0);
        expect(nmToMm((sbNodeM.domainData as any).height)).toBeCloseTo(1164, 0);
        expect(nmToMm((sbNodeM.domainData as any).depth)).toBeGreaterThanOrEqual(580);
        expect(nmToMm(sbNodeM.localMatrix.decompose().translation.z)).toBeCloseTo(518, 0);

        // Strefa T (Górna, H=700, Z od 1700 do 2400)
        const bayT = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 2050 })!;
        expect(bayT).not.toBeNull();
        expect(bayT.boundsMm.width).toBeCloseTo(964, 0);
        expect(bayT.boundsMm.height).toBeCloseTo(664, 0); // 700 - 2*18
        expect(bayT.boundary.bottom.planeCoordMm).toBeCloseTo(1718, 0);
        expect(bayT.boundary.top.planeCoordMm).toBeCloseTo(2382, 0);
        expect(bayT.boundary.front.planeCoordMm).toBeCloseTo(-300, 0);

        const sbNodeT = createSmartBoxInDetectedBay(doc, bayT, { id: 'SHELVES', type: 'smartbox_shelves', category: 'internal', label: 'Półki T', icon: '📚', description: 'Półki T' })!;
        expect(nmToMm((sbNodeT.domainData as any).width)).toBeCloseTo(964, 0);
        expect(nmToMm((sbNodeT.domainData as any).height)).toBeCloseTo(664, 0);
        expect(nmToMm((sbNodeT.domainData as any).depth)).toBeGreaterThanOrEqual(580);
        expect(nmToMm(sbNodeT.localMatrix.decompose().translation.z)).toBeCloseTo(1718, 0);
    });

    it('correctly places SmartBox dividers directly on top of an inserted SmartBox wieniec (shelf)', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 1-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        // 1. Wstawiamy pierwszy SmartBox: Wieniec (SHELF) z offset_bottom = 100 mm
        const bay1 = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        expect(bay1).not.toBeNull();
        const shelfSbNode = createSmartBoxInDetectedBay(doc, bay1, {
            id: 'SHELF',
            type: 'smartbox_shelf',
            category: 'internal',
            label: 'Wieniec'
        }, { offset_bottom: 100, offsetBottom: 100 })!;
        expect(shelfSbNode).not.toBeNull();

        // Sprawdzamy pozycję wieńca:
        // Spód kontenera SmartBox Wieniec = 18 mm (na dnie szafy)
        // Wieniec w środku: offset_bottom = 100 mm, thickness = 18 mm.
        // Środek wieńca Z = 100 + 9 = 109 mm (lokalnie).
        // W szafie: Z_środka = 18 + 109 = 127 mm.
        // Górne lico wieńca = 127 + 9 = 136 mm.
        const shelfPanelNode = shelfSbNode.children.find(c => c.name.includes('Wieniec'))!;
        expect(shelfPanelNode).toBeDefined();

        // 2. Wnęka NAD wieńcem (bottomRef to formatka wieńca)
        const bayAbove: any = {
            boundsMm: { width: 764, height: 1982 - 136, depth: 580 },
            boundsNm: { width: mmToNm(764), height: mmToNm(1982 - 136), depth: mmToNm(580) },
            centerWorldMm: { x: 0, y: 0, z: (136 + 1982) / 2 },
            parentCabinetId: cabinet.id,
            boundary: {
                left: { ...bay1.boundary.left },
                right: { ...bay1.boundary.right },
                bottom: { nodeId: shelfPanelNode.id, nodeName: shelfPanelNode.name, face: 'FACE_Z_PLUS', worldPointMm: { x: 0, y: 0, z: 136 }, planeCoordMm: 136 },
                top: { ...bay1.boundary.top },
                back: { ...bay1.boundary.back },
                front: { ...bay1.boundary.front },
                frontPlaneYMm: -300
            }
        };

        // 3. Wstawiamy Przegrody (DIVIDERS)
        const dividersNode = createSmartBoxInDetectedBay(doc, bayAbove, {
            id: 'DIVIDERS',
            type: 'smartbox_dividers',
            category: 'internal',
            label: 'Przegrody'
        })!;
        expect(dividersNode).not.toBeNull();

        const dividersContainer = dividersNode.domainData as any;
        const divPos = dividersNode.localMatrix.decompose().translation;

        // Kluczowa weryfikacja: kontener Przegród MUSI zaczynać się dokładnie na górnym licu wieńca (Z = 136 mm)
        // a NIE 18-20 mm pod nim (Z = 118 mm)!
        expect(nmToMm(divPos.z)).toBeCloseTo(136, 0);
        expect(nmToMm(dividersContainer.height)).toBeCloseTo(1982 - 136, 0);
    });

    it('correctly resolves left and right divider boundaries and faces when placing a shelf in the middle bay between 2 dividers', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 1-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const bay1 = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        expect(bay1).not.toBeNull();

        // 1. Wstawiamy 2 przegrody (3 przestrzenie pionowe)
        const dividersNode = createSmartBoxInDetectedBay(doc, bay1, {
            id: 'DIVIDERS',
            type: 'smartbox_dividers',
            category: 'internal',
            label: 'Przegrody'
        }, { count: 2, dividerCount: 2 })!;
        expect(dividersNode).not.toBeNull();

        // 2. Próbkujemy punkt w środkowej przestrzeni (X=0, y=0, z=1000)
        const middleBay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 });
        expect(middleBay).not.toBeNull();
        expect(middleBay!.boundary.left.nodeName).toContain('Przegroda_1');
        expect(middleBay!.boundary.left.face).toBe('FACE_Z_MINUS'); // Prawa ściana lewej przegrody (+X)
        expect(middleBay!.boundary.right.nodeName).toContain('Przegroda_2');
        expect(middleBay!.boundary.right.face).toBe('FACE_Z_PLUS'); // Lewa ściana prawej przegrody (-X)

        const expectedBayWidth = (764 - 2 * 18) / 3; // 242.67 mm
        expect(middleBay!.boundsMm.width).toBeCloseTo(expectedBayWidth, 0);

        // 3. Wstawiamy Wieniec (SHELF) do środkowej wnęki
        const shelfNode = createSmartBoxInDetectedBay(doc, middleBay!, {
            id: 'SHELF',
            type: 'smartbox_shelf',
            category: 'internal',
            label: 'Wieniec'
        }, { offset_bottom: 200, offsetBottom: 200 })!;
        expect(shelfNode).not.toBeNull();

        const shelfContainer = shelfNode.domainData as any;
        const shelfPos = shelfNode.localMatrix.decompose().translation;

        // Sprawdzamy szerokość wieńca i wycentrowanie w środkowej wnęce (X=0)
        expect(nmToMm(shelfContainer.width)).toBeCloseTo(expectedBayWidth, 0);
        expect(nmToMm(shelfPos.x)).toBeCloseTo(0, 0);

        // Krawędzie wieńca muszą idealnie dotykać wewnętrznych ścian przegród (ani 1 mm wcięcia w przegrody)
        const shelfLeftEdge = nmToMm(shelfPos.x) - nmToMm(shelfContainer.width) / 2;
        const shelfRightEdge = nmToMm(shelfPos.x) + nmToMm(shelfContainer.width) / 2;
        expect(shelfLeftEdge).toBeCloseTo(-expectedBayWidth / 2, 0);
        expect(shelfRightEdge).toBeCloseTo(expectedBayWidth / 2, 0);
    });
});
