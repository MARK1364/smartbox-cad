import { describe, it, expect } from 'vitest';
import { deriveOutlineWithCutouts } from '../native_core/polygon-extrusion';
import { buildMeshFromPanel } from '../native_core/mesh_builder';
import { mmToNm } from '../../A1_core/cad-math/units';

/** Oblicza pole powierzchni siatki triangulowanej 3D */
function meshArea(m: any): number {
    if (!m?.indices?.length || !m?.positions?.length) return 0;
    let area = 0;
    for (let i = 0; i < m.indices.length; i += 3) {
        const i0 = m.indices[i] * 3;
        const i1 = m.indices[i + 1] * 3;
        const i2 = m.indices[i + 2] * 3;
        const ax = m.positions[i0], ay = m.positions[i0 + 1], az = m.positions[i0 + 2];
        const bx = m.positions[i1], by = m.positions[i1 + 1], bz = m.positions[i1 + 2];
        const cx = m.positions[i2], cy = m.positions[i2 + 1], cz = m.positions[i2 + 2];
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    return area;
}

describe('Faza 3: Migracja Wycięcia Brzegowego (Uskok Narożnika / Rewizja) do profilu 2D', () => {

    describe('1. Detekcja wycięć brzegowych (deriveOutlineWithCutouts)', () => {
        const W = 600;
        const H = 800;
        const T = 18;

        it('wyprowadza 6-kątny profil dla wycięcia w lewym-dolnym narożniku (0, 0)', () => {
            const cutoutFeature = {
                id: 'corner_c1',
                type: 'cutout',
                face: 'FACE_Z_PLUS',
                params: {
                    u: 0,
                    v: 0,
                    width: 100,
                    length: 150,
                    through: true
                }
            };

            const derived = deriveOutlineWithCutouts(W, H, T, [cutoutFeature]);
            expect(derived).not.toBeNull();
            expect(derived!.consumedFeatures.has(cutoutFeature)).toBe(true);
            expect(derived!.outline2d.length).toBe(6);

            // Wierzchołki 6-kąta narożnego
            expect(derived!.outline2d).toEqual([
                [100, 0],
                [600, 0],
                [600, 800],
                [0, 800],
                [0, 150],
                [100, 150]
            ]);
        });

        it('wyprowadza 8-kątny profil dla wycięcia rewizyjnego w prawym boku (u=W)', () => {
            const sideCutout = {
                id: 'side_c1',
                type: 'cutout',
                face: 'FACE_Z_PLUS',
                params: {
                    u: 550, // od u=550 do u=600 (szerokość 50 dochodzi do brzegu W=600)
                    v: 200,
                    width: 50,
                    length: 100,
                    through: true
                }
            };

            const derived = deriveOutlineWithCutouts(W, H, T, [sideCutout]);
            expect(derived).not.toBeNull();
            expect(derived!.outline2d.length).toBe(8);
        });

        it('zwraca null dla wycięcia leżącego całkowicie wewnątrz formatki (zlew/przepust)', () => {
            const innerCutout = {
                id: 'inner_sink',
                type: 'cutout',
                face: 'FACE_Z_PLUS',
                params: {
                    u: 100,
                    v: 100,
                    width: 400,
                    length: 400,
                    through: true
                }
            };

            // Wycięcie nie dotyka żadnej krawędzi (u=100..500, v=100..500 w formatce 600x800)
            const derived = deriveOutlineWithCutouts(W, H, T, [innerCutout]);
            expect(derived).toBeNull();
        });
    });

    describe('2. Integracja w buildMeshFromPanel — likwidacja pasków materiału i linii widma', () => {
        const W = 600;
        const H = 800;
        const T = 18;
        const cutW = 100;
        const cutH = 150;

        it('formatka z wycięciem narożnym jest budowana przez profil B-rep bez szwów', () => {
            const mesh = buildMeshFromPanel({
                role: 'SIDE_PANEL',
                width: mmToNm(W),
                height: mmToNm(H),
                thickness: mmToNm(T),
                features: [
                    {
                        id: 'c_pipe',
                        type: 'cutout',
                        face: 'FACE_Z_PLUS',
                        params: {
                            u: 0,
                            v: 0,
                            width: cutW,
                            length: cutH,
                            through: true
                        }
                    }
                ]
            });

            // Lico Z+ oraz Z- są obecne
            expect(mesh.FACE_Z_PLUS).toBeDefined();
            expect(mesh.FACE_Z_MINUS).toBeDefined();

            // Pole powierzchni lica odpowiada idealnie polu formatki minus pole wycięcia
            const expectedArea = W * H - cutW * cutH; // 480_000 - 15_000 = 465_000 mm^2
            expect(meshArea(mesh.FACE_Z_PLUS)).toBeCloseTo(expectedArea, 0);
            expect(meshArea(mesh.FACE_Z_MINUS)).toBeCloseTo(expectedArea, 0);

            // Wycięcie narożne tworzy dokładnie 6 ścianek obwodowych (4 nominalne + 2 ścianki wcięcia)
            const sides = Object.keys(mesh).filter(k => k.startsWith('OUTLINE_SIDE_'));
            expect(sides.length).toBe(6);

            // Ścianki wcięcia (segmenty wewnątrz) posiadają rolę NOTCH (brak obrzeża)
            const notchSides = sides.filter(k => mesh[k].edgeKey === 'NOTCH');
            expect(notchSides.length).toBe(2);

            // Ścianki nominalne zachowują swoje obrzeża
            const nominalKeys = sides.map(k => mesh[k].edgeKey);
            expect(nominalKeys).toContain('-Y');
            expect(nominalKeys).toContain('+X');
            expect(nominalKeys).toContain('+Y');
            expect(nominalKeys).toContain('-X');
        });

        it('krawędzie B-rep zawierają precyzyjne krawędzie uskoku dla stabilnego PMI i gizmów', () => {
            const mesh = buildMeshFromPanel({
                role: 'SIDE_PANEL',
                width: mmToNm(W),
                height: mmToNm(H),
                thickness: mmToNm(T),
                features: [
                    {
                        id: 'c_pipe',
                        type: 'cutout',
                        face: 'FACE_Z_PLUS',
                        params: {
                            u: 0,
                            v: 0,
                            width: cutW,
                            length: cutH,
                            through: true
                        }
                    }
                ]
            });

            const edges = mesh.edges as Array<{ key: string; points: number[][] }>;
            expect(edges.length).toBeGreaterThanOrEqual(18); // 6 góra + 6 dół + 6 piony

            // Wierzchołek wewnętrznego narożnika uskoku: u=100, v=150
            // W LCS: X = 100 - 300 = -200, Y = 150 - 400 = -250
            const cornerEdges = edges.filter(e =>
                e.points.some(p => Math.abs(p[0] - (-200)) < 0.05 && Math.abs(p[1] - (-250)) < 0.05)
            );
            expect(cornerEdges.length).toBeGreaterThan(0);
        });

        it('obsługuje wycięcie zdefiniowane jako pocket z through: true', () => {
            const mesh = buildMeshFromPanel({
                role: 'BOTTOM_PANEL',
                width: mmToNm(W),
                height: mmToNm(H),
                thickness: mmToNm(T),
                features: [
                    {
                        id: 'p_through',
                        type: 'pocket',
                        face: 'FACE_Z_PLUS',
                        params: {
                            u: 0,
                            v: 0,
                            width: cutW,
                            length: cutH,
                            through: true
                        }
                    }
                ]
            });

            const expectedArea = W * H - cutW * cutH;
            expect(meshArea(mesh.FACE_Z_PLUS)).toBeCloseTo(expectedArea, 0);
            const sides = Object.keys(mesh).filter(k => k.startsWith('OUTLINE_SIDE_'));
            expect(sides.length).toBe(6);
        });
    });
});
