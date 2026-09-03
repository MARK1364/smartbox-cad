/**
 * A2_smartbox — SmartBox Adapter
 * 
 * Odpowiada za obliczanie płaszczyzn odniesienia (side_references) korpusu
 * oraz pozycjonowanie i przebudowę kontenera SmartBox w czasie rzeczywistym.
 * 
 * ============================================================================
 * REFERENCE PYTHON CODE FOR ALIGNMENT:
 * ============================================================================
 * 
 * def ensure_smartbox_name(obj):
 *     if obj and obj.get("is_smartbox") and not obj.name.endswith("_SB"):
 *         obj.name = f"{obj.name.split('.')[0]}_SB"
 * 
 * def update_smartbox_core(obj, depsgraph):
 *     if obj.get("_smartbox_internal_update"): return False
 *     sb = obj.smartbox
 *     parent = obj.parent
 *     if parent:
 *         stable_R = parent.matrix_world.to_3x3()
 *     else:
 *         stable_R = obj.matrix_world.to_3x3()
 *     axis_dirs = [
 *         stable_R.col[0].normalized(),
 *         stable_R.col[1].normalized(),
 *         stable_R.col[2].normalized()
 *     ]
 *     updated = False
 *     has_refs = (sb.x.min_obj or sb.x.max_obj or 
 *                 sb.y.min_obj or sb.y.max_obj or 
 *                 sb.z.min_obj or sb.z.max_obj)
 *     if not has_refs: return False
 *     size = Vector(obj.dimensions)
 *     world_center = obj.matrix_world.translation.copy()
 *     centers_scalar = [world_center.dot(axis_dirs[i]) for i in range(3)]
 *     final_mins = [centers_scalar[i] - size[i]/2 for i in range(3)]
 *     final_maxs = [centers_scalar[i] + size[i]/2 for i in range(3)]
 * 
 *     for axis_idx, axis_name in enumerate(['x', 'y', 'z']):
 *         sb_axis = getattr(sb, axis_name)
 *         z_state = get_z_state(sb_axis) if axis_name == 'z' else 'both'
 *         pmin_target = face_center_world(sb_axis.min_obj, sb_axis.min_face_id, depsgraph)
 *         pmax_target = face_center_world(sb_axis.max_obj, sb_axis.max_face_id, depsgraph)
 *         if pmin_target:
 *             val_min = pmin_target.dot(axis_dir) + sb_axis.offset_min
 *         else:
 *             val_min = None
 *         if pmax_target:
 *             val_max = pmax_target.dot(axis_dir) - sb_axis.offset_max
 *         else:
 *             val_max = None
 *         if axis_name == 'z' and z_state == 'min_only' and sb.max_height > 0:
 *             ... (max_height constraints)
 * 
 */

import { applyPlanToContainer } from '../A3_smartframe/smartframe-adapter.js';
import type { ModuleDims } from './base-engine.js';
import { buildShelvesPlan } from './shelves-adapter.js';
import { buildShelfPlan } from './shelf-adapter.js';
import { buildDoorsPlan } from './doors-adapter.js';
import { buildTubesPlan } from './tubes-adapter.js';
import { buildDrawersPlan } from './drawers-adapter.js';
import { buildDividersPlan } from './dividers-adapter.js';
import { buildPanelsPlan } from './panels-adapter.js';
import { buildFlapsPlan } from './flaps-adapter.js';
import korpusRules from '../A3_smartframe/korpus3_3_rules.json';
import smartframeContract from '../A3_smartframe/reference_contract_smartframe.json';
import { ContextManager } from '../A1_core/context-manager.js';
import { nmToMm, mmToNm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { cadMatrixToRenderMatrix } from '../A1_core/cad-math/coord-system.js';
import { normalizeFaceName } from '../A4_smartpanel/panel-model.js';
import { SyncShelfDrillingsCommand } from '../A1_core/commands/sync-shelf-drillings-command.js';
import { SyncDoorDrillingsCommand } from '../A1_core/commands/sync-door-drillings-command.js';
import { SyncDrawerDrillingsCommand } from '../A1_core/commands/sync-drawer-drillings-command.js';
import { SyncFlapsDrillingsCommand } from '../A1_core/commands/sync-flaps-drillings-command.js';
import { ClearSmartBoxDrillingsCommand } from '../A1_core/commands/clear-smartbox-drillings-command.js';

/**
 * Upewnia się, że nazwa kontenera SmartBox kończy się przyrostkiem _SB,
 * dokładnie tak jak funkcja ensure_smartbox_name(obj) w Pythonie.
 */
export function ensure_smartbox_name(container: any) {
    if (!container || !container.generatorParams) return;
    
    // Mapowanie typów generatora na oczekiwane nazwy modułów (zgodnie z Python)
    const typeToName: Record<string, string> = {
        'smartbox_empty': 'SmartBox',
        'smartbox_shelves': 'Polki',
        'smartbox_drawers': 'Drawers',
        'smartbox_doors': 'Drzwi',
        'smartbox_dividers': 'Przegrody',
        'smartbox_flaps': 'Klapy',
        'smartbox_tubes': 'Rurka',
        'smartbox_shelf': 'Wieniec',
        'smartbox_panels': 'Blendy'
    };

    const type = container.generatorParams.type;
    const baseName = typeToName[type] || 'SmartBox';

    if (!container.name.endsWith("_SB")) {
        container.name = baseName + "_SB";
    } else {
        // Jeśli ma już końcówkę _SB, ale np. zmieniono typ modułu
        const currentBase = container.name.split('_SB')[0];
        if (currentBase !== baseName && currentBase !== 'SmartBox') {
            container.name = baseName + "_SB";
        }
    }
}

/**
 * Oblicza 6 płaszczyzn strefy korpusu (xMin, xMax, yMin, yMax, zMin, zMax)
 * w układzie lokalnym szafki (origin dolny-środek szafki).
 */
export function resolveZoneReferences(cabinet: any, zonePrefixRaw: string, space: 'INNER' | 'OUTER' = 'INNER') {
    const W = nmToMm(cabinet.width);
    const H = nmToMm(cabinet.height);
    const D = nmToMm(cabinet.depth);

    const params = cabinet.generatorParams || {};
    const offsets = params.offsets || {};
    const zoneCount = params.zoneCount || 1;
    const bottomH = params.bottomHeight || 500;
    const middleH = params.middleHeight || 1200;
    const backOffset = params.backOffset || 0;

    // 1. Obliczamy wysokość i pozycję bazową Z (wysokość w silniku) wybranej strefy
    const rawZone = (zonePrefixRaw || '').toUpperCase();
    let zonePrefix = 'B';
    let zBase = 0;
    let size = H;

    if (rawZone === 'FULL' || rawZone === 'ALL' || zoneCount === 1) {
        zonePrefix = 'B';
        zBase = 0;
        size = H;
    } else if (rawZone === 'T' || rawZone === 'C' || rawZone === 'TOP') {
        zonePrefix = 'T';
        if (zoneCount === 3) {
            zBase = bottomH + middleH;
            size = Math.max(10, H - bottomH - middleH);
        } else {
            zBase = bottomH;
            size = Math.max(10, H - bottomH);
        }
    } else if (rawZone === 'M' || rawZone === 'MID' || rawZone === 'MIDDLE') {
        zonePrefix = 'M';
        if (zoneCount === 3) {
            zBase = bottomH;
            size = middleH;
        } else {
            zBase = bottomH;
            size = Math.max(10, H - bottomH);
        }
    } else if (rawZone === 'B' || rawZone === 'A' || rawZone === 'BOTTOM') {
        zonePrefix = 'B';
        zBase = 0;
        size = bottomH;
    } else {
        // Fallback
        zonePrefix = 'B';
        zBase = 0;
        size = H;
    }

    // 3. Obliczenie domyślnych współrzędnych przestrzeni (granice kontenera)
    let xMin = -W / 2;
    let xMax = W / 2;
    let yMin = -D / 2;
    let yMax = D / 2;
    let zMin = zBase;
    let zMax = zBase + size;

    // 4. Nadpisanie z dynamicznych reguł JSON (Dziedziczenie: Baza -> Korpus)
    const innerRefs = {
        ...(smartframeContract as any).side_references,
        ...(korpusRules as any).side_references
    };
    const outerRefs = {
        ...(smartframeContract as any).side_references_outer,
        ...(korpusRules as any).side_references_outer
    };

    const overrideFromJSON = (axis: 'x'|'y'|'z', isMin: boolean, fallback: number) => {
        const sideStr = isMin ? 'MIN' : 'MAX';
        let prefixToUse = zonePrefix;

        if (rawZone === 'FULL' || rawZone === 'ALL') {
            if (axis === 'z' && !isMin) {
                if (zoneCount >= 2) prefixToUse = 'T';
                else prefixToUse = 'B';
            }
        }

        let ref: any;
        if (space === 'OUTER') {
            // Blendy: tylko globalne OUTER, bez referencji strefowych INNER.
            ref = outerRefs[`side.${axis.toUpperCase()}_${sideStr}_OUTER`];
        } else {
            const zoneKey = `${prefixToUse}_side.${axis.toUpperCase()}_${sideStr}_INNER`;
            const baseKey = `side.${axis.toUpperCase()}_${sideStr}_INNER`;
            ref = innerRefs[zoneKey] || innerRefs[baseKey];
        }
        
        if (ref && ref.provenance) {
            if (ref.provenance.source_type === 'symbolic') {
                return fallback;
            }
            const val = getCoordinateByProvenance(cabinet, ref.provenance, axis, isMin, prefixToUse);
            if (val !== null) {
                return val;
            }
        }
        
        console.warn(`[SmartBox] Brak poprawnej referencji LCS JSON dla osi ${axis} (${sideStr}). Użyto wymiaru granicznego szafki.`);
        return fallback;
    };

    xMin = overrideFromJSON('x', true, xMin);
    xMax = overrideFromJSON('x', false, xMax);
    yMin = overrideFromJSON('y', true, yMin);
    yMax = overrideFromJSON('y', false, yMax);
    zMin = overrideFromJSON('z', true, zMin);
    zMax = overrideFromJSON('z', false, zMax);

    return { xMin, xMax, yMin, yMax, zMin, zMax };
}

function getCoordinateByProvenance(cabinet: any, prov: any, axis: 'x' | 'y' | 'z', isMin: boolean, zonePrefix: string): number | null {
    if (prov.source_type !== 'component' || !prov.part_key) return null;
    
    const doc = ContextManager.instance.document;
    const cabinetNode = doc?.findNode(cabinet.id);
    if (!cabinetNode) return null;

    const rawKey = prov.part_key;
    // Wyciągnij klucz bazowy bez prefiksu strefy (np. "B_WIENIEC_D" -> "WIENIEC_D", "WIENIEC_D" -> "WIENIEC_D")
    const baseKey = rawKey.replace(/^[A-Z]_/, '');
    // Docelowy klucz z prefiksem strefy (np. "B_WIENIEC_D")
    const targetKey = `${zonePrefix}_${baseKey}`;
    const fallbackKey = rawKey;

    // Słownik ról dla robustnego dopasowania
    const roleMap: Record<string, string> = {
        "BOK_L": "LEFT_SIDE_PANEL",
        "BOK_P": "RIGHT_SIDE_PANEL",
        "PLECY": "BACK_PANEL",
        "WIENIEC_D": "BOTTOM_PANEL",
        "WIENIEC_G": "TOP_PANEL"
    };
    const targetRole = roleMap[baseKey] || roleMap[rawKey];

    // Rekurencyjne wyszukiwanie fizycznej płyty wygenerowanej w scenie 3D (obsługa pod-złożeń np. SEKCJA_M)
    let panel: any = null;
    let panelNode: any = null;

    const findNodeRecursive = (node: any) => {
        if (!node) return;
        const p = node.domainData;
        if (p && (
            (p as any).key === targetKey || p.name === targetKey ||
            (p as any).key === fallbackKey || p.name === fallbackKey ||
            (p as any).key === baseKey || p.name === baseKey ||
            (targetRole && p.role === targetRole)
        )) {
            // Preferuj dokładne dopasowanie z prefiksem
            if (!panel || (p as any).key === targetKey || p.name === targetKey) {
                panel = p;
                panelNode = node;
            }
        }
        if (node.children) {
            for (const child of node.children) {
                findNodeRecursive(child);
            }
        }
    };
    findNodeRecursive(cabinetNode);

    if (!panel || !panelNode) return null;

    const surface = prov.surface || 'INNER';
    let faceName = '';
    let lcs: any = null;
    
    if (korpusRules && (korpusRules as any).model_tree) {
        const findLCS = (obj: any): any => {
            for (let key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    if (
                        key === targetKey || obj[key].role === targetKey ||
                        key === fallbackKey || obj[key].role === fallbackKey ||
                        key === baseKey || obj[key].role === baseKey ||
                        (targetRole && obj[key].role === targetRole)
                    ) {
                        if (obj[key].lcs) return obj[key].lcs;
                    }
                    const res = findLCS(obj[key]);
                    if (res) return res;
                }
            }
            return null;
        };
        lcs = findLCS((korpusRules as any).model_tree);
    }

    if (surface === 'INNER' || surface === 'OUTER') {
        if (lcs && lcs.faces && lcs.faces[surface]) {
            faceName = lcs.faces[surface];
        } else {
            // Złota Zasada LCS: INNER to zawsze FACE_Z_PLUS, OUTER to FACE_Z_MINUS
            faceName = surface === 'INNER' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS';
        }
    } else {
        faceName = surface;
    }
    
    // Węzły CAD (CADNode) i ich macierze używają natywnego, matematycznego układu XYZ (Z to wysokość).
    // Dlatego nie wykonujemy tutaj żadnego mapowania osi dla silnika Babylon!
    return getPanelFaceCoordinate(panel, panelNode, cabinetNode, faceName, axis, lcs, isMin, surface);
}

function getPanelFaceCoordinate(panel: any, panelNode: any, cabinetNode: any, faceName: string, axis: 'x' | 'y' | 'z', lcs: any = null, isMin?: boolean, surface?: string): number {
    let pw = panel.width || 0;
    let ph = panel.height || 0;
    let pt = panel.thickness || 0;
    
    let sizeX = nmToMm(pw);
    let sizeY = nmToMm(ph);
    let sizeZ = nmToMm(pt);

    // 1. Ustal kanoniczną nazwę ściany na podstawie reguł JSON (lcs.faces)
    let canonicalFace = '';
    if (surface && (surface === 'INNER' || surface === 'OUTER')) {
        if (lcs && lcs.faces && lcs.faces[surface]) {
            canonicalFace = normalizeFaceName(lcs.faces[surface]);
        } else {
            canonicalFace = surface === 'INNER' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS';
        }
    } else if (faceName) {
        canonicalFace = normalizeFaceName(faceName);
    } else {
        canonicalFace = 'FACE_Z_PLUS';
    }

    // 2. Akumulacja macierzy transformacji panelu w szafie (CADNode localMatrix)
    let absoluteMat = panelNode.localMatrix.clone();
    let currentParent = panelNode.parent;
    while (currentParent && currentParent !== cabinetNode && currentParent.domainData?.type !== 'container') {
        absoluteMat = currentParent.localMatrix.multiply(absoluteMat);
        currentParent = currentParent.parent;
    }

    // 3. Pobierz środek ściany w lokalnym układzie LCS formatki
    // Złota Zasada LCS: Oś Z to ZAWSZE grubość materiału (od -thickness/2 do +thickness/2)
    let localPoint = new Vec3(0, 0, 0);
    if (canonicalFace === 'FACE_Z_PLUS') {
        localPoint = new Vec3(0, 0, sizeZ / 2);
    } else if (canonicalFace === 'FACE_Z_MINUS') {
        localPoint = new Vec3(0, 0, -sizeZ / 2);
    } else if (canonicalFace === 'FACE_X_PLUS') {
        localPoint = new Vec3(sizeX / 2, 0, 0);
    } else if (canonicalFace === 'FACE_X_MINUS') {
        localPoint = new Vec3(-sizeX / 2, 0, 0);
    } else if (canonicalFace === 'FACE_Y_PLUS') {
        localPoint = new Vec3(0, sizeY / 2, 0);
    } else if (canonicalFace === 'FACE_Y_MINUS') {
        localPoint = new Vec3(0, -sizeY / 2, 0);
    }

    // 4. Przelicz punkt przez macierz renderu w przestrzeni 3D
    const localPointNm = new Vec3(mmToNm(localPoint.x), mmToNm(localPoint.y), mmToNm(localPoint.z));
    const renderMat = cadMatrixToRenderMatrix(absoluteMat);
    const worldPointRender = renderMat.transformPoint(localPointNm);

    // Przeliczenie osi z nm na mm:
    // Render (Babylon: X=szerokość, Y=wysokość, Z=głębokość)
    // CAD    (CADNode: X=szerokość, Y=głębokość, Z=wysokość)
    if (axis === 'x') {
        return nmToMm(worldPointRender.x);
    } else if (axis === 'y') {
        return nmToMm(worldPointRender.z); // Render Z to CAD Y (głębokość szafy)
    } else {
        return nmToMm(worldPointRender.y); // Render Y to CAD Z (wysokość szafy)
    }
}

/**
 * Weryfikuje, czy wskazana ściana formatki posiada orientację wektora normalnego
 * zgodną z osią oczekiwaną przez dany slot referencji.
 * 
 * - xMin / xMax (Bok Lewy / Bok Prawy) -> oczekuje płaszczyzny w osi X mebla (|Nx| > 0.7)
 * - yMin / yMax (Przód / Tył)          -> oczekuje płaszczyzny w osi Y mebla (głębokość) (|Ny| > 0.7)
 * - zMin / zMax (Dół / Góra)           -> oczekuje płaszczyzny w osi Z mebla (wysokość) (|Nz| > 0.7)
 */
export function validateReferenceFaceOrientation(
    panel: any,
    panelNode: any,
    cabinetNode: any,
    faceName: string,
    sideKey: string
): { valid: boolean; errorMsg?: string; dominantAxis?: 'x' | 'y' | 'z' } {
    if (!panel || !faceName || !sideKey) {
        return { valid: true };
    }

    const canonicalFace = normalizeFaceName(faceName);

    // 1. Wektor normalny w lokalnym LCS formatki (Złota zasada: Z to ZAWSZE grubość formatki)
    let nxLocal = 0;
    let nyLocal = 0;
    let nzLocal = 1;

    if (canonicalFace === 'FACE_Z_PLUS') {
        nzLocal = 1;
    } else if (canonicalFace === 'FACE_Z_MINUS') {
        nzLocal = -1;
    } else if (canonicalFace === 'FACE_X_PLUS') {
        nxLocal = 1; nzLocal = 0;
    } else if (canonicalFace === 'FACE_X_MINUS') {
        nxLocal = -1; nzLocal = 0;
    } else if (canonicalFace === 'FACE_Y_PLUS') {
        nyLocal = 1; nzLocal = 0;
    } else if (canonicalFace === 'FACE_Y_MINUS') {
        nyLocal = -1; nzLocal = 0;
    }

    // 2. Pobierz widok PanelView i przelicz wektor normalny przez macierz świata Babylon
    const view = ContextManager.instance.panelViews.get(panel);
    let worldNx = 0;
    let worldNy = 0;
    let worldNz = 0;

    if (view && view.root && (window as any).BABYLON) {
        const BAB = (window as any).BABYLON;
        const localVec = new BAB.Vector3(nxLocal, nyLocal, nzLocal);
        view.root.computeWorldMatrix(true);
        const worldVec = BAB.Vector3.TransformNormal(localVec, view.root.getWorldMatrix()).normalize();
        worldNx = Math.abs(worldVec.x); // X w Babylon = szerokość mebla (Bok Lewy / Prawy)
        worldNy = Math.abs(worldVec.y); // Y w Babylon = wysokość mebla (Dół / Góra)
        worldNz = Math.abs(worldVec.z); // Z w Babylon = głębokość mebla (Przód / Tył)
    } else if (panelNode) {
        let absoluteMat = panelNode.localMatrix.clone();
        let currentParent = panelNode.parent;
        while (currentParent && currentParent !== cabinetNode && currentParent.domainData?.type !== 'container') {
            absoluteMat = currentParent.localMatrix.multiply(absoluteMat);
            currentParent = currentParent.parent;
        }
        const renderMat = cadMatrixToRenderMatrix(absoluteMat);
        const localVec = new Vec3(nxLocal, nyLocal, nzLocal);
        const worldVec = renderMat.transformDirection(localVec).normalize();
        worldNx = Math.abs(worldVec.x);
        worldNy = Math.abs(worldVec.y);
        worldNz = Math.abs(worldVec.z);
    } else {
        return { valid: true };
    }

    // 3. Sprawdź dominującą oś w przestrzeni mebla
    let dominantAxis: 'x' | 'y' | 'z' = 'x';
    if (worldNz >= worldNx && worldNz >= worldNy) dominantAxis = 'y'; // głębokość (Przód/Tył)
    else if (worldNy >= worldNx && worldNy >= worldNz) dominantAxis = 'z'; // wysokość (Dół/Góra)
    else dominantAxis = 'x'; // szerokość (Bok Lewy/Prawy)

    const axisNames: Record<'x' | 'y' | 'z', string> = {
        x: 'szerokości X (Bok Lewy / Bok Prawy)',
        y: 'głębokości Y (Przód / Tył)',
        z: 'wysokości Z (Dół / Góra)'
    };

    let expectedAxis: 'x' | 'y' | 'z' = 'x';
    if (sideKey === 'xMin' || sideKey === 'xMax') expectedAxis = 'x';
    else if (sideKey === 'yMin' || sideKey === 'yMax') expectedAxis = 'y';
    else if (sideKey === 'zMin' || sideKey === 'zMax') expectedAxis = 'z';

    if (dominantAxis !== expectedAxis) {
        return {
            valid: false,
            dominantAxis,
            errorMsg: `Nieprawidłowa orientacja ściany! Wskazano ścianę w osi ${axisNames[dominantAxis]}, a ta referencja wymaga ściany w osi ${axisNames[expectedAxis]}.`
        };
    }

    return { valid: true, dominantAxis };
}

/**
 * Przelicza pozycję, wymiary oraz generuje półki wewnątrz SmartBoxa.
 */
export function update_smartbox_core(container: any, docTarget: any): boolean {
    if (!container || !docTarget) return false;
    const doc = ContextManager.instance.document;
    if (!doc) return false;

    const params = container.generatorParams;
    if (!params) return false;

    // Pilnuj nazewnictwa z końcówką _SB (zgodnie z Blenderem)
    ensure_smartbox_name(container);

    // Znajdź nadrzędny korpus (SmartFrame)
    const cabinetId = params.parentContainerId;
    const containers = typeof doc.getContainers === 'function' ? doc.getContainers() : [];
    
    // Szukamy węzła CADNode, a następnie wyciągamy z niego ContainerModel
    let cabinetNode = containers.find((e: any) => e.domainData && (e.domainData as any).id === cabinetId);
    let cabinet: any = cabinetNode ? cabinetNode.domainData : null;

    if (!cabinet) {
        // Fallback: weź pierwszy lepszy korpus w scenie
        cabinetNode = containers.find((e: any) => (e.domainData && (e.domainData.generatorParams?.type === 'korpus3_2' || e.domainData.generatorParams?.type === 'korpus3_1')));
        cabinet = cabinetNode ? cabinetNode.domainData : null;
        
        if (!cabinet) {
            cabinetNode = containers.find((e: any) => e.domainData && e.domainData.type === 'container');
            cabinet = cabinetNode ? cabinetNode.domainData : null;
        }
        
        if (!cabinet) {
            console.warn('[SmartBoxAdapter] Brak aktywnego korpusu SmartFrame w scenie.');
            return false;
        }
        params.parentContainerId = cabinet.id;
    }

    const zonePrefix = params.targetZone || 'B';
    const typeToBox: Record<string, string> = {
        smartbox_doors: 'DOORS',
        smartbox_shelf: 'SHELF',
        smartbox_tubes: 'TUBES',
        smartbox_drawers: 'DRAWERS',
        smartbox_dividers: 'DIVIDERS',
        smartbox_panels: 'PANELS',
        smartbox_flaps: 'FLAPS',
        smartbox_empty: 'EMPTY',
        smartbox_shelves: 'SHELVES'
    };
    const boxType = params.boxType || typeToBox[params.type] || 'SHELVES';

    // 1. Wylicz domyślne granice przestrzeni z referencji korpusu.
    // Blendy to jedyny moduł OUTER — otula cały SmartFrame od zewnątrz (nie wnętrze strefy).
    const useOuter = boxType === 'PANELS';
    const refs = resolveZoneReferences(cabinet, useOuter ? 'FULL' : zonePrefix, useOuter ? 'OUTER' : 'INNER');

    // 2. Pobierz ręczne referencje i offsety z parametrów
    const customRefs = params.customReferences || {};
    const offsets = params.offsets || {};

    const resolveRef = (sideKey: string, defaultVal: number, axis: 'x' | 'y' | 'z', isMax: boolean) => {
        const offsetVal = parseFloat(offsets[sideKey]) || 0;

        // Jeśli wybrano 'FULL' dla osi Z, używamy bezwzględnych wyliczonych granic wieńca dolnego (18mm) i górnego (2182mm)
        if ((sideKey === 'zMin' || sideKey === 'zMax') && (useOuter || params.targetZone === 'FULL' || params.targetZone === 'ALL')) {
            return isMax ? (defaultVal - offsetVal) : (defaultVal + offsetVal);
        }

        const refConfig = customRefs[sideKey];
        let baseVal = defaultVal;
        
        if (refConfig && refConfig.partKey && refConfig.face) {
            const doc = ContextManager.instance.document;
            const cabinetNode = doc?.findNode(cabinet.id);
            if (cabinetNode) {
                // Rekurencyjne szukanie płyty w szafce (obsługa customowych referencji w zagnieżdżonych strefach)
                let panel: any = null;
                let panelNode: any = null;
                
                const findCustomNode = (node: any) => {
                    if (!node) return;
                    const p = node.domainData;
                    if (p && ((p as any).key === refConfig.partKey || p.name === refConfig.partKey || p.id === refConfig.partKey || (p as any).smartId?.uid === refConfig.partKey)) {
                        panel = p;
                        panelNode = node;
                    }
                    if (!panel && node.children) {
                        for (const child of node.children) {
                            findCustomNode(child);
                        }
                    }
                };
                findCustomNode(cabinetNode);
                
                if (panel && panelNode) {
                    baseVal = getPanelFaceCoordinate(panel, panelNode, cabinetNode, refConfig.face, axis);
                }
            }
        }
        
        return isMax ? (baseVal - offsetVal) : (baseVal + offsetVal);
    };

    const xMinVal = resolveRef('xMin', refs.xMin, 'x', false);
    const xMaxVal = resolveRef('xMax', refs.xMax, 'x', true);
    
    // Y w refs to głębokość (Y w CADNode)
    const yMinVal = resolveRef('yMin', refs.yMin, 'y', false);
    const yMaxVal = resolveRef('yMax', refs.yMax, 'y', true);
    
    // Z w refs to wysokość (Z w CADNode)
    let zMinVal = resolveRef('zMin', refs.zMin, 'z', false);
    let zMaxVal = resolveRef('zMax', refs.zMax, 'z', true);

    const disabledRefs = params.disabledReferences || {};
    const isZMinActive = !disabledRefs.zMin;
    const isZMaxActive = !disabledRefs.zMax;

    // Sztywny parametr wysokości H (maxHeight lub height)
    const heightH = parseFloat(params.maxHeight || params.height) || 0;

    let sbHeight = 0;

    if (isZMinActive && isZMaxActive) {
        // Obie referencje aktywne -> wysokość wyliczana jako odległość Góra - Dół (z uwzględnieniem offsetów)
        sbHeight = Math.max(10, zMaxVal - zMinVal);
    } else if (isZMinActive && !isZMaxActive) {
        // Dół aktywny, Góra skasowana -> wysokość H liczona OD DOŁU w górę!
        sbHeight = heightH > 0 ? heightH : Math.max(10, refs.zMax - zMinVal);
        zMaxVal = zMinVal + sbHeight;
    } else if (!isZMinActive && isZMaxActive) {
        // Góra aktywna, Dół skasowany -> wysokość H liczona OD GÓRY w dół!
        sbHeight = heightH > 0 ? heightH : Math.max(10, zMaxVal - refs.zMin);
        zMinVal = zMaxVal - sbHeight;
    } else {
        // Obie referencje skasowane -> fallback: spód na zMinVal, wysokość H w górę
        sbHeight = heightH > 0 ? heightH : Math.max(10, refs.zMax - refs.zMin);
        zMaxVal = zMinVal + sbHeight;
    }

    const sbWidth = Math.max(10, xMaxVal - xMinVal);
    const sbDepth = Math.max(10, yMaxVal - yMinVal);

    // 3. Zaktualizuj gabaryt kontenera SmartBox w modelu
    container.width = mmToNm(sbWidth);
    container.height = mmToNm(sbHeight);
    container.depth = mmToNm(sbDepth);

    // 4. Zaktualizuj pozycję świata kontenera SmartBox
    const foundCabinetNode = doc?.findNode(cabinet.id);
    const containerNode = doc?.findNode(container.id);

    if (foundCabinetNode && containerNode) {
        let sbPosX = (xMinVal + xMaxVal) / 2;
        let sbPosY = (yMinVal + yMaxVal) / 2; // Głębokość
        let sbPosZ = zMinVal; // Wysokość

        if (isNaN(sbPosY)) {
            const cabinetPos = foundCabinetNode.localMatrix.decompose().translation;
            const debugStr = `🚨 BŁĄD PARAMETRYKI (NaN) 🚨
yMinVal=${yMinVal}
yMaxVal=${yMaxVal}
cabinetPos.y=${nmToMm(cabinetPos.y)}
W=${cabinet.width}, D=${cabinet.depth}, H=${cabinet.height}
Skopiuj ten błąd i wyślij mi!`;
            console.error(debugStr);
            sbPosY = 0; // Wymuszony fallback by zapobiec crashowi
        }
        if (isNaN(sbPosX)) sbPosX = 0;
        if (isNaN(sbPosZ)) sbPosZ = 0;

        const { rotation, scale } = containerNode.localMatrix.decompose();
        containerNode.setLocalTransform(
            new Vec3(mmToNm(sbPosX), mmToNm(sbPosY), mmToNm(sbPosZ)),
            rotation,
            scale
        );
        

        
    }

    // 5. Uruchom moduł generujący wewnątrz tego gabarytu.
    // Mapowanie parametrów na wejście silnika mieszka w adapterze modułu
    // (1 moduł = X-adapter + X-engine + X_3_rules_V1.json).
    const dims: ModuleDims = { width: sbWidth, height: sbHeight, depth: sbDepth };
    let plan: { parts: any[] } = { parts: [] };
    if (boxType === 'SHELVES') {
        plan = buildShelvesPlan(params, dims);
    } else if (boxType === 'DOORS') {
        plan = buildDoorsPlan(params, dims);
    } else if (boxType === 'SHELF') {
        plan = buildShelfPlan(params, dims);
    } else if (boxType === 'TUBES') {
        plan = buildTubesPlan(params, dims);
    } else if (boxType === 'DRAWERS') {
        plan = buildDrawersPlan(params, dims);
    } else if (boxType === 'DIVIDERS') {
        plan = buildDividersPlan(params, dims);
    } else if (boxType === 'PANELS') {
        plan = buildPanelsPlan(params, dims);
    } else if (boxType === 'FLAPS') {
        plan = buildFlapsPlan(params, dims);
    }

    // 6. Zmaterializuj elementy jako dzieci kontenera SmartBox
    applyPlanToContainer(container, plan);

    // 7. Zsynchronizuj nawiercenia na formatkach korpusu.
    // Najpierw usuń wszystko, co ten SmartBox nawiercił wcześniej — po zmianie modułu
    // (np. DRZWI -> WIENIEC) sync poprzedniego modułu już nie wystartuje i bez tego
    // jego otwory zostałyby na boczkach.
    if (doc) {
        new ClearSmartBoxDrillingsCommand(container.id).execute(doc);

        if (boxType === 'SHELVES') {
            new SyncShelfDrillingsCommand(cabinet.id).execute(doc);
        } else if (boxType === 'DOORS') {
            new SyncDoorDrillingsCommand(cabinet.id).execute(doc);
        } else if (boxType === 'DRAWERS') {
            new SyncDrawerDrillingsCommand(cabinet.id).execute(doc);
        } else if (boxType === 'FLAPS') {
            new SyncFlapsDrillingsCommand(cabinet.id).execute(doc);
        }
    }

    return true;
}

export function getDefaultReferenceProvenance(boxOrCabinet: any, sideKey: string): { partKey: string, faceName: string, panelId?: string } | null {
    if (!boxOrCabinet) return null;
    const doc = ContextManager.instance.document;
    if (!doc) return null;

    let container = boxOrCabinet;
    let cabinetNode = doc.findNode(boxOrCabinet.id);
    if (cabinetNode && cabinetNode.parent && (cabinetNode.parent.domainData as any)?.type === 'container') {
        cabinetNode = cabinetNode.parent;
    } else if (!cabinetNode || (cabinetNode.domainData as any)?.generatorParams?.type?.startsWith('smartbox')) {
        const containers = (doc as any).getContainers ? (doc as any).getContainers() : [];
        const found = containers.find((c: any) => c.id !== boxOrCabinet.id);
        if (found) cabinetNode = doc.findNode(found.id);
    }
    if (!cabinetNode) return null;

    const cabinet: any = cabinetNode.domainData || cabinetNode;
    const params = container.generatorParams || {};
    const rawZone = (params.targetZone || params.zonePrefixRaw || '').toUpperCase();
    const zoneCount = cabinet.generatorParams?.zoneCount || 1;
    const boxType = params.boxType || '';
    const useOuter = boxType === 'PANELS' || params.type === 'smartbox_panels';

    let zonePrefix = 'B';
    if (!useOuter && (rawZone === 'T' || rawZone === 'TOP')) zonePrefix = 'T';
    else if (!useOuter && (rawZone === 'M' || rawZone === 'MID' || rawZone === 'MIDDLE')) zonePrefix = 'M';
    else if (useOuter || rawZone === 'FULL' || rawZone === 'ALL') {
        if (sideKey === 'zMax') {
            zonePrefix = zoneCount >= 2 ? 'T' : 'B';
        } else {
            zonePrefix = 'B';
        }
    }

    let axis: 'x' | 'y' | 'z';
    let isMin = false;
    switch (sideKey) {
        case 'xMin': axis = 'x'; isMin = true; break;
        case 'xMax': axis = 'x'; isMin = false; break;
        case 'yMin': axis = 'y'; isMin = true; break;
        case 'yMax': axis = 'y'; isMin = false; break;
        case 'zMin': axis = 'z'; isMin = true; break;
        case 'zMax': axis = 'z'; isMin = false; break;
        default: return null;
    }

    const sideRefs = useOuter
        ? {
            ...(smartframeContract as any).side_references_outer,
            ...(korpusRules as any).side_references_outer
        }
        : {
            ...(smartframeContract as any).side_references,
            ...(korpusRules as any).side_references
        };

    const sideStr = isMin ? 'MIN' : 'MAX';
    const suffix = useOuter ? 'OUTER' : 'INNER';
    const zoneKey = `${zonePrefix}_side.${axis.toUpperCase()}_${sideStr}_${suffix}`;
    const baseKey = `side.${axis.toUpperCase()}_${sideStr}_${suffix}`;
    const ref = sideRefs[zoneKey] || sideRefs[baseKey];

    if (!ref || !ref.provenance || !ref.provenance.part_key) return null;

    // Szukamy fizycznej płyty w szafie
    const targetKey = `${zonePrefix}_${ref.provenance.part_key}`;
    const fallbackKey = ref.provenance.part_key;
    const roleMap: Record<string, string> = {
        "BOK_L": "LEFT_SIDE_PANEL",
        "BOK_P": "RIGHT_SIDE_PANEL",
        "PLECY": "BACK_PANEL",
        "WIENIEC_D": "BOTTOM_PANEL",
        "WIENIEC_G": "TOP_PANEL"
    };
    const targetRole = roleMap[ref.provenance.part_key];

    let foundPanel: any = null;
    const findNodeRecursive = (node: any) => {
        if (!node) return;
        const p = node.domainData;
        if (p && ((p as any).key === targetKey || p.name === targetKey || (p as any).key === fallbackKey || p.name === fallbackKey || p.role === fallbackKey || (targetRole && p.role === targetRole))) {
            if (!foundPanel || (p as any).key === targetKey || p.name === targetKey) {
                foundPanel = p;
            }
        }
        if (node.children) {
            for (const child of node.children) findNodeRecursive(child);
        }
    };
    findNodeRecursive(cabinetNode);

    const surface = ref.provenance.surface || 'INNER';
    let faceName = surface === 'INNER' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS';

    return {
        partKey: foundPanel?.name || targetKey,
        faceName: faceName,
        panelId: foundPanel?.id
    };
}
