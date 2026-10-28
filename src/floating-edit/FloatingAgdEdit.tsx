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
import type { MicrowaveParamsMm, FridgeParamsMm } from '../../A6_agd/smart-appliance-types.js';
import {
    BayReferenceWallsPanel,
    type BayRefsParamsPatch,
} from '../../A2_bloki/02_bay-reference-walls-panel.js';
import { customReferencesFromDetectedBay } from '../../A2_bloki/hangers/smartpart-bay-placement.js';
import { resolveDetectedBay } from '../../A2_bloki/02_bloki-bay-detector.js';

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
    const [params, setParams] = useState<any | null>(null);

    useEffect(() => {
        if (!container) {
            setParams(null);
            return;
        }
        const gp = container.generatorParams || {};
        if (!gp.customReferences) {
            const resolvedBay = resolveDetectedBay(gp);
            if (resolvedBay) {
                gp.customReferences = customReferencesFromDetectedBay(resolvedBay);
                gp.disabledReferences = gp.disabledReferences || {};
                gp.offsets = gp.offsets || { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 };
                gp.side_references_bloki = gp.side_references_bloki || 'INNER';
                container.generatorParams = { ...gp };
            }
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

    const handleParamChange = (key: string, value: number) => {
        if (!container || !params) return;
        const isF = container.generatorParams?.kind === 'FRIDGE';
        const newParams: Record<string, any> = { ...params, [key]: value };

        if (isF) {
            const totH = key === 'totalHeight' ? value : Number(newParams.totalHeight || 1850);
            const btmH = key === 'frontBottomHeight' ? value : Number(newParams.frontBottomHeight || 714);
            const gap = 4;
            const topH = Math.max(50, totH - btmH - gap);
            newParams.frontTopHeight = topH;
            newParams.totalHeight = totH;
            newParams.plinthHeight = 0;
            newParams.doorGap = 4;
            if (!container.generatorParams) container.generatorParams = {};
            container.generatorParams.frontTopHeight = topH;
            container.generatorParams.totalHeight = totH;
            container.generatorParams.plinthHeight = 0;
            container.generatorParams.doorGap = 4;
        }

        setParams(newParams);
        if (!container.generatorParams) container.generatorParams = {};
        container.generatorParams[key] = value;
        const doc = ContextManager.instance.document;
        rebuildSmartAppliance(container, doc);
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
    };

    if (!container || !params) return null;

    const isFridge = container.generatorParams?.kind === 'FRIDGE';

    const totalApplianceHeight = isFridge
        ? Number(params.totalHeight || 1850)
        : Number(params.frontHeight || 0);

    const calculatedFrontTopH = isFridge
        ? Math.max(50, totalApplianceHeight - Number(params.frontBottomHeight || 714) - 4)
        : 0;

    const totalApplianceDepth = isFridge
        ? (Number(params.corpusDepth || 650) + Number(params.doorDepth ?? params.frontDepth ?? 45))
        : (Number(params.corpusDepth || 550) + Number(params.frontDepth || 20));

    const calculatedCorpusHeight = isFridge
        ? totalApplianceHeight
        : Math.max(50, Number(params.frontHeight || 0) - Number(params.nalGoraMicro || 0) - Number(params.nalDolneMicro || 0));

    const isSideBySide = isFridge && (params.doorLayout === 'SIDE_BY_SIDE' || !params.doorLayout);
    const isSingleDoor = isFridge && params.doorLayout === 'SINGLE';
    const isTopBottom = isFridge && params.doorLayout === 'TOP_BOTTOM';

    const calculatedHalfDoorW = isSideBySide
        ? Math.max(50, Math.round(((Number(params.corpusWidth || 900) - 4) / 2) * 10) / 10)
        : 0;

    const fields: Array<[string, string]> = isFridge
        ? (isTopBottom
            ? [
                ['totalHeight', 'Wysokość całkowita'],
                ['frontBottomHeight', 'Drzwi dolne'],
                ['corpusWidth', 'Szerokość lodówki'],
                ['corpusDepth', 'Głębokość lodówki'],
            ]
            : [
                ['totalHeight', 'Wysokość całkowita'],
                ['corpusWidth', 'Szerokość lodówki'],
                ['corpusDepth', 'Głębokość lodówki'],
            ]
        )
        : [
            ['frontHeight', 'Wysokość frontu'],
            ['nalGoraMicro', 'Nałożenie górne'],
            ['nalDolneMicro', 'Nałożenie dolne'],
            ['frontWidth', 'Szerokość frontu'],
            ['corpusWidth', 'Szerokość korpusu wnęki'],
            ['corpusDepth', 'Głębokość korpusu wnęki'],
            ['frontDepth', 'Grubość frontu'],
        ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <BayReferenceWallsPanel
                container={container}
                defaultOpen={true}
                onParamsPatch={handleRefsPatch}
            />

            <div style={{ fontSize: '11px', fontWeight: 700, color: '#e4e4e7' }}>
                {isFridge ? 'Wymiary & komponenty lodówki' : 'Wymiary & położenie frontu'}
            </div>

            {isFridge && (
                <>
                    <div style={fieldRow}>
                        <span style={{ color: '#cbd5e1', fontSize: '11px' }}>Układ drzwi</span>
                        <select
                            style={{
                                background: '#18181b',
                                color: '#e4e4e7',
                                border: '1px solid #3f3f46',
                                borderRadius: '4px',
                                padding: '3px 6px',
                                fontSize: '11px',
                            }}
                            value={params.doorLayout || 'SIDE_BY_SIDE'}
                            onChange={(e) => {
                                const val = e.target.value;
                                const newParams: Record<string, any> = { ...params, doorLayout: val };
                                setParams(newParams);
                                if (!container.generatorParams) container.generatorParams = {};
                                container.generatorParams.doorLayout = val;
                                const doc = ContextManager.instance.document;
                                rebuildSmartAppliance(container, doc);
                                window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
                            }}
                        >
                            <option value="SIDE_BY_SIDE">Dwa drzwi w pionie (Side-by-Side)</option>
                            <option value="TOP_BOTTOM">Góra / Dół (chłodziarko-zamrażarka)</option>
                            <option value="SINGLE">Pojedyncze drzwi</option>
                        </select>
                    </div>

                    <div style={fieldRow}>
                        <span style={{ color: '#cbd5e1', fontSize: '11px' }}>Kolor lodówki</span>
                        <select
                            style={{
                                background: '#18181b',
                                color: '#e4e4e7',
                                border: '1px solid #3f3f46',
                                borderRadius: '4px',
                                padding: '3px 6px',
                                fontSize: '11px',
                            }}
                            value={params.finish || 'INOX'}
                            onChange={(e) => {
                                const val = e.target.value;
                                const newParams: Record<string, any> = { ...params, finish: val };
                                setParams(newParams);
                                if (!container.generatorParams) container.generatorParams = {};
                                container.generatorParams.finish = val;
                                const doc = ContextManager.instance.document;
                                rebuildSmartAppliance(container, doc);
                                window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
                            }}
                        >
                            <option value="INOX">Stal szlachetna / Inox</option>
                            <option value="BLACK">Elegancki czarny mat</option>
                            <option value="WHITE">Biały lakier AGD</option>
                        </select>
                    </div>
                </>
            )}

            {fields.map(([key, label]) => (
                <div key={key}>
                    <div style={fieldRow}>
                        <span style={{ color: '#cbd5e1', fontSize: '11px' }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                                type="number"
                                style={inputStyle}
                                value={
                                    params[key] !== undefined
                                        ? params[key]
                                        : (key === 'totalHeight' ? 1775 : key === 'plinthHeight' ? 40 : 0)
                                }
                                onChange={(e) => handleParamChange(key, parseFloat(e.target.value) || 0)}
                            />
                            <span style={{ color: '#71717a', fontSize: '10px' }}>mm</span>
                        </div>
                    </div>

                    {isFridge && key === 'frontBottomHeight' && (
                        <div style={fieldRow}>
                            <span style={{ color: '#cbd5e1', fontSize: '11px' }}>Drzwi górne</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="number"
                                    style={{
                                        ...inputStyle,
                                        opacity: 0.9,
                                        cursor: 'default',
                                        backgroundColor: '#1f2937',
                                    }}
                                    readOnly
                                    value={calculatedFrontTopH}
                                />
                                <span style={{ color: '#71717a', fontSize: '10px' }}>mm</span>
                            </div>
                        </div>
                    )}

                    {isSideBySide && key === 'corpusWidth' && (
                        <div style={fieldRow}>
                            <span style={{ color: '#cbd5e1', fontSize: '11px' }}>Szerokość 1 skrzydła</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="number"
                                    style={{
                                        ...inputStyle,
                                        opacity: 0.9,
                                        cursor: 'default',
                                        backgroundColor: '#1f2937',
                                    }}
                                    readOnly
                                    value={calculatedHalfDoorW}
                                />
                                <span style={{ color: '#71717a', fontSize: '10px' }}>mm</span>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {!isFridge && (
                <div
                    style={{
                        padding: '6px 8px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8' }}>Wysokość korpusu wnęki</span>
                        <strong style={{ color: '#93c5fd' }}>{calculatedCorpusHeight} mm</strong>
                    </div>
                </div>
            )}
        </div>
    );
}
