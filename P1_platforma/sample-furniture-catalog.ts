/**
 * P1_platforma — Wstępny katalog modeli mebli CAD
 * Modele oparte na silnikach korpusów i bloków Crevo.
 */

import type { FurnitureCatalogItem } from './platforma-types.js';

export const INITIAL_FURNITURE_CATALOG: FurnitureCatalogItem[] = [
    {
        id: 'furn_kd_60_3sz',
        code: 'KD-3SZ',
        name: 'Szafka dolna z 3 szufladami',
        category: 'DOLNE',
        categoryLabel: 'Szafki dolne',
        dimensions: { width_mm: 600, height_mm: 820, depth_mm: 560 },
        description: 'Standardowa szafka kuchenna dolna z 1 płytką szufladą na sztućce oraz 2 głębokimi szufladami z pełnym wysuwem.',
        tags: ['kuchnia', 'szuflady', 'dolna', 'soft-close'],
        korpusType: 'korpus3',
        drawerCount: 3,
        hardwareBrand: 'Blum / GTV',
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 600,
            height_mm: 820,
            depth_mm: 560,
            material_korpus: 'MDF_SUROWY_18',
            bloki: [
                {
                    kind: '09_drawers',
                    params: { drawerCount: 3, layout: '1_small_2_large', front_gap_mm: 3 }
                }
            ]
        }
    },
    {
        id: 'furn_kd_60_drzwi',
        code: 'KD-1D',
        name: 'Szafka dolna z drzwiami i półką',
        category: 'DOLNE',
        categoryLabel: 'Szafki dolne',
        dimensions: { width_mm: 600, height_mm: 820, depth_mm: 560 },
        description: 'Jednodrzwiowa szafka dolna z regulowaną półką wewnętrzną na podpórkach fi 5 mm.',
        tags: ['kuchnia', 'drzwi', 'półka', 'dolna'],
        korpusType: 'korpus3',
        doorCount: 1,
        shelfCount: 1,
        hingeBrand: 'Blum Clip Top 110°',
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 600,
            height_mm: 820,
            depth_mm: 560,
            bloki: [
                { kind: '04_shelves', params: { shelfCount: 1 } },
                { kind: '05_doors', params: { doorCount: 1, side: 'LEFT' } }
            ]
        }
    },
    {
        id: 'furn_kd_80_zlew',
        code: 'KD-ZLEW',
        name: 'Szafka pod zlewozmywak',
        category: 'DOLNE',
        categoryLabel: 'Szafki dolne',
        dimensions: { width_mm: 800, height_mm: 820, depth_mm: 560 },
        description: 'Szafka podwójna ze wzmocnionym wieńcem górnym na sztorc (TRAVERSE_V) przystosowana do montażu zlewu i syfonu.',
        tags: ['zlew', 'kuchnia', '2 drzwi', 'dolna', 'traverse-v'],
        korpusType: 'korpus3',
        doorCount: 2,
        hingeBrand: 'GTV 3D Hydraulic',
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 800,
            height_mm: 820,
            depth_mm: 560,
            bloki: [
                { kind: '05_doors', params: { doorCount: 2 } }
            ]
        }
    },
    {
        id: 'furn_kd_30_cargo',
        code: 'KD-CARGO',
        name: 'Szafka dolna z koszem Cargo',
        category: 'DOLNE',
        categoryLabel: 'Szafki dolne',
        dimensions: { width_mm: 300, height_mm: 820, depth_mm: 560 },
        description: 'Wąska szafka kuchenna z wysuwanym dwupoziomowym koszem cargo na butelki i przyprawy.',
        tags: ['kuchnia', 'cargo', 'wąska', 'dolna', 'organizacja'],
        korpusType: 'korpus3',
        doorCount: 1,
        hardwareBrand: 'Rejs / Peka',
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 300,
            height_mm: 820,
            depth_mm: 560,
            bloki: []
        }
    },
    {
        id: 'furn_kw_60_2polki',
        code: 'KW-2P',
        name: 'Szafka wisząca z 2 półkami',
        category: 'WISZACE',
        categoryLabel: 'Szafki wiszące',
        dimensions: { width_mm: 600, height_mm: 720, depth_mm: 320 },
        description: 'Wisząca szafka kuchenna z zawieszkami mimośrodowymi CAMAR i dwoma rzędami regulowanych półek.',
        tags: ['kuchnia', 'wisząca', 'górna', 'półki'],
        korpusType: 'korpus3',
        shelfCount: 2,
        doorCount: 1,
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 600,
            height_mm: 720,
            depth_mm: 320,
            bloki: [
                { kind: '04_shelves', params: { shelfCount: 2 } },
                { kind: '05_doors', params: { doorCount: 1 } }
            ]
        }
    },
    {
        id: 'furn_kw_80_klapa',
        code: 'KW-AVENTOS',
        name: 'Szafka wisząca z podnośnikiem klapy',
        category: 'WISZACE',
        categoryLabel: 'Szafki wiszące',
        dimensions: { width_mm: 800, height_mm: 720, depth_mm: 320 },
        description: 'Nowoczesna szafka górna z frontem łamanym unoszonym do góry na siłownikach gazowych lub Aventos.',
        tags: ['kuchnia', 'wisząca', 'klapa', 'siłownik', 'aventos'],
        korpusType: 'korpus3',
        flapCount: 1,
        hardwareBrand: 'Blum Aventos HK/HF',
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 800,
            height_mm: 720,
            depth_mm: 320,
            bloki: [
                { kind: '12_flaps', params: { flapCount: 1 } }
            ]
        }
    },
    {
        id: 'furn_kw_60_witryna',
        code: 'KW-ALU',
        name: 'Szafka wisząca witryna z ramką ALU',
        category: 'WISZACE',
        categoryLabel: 'Szafki wiszące',
        dimensions: { width_mm: 600, height_mm: 720, depth_mm: 320 },
        description: 'Elegancka szafka wisząca z frontem z profilu aluminiowego i szkła hartowanego ze zintegrowanym frezem pod taśmę LED.',
        tags: ['szkło', 'alu', 'led', 'witryna', 'wisząca'],
        korpusType: 'korpus3',
        doorCount: 1,
        shelfCount: 2,
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 600,
            height_mm: 720,
            depth_mm: 320,
            bloki: [
                { kind: '04_shelves', params: { shelfCount: 2 } },
                { kind: '16_led', params: { purpose: 'LED_CHANNEL' } }
            ]
        }
    },
    {
        id: 'furn_kn_90_rog',
        code: 'KN-ROG',
        name: 'Szafka narożna z drzwiami łamanymi',
        category: 'NAROZNE',
        categoryLabel: 'Szafki narożne',
        dimensions: { width_mm: 900, height_mm: 820, depth_mm: 900 },
        description: 'Narożnik kuchenny kątowy 90° z podwójnymi drzwiami łamanymi na zawiasach 165° + 135°.',
        tags: ['narożna', 'kuchnia', 'rogowy90', 'drzwi łamane'],
        korpusType: 'korpus_rogowy90',
        doorCount: 2,
        hingeBrand: 'Blum 165° + Kątowy',
        projectConfig: {
            typ_korpusu: 'korpus_rogowy90',
            width_mm: 900,
            height_mm: 820,
            depth_mm: 900,
            bloki: [
                { kind: '07_corner-doors', params: {} }
            ]
        }
    },
    {
        id: 'furn_sl_60_agd',
        code: 'SL-AGD',
        name: 'Słupek wysoki pod piekarnik i mikrofalę',
        category: 'SLUPKI',
        categoryLabel: 'Słupki wysokie',
        dimensions: { width_mm: 600, height_mm: 2040, depth_mm: 560 },
        description: 'Wysoki słupek kuchenny pod standardową wnękę piekarnika (595 mm) oraz mikrofalówkę z dolnymi szufladami głębokimi.',
        tags: ['słupek', 'agd', 'piekarnik', 'wysoka', 'szuflady'],
        korpusType: 'korpus3',
        drawerCount: 2,
        doorCount: 1,
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 600,
            height_mm: 2040,
            depth_mm: 560,
            bloki: [
                { kind: '09_drawers', params: { drawerCount: 2 } }
            ]
        }
    },
    {
        id: 'furn_sl_60_spizarka',
        code: 'SL-SPIZARKA',
        name: 'Słupek wysoki spiżarkowy (5 półek)',
        category: 'SLUPKI',
        categoryLabel: 'Słupki wysokie',
        dimensions: { width_mm: 600, height_mm: 2040, depth_mm: 560 },
        description: 'Pojemny słupek gospodarczy z podziałem na górną i dolną strefę oraz pięcioma przestawnymi półkami.',
        tags: ['słupek', 'spiżarka', 'półki', 'duża pojemność'],
        korpusType: 'korpus3',
        shelfCount: 5,
        doorCount: 2,
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 600,
            height_mm: 2040,
            depth_mm: 560,
            bloki: [
                { kind: '04_shelves', params: { shelfCount: 5 } },
                { kind: '05_doors', params: { doorCount: 2 } }
            ]
        }
    },
    {
        id: 'furn_kom_120_4sz',
        code: 'KOM-4SZ',
        name: 'Komoda pokojowa z 4 szufladami',
        category: 'BIURO_POKOJ',
        categoryLabel: 'Komody i biuro',
        dimensions: { width_mm: 1200, height_mm: 880, depth_mm: 450 },
        description: 'Szeroka komoda do sypialni lub salonu na 4 szuflady z krytymi prowadnicami dolnego montażu z dociągiem.',
        tags: ['salon', 'sypialnia', 'komoda', 'szuflady', 'szeroka'],
        korpusType: 'korpus3',
        drawerCount: 4,
        hardwareBrand: 'Blum Movento / Tandem',
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 1200,
            height_mm: 880,
            depth_mm: 450,
            bloki: [
                { kind: '09_drawers', params: { drawerCount: 4 } }
            ]
        }
    },
    {
        id: 'furn_biurko_120_kont',
        code: 'BIUR-KONT',
        name: 'Biurko gabinetowe z kontenerkiem 3SZ',
        category: 'BIURO_POKOJ',
        categoryLabel: 'Komody i biuro',
        dimensions: { width_mm: 1200, height_mm: 750, depth_mm: 650 },
        description: 'Biurko do pracy i nauki ze zintegrowanym kontenerkiem z 3 szufladami zamykanymi na zamek centralny.',
        tags: ['biuro', 'praca', 'biurko', 'szuflady'],
        korpusType: 'korpus3',
        drawerCount: 3,
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 1200,
            height_mm: 750,
            depth_mm: 650,
            bloki: []
        }
    },
    {
        id: 'furn_szafa_100_2d',
        code: 'SZF-2D',
        name: 'Szafa garderobiana z drążkiem i półkami',
        category: 'SZAFY',
        categoryLabel: 'Szafy i garderoby',
        dimensions: { width_mm: 1000, height_mm: 2160, depth_mm: 600 },
        description: 'Dwudrzwiowa szafa ubraniowa z drążkiem owalnym na ubrania wiszące, pawężą górną i dolną półką na buty.',
        tags: ['garderoba', 'szafa', 'drążek', 'duża'],
        korpusType: 'korpus3',
        doorCount: 2,
        shelfCount: 2,
        projectConfig: {
            typ_korpusu: 'korpus3',
            width_mm: 1000,
            height_mm: 2160,
            depth_mm: 600,
            bloki: [
                { kind: '08_tubes', params: { tubeType: 'OVAL' } },
                { kind: '04_shelves', params: { shelfCount: 2 } },
                { kind: '05_doors', params: { doorCount: 2 } }
            ]
        }
    }
];
