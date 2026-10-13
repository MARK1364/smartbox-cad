/**
 * A5_smartparts / handles — handle-layout.ts
 * Czysty rdzeń obliczeniowy (Functional Core) układu geometrii uchwytu meblowego.
 *
 * Brak zależności od Babylon.js, DOM, okna przeglądarki ani ContextManager.
 * Oblicza środek (X, Y), pozycje otworów montażowych, układ UV oraz skrajny bounding-box w mm.
 */

import {
    type HandleParamsMm,
    type HandlePlacementPreset,
    type HandleOrientation,
    type EdgeU,
    type EdgeV,
    computeHandleOverhang,
} from './handle-types.js';

export interface HandleComputedLayoutMm {
    /** Środek uchwytu na formacie (X, Y) [mm] */
    center: { x: number; y: number };
    /** Pozycje otworów montażowych pod śruby C-C [mm] */
    holes: Array<{ x: number; y: number }>;
    /** Wypust gabarytu poza otwory [mm] z każdej strony */
    overhangMm: number;
    /** Skrajny obrys uchwytu [mm] (AABB na płaszczyźnie formatki) */
    bbox: { minX: number; maxX: number; minY: number; maxY: number };
    /** Grubość i głębokość [mm] */
    depthMm: number;
    thicknessMm: number;
    orientation: HandleOrientation;
}

// ─────────────────────────────────────────────────────────────────────────────
// UV ↔ CENTER — semantyka:
//   Oś główna (wzdłuż otworów): uMm/vMm = odległość od krawędzi do BLIŻSZEGO OTWORU
//   Oś poprzeczna            : uMm/vMm = odległość od krawędzi do środka uchwytu
//
//   Dla uchwytów jednootworowych (gałki, holeDistanceMm = 0)
//   obie osie mierzą do punktu otworu (= środek).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oblicza pozycję środka (X, Y) uchwytu z koordynatów UV i krawędzi odniesienia.
 *
 * Semantyka UV:
 *   HORIZONTAL → uMm = odległość od uEdge do bliższego otworu (X); vMm = odległość od vEdge do środka (Y)
 *   VERTICAL   → vMm = odległość od vEdge do bliższego otworu (Y); uMm = odległość od uEdge do środka (X)
 */
export function computeHandleCenterFromUV(
    uMm: number,
    vMm: number,
    uEdge: EdgeU,
    vEdge: EdgeV,
    panelW: number,
    panelH: number,
    orientation: 'HORIZONTAL' | 'VERTICAL' = 'HORIZONTAL',
    holeDistanceMm: number = 0
): { x: number; y: number } {
    const halfW = panelW / 2;
    const halfH = panelH / 2;
    const halfHole = holeDistanceMm / 2;

    // Oś X: oś główna dla HORIZONTAL
    const uIsMain = orientation === 'HORIZONTAL';
    const refHoleX = uEdge === 'FACE_X_MINUS' ? -halfW + uMm : halfW - uMm;
    const x = uIsMain
        ? (uEdge === 'FACE_X_MINUS' ? refHoleX + halfHole : refHoleX - halfHole)
        : refHoleX; // oś poprzeczna → środek == refHoleX

    // Oś Y: oś główna dla VERTICAL
    const vIsMain = orientation === 'VERTICAL';
    const refHoleY = vEdge === 'FACE_Y_MINUS' ? -halfH + vMm : halfH - vMm;
    const y = vIsMain
        ? (vEdge === 'FACE_Y_MINUS' ? refHoleY + halfHole : refHoleY - halfHole)
        : refHoleY;

    return { x, y };
}

/**
 * Oblicza współrzędne UV z pozycji środka (X, Y) i krawędzi odniesienia.
 *
 * Wynik: uMm/vMm = odległość od krawędzi do BLIŻSZEGO OTWORU na osi głównej,
 *        lub do środka na osi poprzecznej.
 */
export function computeUVFromCenter(
    x: number,
    y: number,
    uEdge: EdgeU,
    vEdge: EdgeV,
    panelW: number,
    panelH: number,
    orientation: 'HORIZONTAL' | 'VERTICAL' = 'HORIZONTAL',
    holeDistanceMm: number = 0
): { uMm: number; vMm: number } {
    const halfW = panelW / 2;
    const halfH = panelH / 2;
    const halfHole = holeDistanceMm / 2;

    // Oś X
    const uIsMain = orientation === 'HORIZONTAL';
    // Pozycja bliższego otworu X:
    const refHoleX = uIsMain
        ? (uEdge === 'FACE_X_MINUS' ? x - halfHole : x + halfHole)
        : x; // oś poprzeczna: otwór == środek
    const uMm = uEdge === 'FACE_X_MINUS' ? refHoleX + halfW : halfW - refHoleX;

    // Oś Y
    const vIsMain = orientation === 'VERTICAL';
    const refHoleY = vIsMain
        ? (vEdge === 'FACE_Y_MINUS' ? y - halfHole : y + halfHole)
        : y;
    const vMm = vEdge === 'FACE_Y_MINUS' ? refHoleY + halfH : halfH - refHoleY;

    return {
        uMm: Math.max(0, Math.round(uMm * 10) / 10),
        vMm: Math.max(0, Math.round(vMm * 10) / 10),
    };
}

/**
 * Oblicza pozycję BLIŻSZEGO OTWORU montażowego (punkt zakotwienia) w układzie formatki.
 * Używane przez gizmo do rysowania linii wymiarowej końcowej przy otworze.
 */
export function computeRefHolePosition(
    uMm: number,
    vMm: number,
    uEdge: EdgeU,
    vEdge: EdgeV,
    panelW: number,
    panelH: number
): { x: number; y: number } {
    const halfW = panelW / 2;
    const halfH = panelH / 2;
    return {
        x: uEdge === 'FACE_X_MINUS' ? -halfW + uMm : halfW - uMm,
        y: vEdge === 'FACE_Y_MINUS' ? -halfH + vMm : halfH - vMm,
    };
}

/**
 * Przelicza odległość przy zmianie krawędzi odniesienia (np. z Lewej na Prawą),
 * zachowując niezmienną pozycję fizyczną uchwytu.
 *
 * @param holeOffsetMm  dla osi głównej podaj holeDistanceMm; dla osi poprzecznej 0
 */
export function rebindHandleEdge(
    currentEdge: EdgeU | EdgeV,
    newEdge: EdgeU | EdgeV,
    currentDistMm: number,
    spanMm: number,
    holeOffsetMm: number = 0
): number {
    if (currentEdge === newEdge) return currentDistMm;
    // Nowa odl. = span - stara_odl. - rozstaw_otworów (bo zmieniliśmy odniesienie z jednego otworu na drugi)
    return Math.max(0, Math.round((spanMm - currentDistMm - holeOffsetMm) * 10) / 10);
}

/**
 * Oblicza pozycję środka uchwytu (X, Y) na powierzchni formatki w oparciu o preset i odsunięcia.
 * Używane TYLKO do bootstrapu UV przy wstawianiu (gdy jeszcze nie ma uMm/vMm).
 * Po ustawieniu UV geometria idzie wyłącznie z dystansu — bez drugiego mechanizmu.
 */
export function computeHandleCenterMm(
    preset: HandlePlacementPreset,
    panelW: number,
    panelH: number,
    offsetXMm: number,
    offsetYMm: number,
    orientation: HandleOrientation
): { x: number; y: number } {
    const halfW = panelW / 2;
    const halfH = panelH / 2;

    switch (preset) {
        case 'TOP_CENTER':
            return { x: offsetXMm, y: halfH - offsetYMm };

        case 'BOTTOM_CENTER':
            return { x: offsetXMm, y: -halfH + offsetYMm };

        case 'CENTER':
        case 'CENTER_HORIZONTAL':
            return { x: 0, y: offsetYMm };

        case 'CENTER_VERTICAL':
            return { x: offsetXMm, y: 0 };

        case 'TOP_LEFT': {
            const defOffX = offsetXMm !== 0 ? offsetXMm : 40;
            const defOffY = offsetYMm !== 0 ? offsetYMm : (orientation === 'VERTICAL' ? 100 : 40);
            return { x: -halfW + defOffX, y: halfH - defOffY };
        }

        case 'TOP_RIGHT': {
            const defOffX = offsetXMm !== 0 ? offsetXMm : 40;
            const defOffY = offsetYMm !== 0 ? offsetYMm : (orientation === 'VERTICAL' ? 100 : 40);
            return { x: halfW - defOffX, y: halfH - defOffY };
        }

        case 'BOTTOM_LEFT': {
            const defOffX = offsetXMm !== 0 ? offsetXMm : 40;
            const defOffY = offsetYMm !== 0 ? offsetYMm : (orientation === 'VERTICAL' ? 100 : 40);
            return { x: -halfW + defOffX, y: -halfH + defOffY };
        }

        case 'BOTTOM_RIGHT': {
            const defOffX = offsetXMm !== 0 ? offsetXMm : 40;
            const defOffY = offsetYMm !== 0 ? offsetYMm : (orientation === 'VERTICAL' ? 100 : 40);
            return { x: halfW - defOffX, y: -halfH + defOffY };
        }

        case 'CUSTOM':
        default:
            return { x: offsetXMm, y: offsetYMm };
    }
}

/**
 * SSOT pozycji uchwytu = uMm/vMm (+ krawędzie).
 * Jeśli UV brak — jednorazowo wylicza z presetu startowego i zapisuje do parametrów.
 */
export function ensureHandleUvMm(
    params: HandleParamsMm,
    panelWMm: number,
    panelHMm: number,
): HandleParamsMm {
    if (typeof params.uMm === 'number' && typeof params.vMm === 'number') {
        return params;
    }

    const initialCenter = computeHandleCenterMm(
        params.placementPreset,
        panelWMm,
        panelHMm,
        params.offsetEdgeXMm,
        params.offsetEdgeYMm,
        params.orientation,
    );
    const uEdge: EdgeU = params.uEdge || (initialCenter.x >= 0 ? 'FACE_X_PLUS' : 'FACE_X_MINUS');
    const vEdge: EdgeV = params.vEdge || (initialCenter.y >= 0 ? 'FACE_Y_PLUS' : 'FACE_Y_MINUS');
    const uv = computeUVFromCenter(
        initialCenter.x,
        initialCenter.y,
        uEdge,
        vEdge,
        panelWMm,
        panelHMm,
        params.orientation,
        params.holeDistanceMm,
    );

    return {
        ...params,
        uEdge,
        vEdge,
        uMm: uv.uMm,
        vMm: uv.vMm,
    };
}

/**
 * Oblicza pełny układ montażowy uchwytu: środek, osie otworów oraz skrajny obrys.
 * Pozycja zawsze z UV (jedna ścieżka — bez osobnego centrowania przez preset).
 */
export function computeHandleLayout(
    params: HandleParamsMm,
    panelWMm: number,
    panelHMm: number
): HandleComputedLayoutMm {
    const p = ensureHandleUvMm(params, panelWMm, panelHMm);
    const uEdge = p.uEdge || 'FACE_X_MINUS';
    const vEdge = p.vEdge || 'FACE_Y_PLUS';
    const center = computeHandleCenterFromUV(
        p.uMm!,
        p.vMm!,
        uEdge,
        vEdge,
        panelWMm,
        panelHMm,
        p.orientation,
        p.holeDistanceMm,
    );

    const overhangMm = computeHandleOverhang(p);
    const halfLen = p.totalLengthMm / 2;
    const halfHoleDist = p.holeDistanceMm / 2;
    const halfThick = p.thicknessMm / 2;

    const holes: Array<{ x: number; y: number }> = [];

    let bbox: { minX: number; maxX: number; minY: number; maxY: number };

    if (p.orientation === 'HORIZONTAL') {
        if (p.holeDistanceMm > 0) {
            holes.push({ x: center.x - halfHoleDist, y: center.y });
            holes.push({ x: center.x + halfHoleDist, y: center.y });
        } else {
            holes.push({ x: center.x, y: center.y });
        }
        bbox = {
            minX: center.x - halfLen,
            maxX: center.x + halfLen,
            minY: center.y - halfThick,
            maxY: center.y + halfThick,
        };
    } else {
        if (p.holeDistanceMm > 0) {
            holes.push({ x: center.x, y: center.y - halfHoleDist });
            holes.push({ x: center.x, y: center.y + halfHoleDist });
        } else {
            holes.push({ x: center.x, y: center.y });
        }
        bbox = {
            minX: center.x - halfThick,
            maxX: center.x + halfThick,
            minY: center.y - halfLen,
            maxY: center.y + halfLen,
        };
    }

    return {
        center,
        holes,
        overhangMm,
        bbox,
        depthMm: p.depthMm,
        thicknessMm: p.thicknessMm,
        orientation: p.orientation,
    };
}
