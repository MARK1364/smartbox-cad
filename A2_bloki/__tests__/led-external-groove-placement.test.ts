import { describe, it, expect } from 'vitest';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { findCabinetPanel } from '../../A1_core/panel-lookup.js';
import { detectCabinetOuterHull } from '../bloki-bay-detector.js';
import { syncBlokiLedExternalGrooves } from '../led-external-engine.js';
import { createBlokInDetectedBay, BLOKI_EXTERNAL_OPTIONS } from '../bloki-bay-actions.js';
import { LED_CHANNEL_SOURCE } from '../../A5_smartparts/led/led-channel-types.js';
import '../../src/application/project-domain.js';
import { ContainerModel } from '../../A1_core/container-model.js';

describe('LED external groove placement on Korpus3', () => {
    it('puts continuous edge channel on bottom rail + both sides (not mid-face pocket)', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'Korpus3_LED' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 720, 350, 1, 0, 0, 0);

        const cabNode = doc.findNode(cabinet.id)!;
        const hull = detectCabinetOuterHull(doc, cabinet.id);
        expect(hull).not.toBeNull();

        const bottomNode = findCabinetPanel(cabNode, { role: 'BOTTOM_PANEL' }).node!;
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        // Diagnoza referencji outer hull (wczeĹ›niej dno braĹ‚o bok â€” rowek na Ĺ›rodku)
        expect(
            hull!.boundary.bottom.nodeId,
            `bottom ref=${hull!.boundary.bottom.nodeName} face=${hull!.boundary.bottom.face}`
        ).toBe(bottomNode.id);
        expect(hull!.boundary.left.nodeId).toBe(leftNode.id);
        expect(hull!.boundary.right.nodeId).toBe(rightNode.id);
        expect(hull!.boundary.bottom.face).toBe('FACE_Z_MINUS');
        expect(hull!.boundary.front.face).toMatch(/^FACE_/);

        const ledOpt = BLOKI_EXTERNAL_OPTIONS.find(o => o.id === 'LED_EXTERNAL')!;
        const sbNode = createBlokInDetectedBay(doc, hull!, ledOpt, {
            odsuniecie_od_przodu_mm: 50,
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9,
            frezuj_boki: true,
        });
        expect(sbNode).not.toBeNull();

        syncBlokiLedExternalGrooves(sbNode!, doc);

        const bottom = bottomNode.domainData as any;
        const left = leftNode.domainData as any;
        const right = rightNode.domainData as any;

        const gBottom = bottom.features?.find((f: any) => f.params?.source === LED_CHANNEL_SOURCE);
        const gLeft = left.features?.find((f: any) => f.params?.source === LED_CHANNEL_SOURCE);
        const gRight = right.features?.find((f: any) => f.params?.source === LED_CHANNEL_SOURCE);

        expect(gBottom, 'wieniec dolny musi mieÄ‡ rowek').toBeDefined();
        expect(gLeft, 'bok lewy musi mieÄ‡ wciÄ™cie').toBeDefined();
        expect(gRight, 'bok prawy musi mieÄ‡ wciÄ™cie').toBeDefined();

        // Wieniec: wejĹ›cie od spodu
        expect(gBottom.face).toBe('FACE_Z_MINUS');
        expect(gBottom.params.depth).toBeGreaterThanOrEqual(8);
        expect(gBottom.params.depth).toBeLessThanOrEqual(10);

        // Boki: wciÄ™cie od krawÄ™dzi dolnej, NIE kieszeĹ„ na duĹĽym licu (FACE_Z_*)
        expect(['FACE_X_MINUS', 'FACE_X_PLUS', 'FACE_Y_MINUS', 'FACE_Y_PLUS']).toContain(gLeft.face);
        expect(['FACE_X_MINUS', 'FACE_X_PLUS', 'FACE_Y_MINUS', 'FACE_Y_PLUS']).toContain(gRight.face);
        expect(gLeft.face).not.toMatch(/^FACE_Z_/);
        expect(gRight.face).not.toMatch(/^FACE_Z_/);

        // KanaĹ‚ nie moĹĽe siedzieÄ‡ â€žna Ĺ›rodkuâ€ť wysokoĹ›ci boku (v â‰ height/2)
        const leftH = nmToMm(left.height);
        const midBand = leftH * 0.35;
        const leftVCenter = gLeft.params.v + gLeft.params.length / 2;
        expect(leftVCenter).toBeLessThan(midBand);
    });
});
