import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CabinetType, NormalizedCabinetParams } from '../smartframe-types.js';
import {
    ensureSmartFrameWasmInitialized,
    callCabinetPlanWasm,
    isSmartFrameWasmReady,
} from '../smartframe-wasm-bridge.js';
import {
    calculateRogowy1CabinetPlan,
    calculateRogowy90CabinetPlan,
    calculateSkosnyCabinetPlan,
} from '../smartframe-engine.js';

describe('wasm_smartframe offsets (green +Y/-Y, red +X/-X, blue shift)', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(process.cwd(), 'src/wasm/smartframe/wasm_smartframe_bg.wasm');
        const buf = fs.readFileSync(wasmPath);
        const ok = await ensureSmartFrameWasmInitialized(buf);
        expect(ok).toBe(true);
        expect(isSmartFrameWasmReady()).toBe(true);
    });

    const baseDims = { szerokosc_mm: 600, wysokosc_mm: 720, glebokosc_mm: 560 };

    it('applies green (+Y), red (+X), and blue (shiftX/shiftZ) offsets in Rust WASM', () => {
        const params: NormalizedCabinetParams = {
            ...baseDims,
            typ_korpusu: 'korpus3',
            liczba_stref: 1,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 11,
            tryb_wienca_gornego: 'FULL',
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT',
            offsets: {
                'Bok_L_+Y': 25,
                'Bok_L_+X': 15,
                'Bok_L_shiftX': 10,
                'Wieniec_G_shiftZ': -20,
            },
        };
        const plan = callCabinetPlanWasm(baseDims, params);

        expect(plan).not.toBeNull();
        const bokL = plan!.parts.find((p) => p.key === 'BOK_L')!;
        const wieniecG = plan!.parts.find((p) => p.key === 'WIENIEC_G')!;
        const plecy = plan!.parts.find((p) => p.key === 'PLECY')!;

        expect(bokL.dim.x).toBeCloseTo(720 + 25, 4);
        expect(bokL.dim.y).toBeCloseTo(560 + 15, 4);
        expect(bokL.loc.x).toBeCloseTo(-300 + 9 - 10, 4);
        expect(bokL.loc.y).toBeCloseTo(7.5, 4);
        expect(bokL.loc.z).toBeCloseTo(360 + 12.5, 4);

        expect(wieniecG.loc.z).toBeCloseTo(720 - 9 - 20, 4);
        // Wieniec_G_shiftZ = -20 => inwardTop = +20, overlapTop = 11 + 20 = 31 -> back height stays invariant (720 - 36 + 22 = 706)
        expect(plecy.dim.z).toBeCloseTo(720 - 36 + 22, 4);
        // Bok_L_shiftX = 10 => inwardLeft = -10, overlapLeft = 11 - 10 = 1 -> back width stays invariant (600 - 36 + 22 = 586)
        expect(plecy.dim.x).toBeCloseTo(600 - 36 + 22, 4);
    });

    it('applies Plecy_shiftY and back edge overlap shortening on top/bottom panels', () => {
        const params: NormalizedCabinetParams = {
            ...baseDims,
            typ_korpusu: 'korpus3',
            liczba_stref: 1,
            cofniecie_plecow_mm: 20,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 11,
            tryb_wienca_gornego: 'FULL',
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT',
            offsets: {
                'Plecy_shiftY': -5,
                'Plecy_+Y': 20,
            },
        };
        const plan = callCabinetPlanWasm(baseDims, params);

        expect(plan).not.toBeNull();
        const plecy = plan!.parts.find((p) => p.key === 'PLECY')!;
        const wieniecG = plan!.parts.find((p) => p.key === 'WIENIEC_G')!;

        expect(plecy.loc.y).toBeCloseTo(280 + 1.5 - 20 - 5, 4);
        // overlapTop (20 >= 18) -> Wieniec_G shortened to D - backOffset + backShiftY = 560 - 20 - 5 = 535
        expect(wieniecG.dim.y).toBeCloseTo(535, 4);
    });

    it('matches TS parity for korpus_rogowy1 (BLENDA + offsets)', () => {
        const dims = { szerokosc_mm: 1000, wysokosc_mm: 720, glebokosc_mm: 560 };
        const params: NormalizedCabinetParams = {
            ...dims,
            typ_korpusu: 'korpus_rogowy1',
            liczba_stref: 1,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 11,
            tryb_wienca_gornego: 'FULL',
            szerokosc_trawersu_mm: 100,
            szerokosc_blendy_mm: 350,
            strona_blendy: 'RIGHT',
            offsets: { 'BLIND_PANEL_+X': 12, 'BLIND_PANEL_shiftX': -5 },
        };
        const wasmPlan = callCabinetPlanWasm(dims, params)!;
        const tsPlan = calculateRogowy1CabinetPlan(dims, params);

        const wBlenda = wasmPlan.parts.find((p) => p.role === 'BLIND_PANEL')!;
        const tBlenda = tsPlan.parts.find((p) => p.role === 'BLIND_PANEL')!;
        expect(wBlenda.dim.x).toBeCloseTo(tBlenda.dim.x, 4);
        expect(wBlenda.dim.y).toBeCloseTo(tBlenda.dim.y, 4);
        expect(wBlenda.dim.z).toBeCloseTo(tBlenda.dim.z, 4);
        expect(wBlenda.loc.x).toBeCloseTo(tBlenda.loc.x, 4);
        expect(wBlenda.loc.y).toBeCloseTo(tBlenda.loc.y, 4);
        expect(wBlenda.loc.z).toBeCloseTo(tBlenda.loc.z, 4);
    });

    it('matches TS parity for korpus_rogowy90 (L_NOTCH + KATOWA_90 + offsets)', () => {
        const dims = { szerokosc_mm: 900, wysokosc_mm: 720, glebokosc_mm: 900 };
        const params: NormalizedCabinetParams = {
            ...dims,
            typ_korpusu: 'korpus_rogowy90',
            liczba_stref: 1,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 11,
            tryb_wienca_gornego: 'FULL',
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT',
            glebokosc_boku_lewego_mm: 560,
            glebokosc_boku_prawego_mm: 560,
            szerokosc_listwy_naroznej_mm: 100,
            typ_listwy_naroznej: 'KATOWA_90',
            offsets: {
                'Bok_L_+Y': 10,
                'Wieniec_G_shiftZ': -15,
            },
        };
        const wasmPlan = callCabinetPlanWasm(dims, params)!;
        const tsPlan = calculateRogowy90CabinetPlan(dims, params);

        expect(wasmPlan.parts.length).toBe(tsPlan.parts.length);
        for (const tp of tsPlan.parts) {
            const wp = wasmPlan.parts.find((p) => p.key === tp.key)!;
            expect(wp, `missing part ${tp.key}`).toBeDefined();
            expect(wp.dim.x).toBeCloseTo(tp.dim.x, 4);
            expect(wp.dim.y).toBeCloseTo(tp.dim.y, 4);
            expect(wp.dim.z).toBeCloseTo(tp.dim.z, 4);
            expect(wp.loc.x).toBeCloseTo(tp.loc.x, 4);
            expect(wp.loc.y).toBeCloseTo(tp.loc.y, 4);
            expect(wp.loc.z).toBeCloseTo(tp.loc.z, 4);
            if (tp.customProperties?.outline2d) {
                expect(wp.customProperties?.shape).toBe('L_NOTCH');
                expect(wp.customProperties?.outline2d).toHaveLength(tp.customProperties.outline2d.length);
                for (let i = 0; i < tp.customProperties.outline2d.length; i++) {
                    expect(wp.customProperties.outline2d[i][0]).toBeCloseTo(tp.customProperties.outline2d[i][0], 4);
                    expect(wp.customProperties.outline2d[i][1]).toBeCloseTo(tp.customProperties.outline2d[i][1], 4);
                }
            }
        }
    });

    it('matches TS parity for korpus_skosny, korpus_skosny_dach, korpus_skosny_lr, korpus_skosny_lr_uc with offsets', () => {
        const cases: Array<{ typ: CabinetType; offsets: Record<string, number> }> = [
            { typ: 'korpus_skosny', offsets: { 'B_PLECY_shiftY': 4, 'T_WIENIEC_G_shiftZ': -3 } },
            { typ: 'korpus_skosny_dach', offsets: { 'B_PLECY_+Y': 8, 'BOK_L_shiftY': 2 } },
            { typ: 'korpus_skosny_lr', offsets: { 'B_PLECY_-X': 7, 'B_PLECY_+X': 13, 'B_PLECY_+Y': 9 } },
            { typ: 'korpus_skosny_lr_uc', offsets: { 'B_PLECY_-X': 7, 'B_PLECY_+Y': 9, 'B_PLECY_shiftZ': 8 } },
        ];
        for (const c of cases) {
            const dims = { szerokosc_mm: 1200, wysokosc_mm: 2200, glebokosc_mm: 600 };
            const params: NormalizedCabinetParams = {
                ...dims,
                typ_korpusu: c.typ,
                liczba_stref: 1,
                cofniecie_plecow_mm: 15,
                grubosc_plecow_mm: 3,
                wpuszczenie_plecow_mm: 11,
                tryb_wienca_gornego: 'FULL',
                szerokosc_trawersu_mm: 100,
                strona_blendy: 'LEFT',
                wysokosc_przod_mm: 1000,
                wysokosc_tyl_mm: 2200,
                wysokosc_lewy_mm: 1000,
                wysokosc_prawy_mm: 2200,
                offsets: c.offsets,
            };
            const wasmPlan = callCabinetPlanWasm(dims, params)!;
            const tsPlan = calculateSkosnyCabinetPlan(dims, params);

            expect(wasmPlan.parts.length, c.typ).toBe(tsPlan.parts.length);
            for (const tp of tsPlan.parts) {
                const wp = wasmPlan.parts.find((p) => p.key === tp.key)!;
                expect(wp, `${c.typ} missing part ${tp.key}`).toBeDefined();
                expect(wp.dim.x, `${c.typ}:${tp.key}.dim.x`).toBeCloseTo(tp.dim.x, 4);
                expect(wp.dim.y, `${c.typ}:${tp.key}.dim.y`).toBeCloseTo(tp.dim.y, 4);
                expect(wp.dim.z, `${c.typ}:${tp.key}.dim.z`).toBeCloseTo(tp.dim.z, 4);
                expect(wp.loc.x, `${c.typ}:${tp.key}.loc.x`).toBeCloseTo(tp.loc.x, 4);
                expect(wp.loc.y, `${c.typ}:${tp.key}.loc.y`).toBeCloseTo(tp.loc.y, 4);
                expect(wp.loc.z, `${c.typ}:${tp.key}.loc.z`).toBeCloseTo(tp.loc.z, 4);
                if (tp.lcs?.rotation) {
                    expect(wp.lcs?.rotation?.[0]).toBeCloseTo(tp.lcs.rotation[0], 4);
                    expect(wp.lcs?.rotation?.[1]).toBeCloseTo(tp.lcs.rotation[1], 4);
                    expect(wp.lcs?.rotation?.[2]).toBeCloseTo(tp.lcs.rotation[2], 4);
                }
                if (tp.customProperties?.outline2d) {
                    expect(wp.customProperties?.shape).toBe(tp.customProperties.shape);
                    expect(wp.customProperties?.outline2d).toHaveLength(tp.customProperties.outline2d.length);
                    for (let i = 0; i < tp.customProperties.outline2d.length; i++) {
                        expect(wp.customProperties.outline2d[i][0]).toBeCloseTo(tp.customProperties.outline2d[i][0], 4);
                        expect(wp.customProperties.outline2d[i][1]).toBeCloseTo(tp.customProperties.outline2d[i][1], 4);
                    }
                }
                if (tp.customProperties?.backGrooveTrapezoid) {
                    expect(wp.customProperties?.backGrooveTrapezoid).toEqual(tp.customProperties.backGrooveTrapezoid);
                }
                if (tp.edge_banding) {
                    expect(wp.edge_banding instanceof Map).toBe(false);
                    for (const edgeKey of ['+X', '-X', '+Y', '-Y'] as const) {
                        const te = tp.edge_banding[edgeKey];
                        const we = wp.edge_banding?.[edgeKey];
                        if (te) {
                            expect(we?.active, `${c.typ}:${tp.key}.edge_banding.${edgeKey}.active`).toBe(te.active);
                            if (te.cutAngle !== undefined) {
                                expect(we?.cutAngle, `${c.typ}:${tp.key}.edge_banding.${edgeKey}.cutAngle`).toBeCloseTo(te.cutAngle, 4);
                                expect(we?.cutAnchor, `${c.typ}:${tp.key}.edge_banding.${edgeKey}.cutAnchor`).toBe(te.cutAnchor);
                            }
                        }
                    }
                }
            }
        }
    });
});
