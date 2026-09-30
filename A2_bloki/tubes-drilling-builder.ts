/**
 * tubes-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu DRĄŻEK (TUBES).
 * Rzutuje otwory rozet drążka (TUBE_HOLDER_DRILLING fi 3.5x12, rozstaw 32mm)
 * oraz opcjonalne podpórki półki nad drążkiem na formatki graniczne (bok / przegroda).
 * Brak sztywnego szukania po rolach — pełne wsparcie customReferences, boundary i geometrii.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { TubesDrillingIntent, TubesDrillingFeature } from './tubes-drilling-intent.js';
import { nmToMm, rulesMToMm } from '../A1_core/cad-math/units.js';
import { normalizeTubesParams } from './tubes-engine.js';
import { computeFaceData, calcFaceUFromFront, calcFaceUFromBack, PANEL_FACE_NAMES } from '../A4_smartpanel/native_core/face-lcs.js';
import type { FaceName } from '../A4_smartpanel/panel-model.js';
import tubesRules from './tubes_3_rules_V1.json';

function dimToMm(raw: number | undefined, fallback = 0): number {
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return fallback;
    return nmToMm(Number(raw));
}

export function buildTubesDrillings(document: ProjectDocument, cabinetContainerId?: string): TubesDrillingIntent[] {
    const intents: TubesDrillingIntent[] = [];
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

    // 2. Znajdź wszystkie aktywne kontenery Bloki z drążkiem
    const sbContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        return p && (p.type === 'blok_tubes' || p.boxType === 'TUBES') && c.domainData?.visible !== false;
    });

    if (sbContainers.length === 0) return intents;

    const allPanels = typeof document.getPanels === 'function' ? document.getPanels() : [];
    const allCabinetPanels = cabinetNode
        ? allPanels.filter((p: any) => p.parent?.id === cabinetNode.id || p.domainData?.cabinetId === cabinetNode.id)
        : allPanels;

    const getPanelWorldZ = (node: any): number => {
        const pos = node.getWorldMatrix().decompose().translation;
        return nmToMm(pos.z);
    };

    const getVForPanel = (targetNode: any, worldZ: number): number => {
        if (!targetNode) return worldZ;
        const d = targetNode.domainData as any;
        const rawH = d?.length ?? d?.height ?? d?.width ?? 0;
        const targetHeight = nmToMm(rawH);
        const targetBottomZ = getPanelWorldZ(targetNode) - targetHeight / 2;
        return worldZ - targetBottomZ;
    };

    const isVerticalSidePanel = (node: any): boolean => {
        if (!node) return false;
        const d = node.domainData as any;
        const role = String(d?.role || '');
        if (role === 'LEFT_SIDE_PANEL' || role === 'RIGHT_SIDE_PANEL' || role === 'PARTITION') return true;
        const w = nmToMm(d?.width || 0);
        const h = nmToMm(d?.height || d?.length || 0);
        const t = nmToMm(d?.thickness || 0);
        return h > 100 && w > 100 && t < 50;
    };

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
            if (node) {
                return { node, suggestedFace: ref.face };
            }
        }

        // Priorytet 2: boundary references
        const boundaryRef = side === 'left' ? p.boundary?.left : p.boundary?.right;
        if (boundaryRef?.nodeId) {
            const node = document.findNode(boundaryRef.nodeId);
            if (node) {
                return { node, suggestedFace: boundaryRef.face };
            }
        }

        // Priorytet 3: dopasowanie geometryczne
        const sbWidth = dimToMm(sbNode.domainData?.width, 600);
        const sbWorldPos = sbNode.getWorldMatrix().decompose().translation;
        const sbCenterX = nmToMm(sbWorldPos.x);
        const sbLeftX = sbCenterX - sbWidth / 2;
        const sbRightX = sbCenterX + sbWidth / 2;

        const candidates = allCabinetPanels.filter((pNode) => {
            if (!isVerticalSidePanel(pNode)) return false;
            const d = pNode.domainData as any;
            const rawH = d?.height ?? d?.length ?? d?.width ?? 0;
            const h = nmToMm(rawH);
            const centerZ = getPanelWorldZ(pNode);
            const pZMin = centerZ - h / 2;
            const pZMax = centerZ + h / 2;
            if (h > 0 && (worldZ !== undefined && (worldZ < pZMin - 10 || worldZ > pZMax + 10))) return false;

            const panelX = nmToMm(pNode.getWorldMatrix().decompose().translation.x);
            return side === 'left' ? (panelX <= sbCenterX + 5) : (panelX >= sbCenterX - 5);
        });

        if (candidates.length === 0) return null;

        const targetRefX = side === 'left' ? sbLeftX : sbRightX;
        candidates.sort((a, b) => {
            const distA = Math.abs(nmToMm(a.getWorldMatrix().decompose().translation.x) - targetRefX);
            const distB = Math.abs(nmToMm(b.getWorldMatrix().decompose().translation.x) - targetRefX);
            return distA - distB;
        });

        return { node: candidates[0], suggestedFace: 'FACE_Z_PLUS' };
    };

    const findTargetSideFace = (
        node: any,
        suggestedFace?: string | null
    ): { face: TubesDrillingFeature['face']; width: number; height: number } | null => {
        if (!node?.domainData) return null;
        const d = node.domainData as any;
        const pw = nmToMm(d.width || 0);
        const ph = nmToMm(d.height || d.length || 0);
        const pt = nmToMm(d.thickness || 0);

        const targetFace = (suggestedFace && PANEL_FACE_NAMES.includes(suggestedFace as FaceName))
            ? suggestedFace
            : 'FACE_Z_PLUS';

        const fd = computeFaceData(targetFace, pw, ph, pt);
        if (fd.width >= 50 && fd.height >= 50) {
            return { face: targetFace as TubesDrillingFeature['face'], width: fd.width, height: fd.height };
        }
        return null;
    };

    // Parametry otworów z reguł (lub domyślne fi 3.5x12)
    const holderHolesRule = (tubesRules as any).machining_library?.TUBE_HOLDER_DRILLING?.side_mount?.holes || [];
    const hole1Def = holderHolesRule[0] || { dia: 0.0035, depth: 0.012, pos: [-0.016, 0, 0] };
    const hole2Def = holderHolesRule[1] || { dia: 0.0035, depth: 0.012, pos: [0.016, 0, 0] };

    const holeDiameter = rulesMToMm(hole1Def.dia, 3.5);
    const holeDepth = rulesMToMm(hole1Def.depth, 12);
    const offsetHole1_mm = rulesMToMm(hole1Def.pos?.[0], -16);
    const offsetHole2_mm = rulesMToMm(hole2Def.pos?.[0], 16);

    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};

        const sbWidth = dimToMm(sbData.width, 600);
        const sbHeight = dimToMm(sbData.height, 720);
        const sbDepth = dimToMm(sbData.depth, 500);

        const norm = normalizeTubesParams(p, { width_mm: sbWidth, height_mm: sbHeight, depth_mm: sbDepth });
        const {
            odstep_gora_mm,
            pokaz_polke,
            przestrzen_nad_polka_mm,
            grubosc_polki_mm
        } = norm;

        // Wyznaczenie pozycji Z drążka i opcjonalnej półki w układzie wnęki
        let srodek_drazka_z_mm: number;
        let srodek_polki_z_mm: number | null = null;

        if (pokaz_polke) {
            srodek_polki_z_mm = sbHeight - przestrzen_nad_polka_mm - (grubosc_polki_mm / 2.0);
            srodek_drazka_z_mm = srodek_polki_z_mm - (grubosc_polki_mm / 2.0) - odstep_gora_mm;
        } else {
            srodek_drazka_z_mm = sbHeight - odstep_gora_mm;
        }

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
                const bpThick = nmToMm(bpData.thickness || 0);
                sbBottomZ = bpCenterZ + bpThick / 2;
            }
        }

        const rodWorldZ = sbBottomZ + srodek_drazka_z_mm;
        const rodCenterFromFront = sbDepth / 2;

        const leftTarget = resolveSidePanel(sbNode, 'left', rodWorldZ);
        const rightTarget = resolveSidePanel(sbNode, 'right', rodWorldZ);

        const sides: Array<{ target: typeof leftTarget; sideName: 'left' | 'right' }> = [
            { target: leftTarget, sideName: 'left' },
            { target: rightTarget, sideName: 'right' }
        ];

        for (const { target, sideName } of sides) {
            if (!target?.node) continue;
            const targetNode = target.node;
            const faceInfo = findTargetSideFace(targetNode, target.suggestedFace);
            if (!faceInfo) continue;

            // 1. Dwa otwory montażowe rozety drążka
            const offsets = [offsetHole1_mm, offsetHole2_mm];
            offsets.forEach((offsetMm, idx) => {
                const fromFront = rodCenterFromFront + offsetMm;
                const u = calcFaceUFromFront(targetNode, faceInfo.face, faceInfo.width, fromFront, sideName);
                const v = getVForPanel(targetNode, rodWorldZ);

                if (u > 0 && u < faceInfo.width && v > 0 && v < faceInfo.height) {
                    intents.push({
                        targetNodeId: targetNode.id,
                        feature: {
                            id: `tube_holder_${sideName}_${idx}_${sbNode.id}`,
                            type: 'hole',
                            face: faceInfo.face,
                            side: faceInfo.face,
                            params: {
                                template_id: 'TUBE_HOLDER_DRILLING',
                                u,
                                v,
                                u_mm: u,
                                v_mm: v,
                                diameter: holeDiameter,
                                diameter_mm: holeDiameter,
                                depth: holeDepth,
                                depth_mm: holeDepth,
                                isTubeDrilling: true,
                                sourceContainerId: sbNode.id
                            }
                        }
                    });
                }
            });

            // 2. Podpórki półki nad drążkiem (jeśli włączona)
            if (pokaz_polke && srodek_polki_z_mm !== null) {
                const shelfWorldZ = sbBottomZ + srodek_polki_z_mm;
                const shelfV = getVForPanel(targetNode, shelfWorldZ);

                // Dwa otwory pod podpórki półki: 50mm od przodu i 50mm od tyłu
                const uShelfFront = calcFaceUFromFront(targetNode, faceInfo.face, faceInfo.width, 50, sideName);
                const uShelfBack = calcFaceUFromBack(targetNode, faceInfo.face, faceInfo.width, 50, sideName);

                const shelfHoles = [
                    { u: uShelfFront, idSuffix: 'shelf_front' },
                    { u: uShelfBack, idSuffix: 'shelf_back' }
                ];

                shelfHoles.forEach(({ u, idSuffix }) => {
                    if (u > 0 && u < faceInfo.width && shelfV > 0 && shelfV < faceInfo.height) {
                        intents.push({
                            targetNodeId: targetNode.id,
                            feature: {
                                id: `tube_${idSuffix}_${sideName}_${sbNode.id}`,
                                type: 'hole',
                                face: faceInfo.face,
                                side: faceInfo.face,
                                params: {
                                    template_id: 'STANDARD_SHELF_PIN_5MM',
                                    u,
                                    v: shelfV,
                                    u_mm: u,
                                    v_mm: shelfV,
                                    diameter: 5,
                                    diameter_mm: 5,
                                    depth: 12,
                                    depth_mm: 12,
                                    isTubeDrilling: true,
                                    sourceContainerId: sbNode.id
                                }
                            }
                        });
                    }
                });
            }
        }
    }

    return intents;
}
