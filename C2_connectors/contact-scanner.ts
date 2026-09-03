/**
 * Wykrywanie styku płaszczyzn — port scan_for_eligible_connector_faces z A6.
 *
 * Warunki (jak w Blenderze):
 *  1. Promień ze środka ściany: 1 mm wstecz + 0.05 mm w przód. Szczelina 0.5 mm
 *     (półka–bok) NIE jest stykiem — złącza nie wolno tam dać.
 *  2. Trafiona ściana musi patrzeć przeciwnie (dot < -0.5) — odrzuca krawędzie.
 *  3. Osie grubości płyt muszą być prostopadłe (|dot| < 0.5) — bez wieniec–wieniec.
 *  4. Część wspólna AABB na płaszczyźnie styku > 5×5 mm.
 *
 * Praca w mm, układ CAD (Z-up), na OBB formatki — odpowiednik ray_cast mesha skrzynki.
 */

import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import {
    getLocalBoxMm,
    localMmToWorldMm,
    resolveFaceLocalMm,
    resolveFaceQuadMm,
    worldMmToLocalMm,
} from '../S2_solver/constraint-geometry.js';
import type { Vec3 as SolverVec3 } from '../S2_solver/core/math3d.js';
import {
    CONTACT_BACKOFF_MM,
    CONTACT_MIN_OVERLAP_MM,
    CONTACT_TOLERANCE_MM,
    OPPOSING_NORMAL_DOT,
    PARALLEL_DOT_THRESHOLD,
    PICK_EDGE_SLACK_MM,
    type EligibleContactFace,
    type Vec3Tuple,
} from './connectors-types.js';

const SCAN_FACE_NAMES = [
    'FACE_X_PLUS',
    'FACE_X_MINUS',
    'FACE_Y_PLUS',
    'FACE_Y_MINUS',
    'FACE_Z_PLUS',
    'FACE_Z_MINUS',
] as const;

function asTuple(v: Vec3): Vec3Tuple {
    return [v.x, v.y, v.z];
}

function fromTuple(t: SolverVec3 | Vec3Tuple): Vec3 {
    return new Vec3(t[0], t[1], t[2]);
}

export function isCabinetPartForConnectors(node: CADNode | null): boolean {
    if (!node || node.nodeType !== NodeType.PART) return false;
    const d = node.domainData as any;
    if (!d) return false;
    if (d.visible === false) return false;
    const name = String(node.name || d.name || '').toUpperCase();
    if (name.includes('FRAME')) return false;
    if (d.is_connector || d.role === 'CONNECTOR') return false;
    if (d.report_type === 'plyty') return true;
    if (d.smartId) return true;
    if (d.sb_role || d.role) return true;
    if (d.edgeBanding && Object.keys(d.edgeBanding).length > 0) return true;
    if (d.type === 'part' || d.type === 'panel') return true;
    return true;
}

/** Oś grubości w świecie: najcieńszy wymiar lokalnego OBB (jak obj.dimensions w Blenderze). */
export function panelThicknessAxisWorld(node: CADNode): Vec3 {
    const box = getLocalBoxMm(node);
    const { rotation } = node.getWorldMatrix().decompose();
    if (!box) {
        return rotation.rotateVec3(Vec3.UNIT_Y).normalize();
    }
    const sx = box.max[0] - box.min[0];
    const sy = box.max[1] - box.min[1];
    const sz = box.max[2] - box.min[2];
    let local = Vec3.UNIT_Y;
    if (sx <= sy && sx <= sz) local = Vec3.UNIT_X;
    else if (sy <= sx && sy <= sz) local = Vec3.UNIT_Y;
    else local = Vec3.UNIT_Z;
    return rotation.rotateVec3(local).normalize();
}

export function connectorPartsArePerpendicular(a: CADNode, b: CADNode): boolean {
    const ta = panelThicknessAxisWorld(a);
    const tb = panelThicknessAxisWorld(b);
    return Math.abs(ta.dot(tb)) < PARALLEL_DOT_THRESHOLD;
}

function worldDirToLocal(node: CADNode, dir: Vec3): Vec3 {
    const { rotation } = node.getWorldMatrix().decompose();
    return rotation.inverse().rotateVec3(dir);
}

function localDirToWorld(node: CADNode, dir: SolverVec3): Vec3 {
    const { rotation } = node.getWorldMatrix().decompose();
    return rotation.rotateVec3(fromTuple(dir)).normalize();
}

function boxCornersWorld(node: CADNode): Vec3[] {
    const box = getLocalBoxMm(node);
    if (!box) return [];
    const corners: Vec3[] = [];
    for (const x of [box.min[0], box.max[0]]) {
        for (const y of [box.min[1], box.max[1]]) {
            for (const z of [box.min[2], box.max[2]]) {
                corners.push(localMmToWorldMm(node, [x, y, z]));
            }
        }
    }
    return corners;
}

function faceCornersWorld(node: CADNode, faceName: string): Vec3[] | null {
    const quad = resolveFaceQuadMm(node, faceName);
    if (!quad) return null;
    const u = fromTuple(quad.uAxis).normalize();
    const v = fromTuple(quad.vAxis).normalize();
    const c = fromTuple(quad.center);
    const hw = quad.width / 2;
    const hh = quad.height / 2;
    const local = [
        c.add(u.scale(hw)).add(v.scale(hh)),
        c.add(u.scale(-hw)).add(v.scale(hh)),
        c.add(u.scale(-hw)).add(v.scale(-hh)),
        c.add(u.scale(hw)).add(v.scale(-hh)),
    ];
    return local.map((p) => localMmToWorldMm(node, [p.x, p.y, p.z]));
}

/**
 * Slab ray vs AABB. Zwraca t (odległość w jednostkach dir, dir powinien być jednostkowy)
 * oraz lokalną normalną trafionej ściany.
 */
export function rayAabb(
    origin: Vec3,
    dir: Vec3,
    min: Vec3,
    max: Vec3,
    maxDist: number,
): { t: number; normal: Vec3 } | null {
    let tmin = 0;
    let tmax = maxDist;
    let hitAxis: 0 | 1 | 2 = 0;
    let hitSign = 1;

    const o = [origin.x, origin.y, origin.z];
    const d = [dir.x, dir.y, dir.z];
    const bmin = [min.x, min.y, min.z];
    const bmax = [max.x, max.y, max.z];

    for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-12) {
            if (o[i] < bmin[i] || o[i] > bmax[i]) return null;
            continue;
        }
        const inv = 1 / d[i];
        let t0 = (bmin[i] - o[i]) * inv;
        let t1 = (bmax[i] - o[i]) * inv;
        let sign = -1;
        if (t0 > t1) {
            const tmp = t0;
            t0 = t1;
            t1 = tmp;
            sign = 1;
        } else {
            sign = -1;
        }
        if (t0 > tmin) {
            tmin = t0;
            hitAxis = i as 0 | 1 | 2;
            hitSign = sign;
        }
        if (t1 < tmax) tmax = t1;
        if (tmin > tmax) return null;
    }

    if (tmin < 0 || tmin > maxDist) return null;
    const normalArr: [number, number, number] = [0, 0, 0];
    normalArr[hitAxis] = hitSign;
    return { t: tmin, normal: new Vec3(normalArr[0], normalArr[1], normalArr[2]) };
}

function projectToPlane2d(
    p: Vec3,
    planeCo: Vec3,
    uAx: Vec3,
    vAx: Vec3,
): [number, number] {
    const d = p.sub(planeCo);
    return [d.dot(uAx), d.dot(vAx)];
}

function aabbOverlap2d(
    a: { minX: number; maxX: number; minY: number; maxY: number },
    b: { minX: number; maxX: number; minY: number; maxY: number },
): { minX: number; maxX: number; minY: number; maxY: number } | null {
    const minX = Math.max(a.minX, b.minX);
    const maxX = Math.min(a.maxX, b.maxX);
    const minY = Math.max(a.minY, b.minY);
    const maxY = Math.min(a.maxY, b.maxY);
    if (maxX - minX <= CONTACT_MIN_OVERLAP_MM || maxY - minY <= CONTACT_MIN_OVERLAP_MM) {
        return null;
    }
    return { minX, maxX, minY, maxY };
}

function bounds2d(pts: Array<[number, number]>) {
    return {
        minX: Math.min(...pts.map((p) => p[0])),
        maxX: Math.max(...pts.map((p) => p[0])),
        minY: Math.min(...pts.map((p) => p[1])),
        maxY: Math.max(...pts.map((p) => p[1])),
    };
}

export function collectConnectorParts(document: { getPanels?: () => CADNode[] } | null): CADNode[] {
    if (!document?.getPanels) return [];
    return document.getPanels().filter(isCabinetPartForConnectors);
}

export function scanEligibleConnectorFaces(document: { getPanels?: () => CADNode[] } | null): EligibleContactFace[] {
    const parts = collectConnectorParts(document);
    if (parts.length < 2) return [];

    const rayDistance = CONTACT_BACKOFF_MM + CONTACT_TOLERANCE_MM;
    const results: EligibleContactFace[] = [];

    for (const obj of parts) {
        const box = getLocalBoxMm(obj);
        if (!box) continue;

        for (const faceName of SCAN_FACE_NAMES) {
            const face = resolveFaceLocalMm(obj, faceName);
            const corners = faceCornersWorld(obj, faceName);
            if (!face || !corners || corners.length < 3) continue;

            const centerWorld = localMmToWorldMm(obj, face[0]);
            const normalWorld = localDirToWorld(obj, face[1]);
            const rayOrigin = centerWorld.sub(normalWorld.scale(CONTACT_BACKOFF_MM));

            let touching: CADNode | null = null;
            let hitNormalWorld: Vec3 | null = null;

            for (const other of parts) {
                if (other === obj || other.id === obj.id) continue;
                const otherBox = getLocalBoxMm(other);
                if (!otherBox) continue;

                const oriLocal = fromTuple(worldMmToLocalMm(other, rayOrigin));
                const dirLocal = worldDirToLocal(other, normalWorld);
                if (dirLocal.lengthSquared() < 1e-16) continue;
                const dirN = dirLocal.normalize();
                const hit = rayAabb(
                    oriLocal,
                    dirN,
                    new Vec3(otherBox.min[0], otherBox.min[1], otherBox.min[2]),
                    new Vec3(otherBox.max[0], otherBox.max[1], otherBox.max[2]),
                    rayDistance,
                );
                if (!hit) continue;

                const nWorld = localDirToWorld(other, [hit.normal.x, hit.normal.y, hit.normal.z]);
                if (normalWorld.dot(nWorld) < OPPOSING_NORMAL_DOT) {
                    touching = other;
                    hitNormalWorld = nWorld;
                    break;
                }
            }

            if (!touching || !hitNormalWorld) continue;
            if (!connectorPartsArePerpendicular(obj, touching)) continue;

            const planeCo = centerWorld;
            const planeNo = normalWorld;
            let uAx = corners[1].sub(corners[0]);
            if (uAx.lengthSquared() < 1e-10) {
                uAx = corners[2].sub(corners[0]);
            }
            uAx = uAx.normalize();
            let vAx = planeNo.cross(uAx);
            if (vAx.lengthSquared() < 1e-10) {
                vAx = Vec3.UNIT_X.cross(planeNo);
            }
            vAx = vAx.normalize();
            uAx = vAx.cross(planeNo).normalize();

            const poly2d = corners.map((c) => projectToPlane2d(c, planeCo, uAx, vAx));
            const other2d = boxCornersWorld(touching).map((c) => projectToPlane2d(c, planeCo, uAx, vAx));
            const overlap = aabbOverlap2d(bounds2d(poly2d), bounds2d(other2d));
            if (!overlap) continue;

            const from2d = (x: number, y: number) => planeCo.add(uAx.scale(x)).add(vAx.scale(y));
            const clipped = [
                from2d(overlap.minX, overlap.minY),
                from2d(overlap.maxX, overlap.minY),
                from2d(overlap.maxX, overlap.maxY),
                from2d(overlap.minX, overlap.maxY),
            ];

            results.push({
                panelId: obj.id,
                otherPanelId: touching.id,
                faceName,
                centerWorldMm: asTuple(centerWorld),
                normalWorldMm: asTuple(normalWorld),
                clippedVertsWorldMm: clipped.map(asTuple),
            });
        }
    }

    return results;
}

export function pointInPolygon2d(px: number, py: number, poly: Array<[number, number]>): boolean {
    let inside = false;
    const n = poly.length;
    let j = n - 1;
    for (let i = 0; i < n; i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi) {
            inside = !inside;
        }
        j = i;
    }
    return inside;
}

export function distanceToSegment(p: Vec3, a: Vec3, b: Vec3): number {
    const e = b.sub(a);
    const el = e.length();
    if (el < 1e-12) return p.sub(a).length();
    const t = Math.max(0, Math.min(el, p.sub(a).dot(e.scale(1 / el))));
    return p.sub(a.add(e.scale(1 / el).scale(t))).length();
}

export function pickEligibleFace(
    faces: EligibleContactFace[],
    rayOrigin: Vec3,
    rayDir: Vec3,
): EligibleContactFace | null {
    let best: EligibleContactFace | null = null;
    let distMin = Infinity;

    for (const face of faces) {
        const verts = face.clippedVertsWorldMm.map((v) => new Vec3(v[0], v[1], v[2]));
        if (verts.length < 3) continue;
        let acc = Vec3.ZERO;
        for (const v of verts) acc = acc.add(v);
        const planeCo = acc.scale(1 / verts.length);
        const planeNo = new Vec3(face.normalWorldMm[0], face.normalWorldMm[1], face.normalWorldMm[2]).normalize();
        const denom = planeNo.dot(rayDir);
        if (Math.abs(denom) < 1e-8) continue;
        const t = planeNo.dot(planeCo.sub(rayOrigin)) / denom;
        if (t < 0) continue;
        const pt = rayOrigin.add(rayDir.scale(t));

        let uAx = verts[1].sub(verts[0]);
        if (uAx.lengthSquared() < 1e-12) uAx = verts[2].sub(verts[0]);
        uAx = uAx.normalize();
        let vAx = planeNo.cross(uAx);
        if (vAx.lengthSquared() < 1e-12) continue;
        vAx = vAx.normalize();

        const to2d = (p: Vec3): [number, number] => {
            const d = p.sub(planeCo);
            return [d.dot(uAx), d.dot(vAx)];
        };
        const [px, py] = to2d(pt);
        const poly = verts.map(to2d);
        const inside = pointInPolygon2d(px, py, poly);
        if (!inside) {
            if (PICK_EDGE_SLACK_MM <= 0) continue;
            let minD = Infinity;
            for (let i = 0; i < verts.length; i++) {
                minD = Math.min(minD, distanceToSegment(pt, verts[i], verts[(i + 1) % verts.length]));
            }
            if (minD > PICK_EDGE_SLACK_MM) continue;
        }
        if (t < distMin) {
            distMin = t;
            best = face;
        }
    }
    return best;
}
