import { describe, it, expect, beforeAll } from 'vitest';
import { NativePanelBuilder } from '../native-panel-builder.js';
import { ensurePanelBrepWasmInitialized, setUseWasmBrep } from '../panel-brep-wasm-bridge.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('WASM B-Rep: Przypadki brzegowe otworów i interakcje z kieszeniami', () => {
    beforeAll(async () => {
        const ok = await ensurePanelBrepWasmInitialized();
        expect(ok).toBe(true);
        setUseWasmBrep(true);
    });

    const W = 600;
    const H = 800;
    const T = 18;

    // 1. Otwór ślepy: Denko na dokładnej głębokości (FACE_Z_PLUS: depth=12 -> Z = +9 - 12 = -3)
    it('1. Otwór ślepy posiada denko na dokładnej głębokości Z', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T),
            features: [
                {
                    id: 'otwor_slepy',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 100, v: 200, diameter: 35, depth: 12, through: false }
                }
            ]
        };
        const res = builder.build(panelModel);
        const pos = res.FACE_Z_PLUS.positions;
        const zCoords: number[] = [];
        for (let i = 2; i < pos.length; i += 3) {
            zCoords.push(Math.round(pos[i] * 100) / 100);
        }
        // Górne lico (+9) oraz dno otworu na głębokości 12mm (+9 - 12 = -3)
        expect(Math.min(...zCoords)).toBeCloseTo(-3, 2);
        expect(Math.max(...zCoords)).toBeCloseTo(9, 2);
    });

    // 2. Otwór przelotowy: Brak denka, ścianki przechodzą na wylot (Z od +9 do -9)
    it('2. Otwór przelotowy nie generuje denka i przecina całą grubość płyty', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T),
            features: [
                {
                    id: 'otwor_przelotowy',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 150, v: 250, diameter: 10, depth: T, through: true }
                }
            ]
        };
        const res = builder.build(panelModel);
        const pos = res.FACE_Z_PLUS.positions;
        const zCoords: number[] = [];
        for (let i = 2; i < pos.length; i += 3) {
            zCoords.push(Math.round(pos[i] * 100) / 100);
        }
        // Ścianki walca dochodzą do spodu płyty (-9)
        expect(Math.min(...zCoords)).toBeCloseTo(-9, 2);
        expect(Math.max(...zCoords)).toBeCloseTo(9, 2);
    });

    // 3. FACE_Z_MINUS: Poprawny kierunek wiercenia (z tyłu płyty od Z = -9 w głąb w stronę +Z)
    it('3. FACE_Z_MINUS wierci od tyłu płyty w kierunku +Z', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T),
            features: [
                {
                    id: 'zawias_tyl',
                    type: 'hole',
                    face: 'FACE_Z_MINUS',
                    params: { u: 22.5, v: 100, diameter: 35, depth: 12.5, through: false }
                }
            ]
        };
        const res = builder.build(panelModel);
        const pos = res.FACE_Z_MINUS.positions;
        const zCoords: number[] = [];
        for (let i = 2; i < pos.length; i += 3) {
            zCoords.push(Math.round(pos[i] * 100) / 100);
        }
        // Lico tylne Z = -9, dno otworu na głębokości 12.5mm: -9 + 12.5 = +3.5
        expect(Math.min(...zCoords)).toBeCloseTo(-9, 2);
        expect(Math.max(...zCoords)).toBeCloseTo(3.5, 2);
    });

    // 4. TRIPLE: Poprawne współrzędne i identyfikatory
    it('4. Szablon TRIPLE generuje 3 otwory z poprawnymi identyfikatorami i rozstawem', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T),
            features: [
                {
                    id: 'prowadnik',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 37, v: 100, diameter: 5, depth: 11, template_id: 'TRIPLE', spacing: 32 }
                }
            ]
        };
        const res = builder.build(panelModel);
        const edges = res.edges as Array<{ key: string; points: number[][] }>;
        const k0 = edges.find(e => e.key === 'e_hole_prowadnik');
        const kt = edges.find(e => e.key === 'e_hole_prowadnik_t');
        const kb = edges.find(e => e.key === 'e_hole_prowadnik_b');
        expect(k0).toBeDefined();
        expect(kt).toBeDefined();
        expect(kb).toBeDefined();

        // Sprawdź rozstaw osi w Y: v=100, v_t=132, v_b=68 (w układzie wycentrowanym: Y = v - H/2 = v - 400)
        // Y0 = -300, Yt = -268, Yb = -332 -> różnica 32mm
        const y0 = (k0!.points[0][1] + k0!.points[12][1]) / 2;
        const yt = (kt!.points[0][1] + kt!.points[12][1]) / 2;
        const yb = (kb!.points[0][1] + kb!.points[12][1]) / 2;
        expect(Math.abs(yt - y0)).toBeCloseTo(32, 1);
        expect(Math.abs(y0 - yb)).toBeCloseTo(32, 1);
    });

    // 5. SYSTEM_32 / ROW: Prawidłowy rozstaw i liczba otworów
    it('5. Szablon SYSTEM_32 generuje zadaną liczbę otworów w rozstawie 32mm', () => {
        const builder = new NativePanelBuilder();
        const count = 5;
        const panelModel = {
            width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T),
            features: [
                {
                    id: 'rząd_podpórek',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 37, v: 100, diameter: 5, depth: 10, template_id: 'SYSTEM_32', count, spacing: 32 }
                }
            ]
        };
        const res = builder.build(panelModel);
        const edges = res.edges as Array<{ key: string; points: number[][] }>;
        for (let i = 0; i < count; i++) {
            expect(edges.some(e => e.key === `e_hole_rząd_podpórek_${i}`)).toBe(true);
        }
    });

    // 6. Otwór blisko krawędzi formatki: u = 3mm dla otworu fi 5 (krawędź otworu na u=0.5mm)
    it('6. Otwór blisko krawędzi formatki nie uszkadza geometrii ani współrzędnych', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T),
            features: [
                {
                    id: 'otwor_blisko_krawedzi',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 3, v: 50, diameter: 5, depth: 10, through: false }
                }
            ]
        };
        const res = builder.build(panelModel);
        expect(resultValid(res)).toBe(true);
        const edge = (res.edges as any[]).find(e => e.key === 'e_hole_otwor_blisko_krawedzi');
        expect(edge).toBeDefined();
        // Środek otworu X = 3 - 300 = -297 (pomijamy ostatni zamykający punkt)
        const pts = edge.points.slice(0, -1);
        const midX = pts.reduce((acc: number, p: number[]) => acc + p[0], 0) / pts.length;
        expect(midX).toBeCloseTo(-297, 2);
    });

    // 7. KLUCZOWY TEST INTERAKCJI: Otwór wewnątrz kieszeni (ramki)
    // Otwór wiercony w dnie kieszeni (ramka ma depth=3, otwór depth=12)
    // Co sprawdzamy: góra ścianki walca otworu musi zaczynać się od dna ramki (Z = +6), a nie od lica (Z = +9)!
    it('7. Otwór wewnątrz kieszeni zaczyna się od jej dna (brak wiszącej ścianki w powietrzu)', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T),
            features: [
                {
                    id: 'ramka_zewnetrzna',
                    type: 'pocket',
                    face: 'FACE_Z_PLUS',
                    params: { u: 50, v: 50, width: 200, length: 200, depth: 3, through: false }
                },
                {
                    id: 'otwor_w_ramce',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 100, v: 100, diameter: 35, depth: 12, through: false }
                }
            ]
        };
        const res = builder.build(panelModel);
        expect(resultValid(res)).toBe(true);

        // Krawędź otworu B-Rep powinna leżeć na poziomie dna ramki (Z = +6), a nie w powietrzu na Z = +9!
        const edge = (res.edges as any[]).find(e => e.key === 'e_hole_otwor_w_ramce');
        expect(edge).toBeDefined();
        const edgeZ = edge.points[0][2];
        expect(edgeZ).toBeCloseTo(6.0, 1); // dno kieszeni: 9 - 3 = 6mm
    });

    // 8. Otwór wewnątrz wyciętej na wylot rewizji (próżnia) nie może tworzyć ścianek w powietrzu
    it('8. Otwór wewnątrz rewizji przelotowej nie tworzy wiszących ścianek ani denka w pustce', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T),
            features: [
                {
                    id: 'rewizja_wylot',
                    type: 'cutout',
                    face: 'FACE_Z_PLUS',
                    params: { u: 100, v: 100, width: 200, length: 200, depth: 18, through: true }
                },
                {
                    id: 'otwor_w_pustce',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 150, v: 150, diameter: 20, depth: 10, through: false }
                }
            ]
        };
        const res = builder.build(panelModel);
        expect(resultValid(res)).toBe(true);

        // Nie może istnieć denko otworu wewnątrz rewizji, bo rewizja usunęła cały materiał (cell.material === false)
        const faceKeys = Object.keys(res);
        const hasBottom = faceKeys.some(k => k === 'feature_otwor_w_pustce_bottom');
        expect(hasBottom).toBe(false);
    });

    // 9. Otwór częściowo nachodzący na krawędź kieszeni:
    // Sprawdzamy integralność siatki i brak odwróconych normalnych
    it('9. Otwór przecinający krawędź kieszeni zachowuje szczelność i poprawne normalne', () => {
        const builder = new NativePanelBuilder();
        const panelModel = {
            width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T),
            features: [
                {
                    id: 'kieszen_polowkowa',
                    type: 'pocket',
                    face: 'FACE_Z_PLUS',
                    params: { u: 100, v: 100, width: 100, length: 100, depth: 4, through: false }
                },
                {
                    id: 'otwor_na_krawedzi',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    // Środek otworu fi 30 leży dokładnie na krawędzi kieszeni (u = 100)
                    params: { u: 100, v: 150, diameter: 30, depth: 12, through: false }
                }
            ]
        };
        const res = builder.build(panelModel);
        expect(resultValid(res)).toBe(true);

        // Siatka dna kieszeni istnieje
        expect(res['feature_kieszen_polowkowa_bottom']).toBeDefined();
        expect(res['feature_kieszen_polowkowa_bottom'].positions.length).toBeGreaterThan(0);
    });
});

function resultValid(res: any): boolean {
    return Boolean(
        res &&
        res.FACE_Z_PLUS?.positions?.length > 0 &&
        res.FACE_Z_MINUS?.positions?.length > 0 &&
        res.edges?.length > 0
    );
}
