import React, { useState, useRef, useMemo, useEffect } from 'react';
import { tx } from '../../T1_tlumaczenia/core.js';
import { useLocale } from '../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';
import type { DagNode, DagEdge } from '../module-data/types';

interface DagCanvasProps {
    nodes: DagNode[];
    edges: DagEdge[];
    selectedNodeId: string | null;
    onSelectNode: (nodeId: string | null) => void;
    activeFilters: Set<string>;
    searchTerm: string;
    focusConnectedOnly: boolean;
    collapsedContainers: Set<string>;
    onToggleCollapse: (containerId: string) => void;
    allDetailsExpanded?: boolean;
}

interface NodeLayout {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface CabinetBand {
    id: string;
    label: string;
    y: number;
    height: number;
    width: number;
    isLoose?: boolean;
}

export const DagCanvas: React.FC<DagCanvasProps> = ({
    nodes,
    edges,
    selectedNodeId,
    onSelectNode,
    activeFilters,
    searchTerm,
    focusConnectedOnly,
    collapsedContainers,
    onToggleCollapse,
    allDetailsExpanded = false,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pan, setPan] = useState({ x: 60, y: 60 });
    const [zoom, setZoom] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    // Zbiór ID węzłów z indywidualnie rozwiniętymi szczegółami (wymiary, rola)
    const [expandedDetailsIds, setExpandedDetailsIds] = useState<Set<string>>(new Set());
    const locale = useLocale();

    const toggleNodeDetails = (nodeId: string) => {
        setExpandedDetailsIds((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    };

    const isNodeDetailsExpanded = (node: DagNode): boolean => {
        if (allDetailsExpanded) return true;
        return expandedDetailsIds.has(node.id);
    };

    const getNodeHeight = (node: DagNode): number => {
        const hasDetails = !!node.dimensions || !!node.role;
        if (hasDetails && isNodeDetailsExpanded(node)) {
            return node.dimensions && node.role ? 74 : 58;
        }
        return 38;
    };

    // Zlicz bezpośrednie formatki przypisane do każdego korpusu
    const containerChildPanelCounts = useMemo(() => {
        const counts = new Map<string, number>();
        nodes.forEach((n) => {
            if (n.type === 'PANEL' && n.parentId) {
                counts.set(n.parentId, (counts.get(n.parentId) || 0) + 1);
            }
        });
        return counts;
    }, [nodes]);

    // Zbiór węzłów ukrytych z powodu zwinięcia korpusu (oraz ich dzieci: obróbek)
    const hiddenDueToCollapseIds = useMemo(() => {
        const hidden = new Set<string>();
        if (collapsedContainers.size === 0) return hidden;

        const q = searchTerm.trim().toLowerCase();

        // 1. Formatki należące do zwiniętych korpusów
        const collapsedPanelIds = new Set<string>();
        nodes.forEach((n) => {
            if (n.parentId && collapsedContainers.has(n.parentId)) {
                const isSelected = selectedNodeId === n.id;
                const matchesSearch = q && (n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q));
                if (!isSelected && !matchesSearch) {
                    hidden.add(n.id);
                    collapsedPanelIds.add(n.id);
                }
            }
        });

        // 2. Obróbki i okucia należące do tych zwiniętych formatek
        nodes.forEach((n) => {
            if (n.parentId && collapsedPanelIds.has(n.parentId)) {
                const isSelected = selectedNodeId === n.id;
                const matchesSearch = q && (n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q));
                if (!isSelected && !matchesSearch) {
                    hidden.add(n.id);
                }
            }
        });

        return hidden;
    }, [nodes, collapsedContainers, selectedNodeId, searchTerm]);

    // 1. Filtrowanie węzłów
    const visibleNodes = useMemo(() => {
        let result = nodes.filter((n) => activeFilters.has(n.type));

        if (hiddenDueToCollapseIds.size > 0) {
            result = result.filter((n) => !hiddenDueToCollapseIds.has(n.id));
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            result = result.filter(
                (n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q) || (n.role && n.role.toLowerCase().includes(q))
            );
        }

        if (focusConnectedOnly && selectedNodeId) {
            const connectedIds = new Set<string>([selectedNodeId]);
            edges.forEach((e) => {
                if (e.source === selectedNodeId) connectedIds.add(e.target);
                if (e.target === selectedNodeId) connectedIds.add(e.source);
            });
            result = result.filter((n) => connectedIds.has(n.id));
        }

        return result;
    }, [nodes, edges, activeFilters, searchTerm, focusConnectedOnly, selectedNodeId, hiddenDueToCollapseIds]);

    const visibleNodeIdSet = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

    // 2. Filtrowanie krawędzi (tylko między widocznymi węzłami)
    const visibleEdges = useMemo(() => {
        return edges.filter((e) => visibleNodeIdSet.has(e.source) && visibleNodeIdSet.has(e.target));
    }, [edges, visibleNodeIdSet]);

    // 3. Pasmowy układ poddrzew korpusów (Excel-style Banded Layout)
    const layoutResult = useMemo(() => {
        const layouts = new Map<string, NodeLayout>();
        const bands: CabinetBand[] = [];

        const nodeWidth = 240;
        const colGap = 100;
        const rowGap = 10;
        const cabinetBandGap = 44;

        const col0X = 40;                            // ROOM
        const col1X = col0X + nodeWidth + colGap;    // CONTAINER (380)
        const col2X = col1X + nodeWidth + colGap;    // PANEL (720)
        const col3X = col2X + nodeWidth + colGap;    // FEATURE / HARDWARE (1060)
        const col4X = col3X + nodeWidth + colGap;    // CONSTRAINT (1400)

        const roomNodes = visibleNodes.filter((n) => n.type === 'ROOM');
        const containerNodes = visibleNodes.filter((n) => n.type === 'CONTAINER');
        const panelNodes = visibleNodes.filter((n) => n.type === 'PANEL');
        const featureNodes = visibleNodes.filter((n) => n.type === 'FEATURE' || n.type === 'HARDWARE');
        const constraintNodes = visibleNodes.filter((n) => n.type === 'CONSTRAINT');

        // Grupowanie formatek per ID korpusu
        const panelsByContainer = new Map<string, DagNode[]>();
        const loosePanels: DagNode[] = [];
        const containerIdSet = new Set(containerNodes.map((c) => c.id));

        panelNodes.forEach((p) => {
            if (p.parentId && containerIdSet.has(p.parentId)) {
                const list = panelsByContainer.get(p.parentId) || [];
                list.push(p);
                panelsByContainer.set(p.parentId, list);
            } else {
                loosePanels.push(p);
            }
        });

        // Grupowanie obróbek per ID formatki
        const featuresByPanel = new Map<string, DagNode[]>();
        const looseFeatures: DagNode[] = [];
        const panelIdSet = new Set(panelNodes.map((p) => p.id));

        featureNodes.forEach((f) => {
            if (f.parentId && panelIdSet.has(f.parentId)) {
                const list = featuresByPanel.get(f.parentId) || [];
                list.push(f);
                featuresByPanel.set(f.parentId, list);
            } else {
                looseFeatures.push(f);
            }
        });

        // A. Pozycjonowanie ROOM w kolumnie 0
        let roomY = 40;
        roomNodes.forEach((room) => {
            const h = getNodeHeight(room);
            layouts.set(room.id, {
                x: col0X,
                y: roomY,
                width: nodeWidth,
                height: h,
            });
            roomY += h + rowGap;
        });

        let currentY = 40;

        // B. Pozycjonowanie pasm korpusów
        containerNodes.forEach((container) => {
            const isCollapsed = collapsedContainers.has(container.id);
            const panels = panelsByContainer.get(container.id) || [];
            const bandStartY = currentY;
            const containerH = getNodeHeight(container);

            // Karta korpusu w kolumnie 1
            layouts.set(container.id, {
                x: col1X,
                y: currentY,
                width: nodeWidth,
                height: containerH,
            });

            let panelY = currentY;

            if (!isCollapsed && panels.length > 0) {
                panels.forEach((panel) => {
                    const feats = featuresByPanel.get(panel.id) || [];
                    const panelH = getNodeHeight(panel);

                    // Formatka w kolumnie 2
                    layouts.set(panel.id, {
                        x: col2X,
                        y: panelY,
                        width: nodeWidth,
                        height: panelH,
                    });

                    // Obróbki / okucia w kolumnie 3 przypisane do tej formatki
                    if (feats.length > 0) {
                        let featY = panelY;
                        feats.forEach((feat) => {
                            const featH = getNodeHeight(feat);
                            layouts.set(feat.id, {
                                x: col3X,
                                y: featY,
                                width: nodeWidth,
                                height: featH,
                            });
                            featY += featH + rowGap;
                        });
                        const totalFeatsH = featY - panelY - rowGap;
                        panelY += Math.max(panelH, totalFeatsH) + rowGap;
                    } else {
                        panelY += panelH + rowGap;
                    }
                });
            }

            // Wysokość zajęta przez ten korpus i jego poddrzewo
            const subtreeHeight = (!isCollapsed && panels.length > 0)
                ? Math.max(containerH, panelY - bandStartY - rowGap)
                : containerH;

            const hasFeatures = panels.some((p) => (featuresByPanel.get(p.id) || []).length > 0);
            const bandWidth = (!isCollapsed && panels.length > 0)
                ? (hasFeatures ? col3X + nodeWidth - col1X + 24 : col2X + nodeWidth - col1X + 24)
                : nodeWidth + 24;

            bands.push({
                id: container.id,
                label: container.label,
                y: bandStartY - 8,
                height: subtreeHeight + 16,
                width: bandWidth,
            });

            // Kolejny korpus zaczyna się ZAWSZE poniżej wszystkich elementów poprzedniego korpusu!
            currentY = bandStartY + subtreeHeight + cabinetBandGap;
        });

        // C. Formatki wolnostojące (bez przypisanego korpusu)
        if (loosePanels.length > 0) {
            const looseStartY = currentY;
            let panelY = currentY;

            loosePanels.forEach((panel) => {
                const feats = featuresByPanel.get(panel.id) || [];
                const panelH = getNodeHeight(panel);
                layouts.set(panel.id, {
                    x: col2X,
                    y: panelY,
                    width: nodeWidth,
                    height: panelH,
                });
                if (feats.length > 0) {
                    let featY = panelY;
                    feats.forEach((feat) => {
                        const featH = getNodeHeight(feat);
                        layouts.set(feat.id, {
                            x: col3X,
                            y: featY,
                            width: nodeWidth,
                            height: featH,
                        });
                        featY += featH + rowGap;
                    });
                    const totalFeatsH = featY - panelY - rowGap;
                    panelY += Math.max(panelH, totalFeatsH) + rowGap;
                } else {
                    panelY += panelH + rowGap;
                }
            });

            bands.push({
                id: 'loose_panels_band',
                label: tx(srcTekst, 'dag.free_panels', TX_NS),
                y: looseStartY - 8,
                height: Math.max(38, panelY - looseStartY - rowGap) + 16,
                width: (col3X + nodeWidth) - col2X + 24,
                isLoose: true,
            });

            currentY = panelY + cabinetBandGap;
        }

        // D. Obróbki bez formatek (fallback)
        if (looseFeatures.length > 0) {
            looseFeatures.forEach((feat) => {
                const featH = getNodeHeight(feat);
                layouts.set(feat.id, {
                    x: col3X,
                    y: currentY,
                    width: nodeWidth,
                    height: featH,
                });
                currentY += featH + rowGap;
            });
            currentY += cabinetBandGap;
        }

        // E. Więzy kinematyczne w kolumnie 4
        let constraintY = 40;
        constraintNodes.forEach((cNode) => {
            const cH = getNodeHeight(cNode);
            let targetY = constraintY;
            const relatedEdge = visibleEdges.find((e) => e.source === cNode.id || e.target === cNode.id);
            if (relatedEdge) {
                const otherId = relatedEdge.source === cNode.id ? relatedEdge.target : relatedEdge.source;
                const otherLayout = layouts.get(otherId);
                if (otherLayout) {
                    targetY = Math.max(constraintY, otherLayout.y);
                }
            }
            layouts.set(cNode.id, {
                x: col4X,
                y: targetY,
                width: nodeWidth,
                height: cH,
            });
            constraintY = targetY + cH + rowGap;
        });

        return { layouts, bands };
    }, [visibleNodes, collapsedContainers, visibleEdges, allDetailsExpanded, expandedDetailsIds, locale]);

    const nodeLayouts = layoutResult.layouts;
    const cabinetBands = layoutResult.bands;

    const hasInitialFittedRef = useRef(false);

    // Dopasowanie widoku do wszystkich węzłów (Zoom to fit)
    const handleZoomFit = () => {
        if (!containerRef.current || visibleNodes.length === 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        const w = rect.width || window.innerWidth;
        const h = rect.height || window.innerHeight;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodeLayouts.forEach((l) => {
            if (l.x < minX) minX = l.x;
            if (l.y < minY) minY = l.y;
            if (l.x + l.width > maxX) maxX = l.x + l.width;
            if (l.y + l.height > maxY) maxY = l.y + l.height;
        });

        if (!isFinite(minX)) return;

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const paddingX = 100;
        const paddingY = 80;

        const scaleX = (w - paddingX * 2) / contentW;
        const scaleY = (h - paddingY * 2) / contentH;
        const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 1.2);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        setZoom(newZoom);
        setPan({
            x: Math.round(w / 2 - centerX * newZoom),
            y: Math.round(h / 2 - centerY * newZoom),
        });
    };

    // Automatyczne dopasowanie do ekranu przy pierwszym załadowaniu węzłów
    useEffect(() => {
        if (visibleNodes.length > 0 && !hasInitialFittedRef.current) {
            hasInitialFittedRef.current = true;
            const timer = setTimeout(handleZoomFit, 60);
            return () => clearTimeout(timer);
        }
    }, [visibleNodes.length]);

    // Obsługa przeciągania płótna (Pan)
    const handleMouseDown = (e: React.MouseEvent) => {
        // Ignoruj kliknięcia w kontrolki UI
        const target = e.target as HTMLElement;
        if (target.closest('.dag-controls-floating, .dag-toolbar-floating, button, input')) {
            return;
        }

        // Kliknięcie lewym przyciskiem na kartę węzła wybiera węzeł, ale środkowy przycisk zawsze przesuwa
        if (e.button === 0 && target.closest('.dag-node-card')) {
            return;
        }

        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };

    // Globalne nasłuchiwanie przesunięcia kursora na oknie (zapobiega gubieniu dragowania)
    useEffect(() => {
        if (!isDragging) return;

        const onWindowMouseMove = (e: MouseEvent) => {
            setPan({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y,
            });
        };

        const onWindowMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', onWindowMouseMove);
        window.addEventListener('mouseup', onWindowMouseUp);

        return () => {
            window.removeEventListener('mousemove', onWindowMouseMove);
            window.removeEventListener('mouseup', onWindowMouseUp);
        };
    }, [isDragging]);

    // Obsługa kółka myszy: Ctrl = Zoom, zwykłe kółko = Scroll Y (góra/dół), Shift = Scroll X
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
            // Zoom względem pozycji kursora
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.min(Math.max(0.2, zoom * delta), 2.5);

            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                // Zachowaj punkt pod kursorem w tym samym miejscu
                const zoomFactor = newZoom / zoom;
                setPan((prev) => ({
                    x: mouseX - (mouseX - prev.x) * zoomFactor,
                    y: mouseY - (mouseY - prev.y) * zoomFactor,
                }));
            }
            setZoom(newZoom);
        } else if (e.shiftKey) {
            // Przewijanie w poziomie
            setPan((prev) => ({ ...prev, x: prev.x - e.deltaY }));
        } else {
            // Naturalne przewijanie w pionie
            setPan((prev) => ({ ...prev, y: prev.y - e.deltaY }));
        }
    };

    const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.25, 2.5));
    const handleZoomOut = () => setZoom((prev) => Math.max(prev * 0.8, 0.2));
    const handleResetView = () => {
        setPan({ x: 60, y: 60 });
        setZoom(1);
    };

    return (
        <div
            ref={containerRef}
            className="dag-canvas-container"
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
            {/* Pływające kontrolki Zoom */}
            <div className="dag-controls-floating">
                <button className="dag-icon-btn" onClick={handleZoomIn} title={tx(srcTekst, "dag.zoom_in_title", TX_NS)}>+</button>
                <button className="dag-icon-btn" onClick={handleZoomOut} title={tx(srcTekst, "dag.zoom_out_title", TX_NS)}>−</button>
                <button className="dag-icon-btn" onClick={handleZoomFit} title={tx(srcTekst, "dag.zoom_fit", TX_NS)}></button>
                <button className="dag-icon-btn" onClick={handleResetView} title="Resetuj widok (100%)">⟲</button>
            </div>

            {/* Transformowany obszar roboczy */}
            <div
                className="dag-canvas-viewport"
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
            >
                {/* Krawędzie SVG */}
                <svg className="dag-connections-svg">
                    <defs>
                        <marker
                            id="dag-arrow"
                            viewBox="0 0 10 10"
                            refX="6"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M 0 1 L 8 5 L 0 9 z" fill="rgba(255,255,255,0.4)" />
                        </marker>
                        <marker
                            id="dag-arrow-active"
                            viewBox="0 0 10 10"
                            refX="6"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
                        </marker>
                        <marker
                            id="dag-arrow-conflict"
                            viewBox="0 0 10 10"
                            refX="6"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M 0 1 L 8 5 L 0 9 z" fill="#ef4444" />
                        </marker>
                    </defs>

                    {/* Pasma korpusów (Excel-style Bands) */}
                    {cabinetBands.map((band) => {
                        const bandX = band.isLoose ? 720 - 16 : 380 - 16;
                        return (
                            <g key={`band_${band.id}`} className="dag-band-group">
                                <rect
                                    x={bandX}
                                    y={band.y}
                                    width={band.width}
                                    height={band.height}
                                    rx={10}
                                    ry={10}
                                    className={`dag-band-rect ${band.isLoose ? 'loose' : ''}`}
                                />
                                <text
                                    x={bandX + 14}
                                    y={band.y + 18}
                                    className="dag-band-title"
                                >
                                    {band.label}
                                </text>
                                <line
                                    x1={40}
                                    y1={band.y + band.height + 26}
                                    x2={1400 + 220}
                                    y2={band.y + band.height + 26}
                                    className="dag-band-divider-line"
                                />
                            </g>
                        );
                    })}

                    {visibleEdges.map((edge) => {
                        const src = nodeLayouts.get(edge.source);
                        const tgt = nodeLayouts.get(edge.target);
                        if (!src || !tgt) return null;

                        const isHighlighted = selectedNodeId === edge.source || selectedNodeId === edge.target;
                        const isConflict = !!edge.conflict;

                        // Rysuj krzywą od prawej krawędzi źródła do lewej krawędzi celu
                        const x1 = src.x + src.width;
                        const y1 = src.y + src.height / 2;
                        const x2 = tgt.x;
                        const y2 = tgt.y + tgt.height / 2;
                        const dx = Math.abs(x2 - x1) * 0.5;

                        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                        let markerUrl = 'url(#dag-arrow)';
                        if (isConflict) markerUrl = 'url(#dag-arrow-conflict)';
                        else if (isHighlighted) markerUrl = 'url(#dag-arrow-active)';

                        return (
                            <g key={edge.id}>
                                <path
                                    d={d}
                                    className={`dag-edge-path ${edge.kind.toLowerCase()} ${
                                        isHighlighted ? 'highlighted' : ''
                                    } ${isConflict ? 'conflict' : ''}`}
                                    markerEnd={markerUrl}
                                />
                                {edge.label && (
                                    <text
                                        x={(x1 + x2) / 2}
                                        y={(y1 + y2) / 2 - 6}
                                        fill="rgba(255,255,255,0.4)"
                                        fontSize="10"
                                        textAnchor="middle"
                                        fontFamily="sans-serif"
                                    >
                                        {edge.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>

                {/* Węzły */}
                {visibleNodes.map((node) => {
                    const layout = nodeLayouts.get(node.id);
                    if (!layout) return null;

                    const isSelected = selectedNodeId === node.id;
                    const hasConflict = !!node.status?.conflict;
                    const isContainer = node.type === 'CONTAINER';
                    const childCount = containerChildPanelCounts.get(node.id) || 0;
                    const isCollapsed = collapsedContainers.has(node.id);
                    const isDetailsOpen = isNodeDetailsExpanded(node);
                    const hasDetails = !!node.dimensions || !!node.role;

                    return (
                        <div
                            key={node.id}
                            className={`dag-node-card ${isSelected ? 'selected' : ''} ${
                                hasConflict ? 'conflict' : ''
                            } ${isContainer ? 'is-container' : ''} ${isDetailsOpen ? 'details-open' : 'compact'}`}
                            style={{
                                transform: `translate(${layout.x}px, ${layout.y}px)`,
                                width: layout.width,
                                height: layout.height,
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectNode(node.id);
                            }}
                        >
                            {/* Zwarty pojedynczy rząd: TYP + NAZWA + STATUSY + TOGGLE */}
                            <div className="dag-node-compact-row">
                                <span className={`dag-node-type-badge badge-${node.type}`}>{node.type}</span>

                                <span className="dag-node-title-inline" title={node.label}>
                                    {node.label}
                                </span>

                                {/* Zwijanie wyjść korpusu (zwarty pill inline) */}
                                {isContainer && childCount > 0 && (
                                    <button
                                        type="button"
                                        className={`dag-collapse-pill-inline ${isCollapsed ? 'collapsed' : 'expanded'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleCollapse(node.id);
                                        }}
                                        title={
                                            isCollapsed
? tx(srcTekst, 'dag.expand_node', TX_NS)
: tx(srcTekst, 'dag.collapse_node', TX_NS)
                                        }
                                    >
                                        <span className="dag-collapse-icon">
                                            {isCollapsed ? '▶' : '▼'}
                                        </span>
                                        <span>{childCount}</span>
                                    </button>
                                )}

                                {node.status?.frozen && <span title={tx(srcTekst, 'dag.frozen', TX_NS)} style={{ fontSize: '0.75rem' }}>{tx(srcTekst, 'dag.frozen', TX_NS)}</span>}
                                {hasConflict && (
                                    <span
                                        className="dag-stat-tag conflict"
                                        style={{ fontSize: '0.65rem', padding: '1px 3px' }}
                                    >
                                        ⚠️
                                    </span>
                                )}

                                {/* Przycisk rozwijania szczegółów (wymiary, rola) */}
                                {hasDetails && (
                                    <button
                                        type="button"
                                        className="dag-details-toggle-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleNodeDetails(node.id);
                                        }}
                                        title={isDetailsOpen ? tx(srcTekst, 'dag.details_open', TX_NS) : tx(srcTekst, 'dag.details_closed', TX_NS)}
                                    >
                                        {isDetailsOpen ? '▴' : '▾'}
                                    </button>
                                )}
                            </div>

                            {/* Sekcja rozwijana (wymiary, rola, ID) */}
                            {isDetailsOpen && (
                                <div className="dag-node-expanded-body">
                                    {node.dimensions && (
                                        <div className="dag-node-dim">
                                            {node.dimensions.widthMm} × {node.dimensions.heightMm}
                                            {node.dimensions.thicknessMm ? ` × ${node.dimensions.thicknessMm}` : ''} mm
                                        </div>
                                    )}

                                    {node.role && (
                                        <div className="dag-node-meta-row">
                                            <span>{node.role}</span>
                                            <span style={{ opacity: 0.6 }}>#{node.id.slice(-6)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {visibleNodes.length === 0 && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        color: '#64748b',
                        pointerEvents: 'none',
                        zIndex: 5,
                    }}
                >
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🕸️</div>
<div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#94a3b8' }}>{tx(srcTekst, 'dag.no_match', TX_NS)}</div>
<div style={{ fontSize: '0.78rem', marginTop: 4, color: '#64748b' }}>{tx(srcTekst, 'dag.no_match_hint', TX_NS)}</div>
                </div>
            )}
        </div>
    );
};
