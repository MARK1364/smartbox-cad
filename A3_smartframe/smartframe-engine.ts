/**
 * smartframe-engine.ts
 * Silnik geometrii korpusu SmartFrame (1 / 2 / 3 strefy).
 */

import korpusRulesData from './korpus3_3_rules.json';

export interface CabinetGeometryPart {
    key: string;
    name: string;
    role: string;
    material: string;
    thickness: number;
    dim: { x: number; y: number; z: number };
    loc: { x: number; y: number; z: number };
    zonePrefix: string;
    zoneId: string;
    customProperties: Record<string, any>;
    lcs?: {
        mapping?: { X: string; Y: string; Z: string };
        rotation?: number[];
        faces?: { INNER: string; OUTER: string };
    };
}

export interface ZoneLayout {
    zoneKey: string;
    size: number;
    baseOffset: number;
}

export interface CabinetPlanParams {
    width: number;
    height: number;
    depth: number;
    zoneCount: number;
    bottomHeight?: number;
    middleHeight?: number;
    backOffsetMm?: number;
    offsets?: Record<string, number>;
    container?: any;
}

export interface CabinetPlanResult {
    parts: CabinetGeometryPart[];
    zones: ZoneLayout[];
}

const ZONE_KEYS_3 = ["SEKCJA_B", "SEKCJA_M", "SEKCJA_T"];
const ACTIVE_ZONES: Record<number, string[]> = {
    1: ["SEKCJA_B"],
    2: ["SEKCJA_B", "SEKCJA_T"],
    3: ZONE_KEYS_3
};

import { ContextManager } from '../A1_core/context-manager.js';
import { nmToMm, rulesMToMm } from '../A1_core/cad-math/units.js';

function getRootSubcomponents(rules: any): Record<string, any> {
    if (!rules || !rules.model_tree) return {};
    const firstKey = Object.keys(rules.model_tree)[0];
    if (!firstKey) return {};
    return rules.model_tree[firstKey]?.subcomponents || {};
}

export class BaseCabinetEngine {
    rules: any = null;
    baseRules: any = null;
    offsets: Record<string, number> = {};
    protected _targetContainer: any = null;

    protected _computeZoneLayout(
        zoneCount: number,
        height: number,
        bottomHeight: number,
        middleHeight: number
    ): ZoneLayout[] {
        const numZones = Math.max(1, Math.min(3, zoneCount));
        if (numZones === 1) {
            return [{ zoneKey: "SEKCJA_B", size: height, baseOffset: 0 }];
        }

        const activeKeys = ACTIVE_ZONES[numZones] || ZONE_KEYS_3;
        const rootComps = getRootSubcomponents(this.baseRules);
        const sizes: Record<string, number | null> = {};
        const fillZones: string[] = [];
        let totalFixed = 0;

        for (const key of activeKeys) {
            const zoneDef = rootComps[key]?.zone || {};
            const mode = zoneDef.size_mode || "FIXED";
            if (numZones === 2 && key === "SEKCJA_T") {
                fillZones.push(key);
                sizes[key] = null;
                continue;
            }
            if (mode === "FILL") {
                fillZones.push(key);
                sizes[key] = null;
            } else {
                let sz: number;
                if (key === "SEKCJA_B") sz = bottomHeight;
                else if (key === "SEKCJA_M") sz = middleHeight;
                else {
                    const parsed = parseFloat(zoneDef.size || "0");
                    sz = rulesMToMm(parsed);
                }
                sizes[key] = sz;
                totalFixed += sz;
            }
        }

        if (fillZones.length > 0) {
            const fillSize = Math.max(height - totalFixed, 0) / fillZones.length;
            for (const fillKey of fillZones) {
                sizes[fillKey] = fillSize;
            }
        }

        const layout: ZoneLayout[] = [];
        let currentOffset = 0;
        for (const key of activeKeys) {
            const sz = sizes[key] ?? 0;
            layout.push({ zoneKey: key, size: sz, baseOffset: currentOffset });
            currentOffset += sz;
        }
        return layout;
    }

    protected _buildSubcomponents(
        subcomponents: Record<string, any>,
        resultList: CabinetGeometryPart[],
        context: {
            sb_width: number;
            sb_height: number;
            sb_depth: number;
            back_offset_mm: number;
            back_groove_depth: number;
        },
        zoneLayout: ZoneLayout[],
        prefix: string,
        zoneId: string
    ) {
        for (const [key, comp] of Object.entries(subcomponents)) {
            const compType = (comp.type || "Part").toLowerCase();
            if (compType === "assembly") {
                const layout = zoneLayout.find(z => z.zoneKey === key);
                if (!layout) continue;
                const pfx = comp.zone?.prefix || "";
                const ctx = { ...context, sb_height: layout.size };
                this._buildSubcomponents(
                    comp.subcomponents || {},
                    resultList,
                    ctx,
                    zoneLayout,
                    pfx,
                    key
                );
            } else {
                if (key.endsWith("_T2")) continue;
                const cleanKey = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
                const geom = this._resolveGeometry(cleanKey, comp, {
                    ...context,
                    zonePrefix: prefix,
                    zoneId
                });
                if (!geom) continue;
                const zoneOffset = zoneLayout.find(z => z.zoneKey === zoneId)?.baseOffset || 0;
                resultList.push({
                    key,
                    name: comp.name || key,
                    role: comp.role || "PART",
                    material: comp.custom_properties?.material || "",
                    thickness: geom.thickness,
                    dim: geom.dim,
                    loc: { ...geom.loc, z: geom.loc.z + zoneOffset },
                    zonePrefix: prefix,
                    zoneId,
                    customProperties: comp.custom_properties || {},
                    lcs: comp.lcs || null
                });
            }
        }
    }

    protected _resolveGeometry(
        key: string,
        comp: any,
        ctx: {
            sb_width: number;
            sb_height: number;
            sb_depth: number;
            back_offset_mm: number;
            back_groove_depth: number;
            zonePrefix?: string;
            zoneId?: string;
        }
    ) {
        const W = ctx.sb_width;
        const H = ctx.sb_height;
        const D = ctx.sb_depth;
        const backOffset = ctx.back_offset_mm ?? 0;

        const name = comp.name || key;
        const role = comp.role || "";
        const pYPlus  = this.offsets[`${name}_+Y`] || 0;
        const pYMinus = this.offsets[`${name}_-Y`] || 0;
        const pXMinus = this.offsets[`${name}_-X`] || 0;
        const pXPlus  = this.offsets[`${name}_+X`] || 0;

        const shiftX = this.offsets[`${name}_shiftX`] || 0;
        const shiftY = this.offsets[`${name}_shiftY`] || 0;
        const shiftZ = this.offsets[`${name}_shiftZ`] || 0;

        const rawThickness = parseFloat(comp.thickness ?? "0.018");
        const cleanKey = key.replace(/^(B_|M_|T_)/i, '');
        const matchedKey = cleanKey.toUpperCase();
        const pfx = ctx.zonePrefix || '';

        const customTh = this._getNodeThickness(key, pfx) || this._getNodeThickness(cleanKey, pfx) || this._getNodeThickness(name, pfx) || this._getNodeThickness(role, pfx);
        let defaultTh = rulesMToMm(rawThickness);
        if (matchedKey === "PLECY" || matchedKey === "BACK" || role === "BACK_PANEL") {
            if (!rawThickness || rawThickness > 0.010) defaultTh = 3.0;
        }
        const thickness = customTh || defaultTh;

        const leftThick  = this._getNodeThickness("BOK_L", pfx) || this._getNodeThickness("SIDE_LEFT", pfx) || this._getNodeThickness("LEFT_SIDE_PANEL", pfx) || 18;
        const rightThick = this._getNodeThickness("BOK_P", pfx) || this._getNodeThickness("SIDE_RIGHT", pfx) || this._getNodeThickness("RIGHT_SIDE_PANEL", pfx) || 18;
        const innerWidth = W - leftThick - rightThick;
        const midShift   = (leftThick - rightThick) / 2;

        if (matchedKey === "BOK_L" || matchedKey === "SIDE_LEFT" || role === "LEFT_SIDE_PANEL") {
            return {
                thickness,
                dim: { x: H + pYPlus + pYMinus, y: D + pXMinus + pXPlus, z: thickness },
                loc: { x: -W / 2 + thickness / 2 - shiftX, y: (pXPlus - pXMinus) / 2, z: H / 2 + (pYPlus - pYMinus) / 2 }
            };
        }
        if (matchedKey === "BOK_P" || matchedKey === "SIDE_RIGHT" || role === "RIGHT_SIDE_PANEL") {
            return {
                thickness,
                dim: { x: H + pYPlus + pYMinus, y: D + pXMinus + pXPlus, z: thickness },
                loc: { x: W / 2 - thickness / 2 + shiftX, y: (pXPlus - pXMinus) / 2, z: H / 2 + (pYPlus - pYMinus) / 2 }
            };
        }
        if (matchedKey === "WIENIEC_D" || matchedKey === "BOTTOM" || role === "BOTTOM_PANEL") {
            return {
                thickness,
                dim: { x: innerWidth + pYMinus + pYPlus, y: D + pXMinus + pXPlus, z: thickness },
                loc: { x: midShift + (pYPlus - pYMinus) / 2, y: (pXPlus - pXMinus) / 2, z: thickness / 2 - shiftZ }
            };
        }
        if (matchedKey === "WIENIEC_G" || matchedKey === "TOP" || role === "TOP_PANEL") {
            return {
                thickness,
                dim: { x: innerWidth + pYMinus + pYPlus, y: D + pXMinus + pXPlus, z: thickness },
                loc: { x: midShift + (pYPlus - pYMinus) / 2, y: (pXPlus - pXMinus) / 2, z: H - thickness / 2 + shiftZ }
            };
        }
        if (matchedKey === "PLECY" || matchedKey === "BACK" || role === "BACK_PANEL") {
            const grooveDepth = ctx.back_groove_depth || 11;
            const bottomThick = this._getNodeThickness("WIENIEC_D", pfx) || this._getNodeThickness("BOTTOM", pfx) || 18;
            const topThick    = this._getNodeThickness("WIENIEC_G", pfx) || this._getNodeThickness("TOP", pfx) || 18;
            const innerH      = H - bottomThick - topThick;
            const backW       = innerWidth + 2 * grooveDepth + pYMinus + pYPlus;
            const backH       = innerH + 2 * grooveDepth + pYPlus + pYMinus;
            const backY       = D / 2 + thickness / 2 - backOffset + shiftY;
            return {
                thickness,
                dim: { x: backW, y: thickness, z: backH },
                loc: { x: (pYMinus - pYPlus) / 2 + midShift, y: backY, z: pYMinus + backH / 2 + bottomThick - grooveDepth }
            };
        }

        console.warn(`[BaseCabinetEngine] Nieznany węzeł geometrii: "${key}" (role: "${role}")`);
        return null;
    }

    protected _getNodeThickness(partKey: string, zonePrefix: string = ""): number {
        const doc = ContextManager.instance.document;
        let cntNode: any = null;

        if (this._targetContainer) {
            const cId = this._targetContainer.id;
            cntNode = doc ? doc.findNode(cId) : null;
            if (!cntNode && this._targetContainer.children) {
                cntNode = this._targetContainer;
            }
        }

        if (!cntNode && doc) {
            const cnt = doc.activeEntity;
            cntNode = cnt ? (cnt.type === 'container' ? doc.findNode(cnt.id) : doc.findNode(cnt.id)?.parent) : null;
        }

        if (cntNode && cntNode.children) {
            const targetUpper = partKey.toUpperCase();
            const prefixedTarget = (zonePrefix && !targetUpper.startsWith(zonePrefix.toUpperCase()))
                ? (zonePrefix + partKey).toUpperCase()
                : targetUpper;
            const cleanTarget = partKey.replace(/^(B_|M_|T_)/i, '').toUpperCase();

            const child = cntNode.children.find((c: any) => {
                const p = c.domainData || c;
                if (!p) return false;
                const pName = (p.name || '').toUpperCase();
                const pRole = (p.role || '').toUpperCase();
                const pKey = ((p as any).key || '').toUpperCase();
                const pZone = p.zonePrefix || '';

                if (zonePrefix && pZone && pZone !== zonePrefix) {
                    return false;
                }

                return pKey === prefixedTarget || pName === prefixedTarget || pKey === targetUpper || pName === targetUpper ||
                       (pZone === zonePrefix && (pRole === targetUpper || pRole === cleanTarget));
            });

            if (child) {
                const p = child.domainData || child;
                if (p.custom_properties && p.custom_properties.thickness_mm !== undefined) {
                    return p.custom_properties.thickness_mm;
                }
                if (p.custom_properties && p.custom_properties.thickness !== undefined) {
                    const ct = p.custom_properties.thickness;
                    return nmToMm(ct);
                }
                if (p.thickness) {
                    const th = p.thickness;
                    return nmToMm(th);
                }
            }
        }

        const rules = this.rules || this.baseRules;
        if (!rules) return 18;
        const comps = getRootSubcomponents(rules);
        for (const sub of Object.values(comps) as any[]) {
            const innerComps = sub.subcomponents || {};
            for (const [key, comp] of Object.entries(innerComps) as [string, any][]) {
                const cleanKey = key.includes("_") ? key.slice(key.indexOf("_") + 1) : key;
                if (cleanKey === partKey || comp.role === partKey) {
                    const rawThick = parseFloat(comp.thickness ?? "0.018");
                    return rulesMToMm(rawThick);
                }
            }
        }
        return 0;
    }

    protected _collectCabinetGeometry(params: CabinetPlanParams, zoneLayout: ZoneLayout[]): CabinetGeometryPart[] {
        if (!this.rules) return [];
        const defaults = this.rules.cabinet_construction_rules?.defaults || {};
        const rawGroove = defaults.back_groove_depth ?? 0.011;
        const grooveDepth = rulesMToMm(rawGroove);

        const ctx = {
            sb_width: params.width,
            sb_height: params.height,
            sb_depth: params.depth,
            back_offset_mm: params.backOffsetMm ?? 0,
            back_groove_depth: grooveDepth
        };

        const tree = this.rules.model_tree || {};
        const rootKey = Object.keys(tree)[0];
        const subcomps = tree[rootKey]?.subcomponents || {};
        const parts: CabinetGeometryPart[] = [];
        this._buildSubcomponents(subcomps, parts, ctx, zoneLayout, "", "");
        return parts;
    }
}

function filterRulesForZoneCount(baseRules: any, zoneCount: number): any {
    const numZones = Math.max(1, Math.min(3, zoneCount));
    const rules = JSON.parse(JSON.stringify(baseRules));
    const modelTree = rules.model_tree || {};
    if (!Object.keys(modelTree).length) return rules;

    const rootKey = Object.keys(modelTree)[0];
    const rootNode = modelTree[rootKey];
    const allZones = getRootSubcomponents(baseRules);

    if (numZones === 1) {
        const zoneB = allZones.SEKCJA_B;
        rootNode.subcomponents = zoneB ? flattenSingleZone(zoneB) : {};
        return rules;
    }

    const activeKeys = ACTIVE_ZONES[numZones] || ZONE_KEYS_3;
    const filteredComps: Record<string, any> = {};

    for (const key of activeKeys) {
        if (!allZones[key]) continue;
        const zoneCopy = JSON.parse(JSON.stringify(allZones[key]));
        const zoneDef = zoneCopy.zone || {};
        if (numZones === 2 && key === "SEKCJA_T") zoneDef.size_mode = "FILL";
        if (numZones === 2 && key === "SEKCJA_B") zoneDef.size_mode = "FIXED";
        zoneCopy.zone = zoneDef;
        filteredComps[key] = zoneCopy;
    }

    rootNode.subcomponents = filteredComps;
    return rules;
}

function flattenSingleZone(zoneNode: any): Record<string, any> {
    const parts: Record<string, any> = {};
    for (const [key, part] of Object.entries(zoneNode.subcomponents || {})) {
        const cleanKey = key.length > 2 && key[1] === "_" ? key.slice(2) : key;
        const partCopy = JSON.parse(JSON.stringify(part));
        if (typeof partCopy.name === "string") {
            for (const prefix of ["Dol_", "Srodek_", "Gora_"]) {
                if (partCopy.name.startsWith(prefix)) {
                    partCopy.name = partCopy.name.slice(prefix.length);
                    break;
                }
            }
        }
        parts[cleanKey] = partCopy;
    }
    return parts;
}

export class Korpus3Engine extends BaseCabinetEngine {
    constructor() {
        super();
        this.baseRules = korpusRulesData;
        this.rules = this.baseRules;
        if (typeof window !== "undefined") {
            (window as any).korpusRules = this.baseRules;
        }
    }

    async loadRules(rulesPath: string = "/A3_smartframe/korpus3_3_rules.json"): Promise<void> {
        this.baseRules = korpusRulesData;
        this.rules = this.baseRules;
        if (typeof window !== "undefined") {
            (window as any).korpusRules = this.baseRules;
        }
    }

    private _loadFallbackRules(): void {
        this.baseRules = {
            metadata: {
                module_type: "SMARTFRAME_KORPUS3",
                version: "3.0.0"
            },
            parameters: {
                defaults: {
                    bottom_height: 0.5,
                    middle_height: 1.2
                }
            },
            model_tree: {
                root_assembly: {
                    name: "Korpus3_Global",
                    type: "Assembly",
                    subcomponents: {
                        SEKCJA_B: {
                            name: "Sekcja_Dolna",
                            type: "Assembly",
                            role: "ZONE",
                            zone: {
                                stack_axis: "Z",
                                size_mode: "FIXED",
                                size: 0.5,
                                prefix: "B_"
                            },
                            subcomponents: {
                                B_SIDE_LEFT: {
                                    name: "Dol_Bok_L",
                                    type: "Part",
                                    role: "LEFT_SIDE_PANEL",
                                    thickness: 0.018,
                                    custom_properties: { material: "MDF_SUROWY_18" }
                                },
                                B_SIDE_RIGHT: {
                                    name: "Dol_Bok_P",
                                    type: "Part",
                                    role: "RIGHT_SIDE_PANEL",
                                    thickness: 0.018,
                                    custom_properties: { material: "MDF_SUROWY_18" }
                                },
                                B_BOTTOM: {
                                    name: "Dol_Wieniec_D",
                                    type: "Part",
                                    role: "BOTTOM_PANEL",
                                    thickness: 0.018,
                                    custom_properties: { material: "MDF_SUROWY_18" }
                                },
                                B_TOP: {
                                    name: "Dol_Wieniec_G",
                                    type: "Part",
                                    role: "TOP_PANEL",
                                    thickness: 0.018,
                                    custom_properties: { material: "MDF_SUROWY_18" }
                                },
                                B_BACK: {
                                    name: "Dol_Plecy",
                                    type: "Part",
                                    role: "BACK_PANEL",
                                    thickness: 0.003,
                                    custom_properties: { material: "HDF_3" }
                                }
                            }
                        },
                        SEKCJA_M: {
                            name: "Sekcja_Srodkowa",
                            type: "Assembly",
                            role: "ZONE",
                            zone: {
                                stack_axis: "Z",
                                size_mode: "FIXED",
                                size: 1.2,
                                prefix: "M_"
                            },
                            subcomponents: {
                                M_SIDE_LEFT: {
                                    name: "Srodek_Bok_L",
                                    type: "Part",
                                    role: "LEFT_SIDE_PANEL",
                                    thickness: 0.018,
                                    custom_properties: { material: "MDF_SUROWY_18" }
                                },
                                M_SIDE_RIGHT: {
                                    name: "Srodek_Bok_P",
                                    type: "Part",
                                    role: "RIGHT_SIDE_PANEL",
                                    thickness: 0.018,
                                    custom_properties: { material: "MDF_SUROWY_18" }
                                }
                            }
                        },
                        SEKCJA_T: {
                            name: "Sekcja_Gorna",
                            type: "Assembly",
                            role: "ZONE",
                            zone: {
                                stack_axis: "Z",
                                size_mode: "FILL",
                                size: 0.5,
                                prefix: "T_"
                            },
                            subcomponents: {
                                T_SIDE_LEFT: {
                                    name: "Gora_Bok_L",
                                    type: "Part",
                                    role: "LEFT_SIDE_PANEL",
                                    thickness: 0.018,
                                    custom_properties: { material: "MDF_SUROWY_18" }
                                },
                                T_SIDE_RIGHT: {
                                    name: "Gora_Bok_P",
                                    type: "Part",
                                    role: "RIGHT_SIDE_PANEL",
                                    thickness: 0.018,
                                    custom_properties: { material: "MDF_SUROWY_18" }
                                }
                            }
                        }
                    }
                }
            },
            cabinet_construction_rules: {
                defaults: {
                    back_inset: 0.01,
                    back_groove_depth: 0.011
                }
            }
        };
        this.rules = this.baseRules;
        if (typeof window !== "undefined") {
            (window as any).korpusRules = this.baseRules;
        }
    }

    plan(params: CabinetPlanParams): CabinetPlanResult {
        if (!this.baseRules) {
            this._loadFallbackRules();
        }
        this._targetContainer = params.container || null;
        const zoneCount = Math.max(1, Math.min(3, params.zoneCount));
        this.rules = filterRulesForZoneCount(this.baseRules, zoneCount);

        const defaults = this.baseRules.parameters?.defaults || {};
        const defB = rulesMToMm(defaults.bottom_height ?? 0.5);
        const defM = rulesMToMm(defaults.middle_height ?? 1.2);

        const bottomH = params.bottomHeight ?? defB;
        const middleH = params.middleHeight ?? defM;

        const zones = this._computeZoneLayout(zoneCount, params.height, bottomH, middleH);
        this.offsets = params.offsets || {};

        return {
            parts: this._collectCabinetGeometry(params, zones),
            zones
        };
    }
}
