/**
 * parametric-drawer-side.ts — Parametryczny generator 2D (3 pętle) + ekstruzja 3D (Babylon.js)
 * dla systemu szuflad (Boczek + Mocowanie + Prowadnica N).
 *
 * Wszystkie wymiary wejściowe i wyjściowe są w milimetrach (mm).
 * Układ współrzędnych 2D przekroju (X, Y):
 *  - Baza (0, 0) w lewym dolnym narożniku Mocowania (m_x = 0, m_y = 0).
 *  - X = 0 to płaszczyzna wewnętrzna boku korpusu (styk mocowania ze ścianką korpusu).
 *  - Oś +X biegnie do wnętrza szafki (dla prawego boku odbijana lustrzanie X -> -X).
 *  - Oś +Y biegnie pionowo w górę (wysokość szuflady).
 *  - Oś +Z (po ekstruzji 3D w Babylon.js) biegnie od przodu wnęki (0) w głąb korpusu (+length_mm).
 */

import earcut from 'earcut';

declare const BABYLON: any;

export type Point2D = [number, number];

export interface DrawerSideProfileInput {
    /** ① BOCZEK: Wysokość boczka (niebieska figura) [mm], domyślnie 178 */
    b_h?: number;
    /** ① BOCZEK: Wysokość całkowita układu (góra boczka Y) [mm], domyślnie b_h + 16 (194 dla 178) */
    b_y?: number;
    /** ① BOCZEK: Pozycja X zewnętrznej ścianki boczka [mm], domyślnie 7 */
    b_x?: number;
    /** ① BOCZEK: Szerokość górna boczka [mm], domyślnie 12 */
    b_tw?: number;
    /** ① BOCZEK: Kompensacja pleców/dna (L - ...) [mm], domyślnie 21 */
    kompensacja_plecow?: number;
    /** ① BOCZEK: Grubość nóżki boczka [mm], domyślnie (kompensacja_plecow / 2) - b_x = 3.5 */
    b_bw?: number;
    /** ① BOCZEK: Minimalne wcięcie pod dno [mm], domyślnie 1.0 */
    wciecie_dna?: number;
    /** ① BOCZEK: Wysokość pleców [mm], domyślnie b_h - 30 (148 dla 178) */
    b_ph?: number;
    /** ① BOCZEK: Grubość płyty dna [mm] (steruje pozycją Y prowadnicy), domyślnie 16 */
    p_th?: number;

    /** Opcjonalne punkty rzeczywistego profilu z pliku DXF (zamiast uproszczonej pętli parametrycznej) */
    custom_boczek_points?: Point2D[];

    /** ② MOCOWANIE: Szerokość całkowita [mm], domyślnie 45 */
    m_w?: number;
    /** ② MOCOWANIE: Wysokość całkowita [mm], domyślnie 60 */
    m_h?: number;
    /** ② MOCOWANIE: Grubość ścianki [mm], domyślnie 2 */
    m_wall?: number;
    /** ② MOCOWANIE: Wcięcie od prawej X [mm], domyślnie 20 */
    m_nrx?: number;
    /** ② MOCOWANIE: Wcięcie wysokość Y [mm], domyślnie 19 */
    m_nh?: number;
    /** ② MOCOWANIE: Pozycja X bazy [mm], domyślnie 0 */
    m_x?: number;
    /** ② MOCOWANIE: Pozycja Y dół bazy [mm], domyślnie 0 */
    m_y?: number;

    /** ③ PROWADNICA N: Wysokość całkowita [mm], domyślnie 23 */
    r_h?: number;
    /** ③ PROWADNICA N: Szerokość lewego ramienia [mm], domyślnie 10 */
    r_lw?: number;
    /** ③ PROWADNICA N: Szerokość prawego ramienia [mm], domyślnie 10 */
    r_rw?: number;
    /** ③ PROWADNICA N: Głębokość ramion [mm], domyślnie 20 */
    r_ad?: number;
    /** ③ PROWADNICA N: Szerokość całkowita [mm], domyślnie 42 */
    r_w?: number;
    /** ③ PROWADNICA N: Pozycja X lewego ramienia [mm], domyślnie 14 */
    r_x?: number;

    /** Długości wyciągnięć 3D [mm] (z JSON lub wyliczane) */
    boczek_len?: number;
    boczekLen?: number;
    mocowanie_len?: number;
    mocowanieLen?: number;
    prowadnica_len?: number;
    prowadnicaLen?: number;
}

export interface NormalizedDrawerSideProfile {
    b_h: number;
    b_y: number;
    b_x: number;
    b_tw: number;
    kompensacja_plecow: number;
    b_bw: number;
    wciecie_dna: number;
    b_ph: number;
    p_th: number;

    m_w: number;
    m_h: number;
    m_wall: number;
    m_nrx: number;
    m_nh: number;
    m_x: number;
    m_y: number;

    r_h: number;
    r_lw: number;
    r_rw: number;
    r_ad: number;
    r_w: number;
    r_x: number;

    /** Wyliczone rzędne Y [mm] */
    bottomY: number;
    shelfY: number;
    railTopY: number;
    railBottomY: number;

    /** Wyciągnięcia 3D [mm] */
    boczek_len?: number;
    mocowanie_len?: number;
    prowadnica_len?: number;
    custom_boczek_points?: Point2D[];
}

export interface DrawerSideLoops2DResult {
    params: NormalizedDrawerSideProfile;
    /** Pętla ①: Boczek szuflady (6 punktów) */
    boczek: Point2D[];
    /** Pętla ②: Mocowanie do korpusu (8 punktów) */
    mocowanie: Point2D[];
    /** Pętla ③: Prowadnica profil N (8 punktów) */
    prowadnica: Point2D[];
}

function numOr(val: unknown, fallback: number): number {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalizuje parametry profilu boczka, mocowania i prowadnicy N
 * oraz wylicza powiązane rzędne wysokościowe (bottomY, shelfY, railTopY, railBottomY).
 */
export function normalizeDrawerSideProfile(raw: DrawerSideProfileInput = {}): NormalizedDrawerSideProfile {
    const b_h = Math.max(40, numOr(raw.b_h, 178));
    // Domyślny prześwit dolny = 16 mm (dla b_h=178 daje b_y=194), wysokość nogi = 30 mm (dla b_h=178 daje b_ph=148)
    const b_y = numOr(raw.b_y, b_h + 16);
    const b_x = numOr(raw.b_x, 7);
    const b_tw = Math.max(2, numOr(raw.b_tw, 12));
    const kompensacja_plecow = numOr(raw.kompensacja_plecow, 21);
    const b_bw = raw.b_bw !== undefined && Number.isFinite(Number(raw.b_bw))
        ? Number(raw.b_bw)
        : Math.max(0.5, kompensacja_plecow / 2 - b_x);
    const wciecie_dna = Math.max(1.0, numOr(raw.wciecie_dna, 1.0));
    const b_ph = raw.b_ph !== undefined && Number.isFinite(Number(raw.b_ph))
        ? Number(raw.b_ph)
        : Math.max(20, b_h - 30);
    const p_th = Math.max(0, numOr(raw.p_th, 16));

    const m_w = Math.max(5, numOr(raw.m_w, 45));
    const m_h = Math.max(5, numOr(raw.m_h, 60));
    const m_wall = Math.max(0.5, numOr(raw.m_wall, 2));
    const m_nrx = Math.max(0, numOr(raw.m_nrx, 20));
    const m_nh = Math.max(1, numOr(raw.m_nh, 19));
    const m_x = numOr(raw.m_x, 0);
    const m_y = numOr(raw.m_y, 0);

    const r_h = Math.max(5, numOr(raw.r_h, 23));
    const r_lw = Math.max(1, numOr(raw.r_lw, 10));
    const r_rw = Math.max(1, numOr(raw.r_rw, 10));
    const r_ad = Math.max(1, numOr(raw.r_ad, 20));
    const r_w = Math.max(10, numOr(raw.r_w, 42));
    const r_x = numOr(raw.r_x, 14);

    // Wzory wiążące z silnika parametrycznego:
    const bottomY = b_y - b_h;
    const shelfY = b_y - b_ph;
    const railTopY = b_y - b_ph - p_th;
    const railBottomY = railTopY - r_h;

    const boczek_len = raw.boczek_len ?? raw.boczekLen;
    const mocowanie_len = raw.mocowanie_len ?? raw.mocowanieLen;
    const prowadnica_len = raw.prowadnica_len ?? raw.prowadnicaLen;

    return {
        b_h,
        b_y,
        b_x,
        b_tw,
        kompensacja_plecow,
        b_bw,
        wciecie_dna,
        b_ph,
        p_th,
        m_w,
        m_h,
        m_wall,
        m_nrx,
        m_nh,
        m_x,
        m_y,
        r_h,
        r_lw,
        r_rw,
        r_ad,
        r_w,
        r_x,
        bottomY,
        shelfY,
        railTopY,
        railBottomY,
        ...(boczek_len !== undefined ? { boczek_len } : {}),
        ...(mocowanie_len !== undefined ? { mocowanie_len } : {}),
        ...(prowadnica_len !== undefined ? { prowadnica_len } : {}),
        ...(raw.custom_boczek_points && Array.isArray(raw.custom_boczek_points) ? { custom_boczek_points: raw.custom_boczek_points } : {})
    };
}

/**
 * ① Pętla 2D Boczka Szuflady (Góra w b_y, dół w bottomY, półka pod dno w shelfY, pionowa lub skośna wewnętrzna ścianka).
 * Jeśli podano custom_boczek_points (z DXF), używa bezpośrednio tych rzeczywistych punktów,
 * pozycjonując je względem zewnętrznej ścianki b_x i poziomu płyty shelfY.
 * Dla boczka z nogą schodzącą pod płytę (Sevroll SlimBox) generuje 6 punktów.
 * Dla boczka bez nogi, uciętego na wysokości płyty (Blum Antaro: b_h = b_ph, bottomY >= shelfY)
 * generuje 4-punktowy profil trapezowy ze skośną ścianką wewnętrzną (szerokie oparcie na dole, wąska góra).
 */
export function buildBoczekLoop2D(p: NormalizedDrawerSideProfile): Point2D[] {
    const { b_x, b_y, bottomY, b_bw, shelfY, wciecie_dna, b_tw, custom_boczek_points } = p;

    // Gdy podano rzeczywisty profil z DXF:
    if (custom_boczek_points && custom_boczek_points.length >= 3) {
        return custom_boczek_points.map(([lx, ly_down]) => [
            Number((b_x + lx).toFixed(2)),
            Number((b_y - ly_down).toFixed(2))
        ]);
    }

    const topInnerX = b_x + b_tw;
    const shelfInnerX = Math.max(topInnerX, b_x + b_bw + wciecie_dna);

    // Gdy brak nogi schodzącej w dół poniżej płyty (bottomY >= shelfY, np. Blum Antaro):
    // Profil jest ucięty na wysokości płyty dna (shelfY), a wewnętrzna ścianka biegnie skośnie.
    if (bottomY >= shelfY) {
        return [
            [b_x, b_y],             // lewy-góra (zewnętrzna pionowa ścianka)
            [b_x, shelfY],          // lewy-dół (ucięty na wysokości płyty dna: b_y - b_ph)
            [shelfInnerX, shelfY],  // poziomy spód boczka / styk z płytą dna
            [topInnerX, b_y],       // skośna ścianka wewnętrzna wracająca do wąskiej góry
        ];
    }

    return [
        [b_x, b_y],             // lewy-góra (zewnętrzna pionowa ścianka)
        [b_x, bottomY],         // lewy-dół
        [b_x + b_bw, bottomY],  // dół nóżki
        [b_x + b_bw, shelfY],   // pion nóżki do półki (styk z płytą dna)
        [shelfInnerX, shelfY],  // pozioma półka pod dno (wcięcie)
        [topInnerX, b_y],       // wewnętrzna ścianka: pionowa (gdy shelfInnerX == topInnerX) lub skośna do środka szafki
    ];
}

/**
 * ② Pętla 2D Mocowania (Liczona od lewego dołu w [m_x, m_y]).
 */
export function buildMocowanieLoop2D(p: NormalizedDrawerSideProfile): Point2D[] {
    const { m_x, m_y, m_w, m_h, m_wall, m_nrx, m_nh } = p;
    return [
        [m_x, m_y],
        [m_x, m_y + m_h],
        [m_x + m_wall, m_y + m_h],
        [m_x + m_wall, m_y + m_wall],
        [m_x + m_w - m_nrx, m_y + m_wall],
        [m_x + m_w - m_nrx, m_y + m_wall + m_nh],
        [m_x + m_w, m_y + m_wall + m_nh],
        [m_x + m_w, m_y],
    ];
}

/**
 * ③ Pętla 2D Prowadnicy N (Liczona od lewego dołu w [r_x, railBottomY], góra w railTopY).
 */
export function buildProwadnicaLoop2D(p: NormalizedDrawerSideProfile): Point2D[] {
    const { r_x, railBottomY, railTopY, r_w, r_rw, r_ad, r_lw } = p;
    return [
        [r_x, railBottomY],
        [r_x, railTopY],
        [r_x + r_w, railTopY],
        [r_x + r_w, railBottomY],
        [r_x + r_w - r_rw, railBottomY],
        [r_x + r_w - r_rw, railBottomY + r_ad],
        [r_x + r_lw, railBottomY + r_ad],
        [r_x + r_lw, railBottomY],
    ];
}

/**
 * Buduje komplet 3 pętli 2D (boczek, mocowanie, prowadnica) z parametrów wejściowych.
 */
export function buildDrawerSideLoops2D(raw: DrawerSideProfileInput = {}): DrawerSideLoops2DResult {
    const params = normalizeDrawerSideProfile(raw);
    return {
        params,
        boczek: buildBoczekLoop2D(params),
        mocowanie: buildMocowanieLoop2D(params),
        prowadnica: buildProwadnicaLoop2D(params),
    };
}

/**
 * Pomocnicza konwersja pętli 2D do ścieżki SVG (d="M ... L ... Z").
 */
export function loop2DToSvgPath(loop: Point2D[]): string {
    if (!loop.length) return '';
    return loop.map((pt, i) => `${i === 0 ? 'M ' : 'L '}${pt[0].toFixed(2)},${pt[1].toFixed(2)}`).join(' ') + ' Z';
}

function signedArea2D(pts: Point2D[]): number {
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % n];
        area += x0 * y1 - x1 * y0;
    }
    return area / 2;
}

function ensureCCW2D(pts: Point2D[]): Point2D[] {
    if (pts.length < 3) return pts;
    return signedArea2D(pts) < 0 ? [...pts].reverse() : [...pts];
}

/**
 * Wyciąga pojedynczą zamkniętą pętlę 2D (X, Y) wzdłuż osi Z (od 0 do depthMm) jako siatkę Babylon.Mesh.
 * Dla prawej strony (side === 'right') odbija współrzędne X -> -X przed normalizacją orientacji CCW.
 */
export function extrudeLoop2DToBabylonMesh(
    name: string,
    loop2D: Point2D[],
    depthMm: number,
    side: 'left' | 'right',
    material: any,
    scene: any
): any {
    if (typeof BABYLON === 'undefined' || !scene || loop2D.length < 3) return null;

    const len = Math.max(1, depthMm);
    const orientedPts: Point2D[] = loop2D.map(([x, y]) => [side === 'right' ? -x : x, y]);
    const ccwPts = ensureCCW2D(orientedPts);
    const n = ccwPts.length;

    const flat2D: number[] = [];
    for (const [x, y] of ccwPts) {
        flat2D.push(x, y);
    }
    const capTriangles = earcut(flat2D);

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // 1. Zaślepka przednia (z = 0, normalna [0, 0, -1])
    const frontStartIdx = 0;
    for (const [x, y] of ccwPts) {
        positions.push(x, y, 0);
        normals.push(0, 0, -1);
    }
    for (let t = 0; t < capTriangles.length; t += 3) {
        const i0 = capTriangles[t];
        const i1 = capTriangles[t + 1];
        const i2 = capTriangles[t + 2];
        indices.push(frontStartIdx + i0, frontStartIdx + i1, frontStartIdx + i2);
    }

    // 2. Zaślepka tylna (z = len, normalna [0, 0, +1])
    const backStartIdx = positions.length / 3;
    for (const [x, y] of ccwPts) {
        positions.push(x, y, len);
        normals.push(0, 0, 1);
    }
    for (let t = 0; t < capTriangles.length; t += 3) {
        const i0 = capTriangles[t];
        const i1 = capTriangles[t + 1];
        const i2 = capTriangles[t + 2];
        indices.push(backStartIdx + i0, backStartIdx + i2, backStartIdx + i1);
    }

    // 3. Ścianki boczne wzdłuż ekstruzji Z (z twardymi normalnymi dla każdej krawędzi pętli)
    for (let i = 0; i < n; i++) {
        const [x0, y0] = ccwPts[i];
        const [x1, y1] = ccwPts[(i + 1) % n];
        const dx = x1 - x0;
        const dy = y1 - y0;
        const segLen = Math.hypot(dx, dy);
        if (segLen < 1e-6) continue;

        // Zewnętrzna normalna dla pętli CCW: (dy / L, -dx / L, 0)
        const nx = dy / segLen;
        const ny = -dx / segLen;

        const base = positions.length / 3;
        positions.push(
            x0, y0, 0,
            x1, y1, 0,
            x1, y1, len,
            x0, y0, len
        );
        normals.push(
            nx, ny, 0,
            nx, ny, 0,
            nx, ny, 0,
            nx, ny, 0
        );
        indices.push(
            base, base + 2, base + 1,
            base, base + 3, base + 2
        );
    }

    const mesh = new BABYLON.Mesh(name, scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.indices = indices;
    vertexData.applyToMesh(mesh);

    if (material) {
        mesh.material = material;
    }
    return mesh;
}

function getOrCreateDrawerMaterial(
    scene: any,
    matName: string,
    diffuseRgb: [number, number, number],
    specularRgb: [number, number, number] = [0.6, 0.6, 0.65],
    specularPower = 36
): any {
    let mat = scene.getMaterialByName?.(matName);
    if (!mat) {
        mat = new BABYLON.StandardMaterial(matName, scene);
        mat.diffuseColor = new BABYLON.Color3(diffuseRgb[0], diffuseRgb[1], diffuseRgb[2]);
        mat.specularColor = new BABYLON.Color3(specularRgb[0], specularRgb[1], specularRgb[2]);
        mat.specularPower = specularPower;
        mat.backFaceCulling = false;
    }
    return mat;
}

export interface CreateParametricDrawerSideMeshOptions {
    id?: string;
    side?: 'left' | 'right';
    lengthMm?: number;
    corpusHeightMm?: number;
    profile?: DrawerSideProfileInput;
    boczekLenMm?: number;
    mocowanieLenMm?: number;
    prowadnicaLenMm?: number;
}

/**
 * Buduje kompletny zespół 3D boczka szuflady (① Boczek, ② Mocowanie, ③ Prowadnica N)
 * poprzez wyciągnięcie (extrude) 3 pętli 2D wygenerowanych przez funkcje parametryczne.
 * Długości wyciągnięcia sterowane są z JSON (boczek_len, mocowanie_len, prowadnica_len)
 * lub z domyślnych reguł systemowych:
 *  - Boczek: L
 *  - Prowadnica: L + 8 mm
 *  - Mocowanie: dla 270..350 -> 260 mm, dla 400..450 -> 290 mm, dla 500..550 -> 320 mm
 */
export function createParametricDrawerSideMesh(
    opts: CreateParametricDrawerSideMeshOptions,
    scene: any
): any {
    if (typeof BABYLON === 'undefined' || !scene) return null;

    const side = opts.side === 'right' ? 'right' : 'left';
    const lengthMm = Math.max(50, numOr(opts.lengthMm, 500));
    const corpusHeightMm = Math.max(40, numOr(opts.corpusHeightMm ?? opts.profile?.b_h, 178));

    // Domyślne reguły różnicowania wyciągnięć:
    const defaultMocowanieLen = lengthMm <= 350 ? 260 : (lengthMm <= 450 ? 290 : 320);
    const boczekDepth = Math.max(10, numOr(
        opts.boczekLenMm ?? opts.profile?.boczek_len ?? opts.profile?.boczekLen,
        lengthMm
    ));
    const mocowanieDepth = Math.max(10, numOr(
        opts.mocowanieLenMm ?? opts.profile?.mocowanie_len ?? opts.profile?.mocowanieLen,
        defaultMocowanieLen
    ));
    const prowadnicaDepth = Math.max(10, numOr(
        opts.prowadnicaLenMm ?? opts.profile?.prowadnica_len ?? opts.profile?.prowadnicaLen,
        lengthMm + 8
    ));

    const loops = buildDrawerSideLoops2D({
        ...opts.profile,
        b_h: corpusHeightMm,
        m_h: opts.profile?.m_h ?? 60,
        boczek_len: boczekDepth,
        mocowanie_len: mocowanieDepth,
        prowadnica_len: prowadnicaDepth
    });

    const stamp = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const root = new BABYLON.TransformNode(`hw_drawer_param_${opts.id || 'side'}_${side}_${stamp}`, scene);

    const matBoczek = getOrCreateDrawerMaterial(scene, 'b1_drawer_boczek_mat', [0.22, 0.26, 0.32], [0.55, 0.58, 0.62], 32);
    const matMocowanie = getOrCreateDrawerMaterial(scene, 'b1_drawer_mocowanie_mat', [0.72, 0.53, 0.34], [0.5, 0.45, 0.4], 28);
    const matProwadnica = getOrCreateDrawerMaterial(scene, 'b1_drawer_prowadnica_mat', [0.68, 0.74, 0.78], [0.85, 0.88, 0.9], 48);

    const meshBoczek = extrudeLoop2DToBabylonMesh(
        `drawer_boczek_${side}_${stamp}`,
        loops.boczek,
        boczekDepth,
        side,
        matBoczek,
        scene
    );
    const meshMocowanie = extrudeLoop2DToBabylonMesh(
        `drawer_mocowanie_${side}_${stamp}`,
        loops.mocowanie,
        mocowanieDepth,
        side,
        matMocowanie,
        scene
    );
    const meshProwadnica = extrudeLoop2DToBabylonMesh(
        `drawer_prowadnica_${side}_${stamp}`,
        loops.prowadnica,
        prowadnicaDepth,
        side,
        matProwadnica,
        scene
    );

    if (meshBoczek) {
        meshBoczek.metadata = {
            subType: 'boczek',
            subName: side === 'left' ? 'Boczek L' : 'Boczek P',
            lengthMm: boczekDepth,
        };
        try {
            meshBoczek.enableEdgesRendering?.(0.99);
            meshBoczek.edgesWidth = 1.5;
            meshBoczek.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 0.7);
        } catch { /* ignore */ }
    }

    if (meshMocowanie) {
        meshMocowanie.metadata = {
            subType: 'mocowanie',
            subName: side === 'left' ? 'Mocowanie L' : 'Mocowanie P',
            lengthMm: mocowanieDepth,
        };
        try {
            meshMocowanie.enableEdgesRendering?.(0.99);
            meshMocowanie.edgesWidth = 1.5;
            meshMocowanie.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 0.7);
        } catch { /* ignore */ }
    }

    if (meshProwadnica) {
        meshProwadnica.metadata = {
            subType: 'prowadnica',
            subName: side === 'left' ? 'Prowadnica L' : 'Prowadnica P',
            lengthMm: prowadnicaDepth,
        };
        try {
            meshProwadnica.enableEdgesRendering?.(0.99);
            meshProwadnica.edgesWidth = 1.5;
            meshProwadnica.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 0.7);
        } catch { /* ignore */ }
    }

    for (const child of [meshMocowanie, meshProwadnica, meshBoczek]) {
        if (child) {
            child.parent = root;
            child.isPickable = true;
        }
    }

    (root as any).subMeshes = {
        boczek: meshBoczek,
        mocowanie: meshMocowanie,
        prowadnica: meshProwadnica,
    };

    const profileKey = JSON.stringify({
        side,
        lengthMm: Math.round(lengthMm * 100) / 100,
        corpusHeightMm: Math.round(corpusHeightMm * 100) / 100,
        boczekDepth,
        mocowanieDepth,
        prowadnicaDepth,
        params: loops.params
    });

    root.metadata = {
        isParametricDrawerSide: true,
        side,
        lengthMm,
        corpusHeightMm,
        boczekDepth,
        mocowanieDepth,
        prowadnicaDepth,
        profileKey,
        loops
    };

    return root;
}

