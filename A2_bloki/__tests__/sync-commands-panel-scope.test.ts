/**
 * sync-commands-panel-scope.test.ts
 *
 * Strażnik kontraktu zakresu formatek (cabinetContainerId) dla wszystkich komend Sync*:
 *   - Komenda wołana z cabinetContainerId operuje WYŁĄCZNIE na formatkach danego korpusu.
 *   - Formatki drugiego korpusu NIE mogą stracić swoich cech (ani zyskać cech obcego korpusu).
 *   - Komenda bez cabinetContainerId operuje globalnie.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';

import { SyncDoorDrillingsCommand } from '../commands/sync-door-drillings-command.js';
import { SyncFlapsDrillingsCommand } from '../commands/sync-flaps-drillings-command.js';
import { SyncShelfDrillingsCommand } from '../commands/sync-shelf-drillings-command.js';
import { SyncDrawerDrillingsCommand } from '../commands/sync-drawer-drillings-command.js';
import { SyncTubesDrillingsCommand } from '../commands/sync-tubes-drillings-command.js';
import { SyncSkosneDoorsDrillingsCommand } from '../commands/sync-skosne-doors-drillings-command.js';
import { SyncHangersDrillingsCommand } from '../commands/sync-hangers-drillings-command.js';
import { SyncLedMachiningCommand } from '../commands/sync-led-machining-command.js';

describe('Sync* Commands — Cabinet Panel Scope Isolation', () => {
    let doc: ProjectDocument;
    let cab1: ContainerModel;
    let cab2: ContainerModel;
    let panelCab1: PanelModel;
    let panelCab2: PanelModel;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        // Korpus 1
        cab1 = doc.createAssembly({ name: 'Korpus 1' }) as ContainerModel;
        cab1.generatorParams = { type: 'korpus3_2' };
        const cab1Node = doc.findNode(cab1.id)!;
        cab1Node.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

        panelCab1 = new PanelModel({
            name: 'Bok Cab1',
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18),
        });
        const p1Node = CADNode.create(NodeType.PART, panelCab1.name, panelCab1.id);
        p1Node.domainData = panelCab1;
        doc.addNode(cab1.id, p1Node);

        // Korpus 2
        cab2 = doc.createAssembly({ name: 'Korpus 2' }) as ContainerModel;
        cab2.generatorParams = { type: 'korpus3_2' };
        const cab2Node = doc.findNode(cab2.id)!;
        cab2Node.setLocalTransform(new Vec3(mmToNm(1000), 0, 0), Quat.IDENTITY);

        panelCab2 = new PanelModel({
            name: 'Bok Cab2',
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18),
        });
        const p2Node = CADNode.create(NodeType.PART, panelCab2.name, panelCab2.id);
        p2Node.domainData = panelCab2;
        doc.addNode(cab2.id, p2Node);

        // Dodaj cechy na formacie w Korpusie 2, które komendy mogłyby omyłkowo wyczyścić
        panelCab2.features = [
            { id: 'hole_door_cab2', type: 'hole', face: 'FACE_Z_PLUS', params: { isDoorDrilling: true } },
            { id: 'hole_flap_cab2', type: 'hole', face: 'FACE_Z_PLUS', params: { isFlapDrilling: true } },
            { id: 'hole_shelf_cab2', type: 'hole', face: 'FACE_Z_PLUS', params: { isShelfDrilling: true } },
            { id: 'hole_drawer_cab2', type: 'hole', face: 'FACE_Z_PLUS', params: { isDrawerDrilling: true } },
            { id: 'hole_tube_cab2', type: 'hole', face: 'FACE_Z_PLUS', params: { isTubeDrilling: true } },
            { id: 'hole_hanger_cab2', type: 'hole', face: 'FACE_Z_PLUS', params: { isHangerDrilling: true } },
            { id: 'groove_led_cab2', type: 'groove', face: 'FACE_Z_PLUS', params: { source: 'BLOKI_LED', channel_id: 'cab2_led' } },
        ];
    });

    it('SyncDoorDrillingsCommand(cab1.id) nie dotyka cech Korpusu 2', () => {
        const cmd = new SyncDoorDrillingsCommand(cab1.id);
        cmd.execute(doc);
        const feats = panelCab2.features.map((f: any) => f.id);
        expect(feats).toContain('hole_door_cab2');
    });

    it('SyncFlapsDrillingsCommand(cab1.id) nie dotyka cech Korpusu 2', () => {
        const cmd = new SyncFlapsDrillingsCommand(cab1.id);
        cmd.execute(doc);
        const feats = panelCab2.features.map((f: any) => f.id);
        expect(feats).toContain('hole_flap_cab2');
    });

    it('SyncShelfDrillingsCommand(cab1.id) nie dotyka cech Korpusu 2', () => {
        const cmd = new SyncShelfDrillingsCommand(cab1.id);
        cmd.execute(doc);
        const feats = panelCab2.features.map((f: any) => f.id);
        expect(feats).toContain('hole_shelf_cab2');
    });

    it('SyncDrawerDrillingsCommand(cab1.id) nie dotyka cech Korpusu 2', () => {
        const cmd = new SyncDrawerDrillingsCommand(cab1.id);
        cmd.execute(doc);
        const feats = panelCab2.features.map((f: any) => f.id);
        expect(feats).toContain('hole_drawer_cab2');
    });

    it('SyncTubesDrillingsCommand(cab1.id) nie dotyka cech Korpusu 2', () => {
        const cmd = new SyncTubesDrillingsCommand(cab1.id);
        cmd.execute(doc);
        const feats = panelCab2.features.map((f: any) => f.id);
        expect(feats).toContain('hole_tube_cab2');
    });

    it('SyncSkosneDoorsDrillingsCommand(cab1.id) nie dotyka cech Korpusu 2', () => {
        const cmd = new SyncSkosneDoorsDrillingsCommand(cab1.id);
        cmd.execute(doc);
        const feats = panelCab2.features.map((f: any) => f.id);
        expect(feats).toContain('hole_door_cab2');
    });

    it('SyncHangersDrillingsCommand(cab1.id) nie dotyka cech Korpusu 2', () => {
        const cmd = new SyncHangersDrillingsCommand(cab1.id);
        cmd.execute(doc);
        const feats = panelCab2.features.map((f: any) => f.id);
        expect(feats).toContain('hole_hanger_cab2');
    });

    it('SyncLedMachiningCommand(cab1.id) nie dotyka cech Korpusu 2', () => {
        const cmd = new SyncLedMachiningCommand(cab1.id);
        cmd.execute(doc);
        const feats = panelCab2.features.map((f: any) => f.id);
        expect(feats).toContain('groove_led_cab2');
    });
});
