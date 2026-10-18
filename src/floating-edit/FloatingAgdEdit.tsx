/**
 * Formularz edycji AGD w oknie na scenie: referencje wnęki + wymiary frontu.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ContextManager } from '../../A1_core/context-manager.js';
import type { ContainerModel } from '../../A1_core/container-model.js';
import {
    getApplianceParamsMm,
    rebuildSmartAppliance,
    syncApplianceBayFromRefs,
} from '../../A6_agd/smart-appliance-core.js';
import type { MicrowaveParamsMm } from '../../A6_agd/smart-appliance-types.js';
import {
    BayReferenceWallsPanel,
    type BayRefsParamsPatch,
} from '../../A2_bloki/02_bay-reference-walls-panel.js';
import { customReferencesFromDetectedBay } from '../../A2_bloki/hangers/smartpart-bay-placement.js';

const fieldRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
    width: '72px',
    padding: '4px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '4px',
    textAlign: 'right',
    fontSize: '12px',
};

export function FloatingAgdEdit({ container }: { container: ContainerModel }): React.JSX.Element | null {
    const [params, setParams] = useState<MicrowaveParamsMm | null>(null);

    useEffect(() => {
        if (!container) {
            setParams(null);
            return;
        }
        const gp = container.generatorParams || {};
        if (!gp.customReferences && gp.detectedBay) {
            gp.customReferences = customReferencesFromDetectedBay(gp.detectedBay);
            gp.disabledReferences = gp.disabledReferences || {};
            gp.offsets = gp.offsets || { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 };
            gp.side_references_bloki = gp.side_references_bloki || 'INNER';
            container.generatorParams = { ...gp };
        }
        setParams(getApplianceParamsMm(container));
    }, [container, container?.id]);

    const handleRefsPatch = useCallback((patch: BayRefsParamsPatch) => {
        if (!container) return;
        container.generatorParams = {
            ...(container.generatorParams || {}),
            ...patch,
        };
        const doc = ContextManager.instance.document;
        syncApplianceBayFromRefs(container, doc);
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
        if (typeof (window as any).__rebuildGeometry === 'function') {
            (window as any).__rebuildGeometry('AGD odniesienia');
        }
        ContextManager.instance.viewport?.requestRender?.(4);
    }, [container]);

    const handleParamChange = (key: keyof MicrowaveParamsMm, value: number) => {
        if (!container || !params) return;
        const newParams = { ...params, [key]: value };
        setParams(newParams);
        if (!container.generatorParams) container.generatorParams = {};
        container.generatorParams[key] = value;
        const doc = ContextManager.instance.document;
        rebuildSmartAppliance(container, doc);
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
    };

    if (!container || !params) return null;

    const calculatedCorpusHeight = Math.max(50, params.frontHeight - params.nalGoraMicro - params.nalDolneMicro);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <BayReferenceWallsPanel
                container={container}
                defaultOpen={true}
                onParamsPatch={handleRefsPatch}
            />

            <div style={{ fontSize: '11px', fontWeight: 700, color: '#e4e4e7' }}>
                Wymiary &amp; położenie frontu
            </div>

            {(
                [
                    ['frontHeight', 'Wysokość frontu'],
                    ['nalGoraMicro', 'Nałożenie górne'],
                    ['nalDolneMicro', 'Nałożenie dolne'],
                    ['frontWidth', 'Szerokość frontu'],
                    ['corpusWidth', 'Szerokość korpusu wnęki'],
                    ['corpusDepth', 'Głębokość korpusu wnęki'],
                    ['frontDepth', 'Grubość frontu'],
                ] as Array<[keyof MicrowaveParamsMm, string]>
            ).map(([key, label]) => (
                <div key={key} style={fieldRow}>
                    <span style={{ color: '#cbd5e1', fontSize: '11px' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="number"
                            style={inputStyle}
                            value={params[key] as number}
                            onChange={(e) => handleParamChange(key, parseFloat(e.target.value) || 0)}
                        />
                        <span style={{ color: '#71717a', fontSize: '10px' }}>mm</span>
                    </div>
                </div>
            ))}

            <div
                style={{
                    padding: '6px 8px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                }}
            >
                <span style={{ color: '#94a3b8' }}>Wysokość korpusu wnęki</span>
                <strong style={{ color: '#93c5fd' }}>{calculatedCorpusHeight} mm</strong>
            </div>
        </div>
    );
}
