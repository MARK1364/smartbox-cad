import { describe, it, expect, beforeEach } from 'vitest';
import { buildShelfPlan } from '../module-plans.js';
import { collectNodeCleanupCommands, resetNodeCleanupHandlersForTests } from '../../A1_core/node-cleanup-port.js';
import { registerSmartBoxModule } from '../register.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('A2 layers', () => {
    it('buildShelfPlan lives in module-plans, not in the React adapter', () => {
        const plan = buildShelfPlan({}, { width: 564, depth: 450, height: 600 });
        expect(plan.parts).toHaveLength(1);
        expect(plan.parts[0].role).toBe('SHELF_BOARD');
    });

    it('node cleanup port collects ClearSmartBoxDrillingsCommand without Core importing A2', () => {
        resetNodeCleanupHandlersForTests();
        registerSmartBoxModule();

        const doc = new ProjectDocument({ name: 't' });
        const box = doc.createContainer({ name: 'Polki_SB' });
        (box as any).generatorParams = { type: 'smartbox_shelves', boxType: 'SHELVES' };
        const node = doc.findNode(box.id)!;
        const cmds = collectNodeCleanupCommands(node);
        expect(cmds.length).toBeGreaterThan(0);
        expect(cmds[0].label).toMatch(/nawierceń/i);
        expect(mmToNm(1)).toBe(1_000_000);
    });
});
