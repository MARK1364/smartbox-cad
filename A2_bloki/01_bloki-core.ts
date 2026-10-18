/**
 * A2_bloki — Bloki Adapter
 * 
 * Odpowiada za obliczanie płaszczyzn odniesienia (side_references) korpusu
 * oraz pozycjonowanie i przebudowę kontenera Bloki w czasie rzeczywistym.
 * 
 * ============================================================================
 * REFERENCE PYTHON CODE FOR ALIGNMENT:
 * ============================================================================
 * 
 * def ensure_bloki_name(obj):
 *     if obj and obj.get("is_blok") and not obj.name.endswith("_SB"):
 *         obj.name = f"{obj.name.split('.')[0]}_SB"
 * 
 * def update_bloki_core(obj, depsgraph):
 *     if obj.get("_bloki_internal_update"): return False
 *     sb = obj.bloki
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
import type { ModuleDims } from './01_base-engine.js';
import { SmartModuleRegistry } from './core/smart-module-registry.js';
import type { BlokiModuleId, SmartModulePlugin } from './core/smart-module-plugin.js';
import { registerAllBlokiModules } from './01_bootstrap-bloki-modules.js';

import { ContextManager } from '../A1_core/context-manager.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { nmToMm, mmToNm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { cadMatrixToRenderMatrix } from '../A1_core/cad-math/coord-system.js';
import { normalizeFaceName } from '../A4_smartpanel/panel-model.js';
import { classifyOutlineSegmentEdge } from '../A4_smartpanel/native_core/polygon-extrusion.js';
import { SyncShelfDrillingsCommand } from './commands/sync-shelf-drillings-command.js';
import { SyncDoorDrillingsCommand } from './commands/sync-door-drillings-command.js';
import { SyncDrawerDrillingsCommand } from './commands/sync-drawer-drillings-command.js';
import { SyncFlapsDrillingsCommand } from './commands/sync-flaps-drillings-command.js';
import { ClearBlokiDrillingsCommand } from './commands/clear-blok-drillings-command.js';

/**
 * Upewnia się, że nazwa kontenera Bloki i węzła w drzewie ma poprawny schemat:
 * - dla pustego Bloku (z samymi referencjami): blok_
 * - po wybraniu konkretnej kategorii nazwa się dopełnia: blok_polki, blok_szuflady itp.
 */
export function ensure_bloki_name(container: any, docTarget?: any) {
    if (!container || !container.generatorParams) return;
    
    // Mapowanie typów generatora na oczekiwane nazwy kategorii
    const typeToName: Record<string, string> = {
        'blok_empty': 'blok_',
        'blok_shelves': 'blok_polki',
        'blok_drawers': 'blok_szuflady',
        'blok_doors': 'blok_drzwi',
        'blok_skosne_drzwi': 'blok_drzwi_skosne',
        'blok_corner_doors': 'blok_drzwi_narozne',
        'blok_dividers': 'blok_przegrody',
        'blok_flaps': 'blok_klapy',
        'blok_tubes': 'blok_drazek',
        'blok_shelf': 'blok_wieniec',
        'blok_panels': 'blok_blendy',
        'blok_led_external': 'blok_led_podszafkowy',
        'blok_led_internal': 'blok_led_szafowy',
        'smartpart_hangers': 'blok_zawieszki',
        'blok_hangers': 'blok_zawieszki'
    };

    const type = container.generatorParams.type || 'blok_empty';
    const expectedName = typeToName[type] || 'blok_';

    const currentName = container.name || '';
    // Jeśli nazwa jest pusta, zaczyna się od blok_ lub Bloki, albo kończy na _SB,
    // to automatycznie dopełniamy/aktualizujemy do wybranej kategorii
    const isAutoManaged = 
        !currentName || 
        currentName === 'blok_' ||
        currentName.startsWith('blok_') || 
        currentName.startsWith('Bloki') || 
        currentName.endsWith('_SB');

    if (isAutoManaged && currentName !== expectedName) {
        container.name = expectedName;
        const doc = docTarget ?? ContextManager.instance?.document;
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

export function getPanelFaceCoordinate(panel: any, panelNode: any, cabinetNode: any, faceName: string, axis: 'x' | 'y' | 'z', lcs: any = null, isMax?: boolean, surface?: string): number {
    if (isOutlineFaceName(faceName)) {
        const outlineCoord = getOutlineFaceCoordinate(panel, panelNode, cabinetNode, faceName, axis);
        if (outlineCoord != null) return outlineCoord;
    }

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
        canonicalFace = canonicalizeRefFaceName(faceName);
    } else {
        canonicalFace = 'FACE_Z_PLUS';
    }

    // 2. Pozycja środka formatki w przestrzeni szafy (uwzględnia pełne zagnieżdżenie kontenerów)
    let localTxMm = 0;
    let localTyMm = 0;
    let localTzMm = 0;

    if (cabinetNode && panelNode && typeof cabinetNode.worldToLocal === 'function' && typeof panelNode.localToWorld === 'function') {
        const centerInCab = cabinetNode.worldToLocal(panelNode.localToWorld(Vec3.ZERO));
        localTxMm = nmToMm(centerInCab.x);
        localTyMm = nmToMm(centerInCab.y);
        localTzMm = nmToMm(centerInCab.z);
    } else if (panelNode) {
        localTxMm = nmToMm(panelNode.localMatrix.data[12]);
        localTyMm = nmToMm(panelNode.localMatrix.data[13]);
        localTzMm = nmToMm(panelNode.localMatrix.data[14]);
    }


    const roleUpper = String((panel as any).role || '').toUpperCase();

    const isDivider = roleUpper.includes('DIVIDER') || roleUpper.includes('PRZEGRODA');
    const isCabinetSide = roleUpper.includes('SIDE') || roleUpper.includes('BOK') ||
        (roleUpper === 'MANUAL_PANEL' && Math.abs(localTxMm) > 50);

    if (isDivider) {
        if (axis === 'x') {
            // W DividersEngine (rotation [90, 0, 90]):
            // FACE_Z_MINUS to prawa ściana przegrody (+X)
            // FACE_Z_PLUS to lewa ściana przegrody (-X)
            if (canonicalFace === 'FACE_Z_MINUS' || canonicalFace === 'FACE_X_PLUS' || canonicalFace === 'RIGHT') {
                return localTxMm + sizeZ / 2;
            }
            if (canonicalFace === 'FACE_Z_PLUS' || canonicalFace === 'FACE_X_MINUS' || canonicalFace === 'LEFT') {
                return localTxMm - sizeZ / 2;
            }
            // Gdy przegroda jest prawą granicą wnęki (isMax=true), bierzemy jej lewą ścianę (-X).
            // Gdy jest lewą granicą wnęki (isMax=false), bierzemy jej prawą ścianę (+X).
            return isMax ? (localTxMm - sizeZ / 2) : (localTxMm + sizeZ / 2);
        } else if (axis === 'y') {
            const depthMm = sizeY; // w DividersEngine dim.y to depth
            if (canonicalFace === 'FACE_X_PLUS' || canonicalFace === 'FACE_Y_MINUS') {
                return localTyMm - depthMm / 2; // Przód szafy
            } else if (canonicalFace === 'FACE_X_MINUS' || canonicalFace === 'FACE_Y_PLUS') {
                return localTyMm + depthMm / 2; // Tył szafy
            } else {
                return isMax ? (localTyMm + depthMm / 2) : (localTyMm - depthMm / 2);
            }
        } else if (axis === 'z') {
            const heightMm = sizeX; // w DividersEngine dim.x to height
            if (canonicalFace === 'FACE_X_PLUS' || canonicalFace === 'FACE_Y_PLUS') {
                return localTzMm + heightMm / 2; // Góra przegrody
            } else if (canonicalFace === 'FACE_X_MINUS' || canonicalFace === 'FACE_Y_MINUS') {
                return localTzMm - heightMm / 2; // Dół przegrody
            } else {
                return isMax ? (localTzMm + heightMm / 2) : (localTzMm - heightMm / 2);
            }
        }
    } else if (isCabinetSide) {
        if (axis === 'x') {
            const isLeft = localTxMm < 0 || roleUpper.includes('LEFT') || roleUpper.includes('_L');
            const isRight = localTxMm > 0 || roleUpper.includes('RIGHT') || roleUpper.includes('_P');
            if (isLeft) {
                if (canonicalFace === 'FACE_Z_PLUS') return localTxMm + sizeZ / 2;
                if (canonicalFace === 'FACE_Z_MINUS') return localTxMm - sizeZ / 2;
                return isMax ? (localTxMm - sizeZ / 2) : (localTxMm + sizeZ / 2);
            } else if (isRight) {
                if (canonicalFace === 'FACE_Z_PLUS') return localTxMm - sizeZ / 2;
                if (canonicalFace === 'FACE_Z_MINUS') return localTxMm + sizeZ / 2;
                return isMax ? (localTxMm + sizeZ / 2) : (localTxMm - sizeZ / 2);
            } else {
                return isMax ? (localTxMm - sizeZ / 2) : (localTxMm + sizeZ / 2);
            }
        } else if (axis === 'y') {
            // BOK_L rogowy90 (i inne „frontowe” boki): LCS Z→y, CADNode często bez rotacji —
            // localToWorld(0,0,±t/2) wtedy nie przesuwa Y (zostaje środek). Liczymy po grubości.
            const thicknessAlongY =
                String(panel?.lcs?.mapping?.Z || '').toLowerCase() === 'y' ||
                String(panel?.custom_properties?.corner_arm || '').toUpperCase() === 'Y';
            const domY = getPanelFaceDominantAxis(panel, panelNode, cabinetNode, canonicalFace);
            if (
                (canonicalFace === 'FACE_Z_PLUS' || canonicalFace === 'FACE_Z_MINUS') &&
                (domY === 'y' || thicknessAlongY)
            ) {
                if (cabinetNode && panelNode && typeof cabinetNode.worldToLocal === 'function' && typeof panelNode.localToWorld === 'function') {
                    const lz = canonicalFace === 'FACE_Z_PLUS' ? sizeZ / 2 : -sizeZ / 2;
                    const ptInCab = cabinetNode.worldToLocal(panelNode.localToWorld(new Vec3(0, 0, mmToNm(lz))));
                    const yFromXform = nmToMm(ptInCab.y);
                    // Jeśli offset poszedł w inną oś (brak rotacji LCS w macierzy) → heurystyka po Y
                    if (Math.abs(yFromXform - localTyMm) > 0.05) {
                        return yFromXform;
                    }
                }
                const isNeg = localTyMm < 0;
                if (isNeg) {
                    // Front (−Y): INNER / FACE_Z_PLUS = lico w stronę wnęki (+Y)
                    return canonicalFace === 'FACE_Z_PLUS' ? localTyMm + sizeZ / 2 : localTyMm - sizeZ / 2;
                }
                return canonicalFace === 'FACE_Z_PLUS' ? localTyMm - sizeZ / 2 : localTyMm + sizeZ / 2;
            }
            const depthMm = sizeX;
            if (canonicalFace === 'FACE_X_PLUS' || canonicalFace === 'FACE_Y_MINUS') {
                return localTyMm - depthMm / 2; // Przód szafy
            } else if (canonicalFace === 'FACE_X_MINUS' || canonicalFace === 'FACE_Y_PLUS') {
                return localTyMm + depthMm / 2; // Tył szafy
            } else {
                return isMax ? (localTyMm + depthMm / 2) : (localTyMm - depthMm / 2);
            }
        } else if (axis === 'z') {
            const heightMm = sizeY;
            if (canonicalFace === 'FACE_X_PLUS' || canonicalFace === 'FACE_Y_PLUS') {
                return localTzMm + heightMm / 2; // Góra boku
            } else if (canonicalFace === 'FACE_X_MINUS' || canonicalFace === 'FACE_Y_MINUS') {
                return localTzMm - heightMm / 2; // Dół boku
            } else {
                return isMax ? (localTzMm + heightMm / 2) : (localTzMm - heightMm / 2);
            }
        }
    }

    const isHorizontal = roleUpper.includes('BOTTOM') || roleUpper.includes('WIENIEC') || roleUpper.includes('TOP') ||
                         roleUpper.includes('SHELF') || roleUpper.includes('PÓŁKA') || roleUpper.includes('POLKA');

    if (isHorizontal && axis === 'z') {
        // Wieniec GÓRNY SKOŚNY:
        // loc.z (localTzMm) = z_top_center - (sizeZ/2)*cos(beta).
        // Górna krawędź dachu w osi x=0: z_szczyt_dachu_srodek_mm = localTzMm + (sizeZ/2)*cos(beta).
        // Dolne lico wieńca w osi x=0: z_dolne_lico_wienca_mm = z_szczyt_dachu_srodek_mm - sizeZ / cos(beta).
        const czy_wieniec_gorny = roleUpper.includes('TOP') || roleUpper.includes('WIENIEC_G');
        if (czy_wieniec_gorny) {
            const obrot_dachu_deg = Number((panel as any)?.lcs?.rotation?.[2]
                ?? (panelNode as any)?.domainData?.lcs?.rotation?.[2]
                ?? (lcs as any)?.rotation?.[2]);
            if (Number.isFinite(obrot_dachu_deg) && Math.abs(obrot_dachu_deg) > 1e-9) {
                const cos_kat_skosu = Math.cos((-obrot_dachu_deg * Math.PI) / 180);
                if (Math.abs(cos_kat_skosu) > 1e-6 && cos_kat_skosu < 1 - 1e-9) {
                    const z_szczyt_dachu_srodek_mm = localTzMm + (sizeZ / 2) * cos_kat_skosu;
                    const z_dolne_lico_wienca_mm = z_szczyt_dachu_srodek_mm - sizeZ / cos_kat_skosu;
                    if (canonicalFace === 'FACE_Z_PLUS') return z_dolne_lico_wienca_mm;
                    if (canonicalFace === 'FACE_Z_MINUS') return z_szczyt_dachu_srodek_mm;
                    return isMax ? z_dolne_lico_wienca_mm : z_szczyt_dachu_srodek_mm;
                }
            }
        }
        if (canonicalFace === 'FACE_Z_PLUS' && (roleUpper.includes('BOTTOM') || roleUpper.includes('WIENIEC_D'))) {
            return localTzMm + sizeZ / 2;
        }
        if (canonicalFace === 'FACE_Z_MINUS' && (roleUpper.includes('BOTTOM') || roleUpper.includes('WIENIEC_D'))) {
            return localTzMm - sizeZ / 2;
        }
        if (canonicalFace === 'FACE_Z_PLUS' && (roleUpper.includes('TOP') || roleUpper.includes('WIENIEC_G'))) {
            return localTzMm - sizeZ / 2;
        }
        if (canonicalFace === 'FACE_Z_MINUS' && (roleUpper.includes('TOP') || roleUpper.includes('WIENIEC_G'))) {
            return localTzMm + sizeZ / 2;
        }
        // Domyślnie dla wieńców i półek pośrednich:
        // isMax === true oznacza górne ograniczenie (sufit wnęki) -> bierzemy dolne lico formatki
        // isMax === false oznacza dolne ograniczenie (podłogę wnęki) -> bierzemy górne lico formatki
        return isMax ? (localTzMm - sizeZ / 2) : (localTzMm + sizeZ / 2);
    }

    if (isHorizontal && axis === 'y') {
        const depthMm = sizeY > 50 ? sizeY : sizeX;
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

    if (cabinetNode && panelNode && typeof cabinetNode.worldToLocal === 'function' && typeof panelNode.localToWorld === 'function') {
        const localPointNm = new Vec3(mmToNm(localPoint.x), mmToNm(localPoint.y), mmToNm(localPoint.z));
        const ptInCab = cabinetNode.worldToLocal(panelNode.localToWorld(localPointNm));
        if (axis === 'x') return nmToMm(ptInCab.x);
        if (axis === 'y') return nmToMm(ptInCab.y);
        return nmToMm(ptInCab.z);
    }

    return 0;
}

/**
 * Wyszukuje węzeł CADNode formatki w drzewie na podstawie konfiguracji referencji.
 */
export function findPanelNodeByRef(refConfig: any, cabinetNode: any, doc: any): any {
    if (!refConfig) return null;
    let panelNode: any = null;
    if (refConfig.panelId && cabinetNode && refConfig.panelId !== cabinetNode.id) {
        panelNode = findNodeById(cabinetNode, refConfig.panelId);
    }
    if (!panelNode && refConfig.panelId && doc) {
        panelNode = doc.findNode(refConfig.panelId);
    }
    if (!panelNode && refConfig.partKey && refConfig.partKey !== 'SmartFrame' && cabinetNode) {
        panelNode = findNodeByKey(cabinetNode, refConfig.partKey);
    }
    if (!panelNode && refConfig.partKey && doc) {
        panelNode = doc.findNode(refConfig.partKey);
        if (!panelNode && typeof doc.getPanels === 'function') {
            const allPanels = doc.getPanels();
            panelNode = allPanels.find((n: any) => n.id === refConfig.partKey || n.domainData?.name === refConfig.partKey || n.domainData?.id === refConfig.partKey || (n.domainData as any)?.key === refConfig.partKey) || null;
        }
    }
    return panelNode;
}

export function isOutlineFaceName(faceName: string | null | undefined): boolean {
    return String(faceName || '').toUpperCase().startsWith('OUTLINE_');
}

export function canonicalizeRefFaceName(faceName: string | null | undefined): string {
    if (!faceName) return 'FACE_Z_PLUS';
    if (isOutlineFaceName(faceName)) return faceName;
    try {
        return normalizeFaceName(faceName);
    } catch {
        return faceName;
    }
}

function getOutline2dMm(panel: any): number[][] | null {
    const raw = panel?.custom_properties?.outline2d || panel?.outline2d;
    if (!Array.isArray(raw) || raw.length < 3) return null;
    return raw;
}

function parseOutlineSideIndex(faceName: string): number | null {
    const m = String(faceName || '').toUpperCase().match(/^OUTLINE_SIDE_(\d+)$/);
    if (!m) return null;
    const idx = parseInt(m[1], 10);
    return Number.isFinite(idx) ? idx : null;
}

function distPointToSegment2d(
    px: number, py: number,
    x0: number, y0: number,
    x1: number, y1: number
): number {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return Math.hypot(px - x0, py - y0);
    let t = ((px - x0) * dx + (py - y0) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

/** LCS wieńca: +90 dół (V lustrzane względem CAD Y), −90 góra. */
function outlineRotXDeg(panel: any): number {
    const r = Number(panel?.lcs?.rotation?.[0]);
    return Number.isFinite(r) ? r : 0;
}

function panelOriginInCabinetMm(panelNode: any, cabinetNode: any): { x: number; y: number; z: number } {
    if (cabinetNode && panelNode && typeof cabinetNode.worldToLocal === 'function' && typeof panelNode.localToWorld === 'function') {
        const p = cabinetNode.worldToLocal(panelNode.localToWorld(Vec3.ZERO));
        return { x: nmToMm(p.x), y: nmToMm(p.y), z: nmToMm(p.z) };
    }
    if (panelNode?.localMatrix?.data) {
        return {
            x: nmToMm(panelNode.localMatrix.data[12]),
            y: nmToMm(panelNode.localMatrix.data[13]),
            z: nmToMm(panelNode.localMatrix.data[14])
        };
    }
    return { x: 0, y: 0, z: 0 };
}

/**
 * UV obrysu L → CAD XY korpusu (jak worldL w silniku).
 * Nie przez Rx(90) węzła: ta rotacja stawia grubość w CAD Y i zwraca środek płyty zamiast ściany wcięcia.
 */
function outlineUvToCabinetMm(
    panel: any,
    panelNode: any,
    cabinetNode: any,
    u: number,
    v: number
): { x: number; y: number; z: number } {
    const sizeX = nmToMm(panel.width || 0);
    const sizeY = nmToMm(panel.height || 0);
    const c = panelOriginInCabinetMm(panelNode, cabinetNode);
    const rotX = outlineRotXDeg(panel);
    return {
        x: c.x + (u - sizeX / 2),
        y: rotX > 0 ? c.y - (v - sizeY / 2) : c.y + (v - sizeY / 2),
        z: c.z
    };
}

function getOutlineSegmentCabinetMm(
    panel: any,
    panelNode: any,
    cabinetNode: any,
    faceName: string
): { mid: { x: number; y: number; z: number }; normal: Vec3 } | null {
    const idx = parseOutlineSideIndex(faceName);
    const outline = getOutline2dMm(panel);
    if (idx === null || !outline || idx < 0 || idx >= outline.length) return null;
    const [u0, v0] = outline[idx];
    const [u1, v1] = outline[(idx + 1) % outline.length];
    const a = outlineUvToCabinetMm(panel, panelNode, cabinetNode, u0, v0);
    const b = outlineUvToCabinetMm(panel, panelNode, cabinetNode, u1, v1);
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const nlen = Math.hypot(nx, ny) || 1;
    return {
        mid: {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            z: (a.z + b.z) / 2
        },
        normal: new Vec3(nx / nlen, ny / nlen, 0)
    };
}

function transformLocalDirToCabinet(
    panel: any,
    panelNode: any,
    cabinetNode: any,
    localDir: Vec3
): Vec3 | null {
    const view =
        ContextManager.instance.panelViews.get(panel) ||
        (panel?.id ? ContextManager.instance.panelViews.get(panel.id) : null);

    if (view?.root && (window as any).BABYLON) {
        const BAB = (window as any).BABYLON;
        const localVec = new BAB.Vector3(localDir.x, localDir.y, localDir.z);
        view.root.computeWorldMatrix(true);
        const worldVec = BAB.Vector3.TransformNormal(localVec, view.root.getWorldMatrix()).normalize();
        const cadWorld = new Vec3(worldVec.x, worldVec.z, worldVec.y);
        if (cabinetNode?.getWorldMatrix) {
            return cabinetNode.getWorldMatrix().invert().transformDirection(cadWorld).normalize();
        }
        return cadWorld.normalize();
    }

    if (panelNode && cabinetNode && typeof cabinetNode.getWorldMatrix === 'function' && typeof panelNode.getWorldMatrix === 'function') {
        const relMat = cabinetNode.getWorldMatrix().invert().multiply(panelNode.getWorldMatrix());
        return relMat.transformDirection(localDir).normalize();
    }

    if (panelNode && cabinetNode && typeof cabinetNode.worldToLocal === 'function' && typeof panelNode.localToWorld === 'function') {
        const localVecNm = new Vec3(mmToNm(localDir.x), mmToNm(localDir.y), mmToNm(localDir.z));
        const p0 = cabinetNode.worldToLocal(panelNode.localToWorld(Vec3.ZERO));
        const p1 = cabinetNode.worldToLocal(panelNode.localToWorld(localVecNm));
        return new Vec3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z).normalize();
    }

    return null;
}

function dominantAxisFromDir(dir: Vec3): 'x' | 'y' | 'z' {
    const worldNx = Math.abs(dir.x);
    const worldNy = Math.abs(dir.y);
    const worldNz = Math.abs(dir.z);
    if (worldNz >= worldNx && worldNz >= worldNy) return 'z';
    if (worldNy >= worldNx && worldNy >= worldNz) return 'y';
    return 'x';
}

function worldPickNormalToCabinetDir(
    worldNormal: { x: number; y: number; z: number } | null | undefined,
    cabinetNode: any
): Vec3 | null {
    if (!worldNormal) return null;
    const cadWorld = new Vec3(worldNormal.x, worldNormal.z, worldNormal.y);
    if (cabinetNode?.getWorldMatrix) {
        return cabinetNode.getWorldMatrix().invert().transformDirection(cadWorld).normalize();
    }
    return cadWorld.normalize();
}

export function getOutlineFaceCoordinate(
    panel: any,
    panelNode: any,
    cabinetNode: any,
    faceName: string,
    axis: 'x' | 'y' | 'z'
): number | null {
    const seg = getOutlineSegmentCabinetMm(panel, panelNode, cabinetNode, faceName);
    if (!seg) return null;
    if (axis === 'x') return seg.mid.x;
    if (axis === 'y') return seg.mid.y;
    return seg.mid.z;
}

function outlineUvFromPickedFace(
    panel: any,
    faceName: string,
    uv: { u: number; v: number } | null | undefined
): { u: number; v: number } | null {
    if (!uv) return null;
    const canonical = canonicalizeRefFaceName(faceName);
    if (canonical === 'FACE_Z_MINUS') {
        return { u: nmToMm(panel.width || 0) - uv.u, v: uv.v };
    }
    if (canonical === 'FACE_Z_PLUS' || isOutlineFaceName(canonical)) {
        return uv;
    }
    return null;
}

function findClosestOutlineSideForSlot(
    panel: any,
    panelNode: any,
    cabinetNode: any,
    sideKey: string,
    uv: { u: number; v: number } | null | undefined
): string | null {
    const outline = getOutline2dMm(panel);
    if (!outline || !uv) return null;
    const plateW = nmToMm(panel.width || 0);
    const plateD = nmToMm(panel.height || 0);

    let bestFace: string | null = null;
    let bestDist = Infinity;
    let bestNotch: string | null = null;
    let bestNotchDist = Infinity;

    for (let i = 0; i < outline.length; i++) {
        const face = `OUTLINE_SIDE_${i}`;
        const axis = getPanelFaceDominantAxis(panel, panelNode, cabinetNode, face);
        if (!isDominantAxisValidForSideKey(axis, sideKey)) continue;
        const [u0, v0] = outline[i];
        const [u1, v1] = outline[(i + 1) % outline.length];
        const dist = distPointToSegment2d(uv.u, uv.v, u0, v0, u1, v1);
        const edgeKey = classifyOutlineSegmentEdge(u0, v0, u1, v1, plateW, plateD);
        if (dist < bestDist) {
            bestDist = dist;
            bestFace = face;
        }
        if (edgeKey === 'NOTCH' && dist < bestNotchDist) {
            bestNotchDist = dist;
            bestNotch = face;
        }
    }

    if (bestNotch && bestNotchDist <= 80) return bestNotch;
    return bestFace;
}

/**
 * Wyznacza dominującą oś wektora normalnego ściany w przestrzeni mebla/korpusu.
 * Zwraca 'x' (szerokość), 'y' (głębokość) lub 'z' (wysokość).
 */
export function getPanelFaceDominantAxis(
    panel: any,
    panelNode: any,
    cabinetNode: any,
    faceName: string,
    worldNormal?: { x: number; y: number; z: number } | null
): 'x' | 'y' | 'z' | null {
    if (!panel || !faceName) return null;

    if (worldNormal && isOutlineFaceName(faceName)) {
        const fromPick = worldPickNormalToCabinetDir(worldNormal, cabinetNode);
        if (fromPick) return dominantAxisFromDir(fromPick);
    }

    if (isOutlineFaceName(faceName)) {
        const seg = getOutlineSegmentCabinetMm(panel, panelNode, cabinetNode, faceName);
        if (!seg) return null;
        return dominantAxisFromDir(seg.normal);
    }

    const canonicalFace = normalizeFaceName(faceName);

    const roleUpper = String((panel as any).role || '').toUpperCase();
    if (roleUpper.includes('DIVIDER') || roleUpper.includes('PRZEGRODA')) {
        if (canonicalFace === 'FACE_Z_PLUS' || canonicalFace === 'FACE_Z_MINUS') {
            return 'x';
        }
    }

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

    const dir = transformLocalDirToCabinet(panel, panelNode, cabinetNode, new Vec3(nxLocal, nyLocal, nzLocal));
    if (!dir) return null;
    return dominantAxisFromDir(dir);
}

export type ReferenceValidationOptions = {
    /** Ręczny pick — pomija kolizje z auto-ref z bay (pary/prostopadłość). */
    manualPick?: boolean;
};

const MAIN_FACE_CANDIDATES = ['FACE_Z_PLUS', 'FACE_Z_MINUS'] as const;
const EDGE_FACE_CANDIDATES = [
    'FACE_X_PLUS', 'FACE_X_MINUS', 'FACE_Y_PLUS', 'FACE_Y_MINUS',
] as const;

/** Wektor normalny ściany w lokalnym układzie korpusu (CAD: X=szer., Y=głęb., Z=wys.). */
function getPanelFaceNormalInCabinet(
    panel: any,
    panelNode: any,
    cabinetNode: any,
    faceName: string
): Vec3 | null {
    if (!panel || !faceName) return null;

    if (isOutlineFaceName(faceName)) {
        const seg = getOutlineSegmentCabinetMm(panel, panelNode, cabinetNode, faceName);
        if (!seg) return null;
        return seg.normal;
    }

    const canonicalFace = canonicalizeRefFaceName(faceName);

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
    } else {
        return null;
    }

    return transformLocalDirToCabinet(panel, panelNode, cabinetNode, new Vec3(nxLocal, nyLocal, nzLocal));
}

function isDominantAxisValidForSideKey(axis: 'x' | 'y' | 'z' | null, sideKey: string): boolean {
    if (!axis) return false;
    if (sideKey === 'zMin' || sideKey === 'zMax') return axis === 'z';
    return axis !== 'z';
}

function scoreFaceNormalAlignment(
    faceNormal: Vec3 | null,
    pickNormalCabinet: Vec3 | null
): number {
    if (!faceNormal || !pickNormalCabinet) return -1;
    return Math.abs(faceNormal.dot(pickNormalCabinet));
}

function isSlopedTopRef(panel: any, panelNode: any, cabinetNode: any, faceName?: string): boolean {
    const role = String(panel?.role || panelNode?.domainData?.role || '').toUpperCase();
    if (role === 'TOP_PANEL' || role === 'WIENIEC_G') return true;
    const rotZ = panel?.lcs?.rotation?.[2] ?? panelNode?.domainData?.lcs?.rotation?.[2];
    if (rotZ !== undefined && Number.isFinite(Number(rotZ)) && Math.abs(Number(rotZ)) > 0.001) return true;
    const dachKat = cabinetNode?.generatorParams?.dach_kat_deg;
    if (dachKat != null && Number.isFinite(Number(dachKat)) && Number(dachKat) !== 0) {
        if (role === 'TOP_PANEL' || role === 'WIENIEC_G') return true;
    }
    if (faceName && isOutlineFaceName(faceName)) {
        const norm = getPanelFaceNormalInCabinet(panel, panelNode, cabinetNode, faceName);
        if (norm && Math.abs(norm.z) > 0.05) return true;
    }
    return false;
}

/**
 * Ręczny pick: zachowuje wcięcie L (OUTLINE_SIDE), mapuje ABS boku na lico,
 * a klik w poziome lico wieńca L — na najbliższą ścianę wcięcia.
 */
export function resolveManualReferenceFace(
    panel: any,
    panelNode: any,
    cabinetNode: any,
    faceName: string,
    sideKey: string,
    worldNormal?: { x: number; y: number; z: number } | null,
    faceUv?: { u: number; v: number } | null
): { face: string; mapped: boolean } {
    const pickedFace = canonicalizeRefFaceName(faceName);
    const dominantAxis = getPanelFaceDominantAxis(panel, panelNode, cabinetNode, pickedFace, worldNormal);
    const isTopSloped = sideKey === 'zMax' && isSlopedTopRef(panel, panelNode, cabinetNode, pickedFace);

    if (isOutlineFaceName(pickedFace) && (isDominantAxisValidForSideKey(dominantAxis, sideKey) || isTopSloped)) {
        return { face: pickedFace, mapped: false };
    }

    const needsVerticalWall = sideKey !== 'zMin' && sideKey !== 'zMax';
    if (needsVerticalWall && getOutline2dMm(panel)) {
        const outlineUv = outlineUvFromPickedFace(panel, pickedFace, faceUv);
        const snapped = findClosestOutlineSideForSlot(panel, panelNode, cabinetNode, sideKey, outlineUv);
        if (snapped) {
            return { face: snapped, mapped: snapped !== pickedFace };
        }
        if (isOutlineFaceName(pickedFace)) {
            return { face: pickedFace, mapped: false };
        }
    }

    if (isDominantAxisValidForSideKey(dominantAxis, sideKey) || isTopSloped) {
        return { face: pickedFace, mapped: false };
    }

    if (isOutlineFaceName(pickedFace)) {
        return { face: pickedFace, mapped: false };
    }

    const pickNormalCabinet = worldPickNormalToCabinetDir(worldNormal, cabinetNode);

    const tryCandidates = (candidates: readonly string[]): string | null => {
        let bestFace: string | null = null;
        let bestScore = -1;
        for (const candidate of candidates) {
            const axis = getPanelFaceDominantAxis(panel, panelNode, cabinetNode, candidate);
            if (!isDominantAxisValidForSideKey(axis, sideKey)) continue;
            const faceNormal = getPanelFaceNormalInCabinet(panel, panelNode, cabinetNode, candidate);
            const score = scoreFaceNormalAlignment(faceNormal, pickNormalCabinet);
            if (score > bestScore) {
                bestScore = score;
                bestFace = candidate;
            } else if (score === bestScore && !bestFace) {
                bestFace = candidate;
            }
        }
        return bestFace;
    };

    const needsHorizontal = sideKey === 'zMin' || sideKey === 'zMax';
    const primary = needsHorizontal ? EDGE_FACE_CANDIDATES : MAIN_FACE_CANDIDATES;
    const fallback = needsHorizontal ? MAIN_FACE_CANDIDATES : EDGE_FACE_CANDIDATES;

    const resolved = tryCandidates(primary) || tryCandidates(fallback);
    if (resolved) {
        return { face: resolved, mapped: resolved !== pickedFace };
    }

    return { face: pickedFace, mapped: false };
}

/**
 * Weryfikuje poprawność orientacji ściany referencyjnej z uwzględnieniem równoległości w osi:
 * - Dół (zMin) i Góra (zMax) -> płaszczyzna pozioma w osi Z.
 * - Bok Lewy (xMin) i Bok Prawy (xMax) -> dozwolona oś X lub Y; muszą być równoległe do siebie!
 * - Przód (yMin) i Tył (yMax) -> dozwolona oś Y lub X; muszą być równoległe do siebie i prostopadłe do boków!
 */
export function validateReferenceFaceOrientation(
    panel: any,
    panelNode: any,
    cabinetNode: any,
    faceName: string,
    sideKey: string,
    existingRefs?: Record<string, any>,
    options?: ReferenceValidationOptions
): { valid: boolean; errorMsg?: string; dominantAxis?: 'x' | 'y' | 'z' } {
    if (!panel || !faceName || !sideKey) {
        return { valid: true };
    }

    const dominantAxis = getPanelFaceDominantAxis(panel, panelNode, cabinetNode, faceName);
    if (!dominantAxis) {
        return { valid: true };
    }

    const axisNames: Record<'x' | 'y' | 'z', string> = {
        x: 'szerokości X (Bok Lewy / Bok Prawy)',
        y: 'głębokości Y (Przód / Tył)',
        z: 'wysokości Z (Dół / Góra)'
    };

    // Helper do sprawdzenia dominantAxis dla już przypisanej ściany
    const getAxisOfRef = (refKey: string): 'x' | 'y' | 'z' | null => {
        const ref = existingRefs?.[refKey];
        if (!ref || !ref.face) return null;
        const doc = ContextManager.instance.document;
        const pNode = findPanelNodeByRef(ref, cabinetNode, doc);
        if (!pNode || !pNode.domainData) return null;
        return getPanelFaceDominantAxis(pNode.domainData, pNode, cabinetNode, ref.face);
    };

    // 1. Dół / Góra — ściana pozioma w osi Z (dla zMax dopuszczamy również pochyły dach / wieniec górny)
    if (sideKey === 'zMin' || sideKey === 'zMax') {
        const isSlopedTop = sideKey === 'zMax' && isSlopedTopRef(panel, panelNode, cabinetNode, faceName);
        if (dominantAxis !== 'z' && !isSlopedTop) {
            return {
                valid: false,
                dominantAxis,
                errorMsg: `Nieprawidłowa orientacja ściany! Dół i góra wymagają płaszczyzny poziomej (w osi Z), a wskazano ścianę w osi ${axisNames[dominantAxis]}.`
            };
        }
        return { valid: true, dominantAxis };
    }

    // 2. Boki: Lewy (xMin) i Prawy (xMax)
    if (sideKey === 'xMin' || sideKey === 'xMax') {
        if (dominantAxis === 'z') {
            return {
                valid: false,
                dominantAxis,
                errorMsg: `Bok nie może być ścianą poziomą (w osi wysokości Z)!`
            };
        }

        if (!options?.manualPick) {
            // Równoległość pary: Bok lewy i bok prawy MUSZĄ być do siebie równoległe!
            const pairKey = sideKey === 'xMin' ? 'xMax' : 'xMin';
            const pairAxis = getAxisOfRef(pairKey);
            if (pairAxis && pairAxis !== dominantAxis) {
                return {
                    valid: false,
                    dominantAxis,
                    errorMsg: `Bok lewy i bok prawy muszą być do siebie równoległe! Pierwszy bok leży w osi ${axisNames[pairAxis]}, a nowo wskazany w osi ${axisNames[dominantAxis]}.`
                };
            }

            // Prostopadłość: Boki muszą być prostopadłe do przodu i tyłu
            const frontAxis = getAxisOfRef('yMin');
            const backAxis = getAxisOfRef('yMax');
            const fbAxis = frontAxis || backAxis;
            if (fbAxis && fbAxis === dominantAxis) {
                return {
                    valid: false,
                    dominantAxis,
                    errorMsg: `Boki muszą być prostopadłe do przodu i tyłu szafki!`
                };
            }
        }

        return { valid: true, dominantAxis };
    }

    // 3. Przód (yMin) i Tył (yMax)
    if (sideKey === 'yMin' || sideKey === 'yMax') {
        if (dominantAxis === 'z') {
            return {
                valid: false,
                dominantAxis,
                errorMsg: `Przód ani tył nie może być ścianą poziomą (w osi wysokości Z)!`
            };
        }

        if (!options?.manualPick) {
            // Równoległość pary: Przód i tył MUSZĄ być do siebie równoległe!
            const pairKey = sideKey === 'yMin' ? 'yMax' : 'yMin';
            const pairAxis = getAxisOfRef(pairKey);
            if (pairAxis && pairAxis !== dominantAxis) {
                return {
                    valid: false,
                    dominantAxis,
                    errorMsg: `Przód i tył muszą być do siebie równoległe! Pierwsza ściana leży w osi ${axisNames[pairAxis]}, a nowo wskazana w osi ${axisNames[dominantAxis]}.`
                };
            }

            // Prostopadłość: Przód i tył muszą być prostopadłe do boków
            const leftAxis = getAxisOfRef('xMin');
            const rightAxis = getAxisOfRef('xMax');
            const sidesAxis = leftAxis || rightAxis;
            if (sidesAxis && sidesAxis === dominantAxis) {
                return {
                    valid: false,
                    dominantAxis,
                    errorMsg: `Przód i tył muszą być prostopadłe do boków szafki!`
                };
            }
        }

        return { valid: true, dominantAxis };
    }

    return { valid: true, dominantAxis };
}

/**
 * Przelicza pozycję, wymiary oraz generuje elementy wewnątrz Bloku.
 * Bazuje wyłącznie na customReferences (panelId + face) zapisanych przez bay detector.
 * Brak fallbacków opartych na strefach (B/M/T) ani na JSON side_references.
 */
/**
 * Fail-fast na granicy domeny: `boxType` musi mieć wtyczkę w SmartModuleRegistry.
 *
 * `EMPTY` to zapisywany stan pustego bloku (`type: 'blok_empty'`) — legalny,
 * nie jest błędem i wtyczki nie ma. Każdy INNY brak wtyczki oznacza literówkę
 * w parametrze albo moduł pominięty w bootstrap-bloki-modules.ts. Wcześniej
 * kończyło się to cichym `plan = { parts: [] }`, czyli pusty blok bez komunikatu.
 *
 * Wyodrębnione z `update_bloki_core`, żeby regułę dało się przetestować
 * bez całego fixture'a dokumentu i geometrii.
 */
export function resolveModulePlugin(
    boxType: BlokiModuleId | string
): SmartModulePlugin<object> | null {
    let plugin = SmartModuleRegistry.get(boxType);
    if (!plugin) {
        registerAllBlokiModules();
        plugin = SmartModuleRegistry.get(boxType);
    }
    if (!plugin && boxType !== 'EMPTY') {
        throw new Error(
            `[A2_bloki] Nieznany boxType "${boxType}" — brak wtyczki w SmartModuleRegistry. `
            + `Dodaj ${String(boxType).toLowerCase()}-plugin.tsx i wpis w bootstrap-bloki-modules.ts.`
        );
    }
    return plugin ?? null;
}

export function update_bloki_core(container: any, docTarget: any): boolean {
    if (!container || !docTarget) return false;
    const doc = docTarget ?? ContextManager.instance?.document;
    if (!doc) return false;

    const params = container.generatorParams;
    if (!params) return false;

    // Pilnuj spójnego nazewnictwa modułów Bloki
    ensure_bloki_name(container, doc);

    // Znajdź nadrzędny korpus (SmartFrame)
    let cabinetId = params.parentContainerId;
    let cabinetNode = cabinetId ? doc.findNode(cabinetId) : null;
    let cabinet: any = cabinetNode ? cabinetNode.domainData : null;

    // Jeśli cabinetNode to inny moduł Bloki, wejdź wyżej do głównego korpusu SmartFrame
    if (cabinetNode && (cabinet?.generatorParams?.type?.startsWith('blok_') || cabinet?.generatorParams?.boxType)) {
        let curr: CADNode | null = cabinetNode.parent;
        while (curr && curr.id !== doc.rootNode.id) {
            const dd = curr.domainData as any;
            if (dd?.type === 'container' && (dd.generatorParams?.type?.startsWith('korpus') || !dd.generatorParams?.type?.startsWith('blok_'))) {
                cabinetNode = curr;
                cabinet = dd;
                cabinetId = curr.id;
                params.parentContainerId = cabinetId;
                break;
            }
            curr = curr.parent;
        }
    }

    if (!cabinet) {
        const allNodes: CADNode[] = [];
        const traverse = (node: CADNode) => {
            allNodes.push(node);
            for (const child of node.children) traverse(child);
        };
        traverse(doc.rootNode);

        cabinetNode = allNodes.find((e: any) => {
            const t = e.domainData?.generatorParams?.type || '';
            return e.domainData && (t === 'korpus3_2' || t === 'korpus3_1' || t === 'korpus_rogowy1' || String(t).startsWith('korpus'));
        }) || null;
        cabinet = cabinetNode ? cabinetNode.domainData : null;
        
        if (!cabinet) {
            cabinetNode = allNodes.find((e: any) => e.domainData && e.domainData.type === 'container' && e.id !== container.id) || null;
            cabinet = cabinetNode ? cabinetNode.domainData : null;
        }
        
        if (!cabinet) {
            console.warn('[BlokiAdapter] Brak aktywnego korpusu SmartFrame w scenie.');
            return false;
        }
        params.parentContainerId = cabinet.id;
    }

    const typeToBox: Record<string, string> = {
        blok_doors: 'DOORS',
        blok_corner_doors: 'CORNER_DOORS',
        blok_skosne_drzwi: 'SKOSNE_DOORS',
        blok_shelf: 'SHELF',
        blok_tubes: 'TUBES',
        blok_drawers: 'DRAWERS',
        blok_dividers: 'DIVIDERS',
        blok_panels: 'PANELS',
        blok_flaps: 'FLAPS',
        blok_empty: 'EMPTY',
        blok_shelves: 'SHELVES',
        blok_led_external: 'LED_EXTERNAL',
        blok_led_internal: 'LED_INTERNAL'
    };
    const boxType = params.boxType || typeToBox[params.type] || 'SHELVES';

    // 1. Referencje i offsety — wyłącznie z customReferences (bay detector)
    const customRefs = params.customReferences || {};
    const offsets = params.offsets || {};

    const foundCabinetNode = doc.findNode(cabinet.id);

    const disabledRefs = params.disabledReferences || {};
    const isSideDisabled = (sideKey: string) => !!disabledRefs[sideKey];
    const isSideActive = (sideKey: string) => !isSideDisabled(sideKey);

    const SIDE_LABELS: Record<string, string> = {
        xMin: 'Lewo',
        xMax: 'Prawo',
        yMin: 'Przód',
        yMax: 'Tył',
        zMin: 'Dół',
        zMax: 'Góra',
    };

    const warnMissingRef = (sideKey: string, reason: string): false => {
        const label = SIDE_LABELS[sideKey] || sideKey;
        console.warn(
            `[Bloki] ${label} (${sideKey}): ${reason}. Nie używam szacunku z gabarytu kontenera — ustaw ścianę lub wyłącz (✕).`
        );
        return false;
    };

    /**
     * Rozwiązuje koordynatę ściany referencyjnej po panelId (priorytet) lub partKey.
     * Zwraca null gdy brak referencji lub nie udało się odczytać współrzędnej.
     */
    const resolveRef = (sideKey: string, axis: 'x' | 'y' | 'z', isMax: boolean): number | null => {
        const offsetVal = parseFloat(offsets[sideKey]) || 0;
        const refConfig = customRefs[sideKey];
        if (!refConfig) return null;

        const panelNode = findPanelNodeByRef(refConfig, foundCabinetNode, doc);
        const isCabinetSelf =
            !!foundCabinetNode &&
            (panelNode?.id === foundCabinetNode.id || refConfig.panelId === foundCabinetNode.id);
        const isRealWallPanel =
            panelNode &&
            panelNode.domainData &&
            panelNode.domainData.type !== 'container' &&
            !isCabinetSelf;

        // Gdy Przód/Tył ma prawdziwą ścianę (BOK_L, przegroda…) — zawsze lico tej ściany.
        if (isRealWallPanel) {
            const coord = getPanelFaceCoordinate(
                panelNode.domainData, panelNode, foundCabinetNode,
                refConfig.face, axis, null, isMax
            );
            return isMax ? (coord - offsetVal) : (coord + offsetVal);
        }

        // Pusty korpus bez ściany frontowej: yMin = zewnętrzna płaszczyzna −depth/2 (jak dotychczas).
        if (sideKey === 'yMin') {
            if (axis === 'x') {
                const cabWidth = nmToMm(cabinet.width) || 600;
                return cabWidth / 2 - offsetVal;
            }
            const cabDepth = nmToMm(cabinet.depth) || 600;
            return -cabDepth / 2 + offsetVal;
        }

        // Korpus SmartFrame jako referencja dla góry (zMax) — górna płaszczyzna SmartFrame (+height)
        if (sideKey === 'zMax' && isCabinetSelf) {
            const cabHeight = nmToMm(cabinet.height) || (cabinet.generatorParams?.wysokosc_mm ?? 720);
            return cabHeight - offsetVal;
        }

        if (sideKey === 'zMin' && isCabinetSelf) {
            return 0 + offsetVal;
        }

        return null;
    };

    // Określ orientację boków Bloku (oś X mebla w standardzie lub oś Y mebla przy obrocie o 90°)
    let sidesAxis: 'x' | 'y' = 'x';
    const refXMin = customRefs.xMin;
    const refXMax = customRefs.xMax;
    const checkSideRef = refXMin || refXMax;
    if (checkSideRef) {
        const pNode = findPanelNodeByRef(checkSideRef, foundCabinetNode, doc);
        if (pNode && pNode.domainData) {
            const dom = getPanelFaceDominantAxis(pNode.domainData, pNode, foundCabinetNode, checkSideRef.face);
            if (dom === 'y') sidesAxis = 'y';
        }
    } else {
        const refYMin = customRefs.yMin;
        const refYMax = customRefs.yMax;
        const checkFbRef = refYMin || refYMax;
        if (checkFbRef) {
            const pNode = findPanelNodeByRef(checkFbRef, foundCabinetNode, doc);
            if (pNode && pNode.domainData) {
                const dom = getPanelFaceDominantAxis(pNode.domainData, pNode, foundCabinetNode, checkFbRef.face);
                if (dom === 'x') sidesAxis = 'y';
            }
        }
    }

    const xMinAxis: 'x' | 'y' = sidesAxis === 'y' ? 'y' : 'x';
    const yMinAxis: 'x' | 'y' = sidesAxis === 'y' ? 'x' : 'y';

    // Rozwiąż 6 ścian
    const xMinRef = resolveRef('xMin', xMinAxis, false);
    const xMaxRef = resolveRef('xMax', xMinAxis, true);
    const yMinRef = resolveRef('yMin', yMinAxis, false);
    const yMaxRef = resolveRef('yMax', yMinAxis, true);
    const zMinRef = resolveRef('zMin', 'z', false);
    const zMaxRef = resolveRef('zMax', 'z', true);

    const checkActiveSide = (sideKey: string, resolved: number | null): boolean => {
        if (isSideDisabled(sideKey)) return true;
        if (!customRefs[sideKey]) {
            return warnMissingRef(sideKey, 'brak przypisanej ściany');
        }
        if (resolved == null) {
            return warnMissingRef(sideKey, 'nie udało się odczytać współrzędnej ściany');
        }
        return true;
    };

    for (const [sideKey, resolved] of [
        ['xMin', xMinRef],
        ['xMax', xMaxRef],
        ['yMin', yMinRef],
        ['yMax', yMaxRef],
        ['zMin', zMinRef],
        ['zMax', zMaxRef],
    ] as const) {
        if (!checkActiveSide(sideKey, resolved)) return false;
    }

    // Wymiary z params są kanoniczne (*_mm). Używane tylko gdy dana ściana jest wyłączona.
    const widthParam = parseFloat(params.width_mm) || 0;
    const depthParam = parseFloat(params.depth_mm) || 0;
    const heightH = parseFloat(params.maxHeight || params.height_mm) || 0;

    let xMinVal: number;
    let xMaxVal: number;
    if (isSideActive('xMin') && isSideActive('xMax')) {
        xMinVal = xMinRef!;
        xMaxVal = xMaxRef!;
    } else if (isSideDisabled('xMin') && isSideActive('xMax')) {
        if (widthParam <= 0) return warnMissingRef('xMin', 'ściana wyłączona — podaj szerokość w parametrach (width_mm)');
        xMaxVal = xMaxRef!;
        xMinVal = xMaxVal - widthParam;
    } else if (isSideActive('xMin') && isSideDisabled('xMax')) {
        if (widthParam <= 0) return warnMissingRef('xMax', 'ściana wyłączona — podaj szerokość w parametrach (width_mm)');
        xMinVal = xMinRef!;
        xMaxVal = xMinVal + widthParam;
    } else if (isSideDisabled('xMin') && isSideDisabled('xMax')) {
        if (widthParam <= 0) return warnMissingRef('xMin', 'obie ściany boczne wyłączone — podaj szerokość (width_mm)');
        xMinVal = -widthParam / 2;
        xMaxVal = widthParam / 2;
    } else {
        return warnMissingRef('xMin', 'nie można ustalić szerokości — ustaw odniesienia lub wyłącz jedną ścianę boczną');
    }

    let yMinVal: number;
    let yMaxVal: number;
    if (isSideActive('yMin') && isSideActive('yMax')) {
        yMinVal = yMinRef!;
        yMaxVal = yMaxRef!;
    } else if (isSideDisabled('yMin') && isSideActive('yMax')) {
        if (depthParam <= 0) return warnMissingRef('yMin', 'ściana wyłączona — podaj głębokość w parametrach (depth_mm)');
        yMaxVal = yMaxRef!;
        yMinVal = yMaxVal - depthParam;
    } else if (isSideActive('yMin') && isSideDisabled('yMax')) {
        if (depthParam <= 0) return warnMissingRef('yMax', 'ściana wyłączona — podaj głębokość w parametrach (depth_mm)');
        yMinVal = yMinRef!;
        yMaxVal = yMinVal + depthParam;
    } else if (isSideDisabled('yMin') && isSideDisabled('yMax')) {
        if (depthParam <= 0) return warnMissingRef('yMin', 'obie ściany czołowe wyłączone — podaj głębokość (depth_mm)');
        yMinVal = -depthParam / 2;
        yMaxVal = depthParam / 2;
    } else {
        return warnMissingRef('yMin', 'nie można ustalić głębokości — ustaw odniesienia lub wyłącz jedną ścianę czołową');
    }

    const isZMinActive = isSideActive('zMin');
    const isZMaxActive = isSideActive('zMax');

    let zMinVal: number;
    let zMaxVal: number;
    let sbHeight: number;

    if (isZMinActive && isZMaxActive) {
        zMinVal = zMinRef!;
        zMaxVal = zMaxRef!;
        sbHeight = Math.max(10, zMaxVal - zMinVal);
    } else if (isZMinActive && !isZMaxActive) {
        zMinVal = zMinRef!;
        if (heightH <= 0) return warnMissingRef('zMax', 'ściana górna wyłączona — podaj wysokość (maxHeight / height_mm)');
        sbHeight = heightH;
        zMaxVal = zMinVal + sbHeight;
    } else if (!isZMinActive && isZMaxActive) {
        zMaxVal = zMaxRef!;
        if (heightH <= 0) return warnMissingRef('zMin', 'ściana dolna wyłączona — podaj wysokość (maxHeight / height_mm)');
        sbHeight = heightH;
        zMinVal = zMaxVal - sbHeight;
    } else if (isSideDisabled('zMin') && isSideDisabled('zMax')) {
        if (heightH <= 0) return warnMissingRef('zMin', 'obie ściany pionowe wyłączone — podaj wysokość (maxHeight / height_mm)');
        zMinVal = 0;
        zMaxVal = heightH;
        sbHeight = heightH;
    } else {
        return warnMissingRef('zMin', 'nie można ustalić wysokości — ustaw odniesienia lub wyłącz jedną ścianę pionową');
    }

    if (isNaN(sbHeight) || sbHeight <= 0) {
        return warnMissingRef('zMax', 'nieprawidłowa wysokość po rozwiązaniu odniesień');
    }

    const sbWidth = Math.max(10, Math.abs(xMaxVal - xMinVal));
    const sbDepth = Math.max(10, Math.abs(yMaxVal - yMinVal));

    if (isNaN(sbWidth) || isNaN(sbDepth) || isNaN(sbHeight)) {
        console.error(`[Bloki] NaN w wymiarach: W=${sbWidth}, H=${sbHeight}, D=${sbDepth}. Przerywam.`);
        return false;
    }

    // 2. Zaktualizuj gabaryt kontenera Bloki w modelu
    container.width = mmToNm(sbWidth);
    container.height = mmToNm(sbHeight);
    container.depth = mmToNm(sbDepth);

    // 3. Zaktualizuj pozycję kontenera Bloki
    const containerNode = doc.findNode(container.id);

    if (foundCabinetNode && containerNode) {
        let sbPosX = 0;
        let sbPosY = 0;
        let sbPosZ = zMinVal;
        let rotQuat = Quat.IDENTITY;

        if (sidesAxis === 'y') {
            sbPosX = (yMinVal + yMaxVal) / 2;
            sbPosY = (xMinVal + xMaxVal) / 2;
            const rotZ = (yMinVal >= yMaxVal) ? -Math.PI / 2 : Math.PI / 2;
            rotQuat = Quat.fromEulerXYZ(0, 0, rotZ);
        } else {
            sbPosX = (xMinVal + xMaxVal) / 2;
            sbPosY = (yMinVal + yMaxVal) / 2;
            const { rotation } = containerNode.localMatrix.decompose();
            rotQuat = rotation;
        }

        if (isNaN(sbPosX)) sbPosX = 0;
        if (isNaN(sbPosY)) sbPosY = 0;
        if (isNaN(sbPosZ)) sbPosZ = 0;

        const { scale } = containerNode.localMatrix.decompose();
        containerNode.setLocalTransform(
            new Vec3(mmToNm(sbPosX), mmToNm(sbPosY), mmToNm(sbPosZ)),
            rotQuat,
            scale
        );
    }

    // 4. Uruchom moduł generujący wewnątrz tego gabarytu.
    if (boxType === 'SKOSNE_DOORS' && foundCabinetNode) {
        const topPanel = foundCabinetNode.children.find(
            (c: any) => String(c.domainData?.role || '').toUpperCase() === 'TOP_PANEL'
        );
        const rotZ = (topPanel?.domainData as any)?.lcs?.rotation?.[2];
        if (rotZ !== undefined && Number.isFinite(Number(rotZ))) {
            params.dach_kat_deg = -Number(rotZ);
        }
    }

    const dims: ModuleDims = {
        width_mm: sbWidth,
        height_mm: sbHeight,
        depth_mm: sbDepth
    };
    const plugin = resolveModulePlugin(boxType);
    const plan: { parts: any[] } = plugin ? plugin.buildPlan(params, dims) : { parts: [] };

    // 5. Zmaterializuj elementy jako dzieci kontenera Bloki
    applyPlanToContainer(container, plan);

    // 6. Zsynchronizuj nawiercenia i frezowania na formatkach korpusu.
    if (doc) {
        const hasSync = typeof plugin?.syncDrillings === 'function';
        // Pomijamy odświeżanie widoków w Clear jeśli za chwilę syncDrillings wyemituje finalne cechy
        new ClearBlokiDrillingsCommand(container.id, !hasSync).execute(doc);
        if (hasSync) {
            plugin.syncDrillings(doc, cabinet.id, containerNode);
        }
    }

    return true;
}

