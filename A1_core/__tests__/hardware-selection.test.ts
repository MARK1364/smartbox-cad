import { describe, it, expect, vi } from 'vitest';
import { syncSelectionHighlights } from '../selection-highlight.js';
import { ContextManager } from '../context-manager.js';

describe('Hardware Selection & 3D Highlight', () => {
    it('podświetla (outline) siatkę okucia gdy jest ono activeEntity', () => {
        const hwMesh: any = {
            metadata: {
                type: 'hardware',
                id: 'drawer_rail_l',
            },
            renderOutline: false,
            outlineColor: null,
            outlineWidth: 0,
            getChildMeshes: () => [],
            isDisposed: () => false,
        };

        const hardwareViews = new Map<string, any>();
        hardwareViews.set('drawer_rail_l', hwMesh);

        ContextManager.instance.hardwareViews = hardwareViews;
        ContextManager.instance.suppressSelectionHighlight = false;

        const fakeDoc: any = {
            activeEntity: { id: 'drawer_rail_l', name: 'Prowadnica L' },
        };

        syncSelectionHighlights({
            document: fakeDoc,
            containerViews: new Map(),
            panelViews: new Map(),
            hardwareViews,
        } as any);

        expect(hwMesh.renderOutline).toBe(true);
        expect(hwMesh.outlineWidth).toBe(0.04);
    });

    it('wyłącza outline siatki okucia gdy activeEntity jest czymś innym lub nullem', () => {
        const hwMesh: any = {
            metadata: {
                type: 'hardware',
                id: 'drawer_rail_l',
            },
            renderOutline: true,
            outlineColor: null,
            outlineWidth: 0.04,
            getChildMeshes: () => [],
            isDisposed: () => false,
        };

        const hardwareViews = new Map<string, any>();
        hardwareViews.set('drawer_rail_l', hwMesh);
        ContextManager.instance.hardwareViews = hardwareViews;

        const fakeDoc: any = {
            activeEntity: null,
        };

        syncSelectionHighlights({
            document: fakeDoc,
            containerViews: new Map(),
            panelViews: new Map(),
            hardwareViews,
        } as any);

        expect(hwMesh.renderOutline).toBe(false);
    });

    it('podświetla WYŁĄCZNIE wybrany sub-element okucia (np. boczek), nie podświetlając mocowania i prowadnicy', () => {
        const meshBoczek: any = {
            metadata: { type: 'hardware', id: 'rail_1_boczek', subType: 'boczek', parentId: 'rail_1' },
            renderOutline: false,
            outlineWidth: 0,
            getChildMeshes: () => [],
            isDisposed: () => false,
        };
        const meshMocowanie: any = {
            metadata: { type: 'hardware', id: 'rail_1_mocowanie', subType: 'mocowanie', parentId: 'rail_1' },
            renderOutline: false,
            outlineWidth: 0,
            getChildMeshes: () => [],
            isDisposed: () => false,
        };
        const meshProwadnica: any = {
            metadata: { type: 'hardware', id: 'rail_1_prowadnica', subType: 'prowadnica', parentId: 'rail_1' },
            renderOutline: false,
            outlineWidth: 0,
            getChildMeshes: () => [],
            isDisposed: () => false,
        };
        const rootRail: any = {
            metadata: { type: 'hardware', id: 'rail_1' },
            renderOutline: false,
            outlineWidth: 0,
            getChildMeshes: () => [meshBoczek, meshMocowanie, meshProwadnica],
            isDisposed: () => false,
        };

        const hardwareViews = new Map<string, any>();
        hardwareViews.set('rail_1', rootRail);
        hardwareViews.set('rail_1_boczek', meshBoczek);
        hardwareViews.set('rail_1_mocowanie', meshMocowanie);
        hardwareViews.set('rail_1_prowadnica', meshProwadnica);

        ContextManager.instance.hardwareViews = hardwareViews;
        ContextManager.instance.suppressSelectionHighlight = false;

        // Aktywny jest wyłącznie boczek
        const fakeDoc: any = {
            activeEntity: {
                id: 'rail_1_boczek',
                name: 'Boczek L',
                subType: 'boczek',
                parentId: 'rail_1',
                type: 'hardware_subpart',
            },
        };

        syncSelectionHighlights({
            document: fakeDoc,
            containerViews: new Map(),
            panelViews: new Map(),
            hardwareViews,
        } as any);

        expect(meshBoczek.renderOutline).toBe(true);
        expect(meshMocowanie.renderOutline).toBe(false);
        expect(meshProwadnica.renderOutline).toBe(false);
        expect(rootRail.renderOutline).toBe(false);
    });
});

