import { describe, it, expect, beforeAll } from 'vitest';
import { NativePanelBuilder } from '../native-panel-builder.js';
import { ensurePanelBrepWasmInitialized, setUseWasmBrep } from '../panel-brep-wasm-bridge.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('Inspekcja krawędzi Case 2: Rewizja brzegowa + Ramka (pocket)', () => {
    beforeAll(async () => {
        await ensurePanelBrepWasmInitialized();
    });

    it('wypisuje krawędzie wygenerowane przez TS i WASM dla Case 2', () => {
        const W = 500, H = 800, T = 18;
        const panelData = {
            role: 'SIDE_PANEL',
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            features: [
                {
                    id: 'feat_rewizja_edge',
                    type: 'cutout',
                    name: 'Rewizja brzegowa',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 0, v: 80, width: 120, length: 80, depth: T, through: true,
                        u_nm: mmToNm(0), v_nm: mmToNm(80), width_nm: mmToNm(120), length_nm: mmToNm(80), depth_nm: mmToNm(T)
                    }
                },
                {
                    id: 'feat_ramka',
                    type: 'pocket',
                    name: 'Ramka',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 60, v: 60, width: W - 120, length: H - 120, depth: 3, through: false,
                        u_nm: mmToNm(60), v_nm: mmToNm(60), width_nm: mmToNm(W - 120), length_nm: mmToNm(H - 120), depth_nm: mmToNm(3)
                    }
                }
            ]
        };

        const builder = new NativePanelBuilder();

        setUseWasmBrep(false);
        const resTs = builder.build(panelData);

        setUseWasmBrep(true);
        const resWasm = builder.build(panelData);

        // Sprawdzamy krawędzie WASM w rejonie kolizji ramki i rewizji
        const t2 = resWasm.edges.find((e: any) => e.key === 'e_groove_feat_rewizja_edge_t2');
        expect(t2).toBeDefined();
        // t2 (prawa krawędź rewizji w świetle ramki) musi biec na dnie ramki Z = 6.0, a nie w powietrzu na Z = 9.0
        expect(t2.points[0][2]).toBeCloseTo(6.0, 1);
        expect(t2.points[1][2]).toBeCloseTo(6.0, 1);

        const t3_in_ramka = resWasm.edges.find((e: any) => e.key === 'e_groove_feat_rewizja_edge_t3');
        expect(t3_in_ramka).toBeDefined();
        // t3 od -130 do -190 biegnie na Z = 6.0
        expect(t3_in_ramka.points[0][2]).toBeCloseTo(6.0, 1);
        expect(t3_in_ramka.points[1][2]).toBeCloseTo(6.0, 1);

        const t3_on_face = resWasm.edges.find((e: any) => e.key === 'e_groove_feat_rewizja_edge_t3_seg2');
        expect(t3_on_face).toBeDefined();
        // t3 od -190 do -250 biegnie na licu Z = 9.0
        expect(t3_on_face.points[0][2]).toBeCloseTo(9.0, 1);
        expect(t3_on_face.points[1][2]).toBeCloseTo(9.0, 1);

        // Pionowy uskok łączący poziom Z = 6.0 i Z = 9.0
        const step = resWasm.edges.find((e: any) => e.key === 'e_groove_feat_rewizja_edge_t3_step1');
        expect(step).toBeDefined();
        expect(Math.min(step.points[0][2], step.points[1][2])).toBeCloseTo(6.0, 1);
        expect(Math.max(step.points[0][2], step.points[1][2])).toBeCloseTo(9.0, 1);
    });
});
