/**
 * SmartPanel Web — Properties Manager
 * 
 * Centralny moduł inspekcji obiektów 3D wzorowany na:
 *   - SolidWorks Property Manager
 *   - Blender N-Panel (Item / Object Properties / Custom Properties)
 * 
 * Odpowiada za:
 *   - Ekstrakcję danych transformacji (pozycja, rotacja, wymiary) z Babylon.js meshy
 *   - Odczyt parametrów specyficznych (średnica, głębokość, ściana, UV) z modeli CAD
 *   - Zarządzanie Custom Properties (pary klucz-wartość per obiekt)
 *   - Generowanie wpisów do menu kontekstowego
 *   - Emisję eventów DOM do komponentów React
 */

// ─── Interfaces ──────────────────────────────────────────────
import { ContextManager } from './context-manager.js';
import { nmToMm } from './cad-math/units.js';

/** Bezpieczna konwersja jednostek (nanometry -> milimetry jeśli wartość > 10000) */
export function safeMm(val: any, defaultVal = 0): number {
    if (val === null || val === undefined) return defaultVal;
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return defaultVal;
    if (Math.abs(num) > 10000) {
        return Math.round(nmToMm(num));
    }
    return Math.round(num);
}

/** Współrzędne 3D */
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

/** Dane zakładki "Item" — transformacja obiektu */
export interface ItemTransform {
    loc: Vec3;
    worldLoc: Vec3;
    rot?: Vec3;       // w stopniach
    scale?: Vec3;
}

/** Parametry specyficzne dla otworu */
export interface HoleProperties {
    diameter: number;
    depth: number;
    face: string;
    u: number;
    v: number;
}

/** Parametry wpustu / ramki */
export interface GrooveProperties {
    width: number;
    length: number;
    depth: number;
    face: string;
    u: number;
    v: number;
    frameMm?: number;
    frameHMm?: number;
    editable: boolean;
    source: 'library' | 'engine';
    libraryId?: string;
    placement?: 'frame' | 'edge_dims';
    through?: boolean;
    uRef?: number;
    vRef?: number;
    uEdge?: string;
    vEdge?: string;
}

/** Parametry specyficzne dla płyty / panelu */
export interface PanelProperties {
    width: number;
    height: number;
    thickness: number;
}

/** Parametry specyficzne dla kontenera (SmartBox) */
export interface ContainerProperties {
    width: number;
    height: number;
    depth: number;
    panelCount?: number;
}

/** Pojedyncza właściwość użytkownika */
export interface CustomProperty {
    key: string;
    value: string;
    type: 'string' | 'number' | 'boolean' | 'color';
}

/** Typ obiektu w scenie */
export type ObjectKind = 'hole' | 'panel' | 'container' | 'fillet' | 'edge' | 'groove' | 'unknown';

/** Pełne dane inspekcji — przekazywane do UI */
export interface PropertiesData {
    // ─── Nagłówek ───
    name: string;
    objectType: string;         // np. "Otwór walcowy (Cylinder)", "Płyta meblowa (Panel)"
    kind: ObjectKind;
    parentName?: string;
    featureId?: string;         // id operacji jeśli dotyczy
    panelId?: string;           // id formatki
    containerId?: string;       // id kontenera / korpusu

    // ─── Item (Transformacja) ───
    transform: ItemTransform;

    // ─── Properties (Parametry specyficzne) ───
    holeProps?: HoleProperties;
    grooveProps?: GrooveProperties;
    panelProps?: PanelProperties;
    containerProps?: ContainerProperties;

    // ─── Custom Properties ───
    customProperties: CustomProperty[];
}


// ─── PropertiesManager ──────────────────────────────────────

/**
 * Singleton zarządzający inspekcją obiektów w scenie 3D.
 * 
 * Użycie:
 *   const pm = PropertiesManager.instance;
 *   const data = pm.inspectMesh(pickedMesh, projectModel, panelViews);
 *   // → emituje 'smartbox-properties-update' event z PropertiesData
 */
export class PropertiesManager {
    private static _instance: PropertiesManager | null = null;

    /** Aktualnie zaznaczony obiekt */
    private _current: PropertiesData | null = null;

    /** Mapa custom properties per obiekt (klucz = featureId lub panelId) */
    private _customPropsStore: Map<string, CustomProperty[]> = new Map();

    private constructor() {}

    static get instance(): PropertiesManager {
        if (!PropertiesManager._instance) {
            PropertiesManager._instance = new PropertiesManager();
        }
        return PropertiesManager._instance;
    }

    /** Aktualnie wybrane dane */
    get current(): PropertiesData | null {
        return this._current;
    }

    /**
     * Aktywuje i otwiera panel właściwości dla danych obiektów.
     */
    showProperties(data: PropertiesData): void {
        this._current = data;
        document.dispatchEvent(new CustomEvent('smartbox-properties-update', { detail: data }));
    }

    // ─── Inspekcja z Babylon.js Pick (prawy klik na scenie) ────────

    /**
     * Inspekcja meshy pobranego z `scene.pick()`.
     * Rozpoznaje: otwory (walce), płyty (panele), kontenery.
     * Domyślnie emitEvent = false (nie otwiera panelu przy samym PPM).
     */
    inspectMesh(
        pickedMesh: any,
        projectModel: any,
        panelViews: Map<any, any>,
        getAllPanelsFn: (node: any) => any[],
        emitEvent: boolean = false
    ): PropertiesData | null {
        if (!pickedMesh) return null;

        let data: PropertiesData | null = null;

        // A) OTWÓR — walec 3D, ring, krzyżyk
        if (pickedMesh.name.startsWith('hole_') || (pickedMesh.metadata?.type === 'feature')) {
            data = this._inspectHoleMesh(pickedMesh, projectModel, panelViews, getAllPanelsFn, emitEvent);
        }
        // B) PŁYTA / PANEL
        else if (pickedMesh.metadata?.panelModel) {
            data = this._inspectPanelMesh(pickedMesh, panelViews, emitEvent);
        }
        // C) Nieznany obiekt — zwróć minimalne dane
        else {
            const absPos = pickedMesh.absolutePosition || { x: 0, y: 0, z: 0 };
            data = {
                name: pickedMesh.name || 'Obiekt',
                objectType: 'Obiekt 3D',
                kind: 'unknown',
                transform: {
                    loc: { x: 0, y: 0, z: 0 },
                    worldLoc: {
                        x: Math.round(absPos.x),
                        y: Math.round(absPos.y),
                        z: Math.round(absPos.z)
                    }
                },
                customProperties: this._getCustomProps(pickedMesh.name)
            };
            if (emitEvent) {
                this._setCurrent(data);
            } else {
                this._current = data;
            }
        }

        return data;
    }

    // ─── Inspekcja z drzewa operacji (select-feature) ──────────────

    /**
     * Inspekcja operacji (otworu, zaokrąglenia) po ID z drzewa.
     */
    inspectFeature(
        featureId: string,
        projectModel: any,
        panelViews: Map<any, any>,
        getAllPanelsFn: (node: any) => any[],
        facePicker?: any,
        uiSetStatus?: (msg: string, active?: boolean) => void,
        emitEvent: boolean = false
    ): PropertiesData | null {
        let foundFeature: any = null;
        let parentPanel: any = null;

        for (const p of getAllPanelsFn(projectModel)) {
            if (p.features) {
                const f = p.features.find((x: any) => x.id === featureId || x.name === featureId);
                if (f) {
                    foundFeature = f;
                    parentPanel = p;
                    break;
                }
            }
        }

        if (!foundFeature) return null;

        const pv = parentPanel ? panelViews.get(parentPanel) : null;
        let featureMesh: any = null;

        if (pv) {
            // Szukaj walca w _featureMarkers
            if (pv._featureMarkers) {
                featureMesh = pv._featureMarkers.find((m: any) => m.name.includes(foundFeature.id));
            }
            // Fallback: szukaj w faceMeshes
            if (!featureMesh && pv.faceMeshes) {
                featureMesh = Object.values(pv.faceMeshes).find(
                    (m: any) => m.metadata?.type === 'feature' && m.metadata.featureId === foundFeature.id
                );
            }
        }

        // Podświetl mesh w scenie 3D
        if (featureMesh && facePicker) {
            facePicker._selectFeature(featureMesh, featureMesh.metadata?.smartId || null, null, false);
        }

        const dia = safeMm(foundFeature.params?.diameter || foundFeature.dim?.x, 5);
        const dep = safeMm(foundFeature.params?.depth || foundFeature.dim?.z, 12);
        const faceStr = foundFeature.face || 'left';
        const uVal = safeMm(foundFeature.params?.u !== undefined ? foundFeature.params.u : (foundFeature.loc?.x || 0), 0);
        const vVal = safeMm(foundFeature.params?.v !== undefined ? foundFeature.params.v : (foundFeature.loc?.y || 0), 0);
        const worldPos = featureMesh
            ? featureMesh.absolutePosition
            : (pv?.root ? pv.root.absolutePosition : { x: 0, y: 0, z: 0 });

        const isLibrary = foundFeature.params?.source === 'library' && !!foundFeature.params?.library_id;
        const isGroove = String(foundFeature.type).toLowerCase() === 'groove';
        const kind: ObjectKind = foundFeature.type === 'fillet'
            ? 'fillet'
            : (isGroove ? 'groove' : 'hole');
        const objectType = kind === 'fillet'
            ? 'Zaokrąglenie krawędzi (Fillet)'
            : (isLibrary
                ? 'Operacja Smart (ramka / wcięcie)'
                : (isGroove ? 'Wpust silnika (korpus)' : 'Otwór walcowy (Cylinder)'));

        const data: PropertiesData = {
            name: foundFeature.name || (kind === 'fillet' ? 'Zaokrąglenie' : (isGroove ? (isLibrary ? 'Operacja' : 'Wpust') : 'Otwór')),
            objectType,
            kind,
            parentName: parentPanel?.name || 'Płyta',
            featureId: foundFeature.id,
            panelId: parentPanel?.id,
            transform: {
                loc: foundFeature.loc || { x: uVal, y: vVal, z: 0 },
                worldLoc: {
                    x: Math.round(worldPos.x),
                    y: Math.round(worldPos.y),
                    z: Math.round(worldPos.z)
                }
            },
            holeProps: kind === 'hole' ? { diameter: dia, depth: dep, face: faceStr, u: uVal, v: vVal } : undefined,
            grooveProps: kind === 'groove' ? {
                width: safeMm(foundFeature.params?.width, 0),
                length: safeMm(foundFeature.params?.length || foundFeature.params?.height, 0),
                depth: dep,
                face: faceStr,
                u: uVal,
                v: vVal,
                frameMm: safeMm(foundFeature.params?.insets?.l, 0),
                frameHMm: safeMm(foundFeature.params?.insets?.b ?? foundFeature.params?.insets?.t, 0),
                editable: isLibrary,
                source: isLibrary ? 'library' : 'engine',
                libraryId: isLibrary ? String(foundFeature.params.library_id) : undefined,
                placement: foundFeature.params?.placement === 'edge_dims' ? 'edge_dims' : 'frame',
                through: !!foundFeature.params?.through,
                uRef: safeMm(foundFeature.params?.u_ref, 0),
                vRef: safeMm(foundFeature.params?.v_ref, 0),
                uEdge: foundFeature.params?.u_edge,
                vEdge: foundFeature.params?.v_edge,
            } : undefined,
            customProperties: this._getCustomProps(foundFeature.id)
        };

        if (emitEvent) {
            this._setCurrent(data);
        } else {
            this._current = data;
        }

        if (uiSetStatus) {
            if (kind === 'groove') {
                uiSetStatus(isLibrary
                    ? `Wybrano operację Smart: ${data.name}`
                    : `Wpust silnika: ${data.name} (tylko podgląd)`, true);
            } else if (kind === 'hole') {
                uiSetStatus(`Wybrano operację: ${data.name} (⌀${dia}x${dep}mm na ${faceStr})`, true);
            } else {
                uiSetStatus(`Wybrano operację: ${data.name}`, true);
            }
        }

        return data;
    }

    // ─── Inspekcja panelu (select-part / klik na płytę) ────────────

    /**
     * Inspekcja panelu / płyty meblowej.
     */
    inspectPanel(
        panelModel: any,
        panelViews: Map<any, any>,
        emitEvent: boolean = true
    ): PropertiesData | null {
        if (!panelModel) return null;

        const pv = panelViews.get(panelModel);
        const doc = ContextManager.instance.document;
        const cadNode = doc?.findNode(panelModel.id);
        
        let loc = { x: 0, y: 0, z: 0 };
        let rot = { x: 0, y: 0, z: 0 };
        if (cadNode) {
            const decomposed = cadNode.localMatrix.decompose();
            loc = { 
                x: nmToMm(decomposed.translation.x), 
                y: nmToMm(decomposed.translation.y), 
                z: nmToMm(decomposed.translation.z) 
            };
            const eul = decomposed.rotation.toEulerXYZ();
            rot = {
                x: Math.round(eul.x * (180 / Math.PI)),
                y: Math.round(eul.y * (180 / Math.PI)),
                z: Math.round(eul.z * (180 / Math.PI))
            };
        }

        const absPos = pv?.root
            ? pv.root.absolutePosition
            : loc;

        const data: PropertiesData = {
            name: panelModel.name || 'Panel',
            objectType: 'Płyta meblowa (Panel)',
            kind: 'panel',
            panelId: panelModel.id,
            transform: {
                loc: {
                    x: Math.round(loc.x),
                    y: Math.round(loc.y),
                    z: Math.round(loc.z)
                },
                worldLoc: {
                    x: Math.round(absPos.x),
                    y: Math.round(absPos.y),
                    z: Math.round(absPos.z)
                },
                rot
            },
            panelProps: {
                width: safeMm(panelModel.width, 600),
                height: safeMm(panelModel.height, 720),
                thickness: safeMm(panelModel.thickness, 18)
            },
            customProperties: this._getCustomProps(panelModel.id || panelModel.name)
        };

        if (emitEvent) {
            this._setCurrent(data);
        } else {
            this._current = data;
        }
        return data;
    }

    // ─── Inspekcja kontenera (SmartBox) ────────────────────────────

    /**
     * Inspekcja kontenera SmartBox.
     */
    inspectContainer(container: any, emitEvent: boolean = true): PropertiesData | null {
        if (!container) return null;

        const doc = ContextManager.instance.document;
        const cadNode = doc?.findNode(container.id);
        
        let loc = { x: 0, y: 0, z: 0 };
        let worldLoc = { x: 0, y: 0, z: 0 };
        if (cadNode) {
            const decomposed = cadNode.localMatrix.decompose();
            loc = { 
                x: nmToMm(decomposed.translation.x), 
                y: nmToMm(decomposed.translation.y), 
                z: nmToMm(decomposed.translation.z) 
            };
            const worldDecomposed = cadNode.getWorldMatrix().decompose();
            worldLoc = {
                x: nmToMm(worldDecomposed.translation.x), 
                y: nmToMm(worldDecomposed.translation.y), 
                z: nmToMm(worldDecomposed.translation.z)
            };
        }

        const data: PropertiesData = {
            name: container.name || 'Kontener',
            objectType: 'SmartBox (Kontener)',
            kind: 'container',
            containerId: container.id,
            transform: {
                loc: {
                    x: Math.round(loc.x),
                    y: Math.round(loc.y),
                    z: Math.round(loc.z)
                },
                worldLoc: {
                    x: Math.round(worldLoc.x),
                    y: Math.round(worldLoc.y),
                    z: Math.round(worldLoc.z)
                }
            },
            containerProps: {
                width: safeMm(container.width, 800),
                height: safeMm(container.height, 720),
                depth: safeMm(container.depth, 560),
                panelCount: cadNode ? cadNode.children.length : 0
            },
            customProperties: this._getCustomProps(container.id || container.name)
        };

        if (emitEvent) {
            this._setCurrent(data);
        } else {
            this._current = data;
        }
        return data;
    }

    // ─── Generowanie wpisów menu kontekstowego ─────────────────────

    /**
     * Zwraca tablicę wpisów do ContextMenu (pozycja menu "Właściwości").
     */
    getContextMenuItems(data: PropertiesData, iconSvg?: string): any[] {
        const items: any[] = [];

        items.push({
            label: '⚙️ Właściwości',
            icon: iconSvg || '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
            action: 'open-properties',
            shortcut: 'N'
        });
        items.push({ separator: true });

        return items;
    }

    // ─── Custom Properties CRUD ────────────────────────────────────

    /**
     * Dodaje Custom Property do obiektu o danym ID.
     */
    addCustomProperty(objectId: string, key: string, value: string, type: CustomProperty['type'] = 'string'): void {
        const props = this._customPropsStore.get(objectId) || [];
        const existing = props.find(p => p.key === key);
        if (existing) {
            existing.value = value;
            existing.type = type;
        } else {
            props.push({ key, value, type });
        }
        this._customPropsStore.set(objectId, props);
        this._emitCustomPropsChanged(objectId);
    }

    /**
     * Usuwa Custom Property z obiektu o danym ID.
     */
    removeCustomProperty(objectId: string, key: string): void {
        const props = this._customPropsStore.get(objectId) || [];
        const idx = props.findIndex(p => p.key === key);
        if (idx >= 0) {
            props.splice(idx, 1);
            this._customPropsStore.set(objectId, props);
            this._emitCustomPropsChanged(objectId);
        }
    }

    /**
     * Pobiera wszystkie Custom Properties obiektu.
     */
    getCustomProperties(objectId: string): CustomProperty[] {
        return this._customPropsStore.get(objectId) || [];
    }

    /**
     * Aktualizuje wartość Custom Property.
     */
    updateCustomProperty(objectId: string, key: string, value: string): void {
        const props = this._customPropsStore.get(objectId) || [];
        const prop = props.find(p => p.key === key);
        if (prop) {
            prop.value = value;
            this._customPropsStore.set(objectId, props);
            this._emitCustomPropsChanged(objectId);
        }
    }

    /**
     * Serializacja custom properties do JSON (do zapisu w projekcie).
     */
    serializeCustomProperties(): Record<string, CustomProperty[]> {
        const result: Record<string, CustomProperty[]> = {};
        for (const [key, props] of this._customPropsStore.entries()) {
            if (props.length > 0) {
                result[key] = [...props];
            }
        }
        return result;
    }

    /**
     * Deserializacja custom properties z JSON.
     */
    loadCustomProperties(data: Record<string, CustomProperty[]>): void {
        this._customPropsStore.clear();
        for (const [key, props] of Object.entries(data)) {
            this._customPropsStore.set(key, [...props]);
        }
    }

    // ─── Private helpers ───────────────────────────────────────────

    private _inspectHoleMesh(
        pickedMesh: any,
        projectModel: any,
        panelViews: Map<any, any>,
        getAllPanelsFn: (node: any) => any[],
        emitEvent: boolean = false
    ): PropertiesData | null {
        const rawId = pickedMesh.name.replace(/^hole_(cyl_|ring_|cross_|mat_|cyl_mat_)?/, '');
        let foundFeature: any = null;
        let parentPanel: any = null;

        for (const p of getAllPanelsFn(projectModel)) {
            if (p.features) {
                const f = p.features.find((x: any) => x.id === rawId || x.name === rawId || rawId.includes(x.id));
                if (f) {
                    foundFeature = f;
                    parentPanel = p;
                    break;
                }
            }
        }

        if (!foundFeature) return null;

        const dia = safeMm(foundFeature.params?.diameter || foundFeature.dim?.x, 5);
        const dep = safeMm(foundFeature.params?.depth || foundFeature.dim?.z, 12);
        const faceStr = foundFeature.face || 'left';
        const uVal = safeMm(foundFeature.params?.u !== undefined ? foundFeature.params.u : (foundFeature.loc?.x || 0), 0);
        const vVal = safeMm(foundFeature.params?.v !== undefined ? foundFeature.params.v : (foundFeature.loc?.y || 0), 0);
        const absPos = pickedMesh.absolutePosition;

        const data: PropertiesData = {
            name: foundFeature.name || 'Otwór',
            objectType: 'Otwór walcowy (Cylinder)',
            kind: 'hole',
            parentName: parentPanel?.name || 'Płyta',
            featureId: foundFeature.id,
            transform: {
                loc: foundFeature.loc || { x: uVal, y: vVal, z: 0 },
                worldLoc: {
                    x: Math.round(absPos.x),
                    y: Math.round(absPos.y),
                    z: Math.round(absPos.z)
                }
            },
            holeProps: { diameter: dia, depth: dep, face: faceStr, u: uVal, v: vVal },
            customProperties: this._getCustomProps(foundFeature.id)
        };

        if (emitEvent) {
            this._setCurrent(data);
        } else {
            this._current = data;
        }
        return data;
    }

    private _inspectPanelMesh(
        pickedMesh: any,
        panelViews: Map<any, any>,
        emitEvent: boolean = false
    ): PropertiesData | null {
        const p = pickedMesh.metadata.panelModel;
        return this.inspectPanel(p, panelViews, emitEvent);
    }

    private _getCustomProps(objectId: string): CustomProperty[] {
        return [...(this._customPropsStore.get(objectId) || [])];
    }

    private _setCurrent(data: PropertiesData): void {
        this._current = data;
        document.dispatchEvent(new CustomEvent('smartbox-properties-update', { detail: data }));
    }

    private _emitCustomPropsChanged(objectId: string): void {
        // Odśwież current jeśli dotyczy tego samego obiektu
        if (this._current && (this._current.featureId === objectId || this._current.name === objectId)) {
            this._current.customProperties = this._getCustomProps(objectId);
            document.dispatchEvent(new CustomEvent('smartbox-properties-update', { detail: this._current }));
        }
        document.dispatchEvent(new CustomEvent('smartbox-custom-props-changed', {
            detail: { objectId, properties: this.getCustomProperties(objectId) }
        }));
    }
}
