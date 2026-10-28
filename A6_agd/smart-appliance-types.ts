/**
 * A6_agd — smart-appliance-types.ts
 * Typy domenowe i parametry sprzętów AGD.
 * Jednostki parametrów konfiguracyjnych w JSON / UI: milimetry [mm].
 * Konwersja do jednostek domenowych (nm) następuje na brzegu przez mmToNm.
 */

export const SMART_APPLIANCE_TYPE = 'smart_appliance';

export type ApplianceKind = 'MICROWAVE' | 'OVEN' | 'DISHWASHER' | 'HOB' | 'FRIDGE' | 'OTHER';

export interface MicrowaveParamsMm {
    /** Całkowita wysokość frontu szklanego [mm] (np. 380 mm) */
    frontHeight: number;
    /** Wysunięcie / nałożenie górne frontu ponad korpus mikrofali [mm] (np. 20 mm) */
    nalGoraMicro: number;
    /** Wysunięcie / nałożenie dolne frontu poniżej korpusu mikrofali [mm] (np. 8 mm) */
    nalDolneMicro: number;
    /** Szerokość frontu [mm] (np. 595 mm) */
    frontWidth: number;
    /** Grubość / głębokość frontu szklanego [mm] (np. 20 mm) */
    frontDepth: number;
    /** Szerokość korpusu wnękowego mikrofali [mm] (np. 560 mm) */
    corpusWidth: number;
    /** Głębokość korpusu wchodzącego do szafki [mm] (np. 320 mm) */
    corpusDepth: number;
    /** Opcjonalna głębokość wnęki meblowej [mm] (jeśli zadokowano we wnęce) */
    bayDepth?: number;
}

export interface OvenParamsMm {
    /** Wysokość frontu piekarnika [mm] (np. 596 mm) */
    frontHeight: number;
    /** Nałożenie górne frontu piekarnika na korpus [mm] (np. 20 mm) */
    nalGoraOven: number;
    /** Nałożenie dolne frontu piekarnika [mm] (np. 0 mm) */
    nalDolneOven: number;
    /** Szerokość frontu [mm] (np. 595 mm) */
    frontWidth: number;
    /** Grubość frontu [mm] (np. 22 mm) */
    frontDepth: number;
    /** Szerokość korpusu [mm] (np. 560 mm) */
    corpusWidth: number;
    /** Głębokość korpusu wchodzącego do szafki [mm] (np. 550 mm) */
    corpusDepth: number;
    /** Opcjonalna głębokość wnęki meblowej [mm] (jeśli zadokowano we wnęce) */
    bayDepth?: number;
}

export type FridgeDoorLayout = 'TOP_BOTTOM' | 'SIDE_BY_SIDE' | 'SINGLE';

export interface FridgeParamsMm {
    /** Całkowita wysokość lodówki [mm] (np. 1775 mm lub 1850 mm) */
    totalHeight?: number;
    /** Układ drzwi: 'TOP_BOTTOM' (góra/dół), 'SIDE_BY_SIDE' (2 drzwi w pionie), 'SINGLE' (1 drzwi) */
    doorLayout?: FridgeDoorLayout;
    /** Czy lodówka jest wolnostojąca (nie do zabudowy) */
    isFreestanding?: boolean;
    /** Wysokość dolnych drzwi lodówki [mm] (np. 714 mm) */
    frontBottomHeight: number;
    /** Wyliczana wysokość górnych drzwi lodówki [mm] (np. 1006 mm) */
    frontTopHeight?: number;
    /** Szczelina techniczna między drzwiami lodówki [mm] (np. 15 mm) */
    doorGap: number;
    /** Szerokość korpusu lodówki oraz drzwi [mm] (np. 550, 600 lub 900 mm) */
    corpusWidth: number;
    /** Głębokość korpusu lodówki wsuwanego we wnękę [mm] (np. 545 lub 650 mm) */
    corpusDepth: number;
    /** Grubość drzwi lodówki [mm] (np. 45 mm) */
    doorDepth?: number;
    /** Wysokość dolnego cokołu technicznego / wlotu wentylacji [mm] (np. 40 mm) */
    plinthHeight?: number;
    /** Wykończenie drzwi lodówki: 'WHITE' (białe AGD), 'INOX' (stal szlachetna) lub 'BLACK' (czarny mat) */
    finish?: 'WHITE' | 'INOX' | 'BLACK';
    /** Opcjonalna głębokość wnęki meblowej [mm] (jeśli zadokowano we wnęce) */
    bayDepth?: number;
    /** Kompatybilność wsteczna: opcjonalna szerokość [mm] */
    frontWidth?: number;
    /** Kompatybilność wsteczna: opcjonalna grubość frontu [mm] */
    frontDepth?: number;
    /** Kompatybilność wsteczna */
    nalGora?: number;
    /** Kompatybilność wsteczna */
    nalDolne?: number;
}

export type ApplianceParamsMm = MicrowaveParamsMm | OvenParamsMm | FridgeParamsMm | Record<string, any>;

export interface ApplianceTemplateItem {
    id: string;
    name: string;
    kind: ApplianceKind;
    source: 'PARAMETRIC' | 'GLB';
    description?: string;
    thumbnail?: string;
    glbPath?: string;
    defaultParams?: ApplianceParamsMm;
}

export const DEFAULT_MICROWAVE_PARAMS: MicrowaveParamsMm = {
    frontHeight: 380,
    nalGoraMicro: 20,
    nalDolneMicro: 8,
    frontWidth: 595,
    frontDepth: 20,
    corpusWidth: 560,
    corpusDepth: 320,
};

export const DEFAULT_OVEN_PARAMS: OvenParamsMm = {
    frontHeight: 596,
    nalGoraOven: 20,
    nalDolneOven: 0,
    frontWidth: 595,
    frontDepth: 22,
    corpusWidth: 560,
    corpusDepth: 550,
};

export const DEFAULT_FRIDGE_PARAMS: FridgeParamsMm = {
    totalHeight: 1850,
    doorLayout: 'SIDE_BY_SIDE',
    isFreestanding: true,
    frontBottomHeight: 714,
    frontTopHeight: 1132,
    doorGap: 4,
    corpusWidth: 900,
    corpusDepth: 650,
    doorDepth: 45,
    plinthHeight: 0,
    finish: 'INOX',
    frontWidth: 900,
    frontDepth: 45,
    nalGora: 0,
    nalDolne: 0,
};

export const DEFAULT_FREESTANDING_FRIDGE_PARAMS: FridgeParamsMm = {
    totalHeight: 1850,
    doorLayout: 'SIDE_BY_SIDE',
    isFreestanding: true,
    frontBottomHeight: 714,
    frontTopHeight: 1132,
    doorGap: 4,
    corpusWidth: 900,
    corpusDepth: 650,
    doorDepth: 45,
    plinthHeight: 0,
    finish: 'INOX',
    frontWidth: 900,
    frontDepth: 45,
    nalGora: 0,
    nalDolne: 0,
};

export function isSmartApplianceContainer(container: any): boolean {
    if (!container) return false;
    const gp = container.generatorParams;
    return gp?.type === SMART_APPLIANCE_TYPE || container.role === 'APPLIANCE' || container.domainData?.role === 'APPLIANCE';
}

export function isAppliancePart(panel: any): boolean {
    if (!panel) return false;
    const role = String(panel.role || '').toUpperCase();
    return (
        role === 'APPLIANCE_FRONT' ||
        role === 'APPLIANCE_CORPUS' ||
        role === 'APPLIANCE_DOOR' ||
        role === 'APPLIANCE_GASKET' ||
        role === 'APPLIANCE_PLINTH' ||
        panel.custom_properties?.domain === 'appliance_part'
    );
}
