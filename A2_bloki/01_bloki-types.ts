/**
 * bloki-types.ts
 *
 * Wspólne typy i kontrakty DTO dla modułów Bloki.
 * Architektura funkcyjna, jawne jednostki w nazwach (_mm, _deg, _kg).
 * Zgodność z .agents/AGENTS.md:
 *  - role (np. 'FRONT', 'SHELF') i nodeType ('PART')
 *  - brak logiki bazującej na name
 *  - formatki w milimetrach na poziomie planowania Bloku
 */

export interface BlokiDimensions_mm {
    width_mm: number;
    height_mm: number;
    depth_mm: number;
}

export type BlokiPartRole =
    | 'FRONT'              // Front meblowy (drzwi, front szuflady)
    | 'FLAP'               // Klapa uchylna
    /** @deprecated alias detektora — kanon: SHELF_PANEL / SHELF_BOARD */
    | 'SHELF'
    | 'SHELF_PANEL'        // Półka ruchoma (moduł shelves) — kanon
    | 'SHELF_BOARD'        // Wieniec / półka stała (moduł shelf) — kanon
    /** @deprecated alias — kanon: DIVIDER_PLATE */
    | 'DIVIDER'
    | 'DIVIDER_PLATE'      // Przegroda pionowa (moduł dividers) — kanon
    | 'DRAWER_BOTTOM'      // Dno szuflady
    | 'DRAWER_BACK'        // Ścianka tylna szuflady
    | 'BOX'                // Korpus / boki szuflady
    | 'SPACER'             // Dystans boczny prowadnicy
    | 'TUBE_ROD'           // Drążek ubraniowy
    | 'HOLDER'             // Uchwyt / rozeta drążka
    | 'BACK_PANEL'         // Plecy korpusu
    | 'BODY'               // Korpus ogólny
    | 'LEFT_SIDE_PANEL'    // Panel boczny lewy
    | 'RIGHT_SIDE_PANEL'   // Panel boczny prawy
    | 'TOP_PANEL'          // Panel górny
    | 'BOTTOM_PANEL'       // Panel dolny
    | 'LED'                // Profil / taśma LED
    | 'OTHER';             // Inne elementy pomocnicze

export interface BlokiLcsDefinition {
    mapping: { X: string; Y: string; Z: string };
    rotation: [number, number, number];
    faces: { INNER: string; OUTER: string };
}

export interface BlokiPart {
    id?: string;
    key?: string;
    name: string;
    role: BlokiPartRole;
    nodeType?: 'PART';
    material?: string;
    materialName?: string;
    materialCode?: string;
    dim: { x: number; y: number; z: number }; // wymiary formatki w mm
    loc: { x: number; y: number; z: number }; // pozycja lokalna w mm
    lcs?: BlokiLcsDefinition;
    edge_banding?: Record<string, any>;
    features?: any[];
    meta?: Record<string, any>;
    report_type?: string;
    library_id?: string;
    customProperties?: Record<string, any>;
}

export interface BlokiHardware {
    id: string;
    name: string;
    role?: string;
    hardwareType: 'HINGE' | 'RAIL' | 'TUBE' | 'FLAP' | 'SHELF_PIN' | 'HANDLE' | 'HANGER' | 'OTHER';
    hardwareId: string;
    side?: 'left' | 'right' | 'center';
    loc: { x: number; y: number; z: number }; // pozycja lokalna w mm
    dim?: { x: number; y: number; z: number };
    params?: Record<string, any>;
    customProperties?: Record<string, any>;
}

export interface BlokiPlanResult {
    parts: BlokiPart[];
    hardware?: BlokiHardware[];
}
