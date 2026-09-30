/**
 * src/agd/AgdPanel.tsx
 *
 * Główny panel boczny modułu Sprzętu AGD (SmartAppliance).
 * Zawiera:
 * - Siatkę małych, schludnych kart z ikonami SVG (jak w Bloki), działających jako Drag & Drop oraz Click-to-insert.
 * - Dynamiczny inspektor parametrów mikrofali (wysokość frontu, korpusu, nałożenia) ze zmianą w czasie rzeczywistym.
 */

import React, { useState, useEffect } from 'react';
import { ContextManager } from '../../A1_core/context-manager.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import {
    applianceLibraryStore,
} from '../../A6_agd/appliance-library-store.js';
import {
    isSmartApplianceContainer,
    isAppliancePart,
    type MicrowaveParamsMm,
    type ApplianceTemplateItem,
} from '../../A6_agd/smart-appliance-types.js';
import {
    getApplianceParamsMm,
    rebuildSmartAppliance,
    createSmartAppliance,
} from '../../A6_agd/smart-appliance-core.js';
import './agd-panel.css';

interface Props {
    projectModel?: any;
}

// Schludne małe ikony wektorowe SVG dla urządzeń AGD
function renderApplianceIcon(kind: string) {
    if (kind === 'MICROWAVE') {
        return (
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="1" y="1" width="16" height="12" rx="1.5" />
                <rect x="2.5" y="2.5" width="8" height="9" rx="0.5" fill="currentColor" fillOpacity="0.15" />
                <line x1="14" y1="3.5" x2="14" y2="5.5" strokeWidth="1.2" />
                <circle cx="14" cy="8" r="0.8" fill="currentColor" />
                <circle cx="14" cy="10.5" r="0.8" fill="currentColor" />
            </svg>
        );
    }

    return (
        <svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="1" y="1" width="16" height="14" rx="1.5" />
            <line x1="1" y1="4.5" x2="17" y2="4.5" strokeWidth="1" />
            <line x1="3.5" y1="6" x2="14.5" y2="6" strokeWidth="1.4" />
            <rect x="3" y="8" width="12" height="6" rx="0.5" fill="currentColor" fillOpacity="0.15" />
        </svg>
    );
}

export function AgdPanel({ projectModel }: Props): React.JSX.Element {
    const [templates, setTemplates] = useState<ApplianceTemplateItem[]>(() => applianceLibraryStore.getAll());
    const [activeContainer, setActiveContainer] = useState<ContainerModel | null>(null);
    const [params, setParams] = useState<MicrowaveParamsMm | null>(null);

    const getDoc = () => projectModel?.document || ContextManager.instance.document;

    // Synchronizacja aktywnego urządzenia w scenie
    const syncActiveAppliance = () => {
        const doc = getDoc();
        if (!doc) {
            setActiveContainer(null);
            setParams(null);
            return;
        }

        const active = doc.activeEntity;
        if (!active) {
            setActiveContainer(null);
            setParams(null);
            return;
        }

        // 1. Sprawdź czy zaznaczono bezpośrednio kontener AGD
        if (isSmartApplianceContainer(active)) {
            setActiveContainer(active as ContainerModel);
            setParams(getApplianceParamsMm(active as ContainerModel));
            return;
        }

        // 2. Sprawdź czy zaznaczono panel B-rep wchodzący w skład AGD
        if (isAppliancePart(active)) {
            const node = doc.findNode((active as any).id);
            if (node && node.parent && isSmartApplianceContainer(node.parent.domainData)) {
                const cnt = node.parent.domainData as ContainerModel;
                setActiveContainer(cnt);
                setParams(getApplianceParamsMm(cnt));
                return;
            }
        }

        setActiveContainer(null);
        setParams(null);
    };

    useEffect(() => {
        syncActiveAppliance();

        const doc = getDoc();
        let unsubDoc: (() => void) | null = null;
        if (doc) {
            unsubDoc = doc.onDocumentChanged(syncActiveAppliance);
        }

        const handleProjectChange = () => syncActiveAppliance();
        window.addEventListener('bloki-project-changed', handleProjectChange);
        window.addEventListener('bloki-properties-update', handleProjectChange);

        const unsubStore = applianceLibraryStore.subscribe(() => {
            setTemplates(applianceLibraryStore.getAll());
        });

        return () => {
            if (unsubDoc) unsubDoc();
            window.removeEventListener('bloki-project-changed', handleProjectChange);
            window.removeEventListener('bloki-properties-update', handleProjectChange);
            unsubStore();
        };
    }, []);

    // Aktualizacja pojedynczego parametru na żywo
    const handleParamChange = (key: keyof MicrowaveParamsMm, value: number) => {
        if (!activeContainer || !params) return;
        const newParams = { ...params, [key]: value };
        setParams(newParams);

        if (!activeContainer.generatorParams) activeContainer.generatorParams = {};
        activeContainer.generatorParams[key] = value;

        const doc = getDoc();
        rebuildSmartAppliance(activeContainer, doc);

        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    };

    // Wstawienie szablonu z biblioteki
    const handleInsert = (template: ApplianceTemplateItem) => {
        const doc = getDoc();
        if (!doc) return;

        createSmartAppliance({
            kind: template.kind,
            name: template.name,
            position: { x: 0, y: 0, z: 0 },
            params: template.defaultParams as any,
        }, doc);

        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
        }

        syncActiveAppliance();
    };

    // Obliczenie wysokości korpusu wg reguły z piekarnikowa.html
    const calculatedCorpusHeight = params
        ? Math.max(50, params.frontHeight - params.nalGoraMicro - params.nalDolneMicro)
        : 352;

    return (
        <div className="agd-panel">
            <div className="agd-panel-header">
                <h2>Sprzęt AGD</h2>
                <p className="agd-panel-subtitle">Parametryczne modele B-rep (S2 Solver)</p>
            </div>

            {/* ─── Sekcja: Małe Schludne Karty Katalogu (Drag & Drop) ─── */}
            <div className="agd-section">
                <h3 className="agd-section-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="8" height="8" rx="1" />
                        <rect x="13" y="3" width="8" height="8" rx="1" />
                        <rect x="3" y="13" width="8" height="8" rx="1" />
                        <rect x="13" y="13" width="8" height="8" rx="1" />
                    </svg>
                    Katalog Urządzeń
                </h3>

                <div className="agd-grid">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className="agd-card-compact"
                            draggable={true}
                            onDragStart={(e) => {
                                try {
                                    e.dataTransfer.setData('application/cad-appliance-template', JSON.stringify(template));
                                    e.dataTransfer.effectAllowed = 'copy';
                                } catch {}
                                (window as any).__draggedAppliance = template;
                                const bayCtrl = ContextManager.instance.blokiBayController;
                                if (bayCtrl) {
                                    bayCtrl.startDrag('APPLIANCE');
                                    bayCtrl.setPendingBlokType('APPLIANCE');
                                }
                            }}
                            onDragEnd={() => {
                                (window as any).__draggedAppliance = null;
                                const bayCtrl = ContextManager.instance.blokiBayController;
                                if (bayCtrl) {
                                    bayCtrl.setPendingBlokType(null);
                                    bayCtrl.endDrag();
                                }
                            }}
                            onClick={() => handleInsert(template)}
                            title={`${template.name}\n• Przeciągnij na scenę 3D lub kliknij, aby wstawić`}
                        >
                            <div className="agd-card-icon">
                                {renderApplianceIcon(template.kind)}
                            </div>
                            <span className="agd-card-title">{template.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Sekcja: Edycja Aktywnej Mikrofali / Sprzętu ─── */}
            {activeContainer && params ? (
                <div className="agd-section">
                    <h3 className="agd-section-title">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <rect x="5" y="8" width="10" height="8" rx="1" />
                            <circle cx="18" cy="9" r="1" />
                            <circle cx="18" cy="13" r="1" />
                        </svg>
                        Wymiary & Położenie Frontu
                    </h3>

                    <div className="agd-active-card">
                        <div className="agd-active-name">{activeContainer.name}</div>
                        <div className="agd-brep-note">
                            Geometria B-rep (6 ścian). Wyrównana z ramką Bounding Box.
                        </div>
                    </div>

                    {/* Wymiary frontu */}
                    <div className="agd-field">
                        <div className="agd-field-header">
                            <span>Wysokość frontu (microHeight):</span>
                            <span className="agd-field-val">{params.frontHeight} mm</span>
                        </div>
                        <div className="agd-slider-row">
                            <input
                                type="range"
                                min={250}
                                max={600}
                                step={1}
                                value={params.frontHeight}
                                onChange={(e) => handleParamChange('frontHeight', parseFloat(e.target.value))}
                            />
                            <input
                                type="number"
                                value={params.frontHeight}
                                onChange={(e) => handleParamChange('frontHeight', parseFloat(e.target.value) || 380)}
                            />
                        </div>
                    </div>

                    {/* Nałożenie górne */}
                    <div className="agd-field">
                        <div className="agd-field-header">
                            <span>Nałożenie górne (nalGora):</span>
                            <span className="agd-field-val">{params.nalGoraMicro} mm</span>
                        </div>
                        <div className="agd-slider-row">
                            <input
                                type="range"
                                min={0}
                                max={50}
                                step={1}
                                value={params.nalGoraMicro}
                                onChange={(e) => handleParamChange('nalGoraMicro', parseFloat(e.target.value))}
                            />
                            <input
                                type="number"
                                value={params.nalGoraMicro}
                                onChange={(e) => handleParamChange('nalGoraMicro', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    {/* Nałożenie dolne */}
                    <div className="agd-field">
                        <div className="agd-field-header">
                            <span>Nałożenie dolne (nalDolne):</span>
                            <span className="agd-field-val">{params.nalDolneMicro} mm</span>
                        </div>
                        <div className="agd-slider-row">
                            <input
                                type="range"
                                min={-20}
                                max={50}
                                step={1}
                                value={params.nalDolneMicro}
                                onChange={(e) => handleParamChange('nalDolneMicro', parseFloat(e.target.value))}
                            />
                            <input
                                type="number"
                                value={params.nalDolneMicro}
                                onChange={(e) => handleParamChange('nalDolneMicro', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    {/* Obliczona wysokość korpusu */}
                    <div className="agd-calc-badge">
                        <span>Wysokość korpusu wnęki:</span>
                        <strong>{calculatedCorpusHeight} mm</strong>
                    </div>

                    {/* Szerokość frontu i korpusu */}
                    <div className="agd-field">
                        <div className="agd-field-header">
                            <span>Szerokość frontu:</span>
                            <span className="agd-field-val">{params.frontWidth} mm</span>
                        </div>
                        <div className="agd-slider-row">
                            <input
                                type="range"
                                min={400}
                                max={900}
                                step={1}
                                value={params.frontWidth}
                                onChange={(e) => handleParamChange('frontWidth', parseFloat(e.target.value))}
                            />
                            <input
                                type="number"
                                value={params.frontWidth}
                                onChange={(e) => handleParamChange('frontWidth', parseFloat(e.target.value) || 595)}
                            />
                        </div>
                    </div>

                    <div className="agd-field">
                        <div className="agd-field-header">
                            <span>Szerokość korpusu wnękowego:</span>
                            <span className="agd-field-val">{params.corpusWidth} mm</span>
                        </div>
                        <div className="agd-slider-row">
                            <input
                                type="range"
                                min={350}
                                max={860}
                                step={1}
                                value={params.corpusWidth}
                                onChange={(e) => handleParamChange('corpusWidth', parseFloat(e.target.value))}
                            />
                            <input
                                type="number"
                                value={params.corpusWidth}
                                onChange={(e) => handleParamChange('corpusWidth', parseFloat(e.target.value) || 560)}
                            />
                        </div>
                    </div>

                    {/* Głębokość korpusu */}
                    <div className="agd-field">
                        <div className="agd-field-header">
                            <span>Głębokość korpusu wnęki:</span>
                            <span className="agd-field-val">{params.corpusDepth} mm</span>
                        </div>
                        <div className="agd-slider-row">
                            <input
                                type="range"
                                min={200}
                                max={580}
                                step={5}
                                value={params.corpusDepth}
                                onChange={(e) => handleParamChange('corpusDepth', parseFloat(e.target.value))}
                            />
                            <input
                                type="number"
                                value={params.corpusDepth}
                                onChange={(e) => handleParamChange('corpusDepth', parseFloat(e.target.value) || 320)}
                            />
                        </div>
                    </div>

                    {/* Grubość frontu */}
                    <div className="agd-field">
                        <div className="agd-field-header">
                            <span>Grubość frontu szklanego:</span>
                            <span className="agd-field-val">{params.frontDepth} mm</span>
                        </div>
                        <div className="agd-slider-row">
                            <input
                                type="range"
                                min={10}
                                max={35}
                                step={1}
                                value={params.frontDepth}
                                onChange={(e) => handleParamChange('frontDepth', parseFloat(e.target.value))}
                            />
                            <input
                                type="number"
                                value={params.frontDepth}
                                onChange={(e) => handleParamChange('frontDepth', parseFloat(e.target.value) || 20)}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
