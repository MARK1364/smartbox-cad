/**
 * SmartPanel Web — C1_CNC Tool Library
 * 
 * Zarządzanie magazynkiem narzędzi CNC.
 */

import { Tool } from '../dto/cam-dto.js';

export const DEFAULT_CNC_TOOLS: Tool[] = [
    {
        id: "tool_4_drill_8",
        name: "Wiertło fi 8 mm",
        diameter: 8.0,
        type: "drill",
        allowedAxes: ["Z"],
        parameters: { feedRate: 1000, spindleRpm: 3000 }
    },
    {
        id: "tool_2_drill_5",
        name: "Wiertło fi 5 mm",
        diameter: 5.0,
        type: "drill",
        allowedAxes: ["Z"],
        parameters: { feedRate: 1000, spindleRpm: 3000 }
    },
    {
        id: "tool_9_drill_7",
        name: "Wiertło fi 7 mm",
        diameter: 7.0,
        type: "drill",
        allowedAxes: ["Z"],
        parameters: { feedRate: 1000, spindleRpm: 3000 }
    },
    {
        id: "tool_7_drill_8_h",
        name: "Wiertło poziome fi 8 mm",
        diameter: 8.0,
        type: "drill",
        allowedAxes: ["X", "Y"],
        parameters: { feedRate: 1000, spindleRpm: 3000 }
    },
    {
        id: "tool_8_drill_5_h",
        name: "Wiertło poziome fi 5 mm",
        diameter: 5.0,
        type: "drill",
        allowedAxes: ["X", "Y"],
        parameters: { feedRate: 1000, spindleRpm: 3000 }
    },
    {
        id: "tool_6_drill_3",
        name: "Wiertło fi 3 mm",
        diameter: 3.0,
        type: "drill",
        allowedAxes: ["Z"],
        parameters: { feedRate: 800, spindleRpm: 3000 }
    },
    {
        id: "tool_2_drill_35",
        name: "Wiertło fi 35 mm (Puszka)",
        diameter: 35.0,
        type: "drill",
        allowedAxes: ["Z"],
        parameters: { feedRate: 500, spindleRpm: 1500 }
    },
    {
        id: "tool_1_saw_150",
        name: "Piła nutująca 150x3 mm",
        diameter: 150.0,
        type: "groove",
        allowedAxes: ["X"],
        parameters: { thickness: 3.0, feedRate: 1000, spindleRpm: 4000 }
    },
    {
        id: "tool_4_mill_8",
        name: "Frez fi 8 mm",
        diameter: 8.0,
        type: "mill",
        allowedAxes: ["X", "Y", "Z"],
        parameters: { feedRate: 1200, spindleRpm: 6000 }
    }
];

export class ToolLibrary {
    private toolsMap: Map<string, Tool> = new Map();

    public static validateTool(tool: Tool): void {
        if (!tool || typeof tool.id !== 'string' || tool.id.trim().length === 0) {
            throw new Error(`[ToolLibrary] Narzędzie musi posiadać niepuste ID.`);
        }
        if (typeof tool.diameter !== 'number' || !Number.isFinite(tool.diameter) || tool.diameter <= 0) {
            throw new Error(`[ToolLibrary] Średnica narzędzia musi być skończoną liczbą dodatnią dla narzędzia "${tool.id}" (diameter=${tool?.diameter}).`);
        }
        if (tool.parameters) {
            if (typeof tool.parameters.feedRate !== 'undefined' && (!Number.isFinite(tool.parameters.feedRate) || tool.parameters.feedRate <= 0)) {
                throw new Error(`[ToolLibrary] Posuw narzędzia musi być skończoną liczbą dodatnią dla narzędzia "${tool.id}" (feedRate=${tool.parameters.feedRate}).`);
            }
            if (typeof tool.parameters.spindleRpm !== 'undefined' && (!Number.isFinite(tool.parameters.spindleRpm) || tool.parameters.spindleRpm <= 0)) {
                throw new Error(`[ToolLibrary] Obroty wrzeciona muszą być skończoną liczbą dodatnią dla narzędzia "${tool.id}" (spindleRpm=${tool.parameters.spindleRpm}).`);
            }
            if (typeof tool.parameters.stepDown !== 'undefined' && (!Number.isFinite(tool.parameters.stepDown) || tool.parameters.stepDown <= 0)) {
                throw new Error(`[ToolLibrary] Krok wgłębny narzędzia (stepDown) musi być skończoną liczbą dodatnią dla narzędzia "${tool.id}" (stepDown=${tool.parameters.stepDown}).`);
            }
            if (typeof tool.parameters.stepoverPercent !== 'undefined' && (!Number.isFinite(tool.parameters.stepoverPercent) || tool.parameters.stepoverPercent <= 0 || tool.parameters.stepoverPercent > 100)) {
                throw new Error(`[ToolLibrary] Procent nakładania narzędzia (stepoverPercent) musi być liczbą z zakresu (0, 100] dla narzędzia "${tool.id}" (stepoverPercent=${tool.parameters.stepoverPercent}).`);
            }
        }
    }

    constructor(initialTools: Tool[] = DEFAULT_CNC_TOOLS) {
        for (const tool of initialTools) {
            this.addOrUpdateTool(tool);
        }
    }

    public getAllTools(): Tool[] {
        return Array.from(this.toolsMap.values());
    }

    public getTool(id: string): Tool | undefined {
        return this.toolsMap.get(id);
    }

    public addOrUpdateTool(tool: Tool): void {
        ToolLibrary.validateTool(tool);
        this.toolsMap.set(tool.id, { ...tool, parameters: { ...tool.parameters } });
    }

    public removeTool(id: string): boolean {
        return this.toolsMap.delete(id);
    }

    /**
     * Znajduje najlepsze narzędzie dla podanej średnicy otworu z wyznaczoną tolerancją (w mm).
     */
    public findBestHoleTool(diameterMm: number, toleranceMm: number = 0.3): Tool | null {
        let bestTool: Tool | null = null;
        let minDiff = Infinity;

        for (const tool of this.toolsMap.values()) {
            if (tool.type === 'drill' || tool.type === 'mill') {
                const diff = Math.abs(tool.diameter - diameterMm);
                if (diff <= toleranceMm && diff < minDiff) {
                    minDiff = diff;
                    bestTool = tool;
                }
            }
        }
        return bestTool;
    }

    /**
     * Znajduje narzędzie dla operacji wpustu (saw/groove/mill).
     */
    public findBestGrooveTool(): Tool | null {
        for (const tool of this.toolsMap.values()) {
            if (tool.type === 'groove') {
                return tool;
            }
        }
        for (const tool of this.toolsMap.values()) {
            if (tool.type === 'mill') {
                return tool;
            }
        }
        return null;
    }

    /**
     * Znajduje optymalny frez palcowy (typ 'mill') o średnicy mniejszej lub równej zadanemu limitowi.
     */
    public findBestMillTool(maxDiameterMm?: number): Tool | null {
        const mills = Array.from(this.toolsMap.values())
            .filter(t => t.type === 'mill')
            .sort((a, b) => b.diameter - a.diameter);
        if (typeof maxDiameterMm === 'number' && Number.isFinite(maxDiameterMm) && maxDiameterMm > 0) {
            const fit = mills.find(m => m.diameter <= maxDiameterMm + 1e-4);
            if (fit) return fit;
        }
        return mills[0] || null;
    }
}
