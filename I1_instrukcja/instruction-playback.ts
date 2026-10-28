/**
 * I1_instrukcja - instruction-playback.ts
 * Mostek CAD: podstrona instrukcja.html prosi okno CAD (BroadcastChannel) o
 * odtworzenie animacji złożenia na ŻYWEJ scenie. Plan liczony od zera
 * (adapter + fingerprint), jakoś od gracza — AssemblyAnimPlayer.restore().
 *
 * Odpowiednik installModuleRefreshBridge — instalowany raz w App.tsx CAD.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { UIController } from '../A1_core/ui-controller.js';
import { MODULE_PLAY_MSG, CAD_BRIDGE_CHANNEL } from '../src/module-data/session.js';
import type { ModuleScope } from '../src/module-data/types.js';
import { DEFAULT_ASSEMBLY_RULES } from './assembly-sequence-engine.js';
import { assemblyPlanFromScene, isPlanStale } from './assembly-scene-adapter.js';
import { AssemblyAnimPlayer } from './assembly-anim.js';
import { stopSpeech } from './assembly-lektor.js';

let _player: AssemblyAnimPlayer | null = null;

/**
 * Odtwarza animację złożenia dla scope'u na żywej scenie CAD.
 * Kadry/plan liczone od zera z żywego dokumentu (plan z podstrony służy
 * tylko jako metadane kroku — scena jest prawdą).
 */
export async function playInstructionInCad(scope: ModuleScope | null): Promise<void> {
    if (_player?.isPlaying) {
        _player.stop();
        _player = null;
    }
    stopSpeech();
    const containerId = scope && (scope.type === 'CONTAINER' || scope.type === 'BLOKI')
        ? scope.id
        : null;
    const plan = assemblyPlanFromScene(DEFAULT_ASSEMBLY_RULES, { containerId });
    if (!plan) {
        UIController.instance?.setStatus?.('Instrukcja: brak części w scope — nie ma czego animować.', true);
        return;
    }
    let stale = false;
    try {
        stale = isPlanStale(plan, ContextManager.instance?.document);
    } catch { /* brak meta → też OK, plan świeży z żywej sceny */ }
    void stale; // plan zawsze świeży z live doc — staleness warning zbędny w tym ścieżce
    _player = new AssemblyAnimPlayer(plan, {
        onProgress: ({ stepIndex, doneSteps, totalSteps, finished }) => {
            if (finished) {
                UIController.instance?.setStatus?.(`Instrukcja montażu — gotowe (${totalSteps} kroków).`, true);
            } else if (stepIndex >= 0) {
                UIController.instance?.setStatus?.(`Instrukcja: krok ${doneSteps} / ${totalSteps}`, true);
            }
        },
    });
    UIController.instance?.setStatus?.(`Instrukcja montażu — ${plan.steps.length} kroków na scenie`, true);
    try {
        await _player.play();
    } catch (err: any) {
        console.error('[instruction-playback] play failed:', err);
    } finally {
        _player.restore();
        _player = null;
    }
}

/**
 * Nasłuchuje próśb podstrony instrukcji (instrukcja.html) — odtwarzaj animację.
 * Zwraca funkcję odmontowania (jak installModuleRefreshBridge).
 */
export function installInstructionPlaybackBridge(): () => void {
    const onMessage = (ev: MessageEvent) => {
        const data = ev.data;
        if (!data || data.type !== MODULE_PLAY_MSG || data.module !== 'instrukcja') return;
        void playInstructionInCad((data.scope as ModuleScope) || null);
    };
    window.addEventListener('message', onMessage);

    let channel: BroadcastChannel | null = null;
    try {
        channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
        channel.onmessage = (ev) => onMessage(ev as MessageEvent);
    } catch { /* Paskudnie stary przeglądarka — tylko postMessage */ }

    return () => {
        window.removeEventListener('message', onMessage);
        try { channel?.close(); } catch { /* ignore */ }
    };
}
