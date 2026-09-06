/**
 * shelves-drilling-builder.ts
 *
 * Nawiercenia modułu PÓŁKI (smartbox_shelves).
 * Rzutuje otwory na boki / przegrody graniczne korpusu.
 * Pełne wsparcie customReferences i geometrii — zero sztywnych ról.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ShelvesDrillingIntent, ShelvesDrillingFeature } from './shelves-drilling-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
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

    // 3. Zbierz wszystkie formatki korpusu (wykluczając sam kontener korpusu)
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

    /** Wysokość V na bokach (oś pionowa = world Z). */
    const getVForPanel = (targetNode: any, worldZ: number): number => {
        if (!targetNode) return worldZ;
        const dd = targetNode.domainData;
        const rawH = dd?.length ?? dd?.height ?? dd?.width ?? 0;
        const targetHeight = nmToMm(rawH);
        const targetCenterZ = getPanelWorldZ(targetNode);
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
    ): { node: any; face: ShelvesDrillingFeature['face'] } | null => {
        const p = sbNode.domainData?.generatorParams || {};
        const ref = side === 'left' ? p.customReferences?.xMin : p.customReferences?.xMax;

        if (ref?.panelId) {
            const node = document.findNode(ref.panelId);
            if (node) {
                return { node, face: (ref.face || 'FACE_Z_PLUS') as ShelvesDrillingFeature['face'] };
            }
        }

        const boundaryRef = side === 'left' ? p.boundary?.left : p.boundary?.right;
        if (boundaryRef?.nodeId) {
            const node = document.findNode(boundaryRef.nodeId);
            if (node) {
                return { node, face: (boundaryRef.face || 'FACE_Z_PLUS') as ShelvesDrillingFeature['face'] };
            }
        }

        const sbWorldPos = sbNode.getWorldMatrix().decompose().translation;
        const sbCenterX = nmToMm(sbWorldPos.x);
        const sbLeftX = sbCenterX - sbWidth / 2;
        const sbRightX = sbCenterX + sbWidth / 2;

        let candidates: any[] = [];

        if (zonePrefix && zonePrefix !== 'FULL') {
            const zoneMatches = allCabinetPanels.filter((pNode) => {
                if (!isVerticalSidePanel(pNode)) return false;
                const panelX = nmToMm(pNode.getWorldMatrix().decompose().translation.x);
                if (side === 'left' ? (panelX > sbCenterX + 5) : (panelX < sbCenterX - 5)) return false;
                return isPanelMatchingZone(pNode, zonePrefix);
            });
            if (zoneMatches.length > 0) {
                candidates = zoneMatches;
            }
        }

        if (candidates.length === 0) {
            candidates = allCabinetPanels.filter((pNode) => {
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
        }

        if (candidates.length === 0) return null;

        const targetRefX = side === 'left' ? sbLeftX : sbRightX;
        candidates.sort((a, b) => {
            const distA = Math.abs(nmToMm(a.getWorldMatrix().decompose().translation.x) - targetRefX);
            const distB = Math.abs(nmToMm(b.getWorldMatrix().decompose().translation.x) - targetRefX);
            return distA - distB;
        });

        return { node: candidates[0], face: 'FACE_Z_PLUS' as ShelvesDrillingFeature['face'] };
    };

    // 4. Dla każdego SmartBoxa wylicz nawiercenia na formatkach korpusu
    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};
        const zonePrefix = getZonePrefix(p.targetZone || 'B');

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
        const sbBottomZ = getPanelWorldZ(sbNodeResolved || sbNode);
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

                    // 1. Bok / Przegroda Lewa
                    const leftTarget = resolveSidePanel(sbNode, 'left', worldZ, zonePrefix, sbWidth);
                    if (leftTarget?.node) {
                        const leftNode = leftTarget.node;
                        const rawD = leftNode.domainData.width ?? leftNode.domainData.depth ?? leftNode.domainData.length ?? 0;
                        const sideDepth = nmToMm(rawD) || sbDepth;
                        const face = leftTarget.face || 'FACE_Z_PLUS';

                        const localXWorld = leftNode.localMatrix ? leftNode.localMatrix.transformDirection(new Vec3(1, 0, 0)) : new Vec3(0, -1, 0);
                        const isRightOriented = localXWorld.y > 0.1;

                        const uFront = isRightOriented
                            ? Math.max(0, frontInset + offsetFront)
                            : Math.max(0, sideDepth - (frontInset + offsetFront));
                        const uBack = isRightOriented
                            ? Math.max(0, sideDepth - backInset)
                            : Math.max(0, backInset);
                        const vPos = getVForPanel(leftNode, worldZ);

                        intents.push({
                            targetNodeId: leftNode.id,
                            feature: {
                                id: `shelf_${i}_left_front${suffix}`,
                                type: 'hole',
                                face,
                                side: face,
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
                                face,
                                side: face,
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

                    // 2. Bok / Przegroda Prawa
                    const rightTarget = resolveSidePanel(sbNode, 'right', worldZ, zonePrefix, sbWidth);
                    if (rightTarget?.node) {
                        const rightNode = rightTarget.node;
                        const rawD = rightNode.domainData.width ?? rightNode.domainData.depth ?? rightNode.domainData.length ?? 0;
                        const sideDepth = nmToMm(rawD) || sbDepth;
                        const face = rightTarget.face || 'FACE_Z_PLUS';

                        const localXWorld = rightNode.localMatrix ? rightNode.localMatrix.transformDirection(new Vec3(1, 0, 0)) : new Vec3(0, 1, 0);
                        const isRightOriented = localXWorld.y > 0.1;

                        const uFront = isRightOriented
                            ? Math.max(0, frontInset + offsetFront)
                            : Math.max(0, sideDepth - (frontInset + offsetFront));
                        const uBack = isRightOriented
                            ? Math.max(0, sideDepth - backInset)
                            : Math.max(0, backInset);
                        const vPos = getVForPanel(rightNode, worldZ);

                        intents.push({
                            targetNodeId: rightNode.id,
                            feature: {
                                id: `shelf_${i}_right_front${suffix}`,
                                type: 'hole',
                                face,
                                side: face,
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
                                face,
                                side: face,
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

                    // 3–4. Otwory środkowe przód/tył
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

        // ─── B. WZORZEC SYSTEM 32 ───────────────────────────────────────────
        if (holePattern === 'SYSTEM_32' || holePattern === 'ROW') {
            const totalHoles = sys32HoleCount > 0 ? sys32HoleCount : 10;

            for (let k = 0; k < totalHoles; k++) {
                const localZ = sys32StartOffset + k * sys32Spacing;
                if (localZ > sbHeight - 10) break;
                const worldZ = sbBottomZ + localZ;

                // 1. Lewa strona
                const leftTarget = resolveSidePanel(sbNode, 'left', worldZ, zonePrefix, sbWidth);
                if (leftTarget?.node) {
                    const leftNode = leftTarget.node;
                    const rawD = leftNode.domainData.width ?? leftNode.domainData.depth ?? leftNode.domainData.length ?? 0;
                    const sideDepth = nmToMm(rawD) || sbDepth;
                    const face = leftTarget.face || 'FACE_Z_PLUS';

                    const localXWorld = leftNode.localMatrix ? leftNode.localMatrix.transformDirection(new Vec3(1, 0, 0)) : new Vec3(0, -1, 0);
                    const isRightOriented = localXWorld.y > 0.1;

                    const uFront = isRightOriented
                        ? Math.max(0, frontInset + offsetFront)
                        : Math.max(0, sideDepth - (frontInset + offsetFront));
                    const uBack = isRightOriented
                        ? Math.max(0, sideDepth - backInset)
                        : Math.max(0, backInset);
                    const vPos = getVForPanel(leftNode, worldZ);

                    intents.push({
                        targetNodeId: leftNode.id,
                        feature: {
                            id: `sys32_left_front_${k}`,
                            type: 'hole',
                            face,
                            side: face,
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
                            face,
                            side: face,
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

                // 2. Prawa strona
                const rightTarget = resolveSidePanel(sbNode, 'right', worldZ, zonePrefix, sbWidth);
                if (rightTarget?.node) {
                    const rightNode = rightTarget.node;
                    const rawD = rightNode.domainData.width ?? rightNode.domainData.depth ?? rightNode.domainData.length ?? 0;
                    const sideDepth = nmToMm(rawD) || sbDepth;
                    const face = rightTarget.face || 'FACE_Z_PLUS';

                    const localXWorld = rightNode.localMatrix ? rightNode.localMatrix.transformDirection(new Vec3(1, 0, 0)) : new Vec3(0, 1, 0);
                    const isRightOriented = localXWorld.y > 0.1;

                    const uFront = isRightOriented
                        ? Math.max(0, frontInset + offsetFront)
                        : Math.max(0, sideDepth - (frontInset + offsetFront));
                    const uBack = isRightOriented
                        ? Math.max(0, sideDepth - backInset)
                        : Math.max(0, backInset);
                    const vPos = getVForPanel(rightNode, worldZ);

                    intents.push({
                        targetNodeId: rightNode.id,
                        feature: {
                            id: `sys32_right_front_${k}`,
                            type: 'hole',
                            face,
                            side: face,
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
                            face,
                            side: face,
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
