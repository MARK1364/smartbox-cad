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

    constructor(initialTools: Tool[] = DEFAULT_CNC_TOOLS) {
        for (const tool of initialTools) {
            this.toolsMap.set(tool.id, { ...tool, parameters: { ...tool.parameters } });
        }
    }

    public getAllTools(): Tool[] {
        return Array.from(this.toolsMap.values());
    }

    public getTool(id: string): Tool | undefined {
        return this.toolsMap.get(id);
    }

    public addOrUpdateTool(tool: Tool): void {
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
}
