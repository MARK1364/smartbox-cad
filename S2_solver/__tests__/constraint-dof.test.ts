/**
 * Testy analitycznego modelu DOF (projekcja, Gram–Schmidt, swing–twist).
 */

import { describe, it, expect } from 'vitest';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import {
    mergeAxes,
    orthonormalize,
    projectOntoConstrainedSpace,
    projectOntoFreeSpace,
    rotationBetween,
    swingTwistDecompose,
} from '../constraint-dof.js';

describe('projekcja DOF', () => {
    it('COPLANAR blokuje ruch wzdłuż normalnej, ale pozwala ślizgać po płaszczyźnie', () => {
        const delta = new Vec3(120, 80, 40);
        const free = projectOntoFreeSpace(delta, [Vec3.UNIT_X]);
        expect(free.x).toBeCloseTo(0);
        expect(free.y).toBeCloseTo(80);
        expect(free.z).toBeCloseTo(40);
    });

    it('dwa niezależne więzy płaszczyzn pozostawiają ruch tylko wzdłuż ich przecięcia', () => {
        const delta = new Vec3(120, 80, 40);
        const free = projectOntoFreeSpace(delta, [Vec3.UNIT_X, Vec3.UNIT_Z]);
        expect(free.x).toBeCloseTo(0);
        expect(free.y).toBeCloseTo(80);
        expect(free.z).toBeCloseTo(0);
    });

    it('trzy niezależne płaszczyzny wiążą całą translację', () => {
        const delta = new Vec3(120, 80, 40);
        const free = projectOntoFreeSpace(delta, [Vec3.UNIT_X, Vec3.UNIT_Y, Vec3.UNIT_Z]);
        expect(free.length()).toBeCloseTo(0);
        const bound = projectOntoConstrainedSpace(delta, [Vec3.UNIT_X, Vec3.UNIT_Y, Vec3.UNIT_Z]);
        expect(bound.x).toBeCloseTo(120);
        expect(bound.y).toBeCloseTo(80);
        expect(bound.z).toBeCloseTo(40);
    });

    it('nie odejmuje dwa razy tego samego stopnia swobody', () => {
        const merged = mergeAxes([Vec3.UNIT_X], [new Vec3(-1, 0, 0)]);
        expect(merged).toHaveLength(1);
        const delta = new Vec3(120, 80, 40);
        const free = projectOntoFreeSpace(delta, merged);
        expect(free.x).toBeCloseTo(0);
        expect(free.y).toBeCloseTo(80);
        expect(free.z).toBeCloseTo(40);
    });

    it('wyrównanie frontów przekazuje drugiej szafie tylko ruch w osi normalnej', () => {
        const delta = new Vec3(120, 80, 40);
        const transferred = projectOntoConstrainedSpace(delta, [Vec3.UNIT_Y]);
        expect(transferred.x).toBeCloseTo(0);
        expect(transferred.y).toBeCloseTo(80);
        expect(transferred.z).toBeCloseTo(0);
    });

    it('projekcja po rzeczywistej normalnej świata, nie globalnej osi', () => {
        const normal = new Vec3(1, 1, 0).normalize();
        const along = normal.scale(50);
        const tangent = new Vec3(-1, 1, 0).normalize().scale(30);
        const delta = along.add(tangent);
        const transferred = projectOntoConstrainedSpace(delta, [normal]);
        expect(transferred.sub(along).length()).toBeLessThan(1e-9);
    });
});

describe('swing–twist', () => {
    it('obrót wokół normalnej to sam twist — swing identycznościowy', () => {
        const q = Quat.fromAxisAngle(Vec3.UNIT_Y, Math.PI / 5);
        const { swing, twist } = swingTwistDecompose(q, Vec3.UNIT_Y);
        expect(swing.equals(Quat.IDENTITY, 1e-6)).toBe(true);
        const recovered = twist.rotateVec3(Vec3.UNIT_Y);
        expect(recovered.y).toBeCloseTo(1, 5);
    });

    it('obrót zmieniający normalną to swing', () => {
        const q = Quat.fromAxisAngle(Vec3.UNIT_X, Math.PI / 2);
        const { swing, twist } = swingTwistDecompose(q, Vec3.UNIT_Y);
        const swung = swing.rotateVec3(Vec3.UNIT_Y);
        expect(swung.y).toBeCloseTo(0, 5);
        expect(Math.abs(swung.z)).toBeCloseTo(1, 5);
        const twistedY = twist.rotateVec3(Vec3.UNIT_Y);
        expect(twistedY.y).toBeCloseTo(1, 5);
    });

    it('rotationBetween 0° i 180° jest numerycznie stabilne', () => {
        expect(rotationBetween(Vec3.UNIT_Z, Vec3.UNIT_Z).equals(Quat.IDENTITY, 1e-6)).toBe(true);
        const flip = rotationBetween(Vec3.UNIT_Z, new Vec3(0, 0, -1));
        const out = flip.rotateVec3(Vec3.UNIT_Z);
        expect(out.z).toBeCloseTo(-1, 5);
    });

    it('orthonormalize pomija osie równoległe i zerowe', () => {
        const basis = orthonormalize([
            Vec3.ZERO,
            Vec3.UNIT_Y,
            new Vec3(0, 2, 0),
            Vec3.UNIT_Z,
        ]);
        expect(basis).toHaveLength(2);
    });
});
