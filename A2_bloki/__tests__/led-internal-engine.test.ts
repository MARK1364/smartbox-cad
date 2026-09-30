import { describe, it, expect } from 'vitest';
import { syncBlokiLedInternalGrooves, assertCanonicalLedInternalParams } from '../led-internal-engine.js';
import { buildLedInternalPlan } from '../led-internal-adapter.js';
import { BLOKI_INTERNAL_OPTIONS, BLOKI_CATEGORY_NAMES } from '../bloki-bay-actions.js';
import { MODULE_TYPES } from '../ui/BlokiFloatingWindow.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';


describe('Bloki LED Internal Module (buildLedInternalPlan)', () => {
    it('registers LED_INTERNAL in internal category', () => {
        const intOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'LED_INTERNAL');
        expect(intOpt).toBeDefined();
        expect(intOpt?.category).toBe('internal');
        expect(intOpt?.type).toBe('blok_led_internal');
        expect(MODULE_TYPES['LED_INTERNAL']?.category).toBe('internal');
        expect(BLOKI_CATEGORY_NAMES['LED_INTERNAL']).toBe('blok_led_szafowy');
    });

    it('odrzuca wycofane aliasy (fail-fast)', () => {
        expect(() => assertCanonicalLedInternalParams({ variant: 'VERTICAL_BOTH_SIDES' })).toThrow(/variant → wariant_led/);
        expect(() => assertCanonicalLedInternalParams({ offsetFromFrontLeftMm: 50 })).toThrow(/offsetFromFrontLeftMm → odsuniecie_od_przodu_lewe_mm/);
        expect(() => assertCanonicalLedInternalParams({ wariant_led: 'VERTICAL_BOTH_SIDES' })).not.toThrow();
    });

    it('generates 3D profile plan for vertical LED on both sides in wardrobe bay', () => {
        const plan = buildLedInternalPlan({
            wariant_led: 'VERTICAL_BOTH_SIDES',
            odsuniecie_od_przodu_lewe_mm: 50,
            odsuniecie_od_przodu_prawe_mm: 150,
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9,
            odstep_gora_mm: 20,
            odstep_dol_mm: 20
        }, { width_mm: 600, height_mm: 2000, depth_mm: 550  });

        expect(plan.parts.length).toBe(2);
        const [leftStrip, rightStrip] = plan.parts;
        expect(leftStrip.name).toContain('Lewy');
        expect(rightStrip.name).toContain('Prawy');
        expect(leftStrip.role).toBe('LED');
        expect(rightStrip.role).toBe('LED');

        // Orientacja pionowa w scenie (model.height = Y = pion):
        expect(leftStrip.dim.y).toBe(1960); // stripH = 2000 - 20 - 20 (pionowa wysokość profilu)
        expect(rightStrip.dim.y).toBe(1960);
        expect(leftStrip.dim.x).toBe(9);    // głębokość wpustu grooveD w bok szafy
        expect(leftStrip.dim.z).toBe(14);   // szerokość profilu grooveW w osi głębokości
        expect(leftStrip.loc.z).toBe(1000); // zCenter = 20 + 1960/2

        // Osadzenie we wpustach w bokach korpusu:
        expect(leftStrip.loc.x).toBe(-300 - 4.5); // lewy bok (-width/2 - grooveD/2)
        expect(rightStrip.loc.x).toBe(300 + 4.5);  // prawy bok (width/2 + grooveD/2)

        // Pozycje Y wyrównane ze środkiem wpustu:
        // depth=550 -> front is at -275
        // left: -275 + 50 + 7 = -218
        expect(leftStrip.loc.y).toBe(-218);
        // right: -275 + 150 + 7 = -118
        expect(rightStrip.loc.y).toBe(-118);
    });

    it('handles independent default left offset 50 mm and right offset 150 mm without symmetry collapse', () => {
        const plan = buildLedInternalPlan({
            wariant_led: 'VERTICAL_BOTH_SIDES',
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9,
            odstep_gora_mm: 20,
            odstep_dol_mm: 20
        }, { width_mm: 600, height_mm: 2000, depth_mm: 500  });

        expect(plan.parts.length).toBe(2);
        const [leftStrip, rightStrip] = plan.parts;
        // depth=500 -> front is at -250
        // left: -250 + 50 + 7 = -193
        expect(leftStrip.loc.y).toBe(-193);
        // right: -250 + 150 + 7 = -93
        expect(rightStrip.loc.y).toBe(-93);

        // Kanały w formatkach również niesymetryczne przy domyślnych parametrach
        const leftPanel: any = { id: 'p_l', width: 500_000_000, height: 2000_000_000, features: [] };
        const rightPanel: any = { id: 'p_r', width: 500_000_000, height: 2000_000_000, features: [] };
        const docMock: any = {
            findNode: (id: string) => {
                if (id === 'p_l') return { domainData: leftPanel };
                if (id === 'p_r') return { domainData: rightPanel };
                return null;
            }
        };
        const sbNode: any = {
            domainData: {
                id: 'sb_test',
                height: 2000_000_000,
                depth: 500_000_000,
                generatorParams: {
                    boxType: 'LED_INTERNAL',
                    customReferences: { xMin: { panelId: 'p_l' }, xMax: { panelId: 'p_r' } }
                }
            }
        };
        syncBlokiLedInternalGrooves(sbNode, docMock);
        expect(leftPanel.features[0].params.u).toBe(500 - 50 - 14); // 436 mm (50 mm od frontu)
        expect(rightPanel.features[0].params.u).toBe(150);          // 150 mm od frontu
    });

    it('syncBlokiLedInternalGrooves respects CADNode localMatrix rotation when present', () => {
        const leftPanel = new PanelModel({ width: 500_000_000, height: 2000_000_000, thickness: 18_000_000 });
        const leftNode = CADNode.create(NodeType.PART, 'Bok_L', 'p_l');
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(0, 0, 0), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));

        const rightPanel = new PanelModel({ width: 500_000_000, height: 2000_000_000, thickness: 18_000_000 });
        const rightNode = CADNode.create(NodeType.PART, 'Bok_P', 'p_r');
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(0, 0, 0), Quat.fromEulerXYZ(0, 0, Math.PI / 2));

        const docMock: any = {
            findNode: (id: string) => {
                if (id === 'p_l') return leftNode;
                if (id === 'p_r') return rightNode;
                return null;
            }
        };
        const sbNode: any = {
            domainData: {
                id: 'sb_test_rot',
                height: 2000_000_000,
                depth: 500_000_000,
                generatorParams: {
                    boxType: 'LED_INTERNAL',
                    odsuniecie_od_przodu_lewe_mm: 50,
                    odsuniecie_od_przodu_prawe_mm: 150,
                    customReferences: { xMin: { panelId: 'p_l' }, xMax: { panelId: 'p_r' } }
                }
            }
        };
        syncBlokiLedInternalGrooves(sbNode, docMock);
        expect(leftPanel.features[0].params.u).toBe(500 - 50 - 14); // 436 mm od tylnej krawędzi (50 mm od frontu)
        expect(rightPanel.features[0].params.u).toBe(150);          // 150 mm od frontu
    });


    it('generates horizontal top LED profile for LED_INTERNAL when requested', () => {
        const plan = buildLedInternalPlan({
            wariant_led: 'HORIZONTAL_TOP',
            odsuniecie_od_przodu_mm: 50,
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9
        }, { width_mm: 600, height_mm: 800, depth_mm: 500  });

        expect(plan.parts.length).toBe(1);
        const topStrip = plan.parts[0];
        expect(topStrip.role).toBe('LED');
        expect(topStrip.dim.x).toBe(596);
        expect(topStrip.dim.y).toBe(9);
        expect(topStrip.dim.z).toBe(14);
        expect(topStrip.loc.y).toBe(-250 + 50 + 7);
    });

    it('generates vertical LED profile and groove on BACK panel with center offset 125 mm', () => {
        const plan = buildLedInternalPlan({
            wariant_led: 'VERTICAL_BACK',
            odsuniecie_tyl_od_srodka_mm: 125,
            szerokosc_wpustu_mm: 14,
            glebokosc_wpustu_mm: 9,
            odstep_gora_mm: 20,
            odstep_dol_mm: 20
        }, { width_mm: 600, height_mm: 2000, depth_mm: 500  });

        expect(plan.parts.length).toBe(1);
        const backStrip = plan.parts[0];
        expect(backStrip.name).toContain('Plecy');
        expect(backStrip.loc.x).toBe(125);
        expect(backStrip.loc.y).toBe(250 + 4.5);
        expect(backStrip.dim.x).toBe(14);
        expect(backStrip.dim.y).toBe(1960);
        expect(backStrip.dim.z).toBe(9);

        const backPanel: any = {
            id: 'panel_back',
            role: 'BACK_PANEL',
            width: 600_000_000,
            height: 2000_000_000,
            features: []
        };
        const docMock: any = {
            findNode: (id: string) => {
                if (id === 'panel_back') return { domainData: backPanel };
                return null;
            },
            getPanels: () => [{ domainData: backPanel }]
        };
        const containerMock: any = {
            id: 'sb_led_back_1',
            height: 2000_000_000,
            depth: 500_000_000,
            width: 600_000_000,
            generatorParams: {
                wariant_led: 'VERTICAL_BACK',
                odsuniecie_tyl_od_srodka_mm: 125,
                szerokosc_wpustu_mm: 14,
                glebokosc_wpustu_mm: 9,
                odstep_gora_mm: 20,
                odstep_dol_mm: 20,
                customReferences: { yMax: { panelId: 'panel_back' } }
            }
        };

        syncBlokiLedInternalGrooves({ domainData: containerMock }, docMock);

        expect(backPanel.features.length).toBe(1);
        const feat = backPanel.features[0];
        expect(feat.face).toBe('FACE_Z_PLUS');
        expect(feat.params.length).toBe(1960);
        expect(feat.params.width).toBe(14);
        expect(feat.params.v).toBe(20);
        expect(feat.params.u).toBe(418);
    });

    it('shifts vertical groove on side panel by bottom elevation offset (e.g. 18 mm bottom panel thickness)', () => {
        const leftPanel: any = { id: 'p_l', width: 550_000_000, height: 2000_000_000, features: [] };
        const leftNodeMock: any = {
            domainData: leftPanel,
            getWorldMatrix: () => ({
                decompose: () => ({
                    translation: { x: 0, y: 0, z: 1000_000_000 } // center at 1000 mm -> bottom at 0 mm
                })
            })
        };
        const sbNodeMock: any = {
            domainData: {
                id: 'sb_bay_1',
                height: 1964_000_000,
                depth: 550_000_000,
                generatorParams: {
                    boxType: 'LED_INTERNAL',
                    wariant_led: 'VERTICAL_LEFT_SIDE',
                    odsuniecie_od_przodu_lewe_mm: 50,
                    szerokosc_wpustu_mm: 14,
                    glebokosc_wpustu_mm: 9,
                    odstep_gora_mm: 20,
                    odstep_dol_mm: 20,
                    customReferences: { xMin: { panelId: 'p_l' } }
                }
            },
            getWorldMatrix: () => ({
                decompose: () => ({
                    translation: { x: 0, y: 0, z: 18_000_000 } // container bottom at 18 mm (on top of bottom panel)
                })
            })
        };
        const docMock: any = {
            findNode: (id: string) => (id === 'p_l' ? leftNodeMock : null)
        };

        syncBlokiLedInternalGrooves(sbNodeMock, docMock);

        expect(leftPanel.features.length).toBe(1);
        const feat = leftPanel.features[0];
        // v = zOffset (18 mm) + insetBottom (20 mm) = 38 mm!
        expect(feat.params.v).toBe(38);
        expect(feat.params.length).toBe(1964 - 20 - 20); // 1924 mm
        expect(feat.params.u).toBe(550 - 50 - 14); // 486 mm
    });
});
