import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { probeBayFromCADPoint } from '../../A2_bloki/02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../../A2_bloki/02_bloki-bay-actions.js';
import { SyncShelfDrillingsCommand } from '../../A2_bloki/commands/sync-shelf-drillings-command.js';
import { SyncDoorDrillingsCommand } from '../../A2_bloki/commands/sync-door-drillings-command.js';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';
import { WcsManager } from '../wcs/wcs-manager.js';
import { WcsRulesMapper } from '../wcs/wcs-rules-mapper.js';
import { CAMProcessor } from '../processor/cam-processor.js';
import { ToolLibrary } from '../processor/tool-library.js';
import { Mach3Postprocessor } from '../postprocessors/mach3-postprocessor.js';
import { WoodWOPPostprocessor } from '../postprocessors/woodwop-postprocessor.js';
import { SCMPostprocessor } from '../postprocessors/scm-postprocessor.js';
import { BiessePostprocessor } from '../postprocessors/biesse-postprocessor.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

describe('CNC Right Panel generation', () => {
    it('generuje obróbkę CNC dla prawego boku z 3 otworami na półkę', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();

        // 1. Korpus 2500x800x560
        new CreateKorpusCommand({
            szerokosc_mm: 800,
            wysokosc_mm: 2500,
            glebokosc_mm: 560,
            liczba_stref: 1
        } as any).execute(doc);

        const cabinet = doc.getContainers()[0];
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1250 });
        expect(bay).not.toBeNull();

        // 2. Wstaw półki z wzorem 'TRIPLE' (po 3 otwory pod każdą półkę)
        const shelvesOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SHELVES')!;
        createBlokInDetectedBay(doc, bay!, shelvesOpt, {
            liczba_polek: 5,
            wzor_nawiercen: 'TRIPLE',
            rozstaw_potrojny_z_mm: 32,
            odsuniecie_przod_mm: 20
        });

        // 3. Wstaw drzwi dwuskrzydłowe
        const doorsOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'DOORS')!;
        createBlokInDetectedBay(doc, bay!, doorsOpt, {
            rodzaj_drzwi: 'DOUBLE',
            szczelina_mm: 3
        });

        // 4. Synchronizacja nawierceń w korpusie
        new SyncShelfDrillingsCommand(cabinet.id).execute(doc);
        new SyncDoorDrillingsCommand(cabinet.id).execute(doc);

        // 5. Znajdź prawy bok
        const rightPanelNode = doc.getPanels().find(p => (p.domainData as any)?.role === 'RIGHT_SIDE_PANEL');
        expect(rightPanelNode).toBeDefined();
        const rightPanel = rightPanelNode!.domainData as any;

        const pW = nmToMm(rightPanel.width);
        const pH = nmToMm(rightPanel.height);
        const pT = nmToMm(rightPanel.thickness);

        const shelfFeatures = rightPanel.features.filter((f: any) => f.params?.isShelfDrilling);
        const doorFeatures = rightPanel.features.filter((f: any) => f.params?.isDoorDrilling);

        console.log(`\n=== FORMATKA: ${rightPanel.name} ===`);
        console.log(`Wymiary: ${pW} x ${pH} x ${pT} mm`);
        console.log(`Otwory pod półki (TRIPLE): ${shelfFeatures.length} otworów (5 półek x 3 otwory x 2 rzędy)`);
        console.log(`Otwory pod zawiasy: ${doorFeatures.length} otworów`);

        // 6. Ekstrakcja CAM i WCS
        const extractor = new GeometryDataExtractor();
        const wcs = new WcsManager('G55');
        const dims = { width: pW, height: pH, thickness: pT };
        const rule = WcsRulesMapper.getRuleForRole(rightPanel.role);
        expect(rule).not.toBeNull();
        wcs.updateForPanelDimensions(dims.width, dims.height, dims.thickness);
        wcs.setRule(rule!);

        const toolLib = new ToolLibrary();
        const extracted = extractor.extractPanelFeatures(rightPanel);
        const camFeatures = extracted.features.filter((f: any) => 'diameter' in f);
        for (const f of camFeatures) {
            const matched = toolLib.findBestHoleTool((f as any).diameter);
            if (matched) {
                (f as any).toolId = matched.id;
            } else {
                throw new Error(`Brak narzędzia dla średnicy ${(f as any).diameter}`);
            }
        }

        // 7. Procesor CAM -> CLData -> Postprocesor G-code
        const processor = new CAMProcessor(toolLib);
        const camInput = {
            projectName: 'Szafa_Bok_Prawy',
            wcsOrigin: wcs.getOrigin(),
            wcsName: wcs.getWcsName(),
            features: camFeatures,
            toolAssignments: {},
            postprocessor: 'Mach3',
            workpieceDimensions: dims
        };

        const clProgram = processor.buildCLProgram(camInput);
        const drillCycles = clProgram.commands.filter(c => c.type === 'CYCLE_DRILL');
        console.log(`Liczba cykli wiercenia w CLData: ${drillCycles.length}`);

        const mach3Post = new Mach3Postprocessor();
        const gcode = mach3Post.generateNcCode(clProgram);

        console.log('\n--- G-CODE (MACH3 / ISO) ---');
        console.log(gcode);

        const woodwop = new WoodWOPPostprocessor();
        const mpr = woodwop.generateNcCode(clProgram);
        console.log('\n--- WOODWOP (.MPR) ---');
        console.log(mpr);

        const projectRoot = path.resolve(__dirname, '../../');
        fs.writeFileSync(path.join(projectRoot, 'Bok_Prawy.tap'), gcode, 'utf-8');
        fs.writeFileSync(path.join(projectRoot, 'Bok_Prawy.nc'), gcode, 'utf-8');
        fs.writeFileSync(path.join(projectRoot, 'Bok_Prawy.mpr'), mpr, 'utf-8');

        expect(shelfFeatures.length).toBe(30); // 5 półek x 3 otwory x 2 rzędy = 30 otworów
        expect(drillCycles.length).toBe(shelfFeatures.length + doorFeatures.length);
        expect(gcode).toContain('G81');
        expect(gcode).toContain('G55');
    });
});
