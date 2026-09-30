/**
 * connectors-engine — czyste funkcje rozmieszczenia złączy (A6 connectors_2_engine.py).
 * Zero Babylon / DOM. Wejście: wierzchołki płaszczyzny styku w mm, normalna, reguła JSON.
 * Bez klas — reguły z JSON (opcjonalnie nadpisane argumentem `rules`).
 */

import rulesJson from './connectors_3_rules.json';
import { Quat } from '../A1_core/cad-math/quat.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { rulesMToMm } from '../A1_core/cad-math/units.js';
import type {
    ConnectorDirection,
    ConnectorPlacement,
    ConnectorPositionDef,
    ConnectorsRules,
    PlacementRuleDef,
    Vec3Tuple,
} from './connectors-types.js';
import {
    applyFirstHoleOffset,
    canonicalPlacementRule,
    isConnectorFromFront,
    LEGACY_SYMMETRY2_RULE,
    ruleEdgeOffsetMm,
} from './connectors-types.js';

const DEFAULT_RULES = rulesJson as ConnectorsRules;

function asTuple(v: Vec3): Vec3Tuple {
    return [v.x, v.y, v.z];
}

function vec(t: Vec3Tuple | Vec3): Vec3 {
    if (t instanceof Vec3) return t;
    return new Vec3(t[0], t[1], t[2]);
}

function resolveRules(rules?: ConnectorsRules): ConnectorsRules {
    return rules ?? DEFAULT_RULES;
}

/** rotation_difference z Blendera: obrót, który mapuje `from` na `to`. */
export function quatFromTo(from: Vec3, to: Vec3): Quat {
    const f = from.normalize();
    const t = to.normalize();
    const d = f.dot(t);
    if (d > 0.999999) return Quat.IDENTITY;
    if (d < -0.999999) {
        let axis = Vec3.UNIT_X.cross(f);
        if (axis.lengthSquared() < 1e-12) {
            axis = Vec3.UNIT_Y.cross(f);
        }
        return Quat.fromAxisAngle(axis.normalize(), Math.PI);
    }
    return new Quat(
        f.y * t.z - f.z * t.y,
        f.z * t.x - f.x * t.z,
        f.x * t.y - f.y * t.x,
        1 + d,
    ).normalize();
}

export function countRulePositions(rule: PlacementRuleDef | null | undefined): number {
    if (!rule) return 0;
    return rule.sides.reduce((sum, side) => sum + (side.positions?.length ?? 0), 0);
}

export function getConnectorDefinition(connectorType: string, rules?: ConnectorsRules) {
    return resolveRules(rules).connector_types?.[connectorType] ?? null;
}

export function getPlacementRuleDefinition(ruleKey: string, rules?: ConnectorsRules): PlacementRuleDef | null {
    const key = canonicalPlacementRule(ruleKey);
    return resolveRules(rules).placement_rules?.[key] ?? null;
}

export function getPlacementRuleKeys(rules?: ConnectorsRules): string[] {
    return Object.keys(resolveRules(rules).placement_rules ?? {}).filter((k) => k !== LEGACY_SYMMETRY2_RULE);
}

export function getDefaultPlacementRule(rules?: ConnectorsRules): string {
    const r = resolveRules(rules);
    return r.default_settings?.placement_rule || getPlacementRuleKeys(r)[0] || 'standard_od_lewej';
}

/**
 * Najdłuższa krawędź styku dostaje stały zwrot: +Y formatki (głębokość / tył).
 * Bez tego uzwojenie wielokąta na wieńcu górnym vs dolnym odwraca „od lewej”.
 */
export function orientAlongFormatkaDepth(edgeDir: Vec3, along?: Vec3 | null): Vec3 {
    const prefer = along && along.lengthSquared() > 1e-12 ? along.normalize() : Vec3.UNIT_Y;
    if (Math.abs(edgeDir.dot(prefer)) > 0.2) {
        return edgeDir.dot(prefer) < 0 ? edgeDir.scale(-1) : edgeDir;
    }
    const ax = Math.abs(edgeDir.x);
    const ay = Math.abs(edgeDir.y);
    const az = Math.abs(edgeDir.z);
    if (ay >= ax && ay >= az) return edgeDir.y < 0 ? edgeDir.scale(-1) : edgeDir;
    if (ax >= az) return edgeDir.x < 0 ? edgeDir.scale(-1) : edgeDir;
    return edgeDir.z < 0 ? edgeDir.scale(-1) : edgeDir;
}

export function getFaceParams(
    faceVerts: Vec3[],
    along?: Vec3 | null,
): { center: Vec3; direction: Vec3; length: number } {
    if (faceVerts.length < 3) {
        return { center: Vec3.ZERO, direction: Vec3.UNIT_Y, length: 0 };
    }
    let acc = Vec3.ZERO;
    for (const v of faceVerts) acc = acc.add(v);
    const center = acc.scale(1 / faceVerts.length);

    const edges: Array<{ a: Vec3; b: Vec3; len: number }> = [];
    for (let i = 0; i < faceVerts.length; i++) {
        const a = faceVerts[i];
        const b = faceVerts[(i + 1) % faceVerts.length];
        edges.push({ a, b, len: b.sub(a).length() });
    }
    edges.sort((x, y) => y.len - x.len);
    const longest = edges[0];
    let direction = longest.b.sub(longest.a).normalize();
    direction = orientAlongFormatkaDepth(direction, along);
    return { center, direction, length: longest.len };
}

function calculatePositionsByRule(
    faceVerts: Vec3[],
    ruleDef: PlacementRuleDef,
    positionsActive?: boolean[] | null,
    along?: Vec3 | null,
    firstOffsetMm?: number | null,
) {
    const { center, direction, length } = getFaceParams(faceVerts, along);
    const sides = ruleDef.sides || [];
    const edgeBase = ruleEdgeOffsetMm(ruleDef);
    const connectors: Array<{
        position: Vec3;
        type: string;
        index: number;
        offsetMm: number;
        side: ConnectorDirection;
    }> = [];
    let globalIndex = 0;

    for (const side of sides) {
        const fromFront = isConnectorFromFront(side.direction);
        const positionsDef: ConnectorPositionDef[] = side.positions || [];
        // direction wskazuje +Y formatki (tył). Przód = min Y, tył = max Y.
        const startPos = fromFront
            ? center.sub(direction.scale(length / 2))
            : center.add(direction.scale(length / 2));

        for (const posDef of positionsDef) {
            if (positionsActive && globalIndex < positionsActive.length && !positionsActive[globalIndex]) {
                globalIndex += 1;
                continue;
            }
            const offsetMm = applyFirstHoleOffset(
                Number(posDef.offset_mm) || 0,
                firstOffsetMm,
                edgeBase,
            );
            if (offsetMm <= 0 || offsetMm >= length - 1e-6) {
                globalIndex += 1;
                continue;
            }
            const pos = fromFront
                ? startPos.add(direction.scale(offsetMm))
                : startPos.sub(direction.scale(offsetMm));
            connectors.push({
                position: pos,
                type: posDef.type,
                index: globalIndex,
                offsetMm,
                side: fromFront ? 'front' : 'back',
            });
            globalIndex += 1;
        }
    }

    return connectors;
}

export function generateConnectors(
    faceVertsMm: Array<Vec3Tuple | Vec3>,
    normalMm: Vec3Tuple | Vec3,
    placementRule: string,
    positionsActive?: boolean[] | null,
    alongMm?: Vec3Tuple | Vec3 | null,
    firstOffsetMm?: number | null,
    rules?: ConnectorsRules,
): ConnectorPlacement[] {
    const ruleDef = getPlacementRuleDefinition(placementRule, rules);
    if (!ruleDef) {
        return [];
    }

    const along = alongMm ? vec(alongMm) : null;
    const items = calculatePositionsByRule(
        faceVertsMm.map(vec),
        ruleDef,
        positionsActive,
        along,
        firstOffsetMm,
    );
    const normal = vec(normalMm).normalize();
    const rot = quatFromTo(Vec3.UNIT_Z, normal);
    const euler = rot.toEulerXYZ();

    const out: ConnectorPlacement[] = [];
    for (const item of items) {
        const connDef = getConnectorDefinition(item.type, rules);
        if (!connDef) continue;
        // JSON connectors_3_rules trzyma metry — rulesMToMm z fallbackiem w mm.
        const diameterMm = rulesMToMm(connDef.diameter, 8);
        const lengthMm = rulesMToMm(connDef.length, 35);
        out.push({
            positionMm: asTuple(item.position),
            type: item.type,
            index: item.index,
            offsetMm: item.offsetMm,
            side: item.side,
            diameterMm,
            lengthMm,
            rotationEuler: [euler.x, euler.y, euler.z],
        });
    }
    return out;
}
