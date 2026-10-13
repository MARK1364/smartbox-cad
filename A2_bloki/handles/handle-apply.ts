/**
 * A2_bloki / handles — handle-apply.ts
 * Aplikacja uchwytu (SmartPart Handle) do modelu panelu w strukturze CADNode / ProjectDocument.
 *
 * Tworzy węzeł kontenera ASSEMBLY oraz węzeł okucia HARDWARE,
 * pozycjonuje w układzie lokalnym formatki i synchronizuje nawierty.
 */

import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import {
    type HandleParamsMm,
    DEFAULT_HANDLE_PARAMS,
    SMARTPART_HANDLE_TYPE,
} from './handle-types.js';
import {
    ensureHandleUvMm,
    computeHandleLayout,
} from './handle-layout.js';
import {
    resolvePanelThicknessMm,
    syncHandleDrillings,
} from './handle-drilling.js';
import { buildHandleParametricMesh } from './handle-mesh.js';
import { AddSmartPartHandleCommand } from './handle-commands.js';

/**
 * Tworzy domenowy węzeł kontenera uchwytu SmartPart i przypina go do formatki w dokumencie CAD.
 */
export function createSmartPartHandle(
    document: any,
    targetPanelNode: CADNode,
    params: Partial<HandleParamsMm> = {},
    surface?: { faceZ?: number; normalZ?: number }
): CADNode | null {
    if (!document || !targetPanelNode) return null;

    const panelModel = targetPanelNode.domainData;
    if (!panelModel) return null;

    const panelWMm = nmToMm(panelModel.width);
    const panelHMm = nmToMm(panelModel.height);
    const panelTMm = resolvePanelThicknessMm(panelModel);

    const mergedParams: HandleParamsMm = {
        ...DEFAULT_HANDLE_PARAMS,
        ...params,
    };

    const faceZ = surface?.faceZ ?? -panelTMm / 2;
    const normalZ = surface?.normalZ ?? -1;
    const faceName = normalZ > 0 ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS';

    // Jawnie podany params.face wygrywa; w przeciwnym razie używamy faceName z surface
    mergedParams.face = (params.face) ? params.face : faceName;

    // Jedyna pozycja = UV; preset służy tylko do bootstrapu gdy UV jeszcze nie ma
    Object.assign(mergedParams, ensureHandleUvMm(mergedParams, panelWMm, panelHMm));

    const layout = computeHandleLayout(mergedParams, panelWMm, panelHMm);

    const isHoriz = mergedParams.orientation === 'HORIZONTAL';
    const contW = isHoriz ? mergedParams.totalLengthMm : mergedParams.thicknessMm;
    const contH = isHoriz ? mergedParams.thicknessMm : mergedParams.totalLengthMm;
    const contD = mergedParams.depthMm;

    // Kontener SmartPart
    const container = new ContainerModel({
        name: 'Uchwyty',
        width: mmToNm(contW),
        height: mmToNm(contH),
        depth: mmToNm(contD),
    });

    (container as any).role = 'SMARTPART_HANDLE';
    (container as any).source = 'smartpart';

    container.generatorParams = {
        type: SMARTPART_HANDLE_TYPE,
        partType: 'HANDLE',
        targetPanelId: targetPanelNode.id,
        panelWidthMm: panelWMm,
        panelHeightMm: panelHMm,
        panelThicknessMm: panelTMm,
        faceZ,
        normalZ,
        overhangMm: layout.overhangMm,
        ...mergedParams,
    };

    const cntNode = CADNode.create(NodeType.ASSEMBLY, container.name, container.id);
    cntNode.domainData = container;

    // Lokalne położenie kontenera na powierzchni formatki w układzie CAD:
    // CAD (Z-up): X = szerokość, Y = głębokość (grubość), Z = wysokość formatki.
    const localPosNm = new Vec3(
        mmToNm(layout.center.x),
        mmToNm(faceZ),
        mmToNm(layout.center.y)
    );

    cntNode.setLocalTransform(localPosNm, Quat.IDENTITY);

    // Dodajemy węzeł okucia HARDWARE dla wyceny, BOM i postprocesora CNC
    const hwNode = CADNode.create(NodeType.HARDWARE, 'Okucie_Uchwyty', `hw_${container.id}`);
    hwNode.domainData = {
        id: `hw_${container.id}`,
        name: container.name,
        role: 'HANDLE',
        nodeType: 'HARDWARE',
        hardwareType: 'HANDLE',
        hardwareId: mergedParams.glbModelPath?.replace(/\.glb$/i, '')
            || (mergedParams.seriesId
                ? `REJS_${String(mergedParams.seriesId).toUpperCase()}_${mergedParams.holeDistanceMm}`
                : `HANDLE_${mergedParams.holeDistanceMm}`),
        c_c: mergedParams.holeDistanceMm,
        length: mergedParams.totalLengthMm,
        units: 'mm',
        custom_properties: {
            overhangMm: layout.overhangMm,
            holeDistanceMm: mergedParams.holeDistanceMm,
            totalLengthMm: mergedParams.totalLengthMm,
            orientation: mergedParams.orientation,
            drillingEnabled: mergedParams.drillingEnabled,
            drillDiameterMm: mergedParams.drillDiameterMm,
            holes: layout.holes,
        }
    } as any;

    const cmd = new AddSmartPartHandleCommand(
        targetPanelNode.id,
        cntNode,
        hwNode,
        layout,
        mergedParams,
        normalZ,
        faceZ
    );

    if (document.history && typeof document.history.executeCommand === 'function') {
        document.history.executeCommand(cmd, document);
    } else if (typeof document.executeCommand === 'function') {
        document.executeCommand(cmd);
    } else {
        cmd.execute(document);
    }

    document.setActiveEntity?.(container);

    return cntNode;
}
