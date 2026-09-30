import { describe, it, expect } from 'vitest';
import { buildMeshFromPanel } from '../native_core/mesh_builder';
import { parseFeatureFaceKey, featureIdFromBrepEdgeKey } from '../native_core/cap-machining';
import { mmToNm } from '../../A1_core/cad-math/units';

describe('feature planes z B-rep (groove)', () => {
    it('parseFeatureFaceKey obsługuje id z podkreśleniami', () => {
        expect(parseFeatureFaceKey('feature_przetloczenie_FACE_Z_MINUS_bottom')).toEqual({
            featureId: 'przetloczenie_FACE_Z_MINUS',
            subType: 'bottom',
        });
        expect(parseFeatureFaceKey('feature_rewizja_FACE_Z_PLUS_w2')).toEqual({
            featureId: 'rewizja_FACE_Z_PLUS',
            subType: 'w2',
        });
    });

    it('featureIdFromBrepEdgeKey mapuje e_groove_* → id operacji', () => {
        expect(featureIdFromBrepEdgeKey('e_groove_przetloczenie_FACE_Z_MINUS_t1')).toBe(
            'przetloczenie_FACE_Z_MINUS'
        );
        expect(featureIdFromBrepEdgeKey('e_groove_g_back_v3')).toBe('g_back');
        expect(featureIdFromBrepEdgeKey('e_hole_abc_t')).toBe('abc');
    });

    it('box panel: groove → feature_*_bottom + 4 ścianki', () => {
        const mesh = buildMeshFromPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            features: [{
                id: 'przetloczenie_FACE_Z_MINUS',
                type: 'groove',
                face: 'FACE_Z_MINUS',
                params: { u: 60, v: 60, width: 480, length: 600, depth: 3 },
            }],
        });

        const bottom = mesh['feature_przetloczenie_FACE_Z_MINUS_bottom'];
        expect(bottom?.positions?.length).toBeGreaterThan(0);
        expect(mesh['feature_przetloczenie_FACE_Z_MINUS_w0']?.positions?.length).toBeGreaterThan(0);
        expect(mesh['feature_przetloczenie_FACE_Z_MINUS_w3']?.positions?.length).toBeGreaterThan(0);
        expect(mesh.FACE_Z_MINUS?.positions?.length).toBeGreaterThan(0);
    });
});
