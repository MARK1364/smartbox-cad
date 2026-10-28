/**
 * A2_bloki / sinks — sink-types.ts
 * Typy domenowe i parametry zlewu (SmartPart Sink montowany na pojedynczej formatce).
 *
 * Jednostki w UI i parametrach konfiguracyjnych: milimetry [mm].
 * Konwersja do jednostek domenowych CAD (nm) następuje na brzegu przez mmToNm / nmToMm.
 */

export const SMARTPART_SINK_TYPE = 'smartpart_sink';

export type SinkEdgeU = 'FACE_X_MINUS' | 'FACE_X_PLUS';
export type SinkEdgeV = 'FACE_Y_MINUS' | 'FACE_Y_PLUS';

export interface SinkParamsMm {
    hardwareId: string;
    szerokosc_mm: number;
    glebokosc_mm: number;
    wysokosc_kolnierza_mm: number;
    margines_komory_mm: number;
    glebokosc_komory_mm: number;
    u_mm: number;
    v_mm: number;
    uEdge?: SinkEdgeU;
    vEdge?: SinkEdgeV;
    face: string;
    colorKolnierzHex: string;
    colorKomoraHex: string;
    cutoutEnabled: boolean;
}

export const DEFAULT_SINK_PARAMS: SinkParamsMm = {
    hardwareId: 'sp:zlew_nakladany',
    szerokosc_mm: 600,
    glebokosc_mm: 500,
    wysokosc_kolnierza_mm: 30,
    margines_komory_mm: 10,
    glebokosc_komory_mm: 200,
    u_mm: 300,
    v_mm: 300,
    uEdge: 'FACE_X_MINUS',
    vEdge: 'FACE_Y_MINUS',
    face: 'FACE_Z_PLUS',
    colorKolnierzHex: '#94a3b8',
    colorKomoraHex: '#64748b',
    cutoutEnabled: true,
};

export interface SinkComputedLayoutMm {
    kolnierzWidthMm: number;
    kolnierzDepthMm: number;
    kolnierzHeightMm: number;
    komoraWidthMm: number;
    komoraDepthMm: number;
    komoraHeightMm: number;
    cutoutUMm: number;
    cutoutVMm: number;
    cutoutWidthMm: number;
    cutoutLengthMm: number;
    uAbsMm: number;
    vAbsMm: number;
}

/**
 * Przelicza pozycję środka zadaną względem wybranej krawędzi referencyjnej (uEdge, vEdge)
 * na współrzędne absolutne UV na formacie (od lewego dolnego rogu [0, 0]).
 */
export function resolveSinkAbsoluteCenter(
    params: SinkParamsMm,
    panelWMm: number,
    panelHMm: number
): { uAbsMm: number; vAbsMm: number } {
    const uEdge = params.uEdge || 'FACE_X_MINUS';
    const vEdge = params.vEdge || 'FACE_Y_MINUS';
    const uAbsMm = uEdge === 'FACE_X_PLUS' ? panelWMm - params.u_mm : params.u_mm;
    const vAbsMm = vEdge === 'FACE_Y_PLUS' ? panelHMm - params.v_mm : params.v_mm;
    return { uAbsMm, vAbsMm };
}

/**
 * Normalizuje parametry wejściowe zlewu i domyślnie centruje na formacie docelowej.
 */
export function normalizeSinkParams(
    raw: Partial<SinkParamsMm> = {},
    panelWMm: number = 800,
    panelHMm: number = 600
): SinkParamsMm {
    const szerokosc_mm = typeof raw.szerokosc_mm === 'number' && Number.isFinite(raw.szerokosc_mm)
        ? Math.max(100, raw.szerokosc_mm)
        : DEFAULT_SINK_PARAMS.szerokosc_mm;
    const glebokosc_mm = typeof raw.glebokosc_mm === 'number' && Number.isFinite(raw.glebokosc_mm)
        ? Math.max(100, raw.glebokosc_mm)
        : DEFAULT_SINK_PARAMS.glebokosc_mm;
    const wysokosc_kolnierza_mm = typeof raw.wysokosc_kolnierza_mm === 'number' && Number.isFinite(raw.wysokosc_kolnierza_mm)
        ? Math.max(0, raw.wysokosc_kolnierza_mm)
        : DEFAULT_SINK_PARAMS.wysokosc_kolnierza_mm;
    const margines_komory_mm = typeof raw.margines_komory_mm === 'number' && Number.isFinite(raw.margines_komory_mm)
        ? Math.max(0, raw.margines_komory_mm)
        : DEFAULT_SINK_PARAMS.margines_komory_mm;
    const glebokosc_komory_mm = typeof raw.glebokosc_komory_mm === 'number' && Number.isFinite(raw.glebokosc_komory_mm)
        ? Math.max(10, raw.glebokosc_komory_mm)
        : DEFAULT_SINK_PARAMS.glebokosc_komory_mm;

    const defaultUMm = panelWMm / 2;
    const defaultVMm = panelHMm / 2;

    const u_mm = typeof raw.u_mm === 'number' && Number.isFinite(raw.u_mm) ? raw.u_mm : defaultUMm;
    const v_mm = typeof raw.v_mm === 'number' && Number.isFinite(raw.v_mm) ? raw.v_mm : defaultVMm;

    return {
        hardwareId: raw.hardwareId || DEFAULT_SINK_PARAMS.hardwareId,
        szerokosc_mm,
        glebokosc_mm,
        wysokosc_kolnierza_mm,
        margines_komory_mm,
        glebokosc_komory_mm,
        u_mm,
        v_mm,
        uEdge: raw.uEdge || 'FACE_X_MINUS',
        vEdge: raw.vEdge || 'FACE_Y_MINUS',
        face: raw.face || DEFAULT_SINK_PARAMS.face,
        colorKolnierzHex: raw.colorKolnierzHex || DEFAULT_SINK_PARAMS.colorKolnierzHex,
        colorKomoraHex: raw.colorKomoraHex || DEFAULT_SINK_PARAMS.colorKomoraHex,
        cutoutEnabled: raw.cutoutEnabled ?? DEFAULT_SINK_PARAMS.cutoutEnabled,
    };
}

/**
 * Wylicza geometrię i punkt bazowy wycięcia w układzie 2D lica formatki (Functional Core).
 */
export function computeSinkLayout(
    params: SinkParamsMm,
    panelWMm: number = 800,
    panelHMm: number = 600
): SinkComputedLayoutMm {
    const komoraWidthMm = Math.max(20, params.szerokosc_mm - 2 * params.margines_komory_mm);
    const komoraDepthMm = Math.max(20, params.glebokosc_mm - 2 * params.margines_komory_mm);

    const { uAbsMm, vAbsMm } = resolveSinkAbsoluteCenter(params, panelWMm, panelHMm);

    const cutoutUMm = uAbsMm - komoraWidthMm / 2;
    const cutoutVMm = vAbsMm - komoraDepthMm / 2;

    return {
        kolnierzWidthMm: params.szerokosc_mm,
        kolnierzDepthMm: params.glebokosc_mm,
        kolnierzHeightMm: params.wysokosc_kolnierza_mm,
        komoraWidthMm,
        komoraDepthMm,
        komoraHeightMm: params.glebokosc_komory_mm,
        cutoutUMm,
        cutoutVMm,
        cutoutWidthMm: komoraWidthMm,
        cutoutLengthMm: komoraDepthMm,
        uAbsMm,
        vAbsMm,
    };
}

/**
 * Przelicza pozycję UV formatki (od lewego dolnego narożnika [0, 0])
 * na układ lokalny panelu CAD (wycentrowany w [0, 0] formatki).
 */
export function computeSinkLocalCoords(
    u_mm: number,
    v_mm: number,
    panelWMm: number,
    panelHMm: number,
    face: string = 'FACE_Z_PLUS'
): { localX: number; localY: number } {
    const isMinus = String(face).includes('MINUS');
    const localX = isMinus ? (panelWMm / 2 - u_mm) : (u_mm - panelWMm / 2);
    const localY = v_mm - panelHMm / 2;
    return { localX, localY };
}

/**
 * Przelicza pozycję w lokalnym układzie formatki CAD (wycentrowanym w [0, 0])
 * na koordynaty UV ściany formatki (od lewego dolnego narożnika [0, 0]).
 */
export function computeSinkUvFromLocalCoords(
    localX: number,
    localY: number,
    panelWMm: number,
    panelHMm: number,
    face: string = 'FACE_Z_PLUS'
): { u_mm: number; v_mm: number } {
    const isMinus = String(face).includes('MINUS');
    const u_mm = isMinus ? (panelWMm / 2 - localX) : (localX + panelWMm / 2);
    const v_mm = localY + panelHMm / 2;
    return { u_mm, v_mm };
}
