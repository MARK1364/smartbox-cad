import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { runEngineAndApply } from '../smartframe-adapter.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('Panel Role and Zone Metadata in SmartFrame Container', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('assigns strict roles, zoneId, and zonePrefix on all generated panels for 3-zone cabinet', () => {
        const cabinet = doc.createContainer({ name: 'Szafa 3-strefowa' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 3 };

        runEngineAndApply(
            cabinet,
            mmToNm(1000),
            mmToNm(2400),
            mmToNm(600),
            3,
            mmToNm(500),
            mmToNm(1100)
        );

        const cntNode = doc.findNode(cabinet.id);
        expect(cntNode).toBeDefined();
        expect(cntNode!.children.length).toBeGreaterThan(0);

        const allowedRoles = new Set([
            'LEFT_SIDE_PANEL',
            'RIGHT_SIDE_PANEL',
            'BOTTOM_PANEL',
            'TOP_PANEL',
            'BACK_PANEL'
        ]);

        for (const childNode of cntNode!.children) {
            const panel = childNode.domainData as any;
            expect(panel).toBeDefined();
            expect(allowedRoles.has(panel.role), `Invalid role "${panel.role}" on panel "${panel.name}"`).toBe(true);
            expect(panel.zoneId).toBeDefined();
            expect(['SEKCJA_B', 'SEKCJA_M', 'SEKCJA_T']).toContain(panel.zoneId);
            expect(panel.zonePrefix).toBeDefined();
            expect(['B_', 'M_', 'T_']).toContain(panel.zonePrefix);
            expect(panel.key).toBeDefined();

            // Asercje LCS na PanelModel
            expect(panel.lcs, `Brak LCS na formatce ${panel.name}`).toBeDefined();
            expect(panel.lcs?.faces?.INNER).toBe('FACE_Z_PLUS');
            expect(panel.lcs?.faces?.OUTER).toBe('FACE_Z_MINUS');
            expect(panel.lcs?.mapping).toBeDefined();
            expect(panel.lcs?.rotation).toBeDefined();
        }

        // Test aktualizacji (drugie wywołanie runEngineAndApply)
        runEngineAndApply(
            cabinet,
            mmToNm(1200),
            mmToNm(2500),
            mmToNm(600),
            3,
            mmToNm(600),
            mmToNm(1200)
        );

        for (const childNode of cntNode!.children) {
            const panel = childNode.domainData as any;
            expect(allowedRoles.has(panel.role)).toBe(true);
            expect(['SEKCJA_B', 'SEKCJA_M', 'SEKCJA_T']).toContain(panel.zoneId);
            expect(panel.zonePrefix).toBeDefined();
            expect(panel.key).toBeDefined();
            expect(panel.lcs).toBeDefined();
            expect(panel.lcs?.faces?.INNER).toBe('FACE_Z_PLUS');
            expect(panel.lcs?.faces?.OUTER).toBe('FACE_Z_MINUS');
        }
    });

    it('assigns single zone SEKCJA_B with prefix B_ for 1-zone cabinet and stores LCS', () => {
        const cabinet = doc.createContainer({ name: 'Szafa 1-strefowa' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };

        runEngineAndApply(
            cabinet,
            mmToNm(800),
            mmToNm(2000),
            mmToNm(500),
            1
        );

        const cntNode = doc.findNode(cabinet.id);
        expect(cntNode).toBeDefined();
        expect(cntNode!.children.length).toBeGreaterThan(0);

        for (const childNode of cntNode!.children) {
            const panel = childNode.domainData as any;
            expect(panel.zoneId).toBe('SEKCJA_B');
            expect(panel.zonePrefix).toBe('B_');
            expect(panel.lcs).toBeDefined();
            expect(panel.lcs?.faces?.INNER).toBe('FACE_Z_PLUS');
            expect(panel.lcs?.faces?.OUTER).toBe('FACE_Z_MINUS');
        }
    });
});

