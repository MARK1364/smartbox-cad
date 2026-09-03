/**
 * D1_draw - DrawStudio.tsx
 * Środowisko Rzutowania 2D CAD w standardzie SolidWorks / Creo / Solid Edge:
 * - Bezkresne pole pracy CAD (Infinite Canvas) z pływającym arkuszem papieru ISO,
 * - Zero przesunięcia (100% precyzyjne pokrycie ramki, kliknięć i geometrii formatek),
 * - Rzuty można umieszczać i przesuwać zarówno na arkuszu papieru, jak i poza nim (na pulpicie roboczym),
 * - Narzędzie Rzut Pochodny (Projected View) na żądanie: ciągnięcie w prawo -> bok, w dół -> góra, po skosie -> izometria,
 * - Inteligentny Wymiar CAD (Smart Dimension) i Eksport wydruku 1:1 do PDF/SVG/JPG.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    PaperFormat,
    PAPER_FORMATS,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    MARGIN_TOP,
    MARGIN_BOTTOM,
    TITLE_BLOCK_WIDTH,
    TITLE_BLOCK_HEIGHT,
    TitleBlockInfo,
    Draw2DView,
    Draw2DDimension,
    DrawModelItem,
    DrawProjectionAngle,
} from './draw-types';
import { DrawProjectionEngine, getProjectedAngleFromSource } from './draw-projection';
import { DrawDimensionsEngine } from './draw-dimensions';
import { DrawSheetSVGGenerator } from './draw-sheet-svg';
import { DrawingProjectExtractor, SYNC_CHANNEL_NAME } from '../E3_export/drawing-project-extractor';
import { CADTreeNode } from '../E3_export/drawing-types';
import { loadGeometrySnapshots } from '../E3_export/e3-geometry-snapshot';
import { SceneTree } from '../src/SceneTree';

type ActiveTool = 'select' | 'projected_view' | 'smart_dim';
type ViewAlignment = 'HORIZONTAL' | 'VERTICAL' | 'DIAGONAL';

function getViewSize(v: { widthMm: number; heightMm: number; scale: number }) {
    return { w: v.widthMm * v.scale, h: v.heightMm * v.scale };
}

function getViewCenter(v: { x: number; y: number; widthMm: number; heightMm: number; scale: number }) {
    const { w, h } = getViewSize(v);
    return { x: v.x + w / 2, y: v.y + h / 2 };
}

function collectDescendantIds(views: Draw2DView[], parentId: string): string[] {
    const kids = views.filter((v) => v.parentViewId === parentId);
    return kids.flatMap((k) => [k.id, ...collectDescendantIds(views, k.id)]);
}

function AlignmentCenterline({
    x1,
    y1,
    x2,
    y2,
}: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}) {
    return (
        <g pointerEvents="none">
            <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#3b82f6"
                strokeWidth="0.35"
                strokeDasharray="5,2.5"
                opacity="0.9"
            />
            <circle cx={x1} cy={y1} r="0.9" fill="#2563eb" />
            <circle cx={x2} cy={y2} r="0.9" fill="#2563eb" />
        </g>
    );
}

function cadNodeToDrawItem(node: CADTreeNode): DrawModelItem {
    const type: DrawModelItem['type'] =
        node.type === 'PART' ? 'PART' :
        node.type === 'PROJECT' ? 'PROJECT' :
        node.type === 'ASSEMBLY' ? 'ASSEMBLY' :
        'CONTAINER';
    return {
        id: node.id,
        name: node.name,
        type,
        icon: node.icon || (type === 'PART' ? '🪵' : type === 'PROJECT' ? '📁' : '🗄️'),
        width: node.width || 0,
        height: node.height || 0,
        depth: node.depth || 0,
        thickness: node.thickness,
        material: node.material,
        role: node.role,
        partCount: node.partCount || 1,
        children: node.children?.map(cadNodeToDrawItem),
        rawNode: node,
    };
}

function findDrawItemById(items: DrawModelItem[], id?: string | null): DrawModelItem | undefined {
    if (!id) return undefined;
    for (const item of items) {
        if (item.id === id) return item;
        if (item.children?.length) {
            const nested = findDrawItemById(item.children, id);
            if (nested) return nested;
        }
    }
    return undefined;
}

function findCadNodeById(node: CADTreeNode | null | undefined, id: string): CADTreeNode | null {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children || []) {
        const found = findCadNodeById(child, id);
        if (found) return found;
    }
    return null;
}

function resolveDroppedDrawItem(e: React.DragEvent): { item: DrawModelItem; angle: DrawProjectionAngle } | null {
    const dragged = (window as any).__draggedCadNode;
    let payload: any = dragged;
    if (!payload) {
        const rawCad = e.dataTransfer.getData('application/cad-node');
        if (rawCad) {
            try {
                payload = JSON.parse(rawCad);
            } catch {
                payload = null;
            }
        }
    }

    if (payload) {
        let node: CADTreeNode | null = payload.raw || null;
        if (!node) {
            try {
                const tree = DrawingProjectExtractor.instance.extractProjectTree();
                if (payload.type === 'PROJECT' || payload.id === 'ALL') {
                    node = tree.rootNode;
                } else {
                    node = findCadNodeById(tree.rootNode, payload.id);
                }
            } catch {
                node = null;
            }
        }
        if (node) return { item: cadNodeToDrawItem(node), angle: 'FRONT' };
    }

    const rawJson = e.dataTransfer.getData('application/json');
    if (rawJson) {
        try {
            const data = JSON.parse(rawJson);
            const item: DrawModelItem = data.item || data;
            const angle: DrawProjectionAngle = data.angle || data.defaultAngle || 'FRONT';
            if (item?.id) return { item, angle };
        } catch {
            return null;
        }
    }
    return null;
}

export const DrawStudio: React.FC<{
    initialTargetId?: string;
    initialTreeRoot?: CADTreeNode | null;
}> = ({ initialTargetId, initialTreeRoot }) => {
    // ─── Modele 3D z Projektu ───
    const [projectModels, setProjectModels] = useState<DrawModelItem[]>([]);
    const [activeModel, setActiveModel] = useState<DrawModelItem | null>(null);

    // ─── Narzędzia i Arkusz ───
    const [activeTool, setActiveTool] = useState<ActiveTool>('select');
    const [paperFormat, setPaperFormat] = useState<PaperFormat>('A3_LANDSCAPE');
    const [sheetScale, setSheetScale] = useState<number>(0.1); // Skala 1:10
    const [showDimensions, setShowDimensions] = useState<boolean>(true);

    // ─── Tabelka ISO 7200 ───
    const [titleBlock, setTitleBlock] = useState<TitleBlockInfo>({
        projectName: 'Projekt SmartBox',
        furnitureName: 'Rysunek Wykonawczy CAD',
        author: 'Projektant',
        date: new Date().toISOString().split('T')[0],
        scale: '1:10',
        sheetNumber: '1/1',
        drawingNumber: 'DRW-001',
        remarks: 'Wymiary w mm',
    });

    // ─── Rzuty na Arkuszu (Czysty arkusz na starcie) ───
    const [views, setViews] = useState<Draw2DView[]>([]);
    const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // ─── Tryb Rzutowania Dynamicznego (SolidWorks Projected View) ───
    const [projectionSourceViewId, setProjectionSourceViewId] = useState<string | null>(null);
    const [phantomProjection, setPhantomProjection] = useState<{
        x: number;
        y: number;
        widthMm: number;
        heightMm: number;
        angle: DrawProjectionAngle;
        alignment: ViewAlignment;
        scale: number;
        baseView: { x: number; y: number; widthMm: number; heightMm: number; scale: number };
    } | null>(null);

    // ─── Wymiarowanie Smart Dimension ───
    const [dimDraft, setDimDraft] = useState<{ step: 'pick_p1' | 'pick_p2' | 'place_offset'; p1?: { x: number; y: number } } | null>(null);

    // ─── Zoom / Pan w Bezkresnej Przestrzeni Roboczej ───
    const [zoomLevel, setZoomLevel] = useState<number>(1.2);
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const isPanningRef = useRef<boolean>(false);
    const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerDims, setContainerDims] = useState<{ width: number; height: number }>({ width: 1000, height: 700 });

    // ─── Przesuwanie Rzutu po Arkuszu / Pulpicie ───
    const [dragViewId, setDragViewId] = useState<string | null>(null);
    const dragViewStartPos = useRef<{
        mouseX: number;
        mouseY: number;
        viewX: number;
        viewY: number;
        relatedStarts: Array<{ id: string; x: number; y: number }>;
    } | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Wymiary papieru
    const paperDims = useMemo(() => PAPER_FORMATS[paperFormat] || PAPER_FORMATS['A3_LANDSCAPE'], [paperFormat]);
    const paperW = paperDims.width;
    const paperH = paperDims.height;
    const frameX = MARGIN_LEFT;
    const frameY = MARGIN_TOP;
    const frameW = paperW - MARGIN_LEFT - MARGIN_RIGHT;
    const frameH = paperH - MARGIN_TOP - MARGIN_BOTTOM;

    // Aktualizacja rozmiaru kontenera ekranu
    useEffect(() => {
        const updateDims = () => {
            if (containerRef.current) {
                setContainerDims({
                    width: containerRef.current.clientWidth || 1000,
                    height: containerRef.current.clientHeight || 700,
                });
            }
        };
        updateDims();
        window.addEventListener('resize', updateDims);
        return () => window.removeEventListener('resize', updateDims);
    }, []);

    // ─── Wczytanie Modeli ze Sceny 3D ───
    const refreshModelsFromScene = () => {
        try {
            const tree = initialTreeRoot
                ? { rootNode: initialTreeRoot, containers: [] as any[] }
                : DrawingProjectExtractor.instance.extractProjectTree();
            const items: DrawModelItem[] = [];

            if (tree.rootNode) {
                const mapNode = (node: any): DrawModelItem => ({
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    icon: node.icon || (node.type === 'PROJECT' ? '📁' : node.type === 'PART' ? '🪵' : '🗄️'),
                    width: node.width,
                    height: node.height,
                    depth: node.depth,
                    thickness: node.thickness,
                    material: node.material,
                    role: node.role,
                    partCount: node.partCount || 1,
                    children: node.children ? node.children.map(mapNode) : undefined,
                    rawNode: node,
                });

                if (tree.rootNode.children && tree.rootNode.children.length > 0) {
                    for (const ch of tree.rootNode.children) {
                        items.push(mapNode(ch));
                    }
                } else if (tree.rootNode.type !== 'PROJECT' || tree.containers.length > 0) {
                    items.push(mapNode(tree.rootNode));
                }
            }

            if (items.length === 0 && tree.containers.length > 0) {
                for (const cnt of tree.containers) {
                    items.push({
                        id: cnt.id,
                        name: cnt.name,
                        type: 'CONTAINER',
                        icon: '🗄️',
                        width: cnt.width,
                        height: cnt.height,
                        depth: cnt.depth,
                        partCount: cnt.parts?.length || 1,
                        children: cnt.parts?.map((p) => ({
                            id: p.id,
                            name: p.name,
                            type: 'PART',
                            icon: '🪵',
                            width: p.width,
                            height: p.height,
                            depth: p.thickness || 18,
                            thickness: p.thickness || 18,
                            material: p.material,
                            role: p.role,
                            partCount: 1,
                        })),
                    });
                }
            }

            const snaps = loadGeometrySnapshots();
            if (Object.keys(snaps).length > 0) {
                for (const snapId of Object.keys(snaps)) {
                    const snap = snaps[snapId];
                    if (!items.some((it) => it.id === snap.id)) {
                        items.push({
                            id: snap.id,
                            name: snap.name || 'Korpus 3D',
                            type: snap.type === 'PANEL' ? 'PART' : 'CONTAINER',
                            icon: snap.type === 'PANEL' ? '🪵' : '🗄️',
                            width: snap.width,
                            height: snap.height,
                            depth: snap.depth,
                            partCount: snap.parts.length,
                            children: snap.parts.map((p) => ({
                                id: p.id,
                                name: p.name,
                                type: 'PART',
                                icon: '🪵',
                                width: p.width,
                                height: p.height,
                                depth: p.thickness,
                                thickness: p.thickness,
                                partCount: 1,
                            })),
                        });
                    }
                }
            }

            setProjectModels(items);
            if (items.length > 0) {
                const targeted = initialTargetId
                    ? findDrawItemById(items, initialTargetId)
                    : null;
                setActiveModel(targeted || items[0]);
            }
            showToast('Zsynchronizowano drzewo modeli ze sceny 3D!');
            window.document.dispatchEvent(new Event('smartbox-project-changed'));
        } catch (e) {
            console.warn('Błąd odczytu modeli:', e);
        }
    };

    useEffect(() => {
        refreshModelsFromScene();

        let channel: BroadcastChannel | null = null;
        if (typeof BroadcastChannel !== 'undefined') {
            channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
            channel.onmessage = (e) => {
                if (e.data?.type === 'SCENE_UPDATED') {
                    refreshModelsFromScene();
                }
            };
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' && selectedViewId) {
                removeView(selectedViewId);
            }
            if (e.key === 'Escape') {
                setActiveTool('select');
                setProjectionSourceViewId(null);
                setPhantomProjection(null);
                setDimDraft(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            if (channel) channel.close();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedViewId]);

    // ─── 100% Precyzyjne Przeliczenie Współrzędnych Ekran -> Przestrzeń Robocza (mm) ───
    const getSheetCoordinates = useCallback((e: React.MouseEvent | React.DragEvent): { x: number; y: number } => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Odwrócenie: (mouse - center - pan) / zoom + paperCenter
        const worldX = (mouseX - centerX - panOffset.x) / zoomLevel + (paperW / 2);
        const worldY = (mouseY - centerY - panOffset.y) / zoomLevel + (paperH / 2);

        return { x: worldX, y: worldY };
    }, [panOffset, zoomLevel, paperW, paperH]);

    // ─── Wstawianie Widoku Bazowego (Model View) ───
    const placeBaseView = (item: DrawModelItem, sheetX: number = 50, sheetY: number = 40, angle: DrawProjectionAngle = 'FRONT') => {
        const cabinet = DrawProjectionEngine.modelItemToProjectable(item);
        const newView = DrawProjectionEngine.generateSingleView(cabinet, angle, sheetScale, sheetX, sheetY);

        setViews((prev) => [...prev, newView]);
        setSelectedViewId(newView.id);
        setTitleBlock((prev) => ({ ...prev, furnitureName: item.name }));
        setActiveTool('select');
        showToast(`Wstawiono widok bazowy [${angle}] dla: ${item.name}`);
    };

    // ─── Uruchomienie Trybu Rzutowania (Na Żądanie) ───
    const startProjectedViewMode = (viewId?: string) => {
        const targetId = viewId || selectedViewId || (views.length > 0 ? views[views.length - 1].id : null);
        if (targetId) {
            setProjectionSourceViewId(targetId);
            setSelectedViewId(targetId);
            setActiveTool('projected_view');
            showToast('Narzędzie Rzut Pochodny: Przesuń kursor w prawo (bok), w dół (góra) lub po skosie (izometria). Kliknij, aby wstawić!');
        } else {
            setActiveTool('projected_view');
            setProjectionSourceViewId(null);
            showToast('Wskaż kliknięciem widok bazowy na arkuszu, z którego chcesz wyciągnąć rzut.');
        }
    };

    // ─── Pozycja rzutu pochodnego: oś środka jak w SolidWorks / Inventor ───
    const calculateProjectedViewPlacement = (
        baseView: Draw2DView,
        cursorX: number,
        cursorY: number
    ): { x: number; y: number; widthMm: number; heightMm: number; angle: DrawProjectionAngle; alignment: ViewAlignment } => {
        const scale = baseView.scale;
        const { w: bw, h: bh } = getViewSize(baseView);
        const bCenter = getViewCenter(baseView);

        const deltaX = cursorX - bCenter.x;
        const deltaY = cursorY - bCenter.y;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        const model = findDrawItemById(projectModels, baseView.sourceNodeId);
        const depth = model?.depth || 560;
        const width = model?.width || 800;
        const height = model?.height || 720;
        const minGap = 12;

        const sizeForAngle = (angle: DrawProjectionAngle) => {
            const isIso = angle === 'ISO';
            const targetW = isIso ? width * 1.2 : (angle === 'RIGHT' || angle === 'LEFT') ? depth : width;
            const targetH = isIso ? height * 1.2 : (angle === 'TOP' || angle === 'BOTTOM') ? depth : height;
            return { targetW, targetH };
        };

        const placeOnAxis = (
            angle: DrawProjectionAngle,
            alignment: ViewAlignment,
            axis: 'H' | 'V' | 'D',
            dir: 1 | -1
        ) => {
            const { targetW, targetH } = sizeForAngle(angle);
            const dw = targetW * scale;
            const dh = targetH * scale;

            if (axis === 'D') {
                return {
                    x: cursorX - dw / 2,
                    y: cursorY - dh / 2,
                    widthMm: targetW,
                    heightMm: targetH,
                    angle,
                    alignment,
                };
            }

            if (axis === 'H') {
                const minCenter = bw / 2 + dw / 2 + minGap;
                const cx = dir > 0
                    ? Math.max(bCenter.x + minCenter, cursorX)
                    : Math.min(bCenter.x - minCenter, cursorX);
                return {
                    x: cx - dw / 2,
                    y: bCenter.y - dh / 2,
                    widthMm: targetW,
                    heightMm: targetH,
                    angle,
                    alignment,
                };
            }

            const minCenter = bh / 2 + dh / 2 + minGap;
            const cy = dir > 0
                ? Math.max(bCenter.y + minCenter, cursorY)
                : Math.min(bCenter.y - minCenter, cursorY);
            return {
                x: bCenter.x - dw / 2,
                y: cy - dh / 2,
                widthMm: targetW,
                heightMm: targetH,
                angle,
                alignment,
            };
        };

        if (absX > 35 && absY > 35) {
            return placeOnAxis(getProjectedAngleFromSource(baseView.projection, 'DIAGONAL'), 'DIAGONAL', 'D', 1);
        }

        if (absX >= absY) {
            if (deltaX > 0) {
                return placeOnAxis(getProjectedAngleFromSource(baseView.projection, 'RIGHT'), 'HORIZONTAL', 'H', 1);
            }
            return placeOnAxis(getProjectedAngleFromSource(baseView.projection, 'LEFT'), 'HORIZONTAL', 'H', -1);
        }

        if (deltaY > 0) {
            return placeOnAxis(getProjectedAngleFromSource(baseView.projection, 'DOWN'), 'VERTICAL', 'V', 1);
        }
        return placeOnAxis(getProjectedAngleFromSource(baseView.projection, 'UP'), 'VERTICAL', 'V', -1);
    };

    // ─── Wstawienie Rzutu Pochodnego ───
    const commitProjectedView = () => {
        if (!phantomProjection || !projectionSourceViewId) return;

        const baseView = views.find((v) => v.id === projectionSourceViewId);
        if (!baseView) return;

        const model = findDrawItemById(projectModels, baseView.sourceNodeId) || {
            id: baseView.sourceNodeId || 'model',
            name: baseView.sourceNodeName || 'Model',
            type: 'CONTAINER' as const,
            icon: '🗄️',
            width: baseView.widthMm,
            height: baseView.heightMm,
            depth: 560,
            partCount: 1,
        };

        const cabinet = DrawProjectionEngine.modelItemToProjectable(model);
        const generated = DrawProjectionEngine.generateSingleView(
            cabinet,
            phantomProjection.angle,
            baseView.scale,
            phantomProjection.x,
            phantomProjection.y
        );

        const { w: cw, h: ch } = getViewSize(generated);
        const phantomCenter = {
            x: phantomProjection.x + (phantomProjection.widthMm * phantomProjection.scale) / 2,
            y: phantomProjection.y + (phantomProjection.heightMm * phantomProjection.scale) / 2,
        };
        const parentCenter = getViewCenter(baseView);
        let x = phantomCenter.x - cw / 2;
        let y = phantomCenter.y - ch / 2;
        if (phantomProjection.alignment === 'HORIZONTAL') {
            y = parentCenter.y - ch / 2;
        } else if (phantomProjection.alignment === 'VERTICAL') {
            x = parentCenter.x - cw / 2;
        }

        const newView: Draw2DView = {
            ...generated,
            x,
            y,
            parentViewId: baseView.id,
            alignment: phantomProjection.alignment,
        };

        setViews((prev) => [...prev, newView]);
        setSelectedViewId(newView.id);
        setPhantomProjection(null);
        // Po wstawieniu, nowy rzut staje się źródłem dla kolejnych rzutów (łańcuch rzutowania jak w SolidWorks)!
        setProjectionSourceViewId(newView.id);
        showToast(`Wstawiono [${phantomProjection.angle}] z rzutu [${baseView.projection}]. Ciągnij dalej lub naciśnij Esc!`);
    };

    const removeView = (id: string) => {
        setViews((prev) => prev.filter((v) => v.id !== id));
        if (selectedViewId === id) setSelectedViewId(null);
        if (projectionSourceViewId === id) setProjectionSourceViewId(null);
        showToast('Usunięto rzut');
    };

    // ─── Drag & Drop Modeli na Płótno ───
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDropOnSheet = (e: React.DragEvent) => {
        e.preventDefault();
        try {
            const dropped = resolveDroppedDrawItem(e);
            if (dropped) {
                const coords = getSheetCoordinates(e);
                setActiveModel(dropped.item);
                placeBaseView(dropped.item, coords.x - 20, coords.y - 20, dropped.angle);
            }
        } catch (err) {
            console.error('Błąd dropowania na arkusz:', err);
        }
    };

    // ─── Interakcje Myszą na Płótnie ───
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            // Panowanie
            isPanningRef.current = true;
            panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
            return;
        }

        if (e.button === 2) {
            // Prawoklik = Anuluj
            setActiveTool('select');
            setProjectionSourceViewId(null);
            setPhantomProjection(null);
            setDimDraft(null);
            return;
        }

        if (activeTool === 'projected_view' && e.button === 0) {
            const coords = getSheetCoordinates(e);
            const clickedView = views.slice().reverse().find((v) => {
                const pad = 4;
                const vw = v.widthMm * v.scale;
                const vh = v.heightMm * v.scale;
                return coords.x >= v.x - pad && coords.x <= v.x + vw + pad && coords.y >= v.y - pad && coords.y <= v.y + vh + pad;
            });

            if (clickedView && (!projectionSourceViewId || clickedView.id !== projectionSourceViewId)) {
                setProjectionSourceViewId(clickedView.id);
                setSelectedViewId(clickedView.id);
                showToast(`Wybrano rzut bazowy: ${clickedView.title}. Przesuń kursor w bok/dół/skos aby rzutować!`);
                return;
            }

            if (phantomProjection && projectionSourceViewId) {
                commitProjectedView();
            }
            return;
        }

        if (activeTool === 'select' && e.button === 0) {
            const coords = getSheetCoordinates(e);
            const clickedView = views.slice().reverse().find((v) => {
                const pad = 6;
                const vw = v.widthMm * v.scale;
                const vh = v.heightMm * v.scale;
                return coords.x >= v.x - pad && coords.x <= v.x + vw + pad && coords.y >= v.y - pad && coords.y <= v.y + vh + pad;
            });

            if (clickedView) {
                setSelectedViewId(clickedView.id);
                setDragViewId(clickedView.id);
                const descendantIds = collectDescendantIds(views, clickedView.id);
                dragViewStartPos.current = {
                    mouseX: e.clientX,
                    mouseY: e.clientY,
                    viewX: clickedView.x,
                    viewY: clickedView.y,
                    relatedStarts: views
                        .filter((v) => descendantIds.includes(v.id))
                        .map((v) => ({ id: v.id, x: v.x, y: v.y })),
                };
            } else {
                setSelectedViewId(null);
                isPanningRef.current = true;
                panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
            }
        } else if (activeTool === 'smart_dim' && e.button === 0) {
            const coords = getSheetCoordinates(e);
            if (!dimDraft) {
                setDimDraft({ step: 'pick_p2', p1: coords });
                showToast('Wskaż drugi punkt (P2)');
            } else if (dimDraft.step === 'pick_p2' && dimDraft.p1) {
                const targetView = views.find((v) => v.id === selectedViewId) || views[0];
                if (targetView) {
                    const scale = targetView.scale;
                    const p1LocalX = (dimDraft.p1.x - targetView.x) / scale;
                    const p1LocalY = (dimDraft.p1.y - targetView.y) / scale;
                    const p2LocalX = (coords.x - targetView.x) / scale;
                    const p2LocalY = (coords.y - targetView.y) / scale;

                    const dx = Math.abs(coords.x - dimDraft.p1.x);
                    const dy = Math.abs(coords.y - dimDraft.p1.y);
                    const isHorizontal = dx >= dy;
                    const distMm = isHorizontal ? Math.abs(p2LocalX - p1LocalX) : Math.abs(p2LocalY - p1LocalY);

                    const newDim: Draw2DDimension = {
                        id: `dim_${Date.now()}`,
                        x1: p1LocalX,
                        y1: p1LocalY,
                        x2: p2LocalX,
                        y2: p2LocalY,
                        valueMm: Math.round(distMm),
                        text: `${Math.round(distMm)}`,
                        offsetMm: isHorizontal ? 12 : -12,
                        orientation: isHorizontal ? 'HORIZONTAL' : 'VERTICAL',
                    };

                    setViews((prev) => prev.map((v) => (v.id === targetView.id ? { ...v, dimensions: [...v.dimensions, newDim] } : v)));
                    showToast(`Wstawiono wymiar: ${Math.round(distMm)} mm`);
                }
                setDimDraft(null);
                setActiveTool('select');
            }
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanningRef.current) {
            setPanOffset({
                x: e.clientX - panStartRef.current.x,
                y: e.clientY - panStartRef.current.y,
            });
            return;
        }

        // 1. Rzutowanie Dynamiczne na Żywo
        if (activeTool === 'projected_view' && projectionSourceViewId) {
            const baseView = views.find((v) => v.id === projectionSourceViewId);
            if (baseView) {
                const coords = getSheetCoordinates(e);
                const projectedPlacement = calculateProjectedViewPlacement(baseView, coords.x, coords.y);
                setPhantomProjection({
                    ...projectedPlacement,
                    scale: baseView.scale,
                    baseView: {
                        x: baseView.x,
                        y: baseView.y,
                        widthMm: baseView.widthMm,
                        heightMm: baseView.heightMm,
                        scale: baseView.scale,
                    },
                });
            }
            return;
        }

        // 2. Przesuwanie Rzutu po Arkuszu / Pulpicie
        // Pozycję startową bierzemy z lokalnej kopii — updater setViews może
        // się wykonać po mouseup / remoncie Strict Mode, gdy ref jest już null.
        const dragStart = dragViewStartPos.current;
        if (dragViewId && dragStart) {
            const deltaX = (e.clientX - dragStart.mouseX) / zoomLevel;
            const deltaY = (e.clientY - dragStart.mouseY) / zoomLevel;
            const startViewX = dragStart.viewX;
            const startViewY = dragStart.viewY;
            const relatedStarts = dragStart.relatedStarts;

            setViews((prev) => {
                const dragged = prev.find((v) => v.id === dragViewId);
                const parent = dragged?.parentViewId ? prev.find((v) => v.id === dragged.parentViewId) : undefined;

                return prev.map((v) => {
                    if (v.id === dragViewId) {
                        let nx = startViewX + deltaX;
                        let ny = startViewY + deltaY;
                        if (parent && v.alignment === 'HORIZONTAL') {
                            const pcy = getViewCenter(parent).y;
                            ny = pcy - getViewSize(v).h / 2;
                        } else if (parent && v.alignment === 'VERTICAL') {
                            const pcx = getViewCenter(parent).x;
                            nx = pcx - getViewSize(v).w / 2;
                        }
                        return { ...v, x: Math.round(nx), y: Math.round(ny) };
                    }
                    const rel = relatedStarts.find((r) => r.id === v.id);
                    if (rel) {
                        return { ...v, x: Math.round(rel.x + deltaX), y: Math.round(rel.y + deltaY) };
                    }
                    return v;
                });
            });
        }
    };

    const handleCanvasMouseUp = () => {
        isPanningRef.current = false;
        setDragViewId(null);
        dragViewStartPos.current = null;
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        setZoomLevel((prev) => Math.min(5.0, Math.max(0.15, prev * factor)));
    };

    const selectedView = views.find((v) => v.id === selectedViewId);

    // Generator do eksportu / druku
    const svgExportGenerator = useMemo(() => {
        const gen = new DrawSheetSVGGenerator(paperFormat);
        gen.titleBlock = titleBlock;
        gen.views = views;
        gen.selectedViewId = null;
        gen.phantomView = null;
        gen.showBOM = false;
        gen.showDimensions = showDimensions;
        return gen;
    }, [paperFormat, titleBlock, views, showDimensions]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', backgroundColor: '#070a13', color: '#f8fafc', fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
            {/* Powiadomienie Toast */}
            {toastMessage && (
                <div style={{ position: 'fixed', top: '56px', right: '20px', backgroundColor: 'rgba(37, 99, 235, 0.95)', color: '#fff', padding: '8px 16px', borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 1000, fontSize: '12px', fontWeight: 600 }}>
                    {toastMessage}
                </div>
            )}

            {/* ─── Pasek Narzędzi CAD (SolidWorks Ribbon) ─── */}
            <div style={{ height: '50px', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 900, background: 'linear-gradient(135deg, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        📐 SolidDraw 2D
                    </span>

                    <div style={{ width: '1px', height: '22px', background: '#334155' }}></div>

                    {/* Przyciski Rzutowania i Wymiarowania */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            onClick={() => {
                                setActiveTool('select');
                                setProjectionSourceViewId(null);
                                setPhantomProjection(null);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: activeTool === 'select' ? '#2563eb' : '#1e293b',
                                color: '#fff',
                                border: '1px solid #334155',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                            title="Zaznaczaj i przesuwaj rzuty myszą w bezkresnej przestrzeni roboczej"
                        >
                            👆 Zaznacz / Przesuń
                        </button>

                        <button
                            onClick={() => startProjectedViewMode()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: activeTool === 'projected_view' ? '#2563eb' : '#1e293b',
                                color: '#fff',
                                border: '1px solid #334155',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                            title="Rzut Pochodny (Projected View) — ciągnij w prawo (bok), w dół (góra), po skosie (izometria)"
                        >
                            🔀 Rzut Pochodny (Przeciągnij)
                        </button>

                        <button
                            onClick={() => {
                                setActiveTool('smart_dim');
                                setDimDraft({ step: 'pick_p1' });
                                showToast('Wskaż punkty dla wymiaru');
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: activeTool === 'smart_dim' ? '#2563eb' : '#1e293b',
                                color: '#fff',
                                border: '1px solid #334155',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                            title="Inteligentny Wymiar CAD"
                        >
                            📏 Wymiar CAD
                        </button>

                        {selectedViewId && (
                            <button
                                onClick={() => removeView(selectedViewId)}
                                style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                title="Usuń zaznaczony rzut (Delete)"
                            >
                                ✕ Usuń rzut
                            </button>
                        )}
                    </div>
                </div>

                {/* Arkusz & Eksport */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
                        <span>Format wydruku:</span>
                        <select
                            value={paperFormat}
                            onChange={(e) => setPaperFormat(e.target.value as PaperFormat)}
                            style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                        >
                            {(Object.keys(PAPER_FORMATS) as PaperFormat[]).map((fmt) => (
                                <option key={fmt} value={fmt}>{PAPER_FORMATS[fmt].label}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
                        <span>Skala:</span>
                        <select
                            value={sheetScale}
                            onChange={(e) => setSheetScale(parseFloat(e.target.value))}
                            style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                        >
                            <option value={0.2}>1:5</option>
                            <option value={0.1}>1:10</option>
                            <option value={0.05}>1:20</option>
                        </select>
                    </div>

                    <button onClick={() => svgExportGenerator.printSheet()} style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>🖨️ Drukuj / PDF</button>
                    <button onClick={() => svgExportGenerator.downloadSvg()} style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>⚡ SVG</button>
                    <button onClick={() => svgExportGenerator.downloadJpg()} style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>🖼️ JPG</button>
                </div>
            </div>

            {/* ─── Główny Obszar Roboczy ─── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* ─── Drzewo obiektów ─── */}
                <div
                    id="drzewo-obiektow"
                    aria-label="Drzewo obiektów"
                    style={{
                        width: '320px',
                        backgroundColor: '#111827',
                        borderRight: '1px solid #1f2937',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0,
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <h2 style={{ fontSize: '0.95rem', margin: 0, color: '#e2e8f0', fontWeight: 600 }}>
                            Drzewo obiektów
                        </h2>
                        <button
                            onClick={refreshModelsFromScene}
                            style={{
                                background: 'rgba(37,99,235,0.2)',
                                color: '#93c5fd',
                                border: '1px solid #3b82f6',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                cursor: 'pointer',
                            }}
                            title="Odśwież drzewo ze sceny 3D"
                        >
                            🔄 Odśwież
                        </button>
                    </div>
                    <div style={{ padding: '6px 12px 0', fontSize: '10px', color: '#64748b', lineHeight: 1.4 }}>
                        Przeciągnij korpus lub formatkę na arkusz, aby wstawić widok bazowy.
                    </div>
                    <div style={{ flex: 1, padding: '6px', overflowY: 'auto', minHeight: 0 }}>
                        <SceneTree
                            mode="draw"
                            onSelectNode={(node) => setActiveModel(cadNodeToDrawItem(node))}
                        />
                    </div>

                    {activeModel && (
                        <div style={{ padding: '10px', borderTop: '1px solid #1e293b' }}>
                            <button
                                onClick={() => placeBaseView(activeModel, 40, 30, 'FRONT')}
                                style={{
                                    width: '100%',
                                    background: '#2563eb',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                }}
                            >
                                ➕ Wstaw Widok Bazowy (Przód)
                            </button>
                        </div>
                    )}
                </div>

                {/* ─── Bezkresne Płótno CAD (Infinite Workspace + Floating Sheet) ─── */}
                <div
                    ref={containerRef}
                    onWheel={handleWheel}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onDragOver={handleDragOver}
                    onDrop={handleDropOnSheet}
                    style={{
                        flex: 1,
                        backgroundColor: '#070a13',
                        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: activeTool === 'projected_view' ? 'crosshair' : activeTool === 'smart_dim' ? 'crosshair' : isPanningRef.current ? 'grabbing' : 'default',
                    }}
                >
                    {/* Wskaźnik Rzutowania */}
                    {activeTool === 'projected_view' && (
                        <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, background: 'rgba(37, 99, 235, 0.95)', color: '#fff', padding: '8px 14px', borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>🔀 <strong>Przeciągaj kursor</strong> od rzutu bazowego: w prawo (bok), w dół (góra), po skosie (izometria). Kliknij aby wstawić.</span>
                            <button onClick={() => { setActiveTool('select'); setProjectionSourceViewId(null); setPhantomProjection(null); }} style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '3px 8px', borderRadius: '3px', fontSize: '10px', cursor: 'pointer' }}>Zakończ (Esc)</button>
                        </div>
                    )}

                    {/* Przyciski Zoom & Reset */}
                    <div style={{ position: 'absolute', bottom: '16px', right: '16px', display: 'flex', gap: '6px', zIndex: 10, background: 'rgba(15, 23, 42, 0.85)', padding: '4px 6px', borderRadius: '6px', border: '1px solid #334155' }}>
                        <button onClick={() => setZoomLevel((z) => Math.min(5.0, z * 1.2))} style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '4px 8px', borderRadius: '3px', fontSize: '11px', cursor: 'pointer' }}>➕</button>
                        <button onClick={() => setZoomLevel((z) => Math.max(0.15, z / 1.2))} style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '4px 8px', borderRadius: '3px', fontSize: '11px', cursor: 'pointer' }}>➖</button>
                        <button onClick={() => { setZoomLevel(1.2); setPanOffset({ x: 0, y: 0 }); }} style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '4px 8px', borderRadius: '3px', fontSize: '11px', cursor: 'pointer' }}>🎯 Reset</button>
                    </div>

                    {/* Główny SVG w bezkresnej przestrzeni roboczej */}
                    <svg
                        style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none' }}
                    >
                        {/* Grupa z transformacją Pan & Zoom */}
                        <g transform={`translate(${containerDims.width / 2 + panOffset.x}, ${containerDims.height / 2 + panOffset.y}) scale(${zoomLevel}) translate(${-paperW / 2}, ${-paperH / 2})`}>
                            {/* ─── 1. Pływający Arkusz Papieru (Biała formatka ISO) ─── */}
                            <rect
                                x="0"
                                y="0"
                                width={paperW}
                                height={paperH}
                                fill="#ffffff"
                                stroke="#334155"
                                strokeWidth="0.4"
                                style={{ filter: 'drop-shadow(0 15px 35px rgba(0,0,0,0.6))' }}
                            />

                            {/* Ramka ISO podwójna */}
                            <rect x={frameX} y={frameY} width={frameW} height={frameH} fill="none" stroke="#000000" strokeWidth="0.7" />
                            <rect x={frameX + 1.0} y={frameY + 1.0} width={frameW - 2.0} height={frameH - 2.0} fill="none" stroke="#000000" strokeWidth="0.25" />

                            {/* Tabelka ISO 7200 */}
                            <g transform={`translate(${frameX + frameW - TITLE_BLOCK_WIDTH}, ${frameY + frameH - TITLE_BLOCK_HEIGHT})`}>
                                <rect x="0" y="0" width={TITLE_BLOCK_WIDTH} height={TITLE_BLOCK_HEIGHT} fill="#ffffff" stroke="#000000" strokeWidth="0.7" />
                                <line x1="0" y1="12" x2={TITLE_BLOCK_WIDTH} y2="12" stroke="#000" strokeWidth="0.35" />
                                <line x1="0" y1="21" x2={TITLE_BLOCK_WIDTH} y2="21" stroke="#000" strokeWidth="0.35" />
                                <line x1="80" y1="0" x2="80" y2="21" stroke="#000" strokeWidth="0.35" />

                                <text x="2" y="3.5" fontSize="1.5" fill="#666">Nazwa projektu / mebla</text>
                                <text x="2" y="8.5" fontSize="3.2" fontWeight="bold" fill="#000">{titleBlock.furnitureName || 'Mebel 3D'}</text>
                                <text x="82" y="3.5" fontSize="1.5" fill="#666">Nr rysunku</text>
                                <text x="82" y="8.5" fontSize="3.0" fontWeight="bold" fill="#000">{titleBlock.drawingNumber}</text>

                                <text x="2" y="14.5" fontSize="1.2" fill="#666">Wykonał</text>
                                <text x="2" y="18.5" fontSize="2.2" fill="#000">{titleBlock.author}</text>
                                <text x="82" y="14.5" fontSize="1.2" fill="#666">Data</text>
                                <text x="82" y="18.5" fontSize="2.2" fill="#000">{titleBlock.date}</text>
                            </g>

                            {/* ─── 2. Wszystkie Rzuty 2D w Przestrzeni (na arkuszu i poza nim) ─── */}
                            {views.map((view) => {
                                const isSelected = selectedViewId === view.id;
                                const scale = view.scale;
                                const vx = view.x;
                                const vy = view.y;
                                const vw = view.widthMm * scale;
                                const vh = view.heightMm * scale;

                                return (
                                    <g key={view.id} id={`view_group_${view.id}`}>
                                        {/* Ramka zaznaczenia wokół rzutu */}
                                        {isSelected && (
                                            <rect
                                                x={vx - 2}
                                                y={vy - 8}
                                                width={vw + 4}
                                                height={vh + 10}
                                                fill="rgba(59, 130, 246, 0.05)"
                                                stroke="#3b82f6"
                                                strokeWidth="0.35"
                                                strokeDasharray="3,2"
                                                rx="1"
                                            />
                                        )}

                                        {/* Tytuł i skala rzutu */}
                                        <text x={vx} y={vy - 5} fontSize="3.2" fontWeight="bold" fill="#0f172a">
                                            {view.title}
                                        </text>
                                        <text x={vx} y={vy - 1.5} fontSize="2.0" fill="#64748b">
                                            Skala {view.scaleText}
                                        </text>

                                        {/* Krawędzie i ściany wygenerowane przez automatyczny silnik HLR */}
                                        {view.segments && view.segments.length > 0 ? (
                                            <g>
                                                {/* Tło pod rzutem */}
                                                <rect
                                                    x={vx}
                                                    y={vy}
                                                    width={vw}
                                                    height={vh}
                                                    fill="#ffffff"
                                                    stroke="none"
                                                />
                                                {view.segments
                                                    .slice()
                                                    .sort((a, b) => (a.isHidden === b.isHidden ? 0 : a.isHidden ? -1 : 1))
                                                    .map((seg, idx) => (
                                                    <line
                                                        key={seg.id || idx}
                                                        x1={vx + seg.x1 * scale}
                                                        y1={vy + seg.y1 * scale}
                                                        x2={vx + seg.x2 * scale}
                                                        y2={vy + seg.y2 * scale}
                                                        stroke={seg.strokeColor || (seg.isHidden ? '#64748b' : '#0f172a')}
                                                        strokeWidth={seg.strokeWidth || (seg.isHidden ? 0.35 : 0.5)}
                                                        strokeDasharray={seg.dashArray || (seg.isHidden ? '2,1.5' : undefined)}
                                                    />
                                                ))}
                                            </g>
                                        ) : (
                                            /* Fallback: Prostokąty formatek */
                                            view.rects.map((rect, idx) => (
                                                <g key={rect.id || idx}>
                                                    <rect
                                                        x={vx + rect.x * scale}
                                                        y={vy + rect.y * scale}
                                                        width={rect.width * scale}
                                                        height={rect.height * scale}
                                                        fill={rect.fillColor || '#f8fafc'}
                                                        stroke={rect.strokeColor || '#0f172a'}
                                                        strokeWidth={rect.isBack ? 0.35 : 0.5}
                                                        strokeDasharray={rect.dashArray}
                                                    />
                                                </g>
                                            ))
                                        )}

                                        {/* Wielokąty izometrii — tylko gdy brak krawędzi HLR (inaczej drugi, przesunięty rysunek) */}
                                        {!(view.segments && view.segments.length > 0) && view.polygons && view.polygons.length > 0 && view.polygons.map((poly, idx) => (
                                            <polygon
                                                key={poly.id || idx}
                                                points={poly.points.map((p) => `${(vx + p.x * scale).toFixed(2)},${(vy + p.y * scale).toFixed(2)}`).join(' ')}
                                                fill={poly.fillColor || '#e2e8f0'}
                                                stroke={poly.strokeColor || '#334155'}
                                                strokeWidth={poly.strokeWidth || 0.35}
                                            />
                                        ))}

                                        {/* Strzałki wyciągania rzutu (SolidWorks Projection Handles) */}
                                        {isSelected && (
                                            <g style={{ cursor: 'pointer' }}>
                                                {/* Prawa strzałka (Bok) */}
                                                <g
                                                    onClick={(e) => { e.stopPropagation(); startProjectedViewMode(view.id); }}
                                                    transform={`translate(${vx + vw + 4}, ${vy + vh / 2})`}
                                                >
                                                    <circle r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="0.5" />
                                                    <text fontSize="2.8" fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">▶</text>
                                                </g>

                                                {/* Lewa strzałka */}
                                                <g
                                                    onClick={(e) => { e.stopPropagation(); startProjectedViewMode(view.id); }}
                                                    transform={`translate(${vx - 6}, ${vy + vh / 2})`}
                                                >
                                                    <circle r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="0.5" />
                                                    <text fontSize="2.8" fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">◀</text>
                                                </g>

                                                {/* Dolna strzałka (Góra/Dół) */}
                                                <g
                                                    onClick={(e) => { e.stopPropagation(); startProjectedViewMode(view.id); }}
                                                    transform={`translate(${vx + vw / 2}, ${vy + vh + 6})`}
                                                >
                                                    <circle r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="0.5" />
                                                    <text fontSize="2.8" fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">▼</text>
                                                </g>

                                                {/* Górna strzałka */}
                                                <g
                                                    onClick={(e) => { e.stopPropagation(); startProjectedViewMode(view.id); }}
                                                    transform={`translate(${vx + vw / 2}, ${vy - 11})`}
                                                >
                                                    <circle r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="0.5" />
                                                    <text fontSize="2.8" fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">▲</text>
                                                </g>

                                                {/* Strzałka narożna (Izometria) */}
                                                <g
                                                    onClick={(e) => { e.stopPropagation(); startProjectedViewMode(view.id); }}
                                                    transform={`translate(${vx + vw + 4}, ${vy - 8})`}
                                                >
                                                    <circle r="3.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="0.5" />
                                                    <text fontSize="2.8" fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">↗</text>
                                                </g>
                                            </g>
                                        )}

                                        {/* Wymiary CAD */}
                                        {showDimensions && view.dimensions && view.dimensions.map((dim) => (
                                            <g
                                                key={dim.id}
                                                dangerouslySetInnerHTML={{
                                                    __html: DrawDimensionsEngine.renderDimensionSVG(dim, vx, vy, scale),
                                                }}
                                            />
                                        ))}
                                    </g>
                                );
                            })}

                            {/* Osie środka między rzutem rodzica a pochodnymi (tworzenie i edycja) */}
                            {views.map((view) => {
                                if (!view.parentViewId) return null;
                                const parent = views.find((p) => p.id === view.parentViewId);
                                if (!parent) return null;
                                const isLinked =
                                    selectedViewId === view.id ||
                                    selectedViewId === parent.id ||
                                    dragViewId === view.id ||
                                    dragViewId === parent.id;
                                if (!isLinked) return null;
                                const a = getViewCenter(parent);
                                const b = getViewCenter(view);
                                return <AlignmentCenterline key={`axis_${view.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
                            })}

                            {/* ─── 3. Rzutowanie Dynamiczne na Żywo (Phantom Projected View) ─── */}
                            {phantomProjection && (
                                <g>
                                    {/* Promienie rzutowania powiązane z widokiem bazowym */}
                                    {(() => {
                                        const bv = phantomProjection.baseView;
                                        const bCenter = getViewCenter(bv);
                                        const pw = phantomProjection.widthMm * phantomProjection.scale;
                                        const ph = phantomProjection.heightMm * phantomProjection.scale;
                                        const pCenter = {
                                            x: phantomProjection.x + pw / 2,
                                            y: phantomProjection.y + ph / 2,
                                        };
                                        return (
                                            <AlignmentCenterline
                                                x1={bCenter.x}
                                                y1={bCenter.y}
                                                x2={pCenter.x}
                                                y2={pCenter.y}
                                            />
                                        );
                                    })()}

                                    {/* Ramka podglądu rzutu fantomowego */}
                                    <rect
                                        x={phantomProjection.x}
                                        y={phantomProjection.y}
                                        width={phantomProjection.widthMm * phantomProjection.scale}
                                        height={phantomProjection.heightMm * phantomProjection.scale}
                                        fill="rgba(59, 130, 246, 0.08)"
                                        stroke="#2563eb"
                                        strokeWidth="0.5"
                                        strokeDasharray="4,2"
                                        rx="2"
                                    />
                                    <text
                                        x={phantomProjection.x + (phantomProjection.widthMm * phantomProjection.scale) / 2}
                                        y={phantomProjection.y + (phantomProjection.heightMm * phantomProjection.scale) / 2}
                                        fontSize="3.0"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        fill="#1d4ed8"
                                        dominantBaseline="middle"
                                    >
                                        Rzut: {phantomProjection.angle} (Kliknij aby wstawić)
                                    </text>
                                </g>
                            )}
                        </g>
                    </svg>
                </div>

                {/* ─── Panel edycji: właściwości rzutu i tabelka ─── */}
                <div
                    id="panel-edycji"
                    aria-label="Panel edycji"
                    style={{ width: '260px', backgroundColor: '#0f172a', borderLeft: '1px solid #1e293b', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}
                >
                    {selectedView ? (
                        <div style={{ background: 'rgba(37, 99, 235, 0.1)', border: '1px solid #3b82f6', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#93c5fd' }}>
                                🎯 Zaznaczony Rzut: {selectedView.projection}
                            </div>

                            <button
                                onClick={() => startProjectedViewMode(selectedView.id)}
                                style={{
                                    background: '#2563eb',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                }}
                            >
                                🔀 Ciągnij Rzut Pochodny
                            </button>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                                <label style={{ color: '#94a3b8' }}>Skala:</label>
                                <select
                                    value={selectedView.scale}
                                    onChange={(e) => {
                                        const sc = parseFloat(e.target.value);
                                        setViews((prev) => prev.map((v) => (v.id === selectedView.id ? { ...v, scale: sc, scaleText: sc === 0.1 ? '1:10' : sc === 0.05 ? '1:20' : sc === 0.2 ? '1:5' : '1:1' } : v)));
                                    }}
                                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '4px', borderRadius: '4px', fontSize: '11px' }}
                                >
                                    <option value={0.2}>1:5</option>
                                    <option value={0.1}>1:10</option>
                                    <option value={0.05}>1:20</option>
                                    <option value={1.0}>1:1</option>
                                </select>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                                    <div>
                                        <label style={{ color: '#94a3b8', fontSize: '10px' }}>Pozycja X (mm):</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedView.x)}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setViews((prev) => prev.map((v) => (v.id === selectedView.id ? { ...v, x: val } : v)));
                                            }}
                                            style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '3px 5px', borderRadius: '3px', fontSize: '11px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ color: '#94a3b8', fontSize: '10px' }}>Pozycja Y (mm):</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedView.y)}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setViews((prev) => prev.map((v) => (v.id === selectedView.id ? { ...v, y: val } : v)));
                                            }}
                                            style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '3px 5px', borderRadius: '3px', fontSize: '11px' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ background: '#1e293b', borderRadius: '6px', padding: '10px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                            Kliknij rzut na arkuszu lub pulpicie, aby edytować jego właściwości.
                        </div>
                    )}

                    {/* Tabelka Rysunkowa */}
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px' }}>
                            🏷️ Tabelka Rysunkowa
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                            <div>
                                <label style={{ color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Projekt:</label>
                                <input
                                    type="text"
                                    value={titleBlock.projectName}
                                    onChange={(e) => setTitleBlock({ ...titleBlock, projectName: e.target.value })}
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '4px', borderRadius: '3px', fontSize: '11px' }}
                                />
                            </div>
                            <div>
                                <label style={{ color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Nr rysunku:</label>
                                <input
                                    type="text"
                                    value={titleBlock.drawingNumber}
                                    onChange={(e) => setTitleBlock({ ...titleBlock, drawingNumber: e.target.value })}
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '4px', borderRadius: '3px', fontSize: '11px' }}
                                />
                            </div>
                            <div>
                                <label style={{ color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Autor:</label>
                                <input
                                    type="text"
                                    value={titleBlock.author}
                                    onChange={(e) => setTitleBlock({ ...titleBlock, author: e.target.value })}
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '4px', borderRadius: '3px', fontSize: '11px' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
