import { describe, it, expect, afterEach } from 'vitest';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { MacroCommand } from '../../A1_core/commands/macro-command.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ConstraintGraph } from '../core/graph.js';
import {
    buildNonGroundConstraintEdges,
    ConstraintDragGroup,
    getConstraintDragGroup,
    getGroundFixedNodeIds,
    projectTranslationDelta,
} from '../constraint-drag-group.js';
import { buildConstraintFrames } from '../constraint-dof.js';
import { makeAnchor, makeSolverConstraint, type SolverConstraint } from '../constraint-types.js';

describe('ConstraintGraph.getConnectedComponent', () => {
    it('zbiera spójny komponent bez węzłów uziemionych', () => {
        const fixed = new Set(['g1']);
        const edges = {
            a: ['b'],
            b: ['a', 'c'],
            c: ['b'],
            g1: ['a'],
            a_g: ['g1'],
        };
        const component = ConstraintGraph.getConnectedComponent('a', edges, fixed);
        expect([...component].sort()).toEqual(['a', 'b', 'c']);
    });

    it('nie wchodzi w węzeł uziemiony', () => {
        const fixed = new Set(['g1']);
        const edges = { g1: ['a'], a: ['g1'] };
        expect(ConstraintGraph.getConnectedComponent('g1', edges, fixed).size).toBe(0);
    });
});

describe('constraint-drag-group helpers', () => {
    it('GROUND fixuje węzeł anchorA', () => {
        const constraints = [
            makeSolverConstraint({
                id: '1',
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: 'cab-a', kind: 'OBJECT' }),
            }),
        ];
        expect(getGroundFixedNodeIds(constraints)).toEqual(new Set(['cab-a']));
    });

    it('grupa po COPLANAR — oba korpusy', () => {
        const constraints = [
            makeSolverConstraint({
                id: '1',
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'FACE', faceName: 'left' }),
                anchorB: makeAnchor({ nodeId: 'b', kind: 'FACE', faceName: 'right' }),
            }),
        ];
        const edges = buildNonGroundConstraintEdges(constraints);
        expect(edges.a).toContain('b');
        expect(edges.b).toContain('a');
        expect(getConstraintDragGroup('a', constraints)).toEqual(new Set(['a', 'b']));
    });

    it('korpus uziemiony nie jedzie z sąsiadem', () => {
        const constraints = [
            makeSolverConstraint({
                id: 'g',
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'OBJECT' }),
            }),
            makeSolverConstraint({
                id: 'c',
                bindType: 'FLUSH',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'FACE', faceName: 'front' }),
                anchorB: makeAnchor({ nodeId: 'b', kind: 'FACE', faceName: 'back' }),
            }),
        ];
        expect(getConstraintDragGroup('b', constraints)).toEqual(new Set(['b']));
    });
});

describe('projekcja translacji gizma na pozostawione DOF', () => {
    it('COPLANAR blokuje ruch wzdłuż normalnej, ale pozwala ślizgać po płaszczyźnie', () => {
        const delta = new Vec3(120, 80, 40);
        const projected = projectTranslationDelta(delta, [Vec3.UNIT_X]);

        expect(projected.x).toBeCloseTo(0);
        expect(projected.y).toBeCloseTo(80);
        expect(projected.z).toBeCloseTo(40);
    });

    it('dwa niezależne więzy płaszczyzn pozostawiają ruch tylko wzdłuż ich przecięcia', () => {
        const delta = new Vec3(120, 80, 40);
        const projected = projectTranslationDelta(delta, [Vec3.UNIT_X, Vec3.UNIT_Z]);

        expect(projected.x).toBeCloseTo(0);
        expect(projected.y).toBeCloseTo(80);
        expect(projected.z).toBeCloseTo(0);
    });

    it('nie odejmuje dwa razy tego samego stopnia swobody', () => {
        const delta = new Vec3(120, 80, 40);
        const projected = projectTranslationDelta(delta, [
            Vec3.UNIT_X,
            new Vec3(-1, 0, 0),
        ]);

        expect(projected.x).toBeCloseTo(0);
        expect(projected.y).toBeCloseTo(80);
        expect(projected.z).toBeCloseTo(40);
    });

    it('wyrównanie frontów odejmuje składową normalnej z delty gizma', () => {
        const delta = new Vec3(120, 80, 40);
        const free = projectTranslationDelta(delta, [Vec3.UNIT_Y]);

        expect(free.x).toBeCloseTo(120);
        expect(free.y).toBeCloseTo(0);
        expect(free.z).toBeCloseTo(40);
    });
});

function newCabinet(document: ProjectDocument) {
    for (let attempt = 0; attempt < 8; attempt++) {
        try {
            const container = document.createContainer({
                width: mmToNm(600),
                height: mmToNm(720),
                depth: mmToNm(500),
            });
            return document.findNode(container.id)!;
        } catch {
            /* kolizja ID z Date.now() — ponów */
        }
    }
    throw new Error('Nie udało się utworzyć korpusu testowego');
}

function worldMm(node: { getWorldMatrix: () => { decompose: () => { translation: Vec3; rotation: Quat } } }) {
    const { translation, rotation } = node.getWorldMatrix().decompose();
    return {
        t: new Vec3(nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z)),
        r: rotation,
    };
}

function translateWorldMm(node: ReturnType<typeof newCabinet>, dx: number, dy: number, dz: number) {
    const { translation, rotation, scale } = node.localMatrix.decompose();
    node.setLocalTransform(
        new Vec3(translation.x + mmToNm(dx), translation.y + mmToNm(dy), translation.z + mmToNm(dz)),
        rotation,
        scale,
    );
}

function frontMate(aId: string, bId: string, id = 'front'): SolverConstraint {
    return makeSolverConstraint({
        id,
        bindType: 'COPLANAR',
        anchorA: makeAnchor({ nodeId: aId, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
        anchorB: makeAnchor({ nodeId: bId, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
    });
}

describe('odejmowanie DOF podczas dragu (dokument CAD)', () => {
    afterEach(() => {
        ConstraintDragGroup.instance.end();
    });

    it('wyrównane fronty Y: A jedzie całą deltą, B dostaje tylko Y', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        b.setLocalTransform(new Vec3(mmToNm(800), 0, 0), Quat.IDENTITY);
        const constraints = [frontMate(a.id, b.id)];

        const drag = ConstraintDragGroup.instance;
        drag.begin(document, a.id, constraints);
        translateWorldMm(a, 120, 80, 40);
        drag.propagateTransform(document, a.id);

        const wa = worldMm(a);
        const wb = worldMm(b);
        expect(wa.t.x).toBeCloseTo(120, 0);
        expect(wa.t.y).toBeCloseTo(80, 0);
        expect(wa.t.z).toBeCloseTo(40, 0);
        expect(wb.t.x).toBeCloseTo(800, 0);
        expect(wb.t.y).toBeCloseTo(80, 0);
        expect(wb.t.z).toBeCloseTo(0, 0);
        drag.end();

        drag.begin(document, b.id, constraints);
        const bBefore = worldMm(b).t;
        const aBefore = worldMm(a).t;
        translateWorldMm(b, -30, 25, 10);
        drag.propagateTransform(document, b.id);
        const aAfter = worldMm(a).t;
        const bAfter = worldMm(b).t;
        expect(bAfter.x).toBeCloseTo(bBefore.x - 30, 0);
        expect(bAfter.y).toBeCloseTo(bBefore.y + 25, 0);
        expect(aAfter.x).toBeCloseTo(aBefore.x, 0);
        expect(aAfter.y).toBeCloseTo(aBefore.y + 25, 0);
        expect(aAfter.z).toBeCloseTo(aBefore.z, 0);
    });

    it('szafy obrócone — składowa po normalnej świata idzie na sąsiada', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        a.setLocalTransform(Vec3.ZERO, Quat.fromEulerXYZ(0, 0, Math.PI / 2));
        b.setLocalTransform(new Vec3(mmToNm(900), 0, 0), Quat.fromEulerXYZ(0, 0, Math.PI / 2));
        const constraints = [frontMate(a.id, b.id)];

        ConstraintDragGroup.instance.begin(document, a.id, constraints);
        translateWorldMm(a, 50, 20, 15);
        ConstraintDragGroup.instance.propagateTransform(document, a.id);

        const wa = worldMm(a);
        const wb = worldMm(b);
        expect(wa.t.x).toBeCloseTo(50, 0);
        expect(wa.t.y).toBeCloseTo(20, 0);
        expect(wa.t.z).toBeCloseTo(15, 0);
        expect(wb.t.x).toBeCloseTo(950, 0);
        expect(wb.t.y).toBeCloseTo(0, 0);
        expect(wb.t.z).toBeCloseTo(0, 0);
    });

    it('dwa prostopadłe mate’y: A jedzie całą deltą, B dostaje Y i Z', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        b.setLocalTransform(new Vec3(mmToNm(700), mmToNm(50), 0), Quat.IDENTITY);
        const constraints = [
            frontMate(a.id, b.id),
            makeSolverConstraint({
                id: 'bottom',
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: a.id, kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
                anchorB: makeAnchor({ nodeId: b.id, kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
            }),
        ];

        ConstraintDragGroup.instance.begin(document, a.id, constraints);
        translateWorldMm(a, 40, 25, 18);
        ConstraintDragGroup.instance.propagateTransform(document, a.id);

        const wa = worldMm(a);
        const wb = worldMm(b);
        expect(wa.t.x).toBeCloseTo(40, 0);
        expect(wa.t.y).toBeCloseTo(25, 0);
        expect(wa.t.z).toBeCloseTo(18, 0);
        expect(wb.t.x).toBeCloseTo(700, 0);
        expect(wb.t.y).toBeCloseTo(75, 0);
        expect(wb.t.z).toBeCloseTo(18, 0);
    });

    it('twist wokół normalnej zostaje na przeciąganym; swing idzie na sąsiada', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        b.setLocalTransform(new Vec3(mmToNm(800), 0, 0), Quat.IDENTITY);
        const constraints = [frontMate(a.id, b.id)];

        const drag = ConstraintDragGroup.instance;
        drag.begin(document, a.id, constraints);
        a.setLocalTransform(Vec3.ZERO, Quat.fromAxisAngle(Vec3.UNIT_Y, Math.PI / 6));
        drag.propagateTransform(document, a.id);
        expect(worldMm(b).r.equals(Quat.IDENTITY, 1e-5)).toBe(true);
        drag.end();

        drag.begin(document, a.id, constraints);
        a.setLocalTransform(Vec3.ZERO, Quat.fromAxisAngle(Vec3.UNIT_X, Math.PI / 2));
        drag.propagateTransform(document, a.id);
        const nA = a.getWorldMatrix().transformDirection(new Vec3(0, -1, 0)).normalize();
        const nB = b.getWorldMatrix().transformDirection(new Vec3(0, -1, 0)).normalize();
        expect(nA.dot(nB)).toBeCloseTo(1, 3);
    });

    it('VERTEX: punkty zostają zbieżne, sąsiad jedzie ze związaną translacją', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        b.setLocalTransform(new Vec3(mmToNm(1000), 0, 0), Quat.IDENTITY);
        const constraints = [
            makeSolverConstraint({
                id: 'v',
                bindType: 'VERTEX',
                anchorA: makeAnchor({ nodeId: a.id, kind: 'VERTEX', cornerIndex: 0 }),
                anchorB: makeAnchor({ nodeId: b.id, kind: 'VERTEX', cornerIndex: 0 }),
            }),
        ];

        ConstraintDragGroup.instance.begin(document, a.id, constraints);
        const frames = buildConstraintFrames(document, constraints);
        expect(frames).toHaveLength(1);
        a.setLocalTransform(new Vec3(mmToNm(10), mmToNm(20), mmToNm(30)), Quat.IDENTITY);
        ConstraintDragGroup.instance.propagateTransform(document, a.id);

        const la = frames[0].localPointANm;
        const lb = frames[0].localPointBNm;
        const pa = a.getWorldMatrix().transformPoint(la);
        const pb = b.getWorldMatrix().transformPoint(lb);
        expect(pa.sub(pb).length()).toBeLessThan(mmToNm(0.05));
        expect(nmToMm(a.getWorldMatrix().decompose().translation.x)).toBeCloseTo(10, 0);
        expect(b.getWorldMatrix().decompose().rotation.equals(Quat.IDENTITY, 1e-5)).toBe(true);
    });

    it('łańcuch A–B–C: C dostaje tylko składową związaną z krawędzi B–C', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        const c = newCabinet(document);
        b.setLocalTransform(new Vec3(mmToNm(800), 0, 0), Quat.IDENTITY);
        c.setLocalTransform(new Vec3(mmToNm(1600), 0, 0), Quat.IDENTITY);
        const constraints = [
            frontMate(a.id, b.id, 'ab'),
            makeSolverConstraint({
                id: 'bc',
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: b.id, kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
                anchorB: makeAnchor({ nodeId: c.id, kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
            }),
        ];

        ConstraintDragGroup.instance.begin(document, a.id, constraints);
        translateWorldMm(a, 0, 40, 15);
        ConstraintDragGroup.instance.propagateTransform(document, a.id);

        expect(worldMm(a).t.y).toBeCloseTo(40, 0);
        expect(worldMm(a).t.z).toBeCloseTo(15, 0);
        expect(worldMm(b).t.y).toBeCloseTo(40, 0);
        expect(worldMm(c).t.y).toBeCloseTo(0, 0);
        expect(worldMm(c).t.z).toBeCloseTo(0, 0);
    });

    it('cykl więzów: składowa Y idzie na sąsiadów, wolne osie zostają na przeciąganym', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        const c = newCabinet(document);
        b.setLocalTransform(new Vec3(mmToNm(800), 0, 0), Quat.IDENTITY);
        c.setLocalTransform(new Vec3(mmToNm(400), mmToNm(600), 0), Quat.IDENTITY);
        const constraints = [
            frontMate(a.id, b.id, 'ab'),
            frontMate(b.id, c.id, 'bc'),
            frontMate(c.id, a.id, 'ca'),
        ];

        ConstraintDragGroup.instance.begin(document, a.id, constraints);
        translateWorldMm(a, 0, 50, 0);
        ConstraintDragGroup.instance.propagateTransform(document, a.id);
        expect(worldMm(a).t.y).toBeCloseTo(50, 0);
        expect(worldMm(b).t.y).toBeCloseTo(50, 0);
        expect(worldMm(c).t.y).toBeCloseTo(650, 0);
    });

    it('GROUND na sąsiedzie klamruje przeciągany, sąsiad stoi', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        b.setLocalTransform(new Vec3(mmToNm(800), 0, 0), Quat.IDENTITY);
        const constraints = [
            makeSolverConstraint({
                id: 'g',
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: b.id, kind: 'OBJECT' }),
            }),
            frontMate(a.id, b.id),
        ];

        ConstraintDragGroup.instance.begin(document, a.id, constraints);
        translateWorldMm(a, 10, 40, 5);
        ConstraintDragGroup.instance.propagateTransform(document, a.id);

        const wa = worldMm(a);
        const wb = worldMm(b);
        expect(wb.t.x).toBeCloseTo(800, 0);
        expect(wb.t.y).toBeCloseTo(0, 0);
        expect(wa.t.y).toBeCloseTo(0, 0);
        expect(wa.t.x).toBeCloseTo(10, 0);
        expect(ConstraintDragGroup.instance.lastComponentIds.has(a.id)).toBe(true);
        expect(ConstraintDragGroup.instance.lastComponentIds.has(b.id)).toBe(true);
    });

    it('undo przywraca przeciągany korpus atomowo', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        b.setLocalTransform(new Vec3(mmToNm(800), 0, 0), Quat.IDENTITY);
        const constraints = [frontMate(a.id, b.id)];

        const drag = ConstraintDragGroup.instance;
        drag.begin(document, a.id, constraints);
        translateWorldMm(a, 60, 60, 0);
        drag.propagateTransform(document, a.id);
        const cmds = drag.buildTransformCommands(document, 'test');
        expect(cmds.length).toBeGreaterThanOrEqual(1);
        const macro = new MacroCommand(cmds, 'test');
        macro.execute(document);
        expect(worldMm(a).t.x).toBeCloseTo(60, 0);
        expect(worldMm(a).t.y).toBeCloseTo(60, 0);
        expect(worldMm(b).t.y).toBeCloseTo(60, 0);
        macro.undo(document);
        expect(worldMm(a).t.x).toBeCloseTo(0, 0);
        expect(worldMm(b).t.y).toBeCloseTo(0, 0);
    });

    it('klamrowanie wielu korpusów mieści się w czasie interaktywnym', () => {
        const document = new ProjectDocument();
        const nodes = [];
        while (nodes.length < 24) {
            nodes.push(newCabinet(document));
            nodes[nodes.length - 1].setLocalTransform(
                new Vec3(mmToNm((nodes.length - 1) * 700), 0, 0),
                Quat.IDENTITY,
            );
        }
        const constraints: SolverConstraint[] = [];
        for (let i = 0; i < nodes.length - 1; i++) {
            constraints.push(frontMate(nodes[i].id, nodes[i + 1].id, `e${i}`));
        }

        const drag = ConstraintDragGroup.instance;
        const t0 = Date.now();
        drag.begin(document, nodes[0].id, constraints);
        translateWorldMm(nodes[0], 0, 12, 0);
        drag.propagateTransform(document, nodes[0].id);
        const elapsed = Date.now() - t0;
        expect(elapsed).toBeLessThan(2000);
        expect(worldMm(nodes[0]).t.y).toBeCloseTo(12, 0);
        expect(worldMm(nodes[nodes.length - 1]).t.y).toBeCloseTo(12, 0);
    });

    it('wyrównane dna Z: obie szafy jadą w Z, szczelina 0', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        b.setLocalTransform(new Vec3(mmToNm(800), mmToNm(40), 0), Quat.IDENTITY);
        const constraints = [
            makeSolverConstraint({
                id: 'bottom',
                bindType: 'COPLANAR',
                anchorA: makeAnchor({
                    nodeId: a.id,
                    kind: 'FACE',
                    faceName: 'FACE_Z_MINUS',
                    localPointMm: [0, 0, 0],
                    localNormalMm: [0, 0, -1],
                }),
                anchorB: makeAnchor({
                    nodeId: b.id,
                    kind: 'FACE',
                    faceName: 'FACE_Z_MINUS',
                    localPointMm: [0, 0, 0],
                    localNormalMm: [0, 0, -1],
                }),
            }),
        ];

        ConstraintDragGroup.instance.begin(document, a.id, constraints);
        translateWorldMm(a, 50, 30, 18);
        ConstraintDragGroup.instance.propagateTransform(document, a.id);

        const wa = worldMm(a);
        const wb = worldMm(b);
        expect(wa.t.x).toBeCloseTo(50, 0);
        expect(wa.t.y).toBeCloseTo(30, 0);
        expect(wa.t.z).toBeCloseTo(18, 0);
        expect(wb.t.x).toBeCloseTo(800, 0);
        expect(wb.t.y).toBeCloseTo(40, 0);
        expect(wb.t.z).toBeCloseTo(18, 0);
    });

    it('GROUND na B przy mate Z: A traci Z, B stoi', () => {
        const document = new ProjectDocument();
        const a = newCabinet(document);
        const b = newCabinet(document);
        b.setLocalTransform(new Vec3(mmToNm(800), mmToNm(40), 0), Quat.IDENTITY);
        const constraints = [
            makeSolverConstraint({
                id: 'g',
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: b.id, kind: 'OBJECT' }),
            }),
            makeSolverConstraint({
                id: 'bottom',
                bindType: 'COPLANAR',
                anchorA: makeAnchor({
                    nodeId: a.id,
                    kind: 'FACE',
                    faceName: 'FACE_Z_MINUS',
                    localPointMm: [0, 0, 0],
                    localNormalMm: [0, 0, -1],
                }),
                anchorB: makeAnchor({
                    nodeId: b.id,
                    kind: 'FACE',
                    faceName: 'FACE_Z_MINUS',
                    localPointMm: [0, 0, 0],
                    localNormalMm: [0, 0, -1],
                }),
            }),
        ];

        ConstraintDragGroup.instance.begin(document, a.id, constraints);
        translateWorldMm(a, 50, 30, 18);
        ConstraintDragGroup.instance.propagateTransform(document, a.id);

        const wa = worldMm(a);
        const wb = worldMm(b);
        expect(wa.t.x).toBeCloseTo(50, 0);
        expect(wa.t.y).toBeCloseTo(30, 0);
        expect(wa.t.z).toBeCloseTo(0, 0);
        expect(wb.t.x).toBeCloseTo(800, 0);
        expect(wb.t.y).toBeCloseTo(40, 0);
        expect(wb.t.z).toBeCloseTo(0, 0);
    });
});
