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

    it('wpust dochodzący do boku outline2d (np. wieniec narożny przy boczku) ma otwarty wlot i nie tworzy ścianki czołowej', () => {
        // Krawędź x = 18 na panelu L
        const outlineL = [
            [900, 900],
            [18, 900],
            [18, 300],
            [300, 300],
            [300, 18],
            [900, 18]
        ];
        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(900),
            height: mmToNm(900),
            thickness: mmToNm(18),
            custom_properties: { outline2d: outlineL, shape: 'L_NOTCH' },
            features: [{
                id: 'g_side_open',
                type: 'groove',
                face: 'FACE_Z_PLUS',
                params: { u: 18, v: 890, width: 870, length: 3, depth: 11 }
            }]
        });

        // Ścianka w3 (przy u = 18) leży dokładnie na boku outline [18, 900]..[18, 300], więc nie powinna istnieć
        expect(mesh['feature_g_side_open_w3']).toBeUndefined();
        // Natomiast dno i ścianki boczne istnieją
        expect(mesh['feature_g_side_open_bottom']?.positions?.length).toBeGreaterThan(0);
        expect(mesh['feature_g_side_open_w0']?.positions?.length).toBeGreaterThan(0);
        expect(mesh['feature_g_side_open_w2']?.positions?.length).toBeGreaterThan(0);
    });

    it('tworzy schodek na OUTLINE_SIDE przy wpuście/wrędze na krawędzi zewnętrznej', () => {
        const outlineL = [
            [900, 900],
            [18, 900],
            [18, 300],
            [300, 300],
            [300, 18],
            [900, 18]
        ];
        // Wpust wzdłuż krawędzi tyłu (segment 0: v = 900, u: 900 -> 18)
        // u = 18, v = 897, width = 882, length = 3, depth = 11
        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(900),
            height: mmToNm(900),
            thickness: mmToNm(18),
            custom_properties: { outline2d: outlineL, shape: 'L_NOTCH' },
            features: [{
                id: 'g_back_rabbet',
                type: 'groove',
                face: 'FACE_Z_PLUS',
                params: { u: 18, v: 897, width: 882, length: 3, depth: 11 }
            }]
        });

        // Segment 0 to krawędź tyłu v = 900
        const side0 = mesh.OUTLINE_SIDE_0;
        expect(side0).toBeDefined();
        // Sprawdź wysokość ścianki w osi Z: powinna wynosić 18 - 11 = 7 mm zamiast pełnych 18 mm
        // positions: [p0t, p1t, p1b, p0b] -> 12 liczb (4 wierzchołki x 3 wsp.)
        const z0t = side0.positions[2];
        const z0b = side0.positions[11];
        const heightZ = Math.abs(z0t - z0b);
        expect(heightZ).toBeCloseTo(7, 1);

        // Dla porównania, segment 2 (wcięcie z przodu bez wpustu) ma pełne 18 mm
        const side2 = mesh.OUTLINE_SIDE_2;
        const z2t = side2.positions[2];
        const z2b = side2.positions[11];
        expect(Math.abs(z2t - z2b)).toBeCloseTo(18, 1);
    });

    it('nie tworzy zbędnych ścianek na końcach wpustu ani w narożniku dwóch łączących się wpustów', () => {
        const outlineL = [
            [900, 900],
            [18, 900],
            [18, 300],
            [300, 300],
            [300, 18],
            [900, 18]
        ];
        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(900),
            height: mmToNm(900),
            thickness: mmToNm(18),
            custom_properties: { outline2d: outlineL, shape: 'L_NOTCH' },
            features: [
                {
                    id: 'g_alongX',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: { u: 18, v: 897, width: 882, length: 3, depth: 11 }
                },
                {
                    id: 'g_alongY',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: { u: 897, v: 18, width: 3, length: 882, depth: 11 }
                }
            ]
        });

        // Brak zbędnych ścianek czołowych na końcach wpustów:
        // Dla g_alongX: w3 (u=18) leży na boku formatki, w1 (u=900) leży w narożniku
        expect(mesh['feature_g_alongX_w3']).toBeUndefined();
        expect(mesh['feature_g_alongX_w1']).toBeUndefined();
        // Dla g_alongY: w0 (v=18) leży na boku formatki, w2 (v=900) leży w narożniku
        expect(mesh['feature_g_alongY_w0']).toBeUndefined();
        expect(mesh['feature_g_alongY_w2']).toBeUndefined();

        // Połączony wpust L: dno jest jednym meshem o 6 wierzchołkach,
        // a ścianki wewnętrzne są w feature_g_alongX_w0 (dokładnie 2 quady = 8 wierzchołków = 24 współrzędne)
        const w0 = mesh['feature_g_alongX_w0'] as { positions: number[]; indices: number[] };
        expect(w0).toBeDefined();
        expect(w0.positions.length).toBe(24);
        expect(w0.indices.length).toBe(12);

        // Dno wpustu L ma 6 wierzchołków (18 współrzędnych, 12 indeksów earcut)
        const bX = mesh['feature_g_alongX_bottom'] as { positions: number[]; indices: number[] };
        expect(bX).toBeDefined();
        expect(bX.positions.length).toBe(18);
        expect(bX.indices.length).toBe(12);

        // Brak zdublowanych meshy dla drugiego ramienia g_alongY
        expect(mesh['feature_g_alongY_bottom']).toBeUndefined();
        expect(mesh['feature_g_alongY_w3']).toBeUndefined();

        // Krawędzie wpustu L: narożnik wewnętrzny ma dokładnie 1 krawędź pionową
        const edgeList = (mesh.edges as { key: string; points: number[][] }[]);
        const grooveEdges = edgeList.filter(e => e.key.startsWith('e_groove_'));
        expect(grooveEdges.some(e => e.key.endsWith('_v_corner'))).toBe(true);
        // Brak krawędzi przecinających narożnik
        expect(grooveEdges.some(e => e.key === 'e_groove_g_alongY_t4')).toBe(false);

        // Tyły (segment 0 i 5): brak zbędnych krawędzi pionowych o wysokości 18-11=7 mm w miejscu łączenia pleców
        const redundantSide0Vert = edgeList.filter(e => e.key.startsWith('outline_vert_0_'));
        const redundantSide5Vert = edgeList.filter(e => e.key.startsWith('outline_vert_5_'));
        expect(redundantSide0Vert.length).toBe(0);
        expect(redundantSide5Vert.length).toBe(0);

        const verticalEdges = edgeList.filter(e => {
            const p0 = e.points[0], p1 = e.points[1];
            return Math.abs(p0[2] - p1[2]) > 0.1;
        });
        const edges7mm = verticalEdges.filter(e => Math.abs(Math.abs(e.points[0][2] - e.points[1][2]) - 7) < 0.1);
        // Dokładnie 3 natywne krawędzie narożnika płyty przycięte do 7 mm przez schodek:
        // - outline_vert_0 (wierzchołek 0: narożnik zewnętrzny zbiegu tyłów)
        // - outline_vert_1 (wierzchołek 1: narożnik z boczkiem lewym)
        // - outline_vert_5 (wierzchołek 5: narożnik z boczkiem prawym)
        expect(edges7mm.length).toBe(3);
        expect(edges7mm.some(e => e.key === 'outline_vert_0')).toBe(true);
        expect(edges7mm.some(e => e.key.startsWith('outline_vert_1'))).toBe(true);
        expect(edges7mm.some(e => e.key.startsWith('outline_vert_5'))).toBe(true);

        // Wewnątrz prostego boku formatki (w punkcie 897 na dole) brak jakiejkolwiek sztucznej krawędzi 7 mm
        expect(edgeList.some(e => e.key === 'outline_vert_1_8')).toBe(false);
        expect(edgeList.some(e => e.key === 'outline_vert_4_8')).toBe(false);

        // Natomiast wloty wpustu mają pionowe krawędzie 11 mm
        expect(verticalEdges.some(e => e.key === 'e_groove_g_alongX_v_mouth_0')).toBe(true);
        expect(verticalEdges.some(e => e.key === 'e_groove_g_alongX_v_mouth_2')).toBe(true);

        // Sprawdzamy czy na FACE_Z_PLUS są trójkąty wewnątrz wpustu w narożniku
        const zPlus = mesh.FACE_Z_PLUS as { positions: number[]; indices: number[] };
        const coveringTris: number[][] = [];
        for (let i = 0; i < zPlus.indices.length; i += 3) {
            const i0 = zPlus.indices[i] * 3;
            const i1 = zPlus.indices[i + 1] * 3;
            const i2 = zPlus.indices[i + 2] * 3;
            const p0 = [zPlus.positions[i0], zPlus.positions[i0 + 1], zPlus.positions[i0 + 2]];
            const p1 = [zPlus.positions[i1], zPlus.positions[i1 + 1], zPlus.positions[i1 + 2]];
            const p2 = [zPlus.positions[i2], zPlus.positions[i2 + 1], zPlus.positions[i2 + 2]];
            const cX = (p0[0] + p1[0] + p2[0]) / 3;
            const cY = (p0[1] + p1[1] + p2[1]) / 3;
            if (cX > 446.9 && cX < 450.1 && cY > 446.9 && cY < 450.1) {
                coveringTris.push([cX, cY]);
            }
        }
        expect(coveringTris.length).toBe(0);

        // Teraz sprawdzamy WIENIEC_G (górny)
        const outlineG = [
            [0, 18],
            [600, 18],
            [600, 300],
            [882, 300],
            [882, 900],
            [0, 900]
        ];
        const meshG = buildMeshFromPanel({
            role: 'TOP_PANEL',
            width: mmToNm(900),
            height: mmToNm(900),
            thickness: mmToNm(18),
            custom_properties: { outline2d: outlineG, shape: 'L_NOTCH' },
            features: [
                {
                    id: 'top_alongX',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: { u: 0, v: 897, width: 882, length: 3, depth: 11 }
                },
                {
                    id: 'top_alongY',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: { u: 0, v: 18, width: 3, length: 882, depth: 11 }
                }
            ]
        });

        const zPlusG = meshG.FACE_Z_PLUS as { positions: number[]; indices: number[] };
        const coveringTrisG: number[][] = [];
        for (let i = 0; i < zPlusG.indices.length; i += 3) {
            const i0 = zPlusG.indices[i] * 3;
            const i1 = zPlusG.indices[i + 1] * 3;
            const i2 = zPlusG.indices[i + 2] * 3;
            const p0 = [zPlusG.positions[i0], zPlusG.positions[i0 + 1], zPlusG.positions[i0 + 2]];
            const p1 = [zPlusG.positions[i1], zPlusG.positions[i1 + 1], zPlusG.positions[i1 + 2]];
            const p2 = [zPlusG.positions[i2], zPlusG.positions[i2 + 1], zPlusG.positions[i2 + 2]];
            const cX = (p0[0] + p1[0] + p2[0]) / 3;
            const cY = (p0[1] + p1[1] + p2[1]) / 3;
            // Wpust top_alongX: u in [0, 882], v in [897, 900] -> X in [-450, 432], Y in [447, 450]
            if (cX > -448 && cX < 430 && cY > 447.1 && cY < 449.9) {
                coveringTrisG.push([cX, cY]);
            }
        }
        expect(coveringTrisG.length).toBe(0);
        expect(meshG['feature_top_alongX_bottom']).toBeDefined();
        expect(meshG['feature_top_alongX_w0']).toBeDefined();
        expect(meshG['feature_top_alongY_bottom']).toBeUndefined();
    });

    it('odsunięcie pleców w głąb (np. 15mm) tworzy otwarty rowek z dnem i obiema ściankami (brak płaszczyzny zakrywającej góry)', () => {
        // Wieniec dolny 900x900
        const outlineD = [
            [900, 900],
            [18, 900],
            [18, 300],
            [300, 300],
            [300, 18],
            [900, 18]
        ];
        // Plecy odsunięte o 15 mm w głąb formatki (od krawędzi v = 900 i u = 900):
        // Wpust along X: v in [882, 885], u in [18, 885]
        // Wpust along Y: u in [882, 885], v in [18, 885]
        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(900),
            height: mmToNm(900),
            thickness: mmToNm(18),
            custom_properties: { outline2d: outlineD, shape: 'L_NOTCH' },
            features: [
                {
                    id: 'g_alongX_15mm',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: { u: 18, v: 885, width: 882, length: 3, depth: 11 }
                },
                {
                    id: 'g_alongY_15mm',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: { u: 885, v: 18, width: 3, length: 882, depth: 11 }
                }
            ]
        });

        // 1. Sprawdzamy czy dno wpustu i ścianki istnieją
        console.log('Mesh keys:', Object.keys(mesh).filter(k => k.startsWith('feature_') || k.startsWith('OUTLINE_')));
        const hasBottom = !!(mesh['feature_g_alongX_15mm_bottom'] || mesh['feature_g_alongY_15mm_bottom']);
        expect(hasBottom).toBe(true);

        // 2. Sprawdzamy czy na FACE_Z_PLUS są trójkąty wewnątrz rowka (nie powinno ich być!)
        const zPlus = mesh.FACE_Z_PLUS as { positions: number[]; indices: number[] };
        const coveringTris: number[][] = [];
        for (let i = 0; i < zPlus.indices.length; i += 3) {
            const i0 = zPlus.indices[i] * 3;
            const i1 = zPlus.indices[i + 1] * 3;
            const i2 = zPlus.indices[i + 2] * 3;
            const p0 = [zPlus.positions[i0], zPlus.positions[i0 + 1], zPlus.positions[i0 + 2]];
            const p1 = [zPlus.positions[i1], zPlus.positions[i1 + 1], zPlus.positions[i1 + 2]];
            const p2 = [zPlus.positions[i2], zPlus.positions[i2 + 1], zPlus.positions[i2 + 2]];
            const cX = (p0[0] + p1[0] + p2[0]) / 3;
            const cY = (p0[1] + p1[1] + p2[1]) / 3;
            // X in [-450, 450], Y in [-450, 450]
            // u = 500, v = 883.5 -> X = u - 450 = 50, Y = v - 450 = 433.5
            if (cX > 0 && cX < 200 && cY > 432.1 && cY < 434.9) {
                coveringTris.push([cX, cY]);
            }
        }
        console.log('Covering triangles in 15mm groove:', coveringTris.length);
        expect(coveringTris.length).toBe(0);
    });
});
