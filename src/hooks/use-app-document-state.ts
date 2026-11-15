/**
 * Hooki stanu App — obserwatory ContextManager / UIController / TooltipManager.
 * Wyciągnięte z App.tsx, żeby ekran główny nie trzymał boilerplate'u subskrypcji.
 * Oparte na `useSyncExternalStore` (React 18) i selektorach — bez pollingu `setTimeout`.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { UIController, type UIState } from '../../A1_core/ui-controller';
import { ContextManager } from '../../A1_core/context-manager';
import { TooltipManager, type ToolHint } from '../../A1_core/tooltip-manager';
import { ModalTransformManager, type ModalTransformMode } from '../../A1_core/modal-transform';
import type { ProjectDocument } from '../../A1_core/project-document';

function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false;
  }
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ) {
      return false;
    }
  }
  return true;
}

const subscribeModalTransform = (onStoreChange: () => void) =>
  ModalTransformManager.instance.subscribe(() => onStoreChange());
const getModalTransformSnapshot = (): ModalTransformMode =>
  ModalTransformManager.instance.activeMode;

export function useModalTransformState(): ModalTransformMode {
  return useSyncExternalStore(subscribeModalTransform, getModalTransformSnapshot, getModalTransformSnapshot);
}

const subscribeToolHint = (onStoreChange: () => void) =>
  TooltipManager.instance.onChange(() => onStoreChange());
const getToolHintSnapshot = (): ToolHint | null =>
  TooltipManager.instance.activeHint;

export function useToolHint(): ToolHint | null {
  return useSyncExternalStore(subscribeToolHint, getToolHintSnapshot, getToolHintSnapshot);
}

/** Re-render przy zmianach ProjectDocument (reaktywne podpięcie bez pollingu). */
export function useProjectDocument(): any {
  const [, setTick] = useState(0);
  const [projectModel, setProjectModel] = useState<ProjectDocument | null>(
    () => UIController.instance?.document ?? ContextManager.instance.document ?? null
  );

  useEffect(() => {
    let docUnsub: (() => void) | null = null;
    let currentDoc: ProjectDocument | null = null;

    const bindDoc = (nextDoc: ProjectDocument | null) => {
      if (nextDoc === currentDoc) return;
      if (docUnsub) {
        docUnsub();
        docUnsub = null;
      }
      currentDoc = nextDoc;
      if (nextDoc) {
        ContextManager.instance.document = nextDoc;
        setProjectModel(nextDoc);
        docUnsub = nextDoc.onDocumentChanged(() => {
          setTick((t) => t + 1);
        });
        setTick((t) => t + 1);
      }
    };

    bindDoc(UIController.instance?.document ?? ContextManager.instance.document ?? null);

    const uiUnsub = UIController.subscribe(() => {
      const candidate = UIController.instance?.document ?? ContextManager.instance.document ?? null;
      if (candidate !== currentDoc) {
        bindDoc(candidate);
      }
    });

    return () => {
      uiUnsub();
      if (docUnsub) {
        docUnsub();
      }
    };
  }, []);

  return projectModel;
}

const getUIStateSnapshot = (): UIState | null => UIController.instance?.state ?? null;

/** Pełny obiekt stanu `UIController` (dla komponentów potrzebujących całości). */
export function useUIState(): UIState | null {
  return useSyncExternalStore(UIController.subscribe, getUIStateSnapshot, getUIStateSnapshot);
}

/**
 * Selektor wycinka stanu `UIController` z porównaniem płytkim (`shallowEqual`).
 * Pozwala komponentowi re-renderować się wyłącznie wtedy, gdy zmieniły się wybrane pola
 * (np. wymiary wejściowe bez re-renderu przy zmianie tekstu statusu lub kursora UV).
 */
export function useUISelector<T>(
  selector: (state: UIState | null) => T,
  isEqual: (a: T, b: T) => boolean = shallowEqual
): T {
  const cacheRef = useRef<{ hasValue: boolean; value: T }>({
    hasValue: false,
    value: undefined as unknown as T,
  });

  const getSnapshot = (): T => {
    const next = selector(UIController.instance?.state ?? null);
    if (cacheRef.current.hasValue && isEqual(cacheRef.current.value, next)) {
      return cacheRef.current.value;
    }
    cacheRef.current = { hasValue: true, value: next };
    return next;
  };

  return useSyncExternalStore(UIController.subscribe, getSnapshot, getSnapshot);
}
