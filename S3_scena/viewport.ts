/**
 * SmartPanel Web — Viewport
 * 
 * Inicjalizacja sceny Babylon.js: kamera, światła, siatka podłogowa, render loop.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { PerformanceConfigManager } from '../A1_core/performance-config.js';
import { probeBayFromCADPoint, probeBayFromSceneRay } from '../A2_smartbox/smartbox-bay-detector.js';
import { highlightBayInScene, clearBayHighlight } from '../A2_smartbox/smartbox-bay-visualizer.js';

declare const BABYLON: any;

export class Viewport {
    canvas: HTMLCanvasElement;
    engine: any;
    scene: any;
    camera: any;
    headlamp: any;
    keyLight: any;
    fillLight: any;
    backlight: any;
    gridLines: any[] = [];
    axes: any[] = [];
    datumPlanes: any[] = [];
    _orthoZoomObserver: any = null;
    private _lastCubeAlpha: number | null = null;
    private _lastCubeBeta: number | null = null;

    isPanToolActive: boolean = false;
    currentRenderMode: 'shaded' | 'edges' | 'wireframe' | 'xray' = 'edges';
    /** PMI / narzędzia: podwójny klik odwołuje narzędzie, nie zoomuje kamery. */
    suppressDoubleTapZoom = false;

    private _dirtyFrames: number = 5;
    private _isDirty: boolean = true;

    /**
     * Zgłasza potrzebę wyrenderowania klatki (lub określonej liczby klatek) sceny 3D.
     * W trybie Render-on-Demand pozwala na 0% zużycia CPU/GPU w stanie spoczynku.
     */
    public requestRender(frames: number = 2): void {
        this._dirtyFrames = Math.max(this._dirtyFrames, frames);
        this._isDirty = true;
    }

    /**
     * Inicjalizacja silnika graficznego z obsługą stabilnego WebGL2 oraz opcjonalnego WebGPU
     */
    static async create(canvas: any) {
        let engine: any = null;
        const perfConfig = PerformanceConfigManager.instance;
        const powerPref = perfConfig.getPowerPreference();
        const antialias = perfConfig.getAntialias();
        const preferredEngine = perfConfig.getPreferredEngine();

        // Sprawdzenie czy użytkownik wybrał WebGPU w opcjach lub zażądał w URL (?webgpu=true)
        const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
        const forceWebGPU = preferredEngine === 'webgpu' || urlParams?.get('webgpu') === 'true' || urlParams?.get('webgpu') === '1';

        if (forceWebGPU) {
            try {
                const webGPUSupported = await BABYLON.WebGPUEngine?.IsSupportedAsync;
                if (webGPUSupported) {
                    console.log("🚀 Inicjalizacja eksperymentalnego WebGPU Engine");
                    engine = new BABYLON.WebGPUEngine(canvas, {
                        stencil: true,
                        preserveDrawingBuffer: false,
                        powerPreference: powerPref,
                        antialias
                    });
                    await engine.initAsync();
                }
            } catch (err) {
                console.warn("Nieudana inicjalizacja WebGPU Engine. Następuje fallback do stabilnego WebGL2:", err);
                engine = null;
            }
        }

        // Standard produkcyjny dla CAD: stabilny, w 100% kompatybilny WebGL2
        if (!engine) {
            engine = new BABYLON.Engine(canvas, antialias, {
                preserveDrawingBuffer: false,
                stencil: true,
                powerPreference: powerPref
            });
        }
        
        perfConfig.applyToEngine(engine);
        return new Viewport(canvas, engine);
    }

    constructor(canvas: any, engine: any) {
        this.canvas = canvas;
        this.engine = engine;

        // Scene
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.92, 0.93, 0.95, 1);
        this.scene.ambientColor = new BABYLON.Color3(0.15, 0.15, 0.15);

        // ─── Camera ──────────────────────────────────
        this.camera = new BABYLON.ArcRotateCamera(
            'camera',
            -Math.PI / 4,       // alpha (perspektywa przodu front-right)
            Math.PI / 3,        // beta  (kąt od góry)
            5200,               // radius (odsunięcie, aby cały korpus i otoczenie swobodnie mieściły się w kadrze)
            new BABYLON.Vector3(500, 950, 300), // target — środek standardowego mebla
            this.scene
        );
        this.camera.attachControl(canvas, true);
        this.camera.inertia = 0; // CAD 1:1 - natychmiastowa reakcja bez opóźnień (SolidWorks style)
        this.camera.panningInertia = 0;
        
        // Domyślny widok ortogonalny (ortho)
        this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        this._updateOrthographicBounds();
        this._orthoZoomObserver = this.camera.onViewMatrixChangedObservable.add(() => {
            this._updateOrthographicBounds();
            this._syncViewCube();
            this.requestRender(2);
        });

        // Wyłączenie domyślnych kontroli wskaźnika Babylon.js (LMB nie obraca już natywnie sceny)
        if (this.camera.inputs.attached.pointers) {
            this.camera.inputs.remove(this.camera.inputs.attached.pointers);
        }
        if (this.camera.inputs.attached.mousewheel) {
            this.camera.inputs.remove(this.camera.inputs.attached.mousewheel);
        }

        // Zapobieganie domyślnej nawigacji przeglądarki (Wstecz/Dalej) dla przycisków bocznych myszy
        const preventSideNav = (e: MouseEvent) => {
            if (e.button === 3 || e.button === 4) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        canvas.addEventListener('mousedown', preventSideNav);
        canvas.addEventListener('mouseup', preventSideNav);
        canvas.addEventListener('auxclick', preventSideNav);
        window.addEventListener('auxclick', preventSideNav);

        const rotationSensibility = 150; // Szybki obrót
        const panningSensibility = 0.15; // Prędkość przesuwania
        const zoomSensibility = 0.15; // Prędkość zooma

        let isRotating = false;
        let isPanning = false;
        let lastX = 0;
        let lastY = 0;
        let lastBayProbeTime = 0;

        this.scene.onPointerObservable.add((pointerInfo) => {
            this.requestRender(2);
            const evt = pointerInfo.event as PointerEvent | WheelEvent;

            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                if (evt.button === 1) { // Środkowy przycisk myszy (MMB)
                    if (evt.shiftKey) {
                        isPanning = true;
                    } else {
                        isRotating = true;
                    }
                    lastX = this.scene.pointerX;
                    lastY = this.scene.pointerY;
                    evt.preventDefault();
                } else if (evt.button === 3 || evt.button === 4) { // Mały przycisk myszy z boku (side button)
                    isPanning = true;
                    lastX = this.scene.pointerX;
                    lastY = this.scene.pointerY;
                    evt.preventDefault();
                    evt.stopPropagation();
                } else if (evt.button === 0) { // Lewy przycisk myszy (LMB)
                    const bayCtrl = ContextManager.instance.smartBoxBayController;
                    if (bayCtrl?.isPickerActive && !ContextManager.instance.activeReferencePicker) {
                        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (m: any) => m.isPickable && m.isVisible && !m.name?.includes('ground') && !m.name?.includes('grid') && !m.name?.includes('smartbox_bay') && !m.name?.includes('smartbox_plane'));
                        if (pick && pick.hit && pick.pickedPoint) {
                            const cadPoint = {
                                x: pick.pickedPoint.x,
                                y: pick.pickedPoint.z,
                                z: pick.pickedPoint.y
                            };
                            const doc = ContextManager.instance.document;
                            if (doc) {
                                const bay = probeBayFromSceneRay(this.scene, pick, doc) || probeBayFromCADPoint(doc, cadPoint);
                                if (bay) {
                                    highlightBayInScene(this.scene, bay);
                                    bayCtrl.setLastDetectedBay(bay);
                                    const optType = bayCtrl.pendingSmartBoxType || bayCtrl.draggedSmartBoxType || 'EMPTY';
                                    bayCtrl.notifyBayDetected(bay, optType === 'EMPTY');
                                    evt.preventDefault();
                                    evt.stopPropagation();
                                    return;
                                }
                            }
                        }
                    }

                    if (this.isPanToolActive) {
                        isPanning = true;
                        lastX = this.scene.pointerX;
                        lastY = this.scene.pointerY;
                        evt.preventDefault();
                    } else if (evt.altKey) { // Alt + LMB dla obrotu
                        isRotating = true;
                        lastX = this.scene.pointerX;
                        lastY = this.scene.pointerY;
                        evt.preventDefault();
                    }
                }
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
                if (evt.button === 1 || evt.button === 3 || evt.button === 4) {
                    evt.preventDefault();
                }
                isRotating = false;
                isPanning = false;
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                const bayCtrl = ContextManager.instance.smartBoxBayController;
                if (bayCtrl?.isPickerActive && !ContextManager.instance.activeReferencePicker) {
                    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
                    const throttleMs = PerformanceConfigManager.instance.getThrottleHoverMs();
                    if (now - lastBayProbeTime >= throttleMs) {
                        lastBayProbeTime = now;
                        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (m: any) => m.isPickable && m.isVisible && !m.name?.includes('ground') && !m.name?.includes('grid') && !m.name?.includes('smartbox_bay') && !m.name?.includes('smartbox_plane'));
                        if (pick && pick.hit && pick.pickedPoint) {
                            const cadPoint = {
                                x: pick.pickedPoint.x,
                                y: pick.pickedPoint.z,
                                z: pick.pickedPoint.y
                            };
                            const doc = ContextManager.instance.document;
                            if (doc) {
                                const bay = probeBayFromSceneRay(this.scene, pick, doc) || probeBayFromCADPoint(doc, cadPoint);
                                if (bay) {
                                    highlightBayInScene(this.scene, bay);
                                    bayCtrl.setLastDetectedBay(bay);
                                }
                            }
                        }
                    }
                }
                if (isRotating || isPanning) {
                    const deltaX = this.scene.pointerX - lastX;
                    const deltaY = this.scene.pointerY - lastY;

                    if (deltaX !== 0 || deltaY !== 0) {
                        if (isRotating) {
                            this.camera.alpha -= deltaX / rotationSensibility;
                            this.camera.beta -= deltaY / rotationSensibility;
                        } else if (isPanning) {
                            const moveSpeed = this.camera.radius * panningSensibility * 0.01;
                            
                            const transformMatrix = this.camera.getViewMatrix();
                            const right = new BABYLON.Vector3(transformMatrix.m[0], transformMatrix.m[4], transformMatrix.m[8]);
                            const up = new BABYLON.Vector3(transformMatrix.m[1], transformMatrix.m[5], transformMatrix.m[9]);
                            
                            const panX = right.scale(-deltaX * moveSpeed);
                            const panY = up.scale(deltaY * moveSpeed);
                            
                            this.camera.target.addInPlace(panX).addInPlace(panY);
                        }

                        lastX = this.scene.pointerX;
                        lastY = this.scene.pointerY;
                    }
                }
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
                const wheelEvt = evt as WheelEvent;
                // Kierunek zoomu SolidWorks / poprzedni styl
                const isZoomIn = wheelEvt.deltaY > 0;
                const zoomFactor = isZoomIn ? (1 - zoomSensibility) : (1 + zoomSensibility);

                const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, BABYLON.Matrix.Identity(), this.camera);
                
                // Szukamy fizycznego punktu pod kursorem (kolizja z widocznymi bryłami mebla / narożami)
                const pickInfo = this.scene.pickWithRay(ray, (m: any) => m.isPickable && m.isVisible && !m.name?.includes('ground') && !m.name?.includes('grid') && !m.name?.includes('lcs'));
                
                let targetPoint: any = null;
                if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
                    targetPoint = pickInfo.pickedPoint;
                } else {
                    // Jeśli kursor jest w pustej przestrzeni, rzutujemy na płaszczyznę kamery przechodzącą przez target
                    const forward = this.camera.target.subtract(this.camera.position).normalize();
                    if (forward.lengthSquared() > 0.0001) {
                        const plane = BABYLON.Plane.FromPositionAndNormal(this.camera.target, forward);
                        const dist = ray.intersectsPlane(plane);
                        if (dist !== null && dist > 0) {
                            targetPoint = ray.origin.add(ray.direction.scale(dist));
                        }
                    }
                }

                if (targetPoint && isZoomIn) {
                    // Płynnie przesuwamy cel kamery w stronę wskazanego naroża / formatki
                    const shiftFactor = 1 - zoomFactor;
                    const shiftVec = targetPoint.subtract(this.camera.target).scale(shiftFactor);
                    this.camera.target.addInPlace(shiftVec);
                }

                let newRadius = this.camera.radius * zoomFactor;
                if (newRadius < this.camera.lowerRadiusLimit) newRadius = this.camera.lowerRadiusLimit;
                if (newRadius > this.camera.upperRadiusLimit) newRadius = this.camera.upperRadiusLimit;
                
                this.camera.radius = newRadius;
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOUBLETAP) {
                if (this.suppressDoubleTapZoom) return;
                // Podwójne kliknięcie na naroże lub formatkę centruje widok na wskazanym punkcie
                const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, BABYLON.Matrix.Identity(), this.camera);
                const pickInfo = this.scene.pickWithRay(ray, (m: any) => m.isPickable && m.isVisible && !m.name?.includes('ground') && !m.name?.includes('grid'));
                if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
                    this.animateCameraTo(
                        this.camera.alpha,
                        this.camera.beta,
                        Math.max(this.camera.radius * 0.5, 100),
                        pickInfo.pickedPoint
                    );
                }
            }
        });

        // Globalny helper w konsoli do pobrania aktualnego stanu kamery
        if (typeof window !== 'undefined') {
            (window as any).getCamera = () => {
                const cam = this.camera;
                const info = {
                    radius_mm: Math.round(cam.radius),
                    position: { x: Math.round(cam.position.x), y: Math.round(cam.position.y), z: Math.round(cam.position.z) },
                    target: { x: Math.round(cam.target.x), y: Math.round(cam.target.y), z: Math.round(cam.target.z) },
                    alpha_rad: Number(cam.alpha.toFixed(3)),
                    beta_rad: Number(cam.beta.toFixed(3)),
                };
                console.log('%c[KAMERA AKTUALNY STAN]', 'color: #38bdf8; font-weight: bold;', info);
                return info;
            };
            (window as any).logCamera = (window as any).getCamera;
        }

        // Zapobieganie ucinaniu formatek (brak clippingu w rzucie orto, a w perspektywie minZ = 0.1 mm)
        this.camera.minZ = this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA ? -50000 : 0.1;
        this.camera.maxZ = 50000;
        this.camera.lowerRadiusLimit = 0.5;
        this.camera.upperRadiusLimit = 20000;
        this.camera.inertia = 0; // CAD 1:1 - brak opóźnienia i bezwładności (SolidWorks style)
        this.camera.panningInertia = 0;

        // Odblokowanie pełnego obrotu wokół osi
        this.camera.lowerBetaLimit = null;
        this.camera.upperBetaLimit = null;
        this.camera.allowUpAndDownInputs = true;

        // ─── Lighting ────────────────────────────────
        // Główne światło (Headlamp) - zawsze świeci od strony kamery
        this.headlamp = new BABYLON.HemisphericLight(
            'headlamp',
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
        this.headlamp.intensity = 0.85;
        this.headlamp.specular = new BABYLON.Color3(0.05, 0.05, 0.05);

        // Światło wypełniające (Backlight) - zapobiega smolistym cieniom
        this.backlight = new BABYLON.HemisphericLight(
            'backlight',
            new BABYLON.Vector3(0, -1, 0),
            this.scene
        );
        this.backlight.intensity = 0.35;
        this.backlight.specular = new BABYLON.Color3(0, 0, 0);

        this.scene.registerBeforeRender(() => {
            // Wektor od modelu do kamery (oświetlenie)
            if (this.camera && this.camera.position && this.camera.target) {
                const dir = this.camera.position.subtract(this.camera.target).normalize();
                this.headlamp.direction = dir;
                this.backlight.direction = dir.negate();
            }
        });



        // ─── Ground grid ─────────────────────────────
        this._createGroundGrid();

        // ─── Render loop (Render-on-Demand) ──────────
        this.engine.runRenderLoop(() => {
            const perfConfig = PerformanceConfigManager.instance;
            const onDemand = perfConfig.getRenderOnDemand();
            if (!onDemand || this._dirtyFrames > 0 || this._isDirty) {
                this.scene.render();
                this._syncViewCube();
                if (this._dirtyFrames > 0) {
                    this._dirtyFrames--;
                }
                this._isDirty = false;
            }
        });

        // ─── Resize ──────────────────────────────────
        window.addEventListener('resize', () => {
            this.engine.resize();
            this.requestRender(3);
        });

        PerformanceConfigManager.instance.subscribe(() => {
            this.requestRender(2);
        });
    }

    private _loadScript(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof document === 'undefined') {
                resolve();
                return;
            }
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = (err) => reject(err);
            document.head.appendChild(script);
        });
    }

    async toggleInspector() {
        if (!this.scene) return;
        try {
            if (this.scene.debugLayer && this.scene.debugLayer.isVisible()) {
                this.scene.debugLayer.hide();
                return;
            }
            if (!(window as any).BABYLON?.GUI) {
                await this._loadScript('https://cdn.babylonjs.com/gui/babylon.gui.js');
            }
            if (!(window as any).BABYLON?.Inspector) {
                await this._loadScript('https://cdn.babylonjs.com/inspector/babylon.inspector.bundle.js');
            }
            if (this.scene.debugLayer) {
                this.scene.debugLayer.show({ embedMode: true });
            }
        } catch (e) {
            console.error("Błąd podczas przełączania Babylon Inspector:", e);
        }
    }

    _createGroundGrid() {
        const ground = BABYLON.MeshBuilder.CreateGround('ground', {
            width: 6000,
            height: 6000,
            subdivisions: 1
        }, this.scene);
        ground.position.y = -0.5;
        ground.isPickable = false;

        const gridMat = new BABYLON.StandardMaterial('gridMat', this.scene);
        gridMat.diffuseColor = new BABYLON.Color3(0.88, 0.89, 0.91);
        gridMat.specularColor = BABYLON.Color3.Black();
        gridMat.alpha = 0.4;
        gridMat.backFaceCulling = false;

        // Rysujemy siatkę z linii — daje lepszy efekt niż texture
        const gridLines = [];
        const gridSize = 3000;
        const step = 100;
        for (let i = -gridSize; i <= gridSize; i += step) {
            gridLines.push([
                new BABYLON.Vector3(i, 0, -gridSize),
                new BABYLON.Vector3(i, 0, gridSize)
            ]);
            gridLines.push([
                new BABYLON.Vector3(-gridSize, 0, i),
                new BABYLON.Vector3(gridSize, 0, i)
            ]);
        }

        const grid = BABYLON.MeshBuilder.CreateLineSystem('gridLines', {
            lines: gridLines
        }, this.scene);
        grid.color = new BABYLON.Color3(0.78, 0.80, 0.83);
        grid.alpha = 0.35;
        grid.isPickable = false;

        // Osie — X czerwona, Y zielona, Z niebieska (Styl Blender: 3D strzałki)
        const createArrow = (name, color, dir) => {
            const arrowLen = 120;
            const headLen = 25;
            const thickness = 1.5;
            
            const root = new BABYLON.TransformNode(name, this.scene);
            
            const mat = new BABYLON.StandardMaterial(name + 'Mat', this.scene);
            mat.diffuseColor = color;
            mat.emissiveColor = color.scale(0.4);

            const line = BABYLON.MeshBuilder.CreateCylinder(name + '_line', { height: arrowLen, diameter: thickness }, this.scene);
            line.material = mat;
            line.position.y = arrowLen / 2;
            line.isPickable = false;
            line.parent = root;

            const head = BABYLON.MeshBuilder.CreateCylinder(name + '_head', { height: headLen, diameterTop: 0, diameterBottom: thickness * 3.5 }, this.scene);
            head.material = mat;
            head.position.y = arrowLen + headLen / 2;
            head.isPickable = false;
            head.parent = root;

            if (dir === 'X') {
                root.rotation.z = -Math.PI / 2;
            } else if (dir === 'Y') {
                // y is up by default
            } else if (dir === 'Z') {
                root.rotation.x = Math.PI / 2;
            }
            return root;
        };

        const axisX = createArrow('axisX', new BABYLON.Color3(0.9, 0.2, 0.2), 'X');
        const axisY = createArrow('axisY', new BABYLON.Color3(0.2, 0.4, 0.9), 'Y'); // Blue (pion / Z w Blenderze)
        const axisZ = createArrow('axisZ', new BABYLON.Color3(0.5, 0.8, 0.2), 'Z'); // Green (głębokość / Y w Blenderze)

        // Płaszczyzny bazowe (Datum Planes) — jak Front / Top / Right w SolidWorks
        const planeSize = 500;
        const planeMat = new BABYLON.StandardMaterial('datumMat', this.scene);
        planeMat.diffuseColor = new BABYLON.Color3(0.45, 0.62, 0.95);
        planeMat.alpha = 0.12;
        planeMat.backFaceCulling = false;

        const markDatum = (mesh: any, label: string) => {
            mesh.material = planeMat;
            mesh.isPickable = false;
            mesh.metadata = { type: 'datum_plane', name: label };
            mesh.enableEdgesRendering();
            mesh.edgesWidth = 2.0;
            mesh.edgesColor = new BABYLON.Color4(0.35, 0.55, 0.95, 0.85);
        };

        const topPlane = BABYLON.MeshBuilder.CreatePlane('TopPlane', { size: planeSize }, this.scene);
        topPlane.rotation.x = Math.PI / 2;
        markDatum(topPlane, 'Top');

        const frontPlane = BABYLON.MeshBuilder.CreatePlane('FrontPlane', { size: planeSize }, this.scene);
        markDatum(frontPlane, 'Front');

        const rightPlane = BABYLON.MeshBuilder.CreatePlane('RightPlane', { size: planeSize }, this.scene);
        rightPlane.rotation.y = Math.PI / 2;
        markDatum(rightPlane, 'Right');

        this.gridLines = grid;
        this.axes = [axisX, axisY, axisZ];
        this.datumPlanes = [topPlane, frontPlane, rightPlane];

        ground.dispose(); // nie potrzebujemy fizycznego ground, mamy linie
    }

    /**
     * Włącza lub wyłącza siatkę podłogową i osie.
     */
    toggleGrid(visible) {
        if (this.gridLines) {
            if (typeof this.gridLines.forEach === 'function') {
                this.gridLines.forEach(l => l.setEnabled(visible));
            } else if (typeof (this.gridLines as any).setEnabled === 'function') {
                (this.gridLines as any).setEnabled(visible);
            }
        }
        if (this.axes) {
            this.axes.forEach(axis => axis.setEnabled(visible));
        }
        if (this.datumPlanes) {
            this.datumPlanes.forEach((p) => {
                if (!p) return;
                p.setEnabled(visible);
                p.isVisible = visible;
            });
        }
    }

    /**
     * Ustawia tryb renderowania sceny CAD.
     * @param {'shaded'|'edges'|'wireframe'|'xray'} mode 
     */
    setRenderMode(mode: 'shaded' | 'edges' | 'wireframe' | 'xray') {
        this.currentRenderMode = mode;
        this.applyRenderModeToMeshes();
    }

    /**
     * Stosuje bieżący tryb renderowania do wszystkich siatek w scenie.
     */
    applyRenderModeToMeshes() {
        const mode = this.currentRenderMode || 'edges';
        this.scene.meshes.forEach((mesh: any) => {
            this.applyRenderModeToMesh(mesh, mode);
        });
        this.requestRender(2);
    }

    /**
     * Stosuje tryb renderowania do konkretnej siatki.
     */
    applyRenderModeToMesh(mesh: any, mode?: string) {
        if (!mesh) return;
        const currentMode = mode || this.currentRenderMode || 'edges';

        const name = mesh.name || '';
        const isFace = name.startsWith('face_') || 
                       name.startsWith('cylinder_') || 
                       mesh.metadata?.faceName || 
                       mesh.metadata?.type === 'face';
        const isFeature = mesh.metadata?.type === 'feature' || 
                          name.startsWith('hole_') || 
                          name.startsWith('pocket_') || 
                          name.startsWith('groove_') || 
                          name.startsWith('point_') ||
                          name.startsWith('feature_');
        const isEdge = mesh.metadata?.type === 'edge' || 
                       name.startsWith('edge_') || 
                       name.startsWith('lines_');

        if (isFace || isFeature) {
            if (currentMode === 'wireframe') {
                mesh.visibility = 0.0;
                mesh.isPickable = false;
                mesh.isVisible = false;
            } else if (currentMode === 'xray') {
                mesh.visibility = 0.35;
                mesh.isPickable = true;
                mesh.isVisible = true;
            } else {
                mesh.visibility = 1.0;
                mesh.isPickable = true;
                mesh.isVisible = true;
            }
        }

        if (isEdge) {
            mesh.setEnabled(true);
            mesh.isVisible = true;
            mesh.isPickable = true;
        }

        const isConnectorSymbol = name.startsWith('c2_conn') || 
                                  name.startsWith('c2_patch') || 
                                  mesh.metadata?.type === 'c2_connector_symbol';
        if (isConnectorSymbol) {
            const showInMode = currentMode === 'wireframe' || currentMode === 'xray';
            mesh.setEnabled(showInMode);
            mesh.visibility = showInMode ? 1.0 : 0.0;
            mesh.isVisible = showInMode;
        }
    }

    /**
     * Przełącza rzutowanie kamery między perspektywą a rzutem prostokątnym.
     */
    toggleCameraProjection() {
        if (this.camera.mode === BABYLON.Camera.PERSPECTIVE_CAMERA) {
            this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
            this.camera.minZ = -50000;
            this._updateOrthographicBounds();

            this._orthoZoomObserver = this.camera.onViewMatrixChangedObservable.add(() => {
                this._updateOrthographicBounds();
            });
            return 'ortho';
        } else {
            this.camera.mode = BABYLON.Camera.PERSPECTIVE_CAMERA;
            this.camera.minZ = 0.1;
            if (this._orthoZoomObserver) {
                this.camera.onViewMatrixChangedObservable.remove(this._orthoZoomObserver);
                this._orthoZoomObserver = null;
            }
            return 'perspective';
        }
    }

    private _lastOrthoRadius: number = -1;
    private _lastOrthoAspect: number = -1;

    _updateOrthographicBounds() {
        if (this.camera.mode !== BABYLON.Camera.ORTHOGRAPHIC_CAMERA) return;
        
        const aspect = this.engine.getAspectRatio(this.camera);
        const orthoSize = this.camera.radius * 0.65;
        
        if (this._lastOrthoRadius === this.camera.radius && Math.abs(this._lastOrthoAspect - aspect) < 0.0001) {
            return;
        }
        this._lastOrthoRadius = this.camera.radius;
        this._lastOrthoAspect = aspect;

        this.camera.orthoLeft = -orthoSize * aspect;
        this.camera.orthoRight = orthoSize * aspect;
        this.camera.orthoTop = orthoSize;
        this.camera.orthoBottom = -orthoSize;
    }

    /**
     * Automatycznie ustawia i kadruje kamerę na widoczne obiekty CAD.
     */
    zoomToFit() {
        // Kod kadrowania kamery wyłączony na życzenie użytkownika (brak automatycznego skakania/kadrowania)
        return;
    }

    /**
     * Przybliża kamerę do wskazanego prostokątnego obszaru ekranu (Window Zoom / ramka powiększająca).
     */
    zoomToWindow(startX: number, startY: number, endX: number, endY: number) {
        if (!this.camera || !this.canvas || !this.scene) return;

        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);

        const boxW = maxX - minX;
        const boxH = maxY - minY;

        // Jeśli kliknięto bez przeciągania (zbyt mała ramka), zignoruj
        if (boxW < 8 || boxH < 8) return;

        const canvasW = this.canvas.clientWidth || window.innerWidth;
        const canvasH = this.canvas.clientHeight || window.innerHeight;

        const scaleX = canvasW / boxW;
        const scaleY = canvasH / boxH;
        const zoomFactor = Math.min(Math.max(Math.min(scaleX, scaleY), 1.05), 30);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        let newTarget: any = null;

        // Sprawdź czy pod środkiem ramki znajduje się geometria 3D
        const pickResult = this.scene.pick(centerX, centerY);
        if (pickResult && pickResult.hit && pickResult.pickedPoint) {
            newTarget = pickResult.pickedPoint.clone();
        } else {
            const ray = this.scene.createPickingRay(centerX, centerY, BABYLON.Matrix.Identity(), this.camera);
            const cameraForward = this.camera.target.subtract(this.camera.position).normalize();
            const plane = BABYLON.Plane.FromPositionAndNormal(this.camera.target, cameraForward);
            const dist = ray.intersectsPlane(plane);
            if (dist !== null && dist > 0) {
                newTarget = ray.origin.add(ray.direction.scale(dist));
            } else {
                newTarget = this.camera.target.clone();
            }
        }

        const minRadius = this.camera.lowerRadiusLimit || 50;
        const newRadius = Math.max(minRadius, this.camera.radius / zoomFactor);

        this.animateCameraTo(this.camera.alpha, this.camera.beta, newRadius, newTarget);
    }

    /**
     * Animuje kamerę do podanej pozycji.
     */
    animateCameraTo(alpha, beta, radius, target) {
        const fps = 60;
        const frames = 30;
        const ease = new BABYLON.QuadraticEase();
        const loopMode = 2; // 0 = relative loop, 1 = cycle, 2 = constant (no loop)

        BABYLON.Animation.CreateAndStartAnimation('camAlpha', this.camera, 'alpha', fps, frames,
            this.camera.alpha, alpha, loopMode, ease);

        BABYLON.Animation.CreateAndStartAnimation('camBeta', this.camera, 'beta', fps, frames,
            this.camera.beta, beta, loopMode, ease);

        BABYLON.Animation.CreateAndStartAnimation('camRadius', this.camera, 'radius', fps, frames,
            this.camera.radius, radius, loopMode, ease);

        if (target) {
            BABYLON.Animation.CreateAndStartAnimation('camTarget', this.camera, 'target', fps, frames,
                this.camera.target.clone(), target, loopMode, ease);
        }
        this.requestRender(frames + 10);
    }

    setPanToolActive(active: boolean) {
        this.isPanToolActive = active;
        if (this.canvas) {
            this.canvas.style.cursor = active ? 'grab' : 'default';
        }
    }

    togglePanTool(): boolean {
        this.setPanToolActive(!this.isPanToolActive);
        return this.isPanToolActive;
    }

    dispose() {
        if (this._orthoZoomObserver && this.camera) {
            this.camera.onViewMatrixChangedObservable.remove(this._orthoZoomObserver);
        }
        this.engine.dispose();
    }

    /**
     * Synchronizuje obrót kostki orientacji (ViewCube w prawym górnym rogu) z kamerą sceny 3D.
     */
    _syncViewCube() {
        if (!this.camera) return;
        const alpha = this.camera.alpha;
        const beta = this.camera.beta;
        if (alpha === this._lastCubeAlpha && beta === this._lastCubeBeta) return;
        this._lastCubeAlpha = alpha;
        this._lastCubeBeta = beta;

        const cubes = typeof window !== 'undefined' && window.document
            ? window.document.querySelectorAll<HTMLElement>('.view-cube-wrapper')
            : null;
        if (!cubes || cubes.length === 0) return;

        const degX = (beta * 180 / Math.PI) - 90;
        const degY = -((alpha * 180 / Math.PI) + 90);
        const transformStr = `rotateX(${degX.toFixed(2)}deg) rotateY(${degY.toFixed(2)}deg)`;
        for (let i = 0; i < cubes.length; i++) {
            cubes[i].style.transform = transformStr;
        }
    }
}
