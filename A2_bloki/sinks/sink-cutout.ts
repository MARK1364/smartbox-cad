/**
 * A2_bloki / sinks — sink-cutout.ts
 * Generowanie i synchronizacja cechy obróbczej wycięcia przelotowego (type: 'cutout')
 * w formatce docelowej (np. blacie meblowym) pod montaż komory zlewu.
 *
 * Zgodne ze standardem Taksonomii Cech Płytowych (project-schema.ts):
 * Wycięcie bez dna na wylot = type: 'cutout', through: true.
 */

import type { ProjectDocument } from '../../A1_core/project-document.js';
import type { CADNode } from '../../A1_core/cad-node/cad-node.js';
import type { ContainerModel } from '../../A1_core/container-model.js';
import type { SinkParamsMm, SinkComputedLayoutMm } from './sink-types.js';
import { resolvePanelThicknessMm } from '../handles/handle-drilling.js';

export interface SinkCutoutFeatureDto {
    id: string;
    type: 'cutout';
    face: string;
    side: 'front' | 'back';
    name: string;
    params: {
        u: number;
        v: number;
        width: number;
        length: number;
        depth: number;
        through: boolean;
        isSinkCutout: boolean;
        sinkContainerId: string;
        sourceContainerId: string;
    };
}

/**
 * Czysta funkcja tworząca DTO cechy wycięcia przelotowego (Functional Core).
 */
export function generateSinkCutoutFeature(
    containerId: string,
    params: SinkParamsMm,
    layout: SinkComputedLayoutMm,
    panelTMm: number
): SinkCutoutFeatureDto {
    const isFront = !params.face.includes('MINUS');

    return {
        id: `cutout_${containerId}`,
        type: 'cutout',
        face: params.face,
        side: isFront ? 'front' : 'back',
        name: 'Wycięcie pod komorę zlewu',
        params: {
            u: layout.cutoutUMm,
            v: layout.cutoutVMm,
            width: layout.cutoutWidthMm,
            length: layout.cutoutLengthMm,
            depth: panelTMm,
            through: true,
            isSinkCutout: true,
            sinkContainerId: containerId,
            sourceContainerId: containerId,
        },
    };
}

/**
 * Synchronizuje wycięcie zlewu na formatce docelowej (np. blacie).
 */
export function syncSinkCutout(
    document: ProjectDocument,
    targetPanelNode: CADNode,
    containerModel: ContainerModel,
    params: SinkParamsMm,
    layout: SinkComputedLayoutMm
): void {
    if (!targetPanelNode || !containerModel) return;

    const panelModel = targetPanelNode.domainData as any;
    if (!panelModel) return;

    if (!Array.isArray(panelModel.features)) {
        panelModel.features = [];
    }

    // Usuń dotychczasowe wycięcie powiązane z tym zlewem
    panelModel.features = panelModel.features.filter(
        (f: any) => !(f.params?.isSinkCutout && f.params?.sourceContainerId === containerModel.id)
    );

    if (params.cutoutEnabled) {
        const panelTMm = resolvePanelThicknessMm(panelModel);
        const cutoutFeat = generateSinkCutoutFeature(containerModel.id, params, layout, panelTMm);
        panelModel.features.push(cutoutFeat);
    }

    if (typeof panelModel.markDirty === 'function') {
        panelModel.markDirty();
    }
}

/**
 * Usuwa wycięcie powiązane ze zlewem z formatki docelowej.
 */
export function removeSinkCutout(
    targetPanelNode: CADNode,
    containerId: string
): void {
    if (!targetPanelNode) return;
    const panelModel = targetPanelNode.domainData as any;
    if (!panelModel || !Array.isArray(panelModel.features)) return;

    panelModel.features = panelModel.features.filter(
        (f: any) => !(f.params?.isSinkCutout && f.params?.sourceContainerId === containerId)
    );

    if (typeof panelModel.markDirty === 'function') {
        panelModel.markDirty();
    }
}
