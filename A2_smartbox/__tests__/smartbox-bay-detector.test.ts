import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { probeBayFromCADPoint } from '../smartbox-bay-detector.js';
import { createSmartBoxInDetectedBay } from '../smartbox-bay-actions.js';
import { registerSmartBoxModule } from '../register.js';
import { highlightBayInScene, clearBayHighlight } from '../smartbox-bay-visualizer.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';

describe('SmartBox Bay Detector (3D Geometric Probe)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
        registerSmartBoxModule();
    });

    it('detects 1-zone cabinet interior bay from central probe point', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 1-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        // Punkt w środku wnęki korpusu: X=0, Y=0, Z=1000 mm
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 });

        expect(bay).not.toBeNull();
        expect(bay!.boundsMm.width).toBeCloseTo(764, 0); // 800 - 2*18
        expect(bay!.boundsMm.height).toBeCloseTo(1964, 0); // 2000 - 2*18
        expect(bay!.boundsMm.depth).toBeGreaterThan(500);

        expect(bay!.boundary.left.nodeName).toContain('Bok_L');
        expect(bay!.boundary.right.nodeName).toContain('Bok_P');
        expect(bay!.boundary.bottom.nodeName).toBeDefined();
        expect(bay!.boundary.top.nodeName).toBeDefined();
    });

    it('detects distinct bays for each zone in a 3-zone cabinet', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 3-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 3 };
        runEngineAndApply(
            cabinet,
            mmToNm(1000),
            mmToNm(2400),
            mmToNm(600),
            3,
            mmToNm(600),
            mmToNm(1200),
            0
        );

        // Strefa B: Z od 0 do 600 mm -> punkt na Z = 300 mm
        const bayB = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 300 });
        expect(bayB).not.toBeNull();
        expect(bayB!.boundary.left.nodeName).toContain('Dol_Bok_L');
        expect(bayB!.boundary.right.nodeName).toContain('Dol_Bok_P');

        // Strefa M: Z od 600 do 1800 mm -> punkt na Z = 1200 mm
        const bayM = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1200 });
        expect(bayM).not.toBeNull();
        expect(bayM!.boundary.left.nodeName).toContain('Srodek_Bok_L');
        expect(bayM!.boundary.right.nodeName).toContain('Srodek_Bok_P');

        // Strefa T: Z od 1800 do 2400 mm -> punkt na Z = 2100 mm
        const bayT = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 2100 });
        expect(bayT).not.toBeNull();
        expect(bayT!.boundary.left.nodeName).toContain('Gora_Bok_L');
        expect(bayT!.boundary.right.nodeName).toContain('Gora_Bok_P');
    });

    it('creates SmartBox with exact bay boundaries and references', () => {
        const cabinet = doc.createContainer({ name: 'Korpus' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        expect(bay).toBeDefined();

        const sbNode = createSmartBoxInDetectedBay(doc, bay, {
            id: 'SHELVES',
            type: 'smartbox_shelves',
            label: 'Półki',
            icon: '📚',
            description: 'Półki z nawiertami'
        });

        expect(sbNode).not.toBeNull();
        const sbData = sbNode!.domainData as any;
        expect(sbData.name).toBeDefined();
        expect(sbData.generatorParams.boxType).toBe('SHELVES');
        expect(sbData.generatorParams.boundary).toBeDefined();
        expect(sbData.generatorParams.boundary.left.nodeId).toBe(bay.boundary.left.nodeId);
    });

    it('detects bay depth equal to full cabinet depth even when zone height (500mm) is smaller than depth (600mm)', () => {
        const cabinet = doc.createContainer({ name: 'Korpus Niski Dół' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 3 };
        // Wysokość strefy B = 500 mm, głębokość = 600 mm (500 < 600)
        runEngineAndApply(
            cabinet,
            mmToNm(1000),
            mmToNm(2200),
            mmToNm(600),
            3,
            mmToNm(500),
            mmToNm(1200),
            0
        );

        // Punkt w strefie dolnej: Z = 250 mm
        const bayB = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 250 });
        expect(bayB).not.toBeNull();
        // Głębokość wnęki musi być pełna (~600 mm lub ~580-597 mm z plecami), a NIE obcięta do 500 mm!
        expect(bayB!.boundsMm.depth).toBeGreaterThanOrEqual(580);
        // Lico przodu musi być na poziomie -300 mm (a nie -250 mm!)
        expect(bayB!.boundary.frontPlaneYMm).toBeCloseTo(-300, 0);
    });

    it('computes correct local TRS when cabinet is translated and supports Undo via CommandHistory', () => {
        const cmdHist = new CommandHistory(doc);
        ContextManager.instance.commandHistory = cmdHist;

        const cabinet = doc.createContainer({ name: 'Przesunięty Korpus' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        // Przesuwamy cały korpus o X = 1500 mm w scenie
        const cabNode = doc.findNode(cabinet.id)!;
        cabNode.setLocalTransform(new Vec3(mmToNm(1500), 0, 0), Quat.IDENTITY);

        // Punkt w środku wnęki przesuniętego korpusu: X=1500, Y=0, Z=1000 mm
        const bay = probeBayFromCADPoint(doc, { x: 1500, y: 0, z: 1000 })!;
        expect(bay).not.toBeNull();

        const sbNode = createSmartBoxInDetectedBay(doc, bay, {
            id: 'SHELVES',
            type: 'smartbox_shelves',
            label: 'Półki',
            icon: '📚',
            description: 'Półki z nawiertami'
        })!;

        expect(sbNode).not.toBeNull();
        // Pozycja lokalna SmartBoxa względem korpusu musi wynosić ~0 w X, a NIE 1500 mm!
        const localPos = sbNode.localMatrix.decompose().translation;
        expect(nmToMm(localPos.x)).toBeCloseTo(0, 0);
        const leftPanelNode = doc.findNode(bay.boundary.left.nodeId)!;
        const leftPanel = leftPanelNode.domainData as any;
        const countShelfHoles = () => leftPanel.features.filter((f: any) => f.params?.isShelfDrilling).length;

        expect(countShelfHoles()).toBeGreaterThan(0);

        // Test Undo w CommandHistory: węzeł usunięty + nawiercenia półek wyczyszczone
        expect(doc.findNode(sbNode.id)).not.toBeNull();
        cmdHist.undo();
        expect(doc.findNode(sbNode.id)).toBeNull();
        expect(countShelfHoles()).toBe(0);

        // Test Redo w CommandHistory: węzeł przywrócony + nawiercenia półek odtworzone
        cmdHist.redo();
        expect(doc.findNode(sbNode.id)).not.toBeNull();
        expect(countShelfHoles()).toBeGreaterThan(0);
    });

    it('associatively updates SmartBox dimensions when cabinet width changes', () => {
        const cabinet = doc.createContainer({ name: 'Szafa Asocjacyjna' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        expect(bay).not.toBeNull();

        const sbNode = createSmartBoxInDetectedBay(doc, bay, {
            id: 'SHELVES',
            type: 'smartbox_shelves',
            label: 'Półki',
            icon: '📚',
            description: 'Półki z nawiertami'
        })!;

        const sbContainer = sbNode.domainData as any;
        expect(nmToMm(sbContainer.width)).toBeCloseTo(764, 0);

        // Przebudowa szafy: zmiana szerokości z 800 mm na 1200 mm
        runEngineAndApply(cabinet, mmToNm(1200), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        // SmartBox powinien automatycznie rozszerzyć się do 1164 mm (1200 - 2 * 18)
        expect(nmToMm(sbContainer.width)).toBeCloseTo(1164, 0);

        // Półki wewnątrz SmartBoxa również muszą mieć nową szerokość (1164 mm - 1 mm luzu bocznego = 1163 mm)
        expect(sbNode.children.length).toBeGreaterThan(0);
        for (const child of sbNode.children) {
            const shelfModel = child.domainData as any;
            if (shelfModel && shelfModel.width) {
                expect(nmToMm(shelfModel.width)).toBeCloseTo(1163, 0);
            }
        }
    });

    it('creates bay volume preview in visualizer and clears on reset', () => {
        const cabinet = doc.createContainer({ name: 'Korpus Wizualizacja' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        expect(bay).not.toBeNull();

        let disposedCount = 0;
        const createdPlanes: any[] = [];

        // Global BABYLON mock
        (globalThis as any).BABYLON = {
            MeshBuilder: {
                CreatePlane: (name: string) => {
                    const plane = {
                        name,
                        position: { x: 0, y: 0, z: 0 },
                        rotation: { x: 0, y: 0 },
                        material: null,
                        isPickable: false,
                        renderOutline: false,
                        outlineColor: null,
                        outlineWidth: 0,
                        dispose: () => { disposedCount++; },
                        isDisposed: () => false
                    };
                    createdPlanes.push(plane);
                    return plane;
                }
            },
            StandardMaterial: class {
                diffuseColor: any;
                emissiveColor: any;
                alpha: number = 1;
                backFaceCulling: boolean = false;
            },
            Color3: class {
                constructor(public r: number, public g: number, public b: number) {}
            }
        };

        highlightBayInScene({} as any, bay);
        expect(createdPlanes.length).toBe(5); // bottom, top, left, right, back
        expect(createdPlanes.some(p => p.name === 'smartbox_plane_bottom')).toBe(true);
        expect(createdPlanes.some(p => p.name === 'smartbox_plane_left')).toBe(true);

        clearBayHighlight();
        expect(disposedCount).toBe(5);
    });

    it('detects bay bounded by custom manual panel (e.g. wall thickening) without role or specific naming', () => {
        const cabinet = doc.createContainer({ name: 'Korpus Z Pogrubieniem' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        // Dodajemy ręczną formatkę pogrubiającą lewy bok od środka
        // Lewy bok korpusu kończy się wewnątrz na X = -382 mm.
        // Formatka pogrubiająca (grubość 18 mm, głębokość 600 mm, wysokość 2000 mm)
        // jest umieszczona na X = -373 mm, więc jej lico wewnętrzne jest na X = -373 + 9 = -364 mm.
        const thickeningPanel = new PanelModel({
            name: 'Moje_Pogrubienie_Manualne',
            role: 'MANUAL_PANEL',
            width: mmToNm(2000),
            height: mmToNm(600),
            thickness: mmToNm(18)
        });
        const thickeningNode = CADNode.create(NodeType.PART, thickeningPanel.name, thickeningPanel.id);
        thickeningNode.domainData = thickeningPanel;
        thickeningNode.setLocalTransform(new Vec3(mmToNm(-373), 0, mmToNm(1000)), Quat.IDENTITY);
        doc.addNode(cabinet.id, thickeningNode);

        // Próbnik w środku wnęki: X=0, Y=0, Z=1000
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 });

        expect(bay).not.toBeNull();
        // Lewa ściana to pogrubienie, a nie oryginalny bok korpusu!
        expect(bay!.boundary.left.nodeId).toBe(thickeningNode.id);
        expect(bay!.boundary.left.nodeName).toBe('Moje_Pogrubienie_Manualne');
        expect(bay!.boundary.left.planeCoordMm).toBeCloseTo(-364, 0);

        // Szerokość wnęki wynosi teraz 746 mm zamiast 764 mm
        expect(bay!.boundsMm.width).toBeCloseTo(746, 0);

        // Wstawienie SmartBoxa
        const sbNode = createSmartBoxInDetectedBay(doc, bay!, {
            id: 'SHELVES',
            type: 'smartbox_shelves',
            label: 'Półki',
            icon: '📚',
            description: 'Półki z nawiertami'
        })!;

        expect(sbNode).not.toBeNull();
        const sbContainer = sbNode.domainData as any;
        expect(nmToMm(sbContainer.width)).toBeCloseTo(746, 0);
        expect(sbContainer.generatorParams.boundary.left.nodeId).toBe(thickeningNode.id);
    });
});
