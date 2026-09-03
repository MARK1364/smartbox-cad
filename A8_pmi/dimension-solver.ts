/**
 * Dimension Solver v2 — TypeScript port
 *
 * Port 1:1 z `@@BLENDER/A8_pmi/dimension_solver.py`.
 * Single source of truth for ALL dimension mathematics.
 * Brak zależności od Babylon.js — czysta matematyka wektorowa.
 *
 * Norma linii pomocniczych: NORMA_LINIE_POMOCNICZE.txt
 */

// ============================================================================
// MINIMAL VECTOR3 ALGEBRA (standalone, no Babylon dependency)
// ============================================================================

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export function v3(x = 0, y = 0, z = 0): Vec3 { return { x, y, z }; }
export function v3Copy(v: Vec3): Vec3 { return { x: v.x, y: v.y, z: v.z }; }
export function v3Add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
export function v3Sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
export function v3Scale(v: Vec3, s: number): Vec3 { return { x: v.x * s, y: v.y * s, z: v.z * s }; }
export function v3Negate(v: Vec3): Vec3 { return { x: -v.x, y: -v.y, z: -v.z }; }
export function v3Dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
export function v3Cross(a: Vec3, b: Vec3): Vec3 {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
export function v3Len(v: Vec3): number { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
export function v3LenSq(v: Vec3): number { return v.x * v.x + v.y * v.y + v.z * v.z; }
export function v3Normalize(v: Vec3): Vec3 {
    const l = v3Len(v);
    return l > 1e-12 ? v3Scale(v, 1 / l) : v3(0, 0, 0);
}
export function v3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

// ============================================================================
// MINIMAL 4x4 MATRIX (column-major like mathutils.Matrix)
// ============================================================================

/** Column-major 4x4 matrix stored as flat 16 floats */
export type Mat4 = number[];

export function mat4Identity(): Mat4 {
    // prettier-ignore
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ];
}

/** Build a 4×4 from three column-axes and a translation. */
export function mat4FromAxes(ax: Vec3, ay: Vec3, az: Vec3, t: Vec3): Mat4 {
    // prettier-ignore
    return [
        ax.x, ax.y, ax.z, 0,
        ay.x, ay.y, ay.z, 0,
        az.x, az.y, az.z, 0,
        t.x,  t.y,  t.z,  1,
    ];
}

/** Transform point (w=1) by 4×4 column-major matrix. */
export function mat4TransformPoint(m: Mat4, p: Vec3): Vec3 {
    return {
        x: m[0] * p.x + m[4] * p.y + m[8]  * p.z + m[12],
        y: m[1] * p.x + m[5] * p.y + m[9]  * p.z + m[13],
        z: m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14],
    };
}

/** Transform direction (w=0) by upper-left 3×3 of a 4×4 matrix. */
export function mat4TransformDir(m: Mat4, d: Vec3): Vec3 {
    return {
        x: m[0] * d.x + m[4] * d.y + m[8]  * d.z,
        y: m[1] * d.x + m[5] * d.y + m[9]  * d.z,
        z: m[2] * d.x + m[6] * d.y + m[10] * d.z,
    };
}

/** Invert a 4×4 matrix (general case). Returns null if singular. */
export function mat4Invert(m: Mat4): Mat4 | null {
    const inv: number[] = new Array(16);
    inv[0]  =  m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15] + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
    inv[4]  = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15] - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
    inv[8]  =  m[4]*m[9]*m[15]  - m[4]*m[11]*m[13] - m[8]*m[5]*m[15] + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
    inv[12] = -m[4]*m[9]*m[14]  + m[4]*m[10]*m[13] + m[8]*m[5]*m[14] - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
    inv[1]  = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15] - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
    inv[5]  =  m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15] + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
    inv[9]  = -m[0]*m[9]*m[15]  + m[0]*m[11]*m[13] + m[8]*m[1]*m[15] - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
    inv[13] =  m[0]*m[9]*m[14]  - m[0]*m[10]*m[13] - m[8]*m[1]*m[14] + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
    inv[2]  =  m[1]*m[6]*m[15]  - m[1]*m[7]*m[14]  - m[5]*m[2]*m[15] + m[5]*m[3]*m[14] + m[13]*m[2]*m[7]  - m[13]*m[3]*m[6];
    inv[6]  = -m[0]*m[6]*m[15]  + m[0]*m[7]*m[14]  + m[4]*m[2]*m[15] - m[4]*m[3]*m[14] - m[12]*m[2]*m[7]  + m[12]*m[3]*m[6];
    inv[10] =  m[0]*m[5]*m[15]  - m[0]*m[7]*m[13]  - m[4]*m[1]*m[15] + m[4]*m[3]*m[13] + m[12]*m[1]*m[7]  - m[12]*m[3]*m[5];
    inv[14] = -m[0]*m[5]*m[14]  + m[0]*m[6]*m[13]  + m[4]*m[1]*m[14] - m[4]*m[2]*m[13] - m[12]*m[1]*m[6]  + m[12]*m[2]*m[5];
    inv[3]  = -m[1]*m[6]*m[11]  + m[1]*m[7]*m[10]  + m[5]*m[2]*m[11] - m[5]*m[3]*m[10] - m[9]*m[2]*m[7]   + m[9]*m[3]*m[6];
    inv[7]  =  m[0]*m[6]*m[11]  - m[0]*m[7]*m[10]  - m[4]*m[2]*m[11] + m[4]*m[3]*m[10] + m[8]*m[2]*m[7]   - m[8]*m[3]*m[6];
    inv[11] = -m[0]*m[5]*m[11]  + m[0]*m[7]*m[9]   + m[4]*m[1]*m[11] - m[4]*m[3]*m[9]  - m[8]*m[1]*m[7]   + m[8]*m[3]*m[5];
    inv[15] =  m[0]*m[5]*m[10]  - m[0]*m[6]*m[9]   - m[4]*m[1]*m[10] + m[4]*m[2]*m[9]  + m[8]*m[1]*m[6]   - m[8]*m[2]*m[5];

    const det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];
    if (Math.abs(det) < 1e-14) return null;
    const invDet = 1 / det;
    return inv.map(v => v * invDet);
}

// ============================================================================
// ENUMS — Public contract
// ============================================================================

export enum FrameSource {
    GLOBAL = 'GLOBAL',
    LOCAL_OBJECT = 'LOCAL_OBJECT',
    CUSTOM_PLANE = 'CUSTOM_PLANE',
}

export enum HelperPolicy {
    BOTH_AUTO = 'BOTH_AUTO',
    P1_STRAIGHT_P2_AUTO = 'P1_STRAIGHT_P2_AUTO',
    P1_AUTO_P2_STRAIGHT = 'P1_AUTO_P2_STRAIGHT',
    BOTH_STRAIGHT = 'BOTH_STRAIGHT',
}

export enum ArrowMode {
    INSIDE = 'INSIDE',
    OUTSIDE = 'OUTSIDE',
    SPLIT = 'SPLIT',
}

export enum StatusCode {
    OK_STRAIGHT = 'OK_STRAIGHT',
    OK_BROKEN_P1 = 'OK_BROKEN_P1',
    OK_BROKEN_P2 = 'OK_BROKEN_P2',
    OK_BROKEN_BOTH = 'OK_BROKEN_BOTH',
    FALLBACK_NORMAL_P1 = 'FALLBACK_NORMAL_P1',
    FALLBACK_NORMAL_P2 = 'FALLBACK_NORMAL_P2',
    FALLBACK_NORMAL_BOTH = 'FALLBACK_NORMAL_BOTH',
    FALLBACK_ORTHO_P1 = 'FALLBACK_ORTHO_P1',
    FALLBACK_ORTHO_P2 = 'FALLBACK_ORTHO_P2',
    FALLBACK_ORTHO_BOTH = 'FALLBACK_ORTHO_BOTH',
    ERR_DEGENERATE_FRAME = 'ERR_DEGENERATE_FRAME',
    ERR_ZERO_LENGTH = 'ERR_ZERO_LENGTH',
}

export enum FallbackReason {
    NONE = 'NONE',
    EDGE_MISSING = 'EDGE_MISSING',
    EDGE_PARALLEL_TO_MEASURE = 'EDGE_PARALLEL_TO_MEASURE',
    EDGE_PARALLEL_TO_OFFSET = 'EDGE_PARALLEL_TO_OFFSET',
    NEGATIVE_T_CLAMPED = 'NEGATIVE_T_CLAMPED',
    NORMAL_MISSING = 'NORMAL_MISSING',
    NORMAL_PARALLEL_TO_MEASURE = 'NORMAL_PARALLEL_TO_MEASURE',
}

// ============================================================================
// DATACLASSES — I/O Contract
// ============================================================================

export interface ProjectionFrame {
    originWorld: Vec3;
    axisXWorld: Vec3;
    axisYWorld: Vec3;
    axisZWorld: Vec3;
    matrixWorld: Mat4;
    matrixWorldInv: Mat4;
    source: FrameSource;
}

export interface SelectionInput {
    anchor1World: Vec3;
    anchor2World: Vec3;
    edgeDir1World: Vec3 | null;
    edgeDir2World: Vec3 | null;
    faceNormal1World: Vec3 | null;
    faceNormal2World: Vec3 | null;
    objectMatrixWorld: Mat4 | null;
    requestedOffset: number;
    helperPolicy: HelperPolicy;
}

export interface SolverConfig {
    epsLen: number;
    epsAng: number;
    epsParallel: number;
    minEscapeLen: number;
    minConnectorLen: number;
    preferOrthoWhenEdgeParallelToMeasureAxis: boolean;
    forcebrokenWhenOffsetCrosses: boolean;
    clampNegativeTPolicy: boolean;
    unitsScale: number;
    helperOvershoot: number;
    arrowLengthRatio: number;
    arrowWidthRatio: number;
    arrowsInsideMinArrows: number;
    arrowsInsideFloor: number;
    fontCharAspect: number;
    textMarginRatio: number;
}

export const DEFAULT_SOLVER_CONFIG: SolverConfig = {
    epsLen: 1e-6,
    epsAng: 1e-5,
    epsParallel: 1e-4,
    minEscapeLen: 0.001,
    minConnectorLen: 0.001,
    preferOrthoWhenEdgeParallelToMeasureAxis: true,
    forcebrokenWhenOffsetCrosses: true,
    clampNegativeTPolicy: false,
    unitsScale: 1.0,
    helperOvershoot: 0.002,
    arrowLengthRatio: 15.0,
    arrowWidthRatio: 1.8,
    arrowsInsideMinArrows: 6.0,
    arrowsInsideFloor: 0.25,
    fontCharAspect: 0.62,
    textMarginRatio: 0.6,
};

export interface ArrowPlacementResult {
    mode: ArrowMode;
    arrowLen: number;
    arrowWid: number;
    dimLineP1: Vec3;
    dimLineP2: Vec3;
}

export interface SolverResult {
    valueLength: number;
    dimLineWorld: [Vec3, Vec3];
    helper1SegmentsWorld: Vec3[];
    helper2SegmentsWorld: Vec3[];
    bend1World: Vec3 | null;
    bend2World: Vec3 | null;
    textOriginWorld: Vec3 | null;
    textTangentWorld: Vec3 | null;
    textUpWorld: Vec3 | null;
    textPlaneNormalWorld: Vec3 | null;
    overshoot1World: Vec3 | null;
    overshoot2World: Vec3 | null;
    status: StatusCode;
    diagnosticsP1: FallbackReason;
    diagnosticsP2: FallbackReason;
    renderBrokenP1: boolean;
    renderBrokenP2: boolean;
}

// ============================================================================
// TEXT METRICS — Pure math
// ============================================================================

export function computeTextMetrics(
    textValue: string,
    fontSizeWorld: number,
    charAspect = 0.62,
): [number, number] {
    const line = (textValue || '').split('\n')[0].trim();
    const h = Math.max(fontSizeWorld, 1e-9);
    if (!line) return [0, h];
    return [line.length * charAspect * h, h];
}

// ============================================================================
// ARROW PLACEMENT SOLVER — Pure math
// ============================================================================

export function solveArrowPlacement(opts: {
    dimP1World: Vec3;
    dimP2World: Vec3;
    fwdWorld: Vec3;
    lineThicknessWorld: number;
    textValue: string;
    fontSizeWorld: number;
    config?: Partial<SolverConfig>;
}): ArrowPlacementResult {
    const cfg = { ...DEFAULT_SOLVER_CONFIG, ...opts.config };

    const arrowLen = opts.lineThicknessWorld * cfg.arrowLengthRatio;
    const arrowWid = opts.lineThicknessWorld * cfg.arrowWidthRatio;
    const dimLen = v3Len(v3Sub(opts.dimP2World, opts.dimP1World));

    const fwd = v3Len(opts.fwdWorld) > 1e-7 ? v3Normalize(opts.fwdWorld) : v3(1, 0, 0);

    // ISO 129: groty wewnątrz, od środka na zewnątrz. Na zewnątrz tylko wtedy,
    // gdy między liniami pomocniczymi nie mieszczą się dwa groty.
    const minLenForInside = Math.max(arrowLen * 2.5, cfg.arrowsInsideFloor);
    const mode = dimLen >= minLenForInside ? ArrowMode.INSIDE : ArrowMode.OUTSIDE;

    let p1Trimmed: Vec3;
    let p2Trimmed: Vec3;

    if (mode === ArrowMode.INSIDE) {
        const effectiveTrim = Math.min(arrowLen, dimLen * 0.45);
        p1Trimmed = v3Add(opts.dimP1World, v3Scale(fwd, effectiveTrim));
        p2Trimmed = v3Sub(opts.dimP2World, v3Scale(fwd, effectiveTrim));
        if (v3Dot(v3Sub(p2Trimmed, p1Trimmed), fwd) < 0) {
            p1Trimmed = v3Copy(opts.dimP1World);
            p2Trimmed = v3Copy(opts.dimP2World);
        }
    } else {
        p1Trimmed = v3Copy(opts.dimP1World);
        p2Trimmed = v3Copy(opts.dimP2World);
    }

    return { mode, arrowLen, arrowWid, dimLineP1: p1Trimmed, dimLineP2: p2Trimmed };
}

// ============================================================================
// INTERNAL FRAME HELPERS
// ============================================================================

interface HelperSolve {
    segmentsLocal: Vec3[];
    bendLocal: Vec3 | null;
    usedBroken: boolean;
    usedNormalFallback: boolean;
    usedOrthoFallback: boolean;
    reason: FallbackReason;
}

function toLocalPoint(frame: ProjectionFrame, pWorld: Vec3): Vec3 {
    return mat4TransformPoint(frame.matrixWorldInv, pWorld);
}

function toLocalDir(frame: ProjectionFrame, dirWorld: Vec3 | null): Vec3 | null {
    if (!dirWorld || v3Len(dirWorld) <= 1e-12) return null;
    const d = mat4TransformDir(frame.matrixWorldInv, dirWorld);
    if (v3Len(d) <= 1e-12) return null;
    return v3Normalize(d);
}

function toWorldPoint(frame: ProjectionFrame, pLocal: Vec3): Vec3 {
    return mat4TransformPoint(frame.matrixWorld, pLocal);
}

function isFrameDegenerate(frame: ProjectionFrame, cfg: SolverConfig): boolean {
    const x = frame.axisXWorld, y = frame.axisYWorld, z = frame.axisZWorld;
    if (v3Len(x) <= cfg.epsLen || v3Len(y) <= cfg.epsLen || v3Len(z) <= cfg.epsLen) return true;
    const xn = v3Normalize(x), yn = v3Normalize(y);
    return Math.abs(v3Dot(xn, yn)) >= (1.0 - cfg.epsAng);
}

function orthoBendPoint(anchorLocal: Vec3, dimPtLocal: Vec3): Vec3 {
    return v3(anchorLocal.x, dimPtLocal.y, anchorLocal.z);
}

function buildOrthoSegments(anchorLocal: Vec3, dimPtLocal: Vec3): Vec3[] {
    const step = orthoBendPoint(anchorLocal, dimPtLocal);
    return [v3Copy(anchorLocal), v3Copy(step), v3Copy(step), v3Copy(dimPtLocal)];
}

function solveHelperSide(opts: {
    anchorLocal: Vec3;
    edgeDirLocal: Vec3 | null;
    normalLocal: Vec3 | null;
    dimPtLocal: Vec3;
    cfg: SolverConfig;
    forceStraight: boolean;
}): HelperSolve {
    if (opts.forceStraight) {
        return {
            segmentsLocal: [v3Copy(opts.anchorLocal), v3Copy(opts.dimPtLocal)],
            bendLocal: v3Copy(opts.anchorLocal),
            usedBroken: false,
            usedNormalFallback: false,
            usedOrthoFallback: false,
            reason: FallbackReason.NONE,
        };
    }

    // P2: orthogonal elbow
    const bend = orthoBendPoint(opts.anchorLocal, opts.dimPtLocal);
    return {
        segmentsLocal: buildOrthoSegments(opts.anchorLocal, opts.dimPtLocal),
        bendLocal: bend,
        usedBroken: false,
        usedNormalFallback: false,
        usedOrthoFallback: true,
        reason: FallbackReason.NONE,
    };
}

function resolveForceStraight(policy: HelperPolicy): [boolean, boolean] {
    switch (policy) {
        case HelperPolicy.BOTH_STRAIGHT: return [true, true];
        case HelperPolicy.P1_STRAIGHT_P2_AUTO: return [true, false];
        case HelperPolicy.P1_AUTO_P2_STRAIGHT: return [false, true];
        default: return [false, false];
    }
}

function resolveDimLineZ(a1z: number, a2z: number, fp1: boolean, fp2: boolean): number {
    const w1 = fp1 ? 1_000_000 : 1;
    const w2 = fp2 ? 1_000_000 : 1;
    return (w1 * a1z + w2 * a2z) / (w1 + w2);
}

function composeStatus(s1: HelperSolve, s2: HelperSolve): StatusCode {
    if (s1.usedOrthoFallback || s2.usedOrthoFallback) {
        if (s1.usedOrthoFallback && s2.usedOrthoFallback) return StatusCode.FALLBACK_ORTHO_BOTH;
        return s1.usedOrthoFallback ? StatusCode.FALLBACK_ORTHO_P1 : StatusCode.FALLBACK_ORTHO_P2;
    }
    if (s1.usedNormalFallback || s2.usedNormalFallback) {
        if (s1.usedNormalFallback && s2.usedNormalFallback) return StatusCode.FALLBACK_NORMAL_BOTH;
        return s1.usedNormalFallback ? StatusCode.FALLBACK_NORMAL_P1 : StatusCode.FALLBACK_NORMAL_P2;
    }
    if (s1.usedBroken && s2.usedBroken) return StatusCode.OK_BROKEN_BOTH;
    if (s1.usedBroken) return StatusCode.OK_BROKEN_P1;
    if (s2.usedBroken) return StatusCode.OK_BROKEN_P2;
    return StatusCode.OK_STRAIGHT;
}

function orthoElbowNeeded(anchor: Vec3, dim: Vec3, eps: number): boolean {
    const dy = Math.abs(dim.y - anchor.y);
    const dz = Math.abs(dim.z - anchor.z);
    if (dy <= eps && dz <= eps) return false;
    return dy > eps && dz > eps;
}

function helperRenderBroken(side: HelperSolve, forceStraight: boolean, eps = 1e-6): boolean {
    if (forceStraight) return false;
    if (side.segmentsLocal.length < 2) return false;
    const anchor = side.segmentsLocal[0];
    const dim = side.segmentsLocal[side.segmentsLocal.length - 1];
    return orthoElbowNeeded(anchor, dim, eps);
}

// ============================================================================
// MAIN SOLVER
// ============================================================================

export function solveDimension(
    frame: ProjectionFrame,
    selection: SelectionInput,
    config?: Partial<SolverConfig>,
): SolverResult {
    const cfg = { ...DEFAULT_SOLVER_CONFIG, ...config };

    const zero = v3(0, 0, 0);

    if (isFrameDegenerate(frame, cfg)) {
        return {
            valueLength: 0, dimLineWorld: [v3Copy(zero), v3Copy(zero)],
            helper1SegmentsWorld: [], helper2SegmentsWorld: [],
            bend1World: null, bend2World: null,
            textOriginWorld: null, textTangentWorld: null,
            textUpWorld: null, textPlaneNormalWorld: null,
            overshoot1World: null, overshoot2World: null,
            status: StatusCode.ERR_DEGENERATE_FRAME,
            diagnosticsP1: FallbackReason.NONE, diagnosticsP2: FallbackReason.NONE,
            renderBrokenP1: false, renderBrokenP2: false,
        };
    }

    if (v3Len(v3Sub(selection.anchor1World, selection.anchor2World)) < cfg.epsLen) {
        return {
            valueLength: 0, dimLineWorld: [v3Copy(zero), v3Copy(zero)],
            helper1SegmentsWorld: [], helper2SegmentsWorld: [],
            bend1World: null, bend2World: null,
            textOriginWorld: null, textTangentWorld: null,
            textUpWorld: null, textPlaneNormalWorld: null,
            overshoot1World: null, overshoot2World: null,
            status: StatusCode.ERR_ZERO_LENGTH,
            diagnosticsP1: FallbackReason.NONE, diagnosticsP2: FallbackReason.NONE,
            renderBrokenP1: false, renderBrokenP2: false,
        };
    }

    const a1Local = toLocalPoint(frame, selection.anchor1World);
    const a2Local = toLocalPoint(frame, selection.anchor2World);
    const a1Frame = v3(a1Local.x, a1Local.y, a1Local.z);
    const a2Frame = v3(a2Local.x, a2Local.y, a2Local.z);
    const dimY = selection.requestedOffset;

    const valueLength = Math.abs(a2Frame.x - a1Frame.x) * cfg.unitsScale;
    if (valueLength <= cfg.epsLen) {
        return {
            valueLength: 0, dimLineWorld: [v3Copy(zero), v3Copy(zero)],
            helper1SegmentsWorld: [], helper2SegmentsWorld: [],
            bend1World: null, bend2World: null,
            textOriginWorld: null, textTangentWorld: null,
            textUpWorld: null, textPlaneNormalWorld: null,
            overshoot1World: null, overshoot2World: null,
            status: StatusCode.ERR_ZERO_LENGTH,
            diagnosticsP1: FallbackReason.NONE, diagnosticsP2: FallbackReason.NONE,
            renderBrokenP1: false, renderBrokenP2: false,
        };
    }

    const edge1Local = toLocalDir(frame, selection.edgeDir1World);
    const edge2Local = toLocalDir(frame, selection.edgeDir2World);
    const n1Local = toLocalDir(frame, selection.faceNormal1World);
    const n2Local = toLocalDir(frame, selection.faceNormal2World);

    const [forceP1Straight, forceP2Straight] = resolveForceStraight(selection.helperPolicy);
    const dimZ = resolveDimLineZ(a1Frame.z, a2Frame.z, forceP1Straight, forceP2Straight);

    const p1DimLocal = v3(a1Frame.x, dimY, dimZ);
    const p2DimLocal = v3(a2Frame.x, dimY, dimZ);

    const side1 = solveHelperSide({
        anchorLocal: a1Frame, edgeDirLocal: edge1Local, normalLocal: n1Local,
        dimPtLocal: p1DimLocal, cfg, forceStraight: forceP1Straight,
    });
    const side2 = solveHelperSide({
        anchorLocal: a2Frame, edgeDirLocal: edge2Local, normalLocal: n2Local,
        dimPtLocal: p2DimLocal, cfg, forceStraight: forceP2Straight,
    });

    // Ensure last segment endpoint matches canonical dim point
    side1.segmentsLocal[side1.segmentsLocal.length - 1] = v3Copy(p1DimLocal);
    side2.segmentsLocal[side2.segmentsLocal.length - 1] = v3Copy(p2DimLocal);

    const helper1World = side1.segmentsLocal.map(p => toWorldPoint(frame, p));
    const helper2World = side2.segmentsLocal.map(p => toWorldPoint(frame, p));
    const bend1World = side1.bendLocal ? toWorldPoint(frame, side1.bendLocal) : null;
    const bend2World = side2.bendLocal ? toWorldPoint(frame, side2.bendLocal) : null;

    const dimP1World = toWorldPoint(frame, p1DimLocal);
    const dimP2World = toWorldPoint(frame, p2DimLocal);

    // Text placement
    const textOriginWorld = v3Lerp(dimP1World, dimP2World, 0.5);
    let textTangentWorld = v3Sub(dimP2World, dimP1World);
    if (v3Len(textTangentWorld) <= cfg.epsLen) textTangentWorld = v3Copy(frame.axisXWorld);
    if (v3Len(textTangentWorld) > cfg.epsLen) textTangentWorld = v3Normalize(textTangentWorld);
    let textUpWorld = v3Copy(frame.axisYWorld);
    if (v3Len(textUpWorld) > cfg.epsLen) textUpWorld = v3Normalize(textUpWorld);
    let textPlaneNormalWorld = v3Copy(frame.axisZWorld);
    if (v3Len(textPlaneNormalWorld) > cfg.epsLen) textPlaneNormalWorld = v3Normalize(textPlaneNormalWorld);

    // ISO overshoot
    const overshootVec = v3Scale(textUpWorld, cfg.helperOvershoot);
    const overshoot1World = v3Add(dimP1World, overshootVec);
    const overshoot2World = v3Add(dimP2World, overshootVec);

    const status = composeStatus(side1, side2);
    const renderBrokenP1 = helperRenderBroken(side1, forceP1Straight, cfg.epsLen);
    const renderBrokenP2 = helperRenderBroken(side2, forceP2Straight, cfg.epsLen);

    return {
        valueLength,
        dimLineWorld: [dimP1World, dimP2World],
        helper1SegmentsWorld: helper1World,
        helper2SegmentsWorld: helper2World,
        bend1World, bend2World,
        textOriginWorld, textTangentWorld, textUpWorld, textPlaneNormalWorld,
        overshoot1World, overshoot2World,
        status, diagnosticsP1: side1.reason, diagnosticsP2: side2.reason,
        renderBrokenP1, renderBrokenP2,
    };
}
