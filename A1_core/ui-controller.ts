import { ProjectDocument } from './project-document.js';
import { getCabinetModule } from './cabinet-port.js';
import uiTekstRaw from './ui-tekst.json';
import { unit } from './unit-system.js';
import { NodeType } from './cad-node/node-type.js';

type UiTekstBag = Record<string, { pl?: string; en?: string; de?: string }>;
const uiTekst = uiTekstRaw as UiTekstBag;

/** Lokalny resolver — A1 nie zależy od T1; PL jako domyślny. */
function uiTx(key: string, vars?: Record<string, string | number>): string {
    const entry = uiTekst[key];
    let text = entry?.pl ?? entry?.en ?? key;
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
        }
    }
    return text;
}

/** Ręczny wymiar płyty [mm]: min 0,1 — max pełna szafa. */
export const PANEL_DIM_MIN_MM = 0.1;
export const PANEL_DIM_MAX_MM = 3000;

export class UIController {
    document: ProjectDocument;
    viewport: any;
    static instance: UIController | null = null;

    /** Kody ścian -> klucze tekstów (display tłumaczony, kody stabilne). */
    private static FACE_LABEL_KEYS: Record<string, string> = {
        front: 'app.face_front',
        back: 'app.face_back',
        left: 'app.face_left',
        right: 'app.face_right',
        top: 'app.face_top',
        bottom: 'app.face_bottom',
    };
    _treeListeners: Set<any>;
    _addFilletListeners: Set<any>;
    _resetListeners: Set<any>;

    // State object that React components will observe
    state: {
        statusText: string;
        statusBarActive: boolean;
        /** Wizualny wariant paska statusu — logika czyta TYLKO to, nigdy statusText. */
        statusKind: 'info' | 'error';
        consoleText: string;
        faceInfoHtml: string;
        /** Strukturalny rodzaj selekcji — logika czyta TYLKO to, nigdy faceInfoHtml. */
        faceKind: 'none' | 'face' | 'edge' | 'corner' | 'feature';
        coordsInfoText: string;
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
        this._addFilletListeners = new Set();
        this._resetListeners = new Set();

        this.state = {
            statusText: uiTx('app.status_default'),
            statusBarActive: false,
            statusKind: 'info',
            consoleText: uiTx('app.console_default'),
            faceInfoHtml: `<span class="face-none">${uiTx('app.face_none')}</span>`,
            faceKind: 'none',
            coordsInfoText: "",
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
                getCabinetModule()?.rebuild(activeEntity);
                
                console.log('[UIController] Dispatched bloki-project-changed');
                document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            } else {
                const wMm = Math.min(PANEL_DIM_MAX_MM, Math.max(PANEL_DIM_MIN_MM, width));
                const hMm = Math.min(PANEL_DIM_MAX_MM, Math.max(PANEL_DIM_MIN_MM, height));
                // Grubość edytowalna ręcznie (nie tylko przez drop materiału).
                const tMm = Math.min(100, Math.max(1, thickness));
                activeEntity.setDimensions(unit.fromMM(wMm), unit.fromMM(hMm), unit.fromMM(tMm));
                this.document.emitChange('dimensions');
                console.log('[UIController] Dispatched bloki-panel-changed');
                document.dispatchEvent(new CustomEvent('bloki-panel-changed', { detail: { panelModel: activeEntity } }));
            }
        }
    }

    setStatus(text: string, active = false, kind: 'info' | 'error' = 'info') {
        this.state.statusText = text;
        this.state.statusBarActive = active;
        this.state.statusKind = kind;
        if (this.onStateChange) this.onStateChange();
    }

    setConsole(msg: string) {
        this.state.consoleText = msg;
        if (this.onStateChange) this.onStateChange();
    }

    showSelectedFace(faceName: string | null, faceData: any | null, smartId: any | null = null, kind: 'face' | 'edge' | 'corner' | 'feature' = 'face') {
        if (!faceName) {
            this.state.faceInfoHtml = `<span class="face-none">${uiTx('app.face_none')}</span>`;
            this.state.faceKind = 'none';
            this.state.coordsInfoText = '';
            if (this.onStateChange) this.onStateChange();
            return;
        }
        this.state.faceKind = kind;

        // Display ścian po kodach (kody stabilne, tekst z tekstów). Pseudo-nazwy
        // ('Krawędź', 'Narożnik N', 'Cecha geometryczna') mapowane po kind.
        const label = UIController.faceDisplayName(faceName, kind);
        this.state.faceInfoHtml = `
            <div class="face-badge">
                <span class="dot"></span>
                ${label}
            </div>
            ${smartId ? `<div style="font-size: 11px; opacity: 0.6; margin-top: 4px; font-family: monospace;">ID: ${smartId.fullPath}</div>` : ''}
        `;

        if (faceData) {
            this.state.coordsInfoText = uiTx('app.face_dims', { w: faceData.width, h: faceData.height });
        } else {
            this.state.coordsInfoText = '';
        }
        if (this.onStateChange) this.onStateChange();
    }

    private static faceDisplayName(faceName: string, kind: string): string {
        const key = UIController.FACE_LABEL_KEYS[faceName];
        if (key) return uiTx(key);
        if (kind === 'edge') return uiTx('app.face_edge');
        if (kind === 'feature') return uiTx('app.face_feature');
        if (kind === 'corner') {
            const m = String(faceName).match(/(\d+)\s*$/);
            return uiTx('app.face_corner', { i: m ? m[1] : faceName });
        }
        return faceName;
    }

    clearSelectedFace() {
        this.showSelectedFace(null, null);
    }

    showSketchMode(_face?: any) {
        if (this.onStateChange) this.onStateChange();
    }

    hideSketchMode() {
        if (this.onStateChange) this.onStateChange();
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

    refreshFeatures() {
        if (this.onStateChange) this.onStateChange();
    }

    onAddFillet(fn: () => void) { this._addFilletListeners.add(fn); }
    onReset(fn: () => void) { this._resetListeners.add(fn); }

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
