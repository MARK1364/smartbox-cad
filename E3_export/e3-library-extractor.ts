/**
 * E3_export - e3-library-extractor.ts
 * Ekstraktor 100% natywnego drzewa sceny CAD do biblioteki modeli E3.
 * Odczytuje dokładną strukturę kontenerów i formatek ze sceny głównej.
 */

import { E3LibraryItem } from './e3-library-types';
import { ContextManager } from '../A1_core/context-manager';
import { NodeType } from '../A1_core/cad-node/node-type';
import { CADNode } from '../A1_core/cad-node/cad-node';
import { DrawingProjectExtractor, LIVE_PROJECT_STORAGE_KEY } from '../E2_export/drawing-project-extractor';
import { syncGeometrySnapshots } from './e3-geometry-snapshot';

export const E3_LIBRARY_STORAGE_KEY = 'smartbox_cad_e3_library_v1';
export const E3_SYNC_CHANNEL_NAME = 'smartbox_cad_e3_sync';

export function toMm(val: any, defaultVal: number = 0): number {
    if (val === null || val === undefined) return defaultVal;
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return defaultVal;
    if (Math.abs(num) > 10000) {
        return Math.round(num / 1000000);
    }
    return Math.round(num);
}

export class E3LibraryExtractor {
    private static _instance: E3LibraryExtractor;

    public static get instance(): E3LibraryExtractor {
        if (!E3LibraryExtractor._instance) {
            E3LibraryExtractor._instance = new E3LibraryExtractor();
        }
        return E3LibraryExtractor._instance;
    }

    public syncLibrary(): E3LibraryItem[] {
        const items = this.extractItems();
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(E3_LIBRARY_STORAGE_KEY, JSON.stringify(items));
            }
            if (typeof BroadcastChannel !== 'undefined') {
                const channel = new BroadcastChannel(E3_SYNC_CHANNEL_NAME);
                channel.postMessage({ type: 'LIBRARY_UPDATED', items });
                channel.close();
            }
        } catch (e) {
            console.warn('Błąd zapisu biblioteki E3:', e);
        }
        try {
            syncGeometrySnapshots();
        } catch (e) {
            console.warn('Błąd zapisu geometrii E3:', e);
        }
        return items;
    }

    public loadLibrary(): E3LibraryItem[] {
        const live = this.extractItems();
        if (live && live.length > 0) {
            return live;
        }

        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem(E3_LIBRARY_STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                }
            }
        } catch (e) {
            console.warn('Błąd wczytywania biblioteki ze storage:', e);
        }

        // Fallback do DrawingProjectExtractor
        try {
            const tree = DrawingProjectExtractor.instance.extractProjectTree();
            if (tree && tree.containers && tree.containers.length > 0) {
                return tree.containers.map((c) => ({
                    id: c.id,
                    uid: c.id,
                    name: c.name,
                    type: 'CONTAINER',
                    width: c.width,
                    height: c.height,
                    depth: c.depth,
                    childCount: c.parts.length,
                    children: c.parts.map((p) => ({
                        id: p.id,
                        uid: p.id,
                        name: p.name,
                        type: 'PANEL',
                        width: p.width,
                        height: p.height,
                        depth: p.thickness || 18,
                        materialName: p.material || 'Laminat 18mm',
                        role: p.role,
                        raw: p,
                    })),
                    raw: c,
                }));
            }
        } catch {}

        return [];
    }

    public extractItems(): E3LibraryItem[] {
        const doc = ContextManager.instance?.document;
        const items: E3LibraryItem[] = [];

        if (doc && doc.rootNode) {
            this._extractFromCADNode(doc.rootNode, items);
        }

        return items;
    }

    private _extractFromCADNode(node: CADNode, result: E3LibraryItem[]): void {
        if (!node) return;

        const domainData = node.domainData as any;
        const nodeType = node.nodeType;

        const isContainer = nodeType === NodeType.ASSEMBLY || domainData?.type === 'container' || (node as any).isContainer;
        const isPanel = nodeType === NodeType.PART || domainData?.type === 'panel' || (node as any).type === 'panel';

        if (isContainer) {
            const width = toMm(domainData?.width ?? (node as any).width, 800);
            const height = toMm(domainData?.height ?? (node as any).height, 720);
            const depth = toMm(domainData?.depth ?? (node as any).depth, 560);

            const children: E3LibraryItem[] = [];
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    this._extractFromCADNode(child, children);
                }
            }

            result.push({
                id: node.id,
                uid: domainData?.smartId?.uid || node.id,
                name: domainData?.name || node.name || 'Korpus Meble',
                type: 'CONTAINER',
                width,
                height,
                depth,
                childCount: children.length,
                children,
                raw: {
                    id: node.id,
                    name: domainData?.name || node.name,
                    width,
                    height,
                    depth,
                    parts: children.map((c) => ({
                        id: c.id,
                        name: c.name,
                        width: c.width,
                        height: c.height,
                        thickness: c.depth,
                        role: (c as any).role || c.raw?.role,
                    })),
                },
            });
        } else if (isPanel) {
            const width = toMm(domainData?.width ?? (node as any).width, 600);
            const height = toMm(domainData?.height ?? (node as any).height, 720);
            const depth = toMm(domainData?.thickness ?? (node as any).thickness, 18);

            const cncPrograms = domainData?.cncPrograms || [];

            result.push({
                id: node.id,
                uid: domainData?.smartId?.uid || node.id,
                name: domainData?.name || node.name || 'Formatka',
                type: 'PANEL',
                width,
                height,
                depth,
                materialName: domainData?.materialName || domainData?.material || 'Laminat 18mm',
                colorHex: domainData?.colorHex || '#3b82f6',
                cncCount: cncPrograms.length,
                role: domainData?.role || '',
                raw: domainData || node,
            });
        } else if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                this._extractFromCADNode(child, result);
            }
        }
    }
}
