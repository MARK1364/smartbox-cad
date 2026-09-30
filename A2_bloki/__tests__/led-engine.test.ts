import { describe, it, expect } from 'vitest';
import { syncBlokiLedGrooves } from '../led-engine.js';
import { assertCanonicalLedInternalParams } from '../led-internal-engine.js';
import { assertCanonicalLedExternalParams } from '../led-external-engine.js';
import { buildLedPlan } from '../led-adapter.js';
import {
    BLOKI_INTERNAL_OPTIONS,
    BLOKI_EXTERNAL_OPTIONS,
    BLOKI_CATEGORY_NAMES
} from '../bloki-bay-actions.js';
import { MODULE_TYPES } from '../ui/BlokiFloatingWindow.js';

describe('Bloki LED Module (buildLedPlan & Categories)', () => {
    it('registers LED_EXTERNAL alongside PANELS in external category', () => {
        const extOpt = BLOKI_EXTERNAL_OPTIONS.find(o => o.id === 'LED_EXTERNAL');
        expect(extOpt).toBeDefined();
        expect(extOpt?.category).toBe('external');
        expect(extOpt?.type).toBe('blok_led_external');
        expect(MODULE_TYPES['LED_EXTERNAL']?.category).toBe('external');
        expect(BLOKI_CATEGORY_NAMES['LED_EXTERNAL']).toBe('blok_led_podszafkowy');
    });

    it('registers LED_INTERNAL alongside SHELVES/DIVIDERS in internal category', () => {
        const intOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'LED_INTERNAL');
        expect(intOpt).toBeDefined();
        expect(intOpt?.category).toBe('internal');
        expect(intOpt?.type).toBe('blok_led_internal');
        expect(MODULE_TYPES['LED_INTERNAL']?.category).toBe('internal');
        expect(BLOKI_CATEGORY_NAMES['LED_INTERNAL']).toBe('blok_led_szafowy');
    });

    it('odrzuca wycofane aliasy LED (fail-fast)', () => {
        expect(() => assertCanonicalLedExternalParams({ offsetFromFrontMm: 50 })).toThrow(/offsetFromFrontMm → odsuniecie_od_przodu_mm/);
        expect(() => assertCanonicalLedInternalParams({ variant: 'HORIZONTAL_TOP' })).toThrow(/variant → wariant_led/);
        expect(() => assertCanonicalLedInternalParams({ grooveWidthMm: 14 })).toThrow(/grooveWidthMm → szerokosc_wpustu_mm/);
    });

    it('generates 3D profile plan for LED_EXTERNAL (podszafkowy)', () => {
        const plan = buildLedPlan({
            boxType: 'LED_EXTERNAL',
            category: 'external',
            odsuniecie_od_przodu_mm: 50,
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9
        }, { width_mm: 800, height_mm: 720, depth_mm: 350 });

        expect(plan.parts.length).toBe(1);
        const bar = plan.parts[0];
        expect(bar.role).toBe('LED');
        expect(bar.report_type).toBe('akcesoria');
        expect(bar.library_id).toBe('LED_PROFILE_WPUSZCZANY');
        expect(bar.dim.x).toBe(800);
        expect(bar.dim.y).toBe(9);  // grubość we wpuście w dno (pion)
        expect(bar.dim.z).toBe(14); // szerokość profilu w głębokości
    });

    it('generates 3D profile plan for LED_INTERNAL (vertical both sides in wardrobe bay)', () => {
        const plan = buildLedPlan({
            boxType: 'LED_INTERNAL',
            category: 'internal',
            wariant_led: 'VERTICAL_BOTH_SIDES',
            odsuniecie_od_przodu_lewe_mm: 50,
            odsuniecie_od_przodu_prawe_mm: 150,
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9,
            odstep_gora_mm: 20,
            odstep_dol_mm: 20
        }, { width_mm: 600, height_mm: 2000, depth_mm: 550  });

        expect(plan.parts.length).toBe(2);
        const [leftStrip, rightStrip] = plan.parts;
        expect(leftStrip.name).toContain('Lewy');
        expect(rightStrip.name).toContain('Prawy');
        expect(leftStrip.role).toBe('LED');
        expect(rightStrip.role).toBe('LED');
        // Orientacja pionowa w scenie: dim.y odpowiada wysokości pionowej (pion)
        expect(leftStrip.dim.y).toBe(1960); // 2000 - 20 - 20 (pionowa wysokość)
        expect(rightStrip.dim.y).toBe(1960);
        expect(leftStrip.dim.x).toBe(9);   // głębokość wpustu (oś X w bok)
        expect(leftStrip.dim.z).toBe(14);  // szerokość profilu (oś Z w głębokości)
        expect(leftStrip.loc.z).toBe(1000); // zCenter = 20 + 1960/2
        // Lewy i prawy wchodzą w boki korpusu:
        expect(leftStrip.loc.x).toBe(-300 - 4.5); // lewy bok (-width/2 - grooveD/2)
        expect(rightStrip.loc.x).toBe(300 + 4.5); // prawy bok (width/2 + grooveD/2)
        // Środki Y pokrywają się ze środkiem wpustu:
        // depth=550 -> front is at -275
        // left: -275 + 50 + 7 = -218
        expect(leftStrip.loc.y).toBe(-218);
        // right: -275 + 150 + 7 = -118
        expect(rightStrip.loc.y).toBe(-118);
    });

    it('generates horizontal top LED profile for LED_INTERNAL when requested', () => {
        const plan = buildLedPlan({
            boxType: 'LED_INTERNAL',
            category: 'internal',
            wariant_led: 'HORIZONTAL_TOP',
            odsuniecie_od_przodu_mm: 50,
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9
        }, { width_mm: 600, height_mm: 800, depth_mm: 500  });

        expect(plan.parts.length).toBe(1);
        const topStrip = plan.parts[0];
        expect(topStrip.role).toBe('LED');
        expect(topStrip.dim.x).toBe(596); // width - 4
        expect(topStrip.dim.y).toBe(9);   // grubość / głębokość wpustu w osi pionowej
        expect(topStrip.dim.z).toBe(14);  // szerokość profilu w osi głębokości
        expect(topStrip.loc.y).toBe(-250 + 50 + 7); // -193
    });

    it('syncs vertical grooves on the inner side (FACE_Z_PLUS) for both left and right panels', () => {
        const leftPanel: any = {
            id: 'panel_left',
            width: 500_000_000,  // 500 mm depth
            height: 2000_000_000, // 2000 mm height
            features: []
        };
        const rightPanel: any = {
            id: 'panel_right',
            width: 500_000_000,  // 500 mm depth
            height: 2000_000_000, // 2000 mm height
            features: []
        };

        const docMock: any = {
            findNode: (id: string) => {
                if (id === 'panel_left') return { domainData: leftPanel };
                if (id === 'panel_right') return { domainData: rightPanel };
                return null;
            }
        };

        const containerMock: any = {
            id: 'sb_led_1',
            height: 2000_000_000,
            depth: 500_000_000,
            generatorParams: {
                boxType: 'LED_INTERNAL',
                category: 'internal',
                wariant_led: 'VERTICAL_BOTH_SIDES',
                odsuniecie_od_przodu_lewe_mm: 50,
                odsuniecie_od_przodu_prawe_mm: 150,
                szerokosc_wpustu_mm: 14,
                glebokosc_wpustu_mm: 9,
                odstep_gora_mm: 20,
                odstep_dol_mm: 20,
                customReferences: {
                    xMin: { panelId: 'panel_left' },
                    xMax: { panelId: 'panel_right' }
                }
            }
        };

        syncBlokiLedGrooves({ domainData: containerMock }, docMock);

        expect(leftPanel.features.length).toBe(1);
        expect(rightPanel.features.length).toBe(1);

        const leftFeat = leftPanel.features[0];
        const rightFeat = rightPanel.features[0];

        // OBA wpusty muszą być na wewnętrznym licu (FACE_Z_PLUS)
        expect(leftFeat.face).toBe('FACE_Z_PLUS');
        expect(rightFeat.face).toBe('FACE_Z_PLUS');

        // Orientacja pionowa wpustu:
        // length = 1960 mm (wysokość pionowa V)
        // width = 14 mm (szerokość frezu U w głębokości)
        // v = 20 mm (od dołu)
        expect(leftFeat.params.length).toBe(1960);
        expect(leftFeat.params.width).toBe(14);
        expect(leftFeat.params.v).toBe(20);
        expect(leftFeat.params.u).toBe(500 - 50 - 14); // 436 mm od tyłu (50 mm od frontu)

        expect(rightFeat.params.length).toBe(1960);
        expect(rightFeat.params.width).toBe(14);
        expect(rightFeat.params.v).toBe(20);
        expect(rightFeat.params.u).toBe(150); // 150 mm od frontu — niesymetrycznie!
    });

    it('handles independent default left offset 50 mm and right offset 150 mm without symmetry collapse', () => {
        const plan = buildLedPlan({
            boxType: 'LED_INTERNAL',
            category: 'internal',
            wariant_led: 'VERTICAL_BOTH_SIDES',
            // Domyślne wartości z reguł bez podawania ręcznych
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9,
            odstep_gora_mm: 20,
            odstep_dol_mm: 20
        }, { width_mm: 600, height_mm: 2000, depth_mm: 500  });

        expect(plan.parts.length).toBe(2);
        const [leftStrip, rightStrip] = plan.parts;
        // depth=500 -> front is at -250
        // left: -250 + 50 + 7 = -193
        expect(leftStrip.loc.y).toBe(-193);
        // right: -250 + 150 + 7 = -93
        expect(rightStrip.loc.y).toBe(-93);

        // Kanały w formatek również niesymetryczne przy domyślnych parametrach
        const leftPanel: any = { id: 'p_l', width: 500_000_000, height: 2000_000_000, features: [] };
        const rightPanel: any = { id: 'p_r', width: 500_000_000, height: 2000_000_000, features: [] };
        const docMock: any = {
            findNode: (id: string) => {
                if (id === 'p_l') return { domainData: leftPanel };
                if (id === 'p_r') return { domainData: rightPanel };
                return null;
            }
        };
        const sbNode: any = {
            domainData: {
                id: 'sb_test',
                height: 2000_000_000,
                depth: 500_000_000,
                generatorParams: {
                    boxType: 'LED_INTERNAL',
                    category: 'internal',
                    customReferences: { xMin: { panelId: 'p_l' }, xMax: { panelId: 'p_r' } }
                }
            }
        };
        syncBlokiLedGrooves(sbNode, docMock);
        expect(leftPanel.features[0].params.u).toBe(500 - 50 - 14); // 436 mm (50 mm od frontu)
        expect(rightPanel.features[0].params.u).toBe(150);          // 150 mm od frontu
    });

    it('generates vertical LED profile and groove on BACK panel with center offset 125 mm', () => {
        const plan = buildLedPlan({
            boxType: 'LED_INTERNAL',
            category: 'internal',
            wariant_led: 'VERTICAL_BACK',
            odsuniecie_tyl_od_srodka_mm: 125,
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9,
            odstep_gora_mm: 20,
            odstep_dol_mm: 20
        }, { width_mm: 600, height_mm: 2000, depth_mm: 500  });

        expect(plan.parts.length).toBe(1);
        const backStrip = plan.parts[0];
        expect(backStrip.name).toContain('Plecy');
        expect(backStrip.loc.x).toBe(125); // 125 mm od środka
        expect(backStrip.loc.y).toBe(250 + 4.5); // osadzony w tylnej ściance (depth/2 + grooveD/2)
        expect(backStrip.dim.x).toBe(14); // szerokość profilu w osi X
        expect(backStrip.dim.y).toBe(1960); // pionowy w osi pionowej (Y)
        expect(backStrip.dim.z).toBe(9);  // głębokość wpustu w osi Z (w plecy)

        // Test frezowania wpustu na plecach
        const backPanel: any = {
            id: 'panel_back',
            role: 'BACK_PANEL',
            width: 600_000_000,  // 600 mm width
            height: 2000_000_000, // 2000 mm height
            features: []
        };

        const docMock: any = {
            findNode: (id: string) => {
                if (id === 'panel_back') return { domainData: backPanel };
                return null;
            },
            getPanels: () => [{ domainData: backPanel }]
        };

        const containerMock: any = {
            id: 'sb_led_back_1',
            height: 2000_000_000,
            depth: 500_000_000,
            width: 600_000_000,
            generatorParams: {
                boxType: 'LED_INTERNAL',
                category: 'internal',
                wariant_led: 'VERTICAL_BACK',
                odsuniecie_tyl_od_srodka_mm: 125,
                szerokosc_wpustu_mm: 14,
                glebokosc_wpustu_mm: 9,
                odstep_gora_mm: 20,
                odstep_dol_mm: 20,
                customReferences: {
                    yMax: { panelId: 'panel_back' }
                }
            }
        };

        syncBlokiLedGrooves({ domainData: containerMock }, docMock);

        expect(backPanel.features.length).toBe(1);
        const feat = backPanel.features[0];
        expect(feat.face).toBe('FACE_Z_PLUS');
        expect(feat.params.length).toBe(1960);
        expect(feat.params.width).toBe(14);
        expect(feat.params.v).toBe(20);
        // u = 600/2 + 125 - 14/2 = 300 + 125 - 7 = 418
        expect(feat.params.u).toBe(418);
    });
});
