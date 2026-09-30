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
export type { LedChannelDefinition } from './led/led-channel-types.js';

// ─── Handles (Uchwyty Meblowe) ───
export * from './handles/handle-types.js';
export * from './handles/handle-engine.js';
export * from './handles/handle-detector.js';
export * from './handles/handle-visualizer.js';
export * from './handles/handle-controller.js';
export * from './handles/handle-dim-gizmo.js';

