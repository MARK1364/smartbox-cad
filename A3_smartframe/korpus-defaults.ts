/**
 * Domyślne wymiary korpusu — wyłącznie z JSON (metry → mm na granicy UI).
 * Każdy typ ma własne defaults; create/drag nie dziedziczy gabarytu z aktywnego korpusu.
 *
 * Wyjście jest KANONICZNE (klucze *_mm) — zgodne z CabinetPlanParams.
 * Zero aliasów camelCase; klucze JSON (parameters.defaults) pozostają w swoim dialekcie.
 */

import korpus3Rules from './korpus3_3_rules.json';
import korpusRogowy1Rules from './korpus_rogowy1_rules.json';
import korpusRogowy90Rules from './korpus_rogowy90_rules.json';
import korpusSkosnyRules from './korpus_skosny_rules.json';
import { rulesMToMm } from '../A1_core/cad-math/units.js';
import type { CabinetType } from './smartframe-types.js';

export type KorpusDefaultsCabinetType = CabinetType;

/** Kanoniczny DTO defaultów korpusu [mm] — podzbiór CabinetPlanParams. */
export interface KorpusDefaultsMm {
    szerokosc_mm: number;
    wysokosc_mm: number;
    glebokosc_mm: number;
    liczba_stref: 1 | 2 | 3;
    wysokosc_strefy_dolnej_mm: number;
    wysokosc_strefy_srodkowej_mm: number;
    /** Szerokość blendy [mm] — tylko korpus_rogowy1. */
    szerokosc_blendy_mm?: number;
    strona_blendy?: 'LEFT' | 'RIGHT';
    /** Głębokości ramion [mm] — tylko korpus_rogowy90. */
    glebokosc_boku_lewego_mm?: number;
    glebokosc_boku_prawego_mm?: number;
    /** Wysokości skosu [mm] — korpus_skosny / korpus_skosny_lr. */
    wysokosc_przod_mm?: number;
    wysokosc_tyl_mm?: number;
    wysokosc_lewy_mm?: number;
    wysokosc_prawy_mm?: number;
}

function rulesForType(type: KorpusDefaultsCabinetType): any {
    if (type === 'korpus_skosny' || type === 'korpus_skosny_dach' || type === 'korpus_skosny_lr' || type === 'korpus_skosny_lr_uc') return korpusSkosnyRules;
    if (type === 'korpus_rogowy90') return korpusRogowy90Rules;
    if (type === 'korpus_rogowy1') return korpusRogowy1Rules;
    return korpus3Rules;
}

/** Bazowe defaulty gabarytu z reguł typu `korpus3`. */
export function korpusDefaultDimsMm(rules: any = korpus3Rules): KorpusDefaultsMm {
    const d = rules?.parameters?.defaults || {};
    return {
        szerokosc_mm: rulesMToMm(d.width, 1000),
        wysokosc_mm: rulesMToMm(d.height, 2200),
        glebokosc_mm: rulesMToMm(d.depth, 600),
        liczba_stref: 3,
        wysokosc_strefy_dolnej_mm: rulesMToMm(d.bottom_height, 500),
        wysokosc_strefy_srodkowej_mm: rulesMToMm(d.middle_height, 1200)
    };
}

export function korpusDefaultsForTypeMm(type: KorpusDefaultsCabinetType): KorpusDefaultsMm {
    const rules = rulesForType(type);
    const d = rules?.parameters?.defaults || {};
    const base = korpusDefaultDimsMm(rules);

    if (type === 'korpus_rogowy1') {
        return {
            ...base,
            liczba_stref: 1,
            wysokosc_strefy_dolnej_mm: base.wysokosc_mm,
            wysokosc_strefy_srodkowej_mm: 0,
            szerokosc_blendy_mm: rulesMToMm(d.blind_width, 400),
            strona_blendy: String(d.blind_side || 'LEFT').toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT'
        };
    }

    if (type === 'korpus_rogowy90') {
        const fallback = rulesMToMm(d.arm_depth, 600);
        return {
            ...base,
            liczba_stref: 1,
            wysokosc_strefy_dolnej_mm: base.wysokosc_mm,
            wysokosc_strefy_srodkowej_mm: 0,
            glebokosc_boku_lewego_mm: rulesMToMm(d.bok_lewy ?? d.arm_depth_x ?? d.arm_depth, fallback),
            glebokosc_boku_prawego_mm: rulesMToMm(d.bok_prawy ?? d.arm_depth_y ?? d.arm_depth, fallback)
        };
    }

    if (type === 'korpus_skosny' || type === 'korpus_skosny_dach') {
        const front = rulesMToMm(d.height_front, 1000);
        const back = rulesMToMm(d.height_back, 2200);
        return {
            ...base,
            liczba_stref: 1,
            wysokosc_mm: Math.max(front, back),
            wysokosc_strefy_dolnej_mm: Math.max(front, back),
            wysokosc_strefy_srodkowej_mm: 0,
            wysokosc_przod_mm: front,
            wysokosc_tyl_mm: back
        };
    }

    if (type === 'korpus_skosny_lr' || type === 'korpus_skosny_lr_uc') {
        const left = rulesMToMm(d.height_left, 1000);
        const right = rulesMToMm(d.height_right, 2200);
        return {
            ...base,
            liczba_stref: 1,
            wysokosc_mm: Math.max(left, right),
            wysokosc_strefy_dolnej_mm: Math.max(left, right),
            wysokosc_strefy_srodkowej_mm: 0,
            wysokosc_lewy_mm: left,
            wysokosc_prawy_mm: right
        };
    }

    return { ...base, liczba_stref: 3 };
}
