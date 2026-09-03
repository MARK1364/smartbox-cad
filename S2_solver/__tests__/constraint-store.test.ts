/**
 * Testy ConstraintStore — CRUD, trwałość w dokumencie, czyszczenie martwych referencji.
 *
 * Uruchom: npx vitest run S2_solver  (z katalogu web/)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ConstraintStore, CONSTRAINT_DOCUMENT_SECTION } from '../constraint-store.js';
import { makeAnchor } from '../constraint-types.js';

function freshStore(): ConstraintStore {
    const store = ConstraintStore.instance;
    store.clear();
    return store;
}

describe('ConstraintStore — operacje podstawowe', () => {
    let store: ConstraintStore;

    beforeEach(() => {
        store = freshStore();
    });

    it('dodaje więz z domyślnymi wartościami i unikalnym ID', () => {
        const a = store.add({ bindType: 'GROUND' });
        const b = store.add({ bindType: 'GROUND' });

        expect(a.id).not.toBe(b.id);
        expect(a.enabled).toBe(true);
        expect(a.groundPosMm).toBeNull();
        expect(a.offsetMm).toBe(0);
        expect(store.constraints).toHaveLength(2);
    });

    it('usuwa więz po ID', () => {
        const a = store.add({ bindType: 'GROUND' });
        expect(store.remove(a.id)).toBe(true);
        expect(store.remove(a.id)).toBe(false);
        expect(store.constraints).toHaveLength(0);
    });

    it('aktualizuje więz przez patch', () => {
        const a = store.add({ bindType: 'GROUND' });
        store.update(a.id, { enabled: false, offsetMm: 18 });

        expect(store.get(a.id)!.enabled).toBe(false);
        expect(store.get(a.id)!.offsetMm).toBe(18);
    });

    it('powiadamia subskrybentów o zmianach', () => {
        let calls = 0;
        const off = store.onChange(() => {
            calls++;
        });

        const a = store.add({ bindType: 'GROUND' });
        store.update(a.id, { enabled: false });
        store.remove(a.id);
        off();
        store.add({ bindType: 'GROUND' });

        expect(calls).toBe(3);
    });
});

describe('ConstraintStore — trwałość', () => {
    let store: ConstraintStore;

    beforeEach(() => {
        store = freshStore();
    });

    it('serializuje sourceNodeId kotwicy formatki na korpusie', () => {
        store.add({
            bindType: 'COPLANAR',
            anchorA: makeAnchor({
                nodeId: 'cab_1',
                kind: 'FACE',
                faceName: 'FACE_Z_PLUS',
                sourceNodeId: 'panel_1',
                localPointMm: [0, 0, 9],
                localNormalMm: [0, 0, 1],
            }),
        });
        const json = store.toJSON();
        store.clear();
        store.fromJSON(json);
        expect(store.constraints[0].anchorA?.nodeId).toBe('cab_1');
        expect(store.constraints[0].anchorA?.sourceNodeId).toBe('panel_1');
        expect(store.constraints[0].anchorA?.faceName).toBe('FACE_Z_PLUS');
    });

    it('serializuje i odtwarza kotwice oraz punkt uziemienia', () => {
        store.add({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: 'node_1', kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
            groundPosMm: [10, 20, 30],
            groundNormal: [0, 0, 1],
            offsetMm: 5,
        });

        const json = store.toJSON();
        store.clear();
        store.fromJSON(json);

        expect(store.constraints).toHaveLength(1);
        const restored = store.constraints[0];
        expect(restored.anchorA).toEqual({
            nodeId: 'node_1',
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
            cornerIndex: -1,
        });
        expect(restored.groundPosMm).toEqual([10, 20, 30]);
        expect(restored.groundNormal).toEqual([0, 0, 1]);
        expect(restored.offsetMm).toBe(5);
    });

    it('nie serializuje stanu wynikowego solvera', () => {
        const a = store.add({ bindType: 'GROUND' });
        store.update(a.id, { conflict: true, residual: { linearMm: 1.23, angularRad: 0.01 } });
        store.setValidationIssues([
            {
                constraintId: a.id,
                severity: 'error',
                code: 'MISSING_NODE',
                message: 'brak węzła',
            },
        ]);

        const json = store.toJSON();
        store.clear();
        store.fromJSON(json);

        expect(store.constraints[0].conflict).toBe(false);
        expect(store.constraints[0].residual).toEqual({ linearMm: 0, angularRad: 0 });
        expect(store.getIssues(store.constraints[0].id)).toEqual([]);
    });

    it('odrzuca nieznaną wersję schematu', () => {
        store.add({ bindType: 'GROUND' });
        const json = store.toJSON();
        store.fromJSON({ ...json, version: 999 });

        expect(store.constraints).toHaveLength(0);
    });

    it('odtwarza pusty stan z braku danych', () => {
        store.add({ bindType: 'GROUND' });
        store.fromJSON(null);

        expect(store.constraints).toHaveLength(0);
    });

    it('trafia do serializacji dokumentu i wraca po wczytaniu', () => {
        const document = new ProjectDocument();
        const detach = store.attachTo(document);

        store.add({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: 'node_1', kind: 'VERTEX', cornerIndex: 3 }),
            groundPosMm: [1, 2, 3],
        });

        const serialized = document.serialize();
        expect(serialized.extensions?.[CONSTRAINT_DOCUMENT_SECTION].constraints).toHaveLength(1);
        expect(serialized).not.toHaveProperty(CONSTRAINT_DOCUMENT_SECTION);

        store.clear();
        document.load(serialized);

        expect(store.constraints).toHaveLength(1);
        expect(store.constraints[0].anchorA!.cornerIndex).toBe(3);
        detach();
    });
});

describe('ConstraintStore — czyszczenie martwych referencji', () => {
    let store: ConstraintStore;

    beforeEach(() => {
        store = freshStore();
    });

    it('usuwa więzy wskazujące na nieistniejące węzły', () => {
        const document = new ProjectDocument();
        const panel = document.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
        });

        store.add({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: panel.id, kind: 'OBJECT' }),
        });
        store.add({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: 'usuniety_wezel', kind: 'OBJECT' }),
        });

        const existing = new Set(document.rootNode.findAll().map((n) => n.id));
        const removed = store.pruneMissingNodes(existing);

        expect(removed).toBe(1);
        expect(store.constraints).toHaveLength(1);
        expect(store.constraints[0].anchorA!.nodeId).toBe(panel.id);
    });

    it('usuwa więz, gdy zniknie tylko jeden z dwóch węzłów', () => {
        const document = new ProjectDocument();
        const panel = document.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) });

        store.add({
            bindType: 'VERTEX',
            anchorA: makeAnchor({ nodeId: panel.id, kind: 'VERTEX', cornerIndex: 0 }),
            anchorB: makeAnchor({ nodeId: 'nie_ma', kind: 'VERTEX', cornerIndex: 0 }),
        });

        const existing = new Set(document.rootNode.findAll().map((n) => n.id));

        expect(store.pruneMissingNodes(existing)).toBe(1);
        expect(store.constraints).toHaveLength(0);
    });
});

describe('ConstraintStore — błędy walidacji', () => {
    let store: ConstraintStore;

    beforeEach(() => {
        store = freshStore();
    });

    it('grupuje problemy po ID więzu i czyści je przy usuwaniu', () => {
        const a = store.add({ bindType: 'GROUND' });
        store.setValidationIssues([
            { constraintId: a.id, severity: 'error', code: 'MISSING_GEOMETRY', message: 'brak geometrii' },
            { constraintId: a.id, severity: 'warning', code: 'STALE_SOURCE', message: 'stara formatka' },
        ]);

        expect(store.getIssues(a.id)).toHaveLength(2);
        expect(store.getIssues(a.id)[0].code).toBe('MISSING_GEOMETRY');

        store.remove(a.id);
        expect(store.getIssues(a.id)).toEqual([]);
    });
});
