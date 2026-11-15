/**
 * P1_platforma/platforma-store.ts
 *
 * Zarządza bazą mebli na platformie:
 * - łączy wbudowany katalog z meblami zapisanymi przez użytkownika w programie CAD,
 * - zapewnia most do wstawiania mebli bezpośrednio do otwartej sceny Crevo CAD.
 */

import type { FurnitureCatalogItem, FurnitureCategory } from './platforma-types.js';
import { INITIAL_FURNITURE_CATALOG } from './sample-furniture-catalog.js';
import { cabinetLibraryStore } from '../B1_biblioteka/korpusy/cabinet-library-store.js';
import type { CabinetTemplate } from '../B1_biblioteka/korpusy/types.js';

export function templateToCatalogItem(template: CabinetTemplate): FurnitureCatalogItem {
    const w = template.dimensions.szerokosc_mm;
    const h = template.dimensions.wysokosc_mm;
    const d = template.dimensions.glebokosc_mm;

    const catMap: Record<string, FurnitureCategory> = {
        dolne: 'DOLNE',
        gorne: 'WISZACE',
        slupki: 'SLUPKI',
        inne: 'BIURO_POKOJ'
    };
    const catLabelMap: Record<string, string> = {
        dolne: 'Szafki dolne',
        gorne: 'Szafki wiszące',
        slupki: 'Słupki wysokie',
        inne: 'Komody i biuro'
    };

    let drawerCount = 0;
    let doorCount = 0;
    let shelfCount = 0;
    let flapCount = 0;

    for (const sub of template.submodules || []) {
        if (sub.type === 'blok_drawers' || sub.boxType === 'DRAWERS') {
            drawerCount += Number(sub.params?.drawerCount || 1);
        } else if (sub.type === 'blok_doors' || sub.boxType === 'DOORS') {
            doorCount += Number(sub.params?.doorCount || 1);
        } else if (sub.type === 'blok_shelves' || sub.boxType === 'SHELVES') {
            shelfCount += Number(sub.params?.shelfCount || 1);
        } else if (sub.type === 'blok_flaps' || sub.boxType === 'FLAPS') {
            flapCount += Number(sub.params?.flapCount || 1);
        }
    }

    return {
        id: template.id,
        code: `USR-${template.id.slice(-6).toUpperCase()}`,
        name: template.name,
        category: catMap[template.category] || 'DOLNE',
        categoryLabel: catLabelMap[template.category] || 'Własne projekty',
        dimensions: { width_mm: w, height_mm: h, depth_mm: d },
        description: template.description || 'Mebel zapisany z programu Crevo CAD.',
        tags: ['własny mebel', 'zapisany', template.category],
        korpusType: 'korpus3',
        thumbnailSvg: template.thumbnail,
        drawerCount: drawerCount || undefined,
        doorCount: doorCount || undefined,
        shelfCount: shelfCount || undefined,
        flapCount: flapCount || undefined,
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: w,
            height_mm: h,
            depth_mm: d,
            bloki: (template.submodules || []).map((sub) => ({
                kind: sub.type,
                params: sub.params || {}
            }))
        }
    };
}

export function catalogItemToTemplate(item: FurnitureCatalogItem): CabinetTemplate {
    const w = item.dimensions.width_mm;
    const h = item.dimensions.height_mm;
    const d = item.dimensions.depth_mm;

    const submodules: any[] = [];
    if (item.drawerCount && item.drawerCount > 0) {
        submodules.push({
            type: 'blok_drawers',
            boxType: 'DRAWERS',
            label: `Szuflady (${item.drawerCount})`,
            zoneIndex: 0,
            params: {
                drawerCount: item.drawerCount,
                layout: item.drawerCount === 3 ? '1_small_2_large' : 'equal',
                front_gap_mm: 3
            }
        });
    } else if (item.doorCount && item.doorCount > 0) {
        if (item.category === 'NAROZNE') {
            submodules.push({
                type: 'blok_corner_doors',
                boxType: 'CORNER_DOORS',
                label: 'Drzwi narożne',
                zoneIndex: 0,
                params: {}
            });
        } else {
            submodules.push({
                type: 'blok_doors',
                boxType: 'DOORS',
                label: `Drzwi (${item.doorCount})`,
                zoneIndex: 0,
                params: {
                    doorCount: item.doorCount,
                    side: item.doorCount === 1 ? 'LEFT' : 'DOUBLE'
                }
            });
        }
    }

    if (item.shelfCount && item.shelfCount > 0) {
        submodules.push({
            type: 'blok_shelves',
            boxType: 'SHELVES',
            label: `Półki (${item.shelfCount})`,
            zoneIndex: 0,
            params: {
                shelfCount: item.shelfCount
            }
        });
    }

    if (item.flapCount && item.flapCount > 0) {
        submodules.push({
            type: 'blok_flaps',
            boxType: 'FLAPS',
            label: 'Klapa',
            zoneIndex: 0,
            params: {
                flapCount: item.flapCount
            }
        });
    }

    const catMap: Record<string, 'dolne' | 'gorne' | 'slupki' | 'inne'> = {
        DOLNE: 'dolne',
        WISZACE: 'gorne',
        SLUPKI: 'slupki',
        NAROZNE: 'dolne',
        SZAFY: 'slupki',
        BIURO_POKOJ: 'inne'
    };

    return {
        id: item.id,
        name: item.name,
        category: catMap[item.category] || 'dolne',
        units: 'mm',
        description: item.description,
        thumbnail: item.thumbnailSvg,
        dimensions: {
            szerokosc_mm: w,
            wysokosc_mm: h,
            glebokosc_mm: d,
            cokolHeight: item.category === 'WISZACE' ? 0 : 100
        },
        frameParams: {
            liczba_stref: 1,
            wysokosc_strefy_dolnej_mm: h,
            cofniecie_plecow_mm: 3
        },
        submodules
    };
}

/**
 * Zwraca połączony katalog: modele wbudowane + zapisane przez użytkownika.
 */
export function getAllPlatformItems(): FurnitureCatalogItem[] {
    const userTemplates = cabinetLibraryStore.getAll();
    const userItems = userTemplates.map(templateToCatalogItem);
    return [...userItems, ...INITIAL_FURNITURE_CATALOG];
}

/**
 * Wysyła mebel do otwartej sceny programu Crevo CAD.
 * Jeśli program jest otwarty w innej karcie, następuje natychmiastowe wstawienie.
 * W przeciwnym razie otwiera program w nowej karcie.
 */
export function sendFurnitureToCrevoScene(item: FurnitureCatalogItem): boolean {
    const template = catalogItemToTemplate(item);
    const payload = {
        action: 'insert_cabinet',
        template,
        timestamp: Date.now()
    };

    try {
        if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('crevo_platform_channel');
            bc.postMessage(payload);
            bc.close();
        }
    } catch { /* ignore */ }

    try {
        localStorage.setItem('crevo_import_to_scene', JSON.stringify(payload));
    } catch { /* ignore */ }

    return true;
}
