/**
 * shelf-engine.ts — moduł WIENIEC (smartbox_shelf)
 * Odpowiednik @@BLENDER/A2_smartbox/shelf_2_engine_v1.py + shelf_3_rules_V1.json
 * Bez nawierceń (machining_library puste). To NIE jest moduł półek (shelves_*).
 */
import shelfRules from './shelf_3_rules_V1.json';
import { BaseEngine } from './base-engine.js';

export class ShelfEngine extends BaseEngine {
    plan(params: any): { parts: any[] } {
        const parts: any[] = [];
        const thickness = params.thickness !== undefined ? params.thickness : 18;
        const width = params.width || 600;
        const height = params.height || 720;
        const depth = params.depth || 500;

        const offsetFront = params.offsetFront !== undefined ? params.offsetFront : 0;
        const offsetBack = params.offsetBack !== undefined ? params.offsetBack : 0;
        const offsetSide = params.offsetSide !== undefined ? params.offsetSide : 0;
        const offsetBottom = params.offsetBottom !== undefined ? params.offsetBottom : (params.offset_bottom !== undefined ? params.offset_bottom : 0);

        const effectiveWidth = Math.max(10, width - 2 * offsetSide);
        const effectiveDepth = Math.max(10, depth - (offsetFront + offsetBack));

        const shelfRule = (shelfRules as any).model_tree?.root_assembly?.subcomponents?.SHELF;
        const roleOverride = (shelfRules as any).parameters?.smart_panel_integration?.role_overrides?.SHELF_BOARD;

        const edgeBanding = roleOverride?.edge_banding || {
            '-Y': { active: true, type_id: '0.008x0.022' },
            '+Y': { active: false, type_id: 'none' },
            '+X': { active: false, type_id: 'none' },
            '-X': { active: false, type_id: 'none' }
        };

        const zCenter = offsetBottom + thickness / 2.0;
        const yCenter = (offsetFront - offsetBack) / 2.0;

        parts.push({
            name: shelfRule?.name || 'Wieniec',
            role: shelfRule?.role || 'SHELF_BOARD',
            dim: { x: effectiveWidth, y: effectiveDepth, z: thickness },
            loc: {
                x: 0,
                y: yCenter,
                z: zCenter
            },
            lcs: shelfRule?.lcs || {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [90, 0, 0],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            },
            edge_banding: edgeBanding,
            features: []
        });

        return { parts };
    }
}
