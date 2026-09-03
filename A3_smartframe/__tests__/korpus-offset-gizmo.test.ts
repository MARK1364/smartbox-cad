import { describe, it, expect, beforeEach } from 'vitest';
import {
    findOffsetGizmoHandler,
    registerOffsetGizmoHandler,
    resetOffsetGizmoHandlersForTests
} from '../../A1_core/offset-gizmo-port';
import { korpusOffsetGizmoHandler } from '../korpus-offset-gizmo';
import { smartBoxOffsetGizmoHandler } from '../../A2_smartbox/smartbox-offset-gizmo';

describe('offset gizmo roles', () => {
    beforeEach(() => {
        resetOffsetGizmoHandlersForTests();
        registerOffsetGizmoHandler(korpusOffsetGizmoHandler);
        registerOffsetGizmoHandler(smartBoxOffsetGizmoHandler);
    });

    it('maps BACK_PANEL red/green faces in A3, not in Core', () => {
        const mapping = findOffsetGizmoHandler('BACK_PANEL')!.getFaceMapping('BACK_PANEL')!;
        expect(mapping.left).toBe('-X');
        expect(mapping.right).toBe('+X');
        expect(mapping.top).toBe('+Y');
        expect(mapping.bottom).toBe('-Y');
        expect(findOffsetGizmoHandler('BACK_PANEL')!.id).toBe('A3_korpus');
    });

    it('shifts BACK_PANEL along CAD Y', () => {
        const shift = findOffsetGizmoHandler('BACK_PANEL')!.getShift('BACK_PANEL')!;
        expect(shift.paramSuffix).toBe('shiftY');
        expect(shift.cadAxis).toBe('Y');
    });

    it('keeps shelf mapping in A2', () => {
        expect(findOffsetGizmoHandler('SHELF_PANEL')!.id).toBe('A2_smartbox');
        expect(findOffsetGizmoHandler('LEFT_SIDE_PANEL')!.id).toBe('A3_korpus');
    });
});
