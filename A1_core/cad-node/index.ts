/**
 * SmartPanel Web — cad-node barrel export
 * Zero zależności od Babylon.js i DOM.
 */

export { NodeType } from './node-type.js';
export { CADNode } from './cad-node.js';
export type { WorldMatrixChangedCallback } from './cad-node.js';
export { SceneSyncAdapter } from './scene-sync-adapter.js';
export { CYLINDER_SHAPE, isCylindricalPart, isTubeRodPart, readPartRole, readPartShape } from './part-shape.js';
export type { PartShapeSource } from './part-shape.js';
