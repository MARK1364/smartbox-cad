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

// Indeks wszystkich modeli GLB z B1_biblioteka (zawiasy, szuflady, uchwyty)
const HINGE_GLB_MAP = (import.meta as any).glob('./zawiasy/**/*.glb', { query: '?url', eager: true });
const DRAWER_GLB_MAP = (import.meta as any).glob('./szuflady/**/*.glb', { query: '?url', eager: true });
const HANDLE_GLB_MAP = (import.meta as any).glob('./uchwyty/**/*.glb', { query: '?url', eager: true });
const HANGER_GLB_MAP = (import.meta as any).glob('./zawieszki/**/*.glb', { query: '?url', eager: true });
const SHELF_PIN_GLB_MAP = (import.meta as any).glob('./polki_akcesoria/**/*.glb', { query: '?url', eager: true });
const ALL_GLB_MAP: Record<string, string> = {};

for (const [p, mod] of Object.entries({ ...HINGE_GLB_MAP, ...DRAWER_GLB_MAP, ...HANDLE_GLB_MAP, ...HANGER_GLB_MAP, ...SHELF_PIN_GLB_MAP })) {
    const filename = p.replace(/^.*[\\/]/, '').toLowerCase();
    const url = (mod as any)?.default || p;
    ALL_GLB_MAP[filename] = url;
    // Alias bez rozszerzenia → ten sam URL (loadTemplate('Easy-160'))
    const stem = filename.replace(/\.glb$/i, '');
    if (stem && !ALL_GLB_MAP[stem]) ALL_GLB_MAP[stem] = url;
}

export class HardwareLoader {
    private static _instance: HardwareLoader | null = null;
    private _templates: Map<string, any> = new Map();
    private _loadPromises: Map<string, Promise<any>> = new Map();

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

        if (this._loadPromises.has(id)) {
            return this._loadPromises.get(id);
        }

        const promise = (async () => {
            const hasLoader = await this.ensureLoader();
            if (!hasLoader) {
                console.error('[HardwareLoader] Loader GLB niedostępny');
                return null;
            }

            const baseId = id.replace(/_[LR]$/, '');
            const cleanId = id.toLowerCase().trim().replace(/\.glb$/i, '');
            const cleanBaseId = baseId.toLowerCase().trim().replace(/\.glb$/i, '');

            let loadedResult: any = null;
            let successPath = '';

            // 1. Sprawdzenie zaindeksowanych modeli w ALL_GLB_MAP
            const directUrl = ALL_GLB_MAP[cleanId + '.glb'] ||
                              ALL_GLB_MAP[cleanBaseId + '.glb'] ||
                              ALL_GLB_MAP[cleanId] ||
                              ALL_GLB_MAP[cleanBaseId] ||
                              ALL_GLB_MAP['antaro m 500.glb'];

            if (directUrl) {
                try {
                    const lastSlash = directUrl.lastIndexOf('/');
                    const rootUrl = directUrl.substring(0, lastSlash + 1);
                    const filename = directUrl.substring(lastSlash + 1);
                    loadedResult = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, filename, scene);
                    if (loadedResult && loadedResult.meshes && loadedResult.meshes.length > 0) {
                        successPath = directUrl;
                    }
                } catch (err) {
                    console.warn(`[HardwareLoader] Niepowodzenie ładowania z mapy (${directUrl}):`, err);
                }
            }

            if (!loadedResult || !loadedResult.meshes || loadedResult.meshes.length === 0) {
                const candidates = [
                    `/B1_biblioteka/zawieszki/models/${cleanId}.glb`,
                    `./B1_biblioteka/zawieszki/models/${cleanId}.glb`,
                    `/B1_biblioteka/zawieszki/models/${id}.glb`,
                    `./B1_biblioteka/zawieszki/models/${id}.glb`,
                    `/B1_biblioteka/uchwyty/Rejs/models/${cleanId}.glb`,
                    `./B1_biblioteka/uchwyty/Rejs/models/${cleanId}.glb`,
                    `/B1_biblioteka/uchwyty/Rejs/models/${id}.glb`,
                    `./B1_biblioteka/uchwyty/Rejs/models/${id}.glb`,
                    `/B1_biblioteka/szuflady/Blum/Antaro/models/${id}.glb`,
                    `./B1_biblioteka/szuflady/Blum/Antaro/models/${id}.glb`,
                    `/B1_biblioteka/szuflady/Blum/Antaro/models/${baseId}.glb`,
                    `./B1_biblioteka/szuflady/Blum/Antaro/models/${baseId}.glb`,
                    `/B1_biblioteka/szuflady/Blum/Antaro/models/Antaro M 500.glb`,
                    `./B1_biblioteka/szuflady/Blum/Antaro/models/Antaro M 500.glb`,
                    `/B1_biblioteka/zawiasy/${id}.glb`,
                    `./B1_biblioteka/zawiasy/${id}.glb`,
                    `/B1_biblioteka/zawiasy/models/${id}.glb`,
                    `./B1_biblioteka/zawiasy/models/${id}.glb`,
                    `/B1_biblioteka/polki_akcesoria/models/${id}.glb`,
                    `./B1_biblioteka/polki_akcesoria/models/${id}.glb`,
                    `/B1_biblioteka/polki_akcesoria/models/${cleanId}.glb`,
                    `./B1_biblioteka/polki_akcesoria/models/${cleanId}.glb`,
                    `/B1_biblioteka/polki_akcesoria/${id}.glb`,
                    `./B1_biblioteka/polki_akcesoria/${id}.glb`
                ];

                for (const path of candidates) {
                    try {
                        const lastSlash = path.lastIndexOf('/');
                        const rootUrl = path.substring(0, lastSlash + 1);
                        const filename = path.substring(lastSlash + 1);

                        loadedResult = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, filename, scene);
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
                console.warn(`[HardwareLoader] Nie udało się załadować pliku GLB dla: ${id}`);
                return null;
            }

            // Utwórz węzeł główny szablonu
            const templateRoot = new BABYLON.TransformNode(`template_${id}`, scene);
            templateRoot.position.set(0, -999999, 0); // Schowaj poza widok kamery
            templateRoot.setEnabled(false);

            // Podepnij meshe do węzła szablonu
            for (const mesh of loadedResult.meshes) {
                if (!mesh.parent) {
                    mesh.parent = templateRoot;
                }
                mesh.isPickable = false;
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
            if (diag > 0.0001 && diag < 2.0) {
                templateRoot.scaling.set(1000, 1000, 1000);
            }

            this._templates.set(id, templateRoot);
            // Alias po nazwie pliku (uchwyty: Easy-160 / easy-160)
            if (cleanId && cleanId !== id) this._templates.set(cleanId, templateRoot);
            const withGlb = `${cleanId}.glb`;
            if (cleanId && !this._templates.has(withGlb)) this._templates.set(withGlb, templateRoot);
            console.log(`[HardwareLoader] ✅ Załadowano i przygotowano szablon ${id} z ${successPath}`);
            return templateRoot;
        })();

        this._loadPromises.set(id, promise);
        return promise;
    }

    /**
     * Sprawdza czy szablon jest już załadowany w pamięci podręcznej.
     */
    public hasTemplate(id: string): boolean {
        return this._templates.has(id);
    }

    /**
     * Tworzy instancję / klon zawiasu gotowy do umieszczenia na scenie.
     */
    public createHingeInstance(id: string, scene: any): any {
        return this._cloneHardwareInstance(id, `hw_${id}`, { pickable: false });
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
        const descendants = instance.getDescendants(false);
        for (const node of descendants) {
            node.setEnabled(true);
            if ('isVisible' in node) {
                (node as any).isVisible = true;
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
     * Tworzy instancję / klon boczku szuflady gotowy do umieszczenia na scenie.
     * Obsługuje automatyczne odbicie lustrzane dla prawego boku oraz skalowanie długości (baza 500mm).
     */
    public createDrawerSideInstance(id: string, scene: any, side: 'left' | 'right' = 'left', lengthMm?: number): any {
        let template = this._templates.get(id);
        if (!template && id.endsWith('_R')) {
            template = this._templates.get(id.replace(/_R$/, '_L'));
        }
        if (!template && !id.endsWith('_L') && !id.endsWith('_R')) {
            template = this._templates.get(`${id}_L`) || this._templates.get(id);
        }
        if (!template) {
            // Spróbuj szukać ogólnego modelu Antaro
            template = this._templates.get('BLUM_ANTARO_M_L') || this._templates.get('BLUM_ANTARO_M');
        }
        if (!template) return null;

        const cloneName = `hw_drawer_${id}_${side}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const instance = template.clone(cloneName, null, false);
        if (!instance) return null;

        instance.position.set(0, 0, 0);
        instance.setEnabled(true);

        const descendants = instance.getDescendants(false);
        for (const node of descendants) {
            node.setEnabled(true);
            if ('isVisible' in node) (node as any).isVisible = true;
            if ('isPickable' in node) (node as any).isPickable = true;
            if ((node as any).material) {
                (node as any).material.backFaceCulling = false;
                if ((node as any).material.specularColor) {
                    (node as any).material.specularColor = new BABYLON.Color3(0.7, 0.7, 0.75);
                }
            }
        }

        const baseScale = Math.abs(template.scaling?.y ?? 1);
        const lenScale = (lengthMm && lengthMm > 0) ? (lengthMm / 500) : 1;
        instance.scaling.set(
            side === 'right' ? -baseScale : baseScale,
            baseScale,
            baseScale * lenScale
        );
        // Obrót 180° w osi Y: bieg od frontu szafki w głąb korpusu (+Z)
        instance.rotation.set(0, Math.PI, 0);
        instance.metadata = { baseScale };

        return instance;
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
