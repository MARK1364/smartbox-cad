/**
 * pillars-engine — plan filarów / fills [mm].
 */

import pillarsRules from './pillars_3_rules_V1.json';
import { rulesMToMm } from '../A1_core/cad-math/units.js';
import type { SmartWallFillMm, SmartWallPartPlanMm } from './smartwall-types.js';
import { WALL_ALONG_X_LCS, WALL_DEFAULT_COLOR, WALL_SURFACE_EDGE_BANDING } from './walls-engine.js';

function defSideMm(): number {
    const raw = (pillarsRules as any)?.defaults?.pillar_side_m;
    return rulesMToMm(typeof raw === 'number' ? raw : 0.2, 200);
}

function defHeightMm(): number {
    const raw = (pillarsRules as any)?.defaults?.pillar_height_m;
    return rulesMToMm(typeof raw === 'number' ? raw : 2.7, 2700);
}

export function planPillars(fills: SmartWallFillMm[] | undefined, defaultHeightMm?: number): { parts: SmartWallPartPlanMm[] } {
    if (!fills || fills.length === 0) return { parts: [] };
    const H0 = defaultHeightMm ?? defHeightMm();
    const parts: SmartWallPartPlanMm[] = [];
    for (const f of fills) {
        const length = f.length > 0 ? f.length : defSideMm();
        const thickness = f.thickness > 0 ? f.thickness : defSideMm();
        const height = f.height && f.height > 0 ? f.height : H0;
        const yaw = f.yawDeg ?? 0;
        // Jak ściana przód: bez Rx90 (w widoku Rx90 = płasko jak podłoga).
        const lcs = {
            mapping: WALL_ALONG_X_LCS.mapping,
            rotation: [0, 0, yaw] as [number, number, number],
        };
        parts.push({
            key: f.key,
            name: f.name || 'Filar',
            role: 'WALL_PILLAR',
            // środek filara; z = połowa wysokości
            loc: { x: f.x, y: f.y, z: (f.z != null && f.z > 0) ? f.z : height / 2 },
            dim: { x: length, y: thickness, z: height },
            rotationDeg: lcs.rotation,
            lcs,
            edge_banding: WALL_SURFACE_EDGE_BANDING,
            color: WALL_DEFAULT_COLOR,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'wall_segment',
                shape: 'wall_pillar',
            },
        });
    }
    return { parts };
}

export function defaultPillarFillMm(key = 'PILLAR_1'): SmartWallFillMm {
    const s = defSideMm();
    return {
        key,
        name: 'Filar',
        x: 0,
        y: 0,
        length: s,
        thickness: s,
        height: defHeightMm(),
    };
}
