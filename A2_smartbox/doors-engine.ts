/**
 * doors-engine.ts — moduł DRZWI (smartbox_doors)
 * Odpowiednik @@BLENDER/A2_smartbox/doors_2_engine_v1.py + doors_3_rules_V1.json
 * Nawiercenia zawiasów: doors-drilling-builder.ts (osobny plik).
 */
import doorsRules from './doors_3_rules_V1.json';
import { BaseEngine } from './base-engine.js';
import { DEFAULT_HINGE_ID, hingeFrontHolesMm, hingeTemplateId } from '../Biblioteki/okucia/index.js';

export class DoorsEngine extends BaseEngine {
    plan(params: any): { parts: any[] } {
        const parts: any[] = [];
        const width = params.width || 600;
        const height = params.height || 720;
        const depth = params.depth || 500;
        const thickness = params.thickness || params.front_thickness || 18;
        const doorType = (params.door_type || params.doorType || 'LEFT').toUpperCase();
        const gap = params.gap !== undefined ? Number(params.gap) : 4;

        // Nałożenia frontu na korpus (w mm) - obsługują również wartości ujemne
        const ovTop = params.ov_top !== undefined ? Number(params.ov_top) : 14;
        const ovBottom = params.ov_bottom !== undefined ? Number(params.ov_bottom) : 15;
        const ovLeft = params.ov_left !== undefined ? Number(params.ov_left) : 16;
        const ovRight = params.ov_right !== undefined ? Number(params.ov_right) : 16;

        // Zbierz listę aktywnych zawiasów
        const hinges: { index: number; localZ: number }[] = [];

        // Hinge 1
        if (params.use_hinge_1 !== false) {
            const pos1 = params.hinge_1_pos !== undefined ? Number(params.hinge_1_pos) : 120;
            hinges.push({ index: 1, localZ: pos1 });
        }
        // Hinge 2
        if (params.use_hinge_2) {
            const pos2 = params.hinge_2_pos !== undefined ? Number(params.hinge_2_pos) : 570;
            hinges.push({ index: 2, localZ: pos2 });
        }
        // Hinge 3
        if (params.use_hinge_3) {
            const pos3 = params.hinge_3_pos !== undefined ? Number(params.hinge_3_pos) : 910;
            hinges.push({ index: 3, localZ: pos3 });
        }
        // Hinge 4
        if (params.use_hinge_4) {
            const pos4 = params.hinge_4_pos !== undefined ? Number(params.hinge_4_pos) : 1230;
            hinges.push({ index: 4, localZ: pos4 });
        }
        // Hinge 5
        if (params.use_hinge_5) {
            const pos5 = params.hinge_5_pos !== undefined ? Number(params.hinge_5_pos) : 1580;
            hinges.push({ index: 5, localZ: pos5 });
        }
        // Hinge 6 (Liczony od góry)
        if (params.use_hinge_6 !== false) {
            const pos6 = params.hinge_6_pos !== undefined ? Number(params.hinge_6_pos) : 120;
            hinges.push({ index: 6, localZ: Math.max(0, height - pos6) });
        }

        const hingeId = params.hinge_template || params.hingeTemplate || DEFAULT_HINGE_ID;
        const frontHoles = hingeFrontHolesMm(hingeId);
        const templateId = hingeTemplateId(hingeId);

        const totalDoorHeight = height + ovTop + ovBottom;
        const posZ = height / 2 + (ovTop - ovBottom) / 2;
        // W układzie CADNode, przód korpusu to -depth/2 (współrzędna Y)
        const posY = -(depth / 2 + thickness / 2);

        const buildHingeFeatures = (side: 'left' | 'right', doorWidth: number) => {
            const features: any[] = [];

            for (const hinge of hinges) {
                const vCenter = hinge.localZ + ovBottom;

                for (const hole of frontHoles) {
                    const u = side === 'left' ? hole.edgeDist : (doorWidth - hole.edgeDist);
                    const kind = hole.isCup ? 'cup' : 'screw';
                    const suffix = hole.isCup ? '' : `_${hole.name || 's'}`;
                    features.push({
                        id: `hinge_${kind}_${side}_${hinge.index}${suffix}`,
                        type: 'hole',
                        side: 'FACE_Z_PLUS',
                        face: 'FACE_Z_PLUS',
                        params: {
                            template_id: templateId,
                            u,
                            v: vCenter + hole.yOffset,
                            diameter: hole.dia,
                            depth: hole.depth,
                            isDoorCup: hole.isCup,
                            isDoorScrew: !hole.isCup
                        }
                    });
                }
            }

            return features;
        };

        const rootSubs = (doorsRules as any).model_tree?.root_assembly?.subcomponents || {};
        const doorLRule = rootSubs.DOOR_L;
        const doorRRule = rootSubs.DOOR_R;

        if (doorType === 'LEFT' || doorType === 'RIGHT') {
            // Pojedyncze drzwi
            const doorWidth = width + ovLeft + ovRight;
            const posX = (ovRight - ovLeft) / 2;
            const hingeSide = doorType === 'LEFT' ? 'left' : 'right';
            const doorRule = doorType === 'LEFT' ? doorLRule : doorRRule;

            parts.push({
                name: doorType === 'LEFT' ? 'Drzwi_Lewe' : 'Drzwi_Prawe',
                role: 'FRONT',
                dim: { x: doorWidth, y: thickness, z: totalDoorHeight },
                loc: { x: posX, y: posY, z: posZ },
                lcs: doorRule?.lcs || {
                    mapping: { X: 'x', Y: 'z', Z: 'y' },
                    rotation: [0, 0, 0],
                    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
                },
                features: buildHingeFeatures(hingeSide, doorWidth)
            });
        } else if (doorType === 'DOUBLE') {
            // Podwójne drzwi
            const baseW = (width - gap) / 2;
            const doorWLeft = baseW + ovLeft;
            const doorWRight = baseW + ovRight;

            // Pozycja X dla lewego i prawego skrzydła
            const posLeftX = -width / 2 - ovLeft + doorWLeft / 2;
            const posRightX = width / 2 + ovRight - doorWRight / 2;

            parts.push({
                name: 'Drzwi_Lewe',
                role: 'FRONT',
                dim: { x: doorWLeft, y: thickness, z: totalDoorHeight },
                loc: { x: posLeftX, y: posY, z: posZ },
                lcs: doorLRule?.lcs || {
                    mapping: { X: 'x', Y: 'z', Z: 'y' },
                    rotation: [0, 0, 0],
                    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
                },
                features: buildHingeFeatures('left', doorWLeft)
            });

            parts.push({
                name: 'Drzwi_Prawe',
                role: 'FRONT',
                dim: { x: doorWRight, y: thickness, z: totalDoorHeight },
                loc: { x: posRightX, y: posY, z: posZ },
                lcs: doorRRule?.lcs || {
                    mapping: { X: 'x', Y: 'z', Z: 'y' },
                    rotation: [0, 0, 0],
                    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
                },
                features: buildHingeFeatures('right', doorWRight)
            });
        }

        return { parts };
    }
}
