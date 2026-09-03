/**
 * drawers-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu SZUFLADY.
 * Odpowiednik plan.cnc_features z @@BLENDER/A2_smartbox/drawers_2_engine_v1.py —
 * rzutuje corpus_holes prowadnicy na BOK_L / BOK_P.
 *
 * Pozycje X w JSON są w metrach od przodu szyny. V na boku = world Z otworu.
 * Układ Z jak w drawers-engine (Z=0 spód SmartBoxa) + resolveDrawerLayout.
 */
import { ProjectDocument } from '../A1_core/project-document.js';
import { DrawersDrillingIntent } from './drawers-drilling-intent.js';
import { nmToMm, rulesMToMm } from '../A1_core/cad-math/units.js';
import { resolveDrawerLayout } from './drawers-engine.js';
import { getDrawerDrill } from '../Biblioteki/okucia/index.js';

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
            for (const child of node.children) collectCabinetPanels(child);
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

    // Jak doors-drilling-builder: lokalne Z względem korpusu (origin SmartBoxa = spód strefy).
    const getLocalZ = (node: any): number => {
        const pos = node.localMatrix.decompose().translation;
        return nmToMm(pos.z);
    };

    const findPanelForWorldZ = (panelNodes: any[], worldZ: number) => {
        for (const pNode of panelNodes) {
            const h = dimToMm(pNode.domainData?.height);
            const centerZ = getLocalZ(pNode);
            const pZMin = centerZ - h / 2;
            const pZMax = centerZ + h / 2;
            if (worldZ >= pZMin - 5 && worldZ <= pZMax + 5) return pNode;
        }
        return panelNodes[0] || null;
    };

    const getVForPanel = (targetNode: any, worldZ: number): number => {
        if (!targetNode) return worldZ;
        const targetHeight = dimToMm(targetNode.domainData?.height);
        const targetBottomZ = getLocalZ(targetNode) - targetHeight / 2;
        return worldZ - targetBottomZ;
    };

    const drillTemplate = getDrawerDrill();

    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};
        const zonePrefix = getZonePrefix(p.targetZone || 'B');
        const sbWidth = dimToMm(sbData.width, 600);
        const sbHeight = dimToMm(sbData.height, 720);
        const sbDepth = dimToMm(sbData.depth, 500);
        const sbPosZ = getLocalZ(sbNode);

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

            const pickSide = (nodes: any[]) => zonePrefix === 'FULL'
                ? findPanelForWorldZ(nodes, worldZ)
                : (nodes.find(n => isPanelMatchingZone(n, zonePrefix)) || nodes[0]);

            const leftNode = pickSide(allLeftSides);
            const rightNode = pickSide(allRightSides);

            xPositions.forEach((xRaw, idx) => {
                const fromFront = rulesMToMm(xRaw, 37);

                if (leftNode) {
                    const sideDepth = dimToMm(leftNode.domainData.width, sbDepth);
                    const u = Math.max(0, sideDepth - fromFront);
                    intents.push({
                        targetNodeId: leftNode.id,
                        feature: {
                            id: `drawer_${slot.index}_corp_l_${idx}`,
                            type: 'hole',
                            face: 'FACE_Z_PLUS',
                            side: 'FACE_Z_PLUS',
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

                if (rightNode) {
                    intents.push({
                        targetNodeId: rightNode.id,
                        feature: {
                            id: `drawer_${slot.index}_corp_r_${idx}`,
                            type: 'hole',
                            face: 'FACE_Z_PLUS',
                            side: 'FACE_Z_PLUS',
                            params: {
                                template_id: drillTemplate.id || 'STANDARD_DRAWER_DRILL',
                                u: fromFront,
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
