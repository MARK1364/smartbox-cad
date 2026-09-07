/**
 * flaps-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu KLAPY — prowadniki zawiasów na wieniec górny/dolny lub półkę konstrukcyjną.
 * Pełne wsparcie customReferences i geometrii — zero sztywnych ról.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { FlapsDrillingIntent, FlapsDrillingFeature } from './flaps-drilling-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { DEFAULT_HINGE_ID, hingeCorpusHolesMm, hingeTemplateId } from '../Biblioteki/okucia/index.js';

type HingeSide = 'left' | 'right' | 'center';

function hingeLocalX(side: HingeSide, sbWidth: number, hingeLeft: number, hingeRight: number): number {
    if (side === 'left') return -sbWidth / 2 + hingeLeft;
    if (side === 'right') return sbWidth / 2 - hingeRight;
    return 0;
}

function hingeToWieniecUV(
    panelNode: any,
    hingeX: number,
    hingeY: number
): { u: number; v: number } | null {
    const data = panelNode.domainData;
    if (!data) return null;

    const pos = panelNode.getWorldMatrix().decompose().translation;
    const cx = nmToMm(pos.x);
    const cy = nmToMm(pos.y);

    const panelW = nmToMm(data.width || data.length);
    const panelD = nmToMm(data.height || data.depth);
    if (panelW <= 0 || panelD <= 0) return null;

    const leftEdgeX = cx - panelW / 2;
    const frontEdgeY = cy - panelD / 2;

    const u = hingeX - leftEdgeX;
    const v = hingeY - frontEdgeY;

    if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
    return { u, v };
}

function pushPlateHoles(
    intents: FlapsDrillingIntent[],
    panelNode: any,
    face: FlapsDrillingFeature['face'],
    sbNodeId: string,
    hingeKey: string,
    uCenter: number,
    hingeId: string
): void {
    const corpusHoles = hingeCorpusHolesMm(hingeId);
    const templateId = hingeTemplateId(hingeId);

    corpusHoles.forEach((hole, idx) => {
        const suffix = hole.name || String(idx);
        intents.push({
            targetNodeId: panelNode.id,
            feature: {
                id: `flap_plate_${hingeKey}_${suffix}`,
                type: 'hole',
                face,
                side: face,
                params: {
                    template_id: templateId,
                    u: uCenter + hole.zOffset,
                    v: hole.frontDist,
                    diameter: hole.dia,
                    depth: hole.depth,
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
            return type === 'korpus3_2' || type === 'korpus3_1' || type === 'KORPUS3' ||
                (c.domainData?.type === 'container' && !c.domainData?.generatorParams?.type?.startsWith('smartbox'));
        }) || null;
    }
    if (!cabinetNode) return intents;

    const sbContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        return p && (p.type === 'smartbox_flaps' || p.boxType === 'FLAPS') && c.domainData?.visible !== false;
    });

    if (sbContainers.length === 0) return intents;

    const allCabinetPanels: any[] = [];
    const collectCabinetPanels = (node: any) => {
        if (!node) return;
        const data = node.domainData;
        const gp = data?.generatorParams;
        if (gp && (String(gp.type || '').startsWith('smartbox') || gp.boxType)) return;

        if (data && (data.type === 'panel' || data.type === 'part')) {
            allCabinetPanels.push(node);
        }
        if (node.children) {
            for (const child of node.children) {
                collectCabinetPanels(child);
            }
        }
    };
    collectCabinetPanels(cabinetNode);

    const resolveWieniecPanel = (
        sbNode: any,
        isTopFlap: boolean
    ): { node: any; face: FlapsDrillingFeature['face'] } | null => {
        const p = sbNode.domainData?.generatorParams || {};
        const ref = isTopFlap ? p.customReferences?.zMax : p.customReferences?.zMin;

        if (ref?.panelId) {
            const node = document.findNode(ref.panelId);
            if (node) {
                return { node, face: (ref.face || (isTopFlap ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS')) as FlapsDrillingFeature['face'] };
            }
        }

        const boundaryRef = isTopFlap ? p.boundary?.top : p.boundary?.bottom;
        if (boundaryRef?.nodeId) {
            const node = document.findNode(boundaryRef.nodeId);
            if (node) {
                return { node, face: (boundaryRef.face || (isTopFlap ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS')) as FlapsDrillingFeature['face'] };
            }
        }

        // Fallback geometryczny
        const sbPos = sbNode.getWorldMatrix().decompose().translation;
        const sbCenterZ = nmToMm(sbPos.z);
        const sbHeight = nmToMm(sbNode.domainData?.height || 0);
        const targetZ = isTopFlap ? (sbCenterZ + sbHeight) : sbCenterZ;

        const candidates = allCabinetPanels.filter((pNode) => {
            const posZ = nmToMm(pNode.getWorldMatrix().decompose().translation.z);
            return Math.abs(posZ - targetZ) < 50;
        });

        if (candidates.length === 0) return null;

        return { node: candidates[0], face: (isTopFlap ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS') as FlapsDrillingFeature['face'] };
    };

    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};

        const flapType = (p.flap_type || 'TOP').toUpperCase();
        const isTopFlap = flapType !== 'BOTTOM';

        const sbWidth = nmToMm(sbData.width);
        const sbDepth = nmToMm(sbData.depth);

        const hingeLeft = p.hinge_left_offset !== undefined ? Number(p.hinge_left_offset) : 80;
        const hingeRight = p.hinge_right_offset !== undefined ? Number(p.hinge_right_offset) : 80;
        const resolveHingeId = (side: HingeSide): string => {
            if (side === 'left') return p.hinge_left_template || p.hinge_template || p.library_id || DEFAULT_HINGE_ID;
            if (side === 'right') return p.hinge_right_template || p.hinge_template || p.library_id || DEFAULT_HINGE_ID;
            return p.hinge_center_template || p.hinge_template || p.library_id || DEFAULT_HINGE_ID;
        };

        const sbPos = sbNode.getWorldMatrix().decompose().translation;
        const sbPosX = nmToMm(sbPos.x);
        const sbPosY = nmToMm(sbPos.y);

        const hingeLineY = sbPosY - sbDepth / 2;

        const target = resolveWieniecPanel(sbNode, isTopFlap);
        if (!target?.node) continue;

        const wieniecNode = target.node;
        const face = target.face || 'FACE_Z_PLUS';

        const activeHinges: { key: string; side: HingeSide }[] = [];
        if (isTopFlap) {
            activeHinges.push({ key: 'HINGE_TL', side: 'left' });
            activeHinges.push({ key: 'HINGE_TR', side: 'right' });
            if (p.use_center_hinge) activeHinges.push({ key: 'HINGE_TC', side: 'center' });
        } else {
            activeHinges.push({ key: 'HINGE_BL', side: 'left' });
            activeHinges.push({ key: 'HINGE_BR', side: 'right' });
            if (p.use_center_hinge) activeHinges.push({ key: 'HINGE_BC', side: 'center' });
        }

        for (const hinge of activeHinges) {
            const localX = hingeLocalX(hinge.side, sbWidth, hingeLeft, hingeRight);
            const hingeX = sbPosX + localX;
            const uv = hingeToWieniecUV(wieniecNode, hingeX, hingeLineY);
            if (!uv) continue;

            const hingeId = resolveHingeId(hinge.side);
            pushPlateHoles(intents, wieniecNode, face, sbNode.id, hinge.key, uv.u, hingeId);
        }
    }

    return intents;
}
