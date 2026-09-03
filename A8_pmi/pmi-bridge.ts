/**
 * PMI Bridge — TypeScript
 *
 * Adapter Babylon.js → Dimension Solver.
 * Port logiki z `pmi_bridge.py`. Tłumaczy kontekst Babylon.js na dane
 * wejściowe solvera i zwraca payload gotowy do renderingu.
 */

import {
    Vec3, Mat4, v3, v3Copy, v3Add, v3Sub, v3Scale, v3Negate,
    v3Dot, v3Cross, v3Len, v3Normalize, v3Lerp,
    mat4FromAxes, mat4Invert, mat4TransformPoint, mat4TransformDir,
    ProjectionFrame, SelectionInput, SolverConfig, SolverResult,
    ArrowPlacementResult, ArrowMode,
    FrameSource, HelperPolicy, StatusCode,
    DEFAULT_SOLVER_CONFIG, solveDimension, solveArrowPlacement,
} from './dimension-solver';
import {
    cadAxesFromRenderMatrix,
    dominantCadAxisFromRenderDelta,
} from '../A1_core/cad-math/coord-system.js';

// ============================================================================
// BRIDGE RESULT TYPES
// ============================================================================

export interface BridgeSolveResult {
    solved: SolverResult;
    frame: ProjectionFrame;
    axisXWorld: Vec3;
    axisYWorld: Vec3;
    axisZWorld: Vec3;
    requestedOffset: number;
}

export interface BridgeRenderData {
    p1DimWorld: Vec3;
    p2DimWorld: Vec3;
    p1AnchorWorld: Vec3;
    p2AnchorWorld: Vec3;
    p1BendWorld: Vec3;
    p2BendWorld: Vec3;
    useBrokenP1: boolean;
    useBrokenP2: boolean;
    arrowsOutside: boolean;
    arrowLen: number;
    arrowWid: number;
    dimLineP1World: Vec3;
    dimLineP2World: Vec3;
    fwdWorld: Vec3;
    upWorld: Vec3;
    sideWorld: Vec3;
    thickMain: number;
    thickHelper: number;
    labelText: string;
    /** Zmierzona długość wyznaczona przez solver [mm] — wartość pokazywana na etykiecie. */
    valueLength: number;
    /** Oś pomiaru faktycznie użyta po rozwiązaniu AUTO i zabezpieczeń. */
    resolvedMeasureAxisKey: string;
}

export type HelperSegment = [Vec3, Vec3];

// ============================================================================
// HELPER LINE SEGMENTS — jedyny punkt budowy (UI)
// ============================================================================

export function* iterHelperLineSegments(opts: {
    p1Anchor: Vec3; p1Bend: Vec3; p1Dim: Vec3; useBrokenP1: boolean;
    p2Anchor: Vec3; p2Bend: Vec3; p2Dim: Vec3; useBrokenP2: boolean;
}): Generator<HelperSegment> {
    if (opts.useBrokenP1) {
        yield [opts.p1Anchor, opts.p1Bend];
        yield [opts.p1Bend, opts.p1Dim];
    } else {
        yield [opts.p1Anchor, opts.p1Dim];
    }
    if (opts.useBrokenP2) {
        yield [opts.p2Anchor, opts.p2Bend];
        yield [opts.p2Bend, opts.p2Dim];
    } else {
        yield [opts.p2Anchor, opts.p2Dim];
    }
}

export function helperSegmentsFromRenderData(rd: BridgeRenderData): HelperSegment[] {
    return [...iterHelperLineSegments({
        p1Anchor: rd.p1AnchorWorld, p1Bend: rd.p1BendWorld, p1Dim: rd.p1DimWorld, useBrokenP1: rd.useBrokenP1,
        p2Anchor: rd.p2AnchorWorld, p2Bend: rd.p2BendWorld, p2Dim: rd.p2DimWorld, useBrokenP2: rd.useBrokenP2,
    })];
}

export function helperSegmentsFromSolved(
    solved: SolverResult,
    p1AnchorWorld: Vec3,
    p2AnchorWorld: Vec3,
): HelperSegment[] {
    const [p1Dim, p2Dim] = solved.dimLineWorld;
    const p1Bend = solved.bend1World ?? v3Copy(p1AnchorWorld);
    const p2Bend = solved.bend2World ?? v3Copy(p2AnchorWorld);
    return [...iterHelperLineSegments({
        p1Anchor: p1AnchorWorld, p1Bend, p1Dim, useBrokenP1: solved.renderBrokenP1,
        p2Anchor: p2AnchorWorld, p2Bend, p2Dim, useBrokenP2: solved.renderBrokenP2,
    })];
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

const HELPER_LINE_THICKNESS_RATIO = 0.55;

function normalizedOrFallback(vec: Vec3 | null, fallback: Vec3, eps = 1e-7): Vec3 {
    const v = vec ? v3Copy(vec) : v3(0, 0, 0);
    if (v3Len(v) <= eps) return v3Copy(fallback);
    return v3Normalize(v);
}

function axesMapWorld(axisSpace: string, matrixWorld: Mat4 | null): Record<string, Vec3> {
    const defaultMap: Record<string, Vec3> = {
        X: v3(1, 0, 0),
        Y: v3(0, 0, 1), // CAD głębokość → Babylon Z
        Z: v3(0, 1, 0), // CAD wysokość → Babylon Y
    };
    if ((axisSpace || 'GLOBAL').toUpperCase() !== 'LOCAL' || !matrixWorld) return defaultMap;

    const cadAxes = cadAxesFromRenderMatrix(matrixWorld);
    return {
        X: normalizedOrFallback(v3(cadAxes.X.x, cadAxes.X.y, cadAxes.X.z), defaultMap.X),
        Y: normalizedOrFallback(v3(cadAxes.Y.x, cadAxes.Y.y, cadAxes.Y.z), defaultMap.Y),
        Z: normalizedOrFallback(v3(cadAxes.Z.x, cadAxes.Z.y, cadAxes.Z.z), defaultMap.Z),
    };
}

function orthonormalAxes(axisX: Vec3, axisYSeed: Vec3): [Vec3, Vec3, Vec3] | null {
    const x = normalizedOrFallback(axisX, v3(1, 0, 0));
    let y = v3Sub(axisYSeed, v3Scale(x, v3Dot(axisYSeed, x)));
    if (v3Len(y) <= 1e-7) {
        const cand = Math.abs(x.y) < 0.9 ? v3(0, 1, 0) : v3(0, 0, 1);
        y = v3Sub(cand, v3Scale(x, v3Dot(cand, x)));
    }
    if (v3Len(y) <= 1e-7) return null;
    y = v3Normalize(y);
    let z = v3Cross(x, y);
    if (v3Len(z) <= 1e-7) return null;
    z = v3Normalize(z);
    return [x, y, z];
}

function dominantMeasureAxisKey(
    delta: Vec3,
    axisSpace: string,
    axisMap: Record<string, Vec3>,
): string {
    if ((axisSpace || '').toUpperCase() === 'LOCAL') {
        let bestKey = 'X';
        let bestScore = -1;
        for (const k of ['X', 'Y', 'Z']) {
            const score = Math.abs(v3Dot(delta, axisMap[k] ?? v3(0, 0, 0)));
            if (score > bestScore) {
                bestScore = score;
                bestKey = k;
            }
        }
        return bestKey;
    }
    return dominantCadAxisFromRenderDelta(delta.x, delta.y, delta.z);
}

/** Oś prostopadła do pomiaru, wzdłuż której liczone jest odsunięcie linii wymiarowej. */
function offsetAxisSeed(
    axisMap: Record<string, Vec3>,
    measureKey: string,
    offsetKey: string,
    offsetWorld: Vec3 | null,
): Vec3 {
    const oKey = (offsetKey || '').toUpperCase();
    if (oKey in axisMap && oKey !== measureKey) {
        let seed = v3Copy(axisMap[oKey]);
        if (offsetWorld && v3Len(offsetWorld) > 1e-7 && v3Dot(offsetWorld, seed) < 0) {
            seed = v3Negate(seed);
        }
        return seed;
    }

    const candidates = ['X', 'Y', 'Z'].filter(k => k !== measureKey && k in axisMap);
    if (!candidates.length) return v3(0, 1, 0);
    if (!offsetWorld || v3Len(offsetWorld) <= 1e-7) return v3Copy(axisMap[candidates[0]]);

    let bestKey = candidates[0];
    let bestScore = -1;
    for (const k of candidates) {
        const score = Math.abs(v3Dot(offsetWorld, axisMap[k]));
        if (score > bestScore) {
            bestScore = score;
            bestKey = k;
        }
    }
    let chosen = v3Copy(axisMap[bestKey]);
    if (v3Dot(offsetWorld, chosen) < 0) chosen = v3Negate(chosen);
    return chosen;
}

// ============================================================================
// MEASURE AXIS — jedno źródło prawdy
// ============================================================================

export interface MeasureAxisResolution {
    /** Oś pomiaru po rozwinięciu AUTO i zabezpieczeniu przed zerowym rzutem. */
    measureAxisKey: string;
    /** Kierunek osi pomiaru w przestrzeni świata. */
    axisXWorld: Vec3;
    /** Długość odcinka zrzutowana na oś pomiaru [mm]. */
    lengthMM: number;
    axisMap: Record<string, Vec3>;
}

/**
 * Rozstrzyga, wzdłuż jakiej osi mierzony jest wymiar, i zwraca zrzutowaną długość.
 *
 * Ta sama funkcja zasila solver i etykietę, dzięki czemu wyświetlana wartość nie
 * może się rozjechać z narysowaną geometrią.
 */
export function resolveMeasureAxis(opts: {
    axisSpace: string;
    matrixWorld: Mat4 | null;
    measureAxisKey: string;
    anchor1World: Vec3;
    anchor2World: Vec3;
    faceNormal1World?: Vec3 | null;
    faceNormal2World?: Vec3 | null;
}): MeasureAxisResolution | null {
    const delta = v3Sub(opts.anchor2World, opts.anchor1World);
    if (v3Len(delta) <= 1e-6) return null;

    const axisMap = axesMapWorld(opts.axisSpace, opts.matrixWorld);

    if ((opts.axisSpace || '').toUpperCase() === 'ALIGNED') {
        // ALIGNED w PMI: rzut równoległy na jedną płaszczyznę referencyjną,
        // jeśli dostępna jest normalna ściany. Fallback: klasyczny odcinek 3D.
        const normal = opts.faceNormal1World ?? opts.faceNormal2World ?? null;
        if (normal && v3Len(normal) > 1e-7) {
            const n = v3Normalize(normal);
            const projected = v3Sub(delta, v3Scale(n, v3Dot(delta, n)));
            const projectedLen = v3Len(projected);
            if (projectedLen > 1e-6) {
                const axisX = v3Scale(projected, 1 / projectedLen);
                return { measureAxisKey: 'ALIGNED', axisXWorld: axisX, lengthMM: projectedLen, axisMap };
            }
        }

        const axisX = v3Normalize(delta);
        return { measureAxisKey: 'ALIGNED', axisXWorld: axisX, lengthMM: v3Len(delta), axisMap };
    }

    let measureKey = (opts.measureAxisKey || 'AUTO').toUpperCase();

    if (!['X', 'Y', 'Z'].includes(measureKey)) {
        measureKey = dominantMeasureAxisKey(delta, opts.axisSpace, axisMap);
    } else {
        // Zabezpieczenie: wymuszona oś prostopadła do odcinka dałaby wymiar zerowy.
        const chosen = axisMap[measureKey] || axisMap.X;
        if (Math.abs(v3Dot(delta, chosen)) < 1e-4) {
            measureKey = dominantMeasureAxisKey(delta, opts.axisSpace, axisMap);
        }
    }

    const axisX = v3Copy(axisMap[measureKey] || axisMap.X);
    return {
        measureAxisKey: measureKey,
        axisXWorld: axisX,
        lengthMM: Math.abs(v3Dot(delta, axisX)),
        axisMap,
    };
}

// ============================================================================
// CORE BRIDGE FUNCTION
// ============================================================================

export function solveDimensionBridge(opts: {
    axisSpace: string;
    matrixWorld: Mat4 | null;
    measureAxisKey: string;
    offsetAxisKey: string;
    offsetWorld: Vec3 | null;
    anchor1World: Vec3;
    anchor2World: Vec3;
    dimHint1World: Vec3;
    dimHint2World: Vec3;
    edgeDir1World?: Vec3 | null;
    edgeDir2World?: Vec3 | null;
    faceNormal1World?: Vec3 | null;
    faceNormal2World?: Vec3 | null;
    helperPolicy?: HelperPolicy;
    config?: Partial<SolverConfig>;
}): BridgeSolveResult | null {
    let axisX: Vec3;
    let axisYSeed: Vec3;
    let helperPolicy = opts.helperPolicy ?? HelperPolicy.P1_STRAIGHT_P2_AUTO;

    const delta = v3Sub(opts.anchor2World, opts.anchor1World);
    const deltaLen = v3Len(delta);
    if (deltaLen <= 1e-6) return null;

    if ((opts.axisSpace || '').toUpperCase() === 'ALIGNED') {
        axisX = v3Normalize(delta);

        axisYSeed = (opts.offsetWorld && v3Len(opts.offsetWorld) > 1e-7)
            ? opts.offsetWorld
            : v3Cross(axisX, v3(0, 0, 1));
        if (v3Len(axisYSeed) < 1e-7) axisYSeed = v3Cross(axisX, v3(0, 1, 0));

        helperPolicy = HelperPolicy.BOTH_STRAIGHT;
    } else {
        const resolution = resolveMeasureAxis({
            axisSpace: opts.axisSpace,
            matrixWorld: opts.matrixWorld,
            measureAxisKey: opts.measureAxisKey,
            anchor1World: opts.anchor1World,
            anchor2World: opts.anchor2World,
            faceNormal1World: opts.faceNormal1World,
            faceNormal2World: opts.faceNormal2World,
        });
        if (!resolution) return null;

        const { axisMap, measureAxisKey: measureKey } = resolution;
        axisX = v3Copy(resolution.axisXWorld);
        axisYSeed = offsetAxisSeed(
            axisMap,
            measureKey,
            opts.offsetAxisKey,
            opts.offsetWorld ?? null,
        );
    }

    const basis = orthonormalAxes(axisX, axisYSeed);
    if (!basis) return null;
    const [basisX, basisY, basisZ] = basis;

    const originWorld = v3Lerp(opts.anchor1World, opts.anchor2World, 0.5);
    const frameM = mat4FromAxes(basisX, basisY, basisZ, originWorld);
    const frameInv = mat4Invert(frameM);
    if (!frameInv) return null;

    // Requested offset — skalar wzdłuż basisY (osi odsunięcia w ramce solvera).
    let requestedOffset: number;
    if (opts.offsetWorld && v3Len(opts.offsetWorld) > 1e-12) {
        requestedOffset = v3Dot(opts.offsetWorld, basisY);
    } else {
        const h1 = mat4TransformPoint(frameInv, opts.dimHint1World);
        const h2 = mat4TransformPoint(frameInv, opts.dimHint2World);
        requestedOffset = 0.5 * (h1.y + h2.y);
    }

    // Default offset fallback if 0
    if (Math.abs(requestedOffset) < 1e-4) {
        // Zachowaj stronę gestu: stałe +30 na lewym boku odwracało wymiar w +X.
        const sign = (opts.offsetWorld && v3Dot(opts.offsetWorld, basisY) < 0) ? -1 : 1;
        requestedOffset = 30 * sign;
    }

    const frame: ProjectionFrame = {
        originWorld, axisXWorld: v3Copy(basisX), axisYWorld: v3Copy(basisY), axisZWorld: v3Copy(basisZ),
        matrixWorld: frameM, matrixWorldInv: frameInv,
        source: (opts.axisSpace || 'GLOBAL').toUpperCase() === 'LOCAL' ? FrameSource.LOCAL_OBJECT : FrameSource.GLOBAL,
    };

    const selection: SelectionInput = {
        anchor1World: v3Copy(opts.anchor1World),
        anchor2World: v3Copy(opts.anchor2World),
        edgeDir1World: opts.edgeDir1World ? v3Copy(opts.edgeDir1World) : null,
        edgeDir2World: opts.edgeDir2World ? v3Copy(opts.edgeDir2World) : null,
        faceNormal1World: opts.faceNormal1World ? v3Copy(opts.faceNormal1World) : v3Copy(basisZ),
        faceNormal2World: opts.faceNormal2World ? v3Copy(opts.faceNormal2World) : v3Copy(basisZ),
        objectMatrixWorld: opts.matrixWorld ? [...opts.matrixWorld] : null,
        requestedOffset,
        helperPolicy,
    };

    const cfg = { ...DEFAULT_SOLVER_CONFIG, ...opts.config };
    const solved = solveDimension(frame, selection, cfg);

    if (
        solved.status === StatusCode.ERR_DEGENERATE_FRAME
        || solved.status === StatusCode.ERR_ZERO_LENGTH
    ) {
        return null;
    }

    return {
        solved, frame,
        axisXWorld: v3Copy(basisX), axisYWorld: v3Copy(basisY), axisZWorld: v3Copy(basisZ),
        requestedOffset,
    };
}

// ============================================================================
// RENDER DATA BUILDER
// ============================================================================

export function getRenderData(opts: {
    axisSpace: string;
    matrixWorld: Mat4 | null;
    measureAxisKey: string;
    offsetAxisKey: string;
    offsetWorld: Vec3;
    anchor1World: Vec3;
    anchor2World: Vec3;
    edgeDir1World?: Vec3 | null;
    edgeDir2World?: Vec3 | null;
    faceNormal1World?: Vec3 | null;
    faceNormal2World?: Vec3 | null;
    helperPolicy?: HelperPolicy;
    config?: Partial<SolverConfig>;
    worldThickness?: number;
    fontSizeWorld?: number;
    labelText?: string;
}): BridgeRenderData | null {
    const worldThickness = opts.worldThickness ?? 0.8;
    const fontSizeWorld = opts.fontSizeWorld ?? 14;
    const labelText = opts.labelText ?? '';

    const edgeVec = v3Sub(opts.anchor2World, opts.anchor1World);
    const dist = v3Len(edgeVec);
    if (dist <= 1e-6) return null;

    const measure = resolveMeasureAxis({
        axisSpace: opts.axisSpace,
        matrixWorld: opts.matrixWorld,
        measureAxisKey: opts.measureAxisKey,
        anchor1World: opts.anchor1World,
        anchor2World: opts.anchor2World,
        faceNormal1World: opts.faceNormal1World,
        faceNormal2World: opts.faceNormal2World,
    });

    const bridge = solveDimensionBridge({
        axisSpace: opts.axisSpace,
        matrixWorld: opts.matrixWorld,
        measureAxisKey: opts.measureAxisKey,
        offsetAxisKey: opts.offsetAxisKey,
        offsetWorld: opts.offsetWorld,
        anchor1World: opts.anchor1World,
        anchor2World: opts.anchor2World,
        dimHint1World: v3Add(opts.anchor1World, opts.offsetWorld),
        dimHint2World: v3Add(opts.anchor2World, opts.offsetWorld),
        edgeDir1World: opts.edgeDir1World,
        edgeDir2World: opts.edgeDir2World,
        faceNormal1World: opts.faceNormal1World,
        faceNormal2World: opts.faceNormal2World,
        helperPolicy: opts.helperPolicy,
        config: opts.config,
    });

    if (!bridge) {
        // Fallback directly to parallel offset
        const ax = v3Normalize(edgeVec);
        let ay = opts.offsetWorld && v3Len(opts.offsetWorld) > 1e-4 ? v3Normalize(opts.offsetWorld) : v3Cross(ax, v3(0, 0, 1));
        if (v3Len(ay) < 1e-4) ay = v3Cross(ax, v3(0, 1, 0));
        ay = v3Normalize(ay);

        const offsetDist = Math.max(v3Len(opts.offsetWorld), 25);
        const p1DimW = v3Add(opts.anchor1World, v3Scale(ay, offsetDist));
        const p2DimW = v3Add(opts.anchor2World, v3Scale(ay, offsetDist));

        const thickMain = worldThickness;
        const thickHelper = thickMain * HELPER_LINE_THICKNESS_RATIO;
        const arrowResult = solveArrowPlacement({
            dimP1World: p1DimW, dimP2World: p2DimW,
            fwdWorld: ax, lineThicknessWorld: thickMain,
            textValue: labelText, fontSizeWorld, config: opts.config,
        });

        return {
            p1DimWorld: p1DimW,
            p2DimWorld: p2DimW,
            p1AnchorWorld: v3Copy(opts.anchor1World),
            p2AnchorWorld: v3Copy(opts.anchor2World),
            p1BendWorld: v3Copy(opts.anchor1World),
            p2BendWorld: v3Copy(opts.anchor2World),
            useBrokenP1: false,
            useBrokenP2: false,
            arrowsOutside: arrowResult.mode === ArrowMode.OUTSIDE,
            arrowLen: arrowResult.arrowLen,
            arrowWid: arrowResult.arrowWid,
            dimLineP1World: arrowResult.dimLineP1,
            dimLineP2World: arrowResult.dimLineP2,
            fwdWorld: ax,
            upWorld: ay,
            sideWorld: v3Normalize(v3Cross(ax, ay)),
            thickMain,
            thickHelper,
            labelText,
            valueLength: measure ? measure.lengthMM : dist,
            resolvedMeasureAxisKey: measure ? measure.measureAxisKey : 'ALIGNED',
        };
    }

    const solved = bridge.solved;
    const cfg = { ...DEFAULT_SOLVER_CONFIG, ...opts.config };
    const [p1DimW, p2DimW] = solved.dimLineWorld;

    let fwdW = v3Sub(p2DimW, p1DimW);
    fwdW = v3Len(fwdW) > 1e-7 ? v3Normalize(fwdW) : v3Copy(bridge.axisXWorld);

    const upW = v3Copy(bridge.axisYWorld);
    let sideW = v3Cross(fwdW, upW);
    if (v3Len(sideW) < 1e-7) {
        const fb = Math.abs(fwdW.z) < 0.9 ? v3(0, 0, 1) : v3(0, 1, 0);
        sideW = v3Cross(fwdW, fb);
    }
    sideW = v3Len(sideW) < 1e-7 ? v3(0, 1, 0) : v3Normalize(sideW);

    const thickMain = worldThickness;
    const thickHelper = thickMain * HELPER_LINE_THICKNESS_RATIO;

    const arrowResult = solveArrowPlacement({
        dimP1World: p1DimW, dimP2World: p2DimW,
        fwdWorld: fwdW, lineThicknessWorld: thickMain,
        textValue: labelText, fontSizeWorld, config: cfg,
    });

    const p1BendW = solved.bend1World ?? v3Copy(opts.anchor1World);
    const p2BendW = solved.bend2World ?? v3Copy(opts.anchor2World);

    return {
        p1DimWorld: p1DimW,
        p2DimWorld: p2DimW,
        p1AnchorWorld: v3Copy(opts.anchor1World),
        p2AnchorWorld: v3Copy(opts.anchor2World),
        p1BendWorld: p1BendW,
        p2BendWorld: p2BendW,
        useBrokenP1: solved.renderBrokenP1,
        useBrokenP2: solved.renderBrokenP2,
        arrowsOutside: arrowResult.mode === ArrowMode.OUTSIDE,
        arrowLen: arrowResult.arrowLen,
        arrowWid: arrowResult.arrowWid,
        dimLineP1World: arrowResult.dimLineP1,
        dimLineP2World: arrowResult.dimLineP2,
        fwdWorld: fwdW,
        upWorld: upW,
        sideWorld: sideW,
        thickMain,
        thickHelper,
        labelText,
        valueLength: solved.valueLength,
        resolvedMeasureAxisKey: measure ? measure.measureAxisKey : 'ALIGNED',
    };
}
