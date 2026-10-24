/**
 * SmartPanel Web — A1_Core Face & Subgeometry Picker
 * 
 * Silnik selekcji 3D pozwalający na wybieranie:
 *   - Całych obiektów (PanelModel) w trybie 'object'
 *   - Podgeometrii (ściany, krawędzie, naroża/wierzchołki 0..7, cechy CAM) w trybie 'subgeometry'
 */

import { ContextManager } from './context-manager.js';
import { PerformanceConfigManager } from './performance-config.js';
import { shouldPromoteSubgeometryToEntity } from './selection-mode.js';
import { findFacesAlongRay } from './quick-pick/quick-pick-detector.js';
import { openQuickPick } from './quick-pick/quick-pick-events.js';
import type { QuickPickCandidate } from './quick-pick/quick-pick-types.js';
import { getGrooveParamsMm } from './groove-params.js';
import { normalizeFaceName } from './face-name.js';

declare const BABYLON: any;

function shouldPromotePickToActiveEntity(): boolean {
    const cm = ContextManager.instance;
    if (cm.activeReferencePicker || cm.activeConstraintPicker) {
        return false;
    }
    return shouldPromoteSubgeometryToEntity(cm.activeTab);
}

function isPickingReference(): boolean {
    return Boolean(ContextManager.instance.activeReferencePicker);
}

function sortFaceHitsForPick(hits: any[]): any[] {
    const pickingRef = isPickingReference();
    return hits.slice().sort((a: any, b: any) => {
        if (pickingRef) {
            const aName = String(a.pickedMesh?.metadata?.faceName || '').toUpperCase();
            const bName = String(b.pickedMesh?.metadata?.faceName || '').toUpperCase();
            const aOut = aName.startsWith('OUTLINE_') ? 0 : 1;
            const bOut = bName.startsWith('OUTLINE_') ? 0 : 1;
            if (aOut !== bOut && Math.abs(a.distance - b.distance) < 2) return aOut - bOut;
            const aFeat = a.pickedMesh?.metadata?.type === 'feature' ? 1 : 0;
            const bFeat = b.pickedMesh?.metadata?.type === 'feature' ? 1 : 0;
            if (aFeat !== bFeat && Math.abs(a.distance - b.distance) < 0.5) return aFeat - bFeat;
            return a.distance - b.distance;
        }
        const aFeat = a.pickedMesh.metadata?.type === 'feature' ? 0 : 1;
        const bFeat = b.pickedMesh.metadata?.type === 'feature' ? 0 : 1;
        if (aFeat !== bFeat && Math.abs(a.distance - b.distance) < 0.5) {
            return aFeat - bFeat;
        }
        return a.distance - b.distance;
    });
}

function isMeshHierarchicallyEnabled(mesh: any): boolean {
    let curr = mesh;
    while (curr) {
        if (curr.isEnabled && !curr.isEnabled()) return false;
        curr = curr.parent;
    }
    return true;
}

/** Klik w obszar UV wpustu na FACE → ta sama operacja (gdy ray nie trafił w feature_*). */
function findGrooveFeatureAtUv(panel: any, faceName: string, uv: { u: number; v: number } | null): any | null {
    if (!panel?.features || !uv) return null;
    const face = normalizeFaceName(faceName);
    for (const f of panel.features) {
        if (!f || (f.type !== 'groove' && f.type !== 'pocket' && f.type !== 'cutout')) continue;
        if (f.visible === false || f.params?.visible === false) continue;
        if (f.face !== face) continue;
        const gp = getGrooveParamsMm(f.params);
        if (
            uv.u >= gp.u && uv.u <= gp.u + gp.width &&
            uv.v >= gp.v && uv.v <= gp.v + gp.length
        ) {
            return f;
        }
    }
    return null;
}

export class FacePicker {
    private scene: any;
    private canvas: any;
    private panelViews: Map<any, any>;
    private document: any;
    private _listeners: Set<Function>;

    public enabled: boolean;
    public selectionMode: 'object' | 'subgeometry';
    public targetSubgeometryType: 'edge' | 'vertex' | 'face' | null = null;

    public selectedFace: any = null;
    public selectedFaces: Set<any> = new Set();
    public selectedEdge: any = null;
    public selectedEdges: Set<any> = new Set();
    public selectedVertex: any = null;
    public selectedVertices: Set<any> = new Set();
    public selectedFeature: any = null;
    public selectedFeatures: Set<any> = new Set();

    private _hoveredFace: any = null;
    private _hoveredEntity: any = null;
    public cursorUV: { u: number; v: number } | null = null;
    private _pointerObserver: any = null;
    private _lastHoverTime: number = 0;
    /** Słabo widoczne wszystkie naroża — pipeta VERTEX w solverze. */
    private _vertexPickPreview = false;

    private _longPressTimer: any = null;
    private _pointerDownPos: { x: number; y: number } | null = null;
    private _longPressTriggered = false;

    constructor(scene: any, canvas: any, panelViews: Map<any, any>, document: any) {
        this.scene = scene;
        this.canvas = canvas;
        this.panelViews = panelViews;
        this.document = document;
        this._listeners = new Set();

        this.enabled = true;
        this.selectionMode = 'object';

        this._setupPointerEvents();
    }

    private _setupPointerEvents(): void {
        if (!this.scene) return;

        if (this._pointerObserver) {
            this.scene.onPointerObservable.remove(this._pointerObserver);
        }

        this._pointerObserver = this.scene.onPointerObservable.add((pointerInfo: any) => {
            if (!this.enabled) return;

            const type = pointerInfo.type;
            const evt = pointerInfo.event;

            // ─── 1. HOVER (RUCH MYSZY) ───────────────────────────────────
            if (type === BABYLON.PointerEventTypes.POINTERMOVE) {
                // Jeśli użytkownik przeciąga myszą z wciśniętym przyciskiem (np. obraca lub przesuwa kamerę),
                // pomijamy obciążający multiPick, co zapewnia idealnie płynne obracanie 60 FPS.
                if (evt && evt.buttons !== 0) {
                    return;
                }

                if (this.selectionMode === 'object' && !isPickingReference()) {
                    this._clearHoverHighlights();
                    return;
                }

                const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
                const throttleMs = PerformanceConfigManager.instance.getThrottleHoverMs();
                if (now - this._lastHoverTime < throttleMs) {
                    return;
                }
                this._lastHoverTime = now;

                // Priorytet 1: Narożniki, krawędzie, cechy CAM (z tolerancją próbkowania ekranowego 18px)
                // Referencja Bloki: tylko ściany (wcięcie L = OUTLINE_SIDE, nie krawędź B-rep).
                let pickResult = (this.targetSubgeometryType === 'face' || isPickingReference())
                    ? null
                    : this._pickSubgeometryWithTolerance(this.scene.pointerX, this.scene.pointerY);

                // Priorytet 2: Ściany 3D formatki (+ datum przy pipetcie FACE)
                if (
                    (!pickResult || !pickResult.hit) &&
                    this.targetSubgeometryType !== 'edge' &&
                    this.targetSubgeometryType !== 'vertex'
                ) {
                    const pickingDatumFace =
                        ContextManager.instance.activeConstraintPicker?.expectedKind === 'FACE';
                    const faceHits = this.scene.multiPick(
                        this.scene.pointerX,
                        this.scene.pointerY,
                        (mesh: any) => {
                            if (!mesh || !isMeshHierarchicallyEnabled(mesh) || !mesh.metadata) return false;
                            if (pickingDatumFace && mesh.metadata.type === 'datum_plane') {
                                return mesh.isPickable !== false;
                            }
                            if (!mesh.metadata.faceName) return false;
                            const pVis = mesh.metadata.panelModel ? mesh.metadata.panelModel.visible !== false : true;
                            const mVis = mesh.metadata.model ? mesh.metadata.model.visible !== false : true;
                            return pVis && mVis;
                        }
                    );
                    if (faceHits && faceHits.length > 0) {
                        const validFaceHits = faceHits.filter((h: any) => h.hit && h.pickedMesh);
                        if (validFaceHits.length > 0) {
                            pickResult = sortFaceHitsForPick(validFaceHits)[0];
                        }
                    }
                }

                const newFace = (pickResult && pickResult.hit) ? pickResult.pickedMesh.metadata.faceName : null;
                const smartId = (pickResult && pickResult.hit) ? pickResult.pickedMesh.metadata.smartId : null;
                const isDatumHover =
                    pickResult?.hit &&
                    pickResult.pickedMesh?.metadata?.type === 'datum_plane' &&
                    ContextManager.instance.activeConstraintPicker?.expectedKind === 'FACE';

                if (newFace && pickResult.pickedPoint) {
                    const panelModel = pickResult.pickedMesh ? pickResult.pickedMesh.metadata.panelModel : null;
                    this.cursorUV = this._worldToFaceUV(newFace, pickResult.pickedPoint, panelModel);
                } else {
                    this.cursorUV = null;
                }

                if (this._hoveredEntity && (!pickResult || !pickResult.hit || this._hoveredEntity !== pickResult.pickedMesh)) {
                    if (!this._hoveredEntity.isDisposed() && this._hoveredEntity.metadata) {
                        if (this._hoveredEntity.metadata.type === 'vertex') {
                            if (!this.selectedVertices.has(this._hoveredEntity)) {
                                this._setVertexHoverVisual(this._hoveredEntity, false);
                            }
                        } else if (this._hoveredEntity.metadata.type === 'edge') {
                            if (!this.selectedEdges.has(this._hoveredEntity)) {
                                this._hoveredEntity.material.emissiveColor = this._hoveredEntity.metadata.baseColor || BABYLON.Color3.Black();
                                this._hoveredEntity.material.diffuseColor = this._hoveredEntity.metadata.baseDiffuse || new BABYLON.Color3(0.2, 0.2, 0.2);
                            }
                        } else if (this._hoveredEntity.metadata.type === 'feature') {
                            if (!this.selectedFeatures.has(this._hoveredEntity)) {
                                this._hoveredEntity.material.emissiveColor = this._hoveredEntity.metadata.baseColor || BABYLON.Color3.Black();
                                this._hoveredEntity.material.diffuseColor = this._hoveredEntity.metadata.baseDiffuse || new BABYLON.Color3(0.25, 0.2, 0.15);
                            }
                        } else if (this._hoveredEntity.metadata.type === 'datum_plane') {
                            this._setDatumHoverVisual(this._hoveredEntity, false);
                        }
                    }
                    this._hoveredEntity = null;
                }

                if (pickResult && pickResult.hit && pickResult.pickedMesh.metadata.type) {
                    const metaType = pickResult.pickedMesh.metadata.type;
                    this._hoveredEntity = pickResult.pickedMesh;

                    if (metaType === 'vertex') {
                        this._emit('hover-vertex', { mesh: pickResult.pickedMesh, point: pickResult.pickedPoint, smartId });
                        // SolidWorks: naroże / krawędź / ściana — bez podświetlenia na hover.
                        // Wyjątek: pipeta naroży albo filtr wyłącznie „vertex”.
                        if (
                            !this.selectedVertices.has(this._hoveredEntity) &&
                            (this._vertexPickPreview || this.targetSubgeometryType === 'vertex')
                        ) {
                            this._setVertexHoverVisual(this._hoveredEntity, true);
                        }
                    } else if (metaType === 'edge') {
                        this._emit('hover-edge', { mesh: pickResult.pickedMesh, point: pickResult.pickedPoint, smartId });
                        if (!this.selectedEdges.has(this._hoveredEntity)) {
                            // Brak podświetlania (hover) — jak naroże i ściana
                        }
                    } else if (metaType === 'feature') {
                        this._emit('hover-feature', { 
                            mesh: pickResult.pickedMesh, 
                            point: pickResult.pickedPoint, 
                            smartId, 
                            featureId: pickResult.pickedMesh.metadata.featureId,
                            subType: pickResult.pickedMesh.metadata.subType 
                        });
                        if (!this.selectedFeatures.has(this._hoveredEntity)) {
                            // Brak podświetlania (hover)
                        }
                    } else if (metaType === 'datum_plane' && isDatumHover) {
                        this._setDatumHoverVisual(this._hoveredEntity, true);
                        this._emit('hover-datum', {
                            name: pickResult.pickedMesh.metadata.name,
                            point: pickResult.pickedPoint,
                            mesh: pickResult.pickedMesh,
                        });
                    }
                }

                if (this._hoveredFace && (!pickResult || !pickResult.hit || this._hoveredFace !== pickResult.pickedMesh || isDatumHover)) {
                    if (!this.selectedFaces.has(this._hoveredFace)) {
                        this._setFaceHighlight(this._hoveredFace, 'none');
                    }
                    this._hoveredFace = null;
                }

                if (newFace && !isDatumHover && this._hoveredFace !== pickResult.pickedMesh) {
                    this._hoveredFace = pickResult.pickedMesh;
                    if (!this.selectedFaces.has(this._hoveredFace)) {
                        this._setFaceHighlight(this._hoveredFace, 'hover');
                    }
                    this._emit('hover', { 
                        face: newFace, 
                        point: pickResult.pickedPoint, 
                        uv: this.cursorUV, 
                        smartId,
                        panelModel: pickResult.pickedMesh.metadata.panelModel
                    });
                }
            } else if (type === BABYLON.PointerEventTypes.POINTERDOWN) {
                const isConstraintOrRef = Boolean(ContextManager.instance.activeConstraintPicker || ContextManager.instance.activeReferencePicker);
                if (isConstraintOrRef && evt && evt.button === 0) {
                    this._pointerDownPos = { x: this.scene.pointerX, y: this.scene.pointerY };
                    this._longPressTriggered = false;
                    if (this._longPressTimer) clearTimeout(this._longPressTimer);
                    this._longPressTimer = setTimeout(() => {
                        const candidates = findFacesAlongRay(this.scene, this.scene.pointerX, this.scene.pointerY);
                        if (candidates.length > 1) {
                            this._longPressTriggered = true;
                            openQuickPick({
                                screenX: evt.clientX ?? this.scene.pointerX,
                                screenY: evt.clientY ?? this.scene.pointerY,
                                candidates,
                                onSelect: (candidate) => {
                                    this.selectFaceExplicit(
                                        candidate.mesh,
                                        candidate.worldPoint,
                                        candidate.smartId,
                                        candidate.panelModel,
                                        candidate.worldNormal
                                    );
                                }
                            });
                        }
                    }, 350);
                }
            } else if (type === BABYLON.PointerEventTypes.POINTERUP) {
                if (this._longPressTimer) {
                    clearTimeout(this._longPressTimer);
                    this._longPressTimer = null;
                }
            }
        });

        // Skrót Q usunięty — Wybierz zakrytą tylko przez PPM.
    }

    public selectFaceExplicit(
        mesh: any,
        worldPoint: any,
        smartId: any,
        panelModel: any = null,
        worldNormal: any = null,
    ): void {
        this._selectFace(mesh, worldPoint, smartId, panelModel, false, worldNormal);
    }

    public pickAllFacesUnderCursor(pointerX?: number, pointerY?: number): QuickPickCandidate[] {
        const x = pointerX !== undefined ? pointerX : this.scene?.pointerX;
        const y = pointerY !== undefined ? pointerY : this.scene?.pointerY;
        return findFacesAlongRay(this.scene, x, y);
    }

    public handlePointerDown(pointerX: number, pointerY: number, evt: any): void {
        if (!this.enabled) return;

        if (this._longPressTriggered) {
            this._longPressTriggered = false;
            return;
        }

        // Ignoruj tylko kulki przesuwania CAD (nie ignoruj bazy WCS ani formatki)
        const directPick = this.scene.pick(pointerX, pointerY);
        if (directPick && directPick.hit && directPick.pickedMesh) {
            const name = directPick.pickedMesh.name || "";
            if (name.startsWith('faceGizmoSphere_') || name === 'freeDragSphere' || name.startsWith('freeDragCenterSphere') || name.startsWith('positionGizmo') || name.includes('Gizmo') || name.includes('gizmo') || name.startsWith('groove_dim_handle_') || directPick.pickedMesh.metadata?.type === 'edge-dim-handle') {
                return;
            }
        }

        const isMulti = Boolean(evt && (evt.ctrlKey || evt.metaKey));

        // Uchwyty SmartPart: mesh parametryczny (type=smartpart_handle) nie ma faceName —
        // face multiPick go pomija, więc w trybie object wybieramy go z directPick.
        if (
            this.selectionMode === 'object' &&
            !isPickingReference() &&
            !ContextManager.instance.activeConstraintPicker &&
            directPick?.hit &&
            directPick.pickedMesh?.metadata?.type === 'smartpart_handle'
        ) {
            const nodeId = directPick.pickedMesh.metadata.nodeId as string | undefined;
            const node = nodeId ? this.document?.findNode?.(nodeId) : null;
            const handleModel = node?.domainData ?? directPick.pickedMesh.metadata.model;
            if (handleModel && shouldPromotePickToActiveEntity()) {
                this._clearSelectionExcept(null);
                this.selectedFace = null;
                this.selectedFaces.clear();
                this.document.setActiveEntity(handleModel);
            }
            return;
        }

        // Priorytet 1: Narożniki, krawędzie, cechy CAM (z tolerancją próbkowania ekranowego 18px)
        let pickResult = (this.targetSubgeometryType === 'face' || isPickingReference())
            ? null
            : this._pickSubgeometryWithTolerance(pointerX, pointerY);

        if (
            (!pickResult || !pickResult.hit) &&
            this.targetSubgeometryType !== 'edge' &&
            this.targetSubgeometryType !== 'vertex'
        ) {
            const faceHits = this.scene.multiPick(
                pointerX,
                pointerY,
                (mesh: any) => {
                    if (!mesh || !isMeshHierarchicallyEnabled(mesh) || !mesh.metadata) return false;
                    if (isPickingReference() && mesh.metadata.type === 'feature') return false;
                    const isDatum =
                        mesh.metadata.type === 'datum_plane' &&
                        ContextManager.instance.activeConstraintPicker?.expectedKind === 'FACE';
                    if (isDatum) return mesh.isPickable !== false;
                    const isFace = !!mesh.metadata.faceName;
                    const isFeature = mesh.metadata.type === 'feature';
                    if (!isFace && !isFeature) return false;
                    const pVis = mesh.metadata.panelModel ? mesh.metadata.panelModel.visible !== false : true;
                    const mVis = mesh.metadata.model ? mesh.metadata.model.visible !== false : true;
                    return pVis && mVis;
                }
            );
            if (faceHits && faceHits.length > 0) {
                const validFaceHits = faceHits.filter((h: any) => h.hit && h.pickedMesh);
                if (validFaceHits.length > 0) {
                    const pickingDatum =
                        ContextManager.instance.activeConstraintPicker?.expectedKind === 'FACE';
                    if (pickingDatum) {
                        // Najbliższy hit — datum albo ściana (bez preferowania datum z tyłu)
                        pickResult = sortFaceHitsForPick(validFaceHits)[0];
                    } else {
                        const nonDatum = validFaceHits.filter(
                            (h: any) => h.pickedMesh?.metadata?.type !== 'datum_plane'
                        );
                        pickResult = sortFaceHitsForPick(nonDatum.length ? nonDatum : validFaceHits)[0];
                    }
                }
            }
        }

        if (pickResult && pickResult.hit && pickResult.pickedMesh.metadata) {
            const smartId = pickResult.pickedMesh.metadata.smartId;
            const panelModel = pickResult.pickedMesh.metadata.panelModel;
            const meta = pickResult.pickedMesh.metadata;

            // Datum plane — tylko przy pipetcie więzów FACE
            if (
                meta.type === 'datum_plane' &&
                ContextManager.instance.activeConstraintPicker?.expectedKind === 'FACE'
            ) {
                this._emit('select', {
                    face: null,
                    smartId: null,
                    uv: null,
                    worldPoint: pickResult.pickedPoint,
                    faceData: null,
                    panelModel: null,
                    datumPlane: meta.name || pickResult.pickedMesh.name,
                    mesh: pickResult.pickedMesh,
                });
                return;
            }

            if (this.selectionMode === 'object' && !isPickingReference()) {
                const constraintPicker = ContextManager.instance.activeConstraintPicker;
                if (constraintPicker?.expectedKind === 'OBJECT') {
                    const targetModel = panelModel ?? meta?.model;
                    if (targetModel) {
                        this._emit('select', {
                            face: null,
                            smartId: meta?.smartId ?? null,
                            uv: null,
                            worldPoint: pickResult.pickedPoint,
                            faceData: null,
                            panelModel: targetModel,
                        });
                    }
                    return;
                }

                // Operacje (płaszczyzna feature_* / krawędź e_groove_*) — też w trybie object (zakładka Korpus)
                if (meta.type === 'feature' || meta.featureId) {
                    this._selectFeature(pickResult.pickedMesh, smartId, pickResult.pickedPoint, isMulti);
                    return;
                }
                if (meta.faceName && panelModel) {
                    const uv = this._worldToFaceUV(meta.faceName, pickResult.pickedPoint, panelModel);
                    const grooveFeat = findGrooveFeatureAtUv(panelModel, meta.faceName, uv);
                    if (grooveFeat) {
                        let featMesh: any = null;
                        const pv = this.panelViews?.get(panelModel) || this.panelViews?.get(panelModel.id);
                        if (pv?.faceMeshes) {
                            featMesh = Object.values(pv.faceMeshes).find(
                                (m: any) => m?.metadata?.featureId === grooveFeat.id
                            );
                        }
                        if (featMesh) {
                            this._selectFeature(featMesh, smartId, pickResult.pickedPoint, isMulti);
                        } else {
                            this._emit('select-feature', {
                                smartId,
                                worldPoint: pickResult.pickedPoint,
                                mesh: pickResult.pickedMesh,
                                featureId: grooveFeat.id,
                                panelId: panelModel.id,
                                panelModel,
                            });
                        }
                        return;
                    }
                }

                const targetModel = panelModel ?? meta?.model;
                if (targetModel && shouldPromotePickToActiveEntity()) {
                    this._clearSelectionExcept(null);
                    this.selectedFace = null;
                    this.selectedFaces.clear();
                    this.document.setActiveEntity(targetModel);
                }
                return;
            }

            if (meta.faceName) {
                if (this.targetSubgeometryType !== 'edge' && this.targetSubgeometryType !== 'vertex') {
                    const faceName = pickResult.pickedMesh.metadata.faceName;
                    const uv = this._worldToFaceUV(faceName, pickResult.pickedPoint, panelModel);
                    const grooveFeat = !this.targetSubgeometryType && !isPickingReference()
                        ? findGrooveFeatureAtUv(panelModel, faceName, uv)
                        : null;
                    if (grooveFeat) {
                        let featMesh: any = null;
                        const pv = panelModel && this.panelViews
                            ? (this.panelViews.get(panelModel) || this.panelViews.get(panelModel.id))
                            : null;
                        if (pv?.faceMeshes) {
                            featMesh = Object.values(pv.faceMeshes).find(
                                (m: any) => m?.metadata?.featureId === grooveFeat.id
                            );
                        }
                        if (featMesh) {
                            this._selectFeature(featMesh, smartId, pickResult.pickedPoint, isMulti);
                        } else {
                            this._emit('select-feature', {
                                smartId,
                                worldPoint: pickResult.pickedPoint,
                                mesh: pickResult.pickedMesh,
                                featureId: grooveFeat.id,
                                panelId: panelModel?.id || null,
                                panelModel,
                            });
                        }
                    } else {
                        const worldNormal = pickResult.getNormal ? pickResult.getNormal(true) : null;
                        this._selectFace(
                            pickResult.pickedMesh,
                            pickResult.pickedPoint,
                            smartId,
                            panelModel,
                            isMulti,
                            worldNormal,
                        );
                    }
                }
            } else if (pickResult.pickedMesh.metadata.type) {
                const metaType = pickResult.pickedMesh.metadata.type;
                if (metaType === 'edge' && this.targetSubgeometryType !== 'vertex' && this.targetSubgeometryType !== 'face') {
                    // Krawędź wpustu/otworu → ta sama operacja co płaszczyzna feature_*
                    if (pickResult.pickedMesh.metadata.featureId && !this.targetSubgeometryType) {
                        this._selectFeature(pickResult.pickedMesh, smartId, pickResult.pickedPoint, isMulti);
                    } else {
                        this._selectEdge(pickResult.pickedMesh, smartId, pickResult.pickedPoint, isMulti);
                    }
                } else if (metaType === 'vertex' && this.targetSubgeometryType !== 'edge' && this.targetSubgeometryType !== 'face') {
                    this._selectVertex(pickResult.pickedMesh, smartId, pickResult.pickedPoint, isMulti);
                } else if (metaType === 'feature' && !this.targetSubgeometryType) {
                    this._selectFeature(pickResult.pickedMesh, smartId, pickResult.pickedPoint, isMulti);
                } else if (metaType === 'container') {
                    if (shouldPromotePickToActiveEntity()) {
                        this.document.setActiveEntity(pickResult.pickedMesh.metadata.model);
                    }
                    this.clearSelection();
                }
            }
        } else {
            // Kliknięcie w puste miejsce (brak trafienia w podgeometrię z metadanymi) - odwołaj selekcję (styl SolidWorks)
            this.clearSelection();
        }
    }

    private _worldToFaceUV(faceName: string, worldPoint: any, panelModel: any = null): { u: number; v: number } | null {
        if (!faceName || !worldPoint) return null;
        try {
            const activeEntity = panelModel || this.document.activeEntity;
            if (!activeEntity || typeof activeEntity.getFace !== 'function') return null;

            const face = activeEntity.getFace(faceName);
            if (!face) return null;

            const origin = new BABYLON.Vector3(face.origin[0], face.origin[1], face.origin[2]);
            const uAxis = new BABYLON.Vector3(face.uAxis[0], face.uAxis[1], face.uAxis[2]);
            const vAxis = new BABYLON.Vector3(face.vAxis[0], face.vAxis[1], face.vAxis[2]);

            const view = this.panelViews.get(activeEntity);
            if (!view || !view.root) return null;

            const invMatrix = view.root.getWorldMatrix().clone().invert();
            const localPoint = BABYLON.Vector3.TransformCoordinates(worldPoint, invMatrix);
            const rel = localPoint.subtract(origin);

            const u = BABYLON.Vector3.Dot(rel, uAxis);
            const v = BABYLON.Vector3.Dot(rel, vAxis);

            return { u, v };
        } catch {
            return null;
        }
    }

    private _clearHoverHighlights(): void {
        if (this._hoveredEntity && !this._hoveredEntity.isDisposed()) {
            const type = this._hoveredEntity.metadata?.type;
            if (type === 'vertex') {
                if (!this.selectedVertices.has(this._hoveredEntity)) {
                    this._setVertexHoverVisual(this._hoveredEntity, false);
                }
            } else if (type === 'edge' || type === 'feature') {
                if (!this.selectedEdges.has(this._hoveredEntity) && !this.selectedFeatures.has(this._hoveredEntity)) {
                    this._hoveredEntity.material.emissiveColor = this._hoveredEntity.metadata.baseColor || BABYLON.Color3.Black();
                    this._hoveredEntity.material.diffuseColor = this._hoveredEntity.metadata.baseDiffuse || new BABYLON.Color3(0.2, 0.2, 0.2);
                }
            } else if (type === 'datum_plane') {
                this._setDatumHoverVisual(this._hoveredEntity, false);
            }
            this._hoveredEntity = null;
        }
        if (this._hoveredFace) {
            if (!this.selectedFaces.has(this._hoveredFace)) {
                this._setFaceHighlight(this._hoveredFace, 'none');
            }
            this._hoveredFace = null;
        }
    }

    private _setDatumHoverVisual(mesh: any, hovering: boolean): void {
        if (!mesh || mesh.isDisposed() || !mesh.material) return;
        const meta = mesh.metadata || {};
        const mat = mesh.material;
        if (hovering) {
            mat.alpha = 0.42;
            mat.emissiveColor = new BABYLON.Color3(0.25, 0.55, 1.0);
            mat.diffuseColor = new BABYLON.Color3(0.55, 0.75, 1.0);
            mesh.edgesWidth = 4.0;
            mesh.edgesColor = new BABYLON.Color4(0.45, 0.75, 1.0, 1.0);
        } else {
            mat.alpha = meta.baseAlpha ?? 0.12;
            mat.emissiveColor = meta.baseEmissive || new BABYLON.Color3(0.08, 0.14, 0.28);
            mat.diffuseColor = meta.baseDiffuse || new BABYLON.Color3(0.45, 0.62, 0.95);
            mesh.edgesWidth = 2.0;
            mesh.edgesColor = meta.baseEdges || new BABYLON.Color4(0.35, 0.55, 0.95, 0.85);
        }
    }

    private _setFaceHighlight(mesh: any, mode: 'none' | 'hover' | 'selected', forceBlue?: boolean): void {
        if (!mesh || mesh.isDisposed()) return;
        const mat = mesh.material;
        if (!mat) return;

        const isPickingRef = !!ContextManager.instance.activeReferencePicker;
        const isPickingConstraint = !!ContextManager.instance.activeConstraintPicker;
        const forcePickHighlight = isPickingRef || isPickingConstraint;

        if (mode === 'none') { 
            mat.emissiveColor = mesh.metadata.baseColor || BABYLON.Color3.Black();
            mat.diffuseColor = mesh.metadata.baseDiffuse || new BABYLON.Color3(0.8, 0.8, 0.8);
        } else if (mode === 'hover') {
            if (forcePickHighlight || forceBlue) {
                // Niebieska płaszczyzna przy wyborze / podglądzie referencji
                mat.emissiveColor = new BABYLON.Color3(0.1, 0.4, 0.8);
                mat.diffuseColor = new BABYLON.Color3(0.2, 0.5, 1.0);
            } else {
                // Brak podświetlenia na hover (SolidWorks style)
                mat.emissiveColor = mesh.metadata.baseColor || BABYLON.Color3.Black();
                mat.diffuseColor = mesh.metadata.baseDiffuse || new BABYLON.Color3(0.8, 0.8, 0.8);
            }
        } else if (mode === 'selected') {
            mat.emissiveColor = new BABYLON.Color3(0.4, 0.25, 0.0);
            mat.diffuseColor = new BABYLON.Color3(1.0, 0.6, 0.1);
        }
    }

    private _clearSelectionExcept(exceptType: string | null): void {
        if (exceptType !== 'faces' && this.selectedFaces.size > 0) {
            for (const face of this.selectedFaces) {
                this._setFaceHighlight(face, 'none');
            }
            this.selectedFaces.clear();
            this.selectedFace = null;
        }
        if (exceptType !== 'edges' && this.selectedEdges.size > 0) {
            for (const edge of this.selectedEdges) {
                if (edge.color !== undefined) {
                    edge.color = edge.metadata?.baseColor || BABYLON.Color3.Black();
                } else if (edge.material) {
                    edge.material.emissiveColor = edge.metadata?.baseColor || BABYLON.Color3.Black();
                    edge.material.diffuseColor = edge.metadata?.baseDiffuse || new BABYLON.Color3(0.2, 0.2, 0.2);
                }
            }
            this.selectedEdges.clear();
            this.selectedEdge = null;
        }
        if (exceptType !== 'vertices' && this.selectedVertices.size > 0) {
            for (const mesh of this.selectedVertices) {
                if (!mesh.isDisposed() && mesh.metadata) {
                    mesh.visibility = this._vertexPickPreview ? 0.28 : 0.0;
                    mesh.material.alpha = 0.0;
                    mesh.material.diffuseColor = new BABYLON.Color3(1, 0, 0);
                    mesh.material.emissiveColor = BABYLON.Color3.Black();
                }
            }
            this.selectedVertices.clear();
            this.selectedVertex = null;
            ContextManager.instance.viewport?.requestRender(2);
        }
        if (exceptType !== 'features' && this.selectedFeatures.size > 0) {
            for (const mesh of this.selectedFeatures) {
                if (!mesh.isDisposed() && mesh.metadata) {
                    mesh.material.emissiveColor = mesh.metadata.baseColor || BABYLON.Color3.Black();
                    mesh.material.diffuseColor = mesh.metadata.baseDiffuse || new BABYLON.Color3(0.25, 0.2, 0.15);
                }
            }
            this.selectedFeatures.clear();
            this.selectedFeature = null;
        }
    }

    private _selectFace(
        mesh: any,
        worldPoint: any,
        smartId: any,
        panelModel: any = null,
        multiSelect: boolean = false,
        worldNormal: any = null,
    ): void {
        const isPickingRef = !!ContextManager.instance.activeReferencePicker;
        const isPickingConstraint = !!ContextManager.instance.activeConstraintPicker;
        if (isPickingRef || isPickingConstraint) {
            this.resetAllFaceHighlights();
            const faceName = mesh ? mesh.metadata?.faceName : null;
            const uv = this._worldToFaceUV(faceName, worldPoint, panelModel);
            if (mesh && isPickingConstraint) {
                this._setFaceHighlight(mesh, 'hover', true);
            }
            this._emit('select', {
                face: faceName,
                smartId: smartId,
                uv,
                worldPoint,
                worldNormal,
                faceData: null,
                panelModel: panelModel,
                mesh,
            });
            return;
        }

        if (multiSelect) {
            this._clearSelectionExcept('faces');

            if (this.selectedFaces.has(mesh)) {
                this.selectedFaces.delete(mesh);
                this._setFaceHighlight(mesh, 'none');
            } else {
                this.selectedFaces.add(mesh);
                this._setFaceHighlight(mesh, 'selected');
            }
            this.selectedFace = this.selectedFaces.size > 0 ? Array.from(this.selectedFaces)[this.selectedFaces.size - 1] : null;
        } else {
            if (this.selectedFace === mesh && this.selectedFaces.size <= 1) {
                this.clearSelection();
                return;
            }

            this.clearSelection();
            this.selectedFaces.add(mesh);
            this.selectedFace = mesh;
            this._setFaceHighlight(mesh, 'selected');
        }

        const panel = panelModel || this.document.activeEntity;
        if (panel && shouldPromotePickToActiveEntity()) {
            if (this.document.activeEntity !== panel) {
                this.document.setActiveEntity(panel);
            } else {
                if (ContextManager.instance.showGizmos) {
                    ContextManager.instance.showGizmos();
                }
            }
        }

        const faceName = mesh ? mesh.metadata.faceName : null;
        const uv = this._worldToFaceUV(faceName, worldPoint, panelModel);
        this._emit('select', {
            face: faceName,
            smartId: smartId,
            uv,
            worldPoint,
            worldNormal,
            faceData: null,
            panelModel: panel,
            mesh,
        });
    }

    private _selectEdge(mesh: any, smartId: any, worldPoint: any, multiSelect: boolean = false): void {
        if (multiSelect) {
            this._clearSelectionExcept('edges');

            if (this.selectedEdges.has(mesh)) {
                this.selectedEdges.delete(mesh);
                if (!mesh.isDisposed() && mesh.metadata) {
                    if (mesh.color !== undefined) {
                        mesh.color = mesh.metadata.baseColor || BABYLON.Color3.Black();
                    } else if (mesh.material) {
                        mesh.material.emissiveColor = mesh.metadata.baseColor || BABYLON.Color3.Black();
                        mesh.material.diffuseColor = mesh.metadata.baseDiffuse || new BABYLON.Color3(0.2, 0.2, 0.2);
                    }
                }
            } else {
                this.selectedEdges.add(mesh);
                if (mesh.color !== undefined) {
                    mesh.color = new BABYLON.Color3(0.0, 1.0, 0.8);
                } else if (mesh.material) {
                    mesh.material.emissiveColor = new BABYLON.Color3(0.0, 1.0, 0.8);
                    mesh.material.diffuseColor = new BABYLON.Color3(0.0, 1.0, 0.8);
                }
            }
            this.selectedEdge = this.selectedEdges.size > 0 ? Array.from(this.selectedEdges)[this.selectedEdges.size - 1] : null;
        } else {
            if (this.selectedEdge === mesh && this.selectedEdges.size <= 1) {
                this.clearSelection();
                return;
            }

            this.clearSelection();
            this.selectedEdges.add(mesh);
            this.selectedEdge = mesh;
            if (this.selectedEdge.color !== undefined) {
                this.selectedEdge.color = new BABYLON.Color3(0.0, 1.0, 0.8);
            } else if (this.selectedEdge.material) {
                this.selectedEdge.material.emissiveColor = new BABYLON.Color3(0.0, 1.0, 0.8);
                this.selectedEdge.material.diffuseColor = new BABYLON.Color3(0.0, 1.0, 0.8);
            }
        }

        this._emit('select-edge', {
            smartId: smartId,
            worldPoint: worldPoint,
            mesh: mesh,
            panelModel: mesh?.metadata?.panelModel ?? null,
        });
    }

    private _selectVertex(mesh: any, smartId: any, worldPoint: any, multiSelect: boolean = false): void {
        if (multiSelect) {
            this._clearSelectionExcept('vertices');

            if (this.selectedVertices.has(mesh)) {
                this.selectedVertices.delete(mesh);
                if (!mesh.isDisposed() && mesh.metadata) {
                    mesh.visibility = this._vertexPickPreview ? 0.28 : 0.0;
                    mesh.material.alpha = 0.0;
                    mesh.material.diffuseColor = new BABYLON.Color3(1, 0, 0);
                    mesh.material.emissiveColor = BABYLON.Color3.Black();
                }
            } else {
                this.selectedVertices.add(mesh);
                mesh.visibility = 1.0;
                mesh.material.alpha = 1.0;
                mesh.material.diffuseColor = new BABYLON.Color3(0.2, 1.0, 0.6);
                mesh.material.emissiveColor = new BABYLON.Color3(0.1, 0.8, 0.4);
            }
            this.selectedVertex = this.selectedVertices.size > 0 ? Array.from(this.selectedVertices)[this.selectedVertices.size - 1] : null;
        } else {
            if (this.selectedVertex === mesh && this.selectedVertices.size <= 1) {
                this.clearSelection();
                return;
            }

            this.clearSelection();
            this.selectedVertices.add(mesh);
            this.selectedVertex = mesh;
            this.selectedVertex.visibility = 1.0;
            this.selectedVertex.material.alpha = 1.0;
            this.selectedVertex.material.diffuseColor = new BABYLON.Color3(0.2, 1.0, 0.6);
            this.selectedVertex.material.emissiveColor = new BABYLON.Color3(0.1, 0.8, 0.4);
        }
        ContextManager.instance.viewport?.requestRender(2);

        this._emit('select-vertex', {
            smartId: smartId,
            worldPoint: worldPoint,
            mesh: mesh,
            cornerIndex: mesh.metadata?.cornerIndex ?? -1
        });
    }

    private _selectFeature(mesh: any, smartId: any, worldPoint: any, multiSelect: boolean = false): void {
        const paintFeature = (m: any, selected: boolean) => {
            if (!m || m.isDisposed()) return;
            const mat = m.material;
            if (!mat) {
                // CreateLines (krawędź e_groove_*) — tylko color
                if (m.color && selected) {
                    m.color = new BABYLON.Color3(0.25, 0.85, 0.55);
                } else if (m.color && m.metadata?.baseColor) {
                    m.color = m.metadata.baseColor.clone
                        ? m.metadata.baseColor.clone()
                        : m.metadata.baseColor;
                }
                return;
            }
            if (selected) {
                mat.diffuseColor = new BABYLON.Color3(0.4, 0.8, 0.6);
                mat.emissiveColor = new BABYLON.Color3(0.05, 0.3, 0.2);
            } else if (m.metadata) {
                mat.emissiveColor = m.metadata.baseColor || BABYLON.Color3.Black();
                mat.diffuseColor = m.metadata.baseDiffuse || new BABYLON.Color3(0.25, 0.2, 0.15);
            }
        };

        if (multiSelect) {
            this._clearSelectionExcept('features');

            if (this.selectedFeatures.has(mesh)) {
                this.selectedFeatures.delete(mesh);
                paintFeature(mesh, false);
            } else {
                this.selectedFeatures.add(mesh);
                paintFeature(mesh, true);
            }
            this.selectedFeature = this.selectedFeatures.size > 0 ? Array.from(this.selectedFeatures)[this.selectedFeatures.size - 1] : null;
        } else {
            if (this.selectedFeature === mesh && this.selectedFeatures.size <= 1) {
                this.clearSelection();
                return;
            }

            this.clearSelection();
            this.selectedFeatures.add(mesh);
            this.selectedFeature = mesh;
            paintFeature(mesh, true);
        }

        this._emit('select-feature', {
            smartId: smartId,
            worldPoint: worldPoint,
            mesh: mesh,
            featureId: mesh?.metadata?.featureId || null,
            panelId: mesh?.metadata?.panelModel?.id || null,
            panelModel: mesh?.metadata?.panelModel || null,
        });
    }

    public resetAllFaceHighlights(): void {
        this._clearHoverHighlights();
        this._clearSelectionExcept(null);
        if (this.panelViews) {
            for (const [panel, view] of this.panelViews) {
                if (view && view.faceMeshes) {
                    for (const faceName in view.faceMeshes) {
                        const mesh = view.faceMeshes[faceName];
                        if (mesh && mesh.material && !mesh.isDisposed()) {
                            mesh.material.emissiveColor = mesh.metadata?.baseColor || BABYLON.Color3.Black();
                            mesh.material.diffuseColor = mesh.metadata?.baseDiffuse || new BABYLON.Color3(0.8, 0.8, 0.8);
                        }
                    }
                }
            }
        }
    }

    public clearSelection(): void {
        this._clearSelectionExcept(null);
        this.resetAllFaceHighlights();
        this._emit('deselect', { face: null });
    }

    public onPick(fn: Function): () => void {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    private _emit(type: string, data: any): void {
        for (const fn of this._listeners) {
            try { fn(type, data); } catch (e) { console.error('FacePicker listener error:', e); }
        }
    }

    private _setVertexHoverVisual(mesh: any, hovering: boolean): void {
        if (!mesh || mesh.isDisposed() || !mesh.material) {
            return;
        }
        if (this.selectedVertices.has(mesh)) {
            return;
        }
        if (hovering) {
            mesh.visibility = 0.92;
            mesh.material.alpha = 0.92;
            mesh.material.diffuseColor = new BABYLON.Color3(1.0, 0.85, 0.15);
            mesh.material.emissiveColor = new BABYLON.Color3(1.0, 0.72, 0.08);
            ContextManager.instance.viewport?.requestRender(2);
            return;
        }
        mesh.visibility = this._vertexPickPreview ? 0.28 : 0.0;
        mesh.material.alpha = this._vertexPickPreview ? 0.28 : 0.0;
        mesh.material.diffuseColor = mesh.metadata?.baseDiffuse || new BABYLON.Color3(1, 0.2, 0.2);
        mesh.material.emissiveColor = mesh.metadata?.baseColor || new BABYLON.Color3(0.5, 0.1, 0.1);
        ContextManager.instance.viewport?.requestRender(2);
    }

    /**
     * Pipeta naroży: pokaż wszystkie kółka słabo, hover rozjaśnia wskazane.
     */
    public setVertexPickPreview(on: boolean): void {
        this._vertexPickPreview = on;
        if (!this.panelViews) {
            return;
        }
        for (const view of this.panelViews.values()) {
            const spheres = view?._vertexSpheres;
            if (!Array.isArray(spheres)) {
                continue;
            }
            for (const mesh of spheres) {
                if (!mesh || mesh.isDisposed() || !mesh.material) {
                    continue;
                }
                if (this.selectedVertices.has(mesh) || mesh === this._hoveredEntity) {
                    continue;
                }
                mesh.visibility = on ? 0.28 : 0.0;
                mesh.material.alpha = on ? 0.28 : 0.0;
                mesh.material.diffuseColor = mesh.metadata?.baseDiffuse || new BABYLON.Color3(1, 0.2, 0.2);
                mesh.material.emissiveColor = mesh.metadata?.baseColor || new BABYLON.Color3(0.5, 0.1, 0.1);
                try {
                    mesh.setEnabled(true);
                    mesh.isVisible = true;
                    mesh.isPickable = true;
                } catch {
                    /* mesh mógł zostać usunięty */
                }
            }
        }
        ContextManager.instance.viewport?.requestRender(2);
    }

    /**
     * Wyróżnione próbkowanie z ekranową tolerancją (18px promienia wokół kursora myszy).
     * Pozwala natychmiast kliknąć w cienką krawędź CAD (1mm) z dużej odległości bez zgrubiania siatki!
     */
    private _pickSubgeometryWithTolerance(pointerX: number, pointerY: number): any {
        // 1. Dokładny raycast bezpośrednio pod kursem wskaźnika (pointerX, pointerY)
        const hits = this.scene.multiPick(
            pointerX,
            pointerY,
            (mesh: any) => {
                if (!mesh || !isMeshHierarchicallyEnabled(mesh) || !mesh.metadata || !mesh.metadata.type) return false;
                const pVis = mesh.metadata.panelModel ? mesh.metadata.panelModel.visible !== false : true;
                const mVis = mesh.metadata.model ? mesh.metadata.model.visible !== false : true;
                return pVis && mVis;
            }
        );

        if (hits && hits.length > 0) {
            const validHits = hits.filter((h: any) => h.hit && h.pickedMesh);
            if (this.targetSubgeometryType === 'vertex') {
                const vertexHit = validHits.find((h: any) => h.pickedMesh.metadata.type === 'vertex');
                if (vertexHit) return vertexHit;
            } else if (this.targetSubgeometryType === 'edge') {
                const edgeHit = validHits.find((h: any) => h.pickedMesh.metadata.type === 'edge');
                if (edgeHit) return edgeHit;
                return null;
            } else if (this.targetSubgeometryType === 'face') {
                return null;
            } else {
                const vertexHit = validHits.find((h: any) => h.pickedMesh.metadata.type === 'vertex');
                // Płaszczyzny / krawędzie operacji (featureId) przed zwykłymi krawędziami CAD
                const featureHit = validHits
                    .filter((h: any) => h.pickedMesh.metadata.type === 'feature')
                    .sort((a: any, b: any) => a.distance - b.distance)[0];
                const featureEdgeHit = validHits
                    .filter((h: any) => h.pickedMesh.metadata.type === 'edge' && h.pickedMesh.metadata.featureId)
                    .sort((a: any, b: any) => a.distance - b.distance)[0];
                const edgeHit = validHits
                    .filter((h: any) => h.pickedMesh.metadata.type === 'edge' && !h.pickedMesh.metadata.featureId)
                    .sort((a: any, b: any) => a.distance - b.distance)[0];
                if (vertexHit || featureHit || featureEdgeHit || edgeHit) {
                    return vertexHit || featureHit || featureEdgeHit || edgeHit;
                }
            }
        }

        // Tryb naroży: małe kółka łatwo minąć — dociągamy do najbliższego w większym promieniu (WCS pick).
        if (this.targetSubgeometryType === 'vertex') {
            const nearby = this._pickNearestVertex(pointerX, pointerY, 28);
            if (nearby) {
                return nearby;
            }
        }

        // 2. Usunięto sztuczne próbkowanie ekranowe (offsets), które kradło kliknięcia z małych płaszczyzn.
        // Zamiast tego polegamy na fizycznej wartości intersectionThreshold (w panel-view.ts),
        // dzięki czemu krawędzie mają stały 3D margines (np. 1.5mm) i zostawiają miejsce na płaszczyznę!

        return null;
    }

    private _pickNearestVertex(pointerX: number, pointerY: number, radiusPx: number): any {
        const predicate = (mesh: any) => {
            if (!mesh || !isMeshHierarchicallyEnabled(mesh) || mesh.metadata?.type !== 'vertex') {
                return false;
            }
            const pVis = mesh.metadata.panelModel ? mesh.metadata.panelModel.visible !== false : true;
            const mVis = mesh.metadata.model ? mesh.metadata.model.visible !== false : true;
            return pVis && mVis;
        };
        const ring = [0, radiusPx, -radiusPx, Math.round(radiusPx * 0.7), -Math.round(radiusPx * 0.7)];
        for (const dx of ring) {
            for (const dy of ring) {
                if (dx === 0 && dy === 0) {
                    continue;
                }
                const hit = this.scene.pick(pointerX + dx, pointerY + dy, predicate);
                if (hit?.hit && hit.pickedMesh) {
                    return hit;
                }
            }
        }
        return null;
    }

    public dispose(): void {
        if (this._pointerObserver) {
            this.scene.onPointerObservable.remove(this._pointerObserver);
            this._pointerObserver = null;
        }
    }
}
