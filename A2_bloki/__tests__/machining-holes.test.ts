/**
 * Test warstwy MACHINING-HOLE (doors/flaps):
 *   - buildHoleMachiningIntent daje kanoniczny kształt serializacji (1:1 jak stare buildery),
 *   - isOwnedHole rozróżnia tagi własności modułów,
 *   - machining-sync: clear własnych automatów (zostaw obce/frozen) + upsert na docelowych,
 *   - komenda E2E: execute → upsert na formatek, undo przywraca pierwotną treść.
 */
import { describe, it, expect } from 'vitest';
import {
    buildHoleMachiningIntent,
    isOwnedHole,
} from '../01_machining-intent.js';
import {
    emitMachiningFeatures,
    restoreMachiningFeatures,
    syncMachiningHoles,
} from '../01_machining-sync.js';
import { SyncDoorDrillingsCommand } from '../commands/sync-door-drillings-command.js';

describe('machining-intent — buildHoleMachiningIntent', () => {
    it('buduje intencję hole w kanonicznym kształcie serializacji (identyczny jak buildery doors/flaps)', () => {
        const intent = buildHoleMachiningIntent({
            targetNodeId: 'p_bok_l',
            id: 'hinge_plate_l_0_h',
            face: 'FACE_Z_PLUS',
            side: 'FACE_Z_PLUS',
            template_id: 'BLUM_T_71T3550',
            u: 12,
            v: 500,
            diameter: 8,
            depth: 12,
            ownerTag: 'isDoorDrilling',
            sourceContainerId: 'SB_1',
            sourcePartId: 'Hinge_L0',
        });
        expect(intent.targetNodeId).toBe('p_bok_l');
        expect(intent.feature).toEqual({
            id: 'hinge_plate_l_0_h',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            side: 'FACE_Z_PLUS',
            params: {
                template_id: 'BLUM_T_71T3550',
                u: 12,
                v: 500,
                u_mm: 12,
                v_mm: 500,
                diameter: 8,
                diameter_mm: 8,
                depth: 12,
                depth_mm: 12,
                isDoorDrilling: true,
                sourceContainerId: 'SB_1',
                sourcePartId: 'Hinge_L0',
            },
        });
    });

    it('tag isFlapDrilling po ownerTag: klapa', () => {
        const intent = buildHoleMachiningIntent({
            targetNodeId: 'p_wieniec',
            id: 'flap_plate_HINGE_TL_h',
            face: 'FACE_Z_MINUS',
            u: 80,
            v: 10,
            diameter: 6,
            depth: 8,
            ownerTag: 'isFlapDrilling',
            sourceContainerId: 'SF_1',
            sourcePartId: 'HINGE_TL',
        });
        expect(intent.feature.params.isFlapDrilling).toBe(true);
        expect(intent.feature.params.isDoorDrilling).toBeUndefined();
        expect(intent.feature.params.template_id).toBeUndefined();
    });

    it('tag isShelfDrilling z parametrem clearance', () => {
        const intent = buildHoleMachiningIntent({
            targetNodeId: 'p_bok_l',
            id: 'shelf_hole_1',
            face: 'FACE_Z_PLUS',
            u: 50,
            v: 200,
            diameter: 5,
            depth: 12,
            clearance: 1.5,
            ownerTag: 'isShelfDrilling',
            sourceContainerId: 'SB_SHELVES',
            sourcePartId: 'Polka_1',
        });
        expect(intent.feature.params.isShelfDrilling).toBe(true);
        expect(intent.feature.params.clearance).toBe(1.5);
    });

    it('isOwnedHole rozpoznaje wyłącznie pasujący tag własności danego modułu', () => {
        const door = { type: 'hole', params: { isDoorDrilling: true } };
        const flap = { type: 'hole', params: { isFlapDrilling: true } };
        const shelf = { type: 'hole', params: { isShelfDrilling: true } };
        const drawer = { type: 'hole', params: { isDrawerDrilling: true } };
        const tube = { type: 'hole', params: { isTubeDrilling: true } };
        const hangerHole = { type: 'hole', params: { isHangerDrilling: true } };
        const hangerSmartPart = { type: 'groove', params: { isSmartPartFeature: true } };
        const manual = { type: 'hole', params: { diameter: 8, template_id: 'custom' } };

        expect(isOwnedHole(door, 'isDoorDrilling')).toBe(true);
        expect(isOwnedHole(door, 'isFlapDrilling')).toBe(false);
        expect(isOwnedHole(flap, 'isFlapDrilling')).toBe(true);
        expect(isOwnedHole(flap, 'isDoorDrilling')).toBe(false);
        expect(isOwnedHole(shelf, 'isShelfDrilling')).toBe(true);
        expect(isOwnedHole(drawer, 'isDrawerDrilling')).toBe(true);
        expect(isOwnedHole(tube, 'isTubeDrilling')).toBe(true);
        expect(isOwnedHole(hangerHole, 'isHangerDrilling')).toBe(true);
        expect(isOwnedHole(hangerSmartPart, 'isHangerDrilling')).toBe(true);

        // Ręczna obróbka (bez tagu) — nigdy nie czyścimy
        expect(isOwnedHole(manual, 'isDoorDrilling')).toBe(false);
        expect(isOwnedHole(manual, 'isFlapDrilling')).toBe(false);
        expect(isOwnedHole(manual, 'isShelfDrilling')).toBe(false);
    });
});

describe('machining-sync — syncMachiningHoles', () => {
    function makeSyncFixture() {
        // panelA: ma własny automat doors + obcy ręczny otwor + zamrożony własny;
        // panelB: formatka docelowa upsertu (rola przegrody);
        const panelA: any = {
            id: 'p_a',
            features: [
                { id: 'old_door', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 1, v: 1, diameter: 8, isDoorDrilling: true } },
                { id: 'handmade', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 9, v: 9, diameter: 20, template_id: 'custom' } },
                { id: 'frozen_door', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 2, v: 2, diameter: 8, isDoorDrilling: true, frozen: true } },
            ],
        };
        const panelB: any = { id: 'p_b', features: [{ id: 'obca', type: 'groove', params: {} }] };
        const nodes: Record<string, any> = {
            p_a: { id: 'p_a', domainData: panelA },
            p_b: { id: 'p_b', domainData: panelB },
        };
        const doc: any = {
            findNode: (id: string) => nodes[id] || null,
            notifyDocumentChanged: () => {},
        };
        const panels = [nodes.p_a, nodes.p_b];
        const oldFeatures = new Map<string, any[]>();
        return { doc, panelA, panelB, panels, oldFeatures };
    }

    it('clear taga własności (zachowa frozen i obce) + upsert na docelowych', () => {
        const { doc, panelA, panelB, panels, oldFeatures } = makeSyncFixture();
        const intent = buildHoleMachiningIntent({
            targetNodeId: 'p_b',
            id: 'hinge_plate_l_0_h',
            face: 'FACE_Z_PLUS',
            template_id: 'BLUM_T_71T3550',
            u: 10,
            v: 20,
            diameter: 8,
            depth: 12,
            ownerTag: 'isDoorDrilling',
            sourceContainerId: 'SB_1',
            sourcePartId: 'Hinge_L0',
        });
        const changed = syncMachiningHoles(doc, [intent], panels, 'isDoorDrilling', oldFeatures);

        const idsA = panelA.features.map((f: any) => f.id);
        expect(idsA).toEqual(['handmade', 'frozen_door']);
        const idsB = panelB.features.map((f: any) => f.id);
        expect(idsB).toEqual(['obca', 'hinge_plate_l_0_h']);
        expect(changed.has('p_a')).toBe(true);
        expect(changed.has('p_b')).toBe(true);

        // Snapshot do undo = stan PRZED (old_door + handmade + frozen_door)
        expect((oldFeatures.get('p_a') || []).map((f: any) => f.id)).toEqual(['old_door', 'handmade', 'frozen_door']);
        expect((oldFeatures.get('p_b') || []).map((f: any) => f.id)).toEqual(['obca']);
    });

    it('polityka frozen: zamrożony automat zostaje przy clear', () => {
        const { doc, panelA, panels, oldFeatures } = makeSyncFixture();
        syncMachiningHoles(doc, [], panels, 'isDoorDrilling', oldFeatures);
        const frozen = panelA.features.find((f: any) => f.id === 'frozen_door');
        expect(frozen).toBeDefined();
        expect(isOwnedHole(frozen, 'isDoorDrilling')).toBe(true);
    });

    it('emit / restore: undo odtwarza pierwotne features i emituje (setFeatures)', () => {
        const { doc, panels, oldFeatures } = makeSyncFixture();
        // Pierwszy sync na docelowe (p_b) — snapshot p_b, upsert; emit spy via setFeatures
        const intent = buildHoleMachiningIntent({
            targetNodeId: 'p_b',
            id: 'hinge_plate_r_1_h',
            face: 'FACE_Z_PLUS',
            u: 5,
            v: 6,
            diameter: 8,
            depth: 12,
            ownerTag: 'isDoorDrilling',
        });
        const changed = syncMachiningHoles(doc, [intent], panels, 'isDoorDrilling', oldFeatures);

        let emitted = 0;
        const pBNode = panels.find((p) => p.id === 'p_b');
        pBNode.domainData.setFeatures = () => { emitted += 1; };
        emitMachiningFeatures(panels, changed);
        expect(emitted).toBe(1);

        // Restore z snapshotów
        const beforePb = JSON.parse(JSON.stringify(oldFeatures.get('p_b')));
        restoreMachiningFeatures(doc, oldFeatures);
        expect(JSON.parse(JSON.stringify(pBNode.domainData.features))).toEqual(beforePb);
        expect(pBNode.domainData.features.some((f: any) => f.id === 'hinge_plate_r_1_h')).toBe(false);
    });
});

describe('SyncDoorDrillingsCommand — delegacja do rdzenia MACHINING', () => {
    it('execute → upsert, undo → pierwotna treść (fixture namiastka dokumentu)', () => {
        const panel: any = {
            id: 'p_l',
            features: [],
        };
        const board: any = { id: 'p_l', domainData: panel };
        const doc: any = {
            findNode: (id: string) => (id === 'p_l' ? board : null),
            getPanels: () => [board],
            notifyDocumentChanged: () => {},
        };
        const snapshot = JSON.parse(JSON.stringify(panel.features));
        const cmd = new SyncDoorDrillingsCommand();
        // Bez kontenera bloka doors builder zwraca [] — sprawdzamy przepływ clear/emit/undo
        cmd.execute(doc);
        expect(panel.features).toEqual(snapshot);
        cmd.undo(doc);
        expect(panel.features).toEqual(snapshot);
    });
});
