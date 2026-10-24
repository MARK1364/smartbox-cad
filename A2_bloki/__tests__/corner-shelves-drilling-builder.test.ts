import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { buildCornerShelvesDrillings } from '../18_corner-shelves-drilling-builder.js';
import { SyncShelfDrillingsCommand } from '../commands/sync-shelf-drillings-command.js';

describe('Corner Shelves Drilling Builder (buildCornerShelvesDrillings)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    function setupCornerCabinetAndBlock(params: Record<string, any> = {}) {
        const cabinet = doc.createAssembly({ name: 'Rogowy90' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_rogowy90',
            liczba_stref: 1,
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600,
        };
        runEngineAndApply(cabinet, 900, 720, 900, 1, 0, 0, 0);

        const sb = doc.createAssembly({
            name: 'Polki_Narozne',
            width: mmToNm(900),
            height: mmToNm(684),
            depth: mmToNm(900),
        }, cabinet.id) as ContainerModel;

        sb.generatorParams = {
            type: 'blok_corner_shelves',
            liczba_polek: 1,
            wzor_nawiercen: 'SINGLE',
            odstep_otworow_przod_mm: 40,
            odstep_otworow_tyl_mm: 40,
            bok_lewy_mm: 600,
            bok_prawy_mm: 600,
            ...params,
        };

        return { cabinet, sb };
    }

    it('generuje otwory w trybie SINGLE (2 na BOK_L i 2 na BOK_P, brak na plecach)', () => {
        const { cabinet } = setupCornerCabinetAndBlock({
            liczba_polek: 1,
            wzor_nawiercen: 'SINGLE',
            odstep_otworow_przod_mm: 40,
            odstep_otworow_tyl_mm: 40,
        });

        const intents = buildCornerShelvesDrillings(doc, cabinet.id);
        // 1 półka * 2 boki * 2 otwory (przód + tył) = 4 otwory
        expect(intents).toHaveLength(4);

        for (const intent of intents) {
            expect(intent.feature.rule).toBe('shelf_pin');
            expect(intent.feature.generatedBy).toBe('blok_corner_shelves');
            expect(intent.feature.face).toBe('FACE_Z_PLUS');
            expect(intent.feature.params.isShelfDrilling).toBe(true);
            expect(intent.feature.params.diameter).toBe(5);
        }

        // Sprawdź czy otwory są przypisane do BOK_L i BOK_P
        const targetIds = new Set(intents.map(i => i.targetNodeId));
        expect(targetIds.size).toBe(2);
    });

    it('generuje otwory w trybie TRIPLE (6 na BOK_L i 6 na BOK_P)', () => {
        const { cabinet } = setupCornerCabinetAndBlock({
            liczba_polek: 1,
            wzor_nawiercen: 'TRIPLE',
            rozstaw_potrojny_z_mm: 32,
        });

        const intents = buildCornerShelvesDrillings(doc, cabinet.id);
        // 1 półka * 2 boki * 2 pozycje (przód, tył) * 3 otwory (środek, góra, dół) = 12
        expect(intents).toHaveLength(12);

        const leftIntents = intents.filter(i => i.feature.id.includes('left'));
        const rightIntents = intents.filter(i => i.feature.id.includes('right'));
        expect(leftIntents).toHaveLength(6);
        expect(rightIntents).toHaveLength(6);
    });

    it('generuje otwory w trybie SYSTEM_32 (rząd otworów)', () => {
        const { cabinet } = setupCornerCabinetAndBlock({
            wzor_nawiercen: 'SYSTEM_32',
            liczba_otworow_system32: 5,
            rozstaw_system32_mm: 32,
            start_system32_z_mm: 100,
        });

        const intents = buildCornerShelvesDrillings(doc, cabinet.id);
        // 5 otworów w rzędzie * 2 pozycje (przód, tył) * 2 boki = 20
        expect(intents).toHaveLength(20);

        for (const intent of intents) {
            expect(intent.feature.rule).toBe('shelf_pin');
            expect(intent.feature.drivenBy?.role).toBe('SYSTEM_HOLES');
        }
    });

    it('uwzględnia odsunięcie od frontu odsuniecie_przod_mm w pozycji otworu przedniego', () => {
        const { cabinet: cab0 } = setupCornerCabinetAndBlock({
            odsuniecie_przod_mm: 0,
            odstep_otworow_przod_mm: 40,
        });
        const intents0 = buildCornerShelvesDrillings(doc, cab0.id);
        const front0 = intents0.find(i => i.feature.id.includes('left_front'))!;

        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const { cabinet: cab1 } = setupCornerCabinetAndBlock({
            odsuniecie_przod_mm: 20,
            odstep_otworow_przod_mm: 40,
        });
        const intents1 = buildCornerShelvesDrillings(doc, cab1.id);
        const front1 = intents1.find(i => i.feature.id.includes('left_front'))!;

        // Otwór przedni z odsuniecie_przod_mm=20 powinien być cofnięty o 20mm
        expect(front1.feature.params.u).toBeCloseTo(front0.feature.params.u - 20, 1);
    });

    it('uwzględnia odsunięcie wewnętrznego lica pleców w pozycji otworu tylnego', () => {
        const { cabinet: cab0 } = setupCornerCabinetAndBlock({
            odstep_otworow_tyl_mm: 40,
            plecy_odsuniecie_x_mm: 0,
            plecy_odsuniecie_y_mm: 0,
        });
        const intents0 = buildCornerShelvesDrillings(doc, cab0.id);
        const backL0 = intents0.find(i => i.feature.id.includes('left_back'))!;
        const backR0 = intents0.find(i => i.feature.id.includes('right_back'))!;

        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const { cabinet: cab1 } = setupCornerCabinetAndBlock({
            odstep_otworow_tyl_mm: 40,
            plecy_odsuniecie_x_mm: 16,
            plecy_odsuniecie_y_mm: 16,
        });
        const intents1 = buildCornerShelvesDrillings(doc, cab1.id);
        const backL1 = intents1.find(i => i.feature.id.includes('left_back'))!;
        const backR1 = intents1.find(i => i.feature.id.includes('right_back'))!;

        // Na BOK_L: u rośnie od pleców w stronę frontu, więc u rośnie o 16 mm
        expect(backL1.feature.params.u).toBeCloseTo(backL0.feature.params.u + 16, 1);
        // Na BOK_P: u=pwP jest przy plecach, więc u maleje o 16 mm w stronę frontu
        expect(backR1.feature.params.u).toBeCloseTo(backR0.feature.params.u - 16, 1);
    });

    it('SyncShelfDrillingsCommand synchronizuje cechy obróbcze na formatkach korpusu', () => {
        const { cabinet } = setupCornerCabinetAndBlock({
            liczba_polek: 2,
            wzor_nawiercen: 'SINGLE',
        });

        const cmd = new SyncShelfDrillingsCommand(cabinet.id);
        cmd.execute(doc);

        const cabNode = doc.findNode(cabinet.id)!;
        let totalHolesFound = 0;
        const countHoles = (n: any) => {
            const features = n.domainData?.features || [];
            const shelfHoles = features.filter((f: any) => f.rule === 'shelf_pin' && f.params?.isShelfDrilling === true);
            totalHolesFound += shelfHoles.length;
            for (const ch of n.children || []) countHoles(ch);
        };
        countHoles(cabNode);

        // 2 półki * 4 otwory = 8 otworów
        expect(totalHolesFound).toBe(8);
    });
});
