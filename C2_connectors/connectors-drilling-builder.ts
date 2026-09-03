/**
 * connectors-drilling-builder.ts
 *
 * Transformuje grupy złączy (ConnectorStore) na intencje nawierceń
 * (ConnectorDrillingIntent[]), które SyncConnectorDrillingsCommand
 * wstawia do panel.features[] obu łączonych formatek.
 *
 * Analogiczny do shelves-drilling-builder.ts / doors-drilling-builder.ts.
 *
 * Architektura (niezależnie od tego, którą formatkę kliknięto):
 *  - Formatka FACE (boczek, normalna wzdłuż grubości) → otwór płaszczyznowy
 *    (kołek nieprzelotowy, konfirmat przelotowy)
 *  - Formatka EDGE (wieniec, czoło) → otwór czołowy
 *  - Minifix: 1 czołowy + 2 płaszczyznowe (trzpień + puszka)
 *
 * Zgodność z AGENTS.md:
 *  - Oś Z = grubość, FACE_Z_PLUS = INNER, FACE_Z_MINUS = OUTER
 *  - Obróbki ujemne clampowane do fizycznych granic formatki
 */

import type { ProjectDocument } from '../A1_core/project-document.js';
import type { ConnectorDrillingIntent, ConnectorDrillingFeature, CanonicalFace } from './connectors-drilling-intent.js';
import type { ConnectorGroup, ConnectorInstance, Vec3Tuple } from './connectors-types.js';
import { ConnectorStore } from './connector-store.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { worldMmToLocalMm, localMmToWorldMm, mapLocalDirToNode } from '../S2_solver/constraint-geometry.js';
import {
    DRILLING_SPECS,
    getEdgeHoleDepthMm,
    getEdgeHoleDiameterMm,
    getFaceHoleDepthMm,
    getFaceHoleDiameterMm,
    isParentFaceContact,
    isThroughFaceType,
    resolveEdgeFace,
    type DrillSpec,
} from './connectors-embedment.js';

// ─── Stałe ────────────────────────────────────────────────────────────────────

const NORMAL_TOLERANCE = 0.5;

/**
 * LCS CAD węzła (constraint-geometry): X = szerokość, Y = grubość, Z = wysokość.
 * LCS PanelModel / features UV:           X = szerokość, Y = wysokość, Z = grubość.
 * Pozycje złączy są w CAD — przed UV trzeba zamienić Y↔Z.
 */
function cadToPanelLocal(cad: Vec3Tuple): Vec3Tuple {
    return [cad[0], cad[2], cad[1]];
}

function holeName(connectorType: string): string {
    if (connectorType.startsWith('kolki')) return 'Otwór kołek';
    if (connectorType.startsWith('konfirmat')) return 'Otwór konfirmat';
    if (connectorType === 'minifix') return 'Otwór minifix';
    return `Otwór ${connectorType}`;
}

// ─── Mapowanie normalnej na kanoniczne ściany ─────────────────────────────────

/**
 * Normalna w LCS PanelModel (Z = grubość) → nazwa ściany cech (FACE_*).
 */
function normalToFace(normal: Vec3Tuple): CanonicalFace {
    const [nx, ny, nz] = normal;
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);

    if (ax >= ay && ax >= az) {
        return nx > 0 ? 'FACE_X_PLUS' : 'FACE_X_MINUS';
    }
    if (ay >= ax && ay >= az) {
        return ny > 0 ? 'FACE_Y_PLUS' : 'FACE_Y_MINUS';
    }
    return nz > 0 ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS';
}

/**
 * Zwraca ścianę „naprzeciwległą" (np. jeśli normalna styku z B wskazuje
 * na formatce B stronę Z+ → otwór powinien być na FACE_Z_PLUS).
 */
function contactFaceOnPanelB(normalInB: Vec3Tuple): CanonicalFace {
    return normalToFace(normalInB);
}

// ─── Przeliczanie pozycji na współrzędne UV ściany ────────────────────────────

interface PanelDims {
    widthMm: number;   // PanelModel X = szerokość
    heightMm: number;  // PanelModel Y = wysokość
    thickMm: number;   // PanelModel Z = grubość
}

function getPanelDims(panelData: any): PanelDims {
    return {
        widthMm: nmToMm(panelData.width ?? 600_000_000),
        heightMm: nmToMm(panelData.height ?? 720_000_000),
        thickMm: nmToMm(panelData.thickness ?? 18_000_000),
    };
}

/**
 * Punkt w LCS PanelModel (środek = 0,0,0; Z = grubość) → (U, V) ściany,
 * zgodnie z computeFaceData w panel-model.ts (początek UV w rogu ściany).
 */
function localPointToFaceUV(
    localPoint: Vec3Tuple,
    face: CanonicalFace,
    dims: PanelDims,
): { u: number; v: number } {
    const [lx, ly, lz] = localPoint;
    const hw = dims.widthMm / 2;
    const hh = dims.heightMm / 2;
    const ht = dims.thickMm / 2;

    switch (face) {
        // Płaszczyzny główne (Z)
        case 'FACE_Z_PLUS':
        case 'FACE_Z_MINUS':
            return { u: lx + hw, v: ly + hh };

        // Krawędzie boczne (X) — U wzdłuż grubości (Z), V wzdłuż wysokości (Y)
        case 'FACE_X_PLUS':
        case 'FACE_X_MINUS':
            return { u: lz + ht, v: ly + hh };

        // Krawędzie górna/dolna (Y) — U wzdłuż szerokości (X), V wzdłuż grubości (Z)
        case 'FACE_Y_PLUS':
        case 'FACE_Y_MINUS':
            return { u: lx + hw, v: lz + ht };
    }
}

// ─── Clipping do granic formatki ──────────────────────────────────────────────

function getFaceExtents(face: CanonicalFace, dims: PanelDims): { maxU: number; maxV: number } {
    switch (face) {
        case 'FACE_Z_PLUS':
        case 'FACE_Z_MINUS':
            return { maxU: dims.widthMm, maxV: dims.heightMm };
        case 'FACE_X_PLUS':
        case 'FACE_X_MINUS':
            return { maxU: dims.thickMm, maxV: dims.heightMm };
        case 'FACE_Y_PLUS':
        case 'FACE_Y_MINUS':
            return { maxU: dims.widthMm, maxV: dims.thickMm };
    }
}

function isWithinBounds(u: number, v: number, face: CanonicalFace, dims: PanelDims, radius: number): boolean {
    const { maxU, maxV } = getFaceExtents(face, dims);
    return (u - radius) >= -0.01 && (u + radius) <= maxU + 0.01 &&
           (v - radius) >= -0.01 && (v + radius) <= maxV + 0.01;
}

/**
 * Czoło wieńca: otwór zawsze na środku grubości (18 mm).
 * Oś wzdłuż styku clampowana do obrysu — bez odrzucania przez ±promień na 18 mm.
 */
function snapEdgeUv(
    u: number,
    v: number,
    face: CanonicalFace,
    dims: PanelDims,
    radius: number,
): { u: number; v: number } | null {
    const { maxU, maxV } = getFaceExtents(face, dims);
    const midT = dims.thickMm / 2;
    const isEndX = face === 'FACE_X_PLUS' || face === 'FACE_X_MINUS';
    const isEndY = face === 'FACE_Y_PLUS' || face === 'FACE_Y_MINUS';

    if (isEndX) {
        const r = Math.min(radius, Math.max(0, maxV / 2 - 0.01));
        if (v < -radius || v > maxV + radius) return null;
        return { u: midT, v: Math.max(r, Math.min(maxV - r, v)) };
    }
    if (isEndY) {
        const r = Math.min(radius, Math.max(0, maxU / 2 - 0.01));
        if (u < -radius || u > maxU + radius) return null;
        return { u: Math.max(r, Math.min(maxU - r, u)), v: midT };
    }
    if (!isWithinBounds(u, v, face, dims, radius)) return null;
    return { u, v };
}

// ─── Generacja identyfikatorów ────────────────────────────────────────────────

let _featureSeq = 0;
function nextFeatureId(groupId: string, connIndex: number, suffix: string): string {
    _featureSeq += 1;
    return `conn_${groupId}_${connIndex}_${suffix}_${_featureSeq}`;
}

// ─── Główna funkcja publiczna ─────────────────────────────────────────────────

/**
 * Generuje intencje nawierceń dla WSZYSTKICH złączy w ConnectorStore.
 * Zwraca tablicę intentów, które SyncConnectorDrillingsCommand wstawia
 * do panel.features[] formatek docelowych.
 */
export function buildConnectorDrillings(document: ProjectDocument): ConnectorDrillingIntent[] {
    const intents: ConnectorDrillingIntent[] = [];
    if (!document) return intents;

    const store = ConnectorStore.instance;
    if (store.groups.length === 0) return intents;

    _featureSeq = 0;

    for (const group of store.groups) {
        try {
            processGroup(document, group, intents);
        } catch (err) {
            console.warn(`[connectors-drilling-builder] Błąd przetwarzania grupy ${group.id}:`, err);
        }
    }

    return intents;
}

// ─── Przetwarzanie pojedynczej grupy ──────────────────────────────────────────

function processGroup(
    document: ProjectDocument,
    group: ConnectorGroup,
    intents: ConnectorDrillingIntent[],
): void {
    const nodeA = document.findNode(group.parentObjectId);
    const nodeB = group.otherObjectId ? document.findNode(group.otherObjectId) : null;

    if (!nodeA) {
        console.warn(`[connectors-drilling-builder] Brak węzła A: ${group.parentObjectId}`);
        return;
    }

    const dataA = nodeA.domainData as any;
    if (!dataA) return;
    const dimsA = getPanelDims(dataA);

    const dataB = nodeB?.domainData as any;
    const dimsB = dataB ? getPanelDims(dataB) : null;

    // Normalna styku jest w LCS CAD (Y = grubość) — UV cech jest w LCS panelu (Z = grubość).
    const normalA = cadToPanelLocal(group.faceNormalLocalMm);
    const faceA = normalToFace(normalA);

    // Normalna styku w LCS formatki B (odwrócona)
    let normalInB: Vec3Tuple = [0, 0, 1];
    if (nodeB) {
        const mappedCad = mapLocalDirToNode(nodeA as any, nodeB as any, group.faceNormalLocalMm);
        const mapped = cadToPanelLocal(mappedCad);
        // Odwracamy normalną, bo na formatce B kontakt jest po przeciwnej stronie
        normalInB = [-mapped[0], -mapped[1], -mapped[2]];
    }
    const faceB = contactFaceOnPanelB(normalInB);
    const parentIsFace = isParentFaceContact(group.faceNormalLocalMm, group.faceName);

    for (const conn of group.connectors) {
        processConnector(group, conn, nodeA, nodeB, dimsA, dimsB, faceA, faceB, parentIsFace, normalA, normalInB, intents);
    }
}

interface PanelSide {
    node: any;
    dims: PanelDims;
    face: CanonicalFace;
    local: Vec3Tuple;
}

function processConnector(
    group: ConnectorGroup,
    conn: ConnectorInstance,
    nodeA: any,
    nodeB: any | null,
    dimsA: PanelDims,
    dimsB: PanelDims | null,
    faceA: CanonicalFace,
    faceB: CanonicalFace,
    parentIsFace: boolean,
    normalA: Vec3Tuple,
    normalInB: Vec3Tuple,
    intents: ConnectorDrillingIntent[],
): void {
    const specs = DRILLING_SPECS[conn.type];
    if (!specs) {
        console.warn(`[connectors-drilling-builder] Brak drilling_specs dla typu: ${conn.type}`);
        return;
    }

    const connLocalMm = cadToPanelLocal(conn.positionLocalMm);

    let localInB: Vec3Tuple | null = null;
    if (nodeB && dimsB) {
        const worldPoint = localMmToWorldMm(nodeA, conn.positionLocalMm);
        localInB = cadToPanelLocal(worldMmToLocalMm(nodeB, worldPoint));
    }

    const parentSide: PanelSide = { node: nodeA, dims: dimsA, face: faceA, local: connLocalMm };
    const otherSide: PanelSide | null = (nodeB && dimsB && localInB)
        ? { node: nodeB, dims: dimsB, face: faceB, local: localInB }
        : null;

    const faceSide = parentIsFace ? parentSide : otherSide;
    let edgeSide = parentIsFace ? otherSide : parentSide;

    if (edgeSide) {
        const edgeNormal = parentIsFace ? normalInB : normalA;
        edgeSide = {
            ...edgeSide,
            face: resolveEdgeFace(edgeNormal, edgeSide.local[0], edgeSide.local[1], edgeSide.dims.widthMm, edgeSide.dims.heightMm),
        };
    }

    if (edgeSide && specs.panel_a) {
        emitHole(
            {
                diameter_mm: getEdgeHoleDiameterMm(conn.type),
                depth_mm: getEdgeHoleDepthMm(conn.type),
                face_type: 'EDGE',
            },
            edgeSide, group, conn, intents, 'EDGE',
        );
    }

    if (!faceSide) return;

    if (conn.type === 'minifix') {
        if (specs.panel_b_bolt) {
            emitHole(specs.panel_b_bolt, faceSide, group, conn, intents, 'FACE_bolt');
        }
        if (specs.panel_b_housing) {
            const offset = specs.panel_b_housing.offset_from_edge_mm ?? 34;
            const housingLocal = computeHousingPosition(faceSide.local, faceSide.face, offset, faceSide.dims);
            emitHole(specs.panel_b_housing, { ...faceSide, local: housingLocal }, group, conn, intents, 'FACE_housing');
        }
    } else if (specs.panel_b) {
        emitHole(
            {
                diameter_mm: getFaceHoleDiameterMm(conn.type),
                depth_mm: getFaceHoleDepthMm(conn.type, faceSide.dims.thickMm),
                face_type: 'FACE',
            },
            faceSide, group, conn, intents, 'FACE',
        );
    }
}

function emitHole(
    spec: DrillSpec,
    side: PanelSide,
    group: ConnectorGroup,
    conn: ConnectorInstance,
    intents: ConnectorDrillingIntent[],
    suffix: string,
): void {
    const raw = localPointToFaceUV(side.local, side.face, side.dims);
    const radius = spec.diameter_mm / 2;
    const uv = spec.face_type === 'EDGE'
        ? snapEdgeUv(raw.u, raw.v, side.face, side.dims, radius)
        : (isWithinBounds(raw.u, raw.v, side.face, side.dims, radius) ? raw : null);

    if (uv) {
        intents.push({
            targetNodeId: side.node.id,
            feature: makeFeature(
                nextFeatureId(group.id, conn.index, suffix),
                side.face,
                uv.u, uv.v,
                spec.diameter_mm,
                spec.depth_mm,
                conn.type, group.id, conn.index,
                side.node.id,
                spec.face_type,
                spec.face_type === 'FACE' && isThroughFaceType(conn.type),
            ),
        });
    } else {
        console.warn(
            `[connectors-drilling-builder] Otwór ${suffix} poza granicami formatki: ` +
            `group=${group.id} conn=${conn.index} face=${side.face} u=${raw.u.toFixed(1)} v=${raw.v.toFixed(1)}`
        );
    }
}

// ─── Pozycja puszki mimośrodu (offset od krawędzi styku) ─────────────────────

/**
 * Puszka mimośrodu jest przesunięta w głąb formatki B (prostopadle do krawędzi
 * styku). Kierunek przesunięcia zależy od ściany kontaktu.
 *
 * Np. jeśli kontakt jest na FACE_Z_PLUS, puszka jest w kierunku -Z (do wnętrza).
 * Ale w LCS formatki B to oznacza przesunięcie współrzędnej Z o -offset.
 */
function computeHousingPosition(
    boltLocalInB: Vec3Tuple,
    faceB: CanonicalFace,
    offsetMm: number,
    dimsB: PanelDims,
): Vec3Tuple {
    const [x, y, z] = boltLocalInB;

    switch (faceB) {
        case 'FACE_Z_PLUS':
            // Kontakt od góry Z → przesunięcie do wnętrza = -Z
            return [x, y, z - offsetMm];
        case 'FACE_Z_MINUS':
            return [x, y, z + offsetMm];
        case 'FACE_X_PLUS':
            return [x - offsetMm, y, z];
        case 'FACE_X_MINUS':
            return [x + offsetMm, y, z];
        case 'FACE_Y_PLUS':
            return [x, y - offsetMm, z];
        case 'FACE_Y_MINUS':
            return [x, y + offsetMm, z];
    }
}

// ─── Fabryka ConnectorDrillingFeature ─────────────────────────────────────────

function makeFeature(
    id: string,
    face: CanonicalFace,
    u: number,
    v: number,
    diameter: number,
    depth: number,
    connectorType: string,
    connectorGroupId: string,
    connectorIndex: number,
    sourcePartId?: string,
    faceType?: 'EDGE' | 'FACE',
    through?: boolean,
): ConnectorDrillingFeature {
    return {
        id,
        type: 'hole',
        face,
        name: holeName(connectorType),
        params: {
            u,
            v,
            diameter,
            depth,
            isConnectorDrilling: true,
            template_id: connectorType,
            connectorType,
            connectorGroupId,
            connectorIndex,
            sourcePartId,
            faceType,
            through: through || undefined,
        },
    };
}
