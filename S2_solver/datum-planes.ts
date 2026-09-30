/**
 * Datum planes (Top / Front / Right) — stałe płaszczyzny WCS do więzów.
 * Mesh w viewportcie: metadata.type === 'datum_plane', name = etykieta.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { renderToCAD } from '../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { makeAnchor, type ConstraintAnchor } from './constraint-types.js';
import type { Vec3 as SolverVec3 } from './core/math3d.js';

export type DatumPlaneName = 'Top' | 'Front' | 'Right';

export const DATUM_NODE_PREFIX = '__DATUM__:';

/** Fallback CAD (Z-up), gdy mesh nie jest dostępny. */
const FALLBACK_NORMAL: Record<DatumPlaneName, SolverVec3> = {
    Top: [0, 0, 1],
    Front: [0, 1, 0],
    Right: [1, 0, 0],
};

export function isDatumNodeId(nodeId: string | null | undefined): boolean {
    return Boolean(nodeId && String(nodeId).startsWith(DATUM_NODE_PREFIX));
}

export function isDatumAnchor(anchor: ConstraintAnchor | null | undefined): boolean {
    return Boolean(anchor && (anchor.kind === 'DATUM' || isDatumNodeId(anchor.nodeId)));
}

export function datumNameFromNodeId(nodeId: string): DatumPlaneName | null {
    if (!isDatumNodeId(nodeId)) return null;
    const name = nodeId.slice(DATUM_NODE_PREFIX.length);
    if (name === 'Top' || name === 'Front' || name === 'Right') return name;
    return null;
}

export function datumNodeId(name: DatumPlaneName): string {
    return `${DATUM_NODE_PREFIX}${name}`;
}

export function parseDatumPlaneName(raw: string | null | undefined): DatumPlaneName | null {
    const s = String(raw || '').trim();
    if (s === 'Top' || s === 'Front' || s === 'Right') return s;
    if (s === 'TopPlane') return 'Top';
    if (s === 'FrontPlane') return 'Front';
    if (s === 'RightPlane') return 'Right';
    return null;
}

/** Normalna i punkt płaszczyzny w CAD WCS [mm]. */
export function getDatumWorldPose(name: DatumPlaneName): {
    pointMm: SolverVec3;
    normalMm: SolverVec3;
} {
    const viewport = ContextManager.instance?.viewport as any;
    const mesh = viewport?.datumPlanes?.find(
        (p: any) => parseDatumPlaneName(p?.metadata?.name || p?.name) === name
    );
    if (mesh?.getWorldMatrix) {
        try {
            const BABYLON = (window as any).BABYLON;
            if (BABYLON?.Vector3) {
                const m = mesh.getWorldMatrix();
                const nBab = BABYLON.Vector3.TransformNormal(
                    new BABYLON.Vector3(0, 0, 1),
                    m
                ).normalize();
                const pBab = BABYLON.Vector3.TransformCoordinates(
                    new BABYLON.Vector3(0, 0, 0),
                    m
                );
                const nCad = renderToCAD(new Vec3(nBab.x, nBab.y, nBab.z)).normalize();
                const pCad = renderToCAD(new Vec3(pBab.x, pBab.y, pBab.z));
                return {
                    pointMm: [pCad.x, pCad.y, pCad.z],
                    normalMm: [nCad.x, nCad.y, nCad.z],
                };
            }
        } catch {
            /* fallback */
        }
    }
    return {
        pointMm: [0, 0, 0],
        normalMm: [...FALLBACK_NORMAL[name]] as SolverVec3,
    };
}

export function makeDatumAnchor(name: DatumPlaneName): ConstraintAnchor {
    const pose = getDatumWorldPose(name);
    return makeAnchor({
        nodeId: datumNodeId(name),
        kind: 'DATUM',
        faceName: name,
        localPointMm: pose.pointMm,
        localNormalMm: pose.normalMm,
        quadCenterMm: pose.pointMm,
        quadWidthMm: 500,
        quadHeightMm: 500,
    });
}

export function setDatumPlanesPickable(pickable: boolean): void {
    const viewport = ContextManager.instance?.viewport as any;
    const planes = viewport?.datumPlanes;
    if (!Array.isArray(planes)) return;
    for (const p of planes) {
        if (!p) continue;
        p.isPickable = pickable;
    }
}
