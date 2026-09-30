/**
 * led-external-engine.ts — moduł KANAŁ LED PODSZAFKOWY (blok_led_external)
 * Silnik obliczeniowy planu brył 3D profilu LED na spodzie szafek oraz frezowań wpustów przelotowych.
 */
import ledExtRules from './led_external_3_rules_V1.json';
import { applyLedChannelToDocument } from '../A5_smartparts/led/led-channel-engine.js';
import type { LedChannelDefinition } from '../A5_smartparts/led/led-channel-types.js';
import { detectCabinetOuterHull } from './bloki-bay-detector.js';

import type { BlokiDimensions_mm, BlokiPart, BlokiPlanResult } from './bloki-types.js';
import type { LedExternalPlanParams } from './bloki-module-types.js';
import {
    assertCanonicalLedExternalParams,
    readOptionalNumber
} from './bloki-module-param-guards.js';

export { assertCanonicalLedExternalParams, LEGACY_LED_EXTERNAL_PARAM_ALIASES } from './bloki-module-param-guards.js';

export interface NormalizedLedExternalParams {
    odsuniecie_od_przodu_mm: number;
    szerokosc_wpustu_mm: number;
    glebokosc_wpustu_mm: number;
    frezuj_boki: boolean;
}

export function normalizeLedExternalParams(raw: LedExternalPlanParams = {}, dims?: BlokiDimensions_mm): NormalizedLedExternalParams {
    assertCanonicalLedExternalParams(raw);
    const input = raw as Record<string, unknown>;
    const odsuniecie_od_przodu_mm = readOptionalNumber(input, 'odsuniecie_od_przodu_mm') ?? 50;
    const szerokosc_wpustu_mm = readOptionalNumber(input, 'szerokosc_wpustu_mm') ?? 14;
    const glebokosc_wpustu_mm = readOptionalNumber(input, 'glebokosc_wpustu_mm') ?? 9;
    const frezuj_boki = input.frezuj_boki !== undefined ? Boolean(input.frezuj_boki) : true;

    return {
        odsuniecie_od_przodu_mm,
        szerokosc_wpustu_mm,
        glebokosc_wpustu_mm,
        frezuj_boki
    };
}

export function calculateLedExternalPlan(
    dims_mm: BlokiDimensions_mm,
    params: NormalizedLedExternalParams
): BlokiPlanResult {
    const parts: any[] = [];
    const width = dims_mm.width_mm;
    const depth = dims_mm.depth_mm;

    const offsetFront = params.odsuniecie_od_przodu_mm;
    const grooveW = params.szerokosc_wpustu_mm;
    const grooveD = params.glebokosc_wpustu_mm;

    const extTree = (ledExtRules as any).model_tree?.root_assembly?.subcomponents?.LED_PROFILE_BAR || {};
    const yPos = -depth / 2 + offsetFront + grooveW / 2;
    const zPos = grooveD / 2;

    parts.push({
        name: extTree.name || 'Profil_LED_Podszafkowy',
        role: 'LED',
        report_type: 'akcesoria',
        library_id: extTree.library_id || 'LED_PROFILE_WPUSZCZANY',
        dim: { x: Math.max(10, width), y: grooveD, z: grooveW },
        loc: { x: 0, y: yPos, z: zPos },
        custom_properties: {
            material: 'Aluminium_Anodowane_Opal',
            shape: 'BOX',
            is_bloki_child: true,
            glow_color: [0.65, 0.7, 0.75]
        },
        features: []
    });

    return { parts };
}


/**
 * Synchronizacja frezowań rowka przelotowego LED podszafkowego (dla ciągu szafek).
 * Referencje X/Y/Z biorą z wieńca dolnego i boków korpusu nadrzędnego —
 * nie z przypadkowej krawędzi boku zapisanej w customReferences.
 */
export function syncBlokiLedExternalGrooves(containerNode: any, doc: any): void {
    if (!containerNode || !doc) return;
    const container = containerNode.domainData || containerNode;
    const p = container.generatorParams || {};
    const norm = normalizeLedExternalParams(p);

    const offsetFront = norm.odsuniecie_od_przodu_mm;
    const grooveW = norm.szerokosc_wpustu_mm;
    const grooveD = norm.glebokosc_wpustu_mm;
    const cutSides = norm.frezuj_boki;

    // Preferuj świeży outer-hull korpusu (poprawne dno = wieniec, nie krawędź boku)
    let refBottom = p.customReferences?.zMin
        ? { nodeId: p.customReferences.zMin.panelId, face: p.customReferences.zMin.face, label: p.customReferences.zMin.partKey }
        : null;
    let refLeft = p.customReferences?.xMin
        ? { nodeId: p.customReferences.xMin.panelId, face: p.customReferences.xMin.face, label: p.customReferences.xMin.partKey }
        : null;
    let refRight = p.customReferences?.xMax
        ? { nodeId: p.customReferences.xMax.panelId, face: p.customReferences.xMax.face, label: p.customReferences.xMax.partKey }
        : null;
    let refFront = p.customReferences?.yMin
        ? { nodeId: p.customReferences.yMin.panelId, face: p.customReferences.yMin.face, label: p.customReferences.yMin.partKey }
        : null;
    let refBack = p.customReferences?.yMax
        ? { nodeId: p.customReferences.yMax.panelId, face: p.customReferences.yMax.face, label: p.customReferences.yMax.partKey }
        : null;
    let refTop = p.customReferences?.zMax
        ? { nodeId: p.customReferences.zMax.panelId, face: p.customReferences.zMax.face, label: p.customReferences.zMax.partKey }
        : null;

    const parentId = p.parentContainerId;
    if (parentId) {
        try {
            const hull = detectCabinetOuterHull(doc, parentId);
            if (hull?.boundary) {
                const b = hull.boundary;
                if (b.bottom?.nodeId) {
                    refBottom = { nodeId: b.bottom.nodeId, face: b.bottom.face || 'FACE_Z_MINUS', label: b.bottom.nodeName };
                }
                if (b.left?.nodeId) {
                    refLeft = { nodeId: b.left.nodeId, face: b.left.face || 'FACE_Z_MINUS', label: b.left.nodeName };
                }
                if (b.right?.nodeId) {
                    refRight = { nodeId: b.right.nodeId, face: b.right.face || 'FACE_Z_MINUS', label: b.right.nodeName };
                }
                if (b.front?.nodeId) {
                    refFront = { nodeId: b.front.nodeId, face: b.front.face || 'FACE_Y_MINUS', label: b.front.nodeName };
                }
                if (b.back?.nodeId) {
                    refBack = { nodeId: b.back.nodeId, face: b.back.face || 'FACE_Y_PLUS', label: b.back.nodeName };
                }
                if (b.top?.nodeId) {
                    refTop = { nodeId: b.top.nodeId, face: b.top.face || 'FACE_Z_MINUS', label: b.top.nodeName };
                }
            }
        } catch {
            /* zostaw customReferences */
        }
    }

    const channelDef: LedChannelDefinition = {
        id: container.id,
        name: container.name || 'Kanał LED',
        enabled: true,
        visible: true,
        frozen: false,
        refBottom,
        refLeft,
        refRight,
        refFront,
        refBack,
        refTop,
        offsetFromFrontMm: offsetFront,
        grooveWidthMm: grooveW,
        grooveDepthMm: grooveD,
        cutSides,
        scope: 'row'
    };

    applyLedChannelToDocument(doc, channelDef);
}
