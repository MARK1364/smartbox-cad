import { describe, expect, it, vi } from 'vitest';
import { applyProgramActivation } from '../ui/cnc-program-activation.js';

describe('C1_CNC: aktywacja programu', () => {
    it('łączy wcsName, cornerIndex i postprocessor w jedno wywołanie aktualizacji', () => {
        const updateProg = vi.fn();

        applyProgramActivation(updateProg, {
            id: 'prog_test',
            wcsName: 'G56',
            cornerIndex: 3,
            postprocessor: 'Biesse'
        });

        expect(updateProg).toHaveBeenCalledTimes(1);
        expect(updateProg).toHaveBeenCalledWith({
            wcsName: 'G56',
            cornerIndex: 3,
            postprocessor: 'Biesse'
        });
    });

    it('stosuje bezpieczne wartości domyślne i nie publikuje nic bez programu', () => {
        const updateProg = vi.fn();

        applyProgramActivation(updateProg, { id: 'prog_default' });
        expect(updateProg).toHaveBeenCalledTimes(1);
        expect(updateProg).toHaveBeenCalledWith({
            wcsName: 'G55',
            cornerIndex: -1,
            postprocessor: 'Mach3'
        });

        applyProgramActivation(updateProg, null);
        expect(updateProg).toHaveBeenCalledTimes(1);
    });
});
