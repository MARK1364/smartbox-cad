import { describe, it, expect } from 'vitest';
import korpus3Rules from '../korpus3_3_rules.json';
import rogowy90Rules from '../korpus_rogowy90_rules.json';
import rogowy1Rules from '../korpus_rogowy1_rules.json';
import skosnyRules from '../korpus_skosny_rules.json';

const ABS = { active: true, type_id: '0.008x0.022' };
const NONE = { active: false, type_id: 'none' };

function sideEdgeRules(rules: any) {
    const ro = rules.parameters.smart_panel_integration.role_overrides;
    return {
        left: ro.LEFT_SIDE_PANEL.edge_banding,
        right: ro.RIGHT_SIDE_PANEL.edge_banding,
        front: ro.FRONT_PANEL?.edge_banding
    };
}

describe('side edge banding defaults (3 sides: top +Y, bottom -Y, front)', () => {
    for (const [name, rules] of [
        ['korpus3', korpus3Rules],
        ['rogowy90', rogowy90Rules],
        ['rogowy1', rogowy1Rules],
        ['skosny', skosnyRules]
    ] as const) {
        it(`${name}: LEFT +X front, +Y top, -Y bottom active, -X back none`, () => {
            const { left } = sideEdgeRules(rules);
            expect(left['+X']).toEqual(ABS);
            expect(left['-X']).toEqual(NONE);
            expect(left['+Y']).toEqual(ABS);
            expect(left['-Y']).toEqual(ABS);
        });

        it(`${name}: RIGHT -X front, +Y top, -Y bottom active, +X back none`, () => {
            const { right } = sideEdgeRules(rules);
            expect(right['+X']).toEqual(NONE);
            expect(right['-X']).toEqual(ABS);
            expect(right['+Y']).toEqual(ABS);
            expect(right['-Y']).toEqual(ABS);
        });
    }

    it('rogowy90 Bok_L (LEFT_SIDE_PANEL): 3 sides (+X, +Y, -Y)', () => {
        const { left } = sideEdgeRules(rogowy90Rules);
        expect(left!['+X']).toEqual(ABS);
        expect(left!['-X']).toEqual(NONE);
        expect(left!['+Y']).toEqual(ABS);
        expect(left!['-Y']).toEqual(ABS);
    });
});
