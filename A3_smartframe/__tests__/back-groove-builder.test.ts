import { describe, it, expect } from 'vitest';
import { buildBackGrooves, PanelState } from '../back-groove-builder';
import { Korpus3Engine, applyLcsMapping } from '../smartframe-engine';
import { Mat4 } from '../../A1_core/cad-math/mat4';
import { Quat } from '../../A1_core/cad-math/quat';
import { Vec3 } from '../../A1_core/cad-math/vec3';
import { mmToNm } from '../../A1_core/cad-math/units';
import { defaultBackOverlapMm, readBackEdgeOffset } from '../back-overlap';

function panelStatesFromPlan(
    plan: ReturnType<Korpus3Engine['plan']>,
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
            zonePrefix: part.zonePrefix
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
        const engine = new Korpus3Engine();
        const plan = engine.plan({
            width: 1000,
            height: 2000,
            depth: 600,
            zoneCount: 1
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
        const engine = new Korpus3Engine();
        const plan = engine.plan({
            width: 1000,
            height: 2000,
            depth: 600,
            zoneCount: 1,
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
        const engine = new Korpus3Engine();
        const plan = engine.plan({
            width: 1000,
            height: 2000,
            depth: 600,
            zoneCount: 3,
            bottomHeight: 500,
            middleHeight: 700
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
        const engine = new Korpus3Engine();
        const plan = engine.plan({
            width: 1000,
            height: 2000,
            depth: 600,
            zoneCount: 1,
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

    it('isolates back offsets per zone in multi-zone cabinet (e.g. changing Dol_Plecy does NOT change Srodek_Plecy or Gora_Plecy)', () => {
        const engine = new Korpus3Engine();
        const plan = engine.plan({
            width: 1000,
            height: 2000,
            depth: 600,
            zoneCount: 3,
            bottomHeight: 500,
            middleHeight: 700,
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
});

