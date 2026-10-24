import { describe, it, expect } from 'vitest';
import { getRenderData, resolveMeasureAxis, computeAvailableMeasureAxes, solveDimensionBridge, isOffsetAxisAllowedAlgebraic } from '../pmi-bridge.js';
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

    it('ALIGNED nadal mierzy rzut na płaszczyznę ściany, mimo flagi isPlane', () => {
        const result = resolveMeasureAxis({
            ...globalOpts,
            axisSpace: 'ALIGNED',
            measureAxisKey: 'X',
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(300, 400, 500),
            faceNormal1World: v3(0, 0, 1),
            isPlane1: true,
        });

        expect(result?.measureAxisKey).toBe('ALIGNED');
        expect(result?.lengthMM).toBeCloseTo(500, 6);
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

    it('dla ściany mierzy wzdłuż jej normalnej, a nie od punktu kliknięcia', () => {
        // Plecy: normalna CAD Y (Babylon Z). Wcięcie L: punkt o stałej głębokości.
        // Rzut odcinka na X jest duży, ale ściana nie ma wyróżnionego X.
        const backNormal = v3(0, 0, 1);
        const notch = v3(300, 0, 700);

        for (const clickX of [10, 700]) {
            const result = resolveMeasureAxis({
                ...globalOpts,
                measureAxisKey: 'AUTO',
                anchor1World: v3(clickX, 0, 500),
                anchor2World: notch,
                faceNormal1World: backNormal,
                isPlane1: true,
            });

            expect(result?.measureAxisKey).toBe('Y');
            expect(result?.lengthMM).toBeCloseTo(200, 6);
        }
    });

    it('kierunek odsunięcia nie zmienia osi pomiaru wyznaczonej przez ścianę', () => {
        const backNormal = v3(0, 0, 1);

        for (const offsetAxisKey of ['X', 'Y', 'Z']) {
            const result = resolveMeasureAxis({
                ...globalOpts,
                measureAxisKey: 'AUTO',
                offsetAxisKey,
                anchor1World: v3(10, 0, 500),
                anchor2World: v3(300, 0, 700),
                faceNormal1World: backNormal,
                isPlane1: true,
            });

            expect(result?.measureAxisKey).toBe('Y');
            expect(result?.lengthMM).toBeCloseTo(200, 6);
        }
    });

    it('wymuszona oś leżąca w płaszczyźnie ściany nie wraca do punktu kliknięcia', () => {
        for (const measureAxisKey of ['X', 'Y', 'Z'] as const) {
            const result = resolveMeasureAxis({
                ...globalOpts,
                measureAxisKey,
                anchor1World: v3(10, 0, 500),
                anchor2World: v3(300, 0, 700),
                faceNormal1World: v3(0, 0, 1),
                isPlane1: true,
            });

            expect(result?.measureAxisKey).toBe('Y');
            expect(result?.lengthMM).toBeCloseTo(200, 6);
        }
    });

    it('gdy ścianą jest drugi element, również używa jej normalnej', () => {
        const result = resolveMeasureAxis({
            ...globalOpts,
            measureAxisKey: 'AUTO',
            anchor1World: v3(300, 0, 700),
            anchor2World: v3(10, 0, 500),
            faceNormal2World: v3(0, 0, 1),
            isPlane2: true,
        });

        expect(result?.measureAxisKey).toBe('Y');
        expect(result?.lengthMM).toBeCloseTo(200, 6);
    });

    it('normalna krawędzi na ścianie nie przejmuje osi pomiaru', () => {
        // faceNormalWorld jest też przekazywana dla krawędzi leżących na ścianie,
        // ale tylko kotwica FACE (isPlane) ma narzucać normalną.
        const result = resolveMeasureAxis({
            ...globalOpts,
            measureAxisKey: 'AUTO',
            offsetAxisKey: 'Y',
            anchor1World: v3(10, 0, 500),
            anchor2World: v3(300, 0, 700),
            faceNormal1World: v3(0, 0, 1),
            isPlane1: false,
        });

        expect(result?.measureAxisKey).toBe('X');
        expect(result?.lengthMM).toBeCloseTo(290, 6);
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
    it('buduje podgląd rozstawu 964 mm między dwiema płaszczyznami mimo różnych punktów kliknięcia', () => {
        const rd = getRenderData({
            axisSpace: 'GLOBAL',
            matrixWorld: null,
            measureAxisKey: 'AUTO',
            offsetAxisKey: 'Y',
            offsetWorld: v3(0, 0, 80),
            anchor1World: v3(-482, -180, -90),
            anchor2World: v3(482, 210, 130),
            helperAnchor1World: v3(-482, 210, 130),
            helperAnchor2World: v3(482, 210, 130),
            faceNormal1World: v3(-1, 0, 0),
            faceNormal2World: v3(1, 0, 0),
            isPlane1: true,
            isPlane2: true,
            labelText: '964 mm',
        });

        expect(rd).not.toBeNull();
        expect(rd!.resolvedMeasureAxisKey).toBe('X');
        expect(rd!.valueLength).toBeCloseTo(964, 6);
    });

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

    it('wymiar od płaszczyzny pleców do wcięcia nie zależy od kliknięcia ani kierunku odsunięcia', () => {
        for (const offsetAxisKey of ['X', 'Y', 'Z'] as const) {
            for (const clickX of [10, 700]) {
                const rd = getRenderData({
                    axisSpace: 'GLOBAL',
                    matrixWorld: null,
                    measureAxisKey: 'AUTO',
                    offsetAxisKey,
                    offsetWorld: v3(120, 0, 0),
                    anchor1World: v3(clickX, 0, 500),
                    anchor2World: v3(300, 0, 700),
                    faceNormal1World: v3(0, 0, 1),
                    isPlane1: true,
                    labelText: '200',
                });

                expect(rd).not.toBeNull();
                expect(rd!.resolvedMeasureAxisKey).toBe('Y');
                expect(rd!.valueLength).toBeCloseTo(200, 6);
                const span = Math.hypot(
                    rd!.p2DimWorld.x - rd!.p1DimWorld.x,
                    rd!.p2DimWorld.y - rd!.p1DimWorld.y,
                    rd!.p2DimWorld.z - rd!.p1DimWorld.z,
                );
                expect(span).toBeCloseTo(200, 1);
            }
        }
    });

    it('wymiar od płaszczyzny zachowuje łamaną linię pomocniczą po stronie obiektu', () => {
        // Płaszczyzna pozioma (CAD Z = Babylon Y). Kanoniczny rzut niweluje
        // różnicę wysokości, więc linia pomocnicza musi być liczona z
        // rzeczywistych punktów wyboru, inaczej zniknie załamanie.
        const rd = getRenderData({
            axisSpace: 'GLOBAL',
            matrixWorld: null,
            measureAxisKey: 'AUTO',
            offsetAxisKey: 'X',
            offsetWorld: v3(120, 0, 0),
            anchor1World: v3(10, 0, 0),
            anchor2World: v3(300, 700, 200),
            helperAnchor1World: v3(0, 0, 0),
            faceNormal1World: v3(0, 1, 0),
            isPlane1: true,
            labelText: '700',
        });

        expect(rd).not.toBeNull();
        expect(rd!.resolvedMeasureAxisKey).toBe('Z');
        expect(rd!.valueLength).toBeCloseTo(700, 6);
        expect(rd!.useBrokenP2).toBe(true);
        expect(rd!.p1AnchorWorld).toEqual(v3(0, 0, 0));
        expect(rd!.p2AnchorWorld).toEqual(v3(300, 700, 200));
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

describe('computeAvailableMeasureAxes', () => {
    it('solver używa AUTO helperów po obu stronach dla rozstawu dwóch płaszczyzn', () => {
        const result = solveDimensionBridge({
            axisSpace: 'GLOBAL',
            matrixWorld: null,
            measureAxisKey: 'X',
            offsetAxisKey: 'Y',
            offsetWorld: v3(0, 80, 0),
            anchor1World: v3(-482, 0, 0),
            anchor2World: v3(482, 0, 0),
            helperAnchor1World: v3(-482, 250, 350),
            helperAnchor2World: v3(482, 250, 350),
            dimHint1World: v3(-482, 80, 0),
            dimHint2World: v3(482, 80, 0),
            faceNormal1World: v3(-1, 0, 0),
            faceNormal2World: v3(1, 0, 0),
            isPlane1: true,
            isPlane2: true,
        });
        expect(result).not.toBeNull();
        for (const segments of [result!.solved.helper1SegmentsWorld, result!.solved.helper2SegmentsWorld]) {
            for (let i = 0; i + 1 < segments.length; i += 1) {
                expect(Math.abs(segments[i + 1].x - segments[i].x)).toBeCloseTo(0, 5);
            }
        }
    });

    it('dla ściany dostępna jest tylko oś jej normalnej, niezależnie od kliknięcia', () => {
        for (const clickX of [10, 700]) {
            const res = computeAvailableMeasureAxes({
                anchor1World: v3(clickX, 0, 500),
                anchor2World: v3(300, 0, 700),
                axisSpace: 'GLOBAL',
                faceNormal1World: v3(0, 0, 1),
                isPlane1: true,
            });

            expect(res.axes.X.available).toBe(false);
            expect(res.axes.Y.available).toBe(true);
            expect(res.axes.Y.lengthMM).toBe(200);
            expect(res.axes.Z.available).toBe(false);
        }
    });

    it('dla pojedynczej prostej krawędzi (wzdłuż osi X) tylko X jest dostępna', () => {
        const res = computeAvailableMeasureAxes({
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(600, 0, 0),
            axisSpace: 'GLOBAL',
        });

        expect(res.axes.X.available).toBe(true);
        expect(res.axes.X.lengthMM).toBe(600);

        expect(res.axes.Y.available).toBe(false);
        expect(res.axes.Y.lengthMM).toBe(0);

        expect(res.axes.Z.available).toBe(false);
        expect(res.axes.Z.lengthMM).toBe(0);

        expect(res.isDiagonal).toBe(false);
        expect(res.availableCount).toBe(1);
    });

    it('dla przekątnej (np. szerokość X i wysokość Z) obie osie są dostępne, a Y jest wygaszone', () => {
        // W Babylon CAD: wysokość to Babylon Y (CAD Z)
        const res = computeAvailableMeasureAxes({
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(800, 720, 0),
            axisSpace: 'GLOBAL',
        });

        expect(res.axes.X.available).toBe(true);
        expect(res.axes.X.lengthMM).toBe(800);

        expect(res.axes.Z.available).toBe(true);
        expect(res.axes.Z.lengthMM).toBe(720);

        expect(res.axes.Y.available).toBe(false);
        expect(res.axes.Y.lengthMM).toBe(0);

        expect(res.isDiagonal).toBe(true);
        expect(res.availableCount).toBe(2);
        expect(res.distance3DMM).toBeCloseTo(1076.3, 1);
    });

    it('dla pełnej przekątnej przestrzennej 3D wszystkie 3 osie są aktywne', () => {
        const res = computeAvailableMeasureAxes({
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(800, 720, 500),
            axisSpace: 'GLOBAL',
        });

        expect(res.axes.X.available).toBe(true);
        expect(res.axes.X.lengthMM).toBe(800);

        expect(res.axes.Y.available).toBe(true);
        expect(res.axes.Y.lengthMM).toBe(500);

        expect(res.axes.Z.available).toBe(true);
        expect(res.axes.Z.lengthMM).toBe(720);

        expect(res.isDiagonal).toBe(true);
        expect(res.availableCount).toBe(3);
    });
});


describe('isOffsetAxisAllowedAlgebraic (czysta algebra wektorowa)', () => {
    it('dla rozstawu dwoch rownoleglych scian w osi X blokuje odsuniecie w X, pozwala na Y i Z', () => {
        // Dwie rownolegle sciany z normalna X = (1, 0, 0), rozstaw 964 mm
        const opts = {
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(964, 0, 0),
            faceNormal1World: v3(1, 0, 0),
            faceNormal2World: v3(-1, 0, 0),
            isPlane1: true,
            isPlane2: true,
        };

        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(1, 0, 0) })).toBe(false);
        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(0, 1, 0) })).toBe(true);
        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(0, 0, 1) })).toBe(true);
    });

    it('dla dwoch naroznikow w pelnej przestrzeni 3D zezwala na wszystkie 3 osie odsuniecia X, Y, Z', () => {
        const opts = {
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(1000, 400, 720),
            isPlane1: false,
            isPlane2: false,
        };

        // Kazde odsuniecie ma niezerowa skladowa prostopadla, wiec pozwala mierzyc pozostale osie
        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(1, 0, 0) })).toBe(true);
        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(0, 1, 0) })).toBe(true);
        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(0, 0, 1) })).toBe(true);
    });

    it('dla punktow na prostej 1D wzdluz osi X blokuje odsuniecie w X, pozwala w Y i Z', () => {
        const opts = {
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(500, 0, 0),
            isPlane1: false,
            isPlane2: false,
        };

        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(1, 0, 0) })).toBe(false);
        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(0, 1, 0) })).toBe(true);
        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(0, 0, 1) })).toBe(true);
    });

    it('gdy os pomiaru jest zablokowana recznie (np. Shift+X), blokuje odsuniecie rownolegle do niej', () => {
        const opts = {
            anchor1World: v3(0, 0, 0),
            anchor2World: v3(1000, 400, 720),
            lockedMeasureDirWorld: v3(1, 0, 0),
        };

        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(1, 0, 0) })).toBe(false);
        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(0, 1, 0) })).toBe(true);
        expect(isOffsetAxisAllowedAlgebraic({ ...opts, offsetDirWorld: v3(0, 0, 1) })).toBe(true);
    });
});
