/**
 * Panel edycji — panel layoutowy (#panel-edycji) + treść zakładki / modułu.
 */

import React from 'react';
import { EDIT_MIN_CONTENT_WIDTH } from './hooks/use-panel-widths';
import { tx } from '../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from './src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

export interface PanelEdycjiProps {
  editPanelWidth: number;
  isDraggingEdit: boolean;
  startResizeEdit: (e: React.PointerEvent) => void;
  children: React.ReactNode;
}

export function PanelEdycji({
  editPanelWidth,
  isDraggingEdit,
  startResizeEdit,
  children,
}: PanelEdycjiProps) {
  const collapsed = editPanelWidth <= 48;

  return (
    <div
      id="panel-edycji"
      className={`panel-edycji ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Panel edycji"
      data-ui-name="Panel edycji"
      style={{ width: `${editPanelWidth}px` }}
    >
      <div
        className={`panel-resize-handle panel-resize-handle--right-panel ${isDraggingEdit ? 'is-dragging' : ''} ${collapsed ? 'is-collapsed' : ''}`}
        onPointerDown={startResizeEdit}
        title={
          collapsed
            ? tx(srcTekst, 'app.panel.expand', TX_NS)
            : tx(srcTekst, 'app.panel.collapse', TX_NS)
        }
      >
        <div className="panel-resize-gizmo">
          <div className="panel-resize-gizmo-dot" />
        </div>
      </div>

      <div
        className="panel-inner-content"
        style={{
          minWidth: `${EDIT_MIN_CONTENT_WIDTH}px`,
          width: '100%',
          height: 'auto',
          maxHeight: 'calc(100vh - 80px)',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          overflowY: 'auto',
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition: isDraggingEdit ? 'none' : 'opacity 0.15s ease',
        }}
      >
        <div
          className="panel-header"
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: '0.85rem', margin: 0, color: '#e2e8f0' }}>Panel edycji</h2>
        </div>
        {children}
      </div>
    </div>
  );
}
