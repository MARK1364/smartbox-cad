import { describe, it, expect } from 'vitest';
import { buildMeshFromPanel } from '../native_core/mesh_builder';
import { buildPolygonPanelTopology } from '../native_core/polygon-extrusion';
import { computeOutlineCapVertices } from '../native_core/polygon-extrusion';
import { NativePanelBuilder } from '../native-panel-builder';
import { mmToNm } from '../../A1_core/cad-math/units';

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

describe('polygon extrusion — wieniec L + wpust', () => {
    it('buduje caps i boki z tych samych wierzchołków obrysu (SSOT)', () => {
        const mesh = buildPolygonPanelTopology({
            outline2d,
            plateW,
            plateD,
            thickness: 18
        });

        const sides = Object.keys(mesh).filter((k) => k.startsWith('OUTLINE_SIDE_'));
        expect(sides.length).toBe(6);

        const { topPts } = computeOutlineCapVertices(outline2d, plateW, plateD, 18);
        const side0 = mesh.OUTLINE_SIDE_0 as { positions: number[] };
        expect(side0.positions.slice(0, 3)).toEqual(topPts[0]);

        expect(mesh.FACE_Z_PLUS.positions.length).toBeGreaterThan(0);
        expect(mesh.FACE_Z_MINUS.positions.length).toBeGreaterThan(0);
        expect(mesh.FACE_X_PLUS.positions.length).toBe(0);
        expect(mesh.FACE_Y_MINUS.positions.length).toBe(0);

        const edgeKeys = (mesh.edges as { key: string }[]).map((e) => e.key);
        expect(edgeKeys).not.toContain('dol_tyl');
    });

    it('wycina wpust na FACE_Z_MINUS (earcut hole + kieszeń 3D + 12 krawędzi)', () => {
        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(plateW),
            height: mmToNm(plateD),
            thickness: mmToNm(18),
            custom_properties: { outline2d, shape: 'L_NOTCH' },
            features: [{
                id: 'g_back',
                type: 'groove',
                face: 'FACE_Z_MINUS',
                params: { u: 10, v: 10, width: 3, length: 500, depth: 8 }
            }]
        });

        const sides = Object.entries(mesh).filter(([k]) => k.startsWith('OUTLINE_SIDE_'));
        expect(sides.length).toBe(6);
        const keys = sides.map(([, v]) => (v as any).edgeKey);
        expect(keys.filter((k) => k === 'NOTCH').length).toBe(2);

        const plain = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(plateW),
            height: mmToNm(plateD),
            thickness: mmToNm(18),
            custom_properties: { outline2d, shape: 'L_NOTCH' }
        });
        expect(mesh.FACE_Z_MINUS.positions.length).toBeGreaterThan(plain.FACE_Z_MINUS.positions.length);

        // Płaszczyzny wpustu jako osobne meshe B-rep (pick operacji)
        expect(mesh['feature_g_back_bottom']?.positions?.length).toBeGreaterThan(0);
        expect(mesh['feature_g_back_w0']?.positions?.length).toBeGreaterThan(0);
        expect(mesh['feature_g_back_w1']?.positions?.length).toBeGreaterThan(0);
        expect(mesh['feature_g_back_w2']?.positions?.length).toBeGreaterThan(0);
        expect(mesh['feature_g_back_w3']?.positions?.length).toBeGreaterThan(0);

        const grooveEdges = (mesh.edges as { key: string }[]).filter((e) => String(e.key).startsWith('e_groove_'));
        expect(grooveEdges.length).toBe(12);
    });

    it('NativePanelBuilder zwraca TypedArray i zachowuje edgeKey', () => {
        const typed = new NativePanelBuilder().build({
            role: 'BOTTOM_PANEL',
            width: mmToNm(plateW),
            height: mmToNm(plateD),
            thickness: mmToNm(18),
            custom_properties: { outline2d, shape: 'L_NOTCH' },
            features: [{
                id: 'g_back',
                type: 'groove',
                face: 'FACE_Z_MINUS',
                params: { u: 10, v: 10, width: 3, length: 500, depth: 8 }
            }]
        });

        expect(typed.FACE_Z_MINUS.positions).toBeInstanceOf(Float32Array);
        expect(typed.FACE_Z_MINUS.indices).toBeInstanceOf(Uint32Array);
        expect(typed.OUTLINE_SIDE_0.positions).toBeInstanceOf(Float32Array);
        expect(typed.OUTLINE_SIDE_0.edgeKey).toBeDefined();
        expect((typed.edges as { key: string }[]).some((e) => e.key.startsWith('e_groove_'))).toBe(true);
    });
});
