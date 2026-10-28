/**
 * Formularz edycji Bloku w oknie na scenie: referencje wnęki + UIComponent wtyczki.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { ContextManager } from '../../A1_core/context-manager.js';
import { update_bloki_core } from '../../A2_bloki/01_bloki-core.js';
import { SmartModuleRegistry } from '../../A2_bloki/core/smart-module-registry.js';
import type { BlokiGeneratorParamsPatch, BlokiModuleId } from '../../A2_bloki/01_bloki-module-types.js';
import {
    BayReferenceWallsPanel,
    type BayRefsParamsPatch,
} from '../../A2_bloki/02_bay-reference-walls-panel.js';
import {
    updateSmartPartHangersGroup,
} from '../../A2_bloki/hangers/hanger-apply.js';
import { SMARTPART_HANGERS_GROUP_TYPE } from '../../A2_bloki/hangers/hanger-types.js';
import { SMARTPART_HANDLE_TYPE } from '../../A2_bloki/handles/handle-types.js';
import { HandleEditPanel } from '../../A2_bloki/handles/handle-edit-panel.js';
import { SMARTPART_SINK_TYPE } from '../../A2_bloki/sinks/sink-types.js';
import { SinkEditPanel } from '../../A2_bloki/sinks/sink-edit-panel.js';

function isHangersGroup(model: any): boolean {
    if (!model) return false;
    const gp = model.generatorParams || {};
    const role = String(model.role || '');
    return gp.type === SMARTPART_HANGERS_GROUP_TYPE || role === 'SMARTPART_HANGERS';
}

function isHandleContainer(model: any): boolean {
    if (!model) return false;
    const gp = model.generatorParams || {};
    const role = String(model.role || '');
    return gp.type === SMARTPART_HANDLE_TYPE || gp.type === 'blok_handle'
        || role === 'SMARTPART_HANDLE' || gp.boxType === 'HANDLES';
}

function isSinkContainer(model: any): boolean {
    if (!model) return false;
    const gp = model.generatorParams || {};
    const role = String(model.role || '');
    return gp.type === SMARTPART_SINK_TYPE || gp.type === 'blok_sink'
        || role === 'SMARTPART_SINK' || gp.boxType === 'SINKS';
}

function resolveBoxType(container: any): string {
    if (isHangersGroup(container)) return 'HANGERS';
    if (isHandleContainer(container)) return 'HANDLES';
    if (isSinkContainer(container)) return 'SINKS';
    const p = container?.generatorParams || {};
    if (p.boxType) return String(p.boxType);
    const t = String(p.type || '');
    if (t.startsWith('blok_')) {
        const map: Record<string, string> = {
            blok_shelves: 'SHELVES',
            blok_doors: 'DOORS',
            blok_skosne_drzwi: 'SKOSNE_DOORS',
            blok_corner_doors: 'CORNER_DOORS',
            blok_corner_shelves: 'CORNER_SHELVES',
            blok_drawers: 'DRAWERS',
            blok_flaps: 'FLAPS',
            blok_dividers: 'DIVIDERS',
            blok_tubes: 'TUBES',
            blok_shelf: 'SHELF',
            blok_panels: 'PANELS',
            blok_led_internal: 'LED_INTERNAL',
            blok_led_external: 'LED_EXTERNAL',
            blok_handle: 'HANDLES',
            blok_empty: 'EMPTY',
        };
        return map[t] || 'EMPTY';
    }
    return 'EMPTY';
}

export function FloatingBlokEdit({ container }: { container: any }): React.JSX.Element | null {
    const pendingRef = useRef<Record<string, unknown>>({});
    const rafRef = useRef<number | null>(null);

    const boxType = useMemo(() => resolveBoxType(container), [container, container?.generatorParams]);

    const flushUpdate = useCallback(() => {
        if (!container) return;
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        const updates = { ...pendingRef.current };
        pendingRef.current = {};
        container.generatorParams = { ...container.generatorParams, ...updates };

        const doc = ContextManager.instance.document;
        if (isHangersGroup(container)) {
            const node = doc?.findNode?.(container.id);
            if (node) updateSmartPartHangersGroup(node, doc);
            if (typeof (window as any).__rebuildGeometry === 'function') {
                (window as any).__rebuildGeometry('SmartPart offset');
            }
        } else if (!isHandleContainer(container)) {
            update_bloki_core(container, doc);
            if (typeof (window as any).__rebuildGeometry === 'function') {
                (window as any).__rebuildGeometry('Bloki update');
            } else if (typeof (doc as any)?._notify === 'function') {
                (doc as any)._notify();
            } else if (doc?.emitChange) {
                doc.emitChange('all');
            }
        }

        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
    }, [container]);

    const triggerUpdate = useCallback((updatedParams: BlokiGeneratorParamsPatch) => {
        if (!container) return;
        pendingRef.current = { ...pendingRef.current, ...updatedParams };
        container.generatorParams = { ...container.generatorParams, ...updatedParams };
        if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                flushUpdate();
            });
        }
    }, [container, flushUpdate]);

    const handleRefsPatch = useCallback((patch: BayRefsParamsPatch) => {
        triggerUpdate(patch as BlokiGeneratorParamsPatch);
    }, [triggerUpdate]);

    if (!container) return null;

    if (isHandleContainer(container)) {
        return <HandleEditPanel container={container} />;
    }

    if (isSinkContainer(container)) {
        return <SinkEditPanel container={container} />;
    }

    const plugin = boxType !== 'EMPTY' && boxType !== 'HANGERS'
        ? SmartModuleRegistry.get(boxType as BlokiModuleId)
        : undefined;
    const SubComponent = plugin?.UIComponent;
    const label = plugin?.meta.label || (isHangersGroup(container) ? 'Zawieszki' : boxType);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
                Moduł: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{label}</span>
            </div>

            <BayReferenceWallsPanel
                container={container}
                defaultOpen={isHangersGroup(container) || boxType === 'CORNER_DOORS'}
                onParamsPatch={handleRefsPatch}
            />

            {SubComponent ? (
                <div
                    style={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '6px',
                        padding: '8px',
                    }}
                >
                    <SubComponent container={container} triggerUpdate={triggerUpdate} />
                </div>
            ) : isHangersGroup(container) ? (
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                    Edytuj ściany odniesienia powyżej — ten sam schemat wnęki co Blok.
                </div>
            ) : boxType === 'EMPTY' ? (
                <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
                    Pusty Blok — wybierz typ modułu z palety w zakładce Bloki.
                </div>
            ) : null}
        </div>
    );
}
