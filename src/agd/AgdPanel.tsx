/**
 * src/agd/AgdPanel.tsx
 *
 * Zakładka AGD = katalog wstawiania (paleta).
 * Edycja istniejącego urządzenia = okno na scenie (PPM „Edytuj AGD”).
 */

import React, { useState, useEffect } from 'react';
import { ContextManager } from '../../A1_core/context-manager.js';
import {
    applianceLibraryStore,
} from '../../A6_agd/appliance-library-store.js';
import type { ApplianceTemplateItem } from '../../A6_agd/smart-appliance-types.js';
import {
    createSmartAppliance,
} from '../../A6_agd/smart-appliance-core.js';
import './agd-panel.css';

interface Props {
    projectModel?: any;
}

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

    const getDoc = () => projectModel?.document || ContextManager.instance.document;

    useEffect(() => {
        return applianceLibraryStore.subscribe(() => {
            setTemplates(applianceLibraryStore.getAll());
        });
    }, []);

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
    };

    return (
        <div className="agd-panel">
            <div className="agd-panel-header">
                <h2>Sprzęt AGD</h2>
                <p className="agd-panel-subtitle">Parametryczne modele B-rep (S2 Solver)</p>
            </div>

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
        </div>
    );
}
