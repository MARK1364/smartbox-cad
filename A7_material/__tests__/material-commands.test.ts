import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { AssignMaterialCommand, SetEdgeBandingCommand } from '../material-commands.js';
import { MaterialItem } from '../material-types.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { initializeSmartFrameEngine, rebuildSmartFrameContainer } from '../../A3_smartframe/smartframe-adapter.js';
import { update_bloki_core } from '../../A2_bloki/bloki-core.js';

describe('AssignMaterialCommand & SetEdgeBandingCommand', () => {
    let doc: ProjectDocument;

    const mat18: MaterialItem = {
        id: 'W1100_ST9_18',
        name: 'BiaĹ‚y Alpejski 18mm',
        code: 'W1100 ST9',
        category: 'PĹ‚yty laminowane',
        thickness_mm: 18,
        color: { r: 0.95, g: 0.95, b: 0.95 },
        hexColor: '#f2f2f2',
        price_per_m2: 65
    };

    const mat28: MaterialItem = {
        id: 'U708_ST9_28',
        name: 'Szary Jasny 28mm',
        code: 'U708 ST9',
        category: 'PĹ‚yty laminowane',
        thickness_mm: 28,
        color: { r: 0.6, g: 0.6, b: 0.6 },
        hexColor: '#999999',
        price_per_m2: 120
    };

    beforeEach(async () => {
        doc = new ProjectDocument({ name: 'Material Test' });
        ContextManager.instance.document = doc;
        await initializeSmartFrameEngine();
    });

    it('updates thickness, color and metadata on standalone panel', () => {
        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Formatka Wolna' }) as PanelModel;
        const node = doc.findNode(panel.id)!;

        const cmd = new AssignMaterialCommand(node.id, mat28, 'SINGLE');
        cmd.execute(doc);

        expect(panel.thickness).toBe(mmToNm(28));
        expect(panel.materialId).toBe('U708_ST9_28');
        expect(panel.materialName).toBe('Szary Jasny 28mm');
        expect(panel.color.r).toBeCloseTo(0.6);
        expect(panel.custom_properties?.thickness_mm).toBe(28);

        // Undo
        cmd.undo(doc);
        expect(panel.thickness).toBe(mmToNm(18));
        expect(panel.materialId).toBe('W1100_ST9_18');
        expect(panel.custom_properties?.thickness_mm).toBe(18);
    });

    it('updates thickness on panel inside a Korpus container and triggers rebuild', () => {
        const container = doc.createAssembly({ name: 'Szafka' });
        container.width = mmToNm(1000);
        container.height = mmToNm(2000);
        container.depth = mmToNm(600);
        container.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        rebuildSmartFrameContainer(container);

        const cntNode = doc.findNode(container.id)!;
        expect(cntNode.children.length).toBeGreaterThanOrEqual(4);

        // ZnajdĹş lewy bok
        const sideChild = cntNode.children.find((c: any) => c.domainData?.role === 'LEFT_SIDE_PANEL')!;
        expect(sideChild).toBeDefined();
        const sidePanel = sideChild.domainData as PanelModel;
        expect(sidePanel.thickness).toBe(mmToNm(18));

        // Przypisz materiaĹ‚ 28mm do lewego boku
        const cmd = new AssignMaterialCommand(sideChild.id, mat28, 'SINGLE');
        cmd.execute(doc);

        expect(sidePanel.thickness).toBe(mmToNm(28));
        expect(sidePanel.materialId).toBe('U708_ST9_28');
        expect(sidePanel.custom_properties?.material).toBe('U708_ST9_28');
        expect(sidePanel.custom_properties?.thickness_mm).toBe(28);

        // SprawdĹş czy wieniec dostosowaĹ‚ szerokoĹ›Ä‡ (W - 28 - 18 = 1000 - 46 = 954 mm)
        const bottomChild = cntNode.children.find((c: any) => c.domainData?.role === 'BOTTOM_PANEL')!;
        const bottomPanel = bottomChild.domainData as PanelModel;
        expect(bottomPanel.width).toBe(mmToNm(954));

        // Undo
        cmd.undo(doc);
        expect(sidePanel.thickness).toBe(mmToNm(18));
        expect(bottomPanel.width).toBe(mmToNm(964));
    });

    it('updates grubosc_frontu_mm on doors Bloki so rebuild keeps new thickness', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' });
        cabinet.width = mmToNm(600);
        cabinet.height = mmToNm(720);
        cabinet.depth = mmToNm(500);
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        rebuildSmartFrameContainer(cabinet);

        const cabNode = doc.findNode(cabinet.id)!;
        const leftNode = cabNode.children.find((c: any) => c.domainData?.role === 'LEFT_SIDE_PANEL')!;
        const rightNode = cabNode.children.find((c: any) => c.domainData?.role === 'RIGHT_SIDE_PANEL')!;
        expect(leftNode).toBeDefined();
        expect(rightNode).toBeDefined();

        const sb = doc.createAssembly({ name: 'blok_doors' });
        sb.width = mmToNm(564);
        sb.height = mmToNm(720);
        sb.depth = mmToNm(500);
        sb.generatorParams = {
            type: 'blok_doors',
            boxType: 'DOORS',
            rodzaj_drzwi: 'LEFT',
            parentContainerId: cabinet.id,
            width_mm: 564,
            height_mm: 720,
            depth_mm: 500,
            uzyj_zawias_1: false,
            uzyj_zawias_6: false,
            customReferences: {
                xMin: { panelId: leftNode.id, face: 'FACE_Z_PLUS' },
                xMax: { panelId: rightNode.id, face: 'FACE_Z_MINUS' }
            },
            disabledReferences: { yMin: true, yMax: true, zMin: true, zMax: true }
        };
        const sbNode = doc.findNode(sb.id)!;
        cabNode.addChild(sbNode);

        expect(update_bloki_core(sb, doc)).toBe(true);

        const doorChild = sbNode.children.find((c: any) => c.domainData?.role === 'FRONT');
        expect(doorChild).toBeDefined();
        const doorPanel = doorChild!.domainData as PanelModel;
        expect(doorPanel.thickness).toBe(mmToNm(18));

        const cmd = new AssignMaterialCommand(doorChild!.id, mat28, 'SINGLE');
        cmd.execute(doc);

        expect(sb.generatorParams.grubosc_frontu_mm).toBe(28);

        const doorAfter = sbNode.children.find((c: any) => c.domainData?.role === 'FRONT')!;
        expect((doorAfter.domainData as PanelModel).thickness).toBe(mmToNm(28));
        expect((doorAfter.domainData as PanelModel).materialId).toBe('U708_ST9_28');

        cmd.undo(doc);
        expect(sb.generatorParams.grubosc_frontu_mm).toBeUndefined();
        const doorUndo = sbNode.children.find((c: any) => c.domainData?.role === 'FRONT')!;
        expect((doorUndo.domainData as PanelModel).thickness).toBe(mmToNm(18));
    });

    it('applies edge banding and removes it correctly', () => {
        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Formatka' }) as PanelModel;
        const node = doc.findNode(panel.id)!;

        const edgeConfig = { active: true, type_id: 'ABS_1x22', name: 'ABS 1mm', thickness_mm: 1 };
        const setCmd = new SetEdgeBandingCommand(node.id, '+X', edgeConfig, 'SINGLE');
        setCmd.execute(doc);

        expect(panel.edgeBanding['+X']?.active).toBe(true);
        expect(panel.edgeBanding['+X']?.type_id).toBe('ABS_1x22');

        // Undo
        setCmd.undo(doc);
        expect(panel.edgeBanding['+X']).toBeUndefined();
    });
});
