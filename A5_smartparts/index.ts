/**
 * A5 — SmartParts: narzędzia parametryczne (SmartPart).
 * Moduł zawiera narzędzia do tworzenia gotowych elementów:
 * - Kanał LED (wpust pod profil LED w wieńcach szafek)
 * - (planowane) Kanały wentylacyjne, kratki, itp.
 */

// ─── LED Channel ───
export {
    LedChannelStore,
    startGuidedLedPick,
    stopGuidedLedPick,
    handleLedChannelDrop,
} from './led/led-channel-store.js';
export { LedChannelUI } from './led/led-channel-ui.js';
export { SmartPartsUI } from './smartparts-ui.js';
export { FloatingSmartPartDialog, CAD_CLOSE_FLOATING_SMARTPART } from './floating-smartpart-dialog.js';
export { SmartPartParamPanel } from './smartpart-param-panel.js';
export { SmartPartEditPanel } from './smartpart-edit-panel.js';
export type { LedChannelDefinition } from './led/led-channel-types.js';

// ─── Handles (Uchwyty) — silnik w A2_bloki/handles (jak szuflady w A2) ───
export * from '../A2_bloki/handles/handle-types.js';
export * from '../A2_bloki/handles/handle-engine.js';
export * from '../A2_bloki/handles/handle-detector.js';
export * from '../A2_bloki/handles/handle-visualizer.js';
export * from '../A2_bloki/handles/handle-controller.js';
export * from '../A2_bloki/handles/handle-dim-gizmo.js';
export { HandleEditPanel } from '../A2_bloki/handles/handle-edit-panel.js';
export { HandleCatalogBrowser } from '../A2_bloki/handles/handle-catalog-browser.js';

// ─── Hangers (Zawieszki Camaro — wieszanie szafek) ───
export * from './hangers/hanger-types.js';
export { computeHangerCornerPoses, createSmartPartHangersInBay } from './hangers/hanger-apply.js';
export { buildHangerGlbMesh, syncHangerMeshesFromDocument } from './hangers/hanger-mesh.js';
export { HangerDragController } from './hangers/hanger-controller.js';

// ─── Studio 3D (Kreator Akcesoriów i Bloków 3D) ───
export * from '../S5_studio/index.js';

