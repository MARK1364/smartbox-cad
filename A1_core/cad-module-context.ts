/**
 * CadModuleContext — czysty interfejs kontekstu bootstrapu CAD.
 *
 * Definiuje kształt obiektu przekazywanego do narzędzi CAD, stanów interakcji
 * i kontrolerów UI po zainicjalizowaniu sceny.
 *
 * Celowo nie importuje Babylon.js, DOM ani żadnych klas widoku —
 * plik ten pozostaje w A1_core jako typ domenowy bezpieczny do importu
 * przez wszystkie warstwy aplikacji.
 *
 * Logika tworzenia sceny (Viewport, NativePanelBuilder, ContextManager itd.)
 * mieszka wyłącznie w src/application/scene-bootstrap.ts.
 */

import type { ProjectDocument } from './project-document.js';
import type { FacePicker } from './face-picker.js';
import type { UIController } from './ui-controller.js';
import type { ContextMenu } from './context-menu.js';
import type { PropertiesManager } from './properties.js';

/**
 * Kontekst dostępny po bootstrapie sceny CAD.
 * Typy Babylon.js (Viewport, PanelView, NativePanelBuilder, SketchPlane)
 * importowane są przez `src/application/scene-bootstrap.ts` — tutaj `any`,
 * żeby A1_core nie zależało bezpośrednio od warstwy 3D.
 */
export interface CadModuleContext {
    canvas: HTMLCanvasElement | null;
    document: ProjectDocument;
    /** Viewport Babylon.js — typed as `any` to avoid A1_core ↔ Babylon coupling. */
    viewport: any;
    panelViews: Map<any, any>;
    containerViews: Map<any, any>;
    facePicker: FacePicker;
    /** SketchPlane — typed as `any` to avoid A1_core ↔ S1_sketcher coupling. */
    sketchPlane: any;
    ui: UIController;
    /** NativePanelBuilder — typed as `any` to avoid A1_core ↔ A4_smartpanel coupling. */
    panelBuilder: any;
    contextMenu: ContextMenu;
    propertiesManager: PropertiesManager;
}
