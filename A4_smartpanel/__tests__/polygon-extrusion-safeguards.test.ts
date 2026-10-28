import { describe, it, expect } from 'vitest';
import { deriveOutlineWithCutouts } from '../native_core/polygon-extrusion.js';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('polygon-extrusion safeguards — odporność na brak ID i fail-fast', () => {
    it('cecha wycięcia bez pola id nie usuwa innych cech bez id', () => {
        // Formatka ma wycięcie brzegowe (bez id) oraz wiercenie (bez id)
        const cutoutNoId = {
            type: 'cutout',
            params: { u: 0, v: 0, width: 50, length: 50 }
        };
        const holeNoId = {
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 200, v: 200, diameter: 35, depth: 12 }
        };

        const derived = deriveOutlineWithCutouts(600, 400, 18, [cutoutNoId, holeNoId]);
        expect(derived).not.toBeNull();
        if (!derived) return;

        // Zużyte cechy zawierają dokładnie referencję cutoutNoId
        expect(derived.consumedFeatures.has(cutoutNoId)).toBe(true);
        expect(derived.consumedFeatures.has(holeNoId)).toBe(false);

        // buildMeshFromPanel zachowuje otwór holeNoId
        const mesh = buildMeshFromPanel({
            role: 'PANEL',
            width: mmToNm(600),
            height: mmToNm(400),
            thickness: mmToNm(18),
            features: [cutoutNoId, holeNoId]
        });

        // Otwór holeNoId musi istnieć w wygenerowanych krawędziach
        const edgeKeys = (mesh.edges as Array<{ key: string }>).map(e => e.key);
        expect(edgeKeys.some(k => k.startsWith('e_hole_'))).toBe(true);
    });

    it('rzuca błąd fail-fast gdy wycięcie brzegowe rozcina formatkę na osobne części', () => {
        // Wycięcie na wylot przez całą szerokość formatki (np. u: 0..600, v: 150..250)
        const throughCut = {
            id: 'cut_split',
            type: 'cutout',
            params: { u: 0, v: 150, width: 600, length: 100 }
        };

        expect(() => {
            deriveOutlineWithCutouts(600, 400, 18, [throughCut]);
        }).toThrow(/rozcina formatkę na 2 osobne części/);
    });
});
