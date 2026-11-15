/**
 * src/agd/AgdPanel.tsx
 *
 * Zakładka AGD i Wyposażenia Sceny = katalog wstawiania (paleta) + import plików 3D (.glb, .gltf, .obj, .stl).
 * Edycja istniejącego urządzenia = okno na scenie (PPM „Edytuj AGD”).
 */

import React, { useState, useEffect, useRef } from 'react';
import { ContextManager } from '../../A1_core/context-manager.js';
import { UIController } from '../../A1_core/ui-controller.js';
import {
    applianceLibraryStore,
} from '../../A6_agd/appliance-library-store.js';
import type { ApplianceTemplateItem } from '../../A6_agd/smart-appliance-types.js';
import {
    createSmartAppliance,
} from '../../A6_agd/smart-appliance-core.js';
import { HardwareLoader } from '../../B1_biblioteka/hardware-loader.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import { useLocale } from '../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';
import './agd-panel.css';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

interface Props {
    projectModel?: any;
}

function renderApplianceIcon(template: ApplianceTemplateItem) {
    const kind = template.kind;
    const cat = template.category;

    if (kind === 'SINK') {
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <rect x="5" y="7" width="14" height="10" rx="1" fill="currentColor" fillOpacity="0.15" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
        );
    }

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

    if (kind === 'FRIDGE') {
        return (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="2" y="1" width="14" height="16" rx="1.5" />
                <line x1="2" y1="7" x2="16" y2="7" strokeWidth="1" />
                <line x1="4" y1="3" x2="4" y2="5.5" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="4" y1="9" x2="4" y2="13" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
        );
    }

    if (cat === 'LIGHTING') {
        return (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2">
                <line x1="9" y1="1" x2="9" y2="6" />
                <path d="M4 11C4 8.2 6.2 6 9 6C11.8 6 14 8.2 14 11H4Z" fill="currentColor" fillOpacity="0.15" />
                <circle cx="9" cy="13" r="1.5" />
            </svg>
        );
    }

    if (cat === 'BATHROOM') {
        return (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="3" y="2" width="12" height="14" rx="1" />
                <path d="M6 2V5H12V2" />
                <line x1="7" y1="7" x2="7" y2="9" strokeLinecap="round" />
                <line x1="9" y1="7" x2="9" y2="9.5" strokeLinecap="round" />
                <line x1="11" y1="7" x2="11" y2="9" strokeLinecap="round" />
            </svg>
        );
    }

    if (kind === 'SCENE_PROP') {
        return (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2">
                <polygon points="9,2 16,6 16,12 9,16 2,12 2,6" fill="currentColor" fillOpacity="0.12" />
                <polyline points="2,6 9,10 16,6" />
                <line x1="9" y1="10" x2="9" y2="16" />
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
    useLocale();
    const [templates, setTemplates] = useState<ApplianceTemplateItem[]>(() => applianceLibraryStore.getAll());
    const [importUnit, setImportUnit] = useState<'mm' | 'cm' | 'm'>('mm');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const getDoc = () => projectModel?.document || ContextManager.instance.document;

    useEffect(() => {
        return applianceLibraryStore.subscribe(() => {
            setTemplates(applianceLibraryStore.getAll());
        });
    }, []);

    const handleInsert = (template: ApplianceTemplateItem) => {
        const doc = getDoc();
        if (!doc) return;

        if (template.kind === 'SINK') {
            const bayCtrl = ContextManager.instance.blokiBayController;
            if (bayCtrl) {
                bayCtrl.startDrag('SINK', 'panel');
                bayCtrl.setPendingBlokType('SINK');
                UIController.instance?.setStatus('Wskaż formatkę (np. blat) w widoku 3D, aby wstawić zlew.', true, 'info');
            }
            return;
        }

        createSmartAppliance({
            kind: template.kind,
            name: template.name,
            position: { x: 0, y: 0, z: template.kind === 'SCENE_PROP' ? undefined : 0 },
            params: template.defaultParams as any,
        }, doc);

        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
        }
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const scene = ContextManager.instance.viewport?.scene || (typeof window !== 'undefined' ? (window as any).__cad_scene : null);
        const doc = getDoc();
        if (!scene || !doc) return;

        const isGltf = /\.(glb|gltf)$/i.test(file.name);
        const effectiveUnit = isGltf ? 'm' : importUnit;

        const imported = await HardwareLoader.instance.importModelFromFile(file, scene, {
            unitScale: effectiveUnit,
        });
        if (!imported) {
            UIController.instance?.setStatus(`Błąd importu pliku: ${file.name}`, true, 'error');
            return;
        }

        const newTemplate: ApplianceTemplateItem = {
            id: imported.templateId,
            name: imported.name,
            kind: 'SCENE_PROP',
            source: 'MESH_3D',
            category: 'DECOR',
            modelFormat: imported.format,
            defaultParams: {
                width_mm: imported.width_mm,
                depth_mm: imported.depth_mm,
                height_mm: imported.height_mm,
                modelId: imported.templateId,
                modelFormat: imported.format,
                category: 'DECOR',
            },
        };

        applianceLibraryStore.registerItem(newTemplate);
        handleInsert(newTemplate);
        UIController.instance?.setStatus(
            `Zaimportowano model 3D: ${imported.name} (${imported.width_mm}×${imported.depth_mm}×${imported.height_mm} mm)`,
            true
        );
    };

    const applianceTemplates = templates.filter((t) => t.kind !== 'SCENE_PROP');
    const scenePropTemplates = templates.filter((t) => t.kind === 'SCENE_PROP');

    const renderTemplateCard = (template: ApplianceTemplateItem) => (
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
                    if (template.kind === 'SINK') {
                        bayCtrl.startDrag('SINK', 'panel');
                        bayCtrl.setPendingBlokType('SINK');
                    } else {
                        bayCtrl.startDrag('APPLIANCE');
                        bayCtrl.setPendingBlokType('APPLIANCE');
                    }
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
            title={`${template.name}\n• ${tx(srcTekst, 'agd.card_tooltip', TX_NS)}`}
        >
            <div className="agd-card-icon">
                {renderApplianceIcon(template)}
            </div>
            <span className="agd-card-title">{template.name}</span>
        </div>
    );

    return (
        <div className="agd-panel">
            <div className="agd-panel-header">
                <h2>{tx(srcTekst, 'agd.title', TX_NS)}</h2>
                <p className="agd-panel-subtitle">{tx(srcTekst, 'agd.subtitle', TX_NS)}</p>
            </div>

            <div className="agd-section">
                <h3 className="agd-section-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {tx(srcTekst, 'agd.import_section', TX_NS)}
                </h3>

                <div className="agd-field-row">
                    <span className="agd-field-label">{tx(srcTekst, 'agd.import_unit_label', TX_NS)}</span>
                    <select
                        value={importUnit}
                        onChange={(e) => setImportUnit(e.target.value as 'mm' | 'cm' | 'm')}
                        style={{
                            background: '#121214',
                            color: '#e4e4e7',
                            border: '1px solid #3f3f46',
                            borderRadius: '4px',
                            padding: '3px 6px',
                            fontSize: '11px',
                        }}
                    >
                        <option value="mm">mm (1:1)</option>
                        <option value="cm">cm (×10)</option>
                        <option value="m">m (×1000)</option>
                    </select>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".glb,.gltf,.obj,.stl"
                    style={{ display: 'none' }}
                    onChange={handleFileImport}
                />

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '7px 10px',
                        background: 'rgba(56, 189, 248, 0.14)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        borderRadius: '5px',
                        color: '#38bdf8',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {tx(srcTekst, 'agd.import_btn', TX_NS)}
                </button>

                <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0, lineHeight: 1.35 }}>
                    {tx(srcTekst, 'agd.import_hint', TX_NS)}
                </p>
            </div>

            <div className="agd-section">
                <h3 className="agd-section-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="8" height="8" rx="1" />
                        <rect x="13" y="3" width="8" height="8" rx="1" />
                        <rect x="3" y="13" width="8" height="8" rx="1" />
                        <rect x="13" y="13" width="8" height="8" rx="1" />
                    </svg>
                    {tx(srcTekst, 'agd.catalog_appliances', TX_NS)}
                </h3>

                <div className="agd-grid">
                    {applianceTemplates.map(renderTemplateCard)}
                </div>
            </div>

            <div className="agd-section">
                <h3 className="agd-section-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 22 7 22 17 12 22 2 17 2 7" />
                        <polyline points="2 7 12 12 22 7" />
                        <line x1="12" y1="12" x2="12" y2="22" />
                    </svg>
                    {tx(srcTekst, 'agd.catalog_scene_props', TX_NS)}
                </h3>

                <div className="agd-grid">
                    {scenePropTemplates.map(renderTemplateCard)}
                </div>
            </div>
        </div>
    );
}
