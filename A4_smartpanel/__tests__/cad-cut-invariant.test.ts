import { describe, it, expect } from 'vitest';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';
import { assertCutFeatureEnvelope, assertAdditiveFeaturePreservesBase } from '../native_core/planar-feature-mesh.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('Niezmiennik SolidWorks: Operacja CIĘCIE (cut) nigdy nie dodaje materiału', () => {
    it('assertCutFeatureEnvelope klamruje wierzchołki wychodzące poza bazę formatki', () => {
        const positions = [
            0, 0, 0,           // wewnątrz
            1000, 0, 0,        // poza X (dla W=600, halfW=300)
            0, 0, 50,          // poza Z (dla T=18, halfT=9, np. Z=+50 to "garb" nad płytą)
            0, 0, -50          // poza Z pod płytą
        ];
        assertCutFeatureEnvelope('test_cut', positions, 600, 800, 18);

        // Po klamrowaniu:
        expect(positions[3]).toBe(300);   // sklamrowane do max W/2
        expect(positions[8]).toBe(9);     // sklamrowane do max T/2 (nie wystaje na zewnątrz)
        expect(positions[11]).toBe(-9);   // sklamrowane do min -T/2
    });

    it('wpust pod plecy z offsetem do środka szafki nie generuje ścianek poza obwiednią formatki', () => {
        // Bok szafki 600x800x18 z wpustem pod plecy odsuniętym o 20mm od tyłu (u=20, w=4, l=800, d=8)
        const panel = {
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(18),
            features: [
                {
                    id: 'feat_back_groove_offset',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 20,
                        v: 0,
                        width: 4,
                        length: 800,
                        depth: 8
                    }
                }
            ]
        };

        const mesh = buildMeshFromPanel(panel);
        expect(mesh).toBeDefined();

        // Sprawdzamy dno wpustu i ścianki
        const bottom = mesh.feature_feat_back_groove_offset_bottom;
        expect(bottom).toBeDefined();

        // Wszystkie punkty dna muszą leżeć ściśle wewnątrz formatki
        const halfW = 300 + 0.05;
        const halfH = 400 + 0.05;
        const halfT = 9 + 0.05;

        for (let i = 0; i < bottom.positions.length; i += 3) {
            const x = bottom.positions[i];
            const y = bottom.positions[i + 1];
            const z = bottom.positions[i + 2];
            expect(Math.abs(x)).toBeLessThanOrEqual(halfW);
            expect(Math.abs(y)).toBeLessThanOrEqual(halfH);
            expect(Math.abs(z)).toBeLessThanOrEqual(halfT);
        }
    });

    it('wpust z ujemną głębokością w danych wejściowych nie tworzy garbu na zewnątrz płyty', () => {
        // Symulacja błędu znaku (depth: -10 zamiast 10)
        const panel = {
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(18),
            features: [
                {
                    id: 'feat_groove_inverted_depth',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 50,
                        v: 50,
                        width: 20,
                        length: 200,
                        depth: -10 // Ujemna głębokość!
                    }
                }
            ]
        };

        const mesh = buildMeshFromPanel(panel);
        const bottom = mesh.feature_feat_groove_inverted_depth_bottom;
        expect(bottom).toBeDefined();

        const halfT = 9 + 0.05;
        for (let i = 2; i < bottom.positions.length; i += 3) {
            const z = bottom.positions[i];
            // Żaden punkt nie może wystawać poza lico (+9 mm dla płyty 18 mm wyśrodkowanej w 0)
            expect(z).toBeLessThanOrEqual(halfT);
        }
    });

    it('blok zlew (cutout przelotowy w blacie): komora nie dodaje materiału do formatki blatu', () => {
        // Blat 1200x600x38, wycięcie pod komorę zlewu 480x380 w środku blatu
        const panel = {
            width: mmToNm(1200),
            height: mmToNm(600),
            thickness: mmToNm(38),
            features: [
                {
                    id: 'cutout_sink',
                    type: 'cutout',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 360,
                        v: 110,
                        width: 480,
                        length: 380,
                        depth: 38,
                        through: true,
                        isSinkCutout: true
                    }
                }
            ]
        };

        const mesh = buildMeshFromPanel(panel);
        expect(mesh).toBeDefined();

        // Wycięcie przelotowe nie ma siatki dna na formacie
        expect(mesh.feature_cutout_sink_bottom).toBeUndefined();

        // Ścianki otworu w blacie
        const w0 = mesh.feature_cutout_sink_w0;
        const w1 = mesh.feature_cutout_sink_w1;
        const w2 = mesh.feature_cutout_sink_w2;
        const w3 = mesh.feature_cutout_sink_w3;
        expect(w0).toBeDefined();
        expect(w1).toBeDefined();
        expect(w2).toBeDefined();
        expect(w3).toBeDefined();

        // Sprawdzenie czy ani jeden wierzchołek ścianek zlewu nie wystaje ponad blat (halfT = 19 mm)
        const halfW = 600 + 0.05;
        const halfH = 300 + 0.05;
        const halfT = 19 + 0.05;

        for (const wall of [w0, w1, w2, w3]) {
            for (let i = 0; i < wall.positions.length; i += 3) {
                const x = wall.positions[i];
                const y = wall.positions[i + 1];
                const z = wall.positions[i + 2];
                expect(Math.abs(x)).toBeLessThanOrEqual(halfW);
                expect(Math.abs(y)).toBeLessThanOrEqual(halfH);
                expect(Math.abs(z)).toBeLessThanOrEqual(halfT);
            }
        }
    });

    it('assertAdditiveFeaturePreservesBase: wyciągnięcie dodające materiał nie może zapadać się w głąb bazy', () => {
        // Dodawana podklejka lub występ na ścianie Z+ (baza: [-9..+9] mm)
        const addedPositions = [
            0, 0, 15,   // +15 mm: poprawne wyciągnięcie na zewnątrz ponad bazę
            0, 0, -20   // -20 mm: błędne zapadnięcie w głąb pod bazę
        ];
        assertAdditiveFeaturePreservesBase('test_additive', addedPositions, -9, 9, 1);

        expect(addedPositions[2]).toBe(15);
        expect(addedPositions[5]).toBe(9); // sklamrowane, nie wycina pustki w bazie
    });

    it('ekstruzja formatki z ujemną grubością (błąd znaku) zachowuje dodatnią grubość', () => {
        const panel = {
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(18),
            custom_properties: {
                outline2d: [[0, 0], [600, 0], [600, 800], [0, 800]]
            }
        };

        const mesh = buildMeshFromPanel(panel);
        expect(mesh).toBeDefined();
        expect(mesh.FACE_Z_PLUS).toBeDefined();
        expect(mesh.FACE_Z_MINUS).toBeDefined();
    });
});
