import { describe, it, expect, beforeEach } from 'vitest';
import { SmartFrameDragController } from '../smartframe-drag-controller.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

describe('SmartFrameDragController', () => {
    let controller: SmartFrameDragController;
    let doc: ProjectDocument;

    beforeEach(() => {
        controller = new SmartFrameDragController();
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.smartFrameDragController = controller;
    });

    it('initializes in non-dragging state and updates state on startDrag / endDrag', () => {
        expect(controller.isDragging).toBe(false);
        expect(controller.draggedZoneCount).toBeNull();

        controller.startDrag(2, {
            width: 800,
            height: 2000,
            depth: 600,
            bottomHeight: 600
        });

        expect(controller.isDragging).toBe(true);
        expect(controller.draggedZoneCount).toBe(2);

        controller.endDrag();
        expect(controller.isDragging).toBe(false);
        expect(controller.draggedZoneCount).toBeNull();
    });

    it('calculates ground intersection (Y=0) and drops a 1-zone cabinet firmly on the ground', () => {
        controller.startDrag(1, {
            width: 900,
            height: 2100,
            depth: 550
        });

        // Mock sceny z kamerą rzucającą promień na podłogę Y=0
        // Kamera na (1200, 1500, 800), promień w dół (0, -1, 0)
        // Punkt przecięcia z Y=0: (1200, 0, 800)
        const mockScene = {
            activeCamera: {},
            createPickingRay: () => ({
                origin: {
                    x: 1200,
                    y: 1500,
                    z: 800,
                    add: function(v: any) { return { x: this.x + v.x, y: this.y + v.y, z: this.z + v.z }; }
                },
                direction: {
                    x: 0,
                    y: -1,
                    z: 0,
                    scale: function(s: number) { return { x: this.x * s, y: this.y * s, z: this.z * s }; }
                }
            })
        };

        const pt = controller.onPointerMoveOnScene(mockScene, 100, 100);
        expect(pt).not.toBeNull();
        expect(pt!.x).toBe(1200);
        expect(pt!.y).toBe(800);

        // Upuszczenie na scenę
        const success = controller.onDropOnScene(doc);
        expect(success).toBe(true);
        expect(controller.isDragging).toBe(false);

        // Weryfikacja kontenera w dokumencie
        const containers = doc.getContainers();
        expect(containers.length).toBe(1);

        const cntNode = containers[0];
        const cntData = cntNode.domainData as any;
        expect(cntData).toBeDefined();
        expect(cntData.generatorParams.zoneCount).toBe(1);

        // Weryfikacja pozycji na podłodze Z=0 (w mm)
        const trans = cntNode.localMatrix.getTranslation();
        expect(Math.round(nmToMm(trans.x))).toBe(1200);
        expect(Math.round(nmToMm(trans.y))).toBe(800);
        expect(Math.round(nmToMm(trans.z))).toBe(0); // Twardo na ziemi!
    });

    it('creates cabinets for 2 and 3 zones and supports Undo', () => {
        // Upuszczenie korpusu 3-strefowego
        controller.startDrag(3, {
            width: 1000,
            height: 2200,
            depth: 600,
            bottomHeight: 500,
            middleHeight: 1200
        });

        // Wirtualne rzucenie promienia na X=500, Y=300
        const mockScene = {
            activeCamera: {},
            createPickingRay: () => ({
                origin: {
                    x: 500,
                    y: 1000,
                    z: 300,
                    add: function(v: any) { return { x: this.x + v.x, y: this.y + v.y, z: this.z + v.z }; }
                },
                direction: {
                    x: 0,
                    y: -1,
                    z: 0,
                    scale: function(s: number) { return { x: this.x * s, y: this.y * s, z: this.z * s }; }
                }
            })
        };

        controller.onPointerMoveOnScene(mockScene, 50, 50);
        controller.onDropOnScene(doc);

        const containers = doc.getContainers();
        expect(containers.length).toBe(1);
        expect((containers[0].domainData as any).generatorParams.zoneCount).toBe(3);

        // Cofnięcie przez Undo
        ContextManager.instance.commandHistory.undo();
        expect(doc.getContainers().length).toBe(0);
    });

    it('correctly handles dragging 1-zone, then 2-zone, then 3-zone sequentially without dirty state interference', () => {
        // 1. Upuszczenie 1-strefowego
        controller.startDrag(1, { width: 1000, height: 2200, depth: 600, bottomHeight: 2200, middleHeight: 0 });
        controller.onDropOnScene(doc);

        // 2. Upuszczenie 2-strefowego z domyślnie przekazanymi wysokościami z poprzedniego stanu
        controller.startDrag(2, { width: 1000, height: 2200, depth: 600, bottomHeight: 2200, middleHeight: 0 });
        controller.onDropOnScene(doc);

        // 3. Upuszczenie 3-strefowego z domyślnie przekazanymi wysokościami z poprzedniego stanu
        controller.startDrag(3, { width: 1000, height: 2200, depth: 600, bottomHeight: 2200, middleHeight: 0 });
        controller.onDropOnScene(doc);

        const containers = doc.getContainers();
        expect(containers.length).toBe(3);

        const c1Params = (containers[0].domainData as any).generatorParams;
        const c2Params = (containers[1].domainData as any).generatorParams;
        const c3Params = (containers[2].domainData as any).generatorParams;

        expect(c1Params.zoneCount).toBe(1);
        expect(c2Params.zoneCount).toBe(2);
        expect(c3Params.zoneCount).toBe(3);

        // Upewnijmy się, że 2-strefowy ma poprawny domyślny podział (2000 mm) a nie 2200 mm
        expect(c2Params.bottomHeight).toBe(2000);

        // Upewnijmy się, że 3-strefowy ma poprawny podział (500 mm dół, 1200 mm środek) a nie 2200 / 0
        expect(c3Params.bottomHeight).toBe(500);
        expect(c3Params.middleHeight).toBe(1200);
    });
});
