/**
 * web/src/draw-entry.tsx
 * Punkt wejścia dla podstrony draw.html (SmartBox Draw Studio 2D).
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { DrawStudio } from '../D1_draw/DrawStudio';
import { ModuleSourceBar } from './module-data/ModuleSourceBar';
import { readModuleSession, writeModuleSession, installModulePageLifecycle } from './module-data/session';
import type { DrawModulePayload } from './module-data/types';

installModulePageLifecycle('draw');

function DrawStandaloneApp() {
    const [payload, setPayload] = useState<DrawModulePayload | null>(
        () => readModuleSession<DrawModulePayload>('draw')
    );

    const handleJson = (text: string, fileName: string) => {
        try {
            const data = JSON.parse(text);
            const next: DrawModulePayload = {
                meta: {
                    module: 'draw',
                    sourceId: 'json',
                    loadedAt: new Date().toISOString(),
                    originLabel: `JSON · ${fileName}`,
                },
                scope: data.scope || { type: 'PROJECT', id: 'ALL', name: fileName },
                treeRoot: data.treeRoot || data.rootNode || data,
            };
            writeModuleSession('draw', next);
            setPayload(next);
        } catch (e: any) {
            alert(e?.message || 'Niepoprawny JSON rysunku');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <ModuleSourceBar
                module="draw"
                title="Rysunek"
                originLabel={payload?.meta.originLabel || payload?.scope.name}
                onLoadJson={handleJson}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
                <DrawStudio
                    initialTargetId={payload?.scope.type === 'PROJECT' ? undefined : payload?.scope.id}
                    initialTreeRoot={payload?.treeRoot || undefined}
                />
            </div>
        </div>
    );
}

const rootEl = document.getElementById('draw-root');
if (rootEl) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(
        <React.StrictMode>
            <DrawStandaloneApp />
        </React.StrictMode>
    );
}
