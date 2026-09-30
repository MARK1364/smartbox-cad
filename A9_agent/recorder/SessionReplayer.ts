/**
 * SessionReplayer.ts
 * Precyzyjny i pĹ‚ynny odtwarzacz zarejestrowanych sesji CAD.
 */

import {
  RecordedSession,
  RecordedEvent,
  ReplayState,
  MouseMoveData,
  ClickEventData,
  InputEventData,
  TabSwitchEventData,
  CameraEventData,
  MarkerEventData,
  CadActionEventData,
} from './recorder-types.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { instantiateCabinetTemplate } from '../../B1_biblioteka/korpusy/cabinet-instantiator.js';
import { AssignMaterialCommand, SetEdgeBandingCommand } from '../../A7_material/material-commands.js';
import { materialDatabase } from '../../A7_material/material-database.js';
import { isPanelModel } from '../../A4_smartpanel/panel-model.js';
import type { ProjectDocument } from '../../A1_core/project-document.js';
import { probeBayFromCADPoint } from '../../A2_bloki/bloki-bay-detector.js';
import { createBlokInDetectedBay } from '../../A2_bloki/bloki-bay-actions.js';
import { SmartFrameDragController } from '../../A3_smartframe/smartframe-drag-controller.js';
import { BlokiBayController } from '../../A2_bloki/bloki-bay-controller.js';

export class SessionReplayer {
  private static _instance: SessionReplayer | null = null;

  public static get instance(): SessionReplayer {
    if (!this._instance) {
      this._instance = new SessionReplayer();
    }
    return this._instance;
  }

  private _session: RecordedSession | null = null;
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;
  private _speed: number = 1;

  private _playbackStartTime: number = 0;
  private _currentTimeMs: number = 0;
  private _lastProcessedEventIdx: number = 0;
  private _animFrameId: number | null = null;

  private _currentPointer: { x: number; y: number; isClicking?: boolean } | null = null;
  private _activeMarker: MarkerEventData | null = null;
  private _pendingDragState: {
    type: 'smartframe' | 'bloki';
    liczba_stref?: 1 | 2 | 3;
    boxType?: string;
    params?: any;
  } | null = null;
  private _lastInsertedBlokiTime: number = 0;

  private _getActiveDocument(): ProjectDocument | null {
    return (
      ContextManager.instance.document ||
      (window as any).UIController?.instance?.document ||
      (window as any).__projectDocument ||
      null
    );
  }

  private _stateListeners: Set<(state: ReplayState) => void> = new Set();
  private _onTabSwitch: ((tabKey: string) => void) | null = null;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get currentSession(): RecordedSession | null {
    return this._session;
  }

  get speed(): number {
    return this._speed;
  }

  setTabSwitchHandler(handler: (tabKey: string) => void): void {
    this._onTabSwitch = handler;
  }

  subscribe(listener: (state: ReplayState) => void): () => void {
    this._stateListeners.add(listener);
    return () => this._stateListeners.delete(listener);
  }

  private _notifyState(): void {
    const state: ReplayState = {
      isPlaying: this._isPlaying,
      isPaused: this._isPaused,
      currentTimeMs: this._currentTimeMs,
      totalDurationMs: this._session ? this._session.durationMs : 0,
      speed: this._speed,
      currentPointer: this._currentPointer,
      activeMarker: this._activeMarker,
    };
    for (const l of this._stateListeners) {
      try {
        l(state);
      } catch (e) {
        console.error(e);
      }
    }
  }

  loadSession(session: RecordedSession): void {
    this.stop();
    this._session = session;
    this._currentTimeMs = 0;
    this._lastProcessedEventIdx = 0;
    this._currentPointer = null;
    this._activeMarker = null;
    this._notifyState();
  }

  setSpeed(speed: number): void {
    if (this._isPlaying && !this._isPaused) {
      const now = performance.now();
      this._playbackStartTime = now - (this._currentTimeMs / speed);
    }
    this._speed = speed;
    this._notifyState();
  }

  play(): void {
    if (!this._session || this._session.events.length === 0) return;

    if (this._isPaused) {
      this._isPaused = false;
      this._isPlaying = true;
      this._playbackStartTime = performance.now() - (this._currentTimeMs / this._speed);
      this._startLoop();
      this._notifyState();
      return;
    }

    this._isPlaying = true;
    this._isPaused = false;
    this._currentTimeMs = 0;
    this._lastProcessedEventIdx = 0;
    this._playbackStartTime = performance.now();
    this._startLoop();
    this._notifyState();
  }

  pause(): void {
    if (!this._isPlaying || this._isPaused) return;
    this._isPaused = true;
    this._stopLoop();
    this._notifyState();
  }

  stop(): void {
    this._isPlaying = false;
    this._isPaused = false;
    this._currentTimeMs = 0;
    this._lastProcessedEventIdx = 0;
    this._currentPointer = null;
    this._activeMarker = null;
    this._pendingDragState = null;
    this._lastInsertedBlokiTime = 0;
    this._stopLoop();
    this._notifyState();
  }

  seekTo(timeMs: number): void {
    if (!this._session) return;
    this._currentTimeMs = Math.max(0, Math.min(timeMs, this._session.durationMs));

    if (this._isPlaying && !this._isPaused) {
      this._playbackStartTime = performance.now() - (this._currentTimeMs / this._speed);
    }

    // Reset indeksu zdarzeĹ„ do przeliczenia
    this._lastProcessedEventIdx = 0;
    for (let i = 0; i < this._session.events.length; i++) {
      if (this._session.events[i].t <= this._currentTimeMs) {
        this._lastProcessedEventIdx = i;
      } else {
        break;
      }
    }

    this._updatePointerInterpolation(this._currentTimeMs);
    this._notifyState();
  }

  private _startLoop(): void {
    this._stopLoop();

    const loop = () => {
      if (!this._isPlaying || this._isPaused || !this._session) return;

      try {
        const now = performance.now();
        this._currentTimeMs = (now - this._playbackStartTime) * this._speed;

        if (this._currentTimeMs >= this._session.durationMs) {
          this._currentTimeMs = this._session.durationMs;
          this._processEventsUpTo(this._currentTimeMs);
          this.stop();
          return;
        }

        this._processEventsUpTo(this._currentTimeMs);
        this._updatePointerInterpolation(this._currentTimeMs);
        this._notifyState();
      } catch (err) {
        console.error('[SessionReplayer] Error in animation frame:', err);
      }

      this._animFrameId = requestAnimationFrame(loop);
    };

    this._animFrameId = requestAnimationFrame(loop);
  }

  private _stopLoop(): void {
    if (this._animFrameId !== null) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
  }

  private _processEventsUpTo(timeMs: number): void {
    if (!this._session) return;
    const events = this._session.events;

    while (
      this._lastProcessedEventIdx < events.length &&
      events[this._lastProcessedEventIdx].t <= timeMs
    ) {
      const ev = events[this._lastProcessedEventIdx];
      this._executeEvent(ev);
      this._lastProcessedEventIdx++;
    }
  }

  private _executeEvent(ev: RecordedEvent): void {
    try {
      switch (ev.type) {
        case 'click': {
          const data = ev.data as ClickEventData;
          this._triggerVirtualClick(data);
          break;
        }
        case 'input': {
          const data = ev.data as InputEventData;
          this._triggerVirtualInput(data);
          break;
        }
        case 'tab_switch': {
          const data = ev.data as TabSwitchEventData;
          if (data.tabKey) {
            let canonicalTab = data.tabKey;
            if (canonicalTab === 'smartframe' || canonicalTab === 'a3-smartframe' || canonicalTab === 'korpus' || canonicalTab === 'tab-a3-smartframe') {
              canonicalTab = 'tab-a3-smartframe';
            } else if (canonicalTab === 'bloki' || canonicalTab === 'a2-bloki' || canonicalTab === 'wnetrze' || canonicalTab === 'tab-a2-bloki') {
              canonicalTab = 'tab-a2-bloki';
            } else if (canonicalTab === 'smartpanel' || canonicalTab === 'a4-smartpanel' || canonicalTab === 'panel' || canonicalTab === 'tab-a4-smartpanel') {
              canonicalTab = 'tab-a4-smartpanel';
            } else if (canonicalTab === 'biblioteka' || canonicalTab === 'b1-biblioteka' || canonicalTab === 'tab-b1-biblioteka') {
              canonicalTab = 'tab-b1-biblioteka';
            } else if (canonicalTab === 'solver' || canonicalTab === 's2-solver' || canonicalTab === 'relacje' || canonicalTab === 'tab-s2-solver') {
              canonicalTab = 'tab-s2-solver';
            } else if (canonicalTab === 'material' || canonicalTab === 'a7-material' || canonicalTab === 'materialy' || canonicalTab === 'tab-a7-material') {
              canonicalTab = 'tab-a7-material';
            } else if (canonicalTab === 'connectors' || canonicalTab === 'c2-connectors' || canonicalTab === 'zlacza' || canonicalTab === 'tab-c2-connectors') {
              canonicalTab = 'tab-c2-connectors';
            } else if (canonicalTab === 'operacji' || canonicalTab === 'o1-operacji' || canonicalTab === 'tab-o1-operacji') {
              canonicalTab = 'tab-o1-operacji';
            } else if (canonicalTab === 'cnc' || canonicalTab === 'c1-cnc' || canonicalTab === 'tab-c1-cnc') {
              canonicalTab = 'tab-c1-cnc';
            } else if (canonicalTab === 'nesting' || canonicalTab === 'n1-nesting' || canonicalTab === 'tab-n1-nesting') {
              canonicalTab = 'tab-n1-nesting';
            } else if (canonicalTab === 'export' || canonicalTab === 'e1-export' || canonicalTab === 'tab-e1-export') {
              canonicalTab = 'tab-e1-export';
            }
            if (this._onTabSwitch) {
              this._onTabSwitch(canonicalTab);
            }
            if (typeof document !== 'undefined') {
              window.dispatchEvent(new CustomEvent('cad-switch-tab', { detail: { tabId: canonicalTab } }));
              const btn = document.querySelector(`button[data-tab="${canonicalTab}"], button[id*="${canonicalTab.replace('tab-', '')}"]`) as HTMLElement;
              btn?.click?.();
            }
          }
          break;
        }
        case 'camera': {
          const data = ev.data as CameraEventData;
          this._syncCamera(data);
          break;
        }
        case 'marker': {
          const data = ev.data as MarkerEventData;
          this._activeMarker = data;
          break;
        }
        case 'cad_action': {
          const data = ev.data as CadActionEventData;
          this._executeCadAction(data);
          break;
        }
        case 'drag_start': {
          const d = ev.data as any;
          if (d.liczba_stref !== undefined) {
            const zc = (Number(d.liczba_stref) || 3) as 1 | 2 | 3;
            this._pendingDragState = {
              type: 'smartframe',
              liczba_stref: zc,
              params: { szerokosc_mm: 1000, wysokosc_mm: 2200, glebokosc_mm: 600, liczba_stref: zc },
            };
            if (!ContextManager.instance.smartFrameDragController) {
              ContextManager.instance.smartFrameDragController = new SmartFrameDragController();
            }
            const dragCtrl = ContextManager.instance.smartFrameDragController;
            dragCtrl?.startDrag(zc, { szerokosc_mm: 1000, wysokosc_mm: 2200, glebokosc_mm: 600, liczba_stref: zc });
          } else if (d.boxType) {
            const bType = String(d.boxType);
            this._pendingDragState = {
              type: 'bloki',
              boxType: bType,
              params: { boxType: bType },
            };
            if (!ContextManager.instance.blokiBayController) {
              ContextManager.instance.blokiBayController = new BlokiBayController();
            }
            const ctrl = ContextManager.instance.blokiBayController;
            ctrl?.startDrag(bType);
            ctrl?.setPendingBlokType(bType);
          }
          break;
        }
        case 'drag_drop': {
          const doc = this._getActiveDocument();
          const pending = this._pendingDragState;
          const d = (ev.data || {}) as any;
          const scene = ContextManager.instance.babylonScene || ContextManager.instance.viewport?.scene;
          const winW = typeof window !== 'undefined' ? window.innerWidth : 1920;
          const winH = typeof window !== 'undefined' ? window.innerHeight : 1080;
          const dropX = d.nx !== undefined ? d.nx * winW : (d.x ?? winW / 2);
          const dropY = d.ny !== undefined ? d.ny * winH : (d.y ?? winH / 2);

          // 1. ObsĹ‚uga Korpusu (SmartFrame)
          if (pending?.type === 'smartframe' || ContextManager.instance.smartFrameDragController?.isDragging) {
            const frameCtrl = ContextManager.instance.smartFrameDragController;
            if (frameCtrl && scene) {
              try {
                frameCtrl.onPointerMoveOnScene(scene, dropX, dropY);
              } catch (e) {
                console.warn('[SessionReplayer] frameCtrl.onPointerMoveOnScene error:', e);
              }
            }
            let dropped = false;
            if (frameCtrl && frameCtrl.isDragging && doc) {
              try {
                dropped = frameCtrl.onDropOnScene(doc);
              } catch (e) {
                console.warn('[SessionReplayer] frameCtrl.onDropOnScene failed:', e);
              }
            }
            // Fallback: jeĹ›li onDropOnScene nie utworzyĹ‚ korpusu, wykonaj CreateKorpusCommand bezpoĹ›rednio
            if (!dropped && doc) {
              const zc = (pending?.liczba_stref || frameCtrl?.draggedZoneCount || 3) as 1 | 2 | 3;
              const bH = zc === 1 ? 2200 : zc === 2 ? 1100 : 500;
              const mH = zc === 3 ? 1200 : 0;
              const cmd = new CreateKorpusCommand({
                szerokosc_mm: 1000,
                wysokosc_mm: 2200,
                glebokosc_mm: 600,
                liczba_stref: zc,
                wysokosc_strefy_dolnej_mm: bH,
                wysokosc_strefy_srodkowej_mm: mH,
                cofniecie_plecow_mm: 3,
                position: { x: 0, y: 0, z: 0 },
              });
              const history = ContextManager.instance.commandHistory;
              if (history && typeof history.execute === 'function') {
                history.execute(cmd);
              } else {
                cmd.execute(doc);
              }
            }
            frameCtrl?.endDrag();
            if (typeof window !== 'undefined') {
              (window as any).__rebuildGeometry?.('Replay: Utworzono Korpus');
              window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            }
            this._pendingDragState = null;
          }

          // 2. ObsĹ‚uga WnÄ™trza (Bloki)
          const bayCtrl = ContextManager.instance.blokiBayController;
          if (pending?.type === 'bloki' || (bayCtrl && bayCtrl.isDragging)) {
            const bType = pending?.boxType || bayCtrl?.draggedBlokType || bayCtrl?.pendingBlokType || 'DIVIDERS';
            if (bayCtrl && scene && doc) {
              try {
                bayCtrl.onPointerMoveOnScene(scene, dropX, dropY, doc);
              } catch (e) {
                console.warn('[SessionReplayer] bayCtrl.onPointerMoveOnScene error:', e);
              }
            }
            let dropped = false;
            if (bayCtrl && bayCtrl.isDragging && (bayCtrl as any)._lastDetectedBay) {
              try {
                bayCtrl.onDropOnScene();
                dropped = true;
                this._lastInsertedBlokiTime = performance.now();
              } catch (e) {
                console.warn('[SessionReplayer] bayCtrl.onDropOnScene failed:', e);
              }
            }
            // Fallback: znajdĹş docelowÄ… wnÄ™kÄ™ i wstaw Bloki
            if (!dropped && doc) {
              this._insertBlokiFallback(doc, bType);
              this._lastInsertedBlokiTime = performance.now();
            }
            bayCtrl?.endDrag();
            this._pendingDragState = null;
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.warn('[SessionReplayer] Event execution error:', err);
    }
  }

  private _executeCadAction(data: CadActionEventData): void {
    try {
      const doc = this._getActiveDocument();
      if (!doc) {
        console.warn('[SessionReplayer] Document not available for CAD action:', data.action);
        return;
      }

    switch (data.action) {
      case 'reset_scene': {
        const rootChildren = [...(doc.rootNode?.children || [])];
        for (const child of rootChildren) {
          doc.removeNode(child.id);
        }
        if (typeof window !== 'undefined') {
          (window as any).__rebuildGeometry?.('Replay: Reset Sceny');
        }
        break;
      }
      case 'create_korpus': {
        // Kanoniczne DTO â€” nagrania legacy (width/zoneCount/â€¦) sÄ… odrzucane Ĺ›wiadomie.
        const p = data.params || {};
        const wysokoscMm = p.wysokosc_mm || 720;
        const cmd = new CreateKorpusCommand({
          szerokosc_mm: p.szerokosc_mm || 800,
          wysokosc_mm: wysokoscMm,
          glebokosc_mm: p.glebokosc_mm || 560,
          liczba_stref: p.liczba_stref || 1,
          wysokosc_strefy_dolnej_mm: p.wysokosc_strefy_dolnej_mm || wysokoscMm,
          wysokosc_strefy_srodkowej_mm: p.wysokosc_strefy_srodkowej_mm || 0,
          cofniecie_plecow_mm: p.cofniecie_plecow_mm ?? 3,
          position: p.position || { x: 0, y: 0, z: 0 },
        });
        const history = ContextManager.instance.commandHistory;
        if (history && typeof history.execute === 'function') {
          history.execute(cmd);
        } else {
          cmd.execute(doc);
        }
        if (typeof window !== 'undefined') {
          (window as any).__rebuildGeometry?.('Replay: Utworzono Korpus');
          window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
        break;
      }
      case 'start_drag_korpus': {
        const dragCtrl = ContextManager.instance.smartFrameDragController;
        if (dragCtrl) {
          dragCtrl.startDrag((data.params?.liczba_stref as any) || 3, {
            szerokosc_mm: data.params?.szerokosc_mm || 1000,
            wysokosc_mm: data.params?.wysokosc_mm || 2200,
            glebokosc_mm: data.params?.glebokosc_mm || 600,
            wysokosc_strefy_dolnej_mm: data.params?.wysokosc_strefy_dolnej_mm || 500,
            wysokosc_strefy_srodkowej_mm: data.params?.wysokosc_strefy_srodkowej_mm || 1200,
            cofniecie_plecow_mm: data.params?.cofniecie_plecow_mm ?? 3
          });
        }
        break;
      }
      case 'drop_korpus':
      case 'create_3zone_wardrobe': {
        const dragCtrl = ContextManager.instance.smartFrameDragController;
        if (dragCtrl && dragCtrl.isDragging) {
          dragCtrl.onDropOnScene(doc);
        } else {
          const rootChildren = [...(doc.rootNode?.children || [])];
          for (const child of rootChildren) {
            doc.removeNode(child.id);
          }
          const cmd = new CreateKorpusCommand({
            szerokosc_mm: 1000,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 3,
            wysokosc_strefy_dolnej_mm: 500,
            wysokosc_strefy_srodkowej_mm: 1200,
            cofniecie_plecow_mm: 3,
            position: { x: 0, y: 0, z: 0 },
          });
          const history = ContextManager.instance.commandHistory;
          if (history && typeof history.execute === 'function') {
            history.execute(cmd);
          } else {
            cmd.execute(doc);
          }
          if (typeof window !== 'undefined') {
            (window as any).__rebuildGeometry?.('Replay: Szafa 3-strefowa');
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
          }
        }
        break;
      }
      case 'blok_bay_select': {
        if (performance.now() - this._lastInsertedBlokiTime < 3000) {
          // Pomijamy ponowne wstawienie, jeĹ›li moduĹ‚ zostaĹ‚ juĹĽ wstawiony przez drag_drop
          break;
        }
        const bayCtrl = ContextManager.instance.blokiBayController;
        const bType = bayCtrl?.pendingBlokType || bayCtrl?.draggedBlokType || 'DIVIDERS';
        if (doc) {
          this._insertBlokiFallback(doc, bType);
          this._lastInsertedBlokiTime = performance.now();
        }
        break;
      }
      case 'insert_drawers_bottom': {
        const rootChildren = [...(doc.rootNode?.children || [])];
        for (const child of rootChildren) {
          doc.removeNode(child.id);
        }
        const tmpl = {
          id: 'wardrobe_drawers_step',
          name: 'Szafa 3-strefowa (Szuflady DĂłĹ‚)',
          dimensions: { width: 1000, height: 2200, depth: 600 },
          frameParams: { liczba_stref: 3 as 3, wysokosc_strefy_dolnej_mm: 500, wysokosc_strefy_srodkowej_mm: 1200, cofniecie_plecow_mm: 3 },
          submodules: [
            { boxType: 'DRAWERS', label: 'Szuflady Blum (2 szt.)', zoneIndex: 0, drawerCount: 2, drawerGapMm: 3 }
          ]
        };
        instantiateCabinetTemplate({ template: tmpl as any, position: { x: 0, y: 0, z: 0 } }, doc);
        if (typeof window !== 'undefined') {
          (window as any).__rebuildGeometry?.('Replay: Szuflady dĂłĹ‚');
          window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
        break;
      }
      case 'insert_tube_middle': {
        const rootChildren = [...(doc.rootNode?.children || [])];
        for (const child of rootChildren) {
          doc.removeNode(child.id);
        }
        const tmpl = {
          id: 'wardrobe_tube_step',
          name: 'Szafa 3-strefowa (Szuflady + DrÄ…ĹĽek)',
          dimensions: { width: 1000, height: 2200, depth: 600 },
          frameParams: { liczba_stref: 3 as 3, wysokosc_strefy_dolnej_mm: 500, wysokosc_strefy_srodkowej_mm: 1200, cofniecie_plecow_mm: 3 },
          submodules: [
            { boxType: 'DRAWERS', label: 'Szuflady Blum (2 szt.)', zoneIndex: 0, drawerCount: 2, drawerGapMm: 3 },
            { boxType: 'TUBES', label: 'DrÄ…ĹĽek na ubrania', zoneIndex: 1, tubeOffsetTopMm: 80 }
          ]
        };
        instantiateCabinetTemplate({ template: tmpl as any, position: { x: 0, y: 0, z: 0 } }, doc);
        if (typeof window !== 'undefined') {
          (window as any).__rebuildGeometry?.('Replay: DrÄ…ĹĽek Ĺ›rodek');
          window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
        break;
      }
      case 'insert_shelf_top': {
        const rootChildren = [...(doc.rootNode?.children || [])];
        for (const child of rootChildren) {
          doc.removeNode(child.id);
        }
        const tmpl = {
          id: 'wardrobe_shelf_step',
          name: 'Szafa 3-strefowa (Szuflady + DrÄ…ĹĽek + PĂłĹ‚ka)',
          dimensions: { width: 1000, height: 2200, depth: 600 },
          frameParams: { liczba_stref: 3 as 3, wysokosc_strefy_dolnej_mm: 500, wysokosc_strefy_srodkowej_mm: 1200, cofniecie_plecow_mm: 3 },
          submodules: [
            { boxType: 'DRAWERS', label: 'Szuflady Blum (2 szt.)', zoneIndex: 0, drawerCount: 2, drawerGapMm: 3 },
            { boxType: 'TUBES', label: 'DrÄ…ĹĽek na ubrania', zoneIndex: 1, tubeOffsetTopMm: 80 },
            { boxType: 'SHELVES', label: 'PĂłĹ‚ka gĂłra (1 szt.)', zoneIndex: 2, shelfCount: 1, shelfOffsetFrontMm: 10 }
          ]
        };
        instantiateCabinetTemplate({ template: tmpl as any, position: { x: 0, y: 0, z: 0 } }, doc);
        if (typeof window !== 'undefined') {
          (window as any).__rebuildGeometry?.('Replay: PĂłĹ‚ka gĂłra');
          window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
        break;
      }
      case 'insert_doors_extended': {
        const rootChildren = [...(doc.rootNode?.children || [])];
        for (const child of rootChildren) {
          doc.removeNode(child.id);
        }
        const tmpl = {
          id: 'wardrobe_doors_step',
          name: 'Szafa 3-strefowa Kompletna',
          dimensions: { width: 1000, height: 2200, depth: 600 },
          frameParams: { liczba_stref: 3 as 3, wysokosc_strefy_dolnej_mm: 500, wysokosc_strefy_srodkowej_mm: 1200, cofniecie_plecow_mm: 3 },
          submodules: [
            { boxType: 'DRAWERS', label: 'Szuflady Blum (2 szt.)', zoneIndex: 0, drawerCount: 2, drawerGapMm: 3 },
            { boxType: 'TUBES', label: 'DrÄ…ĹĽek na ubrania', zoneIndex: 1, tubeOffsetTopMm: 80 },
            { boxType: 'SHELVES', label: 'PĂłĹ‚ka gĂłra (1 szt.)', zoneIndex: 2, shelfCount: 1, shelfOffsetFrontMm: 10 },
            {
              boxType: 'DOORS',
              label: 'Drzwi wysokie (Ĺšrodek + GĂłra)',
              zoneIndex: 1,
              zoneSpan: 2,
              doorType: 'DOUBLE',
              doorGapMm: 3,
              params: {
                zoneSpan: 2,
                refTop: 'WIENIEC_G',
                doorType: 'DOUBLE',
                doorGapMm: 3
              }
            }
          ]
        };
        instantiateCabinetTemplate({ template: tmpl as any, position: { x: 0, y: 0, z: 0 } }, doc);
        if (typeof window !== 'undefined') {
          (window as any).__rebuildGeometry?.('Replay: Drzwi Ĺ›rodek + gĂłra');
          window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
        break;
      }
      case 'assign_connectors': {
        if (typeof window !== 'undefined') {
          window.document.dispatchEvent(new CustomEvent('cad-connectors-refresh'));
          (window as any).__rebuildGeometry?.('Replay: ZĹ‚Ä…cza i nawierty');
        }
        break;
      }
      case 'assign_materials': {
        const allMats = (materialDatabase as any).getAllMaterials ? (materialDatabase as any).getAllMaterials() : [];
        const oakMat =
          allMats.find((m: any) => m.id?.includes('H3303') || m.id?.includes('OAK')) ||
          allMats[1] || {
            id: 'H3303_ST10_18',
            name: 'DÄ…b Hamilton Naturalny 18mm',
            code: 'H3303 ST10',
            thickness: 18,
            color: { r: 0.76, g: 0.6, b: 0.42 },
          };
        const nodes = (doc as any).getAllNodes ? (doc as any).getAllNodes() : [];
        const panelNodes = nodes.filter((n: any) => n.domainData && isPanelModel(n.domainData));
        if (panelNodes.length > 0) {
          const firstPanel = panelNodes[0];
          const cmdMat = new AssignMaterialCommand(firstPanel.id, oakMat as any, 'ALL' as any);
          cmdMat.execute(doc);
          const cmdEdge = new SetEdgeBandingCommand(
            firstPanel.id,
            'ALL' as any,
            {
              materialId: 'ABS_OAK_1MM',
              materialName: 'ABS DÄ…b Hamilton 1.0mm',
              thicknessMm: 1.0,
              color: '#c29a6b',
            } as any,
            'ALL' as any
          );
          cmdEdge.execute(doc);
        }
        if (typeof window !== 'undefined') {
          (window as any).__rebuildGeometry?.('Replay: Przypisano DÄ…b i ABS');
          window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
        break;
      }
    }
  } catch (err) {
    console.error('[SessionReplayer] Error executing CAD action:', err);
  }
}

  private _insertBlokiFallback(doc: ProjectDocument, bType: string): void {
    try {
      // Szukanie wnÄ™ki w korpusie (Ĺ›rodkowa, dolna, gĂłrna) â€” w ukĹ‚adzie CAD X=0, Y=0 to Ĺ›rodek szafy
      let bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1100 });
      if (!bay) bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1200 });
      if (!bay) bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 300 });
      if (!bay) bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 });
      if (!bay) bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1900 });

      if (!bay) {
        console.warn('[SessionReplayer] _insertBlokiFallback: Nie znaleziono wnÄ™ki dla', bType);
        return;
      }

      const typeMap: Record<string, { type: string; label: string }> = {
        'EMPTY': { type: 'blok_empty', label: '' },
        'SHELVES': { type: 'blok_shelves', label: 'polki' },
        'DRAWERS': { type: 'blok_drawers', label: 'szuflady' },
        'DOORS': { type: 'blok_doors', label: 'drzwi' },
        'TUBES': { type: 'blok_tubes', label: 'drazek' },
        'SHELF': { type: 'blok_shelf', label: 'wieniec' },
        'DIVIDERS': { type: 'blok_dividers', label: 'przegrody' },
        'FLAPS': { type: 'blok_flaps', label: 'klapy' },
        'PANELS': { type: 'blok_panels', label: 'blendy' },
      };
      const opt = typeMap[bType] || { type: `blok_${bType.toLowerCase()}`, label: bType.toLowerCase() };

      const sbNode = createBlokInDetectedBay(doc, bay, {
        id: bType as any,
        type: opt.type as any,
        category: bType === 'PANELS' ? 'external' : 'internal',
        label: opt.label,
        icon: '',
        description: '',
      });

      if (sbNode) {
        doc.setActiveEntity((sbNode.domainData || sbNode) as any);
        if (typeof window !== 'undefined') {
          (window as any).__rebuildGeometry?.(`Replay: Wstawiono ${opt.label}`);
          window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
      }
    } catch (err) {
      console.warn('[SessionReplayer] BĹ‚Ä…d przy wstawianiu Bloki w odtwarzaczu:', err);
    }
  }

  private _updatePointerInterpolation(timeMs: number): void {
    if (!this._session) return;
    const events = this._session.events;

    const winW = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 1080;

    // Szukamy dwĂłch otaczajÄ…cych zdarzeĹ„ myszy / drag do pĹ‚ynnej interpolacji
    let prevMove: RecordedEvent | null = null;
    let nextMove: RecordedEvent | null = null;

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const isPointerEvent = e.type === 'mouse_move' || e.type === 'click' || e.type === 'drag_start' || e.type === 'drag_drop';
      if (isPointerEvent && e.data && (e.data.x !== undefined || e.data.nx !== undefined)) {
        if (e.t <= timeMs) {
          prevMove = e;
        } else {
          nextMove = e;
          break;
        }
      }
    }

    if (!prevMove && !nextMove) return;

    const isDragging = !!(
      (ContextManager.instance.smartFrameDragController?.isDragging) ||
      (ContextManager.instance.blokiBayController?.isDragging) ||
      this._pendingDragState !== null
    );

    if (prevMove && !nextMove) {
      const p = prevMove.data as any;
      const curX = p.nx !== undefined ? p.nx * winW : p.x;
      const curY = p.ny !== undefined ? p.ny * winH : p.y;
      this._currentPointer = {
        x: curX,
        y: curY,
        isClicking: prevMove.type === 'click' || isDragging,
      };
      this._updateSceneControllers(curX, curY);
      return;
    }

    if (!prevMove && nextMove) {
      const n = nextMove.data as any;
      const curX = n.nx !== undefined ? n.nx * winW : n.x;
      const curY = n.ny !== undefined ? n.ny * winH : n.y;
      this._currentPointer = {
        x: curX,
        y: curY,
        isClicking: isDragging,
      };
      this._updateSceneControllers(curX, curY);
      return;
    }

    // Interpolacja liniowa pomiÄ™dzy prev a next
    const p = prevMove!.data as any;
    const n = nextMove!.data as any;
    const t0 = prevMove!.t;
    const t1 = nextMove!.t;
    const factor = t1 > t0 ? (timeMs - t0) / (t1 - t0) : 0;
    const clampedFactor = Math.max(0, Math.min(1, factor));

    const pX = p.nx !== undefined ? p.nx * winW : p.x;
    const pY = p.ny !== undefined ? p.ny * winH : p.y;
    const nX = n.nx !== undefined ? n.nx * winW : n.x;
    const nY = n.ny !== undefined ? n.ny * winH : n.y;

    const curX = pX + (nX - pX) * clampedFactor;
    const curY = pY + (nY - pY) * clampedFactor;

    this._currentPointer = {
      x: curX,
      y: curY,
      isClicking: isDragging || (prevMove!.type === 'click' && (timeMs - t0 < 300)),
    };

    this._updateSceneControllers(curX, curY);
  }

  private _updateSceneControllers(curX: number, curY: number): void {
    const dragCtrl = ContextManager.instance.smartFrameDragController;
    if (dragCtrl && dragCtrl.isDragging) {
      const scene = ContextManager.instance.babylonScene || ContextManager.instance.viewport?.scene;
      if (scene) {
        try {
          dragCtrl.onPointerMoveOnScene(scene, curX, curY);
          ContextManager.instance.viewport?.requestRender(2);
        } catch { /* ignoruj */ }
      }
    }
    const bayCtrl = ContextManager.instance.blokiBayController;
    if (bayCtrl && bayCtrl.isDragging) {
      const scene = ContextManager.instance.babylonScene || ContextManager.instance.viewport?.scene;
      const doc = this._getActiveDocument();
      if (scene && doc) {
        try {
          bayCtrl.onPointerMoveOnScene(scene, curX, curY, doc);
          ContextManager.instance.viewport?.requestRender(2);
        } catch { /* ignoruj */ }
      }
    }
  }

  private _triggerVirtualClick(data: ClickEventData): void {
    if (typeof document === 'undefined') return;

    let targetEl: HTMLElement | null = null;

    // 1. BezpoĹ›rednie i bezpieczne dopasowanie zakĹ‚adek gĂłrnej belki
    if (
      data.elementId === 'tab-btn-bloki' ||
      data.elementId === 'tab-a2-bloki' ||
      data.textContent === 'Bloki' ||
      data.textContent === 'WnÄ™trze'
    ) {
      targetEl = document.querySelector('#tab-btn-bloki, button[data-tab="tab-a2-bloki"], button[title*="Bloki"]') as HTMLElement;
      if (this._onTabSwitch) this._onTabSwitch('tab-a2-bloki');
    } else if (
      data.elementId === 'tab-btn-smartframe' ||
      data.elementId === 'tab-a3-smartframe' ||
      data.textContent === 'Korpus' ||
      data.textContent === 'SmartFrame'
    ) {
      targetEl = document.querySelector('#tab-btn-smartframe, button[data-tab="tab-a3-smartframe"], button[title*="SmartFrame"]') as HTMLElement;
      if (this._onTabSwitch) this._onTabSwitch('tab-a3-smartframe');
    } else if (
      data.elementId === 'tab-btn-biblioteka' ||
      data.elementId === 'tab-b1-biblioteka' ||
      data.textContent === 'Biblioteka'
    ) {
      targetEl = document.querySelector('#tab-btn-biblioteka, button[data-tab="tab-b1-biblioteka"], button[title*="Biblioteka"]') as HTMLElement;
      if (this._onTabSwitch) this._onTabSwitch('tab-b1-biblioteka');
    } else if (data.elementId) {
      targetEl = document.getElementById(data.elementId);
    }

    // 2. Szukanie po selektorze CSS
    if (!targetEl && data.selector) {
      try {
        targetEl = document.querySelector(data.selector);
      } catch {
        /* ignoruj */
      }
    }

    if (targetEl) {
      targetEl.focus?.();
      targetEl.click?.();
    } else {
      // 3. Fallback: klikniÄ™cie w punkcie
      const x = data.nx !== undefined ? data.nx * window.innerWidth : data.x;
      const y = data.ny !== undefined ? data.ny * window.innerHeight : data.y;
      const hit = document.elementFromPoint(x, y) as HTMLElement;
      if (hit && !hit.closest('#recorder-studio-panel')) {
        hit.click?.();
      }
    }
  }

  private _triggerVirtualInput(data: InputEventData): void {
    if (typeof document === 'undefined') return;

    let targetEl: HTMLInputElement | HTMLSelectElement | null = null;
    if (data.elementId) {
      targetEl = document.getElementById(data.elementId) as any;
    }
    if (!targetEl && data.selector) {
      try {
        targetEl = document.querySelector(data.selector) as any;
      } catch {
        /* ignoruj */
      }
    }

    if (targetEl) {
      const setter = Object.getOwnPropertyDescriptor(
        targetEl instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype,
        'value'
      )?.set;
      if (setter) {
        setter.call(targetEl, String(data.value));
      } else {
        targetEl.value = String(data.value);
      }
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
      targetEl.dispatchEvent(new Event('change', { bubbles: true }));
      targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    }
  }

  private _syncCamera(data: CameraEventData): void {
    if (typeof window === 'undefined') return;
    const scene = (window as any).__babylonScene;
    if (!scene || !scene.activeCamera) return;

    const cam = scene.activeCamera;
    if (data.alpha !== undefined) cam.alpha = data.alpha;
    if (data.beta !== undefined) cam.beta = data.beta;
    if (data.radius !== undefined) cam.radius = data.radius;
    if (data.target && Array.isArray(data.target) && cam.target) {
      cam.target.set(data.target[0], data.target[1], data.target[2]);
    }
  }
}
