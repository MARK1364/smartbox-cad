/**
 * led-internal-engine.ts — moduł KANAŁ LED WEWNĘTRZNY (blok_led_internal)
 * Silnik obliczeniowy planu brył 3D pionowych/poziomych profili LED we wnęce szafy oraz frezowań wpustów w formatkach.
 */
import ledIntRules from './led_internal_3_rules_V1.json';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { NativePanelBuilder } from '../A4_smartpanel/native-panel-builder.js';

import type { PanelModel } from '../A4_smartpanel/panel-model.js';
import { calcFaceUFromFront } from '../A4_smartpanel/native_core/face-lcs.js';



import type { BlokiDimensions_mm, BlokiPart, BlokiPlanResult } from './bloki-types.js';
import type { LedInternalPlanParams } from './bloki-module-types.js';
import {
    assertCanonicalLedInternalParams,
    readOptionalNumber
} from './bloki-module-param-guards.js';

export { assertCanonicalLedInternalParams, LEGACY_LED_INTERNAL_PARAM_ALIASES } from './bloki-module-param-guards.js';

export interface NormalizedLedInternalParams {
    wariant_led: string;
    profil_lewy: boolean;
    profil_prawy: boolean;
    profil_tyl: boolean;
    odsuniecie_od_przodu_lewe_mm: number;
    odsuniecie_od_przodu_prawe_mm: number;
    odsuniecie_tyl_od_srodka_mm: number;
    odsuniecie_od_przodu_mm: number;
    szerokosc_wpustu_mm: number;
    glebokosc_wpustu_mm: number;
    odstep_gora_mm: number;
    odstep_dol_mm: number;
}

export function normalizeLedInternalParams(raw: LedInternalPlanParams = {}, dims?: BlokiDimensions_mm): NormalizedLedInternalParams {
    assertCanonicalLedInternalParams(raw);
    const input = raw as Record<string, unknown>;
    const wariant_led = String(input.wariant_led || 'VERTICAL_BOTH_SIDES');
    const profil_lewy = input.profil_lewy !== undefined
        ? Boolean(input.profil_lewy)
        : (wariant_led === 'VERTICAL_BOTH_SIDES' || wariant_led === 'VERTICAL_LEFT_SIDE' || wariant_led === 'VERTICAL_SIDES_AND_BACK');
    const profil_prawy = input.profil_prawy !== undefined
        ? Boolean(input.profil_prawy)
        : (wariant_led === 'VERTICAL_BOTH_SIDES' || wariant_led === 'VERTICAL_RIGHT_SIDE' || wariant_led === 'VERTICAL_SIDES_AND_BACK');
    const profil_tyl = input.profil_tyl !== undefined
        ? Boolean(input.profil_tyl)
        : (wariant_led === 'VERTICAL_BACK' || wariant_led === 'VERTICAL_SIDES_AND_BACK');

    const odsuniecie_od_przodu_lewe_mm = readOptionalNumber(input, 'odsuniecie_od_przodu_lewe_mm') ?? 50;
    const odsuniecie_od_przodu_prawe_mm = readOptionalNumber(input, 'odsuniecie_od_przodu_prawe_mm') ?? 150;
    const odsuniecie_tyl_od_srodka_mm = readOptionalNumber(input, 'odsuniecie_tyl_od_srodka_mm') ?? 125;
    const odsuniecie_od_przodu_mm = readOptionalNumber(input, 'odsuniecie_od_przodu_mm') ?? 50;

    const szerokosc_wpustu_mm = readOptionalNumber(input, 'szerokosc_wpustu_mm') ?? 14;
    const glebokosc_wpustu_mm = readOptionalNumber(input, 'glebokosc_wpustu_mm') ?? 9;
    const odstep_gora_mm = readOptionalNumber(input, 'odstep_gora_mm') ?? 20;
    const odstep_dol_mm = readOptionalNumber(input, 'odstep_dol_mm') ?? 20;

    return {
        wariant_led,
        profil_lewy,
        profil_prawy,
        profil_tyl,
        odsuniecie_od_przodu_lewe_mm,
        odsuniecie_od_przodu_prawe_mm,
        odsuniecie_tyl_od_srodka_mm,
        odsuniecie_od_przodu_mm,
        szerokosc_wpustu_mm,
        glebokosc_wpustu_mm,
        odstep_gora_mm,
        odstep_dol_mm
    };
}

export function calculateLedInternalPlan(
    dims_mm: BlokiDimensions_mm,
    params: NormalizedLedInternalParams
): BlokiPlanResult {
    const parts: any[] = [];
    const width = dims_mm.width_mm;
    const height = dims_mm.height_mm;
    const depth = dims_mm.depth_mm;

    const offsetLeft = params.odsuniecie_od_przodu_lewe_mm;
    const offsetRight = params.odsuniecie_od_przodu_prawe_mm;
    const offsetBack = params.odsuniecie_tyl_od_srodka_mm;
    const offsetFront = params.odsuniecie_od_przodu_mm;
    const grooveW = params.szerokosc_wpustu_mm;
    const grooveD = params.glebokosc_wpustu_mm;

    const intTree = (ledIntRules as any).model_tree?.root_assembly?.subcomponents?.LED_STRIP || {};
    const stripH = Math.max(10, height - params.odstep_gora_mm - params.odstep_dol_mm);
    const zCenter = params.odstep_dol_mm + stripH / 2;

    if (params.profil_lewy) {
        const yPosLeft = -depth / 2 + offsetLeft + grooveW / 2;
        parts.push({
            name: 'Profil_LED_Pionowy_Lewy',
            role: 'LED',
            report_type: 'akcesoria',
            library_id: intTree.library_id || 'LED_PROFILE_WPUSZCZANY',
            dim: { x: grooveD, y: stripH, z: grooveW },
            loc: { x: -width / 2 - grooveD / 2, y: yPosLeft, z: zCenter },
            custom_properties: {
                material: 'Aluminium_Czarny_Mat_Opal',
                shape: 'BOX',
                is_bloki_child: true,
                glow_color: [0.65, 0.7, 0.75]
            },
            features: []
        });
    }

    if (params.profil_prawy) {
        const yPosRight = -depth / 2 + offsetRight + grooveW / 2;
        parts.push({
            name: 'Profil_LED_Pionowy_Prawy',
            role: 'LED',
            report_type: 'akcesoria',
            library_id: intTree.library_id || 'LED_PROFILE_WPUSZCZANY',
            dim: { x: grooveD, y: stripH, z: grooveW },
            loc: { x: width / 2 + grooveD / 2, y: yPosRight, z: zCenter },
            custom_properties: {
                material: 'Aluminium_Czarny_Mat_Opal',
                shape: 'BOX',
                is_bloki_child: true,
                glow_color: [0.65, 0.7, 0.75]
            },
            features: []
        });
    }

    if (params.profil_tyl) {
        const yPosBack = depth / 2 + grooveD / 2;
        parts.push({
            name: 'Profil_LED_Pionowy_Plecy',
            role: 'LED',
            report_type: 'akcesoria',
            library_id: intTree.library_id || 'LED_PROFILE_WPUSZCZANY',
            dim: { x: grooveW, y: stripH, z: grooveD },
            loc: { x: offsetBack, y: yPosBack, z: zCenter },
            custom_properties: {
                material: 'Aluminium_Czarny_Mat_Opal',
                shape: 'BOX',
                is_bloki_child: true,
                glow_color: [0.65, 0.7, 0.75]
            },
            features: []
        });
    }

    if (params.wariant_led === 'HORIZONTAL_TOP') {
        const yPosTop = -depth / 2 + offsetFront + grooveW / 2;
        parts.push({
            name: 'Profil_LED_Poziomy_Gora',
            role: 'LED',
            report_type: 'akcesoria',
            library_id: intTree.library_id || 'LED_PROFILE_WPUSZCZANY',
            dim: { x: Math.max(10, width - 4), y: grooveD, z: grooveW },
            loc: { x: 0, y: yPosTop, z: height - grooveD / 2 },
            custom_properties: {
                material: 'Aluminium_Czarny_Mat_Opal',
                shape: 'BOX',
                is_bloki_child: true,
                glow_color: [0.65, 0.7, 0.75]
            },
            features: []
        });
    }

    return { parts };
}


function rebuildPanelMesh(panel: PanelModel): void {
    const views = ContextManager.instance?.panelViews;
    let view = views?.get(panel);
    if (!view && views) {
        for (const [m, v] of views) {
            if (m === panel || (m as any)?.id === panel.id) {
                view = v;
                break;
            }
        }
    }
    if (view && typeof view.updateMesh === 'function') {
        const builder = new NativePanelBuilder();
        view.updateMesh(builder.build(panel));
        ContextManager.instance.viewport?.applyRenderModeToMeshes?.();
    }
}

function getContainerZOffsetOnPanel(containerNode: any, panelNode: any): number {
    if (!containerNode || !panelNode) return 0;

    // 1. Próba przez WCS (świat):
    try {
        if (typeof containerNode.getWorldMatrix === 'function' && typeof panelNode.getWorldMatrix === 'function') {
            const cWorldZ = nmToMm(containerNode.getWorldMatrix().decompose().translation.z);
            const pWorldZ = nmToMm(panelNode.getWorldMatrix().decompose().translation.z);
            const panel = panelNode.domainData || panelNode;
            const pH = panel.height ? nmToMm(panel.height) : 0;
            const pBottomZ = pWorldZ - pH / 2;
            const offset = cWorldZ - pBottomZ;
            if (Number.isFinite(offset) && offset > 0) return offset;
        }
    } catch (_) {}

    // 2. Próba przez localMatrix (wspólny rodzic - np. CabinetNode):
    try {
        if (containerNode.localMatrix && panelNode.localMatrix) {
            const cPosZ = nmToMm(containerNode.localMatrix.decompose().translation.z);
            const pPosZ = nmToMm(panelNode.localMatrix.decompose().translation.z);
            const panel = panelNode.domainData || panelNode;
            const pH = panel.height ? nmToMm(panel.height) : 0;
            const pBottomZ = pPosZ - pH / 2;
            const offset = cPosZ - pBottomZ;
            if (Number.isFinite(offset) && offset > 0) return offset;
        }
    } catch (_) {}

    // 3. Fallback: jeśli w generatorParams jest customReferences.zMin, odczytaj grubość wieńca/formatki dolnej
    try {
        const container = containerNode.domainData || containerNode;
        const zMinPanelId = container?.generatorParams?.customReferences?.zMin?.panelId;
        if (zMinPanelId && panelNode.parent) {
            const zMinNode = panelNode.parent.children?.find((c: any) => c.id === zMinPanelId);
            const zMinPanel = zMinNode?.domainData;
            const thick = zMinPanel?.thickness ? nmToMm(zMinPanel.thickness) : 0;
            if (thick > 0) return thick;
        }
    } catch (_) {}

    return 0;
}

/**
 * Synchronizacja frezowań rowków LED wewnętrznego w formatek nadrzędnego korpusu.
 */
export function syncBlokiLedInternalGrooves(containerNode: any, doc: any): void {
    if (!containerNode || !doc) return;
    const container = containerNode.domainData || containerNode;
    const p = container.generatorParams || {};
    const norm = normalizeLedInternalParams(p);

    const offsetLeft = norm.odsuniecie_od_przodu_lewe_mm;
    const offsetRight = norm.odsuniecie_od_przodu_prawe_mm;
    const offsetBack = norm.odsuniecie_tyl_od_srodka_mm;
    const grooveW = norm.szerokosc_wpustu_mm;
    const grooveD = norm.glebokosc_wpustu_mm;

    const leftPanelId = p.customReferences?.xMin?.panelId;
    const rightPanelId = p.customReferences?.xMax?.panelId;
    const insetBottom = norm.odstep_dol_mm;
    const insetTop = norm.odstep_gora_mm;
    const height = container.height ? nmToMm(container.height) : 720;
    const stripH = Math.max(10, height - insetTop - insetBottom);

    const hasLeft = norm.profil_lewy;
    const hasRight = norm.profil_prawy;
    const hasBack = norm.profil_tyl;

    const applySideGroove = (panelId: string | undefined, isLeft: boolean, offsetVal: number) => {
        if (!panelId) return;
        const node = doc.findNode(panelId);
        if (!node) return;
        const panel = node.domainData || node;
        if (!panel || !panel.features) return;

        panel.features = panel.features.filter((f: any) => !(
            f.params?.source === 'BLOKI_LED' && f.params?.channel_id === container.id
        ));

        const panelDepth = panel.width ? nmToMm(panel.width) : (container.depth ? nmToMm(container.depth) : 500);
        const uCenter = calcFaceUFromFront(node, 'FACE_Z_PLUS', panelDepth, offsetVal + grooveW / 2, isLeft ? 'left' : 'right');
        const uPos = Math.max(0, uCenter - grooveW / 2);
        const zOffset = getContainerZOffsetOnPanel(containerNode, node);

        const vPos = zOffset + insetBottom;

        panel.features.push({
            id: `led_groove_${container.id}_${isLeft ? 'l' : 'r'}`,
            type: 'groove',
            face: 'FACE_Z_PLUS',
            name: 'Wpust pod profil LED',
            params: {
                source: 'BLOKI_LED',
                channel_id: container.id,
                u: uPos,
                v: vPos,
                width: grooveW,
                length: stripH,
                depth: grooveD
            }
        });

        rebuildPanelMesh(panel);
    };

    const applyBackGroove = (offsetFromCenter: number) => {
        let backPanelNode = p.customReferences?.yMax?.panelId ? doc.findNode(p.customReferences.yMax.panelId) : null;
        if (!backPanelNode && doc.rootNode) {
            const allPanels = typeof doc.getPanels === 'function' ? doc.getPanels() : [];
            backPanelNode = allPanels.find((n: any) => {
                const domain = n.domainData || n;
                return domain.role === 'BACK_PANEL';
            });
        }
        if (!backPanelNode) return;
        const panel = backPanelNode.domainData || backPanelNode;
        if (!panel || !panel.features) return;

        panel.features = panel.features.filter((f: any) => !(
            f.params?.source === 'BLOKI_LED' && f.params?.channel_id === container.id && f.id?.includes('_b')
        ));

        const backWidth = panel.width ? nmToMm(panel.width) : (container.width ? nmToMm(container.width) : 600);
        const uPos = Math.max(0, backWidth / 2 + offsetFromCenter - grooveW / 2);
        const zOffset = getContainerZOffsetOnPanel(containerNode, backPanelNode);
        const vPos = zOffset + insetBottom;

        panel.features.push({
            id: `led_groove_${container.id}_b`,
            type: 'groove',
            face: 'FACE_Z_PLUS',
            name: 'Wpust pod profil LED (Plecy)',
            params: {
                source: 'BLOKI_LED',
                channel_id: container.id,
                u: uPos,
                v: vPos,
                width: grooveW,
                length: stripH,
                depth: grooveD
            }
        });

        rebuildPanelMesh(panel);
    };

    if (hasLeft) {
        applySideGroove(leftPanelId, true, offsetLeft);
    } else if (leftPanelId) {
        const node = doc.findNode(leftPanelId);
        if (node) {
            const panel = node.domainData || node;
            if (panel && panel.features) {
                const prevLen = panel.features.length;
                panel.features = panel.features.filter((f: any) => !(
                    f.params?.source === 'BLOKI_LED' && f.params?.channel_id === container.id && f.id?.endsWith('_l')
                ));
                if (panel.features.length !== prevLen) rebuildPanelMesh(panel);
            }
        }
    }

    if (hasRight) {
        applySideGroove(rightPanelId, false, offsetRight);
    } else if (rightPanelId) {
        const node = doc.findNode(rightPanelId);
        if (node) {
            const panel = node.domainData || node;
            if (panel && panel.features) {
                const prevLen = panel.features.length;
                panel.features = panel.features.filter((f: any) => !(
                    f.params?.source === 'BLOKI_LED' && f.params?.channel_id === container.id && f.id?.endsWith('_r')
                ));
                if (panel.features.length !== prevLen) rebuildPanelMesh(panel);
            }
        }
    }

    if (hasBack) {
        applyBackGroove(offsetBack);
    } else {
        let backPanelNode = p.customReferences?.yMax?.panelId ? doc.findNode(p.customReferences.yMax.panelId) : null;
        if (!backPanelNode && doc.rootNode) {
            const allPanels = typeof doc.getPanels === 'function' ? doc.getPanels() : [];
            backPanelNode = allPanels.find((n: any) => {
                const domain = n.domainData || n;
                return domain.role === 'BACK_PANEL';
            });
        }
        if (backPanelNode) {
            const panel = backPanelNode.domainData || backPanelNode;
            if (panel && panel.features) {
                const prevLen = panel.features.length;
                panel.features = panel.features.filter((f: any) => !(
                    f.params?.source === 'BLOKI_LED' && f.params?.channel_id === container.id && f.id?.includes('_b')
                ));
                if (panel.features.length !== prevLen) rebuildPanelMesh(panel);
            }
        }
    }
}
