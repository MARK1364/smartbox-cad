/**
 * Typ danych domenowych przypinanych do CADNode.domainData.
 * PanelLike — kontrakt bez klasy A4 PanelModel.
 * Type guard klasy: `isPanelModel` w A4_smartpanel/panel-model.ts.
 */
import type { ContainerModel } from './container-model.js';
import type { PanelLike } from './panel-like.js';
import { isPanelLike } from './panel-like.js';

export type DomainData = ContainerModel | PanelLike;

export { isPanelLike };

export function isContainerModel(data: DomainData): data is ContainerModel {
    return (data as any)?.type === 'container';
}
