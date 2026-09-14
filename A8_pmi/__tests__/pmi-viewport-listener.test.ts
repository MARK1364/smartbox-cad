import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PMIViewportListener } from '../pmi-viewport-listener';
import { PMIStore } from '../pmi-data';

describe('PMIViewportListener — text vs line picking', () => {
    let mockScene: any;
    let mockStateMachine: any;
    let mockCanvas: any;
    let registeredCallback: ((pointerInfo: any) => void) | null = null;
    let store: PMIStore;

    const lineMesh = () => ({
        metadata: { pmiAnnotationId: 'dim_1', pmiTarget: 'line' },
        isPickable: true,
    });
    const textMesh = () => ({
        metadata: { pmiAnnotationId: 'dim_1', pmiTarget: 'text' },
        isPickable: true,
    });

    // Pomocnicze: ustawia scene.pointerX/Y i symuluje POINTERDOWN
    const down = (px = 100, py = 200) => {
        mockScene.pointerX = px;
        mockScene.pointerY = py;
        registeredCallback!({ type: 1, event: { button: 0 } });
    };

    // Pomocnicze: ustawia scene.pointerX/Y i symuluje POINTERMOVE
    const move = (px = 100, py = 200) => {
        mockScene.pointerX = px;
        mockScene.pointerY = py;
        registeredCallback!({ type: 4, event: {} });
    };

    // Pomocnicze: symuluje POINTERUP
    const up = () =>
        registeredCallback!({ type: 2, event: { button: 0 } });

    beforeEach(() => {
        store = new PMIStore();
        mockCanvas = { style: { cursor: 'default' } };
        registeredCallback = null;

        mockScene = {
            pointerX: 100,
            pointerY: 200,
            onPointerObservable: {
                add: vi.fn((cb) => {
                    registeredCallback = cb;
                    return 'obs_1';
                }),
                remove: vi.fn(),
            },
            multiPick: vi.fn(),
            pick: vi.fn(),
            getEngine: vi.fn(() => ({
                getRenderingCanvas: () => mockCanvas,
            })),
        };

        (globalThis as any).BABYLON = {
            PointerEventTypes: {
                POINTERDOWN: 1,
                POINTERUP: 2,
                POINTERMOVE: 4,
            },
        };

        mockStateMachine = {
            onStateChange: vi.fn(() => () => {}),
            getState: vi.fn(),
            changeState: vi.fn(),
        };
    });

    it('nadaje tekstowi priorytet przed linią wymiarową gdy na promieniu są oba meshe', () => {
        const listener = new PMIViewportListener(mockScene, mockStateMachine, store);
        listener.attach();

        // multiPick zwraca najpierw linię (bo cylinder jest grubszy), a potem tekst
        mockScene.multiPick.mockReturnValue([
            { hit: true, pickedMesh: lineMesh() },
            { hit: true, pickedMesh: textMesh() },
        ]);

        const hit = (listener as any).pickAnnotationHit();
        expect(hit).not.toBeNull();
        expect(hit.id).toBe('dim_1');
        expect(hit.target).toBe('text');
    });

    it('zwraca linię wymiarową gdy kursor trafia tylko w linię (poza tekstem)', () => {
        const listener = new PMIViewportListener(mockScene, mockStateMachine, store);
        listener.attach();

        mockScene.multiPick.mockReturnValue([
            { hit: true, pickedMesh: lineMesh() },
        ]);

        const hit = (listener as any).pickAnnotationHit();
        expect(hit).not.toBeNull();
        expect(hit.id).toBe('dim_1');
        expect(hit.target).toBe('line');
    });

    it('ustawia kursor grab przy hoverze na tekst oraz move przy hoverze na linię', () => {
        const listener = new PMIViewportListener(mockScene, mockStateMachine, store);
        listener.attach();

        expect(registeredCallback).not.toBeNull();

        // Hover nad tekstem
        mockScene.multiPick.mockReturnValue([
            { hit: true, pickedMesh: { metadata: { pmiAnnotationId: 'dim_1', pmiTarget: 'text' }, isPickable: true } },
        ]);
        move();
        expect(mockCanvas.style.cursor).toBe('grab');

        // Hover nad linią
        mockScene.multiPick.mockReturnValue([
            { hit: true, pickedMesh: { metadata: { pmiAnnotationId: 'dim_1', pmiTarget: 'line' }, isPickable: true } },
        ]);
        move();
        expect(mockCanvas.style.cursor).toBe('move');

        // Zjechanie poza wymiar
        mockScene.multiPick.mockReturnValue([]);
        move();
        expect(mockCanvas.style.cursor).toBe('default');
    });

    it('pojedynczy klik (bez ruchu) tylko zaznacza wymiar i nie uruchamia narzędzia edycji', () => {
        const listener = new PMIViewportListener(mockScene, mockStateMachine, store);
        listener.attach();

        mockScene.multiPick.mockReturnValue([{ hit: true, pickedMesh: lineMesh() }]);
        mockScene.pick.mockReturnValue({ hit: false });

        down(100, 200);
        // Ruch poniżej progu (0 px)
        move(100, 200);
        up();

        expect(mockStateMachine.changeState).not.toHaveBeenCalled();
    });

    it('przeciągnięcie na linii wymiarowej (> 5px) uruchamia tryb edycji linii (PMI_EDIT_TOOL)', () => {
        const listener = new PMIViewportListener(mockScene, mockStateMachine, store);
        listener.attach();

        mockStateMachine.getState.mockReturnValue({ beginEdit: vi.fn() });
        mockScene.multiPick.mockReturnValue([{ hit: true, pickedMesh: lineMesh() }]);
        mockScene.pick.mockReturnValue({ hit: false });

        down(100, 200);
        move(106, 200); // 6px w prawo — przekracza próg 5px

        expect(mockStateMachine.changeState).toHaveBeenCalledWith('PMI_EDIT_TOOL');
    });

    it('przeciągnięcie na tekście wymiaru (> 5px) uruchamia tryb przesuwania tekstu (PMI_TEXT_SHIFT_TOOL)', () => {
        const listener = new PMIViewportListener(mockScene, mockStateMachine, store);
        listener.attach();

        mockStateMachine.getState.mockReturnValue({ beginEdit: vi.fn() });
        mockScene.multiPick.mockReturnValue([{ hit: true, pickedMesh: textMesh() }]);
        mockScene.pick.mockReturnValue({ hit: false });

        down(100, 200);
        move(100, 207); // 7px w dół

        expect(mockStateMachine.changeState).toHaveBeenCalledWith('PMI_TEXT_SHIFT_TOOL');
    });

    it('ruch mniejszy niż próg (< 5px) NIE uruchamia edycji', () => {
        const listener = new PMIViewportListener(mockScene, mockStateMachine, store);
        listener.attach();

        mockStateMachine.getState.mockReturnValue({ beginEdit: vi.fn() });
        mockScene.multiPick.mockReturnValue([{ hit: true, pickedMesh: lineMesh() }]);
        mockScene.pick.mockReturnValue({ hit: false });

        down(100, 200);
        move(103, 200); // tylko 3px — poniżej progu
        up();

        expect(mockStateMachine.changeState).not.toHaveBeenCalled();
    });
});
