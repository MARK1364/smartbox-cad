/**
 * SmartPanel Web — cad-math barrel export
 * Zero zależności od Babylon.js / OCCT / DOM.
 */

export { Vec3 } from './vec3.js';
export { Quat } from './quat.js';
export { Mat4 } from './mat4.js';
export {
    cadToRender,
    renderToCAD,
    cadMatrixToRenderMatrix,
    renderMatrixToCADMatrix,
    COORD_CHANGE,
    CAD_AXIS_WIDTH,
    CAD_AXIS_DEPTH,
    CAD_AXIS_HEIGHT,
    cadAxisKeyToRenderDirection,
    dominantCadAxisFromRenderDelta,
    lockCadDelta,
    cadAxesFromRenderMatrix,
} from './coord-system.js';
export {
    MM_TO_NM_FACTOR,
    NM_TO_MM_FACTOR,
    M_TO_MM_FACTOR,
    INCH_TO_NM_FACTOR,
    NM_TO_INCH_FACTOR,
    mmToNm,
    nmToMm,
    rulesMToMm,
    inchToNm,
    nmToInch,
} from './units.js';

