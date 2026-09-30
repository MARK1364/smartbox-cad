/**
 * trajectory-types.ts
 * Typy i struktury danych dla trajektorii uczÄ…cych Agenta AI (Behavior Cloning / Trajectory Dataset).
 */

export type DomainActionType =
  | 'CREATE_KORPUS'
  | 'UPDATE_KORPUS_DIMS'
  | 'SET_ZONE_COUNT'
  | 'SET_ZONE_HEIGHTS'
  | 'INSERT_BLOKI_MODULE'
  | 'SELECT_BAY'
  | 'ASSIGN_MATERIALS'
  | 'ASSIGN_CONNECTORS'
  | 'CUSTOM_MUTATION';

export interface CabinetStateSnapshot {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  /** Liczba stref korpusu (SSOT: liczba_stref). */
  liczba_stref: number;
  zoneHeightsMm?: {
    bottom?: number;
    middle?: number;
    top?: number;
  };
  submodules: Array<{
    id: string;
    name: string;
    boxType: string;
    zoneIndex?: number;
  }>;
  panelsCount: number;
}

export interface SemanticAction {
  timestampMs: number;
  type: DomainActionType;
  intent: string; // np. "Wstawienie korpusu 3-strefowego", "Dzielenie wnÄ™ki Ĺ›rodkowej przegrodami"
  target?: {
    entityId?: string;
    bayIndex?: number;
    zoneIndex?: number;
  };
  parameters: Record<string, any>;
  furnitureRulesMatched?: string[]; // np. "min_bay_width_100mm", "thickness_18mm"
}

export interface TrajectoryStep {
  stepIndex: number;
  timeMs: number;
  uiEventSummary?: string; // np. "drag_drop na renderCanvas (x: 974, y: 344)"
  semanticAction: SemanticAction;
  snapshotAfter?: Partial<CabinetStateSnapshot>;
}

export interface AgentTrajectory {
  id: string;
  name: string;
  createdAt: string;
  userPromptOrGoal: string; // "Zbuduj szafkÄ™ 3-strefowÄ… z przegrodami na dokumenty"
  initialCabinetState?: CabinetStateSnapshot;
  steps: TrajectoryStep[];
  finalCabinetState?: CabinetStateSnapshot;
  totalDurationMs: number;
}
