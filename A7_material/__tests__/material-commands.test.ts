import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { AssignMaterialCommand, SetEdgeBandingCommand } from '../material-commands.js';
import { MaterialItem } from '../material-types.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { initializeSmartFrameEngine, rebuildSmartFrameContainer } from '../../A3_smartframe/smartframe-adapter.js';
import * as smartFrameAdapter from '../../A3_smartframe/smartframe-adapter.js';
import { update_bloki_core } from '../../A2_bloki/01_bloki-core.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';

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

    it('rolls back material and thickness if rebuilding a container fails and does not add the command to undo history', () => {
        const container = doc.createAssembly({ name: 'Szafka' });
        container.width = mmToNm(1000);
        container.height = mmToNm(2000);
        container.depth = mmToNm(600);
        container.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        rebuildSmartFrameContainer(container);

        const cntNode = doc.findNode(container.id)!;
        const sideNode = cntNode.children.find((child: any) => child.domainData?.role === 'LEFT_SIDE_PANEL')!;
        const panel = sideNode.domainData as PanelModel;
        const previousMaterialId = panel.materialId;
        const previousThickness = panel.thickness;
        const history = new CommandHistory(doc);
        const rebuildSpy = vi.spyOn(smartFrameAdapter, 'rebuildSmartFrameContainer')
            .mockImplementationOnce(() => {
                throw new Error('forced rebuild failure');
            });

        try {
            const command = new AssignMaterialCommand(sideNode.id, mat28, 'SINGLE');
            expect(() => history.execute(command)).toThrow('forced rebuild failure');
            expect(history.canUndo).toBe(false);
            expect(panel.materialId).toBe(previousMaterialId);
            expect(panel.thickness).toBe(previousThickness);
            expect(panel.custom_properties?.thickness_mm).toBe(18);
            expect(cntNode.children.find((child: any) => child.domainData?.role === 'BOTTOM_PANEL')?.domainData?.width)
                .toBe(mmToNm(964));
        } finally {
            rebuildSpy.mockRestore();
        }
    });

    it('restores the applied material and keeps the undo entry when rebuilding fails during undo', () => {
        const container = doc.createAssembly({ name: 'Szafka' });
        container.width = mmToNm(1000);
        container.height = mmToNm(2000);
        container.depth = mmToNm(600);
        container.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        rebuildSmartFrameContainer(container);

        const cntNode = doc.findNode(container.id)!;
        const sideNode = cntNode.children.find((child: any) => child.domainData?.role === 'LEFT_SIDE_PANEL')!;
        const panel = sideNode.domainData as PanelModel;
        const bottomNode = cntNode.children.find((child: any) => child.domainData?.role === 'BOTTOM_PANEL')!;
        const history = new CommandHistory(doc);
        const command = new AssignMaterialCommand(sideNode.id, mat28, 'SINGLE');
        history.execute(command);

        const rebuildSpy = vi.spyOn(smartFrameAdapter, 'rebuildSmartFrameContainer')
            .mockImplementationOnce(() => {
                throw new Error('forced undo rebuild failure');
            });

        try {
            expect(() => history.undo()).toThrow('forced undo rebuild failure');
            expect(history.canUndo).toBe(true);
            expect(history.canRedo).toBe(false);
            expect(panel.materialId).toBe(mat28.id);
            expect(panel.thickness).toBe(mmToNm(28));
            expect(panel.custom_properties?.thickness_mm).toBe(28);
            expect(bottomNode.domainData?.width).toBe(mmToNm(954));
        } finally {
            rebuildSpy.mockRestore();
        }

        expect(history.undo()).toBe(true);
        expect(panel.materialId).toBe(mat18.id);
        expect(panel.thickness).toBe(mmToNm(18));
        expect(bottomNode.domainData?.width).toBe(mmToNm(964));
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(true);
    });

    it('prefers technical panel roles over names when deciding whether panels are backs', () => {
        const target = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'PLECY - etykieta użytkownika'
        }) as PanelModel;
        const targetNode = doc.findNode(target.id)!;
        target.role = 'LEFT_SIDE_PANEL';

        const back = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Bok - etykieta użytkownika'
        }) as PanelModel;
        const backNode = doc.findNode(back.id)!;
        back.role = 'BACK_PANEL';

        const command = new AssignMaterialCommand(targetNode.id, mat28, 'PROJECT');
        command.execute(doc);

        expect(target.materialId).toBe(mat28.id);
        expect(back.materialId).toBe(mat18.id);
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

        const roleMismatchPanel = doorUndo.domainData as PanelModel;
        roleMismatchPanel.role = 'LEFT_SIDE_PANEL';
        roleMismatchPanel.name = 'DRZWI - etykieta użytkownika';
        new AssignMaterialCommand(doorUndo.id, mat28, 'SINGLE').execute(doc);
        expect(sb.generatorParams.grubosc_frontu_mm).toBeUndefined();
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
        expect(panel.edgeBandingUserDefined).toBe(false);
    });

    it('regeneracja korpusu (zmiana wymiaru) nie usuwa ręcznie nadanych obrzeży', () => {
        const container = doc.createAssembly({ name: 'Szafka' });
        container.width = mmToNm(1000);
        container.height = mmToNm(2000);
        container.depth = mmToNm(600);
        container.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        rebuildSmartFrameContainer(container);

        const cntNode = doc.findNode(container.id)!;
        const sideChild = cntNode.children.find((c: any) => c.domainData?.role === 'LEFT_SIDE_PANEL')!;
        const bottomChild = cntNode.children.find((c: any) => c.domainData?.role === 'BOTTOM_PANEL')!;
        const sidePanel = sideChild.domainData as PanelModel;
        const bottomPanel = bottomChild.domainData as PanelModel;

        new SetEdgeBandingCommand(sideChild.id, '-Y', { active: true, type_id: 'ABS_2x22', thickness_mm: 2 }, 'SINGLE').execute(doc);
        new SetEdgeBandingCommand(bottomChild.id, 'ALL', { active: false }, 'SINGLE').execute(doc);

        // Zmiana wymiaru korpusu → pełna regeneracja
        container.width = mmToNm(800);
        rebuildSmartFrameContainer(container);

        expect(sidePanel.edgeBanding['-Y']?.active).toBe(true);
        expect(sidePanel.edgeBanding['-Y']?.type_id).toBe('ABS_2x22');
        expect(Object.values(bottomPanel.edgeBanding).some((e: any) => e?.active)).toBe(false);
        expect(bottomPanel.width).toBe(mmToNm(764));
    });
});
