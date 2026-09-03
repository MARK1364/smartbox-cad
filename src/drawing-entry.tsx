/**
 * web/src/drawing-entry.tsx
 * Punkt wejścia dla podstrony drawing.html (SmartBox 2D Drawing Studio).
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { DrawingStudio } from '../E2_export/DrawingStudio';

const rootEl = document.getElementById('drawing-studio-root');
if (rootEl) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(
        <React.StrictMode>
            <DrawingStudio />
        </React.StrictMode>
    );
}
