/**
 * Typy danych dla narzędzia LED ZEWNĘTRZNY (kanał) — złożeniowy kontener kanału (Assembly Tool Container).
 * Umożliwia parametryczne frezowanie ciągłego rowka LED w wielu formatkach (wieńcach i bokach).
 *
 * UWAGA — dwa odrębne systemy LED w kodzie (celowo):
 *  - LED WEWNĘTRZNY  → source 'BLOKI_LED'        (led-internal-engine.ts) — profil we wnętrzu szafki,
 *    detekcja geometrii z planu Bloków (wieniec/bok wnęki, sync przy rebuild);
 *  - LED ZEWNĘTRZNY (kanał)                        — ten moduł — kanał pod korpusami (np. kuchnie),
 *    wykrywanie rzędu szafek w świecie (detectCabinetRow), store + UI drop.
 * Silniki NIE są wymienne — różne mechanizmy wykrywania geometrii i różne role montażowe.
 */

import type { AssocPlaneRef } from '../A4_smartpanel/associative-dim.js';

export interface LedChannelDefinition {
    id: string;
    name: string;
    enabled: boolean;
    visible?: boolean;
    frozen?: boolean;

    // 6 referencji płaszczyzn bazowych (układ Bloku: xMin, xMax, yMin, yMax, zMin, zMax)
    refLeft: AssocPlaneRef | null;    // xMin (Bok Lewy)
    refRight: AssocPlaneRef | null;   // xMax (Bok Prawy)
    refFront: AssocPlaneRef | null;   // yMin (Przód)
    refBack?: AssocPlaneRef | null;   // yMax (Tył)
    refBottom: AssocPlaneRef | null;  // zMin (Dół)
    refTop?: AssocPlaneRef | null;    // zMax (Góra)

    // Offsety per ściana (wzór Bloku)
    offsets?: {
        xMin?: number;
        xMax?: number;
        yMin?: number;
        yMax?: number;
        zMin?: number;
        zMax?: number;
    };
    disabledReferences?: Record<string, boolean>;
    maxHeight?: number;

    // Parametry geometryczne frezowania [mm]
    offsetFromFrontMm: number; // odsunięcie od płaszczyzny frontowej w głąb (np. 50 mm)
    grooveWidthMm: number;     // szerokość profilu / frezu (np. 14 mm)
    grooveDepthMm: number;     // głębokość rowka w płycie (np. 9 mm)
    cutSides: boolean;         // czy podcinać boki korpusów na wylot (przelot profilu)

    // Zakres automatu
    scope?: 'row' | 'single';  // 'row' = cały wykryty rząd szafek wiszących, 'single' = tylko wskazany korpus
    rowCabinetIds?: string[];
    rowCabinetCount?: number;
    detectedWidthMm?: number;
}

export function createDefaultLedChannel(id?: string): LedChannelDefinition {
    return {
        id: id || `led_channel_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: 'LED zewnętrzny (kanał)',
        enabled: true,
        visible: true,
        frozen: false,
        refLeft: null,
        refRight: null,
        refBottom: null,
        refFront: null,
        refTop: null,
        refBack: null,
        offsets: {
            xMin: 0,
            xMax: 0,
            yMin: 50,
            yMax: 0,
            zMin: 0,
            zMax: 9,
        },
        disabledReferences: {},
        maxHeight: 9,
        offsetFromFrontMm: 50,
        grooveWidthMm: 14,
        grooveDepthMm: 9,
        cutSides: true,
        scope: 'row',
        rowCabinetIds: [],
        rowCabinetCount: 1,
    };
}

export const LED_CHANNEL_SOURCE = 'assembly_led_channel';
