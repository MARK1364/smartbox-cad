/**
 * hardware-loader.ts — Loader i cache modeli 3D okuć (GLB) dla silnika Babylon.js.
 * 
 * Standard: B1_biblioteka
 * - Modele są ładowane asynchronicznie raz i trzymane w cache jako szablony (master).
 * - Każdy zawias/uchwyt/prowadnica na scenie to lekki klon szablonu.
 * - Jednostki sceny Babylon to milimetry (mm).
 */

declare const BABYLON: any;

import { resolveHingeAlignAxes } from './hinge-align.js';
import {
    createParametricDrawerSideMesh,
    type DrawerSideProfileInput
} from './szuflady/parametric-drawer-side.js';

// Indeks wszystkich modeli 3D z B1_biblioteka (zawiasy, szuflady, uchwyty, wyposażenie sceny)
const HINGE_GLB_MAP = typeof (import.meta as any).glob === 'function' ? (import.meta as any).glob('./zawiasy/**/*.glb', { query: '?url', eager: true }) : {};
const DRAWER_GLB_MAP = typeof (import.meta as any).glob === 'function' ? (import.meta as any).glob('./szuflady/**/*.glb', { query: '?url', eager: true }) : {};
const HANDLE_GLB_MAP = typeof (import.meta as any).glob === 'function' ? (import.meta as any).glob('./uchwyty/**/*.glb', { query: '?url', eager: true }) : {};
const HANGER_GLB_MAP = typeof (import.meta as any).glob === 'function' ? (import.meta as any).glob('./zawieszki/**/*.glb', { query: '?url', eager: true }) : {};
const SHELF_PIN_GLB_MAP = typeof (import.meta as any).glob === 'function' ? (import.meta as any).glob('./polki_akcesoria/**/*.glb', { query: '?url', eager: true }) : {};
const SCENE_PROP_MODEL_MAP = typeof (import.meta as any).glob === 'function'
    ? (import.meta as any).glob('./wyposazenie/**/*.{glb,gltf,obj,stl}', { query: '?url', eager: true })
    : {};
const ALL_GLB_MAP: Record<string, string> = {};
const DEV_GLB_BUST = (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ? `?v=${Date.now()}` : '';

for (const [p, mod] of Object.entries({
    ...HINGE_GLB_MAP,
    ...DRAWER_GLB_MAP,
    ...HANDLE_GLB_MAP,
    ...HANGER_GLB_MAP,
    ...SHELF_PIN_GLB_MAP,
    ...SCENE_PROP_MODEL_MAP,
})) {
    const filename = p.replace(/^.*[\\/]/, '').toLowerCase();
    const url = (mod as any)?.default || p;
    ALL_GLB_MAP[filename] = url;
    // Alias bez rozszerzenia → ten sam URL (loadTemplate('Easy-160'))
    const stem = filename.replace(/\.(glb|gltf|obj|stl)$/i, '');
    if (stem && !ALL_GLB_MAP[stem]) ALL_GLB_MAP[stem] = url;
}

export interface ImportedModelResult {
    templateId: string;
    name: string;
    format: 'glb' | 'gltf' | 'obj' | 'stl';
    width_mm: number;
    depth_mm: number;
    height_mm: number;
}

/**
 * Identyfikuje czy dane id dotyczy zawiasu meblowego (np. Blum 71B3550, 70T3550, 47561700).
 * Ściśle odrzuca szuflady, prowadnice, uchwyty i zawieszki.
 */
export function isHingeHardwareId(id?: string | null): boolean {
    const s = String(id || '').toLowerCase().trim();
    if (!s) return false;
    if (/antaro|merivo|tandem|szuflad|prowadnic|rail|handle|reling|uchwyt|zawieszk|wieszak|podpork/i.test(s)) {
        return false;
    }
    if (/^(71b|70t|71t|79t|79b|47561700|78z)/i.test(s)) return true;
    if (/^blum_(71b|70t|71t|79t|79b|47561700|78z)/i.test(s)) return true;
    if (/blum.*(zawias|hinge)/i.test(s)) return true;
    if (/(^|_)(hinge|zawias)(_|$)/i.test(s)) return true;
    return false;
}

/**
 * Identyfikuje czy dane id dotyczy szuflady / prowadnicy (np. Antaro, Merivo, Tandem, M94).
 */
export function isDrawerRailHardwareId(id?: string | null): boolean {
    const s = String(id || '').toLowerCase().trim();
    if (!s) return false;
    return /antaro|merivo|tandem|szuflad|prowadnic|rail/i.test(s);
}

/**
 * Zwraca identyfikator wspólnego szablonu GLB dla obsługiwanych systemów szuflad.
 */
export function resolveDrawerGlbTemplateId(id?: string | null): 'merivobox' | 'antaro' | null {
    const s = String(id || '');
    if (/merivo|^mr/i.test(s)) return 'merivobox';
    if (/antaro/i.test(s)) return 'antaro';
    return null;
}

export class HardwareLoader {
    private static _instance: HardwareLoader | null = null;
    private _templates: Map<string, any> = new Map();
    private _assetContainers: Map<string, any> = new Map();
    private _templateBounds: Map<string, any> = new Map();
    private _loadPromises: Map<string, Promise<any>> = new Map();
    private _customModelUrls: Map<string, { url: string; ext: string; unitScale: 'mm' | 'cm' | 'm' }> = new Map();

    public static get instance(): HardwareLoader {
        if (!this._instance) {
            this._instance = new HardwareLoader();
        }
        return this._instance;
    }

    /**
     * Upewnia się, że loader glTF/GLB jest zarejestrowany w Babylon.js.
     */
    private async ensureLoader(): Promise<boolean> {
        if (typeof BABYLON === 'undefined') return false;

        const isGlbAvailable =
            typeof (BABYLON as any).GLTFFileLoader !== 'undefined' ||
            (typeof BABYLON.SceneLoader?.IsPluginForExtensionAvailable === 'function' &&
                BABYLON.SceneLoader.IsPluginForExtensionAvailable('.glb')) ||
            (typeof BABYLON.SceneLoader?.GetPluginForExtension === 'function' &&
                !!BABYLON.SceneLoader.GetPluginForExtension('.glb'));

        if (typeof BABYLON.SceneLoader?.ImportMeshAsync === 'function' && isGlbAvailable) {
            return true;
        }

        if (typeof document === 'undefined') return false;

        // Sprawdź czy skrypt już został załączony w HTML (np. index.html) lub jest w trakcie ładowania
        const existingScript = document.querySelector('script[src*="babylonjs.loaders"]') as HTMLScriptElement | null;
        if (existingScript) {
            if (isGlbAvailable) {
                return true;
            }
            return new Promise<boolean>((resolve) => {
                existingScript.addEventListener('load', () => resolve(true));
                existingScript.addEventListener('error', () => resolve(false));
                setTimeout(() => {
                    const ready = typeof (BABYLON as any).GLTFFileLoader !== 'undefined' ||
                        BABYLON.SceneLoader?.IsPluginForExtensionAvailable?.('.glb');
                    resolve(!!ready);
                }, 1000);
            });
        }

        return new Promise<boolean>((resolve) => {
            console.log('[HardwareLoader] Wstrzykiwanie babylonjs.loaders.min.js...');
            const script = document.createElement('script');
            script.src = 'https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js';
            script.onload = () => {
                console.log('[HardwareLoader] Załadowano babylonjs.loaders.min.js');
                resolve(true);
            };
            script.onerror = (err) => {
                console.error('[HardwareLoader] Błąd pobierania loadera GLB:', err);
                resolve(false);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Wczytuje i buforuje model GLB jako szablon na scenie.
     */
    public async loadTemplate(id: string, scene: any): Promise<any> {
        if (this._templates.has(id)) {
            return this._templates.get(id);
        }

        const isBlumHingeReq = isHingeHardwareId(id);
        if (isBlumHingeReq) {
            const shared =
                this._templates.get('blum zawiasy') ||
                this._templates.get('blum zawiasy.glb') ||
                this._templates.get('blum_zawiasy') ||
                this._templates.get('blum_zawiasy.glb');
            if (shared) {
                this._templates.set(id, shared);
                return shared;
            }
        }

        if (this._loadPromises.has(id)) {
            return this._loadPromises.get(id);
        }
        if (isBlumHingeReq) {
            const sharedPromise =
                this._loadPromises.get('blum zawiasy') ||
                this._loadPromises.get('blum zawiasy.glb') ||
                this._loadPromises.get('blum_zawiasy');
            if (sharedPromise) {
                return sharedPromise;
            }
        }

        const promise = (async () => {
            const hasLoader = await this.ensureLoader();
            if (!hasLoader) {
                console.error('[HardwareLoader] Loader GLB niedostępny');
                return null;
            }

            const baseId = id.replace(/_[LR]$/, '');
            const cleanId = id.toLowerCase().trim().replace(/\.(glb|gltf|obj|stl)$/i, '');
            const cleanBaseId = baseId.toLowerCase().trim().replace(/\.(glb|gltf|obj|stl)$/i, '');

            let loadedResult: any = null;
            let successPath = '';

            // 0. Sprawdzenie zaimportowanych z dysku modeli (Blob / DataURL)
            const customModel = this._customModelUrls.get(id) || this._customModelUrls.get(cleanId);
            if (customModel) {
                try {
                    loadedResult = await BABYLON.SceneLoader.ImportMeshAsync(
                        '',
                        '',
                        customModel.url,
                        scene,
                        null,
                        customModel.ext
                    );
                    if (loadedResult && loadedResult.meshes && loadedResult.meshes.length > 0) {
                        successPath = customModel.url;
                    }
                } catch (err) {
                    console.warn(`[HardwareLoader] Niepowodzenie ładowania modelu własnego (${id}):`, err);
                }
            }

            const isBlumHingeId = isHingeHardwareId(cleanId) || isHingeHardwareId(id);
            const isDrawerRail = isDrawerRailHardwareId(cleanId) || isDrawerRailHardwareId(id);

            // 1. Sprawdzenie zaindeksowanych modeli w ALL_GLB_MAP (z zachowaniem ścisłej tożsamości)
            const directUrl = !loadedResult ? (
                (isBlumHingeId ? (ALL_GLB_MAP['blum zawiasy.glb'] || ALL_GLB_MAP['blum_zawiasy.glb'] || ALL_GLB_MAP['blum zawiasy']) : null) ||
                ALL_GLB_MAP[cleanId + '.glb'] ||
                ALL_GLB_MAP[cleanId + '.obj'] ||
                ALL_GLB_MAP[cleanId + '.stl'] ||
                ALL_GLB_MAP[cleanId + '.gltf'] ||
                ALL_GLB_MAP[cleanBaseId + '.glb'] ||
                ALL_GLB_MAP[cleanId] ||
                ALL_GLB_MAP[cleanBaseId]
            ) : null;

            if (directUrl) {
                try {
                    const cleanUrl = directUrl.split('?')[0];
                    const lastSlash = cleanUrl.lastIndexOf('/');
                    const rootUrl = directUrl.substring(0, lastSlash + 1);
                    const filenameRaw = directUrl.substring(lastSlash + 1);
                    const filename = (DEV_GLB_BUST && !filenameRaw.includes('?')) ? `${filenameRaw}${DEV_GLB_BUST}` : filenameRaw;
                    const extMatch = cleanUrl.match(/\.(glb|gltf|obj|stl)$/i);
                    const pluginExtension = extMatch ? `.${extMatch[1].toLowerCase()}` : '.glb';
                    loadedResult = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, filename, scene, null, pluginExtension);
                    if (loadedResult && loadedResult.meshes && loadedResult.meshes.length > 0) {
                        successPath = directUrl;
                    }
                } catch (err) {
                    console.warn(`[HardwareLoader] Niepowodzenie ładowania z mapy (${directUrl}):`, err);
                }
            }

            if (!loadedResult || !loadedResult.meshes || loadedResult.meshes.length === 0) {
                const candidates: string[] = [];

                if (isBlumHingeId) {
                    // Zawiasy Blum: wyłącznie plik blum zawiasy.glb lub dedykowany {id}.glb
                    candidates.push(
                        `/B1_biblioteka/zawiasy/Blum/blum zawiasy.glb`,
                        `./B1_biblioteka/zawiasy/Blum/blum zawiasy.glb`,
                        `/B1_biblioteka/zawiasy/blum zawiasy.glb`,
                        `./B1_biblioteka/zawiasy/blum zawiasy.glb`,
                        `/B1_biblioteka/zawiasy/Blum/${id}.glb`,
                        `./B1_biblioteka/zawiasy/Blum/${id}.glb`,
                        `/B1_biblioteka/zawiasy/${id}.glb`,
                        `./B1_biblioteka/zawiasy/${id}.glb`
                    );
                } else if (/gtv/i.test(id)) {
                    // Dedykowany zawias GTV - wyłącznie plik GTV!
                    candidates.push(
                        `/B1_biblioteka/zawiasy/Gtv/${id}.glb`,
                        `./B1_biblioteka/zawiasy/Gtv/${id}.glb`,
                        `/B1_biblioteka/zawiasy/${id}.glb`,
                        `./B1_biblioteka/zawiasy/${id}.glb`
                    );
                } else if (/hettich/i.test(id)) {
                    // Dedykowany zawias Hettich - wyłącznie plik Hettich!
                    candidates.push(
                        `/B1_biblioteka/zawiasy/Hettich/${id}.glb`,
                        `./B1_biblioteka/zawiasy/Hettich/${id}.glb`,
                        `/B1_biblioteka/zawiasy/${id}.glb`,
                        `./B1_biblioteka/zawiasy/${id}.glb`
                    );
                } else if (/merivo|^mr/i.test(`${id} ${cleanId}`)) {
                    candidates.push(
                        `/B1_biblioteka/szuflady/Blum/Merivo/merivobox.glb`,
                        `./B1_biblioteka/szuflady/Blum/Merivo/merivobox.glb`,
                        `/B1_biblioteka/szuflady/Blum/Merivo/models/${cleanId}.glb`,
                        `./B1_biblioteka/szuflady/Blum/Merivo/models/${cleanId}.glb`,
                        `/B1_biblioteka/szuflady/Blum/Merivo/models/merivobox.glb`,
                        `./B1_biblioteka/szuflady/Blum/Merivo/models/merivobox.glb`
                    );
                } else if (/antaro/i.test(`${id} ${cleanId}`)) {
                    candidates.push(
                        `/B1_biblioteka/szuflady/Blum/Antaro/Antaro.glb`,
                        `./B1_biblioteka/szuflady/Blum/Antaro/Antaro.glb`,
                        `/B1_biblioteka/szuflady/Blum/Antaro/models/${id}.glb`,
                        `./B1_biblioteka/szuflady/Blum/Antaro/models/${id}.glb`,
                        `/B1_biblioteka/szuflady/Blum/Antaro/models/${baseId}.glb`,
                        `./B1_biblioteka/szuflady/Blum/Antaro/models/${baseId}.glb`,
                        `/B1_biblioteka/szuflady/Blum/Antaro/models/${cleanId}.glb`,
                        `./B1_biblioteka/szuflady/Blum/Antaro/models/${cleanId}.glb`
                    );
                } else {
                    candidates.push(
                        `/B1_biblioteka/uchwyty/Rejs/models/${cleanId}.glb`,
                        `./B1_biblioteka/uchwyty/Rejs/models/${cleanId}.glb`,
                        `/B1_biblioteka/uchwyty/Rejs/models/${id}.glb`,
                        `./B1_biblioteka/uchwyty/Rejs/models/${id}.glb`,
                        `/B1_biblioteka/zawieszki/models/${cleanId}.glb`,
                        `./B1_biblioteka/zawieszki/models/${cleanId}.glb`,
                        `/B1_biblioteka/zawieszki/models/${id}.glb`,
                        `./B1_biblioteka/zawieszki/models/${id}.glb`,
                        `/B1_biblioteka/polki_akcesoria/models/${id}.glb`,
                        `./B1_biblioteka/polki_akcesoria/models/${id}.glb`,
                        `/B1_biblioteka/polki_akcesoria/models/${cleanId}.glb`,
                        `./B1_biblioteka/polki_akcesoria/models/${cleanId}.glb`,
                        `/B1_biblioteka/wyposazenie/models/${cleanId}.glb`,
                        `./B1_biblioteka/wyposazenie/models/${cleanId}.glb`,
                        `/B1_biblioteka/wyposazenie/models/${id}.glb`,
                        `./B1_biblioteka/wyposazenie/models/${id}.glb`
                    );
                }

                for (const path of candidates) {
                    try {
                        const cleanPath = path.split('?')[0];
                        const lastSlash = cleanPath.lastIndexOf('/');
                        const rootUrl = path.substring(0, lastSlash + 1);
                        const filenameRaw = path.substring(lastSlash + 1);
                        const filename = (DEV_GLB_BUST && !filenameRaw.includes('?')) ? `${filenameRaw}${DEV_GLB_BUST}` : filenameRaw;
                        const extMatch = cleanPath.match(/\.(glb|gltf|obj|stl)$/i);
                        const pluginExtension = extMatch ? `.${extMatch[1].toLowerCase()}` : '.glb';

                        loadedResult = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, filename, scene, null, pluginExtension);
                        if (loadedResult && loadedResult.meshes && loadedResult.meshes.length > 0) {
                            successPath = path;
                            break;
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }

            if (!loadedResult || !loadedResult.meshes || loadedResult.meshes.length === 0) {
                console.error(`[HardwareLoader] BŁĄD KRYTYCZNY: Brak pliku modelu 3D dla okucia "${id}". Blokada cichego zastępowania.`);
                return null;
            }

            // Utwórz węzeł główny szablonu w neutralnej pozycji
            const templateRoot = new BABYLON.TransformNode(`template_${id}`, scene);
            templateRoot.position.set(0, 0, 0);

            // Podepnij meshe i węzły do węzła szablonu
            for (const mesh of loadedResult.meshes) {
                if (!mesh.parent) {
                    mesh.parent = templateRoot;
                }
                mesh.isPickable = false;
            }
            if (Array.isArray(loadedResult.transformNodes)) {
                for (const tn of loadedResult.transformNodes) {
                    if (!tn.parent && tn !== templateRoot) {
                        tn.parent = templateRoot;
                    }
                }
            }

            // Normalizacja skali (metry -> milimetry):
            // Jeśli maksymalny wymiar geometrii jest < 2.0 (metry), skalujemy szablon x1000 do mm Babylona.
            let minVec = new BABYLON.Vector3(Infinity, Infinity, Infinity);
            let maxVec = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
            for (const mesh of loadedResult.meshes) {
                if (mesh.getBoundingInfo && typeof mesh.getBoundingInfo === 'function') {
                    mesh.computeWorldMatrix(true);
                    const b = mesh.getBoundingInfo().boundingBox;
                    minVec = BABYLON.Vector3.Minimize(minVec, b.minimumWorld);
                    maxVec = BABYLON.Vector3.Maximize(maxVec, b.maximumWorld);
                }
            }
            const diag = BABYLON.Vector3.Distance(minVec, maxVec);
            let scaleFactor = 1;
            if (diag > 0.0001 && diag < 2.0) {
                scaleFactor = 1000;
                templateRoot.scaling.set(1000, 1000, 1000);
            }

            if (Number.isFinite(minVec.x) && Number.isFinite(maxVec.x)) {
                templateRoot.metadata = {
                    ...(templateRoot.metadata || {}),
                    rawBounds: {
                        minX: minVec.x,
                        maxX: maxVec.x,
                        minY: minVec.y,
                        maxY: maxVec.y,
                        minZ: minVec.z,
                        maxZ: maxVec.z,
                        sizeX: Math.max(1e-4, Math.abs(maxVec.x - minVec.x)),
                        sizeY: Math.max(1e-4, Math.abs(maxVec.y - minVec.y)),
                        sizeZ: Math.max(1e-4, Math.abs(maxVec.z - minVec.z)),
                        scaleFactor,
                    },
                };
            }

            templateRoot.setEnabled(false);

            this._templates.set(id, templateRoot);
            // Alias po nazwie pliku (uchwyty: Easy-160 / easy-160)
            if (cleanId && cleanId !== id) this._templates.set(cleanId, templateRoot);
            const withGlb = `${cleanId}.glb`;
            if (cleanId && !this._templates.has(withGlb)) this._templates.set(withGlb, templateRoot);
            if (/blum[\s_]*zawiasy/i.test(successPath) || isBlumHingeReq) {
                this._templates.set('blum zawiasy', templateRoot);
                this._templates.set('blum zawiasy.glb', templateRoot);
                this._templates.set('blum_zawiasy', templateRoot);
                this._templates.set('blum_zawiasy.glb', templateRoot);
            }
            console.log(`[HardwareLoader] ✅ Załadowano i przygotowano szablon ${id} z ${successPath}`);
            return templateRoot;
        })();

        this._loadPromises.set(id, promise);
        if (isBlumHingeReq) {
            this._loadPromises.set('blum zawiasy', promise);
            this._loadPromises.set('blum zawiasy.glb', promise);
            this._loadPromises.set('blum_zawiasy', promise);
            this._loadPromises.set('blum_zawiasy.glb', promise);
        }
        return promise;
    }

    /**
     * Importuje zewnętrzny plik modelu 3D z dysku (.glb, .gltf, .obj, .stl),
     * rejestruje szablon w pamięci podręcznej i zwraca wyliczone wymiary gabarytowe w mm.
     */
    public async importModelFromFile(
        file: File,
        scene: any,
        options: { unitScale?: 'mm' | 'cm' | 'm'; templateId?: string } = {}
    ): Promise<ImportedModelResult | null> {
        const hasLoader = await this.ensureLoader();
        if (!hasLoader || typeof BABYLON === 'undefined' || !scene) {
            console.error('[HardwareLoader] Brak sceny lub loadera Babylon.js dla importu pliku 3D.');
            return null;
        }

        const fileName = file.name || 'model.glb';
        const extMatch = fileName.toLowerCase().match(/\.(glb|gltf|obj|stl)$/);
        const format = (extMatch ? extMatch[1] : 'glb') as 'glb' | 'gltf' | 'obj' | 'stl';
        const pluginExt = `.${format}`;
        const baseName = fileName.replace(/\.(glb|gltf|obj|stl)$/i, '').trim() || 'Model_3D';
        const templateId = options.templateId || `imported_${baseName.toLowerCase().replace(/[^a-z0-9_-]+/g, '_')}_${Date.now()}`;

        const blobUrl = URL.createObjectURL(file);
        let assetContainer: any = null;
        let loadedResult: any = null;

        // 1. Spróbuj załadować jako AssetContainer (Babylon.js standard dla pełnego klonowania glTF/OBJ)
        if (typeof BABYLON.SceneLoader?.LoadAssetContainerAsync === 'function') {
            try {
                assetContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync('', '', blobUrl, scene, null, pluginExt);
            } catch {
                try {
                    assetContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync('', 'file:', file, scene, null, pluginExt);
                } catch {
                    // ignore
                }
            }
        }

        // 2. Fallback: ImportMeshAsync jeśli LoadAssetContainerAsync nie zwrócił siatek
        if (!assetContainer || !Array.isArray(assetContainer.meshes) || assetContainer.meshes.length === 0) {
            assetContainer = null;
            try {
                try {
                    loadedResult = await BABYLON.SceneLoader.ImportMeshAsync('', '', file, scene, null, pluginExt);
                } catch {
                    loadedResult = await BABYLON.SceneLoader.ImportMeshAsync('', '', blobUrl, scene, null, pluginExt);
                }
            } catch (err) {
                console.error(`[HardwareLoader] Błąd importu pliku ${fileName}:`, err);
                return null;
            }
            if (!loadedResult || !Array.isArray(loadedResult.meshes) || loadedResult.meshes.length === 0) {
                console.warn(`[HardwareLoader] Plik ${fileName} nie zawiera siatek 3D.`);
                return null;
            }
        }

        const candidateMeshes = assetContainer ? assetContainer.meshes : loadedResult.meshes;
        let minVec = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let maxVec = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

        for (const mesh of candidateMeshes) {
            if (mesh.getBoundingInfo && typeof mesh.getBoundingInfo === 'function') {
                const totalVertices = typeof mesh.getTotalVertices === 'function' ? mesh.getTotalVertices() : 1;
                if (totalVertices > 0) {
                    mesh.computeWorldMatrix(true);
                    const b = mesh.getBoundingInfo().boundingBox;
                    minVec = BABYLON.Vector3.Minimize(minVec, b.minimumWorld);
                    maxVec = BABYLON.Vector3.Maximize(maxVec, b.maximumWorld);
                }
            }
            mesh.isPickable = true;
            // Domyślny materiał dla plików .obj / .stl bez materiału
            if (!mesh.material && typeof BABYLON.StandardMaterial === 'function') {
                let defaultMat = scene.getMaterialByName?.('b1_imported_model_mat');
                if (!defaultMat) {
                    defaultMat = new BABYLON.StandardMaterial('b1_imported_model_mat', scene);
                    defaultMat.diffuseColor = new BABYLON.Color3(0.82, 0.85, 0.89);
                    defaultMat.specularColor = new BABYLON.Color3(0.35, 0.35, 0.38);
                    defaultMat.backFaceCulling = false;
                }
                mesh.material = defaultMat;
            }
        }

        const templateRoot = new BABYLON.TransformNode(`template_${templateId}`, scene);
        templateRoot.position.set(0, -999999, 0);
        templateRoot.setEnabled(false);

        if (loadedResult) {
            for (const mesh of loadedResult.meshes) {
                if (!mesh.parent) mesh.parent = templateRoot;
            }
            if (Array.isArray(loadedResult.transformNodes)) {
                for (const tn of loadedResult.transformNodes) {
                    if (!tn.parent && tn !== templateRoot) tn.parent = templateRoot;
                }
            }
        }

        const rawSizeX = Number.isFinite(minVec.x) ? Math.max(1e-4, Math.abs(maxVec.x - minVec.x)) : 500;
        const rawSizeY = Number.isFinite(minVec.y) ? Math.max(1e-4, Math.abs(maxVec.y - minVec.y)) : 500;
        const rawSizeZ = Number.isFinite(minVec.z) ? Math.max(1e-4, Math.abs(maxVec.z - minVec.z)) : 500;
        const maxRawDim = Math.max(rawSizeX, rawSizeY, rawSizeZ);

        let effectiveUnitScale: 'mm' | 'cm' | 'm' = options.unitScale || (format === 'glb' || format === 'gltf' ? 'm' : 'mm');
        if (!options.unitScale) {
            if (maxRawDim < 3.0) {
                effectiveUnitScale = 'm';
            } else if (maxRawDim >= 3.0 && maxRawDim < 80.0) {
                effectiveUnitScale = 'cm';
            } else {
                effectiveUnitScale = 'mm';
            }
        } else if (options.unitScale === 'm' && maxRawDim > 50.0) {
            effectiveUnitScale = 'mm';
        }

        this._customModelUrls.set(templateId, { url: blobUrl, ext: pluginExt, unitScale: effectiveUnitScale });
        this._customModelUrls.set(templateId.toLowerCase(), { url: blobUrl, ext: pluginExt, unitScale: effectiveUnitScale });

        const unitMultiplier = effectiveUnitScale === 'm' ? 1000 : effectiveUnitScale === 'cm' ? 10 : 1;
        const width_mm = Math.max(10, Math.round(rawSizeX * unitMultiplier));
        const height_mm = Math.max(10, Math.round(rawSizeY * unitMultiplier));
        const depth_mm = Math.max(10, Math.round(rawSizeZ * unitMultiplier));

        const rawBounds = {
            minX: Number.isFinite(minVec.x) ? minVec.x : -rawSizeX / 2,
            maxX: Number.isFinite(maxVec.x) ? maxVec.x : rawSizeX / 2,
            minY: Number.isFinite(minVec.y) ? minVec.y : -rawSizeY / 2,
            maxY: Number.isFinite(maxVec.y) ? maxVec.y : rawSizeY / 2,
            minZ: Number.isFinite(minVec.z) ? minVec.z : -rawSizeZ / 2,
            maxZ: Number.isFinite(maxVec.z) ? maxVec.z : rawSizeZ / 2,
            sizeX: rawSizeX,
            sizeY: rawSizeY,
            sizeZ: rawSizeZ,
            scaleFactor: unitMultiplier,
        };

        templateRoot.metadata = {
            isScenePropTemplate: true,
            format,
            unitScale: effectiveUnitScale,
            rawBounds,
        };

        if (assetContainer) {
            this._assetContainers.set(templateId, assetContainer);
            this._assetContainers.set(templateId.toLowerCase(), assetContainer);
        }
        this._templateBounds.set(templateId, rawBounds);
        this._templateBounds.set(templateId.toLowerCase(), rawBounds);
        this._templates.set(templateId, templateRoot);
        this._templates.set(templateId.toLowerCase(), templateRoot);

        return {
            templateId,
            name: baseName,
            format,
            width_mm,
            depth_mm,
            height_mm,
        };
    }

    /**
     * Tworzy instancję modelu wyposażenia sceny (.glb / .obj / .stl) przeskalowaną i wycentrowaną
     * wewnątrz kontenera o zadanych wymiarach (width_mm, height_mm, depth_mm).
     */
    public createScenePropInstance(
        id: string,
        scene: any,
        targetDimsMm?: { width_mm: number; height_mm: number; depth_mm: number }
    ): any {
        const stem = id.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/i, '');
        const keys = [id, stem, `${stem}.glb`, `${stem}.obj`, `${stem}.stl`];
        let matchedKey: string | null = null;
        for (const key of keys) {
            if (this._assetContainers.has(key) || this._templates.has(key)) {
                matchedKey = key;
                break;
            }
        }
        if (!matchedKey) {
            for (const [key] of this._assetContainers) {
                if (key.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/i, '') === stem) {
                    matchedKey = key;
                    break;
                }
            }
        }
        if (!matchedKey) {
            for (const [key] of this._templates) {
                if (key.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/i, '') === stem) {
                    matchedKey = key;
                    break;
                }
            }
        }
        if (!matchedKey) return null;

        const rb = this._templateBounds.get(matchedKey) || this._templates.get(matchedKey)?.metadata?.rawBounds;
        let instanceRoot: any = null;

        // 1. Jeśli model załadowano jako AssetContainer — pełne, natywne klonowanie drzewa glTF:
        const assetContainer = this._assetContainers.get(matchedKey);
        if (assetContainer && typeof assetContainer.instantiateModelsToScene === 'function') {
            try {
                const instantiated = assetContainer.instantiateModelsToScene(
                    (sourceName: string) => `prop_${stem}_${sourceName}`
                );
                instanceRoot = new BABYLON.TransformNode(`scene_prop_${stem}_${Date.now()}`, scene);
                if (Array.isArray(instantiated.rootNodes)) {
                    for (const rn of instantiated.rootNodes) {
                        rn.parent = instanceRoot;
                        rn.setEnabled(true);
                    }
                }
            } catch (err) {
                console.warn('[HardwareLoader] Błąd instantiateModelsToScene:', err);
                instanceRoot = null;
            }
        }

        // 2. Fallback: klonowanie z szablonu _templates
        if (!instanceRoot) {
            instanceRoot = this._cloneHardwareInstance(matchedKey, `scene_prop_${stem}`, { pickable: true });
        }

        if (!instanceRoot || typeof BABYLON === 'undefined') return instanceRoot;

        instanceRoot.setEnabled(true);
        const descendants = instanceRoot.getDescendants ? instanceRoot.getDescendants(false) : [];
        for (const node of [instanceRoot, ...descendants]) {
            node.setEnabled(true);
            if ('isVisible' in node) (node as any).isVisible = true;
            if ('visibility' in node) (node as any).visibility = 1.0;
            if ('isPickable' in node) (node as any).isPickable = true;
            if ((node as any).material) {
                const mat = (node as any).material;
                mat.backFaceCulling = false;
                if ('twoSidedLighting' in mat) mat.twoSidedLighting = true;
            }
        }

        if (rb && targetDimsMm) {
            const sx = targetDimsMm.width_mm / Math.max(1e-4, rb.sizeX);
            const sy = targetDimsMm.height_mm / Math.max(1e-4, rb.sizeY);
            const sz = targetDimsMm.depth_mm / Math.max(1e-4, rb.sizeZ);
            instanceRoot.scaling.set(sx, sy, sz);

            const cx = (rb.minX + rb.maxX) / 2;
            const cz = (rb.minZ + rb.maxZ) / 2;
            // Lokalne Y=0 w containerRoot to podstawa bryły:
            // Ustawiamy dolną krawędź modelu (minY) na Y=0, a środek X i Z na 0.
            const posY = -rb.minY * sy;
            instanceRoot.position.set(-cx * sx, posY, -cz * sz);
        } else if (rb && rb.scaleFactor) {
            instanceRoot.scaling.set(rb.scaleFactor, rb.scaleFactor, rb.scaleFactor);
        }

        return instanceRoot;
    }

    /**
     * Sprawdza czy szablon jest już załadowany w pamięci podręcznej.
     */
    public hasTemplate(id: string): boolean {
        if (!id) return false;
        const stem = id.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/i, '');
        if (
            this._templates.has(id) ||
            this._templates.has(stem) ||
            this._assetContainers.has(id) ||
            this._assetContainers.has(stem)
        ) {
            return true;
        }
        if (isHingeHardwareId(stem) || isHingeHardwareId(id)) {
            return (
                this._templates.has('blum zawiasy') ||
                this._templates.has('blum zawiasy.glb') ||
                this._templates.has('blum_zawiasy') ||
                this._templates.has('blum_zawiasy.glb')
            );
        }
        return false;
    }

    /**
     * Tworzy instancję modułowego zawiasu Blum ze wspólnego szablonu blum_zawiasy.glb
     * łącząc właściwe ramię oraz właściwy prowadnik (H=0, H=3, prosty).
     */
    public createBlumModularHingeInstance(
        id: string,
        plateHeight: number = 0,
        scene: any,
        side: 'left' | 'right' | 'top' | 'bottom' = 'left',
        plateId?: string
    ): any {
        const templateRoot =
            this._templates.get('blum_zawiasy') ||
            this._templates.get('blum_zawiasy.glb') ||
            this._templates.get('blum zawiasy3glb') ||
            this._templates.get('blum zawiasy3glb.glb') ||
            this._templates.get('blum zawiasy') ||
            this._templates.get('blum zawiasy.glb');

        if (!templateRoot || typeof BABYLON === 'undefined' || !scene) return null;

        const descendants = templateRoot.getDescendants ? templateRoot.getDescendants(false) : [];
        const nodeByKey = new Map<string, any>();
        for (const node of descendants) {
            const k = String(node.name || node.id || '').toLowerCase();
            if (k && !nodeByKey.has(k)) {
                nodeByKey.set(k, node);
            }
        }

        // Dobór ramienia zawiasu na bazie nazw obiektów (node.name) w blum_zawiasy.glb
        const idLower = (id || '').toLowerCase();
        let armSource: any = null;
        const armRules: Array<[RegExp, RegExp]> = [
            [/70t3550|71t3550/i, /70t3550/i],
            [/71b3550/i, /71b3550/i],
            [/71b7550d|125/i, /71b7550d|125st/i],
            [/71b7550|155|70t7550/i, /155st_71b7550/i],
            [/71t6550|170|71t6557/i, /71t6550|170st/i],
            [/79t8500|rogowy/i, /79t8500|rogowy/i],
            [/47561700|79b9550|79b9955|rownoleg.*naklad/i, /47561700|rownolegly_nakladany/i],
            [/79t9550|79t9555|rownoleg.*wpuszcz|71b3750|71t3750/i, /79t9550|rownolegly_wpuszczany/i],
            [/78z5500|srodkow/i, /78z5500/i],
        ];
        for (const [idRe, nodeRe] of armRules) {
            if (idRe.test(idLower)) {
                for (const [k, node] of nodeByKey) {
                    if (nodeRe.test(k)) {
                        armSource = node;
                        break;
                    }
                }
                if (armSource) break;
            }
        }
        // Ścisła weryfikacja: jeśli brak ramienia dla zadanego zawiasu Blum -> BŁĄD (zakaz cichego podstawiania 110°)
        if (!armSource) {
            console.error(`[HardwareLoader] BŁĄD KRYTYCZNY: W szablonie blum_zawiasy.glb brak węzła ramienia dla zawiasu "${id}". Zakaz cichych zamienników!`);
            return null;
        }

        // Dobór prowadnika (jawny plateId: 175H3100/173L6130/173L6100 lub wg H=0/H=3)
        let plateSource: any = null;
        if (plateId) {
            const pLower = plateId.toLowerCase();
            const plateRe = /175h3100|prosty/.test(pLower)
                ? /175h3100|prowadnik.*prosty/i
                : /173l6130|3mm|h3/.test(pLower)
                    ? /173l6130|prowadnik.*3mm|prowadnik.*h3/i
                    : /173l6100|prowadnik.*0mm|prowadnik.*h0/i;
            for (const [k, node] of nodeByKey) {
                if (plateRe.test(k)) {
                    plateSource = node;
                    break;
                }
            }
        }
        if (!plateSource) {
            for (const [k, node] of nodeByKey) {
                if (plateHeight >= 2.5 && /173l6130|prowadnik.*3mm|prowadnik.*h3/i.test(k)) {
                    plateSource = node;
                    break;
                } else if (plateHeight < 2.5 && /173l6100|prowadnik.*0mm|prowadnik.*h0/i.test(k)) {
                    plateSource = node;
                    break;
                } else if (/175h3100|prowadnik.*prosty/i.test(k)) {
                    plateSource = node;
                }
            }
        }
        if (!plateSource) {
            console.error(`[HardwareLoader] BŁĄD KRYTYCZNY: W szablonie blum_zawiasy.glb brak węzła prowadnika dla wysokości H=${plateHeight} (zawias: "${id}").`);
            return null;
        }

        const cloneName = `blum_hinge_${id}_h${plateHeight}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const instanceRoot = new BABYLON.TransformNode(cloneName, scene);
        const baseScale = Math.abs(templateRoot.scaling?.y || 1000);
        instanceRoot.scaling.set(baseScale, baseScale, baseScale);

        const gltfRoot = templateRoot.getChildren?.()?.[0] || templateRoot;
        const rootHolder = new BABYLON.TransformNode(`${cloneName}_root`, scene);
        rootHolder.parent = instanceRoot;
        if (gltfRoot && gltfRoot !== templateRoot) {
            if (gltfRoot.position) rootHolder.position.copyFrom(gltfRoot.position);
            if (gltfRoot.rotation) rootHolder.rotation.copyFrom(gltfRoot.rotation);
            if (gltfRoot.rotationQuaternion) {
                rootHolder.rotationQuaternion = gltfRoot.rotationQuaternion.clone();
            }
            if (gltfRoot.scaling) rootHolder.scaling.copyFrom(gltfRoot.scaling);
        }
        // W blum zawiasy.glb origin (0,0,0) leży na środku prowadnika; lico puszki jest w +38mm wzdłuż Z,
        // a oś puszki w +7mm wzdłuż X_local. Przesuwamy szablon tak, by środek lica puszki wypadał w (0,0,0).
        const unitToLocal = baseScale >= 100 ? 0.001 : 1;
        rootHolder.position.x -= 7 * unitToLocal;
        rootHolder.position.z -= 38 * unitToLocal;

        const clonePart = (src: any, suffix: string): any => {
            if (!src || typeof src.clone !== 'function') return null;
            const cloned = src.clone(`${cloneName}_${suffix}`, rootHolder, false);
            if (!cloned) return null;
            if (cloned.parent !== rootHolder) {
                cloned.parent = rootHolder;
            }
            const srcMeshes = src.getChildMeshes ? src.getChildMeshes(false) : [];
            const clonedMeshes = cloned.getChildMeshes ? cloned.getChildMeshes(false) : [];
            if (srcMeshes.length > 0 && clonedMeshes.length === 0) {
                for (const cm of srcMeshes) {
                    if (typeof cm.clone === 'function') {
                        cm.clone(`${cloneName}_${suffix}_${cm.name}`, cloned, false);
                    }
                }
            }
            return cloned;
        };

        if (armSource) clonePart(armSource, 'arm');
        if (plateSource) clonePart(plateSource, 'plate');

        instanceRoot.setEnabled(true);
        const instDescendants = instanceRoot.getDescendants ? instanceRoot.getDescendants(false) : [];
        for (const node of instDescendants) {
            node.setEnabled(true);
            if ('isVisible' in node) {
                (node as any).isVisible = true;
            }
            if ('visibility' in node) {
                (node as any).visibility = 1.0;
            }
            if ('isPickable' in node) {
                (node as any).isPickable = false;
            }
            if ((node as any).material) {
                (node as any).material.backFaceCulling = false;
            } else if (typeof BABYLON !== 'undefined' && scene) {
                const fallbackMat = new BABYLON.StandardMaterial(`hinge_fallback_${cloneName}`, scene);
                fallbackMat.diffuseColor = new BABYLON.Color3(0.78, 0.8, 0.83);
                fallbackMat.specularColor = new BABYLON.Color3(0.95, 0.95, 0.98);
                fallbackMat.specularPower = 48;
                fallbackMat.backFaceCulling = false;
                (node as any).material = fallbackMat;
            }
        }

        instanceRoot.metadata = {
            isBlumModularHinge: true,
            hingeId: id,
            plateHeight,
            side
        };

        return instanceRoot;
    }

    /**
     * Tworzy instancję / klon zawiasu gotowy do umieszczenia na scenie.
     */
    public createHingeInstance(id: string, scene: any, options?: { plateHeight?: number; plateId?: string; side?: 'left' | 'right' | 'top' | 'bottom' }): any {
        if (isDrawerRailHardwareId(id)) {
            console.error(`[HardwareLoader] BŁĄD KRYTYCZNY: Próba utworzenia zawiasu z identyfikatora szuflady/prowadnicy: "${id}".`);
            return null;
        }
        const plateHeight = options?.plateHeight ?? 0;
        const side = options?.side ?? 'left';
        const modular = this.createBlumModularHingeInstance(id, plateHeight, scene, side, options?.plateId);
        if (modular) return modular;

        // Dla zawiasów Blum: jeśli modularny zawias się nie złożył, nie podstawiaj nic innego!
        if (isHingeHardwareId(id)) {
            console.error(`[HardwareLoader] BŁĄD KRYTYCZNY: Nie można utworzyć instancji zawiasu Blum dla "${id}". Brak cichego zamiennika.`);
            return null;
        }

        // Dla innego producenta (np. GTV, Hettich): musi istnieć dedykowany szablon {id}
        if (this._templates.has(id)) {
            return this._cloneHardwareInstance(id, `hw_${id}`, { pickable: false });
        }
        console.error(`[HardwareLoader] BŁĄD KRYTYCZNY: Brak dedykowanego modelu 3D dla zawiasu "${id}". Zakaz cichych zamienników.`);
        return null;
    }

    /**
     * Klon uchwytu (SmartPart) — pickowalny, origin = środek C-C.
     */
    public createHandleInstance(id: string, _scene?: any): any {
        const stem = id.toLowerCase().replace(/\.glb$/i, '');
        const keys = [id, stem, `${stem}.glb`, id.replace(/\.glb$/i, '')];
        for (const key of keys) {
            if (this._templates.has(key)) {
                return this._cloneHardwareInstance(key, `handle_${stem}`, { pickable: true });
            }
        }
        // Szablon mógł być zapisany pod oryginalnym id z loadTemplate
        for (const [key] of this._templates) {
            if (key.toLowerCase().replace(/\.glb$/i, '') === stem) {
                return this._cloneHardwareInstance(key, `handle_${stem}`, { pickable: true });
            }
        }
        return null;
    }

    public createShelfPinInstance(id: string, _scene?: any, side: 'left' | 'right' = 'left'): any {
        const stem = id.toLowerCase().replace(/\.glb$/i, '');
        const keys = [id, stem, `${stem}.glb`, id.replace(/\.glb$/i, ''), 'PODPORKA_FI5', 'podporka_fi5'];
        for (const key of keys) {
            if (this._templates.has(key)) {
                const inst = this._cloneHardwareInstance(key, `shelf_pin_${stem}`, { pickable: false });
                if (inst && side === 'right' && inst.scaling) {
                    inst.scaling.x *= -1;
                }
                return inst;
            }
        }
        for (const [key] of this._templates) {
            if (key.toLowerCase().replace(/\.glb$/i, '') === stem) {
                const inst = this._cloneHardwareInstance(key, `shelf_pin_${stem}`, { pickable: false });
                if (inst && side === 'right' && inst.scaling) {
                    inst.scaling.x *= -1;
                }
                return inst;
            }
        }
        return null;
    }

    /**
     * Tworzy parametryczną rurę drążka ubraniowego jako cylinder o zadanej długości i średnicy.
     */
    public createTubeRodMesh(lengthMm: number, diameterMm: number, scene: any): any {
        if (typeof BABYLON === 'undefined' || !scene) return null;
        const mesh = BABYLON.MeshBuilder.CreateCylinder(`tube_rod_${Date.now()}_${Math.floor(Math.random() * 1000)}`, {
            height: Math.max(1, lengthMm),
            diameter: Math.max(1, diameterMm),
            tessellation: 36
        }, scene);
        mesh.rotation.set(0, 0, Math.PI / 2);

        let mat = scene.getMaterialByName('b1_tube_chrome_mat');
        if (!mat) {
            mat = new BABYLON.StandardMaterial('b1_tube_chrome_mat', scene);
            mat.diffuseColor = new BABYLON.Color3(0.78, 0.8, 0.83);
            mat.specularColor = new BABYLON.Color3(0.95, 0.95, 0.98);
            mat.specularPower = 48;
        }
        mesh.material = mat;
        mesh.metadata = { lengthMm, diameterMm };
        return mesh;
    }

    /**
     * Tworzy parametryczną rozetę drążka ubraniowego (kołnierz + tuleja montażowa).
     */
    public createTubeSocketMesh(diameterMm: number, thicknessMm: number, side: 'left' | 'right', scene: any): any {
        if (typeof BABYLON === 'undefined' || !scene) return null;

        const discH = Math.min(3, thicknessMm);
        const collarH = 10;
        const collarDia = 29;

        const disc = BABYLON.MeshBuilder.CreateCylinder('disc', {
            height: discH,
            diameter: Math.max(1, diameterMm),
            tessellation: 36
        }, scene);

        const collar = BABYLON.MeshBuilder.CreateCylinder('collar', {
            height: collarH,
            diameter: collarDia,
            tessellation: 36
        }, scene);

        // disc leży przy boku (X=0)
        // collar wchodzi w stronę środka drążka (+X dla left, -X dla right po rotacji o 90st w Z)
        const inward = side === 'left' ? -1 : 1;
        collar.position.y = (discH / 2 + collarH / 2) * inward;

        let merged = BABYLON.Mesh.MergeMeshes([disc, collar], true, true, undefined, false, true);
        if (!merged) merged = disc;
        merged.name = `tube_socket_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        merged.rotation.set(0, 0, Math.PI / 2);

        let mat = scene.getMaterialByName('b1_tube_chrome_mat');
        if (!mat) {
            mat = new BABYLON.StandardMaterial('b1_tube_chrome_mat', scene);
            mat.diffuseColor = new BABYLON.Color3(0.78, 0.8, 0.83);
            mat.specularColor = new BABYLON.Color3(0.95, 0.95, 0.98);
            mat.specularPower = 48;
        }
        merged.material = mat;
        merged.metadata = { diameterMm, thicknessMm, side };
        return merged;
    }

    private _cloneHardwareInstance(
        templateId: string,
        namePrefix: string,
        opts: { pickable: boolean },
    ): any {
        const template = this._templates.get(templateId);
        if (!template) return null;

        const cloneName = `${namePrefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const instance = template.clone(cloneName, null, false);
        if (!instance) return null;

        instance.position.set(0, 0, 0);
        instance.rotation?.set?.(0, 0, 0);
        instance.setEnabled(true);

        // Zabezpieczenie przed specyfiką Babylon.js, w której Mesh.clone() domyślnie nie klonuje potomków glTF
        const childMeshes = template.getChildMeshes ? template.getChildMeshes(false) : [];
        const instanceMeshes = instance.getChildMeshes ? instance.getChildMeshes(false) : [];
        if (childMeshes.length > 0 && instanceMeshes.length === 0) {
            for (const cm of childMeshes) {
                if (typeof cm.clone === 'function') {
                    const clonedCm = cm.clone(`${cloneName}_${cm.name}`, instance, false);
                    if (clonedCm) {
                        clonedCm.setEnabled(true);
                        clonedCm.isVisible = true;
                        clonedCm.visibility = 1.0;
                    }
                }
            }
        }

        const descendants = instance.getDescendants(false);
        for (const node of descendants) {
            node.setEnabled(true);
            if ('isVisible' in node) {
                (node as any).isVisible = true;
            }
            if ('visibility' in node) {
                (node as any).visibility = 1.0;
            }
            if ('isPickable' in node) {
                (node as any).isPickable = opts.pickable;
            }
            if ((node as any).material) {
                (node as any).material.backFaceCulling = false;
                if ((node as any).material.specularColor) {
                    (node as any).material.specularColor = new BABYLON.Color3(0.6, 0.6, 0.65);
                }
            }
        }
        if ('isPickable' in instance) {
            (instance as any).isPickable = opts.pickable;
        }
        return instance;
    }

    /**
     * Składa kompletny bok szuflady Blum Merivobox (Prowadnica + Boczek + Mocowanie tyłu)
     * z pojedynczego szablonu `merivobox.glb`.
     */
    public createMerivoDrawerSideInstance(
        id: string,
        scene: any,
        side: 'left' | 'right' = 'left',
        lengthMm: number = 500,
        corpusHeightMm: number = 100,
        railId?: string,
        isInternal: boolean = false
    ): any {
        const templateRoot =
            this._templates.get('merivobox') ||
            this._templates.get('merivobox.glb');
        if (!templateRoot || typeof BABYLON === 'undefined' || !scene) return null;

        const availLengths = [270, 300, 350, 400, 450, 500, 550, 600];
        let nominalLen = 500;
        let minDiff = Infinity;
        for (const candidate of availLengths) {
            const diff = Math.abs(candidate - lengthMm);
            if (diff < minDiff) {
                minDiff = diff;
                nominalLen = candidate;
            }
        }

        const keyStr = `${railId || ''} ${id || ''}`.toUpperCase();
        let heightCode: 'N' | 'M' | 'K' | 'E' = 'M';
        if (/200|KOSZ|_E\b/.test(keyStr) || corpusHeightMm >= 180) {
            heightCode = 'E';
        } else if (/150|_K\b/.test(keyStr) || corpusHeightMm >= 130) {
            heightCode = 'K';
        } else if (/_N\b/.test(keyStr) || corpusHeightMm <= 85) {
            heightCode = 'N';
        }

        const descendants = templateRoot.getDescendants ? templateRoot.getDescendants(false) : [];
        const nodeByKey = new Map<string, any>();
        for (const node of descendants) {
            const kId = String(node.id || '').toLowerCase();
            const kName = String(node.name || '').toLowerCase();
            if (kId && !nodeByKey.has(kId)) {
                nodeByKey.set(kId, node);
            }
            if (kName && !nodeByKey.has(kName)) {
                nodeByKey.set(kName, node);
            }
        }

        const hc = heightCode.toLowerCase();
        const railSource = nodeByKey.get(`prowadnica_450.${nominalLen}1b`);
        const sideSource =
            nodeByKey.get(`boczek_470${hc}${nominalLen}2s`) ||
            nodeByKey.get(`boczek_470m${nominalLen}2s`);
        const backSource =
            nodeByKey.get(`mocowanie_tyl_zb4${hc}000s`) ||
            nodeByKey.get('mocowanie_tyl_zb4m000s');
        const boxcapSource = heightCode === 'E'
            ? (
                nodeByKey.get(`boxcup_zl4.${nominalLen}s.e`) ||
                nodeByKey.get(`boxcap_${nominalLen}`) ||
                nodeByKey.get(`boxcap_470${hc}${nominalLen}`)
            )
            : undefined;

        if (!railSource && !sideSource) return null;

        const cloneName = `merivo_${side}_${heightCode}_${nominalLen}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const instanceRoot = new BABYLON.TransformNode(cloneName, scene);
        const baseScale = Math.abs(templateRoot.scaling?.y || 1000);
        // Wspólny układ z Antaro: instanceRoot w mm, rotation=(0,0,0), scaling=(1,1,1),
        // +X do wnętrza (lustro dla 'right'), +Y w górę, +Z w głąb korpusu.
        instanceRoot.scaling.set(1, 1, 1);

        const rootHolder = new BABYLON.TransformNode(`${cloneName}_root`, scene);
        rootHolder.parent = instanceRoot;
        rootHolder.rotationQuaternion = BABYLON.Quaternion.Identity();
        rootHolder.scaling.set(
            (side === 'right' ? -1 : 1) * baseScale,
            baseScale,
            -baseScale
        );

        const clonePart = (src: any, suffix: string): any => {
            if (!src || typeof src.clone !== 'function') return null;
            const cloned = src.clone(`${cloneName}_${suffix}`, null, false);
            if (cloned) {
                cloned.parent = rootHolder;
            }
            return cloned;
        };

        clonePart(railSource, 'rail');
        clonePart(sideSource, 'side');
        const backClone = clonePart(backSource, 'back');
        if (boxcapSource) {
            clonePart(boxcapSource, 'boxcap');
        } else if (heightCode === 'E') {
            console.warn(`[MerivoGLB] Brak węzła boxcup dla E (nominalLen=${nominalLen}, railId=${railId}, id=${id}). Dostępne:`, Array.from(nodeByKey.keys()));
        }
        if (isInternal) {
            const frontBracketSource = heightCode === 'E'
                ? (nodeByKey.get('mocowanie_wew_zi4.2es1') || nodeByKey.get('mocowanie_wew_zi4.0ms1'))
                : nodeByKey.get('mocowanie_wew_zi4.0ms1');
            if (frontBracketSource) {
                clonePart(frontBracketSource, 'front_bracket');
            }
        }

        if (backClone) {
            const unitPerMm = baseScale > 0 ? 1 / baseScale : 0.001;
            const backDepthMm = Math.max(0, nominalLen - 26);
            backClone.position.set(0, 0, -backDepthMm * unitPerMm);
        }

        return this.finalizeGlbDrawerSideInstance(instanceRoot, scene, {
            isGlbDrawerSide: true,
            glbTemplateId: 'merivobox',
            isMerivoGlb: true,
            baseScale,
            lengthMm,
            corpusHeightMm,
            side,
            railId: railId || id,
            isInternal
        });
    }

    /**
     * Składa kompletny bok szuflady Blum Antaro (Prowadnica + Boczek + Mocowanie tyłu + opcjonalnie Reling / Mocowanie frontu)
     * z pojedynczego szablonu `Antaro.glb`.
     */
    public createAntaroDrawerSideInstance(
        id: string,
        scene: any,
        side: 'left' | 'right' = 'left',
        lengthMm: number = 500,
        corpusHeightMm: number = 84,
        railId?: string,
        isInternal: boolean = false
    ): any {
        const templateRoot =
            this._templates.get('antaro') ||
            this._templates.get('Antaro.glb') ||
            this._templates.get('antaro.glb');
        if (!templateRoot || typeof BABYLON === 'undefined' || !scene) return null;

        const keyStr = `${railId || ''} ${id || ''}`.toUpperCase();
        let heightCode: 'N' | 'M' | 'D' = 'M';
        if (/KOSZ|_D\b/.test(keyStr) || corpusHeightMm >= 150) {
            heightCode = 'D';
        } else if (/_N\b/.test(keyStr) || corpusHeightMm <= 75) {
            heightCode = 'N';
        }

        const descendants = templateRoot.getDescendants ? templateRoot.getDescendants(false) : [];
        const nodeByKey = new Map<string, any>();
        for (const node of descendants) {
            const kId = String(node.id || '').toLowerCase();
            const kName = String(node.name || '').toLowerCase();
            if (kId && !nodeByKey.has(kId)) nodeByKey.set(kId, node);
            if (kName && !nodeByKey.has(kName)) nodeByKey.set(kName, node);
        }

        const findClosestByRegex = (re: RegExp, targetLen: number): { node: any; len: number } | null => {
            let best: { node: any; len: number; diff: number } | null = null;
            for (const [key, node] of nodeByKey.entries()) {
                const m = key.match(re);
                if (!m) continue;
                const candLen = Number(m[1]);
                if (!Number.isFinite(candLen)) continue;
                const diff = Math.abs(candLen - targetLen);
                if (!best || diff < best.diff) {
                    best = { node, len: candLen, diff };
                }
            }
            return best ? { node: best.node, len: best.len } : null;
        };

        const railMatch = findClosestByRegex(/^prowadnica_578\.(\d{3})/, lengthMm);
        const sideMatch = heightCode === 'N'
            ? (findClosestByRegex(/^boczek_378n(\d{3})/, lengthMm) || findClosestByRegex(/^boczek_378m(\d{3})/, lengthMm))
            : findClosestByRegex(/^boczek_378m(\d{3})/, lengthMm);
        const backSource = heightCode === 'D'
            ? (nodeByKey.get('mocowanie_d_tyl_z30d000sl') || nodeByKey.get('mocowanie_tyl_z30d000sl_d') || nodeByKey.get('mocowanie_m_tyl_z30m000s.04'))
            : heightCode === 'N'
                ? (nodeByKey.get('mocowanie_n_tyl_z30n000s.04') || nodeByKey.get('mocowanie_tyl_z30n000s.04_n') || nodeByKey.get('mocowanie_m_tyl_z30m000s.04'))
                : (nodeByKey.get('mocowanie_m_tyl_z30m000s.04') || nodeByKey.get('mocowanie_tyl_z30m000s.04_m'));
        const relingMatch = heightCode === 'D'
            ? findClosestByRegex(/^reling_podluzny_(\d{3})_/, lengthMm)
            : null;

        if (!railMatch && !sideMatch) return null;

        const nominalLen = railMatch?.len ?? sideMatch?.len ?? lengthMm;
        const cloneName = `antaro_${side}_${heightCode}_${nominalLen}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const instanceRoot = new BABYLON.TransformNode(cloneName, scene);
        const baseScale = Math.abs(templateRoot.scaling?.y || 1000);
        instanceRoot.scaling.set(1, 1, 1);

        const rootHolder = new BABYLON.TransformNode(`${cloneName}_root`, scene);
        rootHolder.parent = instanceRoot;
        rootHolder.rotationQuaternion = BABYLON.Quaternion.Identity();
        rootHolder.scaling.set(
            (side === 'right' ? -1 : 1) * baseScale,
            baseScale,
            -baseScale
        );

        const clonePart = (src: any, suffix: string): any => {
            if (!src || typeof src.clone !== 'function') return null;
            const cloned = src.clone(`${cloneName}_${suffix}`, null, false);
            if (cloned) cloned.parent = rootHolder;
            return cloned;
        };

        if (railMatch) clonePart(railMatch.node, 'rail');
        const sideClone = sideMatch ? clonePart(sideMatch.node, 'side') : null;
        if (sideClone && sideMatch && sideMatch.len > 0 && sideMatch.len !== nominalLen) {
            sideClone.scaling.z = (sideClone.scaling?.z ?? 1) * (nominalLen / sideMatch.len);
        }
        const relingClone = relingMatch ? clonePart(relingMatch.node, 'reling') : null;
        if (relingClone && relingMatch && relingMatch.len > 0 && relingMatch.len !== nominalLen) {
            relingClone.scaling.z = (relingClone.scaling?.z ?? 1) * (nominalLen / relingMatch.len);
        }
        const backClone = clonePart(backSource, 'back');
        if (isInternal) {
            if (heightCode === 'D') {
                clonePart(nodeByKey.get('mocowanie_d_wew_zif.76d0') || nodeByKey.get('mocowanie_wew_zif.76d0'), 'front_bracket_d');
                clonePart(nodeByKey.get('mocowanie _wew_trzpien_zrg.207rsic'), 'front_pin_d');
            } else {
                clonePart(nodeByKey.get('mocowanie_wew_zif.80m0.01'), 'front_bracket_m');
            }
        } else {
            clonePart(nodeByKey.get('jezyk_zsf.35a2'), 'front_jezyk');
        }

        if (backClone) {
            const unitPerMm = baseScale > 0 ? 1 / baseScale : 0.001;
            const backDepthMm = Math.max(0, nominalLen - 26);
            backClone.position.set(0, 0, -backDepthMm * unitPerMm);
        }

        return this.finalizeGlbDrawerSideInstance(instanceRoot, scene, {
            isGlbDrawerSide: true,
            glbTemplateId: 'antaro',
            isAntaroGlb: true,
            baseScale,
            lengthMm,
            corpusHeightMm,
            side,
            railId: railId || id,
            isInternal
        });
    }

    private finalizeGlbDrawerSideInstance(
        instanceRoot: any,
        scene: any,
        metadata: Record<string, any>
    ): any {
        let defaultMat = scene.getMaterialByName?.('b1_merivo_default_mat');
        if (!defaultMat) {
            defaultMat = new BABYLON.StandardMaterial('b1_merivo_default_mat', scene);
            defaultMat.diffuseColor = new BABYLON.Color3(0.76, 0.78, 0.81);
            defaultMat.specularColor = new BABYLON.Color3(0.5, 0.52, 0.55);
            defaultMat.specularPower = 32;
            defaultMat.backFaceCulling = false;
            if ('twoSidedLighting' in defaultMat) {
                defaultMat.twoSidedLighting = true;
            }
        }

        instanceRoot.setEnabled(true);
        const instDescendants = instanceRoot.getDescendants(false);
        for (const node of instDescendants) {
            node.setEnabled(true);
            if ('isVisible' in node) {
                (node as any).isVisible = true;
            }
            if ('isPickable' in node) {
                (node as any).isPickable = false;
            }
            if ((node as any).material) {
                (node as any).material.backFaceCulling = false;
                if ('twoSidedLighting' in (node as any).material) {
                    (node as any).material.twoSidedLighting = true;
                }
            } else if (typeof (node as any).getTotalVertices === 'function' || 'material' in node) {
                (node as any).material = defaultMat;
            }
            if (typeof (node as any).enableEdgesRendering === 'function' && typeof (node as any).getTotalVertices === 'function' && (node as any).getTotalVertices() > 0) {
                (node as any).enableEdgesRendering(0.92, true);
                (node as any).edgesWidth = 1.5;
                (node as any).edgesColor = new BABYLON.Color4(0.14, 0.16, 0.2, 0.85);
            }
        }

        instanceRoot.metadata = metadata;
        return instanceRoot;
    }

    /**
     * Tworzy parametryczną siatkę 3D boczku szuflady (3 pętle 2D: Boczek, Mocowanie, Prowadnica N)
     * wyciągniętą na dokładną długość prowadnicy lengthMm i wysokość corpusHeightMm.
     */
    public createDrawerSideInstance(
        id: string,
        scene: any,
        side: 'left' | 'right' = 'left',
        lengthMm?: number,
        corpusHeightMm?: number,
        profile?: DrawerSideProfileInput,
        boczekLenMm?: number,
        mocowanieLenMm?: number,
        prowadnicaLenMm?: number,
        railId?: string,
        isInternal: boolean = false
    ): any {
        const checkKey = `${railId || ''} ${id || ''}`;
        if (isHingeHardwareId(id) || isHingeHardwareId(railId)) return null;
        const glbTpl = resolveDrawerGlbTemplateId(checkKey);
        if (glbTpl === 'merivobox') {
            const merivoInst = this.createMerivoDrawerSideInstance(
                id,
                scene,
                side,
                lengthMm ?? 500,
                corpusHeightMm ?? 100,
                railId || id,
                isInternal
            );
            if (merivoInst) return merivoInst;
        } else if (glbTpl === 'antaro') {
            const antaroInst = this.createAntaroDrawerSideInstance(
                id,
                scene,
                side,
                lengthMm ?? 500,
                corpusHeightMm ?? 84,
                railId || id,
                isInternal
            );
            if (antaroInst) return antaroInst;
        }
        return createParametricDrawerSideMesh(
            {
                id,
                side,
                lengthMm: lengthMm ?? 500,
                corpusHeightMm: corpusHeightMm ?? 178,
                profile,
                boczekLenMm: boczekLenMm ?? profile?.boczek_len ?? profile?.boczekLen,
                mocowanieLenMm: mocowanieLenMm ?? profile?.mocowanie_len ?? profile?.mocowanieLen,
                prowadnicaLenMm: prowadnicaLenMm ?? profile?.prowadnica_len ?? profile?.prowadnicaLen,
            },
            scene
        );
    }

    /**
     * Aliasy uniwersalne dla wszystkich typów okuć:
     */
    public setHardwareFrozen(instance: any, frozen: boolean): void {
        this.setHingeFrozen(instance, frozen);
    }

    public setHardwareVisible(instance: any, visible: boolean): void {
        this.setHingeVisible(instance, visible);
    }


    /**
     * Orientuje instancję zawiasu względem ściany frontu i kierunku krawędzi (drzwi lewe/prawe, klapa góra/dół).
     */
    public alignHinge(instance: any, faceData: any, orientation: 'left' | 'right' | 'top' | 'bottom' | boolean): void {
        const uAxis = new BABYLON.Vector3(...faceData.uAxis).normalize();
        const vAxis = new BABYLON.Vector3(...faceData.vAxis).normalize();
        const normal = new BABYLON.Vector3(...faceData.normal).normalize();

        const ori =
            orientation === true ? 'left' as const
            : orientation === false ? 'right' as const
            : orientation;
        const axes = resolveHingeAlignAxes(
            [uAxis.x, uAxis.y, uAxis.z],
            [vAxis.x, vAxis.y, vAxis.z],
            [normal.x, normal.y, normal.z],
            ori
        );

        const m = new BABYLON.Matrix();
        m.setRowFromFloats(0, axes.xDir[0], axes.xDir[1], axes.xDir[2], 0);
        m.setRowFromFloats(1, axes.yDir[0], axes.yDir[1], axes.yDir[2], 0);
        m.setRowFromFloats(2, axes.zDir[0], axes.zDir[1], axes.zDir[2], 0);
        m.setRowFromFloats(3, 0, 0, 0, 1);

        instance.rotationQuaternion = BABYLON.Quaternion.FromRotationMatrix(m);
    }

    /**
     * Ustawia wizualny stan zamrożenia okucia (efekt lodowego błękitu / frost).
     */
    public setHingeFrozen(instance: any, frozen: boolean): void {
        if (!instance) return;
        const descendants = instance.getDescendants ? instance.getDescendants(false) : [];
        const nodes = [instance, ...descendants];
        for (const node of nodes) {
            if ((node as any).material) {
                const mat = (node as any).material;
                if (frozen) {
                    if (mat._origDiffuseColor === undefined && mat.diffuseColor) {
                        mat._origDiffuseColor = mat.diffuseColor.clone();
                    }
                    if (mat._origAlpha === undefined) {
                        mat._origAlpha = mat.alpha ?? 1.0;
                    }
                    if (mat.diffuseColor) {
                        mat.diffuseColor = new BABYLON.Color3(0.35, 0.75, 1.0);
                    }
                    if (mat.emissiveColor) {
                        mat.emissiveColor = new BABYLON.Color3(0.12, 0.28, 0.55);
                    }
                    if (mat.specularColor) {
                        mat.specularColor = new BABYLON.Color3(0.8, 0.95, 1.0);
                    }
                    mat.alpha = 0.75;
                } else {
                    if (mat._origDiffuseColor) {
                        mat.diffuseColor = mat._origDiffuseColor.clone();
                    } else if (mat.diffuseColor) {
                        mat.diffuseColor = new BABYLON.Color3(0.85, 0.85, 0.88);
                    }
                    if (mat.emissiveColor) {
                        mat.emissiveColor = new BABYLON.Color3(0, 0, 0);
                    }
                    if (mat.specularColor) {
                        mat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.65);
                    }
                    mat.alpha = mat._origAlpha ?? 1.0;
                }
            }
        }
    }

    /**
     * Włącza lub wyłącza widoczność instancji okucia.
     */
    public setHingeVisible(instance: any, visible: boolean): void {
        if (!instance) return;
        instance.setEnabled(visible);
        const descendants = instance.getDescendants ? instance.getDescendants(false) : [];
        for (const node of descendants) {
            node.setEnabled(visible);
            if ('isVisible' in node) {
                (node as any).isVisible = visible;
            }
        }
    }
}
