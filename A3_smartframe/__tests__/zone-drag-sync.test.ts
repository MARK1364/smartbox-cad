import { describe, it, expect } from 'vitest';
import { applyRealtimeUpdate } from '../smartframe-adapter.js';

describe('test zone drag', () => {
    it('updates generatorParams on zone update when liczba_stref is 3', () => {
        const container = {
            id: 'test_korpus_1',
            type: 'container',
            width: 600 * 1_000_000,
            height: 2200 * 1_000_000,
            depth: 560 * 1_000_000,
            generatorParams: {
                type: 'korpus3',
                szerokosc_mm: 600,
                wysokosc_mm: 2200,
                glebokosc_mm: 560,
                liczba_stref: 3,
                wysokosc_strefy_dolnej_mm: 500,
                wysokosc_strefy_srodkowej_mm: 1200
            }
        };

        const doc = {
            activeEntity: container,
            findNode: (id: string) => ({ id, domainData: container }),
            getGlcNode: () => null,
            notifyDocumentChanged: () => { console.log('doc.notifyDocumentChanged called!'); }
        };

        const zoneCount = 3;
        const newBottomH = 650;
        const newMiddleH = 1050;

        applyRealtimeUpdate(doc, {
            szerokosc_mm: 600,
            wysokosc_mm: 2200,
            glebokosc_mm: 560,
            liczba_stref: zoneCount,
            wysokosc_strefy_dolnej_mm: newBottomH,
            wysokosc_strefy_srodkowej_mm: newMiddleH,
        }, container);

        expect(container.generatorParams.wysokosc_strefy_dolnej_mm).toBe(650);
        expect(container.generatorParams.wysokosc_strefy_srodkowej_mm).toBe(1050);
    });

    it('test when generatorParams has no liczba_stref initially (default korpus3 preset)', () => {
        const container = {
            id: 'test_korpus_2',
            type: 'container',
            width: 600 * 1_000_000,
            height: 2200 * 1_000_000,
            depth: 560 * 1_000_000,
            generatorParams: {
                type: 'korpus3',
                szerokosc_mm: 600,
                wysokosc_mm: 2200,
                glebokosc_mm: 560,
            } as any
        };

        const doc = {
            activeEntity: container,
            findNode: (id: string) => ({ id, domainData: container }),
            getGlcNode: () => null,
            notifyDocumentChanged: () => { console.log('doc.notifyDocumentChanged called!'); }
        };

        // In gizmo-controller:
        const gp = container.generatorParams;
        const t = String(gp.type || gp.typ_korpusu || '').toLowerCase();
        const isCorner = t.includes('rogowy');
        const isSkosny = t.includes('skosny');
        const defaultZones: 1 | 2 | 3 = (isCorner || isSkosny) ? 1 : 3;
        const zoneCount: 1 | 2 | 3 = Number(gp.liczba_stref ?? (gp.typ_podzialu === 'POZIOMY_2_STREFY' ? 2 : gp.typ_podzialu === 'POZIOMY_3_STREFY' ? 3 : defaultZones)) as 1 | 2 | 3;
        expect(zoneCount).toBe(3);

        const newBottomH = 650;
        const newMiddleH = 1050;

        applyRealtimeUpdate(doc, {
            szerokosc_mm: 600,
            wysokosc_mm: 2200,
            glebokosc_mm: 560,
            liczba_stref: zoneCount,
            wysokosc_strefy_dolnej_mm: newBottomH,
            wysokosc_strefy_srodkowej_mm: newMiddleH,
        }, container);

        expect(container.generatorParams.wysokosc_strefy_dolnej_mm).toBe(650);
        expect(container.generatorParams.wysokosc_strefy_srodkowej_mm).toBe(1050);
    });
});
