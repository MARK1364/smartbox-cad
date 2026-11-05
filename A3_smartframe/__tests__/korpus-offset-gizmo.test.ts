import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document';
import { ContextManager } from '../../A1_core/context-manager';
import { CommandHistory } from '../../A1_core/commands/command-history';
import * as smartFrameAdapter from '../smartframe-adapter';
import {
    findOffsetGizmoHandler,
    registerOffsetGizmoHandler,
    resetOffsetGizmoHandlersForTests
} from '../../A1_core/offset-gizmo-port';
import {
    korpusOffsetGizmoHandler,
    resolveBackPanelFrontParam,
    resolveBackPanelFaceMapping,
    resolveTopPanelFaceMapping,
    isTraverseVPanel,
    findOwningKorpus,
    clampEdgeOffsetMm,
    MIN_PANEL_DIM_MM
} from '../korpus-offset-gizmo';
import { blokiOffsetGizmoHandler } from '../../A2_bloki/02_bloki-offset-gizmo';

describe('offset gizmo roles', () => {
    beforeEach(() => {
        resetOffsetGizmoHandlersForTests();
        registerOffsetGizmoHandler(korpusOffsetGizmoHandler);
        registerOffsetGizmoHandler(blokiOffsetGizmoHandler);
    });

    it('maps BACK_PANEL red/green faces in A3, not in Core', () => {
        const mapping = findOffsetGizmoHandler('BACK_PANEL')!.getFaceMapping('BACK_PANEL')!;
        expect(mapping.FACE_X_MINUS).toBe('-X');
        expect(mapping.FACE_X_PLUS).toBe('+X');
        expect(mapping.FACE_Y_PLUS).toBe('-Y');
        expect(mapping.FACE_Y_MINUS).toBe('+Y');
        expect(findOffsetGizmoHandler('BACK_PANEL')!.id).toBe('A3_korpus');
    });

    it('resolves Rogowy90 PLECY_X → shiftX and PLECY_Y → shiftY', () => {
        // Strict: paramName z key (rename-proof), nie z display name.
        expect(resolveBackPanelFrontParam({ name: 'Plecy_X', key: 'PLECY_X', custom_properties: { corner_arm: 'X' } })).toEqual({
            kind: 'shiftX',
            paramName: 'PLECY_X_shiftX'
        });
        expect(resolveBackPanelFrontParam({ name: 'Plecy_Y', key: 'PLECY_Y' })).toEqual({
            kind: 'shiftY',
            paramName: 'PLECY_Y_shiftY'
        });
        expect(resolveBackPanelFrontParam({ name: 'Plecy' })).toEqual({
            kind: 'backOffset',
            paramName: 'backOffset'
        });
    });

    it('PLECY_X: odwrócone mapowanie krawędzi względem zwykłych pleców', () => {
        const m = resolveBackPanelFaceMapping({ name: 'Plecy_X', custom_properties: { corner_arm: 'X' } });
        expect(m.FACE_Y_PLUS).toBe('+Y');
        expect(m.FACE_Y_MINUS).toBe('-Y');
        expect(m.FACE_X_MINUS).toBe('+X');
        expect(m.FACE_X_PLUS).toBe('-X');
        expect(m.FACE_Z_PLUS).toBe('shiftX');
    });

    it('PLECY_Y / zwykłe plecy: standardowe mapowanie BACK_PANEL', () => {
        const mY = resolveBackPanelFaceMapping({ name: 'Plecy_Y', key: 'PLECY_Y' });
        expect(mY.FACE_Y_PLUS).toBe('-Y');
        expect(mY.FACE_Y_MINUS).toBe('+Y');
        expect(mY.FACE_X_MINUS).toBe('-X');
        expect(mY.FACE_X_PLUS).toBe('+X');
        expect(resolveBackPanelFaceMapping({ name: 'Plecy' }).FACE_Y_PLUS).toBe('-Y');
    });

    it('shifts BACK_PANEL along CAD Y', () => {
        const shift = findOffsetGizmoHandler('BACK_PANEL')!.getShift('BACK_PANEL')!;
        expect(shift.paramSuffix).toBe('shiftY');
        expect(shift.cadAxis).toBe('Y');
    });

    it('keeps divider mapping in A2, while shelves have no carcass edge offsets', () => {
        expect(findOffsetGizmoHandler('DIVIDER')!.id).toBe('A2_bloki');
        expect(findOffsetGizmoHandler('SHELF_PANEL')).toBeNull();
        expect(findOffsetGizmoHandler('LEFT_SIDE_PANEL')!.id).toBe('A3_korpus');
    });

    it('maps LEFT_SIDE_PANEL: FACE_Y_PLUS -> +Y (góra) i FACE_Y_MINUS -> -Y (dół)', () => {
        const mapping = findOffsetGizmoHandler('LEFT_SIDE_PANEL')!.getFaceMapping('LEFT_SIDE_PANEL')!;
        expect(mapping.FACE_Y_PLUS).toBe('+Y');
        expect(mapping.FACE_Y_MINUS).toBe('-Y');
        expect(mapping.FACE_X_MINUS).toBe('+X');
        expect(mapping.FACE_X_PLUS).toBe('-X');
    });

    it('maps RIGHT_SIDE_PANEL: FACE_Y_PLUS -> +Y (góra) i FACE_Y_MINUS -> -Y (dół)', () => {
        const mapping = findOffsetGizmoHandler('RIGHT_SIDE_PANEL')!.getFaceMapping('RIGHT_SIDE_PANEL')!;
        expect(mapping.FACE_Y_PLUS).toBe('+Y');
        expect(mapping.FACE_Y_MINUS).toBe('-Y');
        expect(mapping.FACE_X_PLUS).toBe('+X');
        expect(mapping.FACE_X_MINUS).toBe('-X');
    });

    it('maps TOP_PANEL standard (FULL/TRAVERSE_H): FACE_Y_MINUS -> -X (przód), FACE_Y_PLUS -> +X (tył)', () => {
        const handler = findOffsetGizmoHandler('TOP_PANEL')!;
        const normalTopPanel = { role: 'TOP_PANEL', name: 'Wieniec_G' };
        const mapping = handler.getFaceMapping('TOP_PANEL', normalTopPanel)!;
        expect(mapping.FACE_Y_MINUS).toBe('-X');
        expect(mapping.FACE_Y_PLUS).toBe('+X');
        expect(mapping.FACE_X_MINUS).toBe('-Y');
        expect(mapping.FACE_X_PLUS).toBe('+Y');
    });

    it('maps TOP_PANEL TRAVERSE_V (pionowy): FACE_Y_MINUS -> +X (góra), FACE_Y_PLUS -> -X (dół)', () => {
        const handler = findOffsetGizmoHandler('TOP_PANEL')!;
        const traverseVPanel = {
            role: 'TOP_PANEL',
            key: 'T_WIENIEC_G',
            name: 'Gora_Wieniec_G',
            lcs: {
                rotation: [180, 0, 0],
                mapping: { X: 'x', Y: 'z', Z: 'y' }
            }
        };
        expect(isTraverseVPanel(traverseVPanel)).toBe(true);
        const mapping = handler.getFaceMapping('TOP_PANEL', traverseVPanel)!;
        // W TRAVERSE_V: górna krawędź to FACE_Y_MINUS (steruje marginesem górnym +X),
        // dolna krawędź to FACE_Y_PLUS (steruje marginesem dolnym -X)
        expect(mapping.FACE_Y_MINUS).toBe('+X');
        expect(mapping.FACE_Y_PLUS).toBe('-X');
        expect(mapping.FACE_X_MINUS).toBe('-Y');
        expect(mapping.FACE_X_PLUS).toBe('+Y');
    });

    it('maps TOP_PANEL TRAVERSE_V getShift -> shiftY / cadAxis Y', () => {
        const handler = findOffsetGizmoHandler('TOP_PANEL')!;
        const normalTopPanel = { role: 'TOP_PANEL', name: 'Wieniec_G' };
        const traverseVPanel = {
            role: 'TOP_PANEL',
            key: 'T_WIENIEC_G',
            lcs: {
                rotation: [180, 0, 0],
                mapping: { X: 'x', Y: 'z', Z: 'y' }
            }
        };
        expect(handler.getShift('TOP_PANEL', normalTopPanel)).toEqual({
            paramSuffix: 'shiftZ',
            cadAxis: 'Z',
            sign: 1
        });
        expect(handler.getShift('TOP_PANEL', traverseVPanel)).toEqual({
            paramSuffix: 'shiftY',
            cadAxis: 'Y',
            sign: 1
        });
    });

    it('findOwningKorpus zwraca korpus rodzica płyty, nie „pierwszy z listy”', () => {
        const korpusA = { id: 'a', type: 'container', generatorParams: { type: 'korpus3_2' } };
        const korpusB = { id: 'b', type: 'container', generatorParams: { type: 'korpus_rogowy90' } };
        const panelNode = {
            domainData: { id: 'panel', type: 'panel' },
            parent: { domainData: korpusB, parent: null }
        };
        const doc = {
            findNode: (id: string) => (id === 'panel' ? panelNode : null)
        };
        expect(findOwningKorpus(doc, 'panel')).toBe(korpusB);
        expect(findOwningKorpus(doc, 'panel')).not.toBe(korpusA);
    });

    it('korpusOffsetGizmoHandler preview/commit/read zarządza cofniecie_plecow_mm i backOffset', () => {
        const handler = findOffsetGizmoHandler('BACK_PANEL')!;
        const container = {
            id: 'cnt_1',
            generatorParams: {
                cofniecie_plecow_mm: 5
            }
        };

        expect(handler.readOffsetMm(container, 'backOffset')).toBe(5);
        expect(handler.readOffsetMm(container, 'cofniecie_plecow_mm')).toBe(5);

        handler.previewOffset(container, 'backOffset', 15);
        expect((container.generatorParams as any).cofniecie_plecow_mm).toBe(5);
        expect((container.generatorParams as any).backOffset).toBeUndefined();
        expect((container.generatorParams as any).offsets?.backOffset).toBeUndefined();

        handler.commitOffset(container, 'backOffset', 15, 20);
        expect((container.generatorParams as any).cofniecie_plecow_mm).toBe(20);
        expect((container.generatorParams as any).backOffset).toBe(20);
        expect((container.generatorParams as any).offsets?.backOffset).toBe(20);
    });

    it('resolveSkosnyLrGeometry unosi szczyt dachu pleców o margines_gorny_mm w CAD Z', async () => {
        const { resolveSkosnyLrGeometry } = await import('../geometry/skosny-geometry.js');
        const p1 = resolveSkosnyLrGeometry('PLECY', 'BACK_PANEL', {
            W_mm: 1200, D_mm: 600, wysokosc_lewy_mm: 1000, wysokosc_prawy_mm: 2200,
            grubosc_mm: 3, grubosc_dolny_mm: 18, grubosc_gorny_mm: 18,
            szerokosc_wewnetrzna_mm: 1164, przesuniecie_srodka_mm: 0,
            margines_gorny_mm: 0, margines_dolny_mm: 5
        })!;
        const p2 = resolveSkosnyLrGeometry('PLECY', 'BACK_PANEL', {
            W_mm: 1200, D_mm: 600, wysokosc_lewy_mm: 1000, wysokosc_prawy_mm: 2200,
            grubosc_mm: 3, grubosc_dolny_mm: 18, grubosc_gorny_mm: 18,
            szerokosc_wewnetrzna_mm: 1164, przesuniecie_srodka_mm: 0,
            margines_gorny_mm: 20, margines_dolny_mm: 5
        })!;

        // CAD Z szczytu dachu (v=0 w obrysie, local cy = -backH/2):
        // W LCS [180,0,0]: CAD_Z = loc.z - (-backH/2 + v) = loc.z + backH/2 - v
        const outline1 = (p1.customProperties as any).outline2d;
        const vRight1 = outline1[2][1];
        const cadZRight1 = p1.loc!.z + p1.dim!.z / 2 - vRight1;

        const outline2 = (p2.customProperties as any).outline2d;
        const vRight2 = outline2[2][1];
        const cadZRight2 = p2.loc!.z + p2.dim!.z / 2 - vRight2;

        expect(cadZRight2 - cadZRight1).toBeCloseTo(20, 1);
    });

    it('korpus_rogowy90 niebieskie gizmo pleców: domyślne cofnięcie 3 mm i edycja bezwzględna', async () => {
        const handler = findOffsetGizmoHandler('BACK_PANEL')!;
        const container = {
            id: 'cnt_rogowy',
            generatorParams: {
                type: 'korpus_rogowy90'
            }
        };

        // 1. Domyślna wartość wynosi 3 mm (tak jak w zwykłych korpusach)
        expect(handler.readOffsetMm(container, 'B_PLECY_Y_shiftY', 'BACK_PANEL')).toBe(3);
        expect(handler.readOffsetMm(container, 'B_PLECY_X_shiftX', 'BACK_PANEL')).toBe(3);

        // 2. Jeśli kontener ma ustawione cofniecie_plecow_mm = 5, to domyślnie zwraca 5
        const container5 = {
            id: 'cnt_rogowy_5',
            generatorParams: {
                type: 'korpus_rogowy90',
                cofniecie_plecow_mm: 5
            }
        };
        expect(handler.readOffsetMm(container5, 'B_PLECY_Y_shiftY', 'BACK_PANEL')).toBe(5);

        // 3. Po ustawieniu customowego offsetu w offsets (np. 15 mm)
        const containerCustom = {
            id: 'cnt_rogowy_custom',
            generatorParams: {
                type: 'korpus_rogowy90',
                offsets: {
                    B_PLECY_Y_shiftY: 15
                }
            }
        };
        expect(handler.readOffsetMm(containerCustom, 'B_PLECY_Y_shiftY', 'BACK_PANEL')).toBe(15);

        // 4. Geometria planCabinet:
        const { planCabinet } = await import('../smartframe-engine.js');
        const planDefault = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            typ_korpusu: 'korpus_rogowy90'
        });
        const plecyYDef = planDefault.parts.find(p => p.name?.includes('Plecy_Y') || p.key?.includes('PLECY_Y'))!;
        // D/2 + T/2 - 3 = 450 + 1.5 - 3 = 448.5
        expect(plecyYDef.loc.y).toBeCloseTo(900 / 2 + 3 / 2 - 3, 2);

        // Z customowym offsetem 15 mm
        const planCustom = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            typ_korpusu: 'korpus_rogowy90',
            offsets: {
                B_PLECY_Y_shiftY: 15,
                B_PLECY_X_shiftX: 10
            }
        });
        const plecyYCustom = planCustom.parts.find(p => p.name?.includes('Plecy_Y') || p.key?.includes('PLECY_Y'))!;
        const plecyXCustom = planCustom.parts.find(p => p.name?.includes('Plecy_X') || p.key?.includes('PLECY_X'))!;
        // D/2 + T/2 - 15 = 450 + 1.5 - 15 = 436.5
        expect(plecyYCustom.loc.y).toBeCloseTo(900 / 2 + 3 / 2 - 15, 2);
        // -W/2 - T/2 + 10 = -450 - 1.5 + 10 = -441.5
        expect(plecyXCustom.loc.x).toBeCloseTo(-900 / 2 - 3 / 2 + 10, 2);
    });
});

describe('clampEdgeOffsetMm & minimum 1mm protection', () => {
    it('MIN_PANEL_DIM_MM is 1 mm', () => {
        expect(MIN_PANEL_DIM_MM).toBe(1);
    });

    it('clamps negative edge offset when dimension would drop below 1mm (case from biurko.spp.json)', () => {
        // Biurko: korpus_standard, D=600, cofniecie_plecow=68 z wpuszczeniem pleców (targetD = 600 - 68 = 532 mm)
        const container = {
            id: 'c_biurko',
            generatorParams: {
                typ_korpusu: 'korpus_standard',
                szerokosc_mm: 800,
                wysokosc_mm: 720,
                glebokosc_mm: 600,
                cofniecie_plecow_mm: 68,
                offsets: {
                    'Plecy_-X': 18,
                    'Bok_L_+X': -18
                }
            }
        };

        // Base Bok_L depth = 532 - 18 = 514 mm.
        // Offsetting Bok_L_-X by -537 would give 514 - 537 = -23 mm!
        // clampEdgeOffsetMm must clamp it to -513 so depth = 1 mm.
        const clamped = clampEdgeOffsetMm(container, 'Bok_L_-X', -537);
        expect(clamped).toBe(-513);

        // A safe offset like -20 should remain -20
        expect(clampEdgeOffsetMm(container, 'Bok_L_-X', -20)).toBe(-20);

        // Positive offset should remain untouched
        expect(clampEdgeOffsetMm(container, 'Bok_L_-X', 100)).toBe(100);
    });

    it('korpusOffsetGizmoHandler.clampOffset exposes clamping', () => {
        const container = {
            id: 'c_test',
            generatorParams: {
                typ_korpusu: 'korpus_standard',
                szerokosc_mm: 800,
                wysokosc_mm: 720,
                glebokosc_mm: 600,
                offsets: {}
            }
        };
        // Base Bok_L depth = 600 mm.
        // Offset -1000 would collapse Bok_L -> clamped to -599 (giving 1 mm).
        const result = korpusOffsetGizmoHandler.clampOffset!(container, 'Bok_L_-X', -1000);
        expect(result).toBe(-599);
    });

    it('previewOffset and commitOffset clamp value to prevent negative dimensions', () => {
        const container = {
            id: 'c_test_preview',
            generatorParams: {
                typ_korpusu: 'korpus_standard',
                szerokosc_mm: 800,
                wysokosc_mm: 720,
                glebokosc_mm: 600,
                offsets: {}
            }
        };

        korpusOffsetGizmoHandler.previewOffset(container, 'Bok_L_-X', -1000);
        expect(container.generatorParams.offsets['Bok_L_-X']).toBeUndefined();

        korpusOffsetGizmoHandler.commitOffset(container, 'Bok_L_-X', 0, -9999);
        expect(container.generatorParams.offsets['Bok_L_-X']).toBe(-599);
    });

    it('preview keeps committed params and rolls back a failed rebuild', () => {
        const doc = new ProjectDocument();
        const previousDocument = ContextManager.instance.document;
        const previousHistory = ContextManager.instance.commandHistory;
        const container = doc.createAssembly({ name: 'Preview rollback' }) as any;
        container.generatorParams = { type: 'korpus_standard', offsets: { 'Bok_L_-X': 2 } };
        ContextManager.instance.document = doc;

        const originalWidth = container.width;
        const originalRevision = doc.revision;
        const rebuild = vi.spyOn(smartFrameAdapter, 'rebuildSmartFrameContainer').mockImplementation((target: any) => {
            expect(target.generatorParams.offsets['Bok_L_-X']).toBe(20);
            target.width = 123;
            throw new Error('rebuild failed');
        });

        try {
            expect(() => korpusOffsetGizmoHandler.previewOffset(container, 'Bok_L_-X', 20)).toThrow('rebuild failed');
            expect(container.generatorParams.offsets['Bok_L_-X']).toBe(2);
            expect(container.width).toBe(originalWidth);
            expect(doc.revision).toBe(originalRevision);
        } finally {
            rebuild.mockRestore();
            ContextManager.instance.document = previousDocument;
            ContextManager.instance.commandHistory = previousHistory;
        }
    });

    it('offset command rolls back failed rebuild without adding history', () => {
        const doc = new ProjectDocument();
        const previousDocument = ContextManager.instance.document;
        const previousHistory = ContextManager.instance.commandHistory;
        const container = doc.createAssembly({ name: 'Offset rollback' }) as any;
        container.generatorParams = { type: 'korpus_standard', offsets: { 'Bok_L_-X': 2 } };
        const history = new CommandHistory(doc);
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = history;

        const originalWidth = container.width;
        const originalRevision = doc.revision;
        const rebuild = vi.spyOn(smartFrameAdapter, 'rebuildSmartFrameContainer').mockImplementation((target: any) => {
            target.width = 456;
            throw new Error('rebuild failed');
        });

        try {
            expect(() => korpusOffsetGizmoHandler.commitOffset(container, 'Bok_L_-X', 2, 20)).toThrow('rebuild failed');
            expect(container.generatorParams.offsets['Bok_L_-X']).toBe(2);
            expect(container.width).toBe(originalWidth);
            expect(doc.revision).toBe(originalRevision);
            expect(history.undoStack).toHaveLength(0);
            expect(history.redoStack).toHaveLength(0);
        } finally {
            rebuild.mockRestore();
            ContextManager.instance.document = previousDocument;
            ContextManager.instance.commandHistory = previousHistory;
        }
    });

    it('commits one history command with working undo and redo', () => {
        const doc = new ProjectDocument();
        const previousDocument = ContextManager.instance.document;
        const previousHistory = ContextManager.instance.commandHistory;
        const container = doc.createAssembly({ name: 'Offset history' }) as any;
        container.generatorParams = { type: 'korpus_standard', offsets: { 'Bok_L_-X': 2 } };
        const history = new CommandHistory(doc);
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = history;
        const rebuild = vi.spyOn(smartFrameAdapter, 'rebuildSmartFrameContainer').mockReturnValue(true);

        try {
            korpusOffsetGizmoHandler.commitOffset(container, 'Bok_L_-X', 2, 20);
            expect(container.generatorParams.offsets['Bok_L_-X']).toBe(20);
            expect(history.undoStack).toHaveLength(1);
            expect(history.undo()).toBe(true);
            expect(container.generatorParams.offsets['Bok_L_-X']).toBe(2);
            expect(history.redo()).toBe(true);
            expect(container.generatorParams.offsets['Bok_L_-X']).toBe(20);
            expect(rebuild).toHaveBeenCalledTimes(3);
        } finally {
            rebuild.mockRestore();
            ContextManager.instance.document = previousDocument;
            ContextManager.instance.commandHistory = previousHistory;
        }
    });
});
