/**
 * SmartPanel Web — Testy jednostkowe: cad-math + CADNode
 *
 * Uruchom: npx vitest run  (z katalogu web/)
 *
 * Pokrycie kluczowych wymagań z review:
 *  T1  Mat4: column-major — translacja pod [12,13,14]
 *  T2  Mat4: multiply — tożsamość jest elementem neutralnym
 *  T3  Mat4: multiply — kolejność ma znaczenie (nieprzemienność)
 *  T4  Mat4: fromTRS + transformPoint — punkt po translacji
 *  T5  Mat4: fromTRS + transformPoint — punkt po obrocie 90°
 *  T6  Mat4: parent × child — kaskada transformacji
 *  T7  Mat4: invert — M × M^-1 = I
 *  T8  Mat4: decompose — odzyskanie TRS z fromTRS
 *  T9  Quat: fromEulerXYZ(0,0,0) = identity
 *  T10 Quat: fromEulerXYZ(90° Z) → punkt (1,0,0) → (0,1,0)
 *  T11 coord-system: cadToRender(x,y,z) = (x,z,y)
 *  T12 coord-system: renderToCAD(cadToRender(v)) = v (round-trip)
 *  T13 coord-system: cadMatrixToRenderMatrix — translacja
 *  T14 coord-system: cadMatrixToRenderMatrix — obrót 90° Z nie psuje punktu
 *  T15 CADNode: worldMatrix korzenia = localMatrix
 *  T16 CADNode: worldMatrix dziecka = parent.world × child.local
 *  T17 CADNode: dirty-flag propaguje w dół
 *  T18 CADNode: addChild — detekcja cyklu
 *  T19 CADNode: detach — dziecko staje się korzeniem
 */

import { describe, it, expect } from 'vitest';
import { Mat4 } from '../mat4.js';
import { Quat } from '../quat.js';
import { Vec3 } from '../vec3.js';
import {
    cadToRender,
    renderToCAD,
    cadMatrixToRenderMatrix,
    cadAxisKeyToRenderDirection,
    dominantCadAxisFromRenderDelta,
    lockCadDelta,
} from '../coord-system.js';
import { CADNode } from '../../cad-node/cad-node.js';
import { NodeType } from '../../cad-node/node-type.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EPS = 1e-9;

function expectVec3(v: Vec3, x: number, y: number, z: number, eps = 1e-5) {
    expect(v.x).toBeCloseTo(x, 4);
    expect(v.y).toBeCloseTo(y, 4);
    expect(v.z).toBeCloseTo(z, 4);
}

function expectMat4Identity(m: Mat4, eps = 1e-9) {
    expect(m.data[0]).toBeCloseTo(1, 9);
    expect(m.data[5]).toBeCloseTo(1, 9);
    expect(m.data[10]).toBeCloseTo(1, 9);
    expect(m.data[15]).toBeCloseTo(1, 9);
    // Elementy poza przekątną ≈ 0
    for (const i of [1,2,3,4,6,7,8,9,11,12,13,14]) {
        expect(Math.abs(m.data[i])).toBeLessThan(eps);
    }
}

// ─── T1: column-major — translacja pod [12,13,14] ────────────────────────────

describe('Mat4 — column-major layout', () => {
    it('T1: fromTranslation przechowuje translację pod [12,13,14]', () => {
        const m = Mat4.fromTranslation(10, 20, 30);
        expect(m.data[12]).toBe(10);
        expect(m.data[13]).toBe(20);
        expect(m.data[14]).toBe(30);
        expect(m.data[15]).toBe(1);
        // Przekątna rotacyjna = 1
        expect(m.data[0]).toBe(1);
        expect(m.data[5]).toBe(1);
        expect(m.data[10]).toBe(1);
    });

    it('T2: identity jest elementem neutralnym mnożenia', () => {
        const t = Mat4.fromTranslation(5, -3, 7);
        const result = Mat4.identity().multiply(t);
        expect(result.equals(t)).toBe(true);

        const result2 = t.multiply(Mat4.identity());
        expect(result2.equals(t)).toBe(true);
    });

    it('T3: mnożenie jest nieprzemienne (T×R ≠ R×T)', () => {
        const T = Mat4.fromTranslation(10, 0, 0);
        const R = Mat4.fromQuaternion(Quat.fromAxisAngle(Vec3.UNIT_Y, Math.PI / 2));
        const TR = T.multiply(R);
        const RT = R.multiply(T);
        expect(TR.equals(RT)).toBe(false);
    });
});

// ─── T4–T6: transformPoint ────────────────────────────────────────────────────

describe('Mat4 — transformPoint', () => {
    it('T4: translacja (10,0,0) przesuwa punkt (0,0,0) → (10,0,0)', () => {
        const m = Mat4.fromTranslation(10, 0, 0);
        const p = m.transformPoint(new Vec3(0, 0, 0));
        expectVec3(p, 10, 0, 0);
    });

    it('T5: obrót 90° wokół Z: punkt (1,0,0) → (0,1,0)', () => {
        const q = Quat.fromAxisAngle(Vec3.UNIT_Z, Math.PI / 2);
        const m = Mat4.fromQuaternion(q);
        const p = m.transformPoint(new Vec3(1, 0, 0));
        expectVec3(p, 0, 1, 0);
    });

    it('T6: kaskada parent(T=10,0,0) × child(T=0,5,0) → punkt (0,0,0) ląduje w (10,5,0)', () => {
        const parent = Mat4.fromTranslation(10, 0, 0);
        const child  = Mat4.fromTranslation(0, 5, 0);
        const world  = parent.multiply(child);
        const p = world.transformPoint(Vec3.ZERO);
        expectVec3(p, 10, 5, 0);
    });
});

// ─── T7: invert ──────────────────────────────────────────────────────────────

describe('Mat4 — invert', () => {
    it('T7: M × M^-1 = I (TRS)', () => {
        const q = Quat.fromAxisAngle(Vec3.UNIT_Z, 0.7);
        const m = Mat4.fromTRS(new Vec3(3, -1, 5), q, new Vec3(2, 2, 2));
        const result = m.multiply(m.invert());
        expectMat4Identity(result, 1e-7);
    });
});

// ─── T8: decompose ───────────────────────────────────────────────────────────

describe('Mat4 — decompose', () => {
    it('T8: fromTRS → decompose odzyskuje oryginalne komponenty', () => {
        const t = new Vec3(7, -3, 11);
        const q = Quat.fromAxisAngle(new Vec3(1, 1, 0).normalize(), Math.PI / 3).normalize();
        const s = new Vec3(2, 3, 1);
        const m = Mat4.fromTRS(t, q, s);
        const { translation, rotation, scale } = m.decompose();

        expectVec3(translation, t.x, t.y, t.z);
        expectVec3(new Vec3(scale.x, scale.y, scale.z), s.x, s.y, s.z);
        // Kwaterniony mogą mieć odwrotny znak — |q·q'| = 1
        const dot = Math.abs(rotation.x*q.x + rotation.y*q.y + rotation.z*q.z + rotation.w*q.w);
        expect(dot).toBeCloseTo(1, 5);
    });
});

// ─── T9–T10: Quat ────────────────────────────────────────────────────────────

describe('Quat', () => {
    it('T9: fromEulerXYZ(0,0,0) = identity', () => {
        const q = Quat.fromEulerXYZ(0, 0, 0);
        expect(q.x).toBeCloseTo(0, 9);
        expect(q.y).toBeCloseTo(0, 9);
        expect(q.z).toBeCloseTo(0, 9);
        expect(q.w).toBeCloseTo(1, 9);
    });

    it('T10: obrót 90° wokół Z (fromAxisAngle) → Vec3(1,0,0) → (0,1,0)', () => {
        const q = Quat.fromAxisAngle(Vec3.UNIT_Z, Math.PI / 2);
        const result = q.rotateVec3(new Vec3(1, 0, 0));
        expectVec3(result, 0, 1, 0);
    });
});

// ─── T11–T14: coord-system ───────────────────────────────────────────────────

describe('coord-system', () => {
    it('T11: cadToRender(x,y,z) = (x,z,y)', () => {
        const v = new Vec3(1, 2, 3);
        const r = cadToRender(v);
        expectVec3(r, 1, 3, 2);
    });

    it('T12: round-trip cadToRender → renderToCAD = identity', () => {
        const v = new Vec3(5, -3, 8);
        const rt = renderToCAD(cadToRender(v));
        expectVec3(rt, v.x, v.y, v.z);
    });

    it('T13: cadMatrixToRenderMatrix — translacja CAD(0,0,10) → Babylon Y=10', () => {
        // CAD: przesuń o 10 w górę (CAD Z = 10)
        const cadM = Mat4.fromTranslation(0, 0, 10);
        const renderM = cadMatrixToRenderMatrix(cadM);
        const p = renderM.transformPoint(Vec3.ZERO);
        // W Babylonie Z-góra CAD → Y-góra Babylon
        expectVec3(p, 0, 10, 0);
    });

    it('T14: cadMatrixToRenderMatrix — obrót 90° Z w CAD → obrót 90° Z w Babylonie (X→Z nie X→Y)', () => {
        // W CAD: obrót 90° wokół Z-up (wysokość) kręci w płaszczyźnie XY
        // Po konwersji do Babylona: powinien kręcić w płaszczyźnie XZ (bo Y to teraz góra)
        const q = Quat.fromAxisAngle(Vec3.UNIT_Z, Math.PI / 2); // CAD Z = góra
        const cadM = Mat4.fromQuaternion(q);
        const renderM = cadMatrixToRenderMatrix(cadM);
        // Punkt CAD(1,0,0) → po obrocie CAD → (0,1,0) CAD → renderToCAD → Babylon(0,0,1)
        const cadPoint = new Vec3(1, 0, 0);
        const rotatedCad = q.rotateVec3(cadPoint); // (0, 1, 0) CAD
        const expected = cadToRender(rotatedCad);   // (0, 0, 1) Babylon
        const actual = renderM.transformPoint(cadToRender(cadPoint));
        expectVec3(actual, expected.x, expected.y, expected.z);
    });

    it('T15a: skrót CAD Y mapuje się na Babylon Z (głębokość)', () => {
        const dir = cadAxisKeyToRenderDirection('Y');
        expectVec3(dir, 0, 0, 1);
    });

    it('T15b: skrót CAD Z mapuje się na Babylon Y (wysokość)', () => {
        const dir = cadAxisKeyToRenderDirection('Z');
        expectVec3(dir, 0, 1, 0);
    });

    it('T15c: dominująca oś CAD rozpoznaje wysokość w składowej Babylon Y', () => {
        expect(dominantCadAxisFromRenderDelta(10, 800, 5)).toBe('Z');
    });

    it('T15d: lockCadDelta — Y to głębokość CAD, nie Babylon Y', () => {
        const renderMove = new Vec3(10, 500, 300); // Babylon: duży ruch w Y (góra)
        const cad = renderToCAD(renderMove);
        const lockedY = lockCadDelta(cad, 'y');
        expect(lockedY.x).toBe(0);
        expect(lockedY.y).toBe(cad.y);
        expect(lockedY.z).toBe(0);

        const lockedZ = lockCadDelta(cad, 'z');
        expect(lockedZ.z).toBe(cad.z);
        expect(lockedZ.y).toBe(0);
    });
});

// ─── T15–T19: CADNode ────────────────────────────────────────────────────────

describe('CADNode', () => {
    function makeNode(name: string) {
        return CADNode.create(NodeType.PART, name, name);
    }

    it('T15: worldMatrix korzenia = localMatrix', () => {
        const node = makeNode('root');
        const t = new Vec3(5, 0, 0);
        node.setLocalTransform(t, Quat.IDENTITY);
        const wm = node.getWorldMatrix();
        expectVec3(wm.getTranslation(), 5, 0, 0);
    });

    it('T16: worldMatrix dziecka = parent.world × child.local', () => {
        const parent = makeNode('parent');
        const child  = makeNode('child');
        parent.setLocalTransform(new Vec3(10, 0, 0), Quat.IDENTITY);
        child.setLocalTransform(new Vec3(0, 5, 0), Quat.IDENTITY);
        parent.addChild(child);

        const wm = child.getWorldMatrix();
        expectVec3(wm.getTranslation(), 10, 5, 0);
    });

    it('T17: dirty-flag propaguje w dół przy zmianie rodzica', () => {
        const parent = makeNode('p');
        const child  = makeNode('c');
        const grand  = makeNode('g');

        parent.addChild(child);
        child.addChild(grand);

        // Wymuś obliczenie
        grand.getWorldMatrix();

        // Zmień rodzica — musi zinwalidować wnuka
        parent.setLocalTransform(new Vec3(100, 0, 0), Quat.IDENTITY);
        const wm = grand.getWorldMatrix();
        // Wnuk dziedziczy translację rodzica
        expect(wm.getTranslation().x).toBeCloseTo(100, 4);
    });

    it('T18: addChild rzuca błąd przy cyklu A→B→A', () => {
        const a = makeNode('A');
        const b = makeNode('B');
        a.addChild(b);
        expect(() => b.addChild(a)).toThrow(/cycle/i);
    });

    it('T19: detach — dziecko staje się korzeniem', () => {
        const parent = makeNode('parent');
        const child  = makeNode('child');
        parent.setLocalTransform(new Vec3(10, 0, 0), Quat.IDENTITY);
        child.setLocalTransform(new Vec3(3, 0, 0), Quat.IDENTITY);
        parent.addChild(child);

        child.detach();
        expect(child.parent).toBeNull();
        // Po odłączeniu worldMatrix = localMatrix
        expectVec3(child.getWorldMatrix().getTranslation(), 3, 0, 0);
    });
});
