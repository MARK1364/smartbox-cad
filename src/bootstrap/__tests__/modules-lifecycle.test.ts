import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
    registerGeometryUpdateHandler, 
    resetViewPort, 
    getGeometryUpdateHandlersCount,
    notifyBeforeRebuildGeometry,
    createContainerView,
    createPanelView
} from '../../../A1_core/view-port.js';
import { startModules, disposeModules } from '../modules.js';

import { ProjectDocument } from '../../../A1_core/project-document.js';

describe('Bootstrap Module Lifecycle & ViewPort Idempotence', () => {
    beforeEach(() => {
        disposeModules();
    });

    afterEach(() => {
        disposeModules();
    });

    it('registerGeometryUpdateHandler returns an unsubscribe callback', () => {
        resetViewPort();
        expect(getGeometryUpdateHandlersCount()).toBe(0);

        const dummyHandler = { updateBeforeRebuild: vi.fn() };
        const unsubscribe = registerGeometryUpdateHandler(dummyHandler);
        expect(getGeometryUpdateHandlersCount()).toBe(1);

        unsubscribe();
        expect(getGeometryUpdateHandlersCount()).toBe(0);
    });

    it('resetViewPort clears all registered geometry handlers and adapters', () => {
        resetViewPort();
        registerGeometryUpdateHandler({ updateBeforeRebuild: vi.fn() });
        registerGeometryUpdateHandler({ updateBeforeRebuild: vi.fn() });
        expect(getGeometryUpdateHandlersCount()).toBe(2);

        resetViewPort();
        expect(getGeometryUpdateHandlersCount()).toBe(0);
        expect(() => createContainerView({}, {})).toThrow('Brak zarejestrowanego ContainerViewAdapter');
        expect(() => createPanelView({}, {})).toThrow('Brak zarejestrowanego PanelViewAdapter');
    });

    it('calling startModules() repeatedly is idempotent and does not accumulate duplicate handlers', async () => {
        const dummyCtx: any = {
            document: new ProjectDocument(),
            viewport: { 
                scene: { 
                    onPointerObservable: { add: vi.fn(), remove: vi.fn() } 
                } 
            },
        };
        const dummyStateMachine: any = {
            registerState: vi.fn(),
            onStateChange: vi.fn().mockReturnValue(vi.fn())
        };

        // First start
        await startModules(dummyCtx, dummyStateMachine);
        const countFirst = getGeometryUpdateHandlersCount();
        // A2 bloki + S4 smartwall + A5 smartparts
        expect(countFirst).toBe(3);

        // Second start without explicit dispose (startModules calls disposeModules internally)
        await startModules(dummyCtx, dummyStateMachine);
        const countSecond = getGeometryUpdateHandlersCount();
        expect(countSecond).toBe(3);

        // Third start
        await startModules(dummyCtx, dummyStateMachine);
        const countThird = getGeometryUpdateHandlersCount();
        expect(countThird).toBe(3);

        // Explicit dispose
        disposeModules();
        expect(getGeometryUpdateHandlersCount()).toBe(0);
    });

    it('notifyBeforeRebuildGeometry executes handlers safely', () => {
        resetViewPort();
        const handler = { updateBeforeRebuild: vi.fn() };
        registerGeometryUpdateHandler(handler);

        const doc = {};
        const containers = [{ id: 'c1' }];
        notifyBeforeRebuildGeometry(doc, containers);

        expect(handler.updateBeforeRebuild).toHaveBeenCalledTimes(1);
        expect(handler.updateBeforeRebuild).toHaveBeenCalledWith(doc, containers);
    });
});
