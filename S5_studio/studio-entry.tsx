/**
 * S5_studio — studio-entry.tsx
 * Punkt wejścia aplikacji Studio 3D (ładowany przez studio.html).
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { StudioApp } from './StudioApp.js';

const rootEl = document.getElementById('studio-root') || document.getElementById('smartparts-root');
if (rootEl) {
    ReactDOM.createRoot(rootEl).render(<StudioApp />);
}
