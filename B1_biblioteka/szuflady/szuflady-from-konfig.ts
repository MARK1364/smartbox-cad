/**
 * Adapter: wspólny katalog szuflad (mm, warianty z konfiguracji szuflad)
 * → rekordy RAIL.
 */
/** CAD-only: stałe gabaryty prowadnicy w milimetrach (mm) */
const CAD_RAIL_HEIGHT_MM = 35.0;
const CAD_RAIL_WIDTH_MM = 27.0;

const PRICE_PREFIX: Record<string, string> = {
    M94: 'BLUM_ANTARO_M_'
};

export const DEFAULT_RAIL_ID = 'M94';

export function railsFromKonfig(konfig: { szuflady?: any[] }): any[] {
    const items: any[] = [];
    for (const seria of konfig.szuflady || []) {
        for (const w of seria.warianty || []) {
            const lengths: Record<string, any> = {};
            for (const d of w.warianty_dlugosci || []) {
                const key = String(d.dlugosc);
                const prefix = PRICE_PREFIX[w.id_wariantu];
                lengths[key] = {
                    z_offset: Number(w.dystans_otworow_od_dolu ?? 33),
                    x_positions: (d.otwory_pozycje || []).map(Number),
                    ...(prefix ? { price_id: `${prefix}${key}` } : {})
                };
            }
            const construction = w.construction || seria.construction || (seria.id === 'tandem' ? 'WOODEN' : 'SYSTEM');
            const panels = w.panels || seria.panels;
            items.push({
                id: w.id_wariantu,
                type: 'RAIL',
                name: w.nazwa || seria.nazwa || w.id_wariantu,
                brand: seria.producent,
                usable_in: ['DRAWERS'],
                construction,
                ...(panels ? { panels } : {}),
                mount: {
                    rail_height: CAD_RAIL_HEIGHT_MM,
                    corpus_height: Number(w.wysokosc_skrzynki ?? 94),
                    width: CAD_RAIL_WIDTH_MM
                },
                drill: {
                    dia: (Number(w.promien ?? 1.5)) * 2,
                    depth: Number(w.glebokosc ?? 12)
                },
                front_holes: {
                    x_offset: Number(w.dystans_otworow_front_od_boku ?? 31),
                    z_positions: (w.otwory_front_pozycje || []).map(Number),
                    depth: Number(w.glebokosc_front ?? 10)
                },
                lengths
            });
        }
    }
    return items;
}
