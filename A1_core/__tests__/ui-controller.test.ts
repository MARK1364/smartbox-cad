import { describe, it, expect, vi } from 'vitest';
import { ProjectDocument } from '../project-document';
import { UIController } from '../ui-controller';

describe('UIController state subscriptions', () => {
    it('powiadamia wielu subskrybentów instancji i globalnych bez nadpisywania onStateChange', () => {
        const globalListener = vi.fn();
        const unsubGlobal = UIController.subscribe(globalListener);

        const doc = new ProjectDocument();
        const ui = new UIController(doc);
        expect(globalListener).toHaveBeenCalledTimes(1);

        const listenerA = vi.fn();
        const listenerB = vi.fn();
        const legacyCallback = vi.fn();

        ui.onStateChange = legacyCallback;
        const unsubA = ui.subscribe(listenerA);
        const unsubB = ui.subscribe(listenerB);

        const prevStateRef = ui.state;
        ui.setStatus('Testowy komunikat', true, 'warning');

        expect(ui.state).not.toBe(prevStateRef);
        expect(ui.state.statusText).toBe('Testowy komunikat');
        expect(ui.state.statusBarActive).toBe(true);
        expect(ui.state.statusKind).toBe('warning');

        expect(legacyCallback).toHaveBeenCalledTimes(1);
        expect(listenerA).toHaveBeenCalledTimes(1);
        expect(listenerB).toHaveBeenCalledTimes(1);
        expect(globalListener).toHaveBeenCalledTimes(2);

        // Powtórne ustawienie identycznego statusu nie powinno wyzwalać powiadomienia
        ui.setStatus('Testowy komunikat', true, 'warning');
        expect(listenerA).toHaveBeenCalledTimes(1);

        // Identyczne współrzędne UV nie wyzwalają powiadomienia
        ui.updateCursorCoords({ u: 12.34, v: 56.78 });
        expect(listenerA).toHaveBeenCalledTimes(2);
        ui.updateCursorCoords({ u: 12.31, v: 56.79 }); // po zaokrągleniu do 1 miejsca: 12.3 i 56.8
        expect(listenerA).toHaveBeenCalledTimes(2);

        unsubA();
        ui.setStatus('Nowy stan');
        expect(listenerA).toHaveBeenCalledTimes(2);
        expect(listenerB).toHaveBeenCalledTimes(3);

        unsubB();
        unsubGlobal();
    });
});

