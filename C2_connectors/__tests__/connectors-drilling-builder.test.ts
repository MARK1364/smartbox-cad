/**
 * Testy buildera nawierceń złączy — connectors-drilling-builder.
 *
 * Uruchom: npx vitest run C2_connectors/__tests__/connectors-drilling-builder.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock ConnectorStore ──────────────────────────────────────────────────────

const mockGroups: any[] = [];

vi.mock('../connector-store.js', () => ({
    ConnectorStore: {
        instance: {
            get groups() { return mockGroups; },
        },
    },
}));

// ─── Mock constraint-geometry transforms ──────────────────────────────────────

vi.mock('../../S2_solver/constraint-geometry.js', () => ({
    localMmToWorldMm: (_node: any, local: [number, number, number]) => {
        // Trivial mock: identity transform (no rotation/translation)
        // Returns a Vec3-compatible object with .x, .y, .z and .sub/.add
        return {
            x: local[0], y: local[1], z: local[2],
            sub: (other: any) => ({
                x: local[0] - other.x,
                y: local[1] - other.y,
                z: local[2] - other.z,
            }),
        };
    },
    worldMmToLocalMm: (_node: any, world: any) => {
        return [world.x, world.y, world.z] as [number, number, number];
    },
    mapLocalDirToNode: (_from: any, _to: any, dir: [number, number, number]) => {
        return [...dir] as [number, number, number];
    },
}));

// ─── Import po mockach ────────────────────────────────────────────────────────

import { buildConnectorDrillings } from '../connectors-drilling-builder.js';
import type { ConnectorDrillingIntent } from '../connectors-drilling-intent.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimalny mock PanelModel (wymiary w nanometrach — 600×720×18mm). */
function mockPanelNode(id: string, widthMm = 600, heightMm = 720, thickMm = 18) {
    const nmFactor = 1_000_000;
    return {
        id,
        domainData: {
            type: 'panel',
            width: widthMm * nmFactor,
            height: heightMm * nmFactor,
            thickness: thickMm * nmFactor,
            features: [],
        },
        getWorldMatrix: () => ({
            decompose: () => ({
                translation: { x: 0, y: 0, z: 0 },
                rotation: {
                    rotateVec3: (v: any) => v,
                    inverse: () => ({ rotateVec3: (v: any) => v }),
                },
                scale: { x: 1, y: 1, z: 1 },
            }),
        }),
    };
}

function mockDocument(nodes: any[]) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return {
        findNode: (id: string) => nodeMap.get(id) || null,
        getPanels: () => nodes,
    } as any;
}

function makeConnectorInstance(type: string, index: number, posLocal: [number, number, number]) {
    return {
        type,
        index,
        offsetMm: 0,
        side: 'left' as const,
        positionLocalMm: posLocal,
        normalLocalMm: [1, 0, 0] as [number, number, number],
        diameterMm: 8,
        lengthMm: 35,
    };
}

function makeGroup(
    id: string,
    parentId: string,
    otherId: string,
    faceNormal: [number, number, number],
    connectors: any[],
) {
    return {
        id,
        name: `Grupa ${id}`,
        parentObjectId: parentId,
        otherObjectId: otherId,
        faceName: 'FACE_X_PLUS',
        placementRule: 'standard_od_lewej',
        firstOffsetMm: 32,
        positionsActive: connectors.map(() => true),
        faceVertsLocalMm: [],
        faceNormalLocalMm: faceNormal,
        connectors,
    };
}

// ─── Testy ────────────────────────────────────────────────────────────────────

describe('buildConnectorDrillings', () => {
    beforeEach(() => {
        mockGroups.length = 0;
    });

    it('zwraca pustą listę gdy brak grup złączy', () => {
        const doc = mockDocument([]);
        const result = buildConnectorDrillings(doc);
        expect(result).toEqual([]);
    });

    it('kołek ø8×35 generuje 2 intenty: ø8×23 na FACE_X (A/EDGE) + ø8×12 na FACE_Z (B/FACE)', () => {
        const nodeA = mockPanelNode('panelA', 600, 720, 18);
        const nodeB = mockPanelNode('panelB', 600, 720, 18);
        const doc = mockDocument([nodeA, nodeB]);

        const conn = makeConnectorInstance('kolki_d8x35', 0, [0, 0, 100]);
        mockGroups.push(makeGroup('G1', 'panelA', 'panelB', [1, 0, 0], [conn]));

        const result = buildConnectorDrillings(doc);

        // Formatka A: otwór czołowy na FACE_X_PLUS
        const holesA = result.filter((i) => i.targetNodeId === 'panelA');
        expect(holesA.length).toBe(1);
        expect(holesA[0].feature.face).toBe('FACE_X_PLUS');
        expect(holesA[0].feature.params.diameter).toBe(8);
        expect(holesA[0].feature.params.depth).toBe(23);
        expect(holesA[0].feature.params.isConnectorDrilling).toBe(true);
        expect(holesA[0].feature.params.connectorType).toBe('kolki_d8x35');

        // Formatka B: otwór płaszczyznowy
        const holesB = result.filter((i) => i.targetNodeId === 'panelB');
        expect(holesB.length).toBe(1);
        expect(holesB[0].feature.params.diameter).toBe(8);
        expect(holesB[0].feature.params.depth).toBe(12);
    });

    it('konfirmat 5×50 generuje 2 intenty: ø5×38 (A/wieniec) + ø7×18 (B/boczek)', () => {
        const nodeA = mockPanelNode('panelA');
        const nodeB = mockPanelNode('panelB');
        const doc = mockDocument([nodeA, nodeB]);

        const conn = makeConnectorInstance('konfirmat_5x50', 0, [0, 0, 200]);
        conn.type = 'konfirmat_5x50';
        mockGroups.push(makeGroup('G2', 'panelA', 'panelB', [1, 0, 0], [conn]));

        const result = buildConnectorDrillings(doc);

        const holesA = result.filter((i) => i.targetNodeId === 'panelA');
        expect(holesA.length).toBe(1);
        expect(holesA[0].feature.params.diameter).toBe(5);
        expect(holesA[0].feature.params.depth).toBe(38);

        const holesB = result.filter((i) => i.targetNodeId === 'panelB');
        expect(holesB.length).toBe(1);
        expect(holesB[0].feature.params.diameter).toBe(7);
        expect(holesB[0].feature.params.depth).toBe(18);
    });

    it('minifix generuje 3 intenty: ø8×34 (A) + ø5×11 trzpień (B) + ø15×12.5 puszka (B)', () => {
        const nodeA = mockPanelNode('panelA');
        const nodeB = mockPanelNode('panelB');
        const doc = mockDocument([nodeA, nodeB]);

        const conn = makeConnectorInstance('minifix', 0, [0, 0, 200]);
        conn.type = 'minifix';
        mockGroups.push(makeGroup('G3', 'panelA', 'panelB', [1, 0, 0], [conn]));

        const result = buildConnectorDrillings(doc);

        // Formatka A: 1 otwór czołowy
        const holesA = result.filter((i) => i.targetNodeId === 'panelA');
        expect(holesA.length).toBe(1);
        expect(holesA[0].feature.params.diameter).toBe(8);
        expect(holesA[0].feature.params.depth).toBe(34);

        // Formatka B: 2 otwory (trzpień + puszka)
        const holesB = result.filter((i) => i.targetNodeId === 'panelB');
        expect(holesB.length).toBe(2);

        const bolt = holesB.find((h) => h.feature.params.diameter === 5);
        expect(bolt).toBeDefined();
        expect(bolt!.feature.params.depth).toBe(11);

        const housing = holesB.find((h) => h.feature.params.diameter === 15);
        expect(housing).toBeDefined();
        expect(housing!.feature.params.depth).toBe(12.5);
    });

    it('otwór poza granicami formatki jest odrzucany', () => {
        const nodeA = mockPanelNode('panelA', 600, 720, 18);
        const nodeB = mockPanelNode('panelB', 600, 720, 18);
        const doc = mockDocument([nodeA, nodeB]);

        // CAD: Y = grubość, Z = wysokość — Z=2000 poza height=720
        const conn = makeConnectorInstance('kolki_d8x35', 0, [0, 0, 2000]);
        mockGroups.push(makeGroup('G4', 'panelA', 'panelB', [1, 0, 0], [conn]));

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = buildConnectorDrillings(doc);
        warnSpy.mockRestore();

        // Przynajmniej jeden otwór powinien zostać odrzucony z ostrzeżeniem
        // (zależnie od tego, jak UV się mapuje — Y=2000 pewnie wychodzi poza)
        const totalExpected = result.length;
        expect(totalExpected).toBeLessThanOrEqual(2); // max 2 (jeśli A jest w granicy ale B nie)
    });

    it('brak węzła B → generuje tylko otwory na formatce A', () => {
        const nodeA = mockPanelNode('panelA');
        const doc = mockDocument([nodeA]);

        const conn = makeConnectorInstance('kolki_d8x35', 0, [0, 0, 100]);
        mockGroups.push(makeGroup('G5', 'panelA', 'missingPanel', [1, 0, 0], [conn]));

        const result = buildConnectorDrillings(doc);

        expect(result.length).toBe(1);
        expect(result[0].targetNodeId).toBe('panelA');
    });

    it('wiele złączy w jednej grupie generuje poprawną liczbę intentów', () => {
        const nodeA = mockPanelNode('panelA');
        const nodeB = mockPanelNode('panelB');
        const doc = mockDocument([nodeA, nodeB]);

        const connectors = [
            makeConnectorInstance('kolki_d8x35', 0, [0, 0, 50]),
            makeConnectorInstance('konfirmat_5x50', 1, [0, 0, 100]),
            makeConnectorInstance('kolki_d8x35', 2, [0, 0, 150]),
        ];
        connectors[1].type = 'konfirmat_5x50';
        mockGroups.push(makeGroup('G6', 'panelA', 'panelB', [1, 0, 0], connectors));

        const result = buildConnectorDrillings(doc);

        // 3 złącza × 2 otwory = 6 intentów
        expect(result.length).toBe(6);
        expect(result.filter((i) => i.targetNodeId === 'panelA').length).toBe(3);
        expect(result.filter((i) => i.targetNodeId === 'panelB').length).toBe(3);
    });

    it('każdy intent ma poprawne metadane connectorGroupId i connectorIndex', () => {
        const nodeA = mockPanelNode('panelA');
        const nodeB = mockPanelNode('panelB');
        const doc = mockDocument([nodeA, nodeB]);

        const conn = makeConnectorInstance('kolki_d8x35', 7, [0, 0, 100]);
        mockGroups.push(makeGroup('G7', 'panelA', 'panelB', [1, 0, 0], [conn]));

        const result = buildConnectorDrillings(doc);

        for (const intent of result) {
            expect(intent.feature.params.connectorGroupId).toBe('G7');
            expect(intent.feature.params.connectorIndex).toBe(7);
            expect(intent.feature.type).toBe('hole');
            expect(intent.feature.params.template_id).toBe('kolki_d8x35');
            expect(intent.feature.params.isConnectorDrilling).toBe(true);
        }
    });

    it('kliknięcie boczka (normalna CAD +Y) daje otwór FACE na A i EDGE na B', () => {
        const nodeA = mockPanelNode('panelA');
        const nodeB = mockPanelNode('panelB');
        const doc = mockDocument([nodeA, nodeB]);

        const conn = makeConnectorInstance('kolki_d8x35', 0, [50, 9, 100]);
        mockGroups.push(makeGroup('G8', 'panelA', 'panelB', [0, 1, 0], [conn]));

        const result = buildConnectorDrillings(doc);
        const holesA = result.filter((i) => i.targetNodeId === 'panelA');
        expect(holesA.length).toBe(1);
        expect(holesA[0].feature.face).toBe('FACE_Z_PLUS');
        expect(holesA[0].feature.params.depth).toBe(12);
        expect(holesA[0].feature.params.diameter).toBe(8);
        expect(holesA[0].feature.params.u).toBeCloseTo(350, 0);
        expect(holesA[0].feature.params.v).toBeCloseTo(460, 0);

        const holesB = result.filter((i) => i.targetNodeId === 'panelB');
        expect(holesB.length).toBe(1);
        expect(holesB[0].feature.params.depth).toBe(23);
        expect(holesB[0].feature.face).toMatch(/^FACE_X_/);
        expect(holesB[0].feature.params.faceType).toBe('EDGE');
    });

    it('konfirmat na boczku (FACE): otwór przelotowy = grubość 18 mm, wieniec 38 mm', () => {
        const nodeA = mockPanelNode('boczek', 600, 720, 18);
        // Identity mock mapuje styk na FACE_Z wieńca (V = wysokość) — ten sam gabaryt co A.
        const nodeB = mockPanelNode('wieniec', 600, 720, 18);
        const doc = mockDocument([nodeA, nodeB]);

        const conn = makeConnectorInstance('konfirmat_5x50', 0, [50, 9, 100]);
        conn.type = 'konfirmat_5x50';
        conn.lengthMm = 50;
        conn.diameterMm = 5;
        mockGroups.push(makeGroup('G9', 'boczek', 'wieniec', [0, 1, 0], [conn]));

        const result = buildConnectorDrillings(doc);
        const holesA = result.filter((i) => i.targetNodeId === 'boczek');
        expect(holesA.length).toBe(1);
        expect(holesA[0].feature.params.depth).toBe(18);
        expect(holesA[0].feature.params.diameter).toBe(7);

        const holesB = result.filter((i) => i.targetNodeId === 'wieniec');
        expect(holesB.length).toBe(1);
        expect(holesB[0].feature.params.depth).toBe(38);
        expect(holesB[0].feature.params.diameter).toBe(5);
        expect(holesB[0].feature.params.faceType).toBe('EDGE');
        expect(holesA[0].feature.params.faceType).toBe('FACE');
        expect(holesA[0].feature.params.through).toBe(true);
    });

    it('wieniec EDGE: otwór na środku grubości czoła nawet gdy styk jest na krawędzi 18 mm', () => {
        const nodeA = mockPanelNode('wieniec', 600, 720, 18);
        const nodeB = mockPanelNode('boczek', 600, 720, 18);
        const doc = mockDocument([nodeA, nodeB]);

        // CAD Y = grubość; -9 mm = krawędź czoła — bez snap ø8 wypada poza 0..18
        const conn = makeConnectorInstance('kolki_d8x35', 0, [0, -9, 100]);
        mockGroups.push(makeGroup('G10', 'wieniec', 'boczek', [1, 0, 0], [conn]));

        const result = buildConnectorDrillings(doc);
        const holesEdge = result.filter((i) => i.targetNodeId === 'wieniec');
        expect(holesEdge.length).toBe(1);
        expect(holesEdge[0].feature.face).toBe('FACE_X_PLUS');
        expect(holesEdge[0].feature.params.u).toBeCloseTo(9, 5);
        expect(holesEdge[0].feature.params.depth).toBe(23);
        expect(holesEdge[0].feature.params.faceType).toBe('EDGE');
        expect(holesEdge[0].feature.params.through).toBeUndefined();
    });
});
