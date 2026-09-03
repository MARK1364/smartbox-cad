/**
 * Typy złączy C2 — odpowiednik JSON/DTO z A6_connectors (Blender).
 * Jednostki w silniku i w dokumencie: milimetry (mm) w układzie CAD.
 * W JSON Blendera średnica/długość są w metrach — konwersja w silniku.
 */

export type Vec3Tuple = [number, number, number];

/** `front`/`back` = oś głębokości formatki (±Y). `left`/`right` to aliasy (przód/tył). */
export type ConnectorDirection = 'front' | 'back' | 'left' | 'right';

export function isConnectorFromFront(direction: string): boolean {
    return direction === 'front' || direction === 'left';
}

export function normalizeConnectorSide(direction: string): ConnectorDirection {
    return isConnectorFromFront(direction) ? 'front' : 'back';
}

export interface ConnectorTypeDef {
    name: string;
    description?: string;
    /** Średnica w metrach (jak w connectors_3_rules.json). */
    diameter: number;
    /** Długość w metrach. */
    length: number;
    price?: number;
}

export interface ConnectorPositionDef {
    offset_mm: number;
    type: string;
}

export interface ConnectorSideDef {
    direction: ConnectorDirection;
    positions: ConnectorPositionDef[];
}

export interface PlacementRuleDef {
    name: string;
    description?: string;
    sides: ConnectorSideDef[];
}

export interface ConnectorsRules {
    connector_types: Record<string, ConnectorTypeDef>;
    placement_rules: Record<string, PlacementRuleDef>;
    default_settings?: {
        placement_rule?: string;
        first_offset_mm?: number;
    };
}

/** Szablon JSON jest na siatce 32 mm; UI przesuwa cały rząd względem krawędzi. */
export const DEFAULT_FIRST_OFFSET_MM = 32;
export const LEGACY_SYMMETRY2_RULE = 'symetrycznie2';
export const SYMMETRY_RULE = 'symetrycznie';
export const LEGACY_SYMMETRY2_FIRST_OFFSET_MM = 22;

export function canonicalPlacementRule(ruleKey: string): string {
    return ruleKey === LEGACY_SYMMETRY2_RULE ? SYMMETRY_RULE : ruleKey;
}

export function ruleEdgeOffsetMm(rule: PlacementRuleDef | null | undefined): number {
    let min = Infinity;
    for (const side of rule?.sides ?? []) {
        for (const pos of side.positions ?? []) {
            const n = Number(pos.offset_mm);
            if (Number.isFinite(n) && n < min) min = n;
        }
    }
    return Number.isFinite(min) ? min : DEFAULT_FIRST_OFFSET_MM;
}

export function applyFirstHoleOffset(
    offsetMm: number,
    firstOffsetMm: number | null | undefined,
    edgeBaseMm: number,
): number {
    if (firstOffsetMm == null || !Number.isFinite(firstOffsetMm)) return offsetMm;
    return offsetMm + (firstOffsetMm - edgeBaseMm);
}

export interface ConnectorInstance {
    type: string;
    index: number;
    offsetMm: number;
    side: ConnectorDirection;
    /** Pozycja w LCS formatki-rodzica [mm]. */
    positionLocalMm: Vec3Tuple;
    /** Normalna styku w LCS formatki [mm]. */
    normalLocalMm: Vec3Tuple;
    diameterMm: number;
    lengthMm: number;
}

export interface ConnectorGroup {
    id: string;
    name: string;
    parentObjectId: string;
    otherObjectId: string;
    faceName: string;
    placementRule: string;
    /** Odległość pierwszego otworu od krawędzi [mm]. Przesuwa całą siatkę 32 mm. */
    firstOffsetMm: number;
    positionsActive: boolean[];
    /** Wierzchołki części wspólnej styku w LCS formatki [mm]. */
    faceVertsLocalMm: Vec3Tuple[];
    faceNormalLocalMm: Vec3Tuple;
    connectors: ConnectorInstance[];
}

export interface ConnectorPlacement {
    positionMm: Vec3Tuple;
    type: string;
    index: number;
    offsetMm: number;
    side: ConnectorDirection;
    diameterMm: number;
    lengthMm: number;
    /** Euler XYZ [rad] — oś Z cylindra wzdłuż normalnej styku (jak GeometryDTO w Blenderze). */
    rotationEuler: Vec3Tuple;
}

/** Wykryty styk dwóch płaszczyzn — tylko rzeczywisty kontakt, bez szczeliny. */
export interface EligibleContactFace {
    panelId: string;
    otherPanelId: string;
    faceName: string;
    centerWorldMm: Vec3Tuple;
    normalWorldMm: Vec3Tuple;
    clippedVertsWorldMm: Vec3Tuple[];
}

export const CONNECTORS_DOCUMENT_SECTION = 'connectors';
export const CONNECTORS_SCHEMA_VERSION = 1;

/** Jak Blender: BACKOFF=0.001 m, TOLERANCE=0.00005 m → 1 mm + 0.05 mm. */
export const CONTACT_BACKOFF_MM = 1.0;
export const CONTACT_TOLERANCE_MM = 0.05;
export const CONTACT_MIN_OVERLAP_MM = 5.0;
export const PARALLEL_DOT_THRESHOLD = 0.5;
export const OPPOSING_NORMAL_DOT = -0.5;
/** Tolerancja krawędzi płaszczyzny styku w mm (0 = precyzyjne trafienie wewnątrz obrysu). */
export const PICK_EDGE_SLACK_MM = 0;
