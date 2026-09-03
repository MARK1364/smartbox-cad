/**
 * shelves-drilling-builder.ts
 *
 * Nawiercenia modułu PÓŁKI (smartbox_shelves).
 * Odpowiednik plan.cnc_features z @@BLENDER/A2_smartbox/shelves_2_engine_v1.py —
 * rzutuje otwory na BOK_L / BOK_P / PLECY korpusu.
 *
 * Para z shelves_3_rules_V1.json (machining_library: SINGLE, TRIPLE, SYSTEM_32).
 * Otwory boczne (narożniki) — rzut na BOK_L / BOK_P korpusu.
 * Otwory środkowe przód/tył — zawsze na półce (Polka), współrz. lokalne półki.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { ShelvesDrillingIntent } from './shelves-drilling-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { equalShelfCenterZ } from './shelves-engine.js';

export function buildShelvesDrillings(document: ProjectDocument, cabinetContainerId?: string): ShelvesDrillingIntent[] {
    const intents: ShelvesDrillingIntent[] = [];
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

    // 2. Znajdź wszystkie aktywne kontenery SmartBox z półkami
    const sbContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        return p && p.type === 'smartbox_shelves' && c.domainData?.visible !== false;
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

    const getWorldZ = (node: any): number => {
        const worldPos = node.getWorldMatrix().decompose().translation;
        return nmToMm(worldPos.z);
    };

    /** Wysokość V na bokach (oś pionowa = world Z). */
    const getVForPanel = (targetNode: any, worldZ: number): number => {
        if (!targetNode) return worldZ;
        const dd = targetNode.domainData;
        const rawH = dd?.height ?? dd?.width ?? 0;
        const targetHeight = nmToMm(rawH);
        const targetCenterZ = getWorldZ(targetNode);
        const targetBottomZ = targetCenterZ - targetHeight / 2;
        return worldZ - targetBottomZ;
    };

    const findShelfPanel = (sbNode: any, shelfIndex: number): any | null => {
        for (const child of sbNode?.children || []) {
            const d = child.domainData;
            if (d && d.name === `Polka_${shelfIndex}`) return child;
        }
        return null;
    };

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
            const h = nmToMm(pNode.domainData.height);
            const centerZ = getWorldZ(pNode);
            const pZMin = centerZ - h / 2;
            const pZMax = centerZ + h / 2;
            if (worldZ >= pZMin - 5 && worldZ <= pZMax + 5) {
                return pNode;
            }
        }
        return panelNodes[0] || null;
    };

    // 4. Dla każdego SmartBoxa wylicz nawiercenia na formatkach korpusu
    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};
        
        const rawTargetZone = p.targetZone || 'B';
        const zonePrefix = getZonePrefix(rawTargetZone);

        // Parametry SmartBoxa
        const count = p.shelfCount !== undefined ? p.shelfCount : 3;
        const holePattern = p.holePattern || 'SINGLE';
        if (holePattern === 'NONE') continue;

        const sbWidth = nmToMm(sbData.width);
        const sbHeight = nmToMm(sbData.height);
        const sbDepth = nmToMm(sbData.depth);

        const offsetFront = p.shelfOffsetFront !== undefined ? p.shelfOffsetFront : 10;
        const offsetSide = p.shelfOffsetSide !== undefined ? p.shelfOffsetSide : 0.5;
        const frontInset = p.frontInset !== undefined ? p.frontInset : 37;
        const backInset = p.backInset !== undefined ? p.backInset : 37;
        const frontHoles = p.frontHoles === true || p.front_holes_enabled === true;
        const frontOffsetX = p.frontOffsetX || p.front_holes_offset_x || 0;
        const backHoles = p.backHoles === true || p.back_holes_enabled === true;
        const backOffsetX = p.backOffsetX || p.back_holes_offset_x || 0;
        const tripleZOffset = p.tripleZOffset !== undefined ? p.tripleZOffset : 32;
        const sys32Spacing = p.system32Spacing !== undefined ? p.system32Spacing : 32;
        const sys32StartOffset = p.system32StartOffset !== undefined ? p.system32StartOffset : 150;
        const sys32HoleCount = p.system32HoleCount !== undefined ? p.system32HoleCount : 10;

        const holeDiameter = 5;
        const holeDepth = 12;
        const shelfThickness = p.thickness || 18;
        const radius = holeDiameter / 2;

        const sbNodeResolved = typeof document.findNode === 'function' ? document.findNode(sbNode.id) : sbNode;
        const sbBottomZ = getWorldZ(sbNodeResolved || sbNode);
        const effectiveWidth = sbWidth - 2 * offsetSide;

        /** Otwór środkowy przód/tył — zawsze dziecko półki, współrz. lokalne Polki. */
        const pushShelfCenterHole = (
            shelfNode: any,
            shelfIndex: number,
            kind: 'front' | 'back',
            suffix: string,
            uCenter: number,
            vPos: number,
            clearance: number
        ) => {
            const face = kind === 'front' ? 'FACE_Y_PLUS' : 'FACE_Y_MINUS';
            intents.push({
                targetNodeId: shelfNode.id,
                feature: {
                    id: `shelf_${shelfIndex}_${kind}_center${suffix}`,
                    type: 'hole',
                    face,
                    side: face,
                    params: {
                        template_id: 'SINGLE',
                        u: uCenter,
                        v: vPos,
                        diameter: holeDiameter,
                        depth: holeDepth,
                        clearance,
                        isShelfDrilling: true,
                        sourceContainerId: sbNode.id,
                        sourcePartId: `Polka_${shelfIndex}`
                    }
                }
            });
        };

        // ─── A. WZORZEC SINGLE / TRIPLE DLA PÓŁEK ──────────────────────────────
        if ((holePattern === 'SINGLE' || holePattern === 'TRIPLE') && count > 0 && sbHeight > 0) {
            for (let i = 1; i <= count; i++) {
                const shelfCenterZ = equalShelfCenterZ(sbHeight, count, shelfThickness, i);
                const shelfHoleZ = shelfCenterZ - shelfThickness / 2 - radius;

                // Wysokości otworów lokalnie w SmartBoxie
                const localZPositions = [shelfHoleZ];
                if (holePattern === 'TRIPLE') {
                    localZPositions.push(shelfHoleZ + tripleZOffset);
                    localZPositions.push(shelfHoleZ - tripleZOffset);
                }

                for (let idx = 0; idx < localZPositions.length; idx++) {
                    const localZ = localZPositions[idx];
                    const worldZ = sbBottomZ + localZ;
                    const suffix = idx === 0 ? '' : (idx === 1 ? '_top' : '_bottom');

                    // 1. Bok Lewy (BOK_L -> FACE_Z_PLUS)
                    const leftNode = zonePrefix === 'FULL' 
                        ? findPanelForWorldZ(allLeftSides, worldZ) 
                        : (allLeftSides.find(n => isPanelMatchingZone(n, zonePrefix)) || allLeftSides[0]);

                    if (leftNode) {
                        const sideDepth = nmToMm(leftNode.domainData.width || sbDepth);
                        // BOK_L: U=0 to tył, U=sideDepth to przód
                        const uFront = Math.max(0, sideDepth - (frontInset + offsetFront));
                        const uBack = Math.max(0, backInset);
                        const vPos = getVForPanel(leftNode, worldZ);

                        intents.push({
                            targetNodeId: leftNode.id,
                            feature: {
                                id: `shelf_${i}_left_front${suffix}`,
                                type: 'hole',
                                face: 'FACE_Z_PLUS',
                                side: 'FACE_Z_PLUS',
                                params: {
                                    template_id: 'SINGLE',
                                    u: uFront,
                                    v: vPos,
                                    diameter: holeDiameter,
                                    depth: holeDepth,
                                    isShelfDrilling: true,
                                    sourceContainerId: sbNode.id,
                                    sourcePartId: `Polka_${i}`
                                }
                            }
                        });

                        intents.push({
                            targetNodeId: leftNode.id,
                            feature: {
                                id: `shelf_${i}_left_back${suffix}`,
                                type: 'hole',
                                face: 'FACE_Z_PLUS',
                                side: 'FACE_Z_PLUS',
                                params: {
                                    template_id: 'SINGLE',
                                    u: uBack,
                                    v: vPos,
                                    diameter: holeDiameter,
                                    depth: holeDepth,
                                    isShelfDrilling: true,
                                    sourceContainerId: sbNode.id,
                                    sourcePartId: `Polka_${i}`
                                }
                            }
                        });
                    }

                    // 2. Bok Prawy (BOK_P -> FACE_Z_PLUS)
                    const rightNode = zonePrefix === 'FULL' 
                        ? findPanelForWorldZ(allRightSides, worldZ) 
                        : (allRightSides.find(n => isPanelMatchingZone(n, zonePrefix)) || allRightSides[0]);

                    if (rightNode) {
                        const sideDepth = nmToMm(rightNode.domainData.width || sbDepth);
                        // BOK_P: U=0 to przód, U=sideDepth to tył
                        const uFront = Math.max(0, frontInset + offsetFront);
                        const uBack = Math.max(0, sideDepth - backInset);
                        const vPos = getVForPanel(rightNode, worldZ);

                        intents.push({
                            targetNodeId: rightNode.id,
                            feature: {
                                id: `shelf_${i}_right_front${suffix}`,
                                type: 'hole',
                                face: 'FACE_Z_PLUS',
                                side: 'FACE_Z_PLUS',
                                params: {
                                    template_id: 'SINGLE',
                                    u: uFront,
                                    v: vPos,
                                    diameter: holeDiameter,
                                    depth: holeDepth,
                                    isShelfDrilling: true,
                                    sourceContainerId: sbNode.id,
                                    sourcePartId: `Polka_${i}`
                                }
                            }
                        });

                        intents.push({
                            targetNodeId: rightNode.id,
                            feature: {
                                id: `shelf_${i}_right_back${suffix}`,
                                type: 'hole',
                                face: 'FACE_Z_PLUS',
                                side: 'FACE_Z_PLUS',
                                params: {
                                    template_id: 'SINGLE',
                                    u: uBack,
                                    v: vPos,
                                    diameter: holeDiameter,
                                    depth: holeDepth,
                                    isShelfDrilling: true,
                                    sourceContainerId: sbNode.id,
                                    sourcePartId: `Polka_${i}`
                                }
                            }
                        });
                    }

                    // 3–4. Otwory środkowe przód/tył — zawsze na półce (Polka), układ lokalny półki
                    const shelfNode = findShelfPanel(sbNodeResolved || sbNode, i);
                    if (shelfNode) {
                        const shelfWidth = nmToMm(shelfNode.domainData.width || effectiveWidth);
                        const uCenterBase = (shelfWidth / 2);

                        if (frontHoles) {
                            let uFront = uCenterBase + frontOffsetX;
                            if (holePattern === 'TRIPLE') {
                                if (idx === 1) uFront += tripleZOffset;
                                if (idx === 2) uFront -= tripleZOffset;
                            }
                            pushShelfCenterHole(
                                shelfNode, i, 'front', suffix,
                                uFront, shelfThickness + radius, offsetFront
                            );
                        }

                        if (backHoles) {
                            let uBack = uCenterBase + backOffsetX;
                            if (holePattern === 'TRIPLE') {
                                if (idx === 1) uBack += tripleZOffset;
                                if (idx === 2) uBack -= tripleZOffset;
                            }
                            pushShelfCenterHole(
                                shelfNode, i, 'back', suffix,
                                uBack, -radius, 0
                            );
                        }
                    }
                }
            }
        }

        // ─── B. WZORZEC SYSTEM 32 DLA BOKÓW I PLECÓW ───────────────────────────
        if (holePattern === 'SYSTEM_32' || holePattern === 'ROW') {
            const totalHoles = sys32HoleCount > 0 ? sys32HoleCount : 10;

            for (let k = 0; k < totalHoles; k++) {
                const localZ = sys32StartOffset + k * sys32Spacing;
                if (localZ > sbHeight - 10) break;
                const worldZ = sbBottomZ + localZ;

                // 1. Bok Lewy (BOK_L -> FACE_Z_PLUS)
                const leftNode = zonePrefix === 'FULL' 
                    ? findPanelForWorldZ(allLeftSides, worldZ) 
                    : (allLeftSides.find(n => isPanelMatchingZone(n, zonePrefix)) || allLeftSides[0]);

                if (leftNode) {
                    const sideDepth = nmToMm(leftNode.domainData.width || sbDepth);
                    // BOK_L: U=0 to tył, U=sideDepth to przód
                    const uFront = Math.max(0, sideDepth - (frontInset + offsetFront));
                    const uBack = Math.max(0, backInset);
                    const vPos = getVForPanel(leftNode, worldZ);

                    intents.push({
                        targetNodeId: leftNode.id,
                        feature: {
                            id: `sys32_left_front_${k}`,
                            type: 'hole',
                            face: 'FACE_Z_PLUS',
                            side: 'FACE_Z_PLUS',
                            params: {
                                template_id: 'SINGLE',
                                u: uFront,
                                v: vPos,
                                diameter: holeDiameter,
                                depth: holeDepth,
                                isShelfDrilling: true,
                                sourceContainerId: sbNode.id,
                                sourcePartId: 'System_32'
                            }
                        }
                    });

                    intents.push({
                        targetNodeId: leftNode.id,
                        feature: {
                            id: `sys32_left_back_${k}`,
                            type: 'hole',
                            face: 'FACE_Z_PLUS',
                            side: 'FACE_Z_PLUS',
                            params: {
                                template_id: 'SINGLE',
                                u: uBack,
                                v: vPos,
                                diameter: holeDiameter,
                                depth: holeDepth,
                                isShelfDrilling: true,
                                sourceContainerId: sbNode.id,
                                sourcePartId: 'System_32'
                            }
                        }
                    });
                }

                // 2. Bok Prawy (BOK_P -> FACE_Z_PLUS)
                const rightNode = zonePrefix === 'FULL' 
                    ? findPanelForWorldZ(allRightSides, worldZ) 
                    : (allRightSides.find(n => isPanelMatchingZone(n, zonePrefix)) || allRightSides[0]);

                if (rightNode) {
                    const sideDepth = nmToMm(rightNode.domainData.width || sbDepth);
                    // BOK_P: U=0 to przód, U=sideDepth to tył
                    const uFront = Math.max(0, frontInset + offsetFront);
                    const uBack = Math.max(0, sideDepth - backInset);
                    const vPos = getVForPanel(rightNode, worldZ);

                    intents.push({
                        targetNodeId: rightNode.id,
                        feature: {
                            id: `sys32_right_front_${k}`,
                            type: 'hole',
                            face: 'FACE_Z_PLUS',
                            side: 'FACE_Z_PLUS',
                            params: {
                                template_id: 'SINGLE',
                                u: uFront,
                                v: vPos,
                                diameter: holeDiameter,
                                depth: holeDepth,
                                isShelfDrilling: true,
                                sourceContainerId: sbNode.id,
                                sourcePartId: 'System_32'
                            }
                        }
                    });

                    intents.push({
                        targetNodeId: rightNode.id,
                        feature: {
                            id: `sys32_right_back_${k}`,
                            type: 'hole',
                            face: 'FACE_Z_PLUS',
                            side: 'FACE_Z_PLUS',
                            params: {
                                template_id: 'SINGLE',
                                u: uBack,
                                v: vPos,
                                diameter: holeDiameter,
                                depth: holeDepth,
                                isShelfDrilling: true,
                                sourceContainerId: sbNode.id,
                                sourcePartId: 'System_32'
                            }
                        }
                    });
                }
            }
        }
    }

    return intents;
}
