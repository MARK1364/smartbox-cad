/**
 * PMI ID Bridge — TypeScript
 *
 * Odpowiednik `pmi_id_bridge.py`. Wiąże adnotacje wymiarowe z geometrią przez
 * identyfikatory, które przeżywają przebudowę siatek i zapis projektu.
 *
 * DLACZEGO NIE NAZWA SIATKI:
 * Siatki Babylona (`face_FRONT`, `edge_3`, `vertex_7`) są tworzone od nowa przy
 * każdym `PanelView.updateMesh()`, ich nazwy nie są unikalne między formatkami,
 * a `uniqueId` zmienia się w obrębie sesji. Trwałe jest wyłącznie `CADNode.id`
 * (równe `PanelModel.id`), bo tylko ono trafia do serializacji dokumentu.
 */

declare const BABYLON: any;

import { Vec3, v3, v3Len, v3Sub } from './dimension-solver';
import { ContextManager } from '../A1_core/context-manager';
import { IDManager, EntityType } from '../A1_core/id-manager';

// ============================================================================
// TYPES
// ============================================================================

export type PMIAnchorKind = 'VERTEX' | 'EDGE' | 'FACE' | 'FEATURE' | 'FREE';

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
 * Jest to odpowiednik rozwiązywania SmartID w Blenderze i pokrywa przypadek,
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

        const mesh = entry.meshes.find(m => m?.metadata?.type === 'edge' && String(m.metadata.edgeKey) === ref.subKey);
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

/**
 * Przy tworzeniu wymiaru: przyciąga kliknięcie na ścianie do najbliższego narożnika
 * lub końca krawędzi OCCT, żeby kotwica przeżyła przebudowę geometrii.
 */
export function snapWorldPointToPanelGeometry(
    scene: any,
    mesh: any,
    worldPoint: Vec3,
    snapRadiusMM = 30,
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
 * Dla krawędzi wykrytej na ścianie: jeśli istnieje odpowiadająca krawędź OCCT,
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
// RESOLVING REFS
// ============================================================================

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
