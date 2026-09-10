/**
 * smartbox-locking.test.ts
 *
 * Weryfikacja reguły: komponenty algorytmiczne SmartFrame i SmartBox są utwierdzone
 * względem dokładanych SmartPaneli (paneli ręcznych). Wiązanie SmartBox ze SmartPanelem
 * NIGDY nie może poruszyć SmartBoxa ani SmartFrame — to SmartPanel musi dociągnąć
 * się do SmartBoxa, niezależnie od kolejności kliknięcia (kotwica A czy B).
 */

import { describe, it, expect } from 'vitest';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { ConstraintStore } from '../constraint-store.js';
import { SolverController } from '../solver-controller.js';
import { makeAnchor, makeSolverConstraint, type SolverConstraint } from '../constraint-types.js';
import {
    buildSolverInput,
    collectTransformDeltas,
    computeReferenceLockedIds,
    getNodeGroundingPriority,
} from '../solver-bridge.js';

let seq = 0;
function constraint(init: Partial<SolverConstraint> & { bindType: SolverConstraint['bindType'] }) {
    return makeSolverConstraint({ id: `c_sb_${++seq}`, ...init });
}

describe('SmartBox / SmartFrame Grounding Priority & Locking', () => {
    it('poprawnie przypisuje priorytety uziemienia (Grounding Priority)', () => {
        const doc = new ProjectDocument();

        // 1. SmartFrame container
        const cabinetModel = doc.createContainer({ width: mmToNm(600), height: mmToNm(720), depth: mmToNm(500) });
        const cabinetNode = doc.findNode(cabinetModel.id)!;
        cabinetNode.name = 'smartframe_cabinet';
        (cabinetNode as any).customData = { smartframe: { id: 'sf_1' } };

        // 2. SmartFrame engine component
        const sfSideModel = doc.createPanel({ width: mmToNm(18), height: mmToNm(720), depth: mmToNm(500) }, cabinetModel.id);
        const sfSideNode = doc.findNode(sfSideModel.id)!;
        sfSideNode.name = 'bok_lewy';
        (sfSideNode as any).customData = { smartframe_component: true, role: 'side_left' };

        // 3. SmartBox container
        const shelfBoxModel = doc.createContainer({ width: mmToNm(564), height: mmToNm(100), depth: mmToNm(500) }, cabinetModel.id);
        const shelfBoxNode = doc.findNode(shelfBoxModel.id)!;
        shelfBoxNode.name = 'smartbox_shelf';
        (shelfBoxNode as any).customData = { smartbox: { type: 'shelf' } };

        // 4. SmartBox internal component
        const shelfPanelModel = doc.createPanel({ width: mmToNm(564), height: mmToNm(18), depth: mmToNm(500) }, shelfBoxModel.id);
        const shelfPanelNode = doc.findNode(shelfPanelModel.id)!;
        shelfPanelNode.name = 'wieniec_plyta';
        (shelfPanelNode as any).customData = { role: 'shelf' };

        // 5. SmartPanel (loose panel)
        const loosePanelModel = doc.createPanel({ width: mmToNm(200), height: mmToNm(200), thickness: mmToNm(18) });
        const loosePanelNode = doc.findNode(loosePanelModel.id)!;
        loosePanelNode.name = 'smartpanel_dokladany';

        expect(getNodeGroundingPriority(sfSideNode)).toBe(50);
        expect(getNodeGroundingPriority(cabinetNode)).toBe(40);
        expect(getNodeGroundingPriority(shelfPanelNode)).toBe(35);
        expect(getNodeGroundingPriority(shelfBoxNode)).toBe(30);
        expect(getNodeGroundingPriority(loosePanelNode)).toBe(10);
    });

    it('computeReferenceLockedIds wybiera SmartBox jako zablokowany bez względu na kolejność kliknięcia', () => {
        const doc = new ProjectDocument();

        const shelfBoxModel = doc.createContainer({ width: mmToNm(564), height: mmToNm(100), depth: mmToNm(500) });
        const shelfBoxNode = doc.findNode(shelfBoxModel.id)!;
        shelfBoxNode.name = 'smartbox_shelf';
        (shelfBoxNode as any).customData = { smartbox: { type: 'shelf' } };

        const loosePanelModel = doc.createPanel({ width: mmToNm(200), height: mmToNm(200), thickness: mmToNm(18) });
        const loosePanelNode = doc.findNode(loosePanelModel.id)!;
        loosePanelNode.name = 'smartpanel_dokladany';

        // Przypadek 1: Panel kliknięty jako pierwszy (Anchor A), SmartBox jako drugi (Anchor B)
        const c1 = constraint({
            bindType: 'COPLANAR',
            anchorA: makeAnchor({ nodeId: loosePanelNode.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
            anchorB: makeAnchor({ nodeId: shelfBoxNode.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
        });
        const locked1 = computeReferenceLockedIds([c1], doc);
        expect(locked1.has(shelfBoxNode.id)).toBe(true);
        expect(locked1.has(loosePanelNode.id)).toBe(false);

        // Przypadek 2: SmartBox kliknięty jako pierwszy (Anchor A), Panel jako drugi (Anchor B)
        const c2 = constraint({
            bindType: 'COPLANAR',
            anchorA: makeAnchor({ nodeId: shelfBoxNode.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
            anchorB: makeAnchor({ nodeId: loosePanelNode.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
        });
        const locked2 = computeReferenceLockedIds([c2], doc);
        expect(locked2.has(shelfBoxNode.id)).toBe(true);
        expect(locked2.has(loosePanelNode.id)).toBe(false);
    });

    it('SmartBox nie wyskakuje ze SmartFrame gdy wiążemy z nim SmartPanel (Anchor A = Panel, Anchor B = SmartBox)', () => {
        const doc = new ProjectDocument();
        const history = new CommandHistory(doc);
        const store = new ConstraintStore();
        const controller = new SolverController(store);
        controller.attach(doc, history);

        // SmartFrame w pozycji 0, 0, 0
        const cabinetModel = doc.createContainer({ width: mmToNm(600), height: mmToNm(720), depth: mmToNm(500) });
        const cabinetNode = doc.findNode(cabinetModel.id)!;
        cabinetNode.name = 'smartframe_cabinet';
        (cabinetNode as any).customData = { smartframe: { id: 'sf_1' } };

        // SmartBox wewnątrz szafy, lokalnie Z = 300 mm
        const shelfBoxModel = doc.createContainer({ width: mmToNm(564), height: mmToNm(18), depth: mmToNm(500) }, cabinetModel.id);
        const shelfBoxNode = doc.findNode(shelfBoxModel.id)!;
        shelfBoxNode.name = 'smartbox_shelf';
        (shelfBoxNode as any).customData = { smartbox: { type: 'shelf' } };
        shelfBoxNode.setLocalTransform(new Vec3(0, 0, mmToNm(300)), Quat.IDENTITY);

        // Dokładany SmartPanel gdzieś z boku: X = 1000 mm, Z = 900 mm
        const loosePanelModel = doc.createPanel({ width: mmToNm(200), height: mmToNm(200), thickness: mmToNm(18) });
        const loosePanelNode = doc.findNode(loosePanelModel.id)!;
        loosePanelNode.name = 'smartpanel_wolny';
        loosePanelNode.setLocalTransform(new Vec3(mmToNm(1000), 0, mmToNm(900)), Quat.IDENTITY);

        // Wiązanie COPLANAR: Anchor A = loosePanel, Anchor B = shelfBox
        store.add({
            bindType: 'COPLANAR',
            anchorA: makeAnchor({ nodeId: loosePanelNode.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
            anchorB: makeAnchor({ nodeId: shelfBoxNode.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
        });

        // Wykonaj rozwiązanie przez kontroler
        controller.solveNow();

        // Pozycja shelfBox w świecie nie może drgnąć z Z = 300 mm!
        const shelfWorldPos = shelfBoxNode.getWorldMatrix().decompose().translation;
        expect(nmToMm(shelfWorldPos.x)).toBeCloseTo(0, 1);
        expect(nmToMm(shelfWorldPos.z)).toBeCloseTo(300, 1);

        // Szafa też nie może drgnąć
        const cabinetWorldPos = cabinetNode.getWorldMatrix().decompose().translation;
        expect(nmToMm(cabinetWorldPos.x)).toBeCloseTo(0, 1);
        expect(nmToMm(cabinetWorldPos.z)).toBeCloseTo(0, 1);

        // Dokładany panel musiał się wyrównać w Z do shelfBoxa (Z = 300 mm)!
        const panelWorldPos = loosePanelNode.getWorldMatrix().decompose().translation;
        expect(nmToMm(panelWorldPos.z)).toBeCloseTo(309, 1);

        controller.detach();
    });

    it('SmartBox nie porusza się również gdy kolejność kotwic jest odwrócona (Anchor A = SmartBox, Anchor B = Panel)', () => {
        const doc = new ProjectDocument();
        const history = new CommandHistory(doc);
        const store = new ConstraintStore();
        const controller = new SolverController(store);
        controller.attach(doc, history);

        const cabinetModel = doc.createContainer({ width: mmToNm(600), height: mmToNm(720), depth: mmToNm(500) });
        const cabinetNode = doc.findNode(cabinetModel.id)!;
        cabinetNode.name = 'smartframe_cabinet';
        (cabinetNode as any).customData = { smartframe: { id: 'sf_1' } };

        const shelfBoxModel = doc.createContainer({ width: mmToNm(564), height: mmToNm(18), depth: mmToNm(500) }, cabinetModel.id);
        const shelfBoxNode = doc.findNode(shelfBoxModel.id)!;
        shelfBoxNode.name = 'smartbox_shelf';
        (shelfBoxNode as any).customData = { smartbox: { type: 'shelf' } };
        shelfBoxNode.setLocalTransform(new Vec3(0, 0, mmToNm(300)), Quat.IDENTITY);

        const loosePanelModel = doc.createPanel({ width: mmToNm(200), height: mmToNm(200), thickness: mmToNm(18) });
        const loosePanelNode = doc.findNode(loosePanelModel.id)!;
        loosePanelNode.name = 'smartpanel_wolny';
        loosePanelNode.setLocalTransform(new Vec3(mmToNm(1000), 0, mmToNm(900)), Quat.IDENTITY);

        // Odwrócona kolejność: Anchor A = shelfBox, Anchor B = loosePanel
        store.add({
            bindType: 'COPLANAR',
            anchorA: makeAnchor({ nodeId: shelfBoxNode.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
            anchorB: makeAnchor({ nodeId: loosePanelNode.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
        });

        controller.solveNow();

        const shelfWorldPos = shelfBoxNode.getWorldMatrix().decompose().translation;
        expect(nmToMm(shelfWorldPos.x)).toBeCloseTo(0, 1);
        expect(nmToMm(shelfWorldPos.z)).toBeCloseTo(300, 1);

        const panelWorldPos = loosePanelNode.getWorldMatrix().decompose().translation;
        expect(nmToMm(panelWorldPos.z)).toBeCloseTo(309, 1);

        controller.detach();
    });

    it('wewnętrzne komponenty SmartBox i SmartFrame nie otrzymują deltas transformacji w collectTransformDeltas', () => {
        const doc = new ProjectDocument();

        const shelfBoxModel = doc.createContainer({ width: mmToNm(564), height: mmToNm(100), depth: mmToNm(500) });
        const shelfBoxNode = doc.findNode(shelfBoxModel.id)!;
        shelfBoxNode.name = 'smartbox_shelf';
        (shelfBoxNode as any).customData = { smartbox: { type: 'shelf' } };

        const shelfChildModel = doc.createPanel({ width: mmToNm(564), height: mmToNm(18), depth: mmToNm(500) }, shelfBoxModel.id);
        const shelfChildNode = doc.findNode(shelfChildModel.id)!;
        shelfChildNode.name = 'wieniec_panel';
        (shelfChildNode as any).customData = { role: 'shelf' };

        const loosePanelModel = doc.createPanel({ width: mmToNm(200), height: mmToNm(200), thickness: mmToNm(18) });
        const loosePanelNode = doc.findNode(loosePanelModel.id)!;

        const c = constraint({
            bindType: 'COPLANAR',
            anchorA: makeAnchor({ nodeId: shelfChildNode.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
            anchorB: makeAnchor({ nodeId: loosePanelNode.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
        });

        const input = buildSolverInput(doc, [c]);
        // Symulacja, że solver z jakiegoś powodu zwrócił stan z przesunięciem
        const shelfState = input.states.get(shelfChildNode.id);
        if (shelfState) {
            shelfState.location = [50, 50, 50];
        }

        const deltas = collectTransformDeltas(input);
        const shelfDelta = deltas.find(d => d.nodeId === shelfChildNode.id);
        expect(shelfDelta).toBeUndefined(); // Chroniony przed modyfikacją delty
    });
});
