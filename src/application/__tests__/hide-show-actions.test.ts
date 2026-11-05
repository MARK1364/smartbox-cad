import { describe, it, expect, vi } from 'vitest';
import { ProjectDocument } from '../../../A1_core/project-document.js';
import { PanelModel } from '../../../A4_smartpanel/panel-model.js';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../../A1_core/cad-node/node-type.js';
import { ContextManager } from '../../../A1_core/context-manager.js';
import { registerTreeActionHandlers } from '../tree-action-handlers.js';
import { showCadTreeContextMenu } from '../../module-data/tree-context-menu.js';
import { ContextMenu } from '../../../A1_core/context-menu.js';
import { findHiddenEntityAlongRay } from '../../../A1_core/quick-pick/quick-pick-detector.js';

describe('Hide and Show Actions (Strict, Non-Toggling)', () => {
  function setupTest() {
    const doc = new ProjectDocument();
    let treeCallback: (action: string, data: any) => void = () => {};

    const mockUi = {
      onTreeAction: vi.fn((cb) => {
        treeCallback = cb;
      }),
      setStatus: vi.fn(),
      refreshFeatures: vi.fn(),
    };

    const rebuildGeometrySpy = vi.fn();

    const ctx: any = {
      document: doc,
      ui: mockUi,
      facePicker: { clearSelection: vi.fn() },
      propertiesManager: { showProperties: vi.fn(), inspectFeature: vi.fn() },
      panelViews: new Map(),
    };

    registerTreeActionHandlers(ctx, rebuildGeometrySpy);
    ContextManager.instance.document = doc;

    const emit = (action: string, data: any) => treeCallback(action, data);

    return { doc, emit, rebuildGeometrySpy };
  }

  it('hide-part strictly hides (never unhides on repeated calls)', () => {
    const { doc, emit } = setupTest();

    const p = new PanelModel({ width: 600, height: 720, thickness: 18 });
    const node = CADNode.create(NodeType.PART, 'Formatka_1', p.id);
    node.domainData = p;
    doc.addNode(doc.rootNode.id, node);

    expect(p.visible).not.toBe(false);

    // Pierwsze ukrycie
    emit('hide-part', { id: p.id });
    expect(p.visible).toBe(false);

    // Drugie wywołanie ukryj — NIE MOŻE przywracać widoczności (to nie toggle!)
    emit('hide-part', { id: p.id });
    expect(p.visible).toBe(false);
  });

  it('show-part strictly shows (never hides on repeated calls)', () => {
    const { doc, emit } = setupTest();

    const p = new PanelModel({ width: 600, height: 720, thickness: 18 });
    p.visible = false;
    const node = CADNode.create(NodeType.PART, 'Formatka_1', p.id);
    node.domainData = p;
    doc.addNode(doc.rootNode.id, node);

    expect(p.visible).toBe(false);

    // Pierwsze pokazanie
    emit('show-part', { id: p.id });
    expect(p.visible).toBe(true);

    // Drugie wywołanie pokaż — NIE MOŻE chować
    emit('show-part', { id: p.id });
    expect(p.visible).toBe(true);
  });

  it('show-part restores visibility of hidden parent container', () => {
    const { doc, emit } = setupTest();

    const container = doc.createAssembly({ name: 'Szafka' });
    (container as any).visible = false;

    const p = new PanelModel({ width: 600, height: 720, thickness: 18 });
    p.visible = false;
    const node = CADNode.create(NodeType.PART, 'Formatka_Wewn', p.id);
    node.domainData = p;
    doc.addNode(container.id, node);

    expect((container as any).visible).toBe(false);
    expect(p.visible).toBe(false);

    emit('show-part', { id: p.id });

    expect(p.visible).toBe(true);
    expect((container as any).visible).toBe(true);
  });

  it('context menu shows "Ukryj" for visible panel, and "Pokaż" for hidden panel', () => {
    const doc = new ProjectDocument();
    ContextManager.instance.document = doc;

    const p = new PanelModel({ width: 600, height: 720, thickness: 18 });
    const node = CADNode.create(NodeType.PART, 'Formatka_Test', p.id);
    node.domainData = p;
    doc.addNode(doc.rootNode.id, node);

    let shownItems: any[] = [];
    const origShow = ContextMenu.prototype.show;
    ContextMenu.prototype.show = function (_x: number, _y: number, items: any[]) {
      shownItems = items;
    };

    try {
      // 1. Widoczny panel -> menu zawiera 'Ukryj'
      p.visible = true;
      showCadTreeContextMenu({
        type: 'part',
        id: p.id,
        name: p.name,
        clientX: 100,
        clientY: 100,
      });

      const getToolbarActions = (items: any[]) => {
        const actions: string[] = [];
        for (const it of items) {
          if (Array.isArray(it.toolbar)) {
            for (const t of it.toolbar) {
              if (t.label) actions.push(t.label);
            }
          }
        }
        return actions;
      };

      let actions = getToolbarActions(shownItems);
      expect(actions).toContain('Ukryj');
      expect(actions).not.toContain('Pokaż');

      // 2. Ukryty panel -> menu zawiera 'Pokaż'
      p.visible = false;
      showCadTreeContextMenu({
        type: 'part',
        id: p.id,
        name: p.name,
        visible: false,
        clientX: 100,
        clientY: 100,
      });

      actions = getToolbarActions(shownItems);
      expect(actions).toContain('Pokaż');
      expect(actions).not.toContain('Ukryj');

      // 3. Widoczny panel z ukrytym elementem za nim (hiddenUnderCursor) -> zawiera ZARÓWNO 'Ukryj' JAK I 'Pokaż'
      p.visible = true;
      showCadTreeContextMenu({
        type: 'part',
        id: p.id,
        name: p.name,
        visible: true,
        clientX: 100,
        clientY: 100,
        hiddenUnderCursor: {
          id: 'hidden_panel_id',
          name: 'Półka_Ukryta',
          type: 'part',
        },
      });

      actions = getToolbarActions(shownItems);
      expect(actions).toContain('Ukryj');
      expect(actions).toContain('Pokaż: Półka_Ukryta');
    } finally {
      ContextMenu.prototype.show = origShow;
    }
  });

  it('findHiddenEntityAlongRay identifies hidden panel along ray', () => {
    const doc = new ProjectDocument();
    const p = new PanelModel({ width: 600, height: 720, thickness: 18 });
    p.visible = false;

    const mockMesh = {
      computeWorldMatrix: vi.fn(),
    };

    const mockView = {
      model: p,
      faceMeshes: {
        front: mockMesh,
      },
    };

    const panelViews = new Map<any, any>();
    panelViews.set(p.id, mockView);

    const mockRay = {
      intersectsMesh: vi.fn((mesh: any) => {
        if (mesh === mockMesh) {
          return { hit: true, distance: 150 };
        }
        return { hit: false };
      }),
    };

    const mockScene = {
      activeCamera: {},
      createPickingRay: vi.fn(() => mockRay),
    };

    const hit = findHiddenEntityAlongRay(mockScene, 100, 200, doc, panelViews);
    expect(hit).not.toBeNull();
    expect(hit?.id).toBe(p.id);
    expect(hit?.type).toBe('part');
    expect(hit?.distance).toBe(150);
  });
});
