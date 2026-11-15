import { describe, it, expect, vi } from 'vitest';
import { CAMSyncService } from '../core/cam-sync-service.js';
import { MachiningRuleEngine } from '../rules/machining-rule-engine.js';
import { ToolLibrary, DEFAULT_CNC_TOOLS } from '../processor/tool-library.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';

describe('C1_CNC: MachiningRuleEngine & CAMSyncService', () => {
    const toolLibrary = new ToolLibrary();
    const syncService = CAMSyncService.getInstance();
    const ruleEngine = MachiningRuleEngine.getInstance();

    it('MachiningRuleEngine: dobiera wiertło fi 5 dla otworów półki i fi 8 dla kołków', () => {
        const shelfHole = {
            featureId: 'hole_5_13',
            name: 'Otwór półki',
            diameter: 5.0,
            depth: 13.0,
            position: { x: 50, y: 100, z: 0 },
            objectName: 'Bok'
        };

        const res5 = ruleEngine.resolveFeatureMachining(shelfHole as any, toolLibrary);
        expect(res5.tool).not.toBeNull();
        expect(res5.tool?.diameter).toBe(5.0);
        expect(res5.strategyId).toBe('drilling');

        const dowelHole = {
            featureId: 'hole_8_30',
            name: 'Kołek',
            diameter: 8.0,
            depth: 30.0,
            position: { x: 50, y: 50, z: 0 },
            objectName: 'Wieniec'
        };

        const res8 = ruleEngine.resolveFeatureMachining(dowelHole as any, toolLibrary);
        expect(res8.tool?.diameter).toBe(8.0);
        expect(res8.strategyId).toBe('drilling');
    });

    it('MachiningRuleEngine: dobiera wiertło poziome dla nawiertów w czołach (FACE_X / FACE_Y)', () => {
        const horizHole = {
            featureId: 'hole_edge_8',
            name: 'Kołek czołowy',
            diameter: 8.0,
            depth: 30.0,
            face: 'FACE_X_MINUS',
            position: { x: 0, y: 50, z: 9 },
            objectName: 'Wieniec'
        };

        const res = ruleEngine.resolveFeatureMachining(horizHole as any, toolLibrary);
        expect(res.tool).not.toBeNull();
        expect(res.tool?.diameter).toBe(8.0);
        expect(res.tool?.allowedAxes).toContain('X');
    });

    it('MachiningRuleEngine: dobiera piłę dla rowka pod plecy (szerokość 4mm)', () => {
        const backGroove = {
            featureId: 'groove_back',
            name: 'Wpust na plecy',
            width: 4.0,
            depth: 8.0,
            startPoint: { x: 0, y: 50, z: 0 },
            endPoint: { x: 600, y: 50, z: 0 },
            objectName: 'Bok'
        };

        const res = ruleEngine.resolveFeatureMachining(backGroove as any, toolLibrary);
        expect(res.tool).not.toBeNull();
        expect(res.tool?.type).toBe('groove');
    });

    it('MachiningRuleEngine: dobiera frez palcowy i strategię pocketing dla kanału LED (14x9mm)', () => {
        const ledGroove = {
            featureId: 'groove_led_01',
            name: 'Rowek pod LED',
            purpose: 'LED_CHANNEL',
            width: 14.0,
            depth: 9.0,
            startPoint: { x: 0, y: 50, z: 0 },
            endPoint: { x: 600, y: 50, z: 0 },
            objectName: 'Wieniec'
        };

        const res = ruleEngine.resolveFeatureMachining(ledGroove as any, toolLibrary);
        expect(res.tool).not.toBeNull();
        expect(res.tool?.type).toBe('mill');
        expect(res.tool?.diameter).toBeLessThanOrEqual(14.0);
        expect(res.strategyId).toBe('pocketing');
    });

    it('MachiningRuleEngine: purpose LED_CHANNEL rządzi, nie nazwa ani szerokość (wąski 6mm z tagiem -> frez)', () => {
        const lib6 = new ToolLibrary([
            ...DEFAULT_CNC_TOOLS,
            { id: 'tool_test_mill_6', name: 'Frez fi 6 mm', diameter: 6.0, type: 'mill', allowedAxes: ['X', 'Y', 'Z'], parameters: { feedRate: 1200, spindleRpm: 6000 } } as any,
        ]);
        const narrowLedGroove = {
            featureId: 'groove_led_narrow',
            name: 'Wpust 6mm',
            purpose: 'LED_CHANNEL',
            width: 6.0,
            depth: 9.0,
            startPoint: { x: 0, y: 50, z: 0 },
            endPoint: { x: 600, y: 50, z: 0 },
            objectName: 'Bok'
        };

        const res = ruleEngine.resolveFeatureMachining(narrowLedGroove as any, lib6);
        expect(res.tool).not.toBeNull();
        expect(res.tool?.type).toBe('mill');
        expect(res.tool?.diameter).toBe(6.0);
    });

    it('MachiningRuleEngine: wąski rowek bez purpose idzie na piłę mimo nazwy z LED', () => {
        const narrowNamedGroove = {
            featureId: 'groove_plain_6',
            name: 'Rowek pod LED',
            width: 4.0,
            depth: 8.0,
            startPoint: { x: 0, y: 50, z: 0 },
            endPoint: { x: 600, y: 50, z: 0 },
            objectName: 'Bok'
        };

        const res = ruleEngine.resolveFeatureMachining(narrowNamedGroove as any, toolLibrary);
        expect(res.tool).not.toBeNull();
        expect(res.tool?.type).toBe('groove');
    });

    it('CAMSyncService: wykrywa brakujący kanał LED gdy do formatki dodano rowek po utworzeniu programu CNC', () => {
        // Formatka z początkowo 2 otworami półki
        const panel: any = {
            id: 'panel_wieniec_01',
            name: 'Wieniec Dolny',
            width: mmToNm(600),
            height: mmToNm(500),
            thickness: mmToNm(18),
            features: [
                {
                    id: 'feat_hole_1',
                    type: 'hole',
                    name: 'Nawiert mimośrodu',
                    face: 'FACE_Z_PLUS',
                    params: { x: 50, y: 100, diameter: 15, depth: 13 }
                }
            ]
        };

        // Tworzymy program CNC dla bieżącego stanu
        const prog = syncService.autoSynchronizeProgram(panel, null, toolLibrary);
        expect(prog.features.length).toBe(1);

        // Początkowo program jest w 100% zsynchronizowany
        let report = syncService.comparePanelWithProgram(panel, prog, toolLibrary);
        expect(report.isSynced).toBe(true);
        expect(report.missingInCam.length).toBe(0);

        // Symulacja użytkownika / silnika LED: dodano rowek pod LED do formatki w CAD!
        panel.features.push({
            id: 'groove_led_999',
            type: 'groove',
            name: 'Rowek pod LED',
            face: 'FACE_Z_PLUS',
            params: {
                u: 0,
                v: 50,
                width: 14,
                length: 600,
                depth: 9,
                source: 'assembly_led_channel'
            }
        });

        // Weryfikacja: CAMSyncService MUSI natychmiast wykryć rozbieżność i zgłosić brakujący kanał LED!
        report = syncService.comparePanelWithProgram(panel, prog, toolLibrary);
        expect(report.isSynced).toBe(false);
        expect(report.missingInCam.length).toBe(1);
        expect(report.discrepancies.length).toBe(1);
        expect(report.discrepancies[0].description).toContain('Rowek pod LED');
        expect(report.discrepancies[0].suggestedToolName).toBeDefined();

        // Uruchomienie autoSynchronizeProgram: program zostaje zaktualizowany
        syncService.autoSynchronizeProgram(panel, prog, toolLibrary);
        expect(prog.features.length).toBe(2);

        // Po synchronizacji status to isSynced === true
        const syncAfter = syncService.comparePanelWithProgram(panel, prog, toolLibrary);
        expect(syncAfter.isSynced).toBe(true);
        expect(syncAfter.missingInCam.length).toBe(0);
    });

    it('CAMSyncService: autoSynchronizeProgram nie dopisuje nowego programu poza historią komend', () => {
        const panel: any = {
            id: 'panel_no_program',
            name: 'Formatka bez programu',
            width: mmToNm(600),
            height: mmToNm(500),
            thickness: mmToNm(18),
            features: [
                { id: 'h1', type: 'hole', params: { x: 50, y: 50, diameter: 5, depth: 13 } }
            ]
        };

        const prog = syncService.autoSynchronizeProgram(panel, null, toolLibrary);

        // Program jest tylko zbudowany — formatka nie może zostać zmieniona po cichu.
        expect(prog.features.length).toBe(1);
        expect(panel.cncPrograms).toBeUndefined();
    });

    it('CAMSyncService: validateScope poprawnie weryfikuje zakres szafki i wykrywa formatki wymagające aktualizacji', () => {
        const panel1: any = {
            id: 'p1',
            name: 'Bok Lewy',
            width: mmToNm(720),
            height: mmToNm(500),
            thickness: mmToNm(18),
            features: [
                { id: 'h1', type: 'hole', params: { x: 50, y: 50, diameter: 5, depth: 13 } }
            ]
        };
        const panel2: any = {
            id: 'p2',
            name: 'Wieniec Dolny',
            width: mmToNm(600),
            height: mmToNm(500),
            thickness: mmToNm(18),
            features: [
                { id: 'led1', type: 'groove', name: 'Rowek pod LED', params: { width: 14, depth: 9 } }
            ]
        };

        const mockDoc: any = {
            getPanels: () => [
                { domainData: panel1 },
                { domainData: panel2 }
            ]
        };

        // panel1 ma utworzony program CNC
        panel1.cncPrograms = [syncService.autoSynchronizeProgram(panel1, null, toolLibrary)];
        // panel2 nie ma programu CNC

        // Dodajemy nową cechę do panel1 (np. LED zewnętrzny (kanał) dodany do formatki z programem)
        panel1.features.push({ id: 'led_p1', type: 'groove', name: 'Rowek pod LED', params: { width: 14, depth: 9 } });

        // Weryfikacja: tylko panel1 z utworzonym programem ma rozbieżność (brakujący kanał LED)
        const scopeRep = syncService.validateScope({ type: 'PROJECT', id: 'ALL', name: 'Cały projekt' }, mockDoc, toolLibrary);
        expect(scopeRep.hasDiscrepancies).toBe(true);
        expect(scopeRep.totalDiscrepancyCount).toBe(1);

        // Auto-synchronizacja aktualizuje tylko utworzony program panel1
        const syncRes = syncService.autoSynchronizeScope({ type: 'PROJECT', id: 'ALL', name: 'Cały projekt' }, mockDoc, toolLibrary);
        expect(syncRes.updatedCount).toBe(1);

        // Ponowna walidacja - wszystko spójne!
        const scopeRepAfter = syncService.validateScope({ type: 'PROJECT', id: 'ALL', name: 'Cały projekt' }, mockDoc, toolLibrary);
        expect(scopeRepAfter.hasDiscrepancies).toBe(false);
        expect(scopeRepAfter.totalDiscrepancyCount).toBe(0);
    });

    it('CAMSyncService: zakres korpusu jest liczony z aktualnego drzewa CAD po reparentNode', () => {
        const doc = new ProjectDocument({ name: 'Reparent CAM' });
        const cabA = doc.createAssembly({ name: 'Korpus A' }) as any;
        const cabB = doc.createAssembly({ name: 'Korpus B' }) as any;
        const panel = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Bok przenoszony'
        }, cabA.id) as any;

        const scopeA = { type: 'CONTAINER', id: cabA.id, name: 'Korpus A' };
        const scopeB = { type: 'CONTAINER', id: cabB.id, name: 'Korpus B' };

        // Pierwsze rozwiązanie zakresu nie może zapisywać przynależności w PanelModel.
        expect(syncService.resolvePanelsForScope(scopeA, doc)).toContain(panel);
        expect((panel as any).parent).toBeUndefined();

        // Raport czyta aktualną nazwę korpusu, a nie zapamiętany wcześniej snapshot.
        const program: any = { id: 'prog_reparent_test', features: [] };
        expect(syncService.comparePanelWithProgram(panel, program, toolLibrary).containerName).toBe('Korpus A');
        cabA.name = 'Korpus A po zmianie';
        expect(syncService.comparePanelWithProgram(panel, program, toolLibrary).containerName).toBe('Korpus A po zmianie');

        // Reparenting zmienia wyłącznie drzewo CAD — resolver ma to natychmiast uwzględnić.
        doc.reparentNode(panel.id, cabB.id);

        expect(syncService.resolvePanelsForScope(scopeA, doc)).not.toContain(panel);
        expect(syncService.resolvePanelsForScope(scopeB, doc)).toContain(panel);
        expect(syncService.comparePanelWithProgram(panel, program, toolLibrary).containerName).toBe('Korpus B');
        expect((panel as any).parent).toBeUndefined();
    });

    it('CAMSyncService: raport pokazuje korpus nadrzędny, a nie pośrednie złożenie', () => {
        const doc = new ProjectDocument({ name: 'Nested CAM' });
        const cabinet = doc.createAssembly({ name: 'Korpus Główny' }) as any;
        const nested = doc.createAssembly({ name: 'Złożenie pośrednie' }, cabinet.id) as any;
        const panel = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Półka w złożeniu'
        }, cabinet.id) as any;

        doc.reparentNode(panel.id, nested.id);

        const program: any = { id: 'prog_nested_test', features: [] };
        panel.cncPrograms = [program];

        const scope = { type: 'CONTAINER', id: cabinet.id, name: 'Korpus Główny' };
        const validation = syncService.validateScope(scope, doc, toolLibrary);

        expect(validation.panelReports).toHaveLength(1);
        expect(validation.panelReports[0].containerName).toBe('Korpus Główny');
        expect(syncService.comparePanelWithProgram(panel, program, toolLibrary).containerName).toBe('Korpus Główny');
    });

    it('CAMSyncService: autoSynchronizeScope rollbackuje zmiany i nie powiadamia przy błędzie', () => {
        const doc = new ProjectDocument({ name: 'Rollback CAM' });
        const cabinet = doc.createAssembly({ name: 'Korpus Rollback' }) as any;

        const panel1 = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Formatka poprawna'
        }, cabinet.id) as any;
        panel1.features.push({
            id: 'h1',
            type: 'hole',
            name: 'Otwór początkowy',
            face: 'FACE_Z_PLUS',
            params: { x: 50, y: 100, diameter: 15, depth: 13 }
        });
        const prog1 = syncService.autoSynchronizeProgram(panel1, null, toolLibrary);
        const originalFeatures = prog1.features;
        const originalToolAssignments = prog1.toolAssignments;
        panel1.features.push({
            id: 'h2',
            type: 'hole',
            name: 'Otwór dodany później',
            face: 'FACE_Z_PLUS',
            params: { x: 80, y: 100, diameter: 5, depth: 13 }
        });

        const panel2 = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Formatka z błędem'
        }, cabinet.id) as any;
        panel2.thickness = 0;
        const prog2: any = { id: 'prog_invalid', features: [], toolAssignments: {}, isActive: true };
        panel2.cncPrograms = [prog2];

        const notifySpy = vi.spyOn(doc, 'notifyDocumentChanged');

        expect(() => syncService.autoSynchronizeScope(
            { type: 'PROJECT', id: 'ALL', name: 'Cały projekt' },
            doc,
            toolLibrary
        )).toThrow(/poprawnych wymiarów/);

        // Panel1 był już przetworzony przed błędem — musi wrócić do stanu początkowego.
        expect(prog1.features).toBe(originalFeatures);
        expect(prog1.features).toHaveLength(1);
        expect(prog1.toolAssignments).toBe(originalToolAssignments);
        expect(prog2.features).toEqual([]);
        expect(notifySpy).not.toHaveBeenCalled();
    });

    it('MachiningRuleEngine: zwraca tool: null zamiast pierwszego narzędzia z biblioteki, gdy brak pasującego narzędzia', () => {
        const sawOnlyLib = new ToolLibrary([
            { id: 'tool_1_saw_150', name: 'Piła 150', diameter: 150, type: 'groove', allowedAxes: ['X'], parameters: { feedRate: 2000, spindleRpm: 4000 } } as any
        ]);

        const holeRes = ruleEngine.resolveFeatureMachining({
            featureId: 'h_unmatched',
            name: 'Otwór 35',
            diameter: 35,
            depth: 13,
            position: { x: 50, y: 50, z: 0 },
            objectName: 'Front'
        } as any, sawOnlyLib);
        expect(holeRes.tool).toBeNull();

        // Frez palcowy nie może być po cichu przypisany jako wiertło (strategyId: 'drilling') do otworu
        const millOnlyLib = new ToolLibrary([
            { id: 'tool_mill_8', name: 'Frez 8mm', diameter: 8, type: 'mill', allowedAxes: ['X', 'Y', 'Z'], parameters: { feedRate: 2000, spindleRpm: 18000 } } as any
        ]);
        const holeWithMillLibRes = ruleEngine.resolveFeatureMachining({
            featureId: 'h_no_drill_only_mill',
            name: 'Otwór 15',
            diameter: 15,
            depth: 12,
            position: { x: 50, y: 50, z: 0 },
            objectName: 'Bok'
        } as any, millOnlyLib);
        expect(holeWithMillLibRes.tool).toBeNull();

        // Wiertło pionowe (allowedAxes: ['Z']) nie może zostać przypisane do otworu poziomego (FACE_X / FACE_Y)
        const verticalDrillOnlyLib = new ToolLibrary([
            { id: 'tool_drill_8_v', name: 'Wiertło pionowe 8mm', diameter: 8, type: 'drill', allowedAxes: ['Z'], parameters: { feedRate: 1000, spindleRpm: 3000 } } as any
        ]);
        const horizHoleWithVerticalLibRes = ruleEngine.resolveFeatureMachining({
            featureId: 'h_horiz_no_h_drill',
            name: 'Otwór poziomy 8',
            diameter: 8,
            depth: 25,
            face: 'FACE_X_PLUS',
            position: { x: 300, y: 50, z: 0 },
            axis: { x: -1, y: 0, z: 0 },
            objectName: 'Wieniec'
        } as any, verticalDrillOnlyLib);
        expect(horizHoleWithVerticalLibRes.tool).toBeNull();
        expect(horizHoleWithVerticalLibRes.warning).toBeDefined();

        const grooveRes = ruleEngine.resolveFeatureMachining({
            featureId: 'g_unmatched',
            name: 'Kanał LED 14mm',
            purpose: 'LED_CHANNEL',
            width: 14,
            depth: 9,
            startPoint: { x: 0, y: 50, z: 0 },
            endPoint: { x: 500, y: 50, z: 0 },
            objectName: 'Wieniec'
        } as any, sawOnlyLib);
        expect(grooveRes.tool).toBeNull();

        const contourRes = ruleEngine.resolveFeatureMachining({
            featureId: 'c_unmatched',
            name: 'Kontur',
            depth: 18,
            points: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }],
            objectName: 'Bok'
        } as any, sawOnlyLib);
        expect(contourRes.tool).toBeNull();
    });

    it('wykrywa modyfikację analitycznych segmentów łukowych (segments) w ContourFeature', () => {
        const syncService = new CAMSyncService();

        const camContour = {
            featureId: 'contour_arc_1',
            name: 'Profil z łukiem',
            depth: 10,
            points: [
                { x: 50, y: 50, z: 0 },
                { x: 150, y: 50, z: 0 }
            ],
            segments: [
                {
                    type: 'ARC' as const,
                    start: { x: 50, y: 50, z: 0 },
                    end: { x: 150, y: 50, z: 0 },
                    center: { x: 100, y: 50, z: 0 },
                    radius: 50,
                    direction: 'CCW' as const,
                    plane: 'XY' as const
                }
            ]
        };

        const cadContourModified = {
            ...camContour,
            segments: [
                {
                    ...camContour.segments[0],
                    radius: 70 // <- zmiana promienia z 50 na 70
                }
            ]
        };

        const diffs = (syncService as any).getFeatureDifferences(cadContourModified, camContour, true);
        expect(diffs).toContain('segments');

        const identicalDiffs = (syncService as any).getFeatureDifferences(camContour, camContour, true);
        expect(identicalDiffs).toEqual([]);
    });
});
