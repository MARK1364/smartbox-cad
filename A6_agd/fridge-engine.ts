/**
 * A6_agd — fridge-engine.ts
 *
 * Silnik obliczeń geometrii i planu komponentów B-rep dla lodówki do zabudowy.
 * Modeluje lodówkę jako integralne urządzenie AGD ("tak jak na żywo"):
 *  - Korpus techniczny wsuwany do wnęki (blacha ocynkowana / jasnoszary)
 *  - Cokół techniczny / wlot wentylacyjny agregatu na dole
 *  - Dolne drzwi lodówki (zamrażalnik) — lakier biały AGD lub stal szlachetna Inox
 *  - Uszczelka magnetyczna drzwi dolnych (ciemny antracyt)
 *  - Górne drzwi lodówki (chłodziarka) — lakier biały AGD lub stal szlachetna Inox
 *  - Uszczelka magnetyczna drzwi górnych (ciemny antracyt)
 *
 * Komponenty te są częściami składowymi urządzenia AGD (excludeFromProduction: true),
 * a NIE formatkami meblowymi z płyty.
 */

import type { FridgeParamsMm } from './smart-appliance-types.js';
import {
    APPLIANCE_LCS,
    type AppliancePartPlanMm,
} from './microwave-engine.js';

/** Kolor technicznego korpusu wnękowego (ocynkowana blacha / jasny szary) */
export const FRIDGE_CORPUS_COLOR = { r: 0.88, g: 0.89, b: 0.91 };

/** Kolor uszczelki magnetycznej drzwi lodówki (dyskretny techniczny szary) */
export const FRIDGE_GASKET_COLOR = { r: 0.65, g: 0.67, b: 0.70 };

/** Kolor drzwi lodówki — biały lakier AGD */
export const FRIDGE_DOOR_WHITE_COLOR = { r: 0.96, g: 0.96, b: 0.97 };

/** Kolor drzwi lodówki — stal szlachetna / Inox */
export const FRIDGE_DOOR_INOX_COLOR = { r: 0.84, g: 0.86, b: 0.88 };

/** Kolor drzwi lodówki — elegancki czarny mat / antracyt */
export const FRIDGE_DOOR_BLACK_COLOR = { r: 0.22, g: 0.23, b: 0.25 };

/** Kolor dolnego cokołu wentylacyjnego / kratki agregatu */
export const FRIDGE_PLINTH_COLOR = { r: 0.80, g: 0.82, b: 0.84 };

/** Kolor relingów / uchwytów zewnętrznych */
export const FRIDGE_HANDLE_COLOR = { r: 0.35, g: 0.36, b: 0.38 };

export function planFridge(params: FridgeParamsMm): { parts: AppliancePartPlanMm[]; corpusHeight: number; frontTopHeight: number } {
    const plinthH = Math.max(0, Number.isFinite(params.plinthHeight) ? params.plinthHeight! : 0);
    const frontBottomH = Math.max(100, params.frontBottomHeight || 714);
    const doorGap = Math.max(0, Number.isFinite(params.doorGap) ? params.doorGap : 4);

    // Parametr wejściowy to wysokość całkowita; front górny jest wyliczany:
    const totalHeight = Number.isFinite(params.totalHeight) && params.totalHeight! > 0
        ? Math.max(plinthH + frontBottomH + doorGap + 50, params.totalHeight!)
        : (plinthH + frontBottomH + doorGap + Math.max(50, params.frontTopHeight || 1006));

    const frontTopH = Math.max(50, totalHeight - plinthH - frontBottomH - doorGap);
    const corpusHeight = totalHeight;
    const doorD = Math.max(15, params.doorDepth || params.frontDepth || 45);
    const corpusW = Math.max(100, params.corpusWidth || 550);
    const corpusD = Math.max(50, params.corpusDepth || 545);
    const doorW = corpusW;

    const finish = (params.finish || 'WHITE').toUpperCase();
    const doorColor = finish === 'BLACK'
        ? FRIDGE_DOOR_BLACK_COLOR
        : finish === 'INOX'
            ? FRIDGE_DOOR_INOX_COLOR
            : FRIDGE_DOOR_WHITE_COLOR;

    // Grubość uszczelki i bryły drzwi
    const gasketD = 8;
    const doorBodyD = Math.max(10, doorD - gasketD);

    // Pozycjonowanie w osi Y (głębokość szafki):
    // Gdy kontener jest zadokowany we wnęce o głębokości bayDepth:
    // Lico zewnętrzne drzwi lodówki zlicowane z przodem wnęki (-bayDepth / 2)
    const isBayDocked = Number.isFinite(params.bayDepth) && (params.bayDepth! > 0);
    const totalD = isBayDocked ? params.bayDepth! : (corpusD + doorD);
    const doorFrontY = isBayDocked ? (-totalD / 2) : (-totalD / 2);
    const doorBackY = doorFrontY + doorBodyD;
    const corpusFrontY = doorBackY + gasketD;

    const parts: AppliancePartPlanMm[] = [];

    // 1. Korpus lodówki wsuwany w głąb wnęki (+Y) — kolorowany jednolicie z całą lodówką
    parts.push({
        key: 'appliance_corpus',
        name: 'Korpus_Lodowki',
        role: 'APPLIANCE_CORPUS',
        loc: {
            x: 0,
            y: corpusFrontY + corpusD / 2,
            z: totalHeight / 2,
        },
        dim: {
            x: corpusW,
            y: corpusD,
            z: totalHeight,
        },
        rotationDeg: [0, 0, 0],
        lcs: APPLIANCE_LCS,
        color: doorColor,
        custom_properties: {
            excludeFromProduction: true,
            domain: 'appliance_part',
            applianceType: 'FRIDGE',
            partKey: 'corpus',
            isComponent: true,
        },
    });

    // 2. Dolny cokół techniczny / wlot wentylacyjny (jeśli plinthH > 0)
    if (plinthH > 0) {
        const plinthD = Math.max(20, doorD + 60);
        parts.push({
            key: 'appliance_plinth',
            name: 'Cokol_Wentylacyjny_Lodowki',
            role: 'APPLIANCE_PLINTH',
            loc: {
                x: 0,
                y: doorFrontY + plinthD / 2 + 10,
                z: plinthH / 2,
            },
            dim: {
                x: Math.max(50, corpusW - 10),
                y: plinthD,
                z: plinthH,
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: FRIDGE_PLINTH_COLOR,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'plinth',
                isComponent: true,
            },
        });
    }

    const doorLayout = params.doorLayout || 'TOP_BOTTOM';

    if (doorLayout === 'SIDE_BY_SIDE') {
        const doorH = Math.max(50, totalHeight - plinthH);
        const halfDoorW = Math.max(50, (doorW - doorGap) / 2);
        const zCenter = plinthH + doorH / 2;

        // Uszczelka lewa
        parts.push({
            key: 'appliance_gasket_left',
            name: 'Uszczelka_Lewa_Lodowki',
            role: 'APPLIANCE_GASKET',
            loc: {
                x: -(halfDoorW / 2 + doorGap / 4),
                y: doorBackY + gasketD / 2,
                z: zCenter,
            },
            dim: {
                x: Math.max(20, halfDoorW - 16),
                y: gasketD,
                z: Math.max(10, doorH - 16),
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: FRIDGE_GASKET_COLOR,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'gasket_left',
                isComponent: true,
            },
        });

        // Drzwi lewe
        parts.push({
            key: 'appliance_door_left',
            name: 'Drzwi_Lewe_Lodowki',
            role: 'APPLIANCE_DOOR',
            loc: {
                x: -(halfDoorW / 2 + doorGap / 4),
                y: doorFrontY + doorBodyD / 2,
                z: zCenter,
            },
            dim: {
                x: halfDoorW,
                y: doorBodyD,
                z: doorH,
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: doorColor,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'door_left',
                isApplianceDoor: true,
                isComponent: true,
            },
        });

        // Uszczelka prawa
        parts.push({
            key: 'appliance_gasket_right',
            name: 'Uszczelka_Prawa_Lodowki',
            role: 'APPLIANCE_GASKET',
            loc: {
                x: +(halfDoorW / 2 + doorGap / 4),
                y: doorBackY + gasketD / 2,
                z: zCenter,
            },
            dim: {
                x: Math.max(20, halfDoorW - 16),
                y: gasketD,
                z: Math.max(10, doorH - 16),
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: FRIDGE_GASKET_COLOR,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'gasket_right',
                isComponent: true,
            },
        });

        // Drzwi prawe
        parts.push({
            key: 'appliance_door_right',
            name: 'Drzwi_Prawe_Lodowki',
            role: 'APPLIANCE_DOOR',
            loc: {
                x: +(halfDoorW / 2 + doorGap / 4),
                y: doorFrontY + doorBodyD / 2,
                z: zCenter,
            },
            dim: {
                x: halfDoorW,
                y: doorBodyD,
                z: doorH,
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: doorColor,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'door_right',
                isApplianceDoor: true,
                isComponent: true,
            },
        });

        // Relingi / uchwyty zewnętrzne (dla lodówki dwudrzwiowej)
        if (params.isFreestanding !== false) {
            const handleH = Math.min(800, doorH * 0.6);
            parts.push({
                key: 'appliance_handle_left',
                name: 'Uchwyt_Lewy_Lodowki',
                role: 'APPLIANCE_HANDLE',
                loc: {
                    x: -(doorGap / 2 + 25),
                    y: doorFrontY - 14,
                    z: zCenter,
                },
                dim: {
                    x: 16,
                    y: 28,
                    z: handleH,
                },
                rotationDeg: [0, 0, 0],
                lcs: APPLIANCE_LCS,
                color: FRIDGE_HANDLE_COLOR,
                custom_properties: {
                    excludeFromProduction: true,
                    domain: 'appliance_part',
                    applianceType: 'FRIDGE',
                    partKey: 'handle_left',
                    isComponent: true,
                },
            });
            parts.push({
                key: 'appliance_handle_right',
                name: 'Uchwyt_Prawy_Lodowki',
                role: 'APPLIANCE_HANDLE',
                loc: {
                    x: +(doorGap / 2 + 25),
                    y: doorFrontY - 14,
                    z: zCenter,
                },
                dim: {
                    x: 16,
                    y: 28,
                    z: handleH,
                },
                rotationDeg: [0, 0, 0],
                lcs: APPLIANCE_LCS,
                color: FRIDGE_HANDLE_COLOR,
                custom_properties: {
                    excludeFromProduction: true,
                    domain: 'appliance_part',
                    applianceType: 'FRIDGE',
                    partKey: 'handle_right',
                    isComponent: true,
                },
            });
        }
    } else if (doorLayout === 'SINGLE') {
        const doorH = Math.max(50, totalHeight - plinthH);
        const zCenter = plinthH + doorH / 2;

        parts.push({
            key: 'appliance_gasket_single',
            name: 'Uszczelka_Lodowki',
            role: 'APPLIANCE_GASKET',
            loc: {
                x: 0,
                y: doorBackY + gasketD / 2,
                z: zCenter,
            },
            dim: {
                x: Math.max(50, corpusW - 16),
                y: gasketD,
                z: Math.max(10, doorH - 16),
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: FRIDGE_GASKET_COLOR,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'gasket_single',
                isComponent: true,
            },
        });

        parts.push({
            key: 'appliance_door_single',
            name: 'Drzwi_Lodowki',
            role: 'APPLIANCE_DOOR',
            loc: {
                x: 0,
                y: doorFrontY + doorBodyD / 2,
                z: zCenter,
            },
            dim: {
                x: doorW,
                y: doorBodyD,
                z: doorH,
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: doorColor,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'door_single',
                isApplianceDoor: true,
                isComponent: true,
            },
        });
    } else {
        // Standard: TOP_BOTTOM (chłodziarko-zamrażarka góra/dół)
        const zBottomCenter = plinthH + frontBottomH / 2;
        parts.push({
            key: 'appliance_gasket_bottom',
            name: 'Uszczelka_Dolna_Lodowki',
            role: 'APPLIANCE_GASKET',
            loc: {
                x: 0,
                y: doorBackY + gasketD / 2,
                z: zBottomCenter,
            },
            dim: {
                x: Math.max(50, corpusW - 16),
                y: gasketD,
                z: Math.max(10, frontBottomH - 12),
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: FRIDGE_GASKET_COLOR,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'gasket_bottom',
                isComponent: true,
            },
        });

        parts.push({
            key: 'appliance_door_bottom',
            name: 'Drzwi_Dolne_Lodowki',
            role: 'APPLIANCE_DOOR',
            loc: {
                x: 0,
                y: doorFrontY + doorBodyD / 2,
                z: zBottomCenter,
            },
            dim: {
                x: doorW,
                y: doorBodyD,
                z: frontBottomH,
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: doorColor,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'door_bottom',
                isApplianceDoor: true,
                isComponent: true,
            },
        });

        const zTopBase = plinthH + frontBottomH + doorGap;
        const zTopCenter = zTopBase + frontTopH / 2;
        parts.push({
            key: 'appliance_gasket_top',
            name: 'Uszczelka_Gorna_Lodowki',
            role: 'APPLIANCE_GASKET',
            loc: {
                x: 0,
                y: doorBackY + gasketD / 2,
                z: zTopCenter,
            },
            dim: {
                x: Math.max(50, corpusW - 16),
                y: gasketD,
                z: Math.max(10, frontTopH - 12),
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: FRIDGE_GASKET_COLOR,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'gasket_top',
                isComponent: true,
            },
        });

        parts.push({
            key: 'appliance_door_top',
            name: 'Drzwi_Gorne_Lodowki',
            role: 'APPLIANCE_DOOR',
            loc: {
                x: 0,
                y: doorFrontY + doorBodyD / 2,
                z: zTopCenter,
            },
            dim: {
                x: doorW,
                y: doorBodyD,
                z: frontTopH,
            },
            rotationDeg: [0, 0, 0],
            lcs: APPLIANCE_LCS,
            color: doorColor,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'appliance_part',
                applianceType: 'FRIDGE',
                partKey: 'door_top',
                isApplianceDoor: true,
                isComponent: true,
            },
        });
    }

    return {
        parts,
        corpusHeight,
        frontTopHeight: frontTopH,
    };
}
