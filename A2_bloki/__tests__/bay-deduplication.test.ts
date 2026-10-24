import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { probeBayFromCADPoint, resolveDetectedBay, type DetectedBay } from '../02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../02_bloki-bay-actions.js';
import { registerBlokiModule } from '../01_register.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { bayFrameFromDetectedBay, customReferencesFromDetectedBay } from '../hangers/smartpart-bay-placement.js';
import { updateSmartPartHangersGroup } from '../hangers/hanger-apply.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';

describe('Bay Deduplication & Runtime Resolver (Lean SSOT)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
        registerBlokiModule();
    });

    it('createBlokInDetectedBay deduplicates boundary by omitting it from detectedBay', () => {
        const cabinet = doc.createAssembly({ name: 'Szafa Testowa' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 });
        expect(bay).not.toBeNull();
        expect(bay!.boundary).toBeDefined();

        const shelvesOption = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SHELVES')!;
        const blokNode = createBlokInDetectedBay(doc, bay!, shelvesOption, { liczba_polek: 2 });
        expect(blokNode).not.toBeNull();

        const sbContainer = blokNode!.domainData as ContainerModel;
        const gp = sbContainer.generatorParams!;

        // 1. SSOT: boundary istnieje na głównym poziomie generatorParams
        expect(gp.boundary).toBeDefined();
        expect(gp.boundary.left.nodeId).toBe(bay!.boundary.left.nodeId);
        expect(gp.boundary.right.nodeId).toBe(bay!.boundary.right.nodeId);

        // 2. Lean: detectedBay wewnątrz gp NIE duplikuje już boundary
        expect(gp.detectedBay).toBeDefined();
        expect((gp.detectedBay as any).boundary).toBeUndefined();

        // 3. Serializacja toJSON(): nie zawiera zduplikowanego pola boundary w detectedBay
        const json = sbContainer.toJSON();
        expect(json.generatorParams.boundary).toBeDefined();
        expect(json.generatorParams.detectedBay.boundary).toBeUndefined();
    });

    it('ContainerModel.toJSON() cleans legacy projects with duplicate detectedBay.boundary', () => {
        const legacyContainer = new ContainerModel({ width: 800_000_000, height: 2000_000_000, depth: 600_000_000 });
        const mockBoundary = {
            left: { nodeId: 'p1', nodeName: 'Bok_L', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: -400, y: 0, z: 1000 }, planeCoordMm: -382 },
            right: { nodeId: 'p2', nodeName: 'Bok_P', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 400, y: 0, z: 1000 }, planeCoordMm: 382 },
            bottom: { nodeId: 'p3', nodeName: 'Wieniec_D', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 0, z: 18 }, planeCoordMm: 18 },
            top: { nodeId: 'p4', nodeName: 'Wieniec_G', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 0, z: 1982 }, planeCoordMm: 1982 },
            back: { nodeId: 'p5', nodeName: 'Plecy', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 280, z: 1000 }, planeCoordMm: 280 },
            front: { nodeId: 'p1', nodeName: 'Bok_L', face: 'FACE_X_PLUS' as const, worldPointMm: { x: 0, y: -300, z: 1000 }, planeCoordMm: -300 },
            frontPlaneYMm: -300
        };

        // Symulacja starego formatu: boundary obecne OBA razy
        legacyContainer.generatorParams = {
            boundary: mockBoundary,
            detectedBay: {
                boundsMm: { width: 764, height: 1964, depth: 580 },
                boundsNm: { width: 764_000_000, height: 1964_000_000, depth: 580_000_000 },
                centerWorldMm: { x: 0, y: 0, z: 1000 },
                boundary: mockBoundary // DUPLIKAT
            }
        };

        const json = legacyContainer.toJSON();
        // Sprawdzamy czy toJSON() odciął duplikat z wyjścia
        expect(json.generatorParams.boundary).toBeDefined();
        expect(json.generatorParams.detectedBay.boundary).toBeUndefined();
        // I nie zmodyfikował destrukcyjnie obiektu in-memory
        expect(legacyContainer.generatorParams.detectedBay.boundary).toBeDefined();
    });

    it('resolveDetectedBay seamlessly reconstructs full DetectedBay from slim snapshot + boundary', () => {
        const mockBoundary = {
            left: { nodeId: 'p1', nodeName: 'Bok_L', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: -400, y: 0, z: 1000 }, planeCoordMm: -382 },
            right: { nodeId: 'p2', nodeName: 'Bok_P', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 400, y: 0, z: 1000 }, planeCoordMm: 382 },
            bottom: { nodeId: 'p3', nodeName: 'Wieniec_D', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 0, z: 18 }, planeCoordMm: 18 },
            top: { nodeId: 'p4', nodeName: 'Wieniec_G', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 0, z: 1982 }, planeCoordMm: 1982 },
            back: { nodeId: 'p5', nodeName: 'Plecy', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 280, z: 1000 }, planeCoordMm: 280 },
            front: { nodeId: 'p1', nodeName: 'Bok_L', face: 'FACE_X_PLUS' as const, worldPointMm: { x: 0, y: -300, z: 1000 }, planeCoordMm: -300 },
            frontPlaneYMm: -300
        };

        const slimGp = {
            parentContainerId: 'cab_1',
            boundary: mockBoundary,
            detectedBay: {
                boundsMm: { width: 764, height: 1964, depth: 580 },
                boundsNm: { width: 764_000_000, height: 1964_000_000, depth: 580_000_000 },
                centerWorldMm: { x: 0, y: 0, z: 1000 },
                roofAngleDeg: 15
            }
        };

        const resolved = resolveDetectedBay(slimGp);
        expect(resolved).not.toBeNull();
        expect(resolved!.boundary).toBe(mockBoundary);
        expect(resolved!.roofAngleDeg).toBe(15);
        expect(resolved!.slopeAxis).toBe('X');
        const halfWidthTan = (764 / 2) * Math.tan((15 * Math.PI) / 180);
        expect(resolved!.heightLeftMm).toBeCloseTo(1964 - halfWidthTan, 1);
        expect(resolved!.heightRightMm).toBeCloseTo(1964 + halfWidthTan, 1);
        expect(resolved!.boundsMm.width).toBe(764);

        // bayFrameFromDetectedBay działa bezbłędnie z odtworzonym obiektem
        const frame = bayFrameFromDetectedBay(resolved!);
        expect(frame.widthMm).toBeCloseTo(764, 0);
        expect(frame.heightMm).toBeCloseTo(1964, 0);
    });

    it('resolveDetectedBay can reconstruct DetectedBay even when detectedBay is completely absent', () => {
        const mockBoundary = {
            left: { nodeId: 'p1', nodeName: 'Bok_L', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: -382, y: 0, z: 1000 }, planeCoordMm: -382 },
            right: { nodeId: 'p2', nodeName: 'Bok_P', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 382, y: 0, z: 1000 }, planeCoordMm: 382 },
            bottom: { nodeId: 'p3', nodeName: 'Wieniec_D', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 0, z: 18 }, planeCoordMm: 18 },
            top: { nodeId: 'p4', nodeName: 'Wieniec_G', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 0, z: 1982 }, planeCoordMm: 1982 },
            back: { nodeId: 'p5', nodeName: 'Plecy', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 280, z: 1000 }, planeCoordMm: 280 },
            front: { nodeId: 'p1', nodeName: 'Bok_L', face: 'FACE_X_PLUS' as const, worldPointMm: { x: 0, y: -300, z: 1000 }, planeCoordMm: -300 },
            frontPlaneYMm: -300
        };

        const gpWithoutDetectedBay = {
            parentContainerId: 'cab_1',
            boundary: mockBoundary
        };

        const resolved = resolveDetectedBay(gpWithoutDetectedBay);
        expect(resolved).not.toBeNull();
        expect(resolved!.boundsMm.width).toBeCloseTo(764, 0);
        expect(resolved!.boundsMm.height).toBeCloseTo(1964, 0);
        expect(resolved!.boundsMm.depth).toBeCloseTo(580, 0);
        expect(resolved!.boundary).toBe(mockBoundary);
    });

    it('resolveDetectedBay derives LR slope heights from boundary slope when detectedBay is absent', () => {
        const mockBoundary = {
            left: { nodeId: 'p1', nodeName: 'Bok_L', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: -382, y: 0, z: 1000 }, planeCoordMm: -382 },
            right: { nodeId: 'p2', nodeName: 'Bok_P', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 382, y: 0, z: 1000 }, planeCoordMm: 382 },
            bottom: { nodeId: 'p3', nodeName: 'Wieniec_D', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 0, z: 18 }, planeCoordMm: 18 },
            top: { nodeId: 'p4', nodeName: 'Wieniec_G', face: 'FACE_Z_MINUS' as const, worldPointMm: { x: 0, y: 0, z: 1982 }, planeCoordMm: 1982, slopeAngleDeg: 15 },
            back: { nodeId: 'p5', nodeName: 'Plecy', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 280, z: 1000 }, planeCoordMm: 280 },
            front: { nodeId: 'p1', nodeName: 'Bok_L', face: 'FACE_X_PLUS' as const, worldPointMm: { x: 0, y: -300, z: 1000 }, planeCoordMm: -300 },
            frontPlaneYMm: -300
        };

        const resolved = resolveDetectedBay({
            parentContainerId: 'cab_1',
            boundary: mockBoundary
        });

        expect(resolved).not.toBeNull();
        expect(resolved!.roofAngleDeg).toBe(15);
        expect(resolved!.slopeAxis).toBe('X');
        const halfWidthTan = (764 / 2) * Math.tan((15 * Math.PI) / 180);
        expect(resolved!.heightLeftMm).toBeCloseTo(1964 - halfWidthTan, 1);
        expect(resolved!.heightRightMm).toBeCloseTo(1964 + halfWidthTan, 1);
    });

    it('runtime UI migration: reconstructs customReferences on slim generatorParams via resolveDetectedBay', () => {
        const mockBoundary = {
            left: { nodeId: 'panel_left', nodeName: 'Bok Lewy', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: -400, y: 0, z: 1000 }, planeCoordMm: -382 },
            right: { nodeId: 'panel_right', nodeName: 'Bok Prawy', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 400, y: 0, z: 1000 }, planeCoordMm: 382 },
            bottom: { nodeId: 'panel_bottom', nodeName: 'Wieniec Dolny', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 0, z: 18 }, planeCoordMm: 18 },
            top: { nodeId: 'panel_top', nodeName: 'Wieniec Gorny', face: 'FACE_Z_MINUS' as const, worldPointMm: { x: 0, y: 0, z: 1982 }, planeCoordMm: 1982 },
            back: { nodeId: 'panel_back', nodeName: 'Plecy', face: 'FACE_Z_PLUS' as const, worldPointMm: { x: 0, y: 280, z: 1000 }, planeCoordMm: 280 },
            front: { nodeId: 'panel_front', nodeName: 'Przod', face: 'FACE_X_PLUS' as const, worldPointMm: { x: 0, y: -300, z: 1000 }, planeCoordMm: -300 },
            frontPlaneYMm: -300
        };

        // Kontener z odchudzonym generatorParams: brak customReferences, slim detectedBay (brak boundary w detectedBay)
        const slimParams: any = {
            boundary: mockBoundary,
            detectedBay: {
                boundsMm: { width: 764, height: 1964, depth: 580 },
                boundsNm: { width: 764_000_000, height: 1964_000_000, depth: 580_000_000 },
                centerWorldMm: { x: 0, y: 0, z: 1000 },
            }
        };

        // Krok wykonywany w 01_bloki-ui.tsx i FloatingAgdEdit.tsx:
        const resolved = resolveDetectedBay(slimParams);
        expect(resolved).not.toBeNull();
        expect(resolved!.boundary).toBe(mockBoundary);

        const customRefs = customReferencesFromDetectedBay(resolved!);
        expect(customRefs.xMin.panelId).toBe('panel_left');
        expect(customRefs.xMax.panelId).toBe('panel_right');
        expect(customRefs.zMin.panelId).toBe('panel_bottom');
        expect(customRefs.zMax.panelId).toBe('panel_top');
        expect(customRefs.yMin.panelId).toBe('panel_front');
        expect(customRefs.yMax.panelId).toBe('panel_back');
    });

    it('runtime Hangers update: updateSmartPartHangersGroup successfully evaluates bayFrame with slim generatorParams', () => {
        const cabinet = doc.createAssembly({ name: 'Szafa Zawieszek' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 });
        expect(bay).not.toBeNull();

        // Tworzymy węzeł zawieszek z odchudzonym generatorParams
        const slimBay: Partial<DetectedBay> = { ...bay! };
        delete (slimBay as any).boundary;

        const cabNode = doc.rootNode.children[0];
        const groupContainer = new ContainerModel({ name: 'SmartParts_Zawieszki' });
        groupContainer.generatorParams = {
            type: 'smartpart_hangers_group',
            partType: 'HANGERS',
            parentCabinetId: cabNode?.id,
            parentContainerId: cabNode?.id,
            boundary: bay!.boundary,
            detectedBay: slimBay as DetectedBay,
            offsets: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 },
            width_mm: bay!.boundsMm.width,
            depth_mm: bay!.boundsMm.depth,
            height_mm: bay!.boundsMm.height,
        };

        const groupNode = CADNode.create(NodeType.ASSEMBLY, 'SmartParts_Zawieszki', groupContainer.id);
        groupNode.domainData = groupContainer;
        doc.addNode(cabNode?.id || doc.rootNode.id, groupNode);

        // Wywołanie aktualizacji zawieszek w runtime
        const success = updateSmartPartHangersGroup(groupNode, doc);
        expect(success).toBe(true);
    });
});
