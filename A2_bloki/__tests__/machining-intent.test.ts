import { describe, it, expect } from 'vitest';
import {
    buildGrooveMachiningIntent,
    isOwnedGroove,
} from '../01_machining-intent.js';
import {
    buildBlokiLedInternalGroovePlan,
    applyBlokiLedInternalGroovePlan,
} from '../13_led-internal-engine.js';
import { SyncLedMachiningCommand } from '../commands/sync-led-machining-command.js';

describe('machining-intent — buildGrooveMachiningIntent', () => {
    it('buduje intencję groove w kanonicznym kształcie serializacji (identyczny jak silniki LED)', () => {
        const intent = buildGrooveMachiningIntent({
            targetNodeId: 'p_l',
            id: 'led_groove_SB_1_l',
            source: 'BLOKI_LED',
            channelId: 'SB_1',
            sourceContainerId: 'SB_1',
            name: 'Wpust pod profil LED',
            u: 436,
            v: 2,
            width: 14,
            length: 1960,
            depth: 9,
        });
        expect(intent.targetNodeId).toBe('p_l');
        expect(intent.feature).toEqual({
            id: 'led_groove_SB_1_l',
            type: 'groove',
            face: 'FACE_Z_PLUS',
            name: 'Wpust pod profil LED',
            params: {
                source: 'BLOKI_LED',
                channel_id: 'SB_1',
                u: 436,
                v: 2,
                width: 14,
                length: 1960,
                depth: 9,
                sourceContainerId: 'SB_1',
                isLedGroove: true,
            },
        });
    });

    it('isOwnedGroove rozpoznaje automaty danego modułu i nie miesza systemów LED', () => {
        const led = { type: 'groove', params: { source: 'BLOKI_LED', channel_id: 'SB_1' } };
        const channel = { type: 'groove', params: { source: 'assembly_led_channel', channel_id: 'SB_1' } };
        const manual = { type: 'groove', params: { source: 'custom', channel_id: 'SB_1' } };
        expect(isOwnedGroove(led, 'BLOKI_LED', 'SB_1')).toBe(true);
        expect(isOwnedGroove(channel, 'BLOKI_LED', 'SB_1')).toBe(false);
        expect(isOwnedGroove(manual, 'BLOKI_LED', 'SB_1')).toBe(false);
    });
});

function makeDocMock() {
    const leftPanel: any = {
        id: 'p_l',
        width: 500_000_000,
        height: 2000_000_000,
        features: [{ id: 'led_groove_SB_1_l', type: 'groove', face: 'FACE_Z_PLUS', params: { source: 'BLOKI_LED', channel_id: 'SB_1', u: 1, v: 0, width: 10, length: 10, depth: 5 } }]
    };
    const rightPanel: any = { id: 'p_r', width: 500_000_000, height: 2000_000_000, features: [] };
    const backPanel: any = { id: 'p_b', width: 600_000_000, height: 2000_000_000, features: [] };
    const nodes: Record<string, any> = {
        p_l: { id: 'p_l', domainData: leftPanel },
        p_r: { id: 'p_r', domainData: rightPanel },
        p_b: { id: 'p_b', domainData: backPanel },
    };
    const cs: any = {
        id: 'SB_1',
        domainData: {
            id: 'SB_1',
            visible: true,
            height: 2000_000_000,
            depth: 500_000_000,
            width: 600_000_000,
            generatorParams: {
                boxType: 'LED_INTERNAL',
                profil_lewy: true,
                profil_prawy: true,
                profil_tyl: true,
                customReferences: {
                    xMin: { panelId: 'p_l' },
                    xMax: { panelId: 'p_r' },
                    yMax: { panelId: 'p_b' },
                },
            },
        },
    };
    const doc: any = {
        rootNode: null,
        findNode: (id: string) => nodes[id] || null,
        getContainers: () => [cs],
        getPanels: () => [nodes.p_l, nodes.p_r, nodes.p_b],
    };
    return { doc, leftPanel, rightPanel, backPanel, cs };
}

describe('LED wewnętrzny — plan machining (intent)', () => {
    it('plan = L(all) + R(all) + back z upsertami i sourceContainerId', () => {
        const { doc } = makeDocMock();
        const plan = buildBlokiLedInternalGroovePlan(doc.getContainers()[0], doc);
        expect(plan).not.toBeNull();
        expect(plan!.ownerId).toBe('SB_1');
        expect(plan!.panels.map((p) => p.targetNodeId)).toEqual(['p_l', 'p_r', 'p_b']);
        expect(plan!.panels[0].scope).toBe('all');
        expect(plan!.panels[0].upsert).toBeDefined();
        expect(plan!.panels[0].upsert!.feature.id).toBe('led_groove_SB_1_l');
        expect(plan!.panels[2].scope).toBe('back');
        expect(plan!.panels[2].upsert!.feature.params.sourceContainerId).toBe('SB_1');
        expect(plan!.panels[2].upsert!.feature.name).toContain('Plecy');
    });

    it('aplikacja planu zastępuje wpusty ownera i zostawia obce (debíz/CNC ręczne)', () => {
        const { doc, leftPanel } = makeDocMock();
        const manualGroove = { id: 'handmade', type: 'groove', face: 'FACE_Z_PLUS', params: { source: 'custom', u: 9, v: 0, width: 5, length: 10, depth: 5 } };
        leftPanel.features.push(manualGroove);
        applyBlokiLedInternalGroovePlan(doc, buildBlokiLedInternalGroovePlan(doc.getContainers()[0], doc)!);
        const ids = leftPanel.features.map((f: any) => f.id);
        expect(ids).toContain('led_groove_SB_1_l');
        expect(ids).toContain('handmade');
        const fresh = leftPanel.features.find((f: any) => f.id === 'led_groove_SB_1_l');
        expect(fresh.params.isLedGroove).toBe(true);
    });

    it('profi wyłączone → tylko czyszczenie suffixu, bez upsertu, plecy z fallbacku BACK_PANEL', () => {
        const { doc, cs, leftPanel } = makeDocMock();
        cs.domainData.generatorParams.profil_lewy = false;
        cs.domainData.generatorParams.profil_tyl = false;
        const plan = buildBlokiLedInternalGroovePlan(cs, doc);
        const leftPlan = plan!.panels.find((p) => p.targetNodeId === 'p_l');
        expect(leftPlan!.upsert).toBeUndefined();
        const backPlan = plan!.panels.find((p) => p.targetNodeId === 'p_b');
        expect(backPlan!.upsert).toBeUndefined();
        applyBlokiLedInternalGroovePlan(doc, plan!);
        expect(leftPanel.features.length).toBe(0);
    });
});

describe('SyncLedMachiningCommand', () => {
    it('execute → upsert na formatek, undo przywraca pierwotną treść', () => {
        const { doc, cs, leftPanel } = makeDocMock();
        const snapshot = JSON.parse(JSON.stringify(leftPanel.features));
        const cmd = new SyncLedMachiningCommand('SB_1');
        cmd.execute(doc);
        expect(leftPanel.features.some((f: any) => f.id === 'led_groove_SB_1_l')).toBe(true);
        cmd.undo(doc);
        expect(leftPanel.features).toEqual(snapshot);
        void cs;
    });
});
