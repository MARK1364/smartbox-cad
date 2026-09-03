import { describe, it, expect } from 'vitest';
import { defaultBackOverlapMm, readOffsetMm, isBackPanelEdgeParam } from '../back-overlap';
import korpusRules from '../korpus3_3_rules.json';
import { rulesMToMm } from '../../A1_core/cad-math/units';

describe('back edge offset defaults', () => {
    it('reads default overlap from JSON rules (meters → mm)', () => {
        const fromJson = rulesMToMm(korpusRules.cabinet_construction_rules.defaults.back_groove_depth);
        expect(defaultBackOverlapMm()).toBe(fromJson);
        expect(defaultBackOverlapMm()).toBe(11);
    });

    it('defaults BACK_PANEL edge gizmos to JSON overlap', () => {
        expect(isBackPanelEdgeParam('Dol_Plecy_+X', 'BACK_PANEL')).toBe(true);
        expect(readOffsetMm(undefined, 'Dol_Plecy_+X', 'BACK_PANEL')).toBe(11);
        expect(readOffsetMm(undefined, 'Plecy_-Y', 'BACK_PANEL')).toBe(11);
    });

    it('keeps shift and other roles at 0 unless stored', () => {
        expect(isBackPanelEdgeParam('Dol_Plecy_shiftY', 'BACK_PANEL')).toBe(false);
        expect(readOffsetMm(undefined, 'Dol_Plecy_shiftY', 'BACK_PANEL')).toBe(0);
        expect(readOffsetMm(undefined, 'Dol_Bok_L_+X', 'LEFT_SIDE_PANEL')).toBe(0);
        expect(readOffsetMm({ 'Plecy_+X': 0 }, 'Plecy_+X', 'BACK_PANEL')).toBe(0);
        expect(readOffsetMm(undefined, 'Plecy_+X')).toBe(0);
    });
});
