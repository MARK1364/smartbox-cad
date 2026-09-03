/**
 * SmartPanel Web — C1_CNC CLData (Cutter Location Data)
 * 
 * Neutralna reprezentacja pośrednia ścieżki narzędzia (CLData / standard ISO 4343 / APT).
 * Rozdziela generowanie matematyki ścieżki (strategie obróbki) od konkretnych postprocesorów (G-kod).
 */

import { Vector3D } from '../dto/cam-dto.js';

export type CLCommandType =
    | 'GOTO'            // Szybki lub roboczy ruch liniowy [x, y, z]
    | 'ARC'             // Ruch po łuku [endPoint, center, plane, direction]
    | 'FEDRAT'          // Ustawienie prędkości posuwu (mm/min)
    | 'SPINDL'          // Ustawienie obrotów wrzeciona (RPM, direction)
    | 'TOOL_SELECT'     // Wybór i zmiana narzędzia (toolId, diameter, name)
    | 'COOLNT'          // Sterowanie chłodziwem (ON / OFF / MIST)
    | 'COMPENSATION'    // Kompensacja promienia narzędzia (OFF / LEFT / RIGHT)
    | 'CYCLE_DRILL'     // Cykl wiercenia (G81 / G83 peck / depth / retract)
    | 'COMMENT'         // Komentarz / etykieta sekcji
    | 'STOP';           // Przerwanie / Koniec programu

export interface CLPoint extends Vector3D {
    i?: number;
    j?: number;
    k?: number;
}

export interface CLCommand {
    type: CLCommandType;
    point?: CLPoint;
    feedRate?: number;
    spindleRpm?: number;
    spindleDirection?: 'CW' | 'CCW';
    toolId?: string;
    toolDiameter?: number;
    toolName?: string;
    compensation?: 'OFF' | 'LEFT' | 'RIGHT';
    drillParams?: {
        depth: number;
        retractR: number;
        peckStep?: number;
        dwellTime?: number;
        type: 'STANDARD' | 'PECK' | 'DWELL';
    };
    arcParams?: {
        center: Vector3D;
        radius: number;
        plane: 'XY' | 'XZ' | 'YZ';
        direction: 'CW' | 'CCW';
    };
    comment?: string;
    featureId?: string;
}

export interface CLDataProgram {
    projectName: string;
    wcsName: string;
    wcsOrigin: Vector3D;
    commands: CLCommand[];
    totalLengthMm: number;
    estimatedTimeSec: number;
    toolIdsUsed: string[];
}
