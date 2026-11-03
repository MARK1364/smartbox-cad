import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { applyRealtimeUpdate } from '../smartframe-adapter.js';

describe('applyRealtimeUpdate - zachowywanie offsetów gizm', () => {
    it('nie kasuje istniejących offsetów (np. przesunięcia wieńca shiftZ), gdy UI aktualizuje tylko gabaryty (wysokość)', () => {
        const doc = new ProjectDocument({ name: 'Test Document' });
        const container = new ContainerModel({
            width: mmToNm(1000),
            height: mmToNm(2200),
            depth: mmToNm(550),
            name: 'Korpus 1'
        });

        // Symulacja przesunięcia wieńca dolnego gizmem (Wieniec_D_shiftZ = -564)
        container.generatorParams = {
            typ_korpusu: 'korpus3',
            szerokosc_mm: 1000,
            wysokosc_mm: 2200,
            glebokosc_mm: 550,
            liczba_stref: 1,
            offsets: {
                'Wieniec_D_shiftZ': -564,
                'Wieniec_G_+Y': 20
            }
        };

        // Użytkownik zmienia wysokość w okienku UI z 2200 na 750 mm:
        // Formularz przesyła tylko wymiary gabarytowe (offsets === undefined)
        applyRealtimeUpdate(doc, {
            szerokosc_mm: 1000,
            wysokosc_mm: 750,
            glebokosc_mm: 550
        }, container);

        // Weryfikacja: offsety gizm NIE zostały skasowane!
        expect(container.generatorParams.offsets).toBeDefined();
        expect(container.generatorParams.offsets['Wieniec_D_shiftZ']).toBe(-564);
        expect(container.generatorParams.offsets['Wieniec_G_+Y']).toBe(20);
        expect(container.generatorParams.wysokosc_mm).toBe(750);
    });

    it('planCabinet uwzględnia offsety formatek o nazwach z deduplikacji (np. Bok_L.001_+Y, Bok_L.001_shiftX)', async () => {
        const { planCabinet } = await import('../smartframe-engine.js');
        const plan = planCabinet({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 500,
            typ_korpusu: 'korpus3',
            offsets: {
                'Bok_L.001_+Y': 35,
                'Bok_L.001_shiftX': 15
            }
        });
        const bokL = plan.parts.find(p => p.role === 'LEFT_SIDE_PANEL')!;
        expect(bokL).toBeDefined();
        // Wysokość formatki bazowo 720 mm + 35 mm z offsetu = 755 mm
        expect(bokL.dim.x).toBe(720 + 35);
        // Przesunięcie w osi X: bazowo -300 + 9 = -291, z shiftX (15): -291 - 15 = -306
        expect(bokL.loc.x).toBe(-600 / 2 + 18 / 2 - 15);
    });
});

