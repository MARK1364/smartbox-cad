/**
 * Szerokości Drzewa obiektów i Panelu edycji + resize / collapse (localStorage).
 */

import { useCallback, useRef, useState } from 'react';

const TREE_DEFAULT = 280;
const EDIT_DEFAULT = 340;
export const TREE_MIN_CONTENT_WIDTH = 280;
export const EDIT_MIN_CONTENT_WIDTH = 340;
const COLLAPSED_PANEL_WIDTH = 32;
const COLLAPSE_SNAP_THRESHOLD = 75;

function readStoredWidth(
  key: string,
  lastKey: string,
  lastRef: { current: number },
  defaults: { minLast: number; fallback: number },
): number {
  try {
    const saved = localStorage.getItem(key);
    const last = localStorage.getItem(lastKey);
    if (last) {
      const lVal = parseInt(last, 10);
      if (!isNaN(lVal) && lVal >= defaults.minLast) lastRef.current = lVal;
    }
    if (saved) {
      const val = parseInt(saved, 10);
      if (!isNaN(val)) {
        if (val <= 48) return COLLAPSED_PANEL_WIDTH;
        if (val >= 100 && val <= 1000) return val;
      }
    }
  } catch {
    /* ignore */
  }
  return defaults.fallback;
}

export function usePanelWidths() {
  const lastTreeWidthRef = useRef<number>(TREE_DEFAULT);
  const lastEditWidthRef = useRef<number>(EDIT_DEFAULT);

  const [treeWidth, setTreeWidth] = useState<number>(() =>
    readStoredWidth('cad_tree_panel_width', 'cad_last_tree_width', lastTreeWidthRef, {
      minLast: 160,
      fallback: TREE_DEFAULT,
    }),
  );

  const [editPanelWidth, setEditPanelWidth] = useState<number>(() =>
    readStoredWidth('cad_edit_panel_width', 'cad_last_edit_width', lastEditWidthRef, {
      minLast: 200,
      fallback: EDIT_DEFAULT,
    }),
  );

  const [isDraggingTree, setIsDraggingTree] = useState(false);
  const [isDraggingEdit, setIsDraggingEdit] = useState(false);

  const startResizeTree = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingTree(true);
      const startX = e.clientX;
      const startW = treeWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEv: PointerEvent) => {
        const delta = moveEv.clientX - startX;
        const maxW = Math.floor(window.innerWidth * 0.45);
        const rawW = startW + delta;
        const newW =
          rawW < COLLAPSE_SNAP_THRESHOLD
            ? COLLAPSED_PANEL_WIDTH
            : Math.max(COLLAPSED_PANEL_WIDTH, Math.min(maxW, rawW));
        setTreeWidth(newW);
      };

      const onPointerUp = (upEv: PointerEvent) => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsDraggingTree(false);

        const dragDistance = Math.abs(upEv.clientX - startX);
        if (dragDistance < 4) {
          if (treeWidth <= 48) {
            const restored = lastTreeWidthRef.current || TREE_DEFAULT;
            setTreeWidth(restored);
            try {
              localStorage.setItem('cad_tree_panel_width', String(restored));
            } catch {
              /* ignore */
            }
          } else {
            lastTreeWidthRef.current = treeWidth;
            try {
              localStorage.setItem('cad_last_tree_width', String(treeWidth));
            } catch {
              /* ignore */
            }
            setTreeWidth(COLLAPSED_PANEL_WIDTH);
            try {
              localStorage.setItem('cad_tree_panel_width', String(COLLAPSED_PANEL_WIDTH));
            } catch {
              /* ignore */
            }
          }
          return;
        }

        const finalDelta = upEv.clientX - startX;
        const maxW = Math.floor(window.innerWidth * 0.45);
        const rawW = startW + finalDelta;
        const finalW =
          rawW < COLLAPSE_SNAP_THRESHOLD
            ? COLLAPSED_PANEL_WIDTH
            : Math.max(COLLAPSED_PANEL_WIDTH, Math.min(maxW, rawW));
        setTreeWidth(finalW);
        if (finalW > 48) {
          lastTreeWidthRef.current = finalW;
          try {
            localStorage.setItem('cad_last_tree_width', String(finalW));
          } catch {
            /* ignore */
          }
        }
        try {
          localStorage.setItem('cad_tree_panel_width', String(finalW));
        } catch {
          /* ignore */
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [treeWidth],
  );

  const startResizeEdit = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingEdit(true);
      const startX = e.clientX;
      const startW = editPanelWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEv: PointerEvent) => {
        const delta = startX - moveEv.clientX;
        const maxW = Math.floor(window.innerWidth * 0.5);
        const rawW = startW + delta;
        const newW =
          rawW < COLLAPSE_SNAP_THRESHOLD
            ? COLLAPSED_PANEL_WIDTH
            : Math.max(COLLAPSED_PANEL_WIDTH, Math.min(maxW, rawW));
        setEditPanelWidth(newW);
      };

      const onPointerUp = (upEv: PointerEvent) => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsDraggingEdit(false);

        const dragDistance = Math.abs(startX - upEv.clientX);
        if (dragDistance < 4) {
          if (editPanelWidth <= 48) {
            const restored = lastEditWidthRef.current || EDIT_DEFAULT;
            setEditPanelWidth(restored);
            try {
              localStorage.setItem('cad_edit_panel_width', String(restored));
            } catch {
              /* ignore */
            }
          } else {
            lastEditWidthRef.current = editPanelWidth;
            try {
              localStorage.setItem('cad_last_edit_width', String(editPanelWidth));
            } catch {
              /* ignore */
            }
            setEditPanelWidth(COLLAPSED_PANEL_WIDTH);
            try {
              localStorage.setItem('cad_edit_panel_width', String(COLLAPSED_PANEL_WIDTH));
            } catch {
              /* ignore */
            }
          }
          return;
        }

        const finalDelta = startX - upEv.clientX;
        const maxW = Math.floor(window.innerWidth * 0.5);
        const rawW = startW + finalDelta;
        const finalW =
          rawW < COLLAPSE_SNAP_THRESHOLD
            ? COLLAPSED_PANEL_WIDTH
            : Math.max(COLLAPSED_PANEL_WIDTH, Math.min(maxW, rawW));
        setEditPanelWidth(finalW);
        if (finalW > 48) {
          lastEditWidthRef.current = finalW;
          try {
            localStorage.setItem('cad_last_edit_width', String(finalW));
          } catch {
            /* ignore */
          }
        }
        try {
          localStorage.setItem('cad_edit_panel_width', String(finalW));
        } catch {
          /* ignore */
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [editPanelWidth],
  );

  const expandEditPanelIfCollapsed = useCallback(() => {
    setEditPanelWidth((prev) => {
      if (prev <= 48) {
        const restored =
          lastEditWidthRef.current && lastEditWidthRef.current > 48
            ? lastEditWidthRef.current
            : EDIT_DEFAULT;
        try {
          localStorage.setItem('cad_edit_panel_width', String(restored));
        } catch {
          /* ignore */
        }
        return restored;
      }
      return prev;
    });
  }, []);

  return {
    treeWidth,
    editPanelWidth,
    isDraggingTree,
    isDraggingEdit,
    startResizeTree,
    startResizeEdit,
    expandEditPanelIfCollapsed,
  };
}
