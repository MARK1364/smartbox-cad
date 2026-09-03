/**
 * tubes-engine.ts — moduł DRĄŻEK (smartbox_tubes)
 * Odpowiednik @@BLENDER/A2_smartbox/tubes_2_engine_v1.py + tubes_3_rules_V1.json
 * Bez nawierceń korpusu (otwory rozet zostają w JSON machining_library).
 */
import tubesRules from './tubes_3_rules_V1.json';
import { BaseEngine } from './base-engine.js';

export class TubesEngine extends BaseEngine {
    plan(params: any): { parts: any[] } {
        const parts: any[] = [];
        const width = params.width || 600;
        const height = params.height || 720;
        const depth = params.depth || 500;

        const offsetTop = params.offsetTop !== undefined ? params.offsetTop : (params.offset_top !== undefined ? params.offset_top : 70);
        const showShelf = params.showShelf !== undefined ? params.showShelf : (params.show_shelf !== undefined ? !!params.show_shelf : false);
        const spaceAboveShelf = params.spaceAboveShelf !== undefined ? params.spaceAboveShelf : (params.space_above_shelf !== undefined ? params.space_above_shelf : 100);
        const shelfThickness = params.shelfThickness !== undefined ? params.shelfThickness : (params.shelf_thickness !== undefined ? params.shelf_thickness : 18);

        const tree = (tubesRules as any).model_tree?.root_assembly?.subcomponents || {};
        const rodSys = tree.ROD_SYSTEM?.subcomponents || {};
        const rodRule = rodSys.ROD || {};
        const leftRule = rodSys.HOLDER_LEFT || {};
        const rightRule = rodSys.HOLDER_RIGHT || {};
        const shelfRule = tree.SHELF || {};
        const shelfOverride = (tubesRules as any).parameters?.smart_panel_integration?.role_overrides?.TOP_SHELF;
        const rodDiameter = params.rodDiameter || rodRule.diameter || 25;

        let shelfZ: number | null = null;
        let rodZ: number;

        if (showShelf) {
            shelfZ = height - spaceAboveShelf - (shelfThickness / 2.0);
            rodZ = shelfZ - (shelfThickness / 2.0) - offsetTop;

            const shelfW = Math.max(10, width - 4);
            const shelfD = Math.max(10, depth - 10);

            parts.push({
                name: shelfRule.name || 'Polka_Nad_Drazkiem',
                role: shelfRule.role || 'SHELF_PANEL',
                dim: { x: shelfW, y: shelfD, z: shelfThickness },
                loc: { x: 0, y: 5, z: shelfZ },
                lcs: shelfRule.lcs || {
                    mapping: { X: 'x', Y: 'y', Z: 'z' },
                    rotation: [90, 0, 0],
                    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
                },
                edge_banding: shelfOverride?.edge_banding || {
                    "-Y": { active: true, type_id: "0.008x0.022" },
                    "+Y": { active: false, type_id: "none" },
                    "+X": { active: false, type_id: "none" },
                    "-X": { active: false, type_id: "none" }
                },
                features: []
            });
        } else {
            rodZ = height - offsetTop;
        }

        const rodLength = Math.max(10, width - 2);
        parts.push({
            name: rodRule.name || 'Drazek_fi25',
            role: rodRule.role || 'TUBE_ROD',
            dim: { x: rodLength, y: rodDiameter, z: rodDiameter },
            loc: { x: 0, y: 0, z: rodZ },
            custom_properties: rodRule.custom_properties || {
                material: 'Aluminium_Chrome',
                shape: 'CYLINDER'
            },
            features: []
        });

        const holderThick = 15;
        const holderDia = 48;
        parts.push({
            name: leftRule.name || 'Uchwyt_Lewy',
            role: leftRule.role || 'HOLDER',
            dim: { x: holderThick, y: holderDia, z: holderDia },
            loc: { x: -width / 2 + holderThick / 2, y: 0, z: rodZ },
            custom_properties: leftRule.custom_properties || {
                material: 'Aluminium_Chrome',
                shape: 'CYLINDER'
            },
            features: []
        });

        parts.push({
            name: rightRule.name || 'Uchwyt_Prawy',
            role: rightRule.role || 'HOLDER',
            dim: { x: holderThick, y: holderDia, z: holderDia },
            loc: { x: width / 2 - holderThick / 2, y: 0, z: rodZ },
            custom_properties: rightRule.custom_properties || {
                material: 'Aluminium_Chrome',
                shape: 'CYLINDER'
            },
            features: []
        });

        return { parts };
    }
}
