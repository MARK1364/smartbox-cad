/**
 * B1_biblioteka/korpusy/cabinet-instantiator.ts
 *
 * Odtwarza gotowy mebel (SmartFrame + Bloki submodules) ze wzorca CabinetTemplate
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
import { update_bloki_core } from '../../A2_bloki/bloki-core.js';
import type { CabinetTemplate, CabinetSubmoduleRecipe } from './types.js';

export interface InstantiateCabinetOptions {
    template: CabinetTemplate;
    position?: { x: number; y: number; z?: number };
    overrideDims?: { szerokosc_mm?: number; wysokosc_mm?: number; glebokosc_mm?: number };
}

/**
 * GĹ‚Ăłwna funkcja tworzÄ…ca korpus mebla wraz z jego wyposaĹĽeniem w scenie.
 */
export function instantiateCabinetTemplate(
    options: InstantiateCabinetOptions,
    docTarget?: ProjectDocument
): CADNode | null {
    const doc: ProjectDocument = docTarget || ContextManager.instance.document;
    if (!doc) return null;

    const { template, position, overrideDims } = options;
    const w = overrideDims?.szerokosc_mm ?? template.dimensions.szerokosc_mm;
    const h = overrideDims?.wysokosc_mm ?? template.dimensions.wysokosc_mm;
    const d = overrideDims?.glebokosc_mm ?? template.dimensions.glebokosc_mm;

    const fp = template.frameParams;
    const liczba_stref = fp.liczba_stref || 1;
    const wysokosc_strefy_dolnej_mm = fp.wysokosc_strefy_dolnej_mm !== undefined
        ? fp.wysokosc_strefy_dolnej_mm
        : (liczba_stref === 1 ? h : 500);
    const wysokosc_strefy_srodkowej_mm = fp.wysokosc_strefy_srodkowej_mm !== undefined
        ? fp.wysokosc_strefy_srodkowej_mm
        : (liczba_stref === 3 ? 1200 : 0);
    const cofniecie_plecow_mm = fp.cofniecie_plecow_mm ?? 3;

    // 1. Tworzenie korpusu bazowego przez CreateKorpusCommand (wsparcie dla Undo)
    const cmd = new CreateKorpusCommand({
        szerokosc_mm: w,
        wysokosc_mm: h,
        glebokosc_mm: d,
        liczba_stref,
        wysokosc_strefy_dolnej_mm,
        wysokosc_strefy_srodkowej_mm,
        cofniecie_plecow_mm,
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

    // 2. JeĹ›li szablon posiada podmoduĹ‚y Bloki, odtwarzamy je
    if (Array.isArray(template.submodules) && template.submodules.length > 0) {
        // ZnajdĹş Ĺ›ciany korpusu do dynamicznych referencji
        const allChildren = korpusNode.children || [];
        const bokL = allChildren.find((c) => c.name?.includes('BOK_L') || c.name?.includes('Bok Lewy'));
        const bokR = allChildren.find((c) => c.name?.includes('BOK_R') || c.name?.includes('Bok Prawy'));
        const wieniecD = allChildren.find((c) => c.name?.includes('WIENIEC_D') || c.name?.includes('DĂłĹ‚'));
        const wieniecG = allChildren.find((c) => c.name?.includes('WIENIEC_G') || c.name?.includes('GĂłra'));
        const plecy = allChildren.find((c) => c.name?.includes('PLECY') || c.name?.includes('TyĹ‚'));

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
                liczba_stref,
                wysokosc_strefy_dolnej_mm,
                wysokosc_strefy_srodkowej_mm
            }, doc);
        }
    }

    // Ustawienie aktywnej encji na stworzony mebel
    doc.setActiveEntity(korpusContainer);

    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
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
        liczba_stref: 1 | 2 | 3;
        wysokosc_strefy_dolnej_mm: number;
        wysokosc_strefy_srodkowej_mm: number;
    },
    doc: ProjectDocument
) {
    const isExternal = sub.boxType === 'PANELS';
    const subName = sub.label || `blok_${sub.boxType.toLowerCase()}`;

    // Wymiary wewnÄ™trzne wnÄ™ki
    const innerW = Math.max(100, ctx.korpusW - 36);
    const innerD = Math.max(100, ctx.korpusD - 20);
    let zoneH = Math.max(100, ctx.korpusH - 36);
    let zoneZOffsetMm = 18; // nad wieĹ„cem dolnym

    if ((sub as any).customHeightMm) {
        zoneH = (sub as any).customHeightMm;
    } else if (ctx.liczba_stref === 2) {
        if (sub.zoneIndex === 0) {
            zoneH = ctx.wysokosc_strefy_dolnej_mm - 18;
        } else {
            zoneH = ctx.korpusH - ctx.wysokosc_strefy_dolnej_mm - 18;
            zoneZOffsetMm = ctx.wysokosc_strefy_dolnej_mm + 18;
        }
    } else if (ctx.liczba_stref === 3) {
        if (sub.zoneIndex === 0) {
            zoneH = ctx.wysokosc_strefy_dolnej_mm - 18;
        } else if (sub.zoneIndex === 1) {
            if ((sub as any).zoneSpan === 2 || (sub.params as any)?.zoneSpan === 2 || (sub.params as any)?.refTop === 'WIENIEC_G') {
                // Front obejmujÄ…cy Ĺšrodek + GĂłrÄ™ jednoczeĹ›nie (np. szafa wysoka z szufladami na dole)
                zoneH = ctx.korpusH - ctx.wysokosc_strefy_dolnej_mm - 18;
                zoneZOffsetMm = ctx.wysokosc_strefy_dolnej_mm + 18;
            } else {
                zoneH = ctx.wysokosc_strefy_srodkowej_mm - 18;
                zoneZOffsetMm = ctx.wysokosc_strefy_dolnej_mm + 18;
            }
        } else {
            zoneH = ctx.korpusH - ctx.wysokosc_strefy_dolnej_mm - ctx.wysokosc_strefy_srodkowej_mm - 18;
            zoneZOffsetMm = ctx.wysokosc_strefy_dolnej_mm + ctx.wysokosc_strefy_srodkowej_mm + 18;
        }
    }

    const sbContainer = new ContainerModel({
        name: subName,
        width: mmToNm(innerW),
        height: mmToNm(zoneH),
        depth: mmToNm(innerD)
    });

    sbContainer.generatorParams = {
        type: sub.type || `blok_${sub.boxType.toLowerCase()}`,
        boxType: sub.boxType,
        parentContainerId: korpusNode.id,
        targetZone: isExternal ? 'FULL' : undefined,
        side_references_bloki: isExternal ? 'OUTER' : 'INNER',
        customReferences: {
            xMin: { partKey: 'Bok Lewy', face: isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS', panelId: ctx.leftId },
            xMax: { partKey: 'Bok Prawy', face: isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS', panelId: ctx.rightId },
            zMin: { partKey: 'DĂłĹ‚', face: isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS', panelId: ctx.bottomId },
            zMax: { partKey: 'GĂłra', face: isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_MINUS', panelId: ctx.topId },
            yMin: { partKey: 'PrzĂłd', face: 'FACE_X_PLUS', panelId: ctx.leftId },
            yMax: { partKey: 'TyĹ‚', face: isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS', panelId: ctx.backId }
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

    // WywoĹ‚anie aktualizacji Bloku
    try {
        update_bloki_core(sbContainer, doc);
    } catch (e) {
        console.warn(`[CabinetInstantiator] OstrzeĹĽenie przy aktualizacji podmoduĹ‚u ${subName}:`, e);
    }
}
