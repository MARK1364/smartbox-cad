import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { NestingPanel } from '../n1_nesting/ui/NestingPanel';
import { ModuleSourceBar } from './module-data/ModuleSourceBar';
import { readModuleSession, installModulePageLifecycle } from './module-data/session';
import { parseNestingCsv } from './module-data/csv-nesting';
import type { NestingModulePayload } from './module-data/types';

installModulePageLifecycle('nesting');

function readInitial(): NestingModulePayload | null {
    const session = readModuleSession<NestingModulePayload>('nesting');
    if (session?.parts) return session;

    const legacy = localStorage.getItem('NESTING_SESSION_DATA');
    if (!legacy) return null;
    try {
        const data = JSON.parse(legacy);
        if (!data.parts) return null;
        return {
            meta: {
                module: 'nesting',
                sourceId: 'session',
                loadedAt: new Date().toISOString(),
                originLabel: 'Sesja CAD',
            },
            scope: { type: data.scope || 'PROJECT', id: 'ALL', name: 'Projekt' },
            parts: data.parts,
            containers: data.containers || [],
            config: data.config,
            selectedMaterial: data.selectedMaterial || 'ALL',
        };
    } catch {
        return null;
    }
}

function NestingStandaloneApp() {
    const [payload, setPayload] = useState<NestingModulePayload | null>(readInitial);
    const [reloadKey, setReloadKey] = useState(0);

    const applyPayload = (next: NestingModulePayload) => {
        setPayload(next);
        setReloadKey((k) => k + 1);
    };

    const handleJson = (text: string, fileName: string) => {
        try {
            const data = JSON.parse(text);
            const parts = data.parts || data;
            if (!Array.isArray(parts)) throw new Error('JSON nestingu musi mieć tablicę parts');
            applyPayload({
                meta: {
                    module: 'nesting',
                    sourceId: 'json',
                    loadedAt: new Date().toISOString(),
                    originLabel: `JSON · ${fileName}`,
                },
                scope: data.scope || { type: 'PROJECT', id: 'ALL', name: fileName },
                parts,
                containers: data.containers || [],
                config: data.config,
                selectedMaterial: data.selectedMaterial || 'ALL',
            });
        } catch (e: any) {
            alert(e?.message || 'Niepoprawny JSON nestingu');
        }
    };

    const handleCsv = (text: string, fileName: string) => {
        const parts = parseNestingCsv(text);
        if (parts.length === 0) {
            alert('CSV nie zawiera formatek (wymagane: nazwa, długość, szerokość).');
            return;
        }
        applyPayload({
            meta: {
                module: 'nesting',
                sourceId: 'csv',
                loadedAt: new Date().toISOString(),
                originLabel: `CSV · ${fileName}`,
            },
            scope: { type: 'PROJECT', id: 'ALL', name: fileName },
            parts,
            containers: [],
            selectedMaterial: 'ALL',
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <ModuleSourceBar
                module="nesting"
                title="Nesting"
                originLabel={payload?.meta.originLabel}
                onLoadJson={handleJson}
                onLoadCsv={handleCsv}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
                <NestingPanel
                    key={reloadKey}
                    initialParts={payload?.parts}
                    initialSelectedMaterial={payload?.selectedMaterial || 'ALL'}
                    scopeLabel={payload?.scope?.name || payload?.meta?.originLabel}
                    isStandaloneWindow
                />
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('nesting-root')!).render(
    <React.StrictMode>
        <NestingStandaloneApp />
    </React.StrictMode>
);
