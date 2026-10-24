/**
 * 18_corner-shelves-drilling-builder.ts
 *
 * Nawiercenia modułu PÓŁKI NAROŻNE (blok_corner_shelves).
 * Rzutuje otwory na boki korpusu narożnego 90° (BOK_L i BOK_P).
 * Zgodnie ze specyfikacją:
 *  - 100% kompatybilności parametrów z normalnymi półkami (odsunięcie przód, tył, SINGLE, TRIPLE, SYSTEM_32)
 *  - Otwory wyłącznie na bokach korpusu (BOK_L i BOK_P), bez otworów w plecach ani wspornika w rogu.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { ShelvesDrillingIntent } from './04_shelves-drilling-intent.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { equalShelfCenterZ } from './04_shelves-engine.js';
import { getShelfPinOrDefault } from '../B1_biblioteka/index.js';

function isBlokiSubtree(node: any): boolean {
    const d = node.domainData as any;
    const gp = d?.generatorParams;
    return Boolean(
        d?.type === 'bloki' ||
        d?.type === 'bloki_container' ||
        String(gp?.type ?? '').startsWith('bloki') ||
        Boolean(gp?.boxType)
    );
}

function findRogowyPanel(cabinetNode: any, ...candidates: string[]): any | null {
    for (const cand of candidates) {
        let found: any | null = null;
        const upperCand = cand.toUpperCase();
        const walk = (node: any) => {
            if (found) return;
            if (isBlokiSubtree(node)) return;
            const d = node.domainData as any;
            if (d && (d.type === 'panel' || d.type === 'part' || d.role)) {
                const key = String(d.key || node.name || '').toUpperCase();
                const role = String(d.role || '').toUpperCase();
                if (key === upperCand || key.endsWith(`_${upperCand}`) || role === upperCand || key.includes(upperCand)) {
                    found = node;
                    return;
                }
            }
            for (const child of node.children || []) walk(child);
        };
        walk(cabinetNode);
        if (found) return found;
    }
    return null;
}

export function buildCornerShelvesDrillings(
    document: ProjectDocument,
    cabinetContainerId?: string
): ShelvesDrillingIntent[] {
    const intents: ShelvesDrillingIntent[] = [];
    if (!document) return intents;

    const containers = typeof document.getContainers === 'function' ? document.getContainers() : [];

    // 1. Znajdź główny korpus kątowy (cabinet)
    let cabinetNode = cabinetContainerId ? document.findNode(cabinetContainerId) : null;
    if (!cabinetNode) {
        cabinetNode = containers.find((c: any) => {
            const type = c.domainData?.generatorParams?.type;
            return type === 'korpus_rogowy90' || type === 'korpus_rogowy1' ||
                   (c.domainData?.type === 'container' && !String(c.domainData?.generatorParams?.type || '').startsWith('bloki'));
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

    // 2. Znajdź aktywne kontenery z półkami narożnymi
    const cornerContainers = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        if (!p || c.domainData?.visible === false) return false;
        const isCorner = p.type === 'blok_corner_shelves' || p.boxType === 'CORNER_SHELVES' || p.type === 'CORNER_SHELVES';
        if (!isCorner) return false;
        if (cabinetContainerId) {
            return p.parentContainerId === cabinetNode.id || c.parent?.id === cabinetNode.id || isChildOfCabinet(c);
        }
        return true;
    });

    if (cornerContainers.length === 0) return intents;

    // 3. Zidentyfikuj formatki BOK_L i BOK_P korpusu
    const bokLNode = findRogowyPanel(cabinetNode, 'BOK_L', 'BOK_Y', 'LEFT_SIDE_PANEL');
    const bokPNode = findRogowyPanel(cabinetNode, 'BOK_P', 'BOK_X', 'RIGHT_SIDE_PANEL');
    const bottomNode = findRogowyPanel(cabinetNode, 'WIENIEC_D', 'BOTTOM_PANEL', 'BOTTOM');

    if (!bokLNode && !bokPNode) return intents;

    const getPanelWorldZ = (node: any): number => {
        const mat = typeof node.getWorldMatrix === 'function' ? node.getWorldMatrix() : node.localMatrix;
        if (!mat) return 0;
        return nmToMm(mat.decompose().translation.z);
    };

    const getVForPanel = (targetNode: any, worldZ: number): number => {
        if (!targetNode) return worldZ;
        const dd = targetNode.domainData;
        const rawH = (dd?.height && dd.height > 0) ? dd.height : (dd?.length || dd?.width || 0);
        const targetHeight = nmToMm(rawH);
        const targetCenterZ = getPanelWorldZ(targetNode);
        const targetBottomZ = targetCenterZ - targetHeight / 2;
        return worldZ - targetBottomZ;
    };

    const findShelfPanel = (containerNode: any, shelfIndex: number): any | null => {
        for (const child of containerNode?.children || []) {
            const d = child.domainData;
            if (d && (d.name === `Polka_${shelfIndex}` || child.name === `Polka_${shelfIndex}`)) return child;
        }
        return null;
    };

    // 4. Dla każdego kontenera wylicz nawiercenia na bokach
    for (const sbNode of cornerContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};

        const sbHeight = nmToMm(sbData.height || 0);

        const count = p.liczba_polek ?? 1;
        const holePattern = p.wzor_nawiercen || 'SINGLE';
        if (holePattern === 'NONE' || count <= 0 || sbHeight <= 0) continue;

        const offsetFront = p.odsuniecie_przod_mm ?? 0;
        const frontInset = p.odstep_otworow_przod_mm ?? 40;
        const backInset = p.odstep_otworow_tyl_mm ?? 40;
        const plecyOffsetX = p.plecy_odsuniecie_x_mm ?? 0;
        const plecyOffsetY = p.plecy_odsuniecie_y_mm ?? 0;
        const tripleZOffset = p.rozstaw_potrojny_z_mm ?? 32;
        const sys32Spacing = p.rozstaw_system32_mm ?? 32;
        const sys32StartOffset = p.start_system32_z_mm ?? 150;
        const sys32HoleCount = p.liczba_otworow_system32 ?? 10;
        const shelfThickness = p.grubosc_polki_mm ?? 18;

        const pinItem = getShelfPinOrDefault(p.podporka_id);
        const firstCorpusHole = pinItem.machining?.corpus_holes?.[0];
        const holeDiameter = firstCorpusHole?.dia ?? 5;
        const holeDepth = firstCorpusHole?.depth ?? 11;
        const radius = holeDiameter / 2;

        const sbNodeResolved = typeof document.findNode === 'function' ? document.findNode(sbNode.id) : sbNode;
        let sbBottomZ = getPanelWorldZ(sbNodeResolved || sbNode);

        if (bottomNode) {
            const bpCenterZ = getPanelWorldZ(bottomNode);
            const bpData = (bottomNode.domainData as any) || {};
            const bpRawTh = bpData.custom_properties?.thickness_mm !== undefined
                ? Number(bpData.custom_properties.thickness_mm)
                : (bpData.thickness !== undefined ? nmToMm(bpData.thickness) : 18);
            sbBottomZ = bpCenterZ + bpRawTh / 2;
        }

        // Pomocnik dodający otwór na danym boku korpusu w układzie ścianki (u, v)
        const addHoleOnSide = (
            panelNode: any,
            uPos: number,
            vPos: number,
            holeId: string,
            drivenBy: any,
            sourcePartId: string
        ) => {
            const pw = nmToMm(panelNode.domainData.width || panelNode.domainData.length || 0);
            const ph = nmToMm(panelNode.domainData.height || panelNode.domainData.depth || 0);
            if (pw <= 0 || ph <= 0) return;

            const face = 'FACE_Z_PLUS';
            // Weryfikacja granic ścianki
            if (uPos > 0 && uPos < pw && vPos > 0 && vPos < ph) {
                intents.push(buildHoleMachiningIntent({
                    targetNodeId: panelNode.id,
                    id: holeId,
                    face,
                    side: face,
                    template_id: 'SINGLE',
                    drivenBy,
                    rule: 'shelf_pin',
                    generatedBy: 'blok_corner_shelves',
                    u: uPos,
                    v: vPos,
                    diameter: holeDiameter,
                    depth: holeDepth,
                    ownerTag: 'isShelfDrilling',
                    sourceContainerId: sbNode.id,
                    sourcePartId,
                }));
            }
        };

        // ─── A. WZORZEC SINGLE / TRIPLE DLA PÓŁEK NAROŻNYCH ────────────────────
        if (holePattern === 'SINGLE' || holePattern === 'TRIPLE') {
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

                const shelfHoleZ = shelfWorldZ - (actualShelfThickness / 2) - radius;
                const shelfDrivenBy = {
                    nodeId: shelfNode ? shelfNode.id : sbNode.id,
                    role: 'SHELF_PANEL',
                    partKey: `Polka_${i}`,
                    containerId: sbNode.id,
                };

                const zPositions = [shelfHoleZ];
                if (holePattern === 'TRIPLE') {
                    zPositions.push(shelfHoleZ + tripleZOffset);
                    zPositions.push(shelfHoleZ - tripleZOffset);
                }

                for (let idx = 0; idx < zPositions.length; idx++) {
                    const worldZ = zPositions[idx];
                    const suffix = idx === 0 ? '' : (idx === 1 ? '_top' : '_bottom');

                    // 1. Bok Lewy (BOK_L): u=0 przy plecach, u=pw przy froncie
                    if (bokLNode) {
                        const pwL = nmToMm(bokLNode.domainData.width || bokLNode.domainData.length || 0);
                        const vPos = getVForPanel(bokLNode, worldZ);
                        const uFront = pwL - (frontInset + offsetFront);
                        const uBack = backInset + plecyOffsetX;

                        addHoleOnSide(
                            bokLNode, uFront, vPos,
                            `corner_shelf_${i}_left_front${suffix}`,
                            shelfDrivenBy, `Polka_${i}`
                        );
                        addHoleOnSide(
                            bokLNode, uBack, vPos,
                            `corner_shelf_${i}_left_back${suffix}`,
                            shelfDrivenBy, `Polka_${i}`
                        );
                    }

                    // 2. Bok Prawy (BOK_P): u=0 przy froncie, u=pw przy plecach
                    if (bokPNode) {
                        const pwP = nmToMm(bokPNode.domainData.width || bokPNode.domainData.length || 0);
                        const vPos = getVForPanel(bokPNode, worldZ);
                        const uFront = frontInset + offsetFront;
                        const uBack = pwP - (backInset + plecyOffsetY);

                        addHoleOnSide(
                            bokPNode, uFront, vPos,
                            `corner_shelf_${i}_right_front${suffix}`,
                            shelfDrivenBy, `Polka_${i}`
                        );
                        addHoleOnSide(
                            bokPNode, uBack, vPos,
                            `corner_shelf_${i}_right_back${suffix}`,
                            shelfDrivenBy, `Polka_${i}`
                        );
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

                // 1. Bok Lewy (BOK_L)
                if (bokLNode) {
                    const pwL = nmToMm(bokLNode.domainData.width || bokLNode.domainData.length || 0);
                    const vPos = getVForPanel(bokLNode, worldZ);
                    const uFront = pwL - (frontInset + offsetFront);
                    const uBack = backInset + plecyOffsetX;

                    addHoleOnSide(
                        bokLNode, uFront, vPos,
                        `sys32_corner_left_front_${k}`,
                        sys32DrivenBy, 'System_32'
                    );
                    addHoleOnSide(
                        bokLNode, uBack, vPos,
                        `sys32_corner_left_back_${k}`,
                        sys32DrivenBy, 'System_32'
                    );
                }

                // 2. Bok Prawy (BOK_P)
                if (bokPNode) {
                    const pwP = nmToMm(bokPNode.domainData.width || bokPNode.domainData.length || 0);
                    const vPos = getVForPanel(bokPNode, worldZ);
                    const uFront = frontInset + offsetFront;
                    const uBack = pwP - (backInset + plecyOffsetY);

                    addHoleOnSide(
                        bokPNode, uFront, vPos,
                        `sys32_corner_right_front_${k}`,
                        sys32DrivenBy, 'System_32'
                    );
                    addHoleOnSide(
                        bokPNode, uBack, vPos,
                        `sys32_corner_right_back_${k}`,
                        sys32DrivenBy, 'System_32'
                    );
                }
            }
        }
    }

    return intents;
}
