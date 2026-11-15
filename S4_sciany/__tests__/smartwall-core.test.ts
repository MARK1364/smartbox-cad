import { describe, it, expect, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { MacroCommand } from '../../A1_core/commands/macro-command.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { CreateSmartWallCommand } from '../commands/create-smartwall-command.js';
import { SetSmartWallParamsCommand } from '../commands/set-smartwall-params-command.js';
import * as smartWallCore from '../smartwall-core.js';
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

    it('rollbackuje tworzenie SmartWall po błędzie przebudowy bez wpisu Undo', () => {
        const doc = new ProjectDocument();
        new CreateSmartWallCommand({ preset: 'rect', name: 'Istniejąca ściana' }).execute(doc);
        const previousActiveEntity = doc.activeEntity;
        const initialContainerCount = doc.getContainers().length;
        const history = new CommandHistory(doc);
        const command = new CreateSmartWallCommand({ preset: 'rect', name: 'Nowa ściana' });
        const rebuild = vi.spyOn(smartWallCore, 'rebuildSmartWall').mockImplementation((model, targetDoc) => {
            rebuild.mockRestore();
            smartWallCore.rebuildSmartWall(model, targetDoc);
            throw new Error('test SmartWall rebuild failure');
        });

        expect(() => history.execute(command)).toThrow('test SmartWall rebuild failure');

        expect(history.canUndo).toBe(false);
        expect(doc.getContainers()).toHaveLength(initialContainerCount);
        expect(doc.activeEntity).toBe(previousActiveEntity);
        expect(doc.rootNode.children.map((child) => child.name)).not.toContain('Nowa ściana');
    });

    it('Undo/Redo przywraca te same ID kontenera i formatek SmartWall', () => {
        const doc = new ProjectDocument();
        const history = new CommandHistory(doc);
        history.execute(new CreateSmartWallCommand({ preset: 'rect', name: 'SmartWall ID' }));
        const container = doc.getContainers()[0];
        const containerId = container.id;
        const childIds = container.children.map((child) => child.id);

        expect(history.undo()).toBe(true);
        expect(doc.findNode(containerId)).toBeNull();
        expect(history.redo()).toBe(true);

        const redoneContainer = doc.findNode(containerId);
        expect(redoneContainer).not.toBeNull();
        expect(redoneContainer!.children.map((child) => child.id)).toEqual(childIds);
        expect(doc.activeEntity).toBe(redoneContainer!.domainData);
    });

    it('nie publikuje zdarzenia SmartWall, gdy późniejszy krok makra powoduje rollback', () => {
        const dispatchEvent = vi.fn();
        vi.stubGlobal('window', { document: { dispatchEvent } });
        vi.stubGlobal('CustomEvent', class {
            constructor(public type: string) {}
        });

        try {
            const doc = new ProjectDocument();
            const createWall = new CreateSmartWallCommand({ preset: 'rect', name: 'Makro SmartWall' });
            const failingCommand = {
                id: 'test_failure',
                label: 'Fail',
                timestamp: Date.now(),
                affectedNodeIds: [],
                execute: () => { throw new Error('test macro failure'); },
                undo: () => {},
            };
            const macro = new MacroCommand([createWall, failingCommand]);

            expect(() => macro.execute(doc)).toThrow('test macro failure');
            expect(doc.getContainers()).toHaveLength(0);
            expect(dispatchEvent).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('nie publikuje zdarzenia parametrów SmartWall przed zatwierdzeniem makra', () => {
        const dispatchEvent = vi.fn();
        vi.stubGlobal('window', { document: { dispatchEvent } });
        vi.stubGlobal('CustomEvent', class {
            constructor(public type: string) {}
        });

        try {
            const doc = new ProjectDocument();
            new CreateSmartWallCommand({ preset: 'rect', name: 'SmartWall transakcyjny' }).execute(doc);
            const container = doc.getContainers()[0].domainData as any;
            const before = SetSmartWallParamsCommand.snapshotFrom(container);
            const updateParams = new SetSmartWallParamsCommand(container.id, before, {
                ...before,
                roomWidth: before.roomWidth + 500,
            });
            const failingCommand = {
                id: 'test_params_failure',
                label: 'Fail',
                timestamp: Date.now(),
                affectedNodeIds: [],
                execute: () => { throw new Error('test macro params failure'); },
                undo: () => {},
            };
            const macro = new MacroCommand([updateParams, failingCommand]);
            dispatchEvent.mockClear();

            expect(() => macro.execute(doc)).toThrow('test macro params failure');
            expect(SetSmartWallParamsCommand.snapshotFrom(container)).toEqual(before);
            expect(dispatchEvent).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
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
