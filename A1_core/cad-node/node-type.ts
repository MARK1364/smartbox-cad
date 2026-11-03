/**
 * SmartPanel Web — CADNode: NodeType
 *
 * Enum typów węzłów drzewa domenowego CAD.
 * Odzwierciedla hierarchię: ROOM → ASSEMBLY → PART → FEATURE
 */

export enum NodeType {
    /** Korzeń sceny — cały pokój/przestrzeń robocza */
    ROOM = 'ROOM',

    /** Złożenie: korpus meblowy, SmartFrame, Bloki */
    ASSEMBLY = 'ASSEMBLY',

    /** Formatka/płyta (PanelModel) */
    PART = 'PART',

    /** Operacja na formatce: otwór, rowek, frez, kieszeń */
    FEATURE = 'FEATURE',

    /** Układ bazowy maszyny CNC formatki (Work Coordinate System) */
    WCS_FRAME = 'WCS_FRAME',

    /** Globalny układ odniesienia sceny / poziomów mebli (Global Layout / Level Coordinates) */
    GLC_FRAME = 'GLC_FRAME',

    /** Poziom odniesienia wysokości Z (Datum Level / Sfera Z) */
    DATUM_LEVEL = 'DATUM_LEVEL',

    /** Płaszczyzna lub element szkicu parametrycznego */
    SKETCH = 'SKETCH',

    /** Okucie meblowe: zawias, uchwyt, prowadnica, nóżka, siłownik */
    HARDWARE = 'HARDWARE',
}
