import React from 'react';
import { createRoot } from 'react-dom/client';
import { PlatformaApp } from './PlatformaApp.js';
import './platforma.css';

const container = document.getElementById('platforma-root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <PlatformaApp />
        </React.StrictMode>
    );
}
