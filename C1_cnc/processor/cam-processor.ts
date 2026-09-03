/**
 * SmartPanel Web — C1_CNC CAM Processor
 * 
 * Procesor CAM przygotowujący i optymalizujący operacje CNC przed przekazaniem do postprocesorów.
 */

import {
    CAMProject,
    CAMFeature,
    HoleFeature,
    GrooveFeature,
    ContourFeature,
    CNCOperation,
    ProcessedCAMProject,
    Tool,
    Vector3D
} from '../dto/cam-dto.js';
import { ToolLibrary } from './tool-library.js';
import { createVector3D, vecDistance, vecSub, vecNormalize, vecScale, calculateRadiusOffsetPath, generateEffectiveContourPath } from '../geometry/cnc-geometry-utils.js';

export interface AssignmentIssues {
    unassignedHolesMm: Record<number, number>;
    unassignedGrooves: number;
    unassignedContours: number;
    totalUnassigned: number;
}

export class CAMProcessor {
    private toolLibrary: ToolLibrary;
    private lastAssignmentIssues: AssignmentIssues = {
        unassignedHolesMm: {},
        unassignedGrooves: 0,
        unassignedContours: 0,
        totalUnassigned: 0
    };

    constructor(toolLibrary?: ToolLibrary) {
        this.toolLibrary = toolLibrary || new ToolLibrary();
    }

    public getLastAssignmentIssues(): AssignmentIssues {
        return { ...this.lastAssignmentIssues };
    }

    /**
     * Główny punkt wejścia procesora CAM: przygotowuje projekt do generowania G-kodu.
     */
    public processProject(project: CAMProject): ProcessedCAMProject {
        const featuresWithTools = this.assignToolsToFeatures(project.features);
        this.collectAssignmentIssues(featuresWithTools);

        const optimizedFeatures = this.optimizeFeatureOrder(featuresWithTools);
        const operations = this.createCncOperations(optimizedFeatures, project.wcsOrigin);

        return {
            projectName: project.projectName,
            wcsOrigin: project.wcsOrigin,
            wcsName: project.wcsName || "G55",
            operations,
            postprocessor: project.postprocessor || "Mach3"
        };
    }

    /**
     * Przygotowuje kopie cech. NIE przypisuje automatycznie narzędzi —
     * każda cecha musi mieć jawnie ustawiony toolId przez użytkownika.
     * Cechy bez toolId zostaną pominięte w generowaniu operacji.
     */
    public assignToolsToFeatures(features: CAMFeature[]): CAMFeature[] {
        return features.map(feat => JSON.parse(JSON.stringify(feat)));
    }

    private collectAssignmentIssues(features: CAMFeature[]): void {
        const holesMm: Record<number, number> = {};
        let unassignedGrooves = 0;
        let unassignedContours = 0;

        for (const feat of features) {
            if (!feat.toolId || !this.toolLibrary.getTool(feat.toolId)) {
                if ('diameter' in feat) {
                    const hole = feat as HoleFeature;
                    const dia = Math.round(hole.diameter * 10) / 10;
                    const count = hole.holeCount || (hole.positions ? hole.positions.length : 1);
                    holesMm[dia] = (holesMm[dia] || 0) + count;
                } else if ('startPoint' in feat) {
                    unassignedGrooves++;
                } else if ('points' in feat) {
                    unassignedContours++;
                }
            }
        }

        const totalHoles = Object.values(holesMm).reduce((a, b) => a + b, 0);
        this.lastAssignmentIssues = {
            unassignedHolesMm: holesMm,
            unassignedGrooves,
            unassignedContours,
            totalUnassigned: totalHoles + unassignedGrooves + unassignedContours
        };
    }

    /**
     * Optymalizuje kolejność obróbki: grupowanie według narzędzia + algorytm Nearest Neighbor.
     */
    public optimizeFeatureOrder(features: CAMFeature[]): CAMFeature[] {
        if (!features || features.length === 0) return [];

        const byTool: Map<string, CAMFeature[]> = new Map();
        for (const f of features) {
            const tid = f.toolId || "unassigned";
            if (!byTool.has(tid)) byTool.set(tid, []);
            byTool.get(tid)!.push(f);
        }

        const optimizedAll: CAMFeature[] = [];

        const getPos = (feat: CAMFeature) => {
            if ('position' in feat) return feat.position;
            if ('startPoint' in feat) return feat.startPoint;
            if ('points' in feat && feat.points.length > 0) return feat.points[0];
            return createVector3D();
        };

        for (const [_, group] of byTool.entries()) {
            const unvisited = [...group];
            let currentPos = createVector3D(0, 0, 0); // Baza WCS

            while (unvisited.length > 0) {
                let nearestIdx = 0;
                let nearestDist = vecDistance(getPos(unvisited[0]), currentPos);

                for (let i = 1; i < unvisited.length; i++) {
                    const d = vecDistance(getPos(unvisited[i]), currentPos);
                    if (d < nearestDist) {
                        nearestDist = d;
                        nearestIdx = i;
                    }
                }

                const selected = unvisited.splice(nearestIdx, 1)[0];
                optimizedAll.push(selected);
                currentPos = getPos(selected);
            }
        }

        return optimizedAll;
    }

    /**
     * Tworzy ostateczną listę operacji CNCOperation.
     */
    private createCncOperations(features: CAMFeature[], wcsOrigin: Vector3D): CNCOperation[] {
        const operations: CNCOperation[] = [];

        for (const feature of features) {
            if (!feature.toolId) continue;
            const tool = this.toolLibrary.getTool(feature.toolId);
            if (!tool) continue;

            const feed = tool.parameters.feedRate || 1000;
            const rpm = tool.parameters.spindleRpm || 3000;

            if ('position' in feature) {
                const hole = feature as HoleFeature;
                const positions = (hole.positions && hole.positions.length > 0) ? hole.positions : [hole.position];
                
                for (const pos of positions) {
                    operations.push({
                        type: 'drill',
                        toolId: hole.toolId!,
                        position: {
                            x: pos.x,
                            y: pos.y,
                            z: pos.z
                        },
                        parameters: {
                            diameter: hole.diameter,
                            depth: -Math.abs(hole.depth),
                            feedRate: feed,
                            spindleRpm: rpm,
                            retractR: hole.retractR || 5.0
                        }
                    });
                }
            } else if ('startPoint' in feature) {
                const groove = feature as GrooveFeature;
                let s = {
                    x: groove.startPoint.x,
                    y: groove.startPoint.y,
                    z: groove.startPoint.z
                };
                let e = {
                    x: groove.endPoint.x,
                    y: groove.endPoint.y,
                    z: groove.endPoint.z
                };

                if (groove.reverseDirection) {
                    const temp = s;
                    s = e;
                    e = temp;
                }

                const dx = e.x - s.x;
                const dy = e.y - s.y;
                const dz = e.z - s.z;
                const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (len > 0) {
                    const nx = dx / len;
                    const ny = dy / len;
                    const nz = dz / len;

                    const leadIn = groove.leadIn || 0;
                    const leadOut = groove.leadOut || 0;

                    s.x -= nx * leadIn;
                    s.y -= ny * leadIn;
                    s.z -= nz * leadIn;

                    e.x += nx * leadOut;
                    e.y += ny * leadOut;
                    e.z += nz * leadOut;
                }

                operations.push({
                    type: 'contour',
                    toolId: groove.toolId!,
                    position: s,
                    parameters: {
                        width: groove.width,
                        depth: typeof groove.depth === 'number' && groove.depth !== 0 ? (groove.depth < 0 ? groove.depth : -groove.depth) : -Math.abs(groove.depth),
                        feedRate: feed,
                        spindleRpm: rpm,
                        moves: [
                            { type: 'line', endPoint: e }
                        ]
                    }
                });
            } else if ('points' in feature) {
                const contour = feature as ContourFeature;
                if (contour.points.length >= 2) {
                    const toolRadius = tool.diameter / 2;
                    const effectivePts = generateEffectiveContourPath(
                        contour.points,
                        contour.leadIn || 0,
                        contour.leadOut || 0,
                        contour.compensation || 'Center',
                        toolRadius,
                        contour.reverseDirection || false
                    );

                    // Frezowanie 2.5D: Z jest stałe na całej ścieżce (kontrolowane przez depth).
                    // Spłaszczamy Z punktów do 0, głębokość aplikuje symulator jako offset.
                    const flatZ = 0;

                    const start = {
                        x: effectivePts[0].x,
                        y: effectivePts[0].y,
                        z: flatZ
                    };
                    const moves = effectivePts.slice(1).map(pt => ({
                        type: 'line' as const,
                        endPoint: {
                            x: pt.x,
                            y: pt.y,
                            z: flatZ
                        }
                    }));

                    operations.push({
                        type: 'contour',
                        toolId: contour.toolId!,
                        position: start,
                        parameters: {
                            width: tool.diameter,
                            depth: typeof contour.depth === 'number' ? (contour.depth < 0 ? contour.depth : -contour.depth) : -18.0,
                            feedRate: feed,
                            spindleRpm: rpm,
                            moves
                        }
                    });
                }
            }
        }

        return operations;
    }
}
