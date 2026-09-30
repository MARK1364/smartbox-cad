import React, { useState, useEffect } from 'react';
import './smartparts-ui.css';
import {
    DEFAULT_HANDLE_TEMPLATES,
    DEFAULT_HANDLE_PARAMS,
    type HandleParamsMm,
    type HandleTemplateItem,
    type HandlePlacementPreset,
    type HandleOrientation,
    type EdgeU,
    type EdgeV,
    computeHandleOverhang,
    SMARTPART_HANDLE_TYPE,
} from './handles/handle-types.js';
import {
    computeHandleLayout,
    computeHandleCenterMm,
    computeUVFromCenter,
    rebindHandleEdge,
    buildHandleParametricMesh,
    createSmartPartHandle,
    syncHandleDrillings,
    resolvePanelThicknessMm,
} from './handles/handle-engine.js';
import { HandleDragController } from './handles/handle-controller.js';
import { HandleDimGizmo } from './handles/handle-dim-gizmo.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { nmToMm, mmToNm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';

export function SmartPartsUI(): React.JSX.Element {
    const [activeContainer, setActiveContainer] = useState<any | null>(null);
    const [params, setParams] = useState<HandleParamsMm>(DEFAULT_HANDLE_PARAMS);

    const getDoc = () => ContextManager.instance.document || (window as any).__cad_document;

    /** Gabaryt formatki z generatorParams lub target panel — bez sztywnych 600/360. */
    const resolveTargetPanelSizeMm = (): { widthMm: number; heightMm: number } => {
        if (!activeContainer) return { widthMm: 0, heightMm: 0 };
        const gp = activeContainer.generatorParams || {};
        const doc = getDoc();
        const targetPanel = gp.targetPanelId && doc ? doc.findNode(gp.targetPanelId) : null;
        const panelModel = targetPanel?.domainData;
        return {
            widthMm: gp.panelWidthMm ?? (panelModel?.width ? nmToMm(panelModel.width) : 0),
            heightMm: gp.panelHeightMm ?? (panelModel?.height ? nmToMm(panelModel.height) : 0),
        };
    };

    const syncActiveHandle = () => {
        const doc = getDoc();
        if (!doc) return;

        const activeEntity = doc.activeEntity;
        if (
            activeEntity &&
            (activeEntity.role === 'SMARTPART_HANDLE' ||
             activeEntity.generatorParams?.type === SMARTPART_HANDLE_TYPE ||
             activeEntity.generatorParams?.partType === 'HANDLE')
        ) {
            setActiveContainer(activeEntity);
            const gp = activeEntity.generatorParams || {};
            const syncedParams: HandleParamsMm = {
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
                color: gp.color ?? DEFAULT_HANDLE_PARAMS.color,
                glbModelPath: gp.glbModelPath,
            };
            setParams(syncedParams);
            HandleDimGizmo.instance.attach(activeEntity);
        } else {
            setActiveContainer(null);
            HandleDimGizmo.instance.detach();
        }
    };

    useEffect(() => {
        syncActiveHandle();

        const doc = getDoc();
        let unsubDoc: (() => void) | null = null;
        if (doc) {
            unsubDoc = doc.onDocumentChanged(syncActiveHandle);
        }

        const handleProjectChange = () => syncActiveHandle();
        window.document.addEventListener('bloki-project-changed', handleProjectChange);
        window.document.addEventListener('bloki-properties-update', handleProjectChange);

        return () => {
            if (unsubDoc) unsubDoc();
            window.document.removeEventListener('bloki-project-changed', handleProjectChange);
            window.document.removeEventListener('bloki-properties-update', handleProjectChange);
            HandleDimGizmo.instance.detach();
        };
    }, []);

    const applyUpdatedParams = (newParams: HandleParamsMm) => {
        if (!activeContainer) return;
        setParams(newParams);

        if (!activeContainer.generatorParams) activeContainer.generatorParams = {};
        Object.assign(activeContainer.generatorParams, newParams);

        const doc = getDoc();
        if (!doc) return;

        const cntNode = doc.findNode(activeContainer.id);
        if (!cntNode) return;

        const targetPanel = activeContainer.generatorParams.targetPanelId ? doc.findNode(activeContainer.generatorParams.targetPanelId) : null;
        const panelModel = targetPanel?.domainData;
        const panelWMm = activeContainer.generatorParams.panelWidthMm ?? (panelModel ? nmToMm(panelModel.width) : 0);
        const panelHMm = activeContainer.generatorParams.panelHeightMm ?? (panelModel ? nmToMm(panelModel.height) : 0);
        const panelTMm = activeContainer.generatorParams.panelThicknessMm ?? (panelModel ? resolvePanelThicknessMm(panelModel) : 0);

        const layout = computeHandleLayout(newParams, panelWMm, panelHMm);
        activeContainer.generatorParams.overhangMm = layout.overhangMm;

        // Wymiary kontenera zależą od orientacji (pozioma / pionowa)
        const isHoriz = newParams.orientation === 'HORIZONTAL';
        const contW = isHoriz ? newParams.totalLengthMm : newParams.thicknessMm;
        const contH = isHoriz ? newParams.thicknessMm : newParams.totalLengthMm;
        const contD = newParams.depthMm;

        activeContainer.width = mmToNm(contW);
        activeContainer.height = mmToNm(contH);
        activeContainer.depth = mmToNm(contD);

        // Aktualizacja lokalnej pozycji uchwytu
        const faceZ = activeContainer.generatorParams.faceZ ?? -panelTMm / 2;
        const normalZ = activeContainer.generatorParams.normalZ ?? -1;
        cntNode.setLocalTransform(
            new Vec3(mmToNm(layout.center.x), mmToNm(faceZ), mmToNm(layout.center.y)),
            Quat.IDENTITY
        );

        // Przebudowa modelu 3D
        buildHandleParametricMesh(cntNode, newParams, layout, faceZ, normalZ);

        // Synchronizacja nawiertów montażowych na płycie frontu
        const parentId = activeContainer.generatorParams.targetPanelId || cntNode.parent?.id;
        const targetPanelNode = parentId ? doc.findNode(parentId) : null;
        if (targetPanelNode) {
            syncHandleDrillings(doc, targetPanelNode, activeContainer, layout, newParams, normalZ);
        }

        // Aktualizacja węzła okucia HARDWARE
        const hwNode = cntNode.children?.find((c: any) => c.nodeType === 'HARDWARE');
        if (hwNode && hwNode.domainData) {
            hwNode.domainData.c_c = newParams.holeDistanceMm;
            hwNode.domainData.length = newParams.totalLengthMm;
            if (hwNode.domainData.custom_properties) {
                hwNode.domainData.custom_properties.orientation = newParams.orientation;
                hwNode.domainData.custom_properties.drillingEnabled = newParams.drillingEnabled;
                hwNode.domainData.custom_properties.drillDiameterMm = newParams.drillDiameterMm;
                hwNode.domainData.custom_properties.holes = layout.holes;
            }
        }

        // Aktualizacja zielonej otoczki / obrysu kontenera (ContainerView)
        const cView = ContextManager.instance?.containerViews?.get(activeContainer);
        if (cView && typeof cView.update === 'function') {
            cView.update();
        }

        // Aktualizacja linii wymiarowych UV gizma
        HandleDimGizmo.instance.update();

        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    };

    const handleParamChange = (key: keyof HandleParamsMm, value: any) => {
        if (!activeContainer) return;
        const newParams = { ...params, [key]: value };
        applyUpdatedParams(newParams);
    };

    const toggleUEdge = () => {
        if (!activeContainer) return;
        const { widthMm: panelWMm } = resolveTargetPanelSizeMm();
        if (!(panelWMm > 0)) return;
        const orientation: HandleOrientation = params.orientation || 'HORIZONTAL';
        const oldEdge = params.uEdge || 'FACE_X_MINUS';
        const newEdge: EdgeU = oldEdge === 'FACE_X_MINUS' ? 'FACE_X_PLUS' : 'FACE_X_MINUS';
        const currentU = params.uMm ?? (panelWMm / 2);
        // Oś U jest główna (otwory wzdluż X) tylko dla HORIZONTAL
        const holeOffset = orientation === 'HORIZONTAL' ? (params.holeDistanceMm ?? 0) : 0;
        const newUMm = rebindHandleEdge(oldEdge, newEdge, currentU, panelWMm, holeOffset);

        const newParams = { ...params, uEdge: newEdge, uMm: newUMm };
        applyUpdatedParams(newParams);
    };

    const toggleVEdge = () => {
        if (!activeContainer) return;
        const { heightMm: panelHMm } = resolveTargetPanelSizeMm();
        if (!(panelHMm > 0)) return;
        const orientation: HandleOrientation = params.orientation || 'HORIZONTAL';
        const oldEdge = params.vEdge || 'FACE_Y_PLUS';
        const newEdge: EdgeV = oldEdge === 'FACE_Y_PLUS' ? 'FACE_Y_MINUS' : 'FACE_Y_PLUS';
        const currentV = params.vMm ?? 35;
        // Oś V jest główna (otwory wzdluż Y) tylko dla VERTICAL
        const holeOffset = orientation === 'VERTICAL' ? (params.holeDistanceMm ?? 0) : 0;
        const newVMm = rebindHandleEdge(oldEdge, newEdge, currentV, panelHMm, holeOffset);

        const newParams = { ...params, vEdge: newEdge, vMm: newVMm };
        applyUpdatedParams(newParams);
    };

    const selectPreset = (preset: HandlePlacementPreset) => {
        if (!activeContainer) return;
        const { widthMm: panelWMm, heightMm: panelHMm } = resolveTargetPanelSizeMm();
        if (!(panelWMm > 0) || !(panelHMm > 0)) return;

        const center = computeHandleCenterMm(
            preset,
            panelWMm,
            panelHMm,
            params.offsetEdgeXMm,
            params.offsetEdgeYMm,
            params.orientation
        );

        const uEdge: EdgeU = center.x >= 0 ? 'FACE_X_PLUS' : 'FACE_X_MINUS';
        const vEdge: EdgeV = center.y >= 0 ? 'FACE_Y_PLUS' : 'FACE_Y_MINUS';
        const uv = computeUVFromCenter(center.x, center.y, uEdge, vEdge, panelWMm, panelHMm);

        const newParams: HandleParamsMm = {
            ...params,
            placementPreset: preset,
            uEdge,
            vEdge,
            uMm: uv.uMm,
            vMm: uv.vMm,
        };
        applyUpdatedParams(newParams);
    };

    const handleDirectInsert = (template: HandleTemplateItem) => {
        const doc = getDoc();
        if (!doc) return;

        const activeEntity = doc.activeEntity;
        let targetPanelNode: any = null;

        if (activeEntity && (activeEntity.type === 'part' || activeEntity.thickness != null)) {
            targetPanelNode = doc.findNode(activeEntity.id);
        }

        if (targetPanelNode) {
            createSmartPartHandle(doc, targetPanelNode, {
                totalLengthMm: template.totalLengthMm,
                holeDistanceMm: template.holeDistanceMm,
                depthMm: template.depthMm,
                thicknessMm: template.thicknessMm,
                orientation: template.defaultOrientation,
                placementPreset: template.defaultPreset,
                offsetEdgeYMm: template.defaultOffsetYMm,
                glbModelPath: template.glbModelPath,
            });
            syncActiveHandle();
        }
    };

    const overhangMm = computeHandleOverhang(params);

    return (
        <div className="smartparts-panel">
            {/* ─── Sekcja: Katalog Uchwytów ─── */}
            <div>
                <div className="smartparts-section-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M8 12h8" />
                    </svg>
                    Katalog Uchwytów (SmartPart)
                </div>
                <p className="smartparts-hint">
                    Przeciągnij uchwyt na formatkę (front / drzwi) w scenie 3D.
                </p>

                <div className="smartparts-grid" style={{ marginTop: '8px' }}>
                    {DEFAULT_HANDLE_TEMPLATES.map((tpl) => {
                        const oh = computeHandleOverhang(tpl);
                        return (
                            <div
                                key={tpl.id}
                                className="smartparts-handle-card"
                                draggable={true}
                                onDragStart={(e) => {
                                    try {
                                        e.dataTransfer.setData('application/smartpart-handle-template', JSON.stringify(tpl));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    } catch {}
                                    HandleDragController.instance.startDrag(tpl);
                                }}
                                onDragEnd={() => {
                                    HandleDragController.instance.endDrag();
                                }}
                                onClick={() => handleDirectInsert(tpl)}
                                title={`${tpl.name}\n• Długość: ${tpl.totalLengthMm} mm\n• Rozstaw C-C: ${tpl.holeDistanceMm} mm\n• Wystaje: ${oh} mm z każdej strony\n• Przeciągnij na front`}
                            >
                                <div className="smartparts-handle-card-top">
                                    <div className="smartparts-handle-icon">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M4 12h16" />
                                            <circle cx="6" cy="12" r="1.5" fill="currentColor" />
                                            <circle cx="18" cy="12" r="1.5" fill="currentColor" />
                                        </svg>
                                    </div>
                                    <div className="smartparts-handle-name">{tpl.name}</div>
                                </div>
                                <div className="smartparts-handle-meta">
                                    <span>C-C: {tpl.holeDistanceMm} mm</span>
                                    <span className="smartparts-handle-overhang">+{oh} mm</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── Sekcja: Edycja Aktywnego Uchwytu ─── */}
            {activeContainer ? (
                <div className="smartparts-active-card" style={{ marginTop: '10px' }}>
                    <div className="smartparts-active-title">
                        <span>{activeContainer.name}</span>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>SmartPart Handle</span>
                    </div>

                    {/* Wystawanie poza otwory (Kluczowy parametr stolarski) */}
                    <div className="smartparts-overhang-badge">
                        <span>Wystawanie poza otwory (overhang):</span>
                        <strong>{overhangMm} mm z każdej strony</strong>
                    </div>

                    {/* Szerokość całkowita i rozstaw otworów */}
                    <div className="agd-field">
                        <div className="agd-field-header">
                            <span>Szerokość całkowita (długość):</span>
                            <span className="agd-field-val">{params.totalLengthMm} mm</span>
                        </div>
                        <div className="agd-slider-row">
                            <input
                                type="range"
                                min={30}
                                max={800}
                                step={1}
                                value={params.totalLengthMm}
                                onChange={(e) => handleParamChange('totalLengthMm', parseFloat(e.target.value) || 0)}
                            />
                            <input
                                type="number"
                                value={params.totalLengthMm}
                                onChange={(e) => handleParamChange('totalLengthMm', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="agd-field">
                        <div className="agd-field-header">
                            <span>Rozstaw otworów C-C:</span>
                            <span className="agd-field-val">{params.holeDistanceMm} mm</span>
                        </div>
                        <div className="agd-slider-row">
                            <input
                                type="range"
                                min={0}
                                max={params.totalLengthMm}
                                step={32}
                                value={params.holeDistanceMm}
                                onChange={(e) => handleParamChange('holeDistanceMm', parseFloat(e.target.value) || 0)}
                            />
                            <input
                                type="number"
                                value={params.holeDistanceMm}
                                onChange={(e) => handleParamChange('holeDistanceMm', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        {/* Standardowe rozstawy meblarskie */}
                        <div className="smartparts-std-chips" style={{ marginTop: '4px' }}>
                            {[96, 128, 160, 192, 256, 320].map((std) => (
                                <button
                                    key={std}
                                    type="button"
                                    className={`smartparts-chip ${params.holeDistanceMm === std ? 'active' : ''}`}
                                    onClick={() => handleParamChange('holeDistanceMm', std)}
                                >
                                    {std} mm
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Orientacja: Poziomo / Pionowo */}
                    <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Orientacja:</div>
                        <div className="smartparts-toggle-row">
                            <button
                                type="button"
                                className={`smartparts-toggle-btn ${params.orientation === 'HORIZONTAL' ? 'active' : ''}`}
                                onClick={() => handleParamChange('orientation', 'HORIZONTAL')}
                            >
                                Poziomo
                            </button>
                            <button
                                type="button"
                                className={`smartparts-toggle-btn ${params.orientation === 'VERTICAL' ? 'active' : ''}`}
                                onClick={() => handleParamChange('orientation', 'VERTICAL')}
                            >
                                Pionowo
                            </button>
                        </div>
                    </div>

                    {/* Pozycja UV i kotwiczenie linii wymiarowych do krawędzi */}
                    <div className="smartparts-uv-box">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f1f5f9' }}>Kotwiczenie do krawędzi (UV):</span>
                            <span style={{ fontSize: '10px', color: '#38bdf8' }}>Gizmo aktywne w 3D</span>
                        </div>

                        {/* Oś U (szerokość / X) */}
                        <div className="agd-field" style={{ margin: 0 }}>
                            <div className="agd-field-header">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#94a3b8' }}>Oś U:</span>
                                    <button
                                        type="button"
                                        className="smartparts-edge-badge"
                                        onClick={toggleUEdge}
                                        title="Kliknij, aby zmienić krawędź bazową (Lewa / Prawa)"
                                    >
                                        {params.uEdge === 'FACE_X_MINUS' ? '◀ Krawędź Lewa (X-)' : 'Krawędź Prawa (X+) ▶'}
                                    </button>
                                </span>
                                <span className="agd-field-val">{params.uMm ?? 0} mm</span>
                            </div>
                            <div className="agd-slider-row">
                                <input
                                    type="range"
                                    min={0}
                                    max={Math.max(resolveTargetPanelSizeMm().widthMm, params.uMm ?? 0)}
                                    step={1}
                                    value={params.uMm ?? 0}
                                    onChange={(e) => handleParamChange('uMm', parseFloat(e.target.value) || 0)}
                                />
                                <input
                                    type="number"
                                    value={params.uMm ?? 0}
                                    onChange={(e) => handleParamChange('uMm', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        {/* Oś V (wysokość / Y) */}
                        <div className="agd-field" style={{ margin: 0 }}>
                            <div className="agd-field-header">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#94a3b8' }}>Oś V:</span>
                                    <button
                                        type="button"
                                        className="smartparts-edge-badge"
                                        onClick={toggleVEdge}
                                        title="Kliknij, aby zmienić krawędź bazową (Dół / Góra)"
                                    >
                                        {params.vEdge === 'FACE_Y_PLUS' ? 'Góra (Y+) ▲' : '▼ Dół (Y-)'}
                                    </button>
                                </span>
                                <span className="agd-field-val">{params.vMm ?? 0} mm</span>
                            </div>
                            <div className="agd-slider-row">
                                <input
                                    type="range"
                                    min={0}
                                    max={Math.max(resolveTargetPanelSizeMm().heightMm, params.vMm ?? 0)}
                                    step={1}
                                    value={params.vMm ?? 0}
                                    onChange={(e) => handleParamChange('vMm', parseFloat(e.target.value) || 0)}
                                />
                                <input
                                    type="number"
                                    value={params.vMm ?? 0}
                                    onChange={(e) => handleParamChange('vMm', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Szybkie Presety położenia */}
                    <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Szybkie presety położenia:</div>
                        <div className="smartparts-preset-grid">
                            <button
                                type="button"
                                className={`smartparts-preset-btn ${params.placementPreset === 'TOP_LEFT' ? 'active' : ''}`}
                                onClick={() => selectPreset('TOP_LEFT')}
                            >
                                Góra Lewa
                            </button>
                            <button
                                type="button"
                                className={`smartparts-preset-btn ${params.placementPreset === 'TOP_CENTER' ? 'active' : ''}`}
                                onClick={() => selectPreset('TOP_CENTER')}
                            >
                                Góra Środek
                            </button>
                            <button
                                type="button"
                                className={`smartparts-preset-btn ${params.placementPreset === 'TOP_RIGHT' ? 'active' : ''}`}
                                onClick={() => selectPreset('TOP_RIGHT')}
                            >
                                Góra Prawa
                            </button>

                            <button
                                type="button"
                                className={`smartparts-preset-btn ${params.placementPreset === 'CENTER' ? 'active' : ''}`}
                                onClick={() => selectPreset('CENTER')}
                                style={{ gridColumn: 'span 3' }}
                            >
                                Środek Frontu
                            </button>

                            <button
                                type="button"
                                className={`smartparts-preset-btn ${params.placementPreset === 'BOTTOM_LEFT' ? 'active' : ''}`}
                                onClick={() => selectPreset('BOTTOM_LEFT')}
                            >
                                Dół Lewa
                            </button>
                            <button
                                type="button"
                                className={`smartparts-preset-btn ${params.placementPreset === 'BOTTOM_CENTER' ? 'active' : ''}`}
                                onClick={() => selectPreset('BOTTOM_CENTER')}
                            >
                                Dół Środek
                            </button>
                            <button
                                type="button"
                                className={`smartparts-preset-btn ${params.placementPreset === 'BOTTOM_RIGHT' ? 'active' : ''}`}
                                onClick={() => selectPreset('BOTTOM_RIGHT')}
                            >
                                Dół Prawa
                            </button>
                        </div>
                    </div>

                    <div className="agd-field">
                        <div className="agd-field-header">
                            <span>Wysunięcie od lica (głębokość):</span>
                            <span className="agd-field-val">{params.depthMm} mm</span>
                        </div>
                        <div className="agd-slider-row">
                            <input
                                type="range"
                                min={15}
                                max={50}
                                step={1}
                                value={params.depthMm}
                                onChange={(e) => handleParamChange('depthMm', parseFloat(e.target.value) || 0)}
                            />
                            <input
                                type="number"
                                value={params.depthMm}
                                onChange={(e) => handleParamChange('depthMm', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    {/* Opcja nawiercania pod śruby */}
                    <div style={{ marginTop: '8px', padding: '8px 10px', background: '#1e293b', borderRadius: '6px', border: '1px solid #334155' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#cbd5e1', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={params.drillingEnabled}
                                onChange={(e) => handleParamChange('drillingEnabled', e.target.checked)}
                            />
                            <span>Wiercenie otworów montażowych</span>
                        </label>
                        {params.drillingEnabled && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', marginLeft: '24px' }}>
                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Średnica wiertła:</span>
                                <input
                                    type="number"
                                    min={2}
                                    max={10}
                                    step={0.5}
                                    style={{ width: '48px', padding: '2px 4px', fontSize: '11px', background: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', textAlign: 'center' }}
                                    value={params.drillDiameterMm}
                                    onChange={(e) => handleParamChange('drillDiameterMm', parseFloat(e.target.value) || 4.0)}
                                />
                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>mm (M4)</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
