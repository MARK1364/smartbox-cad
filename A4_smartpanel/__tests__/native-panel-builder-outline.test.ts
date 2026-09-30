import { describe, it, expect } from 'vitest';
import { NativePanelBuilder } from '../native-panel-builder';
import { mmToNm } from '../../A1_core/cad-math/units';

describe('NativePanelBuilder outline edgeKey', () => {
    it('preserves edgeKey through typed array conversion', () => {
        const builder = new NativePanelBuilder();
        const mesh = builder.build({
            role: 'BOTTOM_PANEL',
            width: mmToNm(882),
            height: mmToNm(882),
            thickness: mmToNm(18),
            edgeBanding: {
                NOTCH: { active: true, type_id: '0.008x0.022' },
                '+Y': { active: true, type_id: '0.008x0.022' }
            },
            custom_properties: {
                shape: 'L_NOTCH',
                outline2d: [
                    [0, 0],
                    [600, 0],
                    [600, 282],
                    [882, 282],
                    [882, 882],
                    [0, 882]
                ]
            }
        });

        const sides = Object.entries(mesh).filter(([k]) => k.startsWith('OUTLINE_SIDE_'));
        expect(sides.length).toBeGreaterThan(0);
        for (const [, data] of sides) {
            expect((data as any).edgeKey).toBeDefined();
        }
        const notch = sides.filter(([, d]) => (d as any).edgeKey === 'NOTCH');
        expect(notch.length).toBe(2);
    });
});
