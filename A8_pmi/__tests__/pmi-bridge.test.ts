import { describe, it, expect } from 'vitest';
import { getRenderData, resolveMeasureAxis } from '../pmi-bridge.js';
import { ArrowMode, solveArrowPlacement, v3, v3Len } from '../dimension-solver.js';

/**
 * `resolveMeasureAxis` jest jedynym miejscem, w którym rozstrzygana jest oś i
 * wartość wymiaru. Etykieta oraz geometria czytają ten sam wynik, więc te testy
 * pilnują zgodności tego, co użytkownik widzi, z tym, co jest narysowane.
 */
describe('resolveMeasureAxis', () => {
    const globalOpts = { axisSpace: 'GLOBAL', matrixWorld: null };

    it('wybiera dominującą oś odcinka w trybie AUTO', () => {
        const result = resolveMeasureAxis({
            ...globalOpts,
            measureAxisKey: 'AUTO',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(100, 30, 10),
        });

        expect(result?.measureAxisKey).toBe('X');
        expect(result?.lengthMM).toBeCloseTo(100, 6);
    });

    it('rzutuje długość na wymuszoną oś CAD Y (głębokość = Babylon Z)', () => {
        const result = resolveMeasureAxis({
            ...globalOpts,
            measureAxisKey: 'Y',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(300, 0, 400),
        });

        expect(result?.measureAxisKey).toBe('Y');
        expect(result?.lengthMM).toBeCloseTo(400, 6);
    });

    it('rzutuje długość na wymuszoną oś CAD Z (wysokość = Babylon Y)', () => {
        const result = resolveMeasureAxis({
            ...globalOpts,
            measureAxisKey: 'Z',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(300, 400, 0),
        });

        expect(result?.measureAxisKey).toBe('Z');
        expect(result?.lengthMM).toBeCloseTo(400, 6);
    });

    it('porzuca wymuszoną oś prostopadłą do odcinka, żeby nie zwrócić zera', () => {
        const result = resolveMeasureAxis({
            ...globalOpts,
            measureAxisKey: 'X',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(0, 800, 0),
        });

        expect(result?.measureAxisKey).toBe('Z');
        expect(result?.lengthMM).toBeCloseTo(800, 6);
    });

    it('mierzy wzdłuż odcinka w trybie ALIGNED', () => {
        const result = resolveMeasureAxis({
            ...globalOpts,
            axisSpace: 'ALIGNED',
            measureAxisKey: 'X',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(300, 400, 0),
        });

        expect(result?.measureAxisKey).toBe('ALIGNED');
        expect(result?.lengthMM).toBeCloseTo(500, 6);
    });

    it('w ALIGNED z normalną ściany mierzy rzut na tę płaszczyznę', () => {
        const result = resolveMeasureAxis({
            ...globalOpts,
            axisSpace: 'ALIGNED',
            measureAxisKey: 'X',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(300, 400, 500),
            faceNormal1World: v3(0, 0, 1), // rzut na płaszczyznę XY
        });

        expect(result?.measureAxisKey).toBe('ALIGNED');
        expect(result?.lengthMM).toBeCloseTo(500, 6); // sqrt(300^2 + 400^2)
    });

    it('AUTO w LOCAL wybiera oś formatki, nie globalną', () => {
        const rotatedZ90 = [
            0, 1, 0, 0,
            -1, 0, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ];

        const result = resolveMeasureAxis({
            axisSpace: 'LOCAL',
            matrixWorld: rotatedZ90,
            measureAxisKey: 'AUTO',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(0, 250, 0),
        });

        expect(result?.measureAxisKey).toBe('X');
        expect(result?.lengthMM).toBeCloseTo(250, 6);
    });

    it('używa osi obróconego układu lokalnego', () => {
        // Obrót o 90° wokół Z: lokalna oś X pokrywa się z globalną osią Y.
        const rotatedZ90 = [
            0, 1, 0, 0,
            -1, 0, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ];

        const result = resolveMeasureAxis({
            axisSpace: 'LOCAL',
            matrixWorld: rotatedZ90,
            measureAxisKey: 'X',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(0, 250, 0),
        });

        expect(result?.measureAxisKey).toBe('X');
        expect(result?.lengthMM).toBeCloseTo(250, 6);
    });

    it('przy mierzeniu przekątnej frontu szafy wyciągnięcie w osi Z mierzy szerokość X', () => {
        // Przód szafy: szerokość X=800, wysokość CAD Z=2000 (Babylon Y=2000), głębokość Y=0
        const result = resolveMeasureAxis({
            ...globalOpts,
            measureAxisKey: 'AUTO',
            offsetAxisKey: 'Z',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(800, 2000, 0),
        });

        expect(result?.measureAxisKey).toBe('X');
        expect(result?.lengthMM).toBeCloseTo(800, 6);
    });

    it('przy mierzeniu przekątnej frontu szafy wyciągnięcie w osi X mierzy wysokość Z', () => {
        const result = resolveMeasureAxis({
            ...globalOpts,
            measureAxisKey: 'AUTO',
            offsetAxisKey: 'X',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(800, 2000, 0),
        });

        expect(result?.measureAxisKey).toBe('Z');
        expect(result?.lengthMM).toBeCloseTo(2000, 6);
    });

    it('zwraca null dla zdegenerowanego odcinka', () => {
        const result = resolveMeasureAxis({
            ...globalOpts,
            measureAxisKey: 'AUTO',
            anchor1World: v3(10, 10, 10),
            anchor2World: v3(10, 10, 10),
        });

        expect(result).toBeNull();
    });
});

describe('getRenderData', () => {
    const rotatedZ90 = [
        0, 1, 0, 0,
        -1, 0, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ];

    it('LOCAL + odsunięcie wzdłuż L:Y nie zapada geometrii do (0,0,0)', () => {
        const rd = getRenderData({
            axisSpace: 'LOCAL',
            matrixWorld: rotatedZ90,
            measureAxisKey: 'AUTO',
            offsetAxisKey: 'Y',
            offsetWorld: v3(0, 0, 120),
            anchor1World: v3(100, 0, 0),
            anchor2World: v3(100, 250, 0),
            labelText: '250',
        });

        expect(rd).not.toBeNull();
        const dimSpan = v3Len({
            x: rd!.p2DimWorld.x - rd!.p1DimWorld.x,
            y: rd!.p2DimWorld.y - rd!.p1DimWorld.y,
            z: rd!.p2DimWorld.z - rd!.p1DimWorld.z,
        });
        expect(dimSpan).toBeGreaterThan(100);
        expect(v3Len(rd!.p1DimWorld)).toBeGreaterThan(50);
        expect(v3Len(rd!.p2DimWorld)).toBeGreaterThan(50);
    });

    it('wyciągnięcie przekątnej korpusu w osi Z generuje linię wymiaru szerokości X', () => {
        const rd = getRenderData({
            axisSpace: 'GLOBAL',
            matrixWorld: null,
            measureAxisKey: 'AUTO',
            offsetAxisKey: 'Z',
            offsetWorld: v3(0, 150, 0), // CAD Z (wysokość) = Babylon Y
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(800, 2000, 0),
            labelText: '800',
        });

        expect(rd).not.toBeNull();
        expect(rd!.resolvedMeasureAxisKey).toBe('X');
        expect(rd!.valueLength).toBeCloseTo(800, 6);
        const span = Math.hypot(
            rd!.p2DimWorld.x - rd!.p1DimWorld.x,
            rd!.p2DimWorld.y - rd!.p1DimWorld.y,
            rd!.p2DimWorld.z - rd!.p1DimWorld.z,
        );
        expect(span).toBeCloseTo(800, 1);
    });

    it('wyciągnięcie przekątnej korpusu w różnych kierunkach odsunięcia zachowuje długość linii', () => {
        // Korpus: szerokość 1000 (X), wysokość 720 (CAD Z = Babylon Y), głębokość 500 (CAD Y = Babylon Z)
        const p1 = v3(0, 0, 0);
        const p2 = v3(1000, 720, 500);

        for (const [offsetKey, offVec, expectedMeasureKey, expectedLen] of [
            ['Z', v3(0, 100, 0), 'X', 1000],
            ['Y', v3(0, 0, 100), 'X', 1000],
            ['X', v3(100, 0, 0), 'Z', 720],
        ] as const) {
            const rd = getRenderData({
                axisSpace: 'GLOBAL',
                matrixWorld: null,
                measureAxisKey: 'AUTO',
                offsetAxisKey: offsetKey,
                offsetWorld: offVec,
                anchor1World: p1,
                anchor2World: p2,
                labelText: `${expectedLen}`,
            });

            expect(rd).not.toBeNull();
            const span = Math.hypot(
                rd!.p2DimWorld.x - rd!.p1DimWorld.x,
                rd!.p2DimWorld.y - rd!.p1DimWorld.y,
                rd!.p2DimWorld.z - rd!.p1DimWorld.z,
            );
            console.log(`offsetKey: ${offsetKey}, resolved: ${rd!.resolvedMeasureAxisKey}, span: ${span}, expected: ${expectedLen}`);
            expect(span).toBeCloseTo(expectedLen, 1);
        }
    });

    it('przekątna szafy 1000x2000 wymuszona w osi X daje linię dokładnie 1000 mm zamiast przekątnej 2236 mm', () => {
        const p1 = v3(0, 0, 0);
        const p2 = v3(1000, 2000, 0); // CAD X=1000, CAD Z=2000 (Babylon Y)

        const rd = getRenderData({
            axisSpace: 'GLOBAL',
            matrixWorld: null,
            measureAxisKey: 'X',
            offsetAxisKey: 'Z',
            offsetWorld: v3(0, 100, 0), // odsunięcie w górę (Babylon Y = CAD Z)
            anchor1World: p1,
            anchor2World: p2,
            labelText: '1000.0 mm',
        });

        expect(rd).not.toBeNull();
        expect(rd!.resolvedMeasureAxisKey).toBe('X');
        expect(rd!.valueLength).toBeCloseTo(1000, 6);
        const span = Math.hypot(
            rd!.p2DimWorld.x - rd!.p1DimWorld.x,
            rd!.p2DimWorld.y - rd!.p1DimWorld.y,
            rd!.p2DimWorld.z - rd!.p1DimWorld.z,
        );
        expect(span).toBeCloseTo(1000, 1);
    });

    it('przekątna 3D (1000, 2000, 500) przy wyciągnięciu w głąb Y generuje linię wymiarową dokładnie o długości rzutu', () => {
        const p1 = v3(0, 0, 0);
        const p2 = v3(1000, 2000, 500);

        const rd = getRenderData({
            axisSpace: 'GLOBAL',
            matrixWorld: null,
            measureAxisKey: 'X',
            offsetAxisKey: 'Y',
            offsetWorld: v3(0, 0, 150), // CAD Y = Babylon Z
            anchor1World: p1,
            anchor2World: p2,
            labelText: '1000.0 mm',
        });

        expect(rd).not.toBeNull();
        expect(rd!.resolvedMeasureAxisKey).toBe('X');
        expect(rd!.valueLength).toBeCloseTo(1000, 6);
        const span = Math.hypot(
            rd!.p2DimWorld.x - rd!.p1DimWorld.x,
            rd!.p2DimWorld.y - rd!.p1DimWorld.y,
            rd!.p2DimWorld.z - rd!.p1DimWorld.z,
        );
        expect(span).toBeCloseTo(1000, 1);
    });
});

describe('solveArrowPlacement', () => {
    it('na długiej linii stawia groty wewnątrz (ISO — od środka na zewnątrz)', () => {
        const result = solveArrowPlacement({
            dimP1World: v3(0, 0, 0),
            dimP2World: v3(600, 0, 0),
            fwdWorld: v3(1, 0, 0),
            lineThicknessWorld: 0.8,
            textValue: '600.0 mm',
            fontSizeWorld: 14,
        });

        expect(result.mode).toBe(ArrowMode.INSIDE);
    });

    it('na zbyt krótkiej linii odwraca groty na zewnątrz', () => {
        const result = solveArrowPlacement({
            dimP1World: v3(0, 0, 0),
            dimP2World: v3(8, 0, 0),
            fwdWorld: v3(1, 0, 0),
            lineThicknessWorld: 0.8,
            textValue: '8.0 mm',
            fontSizeWorld: 14,
        });

        expect(result.mode).toBe(ArrowMode.OUTSIDE);
    });
});
