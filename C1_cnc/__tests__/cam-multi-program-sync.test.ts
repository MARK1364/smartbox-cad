import { describe, it, expect, vi } from 'vitest';
import { CAMSyncService } from '../core/cam-sync-service.js';
import { ToolLibrary } from '../processor/tool-library.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';

describe('C1_CNC: Multi-program Panel CAD/CAM Synchronization', () => {
    const toolLibrary = new ToolLibrary();
    const syncService = CAMSyncService.getInstance();

    it('synchronizuje WSZYSTKIE programy formatki z CAD, zachowując indywidualne bazy WCS każdego programu', () => {
        const doc = new ProjectDocument({ name: 'Multi Program CAM Test' });
        const cabinet = doc.createAssembly({ name: 'Szafka_Multi' }) as any;

        const panel = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(18),
            name: 'Bok_Lewy_Multi'
        }, cabinet.id) as any;
        panel.role = 'LEFT_SIDE_PANEL';

        // Początkowy stan CAD: jeden otwór mimośrodu
        panel.features = [
            {
                id: 'feat_cam_init_hole',
                type: 'hole',
                name: 'Otwór bazowy',
                face: 'FACE_Z_PLUS',
                params: { x: 50, y: 100, diameter: 15, depth: 13 }
            }
        ];

        // Formatka posiada DWA różne programy:
        // Program 1: naroże domyślne (cornerIndex = -1 / rola)
        // Program 2: naroże przeciwległe (cornerIndex = 3), nieaktywny!
        const prog1: any = {
            id: 'prog_side_a',
            name: 'Program Baza Główna',
            targetPanelId: panel.id,
            targetPanel: panel,
            wcsName: 'G55',
            cornerIndex: -1,
            isActive: true,
            features: [],
            toolAssignments: {}
        };
        const prog2: any = {
            id: 'prog_side_b',
            name: 'Program Baza Alternatywna',
            targetPanelId: panel.id,
            targetPanel: panel,
            wcsName: 'G56',
            cornerIndex: 3,
            isActive: false,
            features: [],
            toolAssignments: {}
        };

        panel.cncPrograms = [prog1, prog2];

        // Zsynchronizuj oba programy początkowo
        syncService.autoSynchronizeProgram(panel, prog1, toolLibrary);
        syncService.autoSynchronizeProgram(panel, prog2, toolLibrary);

        expect(prog1.features).toHaveLength(1);
        expect(prog2.features).toHaveLength(1);

        // Początkowa walidacja całego zakresu
        const scope = { type: 'CONTAINER', id: cabinet.id, name: 'Szafka_Multi' };
        let report = syncService.validateScope(scope, doc, toolLibrary);
        expect(report.hasDiscrepancies).toBe(false);

        // Użytkownik w CAD dodaje kolejną obróbkę (rowek LED)
        panel.features.push({
            id: 'feat_led_groove_new',
            type: 'groove',
            name: 'Rowek LED',
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

        // validateScope MUSI wykryć rozbieżność w programach formatki
        report = syncService.validateScope(scope, doc, toolLibrary);
        expect(report.hasDiscrepancies).toBe(true);
        expect(report.panelReports[0].isSynced).toBe(false);

        // autoSynchronizeScope synchronizuje CAŁY zakres
        const syncResult = syncService.autoSynchronizeScope(scope, doc, toolLibrary);
        expect(syncResult.updatedCount).toBe(1);

        // Kluczowa weryfikacja: OBA programy (zarówno aktywny prog1 jak i nieaktywny prog2)
        // zostały zaktualizowane i posiadają 2 cechy!
        expect(prog1.features).toHaveLength(2);
        expect(prog2.features).toHaveLength(2);

        // Weryfikacja niezależnych WCS:
        // Cechy w prog1 i prog2 mają współrzędne obliczone zgodnie z ich własnym narożem WCS!
        const prog1Hole = prog1.features[0];
        const prog2Hole = prog2.features[0];
        expect(prog1Hole).toBeDefined();
        expect(prog2Hole).toBeDefined();
        // Ponieważ prog2 ma cornerIndex = 3 (inny punkt bazowy niż prog1), współrzędne X/Y muszą się różnić!
        expect(prog1Hole.position.x !== prog2Hole.position.x || prog1Hole.position.y !== prog2Hole.position.y).toBe(true);

        // Po synchronizacji walidacja potwierdza pełną spójność
        const finalReport = syncService.validateScope(scope, doc, toolLibrary);
        expect(finalReport.hasDiscrepancies).toBe(false);
    });

    it('rollback transakcji w autoSynchronizeScope przywraca stan wszystkich programów formatki w razie błędu', () => {
        const doc = new ProjectDocument({ name: 'Multi Program Rollback Test' });
        const cabinet = doc.createAssembly({ name: 'Szafka_Rollback' }) as any;

        const panelValid = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(18),
            name: 'Bok_OK'
        }, cabinet.id) as any;

        panelValid.features = [
            { id: 'f1', type: 'hole', params: { x: 50, y: 50, diameter: 5, depth: 13 } }
        ];

        const progA: any = { id: 'prog_a', isActive: true, features: [], toolAssignments: {} };
        const progB: any = { id: 'prog_b', isActive: false, features: [], toolAssignments: {} };
        panelValid.cncPrograms = [progA, progB];

        syncService.autoSynchronizeProgram(panelValid, progA, toolLibrary);
        syncService.autoSynchronizeProgram(panelValid, progB, toolLibrary);

        const progAOrigFeatures = progA.features;
        const progBOrigFeatures = progB.features;

        // Dodajemy nową cechę do panelValid
        panelValid.features.push({ id: 'f2', type: 'hole', params: { x: 100, y: 50, diameter: 5, depth: 13 } });

        // Dodajemy drugą formatkę z błędnymi wymiarami
        const panelBroken = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(18),
            name: 'Bok_Broken'
        }, cabinet.id) as any;
        panelBroken.thickness = 0;
        panelBroken.cncPrograms = [{ id: 'prog_broken', isActive: true, features: [], toolAssignments: {} }];

        const notifySpy = vi.spyOn(doc, 'notifyDocumentChanged');

        expect(() => syncService.autoSynchronizeScope(
            { type: 'CONTAINER', id: cabinet.id, name: 'Szafka_Rollback' },
            doc,
            toolLibrary
        )).toThrow(/poprawnych wymiarów/);

        // OBA programy panelu valid muszą powrócić do oryginalnego stanu przed synchronizacją!
        expect(progA.features).toBe(progAOrigFeatures);
        expect(progA.features).toHaveLength(1);
        expect(progB.features).toBe(progBOrigFeatures);
        expect(progB.features).toHaveLength(1);
        expect(notifySpy).not.toHaveBeenCalled();
    });
});
