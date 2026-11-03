import { describe, it } from 'vitest';
import * as fs from 'fs';
import { ProjectDocument } from '../../A1_core/project-document';
import { ReportDataNormalizer } from '../../R1_reports/report-data-normalizer';
import { runNesting } from '../core/nesting-engine';
import { NestingPart, SheetConfig } from '../core/nesting-types';

describe('Szafa Nesting Layout Inspection', () => {
    it('prints board layouts', async () => {
        const jsonStr = fs.readFileSync('szafa_2500x800x560.spp.json', 'utf-8');
        const data = JSON.parse(jsonStr);
        const doc = new ProjectDocument({ name: 'Test' });
        doc.load(data);

        const repData = ReportDataNormalizer.extractProjectData(doc);
        const parts: NestingPart[] = repData.panels.map((p, idx) => ({
            id: p.part_id || `part_${idx}`,
            name: p.name || p.role || `part_${idx}`,
            width: p.length_mm,
            height: p.width_mm,
            thickness: p.thickness_mm,
            quantity: p.qty || 1,
            canRotate: true,
            material: p.material,
        }));

        const config: SheetConfig = { width: 2800, height: 2070, kerf: 4, trimMargin: 10 };
        const saw = await runNesting(parts, config, { machineType: 'saw', mode: 'fast' });
        console.log('=== SAW BOARDS LAYOUT ===');
        saw.boards.forEach((b, i) => {
            console.log(`Board ${i+1} (${b.material}, util: ${b.utilizationPercent.toFixed(1)}%):`);
            b.layout.forEach(p => console.log(`  ${p.name}: pos=(${p.x}, ${p.y}), size=(${p.w}x${p.h}), rotated=${p.rotated}, band=${p.band}`));
        });

        const cnc = await runNesting(parts, config, { machineType: 'cnc', mode: 'fast' });
        console.log('=== CNC BOARDS LAYOUT ===');
        cnc.boards.forEach((b, i) => {
            console.log(`Board ${i+1} (${b.material}, util: ${b.utilizationPercent.toFixed(1)}%):`);
            b.layout.forEach(p => console.log(`  ${p.name}: pos=(${p.x}, ${p.y}), size=(${p.w}x${p.h}), rotated=${p.rotated}`));
        });
    });
});
