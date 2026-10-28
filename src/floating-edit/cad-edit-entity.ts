/**
 * Jedna brama edycji obiektu na scenie (PPM „Edytuj …”).
 * Stare eventy mogą być adapterami — docelowo wszystko idzie przez CAD_EDIT_ENTITY.
 */

export const CAD_EDIT_ENTITY = 'cad-edit-entity';
export const CAD_CLOSE_FLOATING_EDIT = 'cad-close-floating-edit';

export type CadEditEntityKind =
    | 'korpus'
    | 'blok'
    | 'panel'
    | 'agd'
    | 'smartpart'
    | 'operation'
    | 'wall';

export interface CadEditEntityDetail {
    entityId: string;
    kind: CadEditEntityKind;
    /** Operacja biblioteki */
    featureId?: string;
    panelId?: string;
    libraryId?: string;
    face?: string;
    screenX?: number;
    screenY?: number;
}

export function openCadEditEntity(detail: CadEditEntityDetail): void {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    // Jedna sesja: zamknij poprzednie okna edycji przed otwarciem nowego.
    window.dispatchEvent(new CustomEvent(CAD_CLOSE_FLOATING_EDIT));
    window.dispatchEvent(new CustomEvent(CAD_EDIT_ENTITY, { detail }));
}

export function closeCadFloatingEdit(): void {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent(CAD_CLOSE_FLOATING_EDIT));
}
