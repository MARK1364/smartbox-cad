/**
 * panel-lookup.ts
 *
 * Scentralizowany moduł wyszukiwania formatek w drzewie korpusu (CADNode).
 * 
 * Zasady:
 * 1. Dopasowanie wyłącznie po `role` i `zoneId` (żadnego zgadywania po nazwach czy prefiksach).
 * 2. Brak podanej strefy (`zoneId` undefined/null/'') oznacza przeszukiwanie wszystkich stref.
 * 3. Ignorowanie poddrzew kontenerów SmartBox (oraz formatek do nich należących).
 * 4. Ignorowanie formatek ręcznych (`engineManaged === false` / `isManualPanel`).
 * 5. Pełna diagnostyka w przypadku braku lub konfliktu wielu formatek.
 */

import type { CADNode } from './cad-node/cad-node.js';
import { NodeType } from './cad-node/node-type.js';
import { PanelModel, isManualPanel } from '../A4_smartpanel/panel-model.js';
import {
    tryNormalizeToCanonicalZoneId,
    type CanonicalZoneId
} from './zone-helper.js';

export type CabinetPanelRole =
    | 'LEFT_SIDE_PANEL'
    | 'RIGHT_SIDE_PANEL'
    | 'BOTTOM_PANEL'
    | 'TOP_PANEL'
    | 'BACK_PANEL';

export interface PanelLookupQuery {
    /** Rola stolarska formatki (wymagana). */
    role: CabinetPanelRole;
    /** Opcjonalny identyfikator strefy (np. 'B', 'SEKCJA_B', 'M', 'T'). Brak oznacza wszystkie strefy. */
    zoneId?: string | null;
}

export type PanelLookupStatus = 'OK' | 'NOT_FOUND' | 'MULTIPLE_FOUND' | 'INVALID_ZONE';

export interface PanelLookupCandidate {
    node: CADNode;
    panel: PanelModel;
}

export interface PanelLookupResult {
    status: PanelLookupStatus;
    node: CADNode | null;
    panel: PanelModel | null;
    candidatesCount: number;
    candidateKeys: string[];
    candidateZoneIds: string[];
    candidateNames: string[];
    message?: string;
}

/**
 * Sprawdza czy dany węzeł jest kontenerem SmartBox, którego całe poddrzewo należy pominąć.
 * Bazuje wyłącznie na danych semantycznych (brak zgadywania po nazwie).
 */
function isSmartBoxSubtree(node: CADNode): boolean {
    if (!node) return false;
    const d = node.domainData as any;
    const gp = d?.generatorParams;

    return Boolean(
        d?.type === 'smartbox' ||
        d?.type === 'smartbox_container' ||
        String(gp?.type ?? '').startsWith('smartbox') ||
        Boolean(gp?.boxType)
    );
}

/**
 * Zwraca listę wszystkich formatek korpusu pasujących do zapytania.
 * Pomija poddrzewa SmartBoxów oraz formatki ręczne.
 */
export function findCabinetPanels(
    cabinetNode: CADNode | null | undefined,
    query?: Partial<PanelLookupQuery>
): PanelLookupCandidate[] {
    const results: PanelLookupCandidate[] = [];
    if (!cabinetNode) return results;

    let targetZoneId: CanonicalZoneId | null = null;
    if (query?.zoneId !== undefined && query?.zoneId !== null && String(query.zoneId).trim() !== '') {
        targetZoneId = tryNormalizeToCanonicalZoneId(query.zoneId);
        // Jeśli podano niepusty, ale niepoprawny zoneId, żaden panel nie pasuje
        if (!targetZoneId) return results;
    }

    const collectRecursive = (node: CADNode) => {
        if (!node) return;

        // Pomiń całe poddrzewo SmartBoxa
        if (isSmartBoxSubtree(node)) return;

        const data = node.domainData as any;
        if (data && (data instanceof PanelModel || data.type === 'panel' || data.type === 'part')) {
            // Pomiń formatki ręczne
            if (!isManualPanel(data) && data.engineManaged !== false) {
                const panelRole = data.role as CabinetPanelRole;
                const panelZone = tryNormalizeToCanonicalZoneId(data.zoneId);

                const roleMatches = !query?.role || panelRole === query.role;
                const zoneMatches = !targetZoneId || panelZone === targetZoneId;

                if (roleMatches && zoneMatches) {
                    results.push({
                        node,
                        panel: data as PanelModel
                    });
                }
            }
        }

        if (node.children) {
            for (const child of node.children) {
                collectRecursive(child);
            }
        }
    };

    collectRecursive(cabinetNode);
    return results;
}

/**
 * Wyszukuje dokładnie jedną formatkę w korpusie spełniającą kryteria roli i strefy.
 * Jeśli formatki nie ma, podano błędną strefę lub znaleziono konflikt (więcej niż 1 formatkę),
 * zwraca jednoznaczny status diagnostyczny bez maskowania błędu.
 */
export function findCabinetPanel(
    cabinetNode: CADNode | null | undefined,
    query: PanelLookupQuery
): PanelLookupResult {
    if (!cabinetNode) {
        return {
            status: 'NOT_FOUND',
            node: null,
            panel: null,
            candidatesCount: 0,
            candidateKeys: [],
            candidateZoneIds: [],
            candidateNames: [],
            message: 'Brak węzła korpusu (cabinetNode jest null lub undefined).'
        };
    }

    // Walidacja identyfikatora strefy, jeśli został podany
    if (query.zoneId !== undefined && query.zoneId !== null && String(query.zoneId).trim() !== '') {
        const validatedZone = tryNormalizeToCanonicalZoneId(query.zoneId);
        if (!validatedZone) {
            return {
                status: 'INVALID_ZONE',
                node: null,
                panel: null,
                candidatesCount: 0,
                candidateKeys: [],
                candidateZoneIds: [],
                candidateNames: [],
                message: `Nieprawidłowy identyfikator strefy: "${query.zoneId}". Dopuszczalne wartości: SEKCJA_B, SEKCJA_M, SEKCJA_T (lub B, M, T).`
            };
        }
    }

    const candidates = findCabinetPanels(cabinetNode, query);
    const candidateKeys = candidates.map(c => (c.panel as any).key || c.node.name);
    const candidateZoneIds = candidates.map(c => (c.panel as any).zoneId || '');
    const candidateNames = candidates.map(c => c.panel.name || c.node.name);

    if (candidates.length === 0) {
        const roleDesc = query.role ? ` o roli "${query.role}"` : '';
        const zoneDesc = query.zoneId ? ` w strefie "${query.zoneId}"` : '';
        return {
            status: 'NOT_FOUND',
            node: null,
            panel: null,
            candidatesCount: 0,
            candidateKeys: [],
            candidateZoneIds: [],
            candidateNames: [],
            message: `Nie znaleziono formatki${roleDesc}${zoneDesc} w korpusie.`
        };
    }

    if (candidates.length === 1) {
        return {
            status: 'OK',
            node: candidates[0].node,
            panel: candidates[0].panel,
            candidatesCount: 1,
            candidateKeys,
            candidateZoneIds,
            candidateNames
        };
    }

    // candidates.length > 1
    const roleDesc = query.role ? ` o roli "${query.role}"` : '';
    const zoneDesc = query.zoneId ? ` w strefie "${query.zoneId}"` : '';
    return {
        status: 'MULTIPLE_FOUND',
        node: null,
        panel: null,
        candidatesCount: candidates.length,
        candidateKeys,
        candidateZoneIds,
        candidateNames,
        message: `Znaleziono ${candidates.length} formatek${roleDesc}${zoneDesc} w korpusie: [${candidateKeys.join(', ')}]. Sprecyzuj strefę.`
    };
}
