/**
 * PMI Screen Scale — stała grubość w pikselach niezależnie od zoomu (jak pro CAD).
 *
 * Problem: overlaye rysowane jako geometria 3D o stałej średnicy w [mm]
 * (Tube/Cylinder/Sphere) z definicji zmieniają rozmiar na ekranie:
 * daleko -> sub-piksel (ledwo widać), blisko -> kilkadziesiąt px (kloc).
 *
 * Pro CAD trzyma highlight na stałe ~2-5 px. Osiągamy to przeliczając:
 *   pxPerMM = renderH_px / visibleH_mm
 *   worldMM = desiredPx / pxPerMM
 * i dopasowując skalę mesha co klatkę (onBeforeRender), a nie tylko w chwili utworzenia.
 */

export interface PixelsPerMMParams {
    renderH: number;
    /** Tryb kamery: 0 = perspektywa, 1 = ortho. */
    cameraMode: number;
    /** Widoczna wysokość w ortho [mm]. */
    orthoH: number;
    /** Odległość kamery od punktu [mm] (tylko perspektywa). */
    distanceToCamera?: number;
    /** FOV kamery [rad] (tylko perspektywa). */
    cameraFov?: number;
}

/** Czysta matematyka (bez Babylona) — testowalna jednostkowo. */
export function pixelsPerMM(params: PixelsPerMMParams): number {
    const { renderH, cameraMode, orthoH, distanceToCamera, cameraFov } = params;
    if (renderH <= 0) return 0;
    if (cameraMode === 1) {
        if (orthoH <= 1e-4) return 0;
        return renderH / orthoH;
    }
    if (!distanceToCamera || distanceToCamera <= 1e-4) return 0;
    const fov = cameraFov && cameraFov > 1e-4 ? cameraFov : 0.8;
    const visibleH = 2 * distanceToCamera * Math.tan(fov / 2);
    if (visibleH <= 1e-4) return 0;
    return renderH / visibleH;
}

/** Ile [mm] w świecie odpowiada żądanej grubości w [px] przy danym pxPerMM. */
export function worldSizeForPx(desiredPx: number, pxPerMM: number, fallbackMM: number): number {
    if (!Number.isFinite(desiredPx) || desiredPx <= 0) return fallbackMM;
    if (!Number.isFinite(pxPerMM) || pxPerMM <= 1e-6) return fallbackMM;
    const v = desiredPx / pxPerMM;
    if (!Number.isFinite(v) || v <= 0) return fallbackMM;
    return v;
}

/**
 * Grubość linii pomiaru: szanuje suwak użytkownika [mm], ale nigdy nie spada
 * poniżej minPx ani nie wybucha powyżej maxPx na ekranie (zachowanie pro CAD).
 */
export function clampWorldDiameter(desiredMM: number, pxPerMM: number, minPx: number, maxPx: number): number {
    const safe = Math.max(desiredMM, 0.2);
    if (!Number.isFinite(pxPerMM) || pxPerMM <= 1e-6) return safe;
    const minMM = minPx / pxPerMM;
    const maxMM = maxPx / pxPerMM;
    return Math.min(Math.max(safe, minMM), maxMM);
}

// ============================================================================
// Warstwa Babylon (scene: any żeby nie ciągnąć typów silnika do testów)
// ============================================================================

/** Docelowe grubości na ekranie — jak pro CAD. */
export const HIGHLIGHT_DIAMETER_PX = 4.5;
export const VERTEX_DIAMETER_PX = 10;
export const MEASURE_MIN_PX = 1.25;
export const MEASURE_MAX_PX = 3.5;

function cameraParamsAt(scene: any, worldPos: { x: number; y: number; z: number }): PixelsPerMMParams | null {
    try {
        const camera = scene?.activeCamera;
        const engine = scene?.getEngine?.();
        if (!camera || !engine) return null;
        const renderH = engine.getRenderHeight ? engine.getRenderHeight() : 0;
        if (!renderH || renderH <= 0) return null;
        // Babylon: Camera.ORTHOGRAPHIC_CAMERA === 1, PERSPECTIVE === 0.
        const isOrtho = camera.mode === 1;
        if (isOrtho) {
            let orthoH = Math.abs((camera.orthoTop ?? 0) - (camera.orthoBottom ?? 0));
            if (!(orthoH > 1e-4) && camera.radius) orthoH = camera.radius * 1.3;
            return { renderH, cameraMode: 1, orthoH };
        }
        const camPos = camera.globalPosition || camera.position;
        if (!camPos) return { renderH, cameraMode: 0, orthoH: 0 };
        const dist = Math.hypot(camPos.x - worldPos.x, camPos.y - worldPos.y, camPos.z - worldPos.z);
        return { renderH, cameraMode: 0, orthoH: 0, distanceToCamera: dist, cameraFov: camera.fov };
    } catch {
        return null;
    }
}

/** Ile pikseli na 1 mm w otoczeniu punktu. Zwraca 0 gdy nie da się policzyć. */
export function pixelsPerMMAtScene(scene: any, worldPos: { x: number; y: number; z: number }): number {
    const p = cameraParamsAt(scene, worldPos);
    if (!p) return 0;
    return pixelsPerMM(p);
}

/** Średnica świata [mm] dająca stałe desiredPx na ekranie w otoczeniu punktu. */
export function worldDiameterForPxAt(
    scene: any,
    worldPos: { x: number; y: number; z: number },
    desiredPx: number,
    fallbackMM: number,
): number {
    return worldSizeForPx(desiredPx, pixelsPerMMAtScene(scene, worldPos), fallbackMM);
}

/** Średnica linii pomiaru z clampem px (suwak mm + min/max px). */
export function measureDiameterAt(
    scene: any,
    worldPos: { x: number; y: number; z: number },
    desiredMM: number,
    minPx = MEASURE_MIN_PX,
    maxPx = MEASURE_MAX_PX,
): number {
    return clampWorldDiameter(desiredMM, pixelsPerMMAtScene(scene, worldPos), minPx, maxPx);
}

/**
 * Podpina mesh pod stałą grubość ekranową. Co klatkę (przed rysowaniem mesha)
 * przelicza żądaną średnicę świata i dopasowuje skalę:
 * - cylinder (oś długości = lokalne Y): skalowane tylko X/Z (grubość, nie długość),
 * - sfera/punkt: skalowanie jednorodne.
 *
 * @param bakedDiameter średnica zaszyta w geometrii w chwili utworzenia [mm]
 * @param getDesiredDiameterNow ile [mm] potrzeba TERAZ (liczone z aktualnej kamery)
 */
export function attachScreenConstantScale(
    mesh: any,
    bakedDiameter: number,
    getDesiredDiameterNow: () => number,
    radialOnly: boolean,
): void {
    if (!mesh?.onBeforeRenderObservable?.add) return;
    const safeBaked = bakedDiameter > 1e-6 ? bakedDiameter : 1;
    mesh.onBeforeRenderObservable.add(() => {
        try {
            if (!mesh || mesh.isDisposed?.()) return;
            const desired = getDesiredDiameterNow();
            if (!Number.isFinite(desired) || desired <= 0) return;
            const s = desired / safeBaked;
            if (!Number.isFinite(s) || s <= 0) return;
            // Ignoruj mikro-zmiany żeby nie brudzić macierzy co klatkę.
            if (radialOnly) {
                const cur = mesh.scaling?.x ?? 1;
                if (Math.abs(cur - s) / Math.max(cur, 1e-6) < 0.02) return;
                mesh.scaling.x = s;
                mesh.scaling.z = s;
            } else {
                const cur = mesh.scaling?.x ?? 1;
                if (Math.abs(cur - s) / Math.max(cur, 1e-6) < 0.02) return;
                // Wprost po osiach — bez .set(), którego brak w części wersji Babylona
                // (z ?. byłby to cichy no-op i kulka stawałaby w miejscu).
                mesh.scaling.x = s;
                mesh.scaling.y = s;
                mesh.scaling.z = s;
            }
        } catch {
            /* brak kamery w tle — ignoruj */
        }
    });
}
