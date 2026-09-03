/**
 * Testy ConnectorStore — CRUD i serializacja do dokumentu.
 *
 * Uruchom: npx vitest run C2_connectors  (z katalogu web/)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ConnectorStore } from '../connector-store.js';
import { CONNECTORS_DOCUMENT_SECTION } from '../connectors-types.js';
import type { ConnectorGroup } from '../connectors-types.js';

function sampleGroup(id = 'CONN_1'): ConnectorGroup {
    return {
        id,
        name: '1. Bok L (Złącza)',
        parentObjectId: 'panel_left',
        otherObjectId: 'panel_top',
        faceName: 'FACE_Z_PLUS',
        placementRule: 'standard_od_lewej',
        firstOffsetMm: 32,
        positionsActive: [true, true],
        faceVertsLocalMm: [
            [0, 9, 0],
            [100, 9, 0],
            [100, 9, 18],
            [0, 9, 18],
        ],
        faceNormalLocalMm: [0, 1, 0],
        connectors: [
            {
                type: 'kolki_d8x35',
                index: 0,
                offsetMm: 32,
                side: 'left',
                positionLocalMm: [32, 9, 9],
                normalLocalMm: [0, 1, 0],
                diameterMm: 18,
                lengthMm: 35,
            },
        ],
    };
}

describe('ConnectorStore', () => {
    let store: ConnectorStore;

    beforeEach(() => {
        store = ConnectorStore.instance;
        store.clear();
    });

    it('dodaje i usuwa grupę', () => {
        store.addGroup(sampleGroup());
        expect(store.groups).toHaveLength(1);
        expect(store.removeGroup('CONN_1')).toBe(true);
        expect(store.groups).toHaveLength(0);
    });

    it('kopiuje regułę do schowka', () => {
        store.addGroup(sampleGroup());
        expect(store.copyRuleFrom('CONN_1')).toBe(true);
        expect(store.clipboardRule).toBe('standard_od_lewej');
    });

    it('serializuje się w extensions.connectors', () => {
        const doc = new ProjectDocument({ name: 'c2' });
        store.attachTo(doc);
        store.addGroup(sampleGroup('CONN_2'));
        const json = doc.serialize();
        expect(json.extensions?.[CONNECTORS_DOCUMENT_SECTION]?.groups).toHaveLength(1);
        expect(json.extensions[CONNECTORS_DOCUMENT_SECTION].groups[0].id).toBe('CONN_2');

        store.clear();
        expect(store.groups).toHaveLength(0);
        store.fromJSON(json.extensions[CONNECTORS_DOCUMENT_SECTION]);
        expect(store.get('CONN_2')?.connectors).toHaveLength(1);
        expect(store.get('CONN_2')?.firstOffsetMm).toBe(32);
    });

    it('wczytuje starą Symetrycznie2 jako Symetrycznie + 22 mm', () => {
        const raw = sampleGroup('CONN_L');
        const { firstOffsetMm: _omit, ...legacy } = raw;
        store.fromJSON({
            version: 1,
            nextId: 2,
            groups: [{ ...legacy, placementRule: 'symetrycznie2' } as any],
        });
        const g = store.get('CONN_L');
        expect(g?.placementRule).toBe('symetrycznie');
        expect(g?.firstOffsetMm).toBe(22);
    });

    it('usuwa grupy po usunięciu formatki', () => {
        store.addGroup(sampleGroup());
        store.addGroup(sampleGroup('CONN_9'));
        store.groups[1].parentObjectId = 'still_here';
        const n = store.pruneMissingNodes(new Set(['still_here']));
        expect(n).toBe(1);
        expect(store.groups).toHaveLength(1);
        expect(store.groups[0].id).toBe('CONN_9');
    });
});
