/**
 * A2_bloki/core/smart-module-plugin.ts
 *
 * Kontrakt wtyczki modułu Bloki (A2).
 * Czysty podział na:
 *  - meta: pełne metadane UI (etykieta, opis, ikona, kategoria) z wtyczki jako SSOT
 *  - buildPlan: czysta logika domenowa (pure TS/math)
 *  - syncDrillings: obsługa obróbek / nawierceń CNC w korpusie
 *  - getDefaultParams: domyślne kanoniczne parametry (np. liczba_polek, odsuniecie_przod_mm)
 *  - UIComponent: komponent edycji w panelu bocznym z ContainerModel
 */

import type { ComponentType, ReactNode } from 'react';
import type { ModuleDims } from '../base-engine.js';
import type { BlokiPlanResult } from '../bloki-types.js';
import type { ProjectDocument } from '../../A1_core/project-document.js';
import type { CADNode } from '../../A1_core/cad-node/cad-node.js';
import type { ContainerModel } from '../../A1_core/container-model.js';
import type { BlokiModuleId } from '../bloki-module-types.js';

export type { BlokiModuleId };

export interface SmartModuleMeta {
    label: string;                             // Czytelna etykieta wyświetlana w UI
    labelKey: string;                          // Klucz z *_tekst.json
    description: string;                       // Opis modułu w palecie UI
    category: 'internal' | 'external';         // SSOT kategorii Bloki
    subCategory?: 'FRONT' | 'LIGHTING' | 'ACCESSORY';
    order: number;                             // Kolejność w menu wyboru UI
    renderIcon?: (color?: string) => ReactNode;
}

export interface SmartModulePlugin<TParams extends object = Record<string, unknown>> {
    id: BlokiModuleId;
    meta: SmartModuleMeta;

    /** Flaga aktywacji wariantu / licencjonowania (opcjonalny warunek runtime) */
    enabled?: boolean | (() => boolean);

    /** 1. Logika czysto domenowa wyliczająca części i okucia */
    buildPlan: (params: TParams, dims: ModuleDims) => BlokiPlanResult;

    /** 2. Synchronizacja obróbek CNC przy zmianie korpusu/modułu */
    syncDrillings?: (doc: ProjectDocument, cabinetId: string, containerNode?: CADNode) => void;

    /** 3. Domyślne kanoniczne parametry modułu */
    getDefaultParams: (dims?: ModuleDims) => TParams;

    /** 4. Komponent formularza edycji w UI */
    UIComponent: ComponentType<{
        container: ContainerModel;
        triggerUpdate: (patch: Partial<TParams>) => void;
    }>;
}
