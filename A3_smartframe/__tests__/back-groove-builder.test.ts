import { describe, it, expect } from 'vitest';
import { buildBackGrooves, PanelState } from '../back-groove-builder';
import { planCabinet, applyLcsMapping } from '../smartframe-engine.js';
import { Mat4 } from '../../A1_core/cad-math/mat4';
import { Quat } from '../../A1_core/cad-math/quat';
import { Vec3 } from '../../A1_core/cad-math/vec3';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units';
import { defaultBackOverlapMm, readBackEdgeOffset } from '../back-overlap';

function panelStatesFromPlan(
    plan: ReturnType<typeof planCabinet>,
    offsets?: Record<string, number>
): PanelState[] {
    const defaultOverlapMm = defaultBackOverlapMm();
    return plan.parts.map((part) => {
        const mapped = applyLcsMapping(part.dim, part.lcs);
        let rotQuat = Quat.IDENTITY;
        if (part.lcs?.rotation) {
            rotQuat = Quat.fromEulerXYZ(
                part.lcs.rotation[0] * Math.PI / 180,
                part.lcs.rotation[1] * Math.PI / 180,
                part.lcs.rotation[2] * Math.PI / 180
            );
        }
        const state: PanelState = {
            id: part.key || part.name,
            role: part.role,
            dim_nm: { x: mmToNm(mapped.x), y: mmToNm(mapped.y), z: mmToNm(mapped.z) },
            localMatrix: Mat4.fromTRS(new Vec3(mmToNm(part.loc.x), mmToNm(part.loc.y), mmToNm(part.loc.z)), rotQuat),
            zonePrefix: part.zonePrefix,
            lcsMapping: part.lcs?.mapping
        };
        if (part.role === 'BACK_PANEL') {
            const panelName = part.name || part.key || 'Plecy';
            const src = offsets || {};
            state.backMarginsNm = {
                left: mmToNm(readBackEdgeOffset(src, panelName, '-X', defaultOverlapMm)),
                right: mmToNm(readBackEdgeOffset(src, panelName, '+X', defaultOverlapMm)),
                bottom: mmToNm(readBackEdgeOffset(src, panelName, '-Y', defaultOverlapMm)),
                top: mmToNm(readBackEdgeOffset(src, panelName, '+Y', defaultOverlapMm))
            };
        }
        return state;
    });
}

describe('buildBackGrooves overlap depth', () => {
    it('sets groove depth on sides and rails from 11 mm back overlay', () => {
        const plan = planCabinet({
            szerokosc_mm: 1000,
            wysokosc_mm: 2000,
            glebokosc_mm: 600,
            liczba_stref: 1
        });

        const intents = buildBackGrooves(panelStatesFromPlan(plan));
        const overlap = defaultBackOverlapMm();

        expect(intents.length).toBeGreaterThanOrEqual(2);
        for (const intent of intents) {
            expect(intent.feature?.params.depth_nm).toBeCloseTo(mmToNm(overlap));
        }
    });

    it('uses left gizmo overlay as Z-depth on the left side', () => {
        const left = 14;
        const right = 11;
        const plan = planCabinet({
            szerokosc_mm: 1000,
            wysokosc_mm: 2000,
            glebokosc_mm: 600,
            liczba_stref: 1,
            offsets: {
                'Dol_Plecy_-X': left,
                'Dol_Plecy_+X': right,
                'Dol_Plecy_-Y': 11,
                'Dol_Plecy_+Y': 11
            }
        });

        const panels = panelStatesFromPlan(plan, {
            'Plecy_-X': left,
            'Plecy_+X': right,
            'Plecy_-Y': 11,
            'Plecy_+Y': 11
        });
        const intents = buildBackGrooves(panels);
        const leftIntent = intents.find((i) => i.targetNodeId === 'BOK_L' || i.targetNodeId === 'B_BOK_L');

        expect(leftIntent).toBeDefined();
        expect(leftIntent!.feature?.params.depth_nm).toBeCloseTo(mmToNm(left));
    });

    it('verifies exact multi-zone groove lengths matching back panels', () => {
        const plan = planCabinet({
            szerokosc_mm: 1000,
            wysokosc_mm: 2000,
            glebokosc_mm: 600,
            liczba_stref: 3,
            wysokosc_strefy_dolnej_mm: 500,
            wysokosc_strefy_srodkowej_mm: 700
        });

        const panels = panelStatesFromPlan(plan);
        const intents = buildBackGrooves(panels);

        const bGroove = intents.find((i) => i.targetNodeId === 'B_BOK_L')?.feature?.params;
        const mGroove = intents.find((i) => i.targetNodeId === 'M_BOK_L')?.feature?.params;
        const tGroove = intents.find((i) => i.targetNodeId === 'T_BOK_L')?.feature?.params;

        expect(bGroove).toBeDefined();
        expect(mGroove).toBeDefined();
        expect(tGroove).toBeDefined();

        // Każda strefa ma inną, rzeczywistą długość wpustu odpowiadającą swoim plecom:
        expect(bGroove!.width_nm).toBeCloseTo(mmToNm(3));
        expect(bGroove!.length_nm).toBeCloseTo(mmToNm(486));
        expect(bGroove!.depth_nm).toBeCloseTo(mmToNm(11));

        expect(mGroove!.width_nm).toBeCloseTo(mmToNm(3));
        expect(mGroove!.length_nm).toBeCloseTo(mmToNm(686));
        expect(mGroove!.depth_nm).toBeCloseTo(mmToNm(11));

        expect(tGroove!.width_nm).toBeCloseTo(mmToNm(3));
        expect(tGroove!.length_nm).toBeCloseTo(mmToNm(786));
        expect(tGroove!.depth_nm).toBeCloseTo(mmToNm(11));
    });

    it('associatively changes groove depth to 17 mm when back offset is changed from 11 to 17 mm', () => {
        const plan = planCabinet({
            szerokosc_mm: 1000,
            wysokosc_mm: 2000,
            glebokosc_mm: 600,
            liczba_stref: 1,
            offsets: {
                'Plecy_-X': 17,
                'Plecy_+X': 17
            }
        });

        const panels = panelStatesFromPlan(plan, {
            'Plecy_-X': 17,
            'Plecy_+X': 17
        });
        const intents = buildBackGrooves(panels);
        const leftIntent = intents.find((i) => i.targetNodeId === 'BOK_L' || i.targetNodeId === 'B_BOK_L');
        const rightIntent = intents.find((i) => i.targetNodeId === 'BOK_P' || i.targetNodeId === 'B_BOK_P');

        expect(leftIntent).toBeDefined();
        expect(leftIntent!.feature?.params.depth_nm).toBeCloseTo(mmToNm(17));
        expect(rightIntent).toBeDefined();
        expect(rightIntent!.feature?.params.depth_nm).toBeCloseTo(mmToNm(17));
    });

    it('TRAVERSE_V: wcięcie tylko na tylnym T2 (FACE_Z_MINUS, 11×3), przedni bez; boczki nietknięte', () => {
        const plan = planCabinet({
            szerokosc_mm: 1000,
            wysokosc_mm: 2000,
            glebokosc_mm: 600,
            liczba_stref: 1,
            tryb_wienca_gornego: 'TRAVERSE_V',
            szerokosc_trawersu_mm: 100,
            cofniecie_plecow_mm: 3
        });

        const panels = panelStatesFromPlan(plan);
        const rear = panels.find((p) => p.role === 'TOP_PANEL' && String(p.id).includes('T2'))!;
        const front = panels.find((p) => p.role === 'TOP_PANEL' && !String(p.id).includes('T2'))!;
        const left = panels.find((p) => p.role === 'LEFT_SIDE_PANEL' || String(p.id).includes('BOK_L'))!;
        expect(rear).toBeDefined();
        expect(front).toBeDefined();
        expect(left).toBeDefined();

        const intents = buildBackGrooves(panels);
        const rearG = intents.find((i) => i.targetNodeId === rear.id);
        const frontG = intents.find((i) => i.targetNodeId === front.id);
        const leftG = intents.find((i) => i.targetNodeId === left.id);

        expect(frontG).toBeUndefined();
        expect(rearG).toBeDefined();
        expect(rearG!.feature?.face).toBe('-Z');
        expect(nmToMm(rear.dim_nm.y)).toBeCloseTo(100, 0);
        expect(nmToMm(rear.dim_nm.z)).toBeCloseTo(18, 0);
        const back = panels.find((p) => p.role === 'BACK_PANEL')!;
        expect(nmToMm(rearG!.feature!.params.length_nm)).toBeCloseTo(11, 0);
        expect(nmToMm(rearG!.feature!.params.depth_nm)).toBeCloseTo(nmToMm(back.dim_nm.z), 0);
        expect(rearG!.feature!.params.depth_nm).toBeLessThanOrEqual(rear.dim_nm.z);
        expect(rearG!.feature!.params.isEdgeNotch).toBe(true);

        // Boczek: klasyczny wpust na +Z, bez isEdgeNotch z gałęzi trawersa
        expect(leftG).toBeDefined();
        expect(leftG!.feature?.face).toBe('+Z');
        expect(leftG!.feature!.params.isEdgeNotch).toBeUndefined();
    });

    it('isolates back offsets per zone in multi-zone cabinet (e.g. changing Dol_Plecy does NOT change Srodek_Plecy or Gora_Plecy)', () => {
        const plan = planCabinet({
            szerokosc_mm: 1000,
            wysokosc_mm: 2000,
            glebokosc_mm: 600,
            liczba_stref: 3,
            wysokosc_strefy_dolnej_mm: 500,
            wysokosc_strefy_srodkowej_mm: 700,
            offsets: {
                'Dol_Plecy_-X': 17,
                'Dol_Plecy_+X': 17
            }
        });

        const panels = panelStatesFromPlan(plan, {
            'Dol_Plecy_-X': 17,
            'Dol_Plecy_+X': 17
        });
        const intents = buildBackGrooves(panels);

        const bGroove = intents.find((i) => i.targetNodeId === 'B_BOK_L')?.feature?.params;
        const mGroove = intents.find((i) => i.targetNodeId === 'M_BOK_L')?.feature?.params;
        const tGroove = intents.find((i) => i.targetNodeId === 'T_BOK_L')?.feature?.params;

        expect(bGroove).toBeDefined();
        expect(mGroove).toBeDefined();
        expect(tGroove).toBeDefined();

        // Dolna strefa ma 17 mm:
        expect(bGroove!.depth_nm).toBeCloseTo(mmToNm(17));

        // Środkowa i górna strefa pozostają domyślne 11 mm:
        expect(mGroove!.depth_nm).toBeCloseTo(mmToNm(11));
        expect(tGroove!.depth_nm).toBeCloseTo(mmToNm(11));
    });

    it('opcja 3: gdy margines pleców na wieńcu dolnym wynosi 18 mm (pełna grubość), wieniec jest skracany do lica pleców i nie ma wpustu', () => {
        const plan = planCabinet({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
            cofniecie_plecow_mm: 15,
            offsets: {
                'Plecy_-Y': 18
            }
        });

        const botPart = plan.parts.find((p) => p.role === 'BOTTOM_PANEL')!;
        const leftPart = plan.parts.find((p) => p.role === 'LEFT_SIDE_PANEL')!;

        // Wieniec dolny został skrócony o cofnięcie pleców (560 - 15 = 545 mm):
        expect(botPart.dim.y).toBeCloseTo(545, 0);
        // Bok lewy zachowuje pełną głębokość 560 mm:
        expect(leftPart.dim.y).toBeCloseTo(560, 0);

        const panels = panelStatesFromPlan(plan, {
            'Plecy_-Y': 18
        });
        const intents = buildBackGrooves(panels);

        const botGroove = intents.find((i) => i.targetNodeId === botPart.key || i.targetNodeId === botPart.name);
        const leftGroove = intents.find((i) => i.targetNodeId === leftPart.key || i.targetNodeId === leftPart.name);

        // Brak wpustu na wieńcu (plecy nakładane na odciętą krawędź):
        expect(botGroove).toBeUndefined();

        // Bok lewy nadal ma klasyczny wpust:
        expect(leftGroove).toBeDefined();
    });

    it('gdy przeciągamy plecy w bok czerwonym gizmem (Plecy_+X = 18 mm), bok prawy jest odcinany', () => {
        const plan = planCabinet({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
            cofniecie_plecow_mm: 15,
            offsets: {
                'Plecy_+X': 18
            }
        });

        const botPart = plan.parts.find((p) => p.role === 'BOTTOM_PANEL')!;
        const rightPart = plan.parts.find((p) => p.role === 'RIGHT_SIDE_PANEL')!;
        const backPart = plan.parts.find((p) => p.role === 'BACK_PANEL')!;

        // Bok prawy skrócony o 15 mm:
        expect(rightPart.dim.y).toBeCloseTo(545, 0);

        const panels = panelStatesFromPlan(plan, {
            'Plecy_+X': 18
        });
        const intents = buildBackGrooves(panels);
        const botGroove = intents.find((i) => i.targetNodeId === botPart.key || i.targetNodeId === botPart.name);
        const rightGroove = intents.find((i) => i.targetNodeId === rightPart.key || i.targetNodeId === rightPart.name);

        expect(botGroove).toBeDefined();
        // Bok prawy skrócony — brak wpustu na boku prawym (plecy nakładane):
        expect(rightGroove).toBeUndefined();
    });
});


