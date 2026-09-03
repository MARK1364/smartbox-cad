/**
 * SmartPanel Web — C1_CNC WCS Rules Mapper
 * 
 * Odpowiada za odczyt reguł JSON bazy obróbczej (WCS) z korpus3_3_rules.json.
 */

import korpusRules from '../../A3_smartframe/korpus3_3_rules.json';

export interface WcsRule {
    origin_corner: { X: string, Y: string, Z: string };
    directions: { X: string, Y: string, Z: string };
    rotation: { X: number, Y: number, Z: number };
}

    /**
     * Indeks naroża 0..7 (jak NAROZNIKI / mesh vertices) → znaki origin_corner WCS.
     * Używane tylko po ręcznym picku naroża; domyślnie WCS bierze origin z JSON roli.
     * 0: tyl_dol_lewo (−X −Y −Z) … 6: przod_gora_prawo (+X +Y +Z)
     */
export function cornerIndexToOriginCorner(cornerIndex: number): { X: string; Y: string; Z: string } {
    const i = Math.max(0, Math.min(7, Math.floor(Number(cornerIndex) || 0)));
    // Zgodnie z mesh_builder / NAROZNIK_WSPOLRZEDNE (środek formatki = 0)
    const table: Array<{ X: string; Y: string; Z: string }> = [
        { X: '-', Y: '-', Z: '-' }, // 0 tyl_dol_lewo
        { X: '+', Y: '-', Z: '-' }, // 1 tyl_dol_prawo
        { X: '+', Y: '-', Z: '+' }, // 2 przod_dol_prawo
        { X: '-', Y: '-', Z: '+' }, // 3 przod_dol_lewo
        { X: '-', Y: '+', Z: '-' }, // 4 tyl_gora_lewo
        { X: '+', Y: '+', Z: '-' }, // 5 tyl_gora_prawo
        { X: '+', Y: '+', Z: '+' }, // 6 przod_gora_prawo
        { X: '-', Y: '+', Z: '+' }, // 7 przod_gora_lewo
    ];
    return { ...table[i] };
}

export class WcsRulesMapper {
    public static getRuleForRole(role: string): WcsRule | null {
        if (!role) return null;
        
        const roleUpper = role.toUpperCase();
        const roleAliases: Record<string, string> = {
            'BOK_L': 'LEFT_SIDE_PANEL',
            'BOK_P': 'RIGHT_SIDE_PANEL',
            'DOL_BOK_L': 'LEFT_SIDE_PANEL',
            'DOL_BOK_P': 'RIGHT_SIDE_PANEL',
            'GOR_BOK_L': 'LEFT_SIDE_PANEL',
            'GOR_BOK_P': 'RIGHT_SIDE_PANEL',
            'WENEC_G': 'TOP_PANEL',
            'WENEC_D': 'BOTTOM_PANEL',
            'TYL': 'BACK_PANEL',
            'LEFT_SIDE_PANEL': 'LEFT_SIDE_PANEL',
            'RIGHT_SIDE_PANEL': 'RIGHT_SIDE_PANEL',
            'TOP_PANEL': 'TOP_PANEL',
            'BOTTOM_PANEL': 'BOTTOM_PANEL',
            'BACK_PANEL': 'BACK_PANEL'
        };

        const targetRole = roleAliases[roleUpper] || roleUpper;

        const activeRules = korpusRules;
        if (!activeRules) {
            throw new Error("BŁĄD CNC: Brak pliku z regułami WCS (korpus3_3_rules.json).");
        }

        const overrides = (activeRules as any)?.parameters?.smart_panel_integration?.role_overrides;
        if (!overrides) {
            throw new Error("BŁĄD CNC: Brak definicji 'role_overrides' w parametrach JSON.");
        }

        const roleRule = overrides[targetRole] || overrides[role];
        if (!roleRule) {
            return null;
        }

        return {
            origin_corner: roleRule.wcs_origin_corner || { X: "-", Y: "-", Z: "-" },
            directions: roleRule.wcs_axis_directions || { X: "+", Y: "+", Z: "+" },
            rotation: {
                X: Number(roleRule.wcs_axis_rotation?.X || 0),
                Y: Number(roleRule.wcs_axis_rotation?.Y || 0),
                Z: Number(roleRule.wcs_axis_rotation?.Z || 0)
            }
        };
    }
}
