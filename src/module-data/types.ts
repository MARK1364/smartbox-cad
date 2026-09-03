/**
 * Kontrakty danych podstron (raport / nesting / CNC / draw).
 *
 * Moduły nie czytają ProjectDocument. Dostają ten payload — z CAD, JSON albo CSV.
 * Dodatkowe źródła (STEP/DXF dla CNC) podpinają się pod ten sam kształt.
 */

import type { CuttingPanelContract, AccessoryItem, ContainerScopeItem } from '../../R1_reports/report-data-normalizer';
import type { NestingPart, ContainerScopeInfo, SheetConfig } from '../../n1_nesting/core/nesting-types';
import type { CAMFeature } from '../../C1_cnc/dto/cam-dto';
import type { CADTreeNode } from '../../E3_export/drawing-types';

export type ModuleId = 'report' | 'nesting' | 'cnc' | 'draw';

export type ModuleSourceId = 'cad' | 'json' | 'csv' | 'session';

export type ModuleScopeType = 'PROJECT' | 'CONTAINER' | 'SMARTBOX' | 'PANEL';

export interface ModuleScope {
    type: ModuleScopeType;
    id: string;
    name: string;
}

export interface ModuleSessionMeta {
    module: ModuleId;
    sourceId: ModuleSourceId;
    loadedAt: string;
    originLabel: string;
}

export interface ReportModulePayload {
    meta: ModuleSessionMeta;
    scope: ModuleScope;
    panels: CuttingPanelContract[];
    accessories: AccessoryItem[];
    furnitures: string[];
    containers: ContainerScopeItem[];
}

export interface NestingModulePayload {
    meta: ModuleSessionMeta;
    scope: ModuleScope;
    parts: NestingPart[];
    containers: ContainerScopeInfo[];
    config?: Partial<SheetConfig>;
    selectedMaterial?: string;
}

/**
 * Snapshot formatki dla CAM. Wymiary w nm (SSOT silnika).
 * Parser STEP/DXF w przyszłości ma zwracać ten sam obiekt.
 */
export interface CncWorkpiece {
    id: string;
    name: string;
    type?: string;
    role?: string;
    materialId?: string;
    width: number;
    height: number;
    thickness: number;
    color?: { r: number; g: number; b: number };
    features: any[];
    cncPrograms?: any[];
    camFeatures?: CAMFeature[];
}

export interface CncModulePayload {
    meta: ModuleSessionMeta;
    scope: ModuleScope;
    workpiece: CncWorkpiece;
}

export interface DrawModulePayload {
    meta: ModuleSessionMeta;
    scope: ModuleScope;
    treeRoot?: CADTreeNode | null;
}

export type AnyModulePayload =
    | ReportModulePayload
    | NestingModulePayload
    | CncModulePayload
    | DrawModulePayload;

export interface ModuleDataSource<T> {
    id: ModuleSourceId;
    label: string;
    load(): Promise<T>;
}
