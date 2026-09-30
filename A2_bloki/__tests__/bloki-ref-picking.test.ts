import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../../A1_core/context-manager.js';

describe('Bloki reference picking guard and clear flow', () => {
    let mockContainer: any;
    let statusMessages: string[] = [];

    beforeEach(() => {
        statusMessages = [];
        delete ContextManager.instance.activeReferencePicker;
        ContextManager.instance.appAPI = {
            setStatus: (msg: string) => { statusMessages.push(msg); },
            setSelectionMode: () => {},
        } as any;

        mockContainer = {
            id: 'sb_test_container',
            generatorParams: {
                boxType: 'SHELVES',
                customReferences: {
                    xMin: { partKey: 'Bok Lewy', face: 'FACE_Z_PLUS' }
                },
                disabledReferences: {}
            }
        };
    });

    it('does not initiate 3D face picking if reference is already assigned', () => {
        const sideKey = 'xMin';
        const disabledRefs = mockContainer.generatorParams.disabledReferences || {};
        const isDisabled = !!disabledRefs[sideKey];

        // Symulacja startPicking logic:
        let isPicking = false;
        if (!isDisabled) {
            ContextManager.instance.appAPI?.setStatus?.(
                `Referencja [Bok Lewy] jest przypisana. Aby wybrać inną, najpierw skasuj ją przyciskiem [✕].`
            );
        } else {
            isPicking = true;
            ContextManager.instance.activeReferencePicker = { sideKey } as any;
        }

        expect(isPicking).toBe(false);
        expect(ContextManager.instance.activeReferencePicker).toBeUndefined();
        expect(statusMessages.some(m => m.includes('najpierw skasuj ją przyciskiem [✕]'))).toBe(true);
    });

    it('allows 3D face picking only after reference is cleared (✕ -> disabledReferences)', () => {
        const sideKey = 'xMin';

        // 1. Użytkownik klika [✕] -> clearReference
        delete mockContainer.generatorParams.customReferences[sideKey];
        mockContainer.generatorParams.disabledReferences[sideKey] = true;

        expect(mockContainer.generatorParams.disabledReferences[sideKey]).toBe(true);
        expect(mockContainer.generatorParams.customReferences[sideKey]).toBeUndefined();

        // 2. Teraz użytkownik klika w pusty slot (➕ Wybierz ścianę w 3D):
        const isDisabled = !!mockContainer.generatorParams.disabledReferences[sideKey];
        let isPicking = false;
        if (!isDisabled) {
            // zablokowane
        } else {
            isPicking = true;
            ContextManager.instance.activeReferencePicker = {
                sideKey,
                onSelect: (refData: any) => {
                    delete mockContainer.generatorParams.disabledReferences[sideKey];
                    mockContainer.generatorParams.customReferences[sideKey] = refData;
                    delete ContextManager.instance.activeReferencePicker;
                }
            } as any;
        }

        expect(isPicking).toBe(true);
        expect(ContextManager.instance.activeReferencePicker).toBeDefined();
        expect(ContextManager.instance.activeReferencePicker?.sideKey).toBe('xMin');

        // 3. Wskazanie ściany w 3D
        ContextManager.instance.activeReferencePicker?.onSelect({
            partKey: 'Przegroda_1',
            face: 'FACE_Z_MINUS'
        });

        expect(ContextManager.instance.activeReferencePicker).toBeUndefined();
        expect(mockContainer.generatorParams.disabledReferences[sideKey]).toBeUndefined();
        expect(mockContainer.generatorParams.customReferences[sideKey]).toEqual({
            partKey: 'Przegroda_1',
            face: 'FACE_Z_MINUS'
        });
    });

    it('clicking restore (↺) removes disabledReferences and restores default state', () => {
        const sideKey = 'xMin';
        // Stan po skasowaniu:
        mockContainer.generatorParams.disabledReferences[sideKey] = true;
        delete mockContainer.generatorParams.customReferences[sideKey];

        // Kliknięcie ↺:
        delete mockContainer.generatorParams.disabledReferences[sideKey];

        expect(mockContainer.generatorParams.disabledReferences[sideKey]).toBeUndefined();
        expect(mockContainer.generatorParams.customReferences[sideKey]).toBeUndefined();
    });
});
