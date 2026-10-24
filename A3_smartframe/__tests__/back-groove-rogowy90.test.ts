import { describe, it, expect } from 'vitest';
import { buildBackGrooves, PanelState } from '../back-groove-builder';
import { planCabinet, applyLcsMapping } from '../smartframe-engine.js';
import { buildMeshFromPanel } from '../../A4_smartpanel/native_core/mesh_builder';
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

        // Pasek przy +Y (PLECY_Y): po BOTTOM [90,180,0] v=0 = przód, tył = wysokie v
        const alongX = bottom.find((g) => {
            const p = g.feature!.params;
            return p.width_nm > p.length_nm;
        });
        expect(alongX).toBeDefined();
        const botPanel = panels.find((p) => p.role === 'BOTTOM_PANEL')!;
        const faceD = botPanel.dim_nm.y;
        expect(nmToMm(alongX!.feature!.params.v_nm)).toBeGreaterThan(nmToMm(faceD) * 0.5);
        // Rowek zaczyna się dokładnie na styku z BOK_P (18 mm od krawędzi), a nie w próżni na zakładce pleców (7 mm)
        expect(nmToMm(alongX!.feature!.params.u_nm)).toBeCloseTo(18, 0);
        // Długość wpustu obejmuje całą szerokość tyłu (W - grubość BOK_P = 900 - 18 = 882 mm dochodząc do krawędzi wieńca w narożniku styku pleców),
        // a nie tylko szerokość przedniego wcięcia L (282 mm)
        expect(nmToMm(alongX!.feature!.params.width_nm)).toBeCloseTo(882, 0);

        // Pasek przy −X (PLECY_X): u blisko 900 - 3 = 897
        const alongY = bottom.find((g) => {
            const p = g.feature!.params;
            return p.length_nm > p.width_nm;
        });
        expect(alongY).toBeDefined();
        const faceW = botPanel.dim_nm.x;
        expect(nmToMm(alongY!.feature!.params.u_nm)).toBeGreaterThan(nmToMm(faceW) * 0.5);
        expect(nmToMm(alongY!.feature!.params.u_nm)).toBeCloseTo(nmToMm(faceW) - th, 0);
        // Rowek wzdłuż Y zaczyna się dokładnie na styku z BOK_L (18 mm od krawędzi), a nie w próżni (7 mm)
        expect(nmToMm(alongY!.feature!.params.v_nm)).toBeCloseTo(18, 0);
        // Długość wpustu wzdłuż Y obejmuje całą głębokość tyłu (D - grubość BOK_L = 900 - 18 = 882 mm dochodząc do narożnika styku)
        expect(nmToMm(alongY!.feature!.params.length_nm)).toBeCloseTo(882, 0);

        // Głębokość zakładki 11 mm (nie narożnik)
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

    it('przy cofnieciu 15mm generuje wpusty na wieńcu i buduje poprawny mesh bez zakrywania', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600, glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 15
        });

        const panels = panelStatesFromPlan(plan, undefined, 'korpus_rogowy90');
        const intents = buildBackGrooves(panels);
        const botIntents = intents.filter((i) => i.targetNodeId === 'WIENIEC_D' || i.targetNodeId.endsWith('WIENIEC_D'));
        const botPart = plan.parts.find(p => p.role === 'BOTTOM_PANEL')!;
        
        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(900),
            height: mmToNm(900),
            thickness: mmToNm(18),
            custom_properties: botPart.customProperties,
            features: botIntents.map((i, idx) => {
                const faceMap: Record<string, any> = {
                    '+Z': 'FACE_Z_PLUS',
                    '-Z': 'FACE_Z_MINUS',
                    '+Y': 'FACE_Y_PLUS',
                    '-Y': 'FACE_Y_MINUS',
                    '+X': 'FACE_X_PLUS',
                    '-X': 'FACE_X_MINUS'
                };
                return {
                    id: `bg_${idx}`,
                    type: 'groove',
                    face: faceMap[i.feature!.face] || i.feature!.face,
                    params: {
                        isBackGroove: true,
                        u: nmToMm(i.feature!.params.u_nm),
                        v: nmToMm(i.feature!.params.v_nm),
                        width: nmToMm(i.feature!.params.width_nm),
                        length: nmToMm(i.feature!.params.length_nm),
                        depth: nmToMm(i.feature!.params.depth_nm)
                    }
                };
            })
        });
        const alongX = botIntents.find(i => i.feature!.params.width_nm > i.feature!.params.length_nm)!;
        const alongY = botIntents.find(i => i.feature!.params.length_nm > i.feature!.params.width_nm)!;
        expect(alongX).toBeDefined();
        expect(alongY).toBeDefined();

        // Rowek X zaczyna się na styku z BOK_P (18 mm) i biegnie na przestrzał do zewnętrznej krawędzi (900 mm)
        expect(nmToMm(alongX.feature!.params.u_nm)).toBeCloseTo(18, 0);
        expect(nmToMm(alongX.feature!.params.width_nm)).toBeCloseTo(882, 0);
        expect(nmToMm(alongX.feature!.params.u_nm) + nmToMm(alongX.feature!.params.width_nm)).toBeCloseTo(900, 0);

        // Rowek Y zaczyna się na styku z BOK_L (18 mm) i biegnie na przestrzał do zewnętrznej krawędzi (900 mm)
        expect(nmToMm(alongY.feature!.params.v_nm)).toBeCloseTo(18, 0);
        expect(nmToMm(alongY.feature!.params.length_nm)).toBeCloseTo(882, 0);
        expect(nmToMm(alongY.feature!.params.v_nm) + nmToMm(alongY.feature!.params.length_nm)).toBeCloseTo(900, 0);

        expect(mesh['feature_bg_0_bottom']).toBeDefined();
        expect(mesh['feature_bg_0_w0']).toBeDefined();
        expect(mesh['feature_bg_0_w2']).toBeDefined();

        expect(mesh['feature_bg_1_bottom']).toBeDefined();
        expect(mesh['feature_bg_1_w1']).toBeDefined();
        expect(mesh['feature_bg_1_w3']).toBeDefined();

        // Żaden trójkąt na FACE_Z_PLUS nie może zakrywać światła rowka na całej długości (włącznie z przecięciem w rogu)
        const zPlus = mesh.FACE_Z_PLUS as { positions: number[]; indices: number[] };
        const coveringTris: number[][] = [];
        for (let i = 0; i < zPlus.indices.length; i += 3) {
            const i0 = zPlus.indices[i] * 3;
            const i1 = zPlus.indices[i + 1] * 3;
            const i2 = zPlus.indices[i + 2] * 3;
            const p0 = [zPlus.positions[i0], zPlus.positions[i0 + 1], zPlus.positions[i0 + 2]];
            const p1 = [zPlus.positions[i1], zPlus.positions[i1 + 1], zPlus.positions[i1 + 2]];
            const p2 = [zPlus.positions[i2], zPlus.positions[i2 + 1], zPlus.positions[i2 + 2]];
            const cX = (p0[0] + p1[0] + p2[0]) / 3;
            const cY = (p0[1] + p1[1] + p2[1]) / 3;
            // Wpust along X: Y in [435, 438], X from -430 to 448
            if (cY > 435.05 && cY < 437.95 && cX > -430 && cX < 448) {
                coveringTris.push([cX, cY]);
            }
            // Wpust along Y: X in [435, 438], Y from -430 to 448
            if (cX > 435.05 && cX < 437.95 && cY > -430 && cY < 448) {
                coveringTris.push([cX, cY]);
            }
        }
        expect(coveringTris.length).toBe(0);
    });

    it('korpus3 standard z cofnieciem 15mm tworzy klasyczny rowek z 2 sciankami i bez zakrycia', () => {
        const plan = planCabinet({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 500,
            liczba_stref: 1,
            typ_korpusu: 'korpus3',
            cofniecie_plecow_mm: 15
        });

        const panels = panelStatesFromPlan(plan, undefined, 'korpus3');
        const intents = buildBackGrooves(panels);
        const botPart = plan.parts.find(p => p.role === 'BOTTOM_PANEL')!;
        const botIntents = intents.filter((i) => i.targetNodeId === botPart.key || i.targetNodeId === botPart.name);

        const mesh = buildMeshFromPanel({
            role: 'BOTTOM_PANEL',
            width: mmToNm(botPart.dim.x),
            height: mmToNm(botPart.dim.y),
            thickness: mmToNm(botPart.thickness),
            custom_properties: botPart.customProperties,
            features: botIntents.map((i, idx) => ({
                id: `bg_${idx}`,
                type: 'groove',
                face: 'FACE_Z_PLUS',
                params: {
                    isBackGroove: true,
                    u: nmToMm(i.feature!.params.u_nm),
                    v: nmToMm(i.feature!.params.v_nm),
                    width: nmToMm(i.feature!.params.width_nm),
                    length: nmToMm(i.feature!.params.length_nm),
                    depth: nmToMm(i.feature!.params.depth_nm)
                }
            }))
        });

        const zPlus = mesh.FACE_Z_PLUS as { positions: number[]; indices: number[] };

        // Czy wieniec ma wygenerowane ścianki w0 i w2 dla wpustu?
        expect(mesh['feature_bg_0_w0']).toBeDefined();
        expect(mesh['feature_bg_0_w2']).toBeDefined();
        expect(mesh['feature_bg_0_bottom']).toBeDefined();

        // Sprawdzamy czy na FACE_Z_PLUS są trójkąty zakrywające wpust:
        const gp = botIntents[0].feature!.params;
        const vMin = nmToMm(gp.v_nm);
        const vMax = vMin + nmToMm(gp.length_nm);

        // localTo3D for FACE_Z_PLUS:
        // origin: [-w/2, -h/2, t/2]
        // Y = v - h/2.
        const yMin = vMin - botPart.dim.y / 2;
        const yMax = vMax - botPart.dim.y / 2;

        const coveringTris: number[][] = [];
        for (let i = 0; i < zPlus.indices.length; i += 3) {
            const i0 = zPlus.indices[i] * 3;
            const i1 = zPlus.indices[i + 1] * 3;
            const i2 = zPlus.indices[i + 2] * 3;
            const p0 = [zPlus.positions[i0], zPlus.positions[i0 + 1], zPlus.positions[i0 + 2]];
            const p1 = [zPlus.positions[i1], zPlus.positions[i1 + 1], zPlus.positions[i1 + 2]];
            const p2 = [zPlus.positions[i2], zPlus.positions[i2 + 1], zPlus.positions[i2 + 2]];
            const cY = (p0[1] + p1[1] + p2[1]) / 3;
            if (cY > yMin + 0.05 && cY < yMax - 0.05) {
                coveringTris.push([cY]);
            }
        }
        expect(coveringTris.length).toBe(0);
    });

    it('w realnym dokumencie z UUID dla węzłów (SyncBackGroovesCommand) LISTWA_NAROZNA nie blokuje wręgu/wpustu i PLECY_X idą na przestrzał', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 15
        });

        const panels: PanelState[] = plan.parts.map((part, idx) => {
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
                id: `node_uuid_${idx}_${Math.random()}`,
                role: part.role,
                key: part.key,
                name: part.name,
                isCornerNailer: Boolean(part.customProperties?.corner_nailer),
                customProperties: part.customProperties,
                dim_nm: { x: mmToNm(mapped.x), y: mmToNm(mapped.y), z: mmToNm(mapped.z) },
                localMatrix: Mat4.fromTRS(
                    new Vec3(mmToNm(part.loc.x), mmToNm(part.loc.y), mmToNm(part.loc.z)),
                    rotQuat
                ),
                zonePrefix: part.zonePrefix
            };
            if (part.role === 'BACK_PANEL') {
                const panelKey = part.key || part.name || 'Plecy';
                const edge = (suf: '+X' | '-X' | '+Y' | '-Y') => {
                    const def = defaultBackEdgeOverlapMm(`${panelKey}_${suf}`, 'korpus_rogowy90');
                    return mmToNm(readBackEdgeOffset({}, panelKey, suf, def, part.zonePrefix));
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

        const intents = buildBackGrooves(panels);
        const botPanelState = panels.find(p => p.role === 'BOTTOM_PANEL')!;
        const botIntents = intents.filter(i => i.targetNodeId === botPanelState.id);

        expect(botIntents.length).toBe(2);

        // PLECY_X wzdłuż osi Y:
        const alongY = botIntents.find(i => i.feature!.params.length_nm > i.feature!.params.width_nm)!;
        expect(alongY).toBeDefined();

        // Rowek zaczyna się na styku z BOK_L (18 mm) i dochodzi na przestrzał do zewnętrznej krawędzi formatki (900 mm)
        expect(nmToMm(alongY.feature!.params.v_nm)).toBeCloseTo(18, 0);
        expect(nmToMm(alongY.feature!.params.length_nm)).toBeCloseTo(882, 0);
        expect(nmToMm(alongY.feature!.params.v_nm) + nmToMm(alongY.feature!.params.length_nm)).toBeCloseTo(900, 0);

        // PLECY_Y wzdłuż osi X:
        const alongX = botIntents.find(i => i.feature!.params.width_nm > i.feature!.params.length_nm)!;
        expect(alongX).toBeDefined();
        expect(nmToMm(alongX.feature!.params.u_nm)).toBeCloseTo(18, 0);
        expect(nmToMm(alongX.feature!.params.width_nm)).toBeCloseTo(882, 0);
        expect(nmToMm(alongX.feature!.params.u_nm) + nmToMm(alongX.feature!.params.width_nm)).toBeCloseTo(900, 0);
    });

    it('opcja 3 w rogowy90: gdy PLECY_Y_-Y ma 18 mm (pełna grubość wieńca), oba ramiona wieńca w narożniku są skracane o cofnięcie pleców (brak wystającego przekroju) i brak wpustów na wieńcu', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 15,
            offsets: {
                'PLECY_Y_-Y': 18
            }
        });

        const botPart = plan.parts.find((p) => p.role === 'BOTTOM_PANEL')!;
        expect(botPart.customProperties?.shape).toBe('L_NOTCH');
        const outline2d = botPart.customProperties?.outline2d as [number, number][];
        expect(outline2d).toBeDefined();

        // Sprawdzamy czy maksymalne rozpiętości obu ramion wieńca zostały skrócone o 15 mm:
        const maxV = Math.max(...outline2d.map(pt => pt[1]));
        const minV = Math.min(...outline2d.map(pt => pt[1]));
        const maxU = Math.max(...outline2d.map(pt => pt[0]));
        const minU = Math.min(...outline2d.map(pt => pt[0]));

        // Przed odcięciem rozpiętości wynosiły 900 - 18 = 882 mm.
        // Po odcięciu ramion w narożniku wynoszą dokładnie 882 - 15 = 867 mm dla obu osi:
        expect(maxV - minV).toBeCloseTo(882 - 15, 0);
        expect(maxU - minU).toBeCloseTo(882 - 15, 0);

        const panels = panelStatesFromPlan(plan, {
            'PLECY_Y_-Y': 18
        }, 'korpus_rogowy90');
        const intents = buildBackGrooves(panels);

        const botIntents = intents.filter((i) => i.targetNodeId === botPart.key || i.targetNodeId === botPart.name);

        // Brak wpustów na wieńcu, bo oba ramiona zostały skrócone do lica pleców i plecy nakłada się na krawędzie:
        expect(botIntents.length).toBe(0);
    });

    it('gdy PLECY_Y_+X ma 18 mm (czerwone gizmo odcina Bok_P), wpust wieńca pod PLECY_Y nie wystaje o 18 mm poza wieniec i kończy się na styku z Bok_P', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 15,
            offsets: {
                'PLECY_Y_+X': 18
            }
        });

        const botPart = plan.parts.find((p) => p.role === 'BOTTOM_PANEL')!;
        const bokP = plan.parts.find((p) => p.role === 'RIGHT_SIDE_PANEL')!;
        expect(bokP.dim.y).toBeCloseTo(600 - 15, 0); // Bok_P skrócony o 15 mm

        const panels = panelStatesFromPlan(plan, {
            'PLECY_Y_+X': 18
        }, 'korpus_rogowy90');

        const intents = buildBackGrooves(panels);
        const botIntents = intents.filter((i) => i.targetNodeId === botPart.key || i.targetNodeId === botPart.name);

        const alongX = botIntents.find(i => i.feature!.params.width_nm > i.feature!.params.length_nm);
        expect(alongX).toBeDefined();
        // Wpust na wieńcu pod PLECY_Y kończy się na styku z Bok_P (szerokość 882 mm, nie 900 mm):
        expect(nmToMm(alongX!.feature!.params.width_nm)).toBeCloseTo(882, 0);

        const topPart = plan.parts.find((p) => p.role === 'TOP_PANEL')!;
        const topIntents = intents.filter((i) => i.targetNodeId === topPart.key || i.targetNodeId === topPart.name);
        const topAlongX = topIntents.find(i => i.feature!.params.width_nm > i.feature!.params.length_nm);
        expect(topAlongX).toBeDefined();
        expect(nmToMm(topAlongX!.feature!.params.width_nm)).toBeCloseTo(882, 0);
    });

    it('gdy PLECY_X_-X ma 18 mm (odcięcie Bok_L), wpust wieńca pod PLECY_X nie wystaje o 18 mm poza wieniec i kończy się na styku z Bok_L', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 15,
            offsets: {
                'PLECY_X_-X': 18
            }
        });

        const botPart = plan.parts.find((p) => p.role === 'BOTTOM_PANEL')!;
        const bokL = plan.parts.find((p) => p.role === 'LEFT_SIDE_PANEL')!;
        expect(bokL.dim.x).toBeCloseTo(600 - 15, 0); // Bok_L skrócony o 15 mm

        const panels = panelStatesFromPlan(plan, {
            'PLECY_X_-X': 18
        }, 'korpus_rogowy90');

        const intents = buildBackGrooves(panels);
        const botIntents = intents.filter((i) => i.targetNodeId === botPart.key || i.targetNodeId === botPart.name);

        const alongY = botIntents.find(i => i.feature!.params.length_nm > i.feature!.params.width_nm);
        expect(alongY).toBeDefined();
        // Wpust na wieńcu pod PLECY_X kończy się na styku z Bok_L (długość 882 mm, nie 900 mm):
        expect(nmToMm(alongY!.feature!.params.length_nm)).toBeCloseTo(882, 0);
    });
});



