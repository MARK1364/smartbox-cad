/**
 * Punkt wejścia podstrony wiercenia.html — edytor list wierceń okuć (Plik → Wiercenia).
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { WierceniaEditor } from './WierceniaEditor';

ReactDOM.createRoot(document.getElementById('wiercenia-root')!).render(
    <React.StrictMode>
        <WierceniaEditor />
    </React.StrictMode>
);
