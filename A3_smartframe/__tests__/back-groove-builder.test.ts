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
            dim_nm: { x: mapped.x, y: mapped.y, z: mapped.z },
            localMatrix: Mat4.fromTRS(new Vec3(part.loc.x, part.loc.y, part.loc.z), rotQuat),
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
            width: mmToNm(1000),
            height: mmToNm(2000),
            depth: mmToNm(600),
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
            width: mmToNm(1000),
            height: mmToNm(2000),
            depth: mmToNm(600),
            zoneCount: 1,
            offsets: {
                'Dol_Plecy_-X': mmToNm(left),
                'Dol_Plecy_+X': mmToNm(right),
                'Dol_Plecy_-Y': mmToNm(11),
                'Dol_Plecy_+Y': mmToNm(11)
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
            width: mmToNm(1000),
            height: mmToNm(2000),
            depth: mmToNm(600),
            zoneCount: 3,
            bottomHeight: mmToNm(500),
            middleHeight: mmToNm(700)
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
        expect(bGroove!.width_nm).toBeCloseTo(mmToNm(486));
        expect(bGroove!.length_nm).toBeCloseTo(mmToNm(3));
        expect(bGroove!.depth_nm).toBeCloseTo(mmToNm(11));

        expect(mGroove!.width_nm).toBeCloseTo(mmToNm(686));
        expect(mGroove!.length_nm).toBeCloseTo(mmToNm(3));
        expect(mGroove!.depth_nm).toBeCloseTo(mmToNm(11));

        expect(tGroove!.width_nm).toBeCloseTo(mmToNm(786));
        expect(tGroove!.length_nm).toBeCloseTo(mmToNm(3));
        expect(tGroove!.depth_nm).toBeCloseTo(mmToNm(11));
    });
});

