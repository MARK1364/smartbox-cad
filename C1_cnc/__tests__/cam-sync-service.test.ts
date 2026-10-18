import { describe, it, expect } from 'vitest';
import { CAMSyncService } from '../core/cam-sync-service.js';
import { MachiningRuleEngine } from '../rules/machining-rule-engine.js';
import { ToolLibrary, DEFAULT_CNC_TOOLS } from '../processor/tool-library.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

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
            face: 'FACE_Z_MINUS',
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
});
