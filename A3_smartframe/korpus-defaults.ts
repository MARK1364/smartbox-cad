/**
 * Domyślne wymiary korpusu — wyłącznie z JSON (metry → mm na granicy UI).
 */

import korpusRules from './korpus3_3_rules.json';
import { rulesMToMm } from '../A1_core/cad-math/units.js';

export function korpusDefaultDimsMm(rules: any = korpusRules) {
    const d = rules?.parameters?.defaults || {};
    return {
        width: rulesMToMm(d.width, 1000),
        height: rulesMToMm(d.height, 2200),
        depth: rulesMToMm(d.depth, 600),
        bottomHeight: rulesMToMm(d.bottom_height, 500),
        middleHeight: rulesMToMm(d.middle_height, 1200),
        zoneCount: 3 as 1 | 2 | 3
    };
}
