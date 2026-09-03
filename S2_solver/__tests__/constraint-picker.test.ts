/**
 * Testy pipety więzów: geometria z formatki, bryła sztywna = korpus SmartFrame.
 *
 * Uruchom: npx vitest run S2_solver/__tests__/constraint-picker
 */

import { describe, it, expect } from 'vitest';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import {
    bindAnchorToRigidBody,
    resolveBindingTarget,
    resolveRigidBody,
} from '../constraint-picker.js';
import { namedFaceFromPick } from '../constraint-geometry.js';
import { makeAnchor } from '../constraint-types.js';

describe('resolveBindingTarget / resolveRigidBody', () => {
    it('geometria z formatki, bryła sztywna to korpus', () => {
        const document = new ProjectDocument();
        const container = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const panel = document.createPanel(
            { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) },
            container.id,
        );
        const panelNode = document.findNode(panel.id)!;
        const cabNode = document.findNode(container.id)!;

        expect(resolveBindingTarget(panelNode)?.id).toBe(panelNode.id);
        expect(resolveRigidBody(panelNode)?.id).toBe(cabNode.id);
        expect(resolveRigidBody(panelNode)?.nodeType).toBe(NodeType.ASSEMBLY);
    });

    it('panel ręczny w korpusie jest własną bryłą sztywną', () => {
        const document = new ProjectDocument();
        const container = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const panel = document.createPanel(
            {
                width: mmToNm(400),
                height: mmToNm(100),
                thickness: mmToNm(18),
                engineManaged: false,
            },
            container.id,
        );
        const panelNode = document.findNode(panel.id)!;
        expect(resolveRigidBody(panelNode)?.id).toBe(panelNode.id);
        expect(resolveRigidBody(panelNode)?.nodeType).toBe(NodeType.PART);
    });

    it('luźna formatka (bez korpusu) jest własną bryłą sztywną', () => {
        const document = new ProjectDocument();
        const panel = document.createPanel({
            width: mmToNm(600),
            height: mmToNm(400),
            thickness: mmToNm(18),
        });
        const node = document.findNode(panel.id)!;
        expect(resolveRigidBody(node)?.id).toBe(node.id);
        expect(resolveRigidBody(node)?.nodeType).toBe(NodeType.PART);
    });

    it('kliknięty korpus zostaje korpusem', () => {
        const document = new ProjectDocument();
        const container = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const node = document.findNode(container.id)!;
        expect(resolveRigidBody(node)?.id).toBe(node.id);
        expect(resolveRigidBody(node)?.nodeType).toBe(NodeType.ASSEMBLY);
    });
});

describe('bindAnchorToRigidBody', () => {
    it('przepina kotwicę formatki na korpus i zachowuje sourceNodeId', () => {
        const document = new ProjectDocument();
        const container = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const panel = document.createPanel(
            { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) },
            container.id,
        );
        const panelNode = document.findNode(panel.id)!;
        const bound = bindAnchorToRigidBody(
            panelNode,
            makeAnchor({
                nodeId: panelNode.id,
                kind: 'FACE',
                faceName: 'FACE_Z_PLUS',
                localPointMm: [0, 0, 9],
                localNormalMm: [0, 0, 1],
            }),
        );

        expect(bound.nodeId).toBe(container.id);
        expect(bound.sourceNodeId).toBe(panelNode.id);
        expect(bound.faceName).toBe('FACE_Z_PLUS');
        expect(bound.localNormalMm).toEqual([0, 0, 1]);
    });

    it('OUTER boczka (back) mapuje się na −X korpusu, nie na INNER', () => {
        const document = new ProjectDocument();
        const container = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const panel = document.createPanel(
            { width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18) },
            container.id,
        );
        const panelNode = document.findNode(panel.id)!;
        panelNode.setLocalTransform(
            new Vec3(mmToNm(-300 + 9), 0, mmToNm(360)),
            Quat.fromEulerXYZ(0, 0, -Math.PI / 2),
        );
        const named = namedFaceFromPick(panelNode, 'back')!;
        const bound = bindAnchorToRigidBody(
            panelNode,
            makeAnchor({
                nodeId: panelNode.id,
                kind: 'FACE',
                faceName: 'FACE_Z_MINUS',
                localPointMm: named.localPointMm,
                localNormalMm: named.localNormalMm,
            }),
        );

        expect(bound.faceName).toBe('FACE_Z_MINUS');
        expect(bound.localNormalMm?.[0]).toBeCloseTo(-1);
        expect(bound.localPointMm?.[0]).toBeCloseTo(-300);
    });
});
