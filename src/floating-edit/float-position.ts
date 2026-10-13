/**
 * Domyślna pozycja okna edycji: obok panelu edycji, wyśrodkowane w pionie na scenie.
 */

const SCENE_TOP = 64;
const GAP = 12;

export function computeFloatBesideEditPanel(
    dialogWidth: number,
    dialogHeight = 320,
): { x: number; y: number } {
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const sceneBottom = winH - 24;
    const sceneCenterY = (SCENE_TOP + sceneBottom) / 2;

    let x = Math.max(GAP, Math.round(winW / 2 - dialogWidth / 2));
    const panel = typeof document !== 'undefined'
        ? document.getElementById('panel-edycji')
        : null;
    if (panel) {
        const r = panel.getBoundingClientRect();
        // Na lewo od panelu edycji (od strony sceny)
        x = Math.round(r.left - dialogWidth - GAP);
        if (x < GAP) {
            // Za mało miejsca — przyklej do lewej krawędzi panelu od wewnątrz sceny
            x = Math.max(GAP, Math.round(r.left - dialogWidth - 4));
        }
    }

    let y = Math.round(sceneCenterY - dialogHeight / 2);
    y = Math.max(SCENE_TOP, Math.min(y, sceneBottom - Math.min(dialogHeight, 160)));

    return { x, y };
}
