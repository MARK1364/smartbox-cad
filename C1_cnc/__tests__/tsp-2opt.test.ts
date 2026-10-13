import { describe, it, expect } from 'vitest';
import {
    optimizePath2Opt,
    calculateOpenPathLength,
    createVector3D
} from '../geometry/cnc-geometry-utils.js';
import { Vector3D, CAMProject } from '../dto/cam-dto.js';
import { CAMProcessor } from '../processor/cam-processor.js';

describe('TSP 2-Opt Drilling Path Optimizer', () => {
    it('handles empty and small arrays without error', () => {
        expect(optimizePath2Opt([], p => p)).toEqual([]);
        const single = [{ x: 10, y: 20, z: 0 }];
        expect(optimizePath2Opt(single, p => p)).toEqual(single);
        const pair = [{ x: 0, y: 0, z: 0 }, { x: 50, y: 50, z: 0 }];
        expect(optimizePath2Opt(pair, p => p)).toEqual(pair);
    });

    it('untangles crossed paths into a shorter clean route', () => {
        // Punkty ułożone w prostokąt, ale w kolejności przekątnych (koperta/krzyżak X):
        // P0: (0, 0), P1: (100, 100), P2: (0, 100), P3: (100, 0)
        // Ścieżka X krzyżuje się i ma długość ~341 mm
        // Ścieżka obwodowa (0,0) -> (0,100) -> (100,100) -> (100,0) ma długość 300 mm
        const crossedPoints: Vector3D[] = [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 100, z: 0 },
            { x: 0, y: 100, z: 0 },
            { x: 100, y: 0, z: 0 }
        ];

        const startPt = { x: 0, y: 0, z: 0 };
        const initialLen = calculateOpenPathLength(crossedPoints, startPt);
        const optimized = optimizePath2Opt(crossedPoints, p => p, startPt);
        const optimizedLen = calculateOpenPathLength(optimized, startPt);

        expect(optimizedLen).toBeLessThan(initialLen);
        expect(optimized.length).toBe(crossedPoints.length);
        // Sprawdź czy wszystkie punkty pozostały w wynikowej tablicy
        for (const pt of crossedPoints) {
            expect(optimized.some(p => p.x === pt.x && p.y === pt.y)).toBe(true);
        }
    });

    it('significantly shortens zigzag travel across a grid of holes', () => {
        // Siatka 4x4 otworów co 50mm, podana w celowo przemieszanej / nieoptymalnej kolejności (np. skaczącej)
        const unoptimized: Vector3D[] = [];
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                // Dodajemy na przemian z różnych stron
                unoptimized.push({ x: (x % 2 === 0 ? x : 3 - x) * 50, y: (y % 2 === 0 ? 3 - y : y) * 50, z: 0 });
            }
        }

        const startPt = { x: 0, y: 0, z: 0 };
        const unoptimizedLen = calculateOpenPathLength(unoptimized, startPt);
        const optimized = optimizePath2Opt(unoptimized, p => p, startPt);
        const optimizedLen = calculateOpenPathLength(optimized, startPt);

        // 2-Opt powinien skrócić trasę o co najmniej 30%
        expect(optimizedLen).toBeLessThan(unoptimizedLen * 0.7);
        expect(optimized.length).toBe(16);
    });

    it('preserves generic object data associated with points', () => {
        interface CustomHole {
            id: string;
            dia: number;
            coords: Vector3D;
        }

        const holes: CustomHole[] = [
            { id: 'H1', dia: 5, coords: { x: 300, y: 100, z: 0 } },
            { id: 'H2', dia: 5, coords: { x: 10, y: 10, z: 0 } },
            { id: 'H3', dia: 5, coords: { x: 300, y: 10, z: 0 } },
            { id: 'H4', dia: 5, coords: { x: 10, y: 100, z: 0 } }
        ];

        const start = { x: 0, y: 0, z: 0 };
        const optimized = optimizePath2Opt(holes, h => h.coords, start);

        expect(optimized[0].id).toBe('H2'); // Najbliżej (0,0)
        expect(optimized.map(h => h.id)).toHaveLength(4);
    });

    it('optimizes drilling order in CAMProcessor.processProject across multi-hole features', () => {
        const processor = new CAMProcessor();

        // 2 cechy otworów w przeciwległych kątach
        const project: CAMProject = {
            projectName: 'TestTSP',
            wcsName: 'G55',
            postprocessor: 'Mach3',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            features: [
                {
                    featureId: 'f1',
                    objectName: 'Panel1',
                    toolId: 'tool_2_drill_5',
                    diameter: 5,
                    depth: 13,
                    position: { x: 500, y: 500, z: 0 },
                    positions: [
                        { x: 500, y: 500, z: 0 },
                        { x: 500, y: 400, z: 0 }
                    ]
                },
                {
                    featureId: 'f2',
                    objectName: 'Panel1',
                    toolId: 'tool_2_drill_5',
                    diameter: 5,
                    depth: 13,
                    position: { x: 50, y: 50, z: 0 },
                    positions: [
                        { x: 50, y: 50, z: 0 },
                        { x: 50, y: 150, z: 0 }
                    ]
                }
            ],
            toolAssignments: {}
        };

        const ops = processor.processProject(project);
        expect(ops).toHaveLength(4);
        // Pierwsza operacja powinna zaczynać od punktu najbliższego WCS Origin (0,0), czyli (50, 50), a nie od (500, 500)
        expect(ops[0].position.x).toBe(50);
        expect(ops[0].position.y).toBe(50);
        expect(ops[1].position.x).toBe(50);
        expect(ops[1].position.y).toBe(150);
    });
});
