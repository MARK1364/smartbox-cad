import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import {
    bayFrameFromDetectedBay,
    bayFrameFromDocument,
    recoverCollapsedBayHeightMm,
    resolveStudioPlacementInContainerMm,
    resolveStudioPlacementWorldMm,
    resolveCutPlacementLocalMm,
    computeCutProtrusionInBayMm,
    computeSmartPartCutIntents,
    applySmartPartCutIntents,
} from '../hangers/smartpart-bay-placement.js';
import type { DetectedBay } from '../../A2_bloki/bloki-bay-detector.js';
import p40 from '../../B1_biblioteka/zawieszki/p40.json';

describe('A5_smartparts / smartpart-bay-placement — Parametryczne wpasowanie we wnękę', () => {
    const mockBay: DetectedBay = {
        boundsMm: { width: 564, height: 600, depth: 330 },
        boundsNm: { width: 0, height: 0, depth: 0 },
        centerWorldMm: { x: 0, y: 165, z: 300 },
        boundary: {
            left: { nodeId: 'panel_left', planeCoordMm: -282, face: 'FACE_Z_PLUS', nodeName: 'Bok Lewy', worldPointMm: { x: -282, y: 165, z: 300 } },
            right: { nodeId: 'panel_right', planeCoordMm: 282, face: 'FACE_Z_PLUS', nodeName: 'Bok Prawy', worldPointMm: { x: 282, y: 165, z: 300 } },
            back: { nodeId: 'panel_back', planeCoordMm: 330, face: 'FACE_Z_PLUS', nodeName: 'Plecy', worldPointMm: { x: 0, y: 330, z: 300 } },
            front: { nodeId: 'front_edge', planeCoordMm: 0, face: 'FACE_Z_MINUS', nodeName: 'Lico', worldPointMm: { x: 0, y: 0, z: 300 } },
            top: { nodeId: 'panel_top', planeCoordMm: 600, face: 'FACE_Z_MINUS', nodeName: 'Wieniec Górny', worldPointMm: { x: 0, y: 165, z: 600 } },
            bottom: { nodeId: 'panel_bottom', planeCoordMm: 0, face: 'FACE_Z_PLUS', nodeName: 'Wieniec Dolny', worldPointMm: { x: 0, y: 165, z: 0 } },
            frontPlaneYMm: 0,
        },
    };

    it('tworzy ramkę SmartPartBayFrame z DetectedBay z poprawnymi wymiarami', () => {
        const frame = bayFrameFromDetectedBay(mockBay);
        expect(frame.widthMm).toBe(564);
        expect(frame.heightMm).toBe(600);
        expect(frame.depthMm).toBe(330);
        expect(frame.xL).toBe(-282);
        expect(frame.xR).toBe(282);
        expect(frame.zBottom).toBe(0);
        expect(frame.zTop).toBe(600);
        expect(frame.backToFront).toBe(-1);
    });

    it('przelicza pozycję bryły ze ścianami referencyjnymi (CENTER, RIGHT, LEFT, TOP, BOTTOM)', () => {
        const frame = bayFrameFromDetectedBay(mockBay);

        // Part z prawego boku, wycentrowany w pionie i głębokości (jak w SmartPart_222 Part 1)
        const posRightCenter = resolveStudioPlacementWorldMm(frame, {
            refX: 'RIGHT',
            offsetX_mm: 0,
            refY: 'CENTER',
            offsetY_mm: 0,
            refZ: 'CENTER',
            offsetZ_mm: 0,
        });
        expect(posRightCenter.x).toBe(282); // na prawym boku
        expect(posRightCenter.z).toBe(300); // w połowie wysokości (0..600)
        expect(posRightCenter.y).toBe(165); // w połowie głębokości (330..0)

        // Part z lewego boku, 50 mm od dołu (Z), 20 mm od pleców (Y)
        const posCustom = resolveStudioPlacementWorldMm(frame, {
            refX: 'LEFT',
            offsetX_mm: 10,
            refY: 'BACK',
            offsetY_mm: 20,
            refZ: 'BOTTOM',
            offsetZ_mm: 50,
        });
        expect(posCustom.x).toBe(-282 + 10);
        expect(posCustom.z).toBe(0 + 50);
        expect(posCustom.y).toBe(330 - 20); // w stronę przodu (zmniejszający się Y)
    });

    it('wykrywa wystawanie cięcia walcowego (HOLE) w bok lewy i generuje obróbkę', () => {
        const frame = bayFrameFromDetectedBay(mockBay);

        // Walec fi 8, dł 24 mm na lewym boku w środku (jak w SmartPart_222)
        const cut = {
            id: 'cut_1',
            name: 'Walec fi 8',
            type: 'HOLE',
            diameterMm: 8,
            lengthMm: 24,
            refX: 'LEFT',
            offsetX_mm: 0,
            refY: 'CENTER',
            offsetY_mm: 0,
            refZ: 'CENTER',
            offsetZ_mm: 0,
            axis: 'X',
            direction: -1,
        };

        const protrusion = computeCutProtrusionInBayMm(frame, cut);
        expect(protrusion).toBeDefined();
        // Początek (LCS) na LEFT, direction −X → cała długość 24 mm na zewnątrz
        expect(protrusion!.left).toBeCloseTo(24, 1);
        expect(protrusion!.right).toBeLessThan(0);
        expect(protrusion!.top).toBeLessThan(0);
        expect(protrusion!.bottom).toBeLessThan(0);
    });

    it('automatycznie adaptuje pozycje po powiększeniu korpusu (np. z 564 na 764 mm szerokości)', () => {
        // Symulacja zmiany korpusu: bok lewy przesunięty o -100, prawy o +100 (szerokość 764)
        const resizedWallRefs = {
            left: { nodeId: 'panel_left', face: 'FACE_Z_PLUS', planeCoordMm: -382 },
            right: { nodeId: 'panel_right', face: 'FACE_Z_PLUS', planeCoordMm: 382 },
            back: { nodeId: 'panel_back', face: 'FACE_Z_PLUS', planeCoordMm: 330 },
            front: { nodeId: 'front_edge', face: 'FACE_Z_MINUS', planeCoordMm: 0 },
            top: { nodeId: 'panel_top', face: 'FACE_Z_MINUS', planeCoordMm: 700 },
            bottom: { nodeId: 'panel_bottom', face: 'FACE_Z_PLUS', planeCoordMm: 0 },
        };

        const mockDoc = {
            findNode: (id: string) => null, // fallback na planeCoordMm
        };

        const resizedFrame = bayFrameFromDocument(mockDoc, resizedWallRefs);
        expect(resizedFrame).not.toBeNull();
        expect(resizedFrame!.widthMm).toBe(764);
        expect(resizedFrame!.heightMm).toBe(700);

        // Element z refX: RIGHT i offsetX: 0 nadal trzyma się prawego boku (382 mm)
        const posRight = resolveStudioPlacementWorldMm(resizedFrame!, {
            refX: 'RIGHT',
            offsetX_mm: 0,
            refY: 'CENTER',
            offsetY_mm: 0,
            refZ: 'CENTER',
            offsetZ_mm: 0,
        });
        expect(posRight.x).toBe(382);
        expect(posRight.z).toBe(350); // w nowym środku wysokości (700 / 2)
    });

    it('edycja parametru / bayFrameFromDocument: zły front.face (FACE_X_PLUS) nie ucina głębokości do ~½', () => {
        // Jak po dropie: planeCoordMm czoła = 0, tył = 458 (korpus ~560)
        // Stary bug: live z FACE_X_PLUS boku → Y≈środek (229) → depth 229
        const refs = {
            left: { nodeId: 'panel_left', face: 'FACE_Z_PLUS', planeCoordMm: -382 },
            right: { nodeId: 'panel_right', face: 'FACE_Z_PLUS', planeCoordMm: 382 },
            back: { nodeId: 'panel_back', face: 'FACE_Z_PLUS', planeCoordMm: 458 },
            front: { nodeId: 'panel_left', face: 'FACE_X_PLUS', planeCoordMm: 0 },
            top: { nodeId: 'panel_top', face: 'FACE_Z_MINUS', planeCoordMm: 1964 },
            bottom: { nodeId: 'panel_bottom', face: 'FACE_Z_PLUS', planeCoordMm: 0 },
        };
        const mockDoc = {
            findNode: (id: string) => {
                if (id !== 'panel_left') return null;
                // Formatka boku bez rotacji: FACE_X_* mają Y=0 (środek) — pułapka starego kodu
                return {
                    id,
                    domainData: { width: 560e6, height: 1964e6, thickness: 18e6 },
                    getWorldMatrix: () => ({
                        transformPoint: (p: { x: number; y: number; z: number }) => p,
                    }),
                };
            },
        };
        const frame = bayFrameFromDocument(mockDoc, refs);
        expect(frame).not.toBeNull();
        expect(frame!.depthMm).toBeGreaterThan(400);
        expect(frame!.frontY).toBe(0);
        expect(frame!.backY).toBe(458);
    });

    it('recoverCollapsedBayHeightMm: live H≈½ nie psuje refZ TOP (z=H-30, nie środek)', () => {
        const detected = bayFrameFromDetectedBay(mockBay);
        // Symulacja po rebuildzie: live top w środku wnęki → wysokość 300
        const liveCollapsed = {
            ...detected,
            zTop: 300,
            heightMm: 300,
        };
        const recovered = recoverCollapsedBayHeightMm(liveCollapsed, detected);
        expect(recovered.heightMm).toBe(600);
        expect(recovered.zTop).toBe(600);
        expect(recovered.zBottom).toBe(0);

        const part = {
            refX: 'LEFT' as const,
            offsetX_mm: 10,
            refY: 'FRONT' as const,
            offsetY_mm: 30,
            refZ: 'TOP' as const,
            offsetZ_mm: 30,
        };
        const broken = resolveStudioPlacementInContainerMm(
            { widthMm: liveCollapsed.widthMm, heightMm: liveCollapsed.heightMm, depthMm: liveCollapsed.depthMm },
            part,
        );
        expect(broken.z).toBe(270); // H_live-30 ≈ „środek” wizualnie w H=600

        const ok = resolveStudioPlacementInContainerMm(
            { widthMm: recovered.widthMm, heightMm: recovered.heightMm, depthMm: recovered.depthMm },
            part,
        );
        expect(ok.z).toBe(570); // H-30 od dna
        expect(ok.x).toBe(-272); // LEFT+10 w układzie kontenera (środek X=0)
    });

    it('recoverCollapsedBayHeightMm: realne powiększenie wnęki (H 600→800) zostaje', () => {
        const detected = bayFrameFromDetectedBay(mockBay);
        const grown = { ...detected, zTop: 800, heightMm: 800 };
        const kept = recoverCollapsedBayHeightMm(grown, detected);
        expect(kept.heightMm).toBe(800);
        expect(kept.zTop).toBe(800);
    });

    it('p40: otwór (CENTER na Part) ma Z przy górze wnęki, nie na środku — Part refZ TOP', () => {
        const frame = bayFrameFromDetectedBay(mockBay);
        const part = p40.parts[0];
        const cut = p40.cuts[0];
        expect(part.refZ).toBe('TOP');
        expect(part.offsetZ_mm).toBe(50);
        const local = resolveCutPlacementLocalMm(frame, part, cut);
        // Part TOP+50 → h = 600-50 = 550; cut CENTER → +0
        expect(local.h).toBeCloseTo(550, 0);
        expect(local.h).toBeGreaterThan(frame.heightMm * 0.8);
        expect(local.h).not.toBeCloseTo(frame.heightMm / 2, 0);

        const frameInset = { ...frame, zTop: frame.zTop - 300, heightMm: frame.heightMm - 300 };
        const localInset = resolveCutPlacementLocalMm(frameInset, part, cut);
        expect(localInset.h).toBeCloseTo(250, 0); // (600-300)-50
        expect(localInset.h).toBeCloseTo(local.h - 300, 0);
    });

    it('Kontener206: Part BACK+35 (depth 70) ma środek 35 mm od pleców; 2 otwory + kieszeń na plecach', () => {
        const frame = bayFrameFromDetectedBay(mockBay);
        const part = {
            id: 'part_1',
            widthMm: 20,
            heightMm: 40,
            depthMm: 70,
            refX: 'LEFT',
            offsetX_mm: 10,
            refY: 'BACK',
            offsetY_mm: 35,
            refZ: 'TOP',
            offsetZ_mm: 20,
        };
        const world = resolveStudioPlacementWorldMm(frame, part);
        // Środek Parta: 35 mm od pleców w stronę frontu (Y maleje)
        expect(world.x).toBeCloseTo(-282 + 10, 5);
        expect(world.y).toBeCloseTo(330 - 35, 5);
        expect(world.z).toBeCloseTo(600 - 20, 5);

        const def = {
            id: 'sp:test206',
            parts: [part],
            cuts: [
                {
                    id: 'cut_walec_1', name: 'Walec 1', type: 'HOLE', diameterMm: 8, lengthMm: 24,
                    xMm: -10, yMm: -15, zMm: 5, partId: 'part_1',
                    refX: 'LEFT', offsetX_mm: 0, refY: 'CENTER', offsetY_mm: -15, refZ: 'CENTER', offsetZ_mm: 5,
                },
                {
                    id: 'cut_walec_2', name: 'Walec 2', type: 'HOLE', diameterMm: 8, lengthMm: 24,
                    xMm: -10, yMm: -15, zMm: -15, partId: 'part_1',
                    refX: 'LEFT', offsetX_mm: 0, refY: 'CENTER', offsetY_mm: -15, refZ: 'CENTER', offsetZ_mm: -15,
                },
                {
                    id: 'cut_szescian_1', name: 'Sześcian 1', type: 'POCKET',
                    widthMm: 16, heightMm: 32, depthMm: 15,
                    xMm: 0, yMm: 35, zMm: -10, partId: 'part_1',
                    // Utwierdzenie na tyle Parta → wcięcie w plecy korpusu (CAD +Y)
                    refX: 'CENTER', offsetX_mm: 0, refY: 'BACK', offsetY_mm: 0, refZ: 'CENTER', offsetZ_mm: -10,
                },
            ],
        };

        // point3DToFaceUV needs real face math — protrusion-only checks without UV:
        const p1 = computeCutProtrusionInBayMm(frame, def.cuts[0], part)!;
        const p2 = computeCutProtrusionInBayMm(frame, def.cuts[1], part)!;
        const pp = computeCutProtrusionInBayMm(frame, def.cuts[2], part)!;
        expect(p1.left).toBeGreaterThan(0.01);
        expect(p2.left).toBeGreaterThan(0.01);
        // Kieszeń na BACK Parta: cała głębokość 15 mm wystaje w plecy wnęki
        expect(pp.back).toBeCloseTo(15, 1);
    });

    it('p40: otwor na boku sledzi Z Parta (TOP), nie srodek plyty; offset gory -300', () => {
        const doc = new ProjectDocument();
        const H = 1000;
        const panel = new PanelModel({
            width: mmToNm(330),
            height: mmToNm(H),
            thickness: mmToNm(18),
            role: 'LEFT_SIDE_PANEL',
            name: 'Bok_L',
        });
        const node = CADNode.create(NodeType.PART, 'Bok_L', panel.id);
        node.domainData = panel;
        // Jak korpus: środek boku w połowie wysokości, LCS obrót −90° wokół Z
        node.setLocalTransform(
            new Vec3(mmToNm(-291), 0, mmToNm(H / 2)),
            Quat.fromEulerXYZ(0, 0, -Math.PI / 2),
        );
        doc.addNode(doc.rootNode.id, node);

        const frame = {
            xL: -282, xR: 282,
            zBottom: 0, zTop: H,
            backY: 165, frontY: -165,
            backToFront: -1 as const,
            widthMm: 564, heightMm: H, depthMm: 330,
            refs: {
                left: { nodeId: node.id, face: 'FACE_Z_PLUS', planeCoordMm: -282 },
            },
        };
        const intents = computeSmartPartCutIntents(doc, frame as any, p40, 'grp');
        expect(intents.length).toBeGreaterThan(0);
        const v = intents[0].feature.params.v as number;
        // Part TOP+50 → świat Z = 950; środek boku = 500
        expect(v).toBeCloseTo(950, 0);
        expect(v).toBeGreaterThan(H * 0.8);

        const inset = { ...frame, zTop: H - 300, heightMm: H - 300 };
        const moved = computeSmartPartCutIntents(doc, inset as any, p40, 'grp');
        const v2 = moved[0].feature.params.v as number;
        expect(v2).toBeCloseTo(650, 0);
        expect(v2).toBeCloseTo(v - 300, 0);
    });

    it('TT2: wcięcie na plecach jest przy lewym górnym rogu (nie na środku płyty)', () => {
        const doc = new ProjectDocument();
        const W = 564;
        const H = 682;
        const panel = new PanelModel({
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(3),
            role: 'BACK_PANEL',
            name: 'Plecy',
        });
        const node = CADNode.create(NodeType.PART, 'Plecy', panel.id);
        node.domainData = panel;
        // Jak korpus3: mapping Y←z, Z←y, rotation Rx=180 — środek pleców
        node.setLocalTransform(
            new Vec3(0, mmToNm(174), mmToNm(18 + H / 2)),
            Quat.fromEulerXYZ(Math.PI, 0, 0),
        );
        doc.addNode(doc.rootNode.id, node);

        const frame = {
            xL: -282, xR: 282,
            zBottom: 18, zTop: 700,
            backY: 165, frontY: -165,
            backToFront: -1 as const,
            widthMm: 564, heightMm: 682, depthMm: 330,
            refs: {
                back: { nodeId: node.id, face: 'FACE_Z_MINUS', planeCoordMm: 165 },
            },
        };
        const def = {
            id: 'sp:TT2',
            parts: [{
                id: 'part_1', widthMm: 20, heightMm: 40, depthMm: 70,
                refX: 'LEFT', offsetX_mm: 10,
                refY: 'BACK', offsetY_mm: 35,
                refZ: 'TOP', offsetZ_mm: 20,
            }],
            cuts: [{
                id: 'cut_szescian_1', name: 'Wcięcie', type: 'POCKET',
                widthMm: 16, heightMm: 32, depthMm: 15,
                refX: 'CENTER', offsetX_mm: 0,
                refY: 'BACK', offsetY_mm: 0,
                refZ: 'CENTER', offsetZ_mm: 0,
                axis: 'Y', direction: 1, partId: 'part_1',
            }],
        };
        const intents = computeSmartPartCutIntents(doc, frame as any, def, 'grp');
        const groove = intents.find((i) => i.feature.type === 'groove');
        expect(groove).toBeTruthy();
        expect(groove!.feature.face).toBe('FACE_Z_PLUS');
        const u = groove!.feature.params.u as number;
        const v = groove!.feature.params.v as number;
        // Środek Parta X=10 od lewego → u blisko lewej; TOP−20 → małe V (od góry płyty)
        expect(u).toBeLessThan(W * 0.25);
        expect(v).toBeLessThan(H * 0.25);
        expect(u).not.toBeCloseTo(W / 2, 0);
        expect(v).not.toBeCloseTo(H / 2, 0);
    });
});
