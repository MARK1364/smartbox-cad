import { describe, it, expect } from 'vitest';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('groove boundary edge clipping (wycinanie linii krawędzi na wlocie/wylocie wpustu)', () => {
    it('dla wieńca z wpustem przez całą szerokość rozcina krawędź boczną o 3mm i pomija linie t4/t2', () => {
        const widthMm = 564;
        const depthMm = 500;
        const thicknessMm = 18;
        const grooveVMm = 470;
        const grooveThMm = 3;
        const grooveDepthMm = 11;

        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(widthMm),
            height: mmToNm(depthMm),
            thickness: mmToNm(thicknessMm),
            features: [
                {
                    id: 'g_wieniec',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 0,
                        v: grooveVMm,
                        width: widthMm,
                        length: grooveThMm,
                        depth: grooveDepthMm
                    }
                }
            ]
        });

        const edgeKeys = (mesh.edges as Array<{ key: string }>).map(e => e.key);

        // 1. Fałszywe linie zamykające wloty wpustu w powietrzu (t4 na lewym boku, t2 na prawym) muszą być usunięte
        expect(edgeKeys).not.toContain('e_groove_g_wieniec_t4');
        expect(edgeKeys).not.toContain('e_groove_g_wieniec_t2');

        // 2. Krawędzie podłużne wpustu wewnątrz formatki (t1, t3) oraz dno i piony muszą istnieć
        expect(edgeKeys).toContain('e_groove_g_wieniec_t1');
        expect(edgeKeys).toContain('e_groove_g_wieniec_t3');
        expect(edgeKeys).toContain('e_groove_g_wieniec_b1');
        expect(edgeKeys).toContain('e_groove_g_wieniec_b2');
        expect(edgeKeys).toContain('e_groove_g_wieniec_b3');
        expect(edgeKeys).toContain('e_groove_g_wieniec_b4');
        expect(edgeKeys).toContain('e_groove_g_wieniec_v1');
        expect(edgeKeys).toContain('e_groove_g_wieniec_v2');
        expect(edgeKeys).toContain('e_groove_g_wieniec_v3');
        expect(edgeKeys).toContain('e_groove_g_wieniec_v4');

        // 3. Krawędź obrysu boku przod_lewo (lewa strona wieńca) musi być rozcięta na 2 odcinki
        const leftEdges = (mesh.edges as Array<{ key: string; points: number[][] }>).filter(
            e => e.key === 'przod_lewo' || e.key.startsWith('przod_lewo_')
        );
        expect(leftEdges.length).toBe(2);

        // Pierwszy odcinek: od przodu (v=0 -> y = -250) do wlotu wpustu (v=470 -> y = +220)
        const seg1 = leftEdges[0];
        expect(seg1.points[0][1]).toBeCloseTo(-250, 1);
        expect(seg1.points[1][1]).toBeCloseTo(-250 + grooveVMm, 1);

        // Drugi odcinek: od wylotu wpustu (v=473 -> y = +223) do tyłu formatki (v=500 -> y = +250)
        const seg2 = leftEdges[1];
        expect(seg2.points[0][1]).toBeCloseTo(-250 + grooveVMm + grooveThMm, 1);
        expect(seg2.points[1][1]).toBeCloseTo(+250, 1);

        // Przerwa między segmentami wynosi dokładnie szerokość wpustu (3mm)
        const gap = seg2.points[0][1] - seg1.points[1][1];
        expect(gap).toBeCloseTo(grooveThMm, 1);

        // 4. Krawędź prawa przod_prawo również musi być rozcięta na 2 odcinki
        const rightEdges = (mesh.edges as Array<{ key: string; points: number[][] }>).filter(
            e => e.key === 'przod_prawo' || e.key.startsWith('przod_prawo_')
        );
        expect(rightEdges.length).toBe(2);
        const rightGap = rightEdges[1].points[0][1] - rightEdges[0].points[1][1];
        expect(rightGap).toBeCloseTo(grooveThMm, 1);
    });

    it('dla boku pionowego z wpustem przez całą wysokość pomija linie t1/t3 i rozcina krawędzie', () => {
        const widthMm = 500;
        const heightMm = 720;
        const thicknessMm = 18;

        const mesh = buildMeshFromPanel({
            role: 'SIDE_PANEL',
            width: mmToNm(widthMm),
            height: mmToNm(heightMm),
            thickness: mmToNm(thicknessMm),
            features: [
                {
                    id: 'g_side',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 470,
                        v: 0,
                        width: 3,
                        length: heightMm,
                        depth: 11
                    }
                }
            ]
        });

        const edgeKeys = (mesh.edges as Array<{ key: string }>).map(e => e.key);

        // Wpust w osi V przez całą wysokość: t1 (dolny wlot) i t3 (górny wlot) pominięte
        expect(edgeKeys).not.toContain('e_groove_g_side_t1');
        expect(edgeKeys).not.toContain('e_groove_g_side_t3');
        expect(edgeKeys).toContain('e_groove_g_side_t2');
        expect(edgeKeys).toContain('e_groove_g_side_t4');
    });

    it('dla wpustu nieprzelotowego (wewnętrznego) zachowuje wszystkie 4 krawędzie t1..t4 i nie rozcina obrysu', () => {
        const mesh = buildMeshFromPanel({
            role: 'PANEL',
            width: mmToNm(500),
            height: mmToNm(500),
            thickness: mmToNm(18),
            features: [
                {
                    id: 'g_pocket',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 50,
                        v: 50,
                        width: 100,
                        length: 200,
                        depth: 8
                    }
                }
            ]
        });

        const edgeKeys = (mesh.edges as Array<{ key: string }>).map(e => e.key);
        expect(edgeKeys).toContain('e_groove_g_pocket_t1');
        expect(edgeKeys).toContain('e_groove_g_pocket_t2');
        expect(edgeKeys).toContain('e_groove_g_pocket_t3');
        expect(edgeKeys).toContain('e_groove_g_pocket_t4');

        const leftEdges = (mesh.edges as Array<{ key: string }>).filter(
            e => e.key === 'przod_lewo' || e.key.startsWith('przod_lewo_')
        );
        expect(leftEdges.length).toBe(1);
    });

    it('dla uskoku/felcu z tyłu formatki po całej szerokości: pomija v3 i v4 (brak ścianki) i przycina pionowe krawędzie narożnika', () => {
        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(1164),
            height: mmToNm(600),
            thickness: mmToNm(18),
            features: [
                {
                    id: 'g_uskok',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 0,
                        v: 597,
                        width: 1164,
                        length: 3,
                        depth: 11
                    }
                }
            ]
        });

        const edgeKeys = (mesh.edges as Array<{ key: string }>).map(e => e.key);
        // v1 i v2 są na wewnętrznym uskoku (gdzie ścianka w0 schodzi w dół o 11mm)
        expect(edgeKeys).toContain('e_groove_g_uskok_v1');
        expect(edgeKeys).toContain('e_groove_g_uskok_v2');

        // v3 i v4 byłyby w powietrzu na wylotowych narożnikach (tył-lewo i tył-prawo) - muszą być pominięte
        expect(edgeKeys).not.toContain('e_groove_g_uskok_v3');
        expect(edgeKeys).not.toContain('e_groove_g_uskok_v4');

        // t3 (wylot z tyłu), t2 (wylot z prawej) i t4 (wylot z lewej) również pominięte
        expect(edgeKeys).not.toContain('e_groove_g_uskok_t2');
        expect(edgeKeys).not.toContain('e_groove_g_uskok_t3');
        expect(edgeKeys).not.toContain('e_groove_g_uskok_t4');

        // t1 (przednia krawędź uskoku na licu formatki) oraz b1..b4 (dno uskoku) są obecne
        expect(edgeKeys).toContain('e_groove_g_uskok_t1');
        expect(edgeKeys).toContain('e_groove_g_uskok_b1');
        expect(edgeKeys).toContain('e_groove_g_uskok_b3');
    });
});

