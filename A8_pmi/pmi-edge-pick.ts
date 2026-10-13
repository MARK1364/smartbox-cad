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
export const EDGE_SNAP_PX = 22;

/** Domyślny promień chwytania narożnika — celowo mniejszy niż krawędzi. */
export const VERTEX_SNAP_PX = 12;

/**
 * Margines okluzji [mm]: narożnik leży na własnej ściance, więc trafienie
 * w nią (w granicy błędu numerycznego) nie liczy się jako zasłonięcie.
 * Ścianka ma zwykle 18+ mm, więc 2 mm czysto rozdziela oba przypadki.
 */
export const OCCLUSION_EPS_MM = 2;
/**
 * Margines okluzji dla własnej formatki [mm]: krawędź leżąca na tej samej ściance
 * formatki nie może być uznana za zasłoniętą przez tę samą ściankę przy rzucie ukośnym.
 * Formatka ma min. 10-18mm grubości, więc 10mm bezpiecznie odcina przeciwległą stronę.
 */
export const SELF_PANEL_OCCLUSION_EPS_MM = 10;

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

/** Czy mesh może zasłaniać (prawdziwa geometria CAD, nie helpery). */
function isOccluderMesh(mesh: any, exclude: any): boolean {
    if (!mesh || mesh === exclude || mesh.isDisposed?.()) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    // Duchy (kontenery alpha 0, hitboxy wymiarów) i overlays nie zasłaniają.
    if (mesh.isPickable === false) return false;
    if (mesh.isVisible === false) return false;
    if (typeof mesh.visibility === 'number' && mesh.visibility <= 0) return false;
    const md = mesh.metadata;
    if (!md) return false;
    if (md.isPmiOverlay) return false;
    if (md.type === 'edge' || md.type === 'vertex') return false;
    // Jak w GeometryDetector: tylko geometria CAD; siatki pomocnicze nie zasłaniają.
    if (!(md.type || md.faceName || md.panelModel || md.smartId)) return false;
    if (md.panelModel && md.panelModel.visible === false) return false;
    if (md.model && md.model.visible === false) return false;
    return true;
}

/** Licznik diagnostyczny: czy test okluzji w ogóle działa (do odczytu w konsoli). */
export const occlusionStats = { tests: 0, filtered: 0 };

function publishOcclusionStats(): void {
    try {
        (globalThis as any).__pmiOcclusionStats = occlusionStats;
    } catch {
        /* brak globalThis — ignoruj */
    }
}

/**
 * Test okluzji punktu: promień z kamery przez pozycję ekranową kandydata.
 * Zwraca true, gdy inna geometria CAD trafia wyraźnie (powyżej OCCLUSION_EPS_MM)
 * przed punktem — czyli punkt jest za ścianą i nie wolno go łapać.
 * Fail-open: bez kamery/promienia zwraca false (zachowanie jak wcześniej).
 */
export function isPointOccluded(
    scene: any,
    worldPoint: { x: number; y: number; z: number },
    screenX: number,
    screenY: number,
    excludeMesh: any = null,
): boolean {
    try {
        const camera = scene?.activeCamera;
        if (!scene || !camera) return false;
        if (typeof scene.createPickingRay !== 'function' || typeof scene.pickWithRay !== 'function') return false;
        const ray = scene.createPickingRay(screenX, screenY, BABYLON.Matrix.Identity(), camera, false);
        if (!ray || !ray.origin) return false;
        const dx = worldPoint.x - ray.origin.x;
        const dy = worldPoint.y - ray.origin.y;
        const dz = worldPoint.z - ray.origin.z;
        const distToPoint = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!(distToPoint > 0)) return false;
        const pick = scene.pickWithRay(ray, (m: any) => isOccluderMesh(m, excludeMesh));
        occlusionStats.tests += 1;
        publishOcclusionStats();
        if (!pick || !pick.hit || typeof pick.distance !== 'number') return false;
        const hitMesh = pick.pickedMesh;
        const isSamePanel = Boolean(
            excludeMesh &&
            hitMesh &&
            (
                (hitMesh.metadata?.panelModel && hitMesh.metadata.panelModel === excludeMesh.metadata?.panelModel) ||
                (excludeMesh.parent && hitMesh.parent === excludeMesh.parent)
            )
        );
        const eps = isSamePanel ? SELF_PANEL_OCCLUSION_EPS_MM : OCCLUSION_EPS_MM;
        const occluded = pick.distance < distToPoint - eps;
        if (occluded) occlusionStats.filtered += 1;
        return occluded;
    } catch {
        return false;
    }
}

/**
 * Wyznacza krawędzie obwiedni ścianki (np. Native Panel Face), gdy model
 * nie posiada dedykowanych linii B-rep (type === 'edge') lub zostały one
 * odrzucone. Odpowiada logice 'Część B' z PMI Tool.
 */
export function findFaceBoundaryEdgeSegments(
    scene: any,
    pointerX: number,
    pointerY: number,
    maxPx: number = EDGE_SNAP_PX,
): EdgeSegmentCandidate[] {
    const project = createProjector(scene);
    if (!project || typeof scene.multiPick !== 'function') return [];

    const faceHits = scene.multiPick(
        pointerX,
        pointerY,
        (m: any) => m && m.isEnabled() && m.metadata && m.metadata.faceName,
    );
    if (!faceHits || faceHits.length === 0) return [];
    const valid = faceHits.filter((h: any) => h.hit && h.pickedMesh && h.pickedPoint);
    if (valid.length === 0) return [];

    const candidates: Array<{ c: EdgeSegmentCandidate; sx: number; sy: number }> = [];

    for (const hit of valid) {
        const mesh = hit.pickedMesh;
        const boundingInfo = mesh.getBoundingInfo ? mesh.getBoundingInfo() : null;
        if (!boundingInfo) continue;
        const bb = boundingInfo.boundingBox;
        const min = bb.minimum;
        const max = bb.maximum;
        const spanX = max.x - min.x;
        const spanY = max.y - min.y;
        const spanZ = max.z - min.z;

        const candidateSegments: [any, any][] = [];
        if (spanZ < 1.0) {
            const z = (min.z + max.z) / 2;
            candidateSegments.push([new BABYLON.Vector3(min.x, min.y, z), new BABYLON.Vector3(min.x, max.y, z)]);
            candidateSegments.push([new BABYLON.Vector3(max.x, min.y, z), new BABYLON.Vector3(max.x, max.y, z)]);
            candidateSegments.push([new BABYLON.Vector3(min.x, min.y, z), new BABYLON.Vector3(max.x, min.y, z)]);
            candidateSegments.push([new BABYLON.Vector3(min.x, max.y, z), new BABYLON.Vector3(max.x, max.y, z)]);
        } else if (spanX < 1.0) {
            const x = (min.x + max.x) / 2;
            candidateSegments.push([new BABYLON.Vector3(x, min.y, min.z), new BABYLON.Vector3(x, max.y, min.z)]);
            candidateSegments.push([new BABYLON.Vector3(x, min.y, max.z), new BABYLON.Vector3(x, max.y, max.z)]);
            candidateSegments.push([new BABYLON.Vector3(x, min.y, min.z), new BABYLON.Vector3(x, min.y, max.z)]);
            candidateSegments.push([new BABYLON.Vector3(x, max.y, min.z), new BABYLON.Vector3(x, max.y, max.z)]);
        } else if (spanY < 1.0) {
            const y = (min.y + max.y) / 2;
            candidateSegments.push([new BABYLON.Vector3(min.x, y, min.z), new BABYLON.Vector3(min.x, y, max.z)]);
            candidateSegments.push([new BABYLON.Vector3(max.x, y, min.z), new BABYLON.Vector3(max.x, y, max.z)]);
            candidateSegments.push([new BABYLON.Vector3(min.x, y, min.z), new BABYLON.Vector3(max.x, y, min.z)]);
            candidateSegments.push([new BABYLON.Vector3(min.x, y, max.z), new BABYLON.Vector3(max.x, y, max.z)]);
        }
        if (candidateSegments.length === 0) continue;

        const wm = mesh.getWorldMatrix ? mesh.getWorldMatrix() : BABYLON.Matrix.Identity();

        for (const [p1, p2] of candidateSegments) {
            const wp1 = BABYLON.Vector3.TransformCoordinates(p1, wm);
            const wp2 = BABYLON.Vector3.TransformCoordinates(p2, wm);
            const sp1 = project(wp1);
            const sp2 = project(wp2);
            if ((sp1.z < 0 || sp1.z > 1) && (sp2.z < 0 || sp2.z > 1)) continue;

            const t = closestParam2D(pointerX, pointerY, sp1.x, sp1.y, sp2.x, sp2.y);
            const cx = sp1.x + (sp2.x - sp1.x) * t;
            const cy = sp1.y + (sp2.y - sp1.y) * t;
            const distPx = Math.hypot(pointerX - cx, pointerY - cy);
            if (distPx > maxPx) continue;

            candidates.push({
                c: {
                    mesh,
                    p1World: v3(wp1.x, wp1.y, wp1.z),
                    p2World: v3(wp2.x, wp2.y, wp2.z),
                    p1Local: v3(p1.x, p1.y, p1.z),
                    p2Local: v3(p2.x, p2.y, p2.z),
                    index1: 0,
                    index2: 1,
                    closestWorld: v3(
                        wp1.x + (wp2.x - wp1.x) * t,
                        wp1.y + (wp2.y - wp1.y) * t,
                        wp1.z + (wp2.z - wp1.z) * t,
                    ),
                    distPx,
                    depth: sp1.z + (sp2.z - sp1.z) * t,
                },
                sx: cx,
                sy: cy,
            });
        }
    }

    candidates.sort((x, y) => x.c.distPx - y.c.distPx || x.c.depth - y.c.depth);
    const unique: EdgeSegmentCandidate[] = [];
    const seen = new Set<string>();
    for (const { c: candidate, sx, sy } of candidates) {
        const key = coincidenceKey(candidate.p1World, candidate.p2World);
        if (seen.has(key)) continue;
        seen.add(key);
        if (isPointOccluded(scene, candidate.closestWorld, sx, sy, candidate.mesh)) continue;
        unique.push(candidate);
    }
    return unique;
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

    const found: Array<{ c: EdgeSegmentCandidate; sx: number; sy: number }> = [];

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
                c: {
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
                },
                sx: cx,
                sy: cy,
            });
        }
    }

    // Różnice poniżej kilku pikseli traktujemy jako remis i rozstrzygamy głębokością,
    // dzięki czemu kursor nie „przeskakuje” między pokrywającymi się krawędziami.
    const bucket = (d: number) => Math.round(d / 4);
    found.sort((x, y) =>
        (bucket(x.c.distPx) - bucket(y.c.distPx)) ||
        (x.c.depth - y.c.depth) ||
        (x.c.distPx - y.c.distPx));

    const unique: EdgeSegmentCandidate[] = [];
    const seen = new Set<string>();
    for (const { c: candidate, sx, sy } of found) {
        const key = coincidenceKey(candidate.p1World, candidate.p2World);
        if (seen.has(key)) continue;
        seen.add(key);
        // Odrzuć krawędź zasłoniętą ścianą — promień trafia wyraźnie przed nią.
        if (isPointOccluded(scene, candidate.closestWorld, sx, sy, candidate.mesh)) continue;
        unique.push(candidate);
    }

    if (unique.length === 0) {
        return findFaceBoundaryEdgeSegments(scene, pointerX, pointerY, maxPx);
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

    const found: Array<{ c: VertexCandidate; sx: number; sy: number }> = [];

    for (const mesh of scene.meshes) {
        if (!isSelectableVertexMesh(mesh)) continue;

        const world = mesh.getAbsolutePosition?.();
        if (!world) continue;

        const screen = project(world);
        if (screen.z < 0 || screen.z > 1) continue;

        const distPx = Math.hypot(pointerX - screen.x, pointerY - screen.y);
        if (distPx > maxPx) continue;

        found.push({
            c: {
            mesh,
            world: v3(world.x, world.y, world.z),
            distPx,
            depth: screen.z,
            },
            sx: screen.x,
            sy: screen.y,
        });
    }

    found.sort((x, y) => (x.c.distPx - y.c.distPx) || (x.c.depth - y.c.depth));
    // Odrzuć naroża za ścianą — bezwzględne pierwszeństwo ma tylko widoczny narożnik.
    return found
        .filter(({ c, sx, sy }) => !isPointOccluded(scene, c.world, sx, sy, c.mesh))
        .map(({ c }) => c);
}
