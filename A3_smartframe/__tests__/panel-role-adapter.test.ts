import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { runEngineAndApply } from '../smartframe-adapter.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ContainerModel } from '../../A1_core/container-model.js';

describe('Panel Role and Zone Metadata in SmartFrame Container', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('assigns strict roles, zoneId, and zonePrefix on all generated panels for 3-zone cabinet', () => {
        const cabinet = doc.createAssembly({ name: 'Szafa 3-strefowa' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 3 };

        runEngineAndApply(
            cabinet,
            1000,
            2400,
            600,
            3,
            500,
            1100
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

        // Test aktualizacji (drugie wywoĹ‚anie runEngineAndApply)
        runEngineAndApply(
            cabinet,
            1200,
            2500,
            600,
            3,
            600,
            1200
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
        const cabinet = doc.createAssembly({ name: 'Szafa 1-strefowa' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };

        runEngineAndApply(
            cabinet,
            800,
            2000,
            500,
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

