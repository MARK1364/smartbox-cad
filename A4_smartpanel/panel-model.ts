/**
 * SmartPanel Web — Panel Model (Domain Object)
 * 
 * Czysta logika JS — zero zależności od Babylon, OCCT, DOM.
 * Reprezentuje płytę meblową z 6 ścianami i listą features.
 */

import { IDManager, EntityType } from '../A1_core/id-manager.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';

// ─── Face definitions ────────────────────────────────────────

export type FaceName = 'FACE_X_PLUS' | 'FACE_X_MINUS' | 'FACE_Y_PLUS' | 'FACE_Y_MINUS' | 'FACE_Z_PLUS' | 'FACE_Z_MINUS';

const FACE_NAMES: FaceName[] = [
    'FACE_X_PLUS',
    'FACE_X_MINUS',
    'FACE_Y_PLUS',
    'FACE_Y_MINUS',
    'FACE_Z_PLUS',
    'FACE_Z_MINUS'
];

/**
 * Normalizuje dowolną nazwę ściany (legacy lub skróconą) do kanonicznej nazwy LCS.
 */
export function normalizeFaceName(name: string): FaceName {
    if (!name) return 'FACE_Z_PLUS';
    const key = name.trim().toUpperCase();
    switch (key) {
        // Płaszczyzny główne (grubość Z)
        case 'FACE_Z_PLUS':
        case 'FRONT':
        case '+Z':
        case 'POS_Z':
        case 'Z+':
            return 'FACE_Z_PLUS';

        case 'FACE_Z_MINUS':
        case 'BACK':
        case '-Z':
        case 'NEG_Z':
        case 'Z-':
            return 'FACE_Z_MINUS';

        // Płaszczyzny boczne szerokości (oś X)
        case 'FACE_X_MINUS':
        case 'EDGE_X_MINUS':
        case 'LEFT':
        case '-X':
        case 'NEG_X':
        case 'X-':
            return 'FACE_X_MINUS';

        case 'FACE_X_PLUS':
        case 'EDGE_X_PLUS':
        case 'RIGHT':
        case '+X':
        case 'POS_X':
        case 'X+':
            return 'FACE_X_PLUS';

        // Płaszczyzny boczne wysokości (oś Y)
        case 'FACE_Y_PLUS':
        case 'EDGE_Y_PLUS':
        case 'TOP':
        case '+Y':
        case 'POS_Y':
        case 'Y+':
            return 'FACE_Y_PLUS';

        case 'FACE_Y_MINUS':
        case 'EDGE_Y_MINUS':
        case 'BOTTOM':
        case '-Y':
        case 'NEG_Y':
        case 'Y-':
            return 'FACE_Y_MINUS';

        default:
            // Jeśli nie rozpoznano, a jest poprawnym FaceName w innym casingu
            const matched = FACE_NAMES.find(f => f.toUpperCase() === key);
            if (matched) return matched;
            throw new Error(`Invalid face name: "${name}". Valid: ${FACE_NAMES.join(', ')}`);
    }
}

/**
 * Oblicza lokalny układ współrzędnych 2D dla danej ściany płyty.
 * Zgodne z sekcją 9 planu OCCT.
 * 
 * @param {string} rawFaceName 
 * @param {number} w - szerokość płyty (X)
 * @param {number} h - wysokość płyty (Y)
 * @param {number} t - grubość płyty (Z)
 * @returns {{ origin: number[], uAxis: number[], vAxis: number[], normal: number[], width: number, height: number }}
 */
function computeFaceData(rawFaceName: string, w: number, h: number, t: number) {
    const faceName = normalizeFaceName(rawFaceName);
    const cx = -w / 2;
    const cy = -h / 2;
    const cz = -t / 2;
    switch (faceName) {
        case 'FACE_Z_PLUS':  return { origin: [cx, cy, cz + t], uAxis: [1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, 1], width: w, height: h };
        case 'FACE_Z_MINUS': return { origin: [cx + w, cy, cz], uAxis: [-1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, -1], width: w, height: h };
        case 'FACE_X_MINUS': return { origin: [cx, cy, cz], uAxis: [0, 0, 1], vAxis: [0, 1, 0], normal: [-1, 0, 0], width: t, height: h };
        case 'FACE_X_PLUS':  return { origin: [cx + w, cy, cz + t], uAxis: [0, 0, -1], vAxis: [0, 1, 0], normal: [1, 0, 0], width: t, height: h };
        case 'FACE_Y_PLUS':  return { origin: [cx, cy + h, cz + t], uAxis: [1, 0, 0], vAxis: [0, 0, -1], normal: [0, 1, 0], width: w, height: t };
        case 'FACE_Y_MINUS': return { origin: [cx, cy, cz], uAxis: [1, 0, 0], vAxis: [0, 0, 1], normal: [0, -1, 0], width: w, height: t };
        default: throw new Error(`Unknown face: ${faceName}`);
    }
}


// ─── PanelModel class ────────────────────────────────────────

export class PanelModel {
    id: string;
    width: number;
    height: number;
    thickness: number;
    role: string;
    name: string;
    projectName: string;
    parentId: string;
    smartId: any;
    features: any[];
    cncPrograms: any[];
    _nextId: number;
    _listeners: Set<Function>;
    zoneId?: string;
    zonePrefix?: string;
    type: string = 'part';
    visible: boolean = true;
    lcsVisible: boolean = true;
    materialId: string = 'W1100_ST9_18';
    /** Alias kompatybilności z JSON / Blender (materialId). */
    material?: string;
    materialName: string = 'Biały Alpejski';
    materialCode: string = 'W1100 ST9';
    color: { r: number; g: number; b: number; a?: number } = { r: 0.95, g: 0.95, b: 0.95 };
    edgeBanding: Record<string, any> = {};
    custom_properties: Record<string, any> = {};
    /**
     * false = panel ręczny (wzmocnienie, nietypowa płyta w korpusie).
     * Silnik nie kasuje go przy przebudowie i nie nadpisuje wymiarów / transformacji.
     */
    engineManaged: boolean = true;
    /** Asocjacyjna szerokość / wysokość — dwie płaszczyzny + offset [mm]. */
    associativeDims: import('./associative-dim.js').AssociativeDims | null = null;

    constructor({ 
        width = 600_000_000, 
        height = 720_000_000, 
        thickness = 18_000_000, 
        position = {x: 0, y: 0, z: 0},
        rotation = {x: 0, y: 0, z: 0},
        role = "LEFT_SIDE_PANEL",
        name = "Płyta",
        materialId = "W1100_ST9_18",
        materialName = "Biały Alpejski",
        materialCode = "W1100 ST9",
        color = { r: 0.95, g: 0.95, b: 0.95 },
        engineManaged = true,
        zoneId = undefined as string | undefined,
        zonePrefix = undefined as string | undefined,
    } = {}) {
        if ((thickness <= 3_500_000 || role === 'BACK_PANEL') && materialId === 'W1100_ST9_18' && materialName === 'Biały Alpejski') {
            materialId = 'HDF_BIALY_3';
            materialName = 'HDF Biały 3mm';
            materialCode = 'HDF 3mm';
            color = { r: 0.94, g: 0.94, b: 0.94 };
        }

        this.width = width;
        this.height = height;
        this.thickness = thickness;
        this.role = role;
        this.engineManaged = engineManaged !== false;
        this.materialId = materialId;
        this.materialName = materialName;
        this.materialCode = materialCode;
        this.color = color;
        this.custom_properties = { material: materialId, material_name: materialName, material_code: materialCode };
        
        if (zoneId !== undefined) {
            this.zoneId = zoneId;
            this.custom_properties.zone = zoneId;
        }
        if (zonePrefix !== undefined) this.zonePrefix = zonePrefix;

        this.name = name;
        this.projectName = "Projekt";
        
        // ID must be assigned by creator (or generator)
        this.id = 'panel_' + Math.random().toString(36).substr(2, 9);
        
        // Inicjalizacja Głównego ID
        const idMgr = IDManager.getInstance();
        this.parentId = idMgr.register(EntityType.SMARTBOX, "", "main").fullPath;
        this.smartId = idMgr.register(EntityType.PART, this.parentId, "", { model: this });

        this.features = [];
        this.cncPrograms = [];
        this._nextId = 1;
        this._listeners = new Set();
    }

    // Transformacje usunięto. Zgodnie z nową architekturą, transformacje 
    // przechowuje wyłącznie CADNode. Zobacz klasę ContainerModel lub
    // projekt, gdzie PanelModel przypisany jest do node.domainData.

    // ─── Dimensions ──────────────────────────────────

    setDimensions(width, height, thickness) {
        if (this.width === width && this.height === height && this.thickness === thickness) return;
        this.width = width;
        this.height = height;
        this.thickness = thickness;
        this._emit('dimensions', { width, height, thickness });
    }

    // ─── Native LCS (Local Coordinate System) ─────────

    /**
     * Zwraca lokalny natywny układ odniesienia LCS z punktem zerowym (Pivot) w środku formatki.
     */
    getLCS() {
        return {
            origin: [0, 0, 0],
            uX: [1, 0, 0],
            uY: [0, 1, 0],
            uZ: [0, 0, 1],
            width: this.width,
            height: this.height,
            thickness: this.thickness
        };
    }

    setLcsVisible(visible: boolean) {
        if (this.lcsVisible === visible) return;
        this.lcsVisible = visible;
        this._emit('lcsVisibility', { visible });
    }

    // ─── Edge Banding (Okleinowanie Krawędzi) ────────
    
    /**
     * Normalizuje klucz krawędzi do kanonicznego formatu (+X, -X, +Y, -Y).
     */
    static normalizeEdgeKey(key: string): '+X' | '-X' | '+Y' | '-Y' {
        const u = String(key || '').toUpperCase().trim();
        if (u === '+X' || u === 'FACE_X_PLUS' || u === 'RIGHT' || u === 'POS_X' || u === 'X+') return '+X';
        if (u === '-X' || u === 'FACE_X_MINUS' || u === 'LEFT' || u === 'NEG_X' || u === 'X-') return '-X';
        if (u === '+Y' || u === 'FACE_Y_PLUS' || u === 'TOP' || u === 'POS_Y' || u === 'Y+') return '+Y';
        if (u === '-Y' || u === 'FACE_Y_MINUS' || u === 'BOTTOM' || u === 'NEG_Y' || u === 'Y-') return '-Y';
        return '+X';
    }

    /**
     * Ustawia obrzeże na wybranej krawędzi.
     */
    setEdgeBand(edgeKey: string, config: { active?: boolean; type_id?: string; name?: string; thickness_mm?: number; width_mm?: number; color?: any; material_id?: string; price_per_mb?: number }) {
        const canonical = PanelModel.normalizeEdgeKey(edgeKey);
        if (!this.edgeBanding) this.edgeBanding = {};
        const existing = this.edgeBanding[canonical] || {};

        this.edgeBanding[canonical] = {
            active: config.active !== undefined ? config.active : true,
            type_id: config.type_id || existing.type_id || '0.008x0.022',
            name: config.name || existing.name || 'Okleina ABS 0.8x22 mm',
            thickness_mm: config.thickness_mm !== undefined ? config.thickness_mm : (existing.thickness_mm || 0.8),
            width_mm: config.width_mm !== undefined ? config.width_mm : (existing.width_mm || 22.0),
            color: config.color || existing.color || this.color,
            material_id: config.material_id || existing.material_id || this.materialId,
            price_per_mb: config.price_per_mb !== undefined ? config.price_per_mb : (existing.price_per_mb || 3.50)
        };

        if (this.custom_properties) {
            this.custom_properties.edge_banding = { ...this.edgeBanding };
        }

        this._emit('edgeBanding', { edgeBanding: this.edgeBanding, edge: canonical });
    }

    /**
     * Usuwa obrzeże z wybranej krawędzi.
     */
    removeEdgeBand(edgeKey: string) {
        const canonical = PanelModel.normalizeEdgeKey(edgeKey);
        if (!this.edgeBanding) this.edgeBanding = {};
        this.edgeBanding[canonical] = {
            active: false,
            type_id: 'none',
            name: 'Brak',
            thickness_mm: 0
        };

        if (this.custom_properties) {
            this.custom_properties.edge_banding = { ...this.edgeBanding };
        }

        this._emit('edgeBanding', { edgeBanding: this.edgeBanding, edge: canonical });
    }

    /**
     * Usuwa obrzeża ze wszystkich 4 krawędzi.
     */
    clearAllEdgeBanding() {
        this.edgeBanding = {
            '+X': { active: false, type_id: 'none' },
            '-X': { active: false, type_id: 'none' },
            '+Y': { active: false, type_id: 'none' },
            '-Y': { active: false, type_id: 'none' }
        };

        if (this.custom_properties) {
            this.custom_properties.edge_banding = { ...this.edgeBanding };
        }

        this._emit('edgeBanding', { edgeBanding: this.edgeBanding });
    }

    /**
     * Ustawia ten sam typ obrzeża na wszystkich 4 krawędziach.
     */
    setAllEdges(config: any) {
        const keys: ('+X' | '-X' | '+Y' | '-Y')[] = ['+X', '-X', '+Y', '-Y'];
        if (!this.edgeBanding) this.edgeBanding = {};
        for (const k of keys) {
            this.edgeBanding[k] = {
                active: true,
                type_id: config.type_id || '0.008x0.022',
                name: config.name || 'Okleina ABS 0.8x22 mm',
                thickness_mm: config.thickness_mm || 0.8,
                width_mm: config.width_mm || 22.0,
                color: config.color || this.color,
                material_id: config.material_id || this.materialId,
                price_per_mb: config.price_per_mb || 3.50
            };
        }

        if (this.custom_properties) {
            this.custom_properties.edge_banding = { ...this.edgeBanding };
        }

        this._emit('edgeBanding', { edgeBanding: this.edgeBanding });
    }

    /**
     * Przypisuje kompletną mapę obrzeży.
     */
    setEdgeBanding(edgeBandingMap: Record<string, any>) {
        if (!edgeBandingMap || typeof edgeBandingMap !== 'object') return;
        this.edgeBanding = { ...edgeBandingMap };
        if (this.custom_properties) {
            this.custom_properties.edge_banding = { ...this.edgeBanding };
        }
        this._emit('edgeBanding', { edgeBanding: this.edgeBanding });
    }

    // ─── Face queries ────────────────────────────────

    /**
     * Zwraca dane geometryczne ściany.
     * @param {string} name 
     */
    getFace(name: string) {
        const canonical = normalizeFaceName(name);
        const w = nmToMm(this.width);
        const h = nmToMm(this.height);
        const t = nmToMm(this.thickness);
        return computeFaceData(canonical, w, h, t);
    }

    /**
     * Zwraca wszystkie ściany.
     */
    getAllFaces() {
        const result: Record<string, any> = {};
        for (const name of FACE_NAMES) {
            result[name] = this.getFace(name);
        }
        return result;
    }

    // ─── Features ────────────────────────────────────

    /**
     * Dodaje feature do płyty.
     * @param {{ type: string, face: string, params: object }} feature
     * @returns {number} id dodanego feature
     */
    addFeature({ type, face, params }: { type: string, face: string, params: any }) {
        let canonicalFace = face;
        if (face !== 'edge' && face !== 'none') {
            canonicalFace = normalizeFaceName(face);
        }
        const id = this._nextId++;
        const entry = { id, type, face: canonicalFace, params: { ...params } };
        this.features.push(entry);
        this._emit('featureAdded', entry);
        return id;
    }

    /**
     * Usuwa feature po id.
     */
    removeFeature(id) {
        const idx = this.features.findIndex(f => f.id === id);
        if (idx !== -1) {
            const removed = this.features.splice(idx, 1)[0];
            this._emit('featureRemoved', removed);
        }
    }

    /**
     * Zwraca features na danej ścianie.
     */
    getFeaturesOnFace(faceName) {
        return this.features.filter(f => f.face === faceName);
    }

    /**
     * Czyści wszystkie features.
     */
    clearFeatures() {
        this.features = [];
        this._nextId = 1;
        this._emit('featuresCleared', {});
    }

    /**
     * Ustawia nową tablicę operacji (features) i powiadamia widok 3D.
     */
    setFeatures(features) {
        this.features = (features || []).map(f => ({
            ...f,
            params: { ...(f.params || {}) }
        }));
        this._nextId = this.features.reduce((max, f) => Math.max(max, (f.id || 0) + 1), 1);
        this._emit('features', { features: this.features });
    }

    // ─── Serialization ───────────────────────────────

    toJSON() {
        return {
            projectName: this.projectName,
            name: this.name,
            role: this.role,
            width: this.width,
            height: this.height,
            thickness: this.thickness,
            materialId: this.materialId,
            materialName: this.materialName,
            materialCode: this.materialCode,
            color: this.color,
            edgeBanding: this.edgeBanding,
            custom_properties: this.custom_properties,
            engineManaged: this.engineManaged,
            associativeDims: this.associativeDims,
            features: this.features.map(f => ({ ...f, params: { ...f.params } }))
        };
    }

    fromJSON(data: any) {
        if (!data) return;
        if (data.width != null) this.width = data.width;
        if (data.height != null) this.height = data.height;
        if (data.thickness != null) this.thickness = data.thickness;
        if (data.name != null) this.name = data.name;
        if (data.role != null) this.role = data.role;
        if (data.projectName != null) this.projectName = data.projectName;
        if (data.materialId != null) this.materialId = data.materialId;
        if (data.materialName != null) this.materialName = data.materialName;
        if (data.materialCode != null) this.materialCode = data.materialCode;
        if (data.color != null) this.color = data.color;
        if (data.edgeBanding != null) this.edgeBanding = data.edgeBanding;
        if (data.custom_properties != null) this.custom_properties = data.custom_properties;
        if (data.engineManaged != null) this.engineManaged = data.engineManaged !== false;
        if (data.associativeDims !== undefined) this.associativeDims = data.associativeDims;
        if (data.features) {
            this.features = data.features.map((f: any) => ({
                ...f,
                params: { ...(f.params || {}) }
            }));
            this._nextId = this.features.reduce((max, f) => Math.max(max, (f.id || 0) + 1), 1);
        }
    }

    static fromJSON(data: any) {
        const panel = new PanelModel({
            width: data.width,
            height: data.height,
            thickness: data.thickness,
            role: data.role,
            name: data.name,
            materialId: data.materialId,
            materialName: data.materialName,
            materialCode: data.materialCode,
            color: data.color
        });
        panel.fromJSON(data);
        return panel;
    }

    /**
     * Ładuje stan z JSON snapshot in-place (bez tworzenia nowej instancji).
     * Używane przez undo/redo.
     * @param {object} data 
     */
    loadFromJSON(data) {
        this.projectName = data.projectName || "Projekt";
        this.name = data.name || "Płyta";
        this.role = data.role || this.role;
        this.width = data.width;
        this.height = data.height;
        this.thickness = data.thickness;
        if (data.materialId) this.materialId = data.materialId;
        if (data.materialName) this.materialName = data.materialName;
        if (data.materialCode) this.materialCode = data.materialCode;
        if (data.color) this.color = data.color;
        if (data.edgeBanding) this.edgeBanding = data.edgeBanding;
        if (data.custom_properties) this.custom_properties = data.custom_properties;
        if (data.engineManaged != null) this.engineManaged = data.engineManaged !== false;
        if (data.associativeDims !== undefined) this.associativeDims = data.associativeDims;
        this.features = (data.features || []).map(f => ({
            ...f,
            params: { ...f.params }
        }));
        this._nextId = this.features.reduce((max, f) => Math.max(max, f.id + 1), 1);
        this._emit('loaded', data);
    }

    // ─── Project format (.spp.json) ─────────────────

    /**
     * Serializuje pełny projekt z metadanymi, kamerą i ustawieniami.
     * @param {object} opts
     * @param {string} [opts.name] - Nazwa projektu
     * @param {object} [opts.camera] - { alpha, beta, radius, target }
     * @param {string} [opts.renderMode] - 'shaded' | 'edges' | 'wireframe' | 'xray'
     * @param {boolean} [opts.gridVisible]
     * @param {string} [opts.projection] - 'perspective' | 'ortho'
     * @returns {object}
     */


    // ─── Events ──────────────────────────────────────

    /**
     * Rejestruje listener na zmiany modelu.
     * @param {Function} fn - callback(eventType, data)
     */
    onChange(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    offChange(fn) {
        this._listeners.delete(fn);
    }

    _emit(type, data) {
        for (const fn of this._listeners) {
            try { fn(type, data); } catch (e) { console.error('PanelModel listener error:', e); }
        }
    }
}

/** Panel ręczny (wzmocnienie, nietypowa płyta) — silnik nie kasuje i nie nadpisuje. */
export function isManualPanel(panel: any): boolean {
    return !!panel && panel.engineManaged === false;
}

export { FACE_NAMES };
