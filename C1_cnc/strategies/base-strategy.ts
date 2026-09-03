/**
 * SmartPanel Web — C1_CNC Machining Strategy Base Interface
 * 
 * Bazowy interfejs i klasy abstrakcyjne dla strategii obróbczych (Wzorzec Strategy dla CAM).
 */

import { CAMFeature, Tool, Vector3D } from '../dto/cam-dto.js';
import { CLCommand } from '../core/cl-data.js';

export interface StrategyParams {
    feedRate?: number;
    spindleRpm?: number;
    stepoverPercent?: number;  // % średnicy narzędzia (np. 60%)
    stepdownMm?: number;        // Głębokość w jednym przejściu (mm)
    leadInMm?: number;         // Wydłużenie/łuk wejścia (mm)
    leadOutMm?: number;        // Wydłużenie/łuk wyjścia (mm)
    compensation?: 'OFF' | 'LEFT' | 'RIGHT';
    peckStepMm?: number;       // Skok przy wierceniu głębokim G83 (mm)
    reverseDirection?: boolean;
}

export interface MachiningStrategy {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly targetFeatureTypes: Array<'hole' | 'groove' | 'contour'>;

    /**
     * Generuje zestaw neutralnych komend CLData dla podanej cechy i narzędzia.
     */
    generateCLCommands(
        feature: CAMFeature,
        tool: Tool,
        wcsOrigin: Vector3D,
        customParams?: StrategyParams
    ): CLCommand[];
}
