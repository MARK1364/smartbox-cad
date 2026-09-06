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
 * Upewnia się, że nazwa kontenera SmartBox i węzła w drzewie ma poprawny schemat:
 * - dla pustego SmartBoxa (z samymi referencjami): smartbox_
 * - po wybraniu konkretnej kategorii nazwa się dopełnia: smartbox_polki, smartbox_szuflady itp.
 */
export function ensure_smartbox_name(container: any) {
    if (!container || !container.generatorParams) return;
    
    // Mapowanie typów generatora na oczekiwane nazwy kategorii
    const typeToName: Record<string, string> = {
        'smartbox_empty': 'smartbox_',
        'smartbox_shelves': 'smartbox_polki',
        'smartbox_drawers': 'smartbox_szuflady',
        'smartbox_doors': 'smartbox_drzwi',
        'smartbox_dividers': 'smartbox_przegrody',
        'smartbox_flaps': 'smartbox_klapy',
        'smartbox_tubes': 'smartbox_drazek',
        'smartbox_shelf': 'smartbox_wieniec',
        'smartbox_panels': 'smartbox_blendy'
    };

    const type = container.generatorParams.type || 'smartbox_empty';
    const expectedName = typeToName[type] || 'smartbox_';

    const currentName = container.name || '';
    // Jeśli nazwa jest pusta, zaczyna się od smartbox_ lub SmartBox, albo kończy na _SB,
    // to automatycznie dopełniamy/aktualizujemy do wybranej kategorii
    const isAutoManaged = 
        !currentName || 
        currentName === 'smartbox_' ||
        currentName.startsWith('smartbox_') || 
        currentName.startsWith('SmartBox') || 
        currentName.endsWith('_SB');

    if (isAutoManaged && currentName !== expectedName) {
        container.name = expectedName;
        const doc = ContextManager.instance.document;
        if (doc && container.id) {
            const node = doc.findNode(container.id);
            if (node) {
                node.name = expectedName;
            }
        }
    }
}

/**
 * Rekurencyjne wyszukiwanie węzła CADNode po ID.
 */
function findNodeById(root: any, nodeId: string): any | null {
    if (!root || !nodeId) return null;
    if (root.id === nodeId) return root;
    if (root.children) {
        for (const child of root.children) {
            const found = findNodeById(child, nodeId);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Rekurencyjne wyszukiwanie węzła CADNode po nazwie, kluczu lub smartId.
 */
function findNodeByKey(root: any, partKey: string): any | null {
    if (!root || !partKey) return null;
    const p = root.domainData;
    if (p && (
        (p as any).key === partKey ||
        p.name === partKey ||
        p.id === partKey ||
        (p as any).smartId?.uid === partKey
    )) {
        return root;
    }
    if (root.children) {
        for (const child of root.children) {
            const found = findNodeByKey(child, partKey);
            if (found) return found;
        }
    }
    return null;
}

function getPanelFaceCoordinate(panel: any, panelNode: any, cabinetNode: any, faceName: string, axis: 'x' | 'y' | 'z', lcs: any = null, isMax?: boolean, surface?: string): number {
    const pw = panel.width || 0;
    const ph = panel.height || 0;
    const pt = panel.thickness || 0;

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

    const roleUpper = String((panel as any).role || '').toUpperCase();
    const localTxMm = nmToMm(panelNode.localMatrix.data[12]);
    const localTyMm = nmToMm(panelNode.localMatrix.data[13]);
    const localTzMm = nmToMm(panelNode.localMatrix.data[14]);

    const isSide = roleUpper.includes('SIDE') || roleUpper.includes('BOK') || roleUpper.includes('DIVIDER') || roleUpper.includes('PRZEGRODA') ||
        (roleUpper === 'MANUAL_PANEL' && Math.abs(panelNode.localMatrix.data[12]) > mmToNm(50));

    if (isSide) {
        if (axis === 'x') {
            const isLeft = localTxMm < 0 || roleUpper.includes('LEFT') || roleUpper.includes('_L');
            const isRight = localTxMm > 0 || roleUpper.includes('RIGHT') || roleUpper.includes('_P');
            if (isLeft) {
                if (canonicalFace === 'FACE_Z_PLUS') return localTxMm + sizeZ / 2;
                if (canonicalFace === 'FACE_Z_MINUS') return localTxMm - sizeZ / 2;
            } else if (isRight) {
                if (canonicalFace === 'FACE_Z_PLUS') return localTxMm - sizeZ / 2;
                if (canonicalFace === 'FACE_Z_MINUS') return localTxMm + sizeZ / 2;
            } else {
                if (canonicalFace === 'FACE_Z_PLUS') return localTxMm + sizeZ / 2;
                if (canonicalFace === 'FACE_Z_MINUS') return localTxMm - sizeZ / 2;
            }
        } else if (axis === 'y') {
            const depthMm = Math.min(sizeX, sizeY) > 50 && Math.max(sizeX, sizeY) > 200 ? Math.min(sizeX, sizeY) : sizeX;
            if (canonicalFace === 'FACE_X_PLUS' || canonicalFace === 'FACE_Y_MINUS') {
                return localTyMm - depthMm / 2; // Przód szafy
            } else if (canonicalFace === 'FACE_X_MINUS' || canonicalFace === 'FACE_Y_PLUS') {
                return localTyMm + depthMm / 2; // Tył szafy
            } else {
                return isMax ? (localTyMm + depthMm / 2) : (localTyMm - depthMm / 2);
            }
        } else if (axis === 'z') {
            const heightMm = Math.max(sizeX, sizeY);
            if (canonicalFace === 'FACE_X_PLUS' || canonicalFace === 'FACE_Y_PLUS') {
                return localTzMm + heightMm / 2; // Góra boku
            } else if (canonicalFace === 'FACE_X_MINUS' || canonicalFace === 'FACE_Y_MINUS') {
                return localTzMm - heightMm / 2; // Dół boku
            } else {
                return isMax ? (localTzMm + heightMm / 2) : (localTzMm - heightMm / 2);
            }
        }
    }

    if ((roleUpper.includes('BOTTOM') || roleUpper.includes('WIENIEC_D')) && axis === 'z') {
        if (canonicalFace === 'FACE_Z_PLUS') return localTzMm + sizeZ / 2;
        if (canonicalFace === 'FACE_Z_MINUS') return localTzMm - sizeZ / 2;
        return isMax ? (localTzMm + sizeZ / 2) : (localTzMm - sizeZ / 2);
    }

    if ((roleUpper.includes('TOP') || roleUpper.includes('WIENIEC_G')) && axis === 'z') {
        if (canonicalFace === 'FACE_Z_PLUS') return localTzMm - sizeZ / 2;
        if (canonicalFace === 'FACE_Z_MINUS') return localTzMm + sizeZ / 2;
        return isMax ? (localTzMm + sizeZ / 2) : (localTzMm - sizeZ / 2);
    }

    if ((roleUpper.includes('BOTTOM') || roleUpper.includes('TOP') || roleUpper.includes('WIENIEC') || roleUpper.includes('SHELF')) && axis === 'y') {
        const depthMm = Math.min(sizeX, sizeY) > 50 && Math.max(sizeX, sizeY) > 200 ? Math.min(sizeX, sizeY) : (sizeY > 50 ? sizeY : sizeX);
        if (canonicalFace === 'FACE_X_PLUS' || canonicalFace === 'FACE_Y_MINUS') {
            return localTyMm - depthMm / 2; // Przód szafy
        } else if (canonicalFace === 'FACE_X_MINUS' || canonicalFace === 'FACE_Y_PLUS') {
            return localTyMm + depthMm / 2; // Tył szafy
        } else {
            return isMax ? (localTyMm + depthMm / 2) : (localTyMm - depthMm / 2);
        }
    }

    if ((roleUpper.includes('BACK') || roleUpper.includes('PLECY')) && axis === 'y') {
        if (canonicalFace === 'FACE_Z_PLUS') return localTyMm - sizeZ / 2;
        if (canonicalFace === 'FACE_Z_MINUS') return localTyMm + sizeZ / 2;
        return isMax ? (localTyMm + sizeZ / 2) : (localTyMm - sizeZ / 2);
    }

    // 3. Uniwersalna transformacja dla paneli ogólnych (CAD Z-up)
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

    const localPointNm = new Vec3(mmToNm(localPoint.x), mmToNm(localPoint.y), mmToNm(localPoint.z));
    const worldPointCAD = absoluteMat.transformPoint(localPointNm);

    if (axis === 'x') {
        return nmToMm(worldPointCAD.x);
    } else if (axis === 'y') {
        return nmToMm(worldPointCAD.y);
    } else {
        return nmToMm(worldPointCAD.z);
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
 * Przelicza pozycję, wymiary oraz generuje elementy wewnątrz SmartBoxa.
 * Bazuje wyłącznie na customReferences (panelId + face) zapisanych przez bay detector.
 * Brak fallbacków opartych na strefach (B/M/T) ani na JSON side_references.
 */
export function update_smartbox_core(container: any, docTarget: any): boolean {
    if (!container || !docTarget) return false;
    const doc = ContextManager.instance.document;
    if (!doc) return false;

    const params = container.generatorParams;
    if (!params) return false;

    // Pilnuj spójnego nazewnictwa modułów SmartBox
    ensure_smartbox_name(container);

    // Znajdź nadrzędny korpus (SmartFrame)
    const cabinetId = params.parentContainerId;
    const containers = typeof doc.getContainers === 'function' ? doc.getContainers() : [];
    
    let cabinetNode = containers.find((e: any) => e.domainData && (e.domainData as any).id === cabinetId);
    let cabinet: any = cabinetNode ? cabinetNode.domainData : null;

    if (!cabinet) {
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

    // 1. Referencje i offsety — wyłącznie z customReferences (bay detector)
    const customRefs = params.customReferences || {};
    const offsets = params.offsets || {};

    const foundCabinetNode = doc.findNode(cabinet.id);

    /**
     * Rozwiązuje koordynatę ściany referencyjnej po panelId (priorytet) lub partKey.
     * Zwraca null jeśli brak referencji — wtedy używamy dotychczasowego rozmiaru kontenera.
     */
    const resolveRef = (sideKey: string, axis: 'x' | 'y' | 'z', isMax: boolean): number | null => {
        const offsetVal = parseFloat(offsets[sideKey]) || 0;
        const refConfig = customRefs[sideKey];
        if (!refConfig) return null;

        let panelNode: any = null;

        // Priorytet 1: szukaj po panelId (unikalny identyfikator z bay detectora)
        if (refConfig.panelId && foundCabinetNode) {
            panelNode = findNodeById(foundCabinetNode, refConfig.panelId);
        }

        // Priorytet 2: szukaj po partKey (nazwa/klucz)
        if (!panelNode && refConfig.partKey && foundCabinetNode) {
            panelNode = findNodeByKey(foundCabinetNode, refConfig.partKey);
        }

        if (panelNode && panelNode.domainData) {
            const coord = getPanelFaceCoordinate(
                panelNode.domainData, panelNode, foundCabinetNode,
                refConfig.face, axis, null, isMax
            );
            return isMax ? (coord - offsetVal) : (coord + offsetVal);
        }

        return null;
    };

    // Fallback wymiarów: aktualny rozmiar kontenera (w mm)
    const currentW = nmToMm(container.width) || 500;
    const currentH = nmToMm(container.height) || 500;
    const currentD = nmToMm(container.depth) || 500;
    const currentNode = doc.findNode(container.id);
    const currentPos = currentNode ? currentNode.localMatrix.decompose().translation : new Vec3(0, 0, 0);
    const currentPosXMm = nmToMm(currentPos.x);
    const currentPosYMm = nmToMm(currentPos.y);
    const currentPosZMm = nmToMm(currentPos.z);

    // Rozwiąż 6 ścian
    const xMinRef = resolveRef('xMin', 'x', false);
    const xMaxRef = resolveRef('xMax', 'x', true);
    const yMinRef = resolveRef('yMin', 'y', false);
    const yMaxRef = resolveRef('yMax', 'y', true);
    let zMinRef = resolveRef('zMin', 'z', false);
    let zMaxRef = resolveRef('zMax', 'z', true);

    // Wylicz wartości z fallbackiem na aktualny gabaryt kontenera
    const xMinVal = xMinRef ?? (currentPosXMm - currentW / 2);
    const xMaxVal = xMaxRef ?? (currentPosXMm + currentW / 2);
    const yMinVal = yMinRef ?? (currentPosYMm - currentD / 2);
    const yMaxVal = yMaxRef ?? (currentPosYMm + currentD / 2);

    const disabledRefs = params.disabledReferences || {};
    const isZMinActive = !disabledRefs.zMin;
    const isZMaxActive = !disabledRefs.zMax;

    const heightH = parseFloat(params.maxHeight || params.height) || 0;

    let zMinVal = zMinRef ?? currentPosZMm;
    let zMaxVal = zMaxRef ?? (currentPosZMm + currentH);
    let sbHeight = 0;

    if (isZMinActive && isZMaxActive) {
        sbHeight = Math.max(10, zMaxVal - zMinVal);
    } else if (isZMinActive && !isZMaxActive) {
        sbHeight = heightH > 0 ? heightH : Math.max(10, zMaxVal - zMinVal);
        zMaxVal = zMinVal + sbHeight;
    } else if (!isZMinActive && isZMaxActive) {
        sbHeight = heightH > 0 ? heightH : Math.max(10, zMaxVal - zMinVal);
        zMinVal = zMaxVal - sbHeight;
    } else {
        sbHeight = heightH > 0 ? heightH : Math.max(10, zMaxVal - zMinVal);
        zMaxVal = zMinVal + sbHeight;
    }

    if (isNaN(sbHeight) || sbHeight <= 0) sbHeight = currentH;

    const sbWidth = Math.max(10, xMaxVal - xMinVal);
    const sbDepth = Math.max(10, yMaxVal - yMinVal);

    if (isNaN(sbWidth) || isNaN(sbDepth) || isNaN(sbHeight)) {
        console.error(`[SmartBox] NaN w wymiarach: W=${sbWidth}, H=${sbHeight}, D=${sbDepth}. Przerywam.`);
        return false;
    }

    // 2. Zaktualizuj gabaryt kontenera SmartBox w modelu
    container.width = mmToNm(sbWidth);
    container.height = mmToNm(sbHeight);
    container.depth = mmToNm(sbDepth);

    // 3. Zaktualizuj pozycję kontenera SmartBox
    const containerNode = doc.findNode(container.id);

    if (foundCabinetNode && containerNode) {
        let sbPosX = (xMinVal + xMaxVal) / 2;
        let sbPosY = (yMinVal + yMaxVal) / 2;
        let sbPosZ = zMinVal;

        if (isNaN(sbPosX)) sbPosX = 0;
        if (isNaN(sbPosY)) sbPosY = 0;
        if (isNaN(sbPosZ)) sbPosZ = 0;

        const { rotation, scale } = containerNode.localMatrix.decompose();
        containerNode.setLocalTransform(
            new Vec3(mmToNm(sbPosX), mmToNm(sbPosY), mmToNm(sbPosZ)),
            rotation,
            scale
        );
    }

    // 4. Uruchom moduł generujący wewnątrz tego gabarytu.
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

    // 5. Zmaterializuj elementy jako dzieci kontenera SmartBox
    applyPlanToContainer(container, plan);

    // 6. Zsynchronizuj nawiercenia na formatkach korpusu.
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

