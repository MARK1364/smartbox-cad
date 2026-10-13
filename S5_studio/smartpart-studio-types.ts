/**
 * A5_smartparts / studio — smartpart-studio-types.ts
 * Czysta geometria SmartParts (niezależna od producentów).
 *
 * Model:
 * 1. Kontener Główny SmartPart (objętość montażowa szukająca ścian korpusu)
 * 2. Mały kontener part (bryła właściwego okucia wewnątrz kontenera)
 * 3. Dwa typy cięć:
 *    - Otwory (walce / cylindry)
 *    - Rewizje (sześciany / prostopadłościany)
 *
 * Zasada cięcia: Tyle, ile walec lub sześcian wystaje poza obrys Kontenera Głównego,
 * dokładnie tyle materiału zostanie wycięte w korpusie mebla.
 *
 * Jednostki: milimetry (mm), units: 'mm'.
 */

export type CutType = 'HOLE' | 'POCKET';

export type CutAxis = 'X' | 'Y' | 'Z';

/**
 * Układ SmartPart Studio = CAD (Z-up), jak scena główna:
 *   X = szerokość, Y = głębokość, Z = wysokość
 * Babylon (Y-up) tylko przy rysowaniu: cadToRender / renderToCAD.
 */
export type SmartPartCoordSystem = 'CAD';

/** Ściana referencyjna dla osi X (szerokość) */
export type XRefWall = 'LEFT' | 'RIGHT' | 'CENTER';

/** Ściana referencyjna dla osi Y (głębokość) */
export type YRefWall = 'BACK' | 'FRONT' | 'CENTER';

/** Ściana referencyjna dla osi Z (wysokość) */
export type ZRefWall = 'BOTTOM' | 'TOP' | 'CENTER';

export interface SmartPartHoleCut {
    id: string;
    name: string;
    type: 'HOLE';
    /** Średnica walca / otworu [mm] */
    diameterMm: number;
    /** Długość walca [mm] */
    lengthMm: number;
    /**
     * Początek walca = lico utwierdzenia / LCS (CAD X) [mm] w LCS Parta — NIE środek bryły.
     * Środek geometrii = origin + direction × (lengthMm/2) wzdłuż `axis`.
     */
    xMm: number;
    /** Początek (LCS) w CAD Y = głęb. [mm] */
    yMm: number;
    /** Początek (LCS) w CAD Z = wys. [mm] */
    zMm: number;
    /** Ściana referencyjna dla X (Bok lewy / Bok prawy / Środek) */
    refX?: XRefWall;
    /** Odległość w mm od ściany referencyjnej X */
    offsetX_mm?: number;
    /** Ściana referencyjna dla Y (Tył / Przód / Środek) */
    refY?: YRefWall;
    /** Odległość w mm od ściany referencyjnej Y */
    offsetY_mm?: number;
    /** Ściana referencyjna dla Z (Dół / Góra / Środek) */
    refZ?: ZRefWall;
    /** Odległość w mm od ściany referencyjnej Z */
    offsetZ_mm?: number;
    /** Cache osi wysuwu — SSOT = refX/refY/refZ (`cutOrientFromRefs`) */
    axis: CutAxis;
    /** Cache zwrotu — SSOT = ściana referencyjna */
    direction: 1 | -1;
    /** Part, do którego należy to cięcie (dziecko w drzewie) */
    partId?: string;
    /** Widoczność w Studio (jak drzewo CAD) — domyślnie true */
    visible?: boolean;
    /** Wyłącz z przeliczania / CNC (panel aplikacji → check → frozen) */
    frozen?: boolean;
}

export interface SmartPartPocketCut {
    id: string;
    name: string;
    type: 'POCKET';
    /** Gabaryt w CAD X — szerokość [mm] */
    widthMm: number;
    /** Gabaryt w CAD Z — wysokość [mm] */
    heightMm: number;
    /** Gabaryt w CAD Y — głębokość [mm] */
    depthMm: number;
    /**
     * Początek = lico utwierdzenia / LCS (CAD X) [mm] w LCS Parta — NIE środek bryły.
     * Środek = origin + direction × (pół gabarytu wzdłuż `axis`).
     */
    xMm: number;
    /** Początek (LCS) w CAD Y głęb. [mm] */
    yMm: number;
    /** Początek (LCS) w CAD Z wys. [mm] */
    zMm: number;
    /** Ściana referencyjna dla X (Bok lewy / Bok prawy / Środek) */
    refX?: XRefWall;
    /** Odległość w mm od ściany referencyjnej X */
    offsetX_mm?: number;
    /** Ściana referencyjna dla Y (Tył / Przód / Środek) */
    refY?: YRefWall;
    /** Odległość w mm od ściany referencyjnej Y */
    offsetY_mm?: number;
    /** Ściana referencyjna dla Z (Dół / Góra / Środek) */
    refZ?: ZRefWall;
    /** Odległość w mm od ściany referencyjnej Z */
    offsetZ_mm?: number;
    /** Cache osi wysuwu — SSOT = refX/refY/refZ (`cutOrientFromRefs`) */
    axis?: CutAxis;
    /** Cache zwrotu — SSOT = ściana referencyjna */
    direction?: 1 | -1;
    /** Part, do którego należy to cięcie (dziecko w drzewie) */
    partId?: string;
    /** Widoczność w Studio (jak drzewo CAD) — domyślnie true */
    visible?: boolean;
    /** Wyłącz z przeliczania / CNC (panel aplikacji → check → frozen) */
    frozen?: boolean;
}

export type SmartPartCut = SmartPartHoleCut | SmartPartPocketCut;

/** Wymiary Kontenera Głównego SmartParta (szukającego ścian korpusu) */
export interface MainContainerDims {
    widthMm: number;
    heightMm: number;
    depthMm: number;
}

export interface SmartPartSetItem {
    id: string;
    name: string;
    description?: string;
    /** Widoczność zestawu w Studio (domyślnie true) */
    visible?: boolean;
}

/** Wymiary i pozycja Kontenera Part wewnątrz Kontenera Głównego */
export interface SmartPartBodyItem {
    id: string;
    name: string;
    /** ID zestawu, do którego należy ten Part */
    setId?: string;
    widthMm: number;
    heightMm: number;
    depthMm: number;
    xMm: number;
    yMm: number;
    zMm: number;
    refX?: XRefWall;
    offsetX_mm?: number;
    refY?: YRefWall;
    offsetY_mm?: number;
    refZ?: ZRefWall;
    offsetZ_mm?: number;
    colorHex: string;
    glbPath?: string;
    /** Widoczność w Studio (jak drzewo CAD) — domyślnie true */
    visible?: boolean;
    /** Wyłącz z przeliczania / CNC (panel aplikacji → check → frozen) */
    frozen?: boolean;
}

/** Alias kompatybilności wstecznej */
export type PartBodyConfig = SmartPartBodyItem;

/**
 * Przelicza pozycję bezwzględną CAD (xMm, yMm=głęb., zMm=wys.) ze ścian i offsetów.
 */
export function computeAbsoluteFromReference(
    main: MainContainerDims,
    refX: XRefWall = 'CENTER',
    offsetX = 0,
    refY: YRefWall = 'CENTER',
    offsetY = 0,
    refZ: ZRefWall = 'CENTER',
    offsetZ = 0
): { xMm: number; yMm: number; zMm: number } {
    const halfW = main.widthMm / 2;
    const halfH = main.heightMm / 2;
    const halfD = main.depthMm / 2;

    let xMm = offsetX;
    if (refX === 'LEFT') xMm = -halfW + offsetX;
    else if (refX === 'RIGHT') xMm = halfW - offsetX;

    // CAD Y = głębokość, środek kontenera = 0. Przód = −Y, tył = +Y.
    let yMm = offsetY;
    if (refY === 'FRONT') yMm = -halfD + offsetY;
    else if (refY === 'BACK') yMm = halfD - offsetY;

    // CAD Z = wysokość
    let zMm = offsetZ;
    if (refZ === 'BOTTOM') zMm = -halfH + offsetZ;
    else if (refZ === 'TOP') zMm = halfH - offsetZ;

    return {
        xMm: Math.round(xMm),
        yMm: Math.round(yMm),
        zMm: Math.round(zMm),
    };
}

/**
 * Przelicza offsety od ścian referencyjnych z pozycji bezwzględnej CAD.
 */
export function computeReferenceFromAbsolute(
    main: MainContainerDims,
    xMm: number,
    yMm: number,
    zMm: number,
    refX: XRefWall = 'CENTER',
    refY: YRefWall = 'CENTER',
    refZ: ZRefWall = 'CENTER'
): { offsetX_mm: number; offsetY_mm: number; offsetZ_mm: number } {
    const halfW = main.widthMm / 2;
    const halfH = main.heightMm / 2;
    const halfD = main.depthMm / 2;

    let offsetX_mm = Math.round(xMm);
    if (refX === 'LEFT') offsetX_mm = Math.round(xMm + halfW);
    else if (refX === 'RIGHT') offsetX_mm = Math.round(halfW - xMm);

    let offsetY_mm = Math.round(yMm);
    if (refY === 'FRONT') offsetY_mm = Math.round(yMm + halfD);
    else if (refY === 'BACK') offsetY_mm = Math.round(halfD - yMm);

    let offsetZ_mm = Math.round(zMm);
    if (refZ === 'BOTTOM') offsetZ_mm = Math.round(zMm + halfH);
    else if (refZ === 'TOP') offsetZ_mm = Math.round(halfH - zMm);

    return { offsetX_mm, offsetY_mm, offsetZ_mm };
}

/** Odczyt wystawania cięcia poza 6 ścian Kontenera Głównego */
export interface CutProtrusionInfo {
    cutId: string;
    cutName: string;
    type: CutType;
    /** Wystawanie w mm poza poszczególne ściany kontenera głównego */
    leftXMinusMm: number;   // styk z boczkiem lewym (CAD −X)
    rightXPlusMm: number;   // styk z boczkiem prawym (CAD +X)
    bottomYMinusMm: number; // styk z wieńcem dolnym (CAD −Z) — nazwa historyczna
    topYPlusMm: number;     // styk z wieńcem górnym (CAD +Z)
    backZMinusMm: number;   // styk z plecami (CAD −Y)
    frontZPlusMm: number;   // styk z frontem (CAD +Y)
}

/** Opcja listy wyboru modelu (np. typ nóżki) — każda opcja = osobny GLB. */
export interface SmartPartListOption {
    key: string;
    /** Etykieta wyświetlana (tłumaczona) */
    label?: string;
    /** Ścieżka GLB w folderze pakietu */
    glbPath: string;
}

/** Parametr udostępniony w panelu edycji aplikacji (generowanym z JSON). */
export type SmartPartParameter =
    | {
        key: string;
        type: 'number';
        label?: string;
        default_mm: number;
        min_mm?: number;
        max_mm?: number;
    }
    | {
        key: string;
        type: 'list';
        label?: string;
        default: string;
        options: SmartPartListOption[];
    }
    | {
        key: string;
        type: 'check';
        label?: string;
        /** true = zaznaczony (np. zamrożony) */
        default: boolean;
    };

export type SmartPartTargetType = 'PART' | 'CUT' | 'MAIN';

/** Pole parta, cięcia lub kontenera, które można podpiąć pod parametr (🔗 w Studio). */
export type SmartPartBindingField =
    | 'offsetX_mm'
    | 'offsetY_mm'
    | 'offsetZ_mm'
    | 'widthMm'
    | 'heightMm'
    | 'depthMm'
    | 'diameterMm'
    | 'lengthMm'
    | 'glbPath'
    | 'frozen';

/** Powiązanie: pole elementu (part / cut / mainContainer) ← parametr sterujący. */
export interface SmartPartBinding {
    paramKey: string;
    /** Typ docelowego elementu (domyślnie 'PART' gdy nie podano) */
    targetType?: SmartPartTargetType;
    /** Identyfikator celu: partId, cutId lub 'main_container' */
    targetId: string;
    field: SmartPartBindingField;
    /** Dla wygody / zachowania czytelności: równe targetId gdy targetType === 'PART' */
    partId?: string;
}

/** Pełna definicja SmartParta (zgodna z pakietem JSON + GLB + Ikona UI) */
export interface SmartPartPackageDefinition {
    /** Parametry panelu aplikacji (opcjonalne; brak = SmartPart bez panelu parametrów) */
    parameters?: SmartPartParameter[];
    /** Powiązania pól partów z parametrami */
    bindings?: SmartPartBinding[];
    id: string;
    name: string;
    units: 'mm';
    version: '1.0';
    type: 'HANGER' | 'CONNECTOR' | 'CUSTOM';
    /** Po normalizacji zawsze CAD (X szer., Y głęb., Z wys.) */
    coordSystem?: SmartPartCoordSystem;
    /** Cięcia w LCS Parta (x/y/z względem środka Parta), nie kontenera głównego */
    cutsFrame?: 'PART';
    /** Kontener Główny SmartPart (szukający ścian korpusu) */
    mainContainer: MainContainerDims;
    /** Kolekcja zestawów okuć (opcjonalna; brak = 1 domyślny zestaw) */
    sets?: SmartPartSetItem[];
    /** Kolekcja Kontenerów Parts (dowolna liczba: 1, 2... 100) */
    parts: SmartPartBodyItem[];
    /** Kompatybilność wsteczna */
    partBody?: SmartPartBodyItem;
    /** Lista cięć (tylko walce i sześciany) */
    cuts: SmartPartCut[];
    /** Opcjonalna miniatura DataURL (ikona do UI) */
    iconDataUrl?: string;
    /** Znacznik czasu */
    updatedAt: number;
}

/**
 * Upewnia się, że pakiet posiada przynajmniej jeden zestaw i że każdy Part ma przypisany setId.
 */
export function ensurePackageSets(pkg: SmartPartPackageDefinition): SmartPartPackageDefinition {
    if (!pkg) return pkg;
    const existingSets = Array.isArray(pkg.sets) && pkg.sets.length > 0 ? pkg.sets : [];
    if (existingSets.length === 0) {
        const defaultSetId = 'set_1';
        const defaultSet: SmartPartSetItem = {
            id: defaultSetId,
            name: pkg.name || 'Zestaw 1',
            visible: true,
        };
        const updatedParts = (pkg.parts || []).map((p) => ({
            ...p,
            setId: p.setId || defaultSetId,
        }));
        return {
            ...pkg,
            sets: [defaultSet],
            parts: updatedParts,
        };
    }

    const firstSetId = existingSets[0].id;
    const updatedParts = (pkg.parts || []).map((p) => ({
        ...p,
        setId: p.setId || firstSetId,
    }));
    return {
        ...pkg,
        sets: existingSets,
        parts: updatedParts,
    };
}

/**
 * Zwrot na zewnątrz względem ściany utwierdzenia.
 * LEFT/FRONT/BOTTOM → −1, RIGHT/BACK/TOP → +1. CENTER → null.
 */
export function holeOutwardDirectionForRef(
    axis: CutAxis,
    refX?: string,
    refY?: string,
    refZ?: string,
): 1 | -1 | null {
    if (axis === 'X') {
        if (refX === 'LEFT') return -1;
        if (refX === 'RIGHT') return 1;
    } else if (axis === 'Y') {
        if (refY === 'FRONT') return -1;
        if (refY === 'BACK') return 1;
    } else {
        if (refZ === 'BOTTOM') return -1;
        if (refZ === 'TOP') return 1;
    }
    return null;
}

/**
 * Oś + zwrot wysuwu z ścian referencyjnych (SSOT UI).
 * `axis`/`direction` w JSON to tylko cache — przy ścianie bocznej liczymy z ref*.
 */
export function cutOrientFromRefs(cut: {
    axis?: CutAxis;
    direction?: 1 | -1;
    refX?: string;
    refY?: string;
    refZ?: string;
}): { axis: CutAxis; direction: 1 | -1 } {
    const sides: { axis: CutAxis; direction: 1 | -1 }[] = [];
    const dx = holeOutwardDirectionForRef('X', cut.refX, cut.refY, cut.refZ);
    const dy = holeOutwardDirectionForRef('Y', cut.refX, cut.refY, cut.refZ);
    const dz = holeOutwardDirectionForRef('Z', cut.refX, cut.refY, cut.refZ);
    if (dx !== null) sides.push({ axis: 'X', direction: dx });
    if (dy !== null) sides.push({ axis: 'Y', direction: dy });
    if (dz !== null) sides.push({ axis: 'Z', direction: dz });
    if (sides.length === 1) return sides[0];
    if (sides.length > 1) {
        const pref = sides.find((s) => s.axis === cut.axis);
        return pref ?? sides[0];
    }
    const axis: CutAxis = cut.axis === 'X' || cut.axis === 'Y' || cut.axis === 'Z' ? cut.axis : 'Y';
    const direction: 1 | -1 = cut.direction === 1 || cut.direction === -1 ? cut.direction : 1;
    return { axis, direction };
}

/** @deprecated użyj cutOrientFromRefs */
export const pocketAxisDirection = cutOrientFromRefs;

/**
 * Środek geometrii walca z początku (LCS).
 * origin + direction × (length/2) wzdłuż osi CAD.
 */
export function holeCenterFromOriginCad(cut: {
    xMm: number;
    yMm: number;
    zMm: number;
    lengthMm: number;
    axis?: CutAxis;
    direction?: 1 | -1;
    refX?: string;
    refY?: string;
    refZ?: string;
}): { xMm: number; yMm: number; zMm: number } {
    const { axis, direction } = cutOrientFromRefs(cut);
    const half = Math.max(1, Number(cut.lengthMm) || 0) / 2;
    if (axis === 'X') return { xMm: cut.xMm + direction * half, yMm: cut.yMm, zMm: cut.zMm };
    if (axis === 'Y') return { xMm: cut.xMm, yMm: cut.yMm + direction * half, zMm: cut.zMm };
    return { xMm: cut.xMm, yMm: cut.yMm, zMm: cut.zMm + direction * half };
}

/** Środek sześcianu z początku (LCS). */
export function pocketCenterFromOriginCad(pocket: {
    xMm: number;
    yMm: number;
    zMm: number;
    widthMm: number;
    heightMm: number;
    depthMm: number;
    axis?: CutAxis;
    direction?: 1 | -1;
    refX?: string;
    refY?: string;
    refZ?: string;
}): { xMm: number; yMm: number; zMm: number } {
    const { axis, direction } = cutOrientFromRefs(pocket);
    const half =
        axis === 'X' ? Math.max(1, pocket.widthMm) / 2
        : axis === 'Y' ? Math.max(1, pocket.depthMm) / 2
        : Math.max(1, pocket.heightMm) / 2;
    if (axis === 'X') return { xMm: pocket.xMm + direction * half, yMm: pocket.yMm, zMm: pocket.zMm };
    if (axis === 'Y') return { xMm: pocket.xMm, yMm: pocket.yMm + direction * half, zMm: pocket.zMm };
    return { xMm: pocket.xMm, yMm: pocket.yMm, zMm: pocket.zMm + direction * half };
}

/** Oblicza ile mm cięcie wystaje poza Kontener Główny.
 * `cut` jest w LCS Parta; podaj `partOrigin` (pozycja Parta w kontenerze) albo abs cut w main. */
export function calculateCutProtrusion(
    cut: SmartPartCut,
    main: MainContainerDims,
    partOrigin?: { xMm: number; yMm: number; zMm: number } | null,
): CutProtrusionInfo {
    const halfContX = main.widthMm / 2;
    const halfContY = main.depthMm / 2;   // CAD Y = głębokość
    const halfContZ = main.heightMm / 2;  // CAD Z = wysokość

    let ox = (partOrigin?.xMm ?? 0) + cut.xMm;
    let oy = (partOrigin?.yMm ?? 0) + cut.yMm;
    let oz = (partOrigin?.zMm ?? 0) + cut.zMm;

    let minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = 0;

    if (cut.type === 'HOLE') {
        const radius = cut.diameterMm / 2;
        const halfLen = cut.lengthMm / 2;
        const { axis } = cutOrientFromRefs(cut);
        const c = holeCenterFromOriginCad(cut);
        ox = (partOrigin?.xMm ?? 0) + c.xMm;
        oy = (partOrigin?.yMm ?? 0) + c.yMm;
        oz = (partOrigin?.zMm ?? 0) + c.zMm;

        if (axis === 'X') {
            minX = ox - halfLen;
            maxX = ox + halfLen;
            minY = oy - radius;
            maxY = oy + radius;
            minZ = oz - radius;
            maxZ = oz + radius;
        } else if (axis === 'Y') {
            minX = ox - radius;
            maxX = ox + radius;
            minY = oy - halfLen;
            maxY = oy + halfLen;
            minZ = oz - radius;
            maxZ = oz + radius;
        } else {
            minX = ox - radius;
            maxX = ox + radius;
            minY = oy - radius;
            maxY = oy + radius;
            minZ = oz - halfLen;
            maxZ = oz + halfLen;
        }
    } else {
        const halfW = cut.widthMm / 2;
        const halfD = cut.depthMm / 2;
        const halfH = cut.heightMm / 2;
        const c = pocketCenterFromOriginCad(cut);
        ox = (partOrigin?.xMm ?? 0) + c.xMm;
        oy = (partOrigin?.yMm ?? 0) + c.yMm;
        oz = (partOrigin?.zMm ?? 0) + c.zMm;
        minX = ox - halfW;
        maxX = ox + halfW;
        minY = oy - halfD;
        maxY = oy + halfD;
        minZ = oz - halfH;
        maxZ = oz + halfH;
    }

    return {
        cutId: cut.id,
        cutName: cut.name,
        type: cut.type,
        leftXMinusMm: Math.max(0, Math.round((-halfContX - minX) * 10) / 10),
        rightXPlusMm: Math.max(0, Math.round((maxX - halfContX) * 10) / 10),
        bottomYMinusMm: Math.max(0, Math.round((-halfContZ - minZ) * 10) / 10),
        topYPlusMm: Math.max(0, Math.round((maxZ - halfContZ) * 10) / 10),
        backZMinusMm: Math.max(0, Math.round((-halfContY - minY) * 10) / 10),
        frontZPlusMm: Math.max(0, Math.round((maxY - halfContY) * 10) / 10),
    };
}

/** Gabaryt Parta jako „kontener” do refs cięcia (LCS Part). */
export function partDimsAsMain(part: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
}): MainContainerDims {
    return {
        widthMm: Math.max(1, Number(part.widthMm) || 1),
        heightMm: Math.max(1, Number(part.heightMm) || 1),
        depthMm: Math.max(1, Number(part.depthMm) || 1),
    };
}

export function findPartForCut(
    def: { parts?: SmartPartBodyItem[]; partBody?: SmartPartBodyItem },
    cut: { partId?: string },
): SmartPartBodyItem | undefined {
    const parts = Array.isArray(def.parts) && def.parts.length > 0
        ? def.parts
        : def.partBody
            ? [def.partBody]
            : [];
    if (cut.partId) {
        const found = parts.find((p) => p.id === cut.partId);
        // Nie wrzucaj na parts[0] przy zepsutym partId — to dokładało walce Part2 pod Part1
        if (found) return found;
        return undefined;
    }
    return parts.length === 1 ? parts[0] : undefined;
}

/** Czy punkt cięcia mieści się w lokalnym gabarycie Parta (z zapasem). */
function cutInsidePartLocal(part: SmartPartBodyItem, cut: { xMm?: number; yMm?: number; zMm?: number }): boolean {
    const margin = 2;
    const hx = Math.max(1, Number(part.widthMm) || 1) / 2 + margin;
    const hy = Math.max(1, Number(part.depthMm) || 1) / 2 + margin;
    const hz = Math.max(1, Number(part.heightMm) || 1) / 2 + margin;
    return Math.abs(Number(cut.xMm) || 0) <= hx
        && Math.abs(Number(cut.yMm) || 0) <= hy
        && Math.abs(Number(cut.zMm) || 0) <= hz;
}

/**
 * Cięcia widoczne w drzewie Studio (= mają żywego właściciela Part).
 * Cut ze starym/brakującym partId NIE wisi pod żadnym Partem w UI, ale siedział
 * w cuts[] i trafiał do JSON — CAD doklejał go potem do Part1. Stąd „duplikaty”.
 * Eksport / zapis / odczyt muszą brać TYLKO to, co widać w drzewie — bez zgadywania geometrią.
 */
export function cutsOwnedByLiveParts(
    def: { parts?: SmartPartBodyItem[]; partBody?: SmartPartBodyItem; cuts?: SmartPartCut[] },
): SmartPartCut[] {
    const parts = Array.isArray(def.parts) && def.parts.length > 0
        ? def.parts
        : def.partBody
            ? [def.partBody]
            : [];
    const cuts = Array.isArray(def.cuts) ? def.cuts : [];
    if (parts.length === 0) return [];
    const partIds = new Set(parts.map((p) => p.id));
    const out: SmartPartCut[] = [];
    for (const c of cuts) {
        if (c.partId && partIds.has(c.partId)) {
            out.push(c);
            continue;
        }
        // Brak / zły partId: tylko przy jednym Partie — jawnie przypisz (to widać w drzewie)
        if (!c.partId && parts.length === 1) {
            out.push({ ...c, partId: parts[0].id });
        }
        // multi-part + orphan → pomijamy (nie było w drzewie pod Partem)
    }
    return out;
}

/** Orphan cuts: są w tablicy, ale nie wiszą pod żadnym Partem w drzewie. */
export function orphanSmartPartCuts(
    def: { parts?: SmartPartBodyItem[]; partBody?: SmartPartBodyItem; cuts?: SmartPartCut[] },
): SmartPartCut[] {
    const parts = Array.isArray(def.parts) && def.parts.length > 0
        ? def.parts
        : def.partBody
            ? [def.partBody]
            : [];
    const cuts = Array.isArray(def.cuts) ? def.cuts : [];
    const partIds = new Set(parts.map((p) => p.id));
    return cuts.filter((c) => {
        if (c.partId && partIds.has(c.partId)) return false;
        if (!c.partId && parts.length === 1) return false;
        return true;
    });
}

/**
 * Przy zapisie/odczycie: cuts = dokładnie to, co w drzewie pod Partami.
 * Bez dedupe geometrii, bez zgadywania właściciela.
 */
export function sanitizeSmartPartCuts(def: SmartPartPackageDefinition): SmartPartPackageDefinition {
    if (!def || !Array.isArray(def.cuts)) return def;
    const cuts = cutsOwnedByLiveParts(def);
    return { ...def, cuts, cutsFrame: 'PART' };
}

/** Pozycja cięcia w układzie Kontenera Głównego = Part + lokalne LCS. */
export function cutAbsoluteInMain(
    part: { xMm: number; yMm: number; zMm: number } | null | undefined,
    cut: { xMm: number; yMm: number; zMm: number },
): { xMm: number; yMm: number; zMm: number } {
    if (!part) return { xMm: cut.xMm, yMm: cut.yMm, zMm: cut.zMm };
    return {
        xMm: part.xMm + cut.xMm,
        yMm: part.yMm + cut.yMm,
        zMm: part.zMm + cut.zMm,
    };
}

const LEGACY_HEIGHT_REFS = new Set(['BOTTOM', 'TOP']);
const LEGACY_DEPTH_REFS = new Set(['BACK', 'FRONT']);

function isLegacyStudioCoords(item: { refY?: string; refZ?: string } | null | undefined): boolean {
    if (!item) return false;
    const ry = String(item.refY || '').toUpperCase();
    const rz = String(item.refZ || '').toUpperCase();
    return LEGACY_HEIGHT_REFS.has(ry) || LEGACY_DEPTH_REFS.has(rz);
}

/** Stary Studio (Y=wys., Z=głęb.) → CAD (Y=głęb., Z=wys.): zamiana Y↔Z. */
function migratePlacedItemYZX<T extends Record<string, any>>(item: T): T {
    if (!isLegacyStudioCoords(item)) return item;
    const next: any = { ...item };
    const yMm = next.yMm;
    const zMm = next.zMm;
    next.yMm = zMm;
    next.zMm = yMm;
    const offY = next.offsetY_mm;
    const offZ = next.offsetZ_mm;
    next.offsetY_mm = offZ;
    next.offsetZ_mm = offY;
    const refY = String(next.refY || 'CENTER').toUpperCase();
    const refZ = String(next.refZ || 'CENTER').toUpperCase();
    next.refY = LEGACY_DEPTH_REFS.has(refZ) || refZ === 'CENTER' ? refZ : 'CENTER';
    next.refZ = LEGACY_HEIGHT_REFS.has(refY) || refY === 'CENTER' ? refY : 'CENTER';
    if (next.type === 'HOLE' && (next.axis === 'Y' || next.axis === 'Z')) {
        next.axis = next.axis === 'Y' ? 'Z' : 'Y';
    }
    return next as T;
}

/** Cięcia wyglądają na lokalne LCS Parta (nie absolut kontenera) — nie odejmuj pozycji Parta drugi raz. */
function cutsAlreadyPartLocal(def: SmartPartPackageDefinition): boolean {
    if (def.cutsFrame === 'PART') return true;
    const parts = Array.isArray(def.parts) ? def.parts : [];
    const cuts = Array.isArray(def.cuts) ? def.cuts : [];
    if (parts.length === 0 || cuts.length === 0) return true;
    let checked = 0;
    for (const c of cuts) {
        const ownerId = c.partId && parts.some((p) => p.id === c.partId) ? c.partId : undefined;
        if (!ownerId) continue;
        const part = parts.find((p) => p.id === ownerId)!;
        checked += 1;
        if (!cutInsidePartLocal(part, c)) return false;
    }
    return checked > 0;
}

/** Stare cięcia w układzie kontenera głównego → lokalne LCS Parta (tylko cut z żywym partId). */
function migrateCutsToPartLocal(def: SmartPartPackageDefinition): SmartPartPackageDefinition {
    if (cutsAlreadyPartLocal(def)) {
        return { ...def, cutsFrame: 'PART' };
    }
    const parts = Array.isArray(def.parts) ? def.parts : [];
    if (!Array.isArray(def.cuts) || def.cuts.length === 0) {
        return { ...def, cutsFrame: 'PART' };
    }

    const cuts = def.cuts.map((c) => {
        const part = findPartForCut(def, c);
        if (!part) return c; // orphan — sanitize później wyrzuci (nie było w drzewie)
        const localX = Math.round(Number(c.xMm || 0) - Number(part.xMm || 0));
        const localY = Math.round(Number(c.yMm || 0) - Number(part.yMm || 0));
        const localZ = Math.round(Number(c.zMm || 0) - Number(part.zMm || 0));
        const refX = (c.refX || 'CENTER') as XRefWall;
        const refY = (c.refY || 'CENTER') as YRefWall;
        const refZ = (c.refZ || 'CENTER') as ZRefWall;
        const rel = computeReferenceFromAbsolute(
            partDimsAsMain(part),
            localX,
            localY,
            localZ,
            refX,
            refY,
            refZ,
        );
        return {
            ...c,
            xMm: localX,
            yMm: localY,
            zMm: localZ,
            refX,
            refY,
            refZ,
            offsetX_mm: rel.offsetX_mm,
            offsetY_mm: rel.offsetY_mm,
            offsetZ_mm: rel.offsetZ_mm,
            partId: part.id,
        };
    });

    return { ...def, cuts, cutsFrame: 'PART' };
}

/**
 * xMm/yMm/zMm przy ścianie (LEFT/FRONT/…) biorą się z offsetu, nie ze starego znaku Y.
 * CENTER zostaje — tam absolut jest ręczny.
 */
function syncWallAbsolute<T extends Record<string, any>>(item: T, dims: MainContainerDims): T {
    if (!item || !dims) return item;
    const refX = String(item.refX || 'CENTER').toUpperCase();
    const refY = String(item.refY || 'CENTER').toUpperCase();
    const refZ = String(item.refZ || 'CENTER').toUpperCase();
    if (refX === 'CENTER' && refY === 'CENTER' && refZ === 'CENTER') return item;
    const abs = computeAbsoluteFromReference(
        dims,
        refX as XRefWall,
        Number(item.offsetX_mm) || 0,
        refY as YRefWall,
        Number(item.offsetY_mm) || 0,
        refZ as ZRefWall,
        Number(item.offsetZ_mm) || 0,
    );
    return {
        ...item,
        xMm: refX === 'CENTER' ? item.xMm : abs.xMm,
        yMm: refY === 'CENTER' ? item.yMm : abs.yMm,
        zMm: refZ === 'CENTER' ? item.zMm : abs.zMm,
    };
}

/**
 * Normalizuje pakiet do CAD + cięcia w LCS Parta.
 * Zapis/odczyt = cutsOwnedByLiveParts (1:1 z drzewem Studio) — bez dedupe, bez zgadywania.
 */
export function normalizeSmartPartToCadCoords(
    def: SmartPartPackageDefinition,
): SmartPartPackageDefinition {
    if (!def) return def;

    let next: SmartPartPackageDefinition = {
        ...def,
        coordSystem: 'CAD',
    };
    if (def.coordSystem !== 'CAD') {
        if (Array.isArray(next.parts)) {
            next.parts = next.parts.map((p) => migratePlacedItemYZX(p));
        }
        if (Array.isArray(next.cuts)) {
            next.cuts = next.cuts.map((c) => migratePlacedItemYZX(c));
        }
    }
    if (!next.partBody && Array.isArray(next.parts) && next.parts[0]) {
        next.partBody = next.parts[0];
    }

    next = sanitizeSmartPartCuts(migrateCutsToPartLocal(next));
    if (next.mainContainer && Array.isArray(next.parts)) {
        next.parts = next.parts.map((p) => syncWallAbsolute(p, next.mainContainer));
        const bodyId = next.partBody?.id;
        next.partBody = (bodyId ? next.parts.find((p) => p.id === bodyId) : null) || next.parts[0] || next.partBody;
    }
    if (Array.isArray(next.cuts)) {
        next.cuts = next.cuts.map((c) => {
            const part = findPartForCut(next, c);
            const dims = part ? partDimsAsMain(part) : next.mainContainer;
            return dims ? syncWallAbsolute(c, dims) : c;
        });
    }
    return next;
}
