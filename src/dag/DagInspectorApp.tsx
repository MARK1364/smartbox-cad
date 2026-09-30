import React, { useState, useEffect, useMemo } from 'react';
import {
    readModuleSession,
    readProjectSnapshot,
    returnToCad,
    requestModuleRefresh,
    installModulePageLifecycle,
    MODULE_SESSION_UPDATED_MSG,
    CAD_BRIDGE_CHANNEL,
} from '../module-data/session';
import { extractDagPayload } from '../module-data/cad-extract';
import type { DagModulePayload, DagNode } from '../module-data/types';
import { DagCanvas } from './DagCanvas';
import { DagNodeDetails } from './DagNodeDetails';
import { tx } from '../../T1_tlumaczenia/core.js';
import { useLocale } from '../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';
import './dag.css';

installModulePageLifecycle('dag');

function loadInitialPayload(): DagModulePayload | null {
    const session = readModuleSession<DagModulePayload>('dag');
    if (session && Array.isArray(session.nodes) && session.nodes.length > 0) {
        return session;
    }
    const snapshot = readProjectSnapshot();
    if (snapshot) {
        try {
            return extractDagPayload({ type: 'PROJECT', id: 'ALL', name: 'Projekt' }, snapshot);
        } catch (e) {
            console.warn('DAG fallback from snapshot failed:', e);
        }
    }
    return session || null;
}

export const DagInspectorApp: React.FC = () => {
    useLocale();
    const [payload, setPayload] = useState<DagModulePayload | null>(loadInitialPayload);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
        const init = loadInitialPayload();
        if (init?.scope && init.scope.type !== 'PROJECT' && init.scope.id !== 'ALL') {
            return init.scope.id;
        }
        return null;
    });
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [focusConnectedOnly, setFocusConnectedOnly] = useState<boolean>(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

    const [activeFilters, setActiveFilters] = useState<Set<string>>(
        new Set(['ROOM', 'CONTAINER', 'PANEL', 'FEATURE', 'HARDWARE', 'CONSTRAINT'])
    );
    const [collapsedContainers, setCollapsedContainers] = useState<Set<string>>(new Set());
    const [allDetailsExpanded, setAllDetailsExpanded] = useState<boolean>(false);

    const toggleCollapseContainer = (id: string) => {
        setCollapsedContainers((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleCollapseAll = () => {
        if (!payload?.nodes) return;
        const allContainerIds = payload.nodes.filter((n) => n.type === 'CONTAINER').map((n) => n.id);
        setCollapsedContainers(new Set(allContainerIds));
    };

    const handleExpandAll = () => {
        setCollapsedContainers(new Set());
    };

    // Nasłuchuj odświeżenia sesji z CAD (np. po zmianie mebla w edytorze)
    useEffect(() => {
        const handleUpdate = () => {
            const fresh = loadInitialPayload();
            if (fresh) setPayload(fresh);
        };

        let channel: BroadcastChannel | null = null;
        try {
            channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
            channel.onmessage = (ev) => {
                if (ev.data?.type === MODULE_SESSION_UPDATED_MSG && ev.data?.module === 'dag') {
                    handleUpdate();
                }
            };
        } catch { /* ignore */ }

        const onWindowMsg = (ev: MessageEvent) => {
            if (ev.data?.type === MODULE_SESSION_UPDATED_MSG && ev.data?.module === 'dag') {
                handleUpdate();
            }
        };
        window.addEventListener('message', onWindowMsg);

        return () => {
            window.removeEventListener('message', onWindowMsg);
            try {
                channel?.close();
            } catch { /* ignore */ }
        };
    }, []);

    const toggleFilter = (type: string) => {
        setActiveFilters((prev) => {
            const next = new Set(prev);
            if (next.has(type)) {
                next.delete(type);
            } else {
                next.add(type);
            }
            return next;
        });
    };

    const handleRefresh = () => {
        if (payload?.scope) {
            requestModuleRefresh('dag', payload.scope);
        }
    };

    const selectedNode = useMemo<DagNode | null>(() => {
        if (!payload || !selectedNodeId) return null;
        return payload.nodes.find((n) => n.id === selectedNodeId) || null;
    }, [payload, selectedNodeId]);

    if (!payload || !payload.nodes || payload.nodes.length === 0) {
        return (
            <div className="dag-app" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div
                    style={{
                        textAlign: 'center',
                        maxWidth: 460,
                        padding: 32,
                        background: 'rgba(15, 23, 42, 0.9)',
                        borderRadius: 12,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    }}
                >
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 12, color: '#f8fafc' }}>{tx(srcTekst, 'dag.empty_title', TX_NS)}</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.5, marginBottom: 24 }}>
                        {tx(srcTekst, 'dag.no_objects', TX_NS)} {tx(srcTekst, 'dag.no_objects_hint', TX_NS)}
                        <strong>{tx(srcTekst, 'dag.empty_hint', TX_NS)}</strong>.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button className="dag-btn" onClick={handleRefresh}>
                            <span>{tx(srcTekst, 'dag.refresh', TX_NS)}</span>
                        </button>
                        <button className="dag-btn primary" onClick={() => returnToCad('dag')}>
                            <span>{tx(srcTekst, 'dag.back_editor', TX_NS)}</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const stats = payload.stats || {
        containerCount: 0,
        panelCount: 0,
        featureCount: 0,
        hardwareCount: 0,
        constraintCount: 0,
        conflictCount: 0,
    };

    return (
        <div className="dag-app">
            {/* Górna belka / Toolbar */}
            <header className="dag-header">
                <div className="dag-header-left">
                    <div className="dag-brand">
                        <span>{tx(srcTekst, 'dag.inspector', TX_NS)}</span>
                    </div>
                    <span className="dag-badge-pill">{payload.scope.name || tx(srcTekst, 'tree.project_default', TX_NS)}</span>

                    <div className="dag-header-stats">
                        <span className="dag-stat-tag" title={`${tx(srcTekst, 'dag.f_bodies', TX_NS)} / ${tx(srcTekst, 'dag.stat_asm', TX_NS)}`}>
                            {stats.containerCount}
                        </span>
                        <span className="dag-stat-tag" title={tx(srcTekst, 'dag.stat_panels', TX_NS)}>
                            {stats.panelCount}
                        </span>
                        <span className="dag-stat-tag" title={tx(srcTekst, 'dag.stat_features', TX_NS)}>
                            {stats.featureCount}
                        </span>
                        <span className="dag-stat-tag" title={`${tx(srcTekst, 'dag.f_joints', TX_NS)} ${tx(srcTekst, 'dag.stat_constraints', TX_NS)}`}>
                            {stats.constraintCount}
                        </span>
                        {stats.conflictCount > 0 && (
                            <span className="dag-stat-tag conflict" title={tx(srcTekst, 'dag.stat_conflicts', TX_NS)}>
                                {tx(srcTekst, 'dag.conflict_count', TX_NS, { n: stats.conflictCount })}
                            </span>
                        )}
                    </div>
                </div>

                <div className="dag-header-actions">
                    <button className="dag-btn" onClick={handleRefresh} title={tx(srcTekst, 'dag.fetch_fresh', TX_NS)}>
                        <span>{tx(srcTekst, 'dag.refresh_cad', TX_NS)}</span>
                    </button>
                    <button className="dag-btn primary" onClick={() => returnToCad('dag')} title={tx(srcTekst, 'dag.back_3d', TX_NS)}>
                        <span>{tx(srcTekst, 'dag.back_cad', TX_NS)}</span>
                    </button>
                </div>
            </header>

            {/* Ciało aplikacji */}
            <div className="dag-body">
                {/* Pływające filtry wyszukiwania */}
                <div className="dag-toolbar-floating">
                    <input
                        type="text"
                        className="dag-search-input"
                        placeholder="Szukaj (nazwa, rola, ID)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <button
                        className={`dag-toggle-chip ${activeFilters.has('CONTAINER') ? 'active' : ''}`}
                        onClick={() => toggleFilter('CONTAINER')}
                    >
                        {tx(srcTekst, 'dag.f_bodies', TX_NS)}
                    </button>
                    <button
                        className={`dag-toggle-chip ${activeFilters.has('PANEL') ? 'active' : ''}`}
                        onClick={() => toggleFilter('PANEL')}
                    >
                        {tx(srcTekst, 'dag.f_panels', TX_NS)}
                    </button>
                    <button
                        className={`dag-toggle-chip ${activeFilters.has('FEATURE') ? 'active' : ''}`}
                        onClick={() => toggleFilter('FEATURE')}
                    >
                        {tx(srcTekst, 'dag.f_features', TX_NS)}
                    </button>
                    <button
                        className={`dag-toggle-chip ${activeFilters.has('CONSTRAINT') ? 'active' : ''}`}
                        onClick={() => toggleFilter('CONSTRAINT')}
                    >
                        {tx(srcTekst, 'dag.f_joints', TX_NS)}
                    </button>

                    <button
                        className={`dag-toggle-chip ${focusConnectedOnly ? 'active' : ''}`}
                        onClick={() => setFocusConnectedOnly(!focusConnectedOnly)}
                        title={tx(srcTekst, 'dag.connected_title', TX_NS)}
                        style={{ borderStyle: 'dashed' }}
                    >
                        {tx(srcTekst, 'dag.connected_only', TX_NS)}
                    </button>

                    <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

                    <button
                        className="dag-toggle-chip"
                        onClick={handleCollapseAll}
                        title={tx(srcTekst, 'dag.collapse_title', TX_NS)}
                    >
                        {tx(srcTekst, 'dag.collapse', TX_NS)}
                    </button>
                    <button
                        className="dag-toggle-chip"
                        onClick={handleExpandAll}
                        title={tx(srcTekst, 'dag.expand_title', TX_NS)}
                    >
                        {tx(srcTekst, 'dag.expand', TX_NS)}
                    </button>

                    <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

                    <button
                        className={`dag-toggle-chip ${allDetailsExpanded ? 'active' : ''}`}
                        onClick={() => setAllDetailsExpanded(!allDetailsExpanded)}
                        title={tx(srcTekst, 'dag.toggle_cards', TX_NS)}
                    >
                        {allDetailsExpanded ? tx(srcTekst, 'dag.compact_labels', TX_NS) : tx(srcTekst, 'dag.show_details', TX_NS)}
                    </button>
                </div>

                {/* Płótno grafu */}
                <DagCanvas
                    nodes={payload.nodes}
                    edges={payload.edges}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={(id) => {
                        setSelectedNodeId(id);
                        if (id && !isSidebarOpen) setIsSidebarOpen(true);
                    }}
                    activeFilters={activeFilters}
                    searchTerm={searchTerm}
                    focusConnectedOnly={focusConnectedOnly}
                    collapsedContainers={collapsedContainers}
                    onToggleCollapse={toggleCollapseContainer}
                    allDetailsExpanded={allDetailsExpanded}
                />

                {/* Boczny panel inspekcji */}
                {isSidebarOpen && (
                    <DagNodeDetails
                        node={selectedNode}
                        allNodes={payload.nodes}
                        edges={payload.edges}
                        onSelectNode={(id) => setSelectedNodeId(id)}
                        onClose={() => setIsSidebarOpen(false)}
                    />
                )}
            </div>
        </div>
    );
};
