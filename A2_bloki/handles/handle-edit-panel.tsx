/**
 * Formularz edycji uchwytu SmartPart — wspólny dla okna pływającego (i ewentualnie panelu).
 */

import React, { useEffect, useState } from 'react';
import {
    DEFAULT_HANDLE_PARAMS,
    REJS_BAR_SERIES,
    DEFAULT_REJS_SERIES_ID,
    getRejsSeries,
    resolveRejsSize,
    resolveHandleGlbFile,
    HANDLE_PLACEMENT_OPTIONS,
    HANDLE_COLOR_OPTIONS,
    DEFAULT_HANDLE_COLOR_ID,
    resolveHandleColor,
    isCenterLockPreset,
    getCenterLockAxes,
    type HandleParamsMm,
    type HandlePlacementPreset,
    type HandleOrientation,
    type HandleColorId,
    type EdgeU,
    type EdgeV,
    SMARTPART_HANDLE_TYPE,
} from './handle-types.js';
import {
    computeHandleLayout,
    computeHandleCenterFromUV,
    computeUVFromCenter,
    rebindHandleEdge,
    buildHandleParametricMesh,
    syncHandleDrillings,
    resolvePanelThicknessMm,
} from './handle-engine.js';
import { HandleDimGizmo } from './handle-dim-gizmo.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { SmartNumericInput } from '../../A1_core/ui/SmartNumericInput.js';
import { nmToMm, mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';

function paramsFromContainer(container: any): HandleParamsMm {
    const gp = container?.generatorParams || {};
    return {
        totalLengthMm: gp.totalLengthMm ?? DEFAULT_HANDLE_PARAMS.totalLengthMm,
        holeDistanceMm: gp.holeDistanceMm ?? DEFAULT_HANDLE_PARAMS.holeDistanceMm,
        depthMm: gp.depthMm ?? DEFAULT_HANDLE_PARAMS.depthMm,
        thicknessMm: gp.thicknessMm ?? DEFAULT_HANDLE_PARAMS.thicknessMm,
        footDiameterMm: gp.footDiameterMm ?? DEFAULT_HANDLE_PARAMS.footDiameterMm,
        offsetEdgeXMm: gp.offsetEdgeXMm ?? DEFAULT_HANDLE_PARAMS.offsetEdgeXMm,
        offsetEdgeYMm: gp.offsetEdgeYMm ?? DEFAULT_HANDLE_PARAMS.offsetEdgeYMm,
        orientation: gp.orientation ?? DEFAULT_HANDLE_PARAMS.orientation,
        placementPreset: gp.placementPreset ?? DEFAULT_HANDLE_PARAMS.placementPreset,
        face: gp.face ?? DEFAULT_HANDLE_PARAMS.face,
        uMm: gp.uMm ?? DEFAULT_HANDLE_PARAMS.uMm,
        vMm: gp.vMm ?? DEFAULT_HANDLE_PARAMS.vMm,
        uEdge: gp.uEdge ?? DEFAULT_HANDLE_PARAMS.uEdge,
        vEdge: gp.vEdge ?? DEFAULT_HANDLE_PARAMS.vEdge,
        drillingEnabled: gp.drillingEnabled ?? DEFAULT_HANDLE_PARAMS.drillingEnabled,
        drillDiameterMm: gp.drillDiameterMm ?? DEFAULT_HANDLE_PARAMS.drillDiameterMm,
        colorId: gp.colorId ?? DEFAULT_HANDLE_COLOR_ID,
        color: gp.color ?? resolveHandleColor(gp.colorId ?? DEFAULT_HANDLE_COLOR_ID).color,
        glbModelPath: gp.glbModelPath,
        handleType: gp.handleType ?? (gp.holeDistanceMm === 0 ? 'KNOB' : 'BAR'),
        producerId: gp.producerId ?? 'rejs',
        seriesId: gp.seriesId ?? DEFAULT_REJS_SERIES_ID,
        placementLocked: gp.placementLocked === true && isCenterLockPreset(gp.placementPreset),
    };
}

export function HandleEditPanel({ container }: { container: any }): React.JSX.Element | null {
    const [params, setParams] = useState<HandleParamsMm>(() => paramsFromContainer(container));

    useEffect(() => {
        setParams(paramsFromContainer(container));
        if (container) HandleDimGizmo.instance.attach(container);
        return () => {
            HandleDimGizmo.instance.detach();
        };
    }, [container?.id]);

    if (!container) return null;

    const getDoc = () => ContextManager.instance.document || (window as any).__cad_document;

    const resolveTargetPanelSizeMm = (): { widthMm: number; heightMm: number } => {
        const gp = container.generatorParams || {};
        const doc = getDoc();
        const targetPanel = gp.targetPanelId && doc ? doc.findNode(gp.targetPanelId) : null;
        const panelModel = targetPanel?.domainData;
        return {
            widthMm: gp.panelWidthMm ?? (panelModel?.width ? nmToMm(panelModel.width) : 0),
            heightMm: gp.panelHeightMm ?? (panelModel?.height ? nmToMm(panelModel.height) : 0),
        };
    };

    const applyUpdatedParams = (newParams: HandleParamsMm) => {
        setParams(newParams);
        if (!container.generatorParams) container.generatorParams = {};
        Object.assign(container.generatorParams, newParams);

        const doc = getDoc();
        if (!doc) return;
        const cntNode = doc.findNode(container.id);
        if (!cntNode) return;

        const targetPanel = container.generatorParams.targetPanelId
            ? doc.findNode(container.generatorParams.targetPanelId)
            : null;
        const panelModel = targetPanel?.domainData;
        const panelWMm = container.generatorParams.panelWidthMm ?? (panelModel ? nmToMm(panelModel.width) : 0);
        const panelHMm = container.generatorParams.panelHeightMm ?? (panelModel ? nmToMm(panelModel.height) : 0);
        const panelTMm = container.generatorParams.panelThicknessMm
            ?? (panelModel ? resolvePanelThicknessMm(panelModel) : 0);

        const layout = computeHandleLayout(newParams, panelWMm, panelHMm);
        container.generatorParams.overhangMm = layout.overhangMm;

        const isHoriz = newParams.orientation === 'HORIZONTAL';
        container.width = mmToNm(isHoriz ? newParams.totalLengthMm : newParams.thicknessMm);
        container.height = mmToNm(isHoriz ? newParams.thicknessMm : newParams.totalLengthMm);
        container.depth = mmToNm(newParams.depthMm);

        const faceZ = container.generatorParams.faceZ ?? -panelTMm / 2;
        const normalZ = container.generatorParams.normalZ ?? -1;
        cntNode.setLocalTransform(
            new Vec3(mmToNm(layout.center.x), mmToNm(faceZ), mmToNm(layout.center.y)),
            Quat.IDENTITY,
        );

        buildHandleParametricMesh(cntNode, newParams, layout, faceZ, normalZ);

        const parentId = container.generatorParams.targetPanelId || cntNode.parent?.id;
        const targetPanelNode = parentId ? doc.findNode(parentId) : null;
        if (targetPanelNode) {
            syncHandleDrillings(doc, targetPanelNode, container, layout, newParams, normalZ);
        }

        const hwNode = cntNode.children?.find((c: any) => c.nodeType === 'HARDWARE');
        if (hwNode?.domainData) {
            hwNode.domainData.c_c = newParams.holeDistanceMm;
            hwNode.domainData.length = newParams.totalLengthMm;
            if (newParams.glbModelPath) {
                hwNode.domainData.hardwareId = newParams.glbModelPath.replace(/\.glb$/i, '');
            }
            if (hwNode.domainData.custom_properties) {
                hwNode.domainData.custom_properties.orientation = newParams.orientation;
                hwNode.domainData.custom_properties.drillingEnabled = newParams.drillingEnabled;
                hwNode.domainData.custom_properties.drillDiameterMm = newParams.drillDiameterMm;
                hwNode.domainData.custom_properties.holes = layout.holes;
            }
        }

        const cView = ContextManager.instance?.containerViews?.get(container);
        if (cView && typeof cView.update === 'function') cView.update();
        HandleDimGizmo.instance.update();

        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
    };

    const handleParamChange = (key: keyof HandleParamsMm, value: any) => {
        applyUpdatedParams({ ...params, [key]: value });
    };

    const placementLocked = params.placementLocked === true && isCenterLockPreset(params.placementPreset);
    const { lockU, lockV } = placementLocked
        ? getCenterLockAxes(params.placementPreset)
        : { lockU: false, lockV: false };
    const activeSeries = getRejsSeries(params.seriesId);
    const isBarHandle = (params.handleType ?? (params.holeDistanceMm === 0 ? 'KNOB' : 'BAR')) === 'BAR';

    const selectPreset = (preset: HandlePlacementPreset, locked = true, baseParams: HandleParamsMm = params) => {
        const { widthMm: panelWMm, heightMm: panelHMm } = resolveTargetPanelSizeMm();
        if (!(panelWMm > 0) || !(panelHMm > 0)) return;
        if (preset === 'CUSTOM' || !isCenterLockPreset(preset)) {
            applyUpdatedParams({ ...baseParams, placementPreset: 'CUSTOM', placementLocked: false });
            return;
        }

        let current = { x: 0, y: 0 };
        if (typeof baseParams.uMm === 'number' && typeof baseParams.vMm === 'number') {
            current = computeHandleCenterFromUV(
                baseParams.uMm,
                baseParams.vMm,
                baseParams.uEdge || 'FACE_X_MINUS',
                baseParams.vEdge || 'FACE_Y_PLUS',
                panelWMm,
                panelHMm,
                baseParams.orientation,
                baseParams.holeDistanceMm,
            );
        }

        const center = preset === 'CENTER'
            ? { x: 0, y: 0 }
            : preset === 'CENTER_HORIZONTAL'
                ? { x: 0, y: current.y }
                : { x: current.x, y: 0 };

        const uEdge: EdgeU = baseParams.uEdge || 'FACE_X_MINUS';
        const vEdge: EdgeV = baseParams.vEdge || 'FACE_Y_PLUS';
        const uv = computeUVFromCenter(
            center.x,
            center.y,
            uEdge,
            vEdge,
            panelWMm,
            panelHMm,
            baseParams.orientation,
            baseParams.holeDistanceMm,
        );

        applyUpdatedParams({
            ...baseParams,
            placementPreset: preset,
            placementLocked: locked,
            uEdge,
            vEdge,
            uMm: uv.uMm,
            vMm: uv.vMm,
        });
    };

    const togglePlacementLock = (preset: HandlePlacementPreset, checked: boolean) => {
        if (checked) selectPreset(preset, true);
        else applyUpdatedParams({ ...params, placementPreset: 'CUSTOM', placementLocked: false });
    };

    const applySeriesAndCc = (seriesId: string, holeDistanceMm: number) => {
        const size = resolveRejsSize(seriesId, holeDistanceMm);
        const next: HandleParamsMm = {
            ...params,
            seriesId,
            holeDistanceMm: size.holeDistanceMm,
            totalLengthMm: size.totalLengthMm,
            glbModelPath: resolveHandleGlbFile(seriesId, size.holeDistanceMm, params.handleType || 'BAR'),
        };
        if (params.placementLocked && isCenterLockPreset(params.placementPreset)) {
            selectPreset(params.placementPreset, true, next);
        } else {
            applyUpdatedParams(next);
        }
    };

    const toggleUEdge = () => {
        if (lockU) return;
        const { widthMm: panelWMm } = resolveTargetPanelSizeMm();
        if (!(panelWMm > 0)) return;
        const oldEdge = params.uEdge || 'FACE_X_MINUS';
        const newEdge: EdgeU = oldEdge === 'FACE_X_MINUS' ? 'FACE_X_PLUS' : 'FACE_X_MINUS';
        const holeOffset = (params.orientation || 'HORIZONTAL') === 'HORIZONTAL' ? (params.holeDistanceMm ?? 0) : 0;
        const newUMm = rebindHandleEdge(oldEdge, newEdge, params.uMm ?? panelWMm / 2, panelWMm, holeOffset);
        applyUpdatedParams({
            ...params,
            uEdge: newEdge,
            uMm: newUMm,
            ...(lockV ? {} : { placementPreset: 'CUSTOM' as HandlePlacementPreset, placementLocked: false }),
        });
    };

    const toggleVEdge = () => {
        if (lockV) return;
        const { heightMm: panelHMm } = resolveTargetPanelSizeMm();
        if (!(panelHMm > 0)) return;
        const oldEdge = params.vEdge || 'FACE_Y_PLUS';
        const newEdge: EdgeV = oldEdge === 'FACE_Y_PLUS' ? 'FACE_Y_MINUS' : 'FACE_Y_PLUS';
        const holeOffset = (params.orientation || 'HORIZONTAL') === 'VERTICAL' ? (params.holeDistanceMm ?? 0) : 0;
        const newVMm = rebindHandleEdge(oldEdge, newEdge, params.vMm ?? 35, panelHMm, holeOffset);
        applyUpdatedParams({
            ...params,
            vEdge: newEdge,
            vMm: newVMm,
            ...(lockU ? {} : { placementPreset: 'CUSTOM' as HandlePlacementPreset, placementLocked: false }),
        });
    };

    void SMARTPART_HANDLE_TYPE;

    const placementShort: Record<string, string> = {
        CENTER: 'Środek',
        CENTER_HORIZONTAL: 'Poz.',
        CENTER_VERTICAL: 'Pion.',
    };

    return (
        <div className="smartparts-edit-compact">
            {isBarHandle && (
                <div className="smartparts-edit-row">
                    <span className="smartparts-edit-label">Seria</span>
                    <select
                        className="smartparts-edit-select"
                        value={params.seriesId || DEFAULT_REJS_SERIES_ID}
                        onChange={(e) => {
                            const seriesId = e.target.value;
                            const series = getRejsSeries(seriesId);
                            const keep = series.sizes.find((s) => s.holeDistanceMm === params.holeDistanceMm);
                            applySeriesAndCc(seriesId, keep?.holeDistanceMm ?? series.sizes[0].holeDistanceMm);
                        }}
                    >
                        {REJS_BAR_SERIES.map((series) => (
                            <option key={series.id} value={series.id}>{series.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {isBarHandle ? (
                <div className="smartparts-edit-block">
                    <div className="smartparts-edit-row">
                        <span className="smartparts-edit-label">Rozmiar</span>
                        <span className="smartparts-edit-val">{params.holeDistanceMm} mm</span>
                    </div>
                    <div className="smartparts-std-chips">
                        {activeSeries.sizes.map((size) => (
                            <button
                                key={size.holeDistanceMm}
                                type="button"
                                className={`smartparts-chip ${params.holeDistanceMm === size.holeDistanceMm ? 'active' : ''}`}
                                onClick={() => applySeriesAndCc(params.seriesId || DEFAULT_REJS_SERIES_ID, size.holeDistanceMm)}
                                title={`${size.totalLengthMm} mm`}
                            >
                                {size.holeDistanceMm}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="smartparts-edit-row">
                <span className="smartparts-edit-label">Kolor</span>
                <select
                    className="smartparts-edit-select"
                    value={params.colorId || DEFAULT_HANDLE_COLOR_ID}
                    onChange={(e) => {
                        const colorId = e.target.value as HandleColorId;
                        const { color } = resolveHandleColor(colorId);
                        applyUpdatedParams({ ...params, colorId, color });
                    }}
                >
                    {HANDLE_COLOR_OPTIONS.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </select>
            </div>

            <div className="smartparts-edit-row">
                <span className="smartparts-edit-label">Pion / Poziom</span>
            </div>
            <div className="smartparts-toggle-row">
                <button
                    type="button"
                    className={`smartparts-toggle-btn ${params.orientation === 'HORIZONTAL' ? 'active' : ''}`}
                    title="Uchwyt poziomo"
                    onClick={() => {
                        const next = { ...params, orientation: 'HORIZONTAL' as HandleOrientation };
                        if (placementLocked && isCenterLockPreset(params.placementPreset)) {
                            selectPreset(params.placementPreset, true, next);
                        } else {
                            applyUpdatedParams(next);
                        }
                    }}
                >
                    <svg width="22" height="14" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: 'auto' }}>
                        <rect x="2" y="3" width="20" height="8" rx="2" strokeOpacity="0.35" strokeDasharray="2 2" />
                        <line x1="5" y1="7" x2="19" y2="7" strokeWidth="2.5" />
                        <circle cx="6" cy="7" r="1.5" fill="currentColor" />
                        <circle cx="18" cy="7" r="1.5" fill="currentColor" />
                    </svg>
                </button>
                <button
                    type="button"
                    className={`smartparts-toggle-btn ${params.orientation === 'VERTICAL' ? 'active' : ''}`}
                    title="Uchwyt pionowo"
                    onClick={() => {
                        const next = { ...params, orientation: 'VERTICAL' as HandleOrientation };
                        if (placementLocked && isCenterLockPreset(params.placementPreset)) {
                            selectPreset(params.placementPreset, true, next);
                        } else {
                            applyUpdatedParams(next);
                        }
                    }}
                >
                    <svg width="14" height="22" viewBox="0 0 14 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: 'auto' }}>
                        <rect x="3" y="2" width="8" height="20" rx="2" strokeOpacity="0.35" strokeDasharray="2 2" />
                        <line x1="7" y1="5" x2="7" y2="19" strokeWidth="2.5" />
                        <circle cx="7" cy="6" r="1.5" fill="currentColor" />
                        <circle cx="7" cy="18" r="1.5" fill="currentColor" />
                    </svg>
                </button>
            </div>

            <div className="smartparts-preset-checks">
                {HANDLE_PLACEMENT_OPTIONS.map((opt) => {
                    const checked = placementLocked && params.placementPreset === opt.id;
                    return (
                        <label key={opt.id} className={`smartparts-preset-check${checked ? ' is-active' : ''}`}>
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => togglePlacementLock(opt.id, e.target.checked)}
                            />
                            <span>{placementShort[opt.id] || opt.label}</span>
                        </label>
                    );
                })}
            </div>

            <div className={`smartparts-uv-box${placementLocked ? ' is-locked' : ''}`}>
                <div className="smartparts-edit-uv-row">
                    <button
                        type="button"
                        className="smartparts-edge-badge"
                        onClick={toggleUEdge}
                        disabled={lockU}
                        title={params.uEdge === 'FACE_X_MINUS' ? 'Od lewej krawędzi' : 'Od prawej krawędzi'}
                    >
                        {params.uEdge === 'FACE_X_MINUS' ? '◀' : '▶'}
                    </button>
                    <span className="smartparts-uv-axis-label">X:</span>
                    <SmartNumericInput
                        value={params.uMm ?? 0}
                        disabled={lockU}
                        min={0}
                        max={Math.max(resolveTargetPanelSizeMm().widthMm, params.uMm ?? 0)}
                        step={1}
                        decimals={1}
                        unit="mm"
                        style={{ flex: 1 }}
                        onChange={(val) =>
                            applyUpdatedParams({
                                ...params,
                                uMm: val,
                                ...(lockV
                                    ? { placementPreset: 'CENTER_VERTICAL' as HandlePlacementPreset, placementLocked: true }
                                    : { placementPreset: 'CUSTOM' as HandlePlacementPreset, placementLocked: false }),
                            })
                        }
                    />
                </div>

                <div className="smartparts-edit-uv-row">
                    <button
                        type="button"
                        className="smartparts-edge-badge"
                        onClick={toggleVEdge}
                        disabled={lockV}
                        title={params.vEdge === 'FACE_Y_PLUS' ? 'Od górnej krawędzi' : 'Od dolnej krawędzi'}
                    >
                        {params.vEdge === 'FACE_Y_PLUS' ? '▲' : '▼'}
                    </button>
                    <span className="smartparts-uv-axis-label">Y:</span>
                    <SmartNumericInput
                        value={params.vMm ?? 0}
                        disabled={lockV}
                        min={0}
                        max={Math.max(resolveTargetPanelSizeMm().heightMm, params.vMm ?? 0)}
                        step={1}
                        decimals={1}
                        unit="mm"
                        style={{ flex: 1 }}
                        onChange={(val) =>
                            applyUpdatedParams({
                                ...params,
                                vMm: val,
                                ...(lockU
                                    ? { placementPreset: 'CENTER_HORIZONTAL' as HandlePlacementPreset, placementLocked: true }
                                    : { placementPreset: 'CUSTOM' as HandlePlacementPreset, placementLocked: false }),
                            })
                        }
                    />
                </div>
            </div>

            <label className="smartparts-edit-drill">
                <input
                    type="checkbox"
                    checked={params.drillingEnabled}
                    onChange={(e) => handleParamChange('drillingEnabled', e.target.checked)}
                />
                <span>Średnica otworu</span>
                {params.drillingEnabled && (
                    <>
                        <input
                            type="number"
                            className="smartparts-edit-num"
                            min={2}
                            max={10}
                            step={0.5}
                            value={params.drillDiameterMm}
                            onChange={(e) => handleParamChange('drillDiameterMm', parseFloat(e.target.value) || 4.0)}
                        />
                        <span className="smartparts-edit-unit">mm</span>
                    </>
                )}
            </label>
        </div>
    );
}
