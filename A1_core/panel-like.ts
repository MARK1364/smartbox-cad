/**
 * Wąski kontrakt formatki dla A1 — bez importu klasy PanelModel (A4).
 */

export interface PanelLike {
    type?: string;
    id?: string;
    name?: string;
    role?: string;
    zoneId?: string;
    width?: number;
    height?: number;
    thickness?: number;
    engineManaged?: boolean;
    features?: any[];
    [key: string]: any;
}

/** Panel ręczny — silnik nie kasuje i nie nadpisuje. */
export function isManualPanel(panel: any): boolean {
    return !!panel && panel.engineManaged === false;
}

export function isPanelLike(data: any): data is PanelLike {
    return !!data && (data.type === 'part' || data.type === 'panel');
}
