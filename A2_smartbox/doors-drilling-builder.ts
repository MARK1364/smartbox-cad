/**
 * doors-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu DRZWI.
 * Rzutuje otwory prowadników zawiasów ze SmartBoxa na formatki graniczne (bok / przegroda).
 * Brak sztywnego szukania po rolach — pełne wsparcie customReferences i geometrii.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { DoorsDrillingIntent, DoorsDrillingFeature } from './doors-drilling-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { DEFAULT_HINGE_ID, hingeCorpusHolesMm, hingeTemplateId } from '../Biblioteki/okucia/index.js';

export function buildDoorsDrillings(document: ProjectDocument, cabinetContainerId?: string): DoorsDrillingIntent[] {
    const intents: DoorsDrillingIntent[] = [];
    if (!document) return intents;

    const containers = typeof document.getContainers === 'function' ? document.getContainers() : [];
    
    // 1. Znajdź główny korpus (cabinet)
    let cabinetNode = cabinetContainerId ? document.findNode(cabinetContainerId) : null;
    if (!cabinetNode) {
        cabinetNode = containers.find((c: any) => {
            const type = c.domainData?.generatorParams?.type;
            return type === 'korpus3_2' || type === 'korpus3_1' || type === 'KORPUS3' || 
                   (c.domainData?.type === 'container' && !c.domainData?.generatorParams?.type?.startsWith('smartbox'));
        }) || null;
    }
    if (!cabinetNode) return intents;

    // 2. Znajdź wszystkie aktywne kontenery SmartBox z drzwiami
    const sbContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        return p && (p.type === 'smartbox_doors' || p.boxType === 'DOORS') && c.domainData?.visible !== false;
    });

    if (sbContainers.length === 0) return intents;

    // 3. Zbierz wszystkie formatki korpusu (boki, przegrody pionowe)
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
            for (const child of node.children) {
                collectCabinetPanels(child);
            }
        }
    };
    collectCabinetPanels(cabinetNode);

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
    ): { node: any; face: DoorsDrillingFeature['face'] } | null => {
        const p = sbNode.domainData?.generatorParams || {};
        const ref = side === 'left' ? p.customReferences?.xMin : p.customReferences?.xMax;

        // Priorytet: customReferences
        if (ref?.panelId) {
            const node = document.findNode(ref.panelId);
            if (node) {
                return { node, face: (ref.face || (side === 'left' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS')) as DoorsDrillingFeature['face'] };
            }
        }

        // Fallback: boundary references
        const boundaryRef = side === 'left' ? p.boundary?.left : p.boundary?.right;
        if (boundaryRef?.nodeId) {
            const node = document.findNode(boundaryRef.nodeId);
            if (node) {
                return { node, face: (boundaryRef.face || (side === 'left' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS')) as DoorsDrillingFeature['face'] };
            }
        }

        // Fallback geometryczny
        const sbWorldPos = sbNode.getWorldMatrix().decompose().translation;
        const sbCenterX = nmToMm(sbWorldPos.x);
        const sbLeftX = sbCenterX - sbWidth / 2;
        const sbRightX = sbCenterX + sbWidth / 2;

        let candidates = allCabinetPanels.filter((pNode) => {
            if (!isVerticalSidePanel(pNode)) return false;

            const rawH = pNode.domainData?.length ?? pNode.domainData?.height ?? pNode.domainData?.width ?? 0;
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

        return { node: candidates[0], face: (side === 'left' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS') as DoorsDrillingFeature['face'] };
    };

    // 4. Dla każdego SmartBoxa z drzwiami wylicz nawiercenia prowadników
    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};
        const zonePrefix = getZonePrefix(p.targetZone || 'B');

        const doorType = (p.door_type || p.doorType || 'LEFT').toUpperCase();
        const sbWidth = nmToMm(sbData.width);
        const sbHeight = nmToMm(sbData.height);
        const sbDepth = nmToMm(sbData.depth);

        const sbWorldPos = sbNode.getWorldMatrix().decompose().translation;
        const sbPosZ = nmToMm(sbWorldPos.z);

        // Zbierz listę aktywnych zawiasów
        const hinges: { index: number; localZ: number }[] = [];

        if (p.use_hinge_1 !== false) {
            const pos1 = p.hinge_1_pos !== undefined ? Number(p.hinge_1_pos) : 120;
            hinges.push({ index: 1, localZ: pos1 });
        }
        if (p.use_hinge_2) {
            const pos2 = p.hinge_2_pos !== undefined ? Number(p.hinge_2_pos) : 570;
            hinges.push({ index: 2, localZ: pos2 });
        }
        if (p.use_hinge_3) {
            const pos3 = p.hinge_3_pos !== undefined ? Number(p.hinge_3_pos) : 910;
            hinges.push({ index: 3, localZ: pos3 });
        }
        if (p.use_hinge_4) {
            const pos4 = p.hinge_4_pos !== undefined ? Number(p.hinge_4_pos) : 1230;
            hinges.push({ index: 4, localZ: pos4 });
        }
        if (p.use_hinge_5) {
            const pos5 = p.hinge_5_pos !== undefined ? Number(p.hinge_5_pos) : 1580;
            hinges.push({ index: 5, localZ: pos5 });
        }
        if (p.use_hinge_6 !== false) {
            const pos6 = p.hinge_6_pos !== undefined ? Number(p.hinge_6_pos) : 120;
            hinges.push({ index: 6, localZ: Math.max(0, sbHeight - pos6) });
        }

        const hingeId = p.hinge_template || p.hingeTemplate || DEFAULT_HINGE_ID;
        const corpusHoles = hingeCorpusHolesMm(hingeId);
        const templateId = hingeTemplateId(hingeId);

        const isLeftActive = doorType === 'LEFT' || doorType === 'SINGLE_LEFT' || doorType === 'DOUBLE';
        const isRightActive = doorType === 'RIGHT' || doorType === 'SINGLE_RIGHT' || doorType === 'DOUBLE';

        for (const hinge of hinges) {
            const worldCenterZ = sbPosZ + hinge.localZ;

            // ─── 1. BOK / PRZEGRODA PO LEWEJ STRONIE ──────────────────────────
            if (isLeftActive) {
                const leftTarget = resolveSidePanel(sbNode, 'left', worldCenterZ, zonePrefix, sbWidth);
                if (leftTarget?.node) {
                    const leftNode = leftTarget.node;
                    const rawD = leftNode.domainData?.width ?? leftNode.domainData?.depth ?? leftNode.domainData?.length ?? 0;
                    const sideDepth = nmToMm(rawD) || sbDepth;
                    const face = leftTarget.face || 'FACE_Z_PLUS';

                    const localXWorld = leftNode.localMatrix ? leftNode.localMatrix.transformDirection(new Vec3(1, 0, 0)) : new Vec3(0, -1, 0);
                    const isRightOriented = localXWorld.y > 0.1;

                    for (const hole of corpusHoles) {
                        const uPos = isRightOriented ? hole.frontDist : Math.max(0, sideDepth - hole.frontDist);
                        intents.push({
                            targetNodeId: leftNode.id,
                            feature: {
                                id: `hinge_plate_l_${hinge.index}_${hole.name || 'h'}`,
                                type: 'hole',
                                face,
                                side: face,
                                params: {
                                    template_id: templateId,
                                    u: uPos,
                                    v: getVForPanel(leftNode, worldCenterZ + hole.zOffset),
                                    diameter: hole.dia,
                                    depth: hole.depth,
                                    isDoorDrilling: true,
                                    sourceContainerId: sbNode.id,
                                    sourcePartId: `Hinge_L${hinge.index}`
                                }
                            }
                        });
                    }
                }
            }

            // ─── 2. BOK / PRZEGRODA PO PRAWEJ STRONIE ─────────────────────────
            if (isRightActive) {
                const rightTarget = resolveSidePanel(sbNode, 'right', worldCenterZ, zonePrefix, sbWidth);
                if (rightTarget?.node) {
                    const rightNode = rightTarget.node;
                    const rawD = rightNode.domainData?.width ?? rightNode.domainData?.depth ?? rightNode.domainData?.length ?? 0;
                    const sideDepth = nmToMm(rawD) || sbDepth;
                    const face = rightTarget.face || 'FACE_Z_PLUS';

                    const localXWorld = rightNode.localMatrix ? rightNode.localMatrix.transformDirection(new Vec3(1, 0, 0)) : new Vec3(0, 1, 0);
                    const isRightOriented = localXWorld.y > 0.1;

                    for (const hole of corpusHoles) {
                        const uPos = isRightOriented ? hole.frontDist : Math.max(0, sideDepth - hole.frontDist);
                        intents.push({
                            targetNodeId: rightNode.id,
                            feature: {
                                id: `hinge_plate_r_${hinge.index}_${hole.name || 'h'}`,
                                type: 'hole',
                                face,
                                side: face,
                                params: {
                                    template_id: templateId,
                                    u: uPos,
                                    v: getVForPanel(rightNode, worldCenterZ + hole.zOffset),
                                    diameter: hole.dia,
                                    depth: hole.depth,
                                    isDoorDrilling: true,
                                    sourceContainerId: sbNode.id,
                                    sourcePartId: `Hinge_R${hinge.index}`
                                }
                            }
                        });
                    }
                }
            }
        }
    }

    return intents;
}
