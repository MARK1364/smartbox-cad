/**
 * SmartPanel — sztywna topologia komórki pierwotnej (prostopadłościan).
 * 8 narożników, 12 krawędzi, 6 ścian. Niezależne od wymiarów i otworów.
 */

// ---------------------------------------------------------------------------
// Identyfikatory
// ---------------------------------------------------------------------------

export const NAROZNIKI = [
    "tyl_dol_lewo",      // 0
    "tyl_dol_prawo",     // 1
    "przod_dol_prawo",   // 2
    "przod_dol_lewo",    // 3
    "tyl_gora_lewo",     // 4
    "tyl_gora_prawo",    // 5
    "przod_gora_prawo",  // 6
    "przod_gora_lewo",   // 7
];

export const KRAWEDZIE: Record<string, [number, number]> = {
    "dol_tyl": [0, 1],
    "dol_przod": [3, 2],
    "gora_tyl": [4, 5],
    "gora_przod": [7, 6],
    "tyl_lewo": [0, 4],
    "tyl_prawo": [1, 5],
    "przod_lewo": [3, 7],
    "przod_prawo": [2, 6],
    "dol_lewo": [0, 3],
    "dol_prawo": [1, 2],
    "gora_lewo": [4, 7],
    "gora_prawo": [5, 6],
};

// Ściany: 4 indeksy narożników CCW patrząc od zewnątrz (normalna na zewnątrz)
export const SCIANY: Record<string, [number, number, number, number]> = {
    "front": [3, 2, 6, 7],
    "tyl": [1, 0, 4, 5],
    "prawa": [2, 1, 5, 6],
    "lewa": [0, 3, 7, 4],
    "dol": [0, 1, 2, 3],
    "gora": [4, 7, 6, 5],
};

interface FrameDefinition {
    corners: [number, number, number, number];
    u: "X" | "Y" | "Z";
    v: "X" | "Y" | "Z";
}

// Lokalny układ 2D ściany: (u,v) w mm — który narożnik = (0,0), które osie
// (i0, os_u idzie do i1, os_v idzie do i3) — prostokąt w przestrzeni narożników
export const SCIANA_RAMKA: Record<string, FrameDefinition> = {
    "front": { corners: [3, 2, 6, 7], u: "X", v: "Y" },
    "tyl":   { corners: [1, 0, 4, 5], u: "X", v: "Y" },
    "prawa": { corners: [2, 1, 5, 6], u: "Z", v: "Y" },
    "lewa":  { corners: [0, 3, 7, 4], u: "Z", v: "Y" },
    "dol":   { corners: [0, 1, 2, 3], u: "X", v: "Z" },
    "gora":  { corners: [4, 7, 6, 5], u: "X", v: "Z" },
};

export const KRAWEDZ_ALIASY: Record<string, string> = {
    "przod": "front", "front": "front",
    "tyl": "tyl", "back": "tyl",
    "lewa": "lewa", "left": "lewa",
    "prawa": "prawa", "right": "prawa",
    "dol": "dol", "bottom": "dol",
    "gora": "gora", "top": "gora",
};

export const LISTA_SCIAN = ["front", "tyl", "prawa", "lewa", "dol", "gora"];

// ---------------------------------------------------------------------------
//  RELACJE B-REP (lekka warstwa — tylko dane, liczone raz)
//  Pozwalają feature'om (fillet, faza, wpust) pytać topologię o sąsiedztwo,
//  zamiast pisać geometrię osobno dla każdej krawędzi.
// ---------------------------------------------------------------------------

// Każda z 12 krawędzi graniczy z DOKŁADNIE dwiema ścianami.
export const KRAWEDZ_SCIANY: Record<string, [string, string]> = {
    "dol_tyl":     ["dol", "tyl"],
    "dol_przod":   ["dol", "front"],
    "gora_tyl":    ["gora", "tyl"],
    "gora_przod":  ["gora", "front"],
    "tyl_lewo":    ["tyl", "lewa"],
    "tyl_prawo":   ["tyl", "prawa"],
    "przod_lewo":  ["front", "lewa"],
    "przod_prawo": ["front", "prawa"],
    "dol_lewo":    ["dol", "lewa"],
    "dol_prawo":   ["dol", "prawa"],
    "gora_lewo":   ["gora", "lewa"],
    "gora_prawo":  ["gora", "prawa"],
};

// Normalna zewnętrzna każdej ściany (kierunek jednostkowy w przestrzeni obiektu).
export const SCIANA_NORMALNA: Record<string, [number, number, number]> = {
    "front": [0.0, 0.0, 1.0],
    "tyl":   [0.0, 0.0, -1.0],
    "prawa": [1.0, 0.0, 0.0],
    "lewa":  [-1.0, 0.0, 0.0],
    "gora":  [0.0, 1.0, 0.0],
    "dol":   [0.0, -1.0, 0.0],
};

export function scianyKrawedzi(krawedz: string): [string, string] | undefined {
    /** Zwraca 2 ściany sąsiadujące z krawędzią (relacja B-rep edge→faces). */
    return KRAWEDZ_SCIANY[krawedz];
}

export function krawedzieSciany(sciana: string): string[] {
    /** Zwraca krawędzie należące do ściany (relacja B-rep face→edges). */
    const edges: string[] = [];
    for (const [k, pair] of Object.entries(KRAWEDZ_SCIANY)) {
        if (pair.includes(sciana)) {
            edges.push(k);
        }
    }
    return edges;
}

// Pozycje kanoniczne narożników — indeks → (x, y, z) jako funkcja wymiarów
// x∈{0,X}, y∈{0,Y}, z∈{0,Z}
type Coord = number | "X" | "Y" | "Z";
export const NAROZNIK_WSPOLRZEDNE: [Coord, Coord, Coord][] = [
    [0, 0, 0],  // 0 tyl_dol_lewo
    ["X", 0, 0],
    ["X", 0, "Z"],
    [0, 0, "Z"],
    [0, "Y", 0],
    ["X", "Y", 0],
    ["X", "Y", "Z"],
    [0, "Y", "Z"],
];
