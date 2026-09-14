/**
 * SmartPanel Web — QuickPick 3D Preview (CAD Silhouette Ghosting)
 * 
 * Podświetla wskazaną płaszczyznę w przestrzeni 3D z krawędziową sylwetką formatek pod kursorem:
 * - Formatki pod kursorem stają się półprzezroczyste (ghosting) z wyraźnie zarysowanymi krawędziami CAD,
 * - Wybrana płaszczyzna świeci w pełnym kolorze z akcentem cyjanowym w swoim prawdziwym położeniu 3D (z zachowaniem głębi).
 */

import { ContextManager } from '../context-manager.js';
import type { QuickPickCandidate } from './quick-pick-types.js';

declare const BABYLON: any;

interface SavedMeshState {
    mesh: any;
    visibility: number;
    emissiveColor: any;
    diffuseColor: any;
    edgesWidth?: number;
    edgesColor?: any;
    edgesEnabled?: boolean;
}

export class QuickPickPreview {
    private static _instance: QuickPickPreview | null = null;

    public static get instance(): QuickPickPreview {
        if (!QuickPickPreview._instance) {
            QuickPickPreview._instance = new QuickPickPreview();
        }
        return QuickPickPreview._instance;
    }

    private _savedMeshes: Map<any, SavedMeshState> = new Map();
    private _markerSphere: any = null;
    private _lastCandidates: QuickPickCandidate[] = [];

    /**
     * Podświetla kandydata, tworząc sylwetkę krawędziową dla formatek pod kursorem.
     */
    public highlightCandidate(
        candidate: QuickPickCandidate | null,
        allCandidates?: QuickPickCandidate[]
    ): void {
        if (!candidate || !candidate.mesh || candidate.mesh.isDisposed()) {
            this.clear();
            return;
        }

        const scene = candidate.mesh.getScene ? candidate.mesh.getScene() : ContextManager.instance.viewport?.scene;
        if (!scene) return;

        if (allCandidates && allCandidates.length > 0) {
            this._lastCandidates = allCandidates;
        } else if (this._lastCandidates.length === 0) {
            this._lastCandidates = [candidate];
        }

        // 1. Znajdź wszystkie formatki (panele) pod kursorem
        const panelModels = new Set<any>();
        for (const c of this._lastCandidates) {
            if (c.panelModel) panelModels.add(c.panelModel);
        }
        if (candidate.panelModel) {
            panelModels.add(candidate.panelModel);
        }

        // 2. Zbierz wszystkie siatki ścian dla tych formatek
        const affectedFaceMeshes: any[] = [];
        const panelViews = ContextManager.instance.panelViews;

        if (panelModels.size > 0 && panelViews) {
            for (const panel of panelModels) {
                const view = panelViews.get(panel);
                if (view && view.faceMeshes) {
                    for (const faceKey in view.faceMeshes) {
                        const m = view.faceMeshes[faceKey];
                        if (m && !m.isDisposed()) {
                            affectedFaceMeshes.push(m);
                        }
                    }
                }
            }
        }

        // Jeśli nie znaleziono przez panelViews, dodaj przynajmniej siatki rodzica kandydata
        if (affectedFaceMeshes.length === 0 && candidate.mesh.parent) {
            const children = candidate.mesh.parent.getChildMeshes ? candidate.mesh.parent.getChildMeshes() : [];
            for (const m of children) {
                if (m && !m.isDisposed() && m.metadata?.faceName) {
                    affectedFaceMeshes.push(m);
                }
            }
        }

        if (!affectedFaceMeshes.includes(candidate.mesh)) {
            affectedFaceMeshes.push(candidate.mesh);
        }

        // 3. Zapisz pierwotny stan każdej napotkanej siatki (tylko raz, przed zmianami)
        for (const m of affectedFaceMeshes) {
            if (!this._savedMeshes.has(m)) {
                const mat = m.material;
                this._savedMeshes.set(m, {
                    mesh: m,
                    visibility: m.visibility !== undefined ? m.visibility : 1.0,
                    emissiveColor: mat?.emissiveColor ? mat.emissiveColor.clone() : null,
                    diffuseColor: mat?.diffuseColor ? mat.diffuseColor.clone() : null,
                    edgesWidth: m.edgesWidth,
                    edgesColor: m.edgesColor ? m.edgesColor.clone() : null,
                    edgesEnabled: typeof m._edgesRenderer !== 'undefined' && m._edgesRenderer !== null,
                });
            }
        }

        // 4. Zaaplikuj przezroczystość krawędziową (ghosting) formatek pod kursorem
        for (const m of affectedFaceMeshes) {
            const isTarget = m === candidate.mesh;
            const mat = m.material;
            if (!mat) continue;

            if (isTarget) {
                // Wybrana płaszczyzna: półprzezroczyste wypełnienie (0.30), aby nie zakrywała krawędzi obrysu
                m.visibility = 0.30;
                mat.emissiveColor = new BABYLON.Color3(0.0, 0.65, 0.95);
                mat.diffuseColor = new BABYLON.Color3(0.05, 0.75, 1.0);

                // Ostry, wyrazisty kontur obrysu wybranej płaszczyzny
                if (typeof m.enableEdgesRendering === 'function') {
                    m.enableEdgesRendering();
                    m.edgesWidth = 3.5;
                    m.edgesColor = new BABYLON.Color4(0.0, 0.9, 1.0, 1.0);
                }
            } else {
                // Pozostałe ścianki formatek: subtelny ghosting (0.10) z widocznym obrysem krawędzi bryły formatki
                m.visibility = 0.10;
                const orig = this._savedMeshes.get(m);
                mat.emissiveColor = orig?.emissiveColor ? orig.emissiveColor : new BABYLON.Color3(0.02, 0.04, 0.08);
                mat.diffuseColor = orig?.diffuseColor ? orig.diffuseColor : new BABYLON.Color3(0.85, 0.85, 0.9);

                // Wyraźne krawędzie bryły mebla (w tym krawędzie grubości 18 mm w rzucie izometrycznym)
                if (typeof m.enableEdgesRendering === 'function') {
                    m.enableEdgesRendering();
                    m.edgesWidth = 2.0;
                    m.edgesColor = new BABYLON.Color4(0.18, 0.28, 0.45, 0.9);
                }
            }
        }

        // 5. Dyskretny znacznik punktu trafienia promienia
        if (this._markerSphere) {
            try { this._markerSphere.dispose(); } catch {}
            this._markerSphere = null;
        }

        if (candidate.worldPoint && typeof BABYLON !== 'undefined' && BABYLON.MeshBuilder) {
            try {
                this._markerSphere = BABYLON.MeshBuilder.CreateSphere(
                    'quickpick_hit_marker',
                    { diameter: 8 },
                    scene
                );
                const markerMat = new BABYLON.StandardMaterial('quickpick_marker_mat', scene);
                markerMat.emissiveColor = new BABYLON.Color3(0.0, 0.95, 1.0);
                markerMat.diffuseColor = new BABYLON.Color3(0.1, 1.0, 1.0);
                markerMat.alpha = 0.95;
                this._markerSphere.material = markerMat;
                this._markerSphere.isPickable = false;
                this._markerSphere.position.set(
                    candidate.worldPoint.x,
                    candidate.worldPoint.y,
                    candidate.worldPoint.z
                );
            } catch (err) {
                console.warn('[QuickPickPreview] Nie udało się utworzyć markera sfery:', err);
            }
        }

        ContextManager.instance.viewport?.requestRender(2);
    }

    /**
     * Przywraca oryginalny stan wszystkich zmodyfikowanych siatek i usuwa markery.
     */
    public clear(): void {
        if (this._markerSphere) {
            try { this._markerSphere.dispose(); } catch {}
            this._markerSphere = null;
        }

        if (this._savedMeshes.size > 0) {
            for (const [mesh, saved] of this._savedMeshes) {
                if (!mesh || mesh.isDisposed()) continue;

                mesh.visibility = saved.visibility;
                const mat = mesh.material;
                if (mat) {
                    if (saved.emissiveColor) {
                        mat.emissiveColor = saved.emissiveColor;
                    }
                    if (saved.diffuseColor) {
                        mat.diffuseColor = saved.diffuseColor;
                    }
                }

                if (saved.edgesEnabled && saved.edgesWidth !== undefined) {
                    mesh.edgesWidth = saved.edgesWidth;
                    if (saved.edgesColor) {
                        mesh.edgesColor = saved.edgesColor;
                    }
                } else if (typeof mesh.disableEdgesRendering === 'function') {
                    mesh.disableEdgesRendering();
                }
            }
            this._savedMeshes.clear();
        }

        this._lastCandidates = [];
        ContextManager.instance.viewport?.requestRender(2);
    }
}

