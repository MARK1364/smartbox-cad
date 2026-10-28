/**
 * E1_export - assembly-lektor.ts
 * Warstwa tekstowa instrukcji montażu: opisy kroków (kadr) i skrypt lektora.
 *
 * PURE — zero Babylon / DOM / ContextManager.
 * Szablony tekstów: assembly_tekst.json → T1_tlumaczenia (pl / en / de).
 * Hook na Krok 3 planu (LLM): tekst kroków jest strukturalny — model językowy
 * może go sparafraszować w bardziej naturalny lektor bez zmiany API.
 */

import { tx } from '../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import instrukcjaTekstRaw from './instrukcja_tekst.json';
import connectorsRulesRaw from '../C2_connectors/connectors_3_rules.json';
import type { AssemblyPlan, AssemblyStep } from './assembly-sequence-engine.js';

const assemblyTekst = instrukcjaTekstRaw as unknown as ModuleTexts;
const TX_NS = 'assembly';

const _CONNECTOR_NAMES: Record<string, { name?: string }> | undefined =
    (connectorsRulesRaw as { connector_types?: Record<string, { name?: string }> }).connector_types;

/** Etykieta łącznika: nazwa z C2 (Kołek ø8×35 / Konfirmat / Minifix) lub surowy typ. */
export function connectorTypeLabel(type: string): string {
    return _CONNECTOR_NAMES?.[type]?.name || type;
}

/** "6× Kołek ø8×35, 2× Minifix" — lista elementów do kroku. */
export function hardwareCountsLabel(counts: Record<string, number>): string {
    const items = Object.entries(counts || {})
        .filter(([, n]) => Number.isFinite(n) && n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([type, n]) =>
            tx(assemblyTekst, 'lektor.hardware_item', TX_NS, { count: n, type: connectorTypeLabel(type) }));
    return items.join(', ');
}

function phaseTitle(step: AssemblyStep): string {
    return tx(assemblyTekst, step.labelKey, TX_NS) || step.phaseId;
}

function stepIntroText(step: AssemblyStep): string {
    const titles: string[] = [];
    if (step.mode === 'single') {
        const name = step.actions[0]?.name || '';
        return tx(assemblyTekst, 'lektor.action_single', TX_NS, { part: name });
    }
    for (const a of step.actions) titles.push(a.name);
    const count = titles.length;
    return tx(assemblyTekst, 'lektor.action_joint_many', TX_NS, {
        count,
        names: titles.join(', '),
    });
}

/**
 * Tekst jednego kroku (kadr monter: nagłówek + akcja + łączniki).
 * Dane wejściowe są w pełni strukturalne — wymiana na LLM = nadpisanie tej funkcji.
 */
export function stepLektorText(step: AssemblyStep, isFirst: boolean = false): string {
    const parts: string[] = [];
    const header = tx(assemblyTekst, 'lektor.step_header', TX_NS, { n: step.index, title: phaseTitle(step) });
    parts.push(header);

    const isInventory = step.phaseId === 'inwentarz' || step.index === 0;
    if (isInventory) {
        parts.push(tx(assemblyTekst, 'lektor.inventory_intro', TX_NS, { summary: hardwareCountsLabel(step.hardwareCounts) }));
        return parts.filter(Boolean).join('\n');
    }

    if (step.actions.length > 0) {
        const intro = stepIntroText(step);
        if (intro) parts.push(intro);
    }

    const hwLabel = hardwareCountsLabel(step.hardwareCounts);
    if (hwLabel) {
        parts.push(tx(assemblyTekst, 'lektor.hardware_intro', TX_NS, { items: hwLabel }));
    }
    void isFirst;
    return parts.filter(Boolean).join('\n');
}

/**
 * Pełny skrypt lektora: nagłówek + inwentarz + kroki + zakończenie.
 * Gotowy do pobrania jako .txt lub bezpośrednio do Text-to-Speech.
 */
export function buildLektorScript(plan: AssemblyPlan, furnitureName: string = ''): string {
    const header = tx(assemblyTekst, 'lektor.script_header', TX_NS, {
        furniture: furnitureName || 'Mebel',
    });

    const chunks: string[] = [header];
    const allSteps: AssemblyStep[] = [];

    if (plan.inventoryStep) allSteps.push(plan.inventoryStep);
    allSteps.push(...plan.steps);

    for (const step of allSteps) {
        chunks.push(`\n${stepLektorText(step)}`);
    }

    chunks.push(tx(assemblyTekst, 'lektor.script_footer', TX_NS));
    return chunks.join('');
}

// ─── TTS (Web Speech API) — warstwa przeglądarkowa lektora ───
// Docelowo podmienić gostępu w LLM / ElevenLabs (Krok 3 planu).

let _ttsSupported: boolean | null = null;

function ttsSupported(): boolean {
    if (_ttsSupported !== null) return _ttsSupported;
    try {
        _ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    } catch {
        _ttsSupported = false;
    }
    return _ttsSupported;
}

export function stopSpeech(): void {
    if (!ttsSupported()) return;
    try {
        window.speechSynthesis.cancel();
    } catch { /* ignore */ }
}

/** Czytaj tekst na głos (pl-PL, gdy dostępny); delightful-demo — bez kolejki. */
export function speakText(text: string): void {
    if (!text || !ttsSupported()) return;
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pl-PL';
        utterance.rate = 1.05;
        const plVoice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith('pl'));
        if (plVoice) utterance.voice = plVoice;
        window.speechSynthesis.speak(utterance);
    } catch (err) {
        console.warn('[assembly-lektor] TTS failed:', err);
    }
}

export const ASSEMBLY_TX_NS = TX_NS;
export { assemblyTekst };
