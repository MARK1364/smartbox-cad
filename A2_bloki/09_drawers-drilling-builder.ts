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
        if (!p || (p.type !== 'blok_drawers' && p.boxType !== 'DRAWERS') || c.frozen || c.domainData?.frozen === true) return false;
        if (cabinetContainerId) {
            return p.parentContainerId === cabinetNode.id || c.parent?.id === cabinetNode.id || isChildOfCabinet(c);
        }
        return true;
    });
    if (sbContainers.length === 0) return intents;

    // Zbierz wszystkie formatki korpusu (wykluczając sam kontener korpusu)
    const allCabinetPanels: any[] = [];
    const collectCabinetPanels = (node: any) => {
        if (!node) return;
        const data = node.domainData;
        const gp = data?.generatorParams;
        if (gp && (String(gp.type || '').startsWith('bloki') || gp.boxType)) return;

        if (data && (data.type === 'panel' || data.type === 'part' || data.role)) {
            allCabinetPanels.push(node);
        }
        if (node.children) {
            for (const child of node.children) {
                collectCabinetPanels(child);
            }
        }
    };
    collectCabinetPanels(cabinetNode);

    const getNodeCabinetPosMm = (node: any): { x: number; y: number; z: number } => {
        if (cabinetNode && typeof cabinetNode.getWorldMatrix === 'function' && typeof node?.getWorldMatrix === 'function') {
            const relPos = cabinetNode.getWorldMatrix().invert().multiply(node.getWorldMatrix()).decompose().translation;
            return { x: nmToMm(relPos.x), y: nmToMm(relPos.y), z: nmToMm(relPos.z) };
        }
        const worldPos = node.getWorldMatrix().decompose().translation;
        return { x: nmToMm(worldPos.x), y: nmToMm(worldPos.y), z: nmToMm(worldPos.z) };
    };

    const getPanelWorldZ = (node: any): number => getNodeCabinetPosMm(node).z;
    const getPanelCabinetX = (node: any): number => getNodeCabinetPosMm(node).x;

    const getVForPanel = (targetNode: any, worldZ: number): number => {
        if (!targetNode) return worldZ;
        const rawH = targetNode.domainData?.height ?? targetNode.domainData?.length ?? targetNode.domainData?.width ?? 0;
        const targetHeight = nmToMm(rawH);
        const targetBottomZ = getPanelWorldZ(targetNode) - targetHeight / 2;
        return worldZ - targetBottomZ;
    };

    const isVerticalSidePanel = (pNode: any) => {
        const role = (pNode.domainData?.role || '').toUpperCase();
        if (role.includes('SIDE') || role.includes('PARTITION') || role.includes('BOK') || role.includes('PRZEGRODA')) return true;
        if (pNode.localMatrix) {
            const dirY = Math.abs(pNode.localMatrix.transformDirection(new Vec3(1, 0, 0)).y);
            return dirY > 0.5;
        }
        return true;
    };

    const resolveSidePanel = (
        sbNode: any,
        side: 'left' | 'right',
        worldZ?: number
    ): { node: any; suggestedFace?: string | null } | null => {
        const p = sbNode.domainData?.generatorParams || {};
        const ref = side === 'left' ? p.customReferences?.xMin : p.customReferences?.xMax;

        if (ref?.panelId) {
            const node = document.findNode(ref.panelId);
            if (node && node.domainData && node.domainData.type !== 'container') {
                return { node, suggestedFace: ref.face };
            }
        }

        const boundaryRef = side === 'left' ? p.boundary?.left : p.boundary?.right;
        if (boundaryRef?.nodeId) {
            const node = document.findNode(boundaryRef.nodeId);
            if (node && node.domainData && node.domainData.type !== 'container') {
                return { node, suggestedFace: boundaryRef.face };
            }
        }

        // Priorytet 3: Fallback geometryczny po panelach korpusu
        if (allCabinetPanels.length > 0) {
            const sbWidth = nmToMm(sbNode.domainData?.width || 0);
            const sbCenterX = getPanelCabinetX(sbNode);
            const sbLeftX = sbCenterX - sbWidth / 2;
            const sbRightX = sbCenterX + sbWidth / 2;

            const candidates = allCabinetPanels.filter((pNode) => {
                if (!isVerticalSidePanel(pNode)) return false;
                const rawH = pNode.domainData?.height ?? pNode.domainData?.length ?? pNode.domainData?.width ?? 0;
                const h = nmToMm(rawH);
                const centerZ = getPanelWorldZ(pNode);
                const pZMin = centerZ - h / 2;
                const pZMax = centerZ + h / 2;
                if (h > 0 && (worldZ !== undefined && (worldZ < pZMin - 10 || worldZ > pZMax + 10))) return false;

                const panelX = getPanelCabinetX(pNode);
                return side === 'left' ? (panelX <= sbCenterX + 5) : (panelX >= sbCenterX - 5);
            });

            if (candidates.length > 0) {
                const targetRefX = side === 'left' ? sbLeftX : sbRightX;
                candidates.sort((a, b) => {
                    const distA = Math.abs(getPanelCabinetX(a) - targetRefX);
                    const distB = Math.abs(getPanelCabinetX(b) - targetRefX);
                    return distA - distB;
                });
                return { node: candidates[0], suggestedFace: 'FACE_Z_PLUS' };
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

        const sbNodeResolved = typeof document.findNode === 'function' ? document.findNode(sbNode.id) : sbNode;
        let sbBottomZ = getPanelWorldZ(sbNodeResolved || sbNode) - sbHeight / 2;
        const zMinRef = p.customReferences?.zMin || p.boundary?.bottom;
        if (zMinRef?.planeCoordMm !== undefined) {
            sbBottomZ = zMinRef.planeCoordMm;
        } else if (zMinRef?.panelId || zMinRef?.nodeId) {
            const bottomPanel = document.findNode(zMinRef.panelId || zMinRef.nodeId);
            if (bottomPanel) {
                const bpCenterZ = getPanelWorldZ(bottomPanel);
                const bpData = (bottomPanel.domainData as any) || {};
                const bpRawTh = bpData.custom_properties?.thickness_mm !== undefined
                    ? Number(bpData.custom_properties.thickness_mm)
                    : (bpData.thickness !== undefined ? nmToMm(bpData.thickness) : (bpData.dim?.z ? nmToMm(bpData.dim.z) : undefined));
                const bpThickness = (bpRawTh !== undefined && !isNaN(bpRawTh)) ? bpRawTh : 18;
                sbBottomZ = bpCenterZ + bpThickness / 2;
            }
        }

        const layout = resolveDrawerLayout(p, { width_mm: sbWidth, height_mm: sbHeight, depth_mm: sbDepth });

        for (const slot of layout.slots) {
            const lengthKey = String(Math.round(slot.lengthMm));
            const holeData = slot.rail.lengths[lengthKey] || slot.rail.lengths[String(slot.lengthMm)] || {};
            const xPositions: number[] = (holeData.x_positions && holeData.x_positions.length)
                ? holeData.x_positions
                : ((slot.rail as any).machining?.corpus_holes?.map((h: any) => h.front_dist) || []);
            if (!xPositions.length) continue;

            const holeDiameter = Number(slot.rail.drill?.dia ?? 3);
            const holeDepth = Number(slot.rail.drill?.depth ?? 12);

            const zOff = Number(holeData.z_offset ?? 33);
            const worldZ = sbBottomZ + slot.zInternalBottom + zOff;
            const holesEnabled: boolean[] = Array.isArray(holeData.holes_enabled) ? holeData.holes_enabled : [];

            const leftTarget = resolveSidePanel(sbNode, 'left', worldZ);
            const rightTarget = resolveSidePanel(sbNode, 'right', worldZ);

            const leftFaceInfo = leftTarget?.node ? findTargetSideFace(leftTarget.node, leftTarget.suggestedFace) : null;
            const rightFaceInfo = rightTarget?.node ? findTargetSideFace(rightTarget.node, rightTarget.suggestedFace) : null;

            xPositions.forEach((xRaw, idx) => {
                if (holesEnabled[idx] === false) return;
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
                            drivenBy: {
                                nodeId: `${sbNode.id}_drawer_${slot.index}_rail_L`,
                                role: 'HARDWARE',
                                hardwareType: 'DRAWER_SLIDE',
                                partKey: `drawer_${slot.index}_rail_L`,
                                containerId: sbNode.id,
                            },
                            rule: 'drawer_runner',
                            generatedBy: 'blok_drawers',
                            u,
                            v,
                            diameter: holeDiameter,
                            depth: holeDepth,
                            ownerTag: 'isDrawerDrilling',
                            sourceContainerId: sbNode.id,
                            sourcePartId: `drawer_${slot.index}_rail_L`,
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
                            drivenBy: {
                                nodeId: `${sbNode.id}_drawer_${slot.index}_rail_R`,
                                role: 'HARDWARE',
                                hardwareType: 'DRAWER_SLIDE',
                                partKey: `drawer_${slot.index}_rail_R`,
                                containerId: sbNode.id,
                            },
                            rule: 'drawer_runner',
                            generatedBy: 'blok_drawers',
                            u,
                            v,
                            diameter: holeDiameter,
                            depth: holeDepth,
                            ownerTag: 'isDrawerDrilling',
                            sourceContainerId: sbNode.id,
                            sourcePartId: `drawer_${slot.index}_rail_R`,
                        }));
                    }
                }
            });
        }
    }

    return intents;
}
