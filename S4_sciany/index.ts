/**
 * S4_sciany — SmartWall (strukturalnie jak uproszczony Bloki).
 */

export {
    SMARTWALL_TYPE,
    SMARTWALL_DRAG_MIME,
    isSmartWallContainer,
    isWallPart,
    isExcludedFromProduction,
} from './smartwall-types.js';
export type {
    SmartWallPreset,
    WallPartRole,
    SmartWallFillMm,
    SmartWallPartPlanMm,
    SmartWallPlacementMm,
    SmartWallDragPayload,
} from './smartwall-types.js';

export { planWalls } from './walls-engine.js';
export { planSkos, SKOS_DEFAULTS_MM, skosOutline2dMm } from './skos-engine.js';
export type { SkosPlanParamsMm, SkosSlant } from './skos-engine.js';
export { planPillars, defaultPillarFillMm } from './pillars-engine.js';
export { rebuildSmartWall, syncAllSmartWalls, ensureSmartWallGeneratorParams } from './smartwall-core.js';
export { rebuildSmartFloor, syncAllSmartFloors, ensureSmartFloorGeneratorParams } from './smartfloor-core.js';
export {
    SMARTFLOOR_TYPE,
    SMARTFLOOR_DRAG_MIME,
    FLOOR_DEFAULT_COLOR,
    isSmartFloorContainer,
    isFloorPart,
} from './smartfloor-types.js';
export type {
    FloorPartRole,
    SmartFloorParamsMm,
    SmartFloorDragPayload,
} from './smartfloor-types.js';
export { registerScianyModule, unregisterScianyModule } from './register.js';
export { SmartWallDragController } from './smartwall-drag-controller.js';
export type { SmartWallDragPayload as SmartWallDragPayloadFromController } from './smartwall-drag-controller.js';

export { CreateSmartWallCommand } from './commands/create-smartwall-command.js';
export type { CreateSmartWallParamsMm } from './commands/create-smartwall-command.js';
export { CreateSmartFloorCommand } from './commands/create-smartfloor-command.js';
export type { CreateSmartFloorParamsMm } from './commands/create-smartfloor-command.js';
export { SetSmartFloorParamsCommand } from './commands/set-smartfloor-params-command.js';
export type { SmartFloorParamsSnapshotMm } from './commands/set-smartfloor-params-command.js';
export { SetSmartWallParamsCommand } from './commands/set-smartwall-params-command.js';
export type { SmartWallParamsSnapshotMm } from './commands/set-smartwall-params-command.js';
export { AddWallPillarCommand } from './commands/add-wall-pillar-command.js';

export { ScianyUI } from './sciany-ui.js';
