import { describe, it, expect, beforeEach } from 'vitest';
import {
    findOffsetGizmoHandler,
    registerOffsetGizmoHandler,
    resetOffsetGizmoHandlersForTests
} from '../../A1_core/offset-gizmo-port';
import { korpusOffsetGizmoHandler, resolveBackPanelFrontParam, resolveBackPanelFaceMapping, findOwningKorpus } from '../korpus-offset-gizmo';
import { blokiOffsetGizmoHandler } from '../../A2_bloki/bloki-offset-gizmo';

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

    it('keeps shelf mapping in A2', () => {
        expect(findOffsetGizmoHandler('SHELF_PANEL')!.id).toBe('A2_bloki');
        expect(findOffsetGizmoHandler('LEFT_SIDE_PANEL')!.id).toBe('A3_korpus');
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
});
