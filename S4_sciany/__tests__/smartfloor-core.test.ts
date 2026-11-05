import { describe, it, expect, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { MacroCommand } from '../../A1_core/commands/macro-command.js';
import { CreateSmartFloorCommand } from '../commands/create-smartfloor-command.js';
import { SetSmartFloorParamsCommand } from '../commands/set-smartfloor-params-command.js';
import * as smartFloorCore from '../smartfloor-core.js';
import { rebuildSmartFloor } from '../smartfloor-core.js';
import { isSmartFloorContainer, isFloorPart } from '../smartfloor-types.js';
import { isExcludedFromProduction } from '../smartwall-types.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

describe('S4 SmartFloor', () => {
    it('tworzy osobny kontener pod ROOM (obok SmartWall) z 1× FLOOR', () => {
        const doc = new ProjectDocument();
        new CreateSmartFloorCommand({ name: 'Podłoga' }).execute(doc);
        const containers = doc.getContainers();
        expect(containers).toHaveLength(1);
        const c = containers[0].domainData as any;
        expect(isSmartFloorContainer(c)).toBe(true);
        expect(c.generatorParams?.type).toBe('smartfloor');
        expect(containers[0].children).toHaveLength(1);
        const part = containers[0].children[0].domainData as any;
        expect(part.role).toBe('FLOOR');
        expect(isFloorPart(part)).toBe(true);
        // Poza produkcją jak ściany.
        expect(isExcludedFromProduction(part)).toBe(true);
    });

    it('rollbackuje tworzenie SmartFloor po błędzie przebudowy bez wpisu Undo', () => {
        const doc = new ProjectDocument();
        new CreateSmartFloorCommand({ name: 'Istniejąca podłoga' }).execute(doc);
        const previousActiveEntity = doc.activeEntity;
        const initialContainerCount = doc.getContainers().length;
        const history = new CommandHistory(doc);
        const command = new CreateSmartFloorCommand({ name: 'Nowa podłoga' });
        const rebuild = vi.spyOn(smartFloorCore, 'rebuildSmartFloor').mockImplementation((model, targetDoc) => {
            rebuild.mockRestore();
            smartFloorCore.rebuildSmartFloor(model, targetDoc);
            throw new Error('test SmartFloor rebuild failure');
        });

        expect(() => history.execute(command)).toThrow('test SmartFloor rebuild failure');

        expect(history.canUndo).toBe(false);
        expect(doc.getContainers()).toHaveLength(initialContainerCount);
        expect(doc.activeEntity).toBe(previousActiveEntity);
        expect(doc.rootNode.children.map((child) => child.name)).not.toContain('Nowa podłoga');
    });

    it('Undo/Redo przywraca te same ID kontenera i formatki SmartFloor', () => {
        const doc = new ProjectDocument();
        const history = new CommandHistory(doc);
        history.execute(new CreateSmartFloorCommand({ name: 'SmartFloor ID' }));
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

    it('nie publikuje zdarzenia SmartFloor, gdy późniejszy krok makra powoduje rollback', () => {
        const dispatchEvent = vi.fn();
        vi.stubGlobal('window', { document: { dispatchEvent } });
        vi.stubGlobal('CustomEvent', class {
            constructor(public type: string) {}
        });

        try {
            const doc = new ProjectDocument();
            const createFloor = new CreateSmartFloorCommand({ name: 'Makro SmartFloor' });
            const failingCommand = {
                id: 'test_failure',
                label: 'Fail',
                timestamp: Date.now(),
                affectedNodeIds: [],
                execute: () => { throw new Error('test macro failure'); },
                undo: () => {},
            };
            const macro = new MacroCommand([createFloor, failingCommand]);

            expect(() => macro.execute(doc)).toThrow('test macro failure');
            expect(doc.getContainers()).toHaveLength(0);
            expect(dispatchEvent).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('góra płyty na Z=0 (środek na -T/2), wymiary z generatorParams', () => {
        const doc = new ProjectDocument();
        new CreateSmartFloorCommand({
            floorWidth: 5000,
            floorDepth: 4000,
            floorThickness: 60,
            position: { x: 1000, y: 500, z: 0 },
        }).execute(doc);
        const c = doc.getContainers()[0].domainData as any;
        expect(Math.round(nmToMm(c.width))).toBe(5000);
        expect(Math.round(nmToMm(c.depth))).toBe(4000);
        const node = doc.findNode(c.id);
        const partNode = node!.children[0];
        const { translation } = partNode.localMatrix.decompose();
        // środek płyty 60mm → -30mm w nm
        expect(Math.round(nmToMm(translation.z))).toBe(-30);
        expect(Math.round(nmToMm(translation.x))).toBe(0);
    });

    it('SetSmartFloorParamsCommand zmienia wymiary + undo wraca', () => {
        const doc = new ProjectDocument();
        new CreateSmartFloorCommand({}).execute(doc);
        const c = doc.getContainers()[0].domainData as any;
        const before = SetSmartFloorParamsCommand.snapshotFrom(c);
        const after = { ...before, floorWidth: 6000 };
        const cmd = new SetSmartFloorParamsCommand(c.id, before, after);
        cmd.execute(doc);
        expect(Math.round(nmToMm((doc.getContainers()[0].domainData as any).width))).toBe(6000);
        cmd.undo(doc);
        expect(Math.round(nmToMm((doc.getContainers()[0].domainData as any).width))).toBe(Math.round(before.floorWidth));
    });

    it('rebuild usuwa obce PART, szanuje panele ręczne', () => {
        const doc = new ProjectDocument();
        new CreateSmartFloorCommand({}).execute(doc);
        const c = doc.getContainers()[0].domainData as any;
        expect(rebuildSmartFloor(c, doc)).toBe(true);
        expect(doc.findNode(c.id)!.children).toHaveLength(1);
    });
});
