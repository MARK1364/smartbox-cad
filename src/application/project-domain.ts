/**
 * Wiring hydratorów domainData: ASSEMBLY → ContainerModel, PART → PanelModel.
 *
 * Warstwa aplikacyjna — składa A1 + A4 + S4. A1_core sam A4 nie importuje.
 * Import tej jednostki rejestruje domyślne fabryki (testy + bootstrap).
 */

import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { SMARTWALL_TYPE } from '../../S4_sciany/smartwall-types.js';
import {
    registerDefaultFactory,
    registerDefaultHydrator,
} from '../../A1_core/domain-registry.js';
import type { ProjectDocument } from '../../A1_core/project-document.js';

const LEGACY_WALL_SOLID = 'wall_solid';

/**
 * Stary prototyp wall_solid → pusty ContainerModel smartwall (log + migracja).
 */
function migrateLegacyWallSolid(raw: any, nodeJson: any): ContainerModel {
    console.warn(
        `[S4] Migracja legacy wall_solid → smartwall (${nodeJson?.id || raw?.id}). Przbuduj ściany z UI SmartWall.`,
    );
    const container = ContainerModel.fromJSON({
        ...raw,
        type: 'container',
        name: raw?.name || nodeJson?.name || 'SmartWall (migracja)',
        generatorParams: {
            type: SMARTWALL_TYPE,
            preset: 'empty',
            fills: [],
            roomWidth: raw?.length ?? raw?.width,
            roomDepth: raw?.thickness ?? raw?.depth,
            wallHeight: raw?.height,
            wallThickness: raw?.thickness ?? raw?.depth,
        },
    });
    container.id = nodeJson.id;
    if (!container.name) container.name = nodeJson.name;
    return container;
}

export function hydrateContainer(raw: any, nodeJson: any): ContainerModel {
    if (raw?.type === LEGACY_WALL_SOLID || raw?.generatorParams?.type === LEGACY_WALL_SOLID) {
        return migrateLegacyWallSolid(raw, nodeJson);
    }
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
