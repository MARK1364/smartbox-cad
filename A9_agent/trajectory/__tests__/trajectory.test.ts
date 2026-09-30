import { describe, it, expect, beforeEach } from 'vitest';
import { TrajectoryBridge } from '../trajectory-bridge.js';
import { SemanticActionCollector } from '../semantic-action-collector.js';
import { ProjectDocument } from '../../../A1_core/project-document.js';
import { ContextManager } from '../../../A1_core/context-manager.js';
import { RecordedSession } from '../../recorder/recorder-types.js';

describe('A9_agent - Trajectory & Semantics', () => {
  beforeEach(() => {
    const doc = new ProjectDocument();
    ContextManager.instance.document = doc;
  });

  it('konwertuje surowe nagranie zrzutu sesji na semantycznÄ… trajektoriÄ™ Agenta AI', () => {
    const mockSession: RecordedSession = {
      id: 'rec_test_ai_1',
      name: 'Projekt szafki z przegrodami',
      learningGoal: 'UtwĂłrz szafkÄ™ 3-strefowÄ… i dodaj przegrody',
      createdAt: new Date().toISOString(),
      durationMs: 15000,
      windowSize: { width: 1920, height: 1080 },
      events: [
        {
          t: 500,
          type: 'drag_start',
          data: {
            elementId: 'smartframe-card-zone-3',
            liczba_stref: 3,
            textContent: '3 Strefy',
          },
        },
        {
          t: 1200,
          type: 'drag_drop',
          data: {
            x: 960,
            y: 540,
            isCanvas: true,
            targetId: 'renderCanvas',
          },
        },
        {
          t: 3000,
          type: 'drag_start',
          data: {
            elementId: 'cardBlokiMod_DIVIDERS',
            boxType: 'DIVIDERS',
            textContent: 'Przegrody',
          },
        },
        {
          t: 4500,
          type: 'drag_drop',
          data: {
            x: 960,
            y: 400,
            isCanvas: true,
            targetId: 'renderCanvas',
          },
        },
        {
          t: 4800,
          type: 'cad_action',
          data: {
            action: 'blok_bay_select',
            bayIndex: 1,
          },
        },
      ],
    };

    const trajectory = TrajectoryBridge.instance.convertSessionToTrajectory(mockSession);

    expect(trajectory.id).toBe('traj_rec_test_ai_1');
    expect(trajectory.userPromptOrGoal).toBe('UtwĂłrz szafkÄ™ 3-strefowÄ… i dodaj przegrody');
    expect(trajectory.steps.length).toBe(3);

    // Krok 1: Wstawienie korpusu 3 stref
    expect(trajectory.steps[0].semanticAction.type).toBe('CREATE_KORPUS');
    expect(trajectory.steps[0].semanticAction.parameters.liczba_stref).toBe(3);

    // Krok 2: Wstawienie przegrĂłd
    expect(trajectory.steps[1].semanticAction.type).toBe('INSERT_BLOKI_MODULE');
    expect(trajectory.steps[1].semanticAction.parameters.boxType).toBe('DIVIDERS');

    // Krok 3: WybĂłr komory
    expect(trajectory.steps[2].semanticAction.type).toBe('SELECT_BAY');
    expect(trajectory.steps[2].semanticAction.target?.bayIndex).toBe(1);
  });

  it('poprawnie przechwytuje snapshot mebla w jednostkach milimetrowych', () => {
    const collector = SemanticActionCollector.instance;
    const doc = ContextManager.instance.document!;

    const container = doc.createAssembly({ name: 'Korpus GĹ‚Ăłwny' });
    (container as any).width = 1000000000; // 1000 mm w nm
    (container as any).height = 2000000000; // 2000 mm w nm
    (container as any).depth = 600000000; // 600 mm w nm
    (container as any).generatorParams = { liczba_stref: 2, wysokosc_strefy_dolnej_mm: 500 };

    const snapshot = collector.captureCabinetSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot?.widthMm).toBe(1000);
    expect(snapshot?.heightMm).toBe(2000);
    expect(snapshot?.depthMm).toBe(600);
    expect(snapshot?.liczba_stref).toBe(2);
  });
});
