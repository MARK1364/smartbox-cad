/**
 * bloki-bay-actions.ts
 *
 * Akcje tworzenia i konfiguracji Bloku na podstawie wykrytej wnęki.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../A1_core/container-model.js';
import { AddNodeCommand } from '../A1_core/commands/add-node-command.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import type { DetectedBay } from './bloki-bay-detector.js';
import { update_bloki_core } from './bloki-core.js';
import { applyCornerDoorsDefaultRefs } from './corner-doors-refs.js';
import doorsRules from './doors_3_rules_V1.json';
import skosneDoorsRules from './skosne-doors_3_rules_V1.json';
import { resolveRuleThicknessMm } from './bloki-rules-helper.js';
import type {
    CornerDoorsPlanParams,
    LedInternalVariant,
    SkosneDoorsPlanParams,
    BlokiGeneratorMetadata,
    BlokiGeneratorParams,
    BlokiModuleId,
    BlokiModuleTypeById
} from './bloki-module-types.js';

export type BlokiCategory = 'internal' | 'external' | 'panel';

export type BlokiOption = {
    [ModuleId in BlokiModuleId]: {
        id: ModuleId;
        type: BlokiModuleTypeById[ModuleId];
        label: string;
        category: BlokiCategory;
        icon?: string;
        description?: string;
    }
}[BlokiModuleId] | {
    id: 'EMPTY';
    type: 'blok_empty';
    label: string;
    category: BlokiCategory;
    icon?: string;
    description?: string;
};

export const BLOKI_INTERNAL_OPTIONS: BlokiOption[] = [
    { id: 'SHELVES', type: 'blok_shelves', label: 'Półki', category: 'internal' },
    { id: 'DOORS', type: 'blok_doors', label: 'Drzwi', category: 'internal' },
    { id: 'SKOSNE_DOORS', type: 'blok_skosne_drzwi', label: 'Drzwi skośne', category: 'internal' },
    { id: 'CORNER_DOORS', type: 'blok_corner_doors', label: 'Drzwi narożne', category: 'internal' },
    { id: 'DRAWERS', type: 'blok_drawers', label: 'Szuflady', category: 'internal' },
    { id: 'FLAPS', type: 'blok_flaps', label: 'Klapy', category: 'internal' },
    { id: 'DIVIDERS', type: 'blok_dividers', label: 'Przegrody', category: 'internal' },
    { id: 'TUBES', type: 'blok_tubes', label: 'Drążek', category: 'internal' },
    { id: 'SHELF', type: 'blok_shelf', label: 'Wieniec', category: 'internal' },
    { id: 'LED_INTERNAL', type: 'blok_led_internal', label: 'Kanał LED', category: 'internal' }
];

export const BLOKI_EXTERNAL_OPTIONS: BlokiOption[] = [
    { id: 'PANELS', type: 'blok_panels', label: 'Blendy', category: 'external' },
    { id: 'LED_EXTERNAL', type: 'blok_led_external', label: 'Kanał LED', category: 'external' }
];

export const BLOKI_PANEL_OPTIONS: BlokiOption[] = [
    { id: 'HANDLES', type: 'blok_handle', label: 'Uchwyty', category: 'panel' },
    { id: 'HANGERS', type: 'smartpart_hangers', label: 'Zawieszki', category: 'panel' }
];

export const BLOKI_ALL_OPTIONS: BlokiOption[] = [
    ...BLOKI_INTERNAL_OPTIONS,
    ...BLOKI_EXTERNAL_OPTIONS,
    ...BLOKI_PANEL_OPTIONS
];

function createBlokiGeneratorParams(
    id: BlokiModuleId | 'EMPTY',
    metadata: BlokiGeneratorMetadata,
    params?: BlokiModalParams,
    cornerDoorsParams: CornerDoorsPlanParams = {},
    skosneDoorsParams: SkosneDoorsPlanParams = {}
): BlokiGeneratorParams {
    switch (id) {
        case 'EMPTY':
            return { ...metadata, boxType: 'EMPTY', type: 'blok_empty' };
        case 'SHELVES':
            return {
                ...metadata, boxType: id, type: 'blok_shelves',
                liczba_polek: params?.liczba_polek ?? params?.shelfCount ?? 3,
                odsuniecie_przod_mm: params?.odsuniecie_przod_mm ?? params?.shelfOffsetFrontMm ?? 10,
                wzor_nawiercen: params?.wzor_nawiercen ?? params?.holePattern ?? params?.hole_pattern ?? 'SINGLE',
                rozstaw_potrojny_z_mm: params?.rozstaw_potrojny_z_mm ?? params?.tripleZOffset,
                otwory_przod_aktywne: params?.otwory_przod_aktywne ?? params?.frontHoles,
                otwory_tyl_aktywne: params?.otwory_tyl_aktywne ?? params?.backHoles,
                przesuniecie_otworow_przod_x_mm: params?.przesuniecie_otworow_przod_x_mm ?? params?.frontOffsetX,
                przesuniecie_otworow_tyl_x_mm: params?.przesuniecie_otworow_tyl_x_mm ?? params?.backOffsetX,
                rozstaw_system32_mm: params?.rozstaw_system32_mm ?? params?.system32Spacing,
                start_system32_z_mm: params?.start_system32_z_mm ?? params?.system32StartOffset,
                liczba_otworow_system32: params?.liczba_otworow_system32 ?? params?.system32HoleCount
            };
        case 'DOORS':
            return {
                ...metadata, boxType: id, type: 'blok_doors',
                rodzaj_drzwi: params?.rodzaj_drzwi === 'SINGLE_LEFT' ? 'LEFT'
                    : params?.rodzaj_drzwi === 'SINGLE_RIGHT' ? 'RIGHT'
                        : params?.rodzaj_drzwi ?? 'LEFT',
                szczelina_mm: params?.szczelina_mm ?? params?.doorGapMm,
                pozycja_zawias_1_mm: params?.pozycja_zawias_1_mm,
                pozycja_zawias_6_mm: params?.pozycja_zawias_6_mm
            };
        case 'SKOSNE_DOORS':
            return {
                ...metadata, boxType: id, type: 'blok_skosne_drzwi',
                ...skosneDoorsParams,
                rodzaj_drzwi: (params?.rodzaj_drzwi === 'RIGHT'
                    ? 'RIGHT'
                    : params?.rodzaj_drzwi === 'LEFT'
                        ? 'LEFT'
                        : skosneDoorsParams.rodzaj_drzwi ?? 'LEFT'),
                grubosc_frontu_mm: params?.grubosc_frontu_mm ?? resolveRuleThicknessMm(skosneDoorsRules, ['DRZWI_SKOSNE', 'FRONT'], 'front_thickness', 'skosne_doors'),
                dach_kat_deg: params?.dach_kat_deg ?? skosneDoorsParams.dach_kat_deg,
                nalozenie_gora_mm: params?.nalozenie_gora_mm ?? 14,
                nalozenie_dol_mm: params?.nalozenie_dol_mm ?? 15,
                nalozenie_lewe_mm: params?.nalozenie_lewe_mm ?? 16,
                nalozenie_prawe_mm: params?.nalozenie_prawe_mm ?? 16,
                uzyj_zawias_1: true,
                uzyj_zawias_6: true,
                pozycja_zawias_1_mm: params?.pozycja_zawias_1_mm ?? 120,
                pozycja_zawias_6_mm: params?.pozycja_zawias_6_mm ?? 120
            };
        case 'CORNER_DOORS':
            return {
                ...metadata, boxType: id, type: 'blok_corner_doors',
                ...cornerDoorsParams,
                otwieranie: params?.otwieranie ?? cornerDoorsParams.otwieranie ?? 'jednostronna'
            };
        case 'DRAWERS':
            return {
                ...metadata, boxType: id, type: 'blok_drawers',
                liczba_szuflad: params?.liczba_szuflad ?? params?.drawerCount ?? params?.count ?? 3,
                szczelina_wspolna_mm: params?.szczelina_wspolna_mm ?? params?.drawerGapMm
            };
        case 'FLAPS':
            return {
                ...metadata, boxType: id, type: 'blok_flaps',
                kierunek_klapy: params?.kierunek_klapy
                    ?? (params?.flapType === 'DOWN' ? 'BOTTOM' : 'TOP')
            };
        case 'DIVIDERS':
            return {
                ...metadata, boxType: id, type: 'blok_dividers',
                liczba_przegrod: params?.liczba_przegrod ?? params?.dividerCount ?? params?.count ?? 2
            };
        case 'TUBES':
            return {
                ...metadata, boxType: id, type: 'blok_tubes',
                odstep_gora_mm: params?.odstep_gora_mm ?? params?.tubeOffsetTopMm ?? 70
            };
        case 'SHELF':
            return {
                ...metadata, boxType: id, type: 'blok_shelf',
                odstep_dol_mm: params?.odstep_dol_mm ?? params?.offset_bottom ?? params?.offsetBottom ?? 100
            };
        case 'LED_INTERNAL': {
            const variant = params?.wariant_led ?? params?.variant;
            const validVariants: LedInternalVariant[] = [
                'VERTICAL_BOTH_SIDES', 'VERTICAL_LEFT_SIDE', 'VERTICAL_RIGHT_SIDE',
                'VERTICAL_BACK', 'VERTICAL_SIDES_AND_BACK', 'HORIZONTAL_TOP'
            ];
            return {
                ...metadata, boxType: id, type: 'blok_led_internal',
                wariant_led: validVariants.includes(variant as LedInternalVariant)
                    ? variant as LedInternalVariant
                    : 'VERTICAL_BOTH_SIDES',
                odsuniecie_od_przodu_mm: params?.odsuniecie_od_przodu_mm ?? params?.offsetFromFrontMm,
                odsuniecie_od_przodu_lewe_mm: params?.odsuniecie_od_przodu_lewe_mm ?? params?.offsetFromFrontLeftMm ?? 50,
                odsuniecie_od_przodu_prawe_mm: params?.odsuniecie_od_przodu_prawe_mm ?? params?.offsetFromFrontRightMm ?? 150,
                odsuniecie_tyl_od_srodka_mm: params?.odsuniecie_tyl_od_srodka_mm ?? params?.offsetBackFromCenterMm ?? 125,
                szerokosc_wpustu_mm: params?.szerokosc_wpustu_mm ?? params?.grooveWidthMm ?? 14,
                glebokosc_wpustu_mm: params?.glebokosc_wpustu_mm ?? params?.grooveDepthMm ?? 9
            };
        }
        case 'PANELS':
            return { ...metadata, boxType: id, type: 'blok_panels' };
        case 'LED_EXTERNAL':
            return {
                ...metadata, boxType: id, type: 'blok_led_external',
                odsuniecie_od_przodu_mm: params?.odsuniecie_od_przodu_mm ?? params?.offsetFromFrontMm ?? 50,
                szerokosc_wpustu_mm: params?.szerokosc_wpustu_mm ?? params?.grooveWidthMm ?? 14,
                glebokosc_wpustu_mm: params?.glebokosc_wpustu_mm ?? params?.grooveDepthMm ?? 9,
                frezuj_boki: params?.frezuj_boki ?? params?.cutSides ?? true
            };
        case 'HANDLES':
            throw new Error('[Bloki] HANDLES nie posiada generatorParams wnęki — montowane są na formatce (tryb panel)');
        case 'HANGERS':
            throw new Error('[Bloki] HANGERS montowane są przez dedykowany mechanizm SmartParts/Bloki');
    }
}

/** Parametry przy tworzeniu Bloku — kanoniczne + opcjonalne aliasy (mapowane tylko tu). */
export interface BlokiModalParams {
    // kanoniczne
    liczba_polek?: number;
    odsuniecie_przod_mm?: number;
    wzor_nawiercen?: 'SINGLE' | 'TRIPLE' | 'ROW' | 'SYSTEM_32' | 'NONE';
    rozstaw_potrojny_z_mm?: number;
    otwory_przod_aktywne?: boolean;
    otwory_tyl_aktywne?: boolean;
    przesuniecie_otworow_przod_x_mm?: number;
    przesuniecie_otworow_tyl_x_mm?: number;
    rozstaw_system32_mm?: number;
    start_system32_z_mm?: number;
    liczba_otworow_system32?: number;
    liczba_szuflad?: number;
    szczelina_wspolna_mm?: number;
    rodzaj_drzwi?: 'LEFT' | 'RIGHT' | 'SINGLE_LEFT' | 'SINGLE_RIGHT' | 'DOUBLE';
    szczelina_mm?: number;
    dach_kat_deg?: number;
    kierunek_klapy?: 'TOP' | 'BOTTOM';
    liczba_przegrod?: number;
    odstep_gora_mm?: number;
    odstep_dol_mm?: number;
    wariant_led?: LedInternalVariant | string;
    odsuniecie_od_przodu_mm?: number;
    odsuniecie_od_przodu_lewe_mm?: number;
    odsuniecie_od_przodu_prawe_mm?: number;
    odsuniecie_tyl_od_srodka_mm?: number;
    szerokosc_wpustu_mm?: number;
    glebokosc_wpustu_mm?: number;
    frezuj_boki?: boolean;
    otwieranie?: string;
    szczelina_srodkowa_mm?: number;
    nalozenie_gora_mm?: number;
    nalozenie_dol_mm?: number;
    nalozenie_lewe_mm?: number;
    nalozenie_prawe_mm?: number;
    grubosc_frontu_mm?: number;
    pozycja_zawias_1_mm?: number;
    pozycja_zawias_6_mm?: number;
    grubosc_boka_front?: number;
    grubosc_plecy_x?: number;
    // aliasy — tylko granica createBlokInDetectedBay
    shelfCount?: number;
    shelfOffsetFrontMm?: number;
    drawerCount?: number;
    drawerGapMm?: number;
    doorGapMm?: number;
    flapType?: 'UP' | 'DOWN';
    dividerCount?: number;
    tubeOffsetTopMm?: number;
    offset_bottom?: number;
    offsetBottom?: number;
    count?: number;
    offsetFromFrontMm?: number;
    offsetFromFrontLeftMm?: number;
    offsetFromFrontRightMm?: number;
    offsetBackFromCenterMm?: number;
    grooveWidthMm?: number;
    grooveDepthMm?: number;
    variant?: string;
    cutSides?: boolean;
    holePattern?: 'SINGLE' | 'TRIPLE' | 'ROW' | 'SYSTEM_32' | 'NONE';
    hole_pattern?: 'SINGLE' | 'TRIPLE' | 'ROW' | 'SYSTEM_32' | 'NONE';
    tripleZOffset?: number;
    frontHoles?: boolean;
    backHoles?: boolean;
    frontOffsetX?: number;
    backOffsetX?: number;
    system32Spacing?: number;
    system32StartOffset?: number;
    system32HoleCount?: number;
}

export const BLOKI_CATEGORY_NAMES: Record<string, string> = {
    'EMPTY': 'blok_',
    'SHELVES': 'blok_polki',
    'DRAWERS': 'blok_szuflady',
    'DOORS': 'blok_drzwi',
    'SKOSNE_DOORS': 'blok_drzwi_skosne',
    'CORNER_DOORS': 'blok_drzwi_narozne',
    'TUBES': 'blok_drazek',
    'SHELF': 'blok_wieniec',
    'DIVIDERS': 'blok_przegrody',
    'FLAPS': 'blok_klapy',
    'PANELS': 'blok_blendy',
    'LED_INTERNAL': 'blok_led_szafowy',
    'LED_EXTERNAL': 'blok_led_podszafkowy',
    'HANDLES': 'blok_uchwyty'
};

import { Command } from '../A1_core/commands/command.js';
import { SyncShelfDrillingsCommand } from './commands/sync-shelf-drillings-command.js';
import { SyncDoorDrillingsCommand } from './commands/sync-door-drillings-command.js';
import { SyncDrawerDrillingsCommand } from './commands/sync-drawer-drillings-command.js';
import { SyncFlapsDrillingsCommand } from './commands/sync-flaps-drillings-command.js';
import { SyncTubesDrillingsCommand } from './commands/sync-tubes-drillings-command.js';
import { ClearBlokiDrillingsCommand } from './commands/clear-blok-drillings-command.js';

export class InsertBlokiCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[] = [];

    private _addCmd: AddNodeCommand;
    private _targetParentId: string;
    private _sbNode: CADNode;
    private _sbContainer: ContainerModel;

    constructor(targetParentId: string, sbNode: CADNode, label: string) {
        this.id = `cmd_insert_bloki_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = label;
        this.timestamp = Date.now();
        this._targetParentId = targetParentId;
        this._sbNode = sbNode;
        this._sbContainer = sbNode.domainData as ContainerModel;
        this._addCmd = new AddNodeCommand(targetParentId, sbNode, undefined, label);
        this.affectedNodeIds.push(sbNode.id);
    }

    execute(document: ProjectDocument): void {
        this._addCmd.execute(document);
        update_bloki_core(this._sbContainer, document);
    }

    undo(document: ProjectDocument): void {
        new ClearBlokiDrillingsCommand(this._sbNode.id).execute(document);
        this._addCmd.undo(document);
        new SyncShelfDrillingsCommand(this._targetParentId).execute(document);
        new SyncDoorDrillingsCommand(this._targetParentId).execute(document);
        new SyncDrawerDrillingsCommand(this._targetParentId).execute(document);
        new SyncFlapsDrillingsCommand(this._targetParentId).execute(document);
        new SyncTubesDrillingsCommand(this._targetParentId).execute(document);
    }

    redo(document: ProjectDocument): void {
        this._addCmd.execute(document);
        update_bloki_core(this._sbContainer, document);
    }
}

export function createBlokInDetectedBay(
    document: ProjectDocument,
    bay: DetectedBay,
    option: BlokiOption,
    params?: BlokiModalParams
): CADNode | null {
    if (!document || !bay) return null;
    if (option.id === 'HANDLES' || option.id === 'HANGERS') {
        throw new Error(`[Bloki] ${option.label || option.id} montowane są na formatce / dedykowanym mechanizmem, a nie przez createBlokInDetectedBay.`);
    }

    const sbName = BLOKI_CATEGORY_NAMES[option.id] || (option.id === 'EMPTY' ? 'blok_' : `blok_${(option.label || option.id).toLowerCase()}`);
    const parentId = bay.parentCabinetId;
    const targetParentId = parentId || document.rootNode.id;

    // 1. Tworzymy domenowy ContainerModel
    const sbContainer = new ContainerModel({
        name: sbName,
        width: bay.boundsNm.width,
        height: bay.boundsNm.height,
        depth: bay.boundsNm.depth
    });

    const leftRef = bay.boundary.left;
    const rightRef = bay.boundary.right;
    const bottomRef = bay.boundary.bottom;
    const topRef = bay.boundary.top;
    const backRef = bay.boundary.back;
    const frontRef = bay.boundary.front || leftRef;

    const isExternal = option.category === 'external' || option.id === 'PANELS';

    const parentCabNode = parentId ? document.findNode(parentId) : null;
    const cornerDoorsApplied =
        option.id === 'CORNER_DOORS' && parentCabNode
            ? applyCornerDoorsDefaultRefs(parentCabNode)
            : null;

    const defaultCustomReferences = {
        xMin: { partKey: leftRef.nodeName || 'Bok Lewy', face: leftRef.face || leftRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: leftRef.nodeId },
        xMax: { partKey: rightRef.nodeName || 'Bok Prawy', face: rightRef.face || rightRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: rightRef.nodeId },
        zMin: { partKey: bottomRef.nodeName || 'Dół', face: bottomRef.face || bottomRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: bottomRef.nodeId },
        zMax: { partKey: topRef.nodeName || 'Góra', face: topRef.face || topRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_MINUS'), panelId: topRef.nodeId },
        yMin: { partKey: frontRef.nodeName || 'Przód', face: frontRef.face || frontRef.faceName || 'FACE_X_PLUS', panelId: frontRef.nodeId },
        yMax: { partKey: backRef.nodeName || 'Tył', face: backRef.face || backRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: backRef.nodeId }
    };

    const initialCustomReferences = (() => {
        if (option.id === 'CORNER_DOORS') {
            if (cornerDoorsApplied?.customReferences) {
                const refs: any = {};
                if (cornerDoorsApplied.customReferences.xMin) refs.xMin = cornerDoorsApplied.customReferences.xMin;
                if (cornerDoorsApplied.customReferences.xMax) refs.xMax = cornerDoorsApplied.customReferences.xMax;
                if (cornerDoorsApplied.customReferences.yMin) refs.yMin = cornerDoorsApplied.customReferences.yMin;
                if (cornerDoorsApplied.customReferences.yMax) refs.yMax = cornerDoorsApplied.customReferences.yMax;
                if (cornerDoorsApplied.customReferences.zMin) refs.zMin = cornerDoorsApplied.customReferences.zMin;
                if (cornerDoorsApplied.customReferences.zMax) refs.zMax = cornerDoorsApplied.customReferences.zMax;
                return refs;
            }
            return {
                xMax: { partKey: rightRef.nodeName || 'Bok Prawy', face: rightRef.face || rightRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: rightRef.nodeId },
                yMin: { partKey: leftRef.nodeName || 'Bok Lewy', face: leftRef.face || leftRef.faceName || 'FACE_X_PLUS', panelId: leftRef.nodeId },
                zMin: { partKey: bottomRef.nodeName || 'Dół', face: bottomRef.face || bottomRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: bottomRef.nodeId },
                zMax: { partKey: topRef.nodeName || 'Góra', face: topRef.face || topRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: topRef.nodeId }
            };
        }
        return defaultCustomReferences;
    })();

    /**
     * DRZWI SKOŚNE: kąt nachylenia skosu dachu czytamy bezpośrednio z TOP_PANEL
     * (lcs.rotation[2] wieńca górnego).
     *
     * Brak skosu / brak TOP_PANEL w korpusie = dach_kat_deg pozostaje undefined
     * (fail-fast, brak zgadywania / brak wartości zastępczych).
     */
    const skosneDoorsParams: SkosneDoorsPlanParams = option.id === 'SKOSNE_DOORS'
        ? (() => {
            const topPanel = parentCabNode?.children?.find(
                (c: any) => String(c.domainData?.role || '').toUpperCase() === 'TOP_PANEL'
            );
            if (!topPanel) {
                console.warn(
                    '[bloki-bay] SKOSNE_DOORS: brak TOP_PANEL w korpusie — nie można wyznaczyć kąta skosu.'
                );
                return {} as SkosneDoorsPlanParams;
            }
            const rotZ = (topPanel.domainData as any)?.lcs?.rotation?.[2];
            if (rotZ === undefined || !Number.isFinite(Number(rotZ))) {
                console.warn(
                    '[bloki-bay] SKOSNE_DOORS: brak rotacji lcs.rotation[2] w TOP_PANEL — nie można wyznaczyć kąta skosu.'
                );
                return {} as SkosneDoorsPlanParams;
            }

            // lcs.rotation[2] wieńca to -beta_deg dla wzniosu w prawo, więc kąt dachu beta = -rotZ
            const dach_kat_deg = -Number(rotZ);
            return {
                dach_kat_deg,
                rodzaj_drzwi: dach_kat_deg >= 0 ? 'RIGHT' : 'LEFT'
            } as SkosneDoorsPlanParams;
        })()
        : {};

    const cornerDoorsParams: CornerDoorsPlanParams = option.id === 'CORNER_DOORS'
        ? (() => {
            const leftBok = parentCabNode?.children?.find(
                (c: any) =>
                    String(c.domainData?.role || '').toUpperCase() === 'LEFT_SIDE_PANEL' ||
                    String(c.name || '').toUpperCase().includes('BOK_L') ||
                    String(c.name || '').toUpperCase().includes('BOK LEWY')
            );
            const plecyX = parentCabNode?.children?.find(
                (c: any) =>
                    String(c.name || '').toUpperCase().includes('PLECY_X') ||
                    (String(c.domainData?.role || '').toUpperCase() === 'BACK_PANEL' &&
                        String(c.name || '').toUpperCase().includes('_X'))
            );
            const bokThNm = (leftBok?.domainData as any)?.thickness;
            const plecyThNm = (plecyX?.domainData as any)?.thickness;
            const grubosc_boka_front = bokThNm != null && Number.isFinite(Number(bokThNm))
                ? nmToMm(bokThNm)
                : undefined;
            const grubosc_plecy_x = plecyThNm != null && Number.isFinite(Number(plecyThNm))
                ? nmToMm(plecyThNm)
                : undefined;
            if (grubosc_boka_front === undefined) {
                console.warn('[bloki-bay] CORNER_DOORS: brak grubości BOK_L — grubosc_boka_front nieustawione.');
            }
            if (grubosc_plecy_x === undefined) {
                console.warn('[bloki-bay] CORNER_DOORS: brak grubości PLECY_X — grubosc_plecy_x nieustawione.');
            }
            return {
                szczelina_srodkowa_mm: params?.szczelina_srodkowa_mm ?? 8,
                nalozenie_gora_mm: params?.nalozenie_gora_mm ?? 14,
                nalozenie_dol_mm: params?.nalozenie_dol_mm ?? 15,
                nalozenie_lewe_mm: params?.nalozenie_lewe_mm ?? 16,
                nalozenie_prawe_mm: params?.nalozenie_prawe_mm ?? 16,
                grubosc_frontu_mm: params?.grubosc_frontu_mm ?? resolveRuleThicknessMm(doorsRules, ['FRONT', 'DRZWI_L'], 'front_thickness', 'corner_doors'),
                uzyj_zawias_1: true,
                uzyj_zawias_6: true,
                pozycja_zawias_1_mm: params?.pozycja_zawias_1_mm ?? 120,
                pozycja_zawias_6_mm: params?.pozycja_zawias_6_mm ?? 120,
                grubosc_boka_front: params?.grubosc_boka_front ?? grubosc_boka_front,
                grubosc_plecy_x: params?.grubosc_plecy_x ?? grubosc_plecy_x
            };
        })()
        : {};

    const metadata: BlokiGeneratorMetadata = {
        parentContainerId: parentId,
        boundary: bay.boundary,
        detectedBay: bay,
        targetZone: isExternal ? 'FULL' : undefined,
        side_references_bloki: isExternal ? 'OUTER' : 'INNER',
        customReferences: initialCustomReferences,
        cornerAt: cornerDoorsApplied?.cornerAt ?? 'innerL_wieniec',
        offsets: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 }
    };
    sbContainer.generatorParams = createBlokiGeneratorParams(
        option.id,
        metadata,
        params,
        cornerDoorsParams,
        skosneDoorsParams
    );

    // 2. Tworzymy węzeł CADNode dla kontenera
    const sbNode = CADNode.create(NodeType.ASSEMBLY, sbName, sbContainer.id);
    sbNode.domainData = sbContainer;

    // 3. Pozycja lokalna TRS względem nadrzędnego korpusu (a nie ślepe współrzędne świata)
    // Ważne: w CAD i ContainerView lokalne Z=0 kontenera to jego spód (nie środek geometryczny wysokości).
    const parentNode = document.findNode(targetParentId);
    const bottomZMm = bay.boundary?.bottom?.planeCoordMm ?? (bay.centerWorldMm.z - bay.boundsMm.height / 2);
    let localPosNm = new Vec3(mmToNm(bay.centerWorldMm.x), mmToNm(bay.centerWorldMm.y), mmToNm(bottomZMm));
    if (parentNode && parentNode.id !== document.rootNode.id) {
        const parentWorldInv = parentNode.getWorldMatrix().invert();
        localPosNm = parentWorldInv.transformPoint(localPosNm);
    }
    sbNode.setLocalTransform(localPosNm, Quat.IDENTITY);

    // 4. Dodanie do dokumentu przez CommandHistory (wsparcie Undo/Redo)
    const cmdHist = ContextManager.instance.commandHistory;
    const insertCmd = new InsertBlokiCommand(targetParentId, sbNode, `Wstawienie Blok: ${option.label}`);
    if (cmdHist) {
        cmdHist.execute(insertCmd);
    } else {
        document.addNode(targetParentId, sbNode);
        update_bloki_core(sbContainer, document);
    }

    document.setActiveEntity(sbContainer);
    if (typeof window !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
    }

    return sbNode;
}
