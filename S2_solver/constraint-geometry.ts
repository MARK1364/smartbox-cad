/**
 * constraint-geometry.ts — rozwiązywanie kotwic więzów na geometrię lokalną.
 *
 * Zamienia stabilną `ConstraintAnchor` (nazwa ściany / numer narożnika) na
 * konkretny punkt albo parę (środek, normalna) w lokalnym układzie węzła, w mm.
 * To odpowiednik pythonowego czytania `mesh.vertices[i].co` i `mesh.polygons[i]`,
 * tylko oparty na modelu domenowym, a nie na siatce — bo siatka w web jest
 * regenerowana i jej indeksy nie są trwałe.
 *
 * Konwencje bryły lokalnej w CAD (Z-up). Mesh formatki jest budowany w osiach
 * Babylona (grubość na Z, wysokość na Y); adapter zamienia Y↔Z, więc LCS CAD
 * formatki to X = szerokość, Y = grubość, Z = wysokość.
 *
 *   PART / PanelModel      — wyśrodkowana we wszystkich osiach:
 *                            X ∈ [-w/2, w/2], Y ∈ [-t/2, t/2], Z ∈ [-h/2, h/2]
 *
 *   ASSEMBLY / ContainerModel — wyśrodkowana w X i Y, ale stojąca na Z = 0:
 *                            X ∈ [-w/2, w/2], Y ∈ [-d/2, d/2], Z ∈ [0, h]
 *                            (skutek `bakeTransformIntoVertices` w container-view.ts)
 *
 * Nazwy ścian formatki zostają w konwencji panelu (front = FACE_Z_PLUS),
 * ale wskazują osie CAD po zamianie Y↔Z: FACE_Z_* → oś Y, FACE_Y_* → oś Z.
 */

import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { renderToCAD } from '../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { normalizeFaceName } from '../A4_smartpanel/panel-model.js';
import type { Vec3 as SolverVec3 } from './core/math3d.js';
import { CORNER_COUNT, type ConstraintAnchor } from './constraint-types.js';

export interface LocalBoxMm {
    min: SolverVec3;
    max: SolverVec3;
}

/** Bryła gabarytowa węzła w jego własnym układzie lokalnym [mm], albo null. */
export function getLocalBoxMm(node: CADNode | null): LocalBoxMm | null {
    const domain = node?.domainData as any;
    if (!node || !domain) {
        return null;
    }

    if (node.nodeType === NodeType.PART) {
        const w = nmToMm(domain.width);
        const h = nmToMm(domain.height);
        const t = nmToMm(domain.thickness);
        if (![w, h, t].every(Number.isFinite)) {
            return null;
        }
        return {
            min: [-w / 2, -t / 2, -h / 2],
            max: [w / 2, t / 2, h / 2],
        };
    }

    if (node.nodeType === NodeType.ASSEMBLY) {
        const w = nmToMm(domain.width);
        const d = nmToMm(domain.depth);
        const h = nmToMm(domain.height);
        if (![w, d, h].every(Number.isFinite)) {
            return null;
        }
        return {
            min: [-w / 2, -d / 2, 0],
            max: [w / 2, d / 2, h],
        };
    }

    return null;
}

/** Punkt narożnika bryły w układzie lokalnym [mm]. Numeracja: patrz constraint-types.ts. */
export function resolveCornerLocalMm(node: CADNode | null, cornerIndex: number): SolverVec3 | null {
    if (cornerIndex < 0 || cornerIndex >= CORNER_COUNT) {
        return null;
    }
    const box = getLocalBoxMm(node);
    if (!box) {
        return null;
    }
    return [
        cornerIndex & 1 ? box.max[0] : box.min[0],
        cornerIndex & 2 ? box.max[1] : box.min[1],
        cornerIndex & 4 ? box.max[2] : box.min[2],
    ];
}

const FACE_AXIS: Record<string, { axis: 0 | 1 | 2; positive: boolean }> = {
    FACE_X_PLUS: { axis: 0, positive: true },
    FACE_X_MINUS: { axis: 0, positive: false },
    FACE_Y_PLUS: { axis: 1, positive: true },
    FACE_Y_MINUS: { axis: 1, positive: false },
    FACE_Z_PLUS: { axis: 2, positive: true },
    FACE_Z_MINUS: { axis: 2, positive: false },
};

/**
 * Nazwy ścian formatki są w konwencji panelu (front = +Z mesha / Babylona).
 * W LCS CAD formatki grubość leży na Y, a wysokość na Z — zamieniamy osie 1↔2.
 */
function faceAxisSpec(
    node: CADNode | null,
    canonical: string,
): { axis: 0 | 1 | 2; positive: boolean } | null {
    const spec = FACE_AXIS[canonical];
    if (!spec) {
        return null;
    }
    if (node?.nodeType === NodeType.PART) {
        if (spec.axis === 1) {
            return { axis: 2, positive: spec.positive };
        }
        if (spec.axis === 2) {
            return { axis: 1, positive: spec.positive };
        }
    }
    return spec;
}

function canonicalFaceName(faceName: string): string | null {
    if (!faceName || !faceName.trim()) {
        return null;
    }
    try {
        return normalizeFaceName(faceName);
    } catch {
        return null;
    }
}

/**
 * Środek i normalna ściany w układzie lokalnym [mm].
 * Nazwa ściany przechodzi przez `normalizeFaceName`, więc aliasy w rodzaju
 * 'top' / 'left' działają tak samo jak w reszcie aplikacji.
 */
export function resolveFaceLocalMm(
    node: CADNode | null,
    faceName: string,
): [SolverVec3, SolverVec3] | null {
    const box = getLocalBoxMm(node);
    if (!box) {
        return null;
    }
    // `normalizeFaceName('')` zwraca FACE_Z_PLUS — pusta nazwa nie może cicho
    // stać się górną ścianą bryły.
    const canonical = canonicalFaceName(faceName);
    if (!canonical) {
        return null;
    }

    const spec = faceAxisSpec(node, canonical);
    if (!spec) {
        return null;
    }

    const center: SolverVec3 = [
        (box.min[0] + box.max[0]) / 2,
        (box.min[1] + box.max[1]) / 2,
        (box.min[2] + box.max[2]) / 2,
    ];
    center[spec.axis] = spec.positive ? box.max[spec.axis] : box.min[spec.axis];

    const normal: SolverVec3 = [0, 0, 0];
    normal[spec.axis] = spec.positive ? 1 : -1;

    return [center, normal];
}

function projectPointOntoPlane(
    point: SolverVec3,
    planePoint: SolverVec3,
    normal: SolverVec3,
): SolverVec3 {
    const dx = point[0] - planePoint[0];
    const dy = point[1] - planePoint[1];
    const dz = point[2] - planePoint[2];
    const d = dx * normal[0] + dy * normal[1] + dz * normal[2];
    return [point[0] - d * normal[0], point[1] - d * normal[1], point[2] - d * normal[2]];
}

/**
 * Płaszczyzna z nazwy ściany picka (metadata mesha), nie z getNormal().
 *
 * Meshe `front`/`back` formatki mają geometryczną +Z skierowaną do środka płyty
 * (front obrócony o 180°, back bez obrotu, oba DOUBLESIDE). Raycast podświetla
 * właściwą ścianę po `faceName`, ale getNormal() wskazuje przeciwną — INNER
 * zamiast OUTER. Solver i overlay muszą iść za nazwą z picka.
 */
export function namedFaceFromPick(
    node: CADNode,
    faceName: string,
    pickPointMm?: SolverVec3 | null,
): { localPointMm: SolverVec3; localNormalMm: SolverVec3 } | null {
    const face = resolveFaceLocalMm(node, faceName);
    if (!face) {
        return null;
    }
    const point = pickPointMm
        ? projectPointOntoPlane(pickPointMm, face[0], face[1])
        : face[0];
    return { localPointMm: point, localNormalMm: face[1] };
}

export interface FaceQuadMm {
    center: SolverVec3;
    normal: SolverVec3;
    /** Oś szerokości prostokąta w LCS węzła. */
    uAxis: SolverVec3;
    /** Oś wysokości prostokąta w LCS węzła. */
    vAxis: SolverVec3;
    /** Rozmiar płaszczyzny w osiach stycznych [mm]. */
    width: number;
    height: number;
}

/** Prostokąt ściany bryły — do overlay podświetlenia więzu. */
export function resolveFaceQuadMm(node: CADNode | null, faceName: string): FaceQuadMm | null {
    const box = getLocalBoxMm(node);
    const face = resolveFaceLocalMm(node, faceName);
    if (!box || !face) {
        return null;
    }
    const canonical = canonicalFaceName(faceName) ?? faceName;
    const spec = faceAxisSpec(node, canonical);
    const axis = spec?.axis ?? 2;
    const sizes = [
        box.max[0] - box.min[0],
        box.max[1] - box.min[1],
        box.max[2] - box.min[2],
    ];
    const tangents = [0, 1, 2].filter((a) => a !== axis);
    const uAxis: SolverVec3 = [0, 0, 0];
    const vAxis: SolverVec3 = [0, 0, 0];
    uAxis[tangents[0]] = 1;
    vAxis[tangents[1]] = 1;
    return {
        center: face[0],
        normal: face[1],
        uAxis,
        vAxis,
        width: sizes[tangents[0]] || 100,
        height: sizes[tangents[1]] || 100,
    };
}

const CAD_FACE_FROM_AXIS: Record<string, string> = {
    '0+': 'FACE_X_PLUS',
    '0-': 'FACE_X_MINUS',
    '1+': 'FACE_Y_PLUS',
    '1-': 'FACE_Y_MINUS',
    '2+': 'FACE_Z_PLUS',
    '2-': 'FACE_Z_MINUS',
};

/**
 * Zamienia normalną w LCS węzła na kanoniczną nazwę ściany.
 * Dla formatki wynik jest w konwencji panelu (front = FACE_Z_PLUS),
 * bo tak nazywane są meshe i kotwice.
 */
export function faceNameFromLocalNormal(normal: SolverVec3, nodeType?: string): string {
    let bestAxis: 0 | 1 | 2 = 2;
    let bestSign = 1;
    let bestDot = -Infinity;
    for (const axis of [0, 1, 2] as const) {
        for (const sign of [1, -1] as const) {
            const dot = normal[axis] * sign;
            if (dot > bestDot) {
                bestDot = dot;
                bestAxis = axis;
                bestSign = sign;
            }
        }
    }
    let cadAxis = bestAxis;
    if (nodeType === NodeType.PART) {
        if (cadAxis === 1) {
            cadAxis = 2;
        } else if (cadAxis === 2) {
            cadAxis = 1;
        }
    }
    return CAD_FACE_FROM_AXIS[`${cadAxis}${bestSign > 0 ? '+' : '-'}`] ?? 'FACE_Z_PLUS';
}

/** CAD-owa nazwa ściany AABB → nazwa zapisana w kotwicy (panel zamienia Y↔Z). */
function storedFaceNameFromBoxFace(boxFaceName: string, nodeType?: string): string {
    if (nodeType !== NodeType.PART) {
        return boxFaceName;
    }
    if (boxFaceName === 'FACE_Y_PLUS') {
        return 'FACE_Z_PLUS';
    }
    if (boxFaceName === 'FACE_Y_MINUS') {
        return 'FACE_Z_MINUS';
    }
    if (boxFaceName === 'FACE_Z_PLUS') {
        return 'FACE_Y_PLUS';
    }
    if (boxFaceName === 'FACE_Z_MINUS') {
        return 'FACE_Y_MINUS';
    }
    return boxFaceName;
}

/** Etykiety ścian SmartFrame w LCS korpusu (CAD: Y=głęb, Z=wys). */
export const SMARTFRAME_FACE_LABEL: Record<string, string> = {
    FACE_X_PLUS: 'prawy',
    FACE_X_MINUS: 'lewy',
    FACE_Y_PLUS: 'tył',
    FACE_Y_MINUS: 'przód',
    FACE_Z_PLUS: 'góra',
    FACE_Z_MINUS: 'dół',
};

/** Etykiety ścian formatki w LCS panelu (Y=wys, Z=grubość). */
export const PANEL_FACE_LABEL: Record<string, string> = {
    FACE_Z_PLUS: 'front',
    FACE_Z_MINUS: 'tył',
    FACE_X_MINUS: 'lewy',
    FACE_X_PLUS: 'prawy',
    FACE_Y_PLUS: 'góra',
    FACE_Y_MINUS: 'dół',
    front: 'front',
    back: 'tył',
    left: 'lewy',
    right: 'prawy',
    top: 'góra',
    bottom: 'dół',
};

const AXIS_LETTER = ['X', 'Y', 'Z'] as const;

/** Strona LCS z nazwy ściany: `+Z`, `-X`. Konwencja nazwy (front = +Z), nie CAD po Y↔Z. */
export function faceAxisTag(faceName: string): string | null {
    const canonical = canonicalFaceName(faceName);
    if (!canonical) {
        return null;
    }
    const spec = FACE_AXIS[canonical];
    if (!spec) {
        return null;
    }
    return `${spec.positive ? '+' : '-'}${AXIS_LETTER[spec.axis]}`;
}

export function faceAnchorLabel(faceName: string, nodeType?: string): string {
    const table = nodeType === NodeType.PART ? PANEL_FACE_LABEL : SMARTFRAME_FACE_LABEL;
    const word =
        table[faceName] ??
        PANEL_FACE_LABEL[faceName] ??
        faceName.replace(/^FACE_/, '').toLowerCase();
    const tag = faceAxisTag(faceName);
    return tag ? `${word} (${tag})` : word;
}

const FACE_OUTWARD: Record<string, SolverVec3> = {
    FACE_X_PLUS: [1, 0, 0],
    FACE_X_MINUS: [-1, 0, 0],
    FACE_Y_PLUS: [0, 1, 0],
    FACE_Y_MINUS: [0, -1, 0],
    FACE_Z_PLUS: [0, 0, 1],
    FACE_Z_MINUS: [0, 0, -1],
};

/**
 * Najbliższa ściana bryły SmartFrame do punktu w LCS korpusu.
 * Na krawędzi (dwa dystanse ≈ 0) wygrywa ściana skierowana do kamery —
 * klik w przednią krawędź boczka daje PRZÓD, nie tył.
 *
 * `viewDirCad` to kierunek patrzenia kamery w CAD (Z-up).
 */
export function nearestSmartFrameFace(
    box: LocalBoxMm,
    point: SolverVec3,
    viewDirCad?: SolverVec3 | null,
): string {
    const dist: Array<{ name: string; d: number }> = [
        { name: 'FACE_X_MINUS', d: Math.abs(point[0] - box.min[0]) },
        { name: 'FACE_X_PLUS', d: Math.abs(point[0] - box.max[0]) },
        { name: 'FACE_Y_MINUS', d: Math.abs(point[1] - box.min[1]) },
        { name: 'FACE_Y_PLUS', d: Math.abs(point[1] - box.max[1]) },
        { name: 'FACE_Z_MINUS', d: Math.abs(point[2] - box.min[2]) },
        { name: 'FACE_Z_PLUS', d: Math.abs(point[2] - box.max[2]) },
    ];
    dist.sort((a, b) => a.d - b.d);
    const best = dist[0].d;
    const tied = dist.filter((x) => x.d <= best + 25);

    if (tied.length === 1 || !viewDirCad) {
        return dist[0].name;
    }

    let bestName = tied[0].name;
    let bestFacing = -Infinity;
    const vx = viewDirCad[0];
    const vy = viewDirCad[1];
    const vz = viewDirCad[2];
    for (const t of tied) {
        const n = FACE_OUTWARD[t.name];
        // Ściana „do kamery": normalna na zewnątrz przeciwna do kierunku patrzenia.
        const facing = -(n[0] * vx + n[1] * vy + n[2] * vz);
        if (facing > bestFacing) {
            bestFacing = facing;
            bestName = t.name;
        }
    }
    return bestName;
}

export function nearestSmartFrameCorner(box: LocalBoxMm, point: SolverVec3): number {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < CORNER_COUNT; i++) {
        const cx = i & 1 ? box.max[0] : box.min[0];
        const cy = i & 2 ? box.max[1] : box.min[1];
        const cz = i & 4 ? box.max[2] : box.min[2];
        const dx = point[0] - cx;
        const dy = point[1] - cy;
        const dz = point[2] - cz;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    }
    return best;
}

/**
 * Kotwica na bryle klikniętego węzła (formatka albo korpus).
 * Nie przenosi picka na rodzica SmartFrame.
 *
 * `localNormalMm` to normalna trafionej powierzchni w LCS węzła. Gdy jest
 * dostępna, rozstrzyga o wyborze ściany — heurystyka „najbliższa ściana +
 * kierunek kamery" jest tu zawodna, bo klik w dolną krawędź szafy remisuje
 * między dnem i frontem, a front zawsze wygrywa jako zwrócony do kamery.
 */
export function snapPickToSmartFrame(
    node: CADNode,
    kind: 'FACE' | 'VERTEX',
    localPointMm: SolverVec3,
    viewDirCad?: SolverVec3 | null,
    localNormalMm?: SolverVec3 | null,
): { faceName: string; cornerIndex: number; localPointMm: SolverVec3; localNormalMm?: SolverVec3 } | null {
    const box = getLocalBoxMm(node);
    if (!box) {
        return null;
    }

    if (kind === 'VERTEX') {
        const cornerIndex = nearestSmartFrameCorner(box, localPointMm);
        const point = [
            cornerIndex & 1 ? box.max[0] : box.min[0],
            cornerIndex & 2 ? box.max[1] : box.min[1],
            cornerIndex & 4 ? box.max[2] : box.min[2],
        ] as SolverVec3;
        return { faceName: '', cornerIndex, localPointMm: point };
    }

    const hasNormal =
        Boolean(localNormalMm) && Math.hypot(localNormalMm![0], localNormalMm![1], localNormalMm![2]) > 0.5;
    const faceName = hasNormal
        ? faceNameFromLocalNormal(localNormalMm!, node.nodeType)
        : storedFaceNameFromBoxFace(nearestSmartFrameFace(box, localPointMm, viewDirCad), node.nodeType);
    const face = resolveFaceLocalMm(node, faceName);
    if (!face) {
        return null;
    }
    return {
        faceName,
        cornerIndex: -1,
        localPointMm: face[0],
        localNormalMm: face[1],
    };
}

/**
 * Przekształca trafienie pickera (Babylon Y-up, mm) na punkt/normalną w LCS węzła [mm, CAD Z-up].
 */
export function babylonPickToLocalMm(
    node: CADNode,
    worldPointBabylon: { x: number; y: number; z: number },
    worldNormalBabylon?: { x: number; y: number; z: number } | null,
): { localPointMm: SolverVec3; localNormalMm: SolverVec3 | null } {
    const worldCadMm = renderToCAD(new Vec3(worldPointBabylon.x, worldPointBabylon.y, worldPointBabylon.z));
    const { translation, rotation } = node.getWorldMatrix().decompose();
    const worldOriginCadMm = new Vec3(
        nmToMm(translation.x),
        nmToMm(translation.y),
        nmToMm(translation.z),
    );

    const invRot = rotation.inverse();
    const relative = worldCadMm.sub(worldOriginCadMm);
    const localPoint = invRot.rotateVec3(relative);
    const localPointMm: SolverVec3 = [localPoint.x, localPoint.y, localPoint.z];

    if (!worldNormalBabylon) {
        return { localPointMm, localNormalMm: null };
    }

    const worldNormCad = renderToCAD(
        new Vec3(worldNormalBabylon.x, worldNormalBabylon.y, worldNormalBabylon.z),
    ).normalize();
    const localNorm = invRot.rotateVec3(worldNormCad).normalize();
    return {
        localPointMm,
        localNormalMm: [localNorm.x, localNorm.y, localNorm.z],
    };
}

export function findDescendant(node: CADNode, id: string): CADNode | null {
    for (const child of node.children) {
        if (child.id === id) {
            return child;
        }
        const deeper = findDescendant(child, id);
        if (deeper) {
            return deeper;
        }
    }
    return null;
}

/** Węzeł geometrii (formatka) albo sama bryła, gdy pick był na korpusie. */
export function resolveGeomNode(body: CADNode, anchor: ConstraintAnchor): CADNode {
    if (!anchor.sourceNodeId || anchor.sourceNodeId === body.id) {
        return body;
    }
    return findDescendant(body, anchor.sourceNodeId) ?? body;
}

function nodeOriginMm(node: CADNode): Vec3 {
    const { translation } = node.getWorldMatrix().decompose();
    return new Vec3(nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z));
}

export function localMmToWorldMm(node: CADNode, localMm: SolverVec3): Vec3 {
    const { rotation } = node.getWorldMatrix().decompose();
    return nodeOriginMm(node).add(rotation.rotateVec3(new Vec3(localMm[0], localMm[1], localMm[2])));
}

export function worldMmToLocalMm(node: CADNode, worldMm: Vec3): SolverVec3 {
    const { rotation } = node.getWorldMatrix().decompose();
    const local = rotation.inverse().rotateVec3(worldMm.sub(nodeOriginMm(node)));
    return [local.x, local.y, local.z];
}

/** Kierunek lokalny z jednego węzła do LCS drugiego (bez translacji). */
export function mapLocalDirToNode(
    fromNode: CADNode,
    toNode: CADNode,
    localDir: SolverVec3,
): SolverVec3 {
    if (fromNode.id === toNode.id) {
        return [...localDir];
    }
    const { rotation: fromRot } = fromNode.getWorldMatrix().decompose();
    const { rotation: toRot } = toNode.getWorldMatrix().decompose();
    const world = fromRot.rotateVec3(new Vec3(localDir[0], localDir[1], localDir[2]));
    const local = toRot.inverse().rotateVec3(world).normalize();
    return [local.x, local.y, local.z];
}

export function mapLocalMmToNode(
    fromNode: CADNode,
    toNode: CADNode,
    localPointMm: SolverVec3,
    localNormalMm?: SolverVec3 | null,
): { localPointMm: SolverVec3; localNormalMm: SolverVec3 | null } {
    if (fromNode.id === toNode.id) {
        return {
            localPointMm: [...localPointMm],
            localNormalMm: localNormalMm ? [...localNormalMm] : null,
        };
    }
    const worldPoint = localMmToWorldMm(fromNode, localPointMm);
    const point = worldMmToLocalMm(toNode, worldPoint);
    if (!localNormalMm) {
        return { localPointMm: point, localNormalMm: null };
    }
    const { rotation: fromRot } = fromNode.getWorldMatrix().decompose();
    const { rotation: toRot } = toNode.getWorldMatrix().decompose();
    const worldN = fromRot.rotateVec3(new Vec3(localNormalMm[0], localNormalMm[1], localNormalMm[2])).normalize();
    const localN = toRot.inverse().rotateVec3(worldN).normalize();
    return { localPointMm: point, localNormalMm: [localN.x, localN.y, localN.z] };
}

export interface ResolvedAnchor {
    /** Punkt w układzie lokalnym bryły sztywnej [mm]. Dla OBJECT jest to początek układu. */
    localPointMm: SolverVec3;
    /** Normalna lokalna — tylko dla kotwic FACE, w pozostałych przypadkach null. */
    localNormal: SolverVec3 | null;
}

/**
 * Odświeża płaszczyznę kotwicy z aktualnych wymiarów geometrii.
 *
 * Zachowujemy styczne współrzędne zapisanego punktu (ważne dla GROUND), ale
 * rzutujemy go na bieżącą pozycję nazwanej ściany. Dzięki temu zmiana wymiaru
 * lub położenia formatki aktualizuje kotwicę bez konieczności ponownego picka.
 */
function liveFaceNameFromSnapshot(
    body: CADNode,
    geometry: CADNode,
    faceName: string,
    snapshot: ResolvedAnchor | null,
): string {
    if (!snapshot?.localNormal) {
        return faceName;
    }
    const nGeom =
        geometry.id === body.id
            ? snapshot.localNormal
            : mapLocalDirToNode(body, geometry, snapshot.localNormal);
    const fromNormal = faceNameFromLocalNormal(nGeom, geometry.nodeType);
    const named = resolveFaceLocalMm(geometry, faceName);
    if (!named) {
        return fromNormal;
    }
    const alignment =
        nGeom[0] * named[1][0] + nGeom[1] * named[1][1] + nGeom[2] * named[1][2];
    // Ta sama oś (nawet odwrócona normalna mesha front/back) → nazwa z picka.
    // Inna oś → historyczna nazwa vs obrócona formatka, wygrywa snapshot.
    return Math.abs(alignment) >= 0.5 ? faceName : fromNormal;
}

function resolveLiveFaceAnchor(
    body: CADNode,
    geometry: CADNode,
    faceName: string,
    snapshot: ResolvedAnchor | null,
): ResolvedAnchor | null {
    const liveFaceName = liveFaceNameFromSnapshot(body, geometry, faceName, snapshot);
    const face = resolveFaceLocalMm(geometry, liveFaceName) ?? resolveFaceLocalMm(geometry, faceName);
    if (!face) {
        return null;
    }

    const snapshotInGeometry = snapshot
        ? geometry.id === body.id
            ? snapshot.localPointMm
            : mapLocalMmToNode(body, geometry, snapshot.localPointMm).localPointMm
        : face[0];
    const refreshedPoint = projectPointOntoPlane(snapshotInGeometry, face[0], face[1]);
    const mapped = mapLocalMmToNode(geometry, body, refreshedPoint, face[1]);
    return { localPointMm: mapped.localPointMm, localNormal: mapped.localNormalMm };
}

/**
 * Rozwiązuje kotwicę na geometrię w LCS bryły sztywnej (`node`).
 * Gdy kotwica ma `sourceNodeId` (kliknięta formatka), ściana jest liczona
 * na formatce i mapowana do LCS korpusu — solver rusza korpus, płyta zostaje.
 */
export function resolveAnchor(
    node: CADNode | null,
    anchor: ConstraintAnchor,
    geomNode?: CADNode | null,
): ResolvedAnchor | null {
    if (!node) {
        return null;
    }

    const source =
        geomNode && geomNode.id !== node.id
            ? geomNode
            : anchor.sourceNodeId && anchor.sourceNodeId !== node.id
              ? findDescendant(node, anchor.sourceNodeId)
              : null;

    /**
     * Kotwica deklaruje geometrię na formatce. `faceName` / `cornerIndex` są
     * wtedy wyrażone w konwencji TEJ formatki (front = +Z), a nie bryły
     * sztywnej (góra = +Z). Bez formatki nazwy nie wolno odczytać na bryle —
     * dałaby inną ścianę, obróconą względem wyboru użytkownika.
     */
    const declaresSource = Boolean(anchor.sourceNodeId) && anchor.sourceNodeId !== node.id;

    if (anchor.kind === 'OBJECT') {
        return { localPointMm: [0, 0, 0], localNormal: null };
    }

    if (anchor.kind === 'VERTEX') {
        if (source) {
            const corner = resolveCornerLocalMm(source, anchor.cornerIndex);
            const local = corner ?? anchor.localPointMm;
            if (!local) {
                return null;
            }
            const mapped = mapLocalMmToNode(source, node, local);
            return { localPointMm: mapped.localPointMm, localNormal: null };
        }
        if (anchor.localPointMm) {
            return { localPointMm: [...anchor.localPointMm], localNormal: null };
        }
        if (declaresSource) {
            return null;
        }
        const point = resolveCornerLocalMm(node, anchor.cornerIndex);
        return point ? { localPointMm: point, localNormal: null } : null;
    }

    const snapshot: ResolvedAnchor | null =
        anchor.localPointMm && anchor.localNormalMm
            ? { localPointMm: [...anchor.localPointMm], localNormal: [...anchor.localNormalMm] }
            : null;

    /**
     * Żywa geometria wygrywa ze snapshotem: `faceName` jest interpretowane
     * w układzie właściwego węzła (formatki albo korpusu), a zapisany punkt
     * zostaje rzutowany na aktualną płaszczyznę. Snapshot jest awaryjnym
     * fallbackiem wyłącznie po utracie źródłowej formatki.
     */
    if (source) {
        const live = resolveLiveFaceAnchor(node, source, anchor.faceName, snapshot);
        if (live) {
            return live;
        }
        return snapshot;
    }

    if (declaresSource) {
        return snapshot;
    }

    const live = resolveLiveFaceAnchor(node, node, anchor.faceName, snapshot);
    if (live) {
        return live;
    }
    if (snapshot) {
        return snapshot;
    }
    const fromNormal = anchor.localNormalMm
        ? resolveFaceLocalMm(node, faceNameFromLocalNormal(anchor.localNormalMm, node.nodeType))
        : null;
    if (fromNormal) {
        return { localPointMm: [...fromNormal[0]], localNormal: [...fromNormal[1]] };
    }
    return null;
}

function normalizeDir(v: SolverVec3): SolverVec3 {
    const len = Math.hypot(v[0], v[1], v[2]);
    if (len < 1e-9) {
        return [0, 0, 1];
    }
    return [v[0] / len, v[1] / len, v[2] / len];
}

function perpendicularDir(n: SolverVec3): SolverVec3 {
    const ax = Math.abs(n[0]);
    const ay = Math.abs(n[1]);
    const az = Math.abs(n[2]);
    if (ax <= ay && ax <= az) {
        return normalizeDir([0, -n[2], n[1]]);
    }
    if (ay <= ax && ay <= az) {
        return normalizeDir([-n[2], 0, n[0]]);
    }
    return normalizeDir([-n[1], n[0], 0]);
}

function crossDir(a: SolverVec3, b: SolverVec3): SolverVec3 {
    return normalizeDir([
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]);
}

/** Rozmiar bryły wzdłuż dowolnego kierunku (funkcja podparcia AABB). */
function boxExtentAlong(box: LocalBoxMm, dir: SolverVec3): number {
    const sx = box.max[0] - box.min[0];
    const sy = box.max[1] - box.min[1];
    const sz = box.max[2] - box.min[2];
    return Math.abs(dir[0]) * sx + Math.abs(dir[1]) * sy + Math.abs(dir[2]) * sz;
}

/**
 * Środek prostokąta podglądu: kliknięta ściana, nie punkt picka.
 * Punkt picka zostaje na płaszczyźnie dla solvera; overlay wyśrodkowany na
 * picku zjeżdża na sąsiedni korpus po wyrównaniu.
 */
function overlayCenterMm(
    body: CADNode,
    anchor: ConstraintAnchor,
    source: CADNode | null,
    planePoint: SolverVec3,
    normal: SolverVec3,
): SolverVec3 {
    if (
        anchor.quadCenterMm &&
        Number.isFinite(anchor.quadCenterMm[0]) &&
        Number.isFinite(anchor.quadCenterMm[1]) &&
        Number.isFinite(anchor.quadCenterMm[2])
    ) {
        return projectPointOntoPlane(anchor.quadCenterMm, planePoint, normal);
    }
    if (source && anchor.faceName) {
        const q = resolveFaceQuadMm(source, anchor.faceName);
        if (q) {
            const mapped = mapLocalMmToNode(source, body, q.center).localPointMm;
            return projectPointOntoPlane(mapped, planePoint, normal);
        }
    }
    const bodyQuad = resolveFaceQuadMm(body, anchor.faceName);
    if (bodyQuad) {
        return projectPointOntoPlane(bodyQuad.center, planePoint, normal);
    }
    return [...planePoint];
}

/**
 * Prostokąt kotwicy FACE w LCS bryły sztywnej.
 * Normalna i płaszczyzna = solver; środek i rozmiar = kliknięta ściana.
 */
export function resolveAnchorQuadMm(
    body: CADNode | null,
    anchor: ConstraintAnchor,
    geomNode?: CADNode | null,
): FaceQuadMm | null {
    if (!body) {
        return null;
    }
    const resolved = resolveAnchor(body, anchor, geomNode);
    if (!resolved?.localNormal) {
        return null;
    }
    const normal = normalizeDir(resolved.localNormal);

    const source =
        geomNode && geomNode.id !== body.id
            ? geomNode
            : anchor.sourceNodeId && anchor.sourceNodeId !== body.id
              ? findDescendant(body, anchor.sourceNodeId)
              : null;

    const center = overlayCenterMm(body, anchor, source, resolved.localPointMm, normal);

    if (anchor.localUAxisMm &&
        anchor.localVAxisMm &&
        Number.isFinite(anchor.quadWidthMm) &&
        Number.isFinite(anchor.quadHeightMm)
    ) {
        return {
            center,
            normal,
            uAxis: normalizeDir(anchor.localUAxisMm),
            vAxis: normalizeDir(anchor.localVAxisMm),
            width: anchor.quadWidthMm,
            height: anchor.quadHeightMm,
        };
    }

    // Zgodność: stara kotwica bez prostokąta — żywa formatka albo AABB bryły.
    const sourceQuad = source ? resolveFaceQuadMm(source, anchor.faceName) : null;
    if (source && sourceQuad) {
        return {
            center,
            normal,
            uAxis: mapLocalDirToNode(source, body, sourceQuad.uAxis),
            vAxis: mapLocalDirToNode(source, body, sourceQuad.vAxis),
            width: sourceQuad.width,
            height: sourceQuad.height,
        };
    }

    // Kotwica na samej bryle albo utracona formatka — prostokąt z bryły.
    const box = getLocalBoxMm(body);
    const uAxis = perpendicularDir(normal);
    const vAxis = crossDir(normal, uAxis);
    return {
        center,
        normal,
        uAxis,
        vAxis,
        width: box ? boxExtentAlong(box, uAxis) || 200 : 200,
        height: box ? boxExtentAlong(box, vAxis) || 200 : 200,
    };
}
