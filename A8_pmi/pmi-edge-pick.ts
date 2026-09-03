/**
 * PMI Edge Pick — wybór krawędzi liczony w pikselach ekranu.
 *
 * Raycast po `intersectionThreshold` linii (1.5 mm) wymaga bardzo dokładnego
 * trafienia i gubi się, gdy krawędzie dwóch formatek pokrywają się w tym samym
 * miejscu (np. dwa boczki stojące na sobie albo dwa wieńce leżące na sobie).
 * Tutaj rzutujemy krawędzie na ekran i mierzymy odległość kursora od odcinka,
 * więc promień chwytania jest stały niezależnie od zoomu, a pokrywające się
 * krawędzie są sprowadzane do jednego kandydata (bliższego kamerze).
 */

declare const BABYLON: any;

import { Vec3, v3 } from './dimension-solver';

/** Domyślny promień chwytania krawędzi w pikselach. */
export const EDGE_SNAP_PX = 14;

/** Domyślny promień chwytania narożnika — celowo mniejszy niż krawędzi. */
export const VERTEX_SNAP_PX = 6;

export interface VertexCandidate {
    mesh: any;
    world: Vec3;
    distPx: number;
    depth: number;
}

export interface EdgeSegmentCandidate {
    mesh: any;
    p1World: Vec3;
    p2World: Vec3;
    p1Local: Vec3;
    p2Local: Vec3;
    index1: number;
    index2: number;
    /** Punkt na krawędzi najbliższy kursorowi (świat). */
    closestWorld: Vec3;
    distPx: number;
    /** Głębokość rzutu 0..1 — mniejsza wartość = bliżej kamery. */
    depth: number;
}

function isSelectableEdgeMesh(mesh: any): boolean {
    if (!mesh || mesh.isDisposed?.()) return false;

    const md = mesh.metadata;
    if (!md || md.type !== 'edge') return false;
    if (!Array.isArray(md.brepPoints) || md.brepPoints.length < 2) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (md.panelModel && md.panelModel.visible === false) return false;
    if (md.model && md.model.visible === false) return false;

    return true;
}

function isSelectableVertexMesh(mesh: any): boolean {
    if (!mesh || mesh.isDisposed?.()) return false;

    const md = mesh.metadata;
    if (!md || md.type !== 'vertex') return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (md.panelModel && md.panelModel.visible === false) return false;
    if (md.model && md.model.visible === false) return false;

    return true;
}

/** Parametr t punktu na odcinku 2D najbliższego (px, py), obcięty do <0,1>. */
function closestParam2D(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const lenSq = vx * vx + vy * vy;
    if (lenSq <= 1e-9) return 0;
    const t = ((px - x1) * vx + (py - y1) * vy) / lenSq;
    return Math.max(0, Math.min(1, t));
}

/** Klucz pozycji krawędzi z dokładnością 0.5 mm — łączy krawędzie pokrywające się. */
function coincidenceKey(a: Vec3, b: Vec3): string {
    const q = (n: number) => Math.round(n * 2);
    const ka = `${q(a.x)},${q(a.y)},${q(a.z)}`;
    const kb = `${q(b.x)},${q(b.y)},${q(b.z)}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/** Rzutowanie punktu świata na piksele ekranu; `null` gdy scena nie jest gotowa. */
function createProjector(scene: any): ((point: any) => any) | null {
    if (!scene || !scene.activeCamera || !Array.isArray(scene.meshes)) return null;

    const engine = scene.getEngine?.();
    if (!engine) return null;

    const viewport = scene.activeCamera.viewport.toGlobal(
        engine.getRenderWidth(),
        engine.getRenderHeight(),
    );
    const transform = scene.getTransformMatrix();
    const identity = BABYLON.Matrix.Identity();

    return (point: any) => BABYLON.Vector3.Project(point, identity, transform, viewport);
}

/**
 * Zwraca krawędzie w promieniu `maxPx` od kursora, posortowane od najlepszego
 * kandydata: najpierw odległość na ekranie, przy zbliżonej — bliżej kamery.
 */
export function findEdgeSegmentsNearPointer(
    scene: any,
    pointerX: number,
    pointerY: number,
    maxPx: number = EDGE_SNAP_PX,
): EdgeSegmentCandidate[] {
    const project = createProjector(scene);
    if (!project) return [];

    const found: EdgeSegmentCandidate[] = [];

    for (const mesh of scene.meshes) {
        if (!isSelectableEdgeMesh(mesh)) continue;

        const points = mesh.metadata.brepPoints;
        const worldMatrix = mesh.getWorldMatrix();

        const projected = points.map((p: number[]) => {
            const world = BABYLON.Vector3.TransformCoordinates(
                new BABYLON.Vector3(p[0], p[1], p[2]),
                worldMatrix,
            );
            return { world, screen: project(world) };
        });

        for (let i = 0; i + 1 < projected.length; i++) {
            const a = projected[i];
            const b = projected[i + 1];

            const aBehind = a.screen.z < 0 || a.screen.z > 1;
            const bBehind = b.screen.z < 0 || b.screen.z > 1;
            if (aBehind && bBehind) continue;

            const t = closestParam2D(pointerX, pointerY, a.screen.x, a.screen.y, b.screen.x, b.screen.y);
            const cx = a.screen.x + (b.screen.x - a.screen.x) * t;
            const cy = a.screen.y + (b.screen.y - a.screen.y) * t;
            const distPx = Math.hypot(pointerX - cx, pointerY - cy);
            if (distPx > maxPx) continue;

            found.push({
                mesh,
                p1World: v3(a.world.x, a.world.y, a.world.z),
                p2World: v3(b.world.x, b.world.y, b.world.z),
                p1Local: v3(points[i][0], points[i][1], points[i][2]),
                p2Local: v3(points[i + 1][0], points[i + 1][1], points[i + 1][2]),
                index1: i,
                index2: i + 1,
                closestWorld: v3(
                    a.world.x + (b.world.x - a.world.x) * t,
                    a.world.y + (b.world.y - a.world.y) * t,
                    a.world.z + (b.world.z - a.world.z) * t,
                ),
                distPx,
                depth: a.screen.z + (b.screen.z - a.screen.z) * t,
            });
        }
    }

    // Różnice poniżej kilku pikseli traktujemy jako remis i rozstrzygamy głębokością,
    // dzięki czemu kursor nie „przeskakuje” między pokrywającymi się krawędziami.
    const bucket = (d: number) => Math.round(d / 4);
    found.sort((x, y) =>
        (bucket(x.distPx) - bucket(y.distPx)) ||
        (x.depth - y.depth) ||
        (x.distPx - y.distPx));

    const unique: EdgeSegmentCandidate[] = [];
    const seen = new Set<string>();
    for (const candidate of found) {
        const key = coincidenceKey(candidate.p1World, candidate.p2World);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(candidate);
    }

    return unique;
}

/** Narożniki w promieniu `maxPx` od kursora, posortowane jak krawędzie. */
export function findVerticesNearPointer(
    scene: any,
    pointerX: number,
    pointerY: number,
    maxPx: number = VERTEX_SNAP_PX,
): VertexCandidate[] {
    const project = createProjector(scene);
    if (!project) return [];

    const found: VertexCandidate[] = [];

    for (const mesh of scene.meshes) {
        if (!isSelectableVertexMesh(mesh)) continue;

        const world = mesh.getAbsolutePosition?.();
        if (!world) continue;

        const screen = project(world);
        if (screen.z < 0 || screen.z > 1) continue;

        const distPx = Math.hypot(pointerX - screen.x, pointerY - screen.y);
        if (distPx > maxPx) continue;

        found.push({
            mesh,
            world: v3(world.x, world.y, world.z),
            distPx,
            depth: screen.z,
        });
    }

    found.sort((x, y) => (x.distPx - y.distPx) || (x.depth - y.depth));
    return found;
}
