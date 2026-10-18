/**
 * Punkt wejścia podstrony cennik.html — edytor cen (Plik → Cennik).
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { CennikEditor } from './CennikEditor';

ReactDOM.createRoot(document.getElementById('cennik-root')!).render(
    <React.StrictMode>
        <CennikEditor />
    </React.StrictMode>
);
