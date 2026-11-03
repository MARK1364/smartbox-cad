import { describe, it } from 'vitest';
import { runNesting } from '../core/nesting-engine';
import { NestingPart, SheetConfig } from '../core/nesting-types';

describe('Nesting Quality Diagnostic', () => {
    const config: SheetConfig = {
        width: 2800,
        height: 2070,
        kerf: 4,
        trimMargin: 10
    };

    const partsThatFitOnOneBoard: NestingPart[] = [
        // Total area: 2 * 2.0 * 0.56 = 2.24 m2
        { id: '1', name: 'Bok szafy', width: 2000, height: 560, quantity: 2, thickness: 18, material: 'Biały', canRotate: true },
        // 4 * 0.764 * 0.56 = 1.71 m2
        { id: '2', name: 'Wieniec / Półka', width: 764, height: 560, quantity: 4, thickness: 18, material: 'Biały', canRotate: true },
        // 2 * 0.764 * 0.30 = 0.46 m2
        { id: '3', name: 'Półka wąska', width: 764, height: 300, quantity: 2, thickness: 18, material: 'Biały', canRotate: true },
    ];
    // Total area = 2.24 + 1.71 + 0.46 = 4.41 m2.
    // Sheet usable: (2800-20) x (2070-20) = 2780 x 2050 = 5.699 m2!
    // Geometric fit:
    // Can 2 boki (2000x560) fit?
    // In length 2780: 2000 + 764 = 2764 <= 2780!
    // In height 2050: 560 + 560 + 560 + 300 = 1980 <= 2050!
    // So 3 strips of 560mm (560+560+560 = 1680) + 1 strip of 300mm (1680+300 = 1980 <= 2050):
    // Strip 1 (560 high): Bok (2000) + Wieniec (764) = 2764 mm! (FITS in 2780!)
    // Strip 2 (560 high): Bok (2000) + Wieniec (764) = 2764 mm! (FITS in 2780!)
    // Strip 3 (560 high): Wieniec (764) + Wieniec (764) = 1528 mm! (FITS in 2780!)
    // Strip 4 (300 high): Półka (764) + Półka (764) = 1528 mm! (FITS in 2780!)
    // Total height = 560 + 560 + 560 + 300 = 1980 <= 2050!
    // ALL PARTS FIT ON 1 SINGLE BOARD!

    it('czy algorytm upakuje to na 1 płycie?', async () => {
        const sawFast = await runNesting(partsThatFitOnOneBoard, config, { machineType: 'saw', mode: 'fast' });
        const sawPro = await runNesting(partsThatFitOnOneBoard, config, { machineType: 'saw', mode: 'pro', iterations: 200 });
        const cncFast = await runNesting(partsThatFitOnOneBoard, config, { machineType: 'cnc', mode: 'fast' });
        const cncPro = await runNesting(partsThatFitOnOneBoard, config, { machineType: 'cnc', mode: 'pro', iterations: 200 });

        console.log(`SAW FAST boards: ${sawFast.totalBoardsCount}`);
        console.log(`SAW PRO boards: ${sawPro.totalBoardsCount}`);
        console.log(`CNC FAST boards: ${cncFast.totalBoardsCount}`);
        console.log(`CNC PRO boards: ${cncPro.totalBoardsCount}`);
    });
});
