/**
 * Adapter: wspólny katalog szuflad (mm, warianty z drugiej aplikacji)
 * → rekordy RAIL w metrach. Silnika drawers-engine nie zmienia.
 */
const MM_TO_M = 0.001;

/** CAD-only: nie ma ich we wspólnym pliku. */
const CAD_RAIL_HEIGHT_M = 0.035;
const CAD_RAIL_WIDTH_M = 0.027;

const PRICE_PREFIX: Record<string, string> = {
    M94: 'BLUM_ANTARO_M_'
};

export const DEFAULT_RAIL_ID = 'M94';

function mmToM(n: number): number {
    return Number(n) * MM_TO_M;
}

export function railsFromKonfig(konfig: { szuflady?: any[] }): any[] {
    const items: any[] = [];
    for (const seria of konfig.szuflady || []) {
        for (const w of seria.warianty || []) {
            const lengths: Record<string, any> = {};
            for (const d of w.warianty_dlugosci || []) {
                const key = String(d.dlugosc);
                const prefix = PRICE_PREFIX[w.id_wariantu];
                lengths[key] = {
                    z_offset: mmToM(w.dystans_otworow_od_dolu),
                    x_positions: (d.otwory_pozycje || []).map(mmToM),
                    ...(prefix ? { price_id: `${prefix}${key}` } : {})
                };
            }
            items.push({
                id: w.id_wariantu,
                type: 'RAIL',
                name: w.nazwa || seria.nazwa || w.id_wariantu,
                brand: seria.producent,
                usable_in: ['DRAWERS'],
                mount: {
                    rail_height: CAD_RAIL_HEIGHT_M,
                    corpus_height: mmToM(w.wysokosc_skrzynki),
                    width: CAD_RAIL_WIDTH_M
                },
                drill: {
                    dia: mmToM((w.promien ?? 1.5) * 2),
                    depth: mmToM(w.glebokosc ?? 12)
                },
                front_holes: {
                    x_offset: mmToM(w.dystans_otworow_front_od_boku ?? 31),
                    z_positions: (w.otwory_front_pozycje || []).map(mmToM),
                    depth: mmToM(w.glebokosc_front ?? 10)
                },
                lengths
            });
        }
    }
    return items;
}
