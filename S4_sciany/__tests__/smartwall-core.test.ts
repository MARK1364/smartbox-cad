import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { CreateSmartWallCommand } from '../commands/create-smartwall-command.js';
import { rebuildSmartWall } from '../smartwall-core.js';
import { isExcludedFromProduction, isSmartWallContainer } from '../smartwall-types.js';

describe('S4 SmartWall commands / core', () => {
    it('CreateSmartWall rect: pod ROOM, 4 PART WALL + FLOOR, excludeFromProduction', () => {
        const doc = new ProjectDocument();
        const cmd = new CreateSmartWallCommand({ preset: 'rect', name: 'Pokój test' });
        cmd.execute(doc);

        const containers = doc.getContainers();
        expect(containers).toHaveLength(1);
        expect(containers[0].parent?.nodeType).toBe(NodeType.ROOM);
        const model = containers[0].domainData as any;
        expect(isSmartWallContainer(model)).toBe(true);

        const parts = containers[0].children.filter((c) => c.nodeType === NodeType.PART);
        expect(parts).toHaveLength(5);
        for (const p of parts) {
            expect(isExcludedFromProduction(p.domainData)).toBe(true);
        }
        expect(parts.filter((p) => String((p.domainData as any).role).toUpperCase() === 'WALL')).toHaveLength(4);
        expect(parts.filter((p) => (p.domainData as any)?.key === 'FLOOR')).toHaveLength(1);

        // idempotentny rebuild
        rebuildSmartWall(model, doc);
        expect(containers[0].children.filter((c) => c.nodeType === NodeType.PART)).toHaveLength(5);

        cmd.undo(doc);
        expect(doc.getContainers()).toHaveLength(0);
    });

    it('zamrożona ściana: visible=false, flaga przeżywa rebuild', () => {
        const doc = new ProjectDocument();
        new CreateSmartWallCommand({ preset: 'rect', name: 'Pokój freeze' }).execute(doc);
        const cnt = doc.getContainers()[0];
        const model = cnt.domainData as any;
        const front = cnt.children.find((c) => (c.domainData as any)?.key === 'WALL_FRONT')!;
        const panel = front.domainData as any;
        panel.frozen = true;
        panel.visible = false;

        rebuildSmartWall(model, doc);
        const front2 = cnt.children.find((c) => (c.domainData as any)?.key === 'WALL_FRONT')!;
        expect((front2.domainData as any).frozen).toBe(true);
        expect((front2.domainData as any).visible).toBe(false);
        expect(cnt.children.filter((c) => c.nodeType === NodeType.PART)).toHaveLength(5);
    });

    it('uskok → 2, empty → 0, single → 1', () => {
        const docS = new ProjectDocument();
        new CreateSmartWallCommand({
            preset: 'uskok',
            singleLength: 3000,
            uskokGapStart: 1000,
            uskokGapEnd: 1500,
        }).execute(docS);
        expect(docS.getContainers()[0].children.filter((c) => c.nodeType === NodeType.PART)).toHaveLength(2);

        const docE = new ProjectDocument();
        new CreateSmartWallCommand({ preset: 'empty' }).execute(docE);
        expect(docE.getContainers()[0].children.filter((c) => c.nodeType === NodeType.PART)).toHaveLength(0);

        const docOne = new ProjectDocument();
        new CreateSmartWallCommand({ preset: 'single', singleLength: 3000 }).execute(docOne);
        expect(docOne.getContainers()[0].children.filter((c) => c.nodeType === NodeType.PART)).toHaveLength(1);
    });
});
