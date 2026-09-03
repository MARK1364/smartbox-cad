/**
 * PMI Resolve — TypeScript
 *
 * Zamienia trwałą adnotację (`PMIAnnotation`) na aktualny stan w przestrzeni
 * świata i dalej na payload renderujący.
 *
 * To jedyne miejsce, w którym wartość wymiaru jest wyznaczana. Renderer,
 * narzędzie edycji i panel korzystają z tego samego wyniku, więc etykieta nie
 * może rozjechać się z narysowaną geometrią — czym w Blenderze zajmował się
 * `recalc_distance_and_text_from_world()` wołany z handlera depsgraph.
 */

import { Vec3, v3, v3Len } from './dimension-solver';
import { BridgeRenderData, getRenderData, resolveMeasureAxis } from './pmi-bridge';
import { PMIAnnotation, PMIMeasurement, PMIStore } from './pmi-data';
import {
    PMIAnchorRef,
    directionToLocal,
    resolveAnchorMatrix,
    resolveAnchorWorld,
    resolveDirectionWorld,
} from './pmi-id-bridge';

export interface ResolvedAnnotation {
    anchor1World: Vec3;
    anchor2World: Vec3;
    offsetWorld: Vec3;
    matrixWorld: number[] | null;
    edgeDir1World: Vec3 | null;
    edgeDir2World: Vec3 | null;
    faceNormal1World: Vec3 | null;
    faceNormal2World: Vec3 | null;
}

/**
 * Przelicza wektor odsunięcia zapisany w adnotacji na przestrzeń świata.
 */
export function resolveOffsetWorld(scene: any, ann: PMIAnnotation): Vec3 {
    if (ann.offsetSpace === 'WORLD') return ann.offset;
    return resolveDirectionWorld(scene, ann.anchor1, ann.offset) ?? ann.offset;
}

/**
 * Zapisuje światowy wektor odsunięcia w układzie, w którym adnotacja go trzyma.
 * Kotwica przypięta do węzła dostaje offset lokalny, żeby podążał za obrotem.
 */
export function storeOffsetFromWorld(
    scene: any,
    anchor: PMIAnchorRef,
    offsetWorld: Vec3,
): { offset: Vec3; offsetSpace: 'LOCAL' | 'WORLD' } {
    if (!anchor?.nodeId) {
        return { offset: offsetWorld, offsetSpace: 'WORLD' };
    }
    const local = directionToLocal(scene, anchor, offsetWorld);
    return local
        ? { offset: local, offsetSpace: 'LOCAL' }
        : { offset: offsetWorld, offsetSpace: 'WORLD' };
}

/**
 * Rozwiązuje wszystkie odniesienia adnotacji do bieżącego stanu sceny.
 * Zwraca `null`, gdy kotwice zdegenerowały się do jednego punktu.
 */
export function resolveAnnotation(scene: any, ann: PMIAnnotation): ResolvedAnnotation | null {
    const anchor1World = resolveAnchorWorld(scene, ann.anchor1);
    const anchor2World = resolveAnchorWorld(scene, ann.anchor2);
    if (!anchor1World || !anchor2World) return null;

    const delta = v3(
        anchor2World.x - anchor1World.x,
        anchor2World.y - anchor1World.y,
        anchor2World.z - anchor1World.z,
    );
    if (v3Len(delta) <= 1e-6) return null;

    return {
        anchor1World,
        anchor2World,
        offsetWorld: resolveOffsetWorld(scene, ann),
        matrixWorld: resolveAnchorMatrix(scene, ann.anchor1),
        edgeDir1World: resolveDirectionWorld(scene, ann.anchor1, ann.edgeDir1Local),
        edgeDir2World: resolveDirectionWorld(scene, ann.anchor2, ann.edgeDir2Local),
        faceNormal1World: resolveDirectionWorld(scene, ann.anchor1, ann.faceNormal1Local),
        faceNormal2World: resolveDirectionWorld(scene, ann.anchor2, ann.faceNormal2Local),
    };
}

/**
 * Pełny przebieg: rozwiąż kotwice → zmierz → odśwież etykietę → zbuduj geometrię.
 *
 * @param offsetWorldOverride Podgląd na żywo podczas przeciągania offsetu; nie
 *                            modyfikuje zapisanego stanu adnotacji.
 */
export function buildAnnotationRenderData(
    scene: any,
    ann: PMIAnnotation,
    store: PMIStore,
    offsetWorldOverride?: Vec3 | null,
): BridgeRenderData | null {
    const resolved = resolveAnnotation(scene, ann);
    if (!resolved) return null;

    const offsetWorld = offsetWorldOverride ?? resolved.offsetWorld;

    const measure = resolveMeasureAxis({
        axisSpace: ann.axisSpace,
        matrixWorld: resolved.matrixWorld,
        measureAxisKey: ann.measureAxisKey,
        anchor1World: resolved.anchor1World,
        anchor2World: resolved.anchor2World,
        faceNormal1World: resolved.faceNormal1World,
        faceNormal2World: resolved.faceNormal2World,
    });
    if (!measure) return null;

    store.applyMeasuredValue(ann, measure.lengthMM, measure.measureAxisKey);

    return getRenderData({
        axisSpace: ann.axisSpace,
        matrixWorld: resolved.matrixWorld,
        measureAxisKey: ann.measureAxisKey,
        offsetAxisKey: ann.offsetAxisKey,
        offsetWorld,
        anchor1World: resolved.anchor1World,
        anchor2World: resolved.anchor2World,
        edgeDir1World: resolved.edgeDir1World,
        edgeDir2World: resolved.edgeDir2World,
        faceNormal1World: resolved.faceNormal1World,
        faceNormal2World: resolved.faceNormal2World,
        worldThickness: store.lineWidthMM,
        fontSizeWorld: store.textSizeMM,
        labelText: ann.text,
    });
}

// ============================================================================
// MEASUREMENTS (miarka)
// ============================================================================

export interface MeasureRenderData {
    path: Vec3[];
    labelText: string;
    distanceMM: number;
}

export interface ResolvedPMIEntry<T> {
    id: string;
    visible: boolean;
    selected: boolean;
    renderData: T | null;
}

export interface PMIResolvedFrame {
    annotations: ResolvedPMIEntry<BridgeRenderData>[];
    measurements: ResolvedPMIEntry<MeasureRenderData>[];
    derivedChanged: boolean;
}

/**
 * Rozwiązuje kotwice miarki, aktualizuje wartości pochodne w store i zwraca
 * gotowy payload do renderera.
 */
export function buildMeasureRenderData(
    scene: any,
    item: PMIMeasurement,
    store: PMIStore,
): MeasureRenderData | null {
    const p1 = resolveAnchorWorld(scene, item.anchor1);
    const p2 = resolveAnchorWorld(scene, item.anchor2);
    const via = item.viaAnchor ? resolveAnchorWorld(scene, item.viaAnchor) : null;
    if (!p1 || !p2) return null;

    const path = via ? [p1, via, p2] : [p1, p2];
    store.applyMeasurementValue(item, p1, p2, via);

    return {
        path,
        labelText: item.text,
        distanceMM: item.distanceMM,
    };
}

/**
 * Pełny przebieg resolve dla wymiarów i miarek przed jednym renderem.
 * Renderer korzysta wyłącznie z tego wyniku — nie rozwiązuje kotwic sam.
 */
export function resolvePMIForRender(scene: any, store: PMIStore): PMIResolvedFrame {
    let derivedChanged = false;

    const annotations = store.annotations.map(ann => {
        if (!ann.visible) {
            return { id: ann.id, visible: false, selected: ann.selected, renderData: null };
        }
        const prevText = ann.text;
        const renderData = buildAnnotationRenderData(scene, ann, store);
        if (ann.text !== prevText) derivedChanged = true;
        return { id: ann.id, visible: true, selected: ann.selected, renderData };
    });

    const measurements = store.measurements.map(item => {
        if (!item.visible) {
            return { id: item.id, visible: false, selected: item.selected, renderData: null };
        }
        const prev = { distanceMM: item.distanceMM, text: item.text };
        const renderData = buildMeasureRenderData(scene, item, store);
        if (renderData && (item.distanceMM !== prev.distanceMM || item.text !== prev.text)) {
            derivedChanged = true;
        }
        return { id: item.id, visible: true, selected: item.selected, renderData };
    });

    return { annotations, measurements, derivedChanged };
}
