import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../context-manager.js';
import {
    getSelectionModeForTab,
    shouldPromoteSubgeometryToEntity,
    shouldSuppressEntitySelectionHighlight,
    setConnectorsPlanePickActive,
} from '../selection-mode.js';

describe('selection-mode promotion and highlight', () => {
    beforeEach(() => {
        ContextManager.instance.activeConstraintPicker = null;
        ContextManager.instance.activeReferencePicker = null;
        setConnectorsPlanePickActive(false);
    });

    it('tab-s2-solver defaults to object selection mode so panels can be activated and edited', () => {
        expect(getSelectionModeForTab('tab-s2-solver')).toBe('object');
        expect(shouldPromoteSubgeometryToEntity('tab-s2-solver')).toBe(true);
        expect(shouldSuppressEntitySelectionHighlight('tab-s2-solver')).toBe(false);
    });

    it('tab-s2-solver switches to subgeometry when a constraint tool is actively picking faces', () => {
        ContextManager.instance.activeConstraintPicker = { expectedKind: 'FACE' };
        expect(getSelectionModeForTab('tab-s2-solver')).toBe('subgeometry');
        expect(shouldPromoteSubgeometryToEntity('tab-s2-solver')).toBe(false);
        expect(shouldSuppressEntitySelectionHighlight('tab-s2-solver')).toBe(true);
    });

    it('tab-s2-solver keeps object mode when a constraint tool is picking whole objects', () => {
        ContextManager.instance.activeConstraintPicker = { expectedKind: 'OBJECT' };
        expect(getSelectionModeForTab('tab-s2-solver')).toBe('object');
        expect(shouldPromoteSubgeometryToEntity('tab-s2-solver')).toBe(false);
        expect(shouldSuppressEntitySelectionHighlight('tab-s2-solver')).toBe(true);
    });

    it('blocks subgeometry promotion and suppresses entity highlight when reference picker is active', () => {
        ContextManager.instance.activeReferencePicker = { active: true };
        expect(shouldPromoteSubgeometryToEntity('tab-s2-solver')).toBe(false);
        expect(shouldSuppressEntitySelectionHighlight('tab-s2-solver')).toBe(true);
    });

    it('handles connectors plane pick mode appropriately', () => {
        expect(getSelectionModeForTab('tab-c2-connectors')).toBe('object');
        expect(shouldPromoteSubgeometryToEntity('tab-c2-connectors')).toBe(true);
        expect(shouldSuppressEntitySelectionHighlight('tab-c2-connectors')).toBe(false);

        setConnectorsPlanePickActive(true);
        expect(getSelectionModeForTab('tab-c2-connectors')).toBe('subgeometry');
        expect(shouldPromoteSubgeometryToEntity('tab-c2-connectors')).toBe(false);
        expect(shouldSuppressEntitySelectionHighlight('tab-c2-connectors')).toBe(true);
    });

    it('promotes subgeometry in other standard tabs', () => {
        expect(shouldPromoteSubgeometryToEntity('tab-a3-smartframe')).toBe(true);
        expect(shouldPromoteSubgeometryToEntity('tab-a2-bloki')).toBe(true);
        expect(shouldPromoteSubgeometryToEntity('tab-a4-smartpanel')).toBe(true);
    });
});
