/**
 * A2_smartbox Barrel Export — Public API
 *
 * 1 moduł = adapter + silnik + rules JSON, opcjonalnie drilling:
 *   shelf     — wieniec
 *   shelves   — półki + shelves-drilling-*
 *   doors     — drzwi + doors-drilling-*
 *   tubes     — drążek
 *   drawers   — szuflady + drawers-drilling-*
 *   dividers  — przegrody
 *   panels    — blendy (OUTER)
 *   flaps     — klapy + flaps-drilling-*
 *
 * Wspólne: base-engine, smartbox-core, smartbox-ui.
 */

export { update_smartbox_core } from './smartbox-core.js';
export { SmartBoxUI } from './smartbox-ui';
export { BaseEngine } from './base-engine.js';

export { ShelvesEngine } from './shelves-engine.js';
export { ShelfEngine } from './shelf-engine.js';
export { DoorsEngine } from './doors-engine.js';
export { TubesEngine } from './tubes-engine.js';
export { DrawersEngine } from './drawers-engine.js';
export { DividersEngine } from './dividers-engine.js';
export { PanelsEngine } from './panels-engine.js';
export { FlapsEngine } from './flaps-engine.js';

export { ShelvesSubModule, buildShelvesPlan } from './shelves-adapter.js';
export { ShelfSubModule, buildShelfPlan } from './shelf-adapter.js';
export { DoorsSubModule, buildDoorsPlan } from './doors-adapter.js';
export { TubesSubModule, buildTubesPlan } from './tubes-adapter.js';
export { DrawersSubModule, buildDrawersPlan } from './drawers-adapter.js';
export { DividersSubModule, buildDividersPlan } from './dividers-adapter.js';
export { PanelsSubModule, buildPanelsPlan } from './panels-adapter.js';
export { FlapsSubModule, buildFlapsPlan } from './flaps-adapter.js';

export { buildShelvesDrillings } from './shelves-drilling-builder.js';
export { buildDoorsDrillings } from './doors-drilling-builder.js';
export { buildDrawersDrillings } from './drawers-drilling-builder.js';
export { buildFlapsDrillings } from './flaps-drilling-builder.js';