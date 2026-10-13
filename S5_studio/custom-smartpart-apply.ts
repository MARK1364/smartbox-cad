/**
 * A5_smartparts / studio — custom-smartpart-apply.ts
 * Aplikacja zapisanego SmartParta na formatkę w scenie głównej CAD.
 *
 * Generuje cechy obróbcze (otwory / kieszenie) na formatce docelowej (panelModel.features)
 * zgodnie z zasadą wystawania cięć poza Kontener Główny SmartParta.
 *
 * Wariant testowy (nóżki / CUSTOM): `generatorParams` trzyma snapshot pakietu + `paramValues`.
 * Zmiana wartości w panelu → `resolveSmartPartParams` → przebudowa features.
 */

import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../A1_core/container-model.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { resolvePanelThicknessMm } from '../A2_bloki/handles/handle-drilling.js';
import type {
    SmartPartPackageDefinition,
    SmartPartHoleCut,
    SmartPartPocketCut,
} from './smartpart-studio-types.js';
import {
    calculateCutProtrusion,
    findPartForCut,
} from './smartpart-studio-types.js';
import {
    initialSmartPartParamValues,
    resolveSmartPartParams,
    type SmartPartParamValues,
} from './smartpart-params.js';

/** Typ w generatorParams — odróżnia CUSTOM SmartPart od uchwytu / zawieszki. */
export const SMARTPART_CUSTOM_TYPE = 'smartpart_custom';

export interface CustomSmartPartApplyParams {
    definition: SmartPartPackageDefinition;
    targetPanelNode: CADNode;
    pickUvMm?: { u: number; v: number };
    faceName?: string;
    /** Wartości parametrów panelu (opcjonalne — domyślne z pakietu). */
    paramValues?: SmartPartParamValues;
}

/**
 * Wylicza punkt bazowy (u, v) w układzie lokalnym lica formatki
 * w oparciu o szybkie wzory analityczne (cornerRef + offsety).
 */
export function computeAnalyticalBaseUv(
    panelWMm: number,
    panelHMm: number,
    cornerRef: 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'TOP_LEFT' | 'TOP_RIGHT',
    offsetXMm: number,
    offsetYMm: number
): { u: number; v: number } {
    switch (cornerRef) {
        case 'TOP_LEFT':
            return {
                u: offsetXMm,
                v: panelHMm - offsetYMm,
            };
        case 'TOP_RIGHT':
            return {
                u: panelWMm - offsetXMm,
                v: panelHMm - offsetYMm,
            };
        case 'BOTTOM_RIGHT':
            return {
                u: panelWMm - offsetXMm,
                v: offsetYMm,
            };
        case 'BOTTOM_LEFT':
        default:
            return {
                u: offsetXMm,
                v: offsetYMm,
            };
    }
}

function buildFeaturesFromDefinition(
    definition: SmartPartPackageDefinition,
    opts: {
        containerId: string;
        smartPartId: string;
        baseU: number;
        baseV: number;
        faceName: string;
    },
): any[] {
    const isFrontFace = opts.faceName.includes('MINUS');
    const features: any[] = [];

    for (let i = 0; i < definition.cuts.length; i++) {
        const cut = definition.cuts[i];
        const part = findPartForCut(definition, cut);
        const partOrigin = part
            ? { xMm: part.xMm, yMm: part.yMm, zMm: part.zMm }
            : null;
        const protrusion = calculateCutProtrusion(cut, definition.mainContainer, partOrigin);
        const cutDepth = Math.max(
            protrusion.leftXMinusMm,
            protrusion.rightXPlusMm,
            protrusion.bottomYMinusMm,
            protrusion.topYPlusMm,
            protrusion.backZMinusMm,
            protrusion.frontZPlusMm
        );

        if (cutDepth <= 0) continue;

        const absX = (partOrigin?.xMm ?? 0) + cut.xMm;
        const absY = (partOrigin?.yMm ?? 0) + cut.yMm;

        if (cut.type === 'HOLE') {
            const holeCut = cut as SmartPartHoleCut;
            features.push({
                id: `hole_${opts.containerId}_${i}`,
                type: 'hole',
                face: opts.faceName,
                side: isFrontFace ? 'front' : 'back',
                name: holeCut.name,
                params: {
                    u: opts.baseU + absX,
                    v: opts.baseV + absY,
                    diameter: holeCut.diameterMm,
                    depth: cutDepth,
                    isSmartPartFeature: true,
                    smartPartId: opts.smartPartId,
                    sourceContainerId: opts.containerId,
                    holeIndex: i,
                },
            });
        } else {
            const pocketCut = cut as SmartPartPocketCut;
            features.push({
                id: `pocket_${opts.containerId}_${i}`,
                type: 'groove',
                face: opts.faceName,
                name: pocketCut.name,
                params: {
                    u: opts.baseU + absX,
                    v: opts.baseV + absY,
                    width: pocketCut.widthMm,
                    length: pocketCut.heightMm,
                    depth: cutDepth,
                    isSmartPartFeature: true,
                    smartPartId: opts.smartPartId,
                    sourceContainerId: opts.containerId,
                },
            });
        }
    }

    return features;
}

function replaceSmartPartFeaturesOnPanel(
    panelModel: any,
    containerId: string,
    nextFeatures: any[],
): void {
    const existing = Array.isArray(panelModel.features) ? panelModel.features : [];
    const kept = existing.filter(
        (f: any) => !(f?.params?.isSmartPartFeature && f?.params?.sourceContainerId === containerId)
    );
    const merged = [...kept, ...nextFeatures];
    if (typeof panelModel.setFeatures === 'function') {
        panelModel.setFeatures(merged);
    } else {
        panelModel.features = merged;
    }
}

/**
 * Główna funkcja aplikująca SmartPart na wskazaną płytę.
 */
export function applyCustomSmartPartToPanel(
    document: any,
    params: CustomSmartPartApplyParams
): CADNode | null {
    if (!document || !params.targetPanelNode || !params.definition) return null;

    const { definition: rawDef, targetPanelNode, pickUvMm } = params;
    const panelModel = targetPanelNode.domainData as any;
    if (!panelModel) return null;

    const paramValues = {
        ...initialSmartPartParamValues(rawDef),
        ...(params.paramValues || {}),
    };
    const definition = resolveSmartPartParams(rawDef, paramValues);

    const panelWMm = nmToMm(panelModel.width);
    const panelHMm = nmToMm(panelModel.height);
    const panelTMm = resolvePanelThicknessMm(panelModel);

    const baseU = pickUvMm?.u ?? (panelWMm / 2);
    const baseV = pickUvMm?.v ?? (panelHMm / 2);
    const faceName = params.faceName || 'FACE_Z_MINUS';

    const contW = definition.mainContainer.widthMm;
    const contH = definition.mainContainer.heightMm;
    const contD = definition.mainContainer.depthMm;

    const container = new ContainerModel({
        name: definition.name,
        width: mmToNm(contW),
        height: mmToNm(contH),
        depth: mmToNm(contD),
    });

    (container as any).role = 'SMARTPART';
    (container as any).source = 'smartpart';
    (container as any).generatorParams = {
        type: SMARTPART_CUSTOM_TYPE,
        smartPartId: rawDef.id,
        smartPartName: rawDef.name,
        targetPanelId: targetPanelNode.id,
        panelWidthMm: panelWMm,
        panelHeightMm: panelHMm,
        panelThicknessMm: panelTMm,
        baseU,
        baseV,
        face: faceName,
        /** Snapshot źródłowy (z parameters/bindings) — resolve przy każdej zmianie UI */
        definition: rawDef,
        paramValues,
        mainContainer: definition.mainContainer,
        parts: definition.parts || (definition.partBody ? [definition.partBody] : []),
        partBody: definition.partBody || definition.parts?.[0],
    };

    const containerNode = new CADNode(container.id, definition.name, NodeType.ASSEMBLY);
    containerNode.domainData = container;

    const features = buildFeaturesFromDefinition(definition, {
        containerId: container.id,
        smartPartId: rawDef.id,
        baseU,
        baseV,
        faceName,
    });
    replaceSmartPartFeaturesOnPanel(panelModel, container.id, features);

    targetPanelNode.addChild(containerNode);
    if (typeof document.notifyDocumentChanged === 'function') {
        document.notifyDocumentChanged();
    }

    return containerNode;
}

/**
 * Aktualizacja wartości parametrów SMARTPART (panel aplikacji).
 * Przelicza pozycje partów i przebudowuje otwory na płycie.
 */
export function updateCustomSmartPartParams(
    document: any,
    container: any,
    nextValues: SmartPartParamValues,
): boolean {
    if (!document || !container) return false;
    const gp = container.generatorParams;
    if (!gp || gp.type !== SMARTPART_CUSTOM_TYPE) return false;
    const rawDef = gp.definition as SmartPartPackageDefinition | undefined;
    if (!rawDef) return false;

    let resolved: SmartPartPackageDefinition;
    try {
        resolved = resolveSmartPartParams(rawDef, nextValues);
    } catch (err) {
        console.warn('[CustomSmartPart] resolveSmartPartParams:', err);
        return false;
    }

    gp.paramValues = { ...nextValues };
    gp.parts = resolved.parts;
    gp.partBody = resolved.partBody || resolved.parts?.[0];
    gp.mainContainer = resolved.mainContainer;

    container.width = mmToNm(resolved.mainContainer.widthMm);
    container.height = mmToNm(resolved.mainContainer.heightMm);
    container.depth = mmToNm(resolved.mainContainer.depthMm);

    const targetPanelId = gp.targetPanelId as string | undefined;
    const targetPanelNode = targetPanelId ? document.findNode(targetPanelId) : null;
    const panelModel = targetPanelNode?.domainData;
    if (panelModel) {
        const features = buildFeaturesFromDefinition(resolved, {
            containerId: container.id,
            smartPartId: rawDef.id,
            baseU: Number(gp.baseU) || 0,
            baseV: Number(gp.baseV) || 0,
            faceName: String(gp.face || 'FACE_Z_MINUS'),
        });
        replaceSmartPartFeaturesOnPanel(panelModel, container.id, features);
    }

    if (typeof document.notifyDocumentChanged === 'function') {
        document.notifyDocumentChanged();
    }
    return true;
}

export function isCustomSmartPartModel(model: any): boolean {
    if (!model) return false;
    const role = String(model.role || '');
    const genType = String(model.generatorParams?.type || '');
    const gp = model.generatorParams || {};
    if (role === 'SMARTPART' || genType === SMARTPART_CUSTOM_TYPE) return true;
    if (role === 'SMARTPART_HANGERS' || genType === 'smartpart_hangers') {
        return Boolean(gp.isSmartPart || gp.definition?.parameters || gp.sourceDefinition);
    }
    if (role === 'SMARTPART_HANGER' || genType === 'smartpart_hanger') {
        return Boolean(gp.isSmartPart || gp.definition);
    }
    return false;
}

/** Kontener grupy zawieszek (nie pojedynczy Part) — tu żyją parameters. */
export function isHangerSmartPartGroup(model: any): boolean {
    if (!model) return false;
    const role = String(model.role || '');
    const genType = String(model.generatorParams?.type || '');
    return (role === 'SMARTPART_HANGERS' || genType === 'smartpart_hangers')
        && Boolean(model.generatorParams?.isSmartPart || model.generatorParams?.definition);
}
