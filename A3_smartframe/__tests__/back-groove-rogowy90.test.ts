import { describe, it, expect } from 'vitest';
import { buildBackGrooves, PanelState } from '../back-groove-builder';
import { planCabinet, applyLcsMapping } from '../smartframe-engine.js';
import { Mat4 } from '../../A1_core/cad-math/mat4';
import { Quat } from '../../A1_core/cad-math/quat';
import { Vec3 } from '../../A1_core/cad-math/vec3';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units';
import { defaultBackOverlapMm, defaultBackEdgeOverlapMm, readBackEdgeOffset } from '../back-overlap';

function panelStatesFromPlan(
    plan: ReturnType<typeof planCabinet>,
    offsets?: Record<string, number>,
    cabinetType = ''
): PanelState[] {
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
            localMatrix: Mat4.fromTRS(
                new Vec3(mmToNm(part.loc.x), mmToNm(part.loc.y), mmToNm(part.loc.z)),
                rotQuat
            ),
            zonePrefix: part.zonePrefix
        };
        if (part.role === 'BACK_PANEL') {
            const panelName = part.name || part.key || 'Plecy';
            const src = offsets || {};
            const edge = (suf: '+X' | '-X' | '+Y' | '-Y') => {
                const def = defaultBackEdgeOverlapMm(`${panelName}_${suf}`, cabinetType);
                return mmToNm(readBackEdgeOffset(src, panelName, suf, def, part.zonePrefix));
            };
            state.backMarginsNm = {
                left: edge('-X'),
                right: edge('+X'),
                bottom: edge('-Y'),
                top: edge('+Y')
            };
        }
        return state;
    });
}

describe('Rogowy90 back grooves on real backs', () => {
    it('places thin grooves on wieĹ„ce at PLECY_Y (+Y) and PLECY_X (â’X), not mid-plate', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600, glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 3
        });

        const panels = panelStatesFromPlan(plan, undefined, 'korpus_rogowy90');
        const intents = buildBackGrooves(panels);

        const bottom = intents.filter((i) => i.targetNodeId === 'WIENIEC_D' || i.targetNodeId.endsWith('WIENIEC_D'));
        expect(bottom.length).toBeGreaterThanOrEqual(2);

        const th = 3;
        for (const g of bottom) {
            const p = g.feature!.params;
            const minSide = Math.min(p.width_nm, p.length_nm);
            expect(nmToMm(minSide)).toBeCloseTo(th, 0);
        }

        // Pasek przy +Y (PLECY_Y): po BOTTOM [90,180,0] v=0 = przĂłd, tyĹ‚ = wysokie v
        const alongX = bottom.find((g) => {
            const p = g.feature!.params;
            return p.width_nm > p.length_nm;
        });
        expect(alongX).toBeDefined();
        const botPanel = panels.find((p) => p.role === 'BOTTOM_PANEL')!;
        const faceD = botPanel.dim_nm.y;
        expect(nmToMm(alongX!.feature!.params.v_nm)).toBeGreaterThan(nmToMm(faceD) * 0.5);

        // Pasek przy â’X (PLECY_X): u blisko 0
        const alongY = bottom.find((g) => {
            const p = g.feature!.params;
            return p.length_nm > p.width_nm;
        });
        expect(alongY).toBeDefined();
        const faceW = botPanel.dim_nm.x;
        expect(nmToMm(alongY!.feature!.params.u_nm)).toBeGreaterThan(nmToMm(faceW) * 0.5);
        expect(nmToMm(alongY!.feature!.params.u_nm)).toBeCloseTo(nmToMm(faceW) - th, 0);

        // GĹ‚Ä™bokoĹ›Ä‡ zakĹ‚adki 11 mm (nie naroĹĽnik)
        expect(nmToMm(alongX!.feature!.params.depth_nm)).toBeCloseTo(defaultBackOverlapMm(), 0);
        expect(nmToMm(alongY!.feature!.params.depth_nm)).toBeCloseTo(defaultBackOverlapMm(), 0);
    });

    it('cuts grooves into BOK_P / BOK_L at back overlaps', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600, glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 3
        });

        const intents = buildBackGrooves(panelStatesFromPlan(plan, undefined, 'korpus_rogowy90'));
        const bokX = intents.find((i) => i.targetNodeId === 'BOK_P' || i.targetNodeId.endsWith('BOK_P'));
        const bokY = intents.find((i) => i.targetNodeId === 'BOK_L' || i.targetNodeId.endsWith('BOK_L'));
        expect(bokX).toBeDefined();
        expect(bokY).toBeDefined();
        expect(nmToMm(bokX!.feature!.params.depth_nm)).toBeCloseTo(11, 0);
        expect(nmToMm(bokY!.feature!.params.depth_nm)).toBeCloseTo(11, 0);
        expect(nmToMm(Math.min(bokX!.feature!.params.width_nm, bokX!.feature!.params.length_nm))).toBeCloseTo(3, 0);
        expect(nmToMm(Math.min(bokY!.feature!.params.width_nm, bokY!.feature!.params.length_nm))).toBeCloseTo(3, 0);
    });
});
