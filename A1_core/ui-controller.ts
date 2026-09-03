import { ProjectDocument } from './project-document.js';
import { rebuildSmartFrameContainer } from '../A3_smartframe/smartframe-adapter.js';
import { unit } from './unit-system.js';
import { NodeType } from './cad-node/node-type.js';

/** Ręczny wymiar płyty [mm]: min 0,1 — max pełna szafa. */
export const PANEL_DIM_MIN_MM = 0.1;
export const PANEL_DIM_MAX_MM = 3000;

export class UIController {
    document: ProjectDocument;
    viewport: any;
    static instance: UIController | null = null;
    
    _treeListeners: Set<any>;
    _sketchModeListeners: Set<any>;
    _addHoleListeners: Set<any>;
    _addFilletListeners: Set<any>;
    _resetListeners: Set<any>;

    // State object that React components will observe
    state: {
        statusText: string;
        statusBarActive: boolean;
        consoleText: string;
        faceInfoHtml: string;
        coordsInfoText: string;
        sketchModeActive: boolean;
        sketchFaceName: string;
        inputWidthValue: string;
        inputHeightValue: string;
        inputThicknessValue: string;
        inputThicknessLabel: string;
        inputsDisabled: boolean;
    };

    onStateChange: (() => void) | null = null;

    constructor(document: ProjectDocument) {
        this.document = document;
        this._treeListeners = new Set();
        this._sketchModeListeners = new Set();
        this._addHoleListeners = new Set();
        this._addFilletListeners = new Set();
        this._resetListeners = new Set();

        this.state = {
            statusText: "Ładowanie...",
            statusBarActive: false,
            consoleText: "Gotowy. Najedź na element.",
            faceInfoHtml: '<span class="face-none">Kliknij element</span>',
            coordsInfoText: "",
            sketchModeActive: false,
            sketchFaceName: "—",
            inputWidthValue: "",
            inputHeightValue: "",
            inputThicknessValue: "",
            inputThicknessLabel: "Grubość",
            inputsDisabled: true
        };

        UIController.instance = this;

        // Sync inputs when active entity changes
        this.document.onDocumentChanged(() => {
            this._syncInputsFromActive();
            if (this.onStateChange) this.onStateChange();
        });
        this._syncInputsFromActive();
    }

    _syncInputsFromActive() {
        const activeEntity = this.document.activeEntity as any;
        if (activeEntity) {
            this.state.inputWidthValue = String(unit.toMM(activeEntity.width) || 600);
            this.state.inputHeightValue = String(unit.toMM(activeEntity.height) || 720);
            if (activeEntity.type === 'container') {
                this.state.inputThicknessValue = String(unit.toMM(activeEntity.depth) || 500);
                this.state.inputThicknessLabel = 'Głębokość';
                this.state.inputsDisabled = false;
            } else {
                this.state.inputThicknessValue = String(unit.toMM(activeEntity.thickness) || 18);
                this.state.inputThicknessLabel = 'Grubość';
                
                // Sprawdzamy czy ta płyta jest częścią jakiegoś kontenera
                const node = this.document.findNode(activeEntity.id);
                const hasParent = node && node.parent && node.parent.nodeType === NodeType.ASSEMBLY;
                const isManual = (activeEntity as any).engineManaged === false;

                if (hasParent && !isManual) {
                    // Blokujemy zmianę wymiarów pojedynczych płyt wewnątrz korpusu
                    this.state.inputsDisabled = true;
                } else {
                    this.state.inputsDisabled = false;
                }
            }
        } else {
            this.state.inputWidthValue = '';
            this.state.inputHeightValue = '';
            this.state.inputThicknessValue = '';
            this.state.inputsDisabled = true;
        }
    }

    handleInputChange(width: number, height: number, thickness: number) {
        const activeEntity = this.document.activeEntity as any;
        console.log('[UIController] handleInputChange called with:', width, height, thickness, 'activeEntity:', activeEntity ? activeEntity.name : 'null');
        if (activeEntity) {
            if (activeEntity.type === 'container') {
                activeEntity.width = width;
                activeEntity.height = height;
                activeEntity.depth = thickness;
                
                // Regeneruj płyty korpusu przy zmianie wymiarów z głównych inputów
                rebuildSmartFrameContainer(activeEntity);
                
                console.log('[UIController] Dispatched smartbox-project-changed');
                document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
            } else {
                const wMm = Math.min(PANEL_DIM_MAX_MM, Math.max(PANEL_DIM_MIN_MM, width));
                const hMm = Math.min(PANEL_DIM_MAX_MM, Math.max(PANEL_DIM_MIN_MM, height));
                const thicknessNm = activeEntity.thickness;
                activeEntity.setDimensions(unit.fromMM(wMm), unit.fromMM(hMm), thicknessNm);
                this.document.emitChange('dimensions');
                console.log('[UIController] Dispatched smartbox-panel-changed');
                document.dispatchEvent(new CustomEvent('smartbox-panel-changed', { detail: { panelModel: activeEntity } }));
            }
        }
    }

    setStatus(text: string, active = false) {
        this.state.statusText = text;
        this.state.statusBarActive = active;
        if (this.onStateChange) this.onStateChange();
    }

    setConsole(msg: string) {
        this.state.consoleText = msg;
        if (this.onStateChange) this.onStateChange();
    }

    showSelectedFace(faceName: string | null, faceData: any | null, smartId: any | null = null) {
        if (!faceName) {
            this.state.faceInfoHtml = '<span class="face-none">Kliknij element</span>';
            this.state.coordsInfoText = '';
            if (this.onStateChange) this.onStateChange();
            return;
        }

        const labels: Record<string, string> = {
            front: 'Przód (Front)',
            back: 'Tył (Back)',
            left: 'Lewy bok (Left)',
            right: 'Prawy bok (Right)',
            top: 'Góra (Top)',
            bottom: 'Dół (Bottom)'
        };

        this.state.faceInfoHtml = `
            <div class="face-badge">
                <span class="dot"></span>
                ${labels[faceName] || faceName}
            </div>
            ${smartId ? `<div style="font-size: 11px; opacity: 0.6; margin-top: 4px; font-family: monospace;">ID: ${smartId.fullPath}</div>` : ''}
        `;

        if (faceData) {
            this.state.coordsInfoText = `Wymiary: ${faceData.width} × ${faceData.height} mm`;
        } else {
            this.state.coordsInfoText = '';
        }
        if (this.onStateChange) this.onStateChange();
    }

    clearSelectedFace() {
        this.showSelectedFace(null, null);
    }

    updateCursorCoords(uv: any) {
        if (!uv) {
            this.state.coordsInfoText = '';
            if (this.onStateChange) this.onStateChange();
            return;
        }
        this.state.coordsInfoText = `U: ${uv.u.toFixed(1)} mm  |  V: ${uv.v.toFixed(1)} mm`;
        if (this.onStateChange) this.onStateChange();
    }

    showSketchMode(faceName: string) {
        this.state.sketchModeActive = true;
        this.state.sketchFaceName = faceName;
        if (this.onStateChange) this.onStateChange();
    }

    hideSketchMode() {
        this.state.sketchModeActive = false;
        if (this.onStateChange) this.onStateChange();
    }

    refreshFeatures() {
        if (this.onStateChange) this.onStateChange();
    }

    onSketchMode(fn: () => void) { this._sketchModeListeners.add(fn); }
    onAddHole(fn: () => void) { this._addHoleListeners.add(fn); }
    onAddFillet(fn: () => void) { this._addFilletListeners.add(fn); }
    onReset(fn: () => void) { this._resetListeners.add(fn); }

    triggerSketchMode() { this._sketchModeListeners.forEach(fn => fn()); }
    triggerAddHole() { this._addHoleListeners.forEach(fn => fn()); }
    triggerAddFillet() { this._addFilletListeners.forEach(fn => fn()); }
    triggerReset() { this._resetListeners.forEach(fn => fn()); }

    onTreeAction(fn: (action: string, data: any) => void) {
        this._treeListeners.add(fn);
        return () => this._treeListeners.delete(fn);
    }

    emitTree(action: string, data: any) {
        for (const fn of this._treeListeners) {
            try { fn(action, data); } catch (e) { console.error(e); }
        }
    }
}
