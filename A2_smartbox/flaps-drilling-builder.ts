/**
 * flaps-drilling-builder.ts
 *
 * Nawiercenia korpusu modułu KLAPY — prowadniki zawiasów na WIENIEC_G / WIENIEC_D.
 * (NIE na bokach — to logika drzwi; klapy montują się w poziomy wieniec górny/dolny.)
 *
 * TOP flap    → TOP_PANEL    (wieniec górny strefy)
 * BOTTOM flap → BOTTOM_PANEL (wieniec dolny strefy)
 *
 * Szablon z web/Biblioteki/okucia/zawiasy.json (corpus_holes):
 *   front_dist od krawędzi frontu (oś głębokości wieńca), z_offset wzdłuż szerokości.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { FlapsDrillingIntent } from './flaps-drilling-intent.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { DEFAULT_HINGE_ID, hingeCorpusHolesMm, hingeTemplateId } from '../Biblioteki/okucia/index.js';

/** Wieniec poziomy — otwory na wewnętrznej powierzchni (jak w korpus3_3_rules lcs.faces.INNER). */
const WIENIEC_DRILL_FACE = 'FACE_Z_PLUS' as const;

type HingeSide = 'left' | 'right' | 'center';

function isTopWieniecPanel(data: any): boolean {
    const role = (data.role || '').toUpperCase();
    const key = ((data.key || data.name || '') as string).toUpperCase();
    return role === 'TOP_PANEL' || key.includes('WIENIEC_G') || key.endsWith('_TOP');
}

function isBottomWieniecPanel(data: any): boolean {
    const role = (data.role || '').toUpperCase();
    const key = ((data.key || data.name || '') as string).toUpperCase();
    return role === 'BOTTOM_PANEL' || key.includes('WIENIEC_D') || key.endsWith('_BOTTOM');
}

function getZonePrefix(tz: string): string {
    const u = (tz || 'B').toUpperCase();
    if (u === 'T' || u === 'TOP' || u === 'C') return 'T';
    if (u === 'M' || u === 'MID' || u === 'MIDDLE') return 'M';
    if (u === 'B' || u === 'BOTTOM' || u === 'A') return 'B';
    return 'FULL';
}

function isPanelMatchingZone(panelNode: any, zonePfx: string): boolean {
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
}

function panelCenterZMm(panelNode: any): number {
    const pos = panelNode.localMatrix.decompose().translation;
    return nmToMm(pos.z);
}

/**
 * Wybiera wieniec docelowy dla strefy SmartBoxa.
 * TOP flap → WIENIEC_G; BOTTOM → WIENIEC_D.
 * Dla strefy FULL bierze skrajny wieniec wzdłuż Z (górny/dolny całego korpusu).
 */
function pickWieniecPanel(
    candidates: any[],
    zonePrefix: string,
    pick: 'topmost' | 'bottommost'
): any | null {
    if (candidates.length === 0) return null;

    let pool = candidates;
    if (zonePrefix !== 'FULL') {
        pool = candidates.filter((n) => isPanelMatchingZone(n, zonePrefix));
        if (pool.length === 0) pool = candidates;
    }

    if (zonePrefix === 'FULL' && pool.length > 1) {
        pool = [...pool].sort((a, b) => panelCenterZMm(a) - panelCenterZMm(b));
        return pick === 'topmost' ? pool[pool.length - 1] : pool[0];
    }

    return pool[0] || null;
}

/**
 * Pozycja zawiasu w lokalnym układzie korpusu (mm): origin dolny-środek strefy SmartBoxa.
 * Zgodne z flaps_2_engine_v1.py _resolve_geometry dla HINGE_*.
 */
function hingeLocalX(side: HingeSide, sbWidth: number, hingeLeft: number, hingeRight: number): number {
    if (side === 'left') return -sbWidth / 2 + hingeLeft;
    if (side === 'right') return sbWidth / 2 - hingeRight;
    return 0;
}

/**
 * Mapuje punkt zawiasu (X,Y w układzie korpusu, mm) na UV wewnętrznej powierzchni wieńca.
 * Wieniec: panel.width = szerokość (X), panel.height = głębokość (Y), panel.thickness = grubość.
 * FACE_Z_PLUS: U ∥ X (szerokość), V ∥ Y (głębokość), V=0 przy tylnej krawędzi (−Y/2 od środka).
 */
function hingeToWieniecUV(
    panelNode: any,
    hingeX: number,
    hingeY: number
): { u: number; v: number } | null {
    const data = panelNode.domainData;
    if (!data) return null;

    const pos = panelNode.localMatrix.decompose().translation;
    const cx = nmToMm(pos.x);
    const cy = nmToMm(pos.y);

    const panelW = nmToMm(data.width);
    const panelD = nmToMm(data.height);
    if (panelW <= 0 || panelD <= 0) return null;

    const leftEdgeX = cx - panelW / 2;
    const frontEdgeY = cy - panelD / 2;

    const u = hingeX - leftEdgeX;
    const v = hingeY - frontEdgeY;

    if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
    if (u < -1 || u > panelW + 1 || v < -1 || v > panelD + 1) return null;

    return { u, v };
}

function pushPlateHoles(
    intents: FlapsDrillingIntent[],
    panelNode: any,
    sbNodeId: string,
    hingeKey: string,
    uCenter: number,
    hingeId: string
): void {
    const corpusHoles = hingeCorpusHolesMm(hingeId);
    const templateId = hingeTemplateId(hingeId);

    corpusHoles.forEach((hole, idx) => {
        const suffix = hole.name || String(idx);
        intents.push({
            targetNodeId: panelNode.id,
            feature: {
                id: `flap_plate_${hingeKey}_${suffix}`,
                type: 'hole',
                face: WIENIEC_DRILL_FACE,
                side: WIENIEC_DRILL_FACE,
                params: {
                    template_id: templateId,
                    u: uCenter + hole.zOffset,
                    v: hole.frontDist,
                    diameter: hole.dia,
                    depth: hole.depth,
                    isFlapDrilling: true,
                    sourceContainerId: sbNodeId,
                    sourcePartId: hingeKey
                }
            }
        });
    });
}

export function buildFlapsDrillings(document: ProjectDocument, cabinetContainerId?: string): FlapsDrillingIntent[] {
    const intents: FlapsDrillingIntent[] = [];
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
        return p && (p.type === 'smartbox_flaps' || p.boxType === 'FLAPS') && c.domainData?.visible !== false;
    });

    if (sbContainers.length === 0) return intents;

    const allTopWience: any[] = [];
    const allBottomWience: any[] = [];

    const collectCabinetPanels = (node: any) => {
        if (!node) return;
        const data = node.domainData;
        const gp = data?.generatorParams;
        if (gp && (String(gp.type || '').startsWith('smartbox') || gp.boxType)) return;

        if (data && (data.type === 'panel' || data.type === 'part')) {
            if (isTopWieniecPanel(data)) allTopWience.push(node);
            else if (isBottomWieniecPanel(data)) allBottomWience.push(node);
        }
        if (node.children) {
            for (const child of node.children) {
                collectCabinetPanels(child);
            }
        }
    };
    collectCabinetPanels(cabinetNode);

    for (const sbNode of sbContainers) {
        const sbData = (sbNode.domainData as any) || {};
        const p = sbData.generatorParams || {};

        const zonePrefix = getZonePrefix(p.targetZone || 'B');
        const flapType = (p.flap_type || 'TOP').toUpperCase();
        const isTopFlap = flapType !== 'BOTTOM';

        const sbWidth = nmToMm(sbData.width);
        const sbDepth = nmToMm(sbData.depth);

        const hingeLeft = p.hinge_left_offset !== undefined ? Number(p.hinge_left_offset) : 80;
        const hingeRight = p.hinge_right_offset !== undefined ? Number(p.hinge_right_offset) : 80;
        const hingeId = p.hinge_template || p.library_id || DEFAULT_HINGE_ID;

        const sbPos = sbNode.localMatrix.decompose().translation;
        const sbPosX = nmToMm(sbPos.x);
        const sbPosY = nmToMm(sbPos.y);

        // Linia zawiasu: górna krawędź otworu (TOP) lub dolna (BOTTOM); front = −depth/2 od środka SB.
        const hingeLineY = sbPosY - sbDepth / 2;

        const wieniecNode = pickWieniecPanel(
            isTopFlap ? allTopWience : allBottomWience,
            zonePrefix,
            isTopFlap ? 'topmost' : 'bottommost'
        );
        if (!wieniecNode) continue;

        const activeHinges: { key: string; side: HingeSide }[] = [];
        if (isTopFlap) {
            activeHinges.push({ key: 'HINGE_TL', side: 'left' });
            activeHinges.push({ key: 'HINGE_TR', side: 'right' });
            if (p.use_center_hinge) activeHinges.push({ key: 'HINGE_TC', side: 'center' });
        } else {
            activeHinges.push({ key: 'HINGE_BL', side: 'left' });
            activeHinges.push({ key: 'HINGE_BR', side: 'right' });
            if (p.use_center_hinge) activeHinges.push({ key: 'HINGE_BC', side: 'center' });
        }

        for (const hinge of activeHinges) {
            const localX = hingeLocalX(hinge.side, sbWidth, hingeLeft, hingeRight);
            const hingeX = sbPosX + localX;
            const uv = hingeToWieniecUV(wieniecNode, hingeX, hingeLineY);
            if (!uv) continue;

            pushPlateHoles(intents, wieniecNode, sbNode.id, hinge.key, uv.u, hingeId);
        }
    }

    return intents;
}
