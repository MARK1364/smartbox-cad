/**
 * led-internal-engine.ts — moduł LED WEWNĘTRZNY (blok_led_internal, source 'BLOKI_LED')
 * Silnik obliczeniowy planu brył 3D pionowych/poziomych profili LED we wnęce szafy oraz frezowań wpustów w formatkach.
 *
 * Przepływ machining (wzorcowy dla migracji drilling → machining):
 *   buildBlokiLedInternalGroovePlan  — czysta intencja (kontrakt machining-intent.ts)
 *   applyBlokiLedInternalGroovePlan  — czyszczenie wg scope + upsert + rebuild meshu
 *   syncBlokiLedInternalGrooves      — most dla starych wywołań (plugin przez SyncLedMachiningCommand)
 *
 * UWAGA — to NIE jest ten sam system co LED ZEWNĘTRZNY (kanał): led-external-channel-*.ts (source 'assembly_led_channel').
 * Wewnętrzny: profil we wnętrzu szafki (oświetlenie wnęki), geometria z planu Bloków (sync przy rebuild).
 * Zewnętrzny (kanał): kanał pod korpusami (np. kuchnie), detekcja rzędu szafek w świecie.
 * Silniki nie są wymienne — różne mechanizmy wykrywania geometrii i różne role montażowe.
 */

import ledIntRules from './13_led_internal_3_rules_V1.json';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { NativePanelBuilder } from '../A4_smartpanel/native-panel-builder.js';

import type { PanelModel } from '../A4_smartpanel/panel-model.js';
import { calcFaceUFromFront } from '../A4_smartpanel/native_core/face-lcs.js';



import type { BlokiDimensions_mm, BlokiPart, BlokiPlanResult } from './01_bloki-types.js';
import type { LedInternalPlanParams } from './01_bloki-module-types.js';
import {
    assertCanonicalLedInternalParams,
    readOptionalNumber
} from './01_bloki-module-param-guards.js';
import {
    buildGrooveMachiningIntent,
    isOwnedGroove,
    type MachiningGrooveFeature,
    type MachiningIntent,
} from './01_machining-intent.js';

export { assertCanonicalLedInternalParams, LEGACY_LED_INTERNAL_PARAM_ALIASES } from './01_bloki-module-param-guards.js';

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
/**
 * Plan machining LED WEWNĘTRZNEGO dla jednego kontenera — czysta intencja (zero mesh/dokumentu).
 *   scope          — granica czyszczenia starych automatów na formatce:
 *                    'all'  = aktywny profil boczny → zastępujemy wszystkie wpusty ownera,
 *                    'l'/'r' = profil wyłączony → usuwamy tylko suffix danego boku,
 *                    'back' = plecy → usuwamy tylko suffix '_b'.
 *   upsert         — intencja do wstawienia (tylko dla aktywnych profilów).
 */
export interface BlokiLedInternalPanelPlan {
    targetNodeId: string;
    scope: 'all' | 'l' | 'r' | 'back';
    upsert?: MachiningIntent<MachiningGrooveFeature>;
}

export interface BlokiLedInternalGroovePlan {
    /** ContainerModel.id modułu-właściciela (= params.channel_id = params.sourceContainerId). */
    ownerId: string;
    panels: BlokiLedInternalPanelPlan[];
}

function buildSideGrooveIntent(
    containerId: string,
    key: 'l' | 'r',
    targetNodeId: string,
    uPos: number,
    vPos: number,
    grooveW: number,
    stripH: number,
    grooveD: number,
): MachiningIntent<MachiningGrooveFeature> {
    return buildGrooveMachiningIntent({
        targetNodeId,
        id: `led_groove_${containerId}_${key}`,
        source: 'BLOKI_LED',
        channelId: containerId,
        sourceContainerId: containerId,
        face: 'FACE_Z_PLUS',
        name: 'Wpust pod profil LED',
        u: uPos,
        v: vPos,
        width: grooveW,
        length: stripH,
        depth: grooveD,
    });
}

function buildBackGrooveIntent(
    containerId: string,
    targetNodeId: string,
    uPos: number,
    vPos: number,
    grooveW: number,
    stripH: number,
    grooveD: number,
): MachiningIntent<MachiningGrooveFeature> {
    return buildGrooveMachiningIntent({
        targetNodeId,
        id: `led_groove_${containerId}_b`,
        source: 'BLOKI_LED',
        channelId: containerId,
        sourceContainerId: containerId,
        face: 'FACE_Z_PLUS',
        name: 'Wpust pod profil LED (Plecy)',
        u: uPos,
        v: vPos,
        width: grooveW,
        length: stripH,
        depth: grooveD,
    });
}

/**
 * Buduje plan wpustów LED wewnętrznego dla kontenera — czysto, bez mutacji dokumentu.
 */
export function buildBlokiLedInternalGroovePlan(
    containerNode: any,
    doc: any,
): BlokiLedInternalGroovePlan | null {
    if (!containerNode || !doc) return null;
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

    const panels: BlokiLedInternalPanelPlan[] = [];

    const sidePlan = (panelId: string | undefined, active: boolean, offsetVal: number, key: 'l' | 'r') => {
        if (!panelId) return;
        const node = doc.findNode(panelId);
        if (!node) return;
        const panel = node.domainData || node;
        if (!panel || !panel.features) return;

        const plan: BlokiLedInternalPanelPlan = { targetNodeId: panelId, scope: key };
        if (active) {
            // Aktywny profil boczny = pełny replace (stary sync usuwał WSZYSTKIE wpusty ownera na tej formatce).
            plan.scope = 'all';
            const panelDepth = panel.width ? nmToMm(panel.width) : (container.depth ? nmToMm(container.depth) : 500);
            const uCenter = calcFaceUFromFront(node, 'FACE_Z_PLUS', panelDepth, offsetVal + grooveW / 2, key === 'l' ? 'left' : 'right');
            const uPos = Math.max(0, uCenter - grooveW / 2);
            const zOffset = getContainerZOffsetOnPanel(containerNode, node);
            plan.upsert = buildSideGrooveIntent(
                container.id, key, panelId, uPos, zOffset + insetBottom, grooveW, stripH, grooveD,
            );
        }
        panels.push(plan);
    };

    const backPanelNodeId = (() => {
        const ref = p.customReferences?.yMax?.panelId;
        if (ref) return ref;
        if (doc.rootNode) {
            const allPanels = typeof doc.getPanels === 'function' ? doc.getPanels() : [];
            const found = allPanels.find((n: any) => {
                const domain = n.domainData || n;
                return domain.role === 'BACK_PANEL';
            });
            if (found) return found.id;
        }
        return undefined;
    })();

    if (hasLeft) sidePlan(leftPanelId, true, offsetLeft, 'l');
    else if (leftPanelId) sidePlan(leftPanelId, false, offsetLeft, 'l');

    if (hasRight) sidePlan(rightPanelId, true, offsetRight, 'r');
    else if (rightPanelId) sidePlan(rightPanelId, false, offsetRight, 'r');

    if (hasBack && backPanelNodeId) {
        const node = doc.findNode(backPanelNodeId);
        const panel = node ? (node.domainData || node) : null;
        if (panel && panel.features) {
            const backWidth = panel.width ? nmToMm(panel.width) : (container.width ? nmToMm(container.width) : 600);
            const uPos = Math.max(0, backWidth / 2 + offsetBack - grooveW / 2);
            const zOffset = getContainerZOffsetOnPanel(containerNode, node);
            panels.push({
                targetNodeId: backPanelNodeId,
                scope: 'back',
                upsert: buildBackGrooveIntent(
                    container.id, backPanelNodeId, uPos, zOffset + insetBottom, grooveW, stripH, grooveD,
                ),
            });
        }
    } else if (backPanelNodeId) {
        panels.push({ targetNodeId: backPanelNodeId, scope: 'back' });
    }

    return panels.length > 0 ? { ownerId: container.id, panels } : null;
}

/**
 * Intencje (upserty) LED wewnętrznego dla wskazanego kontenera — kontrakt machining.
 */
export function buildBlokiLedInternalGrooveIntents(
    containerNode: any,
    doc: any,
): MachiningIntent<MachiningGrooveFeature>[] {
    const plan = buildBlokiLedInternalGroovePlan(containerNode, doc);
    const out: MachiningIntent<MachiningGrooveFeature>[] = [];
    for (const panelPlan of plan?.panels || []) {
        if (panelPlan.upsert) out.push(panelPlan.upsert);
    }
    return out;
}

/**
 * Aplikuje plan na formatek: czyszczenie wg scope + upsert + rebuild meshu przy zmianie.
 * Wyeksportowane dla SyncLedMachiningCommand (snapshot przed aplikacją = undo).
 */
export function applyBlokiLedInternalGroovePlan(doc: any, plan: BlokiLedInternalGroovePlan): void {
    for (const panelPlan of plan?.panels || []) {
        const node = doc.findNode(panelPlan.targetNodeId);
        if (!node) continue;
        const panel = node.domainData || node;
        if (!panel || !panel.features) continue;

        const before = panel.features.length;
        panel.features = panel.features.filter((f: any) => {
            if (!isOwnedGroove(f, 'BLOKI_LED', plan.ownerId)) return true;
            if (panelPlan.scope === 'all') return false;
            if (panelPlan.scope === 'back') return !f.id?.includes('_b');
            return !f.id?.endsWith(`_${panelPlan.scope}`);
        });
        const removed = panel.features.length !== before;
        let touched = removed;
        if (panelPlan.upsert) {
            panel.features.push(panelPlan.upsert.feature);
            touched = true;
        }
        if (touched) rebuildPanelMesh(panel);
    }
}

/**
 * Synchronizacja frezowań wpustów LED wewnętrznego (blok = plan → apply).
 */
export function syncBlokiLedInternalGrooves(containerNode: any, doc: any): void {
    const plan = buildBlokiLedInternalGroovePlan(containerNode, doc);
    if (plan) applyBlokiLedInternalGroovePlan(doc, plan);
}
