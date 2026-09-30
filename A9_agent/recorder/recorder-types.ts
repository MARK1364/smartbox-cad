/**
 * recorder-types.ts
 * Typy i struktury danych dla Rejestratora i Odtwarzacza Sesji w module A9_agent.
 */

export type RecordedEventType =
  | 'mouse_move'
  | 'pointer_down'
  | 'pointer_up'
  | 'click'
  | 'input'
  | 'tab_switch'
  | 'camera'
  | 'drag_start'
  | 'drag_drop'
  | 'marker'
  | 'cad_action'
  | 'agent_semantic_action';

export interface CadActionEventData {
  action: 'create_korpus' | 'insert_interior' | 'assign_connectors' | 'assign_materials' | 'reset_scene' | 'blok_bay_select' | string;
  params?: any;
  bayIndex?: number;
  bayBounds?: any;
}

export interface MouseMoveData {
  x: number; // piksele lub znormalizowane 0-1
  y: number;
  nx: number; // znormalizowany X (x / window.innerWidth)
  ny: number; // znormalizowany Y (y / window.innerHeight)
}

export interface ClickEventData {
  x: number;
  y: number;
  nx: number;
  ny: number;
  elementId?: string;
  selector?: string;
  tagName?: string;
  textContent?: string;
}

export interface InputEventData {
  elementId?: string;
  selector?: string;
  value: string | number | boolean;
  name?: string;
}

export interface TabSwitchEventData {
  tabKey: string;
}

export interface CameraEventData {
  alpha: number;
  beta: number;
  radius: number;
  target: [number, number, number];
}

export interface MarkerEventData {
  title: string;
  note: string;
  highlightSelector?: string;
}

export interface DragDropEventData {
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  x?: number;
  y?: number;
  nx?: number;
  ny?: number;
  isCanvas?: boolean;
  targetId?: string;
  /** Liczba stref korpusu — kanoniczny klucz (SSOT: liczba_stref). */
  liczba_stref?: number;
  itemType?: string;
}

export interface RecordedEvent {
  t: number; // czas od rozpoczęcia sesji w milisekundach
  type: RecordedEventType;
  data:
    | MouseMoveData
    | ClickEventData
    | InputEventData
    | TabSwitchEventData
    | CameraEventData
    | MarkerEventData
    | DragDropEventData
    | CadActionEventData
    | any;
  /**
   * Opcjonalne rozszerzenie semantyczne dla modeli AI
   */
  semantic?: {
    intent?: string;
    domainEntity?: string;
    domainParams?: any;
  };
}

export interface RecordedSession {
  id: string;
  name: string;
  createdAt: string;
  durationMs: number;
  windowSize: { width: number; height: number };
  description?: string;
  /**
   * Cel sesji / prompt użytkownika pod kątem uczenia Agenta AI
   */
  learningGoal?: string;
  events: RecordedEvent[];
}

export interface ReplayState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTimeMs: number;
  totalDurationMs: number;
  speed: number;
  currentPointer: { x: number; y: number; isClicking?: boolean } | null;
  activeMarker: MarkerEventData | null;
}
