import { describe, expect, it } from 'vitest';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { findCabinetPanel } from '../../A1_core/panel-lookup.js';
import {
    createDefaultLedChannel,
    LED_CHANNEL_SOURCE,
} from '../15_led-external-channel-types.js';
import {
    applyLedChannelToDocument,
    computeLedChannelWorldBox,
    removeLedChannelFromDocument,
    detectCabinetRow,
} from '../15_led-external-channel-engine.js';
import {
    LedChannelStore,
    handleLedChannelDrop,
    startGuidedLedPick,
    stopGuidedLedPick,
} from '../15_led-external-channel-store.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import '../../src/application/project-domain.js';

describe('LedChannelTool (Assembly Cut LED)', () => {
    it('tworzy domyĹ›lnÄ… definicjÄ™ kanaĹ‚u LED w mm', () => {
        const def = createDefaultLedChannel('test_led_1');
        expect(def.id).toBe('test_led_1');
        expect(def.enabled).toBe(true);
        expect(def.offsetFromFrontMm).toBe(50);
        expect(def.grooveWidthMm).toBe(14);
        expect(def.grooveDepthMm).toBe(9);
        expect(def.cutSides).toBe(true);
    });

    it('wylicza prostopadĹ‚oĹ›cian ciÄ™cia oraz aplikuje wpust do formatki', () => {
        const doc = new ProjectDocument();

        // StwĂłrz panel wieĹ„ca dolnego: 600 mm szerokoĹ›Ä‡ (X), 300 mm gĹ‚Ä™bokoĹ›Ä‡ (Y), 18 mm gruboĹ›Ä‡ (Z)
        const bottomPanel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(300),
            thickness: mmToNm(18),
            name: 'Wieniec Dolny',
            role: 'BOTTOM_PANEL',
        });
        const bottomNode = new CADNode(bottomPanel.id, 'Wieniec Dolny', NodeType.PART);
        bottomNode.domainData = bottomPanel;
        // Ustawienie poziome wieĹ„ca (rotacja 90 st. wokĂłĹ‚ X tak jak w korpusie meblowym)
        bottomNode.setLocalTransform(new Vec3(mmToNm(300), mmToNm(150), mmToNm(9)), Quat.fromEulerXYZ(Math.PI / 2, 0, 0));
        doc.addNode(doc.rootNode.id, bottomNode);

        // StwĂłrz bok lewy
        const leftPanel = new PanelModel({
            width: mmToNm(300),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Bok Lewy',
            role: 'LEFT_SIDE_PANEL',
        });
        const leftNode = new CADNode(leftPanel.id, 'Bok Lewy', NodeType.PART);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(9), mmToNm(150), mmToNm(360)), Quat.fromEulerXYZ(Math.PI / 2, 0, -Math.PI / 2));
        doc.addNode(doc.rootNode.id, leftNode);

        // StwĂłrz bok prawy
        const rightPanel = new PanelModel({
            width: mmToNm(300),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Bok Prawy',
            role: 'RIGHT_SIDE_PANEL',
        });
        const rightNode = new CADNode(rightPanel.id, 'Bok Prawy', NodeType.PART);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(591), mmToNm(150), mmToNm(360)), Quat.fromEulerXYZ(Math.PI / 2, 0, -Math.PI / 2));
        doc.addNode(doc.rootNode.id, rightNode);

        const def = createDefaultLedChannel('led_main');
        def.refLeft = { nodeId: leftNode.id, face: 'FACE_Z_MINUS', label: 'Bok L Â· Lewa' };
        def.refRight = { nodeId: rightNode.id, face: 'FACE_Z_MINUS', label: 'Bok P Â· Prawa' };
        def.refBottom = { nodeId: bottomNode.id, face: 'FACE_Z_MINUS', label: 'Wieniec Â· DĂłĹ‚' };
        def.refFront = { nodeId: bottomNode.id, face: 'FACE_Y_PLUS', label: 'Wieniec Â· PrzĂłd' };
        def.offsetFromFrontMm = 50;
        def.grooveWidthMm = 14;
        def.grooveDepthMm = 9;

        const box = computeLedChannelWorldBox(doc, def);
        expect(box).not.toBeNull();
        expect(box!.xMax).toBeGreaterThan(box!.xMin);
        expect(box!.yMax - box!.yMin).toBeCloseTo(14, 0.5); // Y = gĹ‚Ä™bokoĹ›Ä‡ (szerokoĹ›Ä‡ profilu 14 mm)
        expect(box!.zMax - box!.zMin).toBeCloseTo(9, 0.5);  // Z = wysokoĹ›Ä‡ (gĹ‚Ä™bokoĹ›Ä‡ rowka 9 mm)

        // Aplikacja do formatek
        const affected = applyLedChannelToDocument(doc, def);
        expect(affected).toBeGreaterThan(0);

        console.log('BOTTOM FEATURES:', JSON.stringify(bottomPanel.features, null, 2));
        console.log('LEFT FEATURES:', JSON.stringify(leftPanel.features, null, 2));
        console.log('RIGHT FEATURES:', JSON.stringify(rightPanel.features, null, 2));

        // SprawdĹş czy wieniec dolny otrzymaĹ‚ cechÄ™ groove
        const grooveBottom = bottomPanel.features.find((f: any) => f.params?.source === LED_CHANNEL_SOURCE);
        expect(grooveBottom).toBeDefined();
        expect(grooveBottom.type).toBe('groove');
        expect(grooveBottom.params.channel_id).toBe('led_main');
        expect(grooveBottom.params.depth).toBeCloseTo(9, 0.1);

        // Usuwanie cech
        removeLedChannelFromDocument(doc, 'led_main');
        const remaining = bottomPanel.features.filter((f: any) => f.params?.source === LED_CHANNEL_SOURCE);
        expect(remaining.length).toBe(0);
    });

    it('zarzÄ…dza stanem i serializacjÄ… w LedChannelStore', () => {
        const store = LedChannelStore.instance;
        const ch = store.addChannel('LED Szafki');
        expect(ch.name).toBe('LED Szafki');

        store.updateChannel(ch.id, { grooveWidthMm: 16 });
        expect(store.activeChannel?.grooveWidthMm).toBe(16);

        const serialized = store.serialize();
        expect(serialized.channels.length).toBeGreaterThan(0);

        store.removeChannel(ch.id);
        expect(store.channels.find((c) => c.id === ch.id)).toBeUndefined();
    });

    it('obsĹ‚uguje upuszczenie (handleLedChannelDrop) i sekwencyjny kreator', () => {
        const store = LedChannelStore.instance;
        const channel = store.getOrCreateDefault();

        const fakePanel = {
            id: 'p_bottom_wieniec',
            name: 'Wieniec Dolny 1',
        };
        const fakePick = {
            pickedMesh: {
                metadata: {
                    panelModel: fakePanel,
                    faceName: 'FACE_Z_MINUS',
                },
            },
        };

        const success = handleLedChannelDrop(fakePick, channel.id);
        expect(success).toBe(true);

        const updated = store.channels.find((c) => c.id === channel.id);
        expect(updated?.refBottom?.nodeId).toBe('p_bottom_wieniec');
        expect(updated?.refBottom?.face).toBe('FACE_Z_MINUS');

        // SprawdĹş czy po dropie asystent przeszedĹ‚ do kroku 'front'
        expect(ContextManager.instance.activeReferencePicker?.source).toContain('front');

        // Symuluj wskazanie pĹ‚aszczyzny frontowej
        ContextManager.instance.activeReferencePicker?.onSelect({
            nodeId: 'p_bottom_wieniec',
            face: 'FACE_Y_MINUS',
            panelModel: { id: 'p_bottom_wieniec', name: 'Wieniec Dolny 1' },
        });

        // Po przodzie powinien przejĹ›Ä‡ do 'left'
        expect(ContextManager.instance.activeReferencePicker?.source).toContain('left');

        // Symuluj klikniÄ™cie lewego boku
        ContextManager.instance.activeReferencePicker?.onSelect({
            nodeId: 'p_bok_l',
            face: 'FACE_X_MINUS',
            panelModel: { id: 'p_bok_l', name: 'Bok Lewy' },
        });

        // Po lewym boku powinien przejĹ›Ä‡ do 'right'
        expect(ContextManager.instance.activeReferencePicker?.source).toContain('right');

        // Symuluj klikniÄ™cie prawego boku
        ContextManager.instance.activeReferencePicker?.onSelect({
            nodeId: 'p_bok_p',
            face: 'FACE_X_PLUS',
            panelModel: { id: 'p_bok_p', name: 'Bok Prawy' },
        });

        // Po prawym boku picker powinien zostaÄ‡ wyczyszczony, a kanaĹ‚ w peĹ‚ni skonfigurowany
        expect(ContextManager.instance.activeReferencePicker).toBeUndefined();
        const finalChannel = store.channels.find((c) => c.id === channel.id);
        expect(finalChannel?.refBottom?.nodeId).toBe('p_bottom_wieniec');
        expect(finalChannel?.refFront?.nodeId).toBe('p_bottom_wieniec');
        expect(finalChannel?.refFront?.face).toBe('FACE_Y_MINUS');
        expect(finalChannel?.refLeft?.nodeId).toBe('p_bok_l');
        expect(finalChannel?.refRight?.nodeId).toBe('p_bok_p');
    });

    it('automatycznie wykrywa rzÄ…d szafek wiszÄ…cych (detectCabinetRow)', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        // StwĂłrz 2 szafki obok siebie: Szafka 1 (X: -300..0), Szafka 2 (X: 0..300)
        // Obie szafki majÄ… to samo dno Z=500 i ten sam front Y=-150
        const cab1 = doc.createAssembly({ name: 'Szafka_Gorna_1' });
        const cab1Node = doc.findNode(cab1.id);
        cab1Node.setLocalMatrix(Mat4.fromTranslation(mmToNm(-150), mmToNm(0), mmToNm(500)));

        const wieniec1 = new PanelModel({ width: mmToNm(300), height: mmToNm(300), thickness: mmToNm(18), name: 'Wieniec_D1', role: 'BOTTOM_PANEL' });
        const wieniec1Node = new CADNode(wieniec1.id, 'Wieniec_D1', NodeType.PART);
        wieniec1Node.domainData = wieniec1;
        wieniec1Node.setLocalTransform(new Vec3(0, 0, mmToNm(9)), Quat.fromEulerXYZ(Math.PI / 2, 0, 0));
        doc.addNode(cab1.id, wieniec1Node);

        const bokL1 = new PanelModel({ width: mmToNm(300), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok_L1', role: 'LEFT_SIDE_PANEL' });
        const bokL1Node = new CADNode(bokL1.id, 'Bok_L1', NodeType.PART);
        bokL1Node.domainData = bokL1;
        bokL1Node.setLocalTransform(new Vec3(mmToNm(-141), 0, mmToNm(360)), Quat.fromEulerXYZ(Math.PI / 2, 0, -Math.PI / 2));
        doc.addNode(cab1.id, bokL1Node);

        const cab2 = doc.createAssembly({ name: 'Szafka_Gorna_2' });
        const cab2Node = doc.findNode(cab2.id);
        cab2Node.setLocalMatrix(Mat4.fromTranslation(mmToNm(150), mmToNm(0), mmToNm(500)));

        const wieniec2 = new PanelModel({ width: mmToNm(300), height: mmToNm(300), thickness: mmToNm(18), name: 'Wieniec_D2', role: 'BOTTOM_PANEL' });
        const wieniec2Node = new CADNode(wieniec2.id, 'Wieniec_D2', NodeType.PART);
        wieniec2Node.domainData = wieniec2;
        wieniec2Node.setLocalTransform(new Vec3(0, 0, mmToNm(9)), Quat.fromEulerXYZ(Math.PI / 2, 0, 0));
        doc.addNode(cab2.id, wieniec2Node);

        const bokP2 = new PanelModel({ width: mmToNm(300), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok_P2', role: 'RIGHT_SIDE_PANEL' });
        const bokP2Node = new CADNode(bokP2.id, 'Bok_P2', NodeType.PART);
        bokP2Node.domainData = bokP2;
        bokP2Node.setLocalTransform(new Vec3(mmToNm(141), 0, mmToNm(360)), Quat.fromEulerXYZ(Math.PI / 2, 0, -Math.PI / 2));
        doc.addNode(cab2.id, bokP2Node);

        const row = detectCabinetRow(doc, wieniec1Node.id);
        expect(row).not.toBeNull();
        expect(row!.cabinetCount).toBe(2);
        expect(row!.totalWidthMm).toBeCloseTo(600, 1);
        expect(row!.refLeft.nodeId).toBe(bokL1Node.id);
        expect(row!.refRight.nodeId).toBe(bokP2Node.id);
    });

    it('testuje aplikacjÄ™ LED na realnej szafce z runEngineAndApply', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'Szafka_K1' });
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 720, 350, 1, 0, 0, 0);

        const cabNode = doc.findNode(cabinet.id)!;
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;
        const bottomNode = findCabinetPanel(cabNode, { role: 'BOTTOM_PANEL' }).node!;

        const def = createDefaultLedChannel('led_ext_test');
        def.refLeft = { nodeId: leftNode.id, face: 'FACE_Z_MINUS', label: 'Bok L' };
        def.refRight = { nodeId: rightNode.id, face: 'FACE_Z_MINUS', label: 'Bok P' };
        def.refBottom = { nodeId: bottomNode.id, face: 'FACE_Z_MINUS', label: 'Wieniec D' };
        def.refFront = { nodeId: bottomNode.id, face: 'FACE_Y_PLUS', label: 'Wieniec PrzĂłd' };
        def.offsetFromFrontMm = 50;
        def.grooveWidthMm = 14;
        def.grooveDepthMm = 9;
        def.cutSides = true;

        const affected = applyLedChannelToDocument(doc, def);
        console.log('REAL CAB AFFECTED:', affected);
        console.log('REAL CAB BOTTOM FEATS:', JSON.stringify((bottomNode.domainData as any).features, null, 2));
        console.log('REAL CAB LEFT FEATS:', JSON.stringify((leftNode.domainData as any).features, null, 2));
        console.log('REAL CAB RIGHT FEATS:', JSON.stringify((rightNode.domainData as any).features, null, 2));
    });
});
