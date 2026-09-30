import { describe, it, expect, vi } from 'vitest';
import { syncBlokiLedExternalGrooves, assertCanonicalLedExternalParams } from '../led-external-engine.js';
import { buildLedExternalPlan } from '../led-external-adapter.js';
import { BLOKI_EXTERNAL_OPTIONS, BLOKI_CATEGORY_NAMES } from '../bloki-bay-actions.js';
import { MODULE_TYPES } from '../ui/BlokiFloatingWindow.js';
import * as LedChannelEngine from '../../A5_smartparts/led/led-channel-engine.js';

describe('Bloki LED External Module (buildLedExternalPlan)', () => {
    it('registers LED_EXTERNAL in external category', () => {
        const extOpt = BLOKI_EXTERNAL_OPTIONS.find(o => o.id === 'LED_EXTERNAL');
        expect(extOpt).toBeDefined();
        expect(extOpt?.category).toBe('external');
        expect(extOpt?.type).toBe('blok_led_external');
        expect(MODULE_TYPES['LED_EXTERNAL']?.category).toBe('external');
        expect(BLOKI_CATEGORY_NAMES['LED_EXTERNAL']).toBe('blok_led_podszafkowy');
    });

    it('odrzuca wycofane aliasy (fail-fast)', () => {
        expect(() => assertCanonicalLedExternalParams({ offsetFromFrontMm: 50 })).toThrow(/offsetFromFrontMm → odsuniecie_od_przodu_mm/);
        expect(() => assertCanonicalLedExternalParams({ cutSides: true })).toThrow(/cutSides → frezuj_boki/);
        expect(() => assertCanonicalLedExternalParams({ odsuniecie_od_przodu_mm: 50 })).not.toThrow();
    });

    it('generates 3D profile plan for under-cabinet LED bar', () => {
        const plan = buildLedExternalPlan({
            odsuniecie_od_przodu_mm: 50,
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9
        }, { width_mm: 800, height_mm: 720, depth_mm: 350  });

        expect(plan.parts.length).toBe(1);
        const [profile] = plan.parts;

        expect(profile.role).toBe('LED');
        expect(profile.report_type).toBe('akcesoria');
        expect(profile.library_id).toBe('LED_PROFILE_WPUSZCZANY');
        expect(profile.name).toBe('Profil_LED_Wpuszczany');

        // Orientacja pozioma na spodzie korpusu:
        expect(profile.dim.x).toBe(800);
        expect(profile.dim.y).toBe(9);  // grubość we wpuście w dno (pion)
        expect(profile.dim.z).toBe(14); // szerokość profilu w głębokości

        // Położenie:
        // depth=350 -> front is at -175
        // y: -175 + 50 + 7 = -118
        expect(profile.loc.x).toBe(0);
        expect(profile.loc.y).toBe(-118);
        expect(profile.loc.z).toBe(4.5); // grooveD / 2
    });

    it('supports custom offsets and dimensions in buildLedExternalPlan', () => {
        const plan = buildLedExternalPlan({
            odsuniecie_od_przodu_mm: 70,
            szerokosc_wpustu_mm: 18,
            glebokosc_wpustu_mm: 12
        }, { width_mm: 900, height_mm: 720, depth_mm: 400 });

        expect(plan.parts.length).toBe(1);
        const profile = plan.parts[0];
        expect(profile.dim.x).toBe(900);
        expect(profile.dim.y).toBe(12);
        expect(profile.dim.z).toBe(18);

        // depth=400 -> front is at -200
        // y: -200 + 70 + 9 = -121
        expect(profile.loc.y).toBe(-121);
        expect(profile.loc.z).toBe(6);
    });

    it('syncBlokiLedExternalGrooves delegates groove creation to applyLedChannelToDocument', () => {
        const spy = vi.spyOn(LedChannelEngine, 'applyLedChannelToDocument').mockImplementation(() => 0);

        const docMock: any = {};
        const containerNode: any = {
            domainData: {
                id: 'sb_ext_led_1',
                name: 'Podszafkowy LED',
                generatorParams: {
                    odsuniecie_od_przodu_mm: 45,
                    szerokosc_wpustu_mm: 15,
                    glebokosc_wpustu_mm: 8,
                    frezuj_boki: true,
                    customReferences: {
                        zMin: { panelId: 'bottom_p', face: 'FACE_Z_MINUS', partKey: 'dno' },
                        xMin: { panelId: 'left_p', face: 'FACE_Z_MINUS', partKey: 'bok_l' },
                        xMax: { panelId: 'right_p', face: 'FACE_Z_PLUS', partKey: 'bok_r' }
                    }
                }
            }
        };

        syncBlokiLedExternalGrooves(containerNode, docMock);

        expect(spy).toHaveBeenCalledTimes(1);
        const [calledDoc, calledDef] = spy.mock.calls[0];
        expect(calledDoc).toBe(docMock);
        expect(calledDef.id).toBe('sb_ext_led_1');
        // A5 LedChannelDefinition API — English keys are intentional
        expect(calledDef.offsetFromFrontMm).toBe(45);
        expect(calledDef.grooveWidthMm).toBe(15);
        expect(calledDef.grooveDepthMm).toBe(8);
        expect(calledDef.cutSides).toBe(true);
        expect(calledDef.scope).toBe('row');
        expect(calledDef.refBottom?.nodeId).toBe('bottom_p');
        expect(calledDef.refLeft?.nodeId).toBe('left_p');
        expect(calledDef.refRight?.nodeId).toBe('right_p');

        spy.mockRestore();
    });
});
