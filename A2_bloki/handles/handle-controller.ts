/**
 * A5_smartparts / handles — handle-controller.ts
 * Kontroler przeciągania i upuszczania uchwytów (SmartPart Handle Controller).
 *
 * Koordynuje wykrywanie zarysu formatki, podświetlanie oraz wstawianie kontenera
 * SmartPart Handle na docelową formatkę w scenie.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import {
    type HandleTemplateItem,
    type HandleParamsMm,
    DEFAULT_REJS_SERIES_ID,
    resolveRejsSize,
} from './handle-types.js';
import { probePanelSurfaceFromRay, type DetectedPanelSurface } from './handle-detector.js';
import { highlightPanelSurface, clearPanelHighlight } from './handle-visualizer.js';
import { createSmartPartHandle } from './handle-engine.js';

export class HandleDragController {
    private static _instance: HandleDragController | null = null;

    private _isDragging: boolean = false;
    private _activeTemplate: HandleTemplateItem | null = null;
    private _lastDetectedSurface: DetectedPanelSurface | null = null;
    private _lastProbeTime: number = 0;

    public static get instance(): HandleDragController {
        if (!HandleDragController._instance) {
            HandleDragController._instance = new HandleDragController();
        }
        return HandleDragController._instance;
    }

    get isDragging(): boolean {
        return this._isDragging;
    }

    get activeTemplate(): HandleTemplateItem | null {
        return this._activeTemplate;
    }

    get lastDetectedSurface(): DetectedPanelSurface | null {
        return this._lastDetectedSurface;
    }

    startDrag(template: HandleTemplateItem): void {
        this._isDragging = true;
        this._activeTemplate = template;
        this._lastDetectedSurface = null;
    }

    endDrag(): void {
        this._isDragging = false;
        this._activeTemplate = null;
        this._lastDetectedSurface = null;
        const scene = ContextManager.instance?.viewport?.scene;
        if (scene) {
            clearPanelHighlight(scene);
        }
    }

    onPointerMoveOnScene(scene: any, pointerX: number, pointerY: number, doc: ProjectDocument): DetectedPanelSurface | null {
        if (!this._isDragging || !scene || !doc) return null;

        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        if (now - this._lastProbeTime < 40 && this._lastDetectedSurface) {
            return this._lastDetectedSurface;
        }
        this._lastProbeTime = now;

        // Pomijaj istniejące uchwyty / ghosty — inaczej drop drugiego uchwytu trafia w mesh pierwszego.
        const pick = scene.pick(pointerX, pointerY, (m: any) => {
            if (!m?.isPickable || !m.isVisible) return false;
            const name = String(m.name || '');
            if (name.includes('ground') || name.includes('grid') || name.includes('__handle')) return false;
            if (name.startsWith('handle_mesh_')) return false;
            if (m.metadata?.type === 'smartpart_handle') return false;
            return true;
        });

        if (pick && pick.hit && pick.pickedMesh) {
            const surface = probePanelSurfaceFromRay(scene, pick, doc);
            if (surface) {
                const tpl = this._activeTemplate;
                const params: Partial<HandleParamsMm> = tpl ? {
                    totalLengthMm: tpl.totalLengthMm,
                    holeDistanceMm: tpl.holeDistanceMm,
                    depthMm: tpl.depthMm,
                    thicknessMm: tpl.thicknessMm,
                    orientation: tpl.defaultOrientation,
                    placementPreset: surface.suggestedPreset,
                    offsetEdgeYMm: tpl.defaultOffsetYMm,
                } : {};

                highlightPanelSurface(scene, surface, params);
                this._lastDetectedSurface = surface;
                return surface;
            }
        }

        if (this._lastDetectedSurface) {
            clearPanelHighlight(scene);
            this._lastDetectedSurface = null;
        }
        return null;
    }

    onDropOnScene(doc: ProjectDocument): CADNode | null {
        if (!this._isDragging || !this._lastDetectedSurface || !doc) {
            this.endDrag();
            return null;
        }

        const surface = this._lastDetectedSurface;
        const tpl = this._activeTemplate;

        const seriesId = tpl?.type === 'BAR'
            ? (tpl.defaultSeriesId || DEFAULT_REJS_SERIES_ID)
            : tpl?.defaultSeriesId;

        // Katalog B1 / miniatura ma dokładne wymiary — resolveRejsSize tylko jako uzupełnienie
        let holeDistanceMm = tpl?.holeDistanceMm ?? 0;
        let totalLengthMm = tpl?.totalLengthMm ?? 0;
        if (tpl?.type === 'BAR' && seriesId && !(totalLengthMm > 0)) {
            const size = resolveRejsSize(seriesId, holeDistanceMm);
            holeDistanceMm = size.holeDistanceMm;
            totalLengthMm = size.totalLengthMm;
        }

        const params: Partial<HandleParamsMm> = tpl ? {
            totalLengthMm: totalLengthMm || tpl.totalLengthMm,
            holeDistanceMm,
            depthMm: tpl.depthMm,
            thicknessMm: tpl.thicknessMm,
            orientation: tpl.defaultOrientation,
            placementPreset: surface.suggestedPreset,
            offsetEdgeYMm: tpl.defaultOffsetYMm,
            glbModelPath: tpl.glbModelPath,
            handleType: tpl.type,
            producerId: tpl.producerId,
            seriesId,
            drillingEnabled: true,
            drillDiameterMm: 4,
            placementLocked: false,
            ...(tpl.colorId ? { colorId: tpl.colorId } : {}),
            ...(tpl.color ? { color: tpl.color } : {}),
        } : {};

        const handleNode = createSmartPartHandle(doc, surface.panelNode, params, surface);

        this.endDrag();
        return handleNode;
    }
}
