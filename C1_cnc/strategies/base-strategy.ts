/**
 * SmartPanel Web — C1_CNC Machining Strategy Base Interface
 * 
 * Bazowy interfejs i klasy abstrakcyjne dla strategii obróbczych (Wzorzec Strategy dla CAM).
 */

import { CAMFeature, CAMStrategyParams, Tool, Vector3D } from '../dto/cam-dto.js';
import { CLCommand } from '../core/cl-data.js';

export type StrategyParams = CAMStrategyParams;

export interface MachiningStrategy {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly targetFeatureTypes: Array<'hole' | 'groove' | 'contour' | 'pocket'>;

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
