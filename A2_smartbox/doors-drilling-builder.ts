/**
 * doors-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu DRZWI.
 * Rzutuje otwory prowadników zawiasów ze SmartBoxa na BOK_L / BOK_P.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { DoorsDrillingIntent } from './doors-drilling-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
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

    // 3. Zbierz wszystkie formatki korpusu i ich pozycje
    const allLeftSides: any[] = [];
    const allRightSides: any[] = [];

    const collectCabinetPanels = (node: any) => {
        if (!node) return;
        const data = node.domainData;
        const gp = data?.generatorParams;
        if (gp && (String(gp.type || '').startsWith('smartbox') || gp.boxType)) return;
        if (data && (data.type === 'panel' || data.type === 'part')) {
            const role = data.role || '';
            const name = (data.name || '').toLowerCase();
            const key = (data.key || '').toUpperCase();

            if (role === 'LEFT_SIDE_PANEL' || role.includes('SIDE_LEFT') || (role.includes('BOK') && (name.includes('_l') || name.includes('bok_l') || key.includes('BOK_L')))) {
                allLeftSides.push(node);
            } else if (role === 'RIGHT_SIDE_PANEL' || role.includes('SIDE_RIGHT') || (role.includes('BOK') && (name.includes('_p') || name.includes('bok_p') || key.includes('BOK_P')))) {
                allRightSides.push(node);
            }
        }
        if (node.children) {
            for (const child of node.children) {
                collectCabinetPanels(child);
            }
        }
    };
    collectCabinetPanels(cabinetNode);

    const getZonePrefix = (tz: string) => {
        const u = (tz || 'B').toUpperCase();
        if (u === 'T' || u === 'TOP' || u === 'C') return 'T';
        if (u === 'M' || u === 'MID' || u === 'MIDDLE') return 'M';
        if (u === 'B' || u === 'BOTTOM' || u === 'A') return 'B';
        return 'FULL';
    };

    const isPanelMatchingZone = (panelNode: any, zonePfx: string) => {
        if (zonePfx === 'FULL') return true;
        const d = panelNode.domainData;
        if (!d) return false;
        
        const pfx = (d.zonePrefix || '').replace('_', '').toUpperCase();
        if (pfx === zonePfx) return true;
        
        const k = (d.key || '').toUpperCase();
        if (k.startsWith(`${zonePfx}_`)) return true;
        
        const n = (d.name || '').toLowerCase();
        if (zonePfx === 'M' && (n.includes('srodek') || n.includes('srodk') || n.startsWith('m_') || n.startsWith('m-'))) return true;
        if (zonePfx === 'B' && (n.includes('dol') || n.startsWith('b_') || n.startsWith('b-'))) return true;
        if (zonePfx === 'T' && (n.includes('gora') || n.includes('gor') || n.startsWith('t_') || n.startsWith('t-') || n.includes('pawlacz'))) return true;
        
        return false;
    };

    const findPanelForWorldZ = (panelNodes: any[], worldZ: number) => {
        for (const pNode of panelNodes) {
            const pos = pNode.localMatrix.decompose().translation;
            const h = nmToMm(pNode.domainData.height);
            const pZMin = nmToMm(pos.z) - h / 2;
            const pZMax = nmToMm(pos.z) + h / 2;
            if (worldZ >= pZMin - 5 && worldZ <= pZMax + 5) {
                return pNode;
            }
        }
        return panelNodes[0] || null;
    };

    // 4. Dla każdego SmartBoxa z drzwiami wylicz nawiercenia prowadników na bokach korpusu
    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};
        
        const rawTargetZone = p.targetZone || 'B';
        const zonePrefix = getZonePrefix(rawTargetZone);

        const doorType = (p.door_type || p.doorType || 'LEFT').toUpperCase();
        const sbHeight = nmToMm(sbData.height);
        const sbDepth = nmToMm(sbData.depth);

        // Oblicz bezwzględną wysokość SmartBoxa w korpusie (sbPosZ)
        const sbPos = sbNode.localMatrix.decompose().translation;
        const sbPosZ = nmToMm(sbPos.z);

        // Helper do wyznaczania wysokości V na formatce docelowej
        const getVForPanel = (targetNode: any, worldZ: number): number => {
            if (!targetNode) return worldZ;
            const targetPos = targetNode.localMatrix.decompose().translation;
            const targetHeight = nmToMm(targetNode.domainData.height);
            const targetBottomZ = nmToMm(targetPos.z) - targetHeight / 2;
            return worldZ - targetBottomZ;
        };

        // Zbierz listę aktywnych zawiasów
        const hinges: { index: number; localZ: number }[] = [];

        // Hinge 1
        if (p.use_hinge_1 !== false) {
            const pos1 = p.hinge_1_pos !== undefined ? Number(p.hinge_1_pos) : 120;
            hinges.push({ index: 1, localZ: pos1 });
        }
        // Hinge 2
        if (p.use_hinge_2) {
            const pos2 = p.hinge_2_pos !== undefined ? Number(p.hinge_2_pos) : 570;
            hinges.push({ index: 2, localZ: pos2 });
        }
        // Hinge 3
        if (p.use_hinge_3) {
            const pos3 = p.hinge_3_pos !== undefined ? Number(p.hinge_3_pos) : 910;
            hinges.push({ index: 3, localZ: pos3 });
        }
        // Hinge 4
        if (p.use_hinge_4) {
            const pos4 = p.hinge_4_pos !== undefined ? Number(p.hinge_4_pos) : 1230;
            hinges.push({ index: 4, localZ: pos4 });
        }
        // Hinge 5
        if (p.use_hinge_5) {
            const pos5 = p.hinge_5_pos !== undefined ? Number(p.hinge_5_pos) : 1580;
            hinges.push({ index: 5, localZ: pos5 });
        }
        // Hinge 6 (Liczony od góry)
        if (p.use_hinge_6 !== false) {
            const pos6 = p.hinge_6_pos !== undefined ? Number(p.hinge_6_pos) : 120;
            hinges.push({ index: 6, localZ: Math.max(0, sbHeight - pos6) });
        }

        const hingeId = p.hinge_template || p.hingeTemplate || DEFAULT_HINGE_ID;
        const corpusHoles = hingeCorpusHolesMm(hingeId);
        const templateId = hingeTemplateId(hingeId);

        const isLeftActive = doorType === 'LEFT' || doorType === 'DOUBLE';
        const isRightActive = doorType === 'RIGHT' || doorType === 'DOUBLE';

        for (const hinge of hinges) {
            const worldCenterZ = sbPosZ + hinge.localZ;

            // ─── 1. BOK LEWY (Dla drzwi LEWYCH i PODWÓJNYCH) ──────────────────────────
            if (isLeftActive) {
                const leftNode = zonePrefix === 'FULL' 
                    ? findPanelForWorldZ(allLeftSides, worldCenterZ) 
                    : (allLeftSides.find(n => isPanelMatchingZone(n, zonePrefix)) || allLeftSides[0]);

                if (leftNode) {
                    const sideDepth = nmToMm(leftNode.domainData.width || sbDepth);
                    // Na lewym boku (rot -90 st.) oś U=0 to tył, a U=sideDepth to przód
                    for (const hole of corpusHoles) {
                        const uFront = Math.max(0, sideDepth - hole.frontDist);
                        intents.push({
                            targetNodeId: leftNode.id,
                            feature: {
                                id: `hinge_plate_l_${hinge.index}_${hole.name || 'h'}`,
                                type: 'hole',
                                face: 'FACE_Z_PLUS',
                                side: 'FACE_Z_PLUS',
                                params: {
                                    template_id: templateId,
                                    u: uFront,
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

            // ─── 2. BOK PRAWY (Dla drzwi PRAWYCH i PODWÓJNYCH) ─────────────────────────
            if (isRightActive) {
                const rightNode = zonePrefix === 'FULL' 
                    ? findPanelForWorldZ(allRightSides, worldCenterZ) 
                    : (allRightSides.find(n => isPanelMatchingZone(n, zonePrefix)) || allRightSides[0]);

                if (rightNode) {
                    // Na prawym boku (rot +90 st.) oś U=0 to przód szafki
                    for (const hole of corpusHoles) {
                        intents.push({
                            targetNodeId: rightNode.id,
                            feature: {
                                id: `hinge_plate_r_${hinge.index}_${hole.name || 'h'}`,
                                type: 'hole',
                                face: 'FACE_Z_PLUS',
                                side: 'FACE_Z_PLUS',
                                params: {
                                    template_id: templateId,
                                    u: hole.frontDist,
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
