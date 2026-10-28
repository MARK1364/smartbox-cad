import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { probeBayFromCADPoint } from '../02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../02_bloki-bay-actions.js';
import { registerBlokiModule } from '../01_register.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { buildHangersDrillings } from '../17_hangers-drilling-builder.js';
import { SyncHangersDrillingsCommand } from '../commands/sync-hangers-drillings-command.js';
import { buildMeshFromPanel } from '../../A4_smartpanel/native_core/mesh_builder.js';
import { point3DToFaceUV } from '../../A4_smartpanel/native_core/face-lcs.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';

describe('Hangers Drilling in Cabinet', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        registerBlokiModule();
    });

    it('creates hangers in bay and generates drillings on carcass panels', async () => {
        const cabinet = doc.createAssembly({ name: 'Szafka Wiszaca' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 720, 600, 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 360 });
        expect(bay).not.toBeNull();
        console.log('DETECTED BAY BOUNDARY LEFT:', bay!.boundary.left);
        console.log('DETECTED BAY BOUNDARY RIGHT:', bay!.boundary.right);

        const hangersOption = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'HANGERS')!;
        expect(hangersOption).toBeDefined();

        const blokNode = createBlokInDetectedBay(doc, bay!, hangersOption);
        expect(blokNode).not.toBeNull();

        const intents = buildHangersDrillings(doc, cabinet.id);
        console.log('buildHangersDrillings intents count:', intents.length);
        expect(intents.length).toBeGreaterThan(0);

        // Uruchomienie komendy synchronizacji
        new SyncHangersDrillingsCommand(cabinet.id).execute(doc);

        // Sprawdzenie, czy formatki korpusu (boki, plecy) otrzymały cechy obróbcze
        const leftPanel = doc.findNode(bay!.boundary.left.nodeId);
        const rightPanel = doc.findNode(bay!.boundary.right.nodeId);
        const backPanel = doc.findNode(bay!.boundary.back.nodeId);

        const leftFeatures = (leftPanel?.domainData as any)?.features || [];
        const rightFeatures = (rightPanel?.domainData as any)?.features || [];

        // Weryfikacja wykrywania płaszczyzn ścian wnęki (wewnętrzne lica boków = ±382 mm)
        const { panelFacePlaneCoordMm } = await import('../hangers/smartpart-bay-placement.js');
        expect(panelFacePlaneCoordMm(leftPanel, 'FACE_Z_PLUS', 'x')).toBeCloseTo(-382, 1);
        expect(panelFacePlaneCoordMm(rightPanel, 'FACE_Z_PLUS', 'x')).toBeCloseTo(382, 1);

        const leftMesh = buildMeshFromPanel(leftPanel?.domainData);
        const rightMesh = buildMeshFromPanel(rightPanel?.domainData);

        // Wycięcie przelotowe musi modyfikować siatkę obu lic (FACE_Z_PLUS oraz FACE_Z_MINUS)
        expect(leftMesh.FACE_Z_PLUS?.positions?.length).toBeGreaterThan(0);
        expect(leftMesh.FACE_Z_MINUS?.positions?.length).toBeGreaterThan(0);
        expect(rightMesh.FACE_Z_PLUS?.positions?.length).toBeGreaterThan(0);
        expect(rightMesh.FACE_Z_MINUS?.positions?.length).toBeGreaterThan(0);

        expect(leftFeatures.length).toBe(2);
        expect(rightFeatures.length).toBe(2);

        // Lewy bok: wycięcie narożne/brzegowe
        const leftCutout = leftFeatures.find((f: any) => f.type === 'cutout');
        expect(leftCutout).toBeDefined();
        expect(leftCutout.params.u).toBeCloseTo(1.5, 1);
        expect(leftCutout.params.v + leftCutout.params.length).toBeCloseTo(711, 1);
        expect(leftCutout.params.through).toBe(true);

        // Prawy bok: wycięcie narożne od u=315..350 do v=720
        const rightCutout = rightFeatures.find((f: any) => f.type === 'cutout');
        expect(rightCutout).toBeDefined();
        expect(rightCutout.params.u + rightCutout.params.width).toBeCloseTo(598.5, 1);
        expect(rightCutout.params.v + rightCutout.params.length).toBeCloseTo(711, 1);
        expect(rightCutout.params.through).toBe(true);

        const rightHole = rightFeatures.find((f: any) => f.type === 'hole');
        expect(rightHole).toBeDefined();
        expect(rightHole.params.diameter).toBe(3);
    });
});
