import { describe, it, expect } from 'vitest';
import { buildMeshFromPanel } from '../native_core/mesh_builder';
import { mmToNm } from '../../A1_core/cad-math/units';
import { PanelModel } from '../panel-model';

describe('L outline edge segments', () => {
    it('splits outline into segments with outer edge keys and NOTCH for wcięcie L', () => {
        const plateW = 882;
        const plateD = 882;
        const armU = 600;
        const armV = 600;
        const outline2d = [
            [0, 0],
            [plateW, 0],
            [plateW, armV],
            [armU, armV],
            [armU, plateD],
            [0, plateD]
        ];

        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(plateW),
            height: mmToNm(plateD),
            thickness: mmToNm(18),
            custom_properties: { outline2d, shape: 'L_NOTCH' }
        });

        const sides = Object.entries(mesh).filter(([k]) => k.startsWith('OUTLINE_SIDE_'));
        expect(sides.length).toBe(6);

        const keys = sides.map(([, v]) => (v as any).edgeKey);
        expect(keys.filter((k) => k === 'NOTCH').length).toBe(2);
        expect(keys).toContain('-Y');
        expect(keys).toContain('+Y');
        expect(keys).toContain('-X');
        expect(keys).toContain('+X');
        expect(keys.filter((k) => k === '-Y' || k === '+Y' || k === '-X' || k === '+X').length).toBe(4);

        const edgeKeys = (mesh.edges as { key: string }[]).map((e) => e.key);
        expect(edgeKeys.filter((k) => k.startsWith('outline_top_')).length).toBe(6);
        expect(edgeKeys.filter((k) => k.startsWith('outline_bottom_')).length).toBe(6);
        expect(edgeKeys.filter((k) => k.startsWith('outline_vert_')).length).toBe(6);
        expect(edgeKeys).not.toContain('dol_tyl');

        const side0 = mesh.OUTLINE_SIDE_0 as { positions: number[] };
        const topEdge0 = (mesh.edges as { key: string; points: number[][] }[]).find((e) => e.key === 'outline_top_0');
        const bottomEdge0 = (mesh.edges as { key: string; points: number[][] }[]).find((e) => e.key === 'outline_bottom_0');
        expect(topEdge0?.points[0]).toEqual([side0.positions[0], side0.positions[1], side0.positions[2]]);
        // positions: p0t, p1t, p1b, p0b → dół odcinka to p0b (idx 3) → p1b (idx 2)
        expect(bottomEdge0?.points[0]).toEqual([side0.positions[9], side0.positions[10], side0.positions[11]]);
        expect(bottomEdge0?.points[1]).toEqual([side0.positions[6], side0.positions[7], side0.positions[8]]);
    });

    it('setAllEdges sets NOTCH on L_NOTCH panel, and clearAllEdgeBanding clears it', () => {
        const panel = new PanelModel({
            width: mmToNm(882),
            height: mmToNm(882),
            thickness: mmToNm(18),
            role: 'BOTTOM_PANEL'
        });
        panel.custom_properties = { shape: 'L_NOTCH' };

        panel.setAllEdges({ type_id: '0.008x0.022' });
        expect(panel.edgeBanding['NOTCH']).toBeDefined();
        expect(panel.edgeBanding['NOTCH'].active).toBe(true);
        expect(panel.edgeBanding['+X'].active).toBe(true);

        panel.clearAllEdgeBanding();
        expect(panel.edgeBanding['NOTCH'].active).toBe(false);
        expect(panel.edgeBanding['+X'].active).toBe(false);
    });
});
