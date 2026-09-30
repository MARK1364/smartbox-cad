import React from 'react';
import type { DagNode, DagEdge } from '../module-data/types';
import { tx } from '../../T1_tlumaczenia/core.js';
import { useLocale } from '../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

interface DagNodeDetailsProps {
    node: DagNode | null;
    allNodes: DagNode[];
    edges: DagEdge[];
    onSelectNode: (nodeId: string | null) => void;
    onClose: () => void;
}

export const DagNodeDetails: React.FC<DagNodeDetailsProps> = ({
    node,
    allNodes,
    edges,
    onSelectNode,
    onClose,
}) => {
    useLocale();
    if (!node) {
        return (
            <aside className="dag-sidebar">
                <div className="dag-sidebar-header">
                    <span className="dag-sidebar-title">{tx(srcTekst, "dag.node_inspector", TX_NS)}</span>
                </div>
                <div
                    className="dag-sidebar-content"
                    style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#64748b' }}
                >
                    <p style={{ fontSize: '0.85rem' }}>{tx(srcTekst, "dag.click_node", TX_NS)}</p>
                </div>
            </aside>
        );
    }

    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    // Znajdź połączenia
    const incoming = edges.filter((e) => e.target === node.id);
    const outgoing = edges.filter((e) => e.source === node.id);

    return (
        <aside className="dag-sidebar">
            <div className="dag-sidebar-header">
                <span className="dag-sidebar-title">{tx(srcTekst, "dag.node_inspector", TX_NS)}</span>
                <button className="dag-icon-btn" onClick={onClose} title="Zamknij panel">
                    ✕
                </button>
            </div>

            <div className="dag-sidebar-content">
                {/* 1. Karta podstawowa */}
                <div className="dag-card-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span className={`dag-node-type-badge badge-${node.type}`}>{node.type}</span>
                        {node.status?.frozen && <span title={tx(srcTekst, "dag.frozen", TX_NS)}>{tx(srcTekst, "dag.frozen", TX_NS)}</span>}
                    </div>

                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', wordBreak: 'break-all' }}>
                        {node.label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4, fontFamily: 'monospace' }}>
                        ID: {node.id}
                    </div>
                </div>

                {/* 2. Ostrzeżenie o konflikcie */}
                {node.status?.conflict && (
                    <div
                        className="dag-card-section"
                        style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    >
                        <div style={{ color: '#f87171', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {tx(srcTekst, "dag.joint_conflict", TX_NS)}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#fca5a5', margin: '6px 0 0 0' }}>
                            {tx(srcTekst, "dag.joint_conflict_hint", TX_NS)}
                        </p>
                    </div>
                )}

                {/* 3. Wymiary */}
                {node.dimensions && (
                    <div className="dag-card-section">
                        <div className="dag-card-section-title">{tx(srcTekst, "dag.phys_dims", TX_NS)}</div>
                        <div className="dag-prop-row">
                            <span className="dag-prop-key">{tx(srcTekst, "dag.width", TX_NS)}</span>
                            <span className="dag-prop-val">{node.dimensions.widthMm} mm</span>
                        </div>
                        <div className="dag-prop-row">
                            <span className="dag-prop-key">{tx(srcTekst, "dag.height_len", TX_NS)}</span>
                            <span className="dag-prop-val">{node.dimensions.heightMm} mm</span>
                        </div>
                        {node.dimensions.thicknessMm > 0 && (
                            <div className="dag-prop-row">
                                <span className="dag-prop-key">{tx(srcTekst, "dag.thickness", TX_NS)}</span>
                                <span className="dag-prop-val">{node.dimensions.thicknessMm} mm</span>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Identyfikacja i klasyfikacja */}
                <div className="dag-card-section">
                    <div className="dag-card-section-title">{tx(srcTekst, "dag.cad_class", TX_NS)}</div>
                    <div className="dag-prop-row">
                        <span className="dag-prop-key">{tx(srcTekst, "dag.role", TX_NS)}</span>
                        <span className="dag-prop-val">{node.role || '—'}</span>
                    </div>
                    <div className="dag-prop-row">
                        <span className="dag-prop-key">{tx(srcTekst, "dag.node_type", TX_NS)}</span>
                        <span className="dag-prop-val">{node.type}</span>
                    </div>
                    {node.status?.residual !== undefined && (
                        <div className="dag-prop-row">
                            <span className="dag-prop-key">{tx(srcTekst, "dag.residual", TX_NS)}</span>
                            <span className="dag-prop-val">{node.status.residual.toFixed(4)}</span>
                        </div>
                    )}
                </div>

                {/* 5. Połączenia wchodzące (Rodzice / Źródła) */}
                {incoming.length > 0 && (
                    <div className="dag-card-section">
                        <div className="dag-card-section-title">{tx(srcTekst, 'dag.parents', TX_NS, { n: incoming.length })}</div>
                        {incoming.map((e) => {
                            const srcNode = nodeMap.get(e.source);
                            return (
                                <div
                                    key={e.id}
                                    className="dag-relation-link"
                                    onClick={() => onSelectNode(e.source)}
                                    title={`Skocz do: ${srcNode?.label || e.source}`}
                                >
                                    <span>←</span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {srcNode?.label || e.source}
                                    </span>
                                    <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>{e.label || e.kind}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 6. Połączenia wychodzące (Dzieci / Cele) */}
                {outgoing.length > 0 && (
                    <div className="dag-card-section">
                        <div className="dag-card-section-title">{tx(srcTekst, 'dag.children', TX_NS, { n: outgoing.length })}</div>
                        {outgoing.map((e) => {
                            const tgtNode = nodeMap.get(e.target);
                            return (
                                <div
                                    key={e.id}
                                    className="dag-relation-link"
                                    onClick={() => onSelectNode(e.target)}
                                    title={`Skocz do: ${tgtNode?.label || e.target}`}
                                >
                                    <span>→</span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {tgtNode?.label || e.target}
                                    </span>
                                    <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>{e.label || e.kind}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 7. Metadane techniczne */}
                {node.meta && Object.keys(node.meta).length > 0 && (
                    <details className="dag-card-section" style={{ cursor: 'pointer' }}>
                        <summary className="dag-card-section-title" style={{ outline: 'none' }}>
                            {tx(srcTekst, "dag.json_meta", TX_NS)}
                        </summary>
                        <pre
                            style={{
                                margin: '8px 0 0 0',
                                fontSize: '0.7rem',
                                color: '#94a3b8',
                                background: '#0b0f17',
                                padding: 8,
                                borderRadius: 4,
                                overflowX: 'auto',
                            }}
                        >
                            {JSON.stringify(node.meta, null, 2)}
                        </pre>
                    </details>
                )}
            </div>
        </aside>
    );
};
