/**
 * B1_biblioteka/korpusy/cabinet-instantiator.ts
 *
 * Odtwarza gotowy mebel (SmartFrame + SmartBox submodules) ze wzorca CabinetTemplate
 * na scenie CAD na wskazanej pozycji.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { update_smartbox_core } from '../../A2_smartbox/smartbox-core.js';
import type { CabinetTemplate, CabinetSubmoduleRecipe } from './types.js';

export interface InstantiateCabinetOptions {
    template: CabinetTemplate;
    position?: { x: number; y: number; z?: number };
    overrideDims?: { width?: number; height?: number; depth?: number };
}

/**
 * Główna funkcja tworząca korpus mebla wraz z jego wyposażeniem w scenie.
 */
export function instantiateCabinetTemplate(
    options: InstantiateCabinetOptions,
    docTarget?: ProjectDocument
): CADNode | null {
    const doc: ProjectDocument = docTarget || ContextManager.instance.document;
    if (!doc) return null;

    const { template, position, overrideDims } = options;
    const w = overrideDims?.width ?? template.dimensions.width;
    const h = overrideDims?.height ?? template.dimensions.height;
    const d = overrideDims?.depth ?? template.dimensions.depth;

    const fp = template.frameParams;
    const zoneCount = fp.zoneCount || 1;
    const bottomHeight = fp.bottomHeight !== undefined ? fp.bottomHeight : (zoneCount === 1 ? h : 500);
    const middleHeight = fp.middleHeight !== undefined ? fp.middleHeight : (zoneCount === 3 ? 1200 : 0);
    const backOffset = fp.backOffset ?? 3;

    // 1. Tworzenie korpusu bazowego przez CreateKorpusCommand (wsparcie dla Undo)
    const cmd = new CreateKorpusCommand({
        width: w,
        height: h,
        depth: d,
        zoneCount,
        bottomHeight,
        middleHeight,
        backOffset,
        offsets: fp.offsets || {},
        position: position || { x: 0, y: 0, z: 0 }
    });

    const history = ContextManager.instance.commandHistory;
    if (history && typeof history.execute === 'function') {
        history.execute(cmd);
    } else {
        cmd.execute(doc);
    }

    // Pobranie nowo utworzonego kontenera korpusu
    const korpusContainer = doc.activeEntity as ContainerModel;
    if (!korpusContainer) return null;

    const korpusNode = doc.findNode(korpusContainer.id);
    if (!korpusNode) return null;

    // 2. Jeśli szablon posiada podmoduły SmartBox, odtwarzamy je
    if (Array.isArray(template.submodules) && template.submodules.length > 0) {
        // Znajdź ściany korpusu do dynamicznych referencji
        const allChildren = korpusNode.children || [];
        const bokL = allChildren.find((c) => c.name?.includes('BOK_L') || c.name?.includes('Bok Lewy'));
        const bokR = allChildren.find((c) => c.name?.includes('BOK_R') || c.name?.includes('Bok Prawy'));
        const wieniecD = allChildren.find((c) => c.name?.includes('WIENIEC_D') || c.name?.includes('Dół'));
        const wieniecG = allChildren.find((c) => c.name?.includes('WIENIEC_G') || c.name?.includes('Góra'));
        const plecy = allChildren.find((c) => c.name?.includes('PLECY') || c.name?.includes('Tył'));

        const leftId = bokL?.id || korpusNode.id;
        const rightId = bokR?.id || korpusNode.id;
        const bottomId = wieniecD?.id || korpusNode.id;
        const topId = wieniecG?.id || korpusNode.id;
        const backId = plecy?.id || korpusNode.id;

        for (const sub of template.submodules) {
            instantiateSubmodule(sub, korpusNode, {
                leftId,
                rightId,
                bottomId,
                topId,
                backId,
                korpusW: w,
                korpusH: h,
                korpusD: d,
                zoneCount,
                bottomHeight,
                middleHeight
            }, doc);
        }
    }

    // Ustawienie aktywnej encji na stworzony mebel
    doc.setActiveEntity(korpusContainer);

    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
        (window as any).__rebuildGeometry?.(`Wstawiono z biblioteki: ${template.name}`);
    }

    return korpusNode;
}

function instantiateSubmodule(
    sub: CabinetSubmoduleRecipe,
    korpusNode: CADNode,
    ctx: {
        leftId: string;
        rightId: string;
        bottomId: string;
        topId: string;
        backId: string;
        korpusW: number;
        korpusH: number;
        korpusD: number;
        zoneCount: 1 | 2 | 3;
        bottomHeight: number;
        middleHeight: number;
    },
    doc: ProjectDocument
) {
    const isExternal = sub.boxType === 'PANELS';
    const subName = sub.label || `smartbox_${sub.boxType.toLowerCase()}`;

    // Wymiary wewnętrzne wnęki
    const innerW = Math.max(100, ctx.korpusW - 36);
    const innerD = Math.max(100, ctx.korpusD - 20);
    let zoneH = Math.max(100, ctx.korpusH - 36);
    let zoneZOffsetMm = 18; // nad wieńcem dolnym

    if (ctx.zoneCount === 2) {
        if (sub.zoneIndex === 0) {
            zoneH = ctx.bottomHeight - 18;
        } else {
            zoneH = ctx.korpusH - ctx.bottomHeight - 18;
            zoneZOffsetMm = ctx.bottomHeight + 18;
        }
    } else if (ctx.zoneCount === 3) {
        if (sub.zoneIndex === 0) {
            zoneH = ctx.bottomHeight - 18;
        } else if (sub.zoneIndex === 1) {
            zoneH = ctx.middleHeight - 18;
            zoneZOffsetMm = ctx.bottomHeight + 18;
        } else {
            zoneH = ctx.korpusH - ctx.bottomHeight - ctx.middleHeight - 18;
            zoneZOffsetMm = ctx.bottomHeight + ctx.middleHeight + 18;
        }
    }

    const sbContainer = new ContainerModel({
        name: subName,
        width: mmToNm(innerW),
        height: mmToNm(zoneH),
        depth: mmToNm(innerD)
    });

    sbContainer.generatorParams = {
        type: sub.type || `smartbox_${sub.boxType.toLowerCase()}`,
        boxType: sub.boxType,
        parentContainerId: korpusNode.id,
        targetZone: isExternal ? 'FULL' : undefined,
        side_references_smartbox: isExternal ? 'OUTER' : 'INNER',
        customReferences: {
            xMin: { partKey: 'Bok Lewy', face: isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS', panelId: ctx.leftId },
            xMax: { partKey: 'Bok Prawy', face: isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS', panelId: ctx.rightId },
            zMin: { partKey: 'Dół', face: isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS', panelId: ctx.bottomId },
            zMax: { partKey: 'Góra', face: isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_MINUS', panelId: ctx.topId },
            yMin: { partKey: 'Przód', face: 'FACE_X_PLUS', panelId: ctx.leftId },
            yMax: { partKey: 'Tył', face: isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS', panelId: ctx.backId }
        },
        offsets: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 },
        ...(sub.params || {})
    };

    const sbNode = CADNode.create(NodeType.ASSEMBLY, subName, sbContainer.id);
    sbNode.domainData = sbContainer;

    // Ustawienie lokalnej pozycji Z
    sbNode.setLocalTransform(
        new Vec3(0, 0, mmToNm(zoneZOffsetMm)),
        Quat.IDENTITY
    );

    // Dodanie do drzewa pod korpusem
    doc.addNode(korpusNode.id, sbNode);

    // Wywołanie aktualizacji SmartBoxa
    try {
        update_smartbox_core(sbContainer, doc);
    } catch (e) {
        console.warn(`[CabinetInstantiator] Ostrzeżenie przy aktualizacji podmodułu ${subName}:`, e);
    }
}
