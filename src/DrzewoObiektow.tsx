/**
 * Drzewo obiektów — panel layoutowy (#drzewo-obiektow) + SceneTree (lub własna treść).
 */

import React from 'react';
import { SceneTree } from './SceneTree';
import { UIController } from '../A1_core/ui-controller';
import { TREE_MIN_CONTENT_WIDTH } from './hooks/use-panel-widths';
import { tx } from '../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from './src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

export interface DrzewoObiektowProps {
  /** Wymagane gdy brak `children` — wtedy renderuje SceneTree. */
  projectModel?: any;
  treeWidth: number;
  isDraggingTree: boolean;
  startResizeTree: (e: React.PointerEvent) => void;
  /** Gdy podane — zamiast SceneTree (np. Studio SmartParts). */
  children?: React.ReactNode;
}

export function DrzewoObiektow({
  projectModel,
  treeWidth,
  isDraggingTree,
  startResizeTree,
  children,
}: DrzewoObiektowProps) {
  const title = tx(srcTekst, 'app.tree.title', TX_NS);
  const collapsed = treeWidth <= 48;

  return (
    <div
      id="drzewo-obiektow"
      className={`drzewo-obiektow ${collapsed ? 'is-collapsed' : ''}`}
      aria-label={title}
      data-ui-name={title}
      style={{ width: `${treeWidth}px` }}
    >
      <div
        className="panel-inner-content"
        style={{
          minWidth: `${TREE_MIN_CONTENT_WIDTH}px`,
          width: '100%',
          height: '100%',
          minHeight: 0,
          flex: 1,
          flexShrink: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition: isDraggingTree ? 'none' : 'opacity 0.15s ease',
        }}
      >
        <div
          className="panel-header"
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: '0.9rem', margin: 0, color: '#e2e8f0' }}>{title}</h2>
        </div>
        <div
          className="panel-section"
          style={{ padding: '6px', overflowY: 'auto', flex: 1, minHeight: 0 }}
          onContextMenu={(e) => {
            e.preventDefault();
            UIController.instance?.emitTree('contextmenu-tree-bg', {
              clientX: e.clientX,
              clientY: e.clientY,
            });
          }}
        >
          {children ?? <SceneTree projectModel={projectModel} />}
        </div>
      </div>

      <div
        className={`panel-resize-handle panel-resize-handle--left-panel ${isDraggingTree ? 'is-dragging' : ''} ${collapsed ? 'is-collapsed' : ''}`}
        onPointerDown={startResizeTree}
        title={
          collapsed
            ? tx(srcTekst, 'app.tree.expand', TX_NS)
            : tx(srcTekst, 'app.tree.collapse', TX_NS)
        }
      >
        <div className="panel-resize-gizmo">
          <div className="panel-resize-gizmo-dot" />
        </div>
      </div>
    </div>
  );
}
