/**
 * doors-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu DRZWI.
 * Rzutuje otwory prowadników zawiasów ze Bloku na formatki graniczne (bok / przegroda).
 * Brak sztywnego szukania po rolach — pełne wsparcie customReferences i geometrii.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import type { DoorsDrillingIntent, DoorsDrillingFace } from './05_doors-drilling-intent.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { DEFAULT_HINGE_ID, hingeCorpusHolesMm, hingeTemplateId, isParallelHinge, resolveHingeMounting } from '../B1_biblioteka/index.js';
import { normalizeDoorsParams } from './05_doors-engine.js';
import { computeFaceData, calcFaceUFromFront, PANEL_FACE_NAMES } from '../A4_smartpanel/native_core/face-lcs.js';
import type { FaceName } from '../A4_smartpanel/panel-model.js';

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

    // 2. Znajdź wszystkie aktywne kontenery Bloki z drzwiami
    const sbContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        if (!p || (p.type !== 'blok_doors' && p.boxType !== 'DOORS') || c.frozen || c.domainData?.frozen === true) return false;
        if (cabinetContainerId) {
            return p.parentContainerId === cabinetNode.id || c.parent?.id === cabinetNode.id || isChildOfCabinet(c);
        }
        return true;
    });

    if (sbContainers.length === 0) return intents;

    // 3. Zbierz wszystkie formatki korpusu (wykluczając sam kontener korpusu) — fallback geometryczny
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

    const getPanelCabinetX = (node: any): number => getNodeCabinetPosMm(node).x;

    const isVerticalSidePanel = (pNode: any) => {
        const role = (pNode.domainData?.role || '').toUpperCase();
        if (role.includes('SIDE') || role.includes('PARTITION') || role.includes('BOK') || role.includes('PRZEGRODA')) return true;
        if (pNode.localMatrix) {
            const dirY = Math.abs(pNode.localMatrix.transformDirection(new Vec3(1, 0, 0)).y);
            return dirY > 0.5;
        }
        return true;
    };

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

    /**
     * Wyszukuje formatkę, do której przylega lewa lub prawa ścianka Bloku.
     * Czysta relacja: customReferences (priorytet) -> boundary wnęki -> fallback geometryczny.
     * Brak sprawdzania ról ani nazw paneli.
     */
    const resolveSidePanel = (
        sbNode: any,
        side: 'left' | 'right',
        worldZ?: number
    ): { node: any; suggestedFace?: string | null } | null => {
        const p = sbNode.domainData?.generatorParams || {};
        const ref = side === 'left' ? p.customReferences?.xMin : p.customReferences?.xMax;

        // Priorytet 1: customReferences
        if (ref?.panelId) {
            const node = document.findNode(ref.panelId);
            if (node && node.domainData && node.domainData.type !== 'container') {
                return { node, suggestedFace: ref.face };
            }
        }

        // Priorytet 2: boundary references
        const boundaryRef = side === 'left' ? p.boundary?.left : p.boundary?.right;
        if (boundaryRef?.nodeId) {
            const node = document.findNode(boundaryRef.nodeId);
            if (node && node.domainData && node.domainData.type !== 'container') {
                return { node, suggestedFace: boundaryRef.face };
            }
        }

        // Priorytet 3: fallback geometryczny po panelach korpusu
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
     * Dobiera właściwą płaszczyznę montażową na formatce w oparciu o TYP ZAWIASU (równoległy vs standardowy).
     * Pobiera bezpośrednio ścianę styku formatki ze Blokiem (lub FACE_Z_PLUS dla zawiasu równoległego).
     */
    const findTargetHingeFace = (
        node: any,
        isParallel: boolean,
        suggestedFace?: string | null
    ): { face: DoorsDrillingFace; width: number; height: number } | null => {
        if (!node?.domainData) return null;
        const pw = nmToMm(node.domainData.width || 0);
        const ph = nmToMm(node.domainData.height || 0);
        const pt = nmToMm(node.domainData.thickness || 0);

        if (isParallel) {
            // Zawias równoległy: lico czołowe formatki styku (FACE_Z_PLUS)
            const targetFace = 'FACE_Z_PLUS';
            const fd = computeFaceData(targetFace, pw, ph, pt);
            if (fd.width >= 50 && fd.height >= 50) {
                return { face: targetFace, width: fd.width, height: fd.height };
            }
            return null;
        }

        // Zawias standardowy: bierzemy bezpośrednio ścianę styku formatki ze Blokiem
        const targetFace = (suggestedFace && PANEL_FACE_NAMES.includes(suggestedFace as FaceName))
            ? suggestedFace
            : 'FACE_Z_PLUS';

        const fd = computeFaceData(targetFace, pw, ph, pt);
        if (fd.width >= 50 && fd.height >= 50) {
            return { face: targetFace as DoorsDrillingFace, width: fd.width, height: fd.height };
        }
        return null;
    };

    // 4. Dla każdego Bloku z drzwiami wylicz nawiercenia prowadników
    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};

        const sbWidth = nmToMm(sbData.width);
        const sbHeight = nmToMm(sbData.height);
        const sbDepth = nmToMm(sbData.depth);

        const sbWorldPos = sbNode.getWorldMatrix().decompose().translation;
        const sbPosZ = nmToMm(sbWorldPos.z);

        const normalized = normalizeDoorsParams(p, {
            width_mm: sbWidth,
            height_mm: sbHeight,
            depth_mm: sbDepth
        });

        const hinges = normalized.aktywne_zawiasy;
        const isLeftActive = normalized.rodzaj_drzwi === 'LEFT' || normalized.rodzaj_drzwi === 'DOUBLE';
        const isRightActive = normalized.rodzaj_drzwi === 'RIGHT' || normalized.rodzaj_drzwi === 'DOUBLE';

        const resolveHingeId = (index: number): string => {
            if (normalized.szablony_zawiasow[index]) {
                return normalized.szablony_zawiasow[index];
            }
            if (normalized.domyslny_zawias_id === 'BLUM_71B3550' || normalized.domyslny_zawias_id === 'BLUM_71T3550') {
                return (index % 2 === 1) ? 'BLUM_71B3550' : 'BLUM_71T3550';
            }
            if (normalized.domyslny_zawias_id === 'BLUM_79B9550' || normalized.domyslny_zawias_id === 'BLUM_79T9550') {
                return (index % 2 === 1) ? 'BLUM_79B9550' : 'BLUM_79T9550';
            }
            return normalized.domyslny_zawias_id;
        };

        for (const hinge of hinges) {
            const worldCenterZ = sbPosZ + hinge.pozycja_lokalna_z_mm;
            const hingeId = resolveHingeId(hinge.index);
            const corpusHoles = hingeCorpusHolesMm(hingeId, normalized.typ_prowadnika);
            const templateId = hingeTemplateId(hingeId);

            // ─── 1. BOK / PRZEGRODA PO LEWEJ STRONIE ──────────────────────────
            if (isLeftActive) {
                const leftTarget = resolveSidePanel(sbNode, 'left', worldCenterZ);
                if (leftTarget?.node) {
                    const leftNode = leftTarget.node;
                    const leftOverlay = normalized.nalozenie_lewe_mm;
                    const leftMount = resolveHingeMounting({ hingeId, overlay_mm: leftOverlay });
                    const isParallel = isParallelHinge(hingeId);
                    const targetFace = findTargetHingeFace(leftNode, isParallel, leftTarget.suggestedFace);

                    if (targetFace) {
                        for (const hole of corpusHoles) {
                            const uPos = isParallel
                                ? (targetFace.width - hole.frontDist)
                                : calcFaceUFromFront(leftNode, targetFace.face, targetFace.width, hole.frontDist, 'left');
                            const vPos = getVForPanel(leftNode, worldCenterZ + hole.zOffset);

                            // Twarde zabezpieczenie: otwór musi fizycznie mieścić się na płaszczyźnie płyty
                            if (uPos <= 0 || uPos >= targetFace.width || vPos <= 0 || vPos >= targetFace.height) {
                                continue;
                            }

                            intents.push(buildHoleMachiningIntent({
                                targetNodeId: leftNode.id,
                                id: `hinge_plate_l_${hinge.index}_${hole.name || 'h'}`,
                                face: targetFace.face,
                                side: targetFace.face,
                                template_id: templateId,
                                drivenBy: {
                                    nodeId: `${sbNode.id}_hinge_left_${hinge.index}`,
                                    role: 'HARDWARE',
                                    hardwareType: 'HINGE',
                                    partKey: `Hinge_L${hinge.index}`,
                                    containerId: sbNode.id,
                                },
                                rule: 'mount_plate',
                                generatedBy: 'blok_doors',
                                u: uPos,
                                v: vPos,
                                diameter: hole.dia,
                                depth: hole.depth,
                                ownerTag: 'isDoorDrilling',
                                sourceContainerId: sbNode.id,
                                sourcePartId: `Hinge_L${hinge.index}`,
                                extraParams: {
                                    template_id: templateId,
                                    hinge_id: hingeId,
                                    plate_id: normalized.typ_prowadnika,
                                    plate_height_mm: normalized.typ_prowadnika === '173L6130' ? 3 : (normalized.typ_prowadnika ? 0 : leftMount.plate_height_mm),
                                    plate_part_name: normalized.typ_prowadnika || leftMount.plate_part_name,
                                    isCorpusHole: true,
                                    isHingeDrilling: true,
                                    isDoorDrilling: true,
                                },
                            }));
                        }
                    }
                }
            }

            // ─── 2. BOK / PRZEGRODA PO PRAWEJ STRONIE ─────────────────────────
            if (isRightActive) {
                const rightTarget = resolveSidePanel(sbNode, 'right', worldCenterZ);
                if (rightTarget?.node) {
                    const rightNode = rightTarget.node;
                    const rightOverlay = normalized.nalozenie_prawe_mm;
                    const rightMount = resolveHingeMounting({ hingeId, overlay_mm: rightOverlay });
                    const isParallel = isParallelHinge(hingeId);
                    const targetFace = findTargetHingeFace(rightNode, isParallel, rightTarget.suggestedFace);

                    if (targetFace) {
                        for (const hole of corpusHoles) {
                            const uPos = isParallel
                                ? hole.frontDist
                                : calcFaceUFromFront(rightNode, targetFace.face, targetFace.width, hole.frontDist, 'right');
                            const vPos = getVForPanel(rightNode, worldCenterZ + hole.zOffset);

                            // Twarde zabezpieczenie: otwór musi fizycznie mieścić się na płaszczyźnie płyty
                            if (uPos <= 0 || uPos >= targetFace.width || vPos <= 0 || vPos >= targetFace.height) {
                                continue;
                            }

                            intents.push(buildHoleMachiningIntent({
                                targetNodeId: rightNode.id,
                                id: `hinge_plate_r_${hinge.index}_${hole.name || 'h'}`,
                                face: targetFace.face,
                                side: targetFace.face,
                                template_id: templateId,
                                drivenBy: {
                                    nodeId: `${sbNode.id}_hinge_right_${hinge.index}`,
                                    role: 'HARDWARE',
                                    hardwareType: 'HINGE',
                                    partKey: `Hinge_R${hinge.index}`,
                                    containerId: sbNode.id,
                                },
                                rule: 'mount_plate',
                                generatedBy: 'blok_doors',
                                u: uPos,
                                v: vPos,
                                diameter: hole.dia,
                                depth: hole.depth,
                                ownerTag: 'isDoorDrilling',
                                sourceContainerId: sbNode.id,
                                sourcePartId: `Hinge_R${hinge.index}`,
                                extraParams: {
                                    template_id: templateId,
                                    hinge_id: hingeId,
                                    plate_id: normalized.typ_prowadnika,
                                    plate_height_mm: normalized.typ_prowadnika === '173L6130' ? 3 : (normalized.typ_prowadnika ? 0 : rightMount.plate_height_mm),
                                    plate_part_name: normalized.typ_prowadnika || rightMount.plate_part_name,
                                    isCorpusHole: true,
                                    isHingeDrilling: true,
                                    isDoorDrilling: true,
                                },
                            }));
                        }
                    }
                }
            }
        }
    }

    return intents;
}
