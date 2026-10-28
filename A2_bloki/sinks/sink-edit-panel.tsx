/**
 * A2_bloki / sinks — sink-edit-panel.tsx
 * Formularz edycji parametrów zlewu SmartPart (szerokość, głębokość, kołnierz, komora, pozycja U/V, kotwienie).
 */

import React, { useState, useEffect } from 'react';
import { ContextManager } from '../../A1_core/context-manager.js';
import { SmartNumericInput } from '../../A1_core/ui/SmartNumericInput.js';
import type { SinkEdgeU, SinkEdgeV, SinkParamsMm } from './sink-types.js';
import { normalizeSinkParams, computeSinkLayout, computeSinkLocalCoords, resolveSinkAbsoluteCenter } from './sink-types.js';
import { syncSinkCutout } from './sink-cutout.js';
import { buildSinkParametricMesh } from './sink-mesh.js';
import { SinkDimGizmo } from './sink-dim-gizmo.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';

interface Props {
    container: any;
}

export function SinkEditPanel({ container }: Props): React.JSX.Element | null {
    if (!container) return null;

    const gp = container.generatorParams || {};
    const [params, setParams] = useState<SinkParamsMm>(() => normalizeSinkParams(gp));

    useEffect(() => {
        setParams(normalizeSinkParams(container.generatorParams || {}));
        if (container) {
            SinkDimGizmo.instance.attach(container);
        }
        return () => {
            SinkDimGizmo.instance.detach();
        };
    }, [container]);

    useEffect(() => {
        const onRebind = (e: any) => {
            if (e.detail?.containerId === container?.id) {
                const patch: Partial<SinkParamsMm> = {};
                if (e.detail.uEdge) patch.uEdge = e.detail.uEdge;
                if (e.detail.vEdge) patch.vEdge = e.detail.vEdge;
                if (typeof e.detail.u_mm === 'number') patch.u_mm = e.detail.u_mm;
                if (typeof e.detail.v_mm === 'number') patch.v_mm = e.detail.v_mm;
                handleChange(patch);
            }
        };
        window.addEventListener('sink-rebind-edge', onRebind);
        return () => window.removeEventListener('sink-rebind-edge', onRebind);
    }, [container?.id, params]);

    const panelWMm = container.generatorParams?.panelWidthMm || (params.szerokosc_mm * 2);
    const panelHMm = container.generatorParams?.panelHeightMm || (params.glebokosc_mm * 2);

    const handleChange = (patch: Partial<SinkParamsMm>) => {
        const next = normalizeSinkParams({ ...params, ...patch }, panelWMm, panelHMm);
        setParams(next);

        const doc = ContextManager.instance.document || (window as any).__cad_document;
        if (!doc) return;

        const targetPanelId = container.generatorParams?.targetPanelId;
        const targetPanelNode = targetPanelId ? doc.findNode(targetPanelId) : null;
        const cntNode = doc.findNode(container.id);

        const layout = computeSinkLayout(next, panelWMm, panelHMm);

        const faceZ = container.generatorParams?.faceZ ?? 0;
        const normalZ = container.generatorParams?.normalZ ?? 1;
        const faceName = next.face || (normalZ > 0 ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS');

        const { localX, localY } = computeSinkLocalCoords(
            layout.uAbsMm,
            layout.vAbsMm,
            panelWMm,
            panelHMm,
            faceName
        );

        // Aktualizuj domenowe gabaryty kontenera w nanometrach
        container.width = mmToNm(layout.kolnierzWidthMm);
        container.height = mmToNm(layout.kolnierzDepthMm);
        container.depth = mmToNm(layout.kolnierzHeightMm + layout.komoraHeightMm);

        // Aktualizuj generatorParams kontenera
        container.generatorParams = {
            ...container.generatorParams,
            localX,
            localY,
            ...next,
            ...layout,
        };

        // Aktualizuj węzeł okucia HARDWARE dla BOM i wyceny
        const hwNode = doc.findNode(`hw_${container.id}`);
        if (hwNode && hwNode.domainData) {
            const hw = hwNode.domainData as any;
            hw.length = layout.kolnierzWidthMm;
            hw.custom_properties = {
                ...hw.custom_properties,
                kolnierzWidthMm: layout.kolnierzWidthMm,
                kolnierzDepthMm: layout.kolnierzDepthMm,
                kolnierzHeightMm: layout.kolnierzHeightMm,
                komoraWidthMm: layout.komoraWidthMm,
                komoraDepthMm: layout.komoraDepthMm,
                komoraHeightMm: layout.komoraHeightMm,
                cutoutUMm: layout.cutoutUMm,
                cutoutVMm: layout.cutoutVMm,
                cutoutWidthMm: layout.cutoutWidthMm,
                cutoutLengthMm: layout.cutoutLengthMm,
            };
        }

        // Aktualizuj transformację węzła kontenera w układzie formatki
        if (cntNode) {
            const localPosNm = new Vec3(
                mmToNm(localX),
                mmToNm(faceZ),
                mmToNm(localY)
            );
            cntNode.setLocalTransform(localPosNm, Quat.IDENTITY);
        }

        // Synchronizuj wycięcie na formatce blatu
        if (targetPanelNode) {
            syncSinkCutout(doc, targetPanelNode, container, next, layout);
        }

        // Aktualizuj wireframe kontenera w ContainerView
        const containerViews = (ContextManager.instance as any)?.containerViews;
        if (containerViews) {
            for (const [cModel, cView] of containerViews) {
                if (cModel?.id === container.id || cModel === container) {
                    cView?.update?.();
                    break;
                }
            }
        }

        // Przebuduj meshe 3D zlewu
        if (cntNode) {
            const faceZ = container.generatorParams?.faceZ ?? 0;
            const normalZ = container.generatorParams?.normalZ ?? 1;
            buildSinkParametricMesh(cntNode, next, layout, faceZ, normalZ);
        }

        // Aktualizuj linie wymiarowe referencyjne snap gizmo
        SinkDimGizmo.instance.update();

        if (typeof window !== 'undefined' && typeof (window as any).__rebuildGeometry === 'function') {
            (window as any).__rebuildGeometry('Zlew aktualizacja parametrów');
        }

        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update', {
                detail: { kind: 'container', containerId: container.id }
            }));
        }

        ContextManager.instance?.viewport?.requestRender?.(2);
    };

    const toggleUEdge = () => {
        const currentEdge: SinkEdgeU = params.uEdge || 'FACE_X_MINUS';
        const nextEdge: SinkEdgeU = currentEdge === 'FACE_X_MINUS' ? 'FACE_X_PLUS' : 'FACE_X_MINUS';
        const nextUMm = Math.max(0, panelWMm - params.u_mm);
        handleChange({ uEdge: nextEdge, u_mm: nextUMm });
    };

    const toggleVEdge = () => {
        const currentEdge: SinkEdgeV = params.vEdge || 'FACE_Y_MINUS';
        const nextEdge: SinkEdgeV = currentEdge === 'FACE_Y_MINUS' ? 'FACE_Y_PLUS' : 'FACE_Y_MINUS';
        const nextVMm = Math.max(0, panelHMm - params.v_mm);
        handleChange({ vEdge: nextEdge, v_mm: nextVMm });
    };

    const currentLayout = computeSinkLayout(params, panelWMm, panelHMm);

    return (
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#fff', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #3f3f46', paddingBottom: '4px', color: '#38bdf8' }}>
                Zlew nakładany (SmartPart)
            </div>

            <div style={{
                padding: '6px 8px',
                backgroundColor: '#18181b',
                borderRadius: '4px',
                border: '1px solid #27272a',
                fontSize: '10px',
                color: '#cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
            }}>
                <span>Światło komory:</span>
                <span style={{ fontWeight: 600, color: '#38bdf8' }}>
                    {currentLayout.komoraWidthMm} × {currentLayout.komoraDepthMm} mm
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>Szerokość zewn. [mm]</label>
                    <SmartNumericInput
                        value={params.szerokosc_mm}
                        min={200}
                        max={1400}
                        step={1}
                        onChange={(val) => handleChange({ szerokosc_mm: val })}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>Głębokość zewn. [mm]</label>
                    <SmartNumericInput
                        value={params.glebokosc_mm}
                        min={200}
                        max={800}
                        step={1}
                        onChange={(val) => handleChange({ glebokosc_mm: val })}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>Kołnierz wys. [mm]</label>
                    <SmartNumericInput
                        value={params.wysokosc_kolnierza_mm}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(val) => handleChange({ wysokosc_kolnierza_mm: val })}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>Margines komory [mm]</label>
                    <SmartNumericInput
                        value={params.margines_komory_mm}
                        min={0}
                        max={400}
                        step={1}
                        onChange={(val) => handleChange({ margines_komory_mm: val })}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>Głębokość komory [mm]</label>
                    <SmartNumericInput
                        value={params.glebokosc_komory_mm}
                        min={10}
                        max={400}
                        step={1}
                        onChange={(val) => handleChange({ glebokosc_komory_mm: val })}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginTop: '14px' }}>
                        <input
                            type="checkbox"
                            checked={params.cutoutEnabled}
                            onChange={(e) => handleChange({ cutoutEnabled: e.target.checked })}
                        />
                        <span>Wycięcie w blacie</span>
                    </label>
                </div>
            </div>

            <div style={{ fontWeight: 'bold', marginTop: '4px', borderTop: '1px solid #27272a', paddingTop: '4px', color: '#a1a1aa' }}>
                Kotwienie i pozycja na formacie (X / Y)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label style={{ fontSize: '10px', color: '#9ca3af' }}>Pozycja X [mm]</label>
                        <button
                            type="button"
                            onClick={toggleUEdge}
                            title={params.uEdge === 'FACE_X_MINUS' ? 'Kotwienie: od lewej krawędzi (kliknij aby zmienić)' : 'Kotwienie: od prawej krawędzi (kliknij aby zmienić)'}
                            style={{
                                background: '#27272a',
                                border: '1px solid #3f3f46',
                                borderRadius: '3px',
                                color: '#38bdf8',
                                fontSize: '10px',
                                padding: '1px 5px',
                                cursor: 'pointer',
                            }}
                        >
                            {params.uEdge === 'FACE_X_MINUS' ? '◀ Lewa' : 'Prawa ▶'}
                        </button>
                    </div>
                    <SmartNumericInput
                        value={Math.round(params.u_mm)}
                        min={0}
                        max={panelWMm}
                        step={1}
                        onChange={(val) => handleChange({ u_mm: val })}
                    />
                </div>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <label style={{ fontSize: '10px', color: '#9ca3af' }}>Pozycja Y [mm]</label>
                        <button
                            type="button"
                            onClick={toggleVEdge}
                            title={params.vEdge === 'FACE_Y_MINUS' ? 'Kotwienie: od dolnej/przedniej krawędzi (kliknij aby zmienić)' : 'Kotwienie: od górnej/tylnej krawędzi (kliknij aby zmienić)'}
                            style={{
                                background: '#27272a',
                                border: '1px solid #3f3f46',
                                borderRadius: '3px',
                                color: '#38bdf8',
                                fontSize: '10px',
                                padding: '1px 5px',
                                cursor: 'pointer',
                            }}
                        >
                            {params.vEdge === 'FACE_Y_MINUS' ? '▼ Przód' : 'Tył ▲'}
                        </button>
                    </div>
                    <SmartNumericInput
                        value={Math.round(params.v_mm)}
                        min={0}
                        max={panelHMm}
                        step={1}
                        onChange={(val) => handleChange({ v_mm: val })}
                    />
                </div>
            </div>
        </div>
    );
}
