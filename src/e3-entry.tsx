/**
 * web/src/e3-entry.tsx
 * Punkt wejściowy dla dedykowanej podstrony e3_drawing.html (SmartBox Eksport 3).
 * Uruchamia Studio Multi-Kamera 3D (E3MultiStudio).
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { E3MultiStudio } from '../E3_export/E3MultiStudio';

const rootEl = document.getElementById('root');
if (rootEl) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(
        <React.StrictMode>
            <E3MultiStudio />
        </React.StrictMode>
    );
}
