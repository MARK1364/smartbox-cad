import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { NodeType } from '../cad-node/node-type.js';
import { nmToMm } from '../cad-math/units.js';
import { CreateSmartWallCommand } from '../../S4_sciany/commands/create-smartwall-command.js';

describe('Datum Base Floor and Z Levels', () => {
    it('creates and retrieves Poziomy Z node with 2 default levels (Poziom 1 at 100mm and Poziom 2 at 2400mm)', () => {
        const doc = new ProjectDocument({ name: 'Test GLC' });
        expect(doc.getGlcNode()).toBeNull();

        const glc = doc.ensureGlcNode('Poziomy Z');
        expect(glc).toBeDefined();
        expect(glc.nodeType).toBe(NodeType.GLC_FRAME);
        expect(glc.name).toBe('Poziomy Z');
        expect(doc.getGlcNode()).toBe(glc);

        // Domyślnie dodane dwa poziomy odniesienia (100 mm "Poziom 1" i 2400 mm "Poziom 2")
        expect(glc.children).toHaveLength(2);
        expect(glc.children[0].nodeType).toBe(NodeType.DATUM_LEVEL);
        expect(glc.children[0].name).toBe('Poziom 1');
        expect(nmToMm((glc.children[0].domainData as any).z_nm)).toBe(100);

        expect(glc.children[1].nodeType).toBe(NodeType.DATUM_LEVEL);
        expect(glc.children[1].name).toBe('Poziom 2');
        expect(nmToMm((glc.children[1].domainData as any).z_nm)).toBe(2400);

        // Kolejne wywołanie zwraca ten sam węzeł
        expect(doc.ensureGlcNode()).toBe(glc);
    });

    it('creates Poziomy Z at root level at index 0 (above walls) upon creating SmartWall', () => {
        const doc = new ProjectDocument({ name: 'Test SmartWall Levels' });
        expect(doc.getGlcNode()).toBeNull();

        // Utworzenie SmartWall
        const cmd = new CreateSmartWallCommand({
            preset: 'rect',
            roomWidth: 4000,
            roomDepth: 3000,
            wallHeight: 2700,
        });
        cmd.execute(doc);

        // Poziomy Z pojawiają się na samej górze (root) nad ścianami
        const glc = doc.getGlcNode();
        expect(glc).toBeDefined();
        expect(glc!.name).toBe('Poziomy Z');
        expect(glc!.parent).toBe(doc.rootNode);
        expect(doc.rootNode.children[0]).toBe(glc);
        expect(glc!.children).toHaveLength(2);
        expect(glc!.children[0].name).toBe('Poziom 1');
        expect(glc!.children[1].name).toBe('Poziom 2');
    });

    it('adds datum levels under Base Floor and preserves coordinates', () => {
        const doc = new ProjectDocument({ name: 'Test Datum Levels' });
        const level1 = doc.addDatumLevel(100, 'Poziom 1');
        const level2 = doc.addDatumLevel(858, 'Poziom 2');

        const glc = doc.getGlcNode()!;
        expect(glc).toBeDefined();
        // 2 domyślne poziomy (Poziom 1 + Poziom 2) + 2 dodane = 4 poziomy
        expect(glc.children).toHaveLength(4);

        expect(level1.nodeType).toBe(NodeType.DATUM_LEVEL);
        expect(level1.name).toContain('Poziom 1');
        expect(level1.parent).toBe(glc);

        const z1_nm = (level1.domainData as any).z_nm;
        expect(nmToMm(z1_nm)).toBe(100);

        const z2_nm = (level2.domainData as any).z_nm;
        expect(nmToMm(z2_nm)).toBe(858);
    });

    it('dynamically auto-names levels as Poziom 3, Poziom 4 when name is not provided', () => {
        const doc = new ProjectDocument({ name: 'Test Auto Dynamic Levels' });
        const glc = doc.ensureGlcNode();
        expect(glc.children).toHaveLength(2);
        expect(glc.children[0].name).toBe('Poziom 1');
        expect(glc.children[1].name).toBe('Poziom 2');

        // Dynamiczne dodanie poziomu bez nazwy
        const level3 = doc.addDatumLevel();
        expect(level3.name).toBe('Poziom 3');
        expect(nmToMm((level3.domainData as any).z_nm)).toBe(860);

        const level4 = doc.addDatumLevel();
        expect(level4.name).toBe('Poziom 4');
        expect(nmToMm((level4.domainData as any).z_nm)).toBe(1400);
        expect(glc.children).toHaveLength(4);
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
        // 2 domyślne (Poziom 1 + Poziom 2) + 2 dodane = 4 poziomy
        expect(loadedGlc!.children).toHaveLength(4);
        expect(loadedGlc!.children[0].name).toBe('Poziom 1');
        expect(loadedGlc!.children[1].name).toBe('Poziom 2');
        expect(loadedGlc!.children[2].name).toBe('Cokół');
        expect(loadedGlc!.children[3].name).toBe('Korpus');
    });

    it('protects default GLC and default levels (Poziom 1, Poziom 2) from deletion while allowing custom levels to be deleted', () => {
        const doc = new ProjectDocument({ name: 'Test Deletion Protection' });
        const glc = doc.ensureGlcNode();
        expect(glc.children).toHaveLength(2);

        // Próba usunięcia Podłogi bazowej (GLC) powinna zostać zablokowana
        expect(doc.removeNode(glc.id)).toBeNull();
        expect(doc.getGlcNode()).toBe(glc);

        // Próba usunięcia domyślnego Poziomu 1 (datum_level_1) powinna zostać zablokowana
        const level1 = glc.children[0];
        expect(doc.removeNode(level1.id)).toBeNull();
        expect(doc.findNode(level1.id)).toBe(level1);

        // Próba usunięcia domyślnego Poziomu 2 (datum_level_top) powinna zostać zablokowana
        const levelTop = glc.children[1];
        expect(doc.removeNode(levelTop.id)).toBeNull();
        expect(doc.findNode(levelTop.id)).toBe(levelTop);

        // Nowo dodany poziom odniesienia MOŻE być usunięty
        const customLevel = doc.addDatumLevel(500, 'Poziom 3');
        expect(glc.children).toHaveLength(3);
        expect(doc.findNode(customLevel.id)).toBe(customLevel);

        const removed = doc.removeNode(customLevel.id);
        expect(removed).toBe(customLevel);
        expect(doc.findNode(customLevel.id)).toBeNull();
        expect(glc.children).toHaveLength(2);
    });
});
