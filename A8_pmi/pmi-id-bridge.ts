/**
 * PMI ID Bridge — TypeScript
 *
 * Wiąże adnotacje wymiarowe z geometrią przez
 * identyfikatory, które przeżywają przebudowę siatek i zapis projektu.
 *
 * DLACZEGO NIE NAZWA SIATKI:
 * Siatki Babylona (`face_FRONT`, `edge_3`, `vertex_7`) są tworzone od nowa przy
 * każdym `PanelView.updateMesh()`, ich nazwy nie są unikalne między formatkami,
 * a `uniqueId` zmienia się w obrębie sesji. Trwałe jest wyłącznie `CADNode.id`
 * (równe `PanelModel.id`), bo tylko ono trafia do serializacji dokumentu.
 */

declare const BABYLON: any;

import { Vec3, v3, v3Add, v3Dot, v3Len, v3Normalize, v3Scale, v3Sub } from './dimension-solver';
import { cadToRender, renderToCAD } from '../A1_core/cad-math/coord-system.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 as CadVec3 } from '../A1_core/cad-math/vec3.js';
import { ContextManager } from '../A1_core/context-manager';
import { IDManager, EntityType } from '../A1_core/id-manager';

// ============================================================================
// TYPES
// ============================================================================

export type PMIAnchorKind = 'VERTEX' | 'EDGE' | 'FACE' | 'FEATURE' | 'FREE';

/**
 * Sprawdza, czy siatka należy do warstwy nakładki PMI (linie, etykiety, groty, podglądy).
 * Zgodnie z zasadami SSOT filtrowanie opiera się na metadanych, nigdy na nazwie (`name`).
 */
export function isPmiOverlayMesh(mesh: any): boolean {
    if (!mesh) return false;
    const meta = mesh.metadata;
    return Boolean(meta?.isPmiOverlay || meta?.pmiAnnotationId != null || meta?.pmiTarget != null);
}

/**
 * Transformuje normalna macierza afiniczna 4x4 (column-major).
 *
 * Normalna wymaga macierzy odwrotnej transponowanej, a nie samego kierunku:
 * przy niejednorodnej skali bez tego kąt między plaszczyznami jest falszowany.
 * Zwraca wektor nieznormalizowany albo null dla macierzy osobliwej.
 */
function transformNormalByMat4Data(
    d: ArrayLike<number>,
    nx: number,
    ny: number,
    nz: number,
): Vec3 | null {
    if (!d || d.length < 11) return null;

    const a00 = d[0], a01 = d[4], a02 = d[8];
    const a10 = d[1], a11 = d[5], a12 = d[9];
    const a20 = d[2], a21 = d[6], a22 = d[10];

    const c00 = a11 * a22 - a12 * a21;
    const c01 = a12 * a20 - a10 * a22;
    const c02 = a10 * a21 - a11 * a20;
    const c10 = a02 * a21 - a01 * a22;
    const c11 = a00 * a22 - a02 * a20;
    const c12 = a01 * a20 - a00 * a21;
    const c20 = a01 * a12 - a02 * a11;
    const c21 = a02 * a10 - a00 * a12;
    const c22 = a00 * a11 - a01 * a10;

    const det = a00 * c00 + a01 * c01 + a02 * c02;
    if (Math.abs(det) < 1e-30) return null;

    return v3(
        (c00 * nx + c01 * ny + c02 * nz) / det,
        (c10 * nx + c11 * ny + c12 * nz) / det,
        (c20 * nx + c21 * ny + c22 * nz) / det,
    );
}

/**
 * Dokladna normalna plaszczyzny sciany w ukladzie swiata.
 *
 * `mesh.metadata.planeNormalLocal` jest liczona z wierzcholkow B-rep (double)
 * jeszcze przed konwersja do Float32. Do swiata transformujemy macierza CADNode
 * (Mat4, double), a nie macierza Babylona, zeby nie wprowadzac bledu Float32.
 */
export function planeNormalWorldFromMesh(mesh: any): Vec3 | null {
    let local = mesh?.metadata?.planeNormalLocal;
    const nodeId = mesh?.metadata?.panelModel?.id;
    const faceName = mesh?.metadata?.faceName;

    if (!local && nodeId && faceName) {
        const panelViews = ContextManager.instance?.panelViews;
        if (panelViews) {
            for (const view of panelViews.values()) {
                if (view?.model?.id === nodeId && typeof view.getBrepFaceNormalLocal === 'function') {
                    local = view.getBrepFaceNormalLocal(faceName);
                    if (local) break;
                }
            }
        }
    }
    if (!local) return null;

    const lx = Number(local.x ?? local[0]);
    const ly = Number(local.y ?? local[1]);
    const lz = Number(local.z ?? local[2]);
    if (!Number.isFinite(lx) || !Number.isFinite(ly) || !Number.isFinite(lz)) return null;
    if (Math.hypot(lx, ly, lz) < 1e-12) return null;

    if (nodeId) {
        try {
            const node = ContextManager.instance?.document?.findNode?.(nodeId);
            const d = node?.getWorldMatrix?.()?.data;
            const worldCad = transformNormalByMat4Data(d, lx, lz, ly);
            if (worldCad && v3Len(worldCad) > 1e-12) {
                return v3Normalize(v3(worldCad.x, worldCad.z, worldCad.y));
            }
        } catch {
            // Brak dokumentu (np. testy) - schodzimy do macierzy meshu.
        }
    }

    const bw = mesh?.getWorldMatrix?.();
    const world = transformNormalByMat4Data(bw?.m, lx, ly, lz);
    if (world && v3Len(world) > 1e-12) return v3Normalize(world);

    return null;
}

/**
 * Trwałe odniesienie do punktu zaczepienia wymiaru.
 */
export interface PMIAnchorRef {
    /** Stabilne ID węzła dokumentu (CADNode.id === PanelModel.id). Puste dla kotwic swobodnych. */
    nodeId: string;
    /** Ścieżka SmartID elementu podrzędnego, o ile była dostępna przy wskazaniu. */
    smartIdPath: string;
    kind: PMIAnchorKind;
    /** Klucz elementu w obrębie węzła: faceName, edgeKey albo indeks narożnika. */
    subKey: string;
    /** Który koniec krawędzi (0 lub 1); -1 dla kotwic bez wyróżnionego końca. */
    subIndex: number;
    /** Punkt w układzie lokalnym korzenia węzła [mm]. */
    pointLocal: Vec3;
    /** Ostatnia znana pozycja światowa — używana, gdy węzła nie ma już w scenie. */
    pointWorldFallback: Vec3;
}

// ============================================================================
// ROOT RESOLUTION
// ============================================================================

interface NodeEntry {
    root: any;
    meshes: any[];
}

/**
 * Cache węzłów, ważny w obrębie jednego przebiegu renderowania.
 * Bez niego każda adnotacja skanowałaby całą scenę.
 */
let _nodeCache: Map<string, NodeEntry | null> | null = null;

export function beginResolveBatch(): void {
    _nodeCache = new Map();
}

export function endResolveBatch(): void {
    _nodeCache = null;
}

function lookupNodeEntry(scene: any, nodeId: string): NodeEntry | null {
    let root: any = null;

    // 1. Widoki formatek — najtańsze i najpewniejsze źródło korzenia.
    const panelViews = ContextManager.instance.panelViews;
    if (panelViews) {
        for (const view of panelViews.values()) {
            if (view?.model?.id === nodeId && view.root) {
                root = view.root;
                break;
            }
        }
    }

    // 2. Widoki kontenerów.
    if (!root) {
        const containerViews = ContextManager.instance.containerViews;
        if (containerViews) {
            for (const [container, view] of containerViews) {
                const id = container?.id ?? view?.model?.id;
                if (id === nodeId && view?.rootNode) {
                    root = view.rootNode;
                    break;
                }
            }
        }
    }

    // 3. Awaryjnie: skan siatek po metadanych modelu.
    if (!root) {
        for (const mesh of scene.meshes || []) {
            if (mesh?.metadata?.panelModel?.id === nodeId) {
                root = mesh.parent || mesh;
                break;
            }
        }
    }

    if (!root) return null;
    return { root, meshes: root.getChildMeshes ? root.getChildMeshes(true) : [] };
}

function findNodeEntry(scene: any, nodeId: string): NodeEntry | null {
    if (!scene || !nodeId) return null;

    if (_nodeCache && _nodeCache.has(nodeId)) {
        return _nodeCache.get(nodeId) ?? null;
    }

    const entry = lookupNodeEntry(scene, nodeId);
    if (_nodeCache) _nodeCache.set(nodeId, entry);
    return entry;
}

/**
 * Znajduje korzeń (TransformNode) węzła dokumentu o podanym ID.
 */
export function findNodeRoot(scene: any, nodeId: string): any {
    return findNodeEntry(scene, nodeId)?.root ?? null;
}

/**
 * Odczytuje aktualne położenie elementu wskazanego przez kotwicę wprost z żywej
 * geometrii.
 *
 * Pokrywa przypadek,
 * którego sama macierz świata nie obsłuży: zmianę parametrów formatki. Po
 * poszerzeniu płyty jej korzeń stoi w miejscu, ale narożnik przesuwa się —
 * zapisany punkt lokalny byłby wtedy nieaktualny.
 *
 * Zwraca `null` dla kotwic, których nie da się odtworzyć (np. dowolny punkt
 * wskazany na ścianie) — wtedy obowiązuje zapisany punkt lokalny.
 */
/** Przelicza punkt z układu lokalnego siatki (np. ściany) na układ korzenia formatki. */
export function meshLocalToRootLocal(mesh: any, pointMeshLocal: Vec3): Vec3 {
    const root = anchorRootOf(mesh);
    const meshWorld = mesh?.getWorldMatrix?.();
    const rootWorld = root?.getWorldMatrix?.();
    if (!meshWorld || !rootWorld) return pointMeshLocal;

    const world = BABYLON.Vector3.TransformCoordinates(
        new BABYLON.Vector3(pointMeshLocal.x, pointMeshLocal.y, pointMeshLocal.z),
        meshWorld,
    );
    const rootInv = rootWorld.clone().invert();
    const local = BABYLON.Vector3.TransformCoordinates(world, rootInv);
    return v3(local.x, local.y, local.z);
}

function isRootLocalOverride(kind: PMIAnchorKind): boolean {
    return kind === 'VERTEX' || kind === 'EDGE';
}

function isInsideBBox(point: Vec3, min: Vec3, max: Vec3, margin: number): boolean {
    return point.x >= min.x - margin && point.x <= max.x + margin
        && point.y >= min.y - margin && point.y <= max.y + margin
        && point.z >= min.z - margin && point.z <= max.z + margin;
}

/**
 * Po przebudowie formatki odtwarza punkt kotwicy FACE na bieżącej geometrii ściany.
 * Stare zapisy w układzie lokalnym ściany (błąd sprzed poprawki) są wykrywane i też
 * obsługiwane.
 */
function resolveFaceAnchorLocal(scene: any, ref: PMIAnchorRef, entry: NodeEntry): Vec3 | null {
    const faceMesh = entry.meshes.find(m => m?.metadata?.faceName === ref.subKey);
    if (!faceMesh) return null;

    const root = entry.root;
    const rootMatrix = root.getWorldMatrix();
    const rootInv = rootMatrix.clone().invert();
    const faceWorld = faceMesh.getWorldMatrix();
    const faceInv = faceWorld.clone().invert();

    const bb = faceMesh.getBoundingInfo().boundingBox;
    const min = v3(bb.minimum.x, bb.minimum.y, bb.minimum.z);
    const max = v3(bb.maximum.x, bb.maximum.y, bb.maximum.z);

    const rootAsFaceLocal = BABYLON.Vector3.TransformCoordinates(
        new BABYLON.Vector3(ref.pointLocal.x, ref.pointLocal.y, ref.pointLocal.z),
        rootMatrix,
    );
    let faceLocal = BABYLON.Vector3.TransformCoordinates(rootAsFaceLocal, faceInv);

    // Starsze wymiary mogły zapisać współrzędne w układzie ściany zamiast korzenia.
    if (!isInsideBBox(v3(faceLocal.x, faceLocal.y, faceLocal.z), min, max, 5)) {
        faceLocal = new BABYLON.Vector3(ref.pointLocal.x, ref.pointLocal.y, ref.pointLocal.z);
    }

    const spanX = max.x - min.x;
    const spanY = max.y - min.y;
    const spanZ = max.z - min.z;

    if (spanX <= spanY && spanX <= spanZ) {
        faceLocal.x = (min.x + max.x) / 2;
        faceLocal.y = Math.max(min.y, Math.min(max.y, faceLocal.y));
        faceLocal.z = Math.max(min.z, Math.min(max.z, faceLocal.z));
    } else if (spanY <= spanX && spanY <= spanZ) {
        faceLocal.y = (min.y + max.y) / 2;
        faceLocal.x = Math.max(min.x, Math.min(max.x, faceLocal.x));
        faceLocal.z = Math.max(min.z, Math.min(max.z, faceLocal.z));
    } else {
        faceLocal.z = (min.z + max.z) / 2;
        faceLocal.x = Math.max(min.x, Math.min(max.x, faceLocal.x));
        faceLocal.y = Math.max(min.y, Math.min(max.y, faceLocal.y));
    }

    const newWorld = BABYLON.Vector3.TransformCoordinates(faceLocal, faceWorld);
    const newRootLocal = BABYLON.Vector3.TransformCoordinates(newWorld, rootInv);
    return v3(newRootLocal.x, newRootLocal.y, newRootLocal.z);
}

function currentLocalPoint(scene: any, ref: PMIAnchorRef): Vec3 | null {
    if (!ref.subKey && ref.kind !== 'FREE') return null;

    const entry = findNodeEntry(scene, ref.nodeId);
    if (!entry) return null;

    if (ref.kind === 'VERTEX') {
        const mesh = entry.meshes.find(m => m?.metadata?.type === 'vertex' && String(m.metadata.cornerIndex) === ref.subKey);
        const position = mesh?.position;
        return position ? v3(position.x, position.y, position.z) : null;
    }

    if (ref.kind === 'EDGE') {
        if (ref.subIndex !== 0 && ref.subIndex !== 1) return null;

        const mesh = entry.meshes.find(m => m?.metadata?.type === 'edge' && (String(m.metadata.edgeKey) === ref.subKey || String(m.metadata.alias) === ref.subKey));
        const points = mesh?.metadata?.brepPoints;
        if (!points || points.length < 2) return null;

        const point = points[ref.subIndex];
        return point ? v3(point[0], point[1], point[2]) : null;
    }

    if (ref.kind === 'FACE') {
        return resolveFaceAnchorLocal(scene, ref, entry);
    }

    return null;
}

// ============================================================================
// BUILDING REFS
// ============================================================================

function readNodeId(mesh: any): string {
    const meta = mesh?.metadata;
    if (!meta) return '';
    return meta.panelModel?.id || meta.containerModel?.id || meta.nodeId || '';
}

function readKindAndKey(mesh: any): { kind: PMIAnchorKind; subKey: string } {
    const meta = mesh?.metadata;
    if (!meta) return { kind: 'FREE', subKey: '' };

    if (meta.type === 'vertex') return { kind: 'VERTEX', subKey: String(meta.cornerIndex ?? '') };
    if (meta.type === 'edge') return { kind: 'EDGE', subKey: String(meta.edgeKey ?? '') };
    if (meta.type === 'feature') return { kind: 'FEATURE', subKey: String(meta.featureId ?? '') };
    if (meta.faceName) return { kind: 'FACE', subKey: String(meta.faceName) };

    return { kind: 'FREE', subKey: '' };
}

/**
 * Zwraca korzeń, względem którego liczone są współrzędne lokalne kotwicy.
 * Siatki ścian, krawędzi i narożników są podpięte pod wspólny korzeń formatki,
 * który przeżywa przebudowę geometrii — w odróżnieniu od nich samych.
 */
function anchorRootOf(mesh: any): any {
    if (!mesh) return null;
    return mesh.parent || mesh;
}

/**
 * Buduje trwałe odniesienie kotwicy na podstawie wskazanej siatki i punktu światowego.
 *
 * @param localOverride Punkt lokalny podany wprost (np. dokładny wierzchołek B-rep
 *                      krawędzi), gdy nie chcemy go wyliczać z punktu trafienia.
 * @param subIndex      Numer końca krawędzi, jeśli kotwica siedzi na jej wierzchołku.
 */
export function buildAnchorRef(
    mesh: any,
    worldPoint: Vec3,
    localOverride?: Vec3 | null,
    subIndex = -1,
): PMIAnchorRef {
    const nodeId = readNodeId(mesh);
    const { kind, subKey } = readKindAndKey(mesh);
    const smartIdPath = mesh?.metadata?.smartId?.fullPath ?? '';

    let pointLocal: Vec3;

    if (localOverride) {
        pointLocal = isRootLocalOverride(kind)
            ? localOverride
            : meshLocalToRootLocal(mesh, localOverride);
    } else {
        const root = anchorRootOf(mesh);
        const worldMatrix = root?.getWorldMatrix?.();
        if (worldMatrix) {
            const inv = worldMatrix.clone().invert();
            const local = BABYLON.Vector3.TransformCoordinates(
                new BABYLON.Vector3(worldPoint.x, worldPoint.y, worldPoint.z),
                inv,
            );
            pointLocal = v3(local.x, local.y, local.z);
        } else {
            pointLocal = worldPoint;
        }
    }

    return {
        nodeId,
        smartIdPath,
        kind: nodeId ? kind : 'FREE',
        subKey,
        subIndex,
        pointLocal,
        pointWorldFallback: worldPoint,
    };
}

/**
 * Kotwica niezwiązana z żadnym węzłem — zapisywana wyłącznie w przestrzeni świata.
 */
export function freeAnchorRef(worldPoint: Vec3): PMIAnchorRef {
    return {
        nodeId: '',
        smartIdPath: '',
        kind: 'FREE',
        subKey: '',
        subIndex: -1,
        pointLocal: worldPoint,
        pointWorldFallback: worldPoint,
    };
}

export const SNAP_RADIUS_MM = 30;

/**
 * Linia pomocnicza wymiaru od płaszczyzny zawsze kończy się w narożniku/krawędzi
 * ściany — także wtedy, gdy użytkownik kliknął jej środek. Promień 30 mm dotyczy
 * wyłącznie przechwytywania kotwicy punktowej, nie punktu rysunkowego ściany.
 */
export const FACE_HELPER_SNAP_RADIUS_MM = Number.POSITIVE_INFINITY;

/**
 * Przy tworzeniu wymiaru: przyciąga kliknięcie na ścianie do najbliższego narożnika
 * lub końca krawędzi formatki, żeby kotwica przeżyła przebudowę geometrii.
 */
export function snapWorldPointToPanelGeometry(
    scene: any,
    mesh: any,
    worldPoint: Vec3,
    snapRadiusMM: number = SNAP_RADIUS_MM,
): { anchor: PMIAnchorRef; worldPos: Vec3 } | null {
    const nodeId = readNodeId(mesh);
    if (!nodeId) return null;

    const entry = findNodeEntry(scene, nodeId);
    if (!entry?.root) return null;

    const rootMatrix = entry.root.getWorldMatrix();
    const rootInv = rootMatrix.clone().invert();
    const rootLocal = BABYLON.Vector3.TransformCoordinates(
        new BABYLON.Vector3(worldPoint.x, worldPoint.y, worldPoint.z),
        rootInv,
    );
    const target = v3(rootLocal.x, rootLocal.y, rootLocal.z);

    let bestDist = snapRadiusMM;
    let best: { anchor: PMIAnchorRef; worldPos: Vec3 } | null = null;

    for (const child of entry.meshes) {
        if (child?.metadata?.type === 'vertex' && child.position) {
            const pos = v3(child.position.x, child.position.y, child.position.z);
            const d = v3Len(v3Sub(target, pos));
            if (d < bestDist) {
                bestDist = d;
                const snapped = child.getAbsolutePosition?.();
                const wp = snapped
                    ? v3(snapped.x, snapped.y, snapped.z)
                    : worldPoint;
                best = {
                    anchor: buildAnchorRef(child, wp, pos),
                    worldPos: wp,
                };
            }
        }
    }

    for (const child of entry.meshes) {
        if (child?.metadata?.type !== 'edge') continue;
        const points = child.metadata?.brepPoints;
        if (!points || points.length < 2) continue;

        for (let i = 0; i < 2; i++) {
            const pt = v3(points[i][0], points[i][1], points[i][2]);
            const d = v3Len(v3Sub(target, pt));
            if (d < bestDist) {
                bestDist = d;
                const world = BABYLON.Vector3.TransformCoordinates(
                    new BABYLON.Vector3(pt.x, pt.y, pt.z),
                    rootMatrix,
                );
                const wp = v3(world.x, world.y, world.z);
                best = {
                    anchor: buildAnchorRef(child, wp, pt, i),
                    worldPos: wp,
                };
            }
        }
    }

    return best;
}

/**
 * Tolerancja, w jakiej wierzchołek/krawędź uznajemy za leżące na płaszczyźnie ściany.
 * Grubość płyty jest znacznie większa, więc filtr nie łapie narożników przeciwnej ściany.
 */
const FACE_HELPER_PLANE_TOL_MM = 2;

function projectPointOnPlaneWorld(point: Vec3, planeOrigin: Vec3, planeNormal: Vec3): Vec3 {
    const n = v3Normalize(planeNormal);
    return v3Sub(point, v3Scale(n, v3Dot(v3Sub(point, planeOrigin), n)));
}

/**
 * Kotwica rysunkowa dla ściany. Sam wymiar pozostaje FACE (normalna steruje
 * wartością i osią), ale początek linii pomocniczej trafia do narożnika
 * leżącego na tej ścianie i najbliższego linii wymiarowej — nie do narożnika
 * najbliższego miejscu kliknięcia.
 */
export function resolveFaceHelperWorld(
    scene: any,
    ref: PMIAnchorRef | null,
    worldPoint: Vec3,
    targetWorld?: Vec3 | null,
    planeNormalWorld?: Vec3 | null,
): Vec3 | null {
    if (!ref || ref.kind !== 'FACE') return null;

    const entry = findNodeEntry(scene, ref.nodeId);
    if (!entry) return null;

    const faceMesh = entry.meshes.find(m => m?.metadata?.faceName === ref.subKey)
        ?? entry.meshes.find(m => readNodeId(m) === ref.nodeId);
    if (!faceMesh) return null;

    const reference = targetWorld ?? worldPoint;

    if (!planeNormalWorld || v3Len(planeNormalWorld) <= 1e-7) {
        return snapWorldPointToPanelGeometry(scene, faceMesh, reference, FACE_HELPER_SNAP_RADIUS_MM)?.worldPos ?? null;
    }

    const n = v3Normalize(planeNormalWorld);
    const rootMatrix = entry.root.getWorldMatrix();
    if (!rootMatrix) return null;

    let best: Vec3 | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    const consider = (world: Vec3): void => {
        // Tylko narożniki leżące na płaszczyźnie wskazanej ściany.
        if (Math.abs(v3Dot(v3Sub(world, worldPoint), n)) > FACE_HELPER_PLANE_TOL_MM) return;
        const d = v3Len(v3Sub(world, reference));
        if (d < bestDist) {
            bestDist = d;
            best = world;
        }
    };

    for (const child of entry.meshes) {
        if (child?.metadata?.type === 'vertex') {
            const abs = child.getAbsolutePosition?.();
            if (abs) {
                consider(v3(abs.x, abs.y, abs.z));
            } else if (child.position) {
                const w = BABYLON.Vector3.TransformCoordinates(
                    new BABYLON.Vector3(child.position.x, child.position.y, child.position.z),
                    rootMatrix,
                );
                consider(v3(w.x, w.y, w.z));
            }
            continue;
        }
        if (child?.metadata?.type === 'edge') {
            const points = child.metadata?.brepPoints;
            if (!points) continue;
            for (const p of points) {
                const w = BABYLON.Vector3.TransformCoordinates(
                    new BABYLON.Vector3(p[0], p[1], p[2]),
                    rootMatrix,
                );
                consider(v3(w.x, w.y, w.z));
            }
        }
    }

    return best;
}

/**
 * Wyznacza oba punkty rysunkowe wymiaru. Dla ściany celem jest rzut drugiego
 * elementu na jej płaszczyznę przesunięty o wektor odsunięcia — czyli okolica
 * linii wymiarowej. Dzięki temu linia pomocnicza jest krótka i czytelna.
 */
export function resolveFaceHelperWorlds(opts: {
    scene: any;
    anchor1Ref: PMIAnchorRef | null;
    anchor2Ref: PMIAnchorRef | null;
    anchor1World: Vec3;
    anchor2World: Vec3;
    offsetWorld?: Vec3 | null;
    normal1World?: Vec3 | null;
    normal2World?: Vec3 | null;
}): { helper1World: Vec3; helper2World: Vec3 } {
    const offset = opts.offsetWorld ?? v3(0, 0, 0);
    const bothFaces = opts.anchor1Ref?.kind === 'FACE' && opts.anchor2Ref?.kind === 'FACE';
    const sharedTarget = bothFaces
        ? v3Add(v3Scale(v3Add(opts.anchor1World, opts.anchor2World), 0.5), offset)
        : null;
    const target1 = sharedTarget
        ? helperTargetWorld(opts.anchor1World, sharedTarget, opts.normal1World, v3(0, 0, 0))
        : helperTargetWorld(opts.anchor1World, opts.anchor2World, opts.normal1World, offset);
    const target2 = sharedTarget
        ? helperTargetWorld(opts.anchor2World, sharedTarget, opts.normal2World, v3(0, 0, 0))
        : helperTargetWorld(opts.anchor2World, opts.anchor1World, opts.normal2World, offset);

    return {
        helper1World: resolveFaceHelperWorld(
            opts.scene,
            opts.anchor1Ref,
            opts.anchor1World,
            target1,
            opts.normal1World,
        ) ?? opts.anchor1World,
        helper2World: resolveFaceHelperWorld(
            opts.scene,
            opts.anchor2Ref,
            opts.anchor2World,
            target2,
            opts.normal2World,
        ) ?? opts.anchor2World,
    };
}

function helperTargetWorld(
    planeWorld: Vec3,
    otherWorld: Vec3,
    normalWorld: Vec3 | null | undefined,
    offsetWorld: Vec3,
): Vec3 {
    if (!normalWorld || v3Len(normalWorld) <= 1e-7) {
        return v3Add(planeWorld, offsetWorld);
    }
    return v3Add(projectPointOnPlaneWorld(otherWorld, planeWorld, normalWorld), offsetWorld);
}

/**
 * Przyciąga punkt na krawędzi do najbliższego końca (naroża).
 * W CAD linia pomocnicza zawsze wychodzi z końca krawędzi, nie z miejsca kliknięcia.
 */
export function snapToNearestEdgeEndpoint(
    edgeMesh: any,
    worldPoint: Vec3,
): { anchor: PMIAnchorRef; worldPos: Vec3; subIndex: number } | null {
    const points = edgeMesh?.metadata?.brepPoints;
    if (!points || points.length < 2) return null;

    const root = edgeMesh.parent || edgeMesh;
    const worldMatrix = root.getWorldMatrix?.();
    if (!worldMatrix) return null;

    const inv = worldMatrix.clone().invert();
    const localHit = BABYLON.Vector3.TransformCoordinates(
        new BABYLON.Vector3(worldPoint.x, worldPoint.y, worldPoint.z),
        inv,
    );
    const hit = v3(localHit.x, localHit.y, localHit.z);

    const p0 = v3(points[0][0], points[0][1], points[0][2]);
    const p1 = v3(points[1][0], points[1][1], points[1][2]);
    const d0 = v3Len(v3Sub(hit, p0));
    const d1 = v3Len(v3Sub(hit, p1));
    const subIndex = d0 <= d1 ? 0 : 1;
    const local = subIndex === 0 ? p0 : p1;

    const world = BABYLON.Vector3.TransformCoordinates(
        new BABYLON.Vector3(local.x, local.y, local.z),
        worldMatrix,
    );
    const wp = v3(world.x, world.y, world.z);
    return {
        anchor: buildAnchorRef(edgeMesh, wp, local, subIndex),
        worldPos: wp,
        subIndex,
    };
}

export interface EdgeAnchorPair {
    anchor1: PMIAnchorRef;
    anchor2: PMIAnchorRef;
    p1World: Vec3;
    p2World: Vec3;
    edgeMesh: any;
}

/**
 * Dla krawędzi wykrytej na ścianie: jeśli istnieje odpowiadająca krawędź B-rep,
 * zwraca kotwice EDGE zamiast FACE.
 */
export function tryBuildEdgeAnchorsFromRootPoints(
    scene: any,
    panelMesh: any,
    rp1: Vec3,
    rp2: Vec3,
    p1World: Vec3,
    p2World: Vec3,
    tolMM = 5,
): EdgeAnchorPair | null {
    const nodeId = readNodeId(panelMesh);
    const entry = findNodeEntry(scene, nodeId);
    if (!entry) return null;

    const rootMatrix = entry.root.getWorldMatrix();

    for (const child of entry.meshes) {
        if (child?.metadata?.type !== 'edge') continue;
        const points = child.metadata?.brepPoints;
        if (!points || points.length < 2) continue;

        const a0 = v3(points[0][0], points[0][1], points[0][2]);
        const a1 = v3(points[1][0], points[1][1], points[1][2]);
        const forward = v3Len(v3Sub(rp1, a0)) + v3Len(v3Sub(rp2, a1));
        const reverse = v3Len(v3Sub(rp1, a1)) + v3Len(v3Sub(rp2, a0));
        const useForward = forward <= reverse;

        if (Math.min(forward, reverse) > tolMM * 2) continue;

        const sub1 = useForward ? 0 : 1;
        const sub2 = useForward ? 1 : 0;
        const l1 = useForward ? a0 : a1;
        const l2 = useForward ? a1 : a0;

        const w1 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(l1.x, l1.y, l1.z),
            rootMatrix,
        );
        const w2 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(l2.x, l2.y, l2.z),
            rootMatrix,
        );

        return {
            anchor1: buildAnchorRef(child, v3(w1.x, w1.y, w1.z), l1, sub1),
            anchor2: buildAnchorRef(child, v3(w2.x, w2.y, w2.z), l2, sub2),
            p1World: v3(w1.x, w1.y, w1.z),
            p2World: v3(w2.x, w2.y, w2.z),
            edgeMesh: child,
        };
    }

    return null;
}

// ============================================================================
// B-rep GEOMETRY DATA (SSOT for PMI)
// ============================================================================

export interface BrepGeometryData {
    facePositions: Float64Array | null;
    faceIndices: Uint32Array;
    vertexLocal: Vec3[];
    edgePoints: number[][][];
    faceOriginLocal: Vec3 | null;
    faceNormalLocal: Vec3 | null;
}

export interface ResolvedBrepPick {
    kind: 'VERTEX' | 'EDGE' | 'FACE';
    nodeId: string;
    subKey: string;
    worldPos: Vec3;
    localPos: Vec3;
    anchorRef: PMIAnchorRef;
}

// ============================================================================
// RESOLVING B-rep GEOMETRY
// ============================================================================

/**
 * Pobiera dane B-rep dla panelu na podstawie nodeId.
 * Zwraca dane w milimetrach (mm) — zgodnie z kontraktem PMI.
 */
export function getBrepGeometryForPanel(scene: any, nodeId: string, faceName?: string): BrepGeometryData | null {
    const panelViews = ContextManager.instance.panelViews;
    if (!panelViews) return null;

    let targetView: any = panelViews.get(nodeId);
    if (!targetView) {
        for (const view of panelViews.values()) {
            if (view?.model?.id === nodeId) {
                targetView = view;
                break;
            }
        }
    }
    if (!targetView || typeof targetView.getBrepFacePositions !== 'function') return null;

    const positions = faceName ? targetView.getBrepFacePositions(faceName) : null;
    const indices = faceName ? targetView.getBrepFaceIndices(faceName) ?? new Uint32Array(0) : new Uint32Array(0);
    const vertexLocal = targetView.getBrepVertexLocal?.() ?? [];
    const edgePoints = targetView.getBrepEdgePoints?.() ?? [];
    const origin = faceName ? targetView.getBrepFaceOriginLocal?.(faceName) ?? null : null;
    const normal = faceName ? targetView.getBrepFaceNormalLocal?.(faceName) ?? null : null;

    if (positions || vertexLocal.length > 0 || edgePoints.length > 0) {
        return {
            facePositions: positions ?? null,
            faceIndices: indices,
            vertexLocal,
            edgePoints,
            faceOriginLocal: origin,
            faceNormalLocal: normal,
        };
    }
    return null;
}

export function resolveBrepGeometryPick(
    scene: any,
    hit: any,
    panelView: any,
): ResolvedBrepPick | null {
    const metadata = hit?.pickedMesh?.metadata;
    if (!metadata?.panelModel) return null;

    // Pobierz dane B-rep z panelView
    const faceName = metadata.type === 'face' || (!metadata.type && metadata.faceName)
        ? metadata.faceName
        : undefined;
    let brep = getBrepGeometryForPanel(scene, metadata.panelModel.id, faceName);
    // Face meshes retain the exact plane calculated from B-rep doubles even if
    // the PanelView position buffer is temporarily absent (e.g. during rebuild).
    // The ray hit confirms the point belongs to this face, so projection onto
    // that plane is sufficient to create a stable FACE anchor.
    if ((!brep || !brep.facePositions || !brep.faceOriginLocal || !brep.faceNormalLocal)
        && faceName && metadata.planeOriginLocal && metadata.planeNormalLocal) {
        const origin = metadata.planeOriginLocal;
        const normal = metadata.planeNormalLocal;
        brep = {
            facePositions: brep?.facePositions ?? null,
            faceIndices: brep?.faceIndices ?? new Uint32Array(0),
            vertexLocal: brep?.vertexLocal ?? [],
            edgePoints: brep?.edgePoints ?? [],
            faceOriginLocal: v3(
                Number(origin.x ?? origin[0]),
                Number(origin.y ?? origin[1]),
                Number(origin.z ?? origin[2]),
            ),
            faceNormalLocal: v3(
                Number(normal.x ?? normal[0]),
                Number(normal.y ?? normal[1]),
                Number(normal.z ?? normal[2]),
            ),
        };
    }
    if (!brep) return null;

    if (metadata.type === 'vertex' && metadata.cornerIndex !== undefined) {
        // Wierzchołek z B-rep
        const vertexIndex = metadata.cornerIndex;
        if (vertexIndex < 0 || vertexIndex >= brep.vertexLocal.length) return null;

        const local = brep.vertexLocal[vertexIndex];
        if (!local) return null;

        return resolveLocalToBrepPick(metadata.panelModel.id, 'VERTEX', String(vertexIndex), local, hit.pickedPoint, panelView);
    }

    if (metadata.type === 'edge' && metadata.brepPoints && metadata.brepPoints.length >= 2) {
        // Krawędź z B-rep
        const p0Local = v3(metadata.brepPoints[0][0], metadata.brepPoints[0][1], metadata.brepPoints[0][2]);
        const p1Local = v3(metadata.brepPoints[1][0], metadata.brepPoints[1][1], metadata.brepPoints[1][2]);
        const hitPointWorld = hit.pickedPoint ? v3(hit.pickedPoint.x, hit.pickedPoint.y, hit.pickedPoint.z) : null;
        const hitPoint = hitPointWorld ? worldToLocalFromBrep(metadata.panelModel.id, hitPointWorld, panelView) : null;

        // Bliski punkt na odcinku B-rep (nie BoundingBox)
        const snapped = snapToLocalEdge(brep, p0Local, p1Local, hitPoint);
        if (snapped) {
            return resolveLocalToBrepPick(metadata.panelModel.id, 'EDGE', metadata.edgeKey || '0', snapped, hitPointWorld, panelView);
        }
        return null;
    }

    if (metadata.faceName) {
        // Ściana — rzut punktu na płaszczyznę B-rep
        const planeOrigin = brep.faceOriginLocal;
        const planeNormal = brep.faceNormalLocal;
        if (!planeOrigin || !planeNormal || v3Len(planeNormal) <= 1e-9) return null;
        const hitPointWorld = hit.pickedPoint ? v3(hit.pickedPoint.x, hit.pickedPoint.y, hit.pickedPoint.z) : null;
        const hitPoint = hitPointWorld ? worldToLocalFromBrep(metadata.panelModel.id, hitPointWorld, panelView) : null;

        const local = projectOnPlaneLocal(brep, hitPoint, planeOrigin, planeNormal);
        if (local) {
            return resolveLocalToBrepPick(metadata.panelModel.id, 'FACE', metadata.faceName, local, hitPointWorld, panelView);
        }
        return null;
    }

    return null;
}

/**
 * Konwertuje lokalny punkt B-rep na światowy i buduje PMIAnchorRef.
 */
function resolveLocalToBrepPick(
    nodeId: string,
    kind: 'VERTEX' | 'EDGE' | 'FACE',
    subKey: string,
    localPos: Vec3,
    hitPointWorld: Vec3 | null,
    panelView: any,
): ResolvedBrepPick {
    // Przelicz lokalny → światowy z CADNode.getWorldMatrix()
    const worldPos = localToWorldFromBrep(nodeId, localPos, panelView);

    // Budujemy anchor ref z B-rep danych
    const anchorRef = buildAnchorRefForBrep(nodeId, kind, subKey, localPos, worldPos);
    if (kind === 'EDGE' && hitPointWorld) {
        const edgePoints = panelView?._edgeMeshes?.find((mesh: any) => mesh?.metadata?.edgeKey === subKey || mesh?.metadata?.alias === subKey)?.metadata?.brepPoints;
        if (Array.isArray(edgePoints) && edgePoints.length >= 2) {
            const p0 = v3(edgePoints[0][0], edgePoints[0][1], edgePoints[0][2]);
            const p1 = v3(edgePoints[1][0], edgePoints[1][1], edgePoints[1][2]);
            const endpoint = v3Len(v3Sub(localPos, p0)) <= v3Len(v3Sub(localPos, p1)) ? 0 : 1;
            const endLocal = endpoint === 0 ? p0 : p1;
            const endWorld = localToWorldFromBrep(nodeId, endLocal, panelView);
            anchorRef.subIndex = endpoint;
            anchorRef.pointLocal = endLocal;
            anchorRef.pointWorldFallback = endWorld;
        }
    }

    return {
        kind,
        nodeId,
        subKey,
        worldPos,
        localPos,
        anchorRef,
    };
}

/**
 * Przelicza lokalny punkt B-rep (w mm) na światowy (w mm) z CADNode.
 */
export function localToWorldFromBrep(nodeId: string, localPos: Vec3, panelView?: any): Vec3 {
    const doc = ContextManager.instance.document;
    const cadNode = doc?.findNode(nodeId);
    if (!cadNode) {
        const renderMatrix = panelView?.root?.getWorldMatrix?.();
        if (renderMatrix && typeof BABYLON !== 'undefined' && BABYLON.Vector3?.TransformCoordinates) {
            const world = BABYLON.Vector3.TransformCoordinates(
                new BABYLON.Vector3(localPos.x, localPos.y, localPos.z), renderMatrix,
            );
            return v3(world.x, world.y, world.z);
        }
        return localPos;
    }

    const localCadMm = renderToCAD(new CadVec3(localPos.x, localPos.y, localPos.z));
    const localCadNm = new CadVec3(mmToNm(localCadMm.x), mmToNm(localCadMm.y), mmToNm(localCadMm.z));
    const worldCadNm = cadNode.getWorldMatrix().transformPoint(localCadNm);
    const worldCadMm = v3(nmToMm(worldCadNm.x), nmToMm(worldCadNm.y), nmToMm(worldCadNm.z));
    const worldRenderMm = cadToRender(new CadVec3(worldCadMm.x, worldCadMm.y, worldCadMm.z));
    return v3(worldRenderMm.x, worldRenderMm.y, worldRenderMm.z);
}

function worldToLocalFromBrep(nodeId: string, worldRenderMm: Vec3, panelView?: any): Vec3 {
    const cadNode = ContextManager.instance.document?.findNode(nodeId);
    if (!cadNode) {
        const renderMatrix = panelView?.root?.getWorldMatrix?.();
        if (renderMatrix && typeof BABYLON !== 'undefined' && BABYLON.Vector3?.TransformCoordinates) {
            const inverse = renderMatrix.clone?.().invert?.();
            if (inverse) {
                const local = BABYLON.Vector3.TransformCoordinates(
                    new BABYLON.Vector3(worldRenderMm.x, worldRenderMm.y, worldRenderMm.z), inverse,
                );
                return v3(local.x, local.y, local.z);
            }
        }
        return worldRenderMm;
    }
    const worldCadMm = renderToCAD(new CadVec3(worldRenderMm.x, worldRenderMm.y, worldRenderMm.z));
    const worldCadNm = new CadVec3(mmToNm(worldCadMm.x), mmToNm(worldCadMm.y), mmToNm(worldCadMm.z));
    const localCadNm = cadNode.getWorldMatrix().invert().transformPoint(worldCadNm);
    const localCadMm = v3(nmToMm(localCadNm.x), nmToMm(localCadNm.y), nmToMm(localCadNm.z));
    const localRenderMm = cadToRender(new CadVec3(localCadMm.x, localCadMm.y, localCadMm.z));
    return v3(localRenderMm.x, localRenderMm.y, localRenderMm.z);
}

/**
 * Buduje PMIAnchorRef dla B-rep danych.
 */
function buildAnchorRefForBrep(
    nodeId: string,
    kind: 'VERTEX' | 'EDGE' | 'FACE',
    subKey: string,
    localPos: Vec3,
    worldPos: Vec3,
): PMIAnchorRef {
    const smartIdPath = '';

    return {
        nodeId,
        smartIdPath,
        kind,
        subKey,
        subIndex: -1,
        pointLocal: localPos,
        pointWorldFallback: worldPos,
    };
}

/**
 * Znajduje najbliższy punkt na odcinku B-rep (w układzie lokalnym).
 */
function snapToLocalEdge(
    brep: BrepGeometryData,
    p0: Vec3,
    p1: Vec3,
    hitPoint: Vec3 | null,
): Vec3 | null {
    if (!hitPoint) {
        // Zwróć środek krawędzi
        return v3((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
    }

    const dir = v3Sub(p1, p0);
    const lenSq = v3Dot(dir, dir);
    if (lenSq < 1e-12) return p0; // Krawędź punktowa

    const toHit = v3Sub(hitPoint, p0);
    let t = v3Dot(toHit, dir) / lenSq;
    t = Math.max(0, Math.min(1, t)); // Ogranicz do <0,1>

    return v3Add(p0, v3Scale(dir, t));
}

/**
 * Rzuca punkt na płaszczyznę B-rep (w układzie lokalnym).
 */
function projectOnPlaneLocal(
    brep: BrepGeometryData,
    hitPoint: Vec3 | null,
    planeOrigin: Vec3,
    planeNormal: Vec3,
): Vec3 | null {
    if (!hitPoint) {
        return planeOrigin;
    }

    const toHit = v3Sub(hitPoint, planeOrigin);
    const dist = v3Dot(toHit, planeNormal);

    return v3Sub(hitPoint, v3Scale(planeNormal, dist));
}

export function getWorldMatrixArray(node: any): number[] | null {
    const m = node?.getWorldMatrix?.();
    if (!m) return null;
    return Array.from(m._m || m.m || m.toArray());
}

/**
 * Macierz świata węzła, do którego przypięta jest kotwica (dla trybu LOCAL solvera).
 */
export function resolveAnchorMatrix(scene: any, ref: PMIAnchorRef | null): number[] | null {
    if (!ref?.nodeId) return null;
    return getWorldMatrixArray(findNodeRoot(scene, ref.nodeId));
}

/**
 * Wyznacza aktualną pozycję światową kotwicy.
 *
 * Najpierw próbujemy odczytać element z żywej geometrii (nadąża za zmianą
 * wymiarów formatki), a dopiero potem sięgamy po zapisany punkt lokalny.
 * Gdy węzeł zniknął ze sceny — usunięty albo jeszcze niezbudowany — używana
 * jest ostatnia znana pozycja światowa, żeby wymiar nie zapadł się do zera.
 */
export function resolveAnchorWorld(scene: any, ref: PMIAnchorRef | null): Vec3 | null {
    if (!ref) return null;

    if (!ref.nodeId) {
        return ref.pointWorldFallback ?? ref.pointLocal;
    }

    const root = findNodeRoot(scene, ref.nodeId);
    const worldMatrix = root?.getWorldMatrix?.();
    if (!worldMatrix) {
        return ref.pointWorldFallback ?? ref.pointLocal;
    }

    const local = currentLocalPoint(scene, ref) ?? ref.pointLocal;

    const result = BABYLON.Vector3.TransformCoordinates(
        new BABYLON.Vector3(local.x, local.y, local.z),
        worldMatrix,
    );
    return v3(result.x, result.y, result.z);
}

/**
 * Przelicza wektor kierunkowy (kierunek krawędzi, normalna, odsunięcie) z układu
 * lokalnego węzła kotwicy do przestrzeni świata.
 *
 * W odróżnieniu od punktów używamy transformacji wektora, więc translacja węzła
 * nie ma znaczenia — liczy się wyłącznie jego obrót.
 */
export function resolveDirectionWorld(scene: any, ref: PMIAnchorRef | null, dirLocal: Vec3 | null): Vec3 | null {
    if (!dirLocal) return null;
    if (!ref?.nodeId) return dirLocal;

    const root = findNodeRoot(scene, ref.nodeId);
    const worldMatrix = root?.getWorldMatrix?.();
    if (!worldMatrix) return dirLocal;

    const result = BABYLON.Vector3.TransformNormal(
        new BABYLON.Vector3(dirLocal.x, dirLocal.y, dirLocal.z),
        worldMatrix,
    );
    return v3(result.x, result.y, result.z);
}

/**
 * Odwrotność `resolveDirectionWorld` — zamienia wektor światowy na lokalny
 * względem węzła kotwicy, żeby dało się go trwale zapisać.
 */
export function directionToLocal(scene: any, ref: PMIAnchorRef | null, dirWorld: Vec3 | null): Vec3 | null {
    if (!dirWorld) return null;
    if (!ref?.nodeId) return dirWorld;

    const root = findNodeRoot(scene, ref.nodeId);
    const worldMatrix = root?.getWorldMatrix?.();
    if (!worldMatrix) return dirWorld;

    const inv = worldMatrix.clone().invert();
    const result = BABYLON.Vector3.TransformNormal(
        new BABYLON.Vector3(dirWorld.x, dirWorld.y, dirWorld.z),
        inv,
    );
    return v3(result.x, result.y, result.z);
}

// ============================================================================
// DIMENSION SMART IDs
// ============================================================================

/**
 * Rejestruje wymiar w globalnym rejestrze SmartID jako `dim:<id>` pod ścieżką
 * formatki, do której jest zaczepiony. Odpowiednik `register_dimension_smart_id()`.
 */
export function registerDimensionSmartId(dimensionId: string, ownerRef: PMIAnchorRef | null): string {
    const parentPath = ownerRef?.smartIdPath ? (ownerRef.smartIdPath.split('/').slice(0, 2).join('/')) : '';
    const smartId = IDManager.getInstance().registerStable(
        EntityType.DIMENSION,
        parentPath,
        dimensionId,
        { dimensionId },
    );
    return smartId.fullPath;
}

export function unregisterDimensionSmartId(smartIdPath: string): void {
    if (!smartIdPath) return;
    IDManager.getInstance().unregister(smartIdPath);
}
