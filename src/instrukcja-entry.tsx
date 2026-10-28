/**
 * Podstrona instrukcja.html — KOPIA shella CAD w trybie `instrukcja`.
 *
 * Ładuje ten sam projekt ze snapshotu (`CAD_RESTORE_FLAG` → `cad-app` restore),
 * więc użytkownik ma żywą scenę, drzewo, belkę hierarchii, panel edycji, PMI,
 * gizmo obrotu/przesunięcia — bez zakładek modułów kreślących (ramka/bloki/…).
 * Zakładka „Instrukcja” (I1) liczy plan na żywo i gra animację na tej scenie.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CAD_RESTORE_FLAG, installModulePageLifecycle } from './module-data/session';

// sessionStorage jest per okno → w tej nowej karcie oznaczamy, że cad-app ma
// odtworzyć projekt z ostatniego snapshotu (localStorage, wspólny z CAD).
try {
    sessionStorage.setItem(CAD_RESTORE_FLAG, '1');
} catch { /* ignore */ }

// window.name = SmartPanelInstrukcja (nie koliduje z oknem CAD).
const uninstallLifecycle = installModulePageLifecycle('instrukcja');
window.addEventListener('pagehide', () => uninstallLifecycle(), { once: true });

ReactDOM.createRoot(document.getElementById('instrukcja-root')!).render(
    <React.StrictMode>
        <App mode="instrukcja" initialTab="tab-i1-instrukcja" />
    </React.StrictMode>,
);
