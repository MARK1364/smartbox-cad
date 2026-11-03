import { describe, it, expect, vi } from 'vitest';
import { ProjectDocument } from '../../../A1_core/project-document.js';
import { PanelModel } from '../../../A4_smartpanel/panel-model.js';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../../A1_core/cad-node/node-type.js';
import { HardwareModel } from '../../../A1_core/hardware-model.js';
import { registerTreeActionHandlers } from '../tree-action-handlers.js';

describe('Tree Actions - Freeze and Show-All', () => {
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

    const emit = (action: string, data: any) => treeCallback(action, data);

    return { doc, emit, rebuildGeometrySpy };
  }

  it('show-all restores hidden panels but NEVER shows or unfreezes frozen panels', () => {
    const { doc, emit } = setupTest();

    // Stwórz panel 1 (zwykły) i panel 2 (do zamrożenia)
    const p1 = new PanelModel({ width: 600, height: 720, thickness: 18 });
    const p2 = new PanelModel({ width: 600, height: 720, thickness: 18 });

    const n1 = CADNode.create(NodeType.PART, 'Bok_L', p1.id);
    n1.domainData = p1;
    doc.addNode(doc.rootNode.id, n1);

    const n2 = CADNode.create(NodeType.PART, 'Bok_P', p2.id);
    n2.domainData = p2;
    doc.addNode(doc.rootNode.id, n2);

    expect(p1.visible).not.toBe(false);
    expect(p2.visible).not.toBe(false);

    // 1. Zwykłe ukrycie p1 okiem
    emit('toggle-part-visibility', { id: p1.id });
    expect(p1.visible).toBe(false);
    expect(p1.frozen).toBeFalsy();

    // 2. Zamrożenie p2 śnieżynką
    emit('toggle-freeze-part', { id: p2.id });
    expect(p2.frozen).toBe(true);
    expect(p2.visible).toBe(false);

    // 3. Użytkownik klika "Wszystko" (show-all)
    emit('show-all', {});

    // p1 (zwykły ukryty) powinien zostać przywrócony do widoku:
    expect(p1.visible).toBe(true);
    expect(p1.frozen).toBeFalsy();

    // p2 (zamrożony) MUSI POZOSTAĆ zamrożony i ukryty!
    expect(p2.frozen).toBe(true);
    expect(p2.visible).toBe(false);

    // 4. Odmrożenie p2
    emit('toggle-freeze-part', { id: p2.id });
    expect(p2.frozen).toBe(false);
    expect(p2.visible).toBe(true);
  });

  it('show-all restores hidden hardware but NEVER shows or unfreezes frozen hardware', () => {
    const { doc, emit } = setupTest();

    const hw1 = new HardwareModel({ id: 'hw_hinge_1', name: 'Zawias 1', hardwareType: 'HINGE' });
    const hw2 = new HardwareModel({ id: 'hw_hinge_2', name: 'Zawias 2', hardwareType: 'HINGE' });

    const nHw1 = CADNode.create(NodeType.HARDWARE, 'Zawias 1', hw1.id);
    nHw1.domainData = hw1;
    doc.addNode(doc.rootNode.id, nHw1);

    const nHw2 = CADNode.create(NodeType.HARDWARE, 'Zawias 2', hw2.id);
    nHw2.domainData = hw2;
    doc.addNode(doc.rootNode.id, nHw2);

    // Ukryj hw1
    emit('toggle-hardware-visibility', { id: hw1.id });
    expect((hw1 as any).visible).toBe(false);
    expect((hw1 as any).frozen).toBeFalsy();

    // Zamroź hw2
    emit('toggle-freeze-hardware', { id: hw2.id });
    expect((hw2 as any).frozen).toBe(true);
    expect((hw2 as any).visible).toBe(false);

    // Kliknij "Wszystko" (show-all)
    emit('show-all', {});

    // hw1 (ukryte) zostaje pokazane:
    expect((hw1 as any).visible).toBe(true);
    // hw2 (zamrożone) MUSI POZOSTAĆ zamrożone i ukryte:
    expect((hw2 as any).frozen).toBe(true);
    expect((hw2 as any).visible).toBe(false);
  });
});

