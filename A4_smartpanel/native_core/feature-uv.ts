/**
 * feature-uv.ts — SSOT odczytu UV feature na ścianie.
 * Kanoniczne: params.u / params.v. Alias legacy: params.x / params.y.
 * Opcjonalnie loc.x / loc.y, gdy brak params.
 */

export type FeatureUV = { u: number; v: number };

/**
 * Jedna ścieżka u/x (i v/y) dla mesh + widoku — bez lokalnych kopii z innym fallbackiem.
 */
export function readFeatureUV(
    params?: { u?: number; v?: number; x?: number; y?: number } | null,
    loc?: { x?: number; y?: number } | null
): FeatureUV {
    const p = params || {};
    return {
        u: p.u !== undefined ? p.u : (p.x !== undefined ? p.x : (loc?.x || 0)),
        v: p.v !== undefined ? p.v : (p.y !== undefined ? p.y : (loc?.y || 0)),
    };
}

/** Czy params niosą UV (kanoniczne lub legacy) — bez loc. */
export function hasFeatureParamsUV(
    params?: { u?: number; x?: number } | null
): boolean {
    return !!params && (params.u !== undefined || params.x !== undefined);
}
