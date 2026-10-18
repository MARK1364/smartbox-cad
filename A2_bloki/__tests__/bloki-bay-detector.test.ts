import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { probeBayFromCADPoint, probeBayFromSceneRay, isBayDividingPanel } from '../02_bloki-bay-detector.js';
import { createBlokInDetectedBay } from '../02_bloki-bay-actions.js';
import { registerBlokiModule } from '../01_register.js';
import { highlightBayInScene, clearBayHighlight } from '../02_bloki-bay-visualizer.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';

describe('Bloki Bay Detector (3D Geometric Probe)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
        registerBlokiModule();
    });

    it('detects 1-zone cabinet interior bay from central probe point', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus 1-strefowy' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        // Punkt w Ĺ›rodku wnÄ™ki korpusu: X=0, Y=0, Z=1000 mm
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
        const cabinet = doc.createAssembly({ name: 'Korpus 3-strefowy' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 3 };
        runEngineAndApply(
            cabinet,
            1000,
            2400,
            600,
            3,
            600,
            1200,
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

    it('creates Bloki with exact bay boundaries and references', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        expect(bay).toBeDefined();

        const sbNode = createBlokInDetectedBay(doc, bay, {
            id: 'SHELVES',
            type: 'blok_shelves',
            category: 'internal',
            label: 'PĂłĹ‚ki',
            icon: 'đź“š',
            description: 'PĂłĹ‚ki z nawiertami'
        });

        expect(sbNode).not.toBeNull();
        const sbData = sbNode!.domainData as any;
        expect(sbData.name).toBeDefined();
        expect(sbData.generatorParams.boxType).toBe('SHELVES');
        expect(sbData.generatorParams.boundary).toBeDefined();
        expect(sbData.generatorParams.boundary.left.nodeId).toBe(bay.boundary.left.nodeId);
    });

    it('detects bay depth equal to full cabinet depth even when zone height (500mm) is smaller than depth (600mm)', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus Niski DĂłĹ‚' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 3 };
        // WysokoĹ›Ä‡ strefy B = 500 mm, gĹ‚Ä™bokoĹ›Ä‡ = 600 mm (500 < 600)
        runEngineAndApply(
            cabinet,
            1000,
            2200,
            600,
            3,
            500,
            1200,
            0
        );

        // Punkt w strefie dolnej: Z = 250 mm
        const bayB = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 250 });
        expect(bayB).not.toBeNull();
        // GĹ‚Ä™bokoĹ›Ä‡ wnÄ™ki musi byÄ‡ peĹ‚na (~600 mm lub ~580-597 mm z plecami), a NIE obciÄ™ta do 500 mm!
        expect(bayB!.boundsMm.depth).toBeGreaterThanOrEqual(580);
        // Lico przodu musi byÄ‡ na poziomie -300 mm (a nie -250 mm!)
        expect(bayB!.boundary.frontPlaneYMm).toBeCloseTo(-300, 0);
    });

    it('computes correct local TRS when cabinet is translated and supports Undo via CommandHistory', () => {
        const cmdHist = new CommandHistory(doc);
        ContextManager.instance.commandHistory = cmdHist;

        const cabinet = doc.createAssembly({ name: 'PrzesuniÄ™ty Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        // Przesuwamy caĹ‚y korpus o X = 1500 mm w scenie
        const cabNode = doc.findNode(cabinet.id)!;
        cabNode.setLocalTransform(new Vec3(mmToNm(1500), 0, 0), Quat.IDENTITY);

        // Punkt w Ĺ›rodku wnÄ™ki przesuniÄ™tego korpusu: X=1500, Y=0, Z=1000 mm
        const bay = probeBayFromCADPoint(doc, { x: 1500, y: 0, z: 1000 })!;
        expect(bay).not.toBeNull();

        const sbNode = createBlokInDetectedBay(doc, bay, {
            id: 'SHELVES',
            type: 'blok_shelves',
            category: 'internal',
            label: 'PĂłĹ‚ki',
            icon: 'đź“š',
            description: 'PĂłĹ‚ki z nawiertami'
        })!;

        expect(sbNode).not.toBeNull();
        // Pozycja lokalna Bloku wzglÄ™dem korpusu musi wynosiÄ‡ ~0 w X, a NIE 1500 mm!
        const localPos = sbNode.localMatrix.decompose().translation;
        expect(nmToMm(localPos.x)).toBeCloseTo(0, 0);
        const leftPanelNode = doc.findNode(bay.boundary.left.nodeId)!;
        const leftPanel = leftPanelNode.domainData as any;
        const countShelfHoles = () => leftPanel.features.filter((f: any) => f.params?.isShelfDrilling).length;

        expect(countShelfHoles()).toBeGreaterThan(0);

        // Test Undo w CommandHistory: wÄ™zeĹ‚ usuniÄ™ty + nawiercenia pĂłĹ‚ek wyczyszczone
        expect(doc.findNode(sbNode.id)).not.toBeNull();
        cmdHist.undo();
        expect(doc.findNode(sbNode.id)).toBeNull();
        expect(countShelfHoles()).toBe(0);

        // Test Redo w CommandHistory: wÄ™zeĹ‚ przywrĂłcony + nawiercenia pĂłĹ‚ek odtworzone
        cmdHist.redo();
        expect(doc.findNode(sbNode.id)).not.toBeNull();
        expect(countShelfHoles()).toBeGreaterThan(0);
    });

    it('associatively updates Bloki dimensions when cabinet width changes', () => {
        const cabinet = doc.createAssembly({ name: 'Szafa Asocjacyjna' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        expect(bay).not.toBeNull();

        const sbNode = createBlokInDetectedBay(doc, bay, {
            id: 'SHELVES',
            type: 'blok_shelves',
            category: 'internal',
            label: 'PĂłĹ‚ki',
            icon: 'đź“š',
            description: 'PĂłĹ‚ki z nawiertami'
        })!;

        const sbContainer = sbNode.domainData as any;
        expect(nmToMm(sbContainer.width)).toBeCloseTo(764, 0);

        // Przebudowa szafy: zmiana szerokoĹ›ci z 800 mm na 1200 mm
        runEngineAndApply(cabinet, 1200, 2000, 600, 1, 0, 0, 0);

        // Bloki powinien automatycznie rozszerzyÄ‡ siÄ™ do 1164 mm (1200 - 2 * 18)
        expect(nmToMm(sbContainer.width)).toBeCloseTo(1164, 0);

        // PĂłĹ‚ki wewnÄ…trz Bloku rĂłwnieĹĽ muszÄ… mieÄ‡ nowÄ… szerokoĹ›Ä‡ (1164 mm - 1 mm luzu bocznego = 1163 mm)
        expect(sbNode.children.length).toBeGreaterThan(0);
        for (const child of sbNode.children) {
            const shelfModel = child.domainData as any;
            if (shelfModel && shelfModel.width) {
                expect(nmToMm(shelfModel.width)).toBeCloseTo(1163, 0);
            }
        }
    });

    it('creates bay volume preview in visualizer and clears on reset', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus Wizualizacja' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

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
                },
                CreateBox: (name: string) => {
                    const box = {
                        name,
                        position: { x: 0, y: 0, z: 0 },
                        material: null,
                        isPickable: false,
                        enableEdgesRendering: () => {},
                        dispose: () => { disposedCount++; },
                        isDisposed: () => false
                    };
                    createdPlanes.push(box);
                    return box;
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
            },
            Color4: class {
                constructor(public r: number, public g: number, public b: number, public a: number) {}
            }
        };

        highlightBayInScene({} as any, bay);
        expect(createdPlanes.length).toBe(7); // 1 volume box + 6 boundary planes
        expect(createdPlanes.some(p => p.name === 'blok_bay_volume')).toBe(true);
        expect(createdPlanes.some(p => p.name === 'blok_plane_bottom')).toBe(true);
        expect(createdPlanes.some(p => p.name === 'blok_plane_left')).toBe(true);

        clearBayHighlight();
        expect(disposedCount).toBe(7);
    });

    it('detects bay bounded by custom manual panel (e.g. wall thickening) without role or specific naming', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus Z Pogrubieniem' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        // Dodajemy rÄ™cznÄ… formatkÄ™ pogrubiajÄ…cÄ… lewy bok od Ĺ›rodka
        // Lewy bok korpusu koĹ„czy siÄ™ wewnÄ…trz na X = -382 mm.
        // Formatka pogrubiajÄ…ca (gruboĹ›Ä‡ 18 mm, gĹ‚Ä™bokoĹ›Ä‡ 600 mm, wysokoĹ›Ä‡ 2000 mm)
        // jest umieszczona na X = -373 mm, wiÄ™c jej lico wewnÄ™trzne jest na X = -373 + 9 = -364 mm.
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

        // PrĂłbnik w Ĺ›rodku wnÄ™ki: X=0, Y=0, Z=1000
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 });

        expect(bay).not.toBeNull();
        // Lewa Ĺ›ciana to pogrubienie, a nie oryginalny bok korpusu!
        expect(bay!.boundary.left.nodeId).toBe(thickeningNode.id);
        expect(bay!.boundary.left.nodeName).toBe('Moje_Pogrubienie_Manualne');
        expect(bay!.boundary.left.planeCoordMm).toBeCloseTo(-364, 0);

        // SzerokoĹ›Ä‡ wnÄ™ki wynosi teraz 746 mm zamiast 764 mm
        expect(bay!.boundsMm.width).toBeCloseTo(746, 0);

        // Wstawienie Bloku
        const sbNode = createBlokInDetectedBay(doc, bay!, {
            id: 'SHELVES',
            type: 'blok_shelves',
            category: 'internal',
            label: 'PĂłĹ‚ki',
            icon: 'đź“š',
            description: 'PĂłĹ‚ki z nawiertami'
        })!;

        expect(sbNode).not.toBeNull();
        const sbContainer = sbNode.domainData as any;
        expect(nmToMm(sbContainer.width)).toBeCloseTo(746, 0);
        expect(sbContainer.generatorParams.boundary.left.nodeId).toBe(thickeningNode.id);
    });

    it('ignores front hit from another cabinet and uses SmartFrame front plane (−D/2)', () => {
        // Korpus A (docelowa wnęka) — bez płyty frontowej
        const cabinetA = doc.createAssembly({ name: 'Korpus A' }) as ContainerModel;
        cabinetA.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinetA, 800, 2000, 600, 1, 0, 0, 0);

        // Korpus B stoi przed A (przesunięty w −Y) — jego tył „kradnie” raycast przodu
        const cabinetB = doc.createAssembly({ name: 'Korpus B Przed' }) as ContainerModel;
        cabinetB.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinetB, 800, 2000, 600, 1, 0, 0, 0);
        const nodeB = doc.findNode(cabinetB.id)!;
        nodeB.setLocalTransform(new Vec3(0, mmToNm(-900), 0), Quat.IDENTITY);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 });
        expect(bay).not.toBeNull();
        expect(bay!.parentCabinetId).toBe(cabinetA.id);
        // Przód z SmartFrame korpusu A (−300), nie z tyłu korpusu B (~−600)
        expect(bay!.boundary.frontPlaneYMm).toBeCloseTo(-300, 0);
        expect(bay!.boundary.front.nodeId).toBe(cabinetA.id);
        expect(bay!.boundary.front.nodeName).toBe('Przód Korpusu');
        expect(bay!.boundsMm.depth).toBeGreaterThanOrEqual(580);
    });

    it('verifies that bay depth spans full cabinet and doors/shelves are placed at cabinet front', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus Pelna Glebokosc' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 })!;
        expect(bay).not.toBeNull();

        // PrzĂłd to Y=-300 mm, TyĹ‚ to Y=+300 mm (dla backOffset=0), gĹ‚Ä™bokoĹ›Ä‡ wnÄ™ki 600 mm
        expect(bay.boundary.front.planeCoordMm).toBeCloseTo(-300, 0);
        expect(bay.boundary.back.planeCoordMm).toBeCloseTo(300, 0);
        expect(bay.boundsMm.depth).toBeCloseTo(600, 0);

        // 1. Wstawienie DRZWI (Front)
        const doorNode = createBlokInDetectedBay(doc, bay, {
            id: 'DOORS',
            type: 'blok_doors',
            category: 'internal',
            label: 'Drzwi',
            icon: 'đźšŞ'
        })!;
        expect(doorNode).not.toBeNull();
        const doorCADNode = doc.findNode(doorNode.id)!;
        expect(doorCADNode.children.length).toBeGreaterThan(0);
        const frontPartNode = doorCADNode.children[0];
        const frontModel = frontPartNode.domainData as PanelModel;
        expect(frontModel.role).toBe('FRONT');
        
        // Front musi byÄ‡ z przodu szafy (Y ~ -309 mm), a NIE w Ĺ›rodku (Y=0)
        const frontWorldY = nmToMm(frontPartNode.getWorldMatrix().decompose().translation.y);
        expect(frontWorldY).toBeLessThan(-290);

        // 2. Wstawienie PĂ“ĹEK (Shelves)
        const shelfNode = createBlokInDetectedBay(doc, bay, {
            id: 'SHELVES',
            type: 'blok_shelves',
            category: 'internal',
            label: 'PĂłĹ‚ki',
            icon: 'đź“š'
        })!;
        expect(shelfNode).not.toBeNull();
        const shelfCADNode = doc.findNode(shelfNode.id)!;
        expect(shelfCADNode.children.length).toBeGreaterThan(0);
        const shelfPartNode = shelfCADNode.children[0];
        const shelfModel = shelfPartNode.domainData as PanelModel;
        // GĹ‚Ä™bokoĹ›Ä‡ pĂłĹ‚ki to ~590 mm (600 - 10 mm odsadzenia), a nie 300 mm
        expect(nmToMm(shelfModel.height)).toBeGreaterThan(550);
    });

    it('wykrywa górną płaszczyznę SmartFrame w korpus_skosny (FACE_Z_MINUS, topZ = 2200, bez skosu w środku wieńca)', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus Skosny Przod' }) as ContainerModel;
        cabinet.generatorParams = {
            typ_korpusu: 'korpus_skosny',
            wysokosc_przod_mm: 2200,
            wysokosc_tyl_mm: 1000
        };
        runEngineAndApply(cabinet, 800, 2200, 600, 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 500 });
        expect(bay).not.toBeNull();
        expect(bay!.slopeAxis).toBeUndefined();
        expect(bay!.boundary.top.face).toBe('FACE_Z_MINUS');
        expect(bay!.boundary.top.nodeId).toBe(cabinet.id);
        expect(bay!.boundary.top.planeCoordMm).toBeCloseTo(2200, 0);
        expect(bay!.boundary.top.slopeAngleDeg).toBeUndefined();
    });

    it('probeBayFromSceneRay gracefully handles OUTLINE_SIDE_* and non-canonical face names without crashing', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus Skosny Test' }) as ContainerModel;
        cabinet.generatorParams = {
            typ_korpusu: 'korpus_skosny',
            wysokosc_przod_mm: 2200,
            wysokosc_tyl_mm: 1000
        };
        runEngineAndApply(cabinet, 800, 2200, 600, 1, 0, 0, 0);

        const prevBabylon = (globalThis as any).BABYLON;
        (globalThis as any).BABYLON = {
            Vector3: class {
                x: number; y: number; z: number;
                constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
                clone() { return new (globalThis as any).BABYLON.Vector3(this.x, this.y, this.z); }
                add(v: any) { return new (globalThis as any).BABYLON.Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
                subtract(v: any) { return new (globalThis as any).BABYLON.Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
                scale(s: number) { return new (globalThis as any).BABYLON.Vector3(this.x * s, this.y * s, this.z * s); }
                normalize() { return this; }
                length() { return Math.hypot(this.x, this.y, this.z); }
            },
            Ray: class {
                origin: any; direction: any; length: number;
                constructor(origin: any, direction: any, length = 1000) {
                    this.origin = origin; this.direction = direction; this.length = length;
                }
            }
        };

        try {
            const cabNode = doc.findNode(cabinet.id)!;
            const sidePanelL = cabNode.children.find(c => c.name.includes('Bok_L')) || cabNode.children[0];
            const sidePanelR = cabNode.children.find(c => c.name.includes('Bok_P')) || cabNode.children[1];
            const bottomPanel = cabNode.children.find(c => c.name.includes('Wieniec_D')) || cabNode.children[2];
            const topPanel = cabNode.children.find(c => c.name.includes('Wieniec_G')) || cabNode.children[3];

            const mockHit = (meshMeta: any, pt: { x: number; y: number; z: number }) => ({
                hit: true,
                pickedPoint: pt,
                pickedMesh: {
                    metadata: meshMeta,
                    id: meshMeta.panelModel?.id || 'm_id',
                    name: 'mesh_name',
                    isPickable: true,
                    isVisible: true,
                    getBoundingInfo: () => ({
                        boundingBox: {
                            minimumWorld: { z: -300 },
                            maximumWorld: { z: 300 }
                        }
                    })
                }
            });

            const fakeScene = {
                pickWithRay: (ray: any) => {
                    if (ray.direction.x < -0.5) {
                        return mockHit({ faceName: 'FACE_Z_PLUS', panelModel: sidePanelL }, { x: -382, y: 1000, z: 0 });
                    }
                    if (ray.direction.x > 0.5) {
                        return mockHit({ faceName: 'FACE_Z_PLUS', panelModel: sidePanelR }, { x: 382, y: 1000, z: 0 });
                    }
                    if (ray.direction.y < -0.5) {
                        return mockHit({
                            faceName: 'OUTLINE_SIDE_0',
                            outlineEdgeKey: '+Y',
                            panelModel: bottomPanel
                        }, { x: 0, y: 18, z: 0 });
                    }
                    if (ray.direction.y > 0.5) {
                        return mockHit({ faceName: 'FACE_Z_MINUS', panelModel: topPanel }, { x: 0, y: 2200, z: 0 });
                    }
                    if (ray.direction.z > 0.5) {
                        return mockHit({ faceName: 'FACE_Z_PLUS', panelModel: sidePanelL }, { x: 0, y: 1000, z: 280 });
                    }
                    if (ray.direction.z < -0.5) {
                        return mockHit({ faceName: 'FACE_Z_PLUS', panelModel: sidePanelL }, { x: 0, y: 1000, z: -280 });
                    }
                    return null;
                }
            };

            const pickResult = {
                hit: true,
                pickedPoint: new (globalThis as any).BABYLON.Vector3(0, 100, 0),
                getNormal: () => new (globalThis as any).BABYLON.Vector3(0, 1, 0)
            };

            const bay = probeBayFromSceneRay(fakeScene, pickResult, doc, 'internal');
            expect(bay).not.toBeNull();
            expect(bay!.boundary.bottom.face).toBe('FACE_Y_PLUS');
        } finally {
            (globalThis as any).BABYLON = prevBabylon;
        }
    });

    it('isBayDividingPanel correctly identifies dividing panels and rejects non-structural panels', () => {
        expect(isBayDividingPanel('DIVIDER_PLATE')).toBe(true);
        expect(isBayDividingPanel('VERTICAL_DIVIDER')).toBe(true);
        expect(isBayDividingPanel('SHELF_BOARD')).toBe(true);
        expect(isBayDividingPanel(undefined, 'Przegroda_1')).toBe(true);
        expect(isBayDividingPanel(undefined, 'Wieniec_konstrukcyjny')).toBe(true);

        expect(isBayDividingPanel('FRONT')).toBe(false);
        expect(isBayDividingPanel('SHELF_PANEL')).toBe(false);
        expect(isBayDividingPanel('HANDLE')).toBe(false);
    });

    it('probeBayFromSceneRay detects sub-bay bounded by a vertical divider (blok_dividers) instead of penetrating to the carcass side', () => {
        const prevBabylon = (globalThis as any).BABYLON;
        try {
            (globalThis as any).BABYLON = {
                Vector3: class {
                    x: number; y: number; z: number;
                    constructor(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; }
                    clone() { return new (globalThis as any).BABYLON.Vector3(this.x, this.y, this.z); }
                    add(v: any) { return new (globalThis as any).BABYLON.Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
                    subtract(v: any) { return new (globalThis as any).BABYLON.Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
                    scale(s: number) { return new (globalThis as any).BABYLON.Vector3(this.x * s, this.y * s, this.z * s); }
                    length() { return Math.hypot(this.x, this.y, this.z); }
                    normalize() { const l = this.length() || 1; return new (globalThis as any).BABYLON.Vector3(this.x / l, this.y / l, this.z / l); }
                },
                Ray: class {
                    origin: any; direction: any; length: number;
                    constructor(origin: any, direction: any, length: number) {
                        this.origin = origin; this.direction = direction; this.length = length;
                    }
                }
            };

            const cabinet = doc.createAssembly({ name: 'Korpus 1-strefowy' }) as ContainerModel;
            cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
            runEngineAndApply(cabinet, 1000, 2000, 600, 1, 0, 0, 0);

            const cabNode = doc.findNode(cabinet.id)!;
            const sidePanelL = cabNode.children.find(c => c.name.includes('Bok_L')) || cabNode.children[0];
            const sidePanelR = cabNode.children.find(c => c.name.includes('Bok_P')) || cabNode.children[1];
            const bottomPanel = cabNode.children.find(c => c.name.includes('Wieniec_D')) || cabNode.children[2];
            const topPanel = cabNode.children.find(c => c.name.includes('Wieniec_G')) || cabNode.children[3];

            // Dodajemy moduł blok_dividers z przegrodą na środku (X = 0)
            const dividersAssembly = doc.createAssembly({ name: 'blok_dividers_asm' }, cabinet.id);
            (dividersAssembly as any).generatorParams = { type: 'blok_dividers', liczba_przegrod: 1 };

            const dividerPanel = doc.createPanel({
                name: 'Przegroda_1',
                role: 'DIVIDER_PLATE',
                width: mmToNm(600),
                height: mmToNm(1964),
                thickness: mmToNm(18)
            }, dividersAssembly.id);
            const dividerPart = doc.findNode(dividerPanel.id)!;

            const mockHit = (meshMeta: any, pt: { x: number; y: number; z: number }, meshName: string = 'mesh') => ({
                hit: true,
                pickedPoint: pt,
                pickedMesh: {
                    metadata: meshMeta,
                    id: meshMeta.panelModel?.id || 'm_id',
                    name: meshName,
                    isPickable: true,
                    isVisible: true,
                    getBoundingInfo: () => ({
                        boundingBox: {
                            minimumWorld: { z: -300 },
                            maximumWorld: { z: 300 }
                        }
                    })
                }
            });

            // Scena dla lewej podwnęki: klikamy w X = -250 (między Bok_L w X = -482 a Przegrodą w X = -9)
            const fakeSceneLeftBay = {
                pickWithRay: (ray: any, predicate: (m: any) => boolean) => {
                    // Kierunek -X (w lewo): trafia Bok_L
                    if (ray.direction.x < -0.5) {
                        const hit = mockHit({ faceName: 'FACE_Z_PLUS', panelModel: sidePanelL }, { x: -482, y: 1000, z: 0 }, 'Bok_L');
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    // Kierunek +X (w prawo): trafia Przegrodę_1 w X = -9 (lewa ścianka przegrody o grubości 18 mm wycentrowanej w X=0)
                    if (ray.direction.x > 0.5) {
                        const hit = mockHit({
                            faceName: 'FACE_Z_PLUS',
                            panelModel: dividerPart,
                            isBlokChild: true
                        }, { x: -9, y: 1000, z: 0 }, 'Przegroda_1');
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    if (ray.direction.y < -0.5) {
                        const hit = mockHit({ faceName: 'FACE_Z_PLUS', panelModel: bottomPanel }, { x: -250, y: 18, z: 0 }, 'Wieniec_D');
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    if (ray.direction.y > 0.5) {
                        const hit = mockHit({ faceName: 'FACE_Z_MINUS', panelModel: topPanel }, { x: -250, y: 1982, z: 0 }, 'Wieniec_G');
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    if (ray.direction.z > 0.5) {
                        const hit = mockHit({ faceName: 'FACE_Z_PLUS', panelModel: sidePanelL }, { x: -250, y: 1000, z: 280 });
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    if (ray.direction.z < -0.5) {
                        const hit = mockHit({ faceName: 'FACE_Z_PLUS', panelModel: sidePanelL }, { x: -250, y: 1000, z: -280 });
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    return null;
                }
            };

            const pickResultLeft = {
                hit: true,
                pickedPoint: new (globalThis as any).BABYLON.Vector3(-250, 100, 0),
                getNormal: () => new (globalThis as any).BABYLON.Vector3(0, 1, 0)
            };

            const bayLeft = probeBayFromSceneRay(fakeSceneLeftBay, pickResultLeft, doc, 'internal');
            expect(bayLeft).not.toBeNull();
            // Szerokość lewej wnęki: od -482 do -9 = 473 mm (a NIE 964 mm pełnego korpusu!)
            expect(bayLeft!.boundsMm.width).toBeCloseTo(473, 0);
            expect(bayLeft!.boundary.left.nodeId).toBe(sidePanelL.id);
            expect(bayLeft!.boundary.right.nodeId).toBe(dividerPart.id);
            expect(bayLeft!.boundary.right.nodeName).toBe('Przegroda_1');
            expect(bayLeft!.boundary.right.face).toBe('FACE_Z_PLUS');

            // Scena dla prawej podwnęki: klikamy w X = +250 (między Przegrodą w X = +9 a Bok_P w X = +482)
            const fakeSceneRightBay = {
                pickWithRay: (ray: any, predicate: (m: any) => boolean) => {
                    // Kierunek -X (w lewo): trafia Przegrodę_1 w X = +9 (prawa ścianka przegrody)
                    if (ray.direction.x < -0.5) {
                        const hit = mockHit({
                            faceName: 'FACE_Z_MINUS',
                            panelModel: dividerPart,
                            isBlokChild: true
                        }, { x: 9, y: 1000, z: 0 }, 'Przegroda_1');
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    // Kierunek +X (w prawo): trafia Bok_P
                    if (ray.direction.x > 0.5) {
                        const hit = mockHit({ faceName: 'FACE_Z_PLUS', panelModel: sidePanelR }, { x: 482, y: 1000, z: 0 }, 'Bok_P');
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    if (ray.direction.y < -0.5) {
                        const hit = mockHit({ faceName: 'FACE_Z_PLUS', panelModel: bottomPanel }, { x: 250, y: 18, z: 0 }, 'Wieniec_D');
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    if (ray.direction.y > 0.5) {
                        const hit = mockHit({ faceName: 'FACE_Z_MINUS', panelModel: topPanel }, { x: 250, y: 1982, z: 0 }, 'Wieniec_G');
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    if (ray.direction.z > 0.5) {
                        const hit = mockHit({ faceName: 'FACE_Z_PLUS', panelModel: sidePanelR }, { x: 250, y: 1000, z: 280 });
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    if (ray.direction.z < -0.5) {
                        const hit = mockHit({ faceName: 'FACE_Z_PLUS', panelModel: sidePanelR }, { x: 250, y: 1000, z: -280 });
                        return predicate(hit.pickedMesh) ? hit : null;
                    }
                    return null;
                }
            };

            const pickResultRight = {
                hit: true,
                pickedPoint: new (globalThis as any).BABYLON.Vector3(250, 100, 0),
                getNormal: () => new (globalThis as any).BABYLON.Vector3(0, 1, 0)
            };

            const bayRight = probeBayFromSceneRay(fakeSceneRightBay, pickResultRight, doc, 'internal');
            expect(bayRight).not.toBeNull();
            // Szerokość prawej wnęki: od 9 do 482 = 473 mm
            expect(bayRight!.boundsMm.width).toBeCloseTo(473, 0);
            expect(bayRight!.boundary.left.nodeId).toBe(dividerPart.id);
            expect(bayRight!.boundary.left.nodeName).toBe('Przegroda_1');
            expect(bayRight!.boundary.left.face).toBe('FACE_Z_MINUS');
            expect(bayRight!.boundary.right.nodeId).toBe(sidePanelR.id);
        } finally {
            (globalThis as any).BABYLON = prevBabylon;
        }
    });
});

