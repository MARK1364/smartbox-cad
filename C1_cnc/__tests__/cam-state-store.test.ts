import { describe, expect, it, vi } from 'vitest';
import { CAMStateStore } from '../core/cam-state-store.js';

describe('C1_CNC: CAMStateStore', () => {
    it('setProgramsAndActiveProgram publikuje jeden spójny stan', () => {
        const store = CAMStateStore.getInstance();
        store.setProgramsAndActiveProgram([], null);

        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        try {
            store.setProgramsAndActiveProgram(
                [{ id: 'p1' } as any, { id: 'p2' } as any],
                'p2'
            );

            // Jedno powiadomienie: nowa lista i nowe aktywne ID jednocześnie.
            expect(listener).toHaveBeenCalledTimes(1);

            const state = listener.mock.calls[0][0];
            expect(state.programs.map((p: any) => p.id)).toEqual(['p1', 'p2']);
            expect(state.activeProgramId).toBe('p2');
            expect(store.getState().activeProgramId).toBe('p2');
        } finally {
            unsubscribe();
        }
    });
});
