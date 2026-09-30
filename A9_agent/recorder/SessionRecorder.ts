/**
 * SessionRecorder.ts
 * Moduł nagrywający działania użytkownika w aplikacji CAD podpięty pod moduł A9_agent.
 */

import {
  RecordedEvent,
  RecordedSession,
  MouseMoveData,
  ClickEventData,
  InputEventData,
  CameraEventData,
  MarkerEventData,
} from './recorder-types.js';

const STORAGE_KEY_SESSIONS = 'blok_cad_recorded_sessions_v1';

export class SessionRecorder {
  private static _instance: SessionRecorder | null = null;

  public static get instance(): SessionRecorder {
    if (!this._instance) {
      this._instance = new SessionRecorder();
    }
    return this._instance;
  }

  private _isRecording: boolean = false;
  private _isPaused: boolean = false;
  private _startTime: number = 0;
  private _pauseStartTime: number = 0;
  private _totalPausedDuration: number = 0;
  private _sessionName: string = 'Moje Nagranie';
  private _learningGoal: string = '';
  private _events: RecordedEvent[] = [];

  private _lastMouseMoveTime: number = 0;
  private _lastCameraTime: number = 0;
  private _cameraPollTimer: number | null = null;

  // Handlery zdarzeń
  private _boundOnMouseMove: ((e: MouseEvent) => void) | null = null;
  private _boundOnClick: ((e: MouseEvent) => void) | null = null;
  private _boundOnInput: ((e: Event) => void) | null = null;
  private _boundOnChange: ((e: Event) => void) | null = null;
  private _boundOnDragStart: ((e: DragEvent) => void) | null = null;
  private _boundOnDrop: ((e: DragEvent) => void) | null = null;
  private _boundOnBayDetected: ((e: any) => void) | null = null;

  // Subskrybenci stanu
  private _stateListeners: Set<(isRecording: boolean, isPaused: boolean, count: number) => void> = new Set();

  get isRecording(): boolean {
    return this._isRecording;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get eventsCount(): number {
    return this._events.length;
  }

  get learningGoal(): string {
    return this._learningGoal;
  }

  setLearningGoal(goal: string): void {
    this._learningGoal = goal;
  }

  subscribe(listener: (isRecording: boolean, isPaused: boolean, count: number) => void): () => void {
    this._stateListeners.add(listener);
    return () => this._stateListeners.delete(listener);
  }

  private _notifyState(): void {
    for (const l of this._stateListeners) {
      try {
        l(this._isRecording, this._isPaused, this._events.length);
      } catch (e) {
        console.error(e);
      }
    }
  }

  private _getRelativeTime(): number {
    if (!this._isRecording) return 0;
    const now = performance.now();
    return Math.max(0, Math.round(now - this._startTime - this._totalPausedDuration));
  }

  /**
   * Rozpoczyna nową sesję nagrywania.
   */
  start(sessionName: string = 'Moje Nagranie', learningGoal?: string): void {
    if (this._isRecording) return;

    this._isRecording = true;
    this._isPaused = false;
    this._sessionName = sessionName;
    this._learningGoal = learningGoal || '';
    this._startTime = performance.now();
    this._totalPausedDuration = 0;
    this._events = [];
    this._lastMouseMoveTime = 0;
    this._lastCameraTime = 0;

    this._attachDomListeners();
    this._startCameraTracking();
    this._notifyState();
  }

  /**
   * Pauzuje nagrywanie.
   */
  pause(): void {
    if (!this._isRecording || this._isPaused) return;
    this._isPaused = true;
    this._pauseStartTime = performance.now();
    this._notifyState();
  }

  /**
   * Wznawia nagrywanie po pauzie.
   */
  resume(): void {
    if (!this._isRecording || !this._isPaused) return;
    this._isPaused = false;
    this._totalPausedDuration += performance.now() - this._pauseStartTime;
    this._notifyState();
  }

  /**
   * Kończy nagrywanie i generuje obiekt RecordedSession.
   */
  stop(): RecordedSession {
    if (!this._isRecording) {
      return this._createEmptySession();
    }

    const durationMs = this._getRelativeTime();
    this._isRecording = false;
    this._isPaused = false;

    this._detachDomListeners();
    this._stopCameraTracking();

    const session: RecordedSession = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: this._sessionName || 'Nagranie CAD',
      createdAt: new Date().toISOString(),
      durationMs,
      windowSize: {
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080,
      },
      learningGoal: this._learningGoal || undefined,
      events: [...this._events],
    };

    this.saveSession(session);
    this._notifyState();
    return session;
  }

  /**
   * Wstawia znacznik komentarza / etykietę do nagrania.
   */
  addMarker(title: string, note: string = '', highlightSelector?: string): void {
    if (!this._isRecording || this._isPaused) return;
    const t = this._getRelativeTime();
    const data: MarkerEventData = { title, note, highlightSelector };
    this._events.push({ t, type: 'marker', data });
    this._notifyState();
  }

  /**
   * Rejestruje akcję semantyczną Agenta AI (np. mutacja drzewa CAD, wybór strefy, nałożenie reguły).
   */
  addSemanticAction(intent: string, details?: any): void {
    if (!this._isRecording || this._isPaused) return;
    const t = this._getRelativeTime();
    this._events.push({
      t,
      type: 'agent_semantic_action',
      data: {
        intent,
        details,
      },
      semantic: {
        intent,
        domainParams: details,
      },
    });
    this._notifyState();
  }

  /**
   * Rejestruje przełączenie zakładki.
   */
  recordTabSwitch(tabKey: string): void {
    if (!this._isRecording || this._isPaused) return;
    const t = this._getRelativeTime();
    this._events.push({ t, type: 'tab_switch', data: { tabKey } });
    this._notifyState();
  }

  private _attachDomListeners(): void {
    if (typeof window === 'undefined') return;

    // 1. Ruch myszy (próbkowanie co 40 ms)
    this._boundOnMouseMove = (e: MouseEvent) => {
      if (!this._isRecording || this._isPaused) return;
      const now = performance.now();
      if (now - this._lastMouseMoveTime < 40) return;
      this._lastMouseMoveTime = now;

      const t = this._getRelativeTime();
      const data: MouseMoveData = {
        x: e.clientX,
        y: e.clientY,
        nx: e.clientX / (window.innerWidth || 1),
        ny: e.clientY / (window.innerHeight || 1),
      };
      this._events.push({ t, type: 'mouse_move', data });
    };

    // 2. Kliknięcia
    this._boundOnClick = (e: MouseEvent) => {
      if (!this._isRecording || this._isPaused) return;
      const target = e.target as HTMLElement;
      if (!target) return;

      // Ignoruj kliknięcia wewnątrz samego okna panelu rejestratora
      if (target.closest('#recorder-studio-panel')) return;

      const t = this._getRelativeTime();
      const elementId = target.id || undefined;
      const selector = this._getBestSelector(target);
      const textContent = (target.textContent || '').trim().substring(0, 30);

      const data: ClickEventData = {
        x: e.clientX,
        y: e.clientY,
        nx: e.clientX / (window.innerWidth || 1),
        ny: e.clientY / (window.innerHeight || 1),
        elementId,
        selector,
        tagName: target.tagName,
        textContent,
      };

      this._events.push({ t, type: 'click', data });
      this._notifyState();
    };

    // 3. Zmiany w inputach
    this._boundOnInput = (e: Event) => {
      if (!this._isRecording || this._isPaused) return;
      const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!target || target.closest('#recorder-studio-panel')) return;

      const t = this._getRelativeTime();
      const elementId = target.id || undefined;
      const selector = this._getBestSelector(target);

      const data: InputEventData = {
        elementId,
        selector,
        value: target.value,
        name: target.name || undefined,
      };

      this._events.push({ t, type: 'input', data });
    };

    // 4. Zmiany w select / checkbox / radio (Change)
    this._boundOnChange = (e: Event) => {
      if (!this._isRecording || this._isPaused) return;
      const target = e.target as HTMLInputElement | HTMLSelectElement;
      if (!target || target.closest('#recorder-studio-panel')) return;

      const t = this._getRelativeTime();
      const elementId = target.id || undefined;
      const selector = this._getBestSelector(target);

      const val = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
      const data: InputEventData = {
        elementId,
        selector,
        value: val,
        name: target.name || undefined,
      };

      this._events.push({ t, type: 'input', data });
    };

    // 5. Drag & Drop start (Przeciąganie modułu lub korpusu)
    this._boundOnDragStart = (e: DragEvent) => {
      if (!this._isRecording || this._isPaused) return;
      const rawTarget = e.target as HTMLElement;
      if (!rawTarget || rawTarget.closest('#recorder-studio-panel')) return;

      const target = rawTarget.closest?.('[draggable="true"], .zone-drag-card, [id^="cardBlokiMod_"], [id^="smartframe-card-zone-"]') as HTMLElement || rawTarget;
      const t = this._getRelativeTime();
      const elementId = target.id || target.getAttribute('data-id') || undefined;
      const selector = this._getBestSelector(target);

      let boxType: string | undefined;
      let liczba_stref: number | undefined;
      if (elementId?.startsWith('cardBlokiMod_')) {
        boxType = elementId.replace('cardBlokiMod_', '');
      }
      if (elementId?.startsWith('smartframe-card-zone-')) {
        liczba_stref = parseInt(elementId.replace('smartframe-card-zone-', ''), 10);
      }

      const data = {
        x: e.clientX,
        y: e.clientY,
        nx: e.clientX / (window.innerWidth || 1),
        ny: e.clientY / (window.innerHeight || 1),
        elementId,
        selector,
        boxType,
        liczba_stref,
        textContent: (target.textContent || '').trim().substring(0, 30),
      };

      this._events.push({ t, type: 'drag_start', data });
      this._notifyState();
    };

    // 6. Drag & Drop drop (Upuszczenie na scenie)
    this._boundOnDrop = (e: DragEvent) => {
      if (!this._isRecording || this._isPaused) return;
      const target = e.target as HTMLElement;
      if (!target || target.closest('#recorder-studio-panel')) return;

      const t = this._getRelativeTime();
      const isCanvas = target.tagName === 'CANVAS';
      const data = {
        x: e.clientX,
        y: e.clientY,
        nx: e.clientX / (window.innerWidth || 1),
        ny: e.clientY / (window.innerHeight || 1),
        isCanvas,
        targetId: target.id || undefined,
      };

      this._events.push({ t, type: 'drag_drop', data });
      this._notifyState();
    };

    // 7. Zdarzenie wykrycia/wyboru strefy 3D (Bloki Bay)
    this._boundOnBayDetected = (e: CustomEvent) => {
      if (!this._isRecording || this._isPaused) return;
      const bay = e.detail;
      if (!bay) return;

      const t = this._getRelativeTime();
      this._events.push({
        t,
        type: 'cad_action',
        data: {
          action: 'blok_bay_select',
          bayIndex: bay.index ?? bay.zoneIndex,
          bayBounds: bay.bounds,
        },
      });
      this._notifyState();
    };

    window.addEventListener('mousemove', this._boundOnMouseMove, { passive: true });
    window.addEventListener('click', this._boundOnClick, { capture: true, passive: true });
    window.addEventListener('input', this._boundOnInput, { capture: true, passive: true });
    window.addEventListener('change', this._boundOnChange, { capture: true, passive: true });
    window.addEventListener('dragstart', this._boundOnDragStart, { capture: true, passive: true });
    window.addEventListener('drop', this._boundOnDrop, { capture: true, passive: true });
    window.addEventListener('bloki-bay-detected', this._boundOnBayDetected as EventListener);
  }

  private _detachDomListeners(): void {
    if (typeof window === 'undefined') return;
    if (this._boundOnMouseMove) window.removeEventListener('mousemove', this._boundOnMouseMove);
    if (this._boundOnClick) window.removeEventListener('click', this._boundOnClick, { capture: true });
    if (this._boundOnInput) window.removeEventListener('input', this._boundOnInput, { capture: true });
    if (this._boundOnChange) window.removeEventListener('change', this._boundOnChange, { capture: true });
    if (this._boundOnDragStart) window.removeEventListener('dragstart', this._boundOnDragStart, { capture: true });
    if (this._boundOnDrop) window.removeEventListener('drop', this._boundOnDrop, { capture: true });
    if (this._boundOnBayDetected) window.removeEventListener('bloki-bay-detected', this._boundOnBayDetected as EventListener);

    this._boundOnMouseMove = null;
    this._boundOnClick = null;
    this._boundOnInput = null;
    this._boundOnChange = null;
    this._boundOnDragStart = null;
    this._boundOnDrop = null;
    this._boundOnBayDetected = null;
  }

  private _startCameraTracking(): void {
    if (typeof window === 'undefined') return;

    this._cameraPollTimer = window.setInterval(() => {
      if (!this._isRecording || this._isPaused) return;
      const scene = (window as any).__babylonScene;
      if (!scene || !scene.activeCamera) return;

      const cam = scene.activeCamera;
      if (cam.alpha === undefined || cam.beta === undefined) return;

      const t = this._getRelativeTime();
      const targetArr: [number, number, number] = cam.target
        ? [cam.target.x, cam.target.y, cam.target.z]
        : [0, 0, 0];

      const data: CameraEventData = {
        alpha: Number(cam.alpha.toFixed(4)),
        beta: Number(cam.beta.toFixed(4)),
        radius: Number(cam.radius.toFixed(2)),
        target: targetArr,
      };

      this._events.push({ t, type: 'camera', data });
    }, 150);
  }

  private _stopCameraTracking(): void {
    if (this._cameraPollTimer) {
      clearInterval(this._cameraPollTimer);
      this._cameraPollTimer = null;
    }
  }

  private _getBestSelector(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
    if (el.getAttribute('name')) return `[name="${el.getAttribute('name')}"]`;

    // Budujemy krótki selektor
    const classes = Array.from(el.classList || [])
      .filter((c) => !c.includes('hover') && !c.includes('active') && !c.includes('focus'))
      .slice(0, 2);

    let sel = el.tagName.toLowerCase();
    if (classes.length > 0) {
      sel += `.${classes.join('.')}`;
    }

    if (el.parentElement && el.parentElement !== document.body) {
      if (el.parentElement.id) {
        return `#${el.parentElement.id} > ${sel}`;
      }
    }

    return sel;
  }

  private _createEmptySession(): RecordedSession {
    return {
      id: `rec_empty_${Date.now()}`,
      name: 'Puste nagranie',
      createdAt: new Date().toISOString(),
      durationMs: 0,
      windowSize: { width: 1920, height: 1080 },
      events: [],
    };
  }

  private _memoryCache: RecordedSession[] | null = null;

  // ── Zarządzanie zapisanymi sesjami (localStorage z in-memory fallback) ────
  getAllSavedSessions(): RecordedSession[] {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
        if (raw) {
          const list = JSON.parse(raw);
          this._memoryCache = list;
          return list;
        }
      } catch {
        /* fallback do _memoryCache */
      }
    }
    return this._memoryCache ? [...this._memoryCache] : [];
  }

  saveSession(session: RecordedSession): void {
    const list = this.getAllSavedSessions();
    const existingIdx = list.findIndex((s) => s.id === session.id);
    if (existingIdx >= 0) {
      list[existingIdx] = session;
    } else {
      list.unshift(session);
    }
    const trimmed = list.slice(0, 15);
    this._memoryCache = trimmed;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(trimmed));
      } catch (e) {
        console.warn('[SessionRecorder] Błąd zapisu do localStorage:', e);
      }
    }
  }

  deleteSession(id: string): void {
    const list = this.getAllSavedSessions().filter((s) => s.id !== id);
    this._memoryCache = list;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(list));
      } catch (e) {
        console.error(e);
      }
    }
  }
}
