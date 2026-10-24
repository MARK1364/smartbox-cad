/**
 * A5_smartparts / handles — handle-drilling.ts
 * Generowanie cech nawierceń CNC pod uchwyty meblowe.
 *
 * Wylicza współrzędne (u, v) otworów w lokalnym układzie ściany (FACE_Z_MINUS / FACE_Z_PLUS)
 * i zarządza synchronizacją operacji wiercenia na formatce docelowej.
 */

import { nmToMm } from '../../A1_core/cad-math/units.js';
import type { CADNode } from '../../A1_core/cad-node/cad-node.js';
import type { ContainerModel } from '../../A1_core/container-model.js';
import type { HandleParamsMm } from './handle-types.js';
import type { HandleComputedLayoutMm } from './handle-layout.js';

export interface HandleDrillingPlanParams {
    layout: HandleComputedLayoutMm;
    panelWMm: number;
    panelHMm: number;
    panelTMm: number;
    containerId: string;
    drillDiameterMm?: number;
    drillingEnabled?: boolean;
    normalZ?: number;
}

export interface HandleDrillingFeatureDto {
    id: string;
    type: 'hole';
    face: string;
    side: string;
    name: string;
    params: {
        u: number;
        v: number;
        diameter: number;
        depth: number;
        isHandleDrilling: boolean;
        handleId: string;
        sourceContainerId: string;
        sourcePartId: string;
        holeIndex: number;
    };
}

/**
 * Bezpiecznie pobiera grubość formatki w mm (SSOT z modelu płyty).
 * Rzuca jawny błąd w przypadku braku danych (zasada Fail-Fast).
 */
export function resolvePanelThicknessMm(panelModel: any): number {
    const rawT = panelModel?.thickness ?? panelModel?.depth;
    if (typeof rawT === 'number' && Number.isFinite(rawT) && rawT > 0) {
        return nmToMm(rawT);
    }
    if (typeof panelModel?.panelThicknessMm === 'number' && Number.isFinite(panelModel.panelThicknessMm) && panelModel.panelThicknessMm > 0) {
        return panelModel.panelThicknessMm;
    }
    throw new Error(
        `[SmartParts Handle] Brak zdefiniowanej grubości dla formatki ${panelModel?.id || 'nieznany'}. ` +
        `CAD wymaga poprawnej grubości formatki do wygenerowania nawierceń przelotowych.`
    );
}

/**
 * Czysta funkcja wyliczająca listę cech otworów pod uchwyt (Functional Core).
 */
export function generateHandleDrillingFeatures(
    planParams: HandleDrillingPlanParams
): HandleDrillingFeatureDto[] {
    const {
        layout,
        panelWMm,
        panelHMm,
        panelTMm,
        containerId,
        drillDiameterMm = 4.0,
        drillingEnabled = true,
        normalZ = -1,
    } = planParams;

    if (drillingEnabled === false || !Array.isArray(layout.holes) || layout.holes.length === 0) {
        return [];
    }

    const faceName: string = normalZ < 0 ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS';
    const dia = drillDiameterMm > 0 ? drillDiameterMm : 4.0;
    const depth = panelTMm; // Otwór przelotowy przez całą grubość frontu

    return layout.holes.map((hole, idx) => {
        // Konwersja (hole.x, hole.y) ze środka formatki (0,0) do (u, v) w LCS ściany
        // W A4_smartpanel:
        // FACE_Z_MINUS: origin = [W/2, -H/2, -T/2], uAxis = [-1, 0, 0], vAxis = [0, 1, 0] -> u = W/2 - hole.x, v = hole.y + H/2
        // FACE_Z_PLUS:  origin = [-W/2, -H/2, T/2],  uAxis = [1, 0, 0],  vAxis = [0, 1, 0] -> u = hole.x + W/2, v = hole.y + H/2
        const u = faceName === 'FACE_Z_MINUS'
            ? (panelWMm / 2 - hole.x)
            : (hole.x + panelWMm / 2);
        const v = hole.y + panelHMm / 2;

        return {
            id: `hole_handle_${containerId}_${idx + 1}`,
            type: 'hole',
            face: faceName,
            side: faceName,
            name: `Otwór uchwytu fi ${dia}mm`,
            drivenBy: {
                nodeId: `hw_${containerId}`,
                role: 'HARDWARE',
                hardwareType: 'HANDLE',
                partKey: 'Handle',
                containerId: containerId,
            },
            rule: 'handle_hole',
            generatedBy: 'blok_handles',
            params: {
                u: Math.round(u * 10) / 10,
                v: Math.round(v * 10) / 10,
                diameter: dia,
                depth,
                isHandleDrilling: true,
                handleId: containerId,
                sourceContainerId: containerId,
                sourcePartId: `hw_${containerId}`,
                holeIndex: idx + 1,
            }
        };
    });
}

/**
 * Synchronizuje cechy nawierceń montażowych (type: 'hole') na formatce bazowej (np. froncie).
 */
export function syncHandleDrillings(
    document: any,
    targetPanelNode: CADNode,
    container: ContainerModel,
    layout: HandleComputedLayoutMm,
    params: HandleParamsMm,
    normalZ: number = -1
): void {
    if (!targetPanelNode || !container) return;
    const panelModel = targetPanelNode.domainData as any;
    if (!panelModel) return;

    const panelWMm = nmToMm(panelModel.width);
    const panelHMm = nmToMm(panelModel.height);
    const panelTMm = resolvePanelThicknessMm(panelModel);

    // 1. Usuń poprzednie otwory wygenerowane przez ten uchwyt
    const existingFeatures = Array.isArray(panelModel.features) ? panelModel.features : [];
    const remainingFeatures = existingFeatures.filter((f: any) => {
        const p = f.params || {};
        if (p.sourceContainerId === container.id) return false;
        if (p.isHandleDrilling && (p.handleId === container.id || p.sourceContainerId === container.id)) return false;
        return true;
    });

    // 2. Jeśli wiercenie włączone, dodaj nowe otwory pod śruby C-C
    const newHoles = generateHandleDrillingFeatures({
        layout,
        panelWMm,
        panelHMm,
        panelTMm,
        containerId: container.id,
        drillDiameterMm: params.drillDiameterMm,
        drillingEnabled: params.drillingEnabled,
        normalZ,
    });

    remainingFeatures.push(...newHoles);

    if (typeof panelModel.setFeatures === 'function') {
        panelModel.setFeatures(remainingFeatures);
    } else {
        panelModel.features = remainingFeatures;
    }
}

/**
 * Usuwa wszystkie nawierty powiązane z danym uchwytem ze wszystkich formatek w dokumencie.
 */
export function removeHandleDrillings(document: any, containerId: string): void {
    if (!document || !containerId) return;
    const panels = typeof document.getPanels === 'function' ? document.getPanels() : [];
    for (const pNode of panels) {
        const panelModel = pNode.domainData as any;
        if (!panelModel || !Array.isArray(panelModel.features)) continue;
        const remaining = panelModel.features.filter((f: any) => {
            const p = f.params || {};
            return p.sourceContainerId !== containerId && (!p.isHandleDrilling || p.handleId !== containerId);
        });
        if (remaining.length !== panelModel.features.length) {
            if (typeof panelModel.setFeatures === 'function') {
                panelModel.setFeatures(remaining);
            } else {
                panelModel.features = remaining;
            }
        }
    }
}
