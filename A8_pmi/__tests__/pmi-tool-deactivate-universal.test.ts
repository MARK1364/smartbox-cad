import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../../A1_core/context-manager.js';
import { isPmiToolActive, deactivateAllPmiTools } from '../pmi-tool-activate.js';

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
        mockSm.changeState('DIMENSION_TOOL');
        expect(isPmiToolActive(mockSm as any)).toBe(true);

        mockSm.changeState('DimensionTool');
        expect(isPmiToolActive(mockSm as any)).toBe(true);

        mockSm.changeState('MEASURE_TOOL');
        expect(isPmiToolActive(mockSm as any)).toBe(true);

        mockSm.changeState('MeasureTool');
        expect(isPmiToolActive(mockSm as any)).toBe(true);

        mockSm.changeState('PMI_EDIT_TOOL');
        expect(isPmiToolActive(mockSm as any)).toBe(true);

        mockSm.changeState('SELECTION_TOOL');
        expect(isPmiToolActive(mockSm as any)).toBe(false);

        mockSm.changeState('DRAW_LINE_TOOL');
        expect(isPmiToolActive(mockSm as any)).toBe(false);
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

    it('pozostanie na zakładce tab-a8-pmi NIE deaktywuje narzędzia wymiarowania', () => {
        mockSm.changeState('DIMENSION_TOOL');
        mockSm.stateTransitions = [];

        ContextManager.instance.activeTab = 'tab-a8-pmi';
        expect(mockSm.getCurrentStateName()).toBe('DIMENSION_TOOL');
        expect(mockSm.stateTransitions.length).toBe(0);
    });
});
