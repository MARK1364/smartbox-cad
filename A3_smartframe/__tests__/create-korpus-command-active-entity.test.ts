import { describe, expect, it } from 'vitest';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CreateKorpusCommand } from '../commands/create-korpus-command.js';

describe('CreateKorpusCommand active entity history', () => {
    it('restores the previous active entity on undo and activates the created korpus on redo', () => {
        const document = new ProjectDocument();
        ContextManager.instance.document = document;
        const history = new CommandHistory(document);
        const previousEntity = document.createAssembly({ name: 'Poprzedni korpus' }) as ContainerModel;
        document.setActiveEntity(previousEntity);

        const command = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
        });

        history.execute(command);
        const createdEntity = document.activeEntity;
        expect(createdEntity).not.toBe(previousEntity);
        expect(createdEntity).not.toBeNull();

        expect(history.undo()).toBe(true);
        expect(document.activeEntity).toBe(previousEntity);

        expect(history.redo()).toBe(true);
        expect(document.activeEntity).not.toBeNull();
        expect(document.activeEntity).not.toBe(previousEntity);
        expect(document.findNode(document.activeEntity!.id)?.domainData).toBe(document.activeEntity);

        history.undo();
        expect(document.activeEntity).toBe(previousEntity);
    });
});
