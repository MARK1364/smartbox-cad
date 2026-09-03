/**
 * shelves-engine.ts — moduł PÓŁKI (smartbox_shelves)
 * Odpowiednik @@BLENDER/A2_smartbox/shelves_2_engine_v1.py + shelves_3_rules_V1.json
 * Nawiercenia: shelves-drilling-builder.ts (osobny plik). To NIE jest wieniec (shelf_*).
 */
import shelvesRules from './shelves_3_rules_V1.json';
import { BaseEngine } from './base-engine.js';

/** Równe wnęki wewnętrzne: (H − n×grubość) / (n+1). */
export function equalShelfBay(height: number, count: number, thickness: number): number {
    if (count <= 0) return height;
    return (height - count * thickness) / (count + 1);
}

/** Środek i-tej półki (1-based), Z=0 = spód SmartBoxa. */
export function equalShelfCenterZ(height: number, count: number, thickness: number, index: number): number {
    const bay = equalShelfBay(height, count, thickness);
    return index * bay + (index - 1) * thickness + thickness / 2;
}

export class ShelvesEngine extends BaseEngine {
    plan(params: any): { parts: any[] } {
        const parts: any[] = [];
        const count = params.shelfCount !== undefined ? params.shelfCount : 3;
        const thickness = params.thickness || 18;
        const width = params.width || 600;
        const height = params.height || 720;
        const depth = params.depth || 500;
        const offsetFront = params.shelfOffsetFront !== undefined ? params.shelfOffsetFront : 10;
        const offsetSide = params.shelfOffsetSide !== undefined ? params.shelfOffsetSide : 0.5;

        const effectiveWidth = width - 2 * offsetSide;
        const effectiveDepth = depth - offsetFront;
        const holePattern = params.holePattern || 'SINGLE';
        const frontInset = params.frontInset ?? 37;
        const backInset = params.backInset ?? 37;
        const frontHoles = params.frontHoles === true;
        const frontOffsetX = params.frontOffsetX ?? 0;
        const backHoles = params.backHoles === true;
        const backOffsetX = params.backOffsetX ?? 0;
        const tripleZOffset = params.tripleZOffset ?? 32;
        const sys32Spacing = params.system32Spacing ?? 32;
        const sys32Count = params.system32HoleCount ?? 5;

        const holeDiameter = 5;
        const holeDepth = 12;
        const radius = holeDiameter / 2;

        const shelfVBack = backInset;
        const shelfVFront = Math.max(backInset, effectiveDepth - frontInset);

        /** Otwory w drzewie pod półką — dzieci Polki (plan.cnc_features). Nie renderują się na meshu półki. */
        const buildShelfSupportHoles = (shelfIndex: number, zCenter: number): any[] => {
            if (holePattern !== 'SINGLE' && holePattern !== 'TRIPLE') return [];

            const features: any[] = [];
            const holeZ = zCenter - thickness / 2 - radius;

            const addHole = (id: string, name: string, face: string, u: number, v: number, clearance = 0) => {
                features.push({
                    id,
                    name,
                    type: 'hole',
                    face,
                    side: face,
                    is_assembly_drilling: true,
                    visible: false,
                    params: {
                        template_id: 'SINGLE',
                        u,
                        v,
                        diameter: holeDiameter,
                        depth: holeDepth,
                        clearance,
                        shelfZ: zCenter,
                        holeZ,
                        is_assembly_drilling: true
                    }
                });
            };

            const uUnderLeft = -radius;
            const uUnderRight = thickness + radius;

            addHole(`hole_shelf_${shelfIndex}_left_front`, 'Lewy przód', 'FACE_X_MINUS', uUnderLeft, shelfVFront, offsetSide);
            addHole(`hole_shelf_${shelfIndex}_left_back`, 'Lewy tył', 'FACE_X_MINUS', uUnderLeft, shelfVBack, offsetSide);
            addHole(`hole_shelf_${shelfIndex}_right_front`, 'Prawy przód', 'FACE_X_PLUS', uUnderRight, shelfVFront, offsetSide);
            addHole(`hole_shelf_${shelfIndex}_right_back`, 'Prawy tył', 'FACE_X_PLUS', uUnderRight, shelfVBack, offsetSide);

            if (holePattern === 'TRIPLE') {
                addHole(`hole_shelf_${shelfIndex}_left_front_top`, 'Lewy przód góra', 'FACE_X_MINUS', uUnderLeft + tripleZOffset, shelfVFront, offsetSide);
                addHole(`hole_shelf_${shelfIndex}_left_front_bottom`, 'Lewy przód dół', 'FACE_X_MINUS', uUnderLeft - tripleZOffset, shelfVFront, offsetSide);
                addHole(`hole_shelf_${shelfIndex}_left_back_top`, 'Lewy tył góra', 'FACE_X_MINUS', uUnderLeft + tripleZOffset, shelfVBack, offsetSide);
                addHole(`hole_shelf_${shelfIndex}_left_back_bottom`, 'Lewy tył dół', 'FACE_X_MINUS', uUnderLeft - tripleZOffset, shelfVBack, offsetSide);
                addHole(`hole_shelf_${shelfIndex}_right_front_top`, 'Prawy przód góra', 'FACE_X_PLUS', uUnderRight - tripleZOffset, shelfVFront, offsetSide);
                addHole(`hole_shelf_${shelfIndex}_right_front_bottom`, 'Prawy przód dół', 'FACE_X_PLUS', uUnderRight + tripleZOffset, shelfVFront, offsetSide);
                addHole(`hole_shelf_${shelfIndex}_right_back_top`, 'Prawy tył góra', 'FACE_X_PLUS', uUnderRight - tripleZOffset, shelfVBack, offsetSide);
                addHole(`hole_shelf_${shelfIndex}_right_back_bottom`, 'Prawy tył dół', 'FACE_X_PLUS', uUnderRight + tripleZOffset, shelfVBack, offsetSide);
            }

            if (frontHoles) {
                const uCenterFront = (effectiveWidth / 2) + frontOffsetX;
                const vUnderFront = thickness + radius;
                addHole(`hole_shelf_${shelfIndex}_center_front`, 'Środek przód', 'FACE_Y_PLUS', uCenterFront, vUnderFront, offsetFront);
                if (holePattern === 'TRIPLE') {
                    addHole(`hole_shelf_${shelfIndex}_center_front_top`, 'Środek przód góra', 'FACE_Y_PLUS', uCenterFront + tripleZOffset, vUnderFront, offsetFront);
                    addHole(`hole_shelf_${shelfIndex}_center_front_bottom`, 'Środek przód dół', 'FACE_Y_PLUS', uCenterFront - tripleZOffset, vUnderFront, offsetFront);
                }
            }

            if (backHoles) {
                const uCenterBack = (effectiveWidth / 2) + backOffsetX;
                const vUnderBack = -radius;
                addHole(`hole_shelf_${shelfIndex}_center_back`, 'Środek tył', 'FACE_Y_MINUS', uCenterBack, vUnderBack, 0);
                if (holePattern === 'TRIPLE') {
                    addHole(`hole_shelf_${shelfIndex}_center_back_top`, 'Środek tył góra', 'FACE_Y_MINUS', uCenterBack + tripleZOffset, vUnderBack, 0);
                    addHole(`hole_shelf_${shelfIndex}_center_back_bottom`, 'Środek tył dół', 'FACE_Y_MINUS', uCenterBack - tripleZOffset, vUnderBack, 0);
                }
            }

            return features;
        };

        if (height > 0) {
            if (count > 0) {
                for (let i = 1; i <= count; i++) {
                    const zCenter = equalShelfCenterZ(height, count, thickness, i);

                    let shelfRule = (shelvesRules as any).model_tree?.root_assembly?.subcomponents?.[`SHELF_${i}`];
                    if (!shelfRule) {
                        shelfRule = (shelvesRules as any).model_tree?.root_assembly?.subcomponents?.[`SHELF_1`];
                    }

                    parts.push({
                        name: `Polka_${i}`,
                        role: 'SHELF_PANEL',
                        dim: { x: effectiveWidth, y: effectiveDepth, z: thickness },
                        loc: {
                            x: 0,
                            y: offsetFront / 2,
                            z: zCenter
                        },
                        lcs: shelfRule?.lcs,
                        features: buildShelfSupportHoles(i, zCenter)
                    });
                }
            }

            if (holePattern === 'ROW' || holePattern === 'SYSTEM_32') {
                const sys32Features: any[] = [];
                const startOffset = params.system32StartOffset ?? 150;
                const spacing = sys32Spacing;
                const totalHoles = sys32Count > 0 ? sys32Count : 10;

                const addSys32Hole = (id: string, name: string, face: string, u: number, zPos: number, clearance = 0) => {
                    sys32Features.push({
                        id,
                        name,
                        type: 'hole',
                        face,
                        side: face,
                        is_assembly_drilling: true,
                        visible: false,
                        params: {
                            template_id: 'SINGLE',
                            u,
                            v: zPos,
                            diameter: holeDiameter,
                            depth: holeDepth,
                            clearance,
                            holeZ: zPos,
                            is_assembly_drilling: true
                        }
                    });
                };

                for (let k = 0; k < totalHoles; k++) {
                    const zPos = startOffset + k * spacing;
                    if (zPos > height - 10) break;

                    addSys32Hole(`sys32_left_front_${k}`, `Sys32 LF ${k + 1}`, 'FACE_X_MINUS', frontInset, zPos, offsetSide);
                    addSys32Hole(`sys32_left_back_${k}`, `Sys32 LB ${k + 1}`, 'FACE_X_MINUS', Math.max(frontInset, effectiveDepth - backInset), zPos, offsetSide);
                    addSys32Hole(`sys32_right_front_${k}`, `Sys32 RF ${k + 1}`, 'FACE_X_PLUS', Math.max(0, effectiveDepth - frontInset), zPos, offsetSide);
                    addSys32Hole(`sys32_right_back_${k}`, `Sys32 RB ${k + 1}`, 'FACE_X_PLUS', backInset, zPos, offsetSide);

                    if (frontHoles) {
                        addSys32Hole(`sys32_front_${k}`, `Sys32 Front ${k + 1}`, 'FACE_Z_PLUS', (effectiveWidth / 2) + frontOffsetX, zPos, offsetFront);
                    }
                    if (backHoles) {
                        addSys32Hole(`sys32_back_${k}`, `Sys32 Back ${k + 1}`, 'FACE_Z_MINUS', (effectiveWidth / 2) - backOffsetX, zPos, 0);
                    }
                }

                parts.push({
                    name: 'System_32',
                    role: 'DRILLING_PATTERN',
                    dim: { x: effectiveWidth, y: height, z: effectiveDepth },
                    loc: {
                        x: 0,
                        y: offsetFront / 2,
                        z: height / 2
                    },
                    lcs: {
                        mapping: { X: 'x', Y: 'y', Z: 'z' },
                        rotation: [0, 0, 0],
                        faces: {
                            INNER: 'FACE_Z_PLUS',
                            OUTER: 'FACE_Z_MINUS'
                        }
                    },
                    features: sys32Features
                });
            }
        }

        return { parts };
    }
}
