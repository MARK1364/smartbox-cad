/**
 * Zbatchowany obrys B-rep formatki (jeden GreasedLine na formatkę).
 *
 * Kontrakt:
 *  - widoczny obrys = jeden GreasedLine o stałej szerokości ekranowej (sizeAttenuation: true w Babylon.js, standard CAD 1px);
 *  - linie `edge_*` (CreateLines) służą jako niewidoczne cele pickingu (`visibility = 0`,
 *    `metadata.pickOnly = true`) z pełnymi metadanymi (edgeKey, alias, brepPoints, featureId);
 *  - zaznaczona krawędź jest odsłaniana (`visibility = 1`) w kolorze zaznaczenia;
 *  - EdgesRenderer wyłączony na ścianach i cechach, które obrys B-rep pokrywa.
 */

declare const BABYLON: any;

/** Stała grubość ekranowa obrysu w pikselach (standard CAD, sizeAttenuation: true) — normalnie / zaznaczona. */
export const EDGE_BATCH_WIDTH = 1.35;
export const EDGE_BATCH_WIDTH_SELECTED = 2.4;

export function hasGreasedLineSupport(): boolean {
    return typeof BABYLON !== 'undefined' && typeof BABYLON.CreateGreasedLine === 'function';
}

/**
 * Buduje jeden GreasedLine ze wszystkich odcinków obrysu formatki (wszystkie 12 krawędzi + cechy).
 */
export function buildPanelEdgeBatch(
    scene: any,
    name: string,
    lines: number[][][],
    color: any,
    width: number,
    zOffset = -0.2,
): any | null {
    if (!hasGreasedLineSupport()) return null;
    const polylines = lines
        .filter(pts => Array.isArray(pts) && pts.length >= 2)
        .map(pts => pts.map(p => new BABYLON.Vector3(p[0], p[1], p[2])));
    if (polylines.length === 0) return null;

    const mesh = BABYLON.CreateGreasedLine(
        name,
        { points: polylines },
        {
            color,
            width,
            sizeAttenuation: true,
            ...(BABYLON.GreasedLineMeshColorMode?.COLOR_MODE_SET !== undefined
                ? { colorMode: BABYLON.GreasedLineMeshColorMode.COLOR_MODE_SET }
                : {}),
        },
        scene,
    );
    mesh.isPickable = false;
    mesh.metadata = { ...(mesh.metadata || {}), type: 'edge-batch' };
    if (mesh.material) {
        mesh.material.disableLighting = true;
        mesh.material.zOffset = zOffset;
        mesh.material.backFaceCulling = false;
    }
    return mesh;
}

export function setPanelEdgeBatchStyle(mesh: any, color: any, width: number, zOffset: number): void {
    if (!mesh || mesh.isDisposed?.()) return;
    if (mesh.greasedLineMaterial) {
        mesh.greasedLineMaterial.color = color;
        mesh.greasedLineMaterial.width = width;
    }
    if (mesh.material) mesh.material.zOffset = zOffset;
}

/**
 * Cel pickingu jest niewidoczny; zaznaczenie odsłania go,
 * żeby wybrana krawędź była widoczna. Dla zwykłych krawędzi — no-op.
 */
export function setPickOnlyEdgeRevealed(mesh: any, revealed: boolean): void {
    if (!mesh || mesh.isDisposed?.() || !mesh.metadata?.pickOnly) return;
    mesh.visibility = revealed ? 1 : 0;
}
