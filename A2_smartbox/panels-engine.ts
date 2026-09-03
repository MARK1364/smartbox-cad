/**
 * panels-engine.ts — moduł BLENDY (smartbox_panels)
 * Odpowiednik @@BLENDER/A2_smartbox/panels_2_engine_v1.py + panels_3_rules_V1.json
 *
 * Jedyne SmartBoxy na ZEWNĄTRZ korpusu (side_references_smartbox: OUTER).
 * Gabaryt SmartBoxa = zewnętrzna obudowa SmartFrame; blendy siadają na zewnątrz
 * tej obudowy (lewa/prawa/góra) albo pod spodem (cokół).
 *
 * Origin web: Z=0 = spód strefy (w Blenderze środek). Bez nawierceń.
 */
import panelsRules from './panels_3_rules_V1.json';
import { BaseEngine, type ModuleDims } from './base-engine.js';

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

export type SidePanelMode = 'FULL' | 'KORPUS_BLENDA_G' | 'COKOL_KORPUS' | 'KORPUS';

function mmParam(v: number | undefined, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function flag(params: any, camel: string, snake: string, fallback = false): boolean {
    if (params[camel] !== undefined) return !!params[camel];
    if (params[snake] !== undefined) return !!params[snake];
    return fallback;
}

function edgeFor(role: string): any {
    return (panelsRules as any).parameters?.smart_panel_integration?.role_overrides?.[role]?.edge_banding;
}

function calcSideSpan(mode: SidePanelMode, height: number, plinthH: number, plinthGap: number, topThick: number) {
    let zBottom = 0;
    let zTop = height;
    if (mode === 'FULL') {
        zBottom = -plinthGap - plinthH;
        zTop = height + topThick;
    } else if (mode === 'KORPUS_BLENDA_G') {
        zBottom = 0;
        zTop = height + topThick;
    } else if (mode === 'COKOL_KORPUS') {
        zBottom = -plinthH - plinthGap;
        zTop = height;
    }
    return { zBottom, zTop, sideH: zTop - zBottom, zCenter: (zBottom + zTop) / 2 };
}

export class PanelsEngine extends BaseEngine {
    plan(params: any): { parts: any[] } {
        const width = params.width || 600;
        const height = params.height || 720;
        const depth = params.depth || 500;
        const thickness = mmParam(params.thickness, 18);
        const mode = String(params.sidePanelMode || params.side_panel_mode || 'FULL').toUpperCase() as SidePanelMode;

        const enableLeft = flag(params, 'enableLeft', 'enable_left', true);
        const enableRight = flag(params, 'enableRight', 'enable_right', true);
        const enableTop = flag(params, 'enableTop', 'enable_top', true);
        const enableBottom = flag(params, 'enableBottom', 'enable_bottom', true);

        const autoLeft = flag(params, 'autoDepthLeft', 'override_rear_left', true);
        const autoRight = flag(params, 'autoDepthRight', 'override_rear_right', true);
        const autoTop = flag(params, 'autoDepthTop', 'override_rear_top', true);

        const depthLeft = autoLeft ? depth : mmParam(params.panelDepthLeft ?? params.panel_depth_left, 100);
        const depthRight = autoRight ? depth : mmParam(params.panelDepthRight ?? params.panel_depth_right, 100);
        const depthTop = autoTop ? depth : mmParam(params.panelDepthTop ?? params.panel_depth_top, 100);

        const plinthH = mmParam(params.plinthHeight ?? params.plinth_height, 97);
        const plinthGap = mmParam(params.plinthGap ?? params.plinth_gap, 3);
        const plinthRecess = mmParam(params.plinthRecess ?? params.plinth_recess, 20);
        const clearanceL = mmParam(params.clearanceLeft ?? params.clearance_left, 0);
        const clearanceR = mmParam(params.clearanceRight ?? params.clearance_right, 0);
        const clearanceT = mmParam(params.clearanceTop ?? params.clearance_top, 0);

        const { sideH, zCenter } = calcSideSpan(mode, height, plinthH, plinthGap, thickness);
        const parts: any[] = [];

        if (enableLeft) {
            const posY = autoLeft ? 0 : -(depth / 2) + depthLeft / 2;
            parts.push({
                name: 'Blenda_lewa',
                key: 'PANEL_LEFT',
                role: 'LEFT_SIDE_PANEL',
                dim: { x: sideH, y: depthLeft, z: thickness },
                loc: { x: -width / 2 - thickness / 2 - clearanceL, y: posY, z: zCenter },
                lcs: SIDE_L_LCS,
                edge_banding: edgeFor('LEFT_SIDE_PANEL'),
                features: []
            });
        }

        if (enableRight) {
            const posY = autoRight ? 0 : -(depth / 2) + depthRight / 2;
            parts.push({
                name: 'Blenda_prawa',
                key: 'PANEL_RIGHT',
                role: 'RIGHT_SIDE_PANEL',
                dim: { x: sideH, y: depthRight, z: thickness },
                loc: { x: width / 2 + thickness / 2 + clearanceR, y: posY, z: zCenter },
                lcs: SIDE_R_LCS,
                edge_banding: edgeFor('RIGHT_SIDE_PANEL'),
                features: []
            });
        }

        if (enableTop) {
            let leftEdge = -width / 2;
            let rightEdge = width / 2;
            if (mode === 'KORPUS' || mode === 'COKOL_KORPUS') {
                if (enableLeft) leftEdge -= thickness;
                if (enableRight) rightEdge += thickness;
            }
            const topW = rightEdge - leftEdge;
            const posY = autoTop ? 0 : -(depth / 2) + depthTop / 2;
            parts.push({
                name: 'Blenda_gora',
                key: 'PANEL_TOP',
                role: 'TOP_PANEL',
                dim: { x: topW, y: depthTop, z: thickness },
                loc: { x: (leftEdge + rightEdge) / 2, y: posY, z: height + thickness / 2 + clearanceT },
                lcs: SHELF_LCS,
                edge_banding: edgeFor('TOP_PANEL'),
                features: []
            });
        }

        if (enableBottom) {
            let leftEdge = -width / 2;
            let rightEdge = width / 2;
            if (mode === 'KORPUS_BLENDA_G' || mode === 'KORPUS') {
                if (enableLeft) leftEdge -= thickness;
                if (enableRight) rightEdge += thickness;
            }
            const cokolW = rightEdge - leftEdge;
            parts.push({
                name: 'Panel_Cokol',
                key: 'PANEL_BOTTOM',
                role: 'BOTTOM_PANEL',
                dim: { x: cokolW, y: thickness, z: plinthH },
                loc: {
                    x: (leftEdge + rightEdge) / 2,
                    y: -(depth / 2) + plinthRecess + thickness / 2,
                    z: -plinthGap - plinthH / 2
                },
                lcs: FRONT_LCS,
                edge_banding: edgeFor('BOTTOM_PANEL'),
                features: []
            });
        }

        return { parts };
    }
}
