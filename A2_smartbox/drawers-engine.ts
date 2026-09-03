/**
 * drawers-engine.ts — moduł SZUFLADY (smartbox_drawers)
 * Odpowiednik @@BLENDER/A2_smartbox/drawers_2_engine_v1.py + drawers_3_rules_V1.json
 *
 * JSON trzyma wymiary hardware w metrach (0.035). Silnik pracuje w mm, jak doors/shelves.
 * Origin SmartBoxa w web: Z=0 to spód strefy (w Blenderze środek → tu bez -h/2).
 *
 * Nawiercenia korpusu (corpus_holes → BOK): drawers-drilling-builder.ts.
 * Otwory frontu (front_holes) — features na skrzydle, tu.
 */
import drawersRules from './drawers_3_rules_V1.json';
import { BaseEngine, type ModuleDims } from './base-engine.js';
import { rulesMToMm } from '../A1_core/cad-math/units.js';
import { getDrawerDrill, getHardware, listByType, DEFAULT_RAIL_ID, type HardwareItem } from '../Biblioteki/okucia/index.js';

const FRONT_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' },
    rotation: [0, 0, 0],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

const SHELF_LCS = {
    mapping: { X: 'x', Y: 'y', Z: 'z' },
    rotation: [90, 0, 0],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

const SIDE_L_LCS = {
    mapping: { X: 'y', Y: 'x', Z: 'z' },
    rotation: [0, 0, -90],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

const SIDE_R_LCS = {
    mapping: { X: 'y', Y: 'x', Z: 'z' },
    rotation: [0, 0, 90],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};


function railsForBrand(brand?: string): HardwareItem[] {
    return listByType('RAIL').filter((r) => !brand || r.brand === brand);
}

export function listRailBrands(): string[] {
    const brands = new Set<string>();
    for (const r of listByType('RAIL')) {
        if (r.brand) brands.add(r.brand);
    }
    return Array.from(brands).sort();
}

export function listRailSystemsForBrand(brand: string): { id: string; name: string; corpusHeightMm: number }[] {
    return railsForBrand(brand).map((r) => ({
        id: r.id,
        name: r.name || r.id,
        corpusHeightMm: rulesMToMm(r.mount?.corpus_height, 84)
    }));
}

export function listRailLengthsForBrand(brand: string): string[] {
    const lengths = new Set<string>();
    for (const r of railsForBrand(brand)) {
        for (const k of Object.keys(r.lengths || {})) lengths.add(k);
    }
    return Array.from(lengths).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

export interface DrawerSlot {
    index: number;
    frontH: number;
    zFrontBottom: number;
    zInternalBottom: number;
    zFrontCenter: number;
    railId: string;
    lengthMm: number;
    rail: {
        name: string;
        railHeight: number;
        corpusHeight: number;
        width: number;
        lengths: Record<string, any>;
        frontHoles: any;
        drill: { dia?: number; depth?: number };
    };
    /** Front (z nakładkami) wychodzi poza gabaryt SmartBoxa. */
    frontOutOfPanel: boolean;
    /** Otwory korpusu wychodzą poza wysokość SmartBoxa. */
    corpusHolesOutOfPanel: boolean;
}

export interface DrawerLayout {
    count: number;
    width: number;
    height: number;
    depth: number;
    thickness: number;
    ovTop: number;
    ovBottom: number;
    ovLeft: number;
    ovRight: number;
    spacerL: number;
    spacerR: number;
    innerW: number;
    innerXOffset: number;
    slots: DrawerSlot[];
}

function defaultRailId(params: any): string {
    const fromParams = params.railSystem || params.rail_system;
    if (fromParams && getHardware(fromParams)?.type === 'RAIL') return fromParams;
    return listByType('RAIL').find((r) => r.id === DEFAULT_RAIL_ID)?.id
        || listByType('RAIL')[0]?.id
        || DEFAULT_RAIL_ID;
}

function defaultLength(item: HardwareItem | undefined, requested?: string): string {
    const keys = Object.keys(item?.lengths || {});
    if (requested && keys.includes(String(requested))) return String(requested);
    return keys[0] || '500';
}

/**
 * Wspólny układ szuflad — używany przez silnik, builder nawierceń i ostrzeżenia UI.
 * Wszystko w mm. Z=0 = spód SmartBoxa.
 */
export function resolveDrawerLayout(params: any, dims: ModuleDims): DrawerLayout {
    const width = dims.width || 600;
    const height = dims.height || 720;
    const depth = dims.depth || 500;
    const thickness = params.thickness !== undefined ? params.thickness : 18;
    const count = Math.max(0, Math.min(5, Math.round(params.count ?? params.drawerCount ?? 3)));

    const ovTop = params.ovTop ?? params.overlap_top ?? 15;
    const ovBottom = params.ovBottom ?? params.overlap_bottom ?? 15;
    const ovLeft = params.ovLeft ?? params.overlap_left ?? 15;
    const ovRight = params.ovRight ?? params.overlap_right ?? 15;
    const spacerL = params.spacerL ?? 0;
    const spacerR = params.spacerR ?? 0;

    const autoH = params.frontHeightAuto !== undefined ? !!params.frontHeightAuto : (params.front_height_auto !== false);
    const commonGap = params.commonGap ?? params.common_gap ?? 3;
    const frontHeights: number[] = params.frontHeights || params.front_heights || [];
    const individualGaps: number[] = params.individualGaps || params.individual_gaps || [];
    const railConfigs = params.railConfigs || params.rail_configs || {};
    const fallbackRailId = defaultRailId(params);

    const innerW = Math.max(10, width - spacerL - spacerR);
    const innerXOffset = (spacerL - spacerR) / 2;

    const slots: DrawerSlot[] = [];

    for (let i = 1; i <= count; i++) {
        let frontH: number;
        let zFrontBottom: number;
        if (autoH) {
            const totalH = height + ovBottom + ovTop;
            const totalGaps = count > 1 ? (count - 1) * commonGap : 0;
            frontH = count > 0 ? (totalH - totalGaps) / count : 0;
            zFrontBottom = -ovBottom + (i - 1) * (frontH + commonGap);
        } else {
            frontH = Number(frontHeights[i - 1]);
            if (!Number.isFinite(frontH) || frontH <= 0) frontH = count > 0 ? height / count : height;
            const prevH = frontHeights.slice(0, i - 1).reduce((s: number, v: number) => s + (Number(v) || 0), 0);
            const prevG = individualGaps.slice(0, i - 1).reduce((s: number, v: number) => s + (Number(v) || 0), 0);
            zFrontBottom = -ovBottom + prevH + prevG;
        }

        const zInternalBottom = i === 1 ? 0 : zFrontBottom;
        const zFrontCenter = zFrontBottom + frontH / 2;

        const cfg = railConfigs[i] || railConfigs[String(i)] || {};
        const requestedId = cfg.system;
        const railItem = (requestedId && getHardware(requestedId)?.type === 'RAIL')
            ? getHardware(requestedId)
            : getHardware(fallbackRailId);
        const railId = railItem?.id || fallbackRailId;
        const mount = railItem?.mount || {};
        const lengthMm = parseFloat(defaultLength(railItem, cfg.length));
        const rail = {
            name: railItem?.name || railId,
            railHeight: rulesMToMm(mount.rail_height, 35),
            corpusHeight: rulesMToMm(mount.corpus_height, 84),
            width: rulesMToMm(mount.width, 27),
            lengths: railItem?.lengths || {},
            frontHoles: railItem?.front_holes || {},
            drill: railItem?.drill || { dia: 0.003, depth: 0.012 }
        };

        const frontTop = zFrontBottom + frontH;
        const frontOutOfPanel = frontH <= 0 || zFrontBottom < -ovBottom - 0.5 || frontTop > height + ovTop + 0.5;

        const holeData = rail.lengths[String(Math.round(lengthMm))] || rail.lengths[String(lengthMm)] || {};
        const zOff = rulesMToMm(holeData.z_offset, 33);
        const holeR = rulesMToMm(rail.drill.dia, 3) / 2;
        const boxTop = zInternalBottom + rail.corpusHeight;
        const corpusHolesOutOfPanel =
            (zInternalBottom + zOff - holeR < -0.5) ||
            (zInternalBottom + zOff + holeR > height + 0.5) ||
            (boxTop > height + 0.5);

        slots.push({
            index: i,
            frontH,
            zFrontBottom,
            zInternalBottom,
            zFrontCenter,
            railId,
            lengthMm: Number.isFinite(lengthMm) ? lengthMm : 500,
            rail,
            frontOutOfPanel,
            corpusHolesOutOfPanel
        });
    }

    return {
        count, width, height, depth, thickness,
        ovTop, ovBottom, ovLeft, ovRight,
        spacerL, spacerR, innerW, innerXOffset,
        slots
    };
}

function buildFrontHoles(slot: DrawerSlot, frontW: number, frontH: number): any[] {
    const data = slot.rail.frontHoles || {};
    const zFromBox: number[] = data.z_positions || [];
    if (!zFromBox.length) return [];
    const xOff = rulesMToMm(data.x_offset, 31);
    const drill = getDrawerDrill(slot.railId);
    const dia = rulesMToMm(drill.front_hole?.dia, 3);
    const depth = rulesMToMm(drill.front_hole?.depth, 10);
    const boxFromFrontBottom = slot.zInternalBottom - slot.zFrontBottom;
    const features: any[] = [];
    zFromBox.forEach((zRaw, zIdx) => {
        const v = boxFromFrontBottom + rulesMToMm(zRaw, 0);
        if (v < dia / 2 || v > frontH - dia / 2) return;
        for (const side of ['L', 'R'] as const) {
            const u = side === 'L' ? xOff : (frontW - xOff);
            features.push({
                id: `drawer_${slot.index}_front_${side}_${zIdx}`,
                type: 'hole',
                face: 'FACE_Z_PLUS',
                side: 'FACE_Z_PLUS',
                params: {
                    template_id: drill.id || 'STANDARD_DRAWER_DRILL',
                    u,
                    v,
                    diameter: dia,
                    depth,
                    isDrawerFrontHole: true
                }
            });
        }
    });
    return features;
}

export class DrawersEngine extends BaseEngine {
    plan(params: any): { parts: any[] } {
        const dims: ModuleDims = {
            width: params.width || 600,
            height: params.height || 720,
            depth: params.depth || 500
        };
        const layout = resolveDrawerLayout(params, dims);
        const parts: any[] = [];
        const roleFront = (drawersRules as any).parameters?.smart_panel_integration?.role_overrides?.FRONT;
        const roleSpacer = (drawersRules as any).parameters?.smart_panel_integration?.role_overrides?.SPACER;

        const frontY = -(layout.depth / 2 + layout.thickness / 2);
        // Nałożenie L/P liczone od wewnętrznej ściany dystansu (nie od krawędzi SmartBoxa).
        // Korekta: front = światło między dystansami + ovLeft + ovRight.
        const frontW = layout.innerW + layout.ovLeft + layout.ovRight;
        const frontX = layout.innerXOffset + (layout.ovRight - layout.ovLeft) / 2;

        for (const slot of layout.slots) {
            parts.push({
                name: `Front_${slot.index}`,
                key: `DRAWER_${slot.index}_FRONT`,
                role: 'FRONT',
                dim: { x: frontW, y: layout.thickness, z: slot.frontH },
                loc: { x: frontX, y: frontY, z: slot.zFrontCenter },
                lcs: FRONT_LCS,
                edge_banding: roleFront?.edge_banding,
                features: buildFrontHoles(slot, frontW, slot.frontH)
            });

            const boxW = Math.max(10, layout.innerW - slot.rail.width * 2);
            const boxLen = Math.min(slot.lengthMm, Math.max(10, layout.depth - 2));
            parts.push({
                name: `Skrzynka_${slot.index}`,
                key: `DRAWER_${slot.index}_BOX`,
                role: 'BOX',
                dim: { x: boxW, y: boxLen, z: slot.rail.corpusHeight },
                loc: {
                    x: layout.innerXOffset,
                    y: -(layout.depth / 2) + boxLen / 2,
                    z: slot.zInternalBottom + slot.rail.corpusHeight / 2
                },
                lcs: SHELF_LCS,
                features: []
            });

            const railLen = boxLen;
            const railZ = slot.zInternalBottom + slot.rail.railHeight / 2;
            const railY = -(layout.depth / 2) + railLen / 2;
            const railXLeft = -layout.width / 2 + layout.spacerL + slot.rail.width / 2;
            const railXRight = layout.width / 2 - layout.spacerR - slot.rail.width / 2;

            parts.push({
                name: `Prowadnica_${slot.index}L`,
                key: `DRAWER_${slot.index}_RAIL_L`,
                role: 'PROWADNICA',
                dim: { x: slot.rail.width, y: railLen, z: slot.rail.railHeight },
                loc: { x: railXLeft, y: railY, z: railZ },
                lcs: SHELF_LCS,
                customProperties: {
                    library_id: slot.railId,
                    art_no: slot.rail.lengths[String(Math.round(slot.lengthMm))]?.art_no,
                    shape: 'RAIL'
                },
                features: []
            });

            parts.push({
                name: `Prowadnica_${slot.index}P`,
                key: `DRAWER_${slot.index}_RAIL_R`,
                role: 'PROWADNICA',
                dim: { x: slot.rail.width, y: railLen, z: slot.rail.railHeight },
                loc: { x: railXRight, y: railY, z: railZ },
                lcs: SHELF_LCS,
                customProperties: {
                    library_id: slot.railId,
                    art_no: slot.rail.lengths[String(Math.round(slot.lengthMm))]?.art_no,
                    shape: 'RAIL'
                },
                features: []
            });
        }

        if (layout.spacerL > 0.5) {
            parts.push({
                name: 'Dystans_L',
                key: 'DRAWER_SPACER_L',
                role: 'SPACER',
                dim: { x: layout.height, y: layout.depth, z: layout.spacerL },
                loc: { x: -layout.width / 2 + layout.spacerL / 2, y: 0, z: layout.height / 2 },
                lcs: SIDE_L_LCS,
                edge_banding: roleSpacer?.edge_banding,
                features: []
            });
        }
        if (layout.spacerR > 0.5) {
            parts.push({
                name: 'Dystans_P',
                key: 'DRAWER_SPACER_R',
                role: 'SPACER',
                dim: { x: layout.height, y: layout.depth, z: layout.spacerR },
                loc: { x: layout.width / 2 - layout.spacerR / 2, y: 0, z: layout.height / 2 },
                lcs: SIDE_R_LCS,
                edge_banding: roleSpacer?.edge_banding,
                features: []
            });
        }

        return { parts };
    }
}
