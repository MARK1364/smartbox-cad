/**
 * src/smartparts-entry.tsx — Legacy entry point delegujący do S5_studio/StudioApp.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { StudioApp } from '../S5_studio/StudioApp.js';

const rootEl = document.getElementById('smartparts-root') || document.getElementById('studio-root');
if (rootEl) {
    ReactDOM.createRoot(rootEl).render(<StudioApp />);
}
