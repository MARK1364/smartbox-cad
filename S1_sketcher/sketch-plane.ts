/**
 * SmartPanel Web — Sketch Plane
 * 
 * Aktywuje płaszczyznę 2D na wybranej ścianie płyty.
 * Rysuje siatkę, osie UV, i pozwala klikać punkty.
 */

declare const BABYLON: any;

export class SketchPlane {
    scene: any;
    panelModel: any;
    viewport: any;
    activeFace: string | null = null;
    active: boolean = false;
    _sketchRoot: any = null;
    _gridMesh: any = null;
    _cursorMarker: any = null;
    _pointMarkers: any[] = [];
    points: Array<{ u: number; v: number }> = [];
    _listeners: Set<Function> = new Set();

    constructor(scene: any, panelModel: any, viewport: any) {
        this.scene = scene;
        this.panelModel = panelModel;
        this.viewport = viewport;

        /** @type {string|null} */
        this.activeFace = null;

        /** @type {BABYLON.TransformNode|null} */
        this._sketchRoot = null;

        /** @type {BABYLON.Mesh|null} */
        this._gridMesh = null;

        /** @type {BABYLON.Mesh|null} */
        this._cursorMarker = null;

        /** @type {Array<BABYLON.Mesh>} */
        this._pointMarkers = [];

        /** @type {Array<{u: number, v: number}>} */
        this.points = [];

        /** @type {Set<Function>} */
        this._listeners = new Set();

        /** @type {boolean} */
        this.active = false;
    }

    /**
     * Aktywuje sketch plane na danej ścianie.
     * @param {string} faceName
     * @param {boolean} animateCamera — czy animować kamerę do widoku prostopadłego
     */
    activate(faceName, animateCamera = true) {
        // Deaktywuj poprzedni
        if (this.active) {
            this.deactivate();
        }

        this.activeFace = faceName;
        this.active = true;
        this.points = [];

        const faceData = this.panelModel.getFace(faceName);

        // Root node dla sketch plane
        this._sketchRoot = new BABYLON.TransformNode('sketchRoot', this.scene);

        // ─── Siatka 2D ──────────────────────────────
        this._buildGrid(faceData);

        // ─── Osie UV ─────────────────────────────────
        this._buildAxes(faceData);

        // ─── Cursor marker ───────────────────────────
        this._buildCursorMarker(faceData);

        // ─── Animacja kamery ─────────────────────────
        if (animateCamera) {
            this._animateCameraToFace(faceName, faceData);
        }

        this._emit('activated', { face: faceName, faceData });
    }

    deactivate() {
        if (!this.active) return;

        // Dispose sketch elements
        if (this._sketchRoot) {
            this._sketchRoot.dispose();
            this._sketchRoot = null;
        }
        if (this._gridMesh) {
            this._gridMesh.dispose();
            this._gridMesh = null;
        }
        if (this._cursorMarker) {
            this._cursorMarker.dispose();
            this._cursorMarker = null;
        }
        for (const m of this._pointMarkers) {
            m.dispose();
        }
        this._pointMarkers = [];

        this.active = false;
        this.activeFace = null;
        this.points = [];

        this._emit('deactivated', {});
    }

    _buildGrid(faceData) {
        const { origin, uAxis, vAxis, normal, width, height } = faceData;
        const lines = [];

        const stepSmall = 10;   // co 10mm
        const stepBig = 50;     // co 50mm grubsza linia

        // Offset od ściany — lekko nad nią
        const offset = 0.3;

        // Linie wzdłuż U (poziome na ścianie)
        for (let v = 0; v <= height; v += stepSmall) {
            const p1 = this._facePoint(origin, uAxis, vAxis, normal, 0, v, offset);
            const p2 = this._facePoint(origin, uAxis, vAxis, normal, width, v, offset);
            lines.push([p1, p2]);
        }

        // Linie wzdłuż V (pionowe na ścianie)
        for (let u = 0; u <= width; u += stepSmall) {
            const p1 = this._facePoint(origin, uAxis, vAxis, normal, u, 0, offset);
            const p2 = this._facePoint(origin, uAxis, vAxis, normal, u, height, offset);
            lines.push([p1, p2]);
        }

        this._gridMesh = BABYLON.MeshBuilder.CreateLineSystem('sketchGrid', {
            lines
        }, this.scene);
        this._gridMesh.color = new BABYLON.Color3(0.4, 0.55, 0.8);
        this._gridMesh.alpha = 0.25;
        this._gridMesh.isPickable = false;
        this._gridMesh.parent = this._sketchRoot;

        // Grubsze linie co 50mm
        const bigLines = [];
        for (let v = 0; v <= height; v += stepBig) {
            const p1 = this._facePoint(origin, uAxis, vAxis, normal, 0, v, offset + 0.1);
            const p2 = this._facePoint(origin, uAxis, vAxis, normal, width, v, offset + 0.1);
            bigLines.push([p1, p2]);
        }
        for (let u = 0; u <= width; u += stepBig) {
            const p1 = this._facePoint(origin, uAxis, vAxis, normal, u, 0, offset + 0.1);
            const p2 = this._facePoint(origin, uAxis, vAxis, normal, u, height, offset + 0.1);
            bigLines.push([p1, p2]);
        }

        const bigGrid = BABYLON.MeshBuilder.CreateLineSystem('sketchGridBig', {
            lines: bigLines
        }, this.scene);
        bigGrid.color = new BABYLON.Color3(0.3, 0.45, 0.75);
        bigGrid.alpha = 0.45;
        bigGrid.isPickable = false;
        bigGrid.parent = this._sketchRoot;
    }

    _buildAxes(faceData) {
        const { origin, uAxis, vAxis, normal, width, height } = faceData;
        const offset = 0.5;
        const axisOvershoot = 20;

        // U axis — czerwona
        const uLine = BABYLON.MeshBuilder.CreateLines('sketchAxisU', {
            points: [
                this._facePoint(origin, uAxis, vAxis, normal, -axisOvershoot, 0, offset),
                this._facePoint(origin, uAxis, vAxis, normal, width + axisOvershoot, 0, offset)
            ]
        }, this.scene);
        uLine.color = new BABYLON.Color3(0.9, 0.2, 0.2);
        uLine.isPickable = false;
        uLine.parent = this._sketchRoot;

        // V axis — zielona
        const vLine = BABYLON.MeshBuilder.CreateLines('sketchAxisV', {
            points: [
                this._facePoint(origin, uAxis, vAxis, normal, 0, -axisOvershoot, offset),
                this._facePoint(origin, uAxis, vAxis, normal, 0, height + axisOvershoot, offset)
            ]
        }, this.scene);
        vLine.color = new BABYLON.Color3(0.2, 0.8, 0.2);
        vLine.isPickable = false;
        vLine.parent = this._sketchRoot;
    }

    _buildCursorMarker(faceData) {
        // Mały krzyżyk jako marker kursora na ścianie
        this._cursorMarker = BABYLON.MeshBuilder.CreatePlane('cursorMarker', {
            size: 8
        }, this.scene);
        const mat = new BABYLON.StandardMaterial('cursorMat', this.scene);
        mat.diffuseColor = new BABYLON.Color3(1, 0.3, 0.1);
        mat.emissiveColor = new BABYLON.Color3(1, 0.3, 0.1);
        mat.alpha = 0.8;
        mat.backFaceCulling = false;
        this._cursorMarker.material = mat;
        this._cursorMarker.isPickable = false;
        this._cursorMarker.isVisible = false;
        this._cursorMarker.parent = this._sketchRoot;
    }

    /**
     * Aktualizuje pozycję kursora na sketch plane.
     * Wywoływane z face-picker hover event.
     */
    updateCursor(worldPoint, uv) {
        if (!this.active || !worldPoint || !this._cursorMarker) return;

        const faceData = this.panelModel.getFace(this.activeFace);
        const offset = 0.6;

        // Snapuj do siatki (opcjonalnie, co 1mm)
        const snappedU = Math.round(uv.u);
        const snappedV = Math.round(uv.v);

        const pos = this._facePoint(
            faceData.origin, faceData.uAxis, faceData.vAxis,
            faceData.normal, snappedU, snappedV, offset
        );
        this._cursorMarker.position = pos;

        // Orientacja — normal ściany
        this._cursorMarker.lookAt(
            pos.add(new BABYLON.Vector3(
                faceData.normal[0],
                faceData.normal[1],
                faceData.normal[2]
            ))
        );

        this._cursorMarker.isVisible = true;
    }

    /**
     * Dodaje punkt na sketch plane (kliknięty przez użytkownika).
     */
    addPoint(uv) {
        if (!this.active) return;

        this.points.push({ u: uv.u, v: uv.v });

        const faceData = this.panelModel.getFace(this.activeFace);
        const offset = 0.8;

        // Marker — mała kula
        const sphere = BABYLON.MeshBuilder.CreateSphere(`sketchPoint_${this.points.length}`, {
            diameter: 6
        }, this.scene);
        const pos = this._facePoint(
            faceData.origin, faceData.uAxis, faceData.vAxis,
            faceData.normal, uv.u, uv.v, offset
        );
        sphere.position = pos;

        const mat = new BABYLON.StandardMaterial(`sketchPointMat_${this.points.length}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.15, 0.5, 1);
        mat.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.6);
        sphere.material = mat;
        sphere.isPickable = false;
        sphere.parent = this._sketchRoot;

        this._pointMarkers.push(sphere);

        this._emit('pointAdded', {
            face: this.activeFace,
            uv,
            pointIndex: this.points.length - 1
        });
    }

    _facePoint(origin, uAxis, vAxis, normal, u, v, normalOffset) {
        return new BABYLON.Vector3(
            origin[0] + uAxis[0] * u + vAxis[0] * v + normal[0] * normalOffset,
            origin[1] + uAxis[1] * u + vAxis[1] * v + normal[1] * normalOffset,
            origin[2] + uAxis[2] * u + vAxis[2] * v + normal[2] * normalOffset
        );
    }

    _animateCameraToFace(faceName, faceData) {
        const center = new BABYLON.Vector3(
            faceData.origin[0] + faceData.uAxis[0] * faceData.width / 2 + faceData.vAxis[0] * faceData.height / 2,
            faceData.origin[1] + faceData.uAxis[1] * faceData.width / 2 + faceData.vAxis[1] * faceData.height / 2,
            faceData.origin[2] + faceData.uAxis[2] * faceData.width / 2 + faceData.vAxis[2] * faceData.height / 2
        );

        // Odległość od ściany
        const maxDim = Math.max(faceData.width, faceData.height);
        const distance = maxDim * 1.5;

        // Kamera — kąty zależne od ściany
        const cameraAngles = {
            front:  { alpha: Math.PI / 2,     beta: Math.PI / 2 },
            back:   { alpha: -Math.PI / 2,    beta: Math.PI / 2 },
            left:   { alpha: Math.PI,         beta: Math.PI / 2 },
            right:  { alpha: 0,               beta: Math.PI / 2 },
            top:    { alpha: Math.PI / 2,     beta: 0.01 },
            bottom: { alpha: Math.PI / 2,     beta: Math.PI - 0.01 }
        };

        const angles = cameraAngles[faceName] || { alpha: Math.PI / 4, beta: Math.PI / 3 };

        this.viewport.animateCameraTo(angles.alpha, angles.beta, distance, center);
    }

    // ─── Events ──────────────────────────────────────

    onSketch(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    _emit(type, data) {
        for (const fn of this._listeners) {
            try { fn(type, data); } catch (e) { console.error('SketchPlane listener error:', e); }
        }
    }

    dispose() {
        this.deactivate();
    }
}
