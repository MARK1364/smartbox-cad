/**
 * skosne-doors-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu DRZWI SKOŚNE.
 * Rzutuje otwory prowadników zawiasu ze skrzydła na formatkę graniczną (bok / przegroda).
 *
 * Różnica wobec DRZWI: skrzydło jest trapezem z jedną krawędzią pionową,
 * więc zawias istnieje TYLKO po jednej stronie. Nie ma tu dwustronności
 * ani skrzydła wspólnego — brak zawiasu po stronie pochylonej jest wynikiem
 * geometrii, nie brakiem danych.
 *
 * Bez sztywnego szukania po rolach — pełne wsparcie customReferences i geometrii.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { SkosneDoorsDrillingFeature, SkosneDoorsDrillingIntent } from './skosne-doors-drilling-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import {
    hingeCorpusHolesMm,
    hingeTemplateId,
    isParallelHinge
} from '../B1_biblioteka/index.js';
import { normalizeSkosneDoorsParams } from './skosne-doors-engine.js';
import { computeFaceData, calcFaceUFromFront, PANEL_FACE_NAMES } from '../A4_smartpanel/native_core/face-lcs.js';
import type { FaceName } from '../A4_smartpanel/panel-model.js';

export function buildSkosneDoorsDrillings(
    document: ProjectDocument,
    cabinetContainerId?: string
): SkosneDoorsDrillingIntent[] {
    const intents: SkosneDoorsDrillingIntent[] = [];
    if (!document) return intents;

    const containers = typeof document.getContainers === 'function' ? document.getContainers() : [];

    let cabinetNode = cabinetContainerId ? document.findNode(cabinetContainerId) : null;
    if (!cabinetNode) {
        cabinetNode = containers.find((c: any) => {
            const type = c.domainData?.generatorParams?.type;
            return type === 'korpus3_2' || type === 'korpus3_1' || type === 'KORPUS3'
                || (c.domainData?.type === 'container' && !c.domainData?.generatorParams?.type?.startsWith('bloki'));
        }) || null;
    }
    if (!cabinetNode) return intents;

    const sbContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        return p && (p.type === 'blok_skosne_drzwi' || p.boxType === 'SKOSNE_DOORS')
            && c.domainData?.visible !== false;
    });
    if (sbContainers.length === 0) return intents;

    const getPanelWorldZ = (node: any): number => {
        const worldPos = node.getWorldMatrix().decompose().translation;
        return nmToMm(worldPos.z);
    };

    const getVForPanel = (targetNode: any, worldZ: number): number => {
        if (!targetNode) return worldZ;
        const rawH = targetNode.domainData?.length ?? targetNode.domainData?.height ?? targetNode.domainData?.width ?? 0;
        const targetHeight = nmToMm(rawH);
        const targetCenterZ = getPanelWorldZ(targetNode);
        const targetBottomZ = targetCenterZ - targetHeight / 2;
        return worldZ - targetBottomZ;
    };

    /** Ściana styku Bloku: customReferences → boundary wnęki. Brak roli i nazw. */
    const resolveSidePanel = (
        sbNode: any,
        side: 'left' | 'right'
    ): { node: any; suggestedFace?: string | null } | null => {
        const p = sbNode.domainData?.generatorParams || {};
        const ref = side === 'left' ? p.customReferences?.xMin : p.customReferences?.xMax;
        if (ref?.panelId) {
            const node = document.findNode(ref.panelId);
            if (node) return { node, suggestedFace: ref.face };
        }
        const boundaryRef = side === 'left' ? p.boundary?.left : p.boundary?.right;
        if (boundaryRef?.nodeId) {
            const node = document.findNode(boundaryRef.nodeId);
            if (node) return { node, suggestedFace: boundaryRef.face };
        }
        return null;
    };

    /** Zawias równoległy → lico czołowe (FACE_Z_PLUS); standardowy → ściana styku. */
    const findTargetHingeFace = (
        node: any,
        isParallel: boolean,
        suggestedFace?: string | null
    ): { face: SkosneDoorsDrillingFeature['face']; width: number; height: number } | null => {
        if (!node?.domainData) return null;
        const pw = nmToMm(node.domainData.width || 0);
        const ph = nmToMm(node.domainData.height || 0);
        const pt = nmToMm(node.domainData.thickness || 0);

        if (isParallel) {
            const targetFace = 'FACE_Z_PLUS';
            const fd = computeFaceData(targetFace, pw, ph, pt);
            if (fd.width >= 50 && fd.height >= 50) {
                return { face: targetFace, width: fd.width, height: fd.height };
            }
            return null;
        }

        const targetFace = (suggestedFace && PANEL_FACE_NAMES.includes(suggestedFace as FaceName))
            ? suggestedFace
            : 'FACE_Z_PLUS';
        const fd = computeFaceData(targetFace, pw, ph, pt);
        if (fd.width >= 50 && fd.height >= 50) {
            return { face: targetFace as SkosneDoorsDrillingFeature['face'], width: fd.width, height: fd.height };
        }
        return null;
    };

    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};

        const sbWidth = nmToMm(sbData.width);
        const sbHeight = nmToMm(sbData.height);
        const sbDepth = nmToMm(sbData.depth);
        const sbPosZ = nmToMm(sbNode.getWorldMatrix().decompose().translation.z);

        const normalized = normalizeSkosneDoorsParams(sbData.generatorParams || {}, {
            width_mm: sbWidth,
            height_mm: sbHeight,
            depth_mm: sbDepth
        });
        if (!normalized) continue;

        const hingeSide: 'left' | 'right' = normalized.rodzaj_drzwi === 'LEFT' ? 'left' : 'right';
        const target = resolveSidePanel(sbNode, hingeSide);
        if (!target?.node) continue;

        const targetNode = target.node;
        for (const hinge of normalized.aktywne_zawiasy) {
            const hingeId = normalized.szablony_zawiasow[hinge.index]
                ?? normalized.domyslny_zawias_id;
            const corpusHoles = hingeCorpusHolesMm(hingeId);
            const templateId = hingeTemplateId(hingeId);
            const isParallel = isParallelHinge(hingeId);
            const targetFace = findTargetHingeFace(targetNode, isParallel, target.suggestedFace);
            if (!targetFace) continue;

            for (const hole of corpusHoles) {
                const uPos = isParallel
                    ? (hingeSide === 'left' ? targetFace.width - hole.frontDist : hole.frontDist)
                    : calcFaceUFromFront(targetNode, targetFace.face, targetFace.width, hole.frontDist, hingeSide);
                const vPos = getVForPanel(targetNode, sbPosZ + hinge.pozycja_lokalna_z_mm + hole.zOffset);

                // Otwór musi fizycznie mieścić się na płaszczyźnie płyty.
                if (uPos <= 0 || uPos >= targetFace.width || vPos <= 0 || vPos >= targetFace.height) {
                    continue;
                }

                intents.push({
                    targetNodeId: targetNode.id,
                    feature: {
                        id: `hinge_plate_skosne_${hingeSide[0]}_${hinge.index}_${hole.name || 'h'}`,
                        type: 'hole',
                        face: targetFace.face,
                        side: targetFace.face,
                        params: {
                            template_id: templateId,
                            u: uPos,
                            v: vPos,
                            u_mm: uPos,
                            v_mm: vPos,
                            diameter: hole.dia,
                            diameter_mm: hole.dia,
                            depth: hole.depth,
                            depth_mm: hole.depth,
                            isDoorDrilling: true,
                            sourceContainerId: sbNode.id,
                            sourcePartId: `Hinge_${hingeSide === 'left' ? 'L' : 'R'}${hinge.index}`
                        }
                    }
                });
            }
        }
    }

    return intents;
}