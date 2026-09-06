import { describe, expect, it } from 'vitest';
import {
    v3,
    mat4Identity,
    mat4FromAxes,
    mat4Invert,
    mat4TransformPoint,
    isFrameDegenerate,
    orthoElbowNeeded,
    orthoBendPoint,
    solveDimension,
    solveArrowPlacement,
    FrameSource,
    HelperPolicy,
    StatusCode,
    FallbackReason,
    ArrowMode,
    ProjectionFrame,
    SelectionInput,
    DEFAULT_SOLVER_CONFIG
} from '../dimension-solver.js';

describe('Dimension Solver Core (dimension-solver.ts)', () => {
    describe('Matrix Algebra & Guards', () => {
        it('inverts identity matrix correctly', () => {
            const id = mat4Identity();
            const inv = mat4Invert(id);
            expect(inv).not.toBeNull();
            for (let i = 0; i < 16; i++) {
                expect(inv![i]).toBeCloseTo(id[i], 6);
            }
        });

        it('inverts translation and rotation matrix correctly', () => {
            const ax = v3(0, 1, 0);
            const ay = v3(-1, 0, 0);
            const az = v3(0, 0, 1);
            const t = v3(100, 200, 300);

            const m = mat4FromAxes(ax, ay, az, t);
            const inv = mat4Invert(m);
            expect(inv).not.toBeNull();

            // Transform point and back
            const p = v3(50, -30, 120);
            const pWorld = mat4TransformPoint(m, p);
            const pBack = mat4TransformPoint(inv!, pWorld);

            expect(pBack.x).toBeCloseTo(p.x, 5);
            expect(pBack.y).toBeCloseTo(p.y, 5);
            expect(pBack.z).toBeCloseTo(p.z, 5);
        });

        it('returns null for singular / degenerate matrix (det = 0)', () => {
            // Kolumny liniowo zależne
            const zeroColMatrix = [
                0, 0, 0, 0,
                0, 0, 0, 0,
                0, 0, 0, 0,
                0, 0, 0, 1
            ];
            expect(mat4Invert(zeroColMatrix)).toBeNull();
        });

        it('detects degenerate projection frames', () => {
            const validFrame: ProjectionFrame = {
                originWorld: v3(0, 0, 0),
                axisXWorld: v3(1, 0, 0),
                axisYWorld: v3(0, 1, 0),
                axisZWorld: v3(0, 0, 1),
                matrixWorld: mat4Identity(),
                matrixWorldInv: mat4Identity(),
                source: FrameSource.GLOBAL
            };
            expect(isFrameDegenerate(validFrame, DEFAULT_SOLVER_CONFIG)).toBe(false);

            // Oś o zerowej długości
            const zeroAxisFrame: ProjectionFrame = {
                ...validFrame,
                axisXWorld: v3(0, 0, 0)
            };
            expect(isFrameDegenerate(zeroAxisFrame, DEFAULT_SOLVER_CONFIG)).toBe(true);

            // Osie równoległe (kąt ~ 0)
            const parallelAxesFrame: ProjectionFrame = {
                ...validFrame,
                axisXWorld: v3(1, 0, 0),
                axisYWorld: v3(1, 0, 0)
            };
            expect(isFrameDegenerate(parallelAxesFrame, DEFAULT_SOLVER_CONFIG)).toBe(true);
        });
    });

    describe('Ortho Elbow Logic', () => {
        it('determines when ortho bend is needed', () => {
            const anchor = v3(0, 0, 0);
            // Przesunięcie tylko w osi Y -> prosta linia, brak załamania
            expect(orthoElbowNeeded(anchor, v3(0, 50, 0), 1e-4)).toBe(false);

            // Przesunięcie w obu osiach Y i Z -> wymagane załamanie ortogonalne
            expect(orthoElbowNeeded(anchor, v3(0, 50, 20), 1e-4)).toBe(true);
        });

        it('computes correct ortho bend point', () => {
            const anchor = v3(10, 20, 30);
            const dimPt = v3(10, 100, 50);
            const bend = orthoBendPoint(anchor, dimPt);

            expect(bend.x).toBe(10);
            expect(bend.y).toBe(100);
            expect(bend.z).toBe(30);
        });
    });

    describe('solveDimension Calculation', () => {
        const standardFrame: ProjectionFrame = {
            originWorld: v3(0, 0, 0),
            axisXWorld: v3(1, 0, 0),
            axisYWorld: v3(0, 1, 0),
            axisZWorld: v3(0, 0, 1),
            matrixWorld: mat4Identity(),
            matrixWorldInv: mat4Identity(),
            source: FrameSource.GLOBAL
        };

        it('solves simple orthogonal dimension in XY plane', () => {
            const selection: SelectionInput = {
                anchor1World: v3(0, 0, 0),
                anchor2World: v3(600, 0, 0),
                edgeDir1World: null,
                edgeDir2World: null,
                faceNormal1World: v3(0, 0, 1),
                faceNormal2World: v3(0, 0, 1),
                objectMatrixWorld: null,
                requestedOffset: 50,
                helperPolicy: HelperPolicy.BOTH_STRAIGHT
            };

            const res = solveDimension(standardFrame, selection);

            expect(res.status).toBe(StatusCode.OK_STRAIGHT);
            expect(res.valueLength).toBe(600);
            expect(res.dimLineWorld[0]).toEqual(v3(0, 50, 0));
            expect(res.dimLineWorld[1]).toEqual(v3(600, 50, 0));
            expect(res.renderBrokenP1).toBe(false);
            expect(res.renderBrokenP2).toBe(false);
        });

        it('guards against zero length dimension', () => {
            const selection: SelectionInput = {
                anchor1World: v3(100, 50, 20),
                anchor2World: v3(100, 50, 20),
                edgeDir1World: null,
                edgeDir2World: null,
                faceNormal1World: null,
                faceNormal2World: null,
                objectMatrixWorld: null,
                requestedOffset: 30,
                helperPolicy: HelperPolicy.BOTH_AUTO
            };

            const res = solveDimension(standardFrame, selection);
            expect(res.status).toBe(StatusCode.ERR_ZERO_LENGTH);
            expect(res.valueLength).toBe(0);
        });

        it('uses edge direction when edge vector is provided and valid', () => {
            const selection: SelectionInput = {
                anchor1World: v3(0, 0, 0),
                anchor2World: v3(400, 0, 0),
                edgeDir1World: v3(0, 1, 0), // Krawędź idzie w kierunku Y
                edgeDir2World: v3(0, 1, 0),
                faceNormal1World: v3(0, 0, 1),
                faceNormal2World: v3(0, 0, 1),
                objectMatrixWorld: null,
                requestedOffset: 80,
                helperPolicy: HelperPolicy.BOTH_AUTO
            };

            const res = solveDimension(standardFrame, selection);
            // Krawędzie idą wprost do linii wymiarowej -> proste linie
            expect(res.status).toBe(StatusCode.OK_STRAIGHT);
            expect(res.diagnosticsP1).toBe(FallbackReason.NONE);
            expect(res.diagnosticsP2).toBe(FallbackReason.NONE);
        });

        it('handles negative T and falls back appropriately when edge points in opposite direction', () => {
            const selection: SelectionInput = {
                anchor1World: v3(0, 0, 0),
                anchor2World: v3(400, 0, 0),
                edgeDir1World: v3(0, -1, 0), // Krawędź w dół, a offset w górę (+50)
                edgeDir2World: v3(0, -1, 0),
                faceNormal1World: null,
                faceNormal2World: null,
                objectMatrixWorld: null,
                requestedOffset: 50,
                helperPolicy: HelperPolicy.BOTH_AUTO
            };

            const res = solveDimension(standardFrame, selection);
            expect(res.diagnosticsP1).toBe(FallbackReason.NEGATIVE_T_CLAMPED);
            expect(res.diagnosticsP2).toBe(FallbackReason.NEGATIVE_T_CLAMPED);
            expect(res.status).toBe(StatusCode.FALLBACK_ORTHO_BOTH);
        });

        it('handles face normal fallback when edge direction is missing', () => {
            const selection: SelectionInput = {
                anchor1World: v3(0, 0, 0),
                anchor2World: v3(500, 0, 0),
                edgeDir1World: null,
                edgeDir2World: null,
                faceNormal1World: v3(0, 1, 0), // Normalna skierowana wzdłuż Y
                faceNormal2World: v3(0, 1, 0),
                objectMatrixWorld: null,
                requestedOffset: 60,
                helperPolicy: HelperPolicy.BOTH_AUTO
            };

            const res = solveDimension(standardFrame, selection);
            expect(res.status).toBe(StatusCode.FALLBACK_NORMAL_BOTH);
        });
    });

    describe('solveArrowPlacement', () => {
        it('places arrows inside for wide dimension span', () => {
            const placement = solveArrowPlacement({
                dimP1World: v3(0, 50, 0),
                dimP2World: v3(800, 50, 0),
                fwdWorld: v3(1, 0, 0),
                lineThicknessWorld: 0.8,
                textValue: '800 mm',
                fontSizeWorld: 14
            });

            expect(placement.mode).toBe(ArrowMode.INSIDE);
            expect(placement.arrowLen).toBeGreaterThan(0);
        });

        it('places arrows outside when distance is very small for text and arrows', () => {
            const placement = solveArrowPlacement({
                dimP1World: v3(0, 50, 0),
                dimP2World: v3(15, 50, 0), // Bardzo wąski rozstaw 15 mm
                fwdWorld: v3(1, 0, 0),
                lineThicknessWorld: 0.8,
                textValue: '15.0 mm',
                fontSizeWorld: 14
            });

            expect(placement.mode).toBe(ArrowMode.OUTSIDE);
            expect(placement.arrowLen).toBeGreaterThan(0);
            expect(placement.arrowWid).toBeGreaterThan(0);
        });
    });
});
