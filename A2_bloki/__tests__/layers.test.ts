import { describe, it, expect, beforeEach } from 'vitest';
import { buildShelfPlan } from '../module-plans.js';
import { collectNodeCleanupCommands, resetNodeCleanupHandlersForTests } from '../../A1_core/node-cleanup-port.js';
import { registerBlokiModule } from '../register.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('A2 layers', () => {
    it('buildShelfPlan lives in module-plans, not in the React adapter', () => {
        const plan = buildShelfPlan({}, { width_mm: 564, depth_mm: 450, height_mm: 600  });
        expect(plan.parts).toHaveLength(1);
        expect(plan.parts[0].role).toBe('SHELF_BOARD');
    });

    it('node cleanup port collects ClearBlokiDrillingsCommand without Core importing A2', () => {
        resetNodeCleanupHandlersForTests();
        registerBlokiModule();

        const doc = new ProjectDocument({ name: 't' });
        const box = doc.createAssembly({ name: 'Polki_SB' });
        (box as any).generatorParams = { type: 'blok_shelves', boxType: 'SHELVES' };
        const node = doc.findNode(box.id)!;
        const cmds = collectNodeCleanupCommands(node);
        expect(cmds.length).toBeGreaterThan(0);
        expect(cmds[0].label).toMatch(/nawierceń/i);
        expect(mmToNm(1)).toBe(1_000_000);
    });
});
