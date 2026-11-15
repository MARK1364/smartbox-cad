/**
 * SmartPanel Web — C1_CNC Program Persistence & WCS Consistency
 *
 * Zapisuje zaktualizowany program w liście domenowej formatki oraz zapewnia
 * spójność WCS (fail-fast: przy nieudanym przeliczeniu WCS nie zapisuje niespójnego stanu).
 */

import type { CNCProgramState } from '../core/cam-state-store.js';
import type { CAMFeature } from '../dto/cam-dto.js';
import { WcsManager, retransformFeaturesToWcs } from '../wcs/wcs-manager.js';
import { WcsRulesMapper, cornerIndexToOriginCorner } from '../wcs/wcs-rules-mapper.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

export function isWcsConfigChanged(a: Partial<CNCProgramState>, b: Partial<CNCProgramState>): boolean {
    return b.cornerIndex !== a.cornerIndex ||
        b.wcsOffsetX !== a.wcsOffsetX ||
        b.wcsOffsetY !== a.wcsOffsetY ||
        b.wcsOffsetZ !== a.wcsOffsetZ ||
        b.wcsRotX !== a.wcsRotX ||
        b.wcsRotY !== a.wcsRotY ||
        b.wcsRotZ !== a.wcsRotZ ||
        b.wcsName !== a.wcsName;
}

export function getPanelDimensionsForWcs(panel: any): { width: number; height: number; thickness: number } {
    if (!panel) {
        throw new Error('[C1_cnc/persist] Brak referencji do formatki (panel is null).');
    }
    if (typeof panel.width !== 'number' || !Number.isFinite(panel.width) || panel.width <= 0 ||
        typeof panel.height !== 'number' || !Number.isFinite(panel.height) || panel.height <= 0 ||
        typeof panel.thickness !== 'number' || !Number.isFinite(panel.thickness) || panel.thickness <= 0) {
        throw new Error(`[C1_cnc/persist] Formatka "${panel.id}" nie posiada poprawnych wymiarów fizycznych (W=${panel.width}, H=${panel.height}, T=${panel.thickness}).`);
    }
    return {
        width: nmToMm(panel.width),
        height: nmToMm(panel.height),
        thickness: nmToMm(panel.thickness)
    };
}

function assertValidPoint(p: any, context: string): void {
    if (!p || typeof p.x !== 'number' || !Number.isFinite(p.x) ||
        typeof p.y !== 'number' || !Number.isFinite(p.y) ||
        typeof p.z !== 'number' || !Number.isFinite(p.z)) {
        throw new Error(`[C1_cnc/persist] Nieprawidłowe współrzędne po transformacji WCS (${context}): x=${p?.x}, y=${p?.y}, z=${p?.z}`);
    }
}

const MIN_DIRECTION_VECTOR_LEN = 1e-6;

function assertValidDirectionVector(v: any, context: string): void {
    assertValidPoint(v, context);
    const len = Math.hypot(v.x, v.y, v.z);
    if (len < MIN_DIRECTION_VECTOR_LEN) {
        throw new Error(`[C1_cnc/persist] Wektor kierunku nie może być zerowy ani bliski zeru (${context}): długość=${len}, x=${v.x}, y=${v.y}, z=${v.z}`);
    }
}

export function validateTransformedFeatures(features: CAMFeature[]): void {
    if (!Array.isArray(features)) return;
    for (const f of features) {
        if (!f) continue;
        if ('position' in f && (f as any).position) {
            assertValidPoint((f as any).position, `hole position ${(f as any).featureId || 'unknown'}`);
            if (Array.isArray((f as any).positions)) {
                for (let i = 0; i < (f as any).positions.length; i++) {
                    assertValidPoint((f as any).positions[i], `hole positions[${i}] ${(f as any).featureId || 'unknown'}`);
                }
            }
            if ((f as any).axis) {
                assertValidDirectionVector((f as any).axis, `hole axis ${(f as any).featureId || 'unknown'}`);
            }
        }
        if ('startPoint' in f && 'endPoint' in f) {
            assertValidPoint((f as any).startPoint, `groove startPoint ${(f as any).featureId || 'unknown'}`);
            assertValidPoint((f as any).endPoint, `groove endPoint ${(f as any).featureId || 'unknown'}`);
            if ((f as any).normal) {
                assertValidDirectionVector((f as any).normal, `groove normal ${(f as any).featureId || 'unknown'}`);
            }
        }
        if ('points' in f && Array.isArray((f as any).points)) {
            for (let i = 0; i < (f as any).points.length; i++) {
                assertValidPoint((f as any).points[i], `contour points[${i}] ${(f as any).featureId || 'unknown'}`);
            }
            if ((f as any).depth !== undefined && (typeof (f as any).depth !== 'number' || !Number.isFinite((f as any).depth))) {
                throw new Error(`[C1_cnc/persist] Nieprawidłowa głębokość konturu po transformacji WCS (contour depth ${(f as any).featureId || 'unknown'}): depth=${(f as any).depth}`);
            }
            if (Array.isArray((f as any).segments)) {
                for (let i = 0; i < (f as any).segments.length; i++) {
                    const seg = (f as any).segments[i];
                    assertValidPoint(seg?.start, `contour segments[${i}].start ${(f as any).featureId || 'unknown'}`);
                    assertValidPoint(seg?.end, `contour segments[${i}].end ${(f as any).featureId || 'unknown'}`);
                    if (seg?.type === 'ARC') {
                        assertValidPoint(seg?.center, `contour segments[${i}].center ${(f as any).featureId || 'unknown'}`);
                    }
                }
            }
            if ((f as any).normal) {
                assertValidDirectionVector((f as any).normal, `contour normal ${(f as any).featureId || 'unknown'}`);
            }
        }
        if ('boundaryPoints' in f && Array.isArray((f as any).boundaryPoints)) {
            for (let i = 0; i < (f as any).boundaryPoints.length; i++) {
                assertValidPoint((f as any).boundaryPoints[i], `pocket boundaryPoints[${i}] ${(f as any).featureId || 'unknown'}`);
            }
            if ((f as any).normal) {
                assertValidDirectionVector((f as any).normal, `pocket normal ${(f as any).featureId || 'unknown'}`);
            }
        }
    }
}

/**
 * Przelicza cechy programu dla nowej konfiguracji WCS formatki.
 * Jeśli przeliczenie się nie powiedzie, rzuca wyjątek (fail-fast) i nie zwraca niespójnego programu.
 */
export function recalculateProgramWcsOrThrow(
    prev: CNCProgramState,
    next: CNCProgramState,
    panel: any,
    wcsManager?: WcsManager
): CNCProgramState {
    const wcsChanged = isWcsConfigChanged(prev, next);
    if (!wcsChanged || !next.features || next.features.length === 0) {
        return next;
    }

    // Walidacja skończoności parametrów WCS
    const rotX = next.wcsRotX ?? 0;
    const rotY = next.wcsRotY ?? 0;
    const rotZ = next.wcsRotZ ?? 0;
    const offX = next.wcsOffsetX ?? 0;
    const offY = next.wcsOffsetY ?? 0;
    const offZ = next.wcsOffsetZ ?? 0;
    if (!Number.isFinite(rotX) || !Number.isFinite(rotY) || !Number.isFinite(rotZ) ||
        !Number.isFinite(offX) || !Number.isFinite(offY) || !Number.isFinite(offZ)) {
        throw new Error(`[C1_cnc/persist] Parametry WCS muszą być liczbami skończonymi (rot=[${rotX}, ${rotY}, ${rotZ}], offset=[${offX}, ${offY}, ${offZ}]).`);
    }
    if (next.cornerIndex !== undefined) {
        if (typeof next.cornerIndex !== 'number' || !Number.isInteger(next.cornerIndex) || (next.cornerIndex !== -1 && (next.cornerIndex < 0 || next.cornerIndex > 7))) {
            throw new Error(`[C1_cnc/persist] Indeks naroża WCS musi być wartością -1 lub liczbą całkowitą od 0 do 7 (cornerIndex=${next.cornerIndex}).`);
        }
    }

    // Fail-fast: jeśli program posiada cechy i WCS ulega zmianie, brak formatki lub jej uszkodzenie to błąd krytyczny
    const dims = getPanelDimensionsForWcs(panel);

    // Izolacja: obliczenia wykonujemy na tymczasowej instancji WcsManager.
    // Współdzielony wcsManager (np. z CNCEngine) nie może zostać zanieczyszczony odrzuconymi danymi w razie błędu.
    const tempWcs = new WcsManager();
    const panelRole = panel.role;
    const roleRule = WcsRulesMapper.getRuleForRole(panelRole);
    const rule = roleRule
        ? { ...roleRule, origin_corner: { ...roleRule.origin_corner }, directions: { ...roleRule.directions }, rotation: { ...roleRule.rotation } }
        : {
            origin_corner: { X: '-', Y: '-', Z: '-' },
            directions: { X: '+', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 0 },
        };
    if (typeof next.cornerIndex === 'number' && next.cornerIndex >= 0) {
        rule.origin_corner = cornerIndexToOriginCorner(next.cornerIndex);
    }
    tempWcs.setRule(rule);
    tempWcs.setWcsName(next.wcsName || 'G55');
    tempWcs.updateForPanelDimensions(dims.width, dims.height, dims.thickness);
    tempWcs.setManualRotation({ x: rotX, y: rotY, z: rotZ });
    tempWcs.setManualOffset({ x: offX, y: offY, z: offZ });

    const updatedFeatures = retransformFeaturesToWcs(next.features, tempWcs);

    // Weryfikacja poprawności współrzędnych po transformacji
    validateTransformedFeatures(updatedFeatures);

    // Dopiero po udanym przeliczeniu i walidacji cech bez rzucenia błędu aktualizujemy aktywny manager
    if (wcsManager) {
        wcsManager.copyFrom(tempWcs);
    }

    return {
        ...next,
        features: updatedFeatures
    };
}

export function persistProgramInPanel(panel: any, program: CNCProgramState | null | undefined): void {
    if (!panel || !program) return;

    if (!Array.isArray(panel.cncPrograms)) {
        panel.cncPrograms = [];
    }

    const index = panel.cncPrograms.findIndex((p: any) => p?.id === program.id);
    if (index !== -1) {
        panel.cncPrograms[index] = program;
    }
}
