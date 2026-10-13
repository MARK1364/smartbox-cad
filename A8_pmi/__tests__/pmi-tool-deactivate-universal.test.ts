import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../../A1_core/context-manager.js';
import {
    isPmiToolActive,
    deactivateAllPmiTools,
    isDimensionToolActive,
    isMeasureToolActive,
    DIMENSION_TOOL_STATE,
    MEASURE_TOOL_STATE,
    DIMENSION_EDIT_TOOL_STATE,
    DIMENSION_TEXT_SHIFT_TOOL_STATE,
} from '../pmi-tool-activate.js';
import { PMIStore } from '../pmi-data.js';

class MockStateMachine {
    private _currentStateName = 'SELECTION_TOOL';
    public stateTransitions: string[] = [];

    getCurrentStateName(): string {
        return this._currentStateName;
    }

    changeState(name: string): void {
        this.stateTransitions.push(name);
        this._currentStateName = name;
    }
}

describe('Uniwersalna reguła: Automatyczne wyjście z narzędzi PMI', () => {
    let mockSm: MockStateMachine;

    beforeEach(() => {
        mockSm = new MockStateMachine();
        ContextManager.instance.stateMachine = mockSm as any;
        ContextManager.instance.activeTab = 'tab-a8-pmi';
    });

    it('poprawnie rozpoznaje czy stan jest narzędziem PMI (isPmiToolActive)', () => {
        mockSm.changeState(DIMENSION_TOOL_STATE);
        expect(isPmiToolActive(mockSm as any)).toBe(true);

        mockSm.changeState(MEASURE_TOOL_STATE);
        expect(isPmiToolActive(mockSm as any)).toBe(true);

        mockSm.changeState(DIMENSION_EDIT_TOOL_STATE);
        expect(isPmiToolActive(mockSm as any)).toBe(true);

        mockSm.changeState(DIMENSION_TEXT_SHIFT_TOOL_STATE);
        expect(isPmiToolActive(mockSm as any)).toBe(true);

        mockSm.changeState('SELECTION_TOOL');
        expect(isPmiToolActive(mockSm as any)).toBe(false);

        mockSm.changeState('DRAW_LINE_TOOL');
        expect(isPmiToolActive(mockSm as any)).toBe(false);
    });

    it('weryfikuje wyłącznie kanoniczne nazwy DIMENSION_TOOL i MEASURE_TOOL bez aliasów', () => {
        mockSm.changeState(DIMENSION_TOOL_STATE);
        expect(isDimensionToolActive(mockSm as any)).toBe(true);
        expect(isMeasureToolActive(mockSm as any)).toBe(false);

        mockSm.changeState('DimensionTool');
        expect(isDimensionToolActive(mockSm as any)).toBe(false);

        mockSm.changeState(MEASURE_TOOL_STATE);
        expect(isMeasureToolActive(mockSm as any)).toBe(true);
        expect(isDimensionToolActive(mockSm as any)).toBe(false);

        mockSm.changeState('MeasureTool');
        expect(isMeasureToolActive(mockSm as any)).toBe(false);
    });

    it('deactivateAllPmiTools przełącza aktywny stan PMI do SELECTION_TOOL', () => {
        mockSm.changeState('DIMENSION_TOOL');
        expect(mockSm.getCurrentStateName()).toBe('DIMENSION_TOOL');

        deactivateAllPmiTools(mockSm as any);
        expect(mockSm.getCurrentStateName()).toBe('SELECTION_TOOL');
    });

    it('deactivateAllPmiTools nie zmienia stanu, jeśli narzędzie PMI nie jest aktywne', () => {
        mockSm.changeState('DRAW_LINE_TOOL');
        mockSm.stateTransitions = [];

        deactivateAllPmiTools(mockSm as any);
        expect(mockSm.getCurrentStateName()).toBe('DRAW_LINE_TOOL');
        expect(mockSm.stateTransitions.length).toBe(0);
    });

    it('zmiana zakładki (ContextManager.instance.activeTab) automatycznie wyłącza narzędzie PMI', () => {
        mockSm.changeState('DIMENSION_TOOL');
        expect(mockSm.getCurrentStateName()).toBe('DIMENSION_TOOL');

        // Użytkownik przechodzi do zakładki Bloki (tab-a2-bloki)
        ContextManager.instance.activeTab = 'tab-a2-bloki';

        expect(mockSm.getCurrentStateName()).toBe('SELECTION_TOOL');
    });

    it('zmiana zakładki na inną niż tab-a8-pmi (SmartFrame, CNC, Okucia) zawsze wyłącza PMI', () => {
        const tabsToTest = [
            'tab-a3-smartframe',
            'tab-a2-bloki',
            'tab-c1-cnc',
            'tab-c2-connectors',
            'tab-o1-operacji',
            'tab-s2-solver',
            'tab-e1-export',
        ];

        for (const tab of tabsToTest) {
            mockSm.changeState('MEASURE_TOOL');
            ContextManager.instance.activeTab = tab;
            expect(mockSm.getCurrentStateName()).toBe('SELECTION_TOOL');
        }
    });

    it('deactivateAllPmiTools czyści pomiary ze store (ephemeral measurements)', () => {
        PMIStore.instance.addMeasurement({
            id: 'msr_test_1',
            anchor1: {} as any,
            anchor2: {} as any,
            distanceMM: 100,
            text: '100 mm',
        });
        expect(PMIStore.instance.measurements.length).toBe(1);

        mockSm.changeState('MEASURE_TOOL');
        deactivateAllPmiTools(mockSm as any);

        expect(mockSm.getCurrentStateName()).toBe('SELECTION_TOOL');
        expect(PMIStore.instance.measurements.length).toBe(0);
    });

    it('rozpoznaje stany edycji i przesunięcia tekstu (PMI_EDIT_TOOL, PMI_TEXT_SHIFT_TOOL)', () => {
        mockSm.changeState('PMI_EDIT_TOOL');
        expect(isPmiToolActive(mockSm as any)).toBe(true);

        mockSm.changeState('PMI_TEXT_SHIFT_TOOL');
        expect(isPmiToolActive(mockSm as any)).toBe(true);
    });

    it('ModalTransformManager nie rozpoczyna transformacji (G / R) gdy aktywne jest narzędzie PMI', () => {
        const modalTransform = ContextManager.instance.modalTransformManager;
        modalTransform.activeMode = 'none';

        mockSm.changeState('DIMENSION_TOOL');
        modalTransform.startTransform('translate');

        // Tryb transformacji nie może zostać włączony w trakcie wymiarowania!
        expect(modalTransform.activeMode).toBe('none');
        expect(mockSm.getCurrentStateName()).toBe('DIMENSION_TOOL');
    });
});

