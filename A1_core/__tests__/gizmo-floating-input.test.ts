import { describe, it, expect, beforeEach } from 'vitest';
import { GizmoController } from '../gizmo-controller.js';
import { ContextManager } from '../context-manager.js';
import { ProjectDocument } from '../project-document.js';
import { registerCabinetModule } from '../cabinet-port.js';

describe('GizmoController Floating Input & Math Evaluation', () => {
    let gizmoCtrl: GizmoController;
    let doc: ProjectDocument;

    beforeEach(() => {
        gizmoCtrl = new GizmoController();
        doc = new ProjectDocument({ name: 'Floating Input Test' });
        ContextManager.instance.document = doc;
    });

    it('evaluates math expressions with commas, operations, and parenthesis', () => {
        const evalFn = (gizmoCtrl as any).evaluateMathExpression.bind(gizmoCtrl);

        expect(evalFn('88')).toBe(88);
        expect(evalFn('88,5')).toBe(88.5);
        expect(evalFn('100 + 20')).toBe(120);
        expect(evalFn('720 / 2')).toBe(360);
        expect(evalFn('(600 - 100) * 1.5')).toBe(750);
        expect(evalFn('-25')).toBe(-25);
        expect(evalFn('abc')).toBeNull();
        expect(evalFn('window.alert()')).toBeNull();
    });

    it('commits corner session updates to container via applyRealtimeUpdate', () => {
        let appliedParams: any = null;
        registerCabinetModule({
            rebuild: () => true,
            createKorpus: () => {},
            createSyncBackGroovesCommand: () => ({} as any),
            createSetTopPanelConfigCommand: () => ({} as any),
            applyRealtimeUpdate: (_docTarget: any, params: any) => {
                appliedParams = params;
            }
        });

        const container = { id: 'cabinet_1', generatorParams: { wysokosc_mm: 720 } };
        const mockSphere = { position: { x: 0, y: 0, z: 0 } };

        (gizmoCtrl as any).activeCornerSession = {
            container,
            paramName: 'wysokosc_mm',
            sphere: mockSphere,
            originalValue: 720
        };

        const mockInput = { value: '850+10' } as any;
        const mockBadge = { style: { display: 'flex' } } as any;

        (gizmoCtrl as any).commitFloatingInputValue(mockInput, mockBadge);

        expect(appliedParams).toEqual({ wysokosc_mm: 860 });
    });

    it('commits zone divider height to container via applyRealtimeUpdate', () => {
        let appliedParams: any = null;
        registerCabinetModule({
            rebuild: () => true,
            createKorpus: () => {},
            createSyncBackGroovesCommand: () => ({} as any),
            createSetTopPanelConfigCommand: () => ({} as any),
            applyRealtimeUpdate: (_docTarget: any, params: any) => {
                appliedParams = params;
            }
        });

        const container = { id: 'cabinet_3_zones', generatorParams: { wysokosc_strefy_dolnej_mm: 500 } };
        const mockSphere = { position: { x: 0, y: 0, z: 0 } };

        (gizmoCtrl as any).activeCornerSession = {
            container,
            paramName: 'wysokosc_strefy_dolnej_mm',
            sphere: mockSphere,
            originalValue: 500
        };

        const mockInput = { value: '620' } as any;
        const mockBadge = { style: { display: 'flex' } } as any;

        (gizmoCtrl as any).commitFloatingInputValue(mockInput, mockBadge);

        expect(appliedParams).toEqual({ wysokosc_strefy_dolnej_mm: 620 });
    });

    it('resets stale corner session and clears __glcGizmoActive when activeEntity changes to another container', () => {
        const container1 = { id: 'cabinet_1', type: 'container', generatorParams: { szerokosc_mm: 600, wysokosc_mm: 720, glebokosc_mm: 560 } };
        const container2 = { id: 'cabinet_2', type: 'container', generatorParams: { szerokosc_mm: 800, wysokosc_mm: 720, glebokosc_mm: 560 } };

        (gizmoCtrl as any).activeGizmoContainer = container1;
        (gizmoCtrl as any).activeCornerSession = {
            container: container1,
            paramName: 'wysokosc_mm',
            sphere: { dispose: () => {} },
            originalValue: 720
        };
        (gizmoCtrl as any).isEditingFaceGizmo = true;
        (globalThis as any).__glcGizmoActive = true;

        doc.setActiveEntity(container2 as any);

        expect((globalThis as any).__glcGizmoActive).toBe(false);

        gizmoCtrl.updateFaceGizmo();

        expect((gizmoCtrl as any).isEditingFaceGizmo).toBe(false);
        expect((gizmoCtrl as any).activeCornerSession).toBeNull();
    });

    it('sequentially switches face gizmos without desynchronization or race conditions', () => {
        const committed: any[] = [];
        const container = {
            id: 'cab_1',
            type: 'container',
            generatorParams: {
                offsets: {
                    'Bok_L_+Y': 10,
                    'Bok_L_-Y': 25
                }
            }
        };

        const mockBadge = { style: { display: 'none', left: '0px', top: '0px', border: '' } };
        const mockInput = { value: '', style: { width: '' }, focus: () => {}, select: () => {} };
        (globalThis as any).document = {
            getElementById: (id: string) => {
                if (id === 'gizmo-floating-input') return mockBadge;
                if (id === 'gizmo-input-field') return mockInput;
                return null;
            },
            activeElement: null
        };

        const sphere1 = {
            computeWorldMatrix: () => {},
            getAbsolutePosition: () => ({ x: 100, y: 200, z: 0 }),
            position: { x: 100, y: 200, z: 0 },
            material: { diffuseColor: { r: 0.15, g: 0.8, b: 0.25 } }
        };
        const sphere2 = {
            computeWorldMatrix: () => {},
            getAbsolutePosition: () => ({ x: 100, y: 100, z: 0 }),
            position: { x: 100, y: 100, z: 0 },
            material: { diffuseColor: { r: 0.15, g: 0.8, b: 0.25 } }
        };

        // Open first sphere
        (gizmoCtrl as any).openFloatingInput(sphere1, 'Bok_L_+Y', container, 'LEFT_SIDE_PANEL');
        expect((gizmoCtrl as any).activeGizmoParamName).toBe('Bok_L_+Y');
        expect((gizmoCtrl as any).originalValueBeforeEdit).toBe(10);
        expect(mockInput.value).toBe('10');
        expect((gizmoCtrl as any).isEditingFaceGizmo).toBe(true);

        // User edits value to 50 in input
        mockInput.value = '50';

        // Now user directly clicks second sphere (sphere2)
        (gizmoCtrl as any).openFloatingInput(sphere2, 'Bok_L_-Y', container, 'LEFT_SIDE_PANEL');

        // First was committed (50 in Bok_L_+Y) and second is now active with its own value 25
        expect(container.generatorParams.offsets['Bok_L_+Y']).toBe(50);
        expect((gizmoCtrl as any).activeGizmoParamName).toBe('Bok_L_-Y');
        expect((gizmoCtrl as any).originalValueBeforeEdit).toBe(25);
        expect(mockInput.value).toBe('25');
        expect((gizmoCtrl as any).isEditingFaceGizmo).toBe(true);
    });

    it('handles Escape cancel cleanly without re-committing on blur', () => {
        const container = {
            id: 'cab_1',
            type: 'container',
            generatorParams: {
                offsets: {
                    'Bok_L_+Y': 10
                }
            }
        };

        const mockBadge = { style: { display: 'flex', left: '0px', top: '0px', border: '' } };
        const mockInput = { value: '99', style: { width: '' }, blur: () => {} };
        (globalThis as any).document = {
            getElementById: (id: string) => {
                if (id === 'gizmo-floating-input') return mockBadge;
                if (id === 'gizmo-input-field') return mockInput;
                return null;
            },
            activeElement: mockInput
        };

        (gizmoCtrl as any).activeGizmoContainer = container;
        (gizmoCtrl as any).activeGizmoParamName = 'Bok_L_+Y';
        (gizmoCtrl as any).originalValueBeforeEdit = 10;
        (gizmoCtrl as any).isEditingFaceGizmo = true;

        // Escape cancels (commit = false)
        (gizmoCtrl as any).closeFloatingInput(false);

        // Value in container offsets must revert to original 10, not 99
        expect(container.generatorParams.offsets['Bok_L_+Y']).toBe(10);
        expect((gizmoCtrl as any).isEditingFaceGizmo).toBe(false);
        expect((gizmoCtrl as any).activeGizmoParamName).toBe('');
    });

    it('evaluates math expression, commits offset and dispatches document change events', () => {
        let projectChangedDispatched = false;
        let cadEditEntityDispatched = false;
        let docChangedCalled = false;

        doc.onDocumentChanged(() => {
            docChangedCalled = true;
        });

        (globalThis as any).window = {
            dispatchEvent: (evt: CustomEvent) => {
                if (evt.type === 'bloki-project-changed') projectChangedDispatched = true;
                if (evt.type === 'cad-edit-entity') cadEditEntityDispatched = true;
            },
            document: {
                dispatchEvent: (evt: CustomEvent) => {
                    if (evt.type === 'bloki-project-changed') projectChangedDispatched = true;
                }
            }
        };

        const container = {
            id: 'cab_1',
            type: 'container',
            generatorParams: {
                offsets: {
                    'Bok_L_+Y': 0
                }
            }
        };

        const mockBadge = { style: { display: 'flex' } };
        const mockInput = { value: '25 + 15' };

        (gizmoCtrl as any).activeGizmoContainer = container;
        (gizmoCtrl as any).activeGizmoParamName = 'Bok_L_+Y';
        (gizmoCtrl as any).originalValueBeforeEdit = 0;
        (gizmoCtrl as any).activeGizmoRole = 'LEFT_SIDE_PANEL';

        (gizmoCtrl as any).commitFloatingInputValue(mockInput, mockBadge);

        expect(container.generatorParams.offsets['Bok_L_+Y']).toBe(40);
        expect(projectChangedDispatched).toBe(true);
        expect(cadEditEntityDispatched).toBe(true);
        expect(docChangedCalled).toBe(true);
    });

    it('hooks Enter/blur events even when #gizmo-floating-input was pre-created by InteractiveGlcAxis and commits 18mm immediately on Enter after drag', () => {
        const container = {
            id: 'cab_1',
            type: 'container',
            generatorParams: {
                offsets: {
                    'Bok_L_+Y': 12 // value after dragging green gizmo from 0 to 12
                }
            }
        };

        let focusCount = 0;
        let selectCount = 0;
        const mockBadge: any = {
            id: 'gizmo-floating-input',
            style: { display: 'none', left: '0px', top: '0px', border: '' }
        };
        const mockInput: any = {
            id: 'gizmo-input-field',
            value: '',
            style: { width: '' },
            focus: () => { focusCount++; },
            select: () => { selectCount++; },
            blur: () => {}
        };

        // Pre-existing DOM elements (as created by InteractiveGlcAxis before GizmoController)
        (globalThis as any).document = {
            getElementById: (id: string) => {
                if (id === 'gizmo-floating-input') return mockBadge;
                if (id === 'gizmo-input-field') return mockInput;
                return null;
            },
            activeElement: mockInput
        };

        const mockSphere = {
            position: { x: 50, y: 80, z: 0 },
            getAbsolutePosition: () => ({ x: 50, y: 80, z: 0 }),
            computeWorldMatrix: () => {},
            material: { diffuseColor: { r: 0.15, g: 0.8, b: 0.25 } }
        };

        // Open floating input at the end of drag (originalValue before drag was 0, current dragged value is 12)
        (gizmoCtrl as any).openFloatingInput(mockSphere, 'Bok_L_+Y', container, 'LEFT_SIDE_PANEL', 0);

        expect(typeof mockInput.onkeydown).toBe('function');
        expect(typeof mockInput.onblur).toBe('function');
        expect(mockInput.value).toBe('12');
        expect((gizmoCtrl as any).originalValueBeforeEdit).toBe(0);

        // Premature canvas blur immediately after pointerup (< 150ms) must be ignored, keeping session alive
        mockInput.onblur!();
        expect((gizmoCtrl as any).isEditingFaceGizmo).toBe(true);
        expect((gizmoCtrl as any).activeGizmoParamName).toBe('Bok_L_+Y');

        // User types 18 and presses Enter
        mockInput.value = '18';
        mockInput.onkeydown!({
            key: 'Enter',
            preventDefault: () => {},
            stopPropagation: () => {}
        });

        // Must immediately commit 18mm without waiting for a second gizmo drag
        expect(container.generatorParams.offsets['Bok_L_+Y']).toBe(18);
        expect((gizmoCtrl as any).isEditingFaceGizmo).toBe(false);
        expect(mockBadge.style.display).toBe('none');
    });
});
