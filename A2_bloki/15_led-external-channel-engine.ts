/**
 * A2_bloki — LED zewnętrzny (kanał) — silnik systemu złożeniowego (led-external-channel-engine.ts)
 * Fasada modułu kontenera narzędziowego kanału LED (Assembly LED Channel Engine).
 *
 * Łączy i re-eksportuje:
 *  - Czysty rdzeń analityczny cięć i rzutów geometrii (led-external-channel-math.ts)
 *  - Aplikację wpustów do formatek i aktualizację siatek (led-external-channel-apply.ts)
 */

export {
    type WorldCutBox,
    type DetectedCabinetRow,
    type LedGrooveFeatureDto,
    resolvePlaneWorld,
    getNodeWorldCornersMm,
    getContainerBoundsWorldMm,
    detectCabinetRow,
    computeLedChannelWorldBox,
    computeFaceData,
    meshPointToFaceUVD,
    calculatePanelLedGroove,
} from './15_led-external-channel-math.js';

export {
    rebuildMesh,
    applyLedChannelToDocument,
    removeLedChannelFromDocument,
} from './15_led-external-channel-apply.js';
