import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { runEngineAndApply } from '../smartframe-adapter.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { findCabinetPanel } from '../../A1_core/panel-lookup.js';
import '../../src/application/project-domain.js';
import { ContainerModel } from '../../A1_core/container-model.js';

describe('wieniec LCS orientation', () => {
    it('BOTTOM [90,180,0]: +Y_LCS / CADNode Z â†’ tyĹ‚ (+CAD Y)', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'K' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 720, 350, 1, 0, 0, 0);

        const cabNode = doc.findNode(cabinet.id)!;
        const bot = findCabinetPanel(cabNode, { role: 'BOTTOM_PANEL' }).node!;
        const top = findCabinetPanel(cabNode, { role: 'TOP_PANEL' }).node!;

        expect((bot.domainData as any).lcs?.rotation).toEqual([90, 180, 0]);
        expect((top.domainData as any).lcs?.rotation).toEqual([-90, 0, 0]);

        const { rotation: botR } = bot.getWorldMatrix().decompose();
        const { rotation: topR } = top.getWorldMatrix().decompose();
        const botThick = botR.rotateVec3(new Vec3(0, 1, 0));
        const botDepth = botR.rotateVec3(new Vec3(0, 0, 1));
        const topDepth = topR.rotateVec3(new Vec3(0, 0, 1));

        expect(botThick.z).toBeGreaterThan(0.9);
        expect(botDepth.y).toBeGreaterThan(0.9);
        expect(topDepth.y).toBeGreaterThan(0.9);
    });
});
