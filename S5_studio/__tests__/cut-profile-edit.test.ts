import { describe, it, expect } from 'vitest';
import {
    resolveCutProfileLoop2D,
    ensureCutProfile,
    pocketBoxDimsCad,
    type SmartPartPocketCut,
} from '../smartpart-studio-types.js';

describe('Edycja wymiarów wcięcia prostokątnego (Studio cut profile editing)', () => {
    it('edycja widthMm i heightMm w inpucie natychmiast aktualizuje pętlę 2D i wymiary bryły CAD', () => {
        const cut: SmartPartPocketCut = {
            id: 'pocket_test',
            name: 'Wcięcie testowe',
            type: 'POCKET',
            widthMm: 16,
            heightMm: 32,
            depthMm: 20,
            xMm: 0,
            yMm: 0,
            zMm: 0,
            axis: 'Y',
            direction: -1,
            profile: {
                type: 'RECT',
                widthMm: 16,
                heightMm: 32,
            },
        };

        // 1. Początkowa pętla 2D: szerokość 16, wysokość 32
        const initialLoop = resolveCutProfileLoop2D(cut);
        expect(initialLoop).toEqual([
            [-8, -16],
            [8, -16],
            [8, 16],
            [-8, 16],
        ]);

        // 2. Symulacja edycji w inputach Studio: użytkownik zmienia szerokość na 50 mm i wysokość na 80 mm
        const updatedCut: SmartPartPocketCut = {
            ...cut,
            widthMm: 50,
            heightMm: 80,
        };

        const syncedProfile = ensureCutProfile(updatedCut);
        expect(syncedProfile.widthMm).toBe(50);
        expect(syncedProfile.heightMm).toBe(80);

        const newLoop = resolveCutProfileLoop2D(updatedCut);
        expect(newLoop).toEqual([
            [-25, -40],
            [25, -40],
            [25, 40],
            [-25, 40],
        ]);

        const boxDims = pocketBoxDimsCad(updatedCut);
        expect(boxDims).toEqual({
            xMm: 50,
            yMm: 20,
            zMm: 80,
        });
    });

    it('poprawnie wylicza zaokrąglenie naroży przy edycji cornerRadiusMm', () => {
        const cut: SmartPartPocketCut = {
            id: 'pocket_rounded',
            name: 'Wcięcie zaokrąglone',
            type: 'POCKET',
            widthMm: 40,
            heightMm: 40,
            depthMm: 15,
            xMm: 0,
            yMm: 0,
            zMm: 0,
            axis: 'Y',
            direction: -1,
            cornerRadiusMm: 5,
        };

        const loop = resolveCutProfileLoop2D(cut);
        expect(loop.length).toBeGreaterThan(4); // Pętla z łukami naroży
        expect(loop[0][0]).toBeCloseTo(20, 1);
    });
});
