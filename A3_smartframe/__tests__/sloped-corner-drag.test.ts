import { describe, it, expect } from 'vitest';
import { applyRealtimeUpdate } from '../smartframe-adapter.js';
import { nmToMm, mmToNm } from '../../A1_core/cad-math/units.js';

describe('Sloped Cabinet Corner Drag & Realtime Sync', () => {
    it('updates wysokosc_lewy_mm and adjusts container height when dragging top-left corner', () => {
        const container = {
            id: 'test_korpus_skosny_lr',
            type: 'container',
            width: mmToNm(800),
            height: mmToNm(2200),
            depth: mmToNm(560),
            generatorParams: {
                typ_korpusu: 'korpus_skosny_lr',
                szerokosc_mm: 800,
                wysokosc_mm: 2200,
                glebokosc_mm: 560,
                wysokosc_lewy_mm: 1200,
                wysokosc_prawy_mm: 2200,
            } as any
        };

        const doc = {
            activeEntity: container,
            findNode: (id: string) => ({ id, domainData: container }),
            getGlcNode: () => null,
            notifyDocumentChanged: () => {}
        };

        // Dragging top-left corner down from 1200 to 900
        const newLeftH = 900;
        const newRightH = 2200;
        const newMaxH = Math.max(newLeftH, newRightH);

        applyRealtimeUpdate(doc, {
            szerokosc_mm: 800,
            wysokosc_mm: newMaxH,
            glebokosc_mm: 560,
            wysokosc_lewy_mm: newLeftH,
            wysokosc_prawy_mm: newRightH,
        }, container);

        expect(container.generatorParams.wysokosc_lewy_mm).toBe(900);
        expect(container.generatorParams.wysokosc_prawy_mm).toBe(2200);
        expect(nmToMm(container.height)).toBe(2200);
    });

    it('updates wysokosc_prawy_mm and recalculates container height when right side is raised above left side', () => {
        const container = {
            id: 'test_korpus_skosny_lr_2',
            type: 'container',
            width: mmToNm(800),
            height: mmToNm(1800),
            depth: mmToNm(560),
            generatorParams: {
                typ_korpusu: 'korpus_skosny_lr_uc',
                szerokosc_mm: 800,
                wysokosc_mm: 1800,
                glebokosc_mm: 560,
                wysokosc_lewy_mm: 1200,
                wysokosc_prawy_mm: 1800,
            } as any
        };

        const doc = {
            activeEntity: container,
            findNode: (id: string) => ({ id, domainData: container }),
            getGlcNode: () => null,
            notifyDocumentChanged: () => {}
        };

        // Dragging top-right corner up from 1800 to 2400
        const newLeftH = 1200;
        const newRightH = 2400;
        const newMaxH = Math.max(newLeftH, newRightH);

        applyRealtimeUpdate(doc, {
            szerokosc_mm: 800,
            wysokosc_mm: newMaxH,
            glebokosc_mm: 560,
            wysokosc_lewy_mm: newLeftH,
            wysokosc_prawy_mm: newRightH,
        }, container);

        expect(container.generatorParams.wysokosc_lewy_mm).toBe(1200);
        expect(container.generatorParams.wysokosc_prawy_mm).toBe(2400);
        expect(nmToMm(container.height)).toBe(2400);
    });

    it('updates front and back heights for korpus_skosny_dach', () => {
        const container = {
            id: 'test_korpus_skosny_dach',
            type: 'container',
            width: mmToNm(600),
            height: mmToNm(2000),
            depth: mmToNm(600),
            generatorParams: {
                typ_korpusu: 'korpus_skosny_dach',
                szerokosc_mm: 600,
                wysokosc_mm: 2000,
                glebokosc_mm: 600,
                wysokosc_przod_mm: 2000,
                wysokosc_tyl_mm: 1400,
            } as any
        };

        const doc = {
            activeEntity: container,
            findNode: (id: string) => ({ id, domainData: container }),
            getGlcNode: () => null,
            notifyDocumentChanged: () => {}
        };

        // Dragging top-back corner down from 1400 to 1100
        const newFrontH = 2000;
        const newBackH = 1100;
        const newMaxH = Math.max(newFrontH, newBackH);

        applyRealtimeUpdate(doc, {
            szerokosc_mm: 600,
            wysokosc_mm: newMaxH,
            glebokosc_mm: 600,
            wysokosc_przod_mm: newFrontH,
            wysokosc_tyl_mm: newBackH,
        }, container);

        expect(container.generatorParams.wysokosc_przod_mm).toBe(2000);
        expect(container.generatorParams.wysokosc_tyl_mm).toBe(1100);
        expect(nmToMm(container.height)).toBe(2000);
    });
});

