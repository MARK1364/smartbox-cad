/**
 * Szablony geometrii korpusu — wyłącznie z JSON (cabinet_construction_rules.part_geometry).
 * Silnik podstawia kontekst liczbowy i liczy dim/loc w nm.
 */

export interface GeometryContext {
    W: number;
    H: number;
    D: number;
    thickness: number;
    pYPlus: number;
    pYMinus: number;
    pXMinus: number;
    pXPlus: number;
    shiftX: number;
    shiftY: number;
    shiftZ: number;
    leftThick: number;
    rightThick: number;
    innerWidth: number;
    midShift: number;
    marginLeft: number;
    marginRight: number;
    marginBottom: number;
    marginTop: number;
    bottomThick: number;
    topThick: number;
    innerH: number;
    backW: number;
    backH: number;
}

export interface PartGeometryTemplate {
    dim: [string, string, string];
    loc: [string, string, string];
}

export function evalGeometryExpr(expr: string, ctx: GeometryContext): number {
    const scope: Record<string, number> = ctx as unknown as Record<string, number>;
    const keys = Object.keys(scope);
    const fn = new Function(...keys, `"use strict"; return (${expr});`);
    return Number(fn(...keys.map((k) => scope[k])));
}

export function resolvePartGeometry(
    template: PartGeometryTemplate,
    ctx: GeometryContext
): { dim: { x: number; y: number; z: number }; loc: { x: number; y: number; z: number } } {
    return {
        dim: {
            x: evalGeometryExpr(template.dim[0], ctx),
            y: evalGeometryExpr(template.dim[1], ctx),
            z: evalGeometryExpr(template.dim[2], ctx)
        },
        loc: {
            x: evalGeometryExpr(template.loc[0], ctx),
            y: evalGeometryExpr(template.loc[1], ctx),
            z: evalGeometryExpr(template.loc[2], ctx)
        }
    };
}

export function getPartGeometryTemplate(rules: any, role: string): PartGeometryTemplate | null {
    const tpl = rules?.cabinet_construction_rules?.part_geometry?.[role];
    if (!tpl?.dim || !tpl?.loc) return null;
    return tpl as PartGeometryTemplate;
}
