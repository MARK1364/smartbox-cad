/**
 * Testy weryfikujące spójność osi, głębokości i układu współrzędnych w module CNC (C1_cnc).
 * Pokrywa 5 punktów audytu spójności pipeline'u CAM:
 * 1. Przenoszenie osi wierceń bocznych do CNCOperation i CYCLE_DRILL w CLData
 * 2. Uwzględnianie głębokości cięcia wpustu w CLDataProgram
 * 3. Determinizm featureId (brak duplikatów przy ponownym wykrywaniu)
 * 4. Rekalkulacja współrzędnych po zmianie naroża/bazy WCS
 */

import { describe, it, expect } from 'vitest';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';
import { CAMProcessor } from '../processor/cam-processor.js';
import { WcsManager, retransformFeaturesToWcs } from '../wcs/wcs-manager.js';
import { HoleFeature, GrooveFeature, ContourFeature, CAMProject } from '../dto/cam-dto.js';
import { DrillingStrategy } from '../strategies/drilling-strategy.js';

function mockPanelWithEdgeHole() {
    return {
        name: 'Bok_L',
        width: 600 * 1_000_000,
        height: 720 * 1_000_000,
        thickness: 18 * 1_000_000,
        features: [
            {
                type: 'hole',
                face: 'FACE_X_MINUS',
                name: 'Kołek boczny',
                params: {
                    u: 9,
                    v: 100,
                    diameter: 8,
                    depth: 25,
                    faceType: 'EDGE'
                }
            }
        ],
        getFace: (name: string) => {
            if (name === 'FACE_X_MINUS') {
                return {
                    origin: [-300, -360, -9],
                    uAxis: [0, 0, 1],
                    vAxis: [0, 1, 0],
                    normal: [-1, 0, 0],
                    width: 18,
                    height: 720
                };
            }
            return {
                origin: [-300, -360, 9],
                uAxis: [1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, 1],
                width: 600,
                height: 720
            };
        }
    };
}

describe('C1_cnc — Audyt Spójności Pipeline CAM', () => {
    const extractor = new GeometryDataExtractor();
    const processor = new CAMProcessor();

    it('1. Wiercenia boczne zachowują wektor osi w CNCOperation oraz w CLData CYCLE_DRILL', () => {
        const panel = mockPanelWithEdgeHole();
        const extracted = extractor.extractPanelFeatures(panel, undefined, 'hole');
        expect(extracted.features.length).toBe(1);

        const hole = extracted.features[0] as HoleFeature;
        expect(hole.axis).toBeDefined();
        // Normalna ściany FACE_X_MINUS to [-1, 0, 0], więc wektor wiercenia w głąb materiału to [1, 0, 0]
        expect(hole.axis!.x).toBe(1);
        expect(hole.face).toBe('FACE_X_MINUS');

        hole.toolId = 'tool_7_drill_8_h';

        const project: CAMProject = {
            projectName: 'Test_Axis',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G55',
            features: [hole],
            toolAssignments: { [hole.featureId]: 'tool_7_drill_8_h' },
            postprocessor: 'Mach3'
        };

        const ops = processor.processProject(project);
        expect(ops.length).toBe(1);
        expect(ops[0].parameters.axis).toBeDefined();
        expect(ops[0].parameters.axis!.x).toBe(1);
        expect(ops[0].parameters.face).toBe('FACE_X_MINUS');

        const clProg = processor.buildCLProgram(project);
        const drillCmd = clProg.commands.find(c => c.type === 'CYCLE_DRILL');
        expect(drillCmd).toBeDefined();
        expect(drillCmd?.drillParams?.axis).toBeDefined();
        expect(drillCmd?.drillParams?.axis?.x).toBe(1);
        expect(drillCmd?.drillParams?.face).toBe('FACE_X_MINUS');
    });

    it('2. Głębokość wpustu jest poprawnie zaaplikowana do ścieżki skrawającej CLData', () => {
        const groove: GrooveFeature = {
            featureId: 'groove_test_1',
            name: 'Wpust pod plecy',
            objectName: 'Bok_L',
            face: 'FACE_Z_PLUS',
            width: 4,
            depth: 8,
            startPoint: { x: 50, y: 0, z: 18 },
            endPoint: { x: 50, y: 700, z: 18 },
            panelStartPoint: { x: 50, y: 0, z: 18 },
            panelEndPoint: { x: 50, y: 700, z: 18 },
            toolId: 'tool_4_mill_8'
        };

        const project: CAMProject = {
            projectName: 'Test_Groove_Depth',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G55',
            features: [groove],
            toolAssignments: { [groove.featureId]: 'tool_4_mill_8' },
            postprocessor: 'Mach3'
        };

        const ops = processor.processProject(project);
        expect(ops.length).toBe(1);
        // Na FACE_Z_PLUS zagłębienie o 8 mm w materiał to Z = 18 - 8 = 10 mm
        expect(ops[0].position.z).toBe(10);
        expect(ops[0].parameters.moves?.[0].endPoint.z).toBe(10);

        const clProg = processor.buildCLProgram(project);
        const gotoCommands = clProg.commands.filter(c => c.type === 'GOTO');
        expect(gotoCommands.length).toBeGreaterThanOrEqual(3);

        // Powinien być ruch zjazdu roboczego na głębokość cięcia 10 mm
        const cutGotos = gotoCommands.filter(c => c.point && Math.abs(c.point.z - 10) < 0.01);
        expect(cutGotos.length).toBeGreaterThanOrEqual(2);
    });

    it('3. Wykrywanie cech generuje deterministyczny featureId (brak duplikatów)', () => {
        const panel = mockPanelWithEdgeHole();
        
        // Dwa niezależne wywołania detekcji tej samej cechy bez ID źródłowego
        const res1 = extractor.extractPanelFeatures(panel, undefined, 'hole');
        const res2 = extractor.extractPanelFeatures(panel, undefined, 'hole');

        expect(res1.features.length).toBe(1);
        expect(res2.features.length).toBe(1);
        expect(res1.features[0].featureId).toBe(res2.features[0].featureId);
        expect(res1.features[0].featureId).not.toContain('NaN');
        expect(res1.features[0].featureId).not.toContain('undefined');
    });

    it('4. Zmiana bazy WCS poprawnie rekalkuluje współrzędne z panelPosition', () => {
        const wcsManager = new WcsManager();
        wcsManager.updateForPanelDimensions(600, 720, 18);
        
        // Naroże dolne lewe (-)
        wcsManager.setRule({
            origin_corner: { X: '-', Y: '-', Z: '-' },
            directions: { X: '+', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 0 }
        });

        const initialOrigin = wcsManager.getOrigin();
        expect(initialOrigin.x).toBe(-300);
        expect(initialOrigin.y).toBe(-360);

        const hole: HoleFeature = {
            featureId: 'hole_test_wcs',
            objectName: 'Formatka',
            diameter: 5,
            depth: 12,
            position: wcsManager.toWcsCoordinates({ x: -200, y: -260, z: 9 }),
            positions: [wcsManager.toWcsCoordinates({ x: -200, y: -260, z: 9 })],
            panelPosition: { x: -200, y: -260, z: 9 },
            panelPositions: [{ x: -200, y: -260, z: 9 }]
        };

        // Początkowa współrzędna w WCS (BL): (-200) - (-300) = 100
        expect(hole.position.x).toBe(100);

        // Zmiana naroża na dolne prawe (+ dla X, - dla Y)
        wcsManager.setRule({
            origin_corner: { X: '+', Y: '-', Z: '-' },
            directions: { X: '+', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 0 }
        });

        const retransformed = retransformFeaturesToWcs([hole], wcsManager);
        const updatedHole = retransformed[0] as HoleFeature;

        // Nowy origin.x = +300, więc nowa współrzędna to: (-200) - 300 = -500
        expect(updatedHole.position.x).toBe(-500);
        expect(updatedHole.positions?.[0].x).toBe(-500);
        // Zachowanie pozycji lokalnej formatki w panelPosition
        expect(updatedHole.panelPosition?.x).toBe(-200);
    });

    it('5. Wielokrotna zmiana WCS zachowuje panelAxis, panelNormal i panelPoints bez akumulacji błędu', () => {
        const wcsManager = new WcsManager();
        wcsManager.updateForPanelDimensions(600, 720, 18);

        const hole: HoleFeature = {
            featureId: 'hole_multitransform',
            objectName: 'Formatka',
            diameter: 8,
            depth: 25,
            position: { x: -300, y: 0, z: 0 },
            panelPosition: { x: -300, y: 0, z: 0 },
            axis: { x: 1, y: 0, z: 0 },
            panelAxis: { x: 1, y: 0, z: 0 }
        };

        const contour: any = {
            featureId: 'contour_multitransform',
            objectName: 'Formatka',
            depth: 18,
            points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }],
            panelPoints: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }]
        };

        // Krok 1: WCS z obrotem 90 stopni wokół Z
        wcsManager.setRule({
            origin_corner: { X: '-', Y: '-', Z: '-' },
            directions: { X: '+', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 90 }
        });

        const step1 = retransformFeaturesToWcs([hole, contour], wcsManager);
        const hole1 = step1[0] as HoleFeature;
        const contour1 = step1[1] as any;

        // panelAxis i panelPoints pozostają nienaruszone
        expect(hole1.panelAxis?.x).toBe(1);
        expect(contour1.panelPoints?.[1].x).toBe(100);

        // Krok 2: Druga zmiana WCS (reset do rotacji 0 stopni)
        wcsManager.setRule({
            origin_corner: { X: '-', Y: '-', Z: '-' },
            directions: { X: '+', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 0 }
        });

        const step2 = retransformFeaturesToWcs(step1, wcsManager);
        const hole2 = step2[0] as HoleFeature;
        const contour2 = step2[1] as any;

        // Oś wraca dokładnie do { x: 1, y: 0, z: 0 } bez akumulacji podwójnego obrotu
        expect(Math.round(hole2.axis!.x)).toBe(1);
        expect(Math.round(hole2.axis!.y)).toBe(0);
        expect(Math.round(contour2.points[1].x)).toBe(400); // 100 - (-300) = 400
    });

    it('6. Wpust na ściance bocznej (FACE_X_PLUS) zagłębia się wzdłuż osi normalnej ściany (X), nie Z', () => {
        const grooveSide: GrooveFeature = {
            featureId: 'groove_side_x',
            name: 'Wpust boczny',
            objectName: 'Formatka',
            face: 'FACE_X_PLUS',
            normal: { x: 1, y: 0, z: 0 },
            panelNormal: { x: 1, y: 0, z: 0 },
            width: 4,
            depth: 6,
            startPoint: { x: 300, y: 100, z: 0 },
            endPoint: { x: 300, y: 500, z: 0 },
            panelStartPoint: { x: 300, y: 100, z: 0 },
            panelEndPoint: { x: 300, y: 500, z: 0 },
            toolId: 'tool_4_mill_8'
        };

        const project: CAMProject = {
            projectName: 'Test_Side_Groove',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [grooveSide],
            toolAssignments: { [grooveSide.featureId]: 'tool_4_mill_8' },
            postprocessor: 'Mach3'
        };

        const ops = processor.processProject(project);
        expect(ops.length).toBe(1);
        const op = ops[0];
        // Normalna ściany FACE_X_PLUS to +X, więc zagłębienie o 6 mm w materiał to przesunięcie w kierunku -X
        // Pozycja X skrawania: 300 - 6 = 294 mm; poziom Z pozostaje nienaruszony (0)
        expect(op.position.x).toBe(294);
        expect(op.position.z).toBe(0);
        expect(op.parameters.moves?.[0].endPoint.x).toBe(294);
        expect(op.parameters.moves?.[0].endPoint.z).toBe(0);

        const clProg = processor.buildCLProgram(project);
        const cutMoves = clProg.commands.filter(c => c.type === 'GOTO' && c.point && Math.abs(c.point.x - 294) < 0.01);
        expect(cutMoves.length).toBeGreaterThanOrEqual(2);
    });

    it('7. Grupowanie otworów generuje deterministyczny featureId niezależnie od kolejności wejściowej', () => {
        const panelA = {
            name: 'Panel_A',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                { type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 200, diameter: 5, depth: 12 } },
                { type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 400, diameter: 5, depth: 12 } }
            ],
            getFace: () => ({ origin: [0, 0, 9], uAxis: [1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, 1], width: 600, height: 720 })
        };

        const panelB = {
            name: 'Panel_A',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                // Odwrócona kolejność otworów
                { type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 400, diameter: 5, depth: 12 } },
                { type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 200, diameter: 5, depth: 12 } }
            ],
            getFace: () => ({ origin: [0, 0, 9], uAxis: [1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, 1], width: 600, height: 720 })
        };

        const resA = extractor.extractPanelFeatures(panelA, undefined, 'hole');
        const resB = extractor.extractPanelFeatures(panelB, undefined, 'hole');

        expect(resA.features.length).toBe(1);
        expect(resB.features.length).toBe(1);
        expect(resA.features[0].featureId).toBe(resB.features[0].featureId);
    });

    it('8. Wybór strategyId w CAMProject kieruje generowanie CLData przez wybraną strategię', () => {
        const hole: HoleFeature = {
            featureId: 'hole_strat_test',
            objectName: 'Formatka',
            diameter: 8,
            depth: 25,
            position: { x: 100, y: 150, z: 0 },
            positions: [{ x: 100, y: 150, z: 0 }],
            toolId: 'tool_7_drill_8_h'
        };

        const projectWithStrategy: CAMProject = {
            projectName: 'Test_Strategy_Drill',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [hole],
            toolAssignments: { [hole.featureId]: 'tool_7_drill_8_h' },
            postprocessor: 'Mach3',
            strategyId: 'drilling_standard'
        };

        const clProg = processor.buildCLProgram(projectWithStrategy);
        expect(clProg.commands.some(c => c.type === 'COMMENT' && c.comment?.includes('Głębokość: 25mm'))).toBe(true);
        expect(clProg.commands.some(c => c.type === 'CYCLE_DRILL')).toBe(true);
    });

    it('9. DrillingStrategy generuje najazd i dno wzdłuż osi 3D dla wiercenia poziomego (oś X)', () => {
        const strategy = new DrillingStrategy();
        const hole: HoleFeature = {
            featureId: 'hole_side_x',
            objectName: 'Formatka',
            diameter: 8,
            depth: 30,
            position: { x: -300, y: 150, z: 0 },
            positions: [{ x: -300, y: 150, z: 0 }],
            axis: { x: 1, y: 0, z: 0 },
            retractR: 5
        };
        const tool = {
            id: 'tool_7_drill_8_h',
            name: 'Wiertło poziome fi 8',
            diameter: 8,
            type: 'drill' as const,
            parameters: { feedRate: 800, spindleRpm: 4500 }
        };

        const cmds = strategy.generateCLCommands(hole, tool, { x: 0, y: 0, z: 0 });
        const gotoCmds = cmds.filter((c: any) => c.type === 'GOTO');
        const drillCmd = cmds.find((c: any) => c.type === 'CYCLE_DRILL');

        expect(gotoCmds.length).toBeGreaterThanOrEqual(2);
        // Najazd przed ściankę: pt.x - dir.x * retractR = -300 - 1 * 5 = -305; Z pozostaje 0
        expect(gotoCmds[0].point.x).toBe(-305);
        expect(gotoCmds[0].point.z).toBe(0);

        // Dno otworu w głąb materiału: pt.x + dir.x * depth = -300 + 1 * 30 = -270; Z pozostaje 0
        expect(drillCmd).toBeDefined();
        expect(drillCmd.point.x).toBe(-270);
        expect(drillCmd.point.z).toBe(0);
        expect(drillCmd.drillParams.axis.x).toBe(1);
    });

    it('10. buildCLProgram przy wybranej strategii wiercenia zachowuje wpusty w programie (brak pomijania cech)', () => {
        const hole: HoleFeature = {
            featureId: 'hole_1',
            objectName: 'Formatka',
            diameter: 5,
            depth: 12,
            position: { x: 50, y: 100, z: 18 },
            positions: [{ x: 50, y: 100, z: 18 }],
            toolId: 'tool_7_drill_8_h'
        };
        const groove: GrooveFeature = {
            featureId: 'groove_1',
            objectName: 'Formatka',
            face: 'FACE_Z_PLUS',
            normal: { x: 0, y: 0, z: 1 },
            width: 4,
            depth: 8,
            startPoint: { x: 100, y: 0, z: 18 },
            endPoint: { x: 100, y: 500, z: 18 },
            toolId: 'tool_4_mill_8'
        };

        const project: CAMProject = {
            projectName: 'Test_Hybrid_Program',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [hole, groove],
            toolAssignments: {},
            postprocessor: 'Mach3',
            strategyId: 'drilling_standard'
        };

        const clProg = processor.buildCLProgram(project);
        // Sprawdzenie, że w wygenerowanym programie obecne są ZARÓWNO wiercenia, JAK I ruchy frezowania wpustu
        expect(clProg.commands.some(c => c.type === 'CYCLE_DRILL')).toBe(true);
        expect(clProg.commands.some(c => c.type === 'GOTO' && c.point && Math.abs(c.point.x - 100) < 0.01)).toBe(true);
        expect(clProg.commands[clProg.commands.length - 1].type).toBe('STOP');
    });

    it('11. Bezpieczny odjazd na FACE_Z_MINUS odjeżdża w dół (-Z), na zewnątrz materiału płyty', () => {
        const bottomGroove: GrooveFeature = {
            featureId: 'groove_bottom',
            objectName: 'Formatka',
            face: 'FACE_Z_MINUS',
            normal: { x: 0, y: 0, z: -1 },
            panelNormal: { x: 0, y: 0, z: -1 },
            width: 4,
            depth: 5,
            startPoint: { x: 100, y: 0, z: 0 },
            endPoint: { x: 100, y: 400, z: 0 },
            toolId: 'tool_4_mill_8'
        };

        const project: CAMProject = {
            projectName: 'Test_Bottom_Clearance',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [bottomGroove],
            toolAssignments: {},
            postprocessor: 'Mach3'
        };

        const clProg = processor.buildCLProgram(project);
        const firstGoto = clProg.commands.find(c => c.type === 'GOTO');
        expect(firstGoto).toBeDefined();
        // Dla powierzchni dolnej (Z=0) z normalną -Z punkt bezpieczny to Z = surface.z + norm.z * 5 = -5 mm (pod płytą)
        expect(firstGoto?.point.z).toBe(-5);
    });

    it('12. Grupowanie otworów z zadanym feat.id jest w 100% niezależne od kolejności wejściowej', () => {
        const panel1 = {
            name: 'Panel_With_Ids',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                { id: 'hole_alpha', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 100, diameter: 5, depth: 12 } },
                { id: 'hole_beta', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 500, diameter: 5, depth: 12 } }
            ],
            getFace: () => ({ origin: [0, 0, 9], uAxis: [1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, 1], width: 600, height: 720 })
        };

        const panel2 = {
            name: 'Panel_With_Ids',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                { id: 'hole_beta', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 500, diameter: 5, depth: 12 } },
                { id: 'hole_alpha', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 100, diameter: 5, depth: 12 } }
            ],
            getFace: () => ({ origin: [0, 0, 9], uAxis: [1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, 1], width: 600, height: 720 })
        };

        const res1 = extractor.extractPanelFeatures(panel1, undefined, 'hole');
        const res2 = extractor.extractPanelFeatures(panel2, undefined, 'hole');

        expect(res1.features.length).toBe(1);
        expect(res2.features.length).toBe(1);
        expect(res1.features[0].featureId).toBe(res2.features[0].featureId);
    });

    it('13. Ręczny profil z panelPoints zachowuje lokalną geometrię po wielokrotnej zmianie WCS', () => {
        const wcsManager = new WcsManager();
        wcsManager.updateForPanelDimensions(600, 720, 18);
        wcsManager.setRule({
            origin_corner: { X: '-', Y: '-', Z: '-' },
            directions: { X: '+', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 0 }
        });

        const localPoints = [
            { x: -200, y: -200, z: 9 },
            { x: -100, y: -200, z: 9 },
            { x: -100, y: -100, z: 9 }
        ];

        // Ręczne dodanie konturu z panelPoints (tak jak w CncPanel.tsx)
        const manualContour = {
            featureId: 'contour_manual_1',
            name: 'Profil ręczny',
            objectName: 'Formatka',
            points: localPoints.map(p => wcsManager.toWcsCoordinates(p)),
            panelPoints: localPoints.map(p => ({ ...p })),
            depth: 9
        };

        // Krok 1: WCS origin X: -300 -> wcsPoints[0].x = -200 - (-300) = 100
        expect(manualContour.points[0].x).toBe(100);

        // Krok 2: Zmiana WCS na narożnik górny prawy (+ +)
        wcsManager.setRule({
            origin_corner: { X: '+', Y: '+', Z: '+' },
            directions: { X: '+', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 0 }
        });

        const retransformed = retransformFeaturesToWcs([manualContour as any], wcsManager);
        const updated = retransformed[0] as any;

        // Nowy origin.x = +300 -> (-200) - 300 = -500
        expect(updated.points[0].x).toBe(-500);
        expect(updated.panelPoints[0].x).toBe(-200);

        // Krok 3: Ponowna zmiana WCS na dolny lewy (- -)
        wcsManager.setRule({
            origin_corner: { X: '-', Y: '-', Z: '-' },
            directions: { X: '+', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 0 }
        });

        const retransformed2 = retransformFeaturesToWcs(retransformed, wcsManager);
        const updated2 = retransformed2[0] as any;

        // Wraca dokładnie do 100 bez powtórnego nakładania transformacji WCS
        expect(updated2.points[0].x).toBe(100);
        expect(updated2.panelPoints[0].x).toBe(-200);
    });

    it('14. toPanelCoordinates stanowi ścisłą inwersję toWcsCoordinates dla obrotu i odbicia', () => {
        const wcsManager = new WcsManager();
        wcsManager.updateForPanelDimensions(600, 720, 18);
        wcsManager.setRule({
            origin_corner: { X: '+', Y: '-', Z: '-' },
            directions: { X: '-', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 45 }
        });

        const pOrigin = { x: -125.5, y: 210.75, z: 9 };
        const pWcs = wcsManager.toWcsCoordinates(pOrigin);
        const pBack = wcsManager.toPanelCoordinates(pWcs);

        expect(Math.abs(pBack.x - pOrigin.x)).toBeLessThan(1e-4);
        expect(Math.abs(pBack.y - pOrigin.y)).toBeLessThan(1e-4);
        expect(Math.abs(pBack.z - pOrigin.z)).toBeLessThan(1e-4);
    });

    it('15. buildCLProgram w trybie hybrydowym nie gubi cech bez przypisanego narzędzia', () => {
        const validHole: HoleFeature = {
            featureId: 'hole_valid',
            objectName: 'Formatka',
            diameter: 8,
            depth: 15,
            position: { x: 50, y: 100, z: 18 },
            positions: [{ x: 50, y: 100, z: 18 }],
            toolId: 'tool_7_drill_8_h'
        };

        const unassignedGroove: GrooveFeature = {
            featureId: 'groove_no_tool',
            objectName: 'Formatka',
            face: 'FACE_Z_PLUS',
            normal: { x: 0, y: 0, z: 1 },
            width: 4,
            depth: 8,
            startPoint: { x: 100, y: 0, z: 18 },
            endPoint: { x: 100, y: 500, z: 18 },
            toolId: null // Brak narzędzia
        };

        const project: CAMProject = {
            projectName: 'Test_No_Tool_Drop',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [validHole, unassignedGroove],
            toolAssignments: {},
            postprocessor: 'Mach3',
            strategyId: 'drilling_standard'
        };

        processor.buildCLProgram(project);
        const issues = processor.getLastAssignmentIssues();
        // Cecha bez narzędzia nie zniknęła po cichu — została odnotowana w problemach z przypisaniem
        expect(issues.unassignedGrooves).toBe(1);
        expect(issues.totalUnassigned).toBe(1);
    });

    it('16. toPanelVector stanowi ścisłą inwersję transformVector dla wektorów kierunkowych', () => {
        const wcsManager = new WcsManager();
        wcsManager.updateForPanelDimensions(600, 720, 18);
        wcsManager.setRule({
            origin_corner: { X: '+', Y: '-', Z: '-' },
            directions: { X: '-', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 45 }
        });

        const vPanel = { x: 0, y: 0, z: -1 };
        const vWcs = wcsManager.transformVector(vPanel);
        const vBack = wcsManager.toPanelVector(vWcs);

        expect(Math.abs(vBack.x - vPanel.x)).toBeLessThan(1e-4);
        expect(Math.abs(vBack.y - vPanel.y)).toBeLessThan(1e-4);
        expect(Math.abs(vBack.z - vPanel.z)).toBeLessThan(1e-4);
    });

    it('17. processProject uwzględnia strategyId i przekazuje parametry strategii do CNCOperation', () => {
        const hole: HoleFeature = {
            featureId: 'hole_strat_test',
            objectName: 'Formatka',
            diameter: 8,
            depth: 15,
            position: { x: 50, y: 100, z: 18 },
            positions: [{ x: 50, y: 100, z: 18 }],
            toolId: 'tool_7_drill_8_h'
        };

        const project: CAMProject = {
            projectName: 'Test_Strategy_In_Ops',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [hole],
            toolAssignments: {},
            postprocessor: 'Mach3',
            strategyId: 'drilling_standard'
        };

        const ops = processor.processProject(project);
        expect(ops.length).toBe(1);
        expect(ops[0].parameters.strategyId).toBe('drilling_standard');
    });

    it('18. processProject przy strategii frezowania kieszeni (pocketing_concentric) poprawnie ustawia parametry', () => {
        const groove: GrooveFeature = {
            featureId: 'groove_strat_test',
            objectName: 'Formatka',
            face: 'FACE_Z_PLUS',
            normal: { x: 0, y: 0, z: 1 },
            width: 6,
            depth: 10,
            startPoint: { x: 100, y: 100, z: 18 },
            endPoint: { x: 300, y: 100, z: 18 },
            toolId: 'tool_4_mill_8'
        };

        const project: CAMProject = {
            projectName: 'Test_Groove_Strategy',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [groove],
            toolAssignments: {},
            postprocessor: 'Mach3',
            strategyId: 'pocketing_concentric'
        };

        const ops = processor.processProject(project);
        expect(ops.length).toBe(1);
        expect(ops[0].parameters.strategyId).toBe('pocketing_concentric');
        expect(ops[0].parameters.feedRate).toBe(1500);
        expect(ops[0].parameters.spindleRpm).toBe(18000);
    });

    it('19. wielosegmentowy kontur generuje kolejne odcinki moves ze spójnymi współrzędnymi Z i punktami docelowymi', () => {
        const contour: ContourFeature = {
            featureId: 'contour_multiseg',
            objectName: 'Formatka',
            points: [
                { x: 0, y: 0, z: 18 },
                { x: 100, y: 0, z: 18 },
                { x: 100, y: 100, z: 18 },
                { x: 0, y: 100, z: 18 }
            ],
            toolId: 'tool_4_mill_8',
            depth: -5
        };

        const project: CAMProject = {
            projectName: 'Test_Multiseg_Contour',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [contour],
            toolAssignments: {},
            postprocessor: 'Mach3'
        };

        const ops = processor.processProject(project);
        expect(ops.length).toBe(1);
        const op = ops[0];
        expect(op.position.z).toBe(-5);
        expect(op.parameters.moves?.length).toBe(3);
        op.parameters.moves?.forEach(m => {
            expect(m.endPoint.z).toBe(-5);
        });
    });

    it('20. PocketingStrategy nie gubi cech konturowych - kontur trafia do wygenerowanego programu', () => {
        const contour: ContourFeature = {
            featureId: 'contour_pocket_safe',
            objectName: 'Formatka',
            points: [
                { x: 0, y: 0, z: 18 },
                { x: 200, y: 0, z: 18 },
                { x: 200, y: 200, z: 18 }
            ],
            toolId: 'tool_4_mill_8',
            depth: -5
        };

        const project: CAMProject = {
            projectName: 'Test_Pocket_Contour_Safety',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [contour],
            toolAssignments: {},
            postprocessor: 'Mach3',
            strategyId: 'pocketing_concentric'
        };

        const clProg = processor.buildCLProgram(project);
        // Kontur nie został zgubiony — program zawiera komendy skrawania dla tego konturu
        const gotoCmds = clProg.commands.filter(c => c.type === 'GOTO');
        expect(gotoCmds.length).toBeGreaterThanOrEqual(2);

        const ops = processor.processProject(project);
        expect(ops.length).toBe(1);
        expect(ops[0].type).toBe('contour');
    });

    it('21. ProfilingStrategy (profiling_25d) ze stepdownem generuje wielowarstwowe moves w CNCOperation identyczne z komendami CLData', () => {
        const contour: ContourFeature = {
            featureId: 'contour_stepdown',
            objectName: 'Formatka',
            points: [
                { x: 0, y: 0, z: 10 },
                { x: 100, y: 0, z: 10 }
            ],
            toolId: 'tool_4_mill_8',
            depth: 0 // Schodzimy z Z=10 do Z=0
        };

        const project: CAMProject = {
            projectName: 'Test_Profiling_Stepdown',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [contour],
            toolAssignments: {},
            postprocessor: 'Mach3',
            strategyId: 'profiling_25d',
            strategyParams: { stepdownMm: 4 }
        };

        const clProg = processor.buildCLProgram(project);
        const ops = processor.processProject(project);

        expect(ops.length).toBe(1);
        const op = ops[0];
        expect(op.parameters.strategyId).toBe('profiling_25d');
        expect(op.parameters.feedRate).toBe(2000);
        expect(op.parameters.spindleRpm).toBe(18000);

        const clGotoPoints = clProg.commands.filter(c => c.type === 'GOTO' && c.point).map(c => c.point!);
        // Wymuszony stepdown 4 mm daje rzeczywiste przejścia na Z=6, Z=2 i Z=0.
        expect(clGotoPoints.length).toBeGreaterThanOrEqual(8);
        expect(op.parameters.approachPoint).toEqual(clGotoPoints[0]);
        expect(op.parameters.retractPoint).toEqual(clGotoPoints[clGotoPoints.length - 1]);
        expect(op.position).toEqual(clGotoPoints[1]);
        expect([...new Set(clGotoPoints.filter(p => p.z <= 10 && p.z >= 0).map(p => p.z))]).toEqual([6, 2, 0]);

        // Moves odtwarza każdy punkt skrawania/przejścia między warstwami, bez safeZ na końcu.
        const expectedMovesCount = clGotoPoints.length - 3;
        expect(op.parameters.moves?.length).toBe(expectedMovesCount);
        expect(op.parameters.moves?.map(m => m.endPoint)).toEqual(clGotoPoints.slice(2, -1));
        expect(op.parameters.surfacePoint?.z).toBe(10);
    });

    it('22. Wiercenie ze strategii DrillingStrategy zachowuje pozycję na powierzchni materiału i nie podwaja głębokości', () => {
        const hole: HoleFeature = {
            featureId: 'hole_depth_check',
            objectName: 'Formatka',
            diameter: 8,
            depth: 15,
            position: { x: 50, y: 100, z: 18 },
            positions: [{ x: 50, y: 100, z: 18 }],
            axis: { x: 0, y: 0, z: -1 },
            toolId: 'tool_7_drill_8_h'
        };

        const project: CAMProject = {
            projectName: 'Test_Drill_Depth_Double_Fix',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G54',
            features: [hole],
            toolAssignments: {},
            postprocessor: 'Mach3',
            strategyId: 'drilling_standard'
        };

        const ops = processor.processProject(project);
        expect(ops.length).toBe(1);
        const op = ops[0];
        // Pozycja początkowa wiercenia w CNCOperation MUSI leżeć na powierzchni formatki (Z=18), a nie na dnie (Z=3)
        expect(op.position.z).toBe(18);
        expect(op.parameters.depth).toBe(-15);

        // Symulator oblicza koniec wiercenia jako: pos.z + dirZ * depth
        // Dla dirZ = -1 i depth = 15: endPos.z = 18 + (-1) * 15 = 3 (dokładnie dno otworu, brak podwojonej głębokości!)
        const simEndPosZ = op.position.z + (op.parameters.axis?.z ?? -1) * Math.abs(op.parameters.depth);
        expect(simEndPosZ).toBe(3);
    });
});
