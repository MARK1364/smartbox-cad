/**
 * Regresja: otwór na granicy płyty nie traci dna i ścianek bocznych.
 * Stary guard |pA| >= w/2 - EPS odrzucał każdy prymityw, którego pierwszy
 * wierzchołek leżał na licu zewnętrznym — gubił dno i ścianki.
 */
import { describe, it, expect } from 'vitest';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

function meshPrimCount(m: { positions?: number[]; indices?: number[] } | undefined): number {
    if (!m?.indices?.length) return 0;
    return m.indices.length / 3;
}

describe('otwór na granicy płyty — dno i ścianki', () => {
    const W = 300;
    const H = 200;
    const T = 18;
    const dia = 35;
    const r = dia / 2;
    const depth = 12;

    function build(features: any[]) {
        return buildMeshFromPanel({
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            role: 'PANEL',
            features
        });
    }

    function hole(u: number, v: number) {
        return [{
            id: 'edge_hole',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u, v, diameter: dia, depth }
        }];
    }

    it('otwór styczny do krawędzi u=r ma tyle samo extra tris co otwór w środku', () => {
        const blank = meshPrimCount(build([]).FACE_Z_PLUS);
        const centerExtra = meshPrimCount(build(hole(W / 2, H / 2)).FACE_Z_PLUS) - blank;
        const edgeExtra = meshPrimCount(build(hole(r, H / 2)).FACE_Z_PLUS) - blank;

        // 24 dno + 48 ścianki (+ earcut czapki). Stary guard: edgeExtra ≈ 20–50.
        expect(centerExtra).toBeGreaterThanOrEqual(70);
        expect(edgeExtra).toBeGreaterThanOrEqual(70);
        expect(Math.abs(edgeExtra - centerExtra)).toBeLessThanOrEqual(2);
    });
});
