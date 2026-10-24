/**
 * subcomponents-builder.ts
 *
 * Czysty orkiestrator budowania formatek korpusu (collectCabinetGeometry + buildCabinetSubcomponents).
 * Pure Functional Core — zero `new BaseCabinetEngine()`, zero `ContextManager`.
 */

import { rulesMToMm } from '../../A1_core/cad-math/units.js';
import { CabinetType, CabinetGeometryPart, CabinetPlanParams, ZoneLayout } from '../smartframe-types.js';
import { CabinetThicknessLookupContext } from './cabinet-thickness.js';
import { resolveCabinetPartGeometry, CabinetPartGeometryContext } from './standard-geometry.js';

export function buildCabinetSubcomponents(
    subcomponents: Record<string, any>,
    resultList: CabinetGeometryPart[],
    context: CabinetPartGeometryContext,
    zoneLayout: ZoneLayout[],
    prefix: string,
    zoneId: string
): void {
    for (const [key, comp] of Object.entries(subcomponents)) {
        const compType = (comp.type || "Part").toLowerCase();
        if (compType === "assembly") {
            const layout = zoneLayout.find(z => z.zoneKey === key);
            if (!layout) continue;
            const pfx = comp.zone?.prefix || "";
            const isTopZone = key === zoneLayout[zoneLayout.length - 1]?.zoneKey;
            const ctx: CabinetPartGeometryContext = {
                ...context,
                wysokosc_mm: layout.size,
                tryb_wienca_gornego: isTopZone ? context.tryb_wienca_gornego : 'FULL'
            };
            buildCabinetSubcomponents(
                comp.subcomponents || {},
                resultList,
                ctx,
                zoneLayout,
                pfx,
                key
            );
        } else {
            const isT2 = key.endsWith("_T2");
            const isTopT2 = isT2 && (key.includes("WIENIEC_G") || comp.role === "TOP_PANEL");
            if (isT2 && !isTopT2) continue;
            if (isTopT2) {
                const mode = context.tryb_wienca_gornego || 'FULL';
                if (mode === 'FULL') continue;
            }
            const isNailer2 = key.endsWith("LISTWA_NAROZNA_2") || key === "B_LISTWA_NAROZNA_2";
            if (isNailer2) {
                const nailerMode = context.typ_listwy_naroznej || 'POJEDYNCZA';
                if (nailerMode !== 'KATOWA_90') continue;
            }
            const cleanKey = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
            const geom = resolveCabinetPartGeometry(cleanKey, comp, {
                ...context,
                zonePrefix: prefix,
                zoneId
            });
            if (!geom) continue;
            const zoneOffset = zoneLayout.find(z => z.zoneKey === zoneId)?.baseOffset || 0;
            if (geom.thickness === undefined || isNaN(geom.thickness)) {
                throw new Error(
                    `[subcomponents-builder] Brak zdefiniowanej grubości dla formatki "${key}" (${comp.name || ''}). ` +
                    `CAD wymaga jawnych danych grubości z reguł lub parametrów.`
                );
            }
            const isBack = comp.role === "BACK_PANEL";
            const rawMat = comp.custom_properties?.material;
            const defaultMat = isBack ? "HDF_BIALY_3" : "W1100_ST9_18";
            const effectiveMat = (!rawMat || rawMat === "MDF_SUROWY_18" || rawMat === "HDF_3") ? defaultMat : rawMat;
            const effectiveMatName = isBack ? "HDF Biały 3mm" : "Biały Alpejski";
            const effectiveMatCode = isBack ? "HDF_WHITE_3" : "W1100 ST9";

            resultList.push({
                key,
                name: comp.name || key,
                role: comp.role || "PART",
                material: effectiveMat,
                materialName: effectiveMatName,
                materialCode: effectiveMatCode,
                thickness: geom.thickness,
                dim: geom.dim ?? { x: 0, y: 0, z: 0 },
                loc: {
                    ...(geom.loc ?? { x: 0, y: 0, z: 0 }),
                    z: (geom.loc?.z ?? 0) + zoneOffset
                },
                zonePrefix: prefix,
                zoneId,
                customProperties: {
                    ...(comp.custom_properties || {}),
                    ...((geom as any).customProperties || {})
                },
                lcs: (geom as any).lcs || comp.lcs || null,
                ...((geom as any).edge_banding ? { edge_banding: (geom as any).edge_banding } : {})
            });
        }
    }
}

/**
 * Czysta funkcja zbierająca geometrię formatek korpusu na podstawie parametrów, reguł i stref.
 * Działa bezstanowo, bez tworzenia instancji klas.
 */
export function collectCabinetGeometry(
    params: CabinetPlanParams,
    rules: any,
    baseRules: any,
    zoneLayout: ZoneLayout[],
    offsets: Record<string, number> = {},
    thicknessOverrides?: Record<string, number>
): CabinetGeometryPart[] {
    if (!rules) return [];
    const defaults = rules.cabinet_construction_rules?.defaults || {};
    const rawGroove = defaults.back_groove_depth ?? 0.011;
    const grooveDepth = rulesMToMm(rawGroove);

    const rawInset = defaults.back_inset !== undefined ? rulesMToMm(defaults.back_inset) : 3;
    const topPanelMode = params.tryb_wienca_gornego || 'FULL';
    const traverseWidth = params.szerokosc_trawersu_mm ?? 80;

    // Wszystko poniżej pochodzi z kanonicznego DTO albo z reguł JSON.
    // params.container.generatorParams NIE jest czytane — brak drugiego źródła prawdy.
    // (params.container zostaje wyłącznie dla odczytu realnych grubości w scenie: thicknessLookup)
    const rulesDefaults = rules?.parameters?.defaults || baseRules?.parameters?.defaults || {};
    const defaultBlindMm = rulesMToMm(rulesDefaults.blind_width ?? 0.4);
    const szerokosc_blendy_mm = params.szerokosc_blendy_mm ?? defaultBlindMm;
    const strona_blendy: 'LEFT' | 'RIGHT' = params.strona_blendy === 'RIGHT' ? 'RIGHT' : 'LEFT';
    const defaultBokMm = rulesMToMm(
        rulesDefaults.bok_lewy ?? rulesDefaults.arm_depth ?? 0.6
    );
    const glebokosc_boku_lewego_mm = params.glebokosc_boku_lewego_mm
        ?? (rulesDefaults.bok_lewy != null ? rulesMToMm(rulesDefaults.bok_lewy)
            : rulesDefaults.arm_depth_x != null ? rulesMToMm(rulesDefaults.arm_depth_x) : undefined)
        ?? defaultBokMm;
    const glebokosc_boku_prawego_mm = params.glebokosc_boku_prawego_mm
        ?? (rulesDefaults.bok_prawy != null ? rulesMToMm(rulesDefaults.bok_prawy)
            : rulesDefaults.arm_depth_y != null ? rulesMToMm(rulesDefaults.arm_depth_y) : undefined)
        ?? defaultBokMm;
    const cabinetType = (params.typ_korpusu || 'korpus3') as CabinetType;
    const wysokosc_przod_mm = params.wysokosc_przod_mm
        ?? params.wysokosc_mm
        ?? (rulesDefaults.height_front != null ? rulesMToMm(rulesDefaults.height_front) : undefined)
        ?? 2200;
    const wysokosc_tyl_mm = params.wysokosc_tyl_mm
        ?? (rulesDefaults.height_back != null ? rulesMToMm(rulesDefaults.height_back) : undefined)
        ?? 1000;
    const wysokosc_lewy_mm = params.wysokosc_lewy_mm
        ?? (rulesDefaults.height_left != null ? rulesMToMm(rulesDefaults.height_left) : undefined)
        ?? 1000;
    const wysokosc_prawy_mm = params.wysokosc_prawy_mm
        ?? (rulesDefaults.height_right != null ? rulesMToMm(rulesDefaults.height_right) : undefined)
        ?? params.wysokosc_mm
        ?? 2200;

    const thicknessLookup: CabinetThicknessLookupContext = {
        rules,
        baseRules,
        thicknessOverrides,
        targetContainer: params.container
    };

    const ctx: CabinetPartGeometryContext = {
        szerokosc_mm: params.szerokosc_mm ?? 600,
        wysokosc_mm: params.wysokosc_mm ?? 720,
        glebokosc_mm: params.glebokosc_mm ?? 560,
        cofniecie_plecow_mm: params.cofniecie_plecow_mm ?? rawInset,
        wpuszczenie_plecow_mm: grooveDepth,
        tryb_wienca_gornego: topPanelMode,
        szerokosc_trawersu_mm: traverseWidth,
        szerokosc_blendy_mm: szerokosc_blendy_mm,
        strona_blendy: strona_blendy,
        glebokosc_boku_lewego_mm: glebokosc_boku_lewego_mm,
        glebokosc_boku_prawego_mm: glebokosc_boku_prawego_mm,
        szerokosc_listwy_naroznej_mm: params.szerokosc_listwy_naroznej_mm,
        typ_listwy_naroznej: params.typ_listwy_naroznej,
        wysokosc_przod_mm: wysokosc_przod_mm,
        wysokosc_tyl_mm: wysokosc_tyl_mm,
        wysokosc_lewy_mm: wysokosc_lewy_mm,
        wysokosc_prawy_mm: wysokosc_prawy_mm,
        typ_korpusu: cabinetType,
        offsets,
        rules,
        baseRules,
        thicknessLookup
    };

    const tree = rules.model_tree || {};
    const rootKey = Object.keys(tree)[0];
    const subcomps = tree[rootKey]?.subcomponents || {};
    const parts: CabinetGeometryPart[] = [];
    const isSingleZone = zoneLayout.length === 1 && zoneLayout[0].zoneKey === "SEKCJA_B";
    const initialPrefix = isSingleZone ? "B_" : "";
    const initialZoneId = isSingleZone ? "SEKCJA_B" : "";

    buildCabinetSubcomponents(subcomps, parts, ctx, zoneLayout, initialPrefix, initialZoneId);
    return parts;
}
