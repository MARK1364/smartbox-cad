import React from 'react';
import ReactDOM from 'react-dom/client';
import { DagInspectorApp } from './dag/DagInspectorApp';

const rootEl = document.getElementById('dag-root');
if (rootEl) {
    ReactDOM.createRoot(rootEl).render(
        <React.StrictMode>
            <DagInspectorApp />
        </React.StrictMode>
    );
}
