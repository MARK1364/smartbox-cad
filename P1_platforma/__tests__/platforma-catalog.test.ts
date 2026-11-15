import { describe, it, expect } from 'vitest';
import { INITIAL_FURNITURE_CATALOG } from '../sample-furniture-catalog.js';
import { templateToCatalogItem, catalogItemToTemplate, sendFurnitureToCrevoScene } from '../platforma-store.js';
import type { CabinetTemplate } from '../../B1_biblioteka/korpusy/types.js';

describe('P1_platforma — Katalog modeli mebli', () => {
    it('katalog zawiera zdefiniowane modele mebli z unikalnymi kodami', () => {
        expect(INITIAL_FURNITURE_CATALOG.length).toBeGreaterThanOrEqual(10);
        const codes = INITIAL_FURNITURE_CATALOG.map((item) => item.code);
        const uniqueCodes = new Set(codes);
        expect(uniqueCodes.size).toBe(codes.length);
    });

    it('każdy mebel posiada dodatnie wymiary mm i przypisaną kategorię', () => {
        for (const item of INITIAL_FURNITURE_CATALOG) {
            expect(item.id).toBeTruthy();
            expect(item.name).toBeTruthy();
            expect(item.category).toBeTruthy();
            expect(item.dimensions.width_mm).toBeGreaterThan(0);
            expect(item.dimensions.height_mm).toBeGreaterThan(0);
            expect(item.dimensions.depth_mm).toBeGreaterThan(0);
            expect(item.projectConfig.typ_korpusu).toBeTruthy();
        }
    });

    it('filtrowanie po kategorii DOLNE zwraca wyłącznie szafki dolne', () => {
        const dolne = INITIAL_FURNITURE_CATALOG.filter((item) => item.category === 'DOLNE');
        expect(dolne.length).toBeGreaterThan(0);
        for (const item of dolne) {
            expect(item.category).toBe('DOLNE');
        }
    });

    it('wyszukiwanie po frazie "szuflad" znajduje meble z szufladami', () => {
        const query = 'szuflad';
        const matches = INITIAL_FURNITURE_CATALOG.filter((item) => {
            const q = query.toLowerCase();
            return (
                item.name.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q) ||
                item.tags.some((t) => t.toLowerCase().includes(q))
            );
        });
        expect(matches.length).toBeGreaterThan(0);
        expect(matches.some((m) => m.code === 'KD-3SZ')).toBe(true);
    });

    it('templateToCatalogItem poprawnie konwertuje CabinetTemplate na FurnitureCatalogItem', () => {
        const template: CabinetTemplate = {
            id: 'tmpl_test_1',
            name: 'Moja Szafka z szufladami',
            category: 'dolne',
            units: 'mm',
            description: 'Testowy korpus',
            dimensions: { szerokosc_mm: 600, wysokosc_mm: 820, glebokosc_mm: 560 },
            frameParams: { liczba_stref: 1 },
            submodules: [
                { type: 'blok_drawers', boxType: 'DRAWERS', params: { drawerCount: 3 } }
            ]
        };

        const item = templateToCatalogItem(template);
        expect(item.id).toBe('tmpl_test_1');
        expect(item.name).toBe('Moja Szafka z szufladami');
        expect(item.category).toBe('DOLNE');
        expect(item.dimensions.width_mm).toBe(600);
        expect(item.dimensions.height_mm).toBe(820);
        expect(item.dimensions.depth_mm).toBe(560);
        expect(item.drawerCount).toBe(3);
    });

    it('catalogItemToTemplate poprawnie konwertuje FurnitureCatalogItem na CabinetTemplate', () => {
        const item = INITIAL_FURNITURE_CATALOG[0]; // KD-600-3SZ
        const template = catalogItemToTemplate(item);
        expect(template.id).toBe(item.id);
        expect(template.name).toBe(item.name);
        expect(template.category).toBe('dolne');
        expect(template.dimensions.szerokosc_mm).toBe(600);
        expect(template.dimensions.wysokosc_mm).toBe(820);
        expect(template.dimensions.glebokosc_mm).toBe(560);
        expect(template.submodules.length).toBeGreaterThan(0);
        expect(template.submodules[0].type).toBe('blok_drawers');
    });

    it('sendFurnitureToCrevoScene zapisuje zlecenie wstawienia w localStorage', () => {
        const item = INITIAL_FURNITURE_CATALOG[0];
        const res = sendFurnitureToCrevoScene(item);
        expect(res).toBe(true);
        const stored = localStorage.getItem('crevo_import_to_scene');
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!);
        expect(parsed.action).toBe('insert_cabinet');
        expect(parsed.template.id).toBe(item.id);
    });
});
