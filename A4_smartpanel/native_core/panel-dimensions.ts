/**
 * panel-dimensions.ts — walidacja wymiarów formatki (SSOT jednostek + fail-fast).
 * CAD = nm na modelu; planowanie/mesh = mm przez nmToMm.
 */

import { nmToMm } from '../../A1_core/cad-math/units.js';

export interface PanelDimsMm {
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
}

/**
 * Wymaga dodatnich width/height/thickness w nm na modelu.
 * Rzuca błąd zamiast cichego 600/720/18 mm.
 */
export function validatePanelDimensionsNm(
    model: { width?: unknown; height?: unknown; thickness?: unknown; id?: string; name?: string },
    context: string = 'A4_smartpanel'
): PanelDimsMm {
    const width = model?.width;
    const height = model?.height;
    const thickness = model?.thickness;

    if (
        typeof width !== 'number' || !Number.isFinite(width) || width <= 0 ||
        typeof height !== 'number' || !Number.isFinite(height) || height <= 0 ||
        typeof thickness !== 'number' || !Number.isFinite(thickness) || thickness <= 0
    ) {
        throw new Error(
            `[${context}] Nieprawidłowe wymiary formatki ${model?.id || model?.name || 'nieznana'}: ` +
            `width=${width}, height=${height}, thickness=${thickness} (nm). ` +
            `Wszystkie wymiary muszą być dodatnimi liczbami (zabronione domyślne 600/18 mm).`
        );
    }

    return {
        widthMm: nmToMm(width),
        heightMm: nmToMm(height),
        thicknessMm: nmToMm(thickness),
    };
}
