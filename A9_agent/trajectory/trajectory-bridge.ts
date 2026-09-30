/**
 * trajectory-bridge.ts
 * Mostek konwertujący surowe nagrania sesji (RecordedSession) na semantyczne zbiory uczące AI (AgentTrajectory).
 */

import { RecordedSession, RecordedEvent } from '../recorder/recorder-types.js';
import {
  AgentTrajectory,
  TrajectoryStep,
  SemanticAction,
} from './trajectory-types.js';
import { SemanticActionCollector } from './semantic-action-collector.js';

export class TrajectoryBridge {
  private static _instance: TrajectoryBridge | null = null;

  public static get instance(): TrajectoryBridge {
    if (!this._instance) {
      this._instance = new TrajectoryBridge();
    }
    return this._instance;
  }

  /**
   * Konwertuje standardowy plik sesji nagrania na semantyczną trajektorię demonstracyjną Agenta AI.
   */
  convertSessionToTrajectory(session: RecordedSession): AgentTrajectory {
    const collector = SemanticActionCollector.instance;
    const steps: TrajectoryStep[] = [];
    let stepIndex = 1;

    let pendingDrag: { boxType?: string; liczba_stref?: number; text?: string } | null = null;

    for (const ev of session.events) {
      if (ev.type === 'drag_start') {
        pendingDrag = {
          boxType: ev.data.boxType,
          liczba_stref: ev.data.liczba_stref,
          text: ev.data.textContent,
        };
      } else if (ev.type === 'drag_drop' && pendingDrag) {
        if (pendingDrag.liczba_stref !== undefined) {
          const action: SemanticAction = collector.createAction(
            'CREATE_KORPUS',
            `Wstawienie korpusu o ${pendingDrag.liczba_stref} strefach`,
            { liczba_stref: pendingDrag.liczba_stref, dropCoords: { x: ev.data.x, y: ev.data.y } }
          );
          steps.push({
            stepIndex: stepIndex++,
            timeMs: ev.t,
            uiEventSummary: `Upuszczenie szablonu korpusu (${pendingDrag.liczba_stref} strefy)`,
            semanticAction: action,
          });
        } else if (pendingDrag.boxType) {
          const action: SemanticAction = collector.createAction(
            'INSERT_BLOKI_MODULE',
            `Wstawienie modułu ${pendingDrag.boxType} do komory szafki`,
            { boxType: pendingDrag.boxType, dropCoords: { x: ev.data.x, y: ev.data.y } }
          );
          steps.push({
            stepIndex: stepIndex++,
            timeMs: ev.t,
            uiEventSummary: `Upuszczenie modułu Bloki [${pendingDrag.boxType}]`,
            semanticAction: action,
          });
        }
        pendingDrag = null;
      } else if (ev.type === 'cad_action') {
        const action: SemanticAction = collector.createAction(
          'SELECT_BAY',
          `Wybór/detekcja wnęki w korpusie CAD: ${ev.data.action}`,
          { ...ev.data },
          { bayIndex: ev.data.bayIndex }
        );
        steps.push({
          stepIndex: stepIndex++,
          timeMs: ev.t,
          uiEventSummary: `Akcja silnika CAD: ${ev.data.action}`,
          semanticAction: action,
        });
      }
    }

    return {
      id: `traj_${session.id}`,
      name: session.name || 'Demonstracja CAD',
      createdAt: session.createdAt,
      userPromptOrGoal: session.learningGoal || session.name || 'Konstrukcja mebla',
      steps,
      totalDurationMs: session.durationMs,
    };
  }
}
