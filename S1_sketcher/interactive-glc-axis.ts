/**
 * S1_sketcher — interactive-glc-axis.ts
 *
 * Standardowa Oś Z Układu Globalnego (GLC - Global Layout Coordinates).
 * Wykorzystuje dokładnie ten sam mechanizm, wzorzec ActionManager/PointerDragBehavior
 * oraz to samo okno wymiaru (#gizmo-floating-input) co gizma formatki meblowej.
 *
 * Odwzorowanie przestrzenne:
 * - W domenie CAD / SSOT: wysokość to oś Z (nm)
 * - W silniku Babylon.js: pion to oś Y (mm)
 * - Minimalny dystans od dołu dla poziomów Z: 50 mm
 * - Różne kolory dla gizm i płaszczyzn odniesienia (LEVEL_COLOR_THEMES)
 * - Pełna obsługa ukrywania/pokazywania poziomów
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { ProjectDocument } from '../A1_core/project-document.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { UIController } from '../A1_core/ui-controller.js';
import { getLevelColorTheme, type LevelColorTheme } from './datum-types.js';
import { handleConstraintPickEvent } from '../S2_solver/constraint-picker.js';

declare const BABYLON: any;

interface LevelVisualEntry {
    levelId: string;
    sphere: any;
    plane: any;
    dragBehavior: any;
    theme: LevelColorTheme;
}

export class InteractiveGlcAxis {
    private scene: any;
    private viewport: any;
    private rootNode: any = null;

    // Elementy standardowej osi Z
    private shaftMesh: any = null;
    private arrowHead: any = null;
    private baseRing: any = null;

    // Wysokość masztu osi w mm (Babylon Y)
    private axisHeight_mm: number = 2400;

    // Wizualizacje poziomów (sfery + płaszczyzny)
    private levelsMap: Map<string, LevelVisualEntry> = new Map();

    // Stan aktywnego gizma (zgodny z gizmo-controller.ts)
    private activeGizmoSphere: any = null;
    private activeLevelNode: CADNode | null = null;
    private isDraggingGizmo: boolean = false;
    private isEditingGizmo: boolean = false;
    private originalValueBeforeEdit: number = 0;
    private badgeFixedPos: { left: number; top: number } | null = null;
    private activeThemeHex: string = '#38bdf8';
    private lastDraggedZ_mm: number = -1;
    private needsLiveSolve: boolean = false;

    private boundDoc: ProjectDocument | null = null;
    private unsubscribeDoc: (() => void) | null = null;
    private beforeRenderObserver: any = null;

    constructor(viewport: any) {
        this.viewport = viewport;
        this.scene = viewport.scene;
    }

    /**
     * Inicjalizuje oś Z, rejestruje DOM okna i podłącza render tracking.
     */
    public init(): void {
        if (this.rootNode) return;

        if (typeof window !== 'undefined') {
            (window as any).__glcAxis = this;
        }
        this.rootNode = new BABYLON.TransformNode('glc_axis_root', this.scene);
        this._buildStandardAxis();
        this._ensureFloatingInputDOM();
        this._setupRenderTracking();
        this._ensureDocSubscription();

        // Pierwsza synchronizacja
        this.syncFromDocument();
    }

    private _ensureDocSubscription(): void {
        const doc = ContextManager.instance?.document as ProjectDocument | null;
        if (doc !== this.boundDoc) {
            if (this.unsubscribeDoc) {
                this.unsubscribeDoc();
                this.unsubscribeDoc = null;
            }
            this.boundDoc = doc;
            if (doc) {
                this.unsubscribeDoc = doc.onDocumentChanged(() => {
                    this.syncFromDocument();
                });
                this.syncFromDocument();
            }
        }
    }

    /**
     * Buduje standardową niebieską oś pionową Z ze stożkiem i sferą na czubku grota.
     */
    private _buildStandardAxis(): void {
        const axisColor = new BABYLON.Color3(0.2, 0.45, 0.95);
        const mat = new BABYLON.StandardMaterial('glc_axis_mat', this.scene);
        mat.diffuseColor = axisColor;
        mat.emissiveColor = axisColor.scale(0.45);
        mat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

        const headLen = 30;
        const thickness = 4.5;

        // 1. Podstawa osi na podłodze
        this.baseRing = BABYLON.MeshBuilder.CreateCylinder('glc_base_disk', {
            height: 2,
            diameter: 32,
        }, this.scene);
        this.baseRing.material = mat;
        this.baseRing.position.y = 1;
        this.baseRing.parent = this.rootNode;
        this.baseRing.isPickable = true;
        this.baseRing.metadata = { type: 'glc_axis' };

        // 2. Trzonek osi Z (smukły, bezpośrednio klikalny PPM bez kolidujących tubusów)
        this.shaftMesh = BABYLON.MeshBuilder.CreateCylinder('glc_axis_line', {
            height: this.axisHeight_mm,
            diameter: thickness,
        }, this.scene);
        this.shaftMesh.material = mat;
        this.shaftMesh.position.y = this.axisHeight_mm / 2;
        this.shaftMesh.parent = this.rootNode;
        this.shaftMesh.isPickable = true;
        this.shaftMesh.metadata = { type: 'glc_axis' };

        // 3. Grot strzałki (stożek)
        this.arrowHead = BABYLON.MeshBuilder.CreateCylinder('glc_axis_head', {
            height: headLen,
            diameterTop: 0,
            diameterBottom: thickness * 4.5,
        }, this.scene);
        this.arrowHead.material = mat;
        this.arrowHead.position.y = this.axisHeight_mm + headLen / 2;
        this.arrowHead.parent = this.rootNode;
        this.arrowHead.isPickable = true;
        this.arrowHead.metadata = { type: 'glc_axis' };
    }

    /**
     * Aktualizuje wysokość masztu i pozycję grota strzałki na podstawie najwyższego poziomu Z.
     */
    private _updateMastHeightFromLevels(): void {
        const headLen = 30;
        let maxZ_mm = 2400;
        if (this.levelsMap.size > 0) {
            maxZ_mm = 0;
            for (const entry of this.levelsMap.values()) {
                maxZ_mm = Math.max(maxZ_mm, entry.sphere.position.y);
            }
        }
        this.axisHeight_mm = Math.max(50, maxZ_mm - headLen);
        if (this.shaftMesh) {
            this.shaftMesh.scaling.y = this.axisHeight_mm / 2400;
            this.shaftMesh.position.y = this.axisHeight_mm / 2;
        }
        if (this.arrowHead) {
            this.arrowHead.position.y = this.axisHeight_mm + headLen / 2;
        }
    }

    private _ensureFloatingInputDOM(): void {
        if (typeof document === 'undefined') return;
        let badge = document.getElementById('gizmo-floating-input');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'gizmo-floating-input';
            badge.style.cssText = `
                position: absolute;
                display: none;
                z-index: 1000;
                pointer-events: auto;
                background: rgba(20, 20, 20, 0.85);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1.5px solid rgba(255, 102, 0, 0.8);
                border-radius: 6px;
                padding: 2px 6px;
                align-items: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                font-family: 'Outfit', 'Inter', sans-serif;
                color: #fff;
                font-size: 13px;
            `;

            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'gizmo-input-field';
            input.style.cssText = `
                background: transparent;
                border: none;
                color: #fff;
                font-family: inherit;
                font-size: 13px;
                min-width: 45px;
                width: auto;
                text-align: right;
                outline: none;
                font-weight: bold;
            `;

            const unit = document.createElement('span');
            unit.innerText = 'mm';
            unit.style.cssText = `
                margin-left: 2px;
                color: rgba(255,255,255,0.7);
                font-weight: 500;
            `;

            badge.appendChild(input);
            badge.appendChild(unit);
            document.body.appendChild(badge);

            badge.onmousedown = (e) => e.stopPropagation();
            badge.onpointerdown = (e) => e.stopPropagation();
            input.onmousedown = (e) => e.stopPropagation();
            input.onpointerdown = (e) => e.stopPropagation();
        }

        const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
        if (input) {
            this._hookInputEvents(input, badge);
        }
    }

    /**
     * Podpina zdarzenia klawiatury pod input okna wymiaru.
     */
    private _hookInputEvents(input: HTMLInputElement, badge: HTMLElement): void {
        input.addEventListener('input', () => {
            if (!this.activeGizmoSphere || !(window as any).__glcGizmoActive) return;
            input.style.width = `${Math.max(45, input.value.length * 9)}px`;
        });

        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!this.activeGizmoSphere || !(window as any).__glcGizmoActive) return;

            if (e.key === 'Enter') {
                this._applyInputValue(input.value);
                this._hideBadge(badge, input);
            } else if (e.key === 'Escape') {
                input.value = this.originalValueBeforeEdit.toString();
                this._applyInputValue(input.value);
                this._hideBadge(badge, input);
            }
        });

        input.addEventListener('blur', () => {
            if (!this.activeGizmoSphere || !(window as any).__glcGizmoActive) return;

            this._applyInputValue(input.value);
            this._hideBadge(badge, input);
        });
    }

    private _hideBadge(badge: HTMLElement, input: HTMLInputElement): void {
        this.isEditingGizmo = false;
        this.isDraggingGizmo = false;
        this.badgeFixedPos = null;
        badge.style.display = 'none';
        this.activeGizmoSphere = null;
        this.activeLevelNode = null;
        (window as any).__glcGizmoActive = false;
        input.blur();
    }

    /**
     * Wyświetla badge z wartością i pozycjonuje go na ekranie.
     */
    private _showBadge(valMm: number, accentHex: string = '#38bdf8'): void {
        const badge = document.getElementById('gizmo-floating-input');
        const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
        if (badge && input) {
            (window as any).__glcGizmoActive = true;
            this.activeThemeHex = accentHex;
            badge.style.border = `1.5px solid ${accentHex}`;
            input.value = valMm.toString();
            input.style.width = `${Math.max(45, input.value.length * 9)}px`;
            badge.style.display = 'flex';
            this._updateBadgePosition();
        }
    }

    /**
     * Aktualizuje wartość w polu tekstowym w trakcie przeciągania.
     */
    private _updateBadgeValue(valMm: number): void {
        const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
        if (input && document.activeElement !== input) {
            input.value = valMm.toString();
            input.style.width = `${Math.max(45, input.value.length * 9)}px`;
        }
    }

    /**
     * Otwiera okno edycyjne wymiaru po kliknięciu lub zakończeniu przeciągania.
     */
    public openFloatingInput(sphere: any, node: CADNode | null, currentZ_mm: number, accentHex: string = '#38bdf8'): void {
        (window as any).__glcGizmoActive = true;
        this.activeGizmoSphere = sphere;
        this.activeLevelNode = node;
        this.isEditingGizmo = true;
        this.isDraggingGizmo = false;
        this.originalValueBeforeEdit = currentZ_mm;
        this.badgeFixedPos = null;

        this._showBadge(currentZ_mm, accentHex);

        const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
        if (input) {
            setTimeout(() => {
                input.focus();
                input.select();
            }, 40);
        }
    }

    /**
     * Otwiera pływające okno edycji wysokości Z dla wskazanego poziomu (np. po dodaniu z PPM).
     */
    public openFloatingInputForLevel(levelId: string): void {
        this.syncFromDocument();
        const entry = this.levelsMap.get(levelId);
        const doc = ContextManager.instance?.document as ProjectDocument | null;
        const node = doc?.findNode(levelId) ?? null;
        if (!entry || !node) return;
        const z_nm = (node.domainData as any)?.z_nm ?? node.localMatrix.getTranslation().z ?? 0;
        const z_mm = Math.max(50, Math.round(nmToMm(z_nm)));
        this.openFloatingInput(entry.sphere, node, z_mm, entry.theme.hex);
    }

    /**
     * Oblicza pozycję 2D na ekranie obok sfery (1:1 algorytm z gizmo-controller.ts:200-217).
     */
    private _updateBadgePosition(): void {
        if (!this.activeGizmoSphere || !this.viewport || !this.viewport.scene) return;
        const badge = document.getElementById('gizmo-floating-input');
        const canvas = this.viewport.canvas;
        if (!badge || !canvas) return;

        if (this.isEditingGizmo && this.badgeFixedPos) {
            badge.style.left = `${this.badgeFixedPos.left}px`;
            badge.style.top = `${this.badgeFixedPos.top}px`;
            badge.style.display = 'flex';
            return;
        }

        if (this.activeGizmoSphere.computeWorldMatrix) {
            this.activeGizmoSphere.computeWorldMatrix(true);
        }
        const pos = this.activeGizmoSphere.getAbsolutePosition
            ? this.activeGizmoSphere.getAbsolutePosition()
            : (this.activeGizmoSphere.absolutePosition || this.activeGizmoSphere.position);

        const screenPos = BABYLON.Vector3.Project(
            pos,
            BABYLON.Matrix.Identity(),
            this.viewport.scene.getTransformMatrix(),
            this.viewport.scene.activeCamera.viewport.toGlobal(
                this.viewport.engine.getRenderWidth(),
                this.viewport.engine.getRenderHeight()
            )
        );

        if (screenPos.z < 0 || screenPos.z > 1) {
            badge.style.display = 'none';
            return;
        }

        const canvasRect = canvas.getBoundingClientRect();
        const curLeft = canvasRect.left + screenPos.x + 20;
        const curTop = canvasRect.top + screenPos.y - 45;

        badge.style.left = `${curLeft}px`;
        badge.style.top = `${curTop}px`;
        badge.style.display = 'flex';

        if (this.isEditingGizmo && !this.badgeFixedPos) {
            this.badgeFixedPos = { left: curLeft, top: curTop };
        }
    }

    /**
     * Render loop tracking — aktualizuje pozycję okna w każdej klatce (jak w gizmo-controller.ts).
     */
    private _setupRenderTracking(): void {
        this.beforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
            this._ensureDocSubscription();
            if (this.needsLiveSolve) {
                this.needsLiveSolve = false;
                const solver = (ContextManager.instance as any)?.solverController;
                if (solver?.solveInteractive) {
                    solver.solveInteractive();
                } else {
                    solver?.solveNow?.();
                }
            }
            if ((window as any).__glcGizmoActive && this.activeGizmoSphere) {
                this._updateBadgePosition();
            }
        });
    }

    /**
     * Parsuje i zatwierdza wartość z inputu (obsługa cyfr i wyrażeń np. 820+38).
     * Wymusza minimalny dystans 50 mm od dołu osi Z.
     */
    private _applyInputValue(expr: string): void {
        if (!expr) return;

        const cleaned = expr.replace(/,/g, '.').trim();
        if (!/^[0-9\s\+\-\*/\.\(\)]+$/.test(cleaned)) return;

        try {
            const fn = new Function(`"use strict"; return (${cleaned});`);
            const res = fn();
            if (typeof res !== 'number' || isNaN(res) || !isFinite(res)) return;

            if (this.activeLevelNode) {
                // Poziom Z z drzewa — minimalny dystans od dołu to 50 mm
                const finalZ_mm = Math.max(50, Math.round(res));
                const finalZ_nm = mmToNm(finalZ_mm);
                this.activeLevelNode.setLocalTransform(new Vec3(0, 0, finalZ_nm), Quat.IDENTITY);
                if (this.activeLevelNode.domainData) {
                    (this.activeLevelNode.domainData as any).z_nm = finalZ_nm;
                }

                const doc = ContextManager.instance?.document as ProjectDocument | null;
                if (doc) {
                    doc.emitChange('structure', [this.activeLevelNode.id]);
                    (doc as any)?.markDirty?.();
                    doc.notifyDocumentChanged();
                }

                (ContextManager.instance as any)?.solverController?.solveNow?.();
                this.syncFromDocument();
            }

            this.viewport.requestRender();
        } catch {
            // Ignorujemy błędy składni
        }
    }

    public syncFromDocument(): void {
        const doc = ContextManager.instance?.document as ProjectDocument | null;
        if (!doc) return;

        const glcNode = doc.getGlcNode();
        if (!glcNode) {
            this._clearAllLevels();
            return;
        }

        const isGlcVisible = (glcNode.domainData as any)?.visible !== false;
        if (this.rootNode) {
            this.rootNode.setEnabled(isGlcVisible);
        }
        if (this.viewport && this.viewport.axes) {
            this.viewport.axes.forEach((axis: any) => {
                if (axis) {
                    axis.setEnabled(isGlcVisible);
                    axis.isVisible = isGlcVisible;
                }
            });
        }
        if (!isGlcVisible) {
            if ((typeof window !== 'undefined' && (window as any).__glcGizmoActive) || this.isEditingGizmo || this.isDraggingGizmo) {
                const badge = document.getElementById('gizmo-floating-input');
                const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
                if (badge && input) {
                    this._hideBadge(badge, input);
                }
            }
            this.viewport?.requestRender?.();
            return;
        }

        const showAxisZ = (glcNode.domainData as any)?.showAxisZ !== false;
        if (this.shaftMesh) this.shaftMesh.setEnabled(showAxisZ);
        if (this.arrowHead) this.arrowHead.setEnabled(showAxisZ);
        if (this.baseRing) this.baseRing.setEnabled(showAxisZ);

        const currentLevelIds = new Set<string>();
        let levelIndex = 0;

        for (const child of glcNode.children) {
            if (child.nodeType !== NodeType.DATUM_LEVEL) continue;

            currentLevelIds.add(child.id);
            const z_nm = (child.domainData as any)?.z_nm ?? child.localMatrix.getTranslation().z ?? 0;
            const z_mm = Math.max(50, Math.round(nmToMm(z_nm)));
            const isVisible = (child.domainData as any)?.visible !== false;
            const colorHex = (child.domainData as any)?.color;
            const theme = getLevelColorTheme(levelIndex, colorHex);
            const name = child.name || `Poziom ${z_mm} mm`;

            let entry = this.levelsMap.get(child.id);
            if (!entry) {
                entry = this._createLevelVisual(child, z_mm, name, theme, isVisible);
                this.levelsMap.set(child.id, entry);
            } else {
                this._updateLevelVisual(entry, child, z_mm, theme, isVisible);
            }
            levelIndex++;
        }

        for (const [id, entry] of this.levelsMap.entries()) {
            if (!currentLevelIds.has(id)) {
                this._disposeLevelVisual(entry);
                this.levelsMap.delete(id);
            }
        }

        if (!this.isDraggingGizmo) {
            this._updateMastHeightFromLevels();
        }

        this.viewport.requestRender();
    }

    private _createLevelVisual(
        node: CADNode,
        z_mm: number,
        name: string,
        theme: LevelColorTheme,
        isVisible: boolean
    ): LevelVisualEntry {
        // 1. Sfera uchwytu poziomu
        const sphere = BABYLON.MeshBuilder.CreateSphere(`glc_sphere_${node.id}`, {
            diameter: 30,
            segments: 16,
        }, this.scene);

        const sphereMat = new BABYLON.StandardMaterial(`glc_sphere_mat_${node.id}`, this.scene);
        sphereMat.diffuseColor = new BABYLON.Color3(theme.sphereDiffuse.r, theme.sphereDiffuse.g, theme.sphereDiffuse.b);
        sphereMat.emissiveColor = new BABYLON.Color3(theme.sphereEmissive.r, theme.sphereEmissive.g, theme.sphereEmissive.b);
        sphereMat.specularColor = new BABYLON.Color3(0.6, 0.8, 0.95);
        sphere.material = sphereMat;
        sphere.position.set(0, z_mm, 0);
        sphere.parent = this.rootNode;
        sphere.isPickable = isVisible;
        sphere.setEnabled(isVisible);
        sphere.renderingGroupId = 2;
        sphere.metadata = {
            type: 'datum_level',
            id: node.id,
            name,
            node,
        };

        // 2. Pozioma płaszczyzna odniesienia XY w kolorze motywu
        const planeSize = 1000;
        const plane = BABYLON.MeshBuilder.CreatePlane(`glc_plane_${node.id}`, {
            size: planeSize,
        }, this.scene);
        plane.rotation.x = Math.PI / 2;
        plane.position.set(0, z_mm, 0);
        plane.parent = this.rootNode;

        const planeMat = new BABYLON.StandardMaterial(`glc_plane_mat_${node.id}`, this.scene);
        planeMat.diffuseColor = new BABYLON.Color3(theme.planeDiffuse.r, theme.planeDiffuse.g, theme.planeDiffuse.b);
        planeMat.emissiveColor = new BABYLON.Color3(theme.planeEmissive.r, theme.planeEmissive.g, theme.planeEmissive.b);
        planeMat.alpha = 0.08;
        planeMat.backFaceCulling = false;
        plane.material = planeMat;
        const isPlaneVisible = Boolean((node.domainData as any)?.visiblePlane);
        plane.isPickable = false;
        plane.setEnabled(isPlaneVisible);
        plane.isVisible = isPlaneVisible;
        plane.metadata = {
            type: 'datum_level_plane',
            id: node.id,
            name,
            node,
        };

        plane.enableEdgesRendering();
        plane.edgesWidth = 1.3;
        plane.edgesColor = new BABYLON.Color4(theme.edgeColor.r, theme.edgeColor.g, theme.edgeColor.b, theme.edgeColor.a);

        // 3. PointerDragBehavior (natywne przeciąganie wzdłuż osi Y)
        const dragBehavior = new BABYLON.PointerDragBehavior({
            dragAxis: new BABYLON.Vector3(0, 1, 0),
        });
        dragBehavior.dragDeltaRatio = 1.0;
        dragBehavior.useObjectOrientationForDragging = false;

        dragBehavior.onDragStartObservable.add(() => {
            (window as any).__glcGizmoActive = true;
            this.isDraggingGizmo = true;
            this.isEditingGizmo = false;
            this.activeGizmoSphere = sphere;
            this.activeLevelNode = node;
            this.badgeFixedPos = null;
            this.activeThemeHex = theme.hex;
            this.originalValueBeforeEdit = Math.round(sphere.position.y);
            this.lastDraggedZ_mm = this.originalValueBeforeEdit;
            this.viewport.camera?.detachControl();

            sphereMat.emissiveColor = new BABYLON.Color3(
                Math.min(1, theme.sphereEmissive.r * 1.5 + 0.1),
                Math.min(1, theme.sphereEmissive.g * 1.5 + 0.1),
                Math.min(1, theme.sphereEmissive.b * 1.5 + 0.1)
            );
            planeMat.alpha = 0.22;

            // Wyświetla bieżący wymiar na starcie przeciągania z obramowaniem w kolorze sfery
            this._showBadge(this.originalValueBeforeEdit, theme.hex);
        });

        dragBehavior.onDragObservable.add(() => {
            sphere.position.x = 0;
            sphere.position.z = 0;
            // Minimalny dystans osi Z to 50 mm od dołu
            if (sphere.position.y < 50) {
                sphere.position.y = 50;
            }

            const currentZ = Math.round(sphere.position.y);
            if (currentZ === this.lastDraggedZ_mm) {
                return;
            }
            this.lastDraggedZ_mm = currentZ;
            plane.position.y = currentZ;

            const liveZ_nm = mmToNm(currentZ);
            node.setLocalTransform(new Vec3(0, 0, liveZ_nm), Quat.IDENTITY);
            if (node.domainData) {
                (node.domainData as any).z_nm = liveZ_nm;
            }
            this.needsLiveSolve = true;

            this._updateMastHeightFromLevels();
            this._updateBadgeValue(currentZ);
            this._updateBadgePosition();
            this.viewport.requestRender();
        });

        dragBehavior.onDragEndObservable.add(() => {
            this.isDraggingGizmo = false;
            this.needsLiveSolve = false;
            this.viewport.camera?.attachControl(this.viewport.canvas, true);

            sphereMat.emissiveColor = new BABYLON.Color3(theme.sphereEmissive.r, theme.sphereEmissive.g, theme.sphereEmissive.b);
            planeMat.alpha = 0.08;

            const finalZ_mm = Math.max(50, Math.round(sphere.position.y));
            sphere.position.y = finalZ_mm;
            plane.position.y = finalZ_mm;
            const finalZ_nm = mmToNm(finalZ_mm);

            node.setLocalTransform(new Vec3(0, 0, finalZ_nm), Quat.IDENTITY);
            if (node.domainData) {
                (node.domainData as any).z_nm = finalZ_nm;
            }

            this._updateMastHeightFromLevels();

            const doc = ContextManager.instance?.document as ProjectDocument | null;
            if (doc) {
                doc.emitChange('structure', [node.id]);
                (doc as any)?.markDirty?.();
                doc.notifyDocumentChanged();
            }

            (ContextManager.instance as any)?.solverController?.solveNow?.();
            UIController.instance?.emitTree('select-node', { id: node.id });
            this.viewport.requestRender();

            // Otwórz okno do ewentualnego doprecyzowania z klawiatury
            this.openFloatingInput(sphere, node, finalZ_mm, theme.hex);
        });

        // 4. ActionManager na sferze poziomu (hover + click)
        sphere.actionManager = new BABYLON.ActionManager(this.scene);
        sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPointerOverTrigger,
            () => {
                sphere.scaling.setAll(1.2);
                if (!this.isDraggingGizmo && !this.isEditingGizmo) {
                    this.activeGizmoSphere = sphere;
                    this.activeLevelNode = node;
                    this._showBadge(Math.round(sphere.position.y), theme.hex);
                }
            }
        ));
        sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPointerOutTrigger,
            () => {
                sphere.scaling.setAll(1.0);
                if (!this.isDraggingGizmo && !this.isEditingGizmo) {
                    const badge = document.getElementById('gizmo-floating-input');
                    const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
                    if (badge && input) {
                        this._hideBadge(badge, input);
                    }
                }
            }
        ));
        sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPickTrigger,
            () => {
                if (ContextManager.instance?.activeConstraintPicker) {
                    if (handleConstraintPickEvent('select', { mesh: sphere, datumLevelNode: node })) {
                        return;
                    }
                }
                if (!this.isDraggingGizmo) {
                    this.openFloatingInput(sphere, node, Math.round(sphere.position.y), theme.hex);
                }
            }
        ));

        sphere.addBehavior(dragBehavior);

        return {
            levelId: node.id,
            sphere,
            plane,
            dragBehavior,
            theme,
        };
    }

    /**
     * Aktualizuje pozycję, motyw kolorystyczny i widoczność istniejącego poziomu.
     */
    private _updateLevelVisual(
        entry: LevelVisualEntry,
        node: CADNode,
        z_mm: number,
        theme: LevelColorTheme,
        isVisible: boolean
    ): void {
        entry.theme = theme;
        if (!this.isDraggingGizmo) {
            entry.sphere.position.y = z_mm;
            entry.plane.position.y = z_mm;
        }

        const isPlaneVisible = Boolean((node.domainData as any)?.visiblePlane);
        entry.sphere.setEnabled(isVisible);
        entry.sphere.isPickable = isVisible;
        entry.plane.setEnabled(isPlaneVisible);
        entry.plane.isVisible = isPlaneVisible;

        // Aktualizacja kolorów w materiałach
        if (entry.sphere.material) {
            entry.sphere.material.diffuseColor.set(theme.sphereDiffuse.r, theme.sphereDiffuse.g, theme.sphereDiffuse.b);
            entry.sphere.material.emissiveColor.set(theme.sphereEmissive.r, theme.sphereEmissive.g, theme.sphereEmissive.b);
        }
        if (entry.plane.material) {
            entry.plane.material.diffuseColor.set(theme.planeDiffuse.r, theme.planeDiffuse.g, theme.planeDiffuse.b);
            entry.plane.material.emissiveColor.set(theme.planeEmissive.r, theme.planeEmissive.g, theme.planeEmissive.b);
            entry.plane.edgesColor.set(theme.edgeColor.r, theme.edgeColor.g, theme.edgeColor.b, theme.edgeColor.a);
        }
    }

    private _disposeLevelVisual(entry: LevelVisualEntry): void {
        entry.sphere.dispose();
        entry.plane.dispose();
    }

    private _clearAllLevels(): void {
        for (const entry of this.levelsMap.values()) {
            this._disposeLevelVisual(entry);
        }
        this.levelsMap.clear();
    }

    /**
     * Podświetla płaszczyznę wskazanego poziomu Z podczas przyciągania (snap) szafki lub narożnika.
     */
    public highlightLevelPlane(levelId: string | null): void {
        for (const [id, entry] of this.levelsMap.entries()) {
            const isTarget = Boolean(levelId && id === levelId);
            const isPlaneVisible = isTarget || Boolean((entry.plane?.metadata?.node?.domainData as any)?.visiblePlane);
            if (entry.plane) {
                entry.plane.setEnabled(isPlaneVisible);
                entry.plane.isVisible = isPlaneVisible;
            }
            const theme = entry.theme;
            if (entry.plane?.material) {
                entry.plane.material.alpha = isTarget ? 0.45 : 0.08;
                entry.plane.material.emissiveColor = isTarget
                    ? new BABYLON.Color3(
                        Math.min(1, theme.planeEmissive.r * 2.2 + 0.15),
                        Math.min(1, theme.planeEmissive.g * 2.2 + 0.15),
                        Math.min(1, theme.planeEmissive.b * 2.2 + 0.15)
                    )
                    : new BABYLON.Color3(theme.planeEmissive.r, theme.planeEmissive.g, theme.planeEmissive.b);
            }
            if (entry.plane) {
                entry.plane.edgesWidth = isTarget ? 4.0 : 1.3;
                entry.plane.edgesColor = isTarget
                    ? new BABYLON.Color4(
                        Math.min(1, theme.edgeColor.r * 1.5 + 0.1),
                        Math.min(1, theme.edgeColor.g * 1.5 + 0.1),
                        Math.min(1, theme.edgeColor.b * 1.5 + 0.1),
                        1.0
                    )
                    : new BABYLON.Color4(theme.edgeColor.r, theme.edgeColor.g, theme.edgeColor.b, theme.edgeColor.a);
            }
            if (entry.sphere) {
                entry.sphere.scaling.setAll(isTarget ? 1.35 : 1.0);
            }
        }
        this.viewport?.requestRender?.();
    }

    public setVisible(visible: boolean): void {
        if (this.rootNode) {
            this.rootNode.setEnabled(visible);
        }
        if (this.viewport && this.viewport.axes) {
            this.viewport.axes.forEach((axis: any) => {
                if (axis) {
                    axis.setEnabled(visible);
                    axis.isVisible = visible;
                }
            });
        }
        if (!visible) {
            if ((typeof window !== 'undefined' && (window as any).__glcGizmoActive) || this.isEditingGizmo || this.isDraggingGizmo) {
                const badge = document.getElementById('gizmo-floating-input');
                const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
                if (badge && input) {
                    this._hideBadge(badge, input);
                }
            }
        }
        this.viewport?.requestRender?.();
    }

    public dispose(): void {
        (window as any).__glcGizmoActive = false;
        if (this.beforeRenderObserver) {
            this.scene.onBeforeRenderObservable.remove(this.beforeRenderObserver);
        }
        if (this.unsubscribeDoc) {
            this.unsubscribeDoc();
            this.unsubscribeDoc = null;
        }
        this._clearAllLevels();
        if (this.rootNode) {
            this.rootNode.dispose();
            this.rootNode = null;
        }
    }
}
