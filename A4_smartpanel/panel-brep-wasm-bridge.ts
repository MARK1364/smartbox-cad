/**
 * A4_smartpanel/panel-brep-wasm-bridge.ts
 *
 * Mostek WASM łączący NativePanelBuilder z natywnym silnikiem B-Rep w Rust (panel_brep).
 */

import initWasm, { build_panel_mesh, build_panel_brep, build_alu_frame_mesh } from '../src/wasm/panel_brep/panel_brep.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { discretizePolygonWithFillets } from '../A1_core/cad-math/arc2d.js';
import { isCylindricalPart } from '../A1_core/cad-node/part-shape.js';
import { AluFrameManager } from './alu-frame-manager.js';
import { hasEdgeCutConfig, readEdgeCutConfig } from './native_core/edge-bevel.js';
import { normalizeFaceName } from './panel-model.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<boolean> | null = null;

// Kernel obsługuje prostokątne formatki z cechami na licach Z. Dla reszty
// modeli mostek zwraca `null`, a NativePanelBuilder używa silnika TS.
export let USE_WASM_BREP = true;

export function setUseWasmBrep(enabled: boolean): void {
    USE_WASM_BREP = enabled;
}

export async function ensurePanelBrepWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                // W środowisku Node / Vitest: ładujemy z bufora
                if (typeof window === 'undefined') {
                    const fs = await import('node:fs');
                    const path = await import('node:path');
                    const wasmPath = path.resolve(process.cwd(), 'src', 'wasm', 'panel_brep', 'panel_brep_bg.wasm');
                    if (fs.existsSync(wasmPath)) {
                        const buffer = fs.readFileSync(wasmPath);
                        await initWasm(buffer);
                        _wasmInitialized = true;
                        return true;
                    }
                }
                // W przeglądarce: standardowy fetch
                await initWasm();
                _wasmInitialized = true;
                return true;
            } catch (err) {
                console.warn('[PanelBrepWasmBridge] Inicjalizacja WASM nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
                return false;
            }
        })();
    }
    return _wasmInitPromise;
}

export function isPanelBrepWasmReady(): boolean {
    return _wasmInitialized;
}

const SUPPORTED_FEATURE_TYPES = new Set(['hole', 'groove', 'pocket', 'cutout']);
const SUPPORTED_FACES = new Set(['FACE_Z_PLUS', 'FACE_Z_MINUS']);

function hasCustomOutline(model: any): boolean {
    const cp = model?.custom_properties || model?.customProperties || {};
    const outline = cp.outline2d;
    const outlineNm = cp.outline2d_nm;
    return (Array.isArray(outline) && outline.length >= 3)
        || (Array.isArray(outlineNm) && outlineNm.length >= 3);
}

function isAluFrameModel(model: any): boolean {
    return model?.panelForm === 'ALU_FRAME' || (typeof model?.isAluFrame === 'function' && model.isAluFrame());
}

function isProfiledAluFrameModel(model: any): boolean {
    if (!isAluFrameModel(model)) return false;
    const cp = model.custom_properties || model.customProperties || {};
    const tpl = AluFrameManager.instance.getTemplate(model.frameTemplateId);
    const filletMm = Number(model.fillet_mm || cp.fillet_mm || (tpl?.profile as any)?.fillet_mm) || 0;
    return filletMm > 0.05 || model.frameType === 'PROFILE' || cp.frame_type === 'PROFILE';
}

/**
 * Sprawdza czy model mieści się w zakresie kernela B-Rep w Rust (panel_brep).
 * Jeśli nie, zwraca powód (np. wałek, cechy na bokach).
 */
export function checkPanelBrepSupport(model: any): { supported: boolean; reason?: string } {
    if (!model) return { supported: false, reason: 'Brak obiektu modelu' };
    if (isAluFrameModel(model)) {
        const hasFeatures = Array.isArray(model.features) && model.features.length > 0;
        if (hasFeatures) {
            return { supported: false, reason: 'Ramka aluminiowa z otworami (puszka zawiasu)' };
        }
        return { supported: true };
    }
    if (model.role === 'DRILLING_PATTERN') return { supported: false, reason: 'Rola DRILLING_PATTERN (szablon nawierceń)' };
    if (isCylindricalPart(model)) return { supported: false, reason: 'Element cylindryczny (drążek/rura)' };

    const cp = model.custom_properties || model.customProperties || {};
    if (cp.backGrooveTrapezoid) return { supported: false, reason: 'Trapezoidalny wpust pleców' };
    if (hasEdgeCutConfig(readEdgeCutConfig(model.edgeBanding || cp.edge_banding))) {
        return { supported: false, reason: 'Fazowanie krawędzi (edge cut / bevel)' };
    }

    const hasOutline = Boolean(extractOutlineMm(model));
    const features = Array.isArray(model.features) ? model.features : [];
    for (const f of features) {
        if (!SUPPORTED_FEATURE_TYPES.has(String(f?.type || ''))) {
            return { supported: false, reason: `Nieobsługiwany typ cechy: ${f?.type}` };
        }
        const face = normalizeFaceName(f?.face || f?.side || 'FACE_Z_PLUS');
        const isSideFace = face === 'FACE_X_PLUS' || face === 'FACE_X_MINUS' || face === 'FACE_Y_PLUS' || face === 'FACE_Y_MINUS';
        if (!SUPPORTED_FACES.has(face)) {
            if (!(f.type === 'hole' && isSideFace && !hasOutline)) {
                return { supported: false, reason: `Cecha na ścianie bocznej (${face}) — WASM obsługuje lica Z oraz otwory boczne` };
            }
        }
        const p = f?.params || {};
        if (f.type === 'hole' && !(Number(p.diameter) > 0)) {
            return { supported: false, reason: `Otwór o nieprawidłowej średnicy (${p.diameter})` };
        }
    }
    return { supported: true };
}

/**
 * Czy model mieści się w zakresie prostokątnego kernela 2.5D.
 * Wszystko inne (ALU, kształtowe obrysy, fazowania, wałki, cechy na bokach)
 * musi zostać obsłużone przez dotychczasowy silnik TS.
 */
export function isModelSupportedByPanelBrep(model: any): boolean {
    return checkPanelBrepSupport(model).supported;
}

function extractOutlineMm(model: any): Array<[number, number]> | undefined {
    const cp = model?.custom_properties || model?.customProperties || {};
    const outlineNm = cp.outline2d_nm;
    if (Array.isArray(outlineNm) && outlineNm.length >= 3) {
        return outlineNm.map((p: any) => [nmToMm(Number(p[0])), nmToMm(Number(p[1]))]);
    }
    const outlineRaw = cp.outline2d;
    if (!Array.isArray(outlineRaw) || outlineRaw.length < 3) return undefined;

    const filletMm = Number(cp.fillet_mm) || 0;
    const hasFillets = filletMm > 0.05 || outlineRaw.some(
        (p: any) => typeof p === 'object' && !Array.isArray(p) && (Number(p?.fillet_mm) || 0) > 0.05
    );
    if (hasFillets) {
        return discretizePolygonWithFillets(outlineRaw, filletMm);
    }
    return outlineRaw.map((p: any) => Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [Number(p.u), Number(p.v)]);
}

function buildPanelBrepInput(model: any): Record<string, any> | null {
    const rawW = model.width ?? model.length ?? model.dim?.x ?? model.dim_nm?.x;
    const rawH = model.height ?? model.depth ?? model.dim?.y ?? model.dim_nm?.y;
    const rawT = model.thickness ?? model.dim?.z ?? model.dim_nm?.z;
    if (!rawW || !rawH || !rawT) return null;

    const features = (model.features || []).map((f: any) => {
        const p = f.params || {};
        const faceName = normalizeFaceName(f.face || f.side || 'FACE_Z_PLUS');
        const isThrough = Boolean(p.through || f.type === 'cutout' || p.kind === 'THROUGH');
        const depth = isThrough ? nmToMm(rawT) : Math.abs(Number(p.depth) || 0);

        const rawPoly = p.polygon || p.outline2d || p.points;
        const polygon = Array.isArray(rawPoly) && rawPoly.length >= 3
            ? rawPoly.map((pt: any) => Array.isArray(pt) ? [Number(pt[0]), Number(pt[1])] : [Number(pt.u ?? pt.x ?? 0), Number(pt.v ?? pt.y ?? 0)])
            : undefined;

        return {
            id: String(f.id || f.type || 'feat'),
            type: String(f.type || 'pocket'),
            face: faceName,
            u_mm: p.u !== undefined ? Number(p.u) : (p.x !== undefined ? Number(p.x) : 0),
            v_mm: p.v !== undefined ? Number(p.v) : (p.y !== undefined ? Number(p.y) : 0),
            w_mm: p.width !== undefined ? Number(p.width) : (p.w !== undefined ? Number(p.w) : undefined),
            l_mm: p.length !== undefined ? Number(p.length) : (p.l !== undefined ? Number(p.l) : undefined),
            depth_mm: depth,
            diameter_mm: p.diameter !== undefined ? Number(p.diameter) : undefined,
            through: isThrough,
            template_id: p.template_id,
            spacing_mm: p.spacing !== undefined ? Number(p.spacing) : undefined,
            count: p.count !== undefined ? Number(p.count) : undefined,
            ...(polygon ? { polygon } : {})
        };
    });

    const outline2d = extractOutlineMm(model);
    return {
        width_nm: Math.round(Number(rawW)),
        height_nm: Math.round(Number(rawH)),
        thickness_nm: Math.round(Number(rawT)),
        features,
        ...(outline2d ? { outline2d } : {})
    };
}

/**
 * Wywołuje binarne jądro B-Rep w Rust dla zadanego modelu formatki.
 * Zwraca wynik w postaci dokładnie takiego słownika, jakiego oczekuje NativePanelBuilder.
 */
export function callPanelBrepWasm(model: any): Record<string, any> | null {
    if (!_wasmInitialized) return null;
    if (!isModelSupportedByPanelBrep(model)) return null;

    try {
        if (isAluFrameModel(model)) {
            const rawW = model.width ?? model.length ?? model.dim?.x ?? model.dim_nm?.x;
            const rawH = model.height ?? model.depth ?? model.dim?.y ?? model.dim_nm?.y;
            const rawT = model.thickness ?? model.dim?.z ?? model.dim_nm?.z;
            if (!rawW || !rawH || !rawT) return null;

            const w = nmToMm(Number(rawW));
            const h = nmToMm(Number(rawH));
            const thicknessMm = nmToMm(Number(rawT));
            const tpl = AluFrameManager.instance.getTemplate(model.frameTemplateId);
            const p = tpl.profile;
            const g = tpl.glass;
            const cp = model.custom_properties || model.customProperties || {};
            const filletMm = Number(model.fillet_mm || cp.fillet_mm || (p as any).fillet_mm) || 0;
            const innerFilletRaw = Number(model.inner_fillet_mm ?? cp.inner_fillet_mm);

            const aluInput = {
                w_mm: w,
                h_mm: h,
                t_mm: Math.max(5, p.depth_mm || thicknessMm),
                pw_mm: Math.max(5, p.width_mm || 20),
                glass_t_mm: g.thickness_mm ?? 4,
                lip_depth_mm: p.lip_depth_mm ?? 6,
                clearance_mm: g.clearance_mm ?? 1.5,
                fillet_mm: filletMm > 0 ? filletMm : undefined,
                inner_fillet_mm: Number.isFinite(innerFilletRaw) ? innerFilletRaw : undefined,
                frame_type: model.frameType || cp.frame_type || undefined
            };
            const result: any = build_alu_frame_mesh(aluInput);
            return result || null;
        }

        const input = buildPanelBrepInput(model);
        if (!input) return null;
        const result: any = build_panel_mesh(input);
        return result || null;
    } catch (e) {
        console.warn('[PanelBrepWasmBridge] Błąd w trakcie wywołania WASM B-Rep:', e);
        return null;
    }
}

/**
 * Zwraca diagnostykę B-Rep (podsumowanie topologii: manifoldness, watertight, objętość).
 */
export function callPanelBrepDiagnostics(model: any): any | null {
    if (!_wasmInitialized) return null;
    if (!isModelSupportedByPanelBrep(model)) return null;

    try {
        const input = buildPanelBrepInput(model);
        if (!input) return null;
        const result: any = build_panel_brep(input);
        return result || null;
    } catch (e) {
        console.warn('[PanelBrepWasmBridge] Błąd w trakcie wywołania build_panel_brep:', e);
        return null;
    }
}

