/**
 * Wiring hydratorów domainData: ASSEMBLY → ContainerModel, PART → PanelModel.
 *
 * Warstwa aplikacyjna — składa A1 + A4 + S4. A1_core sam A4 nie importuje.
 * Import tej jednostki rejestruje domyślne fabryki (testy + bootstrap).
 */

import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { PanelModel, bumpPanelIdSeqFromId } from '../../A4_smartpanel/panel-model.js';
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

import { HardwareModel, hydrateHardware } from '../../A1_core/hardware-model.js';

export function hydrateContainer(raw: any, nodeJson: any): ContainerModel {
    if (raw?.type === LEGACY_WALL_SOLID || raw?.generatorParams?.type === LEGACY_WALL_SOLID) {
        return migrateLegacyWallSolid(raw, nodeJson);
    }
    const container = ContainerModel.fromJSON(raw);
    container.id = nodeJson.id;
    if (!container.name) container.name = nodeJson.name;
    if (nodeJson?.frozen || raw?.frozen) {
        container.frozen = true;
        container.visible = false;
    }
    return container;
}

export function hydratePanel(raw: any, nodeJson: any): PanelModel {
    if (raw) {
        if (typeof raw.width === 'number' && (raw.width <= 0 || !Number.isFinite(raw.width))) {
            const repaired = Math.max(mmToNm(10), Math.abs(raw.width) || mmToNm(600));
            console.warn(`[hydratePanel] Naprawiono nieprawidłowy wymiar width formatki "${nodeJson?.id || raw?.id}": ${raw.width} nm -> ${repaired} nm.`);
            raw.width = repaired;
        }
        if (typeof raw.height === 'number' && (raw.height <= 0 || !Number.isFinite(raw.height))) {
            const repaired = Math.max(mmToNm(10), Math.abs(raw.height) || mmToNm(720));
            console.warn(`[hydratePanel] Naprawiono nieprawidłowy wymiar height formatki "${nodeJson?.id || raw?.id}": ${raw.height} nm -> ${repaired} nm.`);
            raw.height = repaired;
        }
        if (typeof raw.thickness === 'number' && (raw.thickness <= 0 || !Number.isFinite(raw.thickness))) {
            const repaired = Math.max(mmToNm(1), Math.abs(raw.thickness) || mmToNm(18));
            console.warn(`[hydratePanel] Naprawiono nieprawidłowy wymiar thickness formatki "${nodeJson?.id || raw?.id}": ${raw.thickness} nm -> ${repaired} nm.`);
            raw.thickness = repaired;
        }
    }
    const resolvedId = nodeJson?.id || raw?.id;
    if (resolvedId) {
        bumpPanelIdSeqFromId(resolvedId);
    }
    const panel = PanelModel.fromJSON(resolvedId ? { ...raw, id: resolvedId } : raw);
    if (resolvedId) {
        panel.id = resolvedId;
    }
    if (!panel.name) panel.name = nodeJson.name;
    if (nodeJson?.frozen || raw?.frozen) {
        panel.frozen = true;
        panel.visible = false;
    }
    return panel;
}

registerDefaultHydrator(NodeType.ASSEMBLY, hydrateContainer);
registerDefaultHydrator(NodeType.PART, hydratePanel);
registerDefaultHydrator(NodeType.HARDWARE, hydrateHardware);
registerDefaultFactory(NodeType.ASSEMBLY, (options) => new ContainerModel(options));
registerDefaultFactory(NodeType.PART, (options) => new PanelModel(options));
registerDefaultFactory(NodeType.HARDWARE, (options) => new HardwareModel(options));

export function registerProjectDomain(document: ProjectDocument): void {
    document.registerHydrator(NodeType.ASSEMBLY, hydrateContainer);
    document.registerHydrator(NodeType.PART, hydratePanel);
    document.registerHydrator(NodeType.HARDWARE, hydrateHardware);
    document.registerFactory(NodeType.ASSEMBLY, (options) => new ContainerModel(options));
    document.registerFactory(NodeType.PART, (options) => new PanelModel(options));
    document.registerFactory(NodeType.HARDWARE, (options) => new HardwareModel(options));
}
