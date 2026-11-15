import { describe, it, expect, beforeAll } from 'vitest';
import { NativePanelBuilder } from '../native-panel-builder.js';
import { ensurePanelBrepWasmInitialized, setUseWasmBrep } from '../panel-brep-wasm-bridge.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('WASM B-Rep: Rowki, wpusty, rozcinanie krawędzi formatki (ABS/CAM) i formatki złożone', () => {
    beforeAll(async () => {
        const ok = await ensurePanelBrepWasmInitialized();
        expect(ok).toBe(true);
        setUseWasmBrep(true);
    });

    const W = 564;
    const H = 500;
    const T = 18;

    // 1. Wpust przelotowy przez całą szerokość (nuta pod plecy)
    it('1. Wpust przelotowy rozcina krawędzie nominalne lewą i prawą, zachowując alias i edgeKey pod okleinowanie ABS', () => {
        const builder = new NativePanelBuilder();
        const grooveVMm = 470;
        const grooveThMm = 3;
        const grooveDepthMm = 11;

        const panelModel = {
            role: 'BOTTOM_PANEL',
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            features: [
                {
                    id: 'g_wieniec',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 0,
                        v: grooveVMm,
                        width: W,
                        length: grooveThMm,
                        depth: grooveDepthMm
                    }
                }
            ]
        };

        const res = builder.build(panelModel);
        expect(res).toBeDefined();
        const edges = res.edges as any[];
        expect(edges).toBeDefined();

        // Sprawdzamy krawędzie boczne przod_lewo (lewa strona formatki, x = -W/2, z = +T/2)
        const leftEdges = edges.filter(
            e => (e.alias === 'przod_lewo' || e.key === 'przod_lewo' || e.key.startsWith('przod_lewo_')) &&
                 Math.abs(e.points[0][2] - T / 2) < 0.1
        );
        expect(leftEdges.length).toBe(2);

        // Krawędź musi mieć przypisany alias i edgeKey do okleinowania ABS
        expect(leftEdges[0].alias).toBe('przod_lewo');
        expect(leftEdges[0].edgeKey).toBe('-X');

        // Sprawdzamy przerwę między segmentami krawędzi (dokładnie szerokość wpustu 3mm)
        leftEdges.sort((a, b) => a.points[0][1] - b.points[0][1]);
        const seg1MaxY = Math.max(leftEdges[0].points[0][1], leftEdges[0].points[1][1]);
        const seg2MinY = Math.min(leftEdges[1].points[0][1], leftEdges[1].points[1][1]);
        const gap = seg2MinY - seg1MaxY;
        expect(gap).toBeCloseTo(grooveThMm, 1);

        // Krawędź prawa przod_prawo również musi być rozcięta na 2 odcinki z przerwą 3mm
        const rightEdges = edges.filter(
            e => (e.alias === 'przod_prawo' || e.key === 'przod_prawo' || e.key.startsWith('przod_prawo_')) &&
                 Math.abs(e.points[0][2] - T / 2) < 0.1
        );
        expect(rightEdges.length).toBe(2);
        expect(rightEdges[0].alias).toBe('przod_prawo');
        expect(rightEdges[0].edgeKey).toBe('+X');

        // Sprawdzamy krawędzie B-Rep samego rowka
        const edgeKeys = edges.map(e => e.key);
        // Fałszywe linie zamykające wloty w powietrzu na brzegu (t4 i t2) nie mogą istnieć
        expect(edgeKeys).not.toContain('e_groove_g_wieniec_t4');
        expect(edgeKeys).not.toContain('e_groove_g_wieniec_t2');
        // Krawędzie podłużne wpustu wewnątrz materiału (t1, t3) oraz dno i piony muszą istnieć
        expect(edgeKeys).toContain('e_groove_g_wieniec_t1');
        expect(edgeKeys).toContain('e_groove_g_wieniec_t3');
        expect(edgeKeys).toContain('e_groove_g_wieniec_b1');
        expect(edgeKeys).toContain('e_groove_g_wieniec_b3');
    });

    // 2. Rowek ślepy (nieprzelotowy, np. frezowany kanał LED zatrzymujący się przed krawędziami formatki)
    it('2. Rowek ślepy (nieprzelotowy) zachowuje wszystkie 4 krawędzie obwodu wpustu (t1..t4) i nie rozcina krawędzi formatki', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            features: [
                {
                    id: 'kanal_led',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 50,
                        v: 100,
                        width: 400,
                        length: 12,
                        depth: 6
                    }
                }
            ]
        };

        const res = builder.build(panelModel);
        expect(res).toBeDefined();
        const edges = res.edges as any[];
        const edgeKeys = edges.map(e => e.key);

        // Wszystkie 4 krawędzie górne rowka ślepego muszą istnieć wewnątrz materiału
        expect(edgeKeys).toContain('e_groove_kanal_led_t1');
        expect(edgeKeys).toContain('e_groove_kanal_led_t2');
        expect(edgeKeys).toContain('e_groove_kanal_led_t3');
        expect(edgeKeys).toContain('e_groove_kanal_led_t4');

        // Krawędzie obrysu formatki nie powinny być rozcięte
        const leftEdges = edges.filter(e => e.alias === 'przod_lewo');
        expect(leftEdges.length).toBe(1);
    });

    // 3. Rewizja brzegowa wycinająca krawędź formatki na wylot
    it('3. Rewizja brzegowa rozcina krawędź formatki na wylot (zarówno Z+, jak i Z-)', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            features: [
                {
                    id: 'wyciecie_pod_rury',
                    type: 'cutout',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 0,
                        v: 150,
                        width: 100,
                        length: 120,
                        depth: 18,
                        through: true
                    }
                }
            ]
        };

        const res = builder.build(panelModel);
        expect(res).toBeDefined();
        const edges = res.edges as any[];

        // Zarówno górna krawędź przod_lewo, jak i dolna tyl_lewo muszą zostać rozcięte na 2 odcinki
        const topEdges = edges.filter(e => e.alias === 'przod_lewo' && Math.abs(e.points[0][2] - T / 2) < 0.1);
        const botEdges = edges.filter(e => e.alias === 'tyl_lewo' && Math.abs(e.points[0][2] + T / 2) < 0.1);

        expect(topEdges.length).toBe(2);
        expect(botEdges.length).toBe(2);

        // Przerwa wynosi dokładnie długość wycięcia 120mm
        topEdges.sort((a, b) => a.points[0][1] - b.points[0][1]);
        const topGap = Math.min(topEdges[1].points[0][1], topEdges[1].points[1][1]) -
                       Math.max(topEdges[0].points[0][1], topEdges[0].points[1][1]);
        expect(topGap).toBeCloseTo(120, 1);
    });

    // 4. FORMATKA ZŁOŻONA: Jednoczesne występowanie kieszeni, wpustu przelotowego, otworów i rewizji
    it('4. Złożona formatka meblowa: kieszeń + wpust przelotowy + otwory zawiasów + rewizja zachowuje pełną spójność B-Rep', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(18),
            features: [
                // 1. Kieszeń (ramka witryny)
                {
                    id: 'ramka_glowna',
                    type: 'pocket',
                    face: 'FACE_Z_PLUS',
                    params: { u: 60, v: 60, width: 480, length: 680, depth: 3, through: false }
                },
                // 2. Wpust przelotowy (nuta pod plecy) na Z_MINUS
                {
                    id: 'nuta_plecy',
                    type: 'groove',
                    face: 'FACE_Z_MINUS',
                    params: { u: 0, v: 760, width: 600, length: 4, depth: 8, through: false }
                },
                // 3. Otwór puszki zawiasu fi 35 w dnie kieszeni
                {
                    id: 'zawias_1',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 100, v: 100, diameter: 35, depth: 12, through: false }
                },
                // 4. Rewizja przelotowa wewnątrz witryny
                {
                    id: 'wyciecie_srodek',
                    type: 'cutout',
                    face: 'FACE_Z_PLUS',
                    params: { u: 200, v: 300, width: 200, length: 200, depth: 18, through: true }
                }
            ]
        };

        const res = builder.build(panelModel);
        expect(res).toBeDefined();

        // Sprawdzamy obecność siatek wszystkich ścian
        expect(res.FACE_Z_PLUS?.positions?.length).toBeGreaterThan(0);
        expect(res.FACE_Z_MINUS?.positions?.length).toBeGreaterThan(0);
        expect(res.feature_ramka_glowna_bottom?.positions?.length).toBeGreaterThan(0);
        expect(res.feature_nuta_plecy_bottom?.positions?.length).toBeGreaterThan(0);

        // Rewizja przelotowa nie może mieć siatki dna
        expect(res.feature_wyciecie_srodek_bottom).toBeUndefined();

        // Krawędzie B-Rep:
        const edges = res.edges as any[];
        // Krawędź puszki zawiasu leży na dnie kieszeni (Z = +6)
        const holeEdge = edges.find(e => e.key === 'e_hole_zawias_1');
        expect(holeEdge).toBeDefined();
        expect(holeEdge.points[0][2]).toBeCloseTo(6.0, 1);

        // Krawędzie wpustu nuta_plecy na Z_MINUS: brak fałszywych linii wlotowych t4/t2
        const edgeKeys = edges.map(e => e.key);
        expect(edgeKeys).not.toContain('e_groove_nuta_plecy_t4');
        expect(edgeKeys).not.toContain('e_groove_nuta_plecy_t2');
        expect(edgeKeys).toContain('e_groove_nuta_plecy_t1');
        expect(edgeKeys).toContain('e_groove_nuta_plecy_t3');
    });
});

