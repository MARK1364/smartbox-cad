/**
 * Typ danych domenowych przypinanych do CADNode.domainData.
 * PanelModel (A4) + ContainerModel (A1) — import type, bez cykli runtime.
 */
import type { ContainerModel } from './container-model.js';
import type { PanelModel } from '../A4_smartpanel/panel-model.js';

export type DomainData = ContainerModel | PanelModel;

export function isPanelModel(data: DomainData): data is PanelModel {
    return data.type === 'part';
}

export function isContainerModel(data: DomainData): data is ContainerModel {
    return data.type === 'container';
}
