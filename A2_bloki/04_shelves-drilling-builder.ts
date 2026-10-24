/**
 * shelves-drilling-builder.ts
 *
 * Nawiercenia modułu PÓŁKI (blok_shelves).
 * Rzutuje otwory na boki / przegrody graniczne korpusu.
 * Pełne wsparcie customReferences i geometrii — zero sztywnych ról.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ShelvesDrillingIntent, ShelvesDrillingFeature } from './04_shelves-drilling-intent.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { equalShelfCenterZ, normalizeShelvesParams } from './04_shelves-engine.js';
import { computeFaceData, PANEL_FACE_NAMES, calcFaceUFromFront, calcFaceUFromBack } from '../A4_smartpanel/native_core/face-lcs.js';
import type { FaceName } from '../A4_smartpanel/panel-model.js';
import { getShelfPinOrDefault } from '../B1_biblioteka/index.js';

export function buildShelvesDrillings(document: ProjectDocument, cabinetContainerId?: string): ShelvesDrillingIntent[] {
    const intents: ShelvesDrillingIntent[] = [];
    if (!document) return intents;

    const containers = typeof document.getContainers === 'function' ? document.getContainers() : [];
    
    // 1. Znajdź główny korpus (cabinet)
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

    // 2. Znajdź wszystkie aktywne kontenery Bloki z półkami
    const sbContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        if (!p || p.type !== 'blok_shelves' || c.domainData?.visible === false) return false;
        if (cabinetContainerId) {
            return p.parentContainerId === cabinetNode.id || c.parent?.id === cabinetNode.id || isChildOfCabinet(c);
        }
        return true;
    });

    if (sbContainers.length === 0) return intents;

    // 3. Zbierz wszystkie formatki korpusu (wykluczając sam kontener korpusu)
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

    const getPanelWorldZ = (node: any): number => {
        const worldPos = node.getWorldMatrix().decompose().translation;
        return nmToMm(worldPos.z);
    };

    /** Wysokość V na bokach (oś pionowa = world Z). */
    const getVForPanel = (targetNode: any, worldZ: number): number => {
        if (!targetNode) return worldZ;
        const dd = targetNode.domainData;
        const rawH = (dd?.height && dd.height > 0) ? dd.height : (dd?.length || dd?.width || 0);
        const targetHeight = nmToMm(rawH);
        const targetCenterZ = getPanelWorldZ(targetNode);
        const targetBottomZ = targetCenterZ - targetHeight / 2;
        return worldZ - targetBottomZ;
    };

    const findShelfPanel = (sbNode: any, shelfIndex: number): any | null => {
        for (const child of sbNode?.children || []) {
            const d = child.domainData;
            if (d && (d.name === `Polka_${shelfIndex}` || child.name === `Polka_${shelfIndex}`)) return child;
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
        worldZ?: number,
        zonePrefix?: string
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

        // Gdy brak referencji w Bloku, znajdź boczny panel korpusu dotykający Bloku na wysokości worldZ lub w strefie zonePrefix
        if (allCabinetPanels.length > 0) {
            const sbWidth = nmToMm(sbNode.domainData?.width || 0);
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
                    if (h > 0 && (worldZ !== undefined && (worldZ < pZMin - 10 || worldZ > pZMax + 10))) return false;

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

            return { node: candidates[0], suggestedFace: 'FACE_Z_PLUS' };
        }

        return null;
    };

    /**
     * Dobiera płaszczyznę montażową podpórek półki ze ściany styku formatki ze Blokiem.
     * Wymaga minimalnego wymiaru 50mm, zabezpieczając przed wierceniem w powietrzu na wąskich krawędziach.
     */
    const findTargetSideFace = (
        node: any,
        side: 'left' | 'right',
        suggestedFace?: string | null
    ): { face: ShelvesDrillingFeature['face']; width: number; height: number } | null => {
        if (!node?.domainData) return null;
        const pw = nmToMm(node.domainData.width || 0);
        const ph = nmToMm(node.domainData.height || node.domainData.length || 0);
        const pt = nmToMm(node.domainData.thickness || 0);

        const targetFace = (suggestedFace && PANEL_FACE_NAMES.includes(suggestedFace as FaceName))
            ? suggestedFace
            : 'FACE_Z_PLUS';

        const fd = computeFaceData(targetFace, pw, ph, pt);
        if (fd.width >= 50 && fd.height >= 50) {
            return { face: targetFace as ShelvesDrillingFeature['face'], width: fd.width, height: fd.height };
        }
        return null;
    };


    // 4. Dla każdego Bloku wylicz nawiercenia na formatkach korpusu
    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};

        const sbWidth = nmToMm(sbData.width);
        const sbHeight = nmToMm(sbData.height);
        const sbDepth = nmToMm(sbData.depth);

        const norm = normalizeShelvesParams(p, { width_mm: sbWidth, height_mm: sbHeight, depth_mm: sbDepth });

        // Parametry Bloku
        const count = norm.liczba_polek;
        const holePattern = norm.wzor_nawiercen;
        if (holePattern === 'NONE') continue;

        const zonePrefix = getZonePrefix(p.targetZone || 'B');

        const offsetFront = norm.odsuniecie_przod_mm;
        const offsetSide = norm.luz_boczny_mm;
        const frontInset = norm.odstep_otworow_przod_mm;
        const backInset = norm.odstep_otworow_tyl_mm;
        const frontHoles = norm.otwory_przod_aktywne;
        const frontOffsetX = norm.przesuniecie_otworow_przod_x_mm;
        const backHoles = norm.otwory_tyl_aktywne;
        const backOffsetX = norm.przesuniecie_otworow_tyl_x_mm;
        const tripleZOffset = norm.rozstaw_potrojny_z_mm;
        const sys32Spacing = norm.rozstaw_system32_mm;
        const sys32StartOffset = norm.start_system32_z_mm;
        const sys32HoleCount = norm.liczba_otworow_system32;

        const pinItem = getShelfPinOrDefault(norm.podporka_id);
        const firstCorpusHole = pinItem.machining?.corpus_holes?.[0];
        const holeDiameter = firstCorpusHole?.dia ?? 5;
        const holeDepth = firstCorpusHole?.depth ?? 11;
        const shelfThickness = norm.grubosc_polki_mm;
        const radius = holeDiameter / 2;

        const sbNodeResolved = typeof document.findNode === 'function' ? document.findNode(sbNode.id) : sbNode;
        let sbBottomZ = getPanelWorldZ(sbNodeResolved || sbNode);
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
                if (bpRawTh === undefined || isNaN(bpRawTh)) {
                    throw new Error(
                        `[shelves-drilling-builder] Brak zdefiniowanej grubości dla formatki dolnej (${bottomPanel.id}). ` +
                        `CAD wymaga jawnych danych grubości bez sztywnego zgadywania.`
                    );
                }
                const bpThickness = bpRawTh;
                sbBottomZ = bpCenterZ + bpThickness / 2;
            }
        } else if (Math.abs(sbBottomZ) < 0.001 && zonePrefix && zonePrefix !== 'FULL') {
            const zonePanel = allCabinetPanels.find(pn => isPanelMatchingZone(pn, zonePrefix));
            if (zonePanel) {
                const rawH = zonePanel.domainData?.length ?? zonePanel.domainData?.height ?? zonePanel.domainData?.width ?? 0;
                const panelH = nmToMm(rawH);
                const panelCenterZ = getPanelWorldZ(zonePanel);
                sbBottomZ = panelCenterZ - panelH / 2;
            }
        }
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
            intents.push(buildHoleMachiningIntent({
                targetNodeId: shelfNode.id,
                id: `shelf_${shelfIndex}_${kind}_center${suffix}`,
                face,
                side: face,
                template_id: 'SINGLE',
                drivenBy: {
                    nodeId: shelfNode.id,
                    role: 'SHELF_PANEL',
                    partKey: `Polka_${shelfIndex}`,
                    containerId: sbNode.id,
                },
                rule: 'shelf_socket',
                generatedBy: 'blok_shelves',
                u: uCenter,
                v: vPos,
                diameter: holeDiameter,
                depth: holeDepth,
                clearance,
                ownerTag: 'isShelfDrilling',
                sourceContainerId: sbNode.id,
                sourcePartId: `Polka_${shelfIndex}`,
            }));
        };

        // ─── A. WZORZEC SINGLE / TRIPLE DLA PÓŁEK ──────────────────────────────
        if ((holePattern === 'SINGLE' || holePattern === 'TRIPLE') && count > 0 && sbHeight > 0) {
            for (let i = 1; i <= count; i++) {
                const shelfNode = findShelfPanel(sbNodeResolved || sbNode, i);
                let shelfWorldZ: number;
                let actualShelfThickness = shelfThickness;

                if (shelfNode) {
                    const rawShelfWorldZ = getPanelWorldZ(shelfNode);
                    if (rawShelfWorldZ > 0.1) {
                        shelfWorldZ = rawShelfWorldZ;
                    } else {
                        const shelfCenterZ = equalShelfCenterZ(sbHeight, count, shelfThickness, i);
                        shelfWorldZ = sbBottomZ + shelfCenterZ;
                    }
                    if (shelfNode.domainData?.thickness) {
                        actualShelfThickness = nmToMm(shelfNode.domainData.thickness);
                    }
                } else {
                    const shelfCenterZ = equalShelfCenterZ(sbHeight, count, shelfThickness, i);
                    shelfWorldZ = sbBottomZ + shelfCenterZ;
                }

                // Otwór bezpośrednio pod półką: od pozycji półki odjąć pół grubości półki oraz pół średnicy otworu
                const shelfHoleZ = shelfWorldZ - (actualShelfThickness / 2) - radius;
                const shelfDrivenBy = {
                    nodeId: shelfNode ? shelfNode.id : sbNode.id,
                    role: 'SHELF_PANEL',
                    partKey: `Polka_${i}`,
                    containerId: sbNode.id,
                };

                // Wysokości otworów w world Z (dla opcji potrójnej dodać na górze i dole otwory)
                const worldZPositions = [shelfHoleZ];
                if (holePattern === 'TRIPLE') {
                    worldZPositions.push(shelfHoleZ + tripleZOffset);
                    worldZPositions.push(shelfHoleZ - tripleZOffset);
                }

                for (let idx = 0; idx < worldZPositions.length; idx++) {
                    const worldZ = worldZPositions[idx];
                    const suffix = idx === 0 ? '' : (idx === 1 ? '_top' : '_bottom');

                    // 1. Bok / Przegroda Lewa
                    const leftTarget = resolveSidePanel(sbNode, 'left', worldZ, zonePrefix);
                    const leftFaceInfo = leftTarget?.node ? findTargetSideFace(leftTarget.node, 'left', leftTarget.suggestedFace) : null;
                    if (leftTarget?.node && leftFaceInfo) {
                        const leftNode = leftTarget.node;
                        const face = leftFaceInfo.face;

                        const uFront = calcFaceUFromFront(leftNode, face, leftFaceInfo.width, frontInset + offsetFront, 'left');
                        const uBack = calcFaceUFromBack(leftNode, face, leftFaceInfo.width, backInset, 'left');
                        const vPos = getVForPanel(leftNode, worldZ);

                        if (uFront > 0 && uFront < leftFaceInfo.width && vPos > 0 && vPos < leftFaceInfo.height) {
                            intents.push(buildHoleMachiningIntent({
                                targetNodeId: leftNode.id,
                                id: `shelf_${i}_left_front${suffix}`,
                                face,
                                side: face,
                                template_id: 'SINGLE',
                                drivenBy: shelfDrivenBy,
                                rule: 'shelf_pin',
                                generatedBy: 'blok_shelves',
                                u: uFront,
                                v: vPos,
                                diameter: holeDiameter,
                                depth: holeDepth,
                                ownerTag: 'isShelfDrilling',
                                sourceContainerId: sbNode.id,
                                sourcePartId: `Polka_${i}`,
                            }));
                        }

                        if (uBack > 0 && uBack < leftFaceInfo.width && vPos > 0 && vPos < leftFaceInfo.height) {
                            intents.push(buildHoleMachiningIntent({
                                targetNodeId: leftNode.id,
                                id: `shelf_${i}_left_back${suffix}`,
                                face,
                                side: face,
                                template_id: 'SINGLE',
                                drivenBy: shelfDrivenBy,
                                rule: 'shelf_pin',
                                generatedBy: 'blok_shelves',
                                u: uBack,
                                v: vPos,
                                diameter: holeDiameter,
                                depth: holeDepth,
                                ownerTag: 'isShelfDrilling',
                                sourceContainerId: sbNode.id,
                                sourcePartId: `Polka_${i}`,
                            }));
                        }
                    }

                    // 2. Bok / Przegroda Prawa
                    const rightTarget = resolveSidePanel(sbNode, 'right', worldZ, zonePrefix);
                    const rightFaceInfo = rightTarget?.node ? findTargetSideFace(rightTarget.node, 'right', rightTarget.suggestedFace) : null;
                    if (rightTarget?.node && rightFaceInfo) {
                        const rightNode = rightTarget.node;
                        const face = rightFaceInfo.face;

                        const uFront = calcFaceUFromFront(rightNode, face, rightFaceInfo.width, frontInset + offsetFront, 'right');
                        const uBack = calcFaceUFromBack(rightNode, face, rightFaceInfo.width, backInset, 'right');
                        const vPos = getVForPanel(rightNode, worldZ);


                        if (uFront > 0 && uFront < rightFaceInfo.width && vPos > 0 && vPos < rightFaceInfo.height) {
                            intents.push(buildHoleMachiningIntent({
                                targetNodeId: rightNode.id,
                                id: `shelf_${i}_right_front${suffix}`,
                                face,
                                side: face,
                                template_id: 'SINGLE',
                                drivenBy: shelfDrivenBy,
                                rule: 'shelf_pin',
                                generatedBy: 'blok_shelves',
                                u: uFront,
                                v: vPos,
                                diameter: holeDiameter,
                                depth: holeDepth,
                                ownerTag: 'isShelfDrilling',
                                sourceContainerId: sbNode.id,
                                sourcePartId: `Polka_${i}`,
                            }));
                        }

                        if (uBack > 0 && uBack < rightFaceInfo.width && vPos > 0 && vPos < rightFaceInfo.height) {
                            intents.push(buildHoleMachiningIntent({
                                targetNodeId: rightNode.id,
                                id: `shelf_${i}_right_back${suffix}`,
                                face,
                                side: face,
                                template_id: 'SINGLE',
                                drivenBy: shelfDrivenBy,
                                rule: 'shelf_pin',
                                generatedBy: 'blok_shelves',
                                u: uBack,
                                v: vPos,
                                diameter: holeDiameter,
                                depth: holeDepth,
                                ownerTag: 'isShelfDrilling',
                                sourceContainerId: sbNode.id,
                                sourcePartId: `Polka_${i}`,
                            }));
                        }
                    }

                }

                // 3–4. Otwory środkowe przód/tył na krawędzi półki (FACE_Y):
                // U = szerokość (poziom), V = grubość/pion — TRIPLE tylko po V (nie w pętli worldZ boków).
                if (shelfNode && (frontHoles || backHoles)) {
                    const shelfWidth = nmToMm(shelfNode.domainData.width || effectiveWidth);
                    const uCenterBase = shelfWidth / 2;

                    if (frontHoles) {
                        const uFront = uCenterBase + frontOffsetX;
                        const vUnderFront = actualShelfThickness + radius;
                        const vFrontPositions = [vUnderFront];
                        if (holePattern === 'TRIPLE') {
                            vFrontPositions.push(vUnderFront - tripleZOffset);
                            vFrontPositions.push(vUnderFront + tripleZOffset);
                        }
                        for (let vi = 0; vi < vFrontPositions.length; vi++) {
                            const vSuffix = vi === 0 ? '' : (vi === 1 ? '_top' : '_bottom');
                            pushShelfCenterHole(
                                shelfNode, i, 'front', vSuffix,
                                uFront, vFrontPositions[vi], offsetFront
                            );
                        }
                    }

                    if (backHoles) {
                        const uBack = uCenterBase + backOffsetX;
                        const vUnderBack = -radius;
                        const vBackPositions = [vUnderBack];
                        if (holePattern === 'TRIPLE') {
                            // FACE_Y_MINUS: V rośnie w przeciwną stronę względem przodu
                            vBackPositions.push(vUnderBack + tripleZOffset);
                            vBackPositions.push(vUnderBack - tripleZOffset);
                        }
                        for (let vi = 0; vi < vBackPositions.length; vi++) {
                            const vSuffix = vi === 0 ? '' : (vi === 1 ? '_top' : '_bottom');
                            pushShelfCenterHole(
                                shelfNode, i, 'back', vSuffix,
                                uBack, vBackPositions[vi], 0
                            );
                        }
                    }
                }
            }
        }

        // ─── B. WZORZEC SYSTEM 32 ───────────────────────────────────────────
        if (holePattern === 'SYSTEM_32' || holePattern === 'ROW') {
            const totalHoles = sys32HoleCount > 0 ? sys32HoleCount : 10;
            const sys32DrivenBy = {
                nodeId: sbNode.id,
                role: 'SYSTEM_HOLES',
                partKey: 'System_32',
                containerId: sbNode.id,
            };

            for (let k = 0; k < totalHoles; k++) {
                const localZ = sys32StartOffset + k * sys32Spacing;
                if (localZ > sbHeight - 10) break;
                const worldZ = sbBottomZ + localZ;

                // 1. Lewa strona
                const leftTarget = resolveSidePanel(sbNode, 'left', worldZ, zonePrefix);
                const leftFaceInfo = leftTarget?.node ? findTargetSideFace(leftTarget.node, 'left', leftTarget.suggestedFace) : null;
                if (leftTarget?.node && leftFaceInfo) {
                    const leftNode = leftTarget.node;
                    const face = leftFaceInfo.face;

                    const uFront = calcFaceUFromFront(leftNode, face, leftFaceInfo.width, frontInset + offsetFront, 'left');
                    const uBack = calcFaceUFromBack(leftNode, face, leftFaceInfo.width, backInset, 'left');
                    const vPos = getVForPanel(leftNode, worldZ);

                    if (uFront > 0 && uFront < leftFaceInfo.width && vPos > 0 && vPos < leftFaceInfo.height) {
                        intents.push(buildHoleMachiningIntent({
                            targetNodeId: leftNode.id,
                            id: `sys32_left_front_${k}`,
                            face,
                            side: face,
                            template_id: 'SINGLE',
                            drivenBy: sys32DrivenBy,
                            rule: 'shelf_pin',
                            generatedBy: 'blok_shelves',
                            u: uFront,
                            v: vPos,
                            diameter: holeDiameter,
                            depth: holeDepth,
                            ownerTag: 'isShelfDrilling',
                            sourceContainerId: sbNode.id,
                            sourcePartId: 'System_32',
                        }));
                    }

                    if (uBack > 0 && uBack < leftFaceInfo.width && vPos > 0 && vPos < leftFaceInfo.height) {
                        intents.push(buildHoleMachiningIntent({
                            targetNodeId: leftNode.id,
                            id: `sys32_left_back_${k}`,
                            face,
                            side: face,
                            template_id: 'SINGLE',
                            drivenBy: sys32DrivenBy,
                            rule: 'shelf_pin',
                            generatedBy: 'blok_shelves',
                            u: uBack,
                            v: vPos,
                            diameter: holeDiameter,
                            depth: holeDepth,
                            ownerTag: 'isShelfDrilling',
                            sourceContainerId: sbNode.id,
                            sourcePartId: 'System_32',
                        }));
                    }
                }

                // 2. Prawa strona
                const rightTarget = resolveSidePanel(sbNode, 'right', worldZ, zonePrefix);
                const rightFaceInfo = rightTarget?.node ? findTargetSideFace(rightTarget.node, 'right', rightTarget.suggestedFace) : null;
                if (rightTarget?.node && rightFaceInfo) {
                    const rightNode = rightTarget.node;
                    const face = rightFaceInfo.face;

                    const uFront = calcFaceUFromFront(rightNode, face, rightFaceInfo.width, frontInset + offsetFront, 'right');
                    const uBack = calcFaceUFromBack(rightNode, face, rightFaceInfo.width, backInset, 'right');
                    const vPos = getVForPanel(rightNode, worldZ);

                    if (uFront > 0 && uFront < rightFaceInfo.width && vPos > 0 && vPos < rightFaceInfo.height) {
                        intents.push(buildHoleMachiningIntent({
                            targetNodeId: rightNode.id,
                            id: `sys32_right_front_${k}`,
                            face,
                            side: face,
                            template_id: 'SINGLE',
                            drivenBy: sys32DrivenBy,
                            rule: 'shelf_pin',
                            generatedBy: 'blok_shelves',
                            u: uFront,
                            v: vPos,
                            diameter: holeDiameter,
                            depth: holeDepth,
                            ownerTag: 'isShelfDrilling',
                            sourceContainerId: sbNode.id,
                            sourcePartId: 'System_32',
                        }));
                    }

                    if (uBack > 0 && uBack < rightFaceInfo.width && vPos > 0 && vPos < rightFaceInfo.height) {
                        intents.push(buildHoleMachiningIntent({
                            targetNodeId: rightNode.id,
                            id: `sys32_right_back_${k}`,
                            face,
                            side: face,
                            template_id: 'SINGLE',
                            drivenBy: sys32DrivenBy,
                            rule: 'shelf_pin',
                            generatedBy: 'blok_shelves',
                            u: uBack,
                            v: vPos,
                            diameter: holeDiameter,
                            depth: holeDepth,
                            ownerTag: 'isShelfDrilling',
                            sourceContainerId: sbNode.id,
                            sourcePartId: 'System_32',
                        }));
                    }
                }

            }
        }
    }

    return intents;
}
