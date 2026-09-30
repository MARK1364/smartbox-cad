/**
 * flaps-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu KLAPY — prowadniki zawiasów na wieniec górny/dolny lub półkę konstrukcyjną.
 * Pełne wsparcie customReferences i geometrii — zero sztywnych ról.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { FlapsDrillingIntent, FlapsDrillingFeature } from './flaps-drilling-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import type { FaceName } from '../A4_smartpanel/panel-model.js';
import { computeFaceData, PANEL_FACE_NAMES, point3DToFaceUV } from '../A4_smartpanel/native_core/face-lcs.js';
import { DEFAULT_HINGE_ID, hingeCorpusHolesMm, hingeTemplateId } from '../B1_biblioteka/index.js';

type HingeSide = 'left' | 'right' | 'center';

function hingeLocalX(side: HingeSide, sbWidth: number, hingeLeft: number, hingeRight: number): number {
    if (side === 'left') return -sbWidth / 2 + hingeLeft;
    if (side === 'right') return sbWidth / 2 - hingeRight;
    return 0;
}

function pushPlateHoles(
    intents: FlapsDrillingIntent[],
    panelNode: any,
    face: FlapsDrillingFeature['face'],
    sbNodeId: string,
    hingeKey: string,
    hingeWorldX: number,
    frontEdgeWorldY: number,
    contactWorldZ: number,
    hingeId: string,
    faceWidth?: number,
    faceHeight?: number
): void {
    const corpusHoles = hingeCorpusHolesMm(hingeId);
    const templateId = hingeTemplateId(hingeId);

    corpusHoles.forEach((hole, idx) => {
        const suffix = hole.name || String(idx);
        const holeWorldX = hingeWorldX + hole.zOffset;
        const holeWorldY = frontEdgeWorldY + hole.frontDist;

        const uv = point3DToFaceUV(panelNode, face, [holeWorldX, holeWorldY, contactWorldZ]);
        if (!uv) return;

        // Twarde zabezpieczenie: otwór musi mieścić się w fizycznym obrysie formatki
        if (faceWidth !== undefined && faceHeight !== undefined) {
            if (uv.u <= 0 || uv.u >= faceWidth || uv.v <= 0 || uv.v >= faceHeight) {
                return;
            }
        }

        intents.push({
            targetNodeId: panelNode.id,
            feature: {
                id: `flap_plate_${hingeKey}_${suffix}`,
                type: 'hole',
                face,
                side: face,
                params: {
                    template_id: templateId,
                    u: uv.u,
                    v: uv.v,
                    u_mm: uv.u,
                    v_mm: uv.v,
                    diameter: hole.dia,
                    diameter_mm: hole.dia,
                    depth: hole.depth,
                    depth_mm: hole.depth,
                    isFlapDrilling: true,
                    sourceContainerId: sbNodeId,
                    sourcePartId: hingeKey
                }
            }
        });
    });
}


export function buildFlapsDrillings(document: ProjectDocument, cabinetContainerId?: string): FlapsDrillingIntent[] {
    const intents: FlapsDrillingIntent[] = [];
    if (!document) return intents;

    const containers = typeof document.getContainers === 'function' ? document.getContainers() : [];

    let cabinetNode = cabinetContainerId ? document.findNode(cabinetContainerId) : null;
    if (!cabinetNode) {
        cabinetNode = containers.find((c: any) => {
            const type = c.domainData?.generatorParams?.type;
            return type === 'korpus3_2' || type === 'korpus3_1' || type === 'KORPUS3' || type === 'korpus_rogowy1' || type === 'korpus_rogowy90' ||
                (c.domainData?.type === 'container' && !c.domainData?.generatorParams?.type?.startsWith('bloki'));
        }) || null;
    }
    if (!cabinetNode) return intents;

    const sbContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        return p && (p.type === 'blok_flaps' || p.boxType === 'FLAPS') && c.domainData?.visible !== false;
    });

    if (sbContainers.length === 0) return intents;

    const resolveWieniecPanel = (
        sbNode: any,
        isTopFlap: boolean
    ): { node: any; suggestedFace?: string | null } | null => {
        const p = sbNode.domainData?.generatorParams || {};
        const ref = isTopFlap ? p.customReferences?.zMax : p.customReferences?.zMin;

        if (ref?.panelId) {
            const node = document.findNode(ref.panelId);
            if (node) {
                return { node, suggestedFace: ref.face };
            }
        }

        const boundaryRef = isTopFlap ? p.boundary?.top : p.boundary?.bottom;
        if (boundaryRef?.nodeId) {
            const node = document.findNode(boundaryRef.nodeId);
            if (node) {
                return { node, suggestedFace: boundaryRef.face };
            }
        }

        return null;
    };

    /**
     * Dobiera płaszczyznę montażową prowadników klapy ze ściany styku formatki ze Blokiem.
     */
    const findTargetWieniecFace = (
        node: any,
        isTopFlap: boolean,
        suggestedFace?: string | null
    ): { face: FlapsDrillingFeature['face']; width: number; height: number } | null => {
        if (!node?.domainData) return null;
        const pw = nmToMm(node.domainData.width || node.domainData.length || 0);
        const ph = nmToMm(node.domainData.height || node.domainData.depth || 0);
        const pt = nmToMm(node.domainData.thickness || 0);

        const targetFace = (suggestedFace && PANEL_FACE_NAMES.includes(suggestedFace as FaceName))
            ? suggestedFace
            : (isTopFlap ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS');

        const fd = computeFaceData(targetFace, pw, ph, pt);
        if (fd.width >= 50 && fd.height >= 50) {
            return { face: targetFace as FlapsDrillingFeature['face'], width: fd.width, height: fd.height };
        }
        return null;
    };

    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};

        const flapType = (p.kierunek_klapy || 'TOP').toUpperCase();
        const isTopFlap = flapType !== 'BOTTOM';

        const sbWidth = nmToMm(sbData.width);
        const sbDepth = nmToMm(sbData.depth);

        const hingeLeft = p.odsuniecie_zawiasu_lewe_mm !== undefined ? Number(p.odsuniecie_zawiasu_lewe_mm) : 80;
        const hingeRight = p.odsuniecie_zawiasu_prawe_mm !== undefined ? Number(p.odsuniecie_zawiasu_prawe_mm) : 80;
        const baseHingeId = p.szablon_zawiasu_domyslny || DEFAULT_HINGE_ID;
        const resolveHingeId = (side: HingeSide): string => {
            if (side === 'left' && p.szablon_zawiasu_lewy) return p.szablon_zawiasu_lewy;
            if (side === 'right' && p.szablon_zawiasu_prawy) return p.szablon_zawiasu_prawy;
            if (side === 'center' && p.szablon_zawiasu_srodkowy) return p.szablon_zawiasu_srodkowy;

            if (baseHingeId === 'BLUM_71B3550' || baseHingeId === 'BLUM_71T3550') {
                if (side === 'right') return 'BLUM_71T3550';
                return 'BLUM_71B3550';
            }
            return baseHingeId;
        };

        const sbPos = sbNode.getWorldMatrix().decompose().translation;
        const sbPosX = nmToMm(sbPos.x);
        const sbPosY = nmToMm(sbPos.y);
        const sbPosZ = nmToMm(sbPos.z);
        const sbHeight = nmToMm(sbData.height);

        const frontEdgeY = sbPosY - sbDepth / 2;
        const contactWorldZ = isTopFlap ? (sbPosZ + sbHeight / 2) : (sbPosZ - sbHeight / 2);

        const target = resolveWieniecPanel(sbNode, isTopFlap);
        if (!target?.node) continue;

        const faceInfo = findTargetWieniecFace(target.node, isTopFlap, target.suggestedFace);
        if (!faceInfo) continue;

        const wieniecNode = target.node;
        const face = faceInfo.face;

        const activeHinges: { key: string; side: HingeSide }[] = [];
        if (isTopFlap) {
            activeHinges.push({ key: 'HINGE_TL', side: 'left' });
            activeHinges.push({ key: 'HINGE_TR', side: 'right' });
            if (p.zawias_srodkowy) activeHinges.push({ key: 'HINGE_TC', side: 'center' });
        } else {
            activeHinges.push({ key: 'HINGE_BL', side: 'left' });
            activeHinges.push({ key: 'HINGE_BR', side: 'right' });
            if (p.zawias_srodkowy) activeHinges.push({ key: 'HINGE_BC', side: 'center' });
        }

        for (const hinge of activeHinges) {
            const localX = hingeLocalX(hinge.side, sbWidth, hingeLeft, hingeRight);
            const hingeWorldX = sbPosX + localX;
            const hingeId = resolveHingeId(hinge.side);

            pushPlateHoles(
                intents,
                wieniecNode,
                face,
                sbNode.id,
                hinge.key,
                hingeWorldX,
                frontEdgeY,
                contactWorldZ,
                hingeId,
                faceInfo.width,
                faceInfo.height
            );
        }

    }

    return intents;
}
