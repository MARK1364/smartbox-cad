import { beforeEach, describe, expect, it } from 'vitest';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import {
    canReparentManualPanel,
    reparentManualPanel,
    resolveActiveSmartFrame,
    resolveManualPanelParent,
} from '../../A1_core/app-commands.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { applyPlanToContainer } from '../smartframe-adapter.js';

function makeSmartFrame(doc: ProjectDocument, name: string) {
    const cabinet = doc.createContainer({ name });
    cabinet.generatorParams = { type: 'korpus3_2' };
    return cabinet;
}

describe('resolveActiveSmartFrame / resolveManualPanelParent', () => {
    it('bez zgody zawsze ląduje na scenie, nawet przy jednym korpusie', () => {
        const doc = new ProjectDocument();
        const cabinet = makeSmartFrame(doc, 'Szafa');
        doc.setActiveEntity(cabinet);
        expect(resolveManualPanelParent(doc, false)).toEqual({
            parentId: doc.rootNode.id,
            inAssembly: false,
        });
    });

    it('po zgodzie dodaje do aktywnego SmartFrame', () => {
        const doc = new ProjectDocument();
        const cabinet = makeSmartFrame(doc, 'Szafa A');
        makeSmartFrame(doc, 'Szafa B');
        doc.setActiveEntity(cabinet);
        expect(resolveActiveSmartFrame(doc)).toEqual({ id: cabinet.id, name: 'Szafa A' });
        expect(resolveManualPanelParent(doc, true)).toEqual({ parentId: cabinet.id, inAssembly: true });
    });

    it('gdy zaznaczona jest formatka, aktywny jest jej SmartFrame', () => {
        const doc = new ProjectDocument();
        const cabinet = makeSmartFrame(doc, 'Szafa');
        const side = doc.createPanel({ name: 'Bok' }, cabinet.id);
        doc.setActiveEntity(side);
        expect(resolveActiveSmartFrame(doc)?.id).toBe(cabinet.id);
        expect(resolveManualPanelParent(doc, true)).toEqual({ parentId: cabinet.id, inAssembly: true });
    });

    it('bez aktywnego SmartFrame nie zgaduje korpusu', () => {
        const doc = new ProjectDocument();
        makeSmartFrame(doc, 'Szafa 1');
        makeSmartFrame(doc, 'Szafa 2');
        expect(resolveActiveSmartFrame(doc)).toBeNull();
        expect(resolveManualPanelParent(doc, true)).toEqual({
            parentId: doc.rootNode.id,
            inAssembly: false,
        });
    });
});

describe('reparentManualPanel', () => {
    it('przenosi panel ręczny między SmartFrame’ami z zachowaniem pozycji świata', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = null;
        const a = makeSmartFrame(doc, 'Szafa A');
        const b = makeSmartFrame(doc, 'Szafa B');
        const panel = doc.createPanel({ name: 'Wzmocnienie', engineManaged: false }, a.id);
        const panelNode = doc.findNode(panel.id)!;

        expect(canReparentManualPanel(doc, panel.id, b.id)).toBe(true);
        expect(reparentManualPanel(doc, panel.id, b.id)).toBe(true);
        expect(panelNode.parent?.id).toBe(b.id);
    });

    it('nie przenosi formatki silnika', () => {
        const doc = new ProjectDocument();
        const a = makeSmartFrame(doc, 'Szafa A');
        const b = makeSmartFrame(doc, 'Szafa B');
        const side = doc.createPanel({ name: 'Bok lewy' }, a.id);
        expect(canReparentManualPanel(doc, side.id, b.id)).toBe(false);
        expect(reparentManualPanel(doc, side.id, b.id)).toBe(false);
        expect(doc.findNode(side.id)!.parent?.id).toBe(a.id);
    });
});

describe('applyPlanToContainer — panel ręczny', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Manual panel' });
        ContextManager.instance.document = doc;
    });

    it('nie kasuje i nie nadpisuje panelu ręcznego przy przebudowie', () => {
        const cabinet = doc.createContainer({
            name: 'Szafa',
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const enginePanel = doc.createPanel({
            name: 'Bok lewy',
            role: 'LEFT_SIDE_PANEL',
            width: mmToNm(18),
            height: mmToNm(720),
            thickness: mmToNm(500),
        }, cabinet.id);
        (enginePanel as any).key = 'LEFT_SIDE_PANEL';

        const manual = doc.createPanel({
            name: 'Wzmocnienie',
            role: 'MANUAL_PANEL',
            width: mmToNm(400),
            height: mmToNm(80),
            thickness: mmToNm(18),
            engineManaged: false,
        }, cabinet.id) as PanelModel;
        const manualNode = doc.findNode(manual.id)!;
        manualNode.setLocalTransform(new Vec3(mmToNm(120), mmToNm(80), mmToNm(40)), Quat.IDENTITY);
        const locBefore = manualNode.localMatrix.decompose().translation;

        applyPlanToContainer(cabinet, {
            parts: [{
                name: 'Bok lewy',
                role: 'LEFT_SIDE_PANEL',
                key: 'LEFT_SIDE_PANEL',
                loc: { x: 0, y: 0, z: 0 },
                dim: { x: 18, y: 720, z: 500 },
            }],
        });

        expect(doc.findNode(manual.id)).toBe(manualNode);
        expect(doc.findNode(enginePanel.id)).not.toBeNull();
        expect(manual.width).toBe(mmToNm(400));
        expect(manual.height).toBe(mmToNm(80));
        const locAfter = manualNode.localMatrix.decompose().translation;
        expect(locAfter.x).toBeCloseTo(locBefore.x);
        expect(locAfter.y).toBeCloseTo(locBefore.y);
        expect(locAfter.z).toBeCloseTo(locBefore.z);
        expect(manualNode.parent?.nodeType).toBe(NodeType.ASSEMBLY);
    });
});
