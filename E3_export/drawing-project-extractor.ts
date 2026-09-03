/**
 * E3_export - drawing-project-extractor.ts
 * Ekstraktor 100% natywnego drzewa obiektów 3D oraz generator rzutów Multi-Kadrów z wymiarami PMI.
 */

import {
    CADTreeNode,
    ProjectDrawingTree,
    ContainerDrawingGeometry,
    PartDrawingGeometry,
    HoleFeature2D,
    GrooveFeature2D,
    ProjectionAngle,
    DrawingPMIDimension,
} from './drawing-types';
import { ContextManager } from '../A1_core/context-manager';
import { NodeType } from '../A1_core/cad-node/node-type';
import { CADNode } from '../A1_core/cad-node/cad-node';
import { PMIStore } from '../A8_pmi/pmi-data';

export const LIVE_PROJECT_STORAGE_KEY = 'smartbox_cad_live_project_v1';
export const LIVE_PMI_STORAGE_KEY = 'smartbox_cad_live_pmi_v1';
export const SYNC_CHANNEL_NAME = 'smartbox_cad_sync';

/**
 * Konwertuje dowolną wartość wymiarową na milimetry (mm).
 * Jeśli wartość w CADNode jest w nanometrach (> 10000), dzieli przez 1 000 000.
 */
export function toMm(val: any, defaultVal: number = 0): number {
    if (val === null || val === undefined) return defaultVal;
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return defaultVal;

    if (Math.abs(num) > 10000) {
        return Math.round(num / 1000000);
    }
    return Math.round(num);
}

function mapGrooveFeature(f: any, fallbackHeight: number): GrooveFeature2D {
    const library = f?.params?.source === 'library' && !!f?.params?.library_id;
    return {
        id: String(f.id || `g_${Math.random().toString(36).slice(2, 8)}`),
        x: toMm(f.params?.u ?? f.params?.x ?? f.x, 0),
        y: toMm(f.params?.v ?? f.params?.y ?? f.y, 0),
        width: toMm(f.params?.width ?? f.width, 4),
        height: toMm(f.params?.length ?? f.params?.height ?? f.height, fallbackHeight),
        depth: toMm(f.params?.depth ?? f.depth, 8),
        name: library ? (f.name || f.params.library_id || 'Operacja') : (f.name || 'Wpust'),
        source: library ? 'library' : 'engine',
        libraryId: library ? String(f.params.library_id) : undefined,
        face: f.face,
        editable: library,
    };
}

export class DrawingProjectExtractor {
    private static _instance: DrawingProjectExtractor;

    public static get instance(): DrawingProjectExtractor {
        if (!DrawingProjectExtractor._instance) {
            DrawingProjectExtractor._instance = new DrawingProjectExtractor();
        }
        return DrawingProjectExtractor._instance;
    }

    /**
     * Zapisuje bieżące natywne drzewo sceny 3D i wymiary PMI do pamięci podręcznej i rozsyła sygnał przez BroadcastChannel.
     */
    public syncLiveSceneTree(): ProjectDrawingTree {
        const tree = this.extractProjectTree();
        const pmiData = this.extractPMIDimensions();
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(LIVE_PROJECT_STORAGE_KEY, JSON.stringify(tree));
                localStorage.setItem(LIVE_PMI_STORAGE_KEY, JSON.stringify(pmiData));
            }
            if (typeof BroadcastChannel !== 'undefined') {
                const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
                channel.postMessage({ type: 'SCENE_UPDATED', tree, pmiData });
                channel.close();
            }
        } catch (e) {
            console.warn('Nie udało się zapisać zsynchronizowanego drzewa do storage:', e);
        }
        return tree;
    }

    /**
     * Pobiera aktywne wymiary i miarki PMI ze sceny 3D.
     */
    public extractPMIDimensions(): DrawingPMIDimension[] {
        const pmiList: DrawingPMIDimension[] = [];

        try {
            const store = PMIStore.instance;
            if (store) {
                const annotations = (store.annotations || []).filter((a) => a.visible !== false);
                for (const ann of annotations) {
                    const text = ann.text || (ann.distanceMM ? `${ann.distanceMM.toFixed(1)} mm` : '');
                    pmiList.push({
                        id: ann.id,
                        text,
                        distanceMM: ann.distanceMM || 0,
                        x1: ann.anchor1?.pointWorldFallback?.x ?? ann.anchor1?.pointLocal?.x ?? 0,
                        y1: ann.anchor1?.pointWorldFallback?.y ?? ann.anchor1?.pointLocal?.y ?? 0,
                        z1: ann.anchor1?.pointWorldFallback?.z ?? ann.anchor1?.pointLocal?.z ?? 0,
                        x2: ann.anchor2?.pointWorldFallback?.x ?? ann.anchor2?.pointLocal?.x ?? 0,
                        y2: ann.anchor2?.pointWorldFallback?.y ?? ann.anchor2?.pointLocal?.y ?? 0,
                        z2: ann.anchor2?.pointWorldFallback?.z ?? ann.anchor2?.pointLocal?.z ?? 0,
                        lx1: ann.anchor1?.pointLocal?.x ?? 0,
                        ly1: ann.anchor1?.pointLocal?.y ?? 0,
                        lz1: ann.anchor1?.pointLocal?.z ?? 0,
                        lx2: ann.anchor2?.pointLocal?.x ?? 0,
                        ly2: ann.anchor2?.pointLocal?.y ?? 0,
                        lz2: ann.anchor2?.pointLocal?.z ?? 0,
                        nodeId: ann.anchor1?.nodeId || ann.anchor2?.nodeId || '',
                        dimType: 'LINEAR',
                    });
                }

                const measurements = (store.measurements || []).filter((m) => m.visible !== false);
                for (const msr of measurements) {
                    const text = msr.text || (msr.distanceMM ? `${msr.distanceMM.toFixed(1)} mm` : '');
                    pmiList.push({
                        id: msr.id,
                        text,
                        distanceMM: msr.distanceMM || 0,
                        x1: msr.anchor1?.pointWorldFallback?.x ?? msr.anchor1?.pointLocal?.x ?? 0,
                        y1: msr.anchor1?.pointWorldFallback?.y ?? msr.anchor1?.pointLocal?.y ?? 0,
                        z1: msr.anchor1?.pointWorldFallback?.z ?? msr.anchor1?.pointLocal?.z ?? 0,
                        x2: msr.anchor2?.pointWorldFallback?.x ?? msr.anchor2?.pointLocal?.x ?? 0,
                        y2: msr.anchor2?.pointWorldFallback?.y ?? msr.anchor2?.pointLocal?.y ?? 0,
                        z2: msr.anchor2?.pointWorldFallback?.z ?? msr.anchor2?.pointLocal?.z ?? 0,
                        lx1: msr.anchor1?.pointLocal?.x ?? 0,
                        ly1: msr.anchor1?.pointLocal?.y ?? 0,
                        lz1: msr.anchor1?.pointLocal?.z ?? 0,
                        lx2: msr.anchor2?.pointLocal?.x ?? 0,
                        ly2: msr.anchor2?.pointLocal?.y ?? 0,
                        lz2: msr.anchor2?.pointLocal?.z ?? 0,
                        nodeId: msr.anchor1?.nodeId || msr.anchor2?.nodeId || '',
                        dimType: 'ALIGNED',
                    });
                }
            }
        } catch (e) {
            console.warn('Błąd podczas odczytu PMIStore:', e);
        }

        // Fallback do localStorage
        if (pmiList.length === 0 && typeof localStorage !== 'undefined') {
            try {
                const raw = localStorage.getItem(LIVE_PMI_STORAGE_KEY);
                if (raw) {
                    return JSON.parse(raw);
                }
            } catch {}
        }

        return pmiList;
    }

    /**
     * Odczytuje identyczne natywne drzewo obiektów CAD bezpośrednio ze sceny 3D (Projekt WebCAD -> Kontenery -> Płyty).
     */
    public extractProjectTree(): ProjectDrawingTree {
        const cm = ContextManager.instance;
        const doc = cm?.document;

        // 1. Odczyt z natywnego ProjectDocument
        if (doc && doc.rootNode) {
            const projectName = doc.name || 'Projekt WebCAD';

            const childNodes: CADTreeNode[] = [];
            if (doc.rootNode.children && doc.rootNode.children.length > 0) {
                for (const child of doc.rootNode.children) {
                    childNodes.push(this._mapCadNodeToTreeNode(child));
                }
            }

            let maxW = 600;
            let maxH = 720;
            let maxD = 560;
            let totalParts = 0;

            for (const ch of childNodes) {
                maxW = Math.max(maxW, ch.width);
                maxH = Math.max(maxH, ch.height);
                maxD = Math.max(maxD, ch.depth);
                totalParts += ch.partCount;
            }

            const rootNode: CADTreeNode = {
                id: 'project-root',
                name: projectName,
                type: 'PROJECT',
                icon: '📁',
                width: maxW,
                height: maxH,
                depth: maxD,
                partCount: totalParts,
                children: childNodes,
            };

            const { containers, standaloneParts } = this._flattenContainersAndParts(rootNode);
            return {
                projectName,
                rootNode,
                containers,
                standaloneParts,
            };
        }

        // 2. Odczyt z containerViews i panelViews w ContextManager
        if (cm && ((cm.containerViews && cm.containerViews.size > 0) || (cm.panelViews && cm.panelViews.size > 0))) {
            const rootNode = this._extractFromViews(cm);
            const { containers, standaloneParts } = this._flattenContainersAndParts(rootNode);
            return {
                projectName: 'Projekt WebCAD',
                rootNode,
                containers,
                standaloneParts,
            };
        }

        // 3. Odczyt z localStorage (dla osobnego okna drawing.html)
        if (typeof localStorage !== 'undefined') {
            try {
                const cachedRaw = localStorage.getItem(LIVE_PROJECT_STORAGE_KEY);
                if (cachedRaw) {
                    const parsed = JSON.parse(cachedRaw);
                    if (parsed && parsed.rootNode) {
                        return parsed;
                    }
                }
            } catch (e) {
                console.warn('Błąd odczytu z pamięci lokalnej:', e);
            }
        }

        // 4. Domyślny pusty korzeń jeśli scena 3D jest pusta
        const emptyRoot: CADTreeNode = {
            id: 'project-root',
            name: 'Projekt WebCAD (Brak mebli w scenie)',
            type: 'PROJECT',
            icon: '📁',
            width: 600,
            height: 720,
            depth: 560,
            partCount: 0,
            children: [],
        };

        return {
            projectName: 'Projekt WebCAD',
            rootNode: emptyRoot,
            containers: [],
            standaloneParts: [],
        };
    }

    private _mapCadNodeToTreeNode(cadNode: CADNode): CADTreeNode {
        const domainData = cadNode.domainData as any;
        const rawName = domainData?.name || cadNode.name || 'Obiekt CAD';

        let width = 0;
        let height = 0;
        let depth = 0;
        let thickness = 18;
        let material = 'Płyta Laminowana 18mm';
        let role = '';
        const holes: HoleFeature2D[] = [];
        const grooves: GrooveFeature2D[] = [];

        if (domainData) {
            width = toMm(domainData.width ?? domainData.dimX, 0);
            height = toMm(domainData.height ?? domainData.dimY, 0);
            depth = toMm(domainData.depth ?? domainData.dimZ, 0);
            thickness = toMm(domainData.thickness ?? domainData.dimZ, 18);
            if (domainData.material) material = domainData.material;
            if (domainData.role) role = domainData.role;

            const rawFeatures = domainData.features || [];
            for (const f of rawFeatures) {
                const isHole = f.type?.toLowerCase() === 'hole' || f.type === 'drill';
                if (isHole) {
                    holes.push({
                        id: f.id || `h_${Math.random()}`,
                        x: toMm(f.params?.x ?? f.x, 0),
                        y: toMm(f.params?.y ?? f.y, 0),
                        diameter: toMm(f.params?.diameter ?? f.diameter, 5),
                        depth: toMm(f.params?.depth ?? f.depth, 12),
                        face: f.params?.face || 'FRONT',
                    });
                } else if (f.type?.toLowerCase() === 'groove') {
                    grooves.push(mapGrooveFeature(f, height || 720));
                }
            }

            if (domainData.holes && Array.isArray(domainData.holes)) {
                for (const h of domainData.holes) {
                    if (!holes.some((ex) => ex.id === h.id)) {
                        holes.push({
                            id: h.id || `h_${Math.random()}`,
                            x: toMm(h.x, 0),
                            y: toMm(h.y, 0),
                            diameter: toMm(h.diameter, 5),
                            depth: toMm(h.depth, 12),
                            face: h.face || 'FRONT',
                        });
                    }
                }
            }

            if (domainData.grooves && Array.isArray(domainData.grooves)) {
                for (const g of domainData.grooves) {
                    if (!grooves.some((ex) => ex.id === g.id)) {
                        grooves.push(mapGrooveFeature(g, height || 720));
                    }
                }
            }
        }

        const isPart = cadNode.nodeType === NodeType.PART || domainData?.type === 'panel';
        const isAssembly = cadNode.nodeType === NodeType.ASSEMBLY || domainData?.type === 'container';
        const isGroup = cadNode.nodeType === NodeType.GROUP;

        let icon = '📦';
        let type: CADTreeNode['type'] = 'CONTAINER';

        if (isPart) {
            icon = '🪵';
            type = 'PART';
            if (depth === 0) depth = thickness;
        } else if (isGroup || rawName.toLowerCase().includes('szuflad') || rawName.toLowerCase().includes('drawer')) {
            icon = '🗄️';
            type = 'DRAWERS';
        } else if (rawName.toLowerCase().includes('półk') || rawName.toLowerCase().includes('shelf')) {
            icon = '📚';
            type = 'SHELVES';
        } else if (isAssembly) {
            icon = '📦';
            type = 'CONTAINER';
        }

        const children: CADTreeNode[] = [];
        let totalPartCount = isPart ? 1 : 0;

        if (cadNode.children && cadNode.children.length > 0) {
            for (const child of cadNode.children) {
                const mappedChild = this._mapCadNodeToTreeNode(child);
                children.push(mappedChild);
                totalPartCount += mappedChild.partCount;

                if (width === 0) width = Math.max(width, mappedChild.width);
                if (height === 0) height = Math.max(height, mappedChild.height);
                if (depth === 0) depth = Math.max(depth, mappedChild.depth);
            }
        }

        if (width === 0) width = 600;
        if (height === 0) height = 720;
        if (depth === 0) depth = isPart ? thickness : 560;

        return {
            id: cadNode.id,
            name: rawName,
            type,
            icon,
            width,
            height,
            depth,
            thickness: isPart ? thickness : undefined,
            material: isPart ? material : undefined,
            role: isPart ? role : undefined,
            partCount: totalPartCount,
            children: children.length > 0 ? children : undefined,
            holes: holes.length > 0 ? holes : undefined,
            grooves: grooves.length > 0 ? grooves : undefined,
            visible: domainData?.visible !== false,
        };
    }

    private _extractFromViews(cm: ContextManager): CADTreeNode {
        const containerNodes: CADTreeNode[] = [];
        const standalonePartNodes: CADTreeNode[] = [];

        if (cm.containerViews && cm.containerViews.size > 0) {
            cm.containerViews.forEach((cView: any, cModel: any) => {
                const cName = cModel?.name || 'Szafka Korpusowa';
                const cWidth = toMm(cModel?.width, 600);
                const cHeight = toMm(cModel?.height, 720);
                const cDepth = toMm(cModel?.depth, 560);
                const cId = cModel?.id || `cont_${Math.random()}`;

                const partsForContainer: CADTreeNode[] = [];

                if (cm.panelViews) {
                    cm.panelViews.forEach((pView: any, pModel: any) => {
                        if (pModel && (pModel.containerId === cId || pModel.parentContainerId === cId)) {
                            partsForContainer.push(this._mapPanelModelToTreeNode(pModel));
                        }
                    });
                }

                containerNodes.push({
                    id: cId,
                    name: cName,
                    type: 'CONTAINER',
                    icon: '📦',
                    width: cWidth,
                    height: cHeight,
                    depth: cDepth,
                    partCount: partsForContainer.length,
                    children: partsForContainer.length > 0 ? partsForContainer : undefined,
                    visible: cModel?.visible !== false,
                });
            });
        }

        if (cm.panelViews && cm.panelViews.size > 0) {
            cm.panelViews.forEach((pView: any, pModel: any) => {
                const hasParent = containerNodes.some((c) => c.children?.some((p) => p.id === pModel?.id));
                if (!hasParent && pModel) {
                    standalonePartNodes.push(this._mapPanelModelToTreeNode(pModel));
                }
            });
        }

        const allChildren = [...containerNodes, ...standalonePartNodes];
        const totalParts = allChildren.reduce((acc, c) => acc + c.partCount, 0);

        return {
            id: 'project-root',
            name: 'Projekt WebCAD',
            type: 'PROJECT',
            icon: '📁',
            width: Math.max(...allChildren.map((c) => c.width), 600),
            height: Math.max(...allChildren.map((c) => c.height), 720),
            depth: Math.max(...allChildren.map((c) => c.depth), 560),
            partCount: totalParts,
            children: allChildren,
        };
    }

    private _mapPanelModelToTreeNode(pModel: any): CADTreeNode {
        const width = toMm(pModel.width ?? pModel.dimX, 560);
        const height = toMm(pModel.height ?? pModel.dimY, 720);
        const thickness = toMm(pModel.thickness ?? pModel.dimZ, 18);
        const name = pModel.name || 'Formatka';
        const material = pModel.material || 'Płyta Laminowana 18mm';
        const role = pModel.role || '';

        const holes: HoleFeature2D[] = [];
        const grooves: GrooveFeature2D[] = [];
        const rawFeatures = pModel.features || [];
        for (const f of rawFeatures) {
            const isHole = f.type?.toLowerCase() === 'hole' || f.type === 'drill';
            if (isHole) {
                holes.push({
                    id: f.id || `h_${Math.random()}`,
                    x: toMm(f.params?.x ?? f.x, 0),
                    y: toMm(f.params?.y ?? f.y, 0),
                    diameter: toMm(f.params?.diameter ?? f.diameter, 5),
                    depth: toMm(f.params?.depth ?? f.depth, 12),
                    face: f.params?.face || 'FRONT',
                });
            } else if (f.type?.toLowerCase() === 'groove') {
                grooves.push(mapGrooveFeature(f, height));
            }
        }
        if (pModel.holes && Array.isArray(pModel.holes)) {
            for (const h of pModel.holes) {
                if (!holes.some((ex) => ex.id === h.id)) {
                    holes.push({
                        id: h.id || `h_${Math.random()}`,
                        x: toMm(h.x, 0),
                        y: toMm(h.y, 0),
                        diameter: toMm(h.diameter, 5),
                        depth: toMm(h.depth, 12),
                        face: h.face || 'FRONT',
                    });
                }
            }
        }
        if (pModel.grooves && Array.isArray(pModel.grooves)) {
            for (const g of pModel.grooves) {
                if (!grooves.some((ex) => ex.id === g.id)) {
                    grooves.push(mapGrooveFeature(g, height));
                }
            }
        }

        return {
            id: pModel.id || `part_${Date.now()}_${Math.random()}`,
            name,
            type: 'PART',
            icon: '🪵',
            width,
            height,
            depth: thickness,
            thickness,
            material,
            role,
            partCount: 1,
            holes,
            grooves,
            visible: pModel.visible !== false,
        };
    }

    private _flattenContainersAndParts(root: CADTreeNode): { containers: ContainerDrawingGeometry[]; standaloneParts: PartDrawingGeometry[] } {
        const containers: ContainerDrawingGeometry[] = [];
        const standaloneParts: PartDrawingGeometry[] = [];

        const walk = (node: CADTreeNode) => {
            if (node.type === 'CONTAINER') {
                const parts: PartDrawingGeometry[] = [];
                if (node.children) {
                    for (const ch of node.children) {
                        if (ch.type === 'PART') {
                            parts.push({
                                id: ch.id,
                                name: ch.name,
                                role: ch.role,
                                material: ch.material || 'Płyta 18mm',
                                width: ch.width,
                                height: ch.height,
                                thickness: ch.thickness || 18,
                                holes: ch.holes || [],
                                grooves: ch.grooves || [],
                            });
                        }
                    }
                }
                containers.push({
                    id: node.id,
                    name: node.name,
                    width: node.width,
                    height: node.height,
                    depth: node.depth,
                    parts,
                });
            } else if (node.type === 'PART') {
                standaloneParts.push({
                    id: node.id,
                    name: node.name,
                    role: node.role,
                    material: node.material || 'Płyta 18mm',
                    width: node.width,
                    height: node.height,
                    thickness: node.thickness || 18,
                    holes: node.holes || [],
                    grooves: node.grooves || [],
                });
            }

            if (node.children) {
                for (const c of node.children) {
                    walk(c);
                }
            }
        };

        walk(root);
        return { containers, standaloneParts };
    }

    /**
     * Generuje czysty wektorowy SVG rzutu technicznego CAD z asocjatywnymi wymiarami PMI.
     */
    public generateVectorSvgForNode(
        node: CADTreeNode,
        projection: ProjectionAngle,
        scale: number,
        showPMI: boolean = true
    ): { svg: string; widthMm: number; heightMm: number } {
        const W = node.width || 600;
        const H = node.height || 720;
        const D = node.depth || (node.thickness || 18);

        let naturalW = W;
        let naturalH = H;

        switch (projection) {
            case 'FRONT':
            case 'BACK':
                naturalW = W;
                naturalH = H;
                break;
            case 'TOP':
            case 'BOTTOM':
                naturalW = W;
                naturalH = D;
                break;
            case 'LEFT':
            case 'RIGHT':
                naturalW = D;
                naturalH = H;
                break;
            case 'ISOMETRIC':
            case 'CUSTOM':
                naturalW = (W + D * 0.6) * 0.95;
                naturalH = (H + D * 0.6) * 0.95;
                break;
        }

        const widthMm = Math.max(20, naturalW * scale);
        const heightMm = Math.max(20, naturalH * scale);

        const pad = 12;
        const vW = naturalW + 2 * pad;
        const vH = naturalH + 2 * pad;

        const lines: string[] = [];
        lines.push(
            `<svg viewBox="-${pad} -${pad} ${vW} ${vH}" width="${widthMm}mm" height="${heightMm}mm" xmlns="http://www.w3.org/2000/svg" style="display:block; overflow:visible;">`
        );

        if (node.type === 'PART') {
            this._drawPartVectors(lines, node, projection, W, H, D);
        } else if (node.type === 'DRAWERS') {
            this._drawDrawersVectors(lines, node, projection, W, H, D);
        } else if (node.type === 'CONTAINER') {
            this._drawContainerVectors(lines, node, projection, W, H, D);
        } else {
            this._drawProjectVectors(lines, node, projection, W, H, D);
        }

        // Renderowanie wymiarów PMI przypisanych do tego rzutu
        if (showPMI) {
            this._drawPMIOverlay(lines, node, projection, W, H, D);
        }

        lines.push('</svg>');
        return { svg: lines.join('\n'), widthMm, heightMm };
    }

    private _drawPartVectors(lines: string[], node: CADTreeNode, proj: ProjectionAngle, W: number, H: number, T: number) {
        if (proj === 'FRONT' || proj === 'BACK') {
            lines.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" stroke="#000000" stroke-width="1.2" rx="0.5"/>`);

            if (node.grooves) {
                for (const g of node.grooves) {
                    lines.push(`<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" fill="#f0f9ff" stroke="#0284c7" stroke-width="0.8" stroke-dasharray="3,2"/>`);
                    lines.push(`<text x="${g.x + g.width / 2}" y="${H / 2}" font-size="7" fill="#0369a1" font-family="'Segoe UI', Arial, sans-serif" text-anchor="middle" transform="rotate(-90, ${g.x + g.width / 2}, ${H / 2})">WPUST ${g.width}×${g.depth}mm</text>`);
                }
            }

            if (node.holes) {
                for (const h of node.holes) {
                    const r = h.diameter / 2;
                    lines.push(`<circle cx="${h.x}" cy="${h.y}" r="${r}" fill="#ecfdf5" stroke="#059669" stroke-width="0.8"/>`);
                    lines.push(`<line x1="${h.x - r - 2}" y1="${h.y}" x2="${h.x + r + 2}" y2="${h.y}" stroke="#10b981" stroke-width="0.35"/>`);
                    lines.push(`<line x1="${h.x}" y1="${h.y - r - 2}" x2="${h.x}" y2="${h.y + r + 2}" stroke="#10b981" stroke-width="0.35"/>`);
                    lines.push(`<text x="${h.x}" y="${h.y - r - 2}" font-size="5" fill="#047857" font-family="'Segoe UI', Arial, sans-serif" font-weight="600" text-anchor="middle">⌀${h.diameter} (${h.depth})</text>`);
                }
            }

            // Wymiary gabarytowe formatki
            lines.push(`<line x1="0" y1="${H + 5}" x2="${W}" y2="${H + 5}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<line x1="0" y1="${H + 2}" x2="0" y2="${H + 7}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<line x1="${W}" y1="${H + 2}" x2="${W}" y2="${H + 7}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<text x="${W / 2}" y="${H + 4.2}" font-size="6" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle">${W}</text>`);

            lines.push(`<line x1="-5" y1="0" x2="-5" y2="${H}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<line x1="-7" y1="0" x2="-2" y2="0" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<line x1="-7" y1="${H}" x2="-2" y2="${H}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<text x="-4" y="${H / 2}" font-size="6" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle" transform="rotate(-90, -4, ${H / 2})">${H}</text>`);
        } else if (proj === 'TOP' || proj === 'BOTTOM') {
            lines.push(`<rect x="0" y="0" width="${W}" height="${T}" fill="#ffffff" stroke="#000000" stroke-width="1.0"/>`);
            lines.push(`<text x="${W / 2}" y="${T / 2 + 1.5}" font-size="6" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle">Grubość ${T} mm</text>`);
        } else if (proj === 'LEFT' || proj === 'RIGHT') {
            lines.push(`<rect x="0" y="0" width="${T}" height="${H}" fill="#ffffff" stroke="#000000" stroke-width="1.0"/>`);
            lines.push(`<text x="${T / 2}" y="${H / 2}" font-size="6" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle" transform="rotate(-90, ${T / 2}, ${H / 2})">${H} × ${T} mm</text>`);
        } else {
            const isoX = T * 0.7;
            const isoY = T * 0.4;
            lines.push(`<polygon points="0,${isoY} ${W},${isoY} ${W + isoX},0 ${isoX},0" fill="#f8fafc" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<polygon points="0,${isoY} ${W},${isoY} ${W},${H + isoY} 0,${H + isoY}" fill="#ffffff" stroke="#000000" stroke-width="1.2"/>`);
            lines.push(`<polygon points="${W},${isoY} ${W + isoX},0 ${W + isoX},${H} ${W},${H + isoY}" fill="#e2e8f0" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<text x="${W / 2}" y="${H / 2 + isoY}" font-size="7" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle">${node.name}</text>`);
        }
    }

    private _drawDrawersVectors(lines: string[], node: CADTreeNode, proj: ProjectionAngle, W: number, H: number, D: number) {
        if (proj === 'FRONT' || proj === 'BACK') {
            lines.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" stroke="#000000" stroke-width="1.2"/>`);
            const h1 = H * 0.22;
            const h2 = H * 0.39;
            const h3 = H * 0.39;

            lines.push(`<rect x="2" y="2" width="${W - 4}" height="${h1 - 4}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<circle cx="${W / 2}" cy="${h1 / 2}" r="2" fill="#000000"/>`);

            lines.push(`<rect x="2" y="${h1 + 2}" width="${W - 4}" height="${h2 - 4}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<circle cx="${W / 2}" cy="${h1 + h2 / 2}" r="2" fill="#000000"/>`);

            lines.push(`<rect x="2" y="${h1 + h2 + 2}" width="${W - 4}" height="${h3 - 4}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<circle cx="${W / 2}" cy="${h1 + h2 + h3 / 2}" r="2" fill="#000000"/>`);
        } else if (proj === 'LEFT' || proj === 'RIGHT') {
            lines.push(`<rect x="0" y="0" width="${D}" height="${H}" fill="#ffffff" stroke="#000000" stroke-width="1.2"/>`);
            lines.push(`<line x1="10" y1="${H * 0.18}" x2="${D - 10}" y2="${H * 0.18}" stroke="#000000" stroke-width="1.0" stroke-dasharray="4,2"/>`);
            lines.push(`<line x1="10" y1="${H * 0.55}" x2="${D - 10}" y2="${H * 0.55}" stroke="#000000" stroke-width="1.0" stroke-dasharray="4,2"/>`);
            lines.push(`<line x1="10" y1="${H * 0.88}" x2="${D - 10}" y2="${H * 0.88}" stroke="#000000" stroke-width="1.0" stroke-dasharray="4,2"/>`);
        } else {
            lines.push(`<rect x="0" y="0" width="${W}" height="${D}" fill="#ffffff" stroke="#000000" stroke-width="1.2"/>`);
            lines.push(`<text x="${W / 2}" y="${D / 2}" font-size="7" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle">${W} × ${D} mm</text>`);
        }
    }

    private _drawContainerVectors(lines: string[], node: CADTreeNode, proj: ProjectionAngle, W: number, H: number, D: number) {
        const T = 18;
        if (proj === 'FRONT' || proj === 'BACK') {
            lines.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" stroke="#000000" stroke-width="1.4"/>`);
            lines.push(`<rect x="0" y="0" width="${T}" height="${H}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<rect x="${W - T}" y="0" width="${T}" height="${H}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<rect x="${T}" y="0" width="${W - 2 * T}" height="${T}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<rect x="${T}" y="${H - T}" width="${W - 2 * T}" height="${T}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);

            // Wymiary gabarytowe szafki
            lines.push(`<line x1="0" y1="${H + 5}" x2="${W}" y2="${H + 5}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<line x1="0" y1="${H + 2}" x2="0" y2="${H + 7}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<line x1="${W}" y1="${H + 2}" x2="${W}" y2="${H + 7}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<text x="${W / 2}" y="${H + 4.2}" font-size="6" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle">${W}</text>`);

            lines.push(`<line x1="-5" y1="0" x2="-5" y2="${H}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<line x1="-7" y1="0" x2="-2" y2="0" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<line x1="-7" y1="${H}" x2="-2" y2="${H}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<text x="-4" y="${H / 2}" font-size="6" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle" transform="rotate(-90, -4, ${H / 2})">${H}</text>`);
        } else if (proj === 'TOP' || proj === 'BOTTOM') {
            lines.push(`<rect x="0" y="0" width="${W}" height="${D}" fill="#ffffff" stroke="#000000" stroke-width="1.2"/>`);
            lines.push(`<rect x="0" y="0" width="${T}" height="${D}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<rect x="${W - T}" y="0" width="${T}" height="${D}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<line x1="0" y1="${D + 5}" x2="${W}" y2="${D + 5}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<text x="${W / 2}" y="${D + 4.2}" font-size="6" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle">${W}</text>`);
            lines.push(`<line x1="-5" y1="0" x2="-5" y2="${D}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<text x="-4" y="${D / 2}" font-size="6" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle" transform="rotate(-90, -4, ${D / 2})">${D}</text>`);
        } else if (proj === 'LEFT' || proj === 'RIGHT') {
            lines.push(`<rect x="0" y="0" width="${D}" height="${H}" fill="#ffffff" stroke="#000000" stroke-width="1.2"/>`);
            lines.push(`<rect x="0" y="0" width="${D}" height="${T}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<rect x="0" y="${H - T}" width="${D}" height="${T}" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<line x1="0" y1="${H + 5}" x2="${D}" y2="${H + 5}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<text x="${D / 2}" y="${H + 4.2}" font-size="6" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle">${D}</text>`);
            lines.push(`<line x1="-5" y1="0" x2="-5" y2="${H}" stroke="#000000" stroke-width="0.4"/>`);
            lines.push(`<text x="-4" y="${H / 2}" font-size="6" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle" transform="rotate(-90, -4, ${H / 2})">${H}</text>`);
        } else {
            const isoX = D * 0.5;
            const isoY = D * 0.3;
            lines.push(`<polygon points="0,${isoY} ${W},${isoY} ${W + isoX},0 ${isoX},0" fill="#f8fafc" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<polygon points="0,${isoY} ${W},${isoY} ${W},${H + isoY} 0,${H + isoY}" fill="#ffffff" stroke="#000000" stroke-width="1.4"/>`);
            lines.push(`<polygon points="${W},${isoY} ${W + isoX},0 ${W + isoX},${H} ${W},${H + isoY}" fill="#e2e8f0" stroke="#000000" stroke-width="0.8"/>`);
            lines.push(`<text x="${W / 2}" y="${H / 2 + isoY}" font-size="7" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle">${node.name}</text>`);
        }
    }

    private _drawProjectVectors(lines: string[], node: CADTreeNode, proj: ProjectionAngle, W: number, H: number, D: number) {
        if (proj === 'TOP' || proj === 'BOTTOM') {
            lines.push(`<rect x="0" y="0" width="${W}" height="${D}" fill="#ffffff" stroke="#000000" stroke-width="1.4"/>`);
            lines.push(`<text x="${W / 2}" y="${D / 2}" font-size="8" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle">${node.name} (${W}×${D} mm)</text>`);
        } else if (proj === 'LEFT' || proj === 'RIGHT') {
            lines.push(`<rect x="0" y="0" width="${D}" height="${H}" fill="#ffffff" stroke="#000000" stroke-width="1.4"/>`);
            lines.push(`<text x="${D / 2}" y="${H / 2}" font-size="8" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle" transform="rotate(-90, ${D / 2}, ${H / 2})">${node.name} (${D}×${H} mm)</text>`);
        } else {
            lines.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" stroke="#000000" stroke-width="1.4"/>`);
            lines.push(`<text x="${W / 2}" y="${H / 2}" font-size="8" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" text-anchor="middle">${node.name} (${W}×${H}×${D} mm)</text>`);
        }
    }

    /**
     * Rzutuje wymiary PMI ze sceny 3D na płaszczyznę widoku w danym kadrze.
     */
    private _drawPMIOverlay(lines: string[], node: CADTreeNode, proj: ProjectionAngle, W: number, H: number, D: number) {
        const pmiList = this.extractPMIDimensions();
        if (pmiList.length === 0) return;

        for (const pmi of pmiList) {
            let px1 = pmi.x1;
            let py1 = pmi.y1;
            let px2 = pmi.x2;
            let py2 = pmi.y2;

            // Przeliczenie współrzędnych 3D na rzut 2D
            if (proj === 'TOP' || proj === 'BOTTOM') {
                py1 = pmi.y1; // Z w 3D
                py2 = pmi.y2;
            } else if (proj === 'LEFT' || proj === 'RIGHT') {
                px1 = pmi.y1;
                px2 = pmi.y2;
            }

            const midX = (px1 + px2) / 2;
            const midY = (py1 + py2) / 2;

            lines.push(`<g class="pmi-dimension-group">`);
            lines.push(`<line x1="${px1.toFixed(1)}" y1="${py1.toFixed(1)}" x2="${px2.toFixed(1)}" y2="${py2.toFixed(1)}" stroke="#2563eb" stroke-width="0.6" stroke-dasharray="2,1"/>`);
            lines.push(`<circle cx="${px1.toFixed(1)}" cy="${py1.toFixed(1)}" r="1.2" fill="#2563eb"/>`);
            lines.push(`<circle cx="${px2.toFixed(1)}" cy="${py2.toFixed(1)}" r="1.2" fill="#2563eb"/>`);
            lines.push(`<rect x="${(midX - 10).toFixed(1)}" y="${(midY - 3).toFixed(1)}" width="20" height="6" fill="#ffffff" stroke="#2563eb" stroke-width="0.3" rx="1"/>`);
            lines.push(`<text x="${midX.toFixed(1)}" y="${(midY + 1.2).toFixed(1)}" font-size="4.5" font-weight="bold" fill="#1e3a8a" font-family="'Segoe UI', Arial, sans-serif" text-anchor="middle">${pmi.text || `${pmi.distanceMM} mm`}</text>`);
            lines.push(`</g>`);
        }
    }
}
