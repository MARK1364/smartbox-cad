import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    CAD_EDIT_ENTITY,
    CAD_CLOSE_FLOATING_EDIT,
    openCadEditEntity,
    closeCadFloatingEdit,
} from '../cad-edit-entity.js';

describe('cad-edit-entity', () => {
    beforeEach(() => {
        vi.stubGlobal('window', {
            dispatchEvent: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('openCadEditEntity closes previous session then opens entity', () => {
        openCadEditEntity({ entityId: 'c1', kind: 'blok' });
        const calls = (window.dispatchEvent as any).mock.calls.map((c: any[]) => c[0]?.type);
        expect(calls).toEqual([CAD_CLOSE_FLOATING_EDIT, CAD_EDIT_ENTITY]);
        const detail = (window.dispatchEvent as any).mock.calls[1][0].detail;
        expect(detail).toEqual({ entityId: 'c1', kind: 'blok' });
    });

    it('closeCadFloatingEdit dispatches close only', () => {
        closeCadFloatingEdit();
        expect(window.dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: CAD_CLOSE_FLOATING_EDIT })
        );
    });
});
