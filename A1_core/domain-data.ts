/**
 * Typ danych domenowych przypinanych do CADNode.domainData.
 * PanelLike — kontrakt bez klasy A4 PanelModel.
 * Type guard klasy: `isPanelModel` w A4_smartpanel/panel-model.ts.
 */
import type { ContainerModel } from './container-model.js';
import type { PanelLike } from './panel-like.js';
import type { HardwareModel } from './hardware-model.js';
import { isPanelLike } from './panel-like.js';

export type DomainData = ContainerModel | PanelLike | HardwareModel;

export { isPanelLike };

export function isContainerModel(data: DomainData): data is ContainerModel {
    return (data as any)?.type === 'container';
}

export function isHardwareModel(data: DomainData): data is HardwareModel {
    return (data as any)?.type === 'hardware' || (data as any)?.nodeType === 'HARDWARE';
}
