/**
 * B1_biblioteka/korpusy/cabinet-serializer.ts
 *
 * Serializuje aktywny mebel (SmartFrame + dzieci Bloki) do lekkiego szablonu CabinetTemplate (w mm).
 */

import { nmToMm } from '../../A1_core/cad-math/units.js';
import { getActiveContainer } from '../../A3_smartframe/smartframe-adapter.js';
import type { CabinetCategory, CabinetTemplate, CabinetSubmoduleRecipe } from './types.js';

/**
 * Wyciąga bezpieczne, prymitywne parametry generatora Bloki bez wskaźników i cykli.
 */
export function sanitizeBlokiParams(rawParams: any): Record<string, any> {
    if (!rawParams || typeof rawParams !== 'object') return {};

    const safe: Record<string, any> = {};
    const ignoredKeys = new Set([
        'boundary', 'detectedBay', 'customReferences', 'parentContainerId',
        'document', 'scene', 'engine', 'mesh', 'metadata', 'rootAssembly'
    ]);

    for (const [k, v] of Object.entries(rawParams)) {
        if (ignoredKeys.has(k)) continue;
        if (v === undefined || v === null) continue;

        const valType = typeof v;
        if (valType === 'number' || valType === 'string' || valType === 'boolean') {
            safe[k] = v;
        } else if (Array.isArray(v)) {
            // Bezpieczne tablice prymitywów (np. wysokości szuflad [140, 280, 280])
            if (v.every((item) => typeof item === 'number' || typeof item === 'string' || typeof item === 'boolean')) {
                safe[k] = [...v];
            }
        }
    }

    return safe;
}

/**
 * Serializuje aktywny korpus z dokumentu do formatu CabinetTemplate.
 */
export function serializeActiveCabinet(
    projectModelOrDoc: any,
    options: {
        name: string;
        category?: CabinetCategory;
        description?: string;
        customId?: string;
        thumbnail?: string;
    }
): CabinetTemplate | null {
    if (!projectModelOrDoc) return null;

    const doc = projectModelOrDoc.document || projectModelOrDoc;
    const container = getActiveContainer(doc);
    if (!container) return null;

    const korpusNode = doc.findNode ? doc.findNode(container.id) : null;
    const wMm = Math.round(nmToMm(container.width));
    const hMm = Math.round(nmToMm(container.height));
    const dMm = Math.round(nmToMm(container.depth));

    const genParams = container.generatorParams || {};
    const liczba_stref = (genParams.liczba_stref as 1 | 2 | 3) || 1;
    const wysokosc_strefy_dolnej_mm = genParams.wysokosc_strefy_dolnej_mm !== undefined
        ? genParams.wysokosc_strefy_dolnej_mm
        : (liczba_stref === 1 ? hMm : 500);
    const wysokosc_strefy_srodkowej_mm = genParams.wysokosc_strefy_srodkowej_mm !== undefined
        ? genParams.wysokosc_strefy_srodkowej_mm
        : (liczba_stref === 3 ? 1200 : 0);
    // Wyjątek gizmo: `backOffset` zapisuje A1_core/gizmo-controller.
    const cofniecie_plecow_mm = genParams.cofniecie_plecow_mm ?? genParams.backOffset ?? 3;

    // Przeszukiwanie dzieci w poszukiwaniu modułów Bloki (_SB)
    const submodules: CabinetSubmoduleRecipe[] = [];
    if (korpusNode && Array.isArray(korpusNode.children)) {
        for (const childNode of korpusNode.children) {
            const childDomain = childNode.domainData;
            const childName = childNode.name || '';
            const isBlok = childName.endsWith('_SB') ||
                childName.includes('bloki') ||
                (childDomain?.generatorParams?.type && String(childDomain.generatorParams.type).startsWith('blok_'));

            if (!isBlok || !childDomain) continue;

            const p = childDomain.generatorParams || {};
            const boxType = p.boxType || (
                childName.includes('Polki') || p.type?.includes('shelves') ? 'SHELVES' :
                childName.includes('Szuflad') || p.type?.includes('drawers') ? 'DRAWERS' :
                childName.includes('Drzwi') || p.type?.includes('doors') ? 'DOORS' :
                childName.includes('Klap') || p.type?.includes('flaps') ? 'FLAPS' :
                childName.includes('Blend') || p.type?.includes('panels') ? 'PANELS' :
                'CUSTOM'
            );

            const safeParams = sanitizeBlokiParams(p);

            // Obliczamy strefę (jeśli określona)
            let zoneIndex = p.targetZoneIndex;
            if (zoneIndex === undefined && childNode.transform?.position) {
                // Heurystyka: pozycja Z w korpusie
                const zPosMm = nmToMm(childNode.transform.position.z);
                if (liczba_stref === 3) {
                    if (zPosMm < wysokosc_strefy_dolnej_mm) zoneIndex = 0;
                    else if (zPosMm < wysokosc_strefy_dolnej_mm + wysokosc_strefy_srodkowej_mm) zoneIndex = 1;
                    else zoneIndex = 2;
                } else if (liczba_stref === 2) {
                    zoneIndex = zPosMm < wysokosc_strefy_dolnej_mm ? 0 : 1;
                } else {
                    zoneIndex = 0;
                }
            }

            submodules.push({
                id: childNode.id,
                type: p.type || `blok_${boxType.toLowerCase()}`,
                boxType,
                label: childNode.name,
                zoneIndex: zoneIndex ?? 0,
                params: safeParams
            });
        }
    }

    const template: CabinetTemplate = {
        id: options.customId || `cabinet_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: options.name || container.name || 'Korpus Meblowy',
        category: options.category || 'dolne',
        units: 'mm',
        description: options.description || '',
        thumbnail: options.thumbnail,
        createdAt: Date.now(),
        dimensions: {
            szerokosc_mm: wMm,
            wysokosc_mm: hMm,
            glebokosc_mm: dMm
        },
        frameParams: {
            liczba_stref,
            wysokosc_strefy_dolnej_mm,
            wysokosc_strefy_srodkowej_mm,
            cofniecie_plecow_mm,
            offsets: genParams.offsets ? { ...genParams.offsets } : {}
        },
        submodules
    };

    return template;
}
