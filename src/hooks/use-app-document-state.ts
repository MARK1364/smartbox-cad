/**
 * Hooki stanu App — obserwatory ContextManager / UIController / TooltipManager.
 * Wyciągnięte z App.tsx, żeby ekran główny nie trzymał boilerplate'u subskrypcji.
 */

import { useEffect, useState } from 'react';
import { UIController } from '../../A1_core/ui-controller';
import { ContextManager } from '../../A1_core/context-manager';
import { TooltipManager } from '../../A1_core/tooltip-manager';
import { ModalTransformManager, type ModalTransformMode } from '../../A1_core/modal-transform';

export function useModalTransformState(): ModalTransformMode {
  const [mode, setMode] = useState<ModalTransformMode>(() => ModalTransformManager.instance.activeMode);

  useEffect(() => {
    const unsub = ModalTransformManager.instance.subscribe((currentMode) => {
      setMode(currentMode);
    });
    return () => {
      unsub();
    };
  }, []);

  return mode;
}

export function useToolHint() {
  const [activeHint, setActiveHint] = useState<any>(null);

  useEffect(() => {
    setActiveHint(TooltipManager.instance.activeHint);
    const unsubscribe = TooltipManager.instance.onChange((hint) => {
      setActiveHint(hint ? { ...hint } : null);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return activeHint;
}

/** Re-render przy zmianach ProjectDocument (podpięcie przez UIController). */
export function useProjectDocument() {
  const [, setTick] = useState(0);
  const [projectModel, setProjectModel] = useState<any>(null);

  useEffect(() => {
    const checkInstance = () => {
      const model = UIController.instance?.document;
      if (model) {
        setProjectModel(model);
        ContextManager.instance.document = model;
        const listener = () => setTick((t) => t + 1);
        const unsubscribe = model.onDocumentChanged(listener);
        setTick((t) => t + 1);
        return () => {
          if (typeof unsubscribe === 'function') unsubscribe();
        };
      }
      setTimeout(checkInstance, 50);
    };
    checkInstance();
  }, []);

  return projectModel;
}

export function useUIState() {
  const [uiState, setUiState] = useState<any>(null);

  useEffect(() => {
    const checkInstance = () => {
      const controller = UIController.instance;
      if (controller) {
        setUiState({ ...controller.state });
        controller.onStateChange = () => {
          setUiState({ ...controller.state });
        };
      } else {
        setTimeout(checkInstance, 50);
      }
    };
    checkInstance();
  }, []);

  return uiState;
}
