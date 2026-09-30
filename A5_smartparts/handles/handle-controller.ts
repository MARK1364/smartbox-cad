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
    DEFAULT_HANDLE_PARAMS,
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

        const pick = scene.pick(pointerX, pointerY, (m: any) =>
            m.isPickable && m.isVisible && !m.name?.includes('ground') && !m.name?.includes('grid') && !m.name?.includes('__handle')
        );

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

        const params: Partial<HandleParamsMm> = tpl ? {
            totalLengthMm: tpl.totalLengthMm,
            holeDistanceMm: tpl.holeDistanceMm,
            depthMm: tpl.depthMm,
            thicknessMm: tpl.thicknessMm,
            orientation: tpl.defaultOrientation,
            placementPreset: surface.suggestedPreset,
            offsetEdgeYMm: tpl.defaultOffsetYMm,
            glbModelPath: tpl.glbModelPath,
        } : {};

        const handleNode = createSmartPartHandle(doc, surface.panelNode, params, surface);

        this.endDrag();
        return handleNode;
    }
}
