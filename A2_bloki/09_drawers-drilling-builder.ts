/**
 * drawers-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu SZUFLADY.
 * Rzutuje corpus_holes prowadnicy na formatki graniczne (bok / przegroda).
 * Pełne wsparcie customReferences i geometrii — zero sztywnych ról.
 */
import { ProjectDocument } from '../A1_core/project-document.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { DrawersDrillingIntent, DrawersDrillingFeature } from './09_drawers-drilling-intent.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { resolveDrawerLayout } from './09_drawers-engine.js';
import { getDrawerDrill } from '../B1_biblioteka/index.js';
import { computeFaceData, calcFaceUFromFront, PANEL_FACE_NAMES } from '../A4_smartpanel/native_core/face-lcs.js';
import type { FaceName } from '../A4_smartpanel/panel-model.js';

function dimToMm(raw: number | undefined, fallback = 0): number {
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return fallback;
    return nmToMm(Number(raw));
}

export function buildDrawersDrillings(document: ProjectDocument, cabinetContainerId?: string): DrawersDrillingIntent[] {
    const intents: DrawersDrillingIntent[] = [];
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

    const isChildOfCabinet = (node: any): boolean => {
        let curr = node.parent;
        while (curr) {
            if (curr.id === cabinetNode.id) return true;
            curr = curr.parent;
        }
        return false;
    };

    const sbContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        if (!p || (p.type !== 'blok_drawers' && p.boxType !== 'DRAWERS') || c.domainData?.visible === false) return false;
        if (cabinetContainerId) {
            return p.parentContainerId === cabinetNode.id || c.parent?.id === cabinetNode.id || isChildOfCabinet(c);
        }
        return true;
    });
    if (sbContainers.length === 0) return intents;

    const getPanelWorldZ = (node: any): number => {
        const pos = node.getWorldMatrix().decompose().translation;
        return nmToMm(pos.z);
    };

    const getVForPanel = (targetNode: any, worldZ: number): number => {
        if (!targetNode) return worldZ;
        const rawH = targetNode.domainData?.length ?? targetNode.domainData?.height ?? targetNode.domainData?.width ?? 0;
        const targetHeight = nmToMm(rawH);
        const targetBottomZ = getPanelWorldZ(targetNode) - targetHeight / 2;
        return worldZ - targetBottomZ;
    };

    const resolveSidePanel = (
        sbNode: any,
        side: 'left' | 'right'
    ): { node: any; suggestedFace?: string | null } | null => {
        const p = sbNode.domainData?.generatorParams || {};
        const ref = side === 'left' ? p.customReferences?.xMin : p.customReferences?.xMax;

        if (ref?.panelId) {
            const node = document.findNode(ref.panelId);
            if (node) {
                return { node, suggestedFace: ref.face };
            }
        }

        const boundaryRef = side === 'left' ? p.boundary?.left : p.boundary?.right;
        if (boundaryRef?.nodeId) {
            const node = document.findNode(boundaryRef.nodeId);
            if (node) {
                return { node, suggestedFace: boundaryRef.face };
            }
        }

        return null;
    };

    /**
     * Dobiera płaszczyznę montażową prowadnicy szuflady ze ściany styku formatki ze Blokiem.
     * Wymaga minimalnego wymiaru 50mm, zabezpieczając przed wierceniem w powietrzu na wąskich krawędziach.
     */
    const findTargetSideFace = (
        node: any,
        suggestedFace?: string | null
    ): { face: DrawersDrillingFeature['face']; width: number; height: number } | null => {
        if (!node?.domainData) return null;
        const pw = nmToMm(node.domainData.width || 0);
        const ph = nmToMm(node.domainData.height || 0);
        const pt = nmToMm(node.domainData.thickness || 0);

        const targetFace = (suggestedFace && PANEL_FACE_NAMES.includes(suggestedFace as FaceName))
            ? suggestedFace
            : 'FACE_Z_PLUS';

        const fd = computeFaceData(targetFace, pw, ph, pt);
        if (fd.width >= 50 && fd.height >= 50) {
            return { face: targetFace as DrawersDrillingFeature['face'], width: fd.width, height: fd.height };
        }
        return null;
    };

    const drillTemplate = getDrawerDrill();

    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};

        const sbWidth = dimToMm(sbData.width, 600);
        const sbHeight = dimToMm(sbData.height, 720);
        const sbDepth = dimToMm(sbData.depth, 500);
        const sbPosZ = getPanelWorldZ(sbNode);

        const layout = resolveDrawerLayout(p, { width_mm: sbWidth, height_mm: sbHeight, depth_mm: sbDepth });

        for (const slot of layout.slots) {
            const lengthKey = String(Math.round(slot.lengthMm));
            const holeData = slot.rail.lengths[lengthKey] || slot.rail.lengths[String(slot.lengthMm)] || {};
            const xPositions: number[] = holeData.x_positions || [];
            if (!xPositions.length) continue;

            const holeDiameter = Number(slot.rail.drill?.dia ?? 3);
            const holeDepth = Number(slot.rail.drill?.depth ?? 12);

            const zOff = Number(holeData.z_offset ?? 33);
            const worldZ = sbPosZ + slot.zInternalBottom + zOff;

            const leftTarget = resolveSidePanel(sbNode, 'left');
            const rightTarget = resolveSidePanel(sbNode, 'right');

            const leftFaceInfo = leftTarget?.node ? findTargetSideFace(leftTarget.node, leftTarget.suggestedFace) : null;
            const rightFaceInfo = rightTarget?.node ? findTargetSideFace(rightTarget.node, rightTarget.suggestedFace) : null;

            xPositions.forEach((xRaw, idx) => {
                const fromFront = Number(xRaw ?? 37);

                if (leftTarget?.node && leftFaceInfo) {
                    const leftNode = leftTarget.node;
                    const u = calcFaceUFromFront(leftNode, leftFaceInfo.face, leftFaceInfo.width, fromFront, 'left');
                    const v = getVForPanel(leftNode, worldZ);

                    // Twarde zabezpieczenie: otwór musi mieścić się w obrysie płyty
                    if (u > 0 && u < leftFaceInfo.width && v > 0 && v < leftFaceInfo.height) {
                        intents.push(buildHoleMachiningIntent({
                            targetNodeId: leftNode.id,
                            id: `drawer_${slot.index}_corp_l_${idx}`,
                            face: leftFaceInfo.face,
                            side: leftFaceInfo.face,
                            template_id: drillTemplate.id || 'STANDARD_DRAWER_DRILL',
                            u,
                            v,
                            diameter: holeDiameter,
                            depth: holeDepth,
                            ownerTag: 'isDrawerDrilling',
                            sourceContainerId: sbNode.id,
                            sourcePartId: `Prowadnica_${slot.index}L`,
                        }));
                    }
                }

                if (rightTarget?.node && rightFaceInfo) {
                    const rightNode = rightTarget.node;
                    const u = calcFaceUFromFront(rightNode, rightFaceInfo.face, rightFaceInfo.width, fromFront, 'right');
                    const v = getVForPanel(rightNode, worldZ);

                    // Twarde zabezpieczenie: otwór musi mieścić się w obrysie płyty
                    if (u > 0 && u < rightFaceInfo.width && v > 0 && v < rightFaceInfo.height) {
                        intents.push(buildHoleMachiningIntent({
                            targetNodeId: rightNode.id,
                            id: `drawer_${slot.index}_corp_r_${idx}`,
                            face: rightFaceInfo.face,
                            side: rightFaceInfo.face,
                            template_id: drillTemplate.id || 'STANDARD_DRAWER_DRILL',
                            u,
                            v,
                            diameter: holeDiameter,
                            depth: holeDepth,
                            ownerTag: 'isDrawerDrilling',
                            sourceContainerId: sbNode.id,
                            sourcePartId: `Prowadnica_${slot.index}P`,
                        }));
                    }
                }
            });
        }
    }

    return intents;
}
