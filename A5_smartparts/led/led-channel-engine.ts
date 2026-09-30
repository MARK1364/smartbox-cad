/**
 * A5_smartparts / led — led-channel-engine.ts
 * Fasada modułu kontenera narzędziowego kanału LED (Assembly LED Channel Engine).
 *
 * Łączy i re-eksportuje:
 *  - Czysty rdzeń analityczny cięć i rzutów geometrii (led-channel-math.ts)
 *  - Aplikację wpustów do formatek i aktualizację siatek (led-channel-apply.ts)
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
} from './led-channel-math.js';

export {
    rebuildMesh,
    applyLedChannelToDocument,
    removeLedChannelFromDocument,
} from './led-channel-apply.js';
