/**
 * BelkaHierarchia — prosta ścieżka w górę od zaznaczenia.
 * Tylko przodkowie (korpus → … → panel → operacja), bez list rodzeństwa.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager';
import { UIController } from '../A1_core/ui-controller';
import { CADNode } from '../A1_core/cad-node/cad-node';
import { NodeType } from '../A1_core/cad-node/node-type';
import type { ProjectDocument } from '../A1_core/project-document';
import { buildSelectionChain, resolveFeatureId } from '../A1_core/selection-path';
import { featureOperationLabel } from '../o1_operacji';
import { CAD_OPEN_FLOATING_OPERATION } from './FloatingOperationDialog';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from './src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

type CrumbKind = 'assembly' | 'panel' | 'hardware' | 'feature';
export type CrumbModeType = 'smartframe' | 'bloki' | 'smartpanel' | 'feature' | 'hardware' | 'assembly';

type Crumb = {
    id: string;
    label: string;
    kind: CrumbKind;
    modeType: CrumbModeType;
    panelId?: string;
};

function isBlokiDomain(data: any): boolean {
    if (!data) return false;
    // Strict: tylko flagi strukturalne, nigdy nazwa (rename-proof, locale-proof).
    return (
        data.type === 'DRAWERS' ||
        data.type === 'SHELVES' ||
        data.is_blok ||
        data.type === 'bloki' ||
        data.generatorParams?.type?.startsWith?.('bloki') ||
        data.generatorParams?.boxType !== undefined ||
        data.sb_role !== undefined ||
        data.role === 'BLOKI'
    );
}

function detectNodeModeType(node: CADNode): CrumbModeType {
    const data = node.domainData as any;
    if (node.nodeType === NodeType.PART) return 'smartpanel';
    if (node.nodeType === NodeType.HARDWARE) return 'hardware';
    if (isBlokiDomain(data)) return 'bloki';
    const t = String(data?.generatorParams?.type || data?.type || '').toLowerCase();
    if (t.includes('korpus') || t.includes('rogowy') || data?.is_smartframe) return 'smartframe';
    return 'assembly';
}

function nodeLabel(node: CADNode): string {
    const data = node.domainData as any;
    const name = (data?.name || node.name || '').trim();
    if (node.nodeType === NodeType.PART) return name || tx(srcTekst, 'crumb.d_panel', TX_NS);
    if (node.nodeType === NodeType.HARDWARE) return name || tx(srcTekst, 'crumb.d_hw', TX_NS);
    if (isBlokiDomain(data)) return name || tx(srcTekst, 'crumb.d_box', TX_NS);
    const t = String(data?.generatorParams?.type || data?.type || '').toLowerCase();
    if (t.includes('korpus') || t.includes('rogowy')) return name || tx(srcTekst, 'crumb.d_frame', TX_NS);
    if (data?.role === 'ZONE' || /sekcja/i.test(name)) return name || tx(srcTekst, 'crumb.d_zone', TX_NS);
    return name || tx(srcTekst, 'crumb.assembly', TX_NS);
}

function featureLabel(f: any): string {
    if (!f) return tx(srcTekst, 'crumb.d_op', TX_NS);
    try {
        return featureOperationLabel(f) || f.name || f.type || tx(srcTekst, 'crumb.d_op', TX_NS);
    } catch {
        return f.name || f.type || tx(srcTekst, 'crumb.d_op', TX_NS);
    }
}

function buildPath(doc: ProjectDocument, selectedFeatureId: string | null): Crumb[] {
    const { nodes, owner } = buildSelectionChain(doc, selectedFeatureId);

    const crumbs: Crumb[] = [];
    for (const n of nodes) {
        const mode = detectNodeModeType(n);
        if (n.nodeType === NodeType.ASSEMBLY) {
            crumbs.push({ id: n.id, label: nodeLabel(n), kind: 'assembly', modeType: mode });
        } else if (n.nodeType === NodeType.PART) {
            crumbs.push({ id: n.id, label: nodeLabel(n), kind: 'panel', modeType: 'smartpanel' });
        } else if (n.nodeType === NodeType.HARDWARE) {
            crumbs.push({ id: n.id, label: nodeLabel(n), kind: 'hardware', modeType: 'hardware' });
        }
    }

    // Tylko TA zaznaczona operacja — nie lista wszystkich na panelu.
    if (owner) {
        crumbs.push({
            id: owner.feature.id,
            label: featureLabel(owner.feature),
            kind: 'feature',
            modeType: 'feature',
            panelId: owner.node.id,
        });
    }

    return crumbs;
}

function selectCrumb(crumb: Crumb, clearFeature?: () => void) {
    const ui = UIController.instance;
    if (!ui) return;
    if (crumb.kind === 'assembly') {
        clearFeature?.();
        ui.emitTree('select-container', { id: crumb.id });
        if (crumb.modeType === 'smartframe') {
            window.dispatchEvent(new CustomEvent('cad-switch-tab', { detail: { tabId: 'tab-a3-smartframe' } }));
            window.dispatchEvent(new CustomEvent('cad-edit-smartframe-korpus', { detail: { containerId: crumb.id } }));
        } else if (crumb.modeType === 'bloki') {
            window.dispatchEvent(new CustomEvent('cad-switch-tab', { detail: { tabId: 'tab-a2-bloki' } }));
        }
    } else if (crumb.kind === 'panel') {
        clearFeature?.();
        ui.emitTree('select-part', { id: crumb.id, uuid: crumb.id });
        window.dispatchEvent(new CustomEvent('cad-switch-tab', { detail: { tabId: 'tab-a4-smartpanel' } }));
    } else if (crumb.kind === 'hardware') {
        clearFeature?.();
        ui.emitTree('select-hardware', { id: crumb.id });
    } else if (crumb.kind === 'feature' && crumb.panelId) {
        ui.emitTree('select-feature', { id: crumb.id, panelId: crumb.panelId, openProperties: false });
        window.dispatchEvent(new CustomEvent('cad-switch-tab', { detail: { tabId: 'tab-o1-operacji' } }));
    }
}

function crumbTooltip(crumb: Crumb): string {
    switch (crumb.modeType) {
        case 'smartframe':
            return tx(srcTekst, 'crumb.cabinet', TX_NS, { name: crumb.label });
        case 'bloki':
            return tx(srcTekst, 'crumb.box', TX_NS, { name: crumb.label });
        case 'smartpanel':
            return tx(srcTekst, 'crumb.panel', TX_NS, { name: crumb.label });
        case 'feature':
            return tx(srcTekst, 'crumb.feature', TX_NS, { name: crumb.label });
        case 'hardware':
            return tx(srcTekst, 'crumb.hardware', TX_NS, { name: crumb.label });
        default:
            return `${crumb.label}`;
    }
}

interface BelkaHierarchyBarProps {
    projectModel?: ProjectDocument | null;
}

export const BelkaHierarchyBar: React.FC<BelkaHierarchyBarProps> = ({ projectModel }) => {
    useLocale();
    const [crumbs, setCrumbs] = useState<Crumb[]>([]);
    const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

    const refresh = useCallback(() => {
        const doc = projectModel || ContextManager.instance.document;
        if (!doc) {
            setCrumbs([]);
            return;
        }
        setCrumbs(buildPath(doc, selectedFeatureId));
    }, [projectModel, selectedFeatureId]);

    useEffect(() => {
        refresh();
        const doc = projectModel || ContextManager.instance.document;
        const unsub = doc?.onDocumentChanged?.(() => {
            setSelectedFeatureId((prev) => resolveFeatureId(doc, prev));
            refresh();
        });

        const onProps = (e: any) => {
            if (e.detail?.featureId) {
                setSelectedFeatureId(String(e.detail.featureId));
            } else if (e.detail?.kind === 'panel' || e.detail?.kind === 'container') {
                setSelectedFeatureId(null);
            }
        };
        document.addEventListener('bloki-properties-update', onProps);

        const onFloatingOp = (e: Event) => {
            const d = (e as CustomEvent).detail || {};
            if (d.featureId) setSelectedFeatureId(String(d.featureId));
        };
        window.addEventListener(CAD_OPEN_FLOATING_OPERATION, onFloatingOp);

        const onProject = () => refresh();
        window.document.addEventListener('bloki-project-changed', onProject);
        window.document.addEventListener('smartpanel-project-changed', onProject);

        return () => {
            unsub?.();
            document.removeEventListener('bloki-properties-update', onProps);
            window.removeEventListener(CAD_OPEN_FLOATING_OPERATION, onFloatingOp);
            window.document.removeEventListener('bloki-project-changed', onProject);
            window.document.removeEventListener('smartpanel-project-changed', onProject);
        };
    }, [projectModel, refresh]);

    if (crumbs.length === 0) return null;

    const clearFeature = () => setSelectedFeatureId(null);

    return (
        <div
            id="belka-hierarchia"
            className="belka-hierarchia"
            aria-label={tx(srcTekst, 'crumb.hierarchy', TX_NS)}
            data-ui-name={tx(srcTekst, 'crumb.hierarchy', TX_NS)}
        >
            {crumbs.map((crumb, idx) => {
                const isLast = idx === crumbs.length - 1;
                return (
                    <React.Fragment key={`${crumb.kind}:${crumb.id}`}>
                        {idx > 0 && (
                            <span className="belka-hierarchia-sep" aria-hidden>
                                ›
                            </span>
                        )}
                        <button
                            type="button"
                            className={`belka-hierarchia-btn ${isLast ? 'is-current' : ''}`}
                            title={crumbTooltip(crumb)}
                            onClick={() => selectCrumb(crumb, clearFeature)}
                        >
                            {crumb.label}
                        </button>
                    </React.Fragment>
                );
            })}
        </div>
    );
};
