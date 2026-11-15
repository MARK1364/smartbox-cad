import { describe, it, expect, beforeAll } from 'vitest';
import { NativePanelBuilder } from '../native-panel-builder.js';
import {
    ensurePanelBrepWasmInitialized,
    isModelSupportedByPanelBrep,
    setUseWasmBrep
} from '../panel-brep-wasm-bridge.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

function simpleModel(features: any[] = []) {
    return {
        width: mmToNm(500),
        height: mmToNm(800),
        thickness: mmToNm(18),
        features,
    };
}

describe('NativePanelBuilder z flagą USE_WASM_BREP', () => {
    beforeAll(async () => {
        const ok = await ensurePanelBrepWasmInitialized();
        expect(ok).toBe(true);
        setUseWasmBrep(true);
    });

    it('generuje poprawną geometrię TypedArray przez WASM B-Rep z zachowaniem tożsamości ścian', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(500),
            height: mmToNm(800),
            thickness: mmToNm(18),
            features: [
                {
                    id: 'feat_rewizja',
                    type: 'cutout',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 100,
                        v: 20,
                        width: 120,
                        length: 140,
                        through: true
                    }
                },
                {
                    id: 'feat_ramka',
                    type: 'pocket',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 60,
                        v: 60,
                        width: 380,
                        length: 680,
                        depth: 3
                    }
                }
            ]
        };

        const result = builder.build(panelModel);

        expect(result).toBeDefined();
        // Sprawdź czy TypedArray są poprawnie wygenerowane pod Babylon.js
        expect(result.FACE_Z_PLUS).toBeDefined();
        expect(result.FACE_Z_PLUS.positions).toBeInstanceOf(Float32Array);
        expect(result.FACE_Z_PLUS.indices).toBeInstanceOf(Uint32Array);

        expect(result.FACE_Z_MINUS).toBeDefined();
        expect(result.FACE_Z_MINUS.positions).toBeInstanceOf(Float32Array);

        // Schodkowanie ścianki rewizji w świetle ramki
        expect(result.feature_feat_rewizja_w3).toBeDefined();
        const w3Pos = result.feature_feat_rewizja_w3.positions;
        const zLevels = new Set<number>();
        for (let i = 2; i < w3Pos.length; i += 3) {
            zLevels.add(Math.round(w3Pos[i] * 100) / 100);
        }
        expect([...zLevels].sort((a, b) => a - b)).toEqual([-9, 6, 9]);

        // Dno ramki
        expect(result.feature_feat_ramka_bottom).toBeDefined();
        expect(result.feature_feat_ramka_bottom.positions).toBeInstanceOf(Float32Array);
    });

    it('rozpoznaje modele obsługiwane przez kernel 2.5D', () => {
        const sideHole = simpleModel([{
            id: 'side_hole', type: 'hole', face: 'FACE_X_PLUS',
            params: { u: 50, v: 50, diameter: 8 },
        }]);
        const badType = simpleModel([{
            id: 'bad', type: 'fillet', face: 'FACE_Z_PLUS', params: {},
        }]);

        expect(isModelSupportedByPanelBrep(simpleModel())).toBe(true);
        expect(isModelSupportedByPanelBrep({
            ...simpleModel(),
            panelForm: 'ALU_FRAME',
        })).toBe(true);
        expect(isModelSupportedByPanelBrep({
            ...simpleModel(),
            custom_properties: { outline2d: [[0, 0], [100, 0], [100, 100]] },
        })).toBe(true);
        expect(isModelSupportedByPanelBrep(sideHole)).toBe(true);
        expect(isModelSupportedByPanelBrep(badType)).toBe(false);
    });

    it('dla nieobsługiwanego modelu wraca synchronicznie do silnika TS', () => {
        const unsupported = simpleModel([{
            id: 'bad_fillet', type: 'fillet', face: 'FACE_Z_PLUS',
            params: { u: 50, v: 50 },
        }]);

        const builder = new NativePanelBuilder();
        try {
            setUseWasmBrep(true);
            const viaBridge = builder.build(unsupported);

            setUseWasmBrep(false);
            const viaTs = builder.build(unsupported);

            expect(Object.keys(viaBridge).sort()).toEqual(Object.keys(viaTs).sort());
            expect(viaBridge.FACE_Z_PLUS).toBeDefined();
            expect(viaBridge.FACE_Z_PLUS.positions.length).toBe(viaTs.FACE_Z_PLUS.positions.length);
        } finally {
            setUseWasmBrep(true);
        }
    });
});

