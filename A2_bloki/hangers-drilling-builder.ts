/**
 * A2_bloki/hangers-drilling-builder.ts
 *
 * Wyliczanie nawierceń i frezowań dla dedykowanego modułu ZAWIESZKI (HANGERS).
 * Przekształca cięcia (cuts) aktywnego zestawu na cechy obróbcze formatki (hole / groove).
 */

import type { ProjectDocument } from '../A1_core/project-document.js';
import type { HangersPlanParams, HangerSetDefinition } from './hangers-types.js';
import { resolveActiveHangerSet } from './hangers-types.js';
import { getHardware } from '../B1_biblioteka/index.js';
import {
    bayFrameFromDocument,
    bayWallRefsFromCustomReferences,
    computeSmartPartCutIntents,
    type SmartPartBayFrameMm,
    type SmartPartCutIntent,
} from '../A5_smartparts/hangers/smartpart-bay-placement.js';

export interface HangersDrillingIntentItem {
    targetNodeId: string;
    feature: any;
}

/**
 * Zwraca listę intencji wierceń/wycięć dla wszystkich zawieszek w danej szafce lub scenie.
 */
export function buildHangersDrillings(
    document: ProjectDocument,
    cabinetContainerId?: string
): HangersDrillingIntentItem[] {
    const intents: HangersDrillingIntentItem[] = [];
    if (!document) return intents;

    const containers = typeof document.getContainers === 'function' ? document.getContainers() : [];

    // Kontenery zawieszek należące do wybranego korpusu (lub wszystkie, jeśli nie podano cabinetContainerId)
    const hangerContainers = containers.filter((c: any) => {
        const gp = c.domainData?.generatorParams;
        if (!gp) return false;
        const isHanger = gp.boxType === 'HANGERS' || gp.type === 'smartpart_hangers' || gp.partType === 'HANGERS';
        if (!isHanger) return false;
        if (c.domainData?.visible === false) return false;
        if (cabinetContainerId) {
            return gp.parentContainerId === cabinetContainerId || c.parent?.id === cabinetContainerId;
        }
        return true;
    });

    for (const containerNode of hangerContainers) {
        const container = containerNode.domainData as any;
        const gp = container?.generatorParams;
        if (!gp) continue;

        const params: HangersPlanParams = {
            szablon_id: gp.szablon_id || gp.hardwareId || 'TT2',
            zestaw_id: gp.zestaw_id || '',
            odsuniecie_bok_mm: gp.odsuniecie_bok_mm,
            odsuniecie_tyl_mm: gp.odsuniecie_tyl_mm,
            odsuniecie_gora_mm: gp.odsuniecie_gora_mm,
            parametry_zestawu: gp.parametry_zestawu || gp.paramValues || {},
        };

        // Pobierz definicję
        let rawDef = gp.definition || gp.sourceDefinition;
        if (!rawDef && params.szablon_id) {
            const hw = getHardware(params.szablon_id);
            rawDef = (hw as any)?.definition || hw;
        }
        if (!rawDef) continue;

        const activeSet = resolveActiveHangerSet(rawDef, params.zestaw_id, params.szablon_id);
        if (!activeSet || !Array.isArray(activeSet.cuts) || activeSet.cuts.length === 0) continue;

        // Zaaplikuj parametry zamrożenia do cięć
        const workingSet: HangerSetDefinition = JSON.parse(JSON.stringify(activeSet));
        const userParams = params.parametry_zestawu || {};

        if (Array.isArray(workingSet.bindings) && Array.isArray(workingSet.cuts)) {
            for (const binding of workingSet.bindings) {
                if (binding.targetType === 'CUT' && binding.field === 'frozen' && binding.paramKey) {
                    const isFrozen = Boolean(userParams[binding.paramKey]);
                    const targetCut = workingSet.cuts.find((c: any) => c.id === binding.targetId);
                    if (targetCut) {
                        targetCut.frozen = isFrozen;
                    }
                }
            }
        }

        // Zbuduj ramkę wnęki z referencji
        const customRefs = gp.customReferences || {};
        const bayWallRefs = bayWallRefsFromCustomReferences(document, customRefs, gp.bayWallRefs);
        const frame: SmartPartBayFrameMm | null = bayFrameFromDocument(document, bayWallRefs);
        if (!frame) continue;

        // Wylicz intencje rzutowania cięć na formatki korpusu
        const cutIntents = computeSmartPartCutIntents(document, frame, workingSet, container.id);
        for (const ci of cutIntents) {
            // Oznacz cechę jako należącą do modułu zawieszek Bloki
            ci.feature.params = {
                ...ci.feature.params,
                isHangerDrilling: true,
                sourceContainerId: container.id,
            };
            intents.push(ci);
        }
    }

    return intents;
}
