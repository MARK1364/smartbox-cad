/**
 * SmartPanel Web — CADNode: NodeType
 *
 * Enum typów węzłów drzewa domenowego CAD.
 * Odzwierciedla hierarchię: ROOM → ASSEMBLY → PART → FEATURE
 */

export enum NodeType {
    /** Korzeń sceny — cały pokój/przestrzeń robocza */
    ROOM = 'ROOM',

    /** Złożenie: korpus meblowy, SmartFrame, SmartBox */
    ASSEMBLY = 'ASSEMBLY',

    /** Formatka/płyta (PanelModel) */
    PART = 'PART',

    /** Operacja na formatce: otwór, rowek, frez, kieszeń */
    FEATURE = 'FEATURE',

    /** Układ bazowy maszyny CNC (Work Coordinate System) */
    WCS_FRAME = 'WCS_FRAME',
}
