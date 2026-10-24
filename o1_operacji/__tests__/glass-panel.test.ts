import { describe, it, expect, beforeEach } from 'vitest';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { applyLibraryOperation, syncGlassPanelForCutout } from '../operacje-apply.js';
import { resolveProcessingPath } from '../../A7_material/material-processing.js';

describe('GLASS_PANEL — generowanie i synchronizacja tafli szkła dla witryn', () => {
    let doc: ProjectDocument;
    let frontNode: CADNode;
    let frontPanel: PanelModel;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        frontPanel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Front_Witryny',
            engineManaged: false,
        });

        frontNode = new CADNode(frontPanel.id, frontPanel.name, NodeType.PART);
        frontNode.domainData = frontPanel;
        frontNode.role = 'FRONT';
        doc.addNode(doc.rootNode.id, frontNode);
    });

    it('tworzy część GLASS_PANEL w drzewie projektu gdy wycięcie ma fill: "glass"', () => {
        const feat = applyLibraryOperation(frontPanel, 'przetloczenie', 'FACE_Z_MINUS', {
            through: true,
            fill: 'glass',
        });

        expect(feat).not.toBeNull();
        expect(feat!.type).toBe('cutout');
        expect(feat!.params.fill).toBe('glass');

        // Sprawdź czy pod węzłem frontu w drzewie dokumentu powstała tafla szkła
        expect(frontNode.children).toHaveLength(1);
        const glassNode = frontNode.children[0];
        expect(glassNode.nodeType).toBe(NodeType.PART);
        expect(glassNode.role).toBe('GLASS_PANEL');
        expect(glassNode.name).toContain('Szkło');

        const glassData = glassNode.domainData as PanelModel;
        expect(glassData).toBeDefined();
        expect(nmToMm(glassData.width)).toBe(480);
        expect(nmToMm(glassData.height)).toBe(600);
        expect(nmToMm(glassData.thickness)).toBe(4);

        // Ścieżka technologiczna szklarza: GLASS_SHOP
        const route = resolveProcessingPath({
            nodeType: 'PART',
            role: glassNode.role,
            materialCategory: glassData.category,
        });
        expect(route).toBe('GLASS_SHOP');
    });

    it('usuwa taflę szkła gdy wycięcie przestaje mieć opcję fill: "glass"', () => {
        // 1. Dodaj wycięcie ze szkłem
        applyLibraryOperation(frontPanel, 'przetloczenie', 'FACE_Z_MINUS', {
            through: true,
            fill: 'glass',
        });
        expect(frontNode.children).toHaveLength(1);

        // 2. Przełącz na ramkę bez szkła (przetłoczenie z dnem)
        applyLibraryOperation(frontPanel, 'przetloczenie', 'FACE_Z_MINUS', {
            through: false,
            fill: undefined,
        });

        // Tafla szkła powinna zostać usunięta
        expect(frontNode.children).toHaveLength(0);
    });

    it('aktualizuje wymiary szkła po zmianie wymiarów wycięcia ramiaka', () => {
        // 1. Początkowe odsadzenia l=60, r=60 -> szerokość 480
        applyLibraryOperation(frontPanel, 'przetloczenie', 'FACE_Z_MINUS', {
            through: true,
            fill: 'glass',
            insets: { l: 60, r: 60, t: 60, b: 60 },
        });

        const glassNode = frontNode.children[0];
        expect(nmToMm((glassNode.domainData as any).width)).toBe(480);

        // 2. Zmiana odsadzeń l=100, r=100 -> szerokość 400
        applyLibraryOperation(frontPanel, 'przetloczenie', 'FACE_Z_MINUS', {
            through: true,
            fill: 'glass',
            insets: { l: 100, r: 100, t: 60, b: 60 },
        });

        expect(frontNode.children).toHaveLength(1);
        expect(nmToMm((glassNode.domainData as any).width)).toBe(400);
    });

    it('wylicza precyzyjne współrzędne 3D (loc) środka tafli szkła dla asymetrycznego wycięcia', () => {
        applyLibraryOperation(frontPanel, 'przetloczenie', 'FACE_Z_MINUS', {
            through: true,
            fill: 'glass',
            insets: { l: 100, r: 60, t: 60, b: 60 },
        });

        const glassNode = frontNode.children[0];
        expect(glassNode).toBeDefined();

        // Front 600x720, grubość 18mm. Na FACE_Z_MINUS:
        // u = 100, width = 440 -> uc = 320.
        // v = 60, length = 600 -> vc = 360.
        // origin = [300, -360, -9], uAxis = [-1, 0, 0], vAxis = [0, 1, 0], normal = [0, 0, -1]
        // posX = 300 - 320 = -20
        // posY = -360 + 360 = 0
        // posZ = -9 - (-1) * 9 = 0 (środek grubości formatki)
        expect(nmToMm(glassNode.loc.x)).toBe(-20);
        expect(nmToMm(glassNode.loc.y)).toBe(0);
        expect(nmToMm(glassNode.loc.z)).toBe(0);

        const glassData = glassNode.domainData as any;
        expect(glassData.position).toEqual({ x: -20, y: 0, z: 0 });
    });
});
