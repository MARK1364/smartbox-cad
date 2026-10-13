/**
 * A5_smartparts / hangers — zawieszki do wieszania szafek (Camaro itd.).
 * Logika: bez nowych formatek → SmartParts; detekcja wnęki jak Bloki.
 */

/** Pojedyncza zawieszka (dziecko grupy). */
export const SMARTPART_HANGER_TYPE = 'smartpart_hanger';
/** Główny wpis w drzewie obiektów — para zawieszek (jak kontener Bloku). */
export const SMARTPART_HANGERS_GROUP_TYPE = 'smartpart_hangers';

export type HangerSide = 'L' | 'R';

export interface HangerTemplateItem {
    id: string;
    name: string;
    brand: string;
    seriesId: string;
    glbModelPath: string;
    fromTopMm: number;
    fromBackMm: number;
    fromSideMm: number;
    widthMm: number;
    heightMm: number;
    depthMm: number;
    pair: boolean;
    thumbnailUrl?: string;
    definition?: any;
}

export interface HangerParamsMm {
    hardwareId: string;
    side: HangerSide;
    fromTopMm: number;
    fromBackMm: number;
    fromSideMm: number;
    widthMm: number;
    heightMm: number;
    depthMm: number;
    glbModelPath: string;
    definition?: any;
    /** Konkretna bryła (part) SmartParta ze Studio, którą reprezentuje ten węzeł */
    part?: any;
}
