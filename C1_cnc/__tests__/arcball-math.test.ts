/**
 * Testy czystej matematyki arcballa (Shoemake).
 */

import { describe, it, expect } from 'vitest';
import {
    computeArcballDelta,
    generateChordArcPoints,
    projectPointerToSphere,
    quatRotateVec,
    raySphereNearestHit,
    unitFromSphereHit,
    vDot,
    vLen,
} from '../interaction/arcball-math.js';

const right = { x: 1, y: 0, z: 0 };
const up = { x: 0, y: 1, z: 0 };
const forward = { x: 0, y: 0, z: 1 };

describe('arcball-math', () => {
    it('projectPointerToSphere: środek → forward', () => {
        const v = projectPointerToSphere(100, 100, 100, 100, 50, right, up, forward);
        expect(v.x).toBeCloseTo(0, 5);
        expect(v.y).toBeCloseTo(0, 5);
        expect(v.z).toBeCloseTo(1, 5);
        expect(vLen(v)).toBeCloseTo(1, 5);
    });

    it('projectPointerToSphere: poza sferą → wektor na równiku (bez skoku)', () => {
        const v = projectPointerToSphere(300, 100, 100, 100, 50, right, up, forward);
        expect(vLen(v)).toBeCloseTo(1, 5);
        // Daleko w prawo → głównie +X
        expect(v.x).toBeGreaterThan(0.9);
        expect(Math.abs(v.z)).toBeLessThan(0.2);
    });

    it('computeArcballDelta: 90° wokół Y', () => {
        const start = { x: 0, y: 0, z: 1 };
        const curr = { x: 1, y: 0, z: 0 };
        const delta = computeArcballDelta(start, curr);
        expect(delta).not.toBeNull();
        expect(delta!.angleRad).toBeCloseTo(Math.PI / 2, 5);
        expect(Math.abs(delta!.axis.y)).toBeCloseTo(1, 5);

        const rotated = quatRotateVec(delta!.quat, start);
        expect(rotated.x).toBeCloseTo(curr.x, 5);
        expect(rotated.y).toBeCloseTo(curr.y, 5);
        expect(rotated.z).toBeCloseTo(curr.z, 5);
    });

    it('computeArcballDelta: snap do 45°', () => {
        const start = { x: 0, y: 0, z: 1 };
        // ~50° w stronę X
        const a = (50 * Math.PI) / 180;
        const curr = { x: Math.sin(a), y: 0, z: Math.cos(a) };
        const delta = computeArcballDelta(start, curr, 45);
        expect(delta!.angleRad).toBeCloseTo((45 * Math.PI) / 180, 5);
    });

    it('generateChordArcPoints: końce na sferze, liczba punktów > 1', () => {
        const center = { x: 10, y: 20, z: 30 };
        const axis = { x: 0, y: 1, z: 0 };
        const v0 = { x: 0, y: 0, z: 1 };
        const radius = 100;
        const pts = generateChordArcPoints(center, axis, v0, Math.PI / 2, radius, 16);
        expect(pts.length).toBeGreaterThan(8);

        const first = pts[0];
        const last = pts[pts.length - 1];
        expect(vLen({ x: first.x - center.x, y: first.y - center.y, z: first.z - center.z })).toBeCloseTo(radius, 4);
        expect(vLen({ x: last.x - center.x, y: last.y - center.y, z: last.z - center.z })).toBeCloseTo(radius, 4);

        // Start ≈ center + v0 * r
        expect(first.x).toBeCloseTo(center.x, 4);
        expect(first.z).toBeCloseTo(center.z + radius, 4);
        // Koniec po 90° wokół Y ≈ center + X * r
        expect(last.x).toBeCloseTo(center.x + radius, 4);
        expect(last.z).toBeCloseTo(center.z, 4);
    });

    it('computeArcballDelta: brak ruchu → null', () => {
        const v = { x: 0, y: 0, z: 1 };
        expect(computeArcballDelta(v, v)).toBeNull();
    });

    it('wektory na sferze pozostają jednostkowe (dot ≤ 1)', () => {
        const a = projectPointerToSphere(120, 80, 100, 100, 60, right, up, forward);
        const b = projectPointerToSphere(140, 90, 100, 100, 60, right, up, forward);
        expect(vLen(a)).toBeCloseTo(1, 5);
        expect(vLen(b)).toBeCloseTo(1, 5);
        expect(Math.abs(vDot(a, b))).toBeLessThanOrEqual(1 + 1e-9);
    });

    it('raySphereNearestHit: przednia ściana pod kursorem', () => {
        const center = { x: 0, y: 0, z: 0 };
        const hit = raySphereNearestHit(
            { x: 0, y: 0, z: 100 },
            { x: 0, y: 0, z: -1 },
            center,
            50
        );
        expect(hit).not.toBeNull();
        expect(hit!.z).toBeCloseTo(50, 5);
        expect(unitFromSphereHit(center, hit!).z).toBeCloseTo(1, 5);
    });

    it('raySphereNearestHit: pudło → null', () => {
        expect(
            raySphereNearestHit(
                { x: 0, y: 0, z: 100 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
                10
            )
        ).toBeNull();
    });
});

describe('getRingRadiusMm (promień cięciwy)', () => {
    it('bok 2000×510 → max(510*1.15, 600) = 600', async () => {
        const { getRingRadiusMm } = await import('../interaction/arcball-camera-session.js');
        // model w nm: 510 mm → 510_000_000, 2000 mm → 2e9
        const r = getRingRadiusMm({ width: 510_000_000, height: 2_000_000_000, thickness: 18_000_000 });
        expect(r).toBe(600);
    });

    it('głębsza płyta 800 mm → 800*1.15 = 920', async () => {
        const { getRingRadiusMm } = await import('../interaction/arcball-camera-session.js');
        const r = getRingRadiusMm({ width: 800_000_000, height: 1_200_000_000, thickness: 18_000_000 });
        expect(r).toBe(Math.round(800 * 1.15));
    });
});
