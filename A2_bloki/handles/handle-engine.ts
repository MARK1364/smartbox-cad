/**
 * A2_bloki / handles — handle-engine.ts
 * Fasada modułu uchwytów meblowych (SmartPart Handle).
 *
 * Łączy i re-eksportuje:
 *  - Czysty rdzeń obliczeniowy geometrii (handle-layout.ts)
 *  - Generowanie i synchronizację nawierceń CNC (handle-drilling.ts)
 *  - Wizualizację 3D w Babylon.js (handle-mesh.ts)
 *  - Aplikację do struktury CADNode / ProjectDocument (handle-apply.ts)
 */

export { computeHandleOverhang } from './handle-types.js';

export {
    type HandleComputedLayoutMm,
    computeHandleCenterFromUV,
    computeUVFromCenter,
    computeRefHolePosition,
    rebindHandleEdge,
    computeHandleCenterMm,
    ensureHandleUvMm,
    computeHandleLayout,
} from './handle-layout.js';

export {
    type HandleDrillingPlanParams,
    type HandleDrillingFeatureDto,
    resolvePanelThicknessMm,
    generateHandleDrillingFeatures,
    syncHandleDrillings,
    removeHandleDrillings,
} from './handle-drilling.js';

export {
    findPanelRootMesh,
    buildHandleParametricMesh,
    HANDLE_GLB_ORIENT,
    HANDLE_GLB_ROTATION_DEG,
    HANDLE_GLB_OUTWARD_FLIP_DEG,
    buildHandleGlbQuaternion,
    resolveHandleGlbRotationRad,
} from './handle-mesh.js';

export {
    createSmartPartHandle,
} from './handle-apply.js';
