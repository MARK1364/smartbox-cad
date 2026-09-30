/**
 * Belka widokowa — tryb cieniowania, podgląd, projekcja, pan/zoom, info + skróty E1.
 */

import React from 'react';
import { BelkaDisplayModeMenu, BelkaProjectionMenu, BelkaInfoMenu } from './BelkaDisplayModeMenu';
import { ContextManager } from '../A1_core/context-manager';
import { UIController } from '../A1_core/ui-controller';
import { ExportEngine } from '../E1_export';
import { tx } from '../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from './src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

const eyeShowIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

export interface BelkaWidokowaProps {
  renderMode: string;
  projection: string;
  gridVisible: boolean;
  lcsVisible: boolean;
  isPanActive: boolean;
  isZoomWindowActive: boolean;
  activeTab: string;
  displayMenuOpen: boolean;
  viewMenuOpen: boolean;
  projMenuOpen: boolean;
  infoMenuOpen: boolean;
  viewMenuRef: React.RefObject<HTMLDivElement | null>;
  onDisplayMenuOpenChange: (open: boolean) => void;
  onViewMenuOpenChange: (open: boolean) => void;
  onProjMenuOpenChange: (open: boolean) => void;
  onInfoMenuOpenChange: (open: boolean) => void;
  onRenderModeChange: (mode: string) => void;
  onToggleGrid: () => void;
  onToggleLcs: (next: boolean) => void;
  onProjectionChange: (next: string) => void;
  onTogglePan: () => void;
  onToggleZoomWindow: () => void;
  onOpenSSOT: () => void;
  callAPI: (method: string, ...args: any[]) => void;
}

export function BelkaWidokowa(props: BelkaWidokowaProps) {
  const {
    renderMode,
    projection,
    gridVisible,
    lcsVisible,
    isPanActive,
    isZoomWindowActive,
    activeTab,
    displayMenuOpen,
    viewMenuOpen,
    projMenuOpen,
    infoMenuOpen,
    viewMenuRef,
    onDisplayMenuOpenChange,
    onViewMenuOpenChange,
    onProjMenuOpenChange,
    onInfoMenuOpenChange,
    onRenderModeChange,
    onToggleGrid,
    onToggleLcs,
    onProjectionChange,
    onTogglePan,
    onToggleZoomWindow,
    onOpenSSOT,
    callAPI,
  } = props;

  const closeOtherMenus = (keep: 'display' | 'view' | 'proj' | 'info') => {
    if (keep !== 'display') onDisplayMenuOpenChange(false);
    if (keep !== 'view') onViewMenuOpenChange(false);
    if (keep !== 'proj') onProjMenuOpenChange(false);
    if (keep !== 'info') onInfoMenuOpenChange(false);
  };

  return (
    <div
      id="belka-widokowa"
      className="belka-widokowa"
      aria-label="Belka widokowa"
      data-ui-name="Belka widokowa"
    >
      <BelkaDisplayModeMenu
        mode={renderMode}
        open={displayMenuOpen}
        onOpenChange={(next) => {
          onDisplayMenuOpenChange(next);
          if (next) closeOtherMenus('display');
        }}
        onChange={(m) => {
          onRenderModeChange(m);
          callAPI('setRenderMode', m);
        }}
      />
      <span className="tool-separator"></span>
      <div ref={viewMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          className={`tool-btn ${viewMenuOpen ? 'active' : ''}`}
          onClick={() => {
            onViewMenuOpenChange(!viewMenuOpen);
            closeOtherMenus('view');
          }}
          title={tx(srcTekst, 'app.view.preview_title', TX_NS)}
        >
          {eyeShowIcon}
          <span>{tx(srcTekst, 'app.view.preview', TX_NS)}</span>
          <svg
            viewBox="0 0 24 24"
            width="10"
            height="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            style={{ marginLeft: '2px', opacity: 0.8 }}
          >
            <path d="M6 9l6 6 6-6"></path>
          </svg>
        </button>

        {viewMenuOpen && (
          <div
            className="view-dropdown-content"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '8px 12px',
              minWidth: '150px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow:
                '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: '#e2e8f0',
                fontSize: '0.8rem',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={gridVisible}
                onChange={onToggleGrid}
                style={{ cursor: 'pointer' }}
              />
              {tx(srcTekst, 'app.view.grid', TX_NS)}
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: '#e2e8f0',
                fontSize: '0.8rem',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={lcsVisible}
                onChange={() => onToggleLcs(!lcsVisible)}
                style={{ cursor: 'pointer' }}
              />
              LCS
            </label>
          </div>
        )}
      </div>
      <BelkaProjectionMenu
        mode={projection}
        open={projMenuOpen}
        onOpenChange={(next) => {
          onProjMenuOpenChange(next);
          if (next) closeOtherMenus('proj');
        }}
        onChange={(next) => {
          if (next === projection) return;
          onProjectionChange(next);
          callAPI('toggleProjection');
        }}
      />
      <button
        className={`tool-btn ${isPanActive ? 'active' : ''}`}
        id="toolPan"
        onClick={onTogglePan}
        title={tx(srcTekst, 'app.view.pan', TX_NS)}
      >
        {tx(srcTekst, 'app.view.pan_btn', TX_NS)}
      </button>
      <button
        className={`tool-btn ${isZoomWindowActive ? 'active' : ''}`}
        id="toolZoomWindow"
        onClick={onToggleZoomWindow}
        title={tx(srcTekst, 'app.view.zoom', TX_NS)}
      >
        🔍 Zoom
      </button>
      <span className="tool-separator"></span>
      <BelkaInfoMenu
        open={infoMenuOpen}
        onOpenChange={(next) => {
          onInfoMenuOpenChange(next);
          if (next) closeOtherMenus('info');
        }}
        onToggleInspector={() => {
          if ((window as any).toggleInspector) {
            (window as any).toggleInspector();
          } else if (UIController.instance?.viewport) {
            UIController.instance.viewport.toggleInspector();
          }
        }}
        onDumpSceneTree={() => {
          let res = '';
          if ((window as any).debugCADSceneTree) {
            res = (window as any).debugCADSceneTree();
          } else if (ContextManager.instance?.sceneSyncAdapter) {
            res = ContextManager.instance.sceneSyncAdapter.debugDumpTrees();
          }
          alert(tx(srcTekst, 'app.tree_dump', TX_NS) + (res ? res.substring(0, 400) + '...' : 'OK'));
        }}
        onOpenSSOT={onOpenSSOT}
      />

      {activeTab === 'tab-e1-export' && (
        <>
          <span className="tool-separator"></span>
          <button
            className="tool-btn"
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '4px',
            }}
            onClick={async () => {
              try {
                const sheet = await ExportEngine.instance.generateCurrentDrawingSheet();
                ExportEngine.instance.setPreviewSvg(sheet.toSvgString());
              } catch (e: any) {
                alert(tx(srcTekst, 'app.preview_error', TX_NS, { error: e?.message || e }));
              }
            }}
            title={tx(srcTekst, 'app.sheet_preview', TX_NS)}
          >
            {tx(srcTekst, 'app.quick_preview', TX_NS)}
          </button>
          <button
            className="tool-btn"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            onClick={async () => {
              try {
                const sheet = await ExportEngine.instance.generateCurrentDrawingSheet();
                await sheet.printOrSavePdf();
              } catch (e: any) {
                alert(tx(srcTekst, 'app.print_error', TX_NS, { error: e?.message || e }));
              }
            }}
            title="Drukuj arkusz lub zapisz do PDF w skali 1:1"
          >
            🖨️ Drukuj / PDF
          </button>
          <button
            className="tool-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={async () => {
              try {
                const sheet = await ExportEngine.instance.generateCurrentDrawingSheet();
                await sheet.downloadRaster(
                  `Arkusz_CAD_${ExportEngine.instance.paperFormat}.jpg`,
                  'image/jpeg',
                );
              } catch (e: any) {
                alert(tx(srcTekst, 'app.jpg_error', TX_NS, { error: e?.message || e }));
              }
            }}
            title={tx(srcTekst, 'app.jpg_title', TX_NS)}
          >
            🖼️ JPG
          </button>
          <button
            className="tool-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={async () => {
              try {
                const sheet = await ExportEngine.instance.generateCurrentDrawingSheet();
                sheet.downloadSvg(`Arkusz_CAD_${ExportEngine.instance.paperFormat}.svg`);
              } catch (e: any) {
                alert(tx(srcTekst, 'app.svg_error', TX_NS, { error: e?.message || e }));
              }
            }}
            title="Pobierz wektorowy plik CAD SVG"
          >
            📐 SVG
          </button>
        </>
      )}
    </div>
  );
}
