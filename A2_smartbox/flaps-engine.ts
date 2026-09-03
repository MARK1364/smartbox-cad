/**
 * flaps-engine.ts — moduł KLAPY (smartbox_flaps)
 * Odpowiednik @@BLENDER/A2_smartbox/flaps_2_engine_v1.py + flaps_3_rules_V1.json
 * Nawiercenia prowadników korpusu: flaps-drilling-builder.ts
 */
import flapsRules from './flaps_3_rules_V1.json';
import { BaseEngine } from './base-engine.js';
import { DEFAULT_HINGE_ID, hingeFrontHolesMm, hingeTemplateId } from '../Biblioteki/okucia/index.js';

const FRONT_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' },
    rotation: [0, 0, 0],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

type HingeSide = 'left' | 'right' | 'center';

export class FlapsEngine extends BaseEngine {
    plan(params: any): { parts: any[] } {
        const width = params.width || 600;
        const height = params.height || 720;
        const depth = params.depth || 500;
        const thickness = params.thickness || params.front_thickness || 18;
        const flapType = (params.flap_type || 'TOP').toUpperCase();
        const isTop = flapType !== 'BOTTOM';

        const ovTop = params.ov_top !== undefined ? Number(params.ov_top) : 14;
        const ovBottom = params.ov_bottom !== undefined ? Number(params.ov_bottom) : 15;
        const ovLeft = params.ov_left !== undefined ? Number(params.ov_left) : 16;
        const ovRight = params.ov_right !== undefined ? Number(params.ov_right) : 16;

        const hingeLeftOffset = params.hinge_left_offset !== undefined ? Number(params.hinge_left_offset) : 80;
        const hingeRightOffset = params.hinge_right_offset !== undefined ? Number(params.hinge_right_offset) : 80;
        const useCenterHinge = !!params.use_center_hinge;
        const hingeId = params.hinge_template || params.library_id || DEFAULT_HINGE_ID;
        const frontHoles = hingeFrontHolesMm(hingeId);
        const templateId = hingeTemplateId(hingeId);

        const flapWidth = width + ovLeft + ovRight;
        const flapHeight = height + ovTop + ovBottom;
        const posX = (ovRight - ovLeft) / 2;
        const posZ = height / 2 + (ovTop - ovBottom) / 2;
        const posY = -(depth / 2 + thickness / 2);

        const hingeUCenter = (side: HingeSide): number => {
            if (side === 'left') return ovLeft + hingeLeftOffset;
            if (side === 'right') return flapWidth - ovRight - hingeRightOffset;
            return flapWidth / 2 - (ovRight - ovLeft) / 2;
        };

        const buildHingeFeatures = (side: HingeSide, hingeKey: string) => {
            const uCenter = hingeUCenter(side);
            const features: any[] = [];

            for (const hole of frontHoles) {
                const isCup = hole.isCup;
                const v = isTop
                    ? flapHeight - hole.edgeDist
                    : hole.edgeDist;
                const u = isCup ? uCenter : (uCenter + hole.yOffset);
                features.push({
                    id: isCup ? `flap_cup_${hingeKey}` : `flap_screw_${hingeKey}_${hole.name || 's'}`,
                    type: 'hole',
                    side: 'FACE_Z_PLUS',
                    face: 'FACE_Z_PLUS',
                    params: {
                        template_id: templateId,
                        u,
                        v,
                        diameter: hole.dia,
                        depth: hole.depth,
                        isFlapCup: isCup,
                        isFlapScrew: !isCup
                    }
                });
            }

            return features;
        };

        const activeHinges: { key: string; side: HingeSide }[] = [];
        if (isTop) {
            activeHinges.push({ key: 'HINGE_TL', side: 'left' });
            activeHinges.push({ key: 'HINGE_TR', side: 'right' });
            if (useCenterHinge) activeHinges.push({ key: 'HINGE_TC', side: 'center' });
        } else {
            activeHinges.push({ key: 'HINGE_BL', side: 'left' });
            activeHinges.push({ key: 'HINGE_BR', side: 'right' });
            if (useCenterHinge) activeHinges.push({ key: 'HINGE_BC', side: 'center' });
        }

        const flapRule = (flapsRules as any).model_tree?.root_assembly?.subcomponents?.FLAP;
        const allFeatures = activeHinges.flatMap((h) => buildHingeFeatures(h.side, h.key));

        const parts: any[] = [{
            name: 'Klapa',
            role: flapRule?.role || 'FLAP',
            dim: { x: flapWidth, y: thickness, z: flapHeight },
            loc: { x: posX, y: posY, z: posZ },
            lcs: flapRule?.lcs || FRONT_LCS,
            features: allFeatures
        }];

        return { parts };
    }
}
