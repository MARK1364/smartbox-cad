/**
 * agent-store.ts
 * Magazyn stanu Agenta AI w module A9_agent.
 */

import { AgentTrajectory } from './trajectory/trajectory-types.js';
import { SessionRecorder } from './recorder/SessionRecorder.js';
import { TrajectoryBridge } from './trajectory/trajectory-bridge.js';

export type AgentMode = 'IDLE' | 'LEARNING' | 'COPILOT' | 'AUTONOMOUS';

export interface AgentState {
  mode: AgentMode;
  currentGoal: string;
  trajectories: AgentTrajectory[];
  activeTrajectory: AgentTrajectory | null;
}

export class AgentStore {
  private static _instance: AgentStore | null = null;

  public static get instance(): AgentStore {
    if (!this._instance) {
      this._instance = new AgentStore();
    }
    return this._instance;
  }

  private _state: AgentState = {
    mode: 'IDLE',
    currentGoal: '',
    trajectories: [],
    activeTrajectory: null,
  };

  private _listeners: Set<(state: AgentState) => void> = new Set();

  get state(): AgentState {
    return this._state;
  }

  subscribe(listener: (state: AgentState) => void): () => void {
    this._listeners.add(listener);
    listener(this._state);
    return () => this._listeners.delete(listener);
  }

  private _notify(): void {
    for (const l of this._listeners) {
      try {
        l(this._state);
      } catch (e) {
        console.error('[AgentStore] Błąd w listenerze:', e);
      }
    }
  }

  setMode(mode: AgentMode): void {
    this._state.mode = mode;
    this._notify();
  }

  setGoal(goal: string): void {
    this._state.currentGoal = goal;
    SessionRecorder.instance.setLearningGoal(goal);
    this._notify();
  }

  /**
   * Zapisuje sesję z rejestratora jako trajektorię demonstracyjną Agenta.
   */
  ingestSessionAsTrajectory(sessionName?: string, goal?: string): AgentTrajectory {
    const rawSession = SessionRecorder.instance.stop();
    if (sessionName) rawSession.name = sessionName;
    if (goal) rawSession.learningGoal = goal;

    const trajectory = TrajectoryBridge.instance.convertSessionToTrajectory(rawSession);
    this._state.trajectories.unshift(trajectory);
    this._state.activeTrajectory = trajectory;
    this._state.mode = 'IDLE';
    this._notify();
    return trajectory;
  }
}
