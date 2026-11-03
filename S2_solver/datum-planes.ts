/**
 * Datum planes (Top / Front / Right) oraz poziomy wysokości Z (DATUM_LEVEL) — płaszczyzny WCS do więzów.
 * Mesh w viewportcie: metadata.type === 'datum_plane' lub 'datum_level' / 'datum_level_plane'.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { renderToCAD } from '../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
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

export function isDatumLevelNode(node: CADNode | null | undefined): boolean {
    if (!node) return false;
    return node.nodeType === NodeType.DATUM_LEVEL || node.nodeType === NodeType.GLC_FRAME;
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

/** Zwraca wysokość Z [mm] węzła DATUM_LEVEL lub górnego czubka osi Z (GLC_FRAME) w dokumencie. */
export function getDatumLevelZMm(levelNode: CADNode): number {
    if (levelNode.nodeType === NodeType.GLC_FRAME) {
        const tipZ_nm = (levelNode.domainData as any)?.tipZ_nm;
        if (typeof tipZ_nm === 'number' && tipZ_nm > 0) {
            return nmToMm(tipZ_nm);
        }
        const axisZ_nm = (levelNode.domainData as any)?.axisZHeight_nm;
        if (typeof axisZ_nm === 'number' && axisZ_nm > 0) {
            return nmToMm(axisZ_nm) + 30;
        }
        return 2430;
    }
    const z_nm = (levelNode.domainData as any)?.z_nm ?? levelNode.localMatrix.getTranslation().z ?? 0;
    return nmToMm(z_nm);
}

/** Tworzy kotwicę DATUM wskazującą na poziom wysokości Z (DATUM_LEVEL) lub górny czubek osi Z w GLC. */
export function makeDatumLevelAnchor(levelNode: CADNode): ConstraintAnchor {
    const z_mm = getDatumLevelZMm(levelNode);
    const pointMm: SolverVec3 = [0, 0, z_mm];
    const normalMm: SolverVec3 = [0, 0, 1];
    const faceLabel = levelNode.nodeType === NodeType.GLC_FRAME
        ? `Góra osi Z = ${Math.round(z_mm)} mm`
        : (levelNode.name || `Poziom Z = ${Math.round(z_mm)} mm`);
    return makeAnchor({
        nodeId: levelNode.id,
        kind: 'DATUM',
        faceName: faceLabel,
        localPointMm: pointMm,
        localNormalMm: normalMm,
        quadCenterMm: pointMm,
        quadWidthMm: 1000,
        quadHeightMm: 1000,
    });
}

/**
 * Rozwiązuje pozycję i normalną w świecie CAD [mm] dla dowolnej kotwicy DATUM
 * (zarówno stałych płaszczyzn Top/Front/Right, jak i dynamicznych węzłów DATUM_LEVEL).
 */
export function resolveDatumAnchorPose(
    anchor: ConstraintAnchor,
    document?: ProjectDocument | null,
): { pointMm: SolverVec3; normalMm: SolverVec3 } | null {
    if (document && anchor.nodeId && !isDatumNodeId(anchor.nodeId)) {
        const levelNode = document.findNode(anchor.nodeId);
        if (levelNode && isDatumLevelNode(levelNode)) {
            const z_mm = getDatumLevelZMm(levelNode);
            return {
                pointMm: [0, 0, z_mm],
                normalMm: [0, 0, 1],
            };
        }
    }
    const name =
        parseDatumPlaneName(anchor.faceName) ||
        datumNameFromNodeId(anchor.nodeId);
    if (name) {
        if (anchor.localPointMm && anchor.localNormalMm) {
            return {
                pointMm: [...anchor.localPointMm] as SolverVec3,
                normalMm: [...anchor.localNormalMm] as SolverVec3,
            };
        }
        return getDatumWorldPose(name);
    }
    if (anchor.localPointMm && anchor.localNormalMm) {
        return {
            pointMm: [...anchor.localPointMm] as SolverVec3,
            normalMm: [...anchor.localNormalMm] as SolverVec3,
        };
    }
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
