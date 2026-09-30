/**
 * Wloty wpustow w czapce (earcut): dokladnie jeden otwor na wpust i tylko na materiale.
 * Regresja wienca L — zdublowany kontur gubil wyciecie, a otwor poza obrysem
 * wygryzal trojkaty z litej plyty.
 */
import { describe, it, expect } from 'vitest';
import { buildMeshFromPanel } from '../native_core/mesh_builder';
import { mmToNm } from '../../A1_core/cad-math/units';

const plateW = 882;
const plateD = 882;
// Realny WIENIEC_D z Korpus3Engine (armDepthX 500, armDepthY 700).
const outlineL = [[0, 0], [882, 0], [882, 700], [500, 700], [500, 882], [0, 882]];
const OUTLINE_L_AREA = 708_400;

/** Pole powierzchni triangulacji — mierzy, co earcut realnie wygenerowal. */
function meshArea(m: any): number {
    if (!m?.indices?.length) return 0;
    let area = 0;
    for (let i = 0; i < m.indices.length; i += 3) {
        const p = (k: number) => m.positions.slice(m.indices[i + k] * 3, m.indices[i + k] * 3 + 3);
        const [ax, ay, az] = p(0);
        const [bx, by, bz] = p(1);
        const [cx, cy, cz] = p(2);
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    return area;
}

function buildL() {
    return buildMeshFromPanel({
        role: 'BOTTOM_PANEL',
        width: mmToNm(plateW),
        height: mmToNm(plateD),
        thickness: mmToNm(18),
        custom_properties: { outline2d: outlineL, shape: 'L_NOTCH' },
        features: []
    });
}

function grooveL(face: string, params: any) {
    return buildMeshFromPanel({
        role: 'BOTTOM_PANEL',
        width: mmToNm(plateW),
        height: mmToNm(plateD),
        thickness: mmToNm(18),
        custom_properties: { outline2d: outlineL, shape: 'L_NOTCH' },
        features: [{ id: 'g', type: 'groove', face, params }]
    });
}

describe('wloty wpustow w czapce — earcut', () => {
    it('wieniec L bez obrobki ma pelne pole obrysu', () => {
        const mesh = buildL();
        expect(meshArea(mesh.FACE_Z_PLUS)).toBeCloseTo(OUTLINE_L_AREA, 0);
        expect(meshArea(mesh.FACE_Z_MINUS)).toBeCloseTo(OUTLINE_L_AREA, 0);
    });

    it('wpust wewnatrz obrysu jest wyciety dokladnie raz', () => {
        const mesh = grooveL('FACE_Z_MINUS', { u: 10, v: 10, width: 3, length: 500, depth: 8 });
        expect(meshArea(mesh.FACE_Z_MINUS)).toBeCloseTo(OUTLINE_L_AREA - 3 * 500, 0);
    });

    it('wpust przy krawedzi u=0 jest wyciety', () => {
        const mesh = grooveL('FACE_Z_MINUS', { u: 0, v: 10, width: 3, length: 500, depth: 8 });
        expect(meshArea(mesh.FACE_Z_MINUS)).toBeCloseTo(OUTLINE_L_AREA - 3 * 500, 0);
    });

    it('wpust przecinajacy wciecie L jest przyciety do materialu', () => {
        // v 800..803 lezy na materiale tylko na 500 mm z 882 mm szerokosci plyty.
        const mesh = grooveL('FACE_Z_MINUS', { u: 0, v: 800, width: 882, length: 3, depth: 8 });
        expect(meshArea(mesh.FACE_Z_MINUS)).toBeCloseTo(OUTLINE_L_AREA - 500 * 3, 0);
    });

    it('wpust w pustce wciecia nie wygryza materialu', () => {
        // Pustka: FACE_Z_MINUS u 0..382, FACE_Z_PLUS u 500..882 (UV odbite w u), v 700..882.
        const minus = grooveL('FACE_Z_MINUS', { u: 100, v: 800, width: 100, length: 50, depth: 8 });
        expect(meshArea(minus.FACE_Z_MINUS)).toBeCloseTo(OUTLINE_L_AREA, 0);

        const plus = grooveL('FACE_Z_PLUS', { u: 600, v: 800, width: 100, length: 50, depth: 8 });
        expect(meshArea(plus.FACE_Z_PLUS)).toBeCloseTo(OUTLINE_L_AREA, 0);
    });

    it('wpust na ramieniu L jest wyciety po obu stronach plyty', () => {
        const plus = grooveL('FACE_Z_PLUS', { u: 100, v: 800, width: 100, length: 50, depth: 8 });
        expect(meshArea(plus.FACE_Z_PLUS)).toBeCloseTo(OUTLINE_L_AREA - 100 * 50, 0);
    });

    it('realny wieniec: dwa wpusty pod plecy nie rozsypuja czapki', () => {
        // Wpusty 1:1 z buildBackGrooves dla rogowy90 900x720x900 (armX 500 / armY 700).
        // Przy zdublowanym konturze earcut gubil tu ~80% powierzchni.
        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(plateW),
            height: mmToNm(plateD),
            thickness: mmToNm(18),
            custom_properties: { outline2d: outlineL, shape: 'L_NOTCH' },
            features: [
                { id: 'bg0', type: 'groove', face: 'FACE_Z_PLUS', params: { u: 3, v: 0, width: 879, length: 3, depth: 11 } },
                { id: 'bg1', type: 'groove', face: 'FACE_Z_PLUS', params: { u: 0, v: 3, width: 3, length: 879, depth: 11 } }
            ]
        });
        expect(meshArea(mesh.FACE_Z_PLUS)).toBeCloseTo(OUTLINE_L_AREA - 2 * 879 * 3, 0);
        expect(meshArea(mesh.FACE_Z_MINUS)).toBeCloseTo(OUTLINE_L_AREA, 0);
    });

    it('formatka prostokatna: wpust wyciety raz, bez ubytku poza nim', () => {
        const w = 600, h = 400, t = 18;
        const mesh = buildMeshFromPanel({
            role: 'SHELF',
            width: mmToNm(w),
            height: mmToNm(h),
            thickness: mmToNm(t),
            features: [{
                id: 'g', type: 'groove', face: 'FACE_Z_MINUS',
                params: { u: 50, v: 50, width: 4, length: 300, depth: 8 }
            }]
        });
        expect(meshArea(mesh.FACE_Z_MINUS)).toBeCloseTo(w * h - 4 * 300, 0);
        expect(meshArea(mesh.FACE_Z_PLUS)).toBeCloseTo(w * h, 0);
    });
});
