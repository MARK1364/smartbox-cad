import { describe, it, expect, beforeAll } from 'vitest';
import { NativePanelBuilder } from '../native-panel-builder.js';
import { ensurePanelBrepWasmInitialized, setUseWasmBrep } from '../panel-brep-wasm-bridge.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('WASM B-Rep: Otwory walcowe (puszka zawiasu fi35, wkręty montażowe, kołki)', () => {
    beforeAll(async () => {
        const ok = await ensurePanelBrepWasmInitialized();
        expect(ok).toBe(true);
        setUseWasmBrep(true);
    });

    it('generuje ścianki walca i krawędzie analityczne B-Rep e_hole_*', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            features: [
                {
                    id: 'zawias_puszka_1',
                    type: 'hole',
                    face: 'FACE_Z_MINUS',
                    params: {
                        u: 22.5,
                        v: 100,
                        diameter: 35,
                        depth: 12.5,
                        through: false
                    }
                },
                {
                    id: 'wkrety_montazowe',
                    type: 'hole',
                    face: 'FACE_Z_MINUS',
                    params: {
                        u: 22.5,
                        v: 100,
                        diameter: 5,
                        depth: 10,
                        template_id: 'TRIPLE',
                        spacing: 22.5
                    }
                }
            ]
        };

        const result = builder.build(panelModel);

        expect(result).toBeDefined();
        expect(result.FACE_Z_MINUS).toBeDefined();

        // Krawędzie B-Rep pod moduł CNC i wymiarowanie
        const edges = result.edges as Array<{ key: string; points: number[][] }>;
        expect(edges).toBeDefined();

        const puszkaEdge = edges.find(e => e.key === 'e_hole_zawias_puszka_1');
        expect(puszkaEdge).toBeDefined();
        expect(puszkaEdge!.points.length).toBeGreaterThanOrEqual(25);

        // Sprawdź czy krawędź otworu ma poprawny promień R = 17.5 mm (średnica fi 35)
        const half = Math.floor((puszkaEdge!.points.length - 1) / 2);
        const p0 = puszkaEdge!.points[0];
        const pOpposite = puszkaEdge!.points[half];
        const dist = Math.hypot(pOpposite[0] - p0[0], pOpposite[1] - p0[1]);
        expect(dist).toBeCloseTo(35.0, 1);

        // Sprawdź otwory z szablonu TRIPLE: główny + góra (_t) + dół (_b)
        expect(edges.some(e => e.key === 'e_hole_wkrety_montazowe')).toBe(true);
        expect(edges.some(e => e.key === 'e_hole_wkrety_montazowe_t')).toBe(true);
        expect(edges.some(e => e.key === 'e_hole_wkrety_montazowe_b')).toBe(true);
    });
});

