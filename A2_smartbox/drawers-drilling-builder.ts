/**
 * drawers-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu SZUFLADY.
 * Rzutuje corpus_holes prowadnicy na formatki graniczne (bok / przegroda).
 * Pełne wsparcie customReferences i geometrii — zero sztywnych ról.
 */
import { ProjectDocument } from '../A1_core/project-document.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { DrawersDrillingIntent, DrawersDrillingFeature } from './drawers-drilling-intent.js';
import { nmToMm, rulesMToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { resolveDrawerLayout } from './drawers-engine.js';
import { getDrawerDrill } from '../B1_biblioteka/index.js';

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
            return type === 'korpus3_2' || type === 'korpus3_1' || type === 'KORPUS3' ||
                (c.domainData?.type === 'container' && !c.domainData?.generatorParams?.type?.startsWith('smartbox'));
        }) || null;
    }
    if (!cabinetNode) return intents;

    const sbContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        return p && (p.type === 'smartbox_drawers' || p.boxType === 'DRAWERS') && c.domainData?.visible !== false;
    });
    if (sbContainers.length === 0) return intents;

    const allCabinetPanels: any[] = [];
    const collectCabinetPanels = (node: any) => {
        if (!node) return;
        const data = node.domainData;
        const gp = data?.generatorParams;
        if (gp && (String(gp.type || '').startsWith('smartbox') || gp.boxType)) return;

        if (node !== cabinetNode && data?.type !== 'container' && node.type !== NodeType.ASSEMBLY) {
            if (node.type === NodeType.PART || (data && (data.type === 'panel' || data.type === 'part' || data.role))) {
                allCabinetPanels.push(node);
            }
        }
        if (node.children) {
            for (const child of node.children) collectCabinetPanels(child);
        }
    };
    collectCabinetPanels(cabinetNode);

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

    const getZonePrefix = (tz: string) => {
        const u = (tz || 'B').toUpperCase();
        if (u === 'T' || u === 'TOP' || u === 'C') return 'T';
        if (u === 'M' || u === 'MID' || u === 'MIDDLE') return 'M';
        if (u === 'B' || u === 'BOTTOM' || u === 'A') return 'B';
        return 'FULL';
    };

    const isPanelMatchingZone = (panelNode: any, zonePfx: string) => {
        if (!zonePfx || zonePfx === 'FULL') return true;
        const d = panelNode.domainData;
        if (!d) return false;
        
        const pfx = (d.zonePrefix || '').replace('_', '').toUpperCase();
        if (pfx === zonePfx) return true;
        
        const k = (d.key || '').toUpperCase();
        if (k.startsWith(`${zonePfx}_`)) return true;
        
        const n = (d.name || '').toLowerCase();
        if (zonePfx === 'M' && (n.includes('srodek') || n.includes('srodk') || n.startsWith('m_') || n.startsWith('m-') || n.includes('_m_') || n.includes('_m'))) return true;
        if (zonePfx === 'B' && (n.includes('dol') || n.startsWith('b_') || n.startsWith('b-') || n.includes('_b_') || n.includes('_b'))) return true;
        if (zonePfx === 'T' && (n.includes('gora') || n.includes('gor') || n.startsWith('t_') || n.startsWith('t-') || n.includes('_t_') || n.includes('_t') || n.includes('pawlacz'))) return true;
        
        return false;
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
        worldZ: number,
        zonePrefix: string,
        sbWidth: number
    ): { node: any; face: DrawersDrillingFeature['face'] } | null => {
        const p = sbNode.domainData?.generatorParams || {};
        const ref = side === 'left' ? p.customReferences?.xMin : p.customReferences?.xMax;

        if (ref?.panelId) {
            const node = document.findNode(ref.panelId);
            if (node) {
                return { node, face: (ref.face || (side === 'left' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS')) as DrawersDrillingFeature['face'] };
            }
        }

        const boundaryRef = side === 'left' ? p.boundary?.left : p.boundary?.right;
        if (boundaryRef?.nodeId) {
            const node = document.findNode(boundaryRef.nodeId);
            if (node) {
                return { node, face: (boundaryRef.face || (side === 'left' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS')) as DrawersDrillingFeature['face'] };
            }
        }

        // Fallback geometryczny
        const sbWorldPos = sbNode.getWorldMatrix().decompose().translation;
        const sbCenterX = nmToMm(sbWorldPos.x);
        const sbLeftX = sbCenterX - sbWidth / 2;
        const sbRightX = sbCenterX + sbWidth / 2;

        let candidates = allCabinetPanels.filter((pNode) => {
            if (!isVerticalSidePanel(pNode)) return false;

            const rawH = pNode.domainData?.height ?? pNode.domainData?.length ?? pNode.domainData?.width ?? 0;
            const h = nmToMm(rawH);
            const centerZ = getPanelWorldZ(pNode);
            const pZMin = centerZ - h / 2;
            const pZMax = centerZ + h / 2;
            if (h > 0 && (worldZ < pZMin - 10 || worldZ > pZMax + 10)) return false;

            const panelX = nmToMm(pNode.getWorldMatrix().decompose().translation.x);
            return side === 'left' ? (panelX <= sbCenterX + 5) : (panelX >= sbCenterX - 5);
        });

        if (zonePrefix && zonePrefix !== 'FULL') {
            const zoneMatches = candidates.filter((n) => isPanelMatchingZone(n, zonePrefix));
            if (zoneMatches.length > 0) {
                candidates = zoneMatches;
            }
        }

        if (candidates.length === 0) return null;

        const targetRefX = side === 'left' ? sbLeftX : sbRightX;
        candidates.sort((a, b) => {
            const distA = Math.abs(nmToMm(a.getWorldMatrix().decompose().translation.x) - targetRefX);
            const distB = Math.abs(nmToMm(b.getWorldMatrix().decompose().translation.x) - targetRefX);
            return distA - distB;
        });

        return { node: candidates[0], face: (side === 'left' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS') as DrawersDrillingFeature['face'] };
    };

    const drillTemplate = getDrawerDrill();

    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};
        const zonePrefix = getZonePrefix(p.targetZone || 'B');

        const sbWidth = dimToMm(sbData.width, 600);
        const sbHeight = dimToMm(sbData.height, 720);
        const sbDepth = dimToMm(sbData.depth, 500);
        const sbPosZ = getPanelWorldZ(sbNode);

        const layout = resolveDrawerLayout(p, { width: sbWidth, height: sbHeight, depth: sbDepth });

        for (const slot of layout.slots) {
            const lengthKey = String(Math.round(slot.lengthMm));
            const holeData = slot.rail.lengths[lengthKey] || slot.rail.lengths[String(slot.lengthMm)] || {};
            const xPositions: number[] = holeData.x_positions || [];
            if (!xPositions.length) continue;

            const holeDiameter = rulesMToMm(slot.rail.drill?.dia, 3);
            const holeDepth = rulesMToMm(slot.rail.drill?.depth, 12);

            const zOff = rulesMToMm(holeData.z_offset, 33);
            const worldZ = sbPosZ + slot.zInternalBottom + zOff;

            const leftTarget = resolveSidePanel(sbNode, 'left', worldZ, zonePrefix, sbWidth);
            const rightTarget = resolveSidePanel(sbNode, 'right', worldZ, zonePrefix, sbWidth);

            xPositions.forEach((xRaw, idx) => {
                const fromFront = rulesMToMm(xRaw, 37);

                if (leftTarget?.node) {
                    const leftNode = leftTarget.node;
                    const rawD = leftNode.domainData?.width ?? leftNode.domainData?.depth ?? leftNode.domainData?.length ?? 0;
                    const sideDepth = nmToMm(rawD) || sbDepth;
                    const face = leftTarget.face || 'FACE_Z_PLUS';

                    const localXWorld = leftNode.localMatrix ? leftNode.localMatrix.transformDirection(new Vec3(1, 0, 0)) : new Vec3(0, -1, 0);
                    const isRightOriented = localXWorld.y > 0.1;
                    const u = isRightOriented ? fromFront : Math.max(0, sideDepth - fromFront);

                    intents.push({
                        targetNodeId: leftNode.id,
                        feature: {
                            id: `drawer_${slot.index}_corp_l_${idx}`,
                            type: 'hole',
                            face,
                            side: face,
                            params: {
                                template_id: drillTemplate.id || 'STANDARD_DRAWER_DRILL',
                                u,
                                v: getVForPanel(leftNode, worldZ),
                                diameter: holeDiameter,
                                depth: holeDepth,
                                isDrawerDrilling: true,
                                sourceContainerId: sbNode.id,
                                sourcePartId: `Prowadnica_${slot.index}L`
                            }
                        }
                    });
                }

                if (rightTarget?.node) {
                    const rightNode = rightTarget.node;
                    const rawD = rightNode.domainData?.width ?? rightNode.domainData?.depth ?? rightNode.domainData?.length ?? 0;
                    const sideDepth = nmToMm(rawD) || sbDepth;
                    const face = rightTarget.face || 'FACE_Z_PLUS';

                    const localXWorld = rightNode.localMatrix ? rightNode.localMatrix.transformDirection(new Vec3(1, 0, 0)) : new Vec3(0, 1, 0);
                    const isRightOriented = localXWorld.y > 0.1;
                    const u = isRightOriented ? fromFront : Math.max(0, sideDepth - fromFront);

                    intents.push({
                        targetNodeId: rightNode.id,
                        feature: {
                            id: `drawer_${slot.index}_corp_r_${idx}`,
                            type: 'hole',
                            face,
                            side: face,
                            params: {
                                template_id: drillTemplate.id || 'STANDARD_DRAWER_DRILL',
                                u,
                                v: getVForPanel(rightNode, worldZ),
                                diameter: holeDiameter,
                                depth: holeDepth,
                                isDrawerDrilling: true,
                                sourceContainerId: sbNode.id,
                                sourcePartId: `Prowadnica_${slot.index}P`
                            }
                        }
                    });
                }
            });
        }
    }

    return intents;
}
