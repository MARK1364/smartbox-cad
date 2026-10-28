import { describe, it, expect } from 'vitest';
import { mmToNm } from '../../A1_core/cad-math/units';
import { buildPolygonPanelTopology } from '../native_core/polygon-extrusion';
import { buildMeshFromPanel } from '../native_core/mesh_builder';

describe('polygon-extrusion — Faza 4: Bryła Zamknięta dla Wycięć Wewnętrznych (Otwory Przelotowe)', () => {
    const W = 1000;
    const D = 600;
    const T = 38;

    it('blat ze zlewem (cutout przelotowy): generuje otwór na Z+ oraz Z-, 4 ścianki pionowe i brak siatki dna', () => {
        const cutoutFeat = {
            id: 'sink_cutout',
            type: 'cutout',
            face: 'FACE_Z_PLUS',
            params: {
                u: 200,
                v: 100,
                width: 500,
                length: 400
            }
        };

        const topo = buildPolygonPanelTopology({
            outline2d: [
                [0, 0],
                [W, 0],
                [W, D],
                [0, D]
            ],
            plateW: W,
            plateD: D,
            thickness: T,
            features: [cutoutFeat]
        });

        // 1. Lico Z+ oraz Z- są wytriangulowane z otworem
        expect(topo['FACE_Z_PLUS']).toBeDefined();
        expect(topo['FACE_Z_MINUS']).toBeDefined();
        expect(topo['FACE_Z_PLUS'].positions.length).toBeGreaterThan(0);
        expect(topo['FACE_Z_MINUS'].positions.length).toBeGreaterThan(0);

        // 2. Brak siatki dna (cutout jest przelotowy)
        expect(topo['feature_sink_cutout_bottom']).toBeUndefined();

        // 3. 4 pionowe ścianki wewnętrzne otworu łączące górne i dolne lico
        expect(topo['feature_sink_cutout_w0']).toBeDefined();
        expect(topo['feature_sink_cutout_w1']).toBeDefined();
        expect(topo['feature_sink_cutout_w2']).toBeDefined();
        expect(topo['feature_sink_cutout_w3']).toBeDefined();

        const w0 = topo['feature_sink_cutout_w0'];
        expect(w0.positions.length).toBe(12); // 4 wierzchołki * 3 współrzędne
        expect(w0.indices.length).toBe(6);    // 2 trójkąty

        // 4. Krawędzie B-rep: góra (t1..t4), dół (b1..b4), pion (v1..v4)
        const edges = topo.edges as Array<{ key: string; points: number[][] }>;
        const edgeKeys = edges.map(e => e.key);

        expect(edgeKeys).toContain('e_groove_sink_cutout_t1');
        expect(edgeKeys).toContain('e_groove_sink_cutout_t2');
        expect(edgeKeys).toContain('e_groove_sink_cutout_t3');
        expect(edgeKeys).toContain('e_groove_sink_cutout_t4');

        expect(edgeKeys).toContain('e_groove_sink_cutout_b1');
        expect(edgeKeys).toContain('e_groove_sink_cutout_b2');
        expect(edgeKeys).toContain('e_groove_sink_cutout_b3');
        expect(edgeKeys).toContain('e_groove_sink_cutout_b4');

        expect(edgeKeys).toContain('e_groove_sink_cutout_v1');
        expect(edgeKeys).toContain('e_groove_sink_cutout_v2');
        expect(edgeKeys).toContain('e_groove_sink_cutout_v3');
        expect(edgeKeys).toContain('e_groove_sink_cutout_v4');

        // Weryfikacja wysokości krawędzi pionowych: dokładnie T = 38 mm
        const v1 = edges.find(e => e.key === 'e_groove_sink_cutout_v1')!;
        const [pTop, pBot] = v1.points;
        expect(pTop[2]).toBeCloseTo(T / 2, 2);
        expect(pBot[2]).toBeCloseTo(-T / 2, 2);
        const lenZ = Math.abs(pTop[2] - pBot[2]);
        expect(lenZ).toBeCloseTo(T, 2);
    });

    it('spójność geometryczna 3D: rzutowany otwór dolnego lica Z- odpowiada dokładnie otworowi górnemu Z+', () => {
        const cutoutFeat = {
            id: 'grommet_cutout',
            type: 'cutout',
            face: 'FACE_Z_PLUS',
            params: {
                u: 150,
                v: 250,
                width: 100,
                length: 80
            }
        };

        const topo = buildPolygonPanelTopology({
            outline2d: [
                [0, 0],
                [W, 0],
                [W, D],
                [0, D]
            ],
            plateW: W,
            plateD: D,
            thickness: T,
            features: [cutoutFeat]
        });

        const edges = topo.edges as Array<{ key: string; points: number[][] }>;
        const t1 = edges.find(e => e.key === 'e_groove_grommet_cutout_t1')!;
        const b1 = edges.find(e => e.key === 'e_groove_grommet_cutout_b1')!;

        // X i Y krawędzi górnej i dolnej muszą być identyczne (idealny cylinder/prostopadłościan wycięcia)
        expect(t1.points[0][0]).toBeCloseTo(b1.points[0][0], 2);
        expect(t1.points[0][1]).toBeCloseTo(b1.points[0][1], 2);
        expect(t1.points[1][0]).toBeCloseTo(b1.points[1][0], 2);
        expect(t1.points[1][1]).toBeCloseTo(b1.points[1][1], 2);

        // Z góry na T/2, Z dołu na -T/2
        expect(t1.points[0][2]).toBeCloseTo(T / 2, 2);
        expect(b1.points[0][2]).toBeCloseTo(-T / 2, 2);
    });

    it('kieszeń z dnem (blind pocket, through: false) generuje dno i nie przebija lica Z-', () => {
        const pocketFeat = {
            id: 'shallow_pocket',
            type: 'pocket',
            face: 'FACE_Z_PLUS',
            params: {
                u: 100,
                v: 100,
                width: 200,
                length: 150,
                depth: 10
            }
        };

        const topo = buildPolygonPanelTopology({
            outline2d: [
                [0, 0],
                [W, 0],
                [W, D],
                [0, D]
            ],
            plateW: W,
            plateD: D,
            thickness: T,
            features: [pocketFeat]
        });

        // Kieszeń z dnem posiada siatkę dna
        expect(topo['feature_shallow_pocket_bottom']).toBeDefined();
        const bottomMesh = topo['feature_shallow_pocket_bottom'];
        expect(bottomMesh.positions.length).toBe(12);

        // Dno leży na Z = T/2 - 10 = 19 - 10 = 9 mm
        for (let i = 2; i < bottomMesh.positions.length; i += 3) {
            expect(bottomMesh.positions[i]).toBeCloseTo(T / 2 - 10, 2);
        }

        // Lico Z- jest nienaruszone (brak otworu w earcut)
        // Dla prostokąta bez otworów earcut generuje dokładnie 4 wierzchołki (12 współrzędnych) i 2 trójkąty (6 indeksów)
        expect(topo['FACE_Z_MINUS'].positions.length).toBe(12);
        expect(topo['FACE_Z_MINUS'].indices.length).toBe(6);
    });

    it('formatka z uskokiem narożnikowym i wewnętrznym wycięciem przelotowym integruje oba typy obróbki', () => {
        // Uskok narożnika 100x100 na rogu formatki (cecha brzegowa z Fazy 3)
        // ORAZ wycięcie wewnętrzne pod zlew 400x300 w środku formatki
        const notchFeat = {
            id: 'corner_notch',
            type: 'cutout',
            face: 'FACE_Z_PLUS',
            params: {
                u: 0,
                v: 0,
                width: 100,
                length: 100
            }
        };
        const sinkFeat = {
            id: 'inner_sink',
            type: 'cutout',
            face: 'FACE_Z_PLUS',
            params: {
                u: 300,
                v: 200,
                width: 400,
                length: 300
            }
        };

        const panel = {
            id: 'panel_complex',
            width: mmToNm(W),
            height: mmToNm(D),
            thickness: mmToNm(T),
            features: [notchFeat, sinkFeat]
        };

        const topo = buildMeshFromPanel(panel);

        // 1. Zewnętrzny obrys został zmodyfikowany przez uskok brzegowy (Faza 3)
        // 2. Wewnętrzny zlew wygenerował ścianki w featureMeshes
        expect(topo['feature_inner_sink_w0']).toBeDefined();
        expect(topo['feature_inner_sink_w1']).toBeDefined();
        expect(topo['feature_inner_sink_w2']).toBeDefined();
        expect(topo['feature_inner_sink_w3']).toBeDefined();
        expect(topo['feature_inner_sink_bottom']).toBeUndefined();

        // Krawędzie B-rep zlewowe istnieją
        const edges = topo.edges as Array<{ key: string; points: number[][] }>;
        const edgeKeys = edges.map(e => e.key);
        expect(edgeKeys).toContain('e_groove_inner_sink_t1');
        expect(edgeKeys).toContain('e_groove_inner_sink_b1');
        expect(edgeKeys).toContain('e_groove_inner_sink_v1');
    });

    it('obsługa jednostek nm (u_nm, v_nm, width_nm, length_nm) w parametrach wycięcia', () => {
        const cutoutNm = {
            id: 'nm_cutout',
            type: 'cutout',
            face: 'FACE_Z_PLUS',
            params: {
                u_nm: mmToNm(250),
                v_nm: mmToNm(150),
                width_nm: mmToNm(300),
                length_nm: mmToNm(200)
            }
        };

        const topo = buildPolygonPanelTopology({
            outline2d: [
                [0, 0],
                [W, 0],
                [W, D],
                [0, D]
            ],
            plateW: W,
            plateD: D,
            thickness: T,
            features: [cutoutNm]
        });

        expect(topo['feature_nm_cutout_w0']).toBeDefined();
        const edges = topo.edges as Array<{ key: string; points: number[][] }>;
        const v1 = edges.find(e => e.key === 'e_groove_nm_cutout_v1')!;
        expect(v1).toBeDefined();

        // Punkt narożnika w LCS: x = -W/2 + u = -500 + 250 = -250 mm
        // y = -D/2 + v = -300 + 150 = -150 mm
        expect(v1.points[0][0]).toBeCloseTo(-250, 2);
        expect(v1.points[0][1]).toBeCloseTo(-150, 2);
    });
});
