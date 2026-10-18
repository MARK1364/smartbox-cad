/**
 * smartframe-drag-controller.ts
 * Kontroler przeciągania i upuszczania korpusów SmartFrame na podłogę sceny 3D.
 * Obsługuje 1, 2 oraz 3 strefy, rzutowanie na płaszczyznę ziemi (Y=0 w Babylon, Z=0 w CAD)
 * oraz podgląd bryły (ghost) w czasie rzeczywistym.
 */

declare const BABYLON: any;
import { ContextManager } from '../A1_core/context-manager.js';
import { CreateKorpusCommand } from './commands/create-korpus-command.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { instantiateCabinetTemplate } from '../B1_biblioteka/korpusy/cabinet-instantiator.js';

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

    get isDragging(): boolean {
        return this._isDragging;
    }

    get draggedZoneCount(): 1 | 2 | 3 | null {
        return this._draggedZoneCount;
    }

    startDrag(liczba_stref: 1 | 2 | 3, params: DraggedKorpusParams): void {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cad-close-floating-edit'));
        }
        this._isDragging = true;
        this._draggedZoneCount = liczba_stref;
        this._draggedParams = { ...params };
        this._lastGroundPointMm = null;
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
     * Wywoływane z onDragOver na canvasie — rzuca promień na podłogę Y=0.
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

        // Przecięcie z płaszczyzną podłogi Y = 0 w Babylonie:
        // ray.origin.y + t * ray.direction.y = 0 => t = -ray.origin.y / ray.direction.y
        const t = -ray.origin.y / ray.direction.y;
        if (t <= 0) return null;

        const hitPoint = ray.origin.add(ray.direction.scale(t));

        // W Babylonie: X = CAD X, Z = CAD Y (głębokość), Y = wysokość (CAD Z).
        const floorCadX = Math.round(hitPoint.x);
        const floorCadY = Math.round(hitPoint.z);

        this._lastGroundPointMm = { x: floorCadX, y: floorCadY };

        // Aktualizacja pozycji podglądu ghosta
        const params = this._draggedParams || { szerokosc_mm: 1000, wysokosc_mm: 2200, glebokosc_mm: 600 };
        const ghost = this._ensureGhostMesh(scene, params.szerokosc_mm, params.wysokosc_mm, params.glebokosc_mm);
        if (ghost) {
            // Podstawa szafki opiera się na podłodze (Y = 0), więc środek bryły leży na Y = height / 2
            ghost.position.set(hitPoint.x, params.wysokosc_mm / 2, hitPoint.z);
            ghost.isVisible = true;
        }

        return this._lastGroundPointMm;
    }

    /**
     * Wywoływane z onDrop na canvasie — tworzy korpus w docelowym punkcie na ziemi.
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
            instantiateCabinetTemplate({
                template: params.template,
                position: { x: pos.x, y: pos.y, z: 0 },
                overrideDims: { szerokosc_mm: params.szerokosc_mm, wysokosc_mm: wysokoscMm, glebokosc_mm: params.glebokosc_mm }
            }, doc);
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
            position: { x: pos.x, y: pos.y, z: 0 },
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

        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }

        this.endDrag();
        return true;
    }
}
