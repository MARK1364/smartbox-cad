/**
 * A7_material/material-processing.ts
 * Kody kategorii materiału + routing ścieżki obróbki.
 *
 * Problem: `category` w bazie to wolny polski tekst ("Płyta Wiórowa", "Inne").
 * Routing po takim polu padnie przy pierwszej literówce / tłumaczeniu.
 * Dlatego logika używa TYLKO kodów MaterialCategoryCode; polskie nazwy
 * zostają w warstwie display (filtr UI, cennik).
 */

export type MaterialCategoryCode =
    | 'BOARD'       // płyta meblowa (wiórowa, MDF, laminowana) -> piła + CNC
    | 'SOLID_WOOD'  // lite drewno -> piła + CNC (inne parametry)
    | 'GLASS'       // szkło -> ścieżka szklarska
    | 'MIRROR'      // lustro -> ścieżka szklarska (osobny dostawca)
    | 'FOAM'        // pianka tapicerska -> tapicer (nóż, brak obrzeża i nawierceń systemowych)
    | 'OTHER';      // nierozpoznana -> brak routingu (jawny UNRESOLVED, nie zgadywanie)

/** Dokąd element trafia po wygenerowaniu planu. */
export type ProcessingPath =
    | 'SAW_CNC'     // piła + centrum CNC (płyty)
    | 'GLASS_SHOP'  // szklarz (szkło, lustra)
    | 'UPHOLSTERY'  // tapicer (pianki)
    | 'PURCHASE'    // zakup gotowy (okucia: HARDWARE z library_id)
    | 'UNRESOLVED'; // brak danych do routingu — element NIE trafia na żadną listę po cichu

/**
 * Mapowanie legacy: wolna polska nazwa kategorii z bazy -> kod.
 * Używane na brzegu (wczytywanie bazy / import), nigdy w logice decyzyjnej.
 */
export function mapLegacyCategoryName(name: string | null | undefined): MaterialCategoryCode {
    const n = String(name || '').toLowerCase();
    if (!n) return 'OTHER';
    if (n.includes('wiórowa') || n.includes('wiorowa') || n.includes('laminowan') ||
        n.includes('mdf') || n.includes('płyta') || n.includes('plyta')) return 'BOARD';
    if (n.includes('lite drewno') || n.includes('drewno lite') || n.includes('solid')) return 'SOLID_WOOD';
    if (n.includes('lustr') || n.includes('mirror')) return 'MIRROR';
    if (n.includes('szkł') || n.includes('szkl') || n.includes('glass') || n.includes('antisol')) return 'GLASS';
    if (n.includes('piank') || n.includes('foam') || n.includes('tapicer')) return 'FOAM';
    return 'OTHER';
}

export interface RoutableNode {
    nodeType?: string;
    role?: string;
    /** Kod kategorii (preferowany) albo legacy nazwa — resolver zmapuje. */
    materialCategory?: MaterialCategoryCode | string | null;
    /** Okucie kupowane ma zawsze library_id (B1_biblioteka). */
    library_id?: string | null;
}

/**
 * Jedyny dozwolony sposób wyznaczania ścieżki obróbki.
 * Strict: nieznane -> UNRESOLVED (element widoczny jako nieroutingowany, nie "gdzieś" po cichu).
 */
export function resolveProcessingPath(node: RoutableNode | null | undefined): ProcessingPath {
    if (!node) return 'UNRESOLVED';
    const nodeType = String(node.nodeType || '').toUpperCase();
    const role = String(node.role || '').toUpperCase();

    // Okucie kupowane: HARDWARE albo rola sprzętowa z katalogiem. Nigdy piła.
    if (nodeType === 'HARDWARE') return 'PURCHASE';
    if ((role === 'HINGE_LOCATOR' || role === 'PROWADNICA' || role === 'RAIL' ||
        role === 'HOLDER' || role === 'LED' || role === 'BOX') && node.library_id) return 'PURCHASE';

    if (nodeType === 'PART') {
        const raw = node.materialCategory;
        const code: MaterialCategoryCode = raw === 'BOARD' || raw === 'SOLID_WOOD' || raw === 'GLASS' ||
            raw === 'MIRROR' || raw === 'FOAM' || raw === 'OTHER'
            ? raw
            : mapLegacyCategoryName(typeof raw === 'string' ? raw : null);
        switch (code) {
            case 'BOARD':
            case 'SOLID_WOOD':
                return 'SAW_CNC';
            case 'GLASS':
            case 'MIRROR':
                return 'GLASS_SHOP';
            case 'FOAM':
                return 'UPHOLSTERY';
            default:
                return 'UNRESOLVED';
        }
    }

    return 'UNRESOLVED';
}
