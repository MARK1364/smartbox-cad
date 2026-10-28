/**
 * A2_bloki / sinks — sink-apply.ts
 * Aplikacja zlewu (SmartPart Sink) do modelu formatki (np. blatu) w strukturze CADNode / ProjectDocument.
 *
 * Tworzy węzeł kontenera ASSEMBLY oraz węzeł okucia HARDWARE,
 * pozycjonuje w układzie lokalnym formatki docelowej i synchronizuje wycięcie przelotowe (type: 'cutout').
 */

import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { HardwareModel } from '../../A1_core/hardware-model.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import {
    type SinkParamsMm,
    normalizeSinkParams,
    computeSinkLayout,
    SMARTPART_SINK_TYPE,
    computeSinkLocalCoords,
    computeSinkUvFromLocalCoords,
} from './sink-types.js';
import { resolvePanelThicknessMm } from '../handles/handle-drilling.js';
import { AddSmartPartSinkCommand } from './sink-commands.js';

/**
 * Tworzy domenowy węzeł kontenera zlewu SmartPart i przypina go do formatki w dokumencie CAD.
 */
export function createSmartPartSink(
    document: any,
    targetPanelNode: CADNode,
    params: Partial<SinkParamsMm> = {},
    surface?: { faceZ?: number; normalZ?: number; localCoordMm?: { x: number; y: number } }
): CADNode | null {
    if (!document || !targetPanelNode) return null;

    const panelModel = targetPanelNode.domainData;
    if (!panelModel) return null;

    const panelWMm = nmToMm(panelModel.width);
    const panelHMm = nmToMm(panelModel.height);
    const panelTMm = resolvePanelThicknessMm(panelModel);

    const faceZ = surface?.faceZ ?? panelTMm / 2;
    const normalZ = surface?.normalZ ?? 1;
    const faceName = normalZ > 0 ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS';

    let initialUMm = params.u_mm;
    let initialVMm = params.v_mm;

    if (initialUMm === undefined || initialVMm === undefined) {
        if (surface?.localCoordMm) {
            const uv = computeSinkUvFromLocalCoords(
                surface.localCoordMm.x,
                surface.localCoordMm.y,
                panelWMm,
                panelHMm,
                faceName
            );
            initialUMm = initialUMm ?? uv.u_mm;
            initialVMm = initialVMm ?? uv.v_mm;
        }
    }

    const mergedParams: SinkParamsMm = {
        ...normalizeSinkParams({
            face: faceName,
            ...params,
            ...(initialUMm !== undefined ? { u_mm: initialUMm } : {}),
            ...(initialVMm !== undefined ? { v_mm: initialVMm } : {}),
        }, panelWMm, panelHMm),
    };

    const layout = computeSinkLayout(mergedParams);
    const { localX, localY } = computeSinkLocalCoords(
        mergedParams.u_mm,
        mergedParams.v_mm,
        panelWMm,
        panelHMm,
        faceName
    );

    // Całkowity gabaryt kontenera zlewu (kołnierz + głębokość komory)
    const contW = layout.kolnierzWidthMm;
    const contH = layout.kolnierzDepthMm;
    const contD = layout.kolnierzHeightMm + layout.komoraHeightMm;

    // Kontener SmartPart zlewu
    const container = new ContainerModel({
        name: 'Zlew',
        width: mmToNm(contW),
        height: mmToNm(contH),
        depth: mmToNm(contD),
    });

    (container as any).role = 'SMARTPART_SINK';
    (container as any).source = 'smartpart';
    (container as any).is_blok = true;

    container.generatorParams = {
        type: SMARTPART_SINK_TYPE,
        partType: 'SINK',
        targetPanelId: targetPanelNode.id,
        panelWidthMm: panelWMm,
        panelHeightMm: panelHMm,
        panelThicknessMm: panelTMm,
        faceZ,
        normalZ,
        localX,
        localY,
        ...mergedParams,
        ...layout,
    };

    const cntNode = CADNode.create(NodeType.ASSEMBLY, container.name, container.id);
    cntNode.domainData = container;

    // Lokalne położenie kontenera na powierzchni formatki w układzie CAD:
    // W układzie CAD (Z-up): X = szerokość formatki, Y = grubość formatki (faceZ), Z = wysokość formatki.
    // Po konwersji do Babylona (Y-up, zamiana Y<->Z) daje (localX, localY, faceZ).
    const localPosNm = new Vec3(
        mmToNm(localX),
        mmToNm(faceZ),
        mmToNm(localY)
    );

    cntNode.setLocalTransform(localPosNm, Quat.IDENTITY);

    // Węzeł okucia HARDWARE dla BOM, wyceny i postprocesora CNC
    const hwNode = CADNode.create(NodeType.HARDWARE, 'Okucie_Zlew', `hw_${container.id}`);
    hwNode.domainData = HardwareModel.fromJSON({
        id: `hw_${container.id}`,
        name: container.name,
        role: 'SINK',
        nodeType: 'HARDWARE',
        hardwareType: 'SINK',
        hardwareId: mergedParams.hardwareId,
        length: layout.kolnierzWidthMm,
        units: 'mm',
        custom_properties: {
            kolnierzWidthMm: layout.kolnierzWidthMm,
            kolnierzDepthMm: layout.kolnierzDepthMm,
            kolnierzHeightMm: layout.kolnierzHeightMm,
            komoraWidthMm: layout.komoraWidthMm,
            komoraDepthMm: layout.komoraDepthMm,
            komoraHeightMm: layout.komoraHeightMm,
            cutoutUMm: layout.cutoutUMm,
            cutoutVMm: layout.cutoutVMm,
            cutoutWidthMm: layout.cutoutWidthMm,
            cutoutLengthMm: layout.cutoutLengthMm,
        },
    });

    const cmd = new AddSmartPartSinkCommand(
        targetPanelNode.id,
        cntNode,
        hwNode,
        layout,
        mergedParams,
        normalZ,
        faceZ
    );

    if (document.history && typeof document.history.execute === 'function') {
        document.history.execute(cmd);
    } else if (document.history && typeof document.history.executeCommand === 'function') {
        document.history.executeCommand(cmd, document);
    } else if (typeof document.executeCommand === 'function') {
        document.executeCommand(cmd);
    } else {
        cmd.execute(document);
    }

    document.setActiveEntity?.(container);

    return cntNode;
}
