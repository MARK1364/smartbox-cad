import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { NodeType } from '../cad-node/node-type.js';
import { nmToMm } from '../cad-math/units.js';

describe('Datum GLC and Z Levels', () => {
    it('creates and retrieves GLC node with 2 default planes (bottom at 100mm and top at 2400mm)', () => {
        const doc = new ProjectDocument({ name: 'Test GLC' });
        expect(doc.getGlcNode()).toBeNull();

        const glc = doc.ensureGlcNode();
        expect(glc).toBeDefined();
        expect(glc.nodeType).toBe(NodeType.GLC_FRAME);
        expect(doc.getGlcNode()).toBe(glc);

        // Domyślnie dodane dwa poziomy odniesienia (100 mm "Płaszczyzna 1" i 2400 mm "Góra osi Z")
        expect(glc.children).toHaveLength(2);
        expect(glc.children[0].nodeType).toBe(NodeType.DATUM_LEVEL);
        expect(glc.children[0].name).toBe('Płaszczyzna 1');
        expect(nmToMm((glc.children[0].domainData as any).z_nm)).toBe(100);

        expect(glc.children[1].nodeType).toBe(NodeType.DATUM_LEVEL);
        expect(glc.children[1].name).toBe('Góra osi Z');
        expect(nmToMm((glc.children[1].domainData as any).z_nm)).toBe(2400);

        // Kolejne wywołanie zwraca ten sam węzeł
        expect(doc.ensureGlcNode()).toBe(glc);
    });

    it('adds datum levels under GLC and preserves coordinates', () => {
        const doc = new ProjectDocument({ name: 'Test Datum Levels' });
        const level1 = doc.addDatumLevel(100, 'Cokół');
        const level2 = doc.addDatumLevel(858, 'Blat');

        const glc = doc.getGlcNode()!;
        expect(glc).toBeDefined();
        // 2 domyślne poziomy (Płaszczyzna 1 + Góra osi Z) + 2 dodane = 4 poziomy
        expect(glc.children).toHaveLength(4);

        expect(level1.nodeType).toBe(NodeType.DATUM_LEVEL);
        expect(level1.name).toBe('Cokół');
        expect(level1.parent).toBe(glc);

        const z1_nm = (level1.domainData as any).z_nm;
        expect(nmToMm(z1_nm)).toBe(100);

        const z2_nm = (level2.domainData as any).z_nm;
        expect(nmToMm(z2_nm)).toBe(858);
    });

    it('serializes and deserializes GLC and levels', () => {
        const doc = new ProjectDocument({ name: 'Test Serial' });
        doc.ensureGlcNode();
        doc.addDatumLevel(100, 'Cokół');
        doc.addDatumLevel(820, 'Korpus');

        const json = doc.serialize();
        const loaded = new ProjectDocument();
        loaded.load(json);

        const loadedGlc = loaded.getGlcNode();
        expect(loadedGlc).toBeDefined();
        // 2 domyślne (Płaszczyzna 1 + Góra osi Z) + 2 dodane = 4 poziomy
        expect(loadedGlc!.children).toHaveLength(4);
        expect(loadedGlc!.children[0].name).toBe('Płaszczyzna 1');
        expect(loadedGlc!.children[1].name).toBe('Góra osi Z');
        expect(loadedGlc!.children[2].name).toBe('Cokół');
        expect(loadedGlc!.children[3].name).toBe('Korpus');
    });
});
