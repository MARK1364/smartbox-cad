/**
 * Mapowanie generatorParams → silnik. Logika — poza Reactem.
 */
import type { ModuleDims } from './base-engine.js';
import { ShelvesEngine } from './shelves-engine.js';
import { ShelfEngine } from './shelf-engine.js';
import { DoorsEngine } from './doors-engine.js';
import { TubesEngine } from './tubes-engine.js';
import { DrawersEngine } from './drawers-engine.js';
import { DividersEngine } from './dividers-engine.js';
import { PanelsEngine, type SidePanelMode } from './panels-engine.js';
import { FlapsEngine } from './flaps-engine.js';
import { DEFAULT_HINGE_ID, DEFAULT_RAIL_ID } from '../Biblioteki/okucia/index.js';

const MAX_DRAWERS = 5;
const MAX_DIVIDERS = 5;
const SPACER_THICK_MM = 18;

function emptyDrawerHeights(): number[] {
    return [150, 150, 150, 150, 150];
}
function emptyDrawerGaps(): number[] {
    return [3, 3, 3, 3];
}
function emptySections(): number[] {
    return [200, 200, 200, 200, 200];
}

function asPanelMode(raw: any): SidePanelMode {
    const m = String(raw || 'FULL').toUpperCase();
    if (m === 'KORPUS_BLENDA_G' || m === 'COKOL_KORPUS' || m === 'KORPUS') return m;
    return 'FULL';
}

function mmParam(v: any, fallback: number): number {
    if (v === undefined || v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

export function buildShelvesPlan(params: any, dims: ModuleDims): { parts: any[] } {
    return new ShelvesEngine().plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        shelfCount: params.shelfCount !== undefined ? params.shelfCount : 3,
        thickness: params.thickness || 18,
        shelfOffsetFront: params.shelfOffsetFront ?? params.offset_front ?? 10,
        shelfOffsetSide: params.shelfOffsetSide ?? params.offset_side ?? 0.5,
        holePattern: params.holePattern,
        frontInset: params.frontInset ?? params.hole_offset_front,
        backInset: params.backInset ?? params.hole_offset_back,
        frontHoles: params.frontHoles === true || params.front_holes_enabled === true,
        frontOffsetX: params.frontOffsetX ?? params.front_holes_offset_x,
        backHoles: params.backHoles === true || params.back_holes_enabled === true,
        backOffsetX: params.backOffsetX ?? params.back_holes_offset_x,
        tripleZOffset: params.tripleZOffset ?? params.triple_z_offset,
        system32Spacing: params.system32Spacing ?? params.system_32_spacing,
        system32StartOffset: params.system32StartOffset ?? params.system_32_start_offset,
        system32HoleCount: params.system32HoleCount ?? params.system_32_hole_count
    });
}

export function buildShelfPlan(params: any, dims: ModuleDims): { parts: any[] } {
    return new ShelfEngine().plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.thickness !== undefined ? params.thickness : 18,
        offsetFront: params.offset_front !== undefined ? params.offset_front : (params.shelfOffsetFront !== undefined ? params.shelfOffsetFront : 0),
        offsetBack: params.offset_back !== undefined ? params.offset_back : (params.shelfOffsetBack !== undefined ? params.shelfOffsetBack : 0),
        offsetSide: params.offset_side !== undefined ? params.offset_side : (params.shelfOffsetSide !== undefined ? params.shelfOffsetSide : 0),
        offsetBottom: params.offset_bottom !== undefined ? params.offset_bottom : (params.offsetBottom !== undefined ? params.offsetBottom : 0)
    });
}

export function buildDoorsPlan(params: any, dims: ModuleDims): { parts: any[] } {
    return new DoorsEngine().plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.front_thickness || params.thickness || 18,
        doorType: params.door_type || params.doorType || 'LEFT',
        gap: params.gap !== undefined ? params.gap : 4,
        ov_top: params.ov_top !== undefined ? params.ov_top : 14,
        ov_bottom: params.ov_bottom !== undefined ? params.ov_bottom : 15,
        ov_left: params.ov_left !== undefined ? params.ov_left : 16,
        ov_right: params.ov_right !== undefined ? params.ov_right : 16,
        use_hinge_1: params.use_hinge_1,
        hinge_1_pos: params.hinge_1_pos,
        use_hinge_2: params.use_hinge_2,
        hinge_2_pos: params.hinge_2_pos,
        use_hinge_3: params.use_hinge_3,
        hinge_3_pos: params.hinge_3_pos,
        use_hinge_4: params.use_hinge_4,
        hinge_4_pos: params.hinge_4_pos,
        use_hinge_5: params.use_hinge_5,
        hinge_5_pos: params.hinge_5_pos,
        use_hinge_6: params.use_hinge_6,
        hinge_6_pos: params.hinge_6_pos,
        hinge_template: params.hinge_template || params.hingeTemplate || DEFAULT_HINGE_ID
    });
}

export function buildTubesPlan(params: any, dims: ModuleDims): { parts: any[] } {
    return new TubesEngine().plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        offsetTop: params.offset_top !== undefined ? params.offset_top : (params.offsetTop !== undefined ? params.offsetTop : 70),
        showShelf: params.show_shelf !== undefined ? !!params.show_shelf : (params.showShelf !== undefined ? !!params.showShelf : false),
        spaceAboveShelf: params.space_above_shelf !== undefined ? params.space_above_shelf : (params.spaceAboveShelf !== undefined ? params.spaceAboveShelf : 100),
        shelfThickness: params.thickness || 18,
        rodDiameter: params.rod_diameter || 25
    });
}

export function buildDrawersPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const engine = new DrawersEngine();
    const count = Math.max(0, Math.min(MAX_DRAWERS, Math.round(params.count ?? params.drawerCount ?? 3)));
    const railConfigs: Record<number, { length: string; system: string }> = {};
    const src = params.railConfigs || params.rail_configs || {};
    for (let i = 1; i <= count; i++) {
        const cfg = src[i] || src[String(i)] || {};
        railConfigs[i] = {
            length: String(cfg.length || params.rail_length || '500'),
            system: cfg.system || params.rail_system || DEFAULT_RAIL_ID
        };
    }
    return engine.plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.thickness || 18,
        count,
        frontHeightAuto: params.frontHeightAuto !== undefined ? params.frontHeightAuto : (params.front_height_auto !== false),
        commonGap: params.commonGap ?? params.common_gap ?? 3,
        frontHeights: params.frontHeights || params.front_heights || emptyDrawerHeights(),
        individualGaps: params.individualGaps || params.individual_gaps || emptyDrawerGaps(),
        ovTop: params.ovTop ?? params.overlap_top ?? params.ov_top ?? 15,
        ovBottom: params.ovBottom ?? params.overlap_bottom ?? params.ov_bottom ?? 15,
        ovLeft: params.ovLeft ?? params.overlap_left ?? params.ov_left ?? 15,
        ovRight: params.ovRight ?? params.overlap_right ?? params.ov_right ?? 15,
        spacerL: params.spacerL ?? (params.enable_spacer_L ? SPACER_THICK_MM : 0),
        spacerR: params.spacerR ?? (params.enable_spacer_R ? SPACER_THICK_MM : 0),
        railConfigs
    });
}

export function buildDividersPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const count = Math.max(0, Math.min(MAX_DIVIDERS, Math.round(params.count ?? params.dividerCount ?? 2)));
    return new DividersEngine().plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.thickness || 18,
        count,
        spacingMode: params.spacingMode || params.spacing_mode || 'EQUAL',
        sectionWidths: params.sectionWidths || params.section_widths || emptySections()
    });
}

export function buildPanelsPlan(params: any, dims: ModuleDims): { parts: any[] } {
    return new PanelsEngine().plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.thickness || 18,
        sidePanelMode: asPanelMode(params.sidePanelMode || params.side_panel_mode),
        enableLeft: params.enableLeft !== undefined ? !!params.enableLeft : params.enable_left !== false,
        enableRight: params.enableRight !== undefined ? !!params.enableRight : params.enable_right !== false,
        enableTop: params.enableTop !== undefined ? !!params.enableTop : params.enable_top !== false,
        enableBottom: params.enableBottom !== undefined ? !!params.enableBottom : params.enable_bottom !== false,
        autoDepthLeft: params.autoDepthLeft !== undefined ? !!params.autoDepthLeft : params.override_rear_left !== false,
        autoDepthRight: params.autoDepthRight !== undefined ? !!params.autoDepthRight : params.override_rear_right !== false,
        autoDepthTop: params.autoDepthTop !== undefined ? !!params.autoDepthTop : params.override_rear_top !== false,
        panelDepthLeft: mmParam(params.panelDepthLeft ?? params.panel_depth_left, 100),
        panelDepthRight: mmParam(params.panelDepthRight ?? params.panel_depth_right, 100),
        panelDepthTop: mmParam(params.panelDepthTop ?? params.panel_depth_top, 100),
        plinthHeight: mmParam(params.plinthHeight ?? params.plinth_height, 97),
        plinthRecess: mmParam(params.plinthRecess ?? params.plinth_recess, 20),
        plinthGap: mmParam(params.plinthGap ?? params.plinth_gap, 3)
    });
}

export function buildFlapsPlan(params: any, dims: ModuleDims): { parts: any[] } {
    return new FlapsEngine().plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.front_thickness || params.thickness || 18,
        flap_type: params.flap_type || params.type || 'TOP',
        ov_top: params.ov_top !== undefined ? params.ov_top : 14,
        ov_bottom: params.ov_bottom !== undefined ? params.ov_bottom : 15,
        ov_left: params.ov_left !== undefined ? params.ov_left : 16,
        ov_right: params.ov_right !== undefined ? params.ov_right : 16,
        hinge_left_offset: params.hinge_left_offset !== undefined ? params.hinge_left_offset : 80,
        hinge_right_offset: params.hinge_right_offset !== undefined ? params.hinge_right_offset : 80,
        use_center_hinge: !!params.use_center_hinge
    });
}
