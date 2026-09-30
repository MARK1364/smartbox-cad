import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CreateSmartWallCommand } from '../commands/create-smartwall-command.js';
import { SetSmartWallParamsCommand } from '../commands/set-smartwall-params-command.js';
import { planSkos, skosOutline2dMm } from '../skos-engine.js';
import { rebuildSmartWall } from '../smartwall-core.js';
import { isExcludedFromProduction } from '../smartwall-types.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

describe('S4 Skos (klin pod schody)', () => {
    it('plan top: trapez w outline2d, bbox L×maxH, rotacja jak FRONT', () => {
        const { parts } = planSkos({ skosLength: 2000, skosHeightLeft: 1800, skosHeightRight: 900, wallThickness: 18, skosSlant: 'top' });
        expect(parts).toHaveLength(1);
        const skos = parts[0];
        expect(skos.key).toBe('SKOS');
        expect(skos.role).toBe('SKOS');
        expect(skos.dim).toEqual({ x: 2000, y: 18, z: 1800 });
        expect(skos.loc.z).toBe(900);
        expect(skos.lcs?.rotation).toEqual([0, 0, 0]);
        expect(skos.custom_properties?.outline2d).toEqual([[0, 0], [2000, 0], [2000, 900], [0, 1800]]);
        expect(skos.custom_properties?.excludeFromProduction).toBe(true);
        expect(skos.custom_properties?.domain).toBe('skos_segment');
    });

    it('default = ukos na dole (góra płaska, zabudowy pod schodami)', () => {
        const { parts } = planSkos({ skosLength: 2000, skosHeightLeft: 1800, skosHeightRight: 900, wallThickness: 18 });
        expect(parts).toHaveLength(1);
        const skos = parts[0];
        expect(skos.dim).toEqual({ x: 2000, y: 18, z: 1800 });
        expect(skos.loc.z).toBe(900);
        expect(skos.custom_properties?.outline2d).toEqual([[0, 0], [2000, 900], [2000, 1800], [0, 1800]]);
        expect(skos.custom_properties?.skosSlant).toBe('bottom');
    });

    it('hL == hR → prostokąt (poprawny obrys)', () => {
        expect(skosOutline2dMm(1500, 1200, 1200)).toEqual([[0, 0], [1500, 0], [1500, 1200], [0, 1200]]);
        expect(skosOutline2dMm(1500, 1200, 1200, 'top')).toEqual([[0, 0], [1500, 0], [1500, 1200], [0, 1200]]);
    });

    it('CreateSmartWall skos: 1× SKOS z outline2d, poza produkcją', () => {
        const doc = new ProjectDocument();
        new CreateSmartWallCommand({
            preset: 'skos',
            skosLength: 2000,
            skosHeightLeft: 1800,
            skosHeightRight: 900,
            wallThickness: 18,
            skosSlant: 'top',
        }).execute(doc);
        const node = doc.getContainers()[0];
        expect(node.children).toHaveLength(1);
        const part = node.children[0].domainData as any;
        expect(part.role).toBe('SKOS');
        expect(part.key).toBe('SKOS');
        expect(Math.round(nmToMm(part.width))).toBe(2000);
        expect(Math.round(nmToMm(part.height))).toBe(1800);
        expect(Math.round(nmToMm(part.thickness))).toBe(18);
        expect(part.custom_properties?.outline2d).toEqual([[0, 0], [2000, 0], [2000, 900], [0, 1800]]);
        expect(isExcludedFromProduction(part)).toBe(true);

        // idempotentny rebuild nie dubluje
        rebuildSmartWall(node.domainData, doc);
        expect(node.children).toHaveLength(1);
    });

    it('SetSmartWallParamsCommand: zmiana hR + undo (ukos na dole)', () => {
        const doc = new ProjectDocument();
        new CreateSmartWallCommand({ preset: 'skos' }).execute(doc);
        const c = doc.getContainers()[0].domainData as any;
        const before = SetSmartWallParamsCommand.snapshotFrom(c);
        expect(before.skosSlant).toBe('bottom');
        expect(before.skosHeightRight).toBe(900);
        const after = { ...before, skosHeightRight: 600 };
        const cmd = new SetSmartWallParamsCommand(c.id, before, after);
        cmd.execute(doc);
        const part = doc.getContainers()[0].children[0].domainData as any;
        // dół: [0,0] → [L,H-hR] → [L,H] → [0,H]; H=1800
        expect(part.custom_properties?.outline2d).toEqual([[0, 0], [2000, 1200], [2000, 1800], [0, 1800]]);
        expect(Math.round(nmToMm(part.height))).toBe(1800); // max(hL=1800, hR=600)
        cmd.undo(doc);
        const part2 = doc.getContainers()[0].children[0].domainData as any;
        expect(part2.custom_properties?.outline2d).toEqual([[0, 0], [2000, 900], [2000, 1800], [0, 1800]]);
    });

    it('przełącznik ukosu góra/dół podmienia obrys', () => {
        const doc = new ProjectDocument();
        new CreateSmartWallCommand({ preset: 'skos' }).execute(doc);
        const c = doc.getContainers()[0].domainData as any;
        const before = SetSmartWallParamsCommand.snapshotFrom(c);
        const cmd = new SetSmartWallParamsCommand(c.id, before, { ...before, skosSlant: 'top' });
        cmd.execute(doc);
        const part = doc.getContainers()[0].children[0].domainData as any;
        expect(part.custom_properties?.outline2d).toEqual([[0, 0], [2000, 0], [2000, 900], [0, 1800]]);
        cmd.undo(doc);
        const part2 = doc.getContainers()[0].children[0].domainData as any;
        expect(part2.custom_properties?.outline2d).toEqual([[0, 0], [2000, 900], [2000, 1800], [0, 1800]]);
    });
});
