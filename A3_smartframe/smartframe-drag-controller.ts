/**
 * smartframe-drag-controller.ts
 * Kontroler przeciągania i upuszczania korpusów SmartFrame na podłogę sceny 3D
 * oraz na poziome płaszczyzny warstw Z (DATUM_LEVEL) w GLC.
 * Obsługuje 1, 2 oraz 3 strefy, rzutowanie na płaszczyznę ziemi (Y=0 w Babylon, Z=0 w CAD)
 * lub przyciąganie do warstw Z (z automatycznym utworzeniem relacji VERTEX_DATUM w S2_solver).
 */

declare const BABYLON: any;
import { ContextManager } from '../A1_core/context-manager.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import { CreateKorpusCommand } from './commands/create-korpus-command.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { instantiateCabinetTemplate } from '../B1_biblioteka/korpusy/cabinet-instantiator.js';
import { ConstraintStore } from '../S2_solver/constraint-store.js';
import { makeAnchor } from '../S2_solver/constraint-types.js';
import { getDatumLevelZMm, makeDatumLevelAnchor } from '../S2_solver/datum-planes.js';
import { resolveCornerLocalMm } from '../S2_solver/constraint-geometry.js';

/**
 * Parametry przeciąganego korpusu — kanoniczne (SSOT: CabinetPlanParams).
 * Zero aliasów legacy; brak zgadywania jednoski po wartości.
 */
export interface DraggedKorpusParams {
    szerokosc_mm: number;
    wysokosc_mm: number;
    glebokosc_mm: number;
    liczba_stref?: 1 | 2 | 3;
    wysokosc_strefy_dolnej_mm?: number;
    wysokosc_strefy_srodkowej_mm?: number;
    cofniecie_plecow_mm?: number;
    szerokosc_blendy_mm?: number;
    strona_blendy?: 'LEFT' | 'RIGHT';
    glebokosc_boku_lewego_mm?: number;
    glebokosc_boku_prawego_mm?: number;
    wysokosc_przod_mm?: number;
    wysokosc_tyl_mm?: number;
    wysokosc_lewy_mm?: number;
    wysokosc_prawy_mm?: number;
    template?: any;
    typ_korpusu?: 'korpus3' | 'korpus_rogowy1' | 'korpus_rogowy90' | 'korpus_skosny' | 'korpus_skosny_dach' | 'korpus_skosny_lr' | 'korpus_skosny_lr_uc';
}

export class SmartFrameDragController {
    private _isDragging: boolean = false;
    private _draggedZoneCount: 1 | 2 | 3 | null = null;
    private _draggedParams: DraggedKorpusParams | null = null;
    private _ghostMesh: any = null;
    private _ghostMaterial: any = null;
    private _lastGroundPointMm: { x: number; y: number } | null = null;
    private _snappedDatumLevel: CADNode | null = null;

    get isDragging(): boolean {
        return this._isDragging;
    }

    get draggedZoneCount(): 1 | 2 | 3 | null {
        return this._draggedZoneCount;
    }

    get snappedDatumLevel(): CADNode | null {
        return this._snappedDatumLevel;
    }

    startDrag(liczba_stref: 1 | 2 | 3, params: DraggedKorpusParams): void {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cad-close-floating-edit'));
        }
        this._isDragging = true;
        this._draggedZoneCount = liczba_stref;
        this._draggedParams = { ...params };
        this._lastGroundPointMm = null;
        this._snappedDatumLevel = null;
    }

    startDragTemplate(template: any): void {
        const fp = template?.frameParams || {};
        const zc = (fp.liczba_stref as 1 | 2 | 3) || 1;
        this.startDrag(zc, {
            szerokosc_mm: template.dimensions?.szerokosc_mm ?? 600,
            wysokosc_mm: template.dimensions?.wysokosc_mm ?? 820,
            glebokosc_mm: template.dimensions?.glebokosc_mm ?? 560,
            wysokosc_strefy_dolnej_mm: fp.wysokosc_strefy_dolnej_mm,
            wysokosc_strefy_srodkowej_mm: fp.wysokosc_strefy_srodkowej_mm,
            cofniecie_plecow_mm: fp.cofniecie_plecow_mm,
            template
        });
    }

    endDrag(): void {
        this._isDragging = false;
        this._draggedZoneCount = null;
        this._draggedParams = null;
        this._lastGroundPointMm = null;
        this._snappedDatumLevel = null;
        if (typeof window !== 'undefined') {
            (window as any).__glcAxis?.highlightLevelPlane?.(null);
        }
        this._disposeGhost();
    }

    private _disposeGhost(): void {
        if (this._ghostMesh) {
            try {
                this._ghostMesh.dispose(false, true);
            } catch { /* ignoruj */ }
            this._ghostMesh = null;
        }
        if (this._ghostMaterial) {
            try {
                this._ghostMaterial.dispose();
            } catch { /* ignoruj */ }
            this._ghostMaterial = null;
        }
    }

    private _ensureGhostMesh(scene: any, width: number, height: number, depth: number): any {
        if (this._ghostMesh && !this._ghostMesh.isDisposed()) {
            return this._ghostMesh;
        }
        if (typeof BABYLON === 'undefined') return null;

        // Tworzymy przezroczysty sześcian podglądu korpusu
        const ghost = BABYLON.MeshBuilder.CreateBox('smartframe_drag_ghost', {
            width,
            height,
            depth,
            updatable: true
        }, scene);
        ghost.isPickable = false;

        const mat = new BABYLON.StandardMaterial('smartframe_drag_ghost_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(0.18, 0.55, 0.94);
        mat.emissiveColor = new BABYLON.Color3(0.1, 0.35, 0.8);
        mat.alpha = 0.35;
        mat.wireframe = false;
        mat.backFaceCulling = false;

        ghost.material = mat;
        this._ghostMesh = ghost;
        this._ghostMaterial = mat;
        return ghost;
    }

    /**
     * Sprawdza, czy promień kursora trafia w płaszczyznę lub kulkę poziomu Z (DATUM_LEVEL).
     */
    private _detectDatumLevelSnap(ray: any): { levelNode: CADNode; hitX: number; hitZ: number; zMm: number } | null {
        const doc = ContextManager.instance?.document as ProjectDocument | null;
        const glcNode = doc?.getGlcNode?.();
        if (!glcNode || !Array.isArray(glcNode.children)) return null;

        let bestMatch: { levelNode: CADNode; hitX: number; hitZ: number; zMm: number; score: number } | null = null;
        const PLANE_HALF_EXTENT = 550; // Płaszczyzna w interactive-glc-axis ma rozmiar 1000x1000 mm

        const candidates: Array<{ node: CADNode; zMm: number }> = [];
        if ((glcNode.domainData as any)?.showAxisZ !== false) {
            const tipZ_nm = (glcNode.domainData as any)?.tipZ_nm;
            const axisZ_nm = (glcNode.domainData as any)?.axisZHeight_nm;
            const tipZMm = typeof tipZ_nm === 'number' && tipZ_nm > 0
                ? Math.round(nmToMm(tipZ_nm))
                : (typeof axisZ_nm === 'number' && axisZ_nm > 0 ? Math.round(nmToMm(axisZ_nm)) + 30 : 2430);
            candidates.push({ node: glcNode, zMm: tipZMm });
        }
        for (const child of glcNode.children) {
            if (child.nodeType !== NodeType.DATUM_LEVEL) continue;
            if ((child.domainData as any)?.visible === false) continue;

            const z_nm = (child.domainData as any)?.z_nm ?? child.localMatrix?.getTranslation?.()?.z ?? 0;
            const zMm = Math.max(50, Math.round(nmToMm(z_nm)));
            candidates.push({ node: child, zMm });
        }

        for (const cand of candidates) {
            const { node: child, zMm } = cand;
            if (Math.abs(ray.direction.y) < 1e-5) continue;
            const tPlane = (zMm - ray.origin.y) / ray.direction.y;
            if (tPlane <= 0) continue;

            const hx = ray.origin.x + ray.direction.x * tPlane;
            const hz = ray.origin.z + ray.direction.z * tPlane;

            if (Math.abs(hx) <= PLANE_HALF_EXTENT && Math.abs(hz) <= PLANE_HALF_EXTENT) {
                const distFromOrigin = Math.hypot(hx, hz);
                if (!bestMatch || distFromOrigin < bestMatch.score) {
                    bestMatch = {
                        levelNode: child,
                        hitX: Math.round(hx),
                        hitZ: Math.round(hz),
                        zMm,
                        score: distFromOrigin,
                    };
                }
            }
        }

        if (!bestMatch) return null;
        return {
            levelNode: bestMatch.levelNode,
            hitX: bestMatch.hitX,
            hitZ: bestMatch.hitZ,
            zMm: bestMatch.zMm,
        };
    }

    /**
     * Wywoływane z onDragOver na canvasie — rzuca promień na płaszczyzny DATUM_LEVEL lub podłogę Y=0.
     */
    onPointerMoveOnScene(scene: any, pointerX: number, pointerY: number): { x: number; y: number } | null {
        if (!this._isDragging || !scene) return null;

        const camera = scene.activeCamera;
        if (!camera) return null;

        const ray = scene.createPickingRay
            ? scene.createPickingRay(
                pointerX,
                pointerY,
                typeof BABYLON !== 'undefined' && BABYLON.Matrix ? BABYLON.Matrix.Identity() : null,
                camera
            )
            : null;
        if (!ray || !ray.origin || !ray.direction || Math.abs(ray.direction.y) < 1e-5) return null;

        const snapped = this._detectDatumLevelSnap(ray);
        let floorCadX = 0;
        let floorCadY = 0;
        let baseZMm = 0;

        if (snapped) {
            this._snappedDatumLevel = snapped.levelNode;
            floorCadX = snapped.hitX;
            floorCadY = snapped.hitZ;
            baseZMm = snapped.zMm;
            if (typeof window !== 'undefined') {
                (window as any).__glcAxis?.highlightLevelPlane?.(snapped.levelNode.id);
            }
        } else {
            this._snappedDatumLevel = null;
            if (typeof window !== 'undefined') {
                (window as any).__glcAxis?.highlightLevelPlane?.(null);
            }
            const t = -ray.origin.y / ray.direction.y;
            if (t <= 0) return null;

            const hitPoint = ray.origin.add(ray.direction.scale(t));
            floorCadX = Math.round(hitPoint.x);
            floorCadY = Math.round(hitPoint.z);
        }

        this._lastGroundPointMm = { x: floorCadX, y: floorCadY };

        // Aktualizacja pozycji podglądu ghosta
        const params = this._draggedParams || { szerokosc_mm: 1000, wysokosc_mm: 2200, glebokosc_mm: 600 };
        const ghost = this._ensureGhostMesh(scene, params.szerokosc_mm, params.wysokosc_mm, params.glebokosc_mm);
        if (ghost) {
            ghost.position.set(floorCadX, baseZMm + params.wysokosc_mm / 2, floorCadY);
            ghost.isVisible = true;
        }

        return this._lastGroundPointMm;
    }

    /**
     * Wywoływane z onDrop na canvasie — tworzy korpus w docelowym punkcie na ziemi lub na warstwie Z.
     */
    onDropOnScene(docTarget?: any): boolean {
        if (!this._isDragging || !this._draggedZoneCount) {
            this.endDrag();
            return false;
        }

        const doc: ProjectDocument = docTarget || ContextManager.instance.document;
        if (!doc) {
            this.endDrag();
            return false;
        }

        const params = this._draggedParams || { szerokosc_mm: 1000, wysokosc_mm: 2200, glebokosc_mm: 600 };
        const zoneCount = this._draggedZoneCount;
        const pos = this._lastGroundPointMm || { x: 0, y: 0 };
        const wysokoscMm = params.wysokosc_mm;
        const snappedLevel = this._snappedDatumLevel;
        const snappedZMm = snappedLevel
            ? Math.max(50, Math.round(getDatumLevelZMm(snappedLevel)))
            : 0;

        let bottomHeight = params.wysokosc_strefy_dolnej_mm ?? (zoneCount === 2 ? 2000 : 500);
        let middleHeight = params.wysokosc_strefy_srodkowej_mm ?? 1200;

        if (zoneCount === 1) {
            bottomHeight = wysokoscMm;
            middleHeight = 0;
        } else if (zoneCount === 2) {
            if (bottomHeight >= wysokoscMm || bottomHeight <= 0 || bottomHeight === 500) {
                bottomHeight = wysokoscMm > 2000 ? 2000 : (wysokoscMm >= 400 ? wysokoscMm - 200 : Math.round(wysokoscMm / 2));
            }
            middleHeight = 0;
        } else if (zoneCount === 3) {
            if (bottomHeight + middleHeight >= wysokoscMm || bottomHeight <= 0 || middleHeight <= 0 || bottomHeight >= wysokoscMm) {
                bottomHeight = 500;
                middleHeight = 1200;
                if (bottomHeight + middleHeight >= wysokoscMm) {
                    bottomHeight = Math.round(wysokoscMm * 0.25);
                    middleHeight = Math.round(wysokoscMm * 0.55);
                }
            }
        }

        if (params.template) {
            const created = instantiateCabinetTemplate({
                template: params.template,
                position: { x: pos.x, y: pos.y, z: snappedZMm },
                overrideDims: { szerokosc_mm: params.szerokosc_mm, wysokosc_mm: wysokoscMm, glebokosc_mm: params.glebokosc_mm }
            }, doc);
            const createdId = created?.id || doc.activeEntity?.id;
            if (snappedLevel && createdId) {
                this._bindBottomCornerToDatumLevel(doc, createdId, snappedLevel);
            }
            this.endDrag();
            return true;
        }

        const cmd = new CreateKorpusCommand({
            // Wyłącznie kanoniczny słownik DTO.
            szerokosc_mm: params.szerokosc_mm,
            wysokosc_mm: wysokoscMm,
            glebokosc_mm: params.glebokosc_mm,
            liczba_stref: (params.liczba_stref ?? zoneCount) as 1 | 2 | 3,
            wysokosc_strefy_dolnej_mm: bottomHeight,
            wysokosc_strefy_srodkowej_mm: middleHeight,
            cofniecie_plecow_mm: params.cofniecie_plecow_mm ?? 3,
            position: { x: pos.x, y: pos.y, z: snappedZMm },
            typ_korpusu: params.typ_korpusu,
            szerokosc_blendy_mm: params.szerokosc_blendy_mm,
            strona_blendy: params.strona_blendy,
            glebokosc_boku_lewego_mm: params.glebokosc_boku_lewego_mm,
            glebokosc_boku_prawego_mm: params.glebokosc_boku_prawego_mm,
            wysokosc_przod_mm: params.wysokosc_przod_mm,
            wysokosc_tyl_mm: params.wysokosc_tyl_mm,
            wysokosc_lewy_mm: params.wysokosc_lewy_mm,
            wysokosc_prawy_mm: params.wysokosc_prawy_mm
        });

        const history = ContextManager.instance.commandHistory;
        if (history && typeof history.execute === 'function') {
            history.execute(cmd);
        } else {
            cmd.execute(doc);
        }

        const createdId = doc.activeEntity?.id;
        if (snappedLevel && createdId) {
            this._bindBottomCornerToDatumLevel(doc, createdId, snappedLevel);
        }

        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }

        this.endDrag();
        return true;
    }

    private _bindBottomCornerToDatumLevel(doc: ProjectDocument, containerId: string, levelNode: CADNode): void {
        const containerNode = doc.findNode(containerId);
        if (!containerNode) return;

        const cornerPt = resolveCornerLocalMm(containerNode, 0) ?? [0, 0, 0];
        ConstraintStore.instance.add({
            bindType: 'VERTEX_DATUM',
            anchorA: makeAnchor({
                nodeId: containerNode.id,
                kind: 'VERTEX',
                cornerIndex: 0,
                sourceNodeId: undefined,
                localPointMm: cornerPt,
            }),
            anchorB: makeDatumLevelAnchor(levelNode),
            offsetMm: 0,
        });
        (ContextManager.instance as any)?.solverController?.solveNow?.();
    }
}
