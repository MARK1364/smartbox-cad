import { describe, expect, it } from 'vitest';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { applyPlanToContainer } from '../../A3_smartframe/smartframe-adapter.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { buildMeshFromPanel } from '../../A4_smartpanel/native_core/mesh_builder.js';
import { getOperation, listOperations } from '../operacje-catalog.js';
import { buildOperationFeature, pocketRectMm } from '../operacje-builder.js';
import {
    applyLibraryOperation,
    bindOperationEdge,
    isLibraryOperation,
    isEngineGroove,
    featureOperationLabel,
    mergeEngineAndLibraryFeatures,
    refreshLibraryOperationsOnPanel,
    updateLibraryOperationsById,
} from '../operacje-apply.js';
import { pocketFromEdgeDims, snapDimHandleToEdge, dimHandleUv, dragHandleAlongAxis, magnetEdgeIfAtBound } from '../operacje-placement.js';
import { DrawingProjectExtractor } from '../../R2_rys/drawing-project-extractor.js';
import '../../A1_core/project-domain.js';

function makePanel(w = 600, h = 720, t = 18) {
    return new PanelModel({
        width: mmToNm(w),
        height: mmToNm(h),
        thickness: mmToNm(t),
        name: 'Front',
        engineManaged: false,
    });
}

describe('o1_operacji katalog', () => {
    it('ładuje przetłoczenie / wycięcie i rewizję', () => {
        const ids = listOperations().map((r) => r.id);
        expect(ids).toEqual(['przetloczenie', 'rewizja']);
        expect(getOperation('przetloczenie')?.insets.l).toBe(60);
        expect(getOperation('przetloczenie')?.depthMm).toBe(3);
        expect(getOperation('rewizja')?.placement).toBe('edge_dims');
        expect(getOperation('rewizja')?.sizeMm).toEqual({ w: 120, h: 80 });
        expect(getOperation('rewizja')?.edge.uMm).toBe(100);
        expect(getOperation('rewizja')?.edge.vMm).toBe(80);
    });
});

describe('o1_operacji builder', () => {
    it('liczy kieszeń przetłoczenia na froncie 600×720', () => {
        const recipe = getOperation('przetloczenie')!;
        const panel = makePanel();
        const feat = buildOperationFeature(recipe, panel, 'FACE_Z_MINUS');
        expect(feat).not.toBeNull();
        expect(feat!.type).toBe('groove');
        expect(feat!.params.source).toBe('library');
        expect(feat!.params.u).toBe(60);
        expect(feat!.params.v).toBe(60);
        expect(feat!.params.width).toBe(480);
        expect(feat!.params.length).toBe(600);
        expect(feat!.params.depth).toBe(3);
        expect(feat!.face).toBe('FACE_Z_MINUS');
    });

    it('wycięcie na wylot bierze grubość płyty przy through=true', () => {
        const recipe = getOperation('przetloczenie')!;
        const panel = makePanel(600, 720, 18);
        const feat = applyLibraryOperation(panel, 'przetloczenie', 'FACE_Z_MINUS', { through: true, fill: 'glass' });
        expect(feat!.params.depth).toBe(18);
        expect(feat!.params.through).toBe(true);
        expect(feat!.params.fill).toBe('glass');
    });

    it('odrzuca płytę mniejszą niż przetłoczenie', () => {
        expect(pocketRectMm(100, 100, { l: 60, r: 60, t: 60, b: 60 })).toBeNull();
        const recipe = getOperation('przetloczenie')!;
        const panel = makePanel(80, 80, 18);
        expect(buildOperationFeature(recipe, panel, 'FACE_Z_MINUS')).toBeNull();
    });
});

describe('o1_operacji apply / merge', () => {
    it('zostawia operację z biblioteki przy cechach silnika', () => {
        const panel = makePanel();
        applyLibraryOperation(panel, 'przetloczenie', 'FACE_Z_MINUS');
        expect(panel.features).toHaveLength(1);
        expect(isLibraryOperation(panel.features[0])).toBe(true);

        const merged = mergeEngineAndLibraryFeatures(panel.features, [
            { id: 'hinge_1', type: 'hole', params: { u: 22, v: 100, diameter: 35 } },
        ]);
        expect(merged).toHaveLength(2);
        expect(merged.some((f) => f.type === 'hole')).toBe(true);
        expect(merged.some(isLibraryOperation)).toBe(true);
    });

    it('po zmianie wysokości przelicza długość kieszeni', () => {
        const panel = makePanel(600, 720, 18);
        applyLibraryOperation(panel, 'przetloczenie', 'FACE_Z_MINUS');
        expect(panel.features[0].params.length).toBe(600);

        panel.setDimensions(mmToNm(600), mmToNm(900), mmToNm(18));
        expect(refreshLibraryOperationsOnPanel(panel)).toBe(true);
        expect(panel.features[0].params.length).toBe(780);
        expect(panel.features[0].params.width).toBe(480);
    });

    it('osobno szerokość i wysokość przetłoczenia', () => {
        const panel = makePanel(600, 720, 18);
        applyLibraryOperation(panel, 'przetloczenie', 'FACE_Z_MINUS', { frameWMm: 40, frameHMm: 80, depthMm: 3 });
        expect(panel.features[0].params.insets.l).toBe(40);
        expect(panel.features[0].params.insets.r).toBe(40);
        expect(panel.features[0].params.insets.t).toBe(80);
        expect(panel.features[0].params.insets.b).toBe(80);
        expect(panel.features[0].params.u).toBe(40);
        expect(panel.features[0].params.v).toBe(80);
        expect(panel.features[0].params.width).toBe(520);
        expect(panel.features[0].params.length).toBe(560);
    });

    it('zmienia przetłoczenie 60→10 bez zaznaczonej formatki', () => {
        const doc = new ProjectDocument({ name: 'O1 live' });
        ContextManager.instance.document = doc;
        const panel = doc.createPanel({
            name: 'Front',
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            engineManaged: false,
        }) as PanelModel;
        applyLibraryOperation(panel, 'przetloczenie', 'FACE_Z_MINUS');
        expect(panel.features[0].params.u).toBe(60);

        const n = updateLibraryOperationsById('przetloczenie', { frameMm: 10, depthMm: 3 });
        expect(n).toBe(1);
        expect(panel.features[0].params.u).toBe(10);
        expect(panel.features[0].params.width).toBe(580);
        expect(panel.features[0].params.length).toBe(700);
    });

    it('buduje fizyczną kieszeń w siatce (dziura + krawędzie wgłębienia)', () => {
        const panel = makePanel(600, 720, 18);
        applyLibraryOperation(panel, 'przetloczenie', 'FACE_Z_MINUS', { frameMm: 60, depthMm: 3 });
        const mesh = buildMeshFromPanel(panel);
        const grooveEdges = (mesh.edges || []).filter((e: any) => String(e.key || '').startsWith('e_groove_'));
        expect(grooveEdges.length).toBe(12);
        const face = mesh.FACE_Z_MINUS;
        expect(face.positions.length).toBeGreaterThan(12);
    });
});

describe('applyPlanToContainer zachowuje operację z biblioteki', () => {
    it('nie kasuje przetłoczenia przy przebudowie silnika', () => {
        const doc = new ProjectDocument({ name: 'O1' });
        ContextManager.instance.document = doc;
        const cabinet = doc.createContainer({
            name: 'Szafa',
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const front = doc.createPanel({
            name: 'Drzwi_Lewe',
            role: 'FRONT',
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
        }, cabinet.id) as PanelModel;
        (front as any).key = 'FRONT';
        applyLibraryOperation(front, 'przetloczenie', 'FACE_Z_MINUS');
        expect(front.features.some(isLibraryOperation)).toBe(true);

        applyPlanToContainer(cabinet, {
            parts: [{
                name: 'Drzwi_Lewe',
                role: 'FRONT',
                key: 'FRONT',
                loc: { x: 0, y: 0, z: 0 },
                dim: { x: 600, y: 18, z: 720 },
                lcs: { mapping: { X: 'x', Y: 'z', Z: 'y' }, rotation: [0, 0, 0] },
                features: [{ id: 'hinge_1', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 22, v: 120, diameter: 35 } }],
            }],
        });

        expect(front.features.some((f) => f.type === 'hole')).toBe(true);
        expect(front.features.some(isLibraryOperation)).toBe(true);
        expect(front.features.find(isLibraryOperation).params.width).toBe(480);
    });
});

describe('wpust silnika vs operacja Smart', () => {
    it('przetłoczenie jest edytowalne, wpust z korpusu nie', () => {
        const przetloczenie = applyLibraryOperation(makePanel(), 'przetloczenie', 'FACE_Z_MINUS');
        expect(isLibraryOperation(przetloczenie)).toBe(true);
        expect(isEngineGroove(przetloczenie)).toBe(false);
        expect(featureOperationLabel(przetloczenie)).toBe('Przetłoczenie / Wycięcie');

        const wpust = {
            id: 'g1',
            type: 'groove',
            name: 'Wpust',
            params: { isBackGroove: true, width: 4, depth: 8 },
        };
        expect(isEngineGroove(wpust)).toBe(true);
        expect(isLibraryOperation(wpust)).toBe(false);
        expect(featureOperationLabel(wpust)).toBe('Wpust');
    });

    it('w drzewie drzwi przetłoczenie jest library, wpust engine', () => {
        const doc = new ProjectDocument({ name: 'Drzwi tree' });
        ContextManager.instance.document = doc;
        const cabinet = doc.createContainer({
            name: 'Szafa',
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const front = doc.createPanel({
            name: 'Drzwi_Lewe',
            role: 'FRONT',
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
        }, cabinet.id) as PanelModel;
        applyLibraryOperation(front, 'przetloczenie', 'FACE_Z_MINUS');
        front.features.push({
            id: 'wpust_plecy',
            type: 'groove',
            name: 'Wpust',
            face: 'FACE_Z_PLUS',
            params: { isBackGroove: true, width: 4, length: 700, depth: 8 },
        });

        const tree = DrawingProjectExtractor.instance.extractProjectTree();
        const findPart = (node: any): any => {
            if (node?.type === 'PART' && node.name === 'Drzwi_Lewe') return node;
            for (const ch of node?.children || []) {
                const hit = findPart(ch);
                if (hit) return hit;
            }
            return null;
        };
        const door = findPart(tree.rootNode);
        expect(door).toBeTruthy();
        const grooves = door.grooves || [];
        const smart = grooves.find((g: any) => g.source === 'library');
        const engine = grooves.find((g: any) => g.source === 'engine');
        expect(smart?.name).toBe('Przetłoczenie / Wycięcie');
        expect(smart?.editable).toBe(true);
        expect(engine?.name).toBe('Wpust');
        expect(engine?.editable).toBe(false);
    });
});

describe('o1_operacji rewizja (edge_dims)', () => {
    const place = {
        uEdge: 'FACE_X_MINUS' as const,
        vEdge: 'FACE_Y_MINUS' as const,
        uMm: 100,
        vMm: 80,
        widthMm: 120,
        heightMm: 80,
    };

    it('wymiar idzie do środka: 100 od lewej / 80 od dołu → UV 40/40', () => {
        const rect = pocketFromEdgeDims('FACE_Z_PLUS', 600, 720, place);
        expect(rect).toEqual({ u: 40, v: 40, width: 120, length: 80 });
    });

    it('na FACE_Z_MINUS u=0 jest fizyczną prawą — 100 od lewej to u=440', () => {
        const rect = pocketFromEdgeDims('FACE_Z_MINUS', 600, 720, place);
        expect(rect).toEqual({ u: 440, v: 40, width: 120, length: 80 });
    });

    it('zapisuje krawędzie i wymiary na cesze', () => {
        const panel = makePanel(600, 720, 18);
        const feat = applyLibraryOperation(panel, 'rewizja', 'FACE_Z_MINUS');
        expect(feat).not.toBeNull();
        expect(feat!.params.placement).toBe('edge_dims');
        expect(feat!.params.u).toBe(440);
        expect(feat!.params.v).toBe(40);
        expect(feat!.params.width).toBe(120);
        expect(feat!.params.length).toBe(80);
        expect(feat!.params.through).toBe(true);
        expect(feat!.params.depth).toBe(18);
        expect(feat!.params.u_edge).toBe('FACE_X_MINUS');
        expect(feat!.params.v_edge).toBe('FACE_Y_MINUS');
        expect(feat!.params.u_ref).toBe(100);
        expect(feat!.params.v_ref).toBe(80);
    });

    it('po zmianie wysokości płyty v_ref zostaje, środek nie skacze od dołu', () => {
        const panel = makePanel(600, 720, 18);
        applyLibraryOperation(panel, 'rewizja', 'FACE_Z_MINUS');
        panel.setDimensions(mmToNm(600), mmToNm(900), mmToNm(18));
        refreshLibraryOperationsOnPanel(panel);
        expect(panel.features[0].params.v).toBe(40);
        expect(panel.features[0].params.v_ref).toBe(80);
        expect(panel.features[0].params.u).toBe(440);
        expect(panel.features[0].params.length).toBe(80);
    });

    it('od góry: wyższa płyta przesuwa UV, v_ref do środka zostaje', () => {
        const panel = makePanel(600, 720, 18);
        applyLibraryOperation(panel, 'rewizja', 'FACE_Z_PLUS', { vEdge: 'FACE_Y_PLUS', vMm: 80 });
        expect(panel.features[0].params.v).toBe(600);
        panel.setDimensions(mmToNm(600), mmToNm(900), mmToNm(18));
        expect(refreshLibraryOperationsOnPanel(panel)).toBe(true);
        expect(panel.features[0].params.v).toBe(780);
        expect(panel.features[0].params.v_ref).toBe(80);
        expect(panel.features[0].params.v_edge).toBe('FACE_Y_PLUS');
    });

    it('przypięcie do prawej zostawia 100 mm i przesuwa kieszeń', () => {
        const panel = makePanel(600, 720, 18);
        applyLibraryOperation(panel, 'rewizja', 'FACE_Z_PLUS');
        expect(panel.features[0].params.u).toBe(40);
        expect(panel.features[0].params.u_ref).toBe(100);
        const bound = bindOperationEdge(panel, 'rewizja', 'FACE_X_PLUS', 'u', 'FACE_Z_PLUS');
        expect(bound?.params.u_edge).toBe('FACE_X_PLUS');
        expect(bound?.params.u_ref).toBe(100);
        expect(bound?.params.u).toBe(440);
        expect(bound?.params.v).toBe(40);
    });

    it('krawędź B-rep przod_prawo kotwiczy oś U i przesuwa o ten sam wymiar', () => {
        const panel = makePanel(600, 720, 18);
        applyLibraryOperation(panel, 'rewizja', 'FACE_Z_PLUS');
        const bound = bindOperationEdge(panel, 'rewizja', 'przod_prawo', 'u', 'FACE_Z_PLUS');
        expect(bound?.params.u_edge).toBe('FACE_X_PLUS');
        expect(bound?.params.u_ref).toBe(100);
        expect(bound?.params.u).toBe(440);
    });

    it('narożna dol_lewo na osi V kotwiczy dół, nie lewą', () => {
        const panel = makePanel(600, 720, 18);
        applyLibraryOperation(panel, 'rewizja', 'FACE_Z_PLUS');
        const bound = bindOperationEdge(panel, 'rewizja', 'dol_lewo', 'v', 'FACE_Z_PLUS');
        expect(bound?.params.v_edge).toBe('FACE_Y_MINUS');
        expect(bound?.params.v).toBe(40);
        expect(bound?.params.u).toBe(40);
    });

    it('zmiana szerokości zostawia środek — rośnie w obie strony', () => {
        const panel = makePanel(600, 720, 18);
        applyLibraryOperation(panel, 'rewizja', 'FACE_Z_PLUS');
        const feat = applyLibraryOperation(panel, 'rewizja', 'FACE_Z_PLUS', { widthMm: 160 });
        expect(feat?.params.width).toBe(160);
        expect(feat?.params.u).toBe(20);
        expect(feat?.params.u_ref).toBe(100);
        expect(feat?.params.v).toBe(40);
    });

    it('kółko U przysysa się do bliższej krawędzi L/P', () => {
        const rect = { u: 40, v: 40, width: 120, length: 80 };
        const left = snapDimHandleToEdge('FACE_Z_PLUS', 'u', 80, 80, rect, 600, 720);
        expect(left.uEdge).toBe('FACE_X_MINUS');
        expect(left.handleU).toBe(0);
        const right = snapDimHandleToEdge('FACE_Z_PLUS', 'u', 400, 80, rect, 600, 720);
        expect(right.uEdge).toBe('FACE_X_PLUS');
        expect(right.handleU).toBe(600);
        const minusLeft = snapDimHandleToEdge('FACE_Z_MINUS', 'u', 500, 80, rect, 600, 720);
        expect(minusLeft.uEdge).toBe('FACE_X_MINUS');
        expect(minusLeft.handleU).toBe(600);
    });

    it('kółko V przysysa się do bliższej krawędzi G/D', () => {
        const rect = { u: 40, v: 40, width: 120, length: 80 };
        const bottom = snapDimHandleToEdge('FACE_Z_PLUS', 'v', 100, 50, rect, 600, 720);
        expect(bottom.vEdge).toBe('FACE_Y_MINUS');
        expect(bottom.handleV).toBe(0);
        const top = snapDimHandleToEdge('FACE_Z_PLUS', 'v', 100, 500, rect, 600, 720);
        expect(top.vEdge).toBe('FACE_Y_PLUS');
        expect(top.handleV).toBe(720);
        const end = dimHandleUv('FACE_Z_PLUS', 'u', rect, 'FACE_X_MINUS', 'FACE_Y_MINUS', 600, 720);
        expect(end).toEqual({ u: 0, v: 80 });
    });

    it('przeciąganie kółka jedzie z kursorem, magnes tylko przy krawędzi', () => {
        const rect = { u: 40, v: 40, width: 120, length: 80 };
        const mid = dragHandleAlongAxis('u', 250, 80, rect, 600, 720);
        expect(mid.handleU).toBe(250);
        expect(mid.handleV).toBe(80);
        expect(magnetEdgeIfAtBound('FACE_Z_PLUS', 'u', mid.handleU, mid.handleV, 600, 720)).toBeNull();

        const nearLeft = dragHandleAlongAxis('u', 20, 80, rect, 600, 720);
        expect(nearLeft.handleU).toBe(0);
        expect(magnetEdgeIfAtBound('FACE_Z_PLUS', 'u', nearLeft.handleU, nearLeft.handleV, 600, 720)?.uEdge)
            .toBe('FACE_X_MINUS');

        const nearRight = dragHandleAlongAxis('u', 580, 80, rect, 600, 720);
        expect(nearRight.handleU).toBe(600);
        expect(magnetEdgeIfAtBound('FACE_Z_PLUS', 'u', nearRight.handleU, nearRight.handleV, 600, 720)?.uEdge)
            .toBe('FACE_X_PLUS');
    });
});
