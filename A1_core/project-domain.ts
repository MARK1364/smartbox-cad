/**
 * Wiring hydratorów domainData: ASSEMBLY → ContainerModel, PART → PanelModel.
 *
 * Import tej jednostki rejestruje domyślne fabryki (testy + bootstrap).
 * ProjectDocument sam A4 nie importuje.
 */

import { NodeType } from './cad-node/node-type.js';
import { ContainerModel } from './container-model.js';
import { PanelModel } from '../A4_smartpanel/panel-model.js';
import {
    registerDefaultFactory,
    registerDefaultHydrator,
} from './domain-registry.js';
import type { ProjectDocument } from './project-document.js';

export function hydrateContainer(raw: any, nodeJson: any): ContainerModel {
    const container = ContainerModel.fromJSON(raw);
    container.id = nodeJson.id;
    if (!container.name) container.name = nodeJson.name;
    return container;
}

export function hydratePanel(raw: any, nodeJson: any): PanelModel {
    const panel = PanelModel.fromJSON(raw);
    panel.id = nodeJson.id;
    if (!panel.name) panel.name = nodeJson.name;
    return panel;
}

registerDefaultHydrator(NodeType.ASSEMBLY, hydrateContainer);
registerDefaultHydrator(NodeType.PART, hydratePanel);
registerDefaultFactory(NodeType.ASSEMBLY, (options) => new ContainerModel(options));
registerDefaultFactory(NodeType.PART, (options) => new PanelModel(options));

export function registerProjectDomain(document: ProjectDocument): void {
    document.registerHydrator(NodeType.ASSEMBLY, hydrateContainer);
    document.registerHydrator(NodeType.PART, hydratePanel);
    document.registerFactory(NodeType.ASSEMBLY, (options) => new ContainerModel(options));
    document.registerFactory(NodeType.PART, (options) => new PanelModel(options));
}
