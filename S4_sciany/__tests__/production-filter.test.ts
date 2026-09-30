import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ReportDataNormalizer } from '../../R1_reports/report-data-normalizer.js';
import { CreateSmartWallCommand } from '../commands/create-smartwall-command.js';
import { CreateSmartFloorCommand } from '../commands/create-smartfloor-command.js';
import { isExcludedFromProduction } from '../smartwall-types.js';

describe('S4 SmartWall production filters', () => {
    it('WALL + FLOOR PART nie trafiają do extractProjectData (raport / nest)', () => {
        const doc = new ProjectDocument();
        new CreateSmartWallCommand({ preset: 'rect', name: 'Pokój' }).execute(doc);
        const parts = doc.getContainers()[0].children.map((c) => c.domainData);
        expect(parts.length).toBe(5);
        expect(parts.every((p) => isExcludedFromProduction(p))).toBe(true);

        const extracted = ReportDataNormalizer.extractProjectData(doc);
        expect(extracted.panels).toHaveLength(0);
    });

    it('FLOOR (osobny kontener pod ROOM) też poza extractProjectData', () => {
        const doc = new ProjectDocument();
        new CreateSmartWallCommand({ preset: 'rect', name: 'Pokój' }).execute(doc);
        new CreateSmartFloorCommand({ name: 'Podłoga' }).execute(doc);
        expect(doc.getContainers()).toHaveLength(2);
        const floorParts = doc.getContainers()[1].children.map((c) => c.domainData);
        expect(floorParts).toHaveLength(1);
        expect(floorParts.every((p) => isExcludedFromProduction(p))).toBe(true);

        const extracted = ReportDataNormalizer.extractProjectData(doc);
        expect(extracted.panels).toHaveLength(0);
    });
});
