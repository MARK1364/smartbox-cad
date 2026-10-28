/**
 * I1_instrukcja - InstructionPanel.tsx
 * Panel „Instrukcja montażu" w kopii shella CAD (instrukcja.html).
 *
 * Podstrona ładuje ŻYWY projekt ze snapshotu, więc plan liczymy TU, lokalnie
 * (`assemblyPlanFromScene`) — bez payloadu z CAD. Animacja gra na tej samej
 * scenie, na której użytkownik ustawia PMI / obraca / przesuwa części.
 *
 * Zawiera edycję klatek (keyframes) kroków:
 *  - podgląd wybranego kroku (showStep),
 *  - suwak postępu wpasowania (ratio) oraz dystansu rozsunięcia (mm),
 *  - wybór kierunku exploda (przód, tył, góra, dół, lewo, prawo),
 *  - zapisywanie pozycji ustawionych manualnie gizmami 3D (G / R),
 *  - zmianę kolejności kroków w sekwencji (▲ / ▼).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import {
    readModuleSession,
    persistProjectSnapshot,
    returnToCad,
    CAD_BRIDGE_CHANNEL,
    MODULE_SYNC_MSG,
} from '../src/module-data/session';
import type { InstrukcjaModulePayload, ModuleScope } from '../src/module-data/types';
import {
    assemblyPlanFromScene,
} from './assembly-scene-adapter';
import { AssemblyAnimPlayer } from './assembly-anim';
import {
    buildLektorScript,
    hardwareCountsLabel,
    speakText,
    stepLektorText,
    stopSpeech,
} from './assembly-lektor';
import type { AssemblyPlan, AssemblyStep } from './assembly-sequence-engine';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import instrukcjaTekstRaw from './instrukcja_tekst.json';

const instrukcjaTekst = instrukcjaTekstRaw as unknown as ModuleTexts;
const TX_NS = 'instrukcja';

interface StepRow {
    stepIndex: number;
    key: string;
    title: string;
    text: string;
    hwLabel: string | null;
}

function downloadTextFile(name: string, text: string): void {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function scopeContainerId(scope: ModuleScope | null): string | null {
    if (!scope) return null;
    return scope.type === 'CONTAINER' || scope.type === 'BLOKI' ? scope.id : null;
}

function notifyCadSync(): void {
    try {
        const channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
        channel.postMessage({ type: MODULE_SYNC_MSG, module: 'instrukcja' });
        channel.close();
    } catch { /* ignore */ }
}

const DIR_OPTIONS: Record<string, { label: string; dir: [number, number, number] | null }> = {
    AUTO: { label: 'Auto (wg roli)', dir: null },
    FRONT: { label: 'Przód (-Y)', dir: [0, -1, 0] },
    BACK: { label: 'Tył (+Y)', dir: [0, 1, 0] },
    UP: { label: 'Góra (+Z)', dir: [0, 0, 1] },
    DOWN: { label: 'Dół (-Z)', dir: [0, 0, -1] },
    LEFT: { label: 'Lewo (-X)', dir: [-1, 0, 0] },
    RIGHT: { label: 'Prawo (+X)', dir: [1, 0, 0] },
};

const btn: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: 6,
    border: '1px solid var(--border-medium, rgba(255,255,255,0.15))',
    background: 'var(--bg-secondary, #252528)',
    color: 'var(--text-primary, #e2e8f0)',
    cursor: 'pointer',
};

export function InstructionPanel(): React.ReactElement {
    useLocale();
    const payload = useMemo<InstrukcjaModulePayload | null>(() =>
        readModuleSession<InstrukcjaModulePayload>('instrukcja'), []);
    const scope = payload?.scope || null;
    const containerId = scopeContainerId(scope);

    const [doc, setDoc] = useState<any>(() => ContextManager.instance?.document || null);
    const [plan, setPlan] = useState<AssemblyPlan | null>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    
    // ─── Stan edycji klatek / kroków ───
    const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
    const [explodeRatio, setExplodeRatio] = useState<number>(1.0); // 1 = odsunięty, 0 = wpasowany
    const [stepDistanceMm, setStepDistanceMm] = useState<number>(350);
    const [stepDirKey, setStepDirKey] = useState<string>('AUTO');

    const playerRef = useRef<AssemblyAnimPlayer | null>(null);

    const showStatus = useCallback((msg: string) => {
        setStatus(msg);
        window.setTimeout(() => setStatus(null), 4500);
    }, []);

    // Dokument powstaje asynchronicznie (bootstrap sceny) — czekaj aż będzie.
    useEffect(() => {
        if (doc) return;
        const timer = window.setInterval(() => {
            const d = ContextManager.instance?.document;
            if (d) {
                setDoc(d);
                window.clearInterval(timer);
            }
        }, 250);
        return () => window.clearInterval(timer);
    }, [doc]);

    const getOrCreatePlayer = useCallback((): AssemblyAnimPlayer | null => {
        if (!plan) return null;
        if (!playerRef.current) {
            playerRef.current = new AssemblyAnimPlayer(plan, {
                onProgress: ({ stepIndex, doneSteps, totalSteps, finished }) => {
                    if (finished || stepIndex < 0) {
                        setProgress(null);
                        return;
                    }
                    setProgress({ done: doneSteps, total: totalSteps });
                },
            });
        }
        return playerRef.current;
    }, [plan]);

    const recompute = useCallback(() => {
        if (!ContextManager.instance?.document) return;
        const newPlan = assemblyPlanFromScene(null, { containerId });
        setPlan(newPlan);
        if (playerRef.current) {
            playerRef.current.stop();
            playerRef.current = null;
        }
        setSelectedStepIndex(null);
    }, [containerId]);

    useEffect(() => {
        recompute();
        if (!doc?.onDocumentChanged) return;
        let timer: number | null = null;
        const unsub = doc.onDocumentChanged(() => {
            if (timer !== null) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                timer = null;
                recompute();
            }, 250);
        });
        return () => {
            if (timer !== null) window.clearTimeout(timer);
            if (typeof unsub === 'function') unsub();
        };
    }, [doc, recompute]);

    // Sprzątanie animacji przy odmontowaniu panelu.
    useEffect(() => () => {
        playerRef.current?.stop();
        playerRef.current = null;
        stopSpeech();
    }, []);

    const furnitureName = scope?.name || payload?.meta.originLabel || 'Projekt';

    const rows = useMemo<StepRow[]>(() => {
        if (!plan) return [];
        const out: StepRow[] = [];
        if (plan.inventoryStep) {
            const inv = plan.inventoryStep;
            out.push({
                stepIndex: 0,
                key: 'inv',
                title: `Krok 0 — ${tx(instrukcjaTekst, 'phase.inwentarz', TX_NS)}`,
                text: stepLektorText(inv),
                hwLabel: hardwareCountsLabel(inv.hardwareCounts),
            });
        }
        for (const step of plan.steps) {
            const first = step.actions[0];
            const what = step.mode === 'single' && first?.name ? first.name : `${step.actions.length}× element`;
            out.push({
                stepIndex: step.index,
                key: `s${step.index}`,
                title: `Krok ${step.index} — ${tx(instrukcjaTekst, step.labelKey, TX_NS)} — ${what}`,
                text: stepLektorText(step),
                hwLabel: hardwareCountsLabel(step.hardwareCounts),
            });
        }
        return out;
    }, [plan]);

    // ─── Wybór i podgląd kroku / klatki ───
    const handleSelectStep = useCallback((stepIdx: number | null) => {
        if (!plan) return;
        const player = getOrCreatePlayer();
        if (!player) return;

        setSelectedStepIndex(stepIdx);
        if (stepIdx === null) {
            player.restore();
            return;
        }

        const step = plan.steps.find((s) => s.index === stepIdx);
        const dist = step?.explodeOverride?.distanceMm ?? 350;
        setStepDistanceMm(dist);
        setExplodeRatio(1.0);

        // Znajdź klucz kierunku
        let matchedDirKey = 'AUTO';
        if (step?.explodeOverride?.dirCad) {
            const [x, y, z] = step.explodeOverride.dirCad;
            for (const [key, val] of Object.entries(DIR_OPTIONS)) {
                if (val.dir && val.dir[0] === x && val.dir[1] === y && val.dir[2] === z) {
                    matchedDirKey = key;
                    break;
                }
            }
        }
        setStepDirKey(matchedDirKey);

        player.showStep(stepIdx, 1.0);
    }, [plan, getOrCreatePlayer]);

    // Zmiana pozycji wpasowania suwakiem (0..1)
    const handleExplodeRatioChange = useCallback((ratio: number) => {
        setExplodeRatio(ratio);
        if (selectedStepIndex === null) return;
        const player = getOrCreatePlayer();
        player?.showStep(selectedStepIndex, ratio);
    }, [selectedStepIndex, getOrCreatePlayer]);

    // Zmiana dystansu odsunięcia
    const handleDistanceChange = useCallback((distance: number) => {
        setStepDistanceMm(distance);
        if (selectedStepIndex === null) return;
        const player = getOrCreatePlayer();
        const dir = DIR_OPTIONS[stepDirKey]?.dir ?? null;
        player?.setStepExplode(selectedStepIndex, dir, distance);
    }, [selectedStepIndex, stepDirKey, getOrCreatePlayer]);

    // Zmiana kierunku odsunięcia
    const handleDirChange = useCallback((dirKey: string) => {
        setStepDirKey(dirKey);
        if (selectedStepIndex === null) return;
        const player = getOrCreatePlayer();
        const dir = DIR_OPTIONS[dirKey]?.dir ?? null;
        player?.setStepExplode(selectedStepIndex, dir, stepDistanceMm);
    }, [selectedStepIndex, stepDistanceMm, getOrCreatePlayer]);

    // Zapis pozycji z gizm 3D
    const handleSaveKeyframeFromScene = useCallback(() => {
        if (selectedStepIndex === null) return;
        const player = getOrCreatePlayer();
        const ok = player?.captureCurrentPositionsAsKeyframe(selectedStepIndex);
        if (ok) {
            showStatus(`Zapisano własną pozycję klatki kroku #${selectedStepIndex} z widoku 3D.`);
        } else {
            showStatus(`Nie znaleziono zmienionych elementów dla kroku #${selectedStepIndex}.`);
        }
    }, [selectedStepIndex, getOrCreatePlayer, showStatus]);

    // Zmiana kolejności kroków
    const handleMoveStep = useCallback((stepIdx: number, direction: -1 | 1) => {
        if (!plan) return;
        const steps = [...plan.steps];
        const currentPos = steps.findIndex((s) => s.index === stepIdx);
        if (currentPos < 0) return;
        const targetPos = currentPos + direction;
        if (targetPos < 0 || targetPos >= steps.length) return;

        // Zamiana miejscami
        const temp = steps[currentPos];
        steps[currentPos] = steps[targetPos];
        steps[targetPos] = temp;

        // Przenumerowanie 1-based
        steps.forEach((s, i) => {
            s.index = i + 1;
        });

        const newPlan = { ...plan, steps };
        setPlan(newPlan);

        // Odśwież playera
        if (playerRef.current) {
            playerRef.current.stop();
            playerRef.current = null;
        }

        const newStepIndex = targetPos + 1;
        setSelectedStepIndex(newStepIndex);
        window.setTimeout(() => {
            if (playerRef.current) {
                playerRef.current.showStep(newStepIndex, 1.0);
            }
        }, 50);

        showStatus(`Przesunięto krok na pozycję #${newStepIndex}.`);
    }, [plan, showStatus]);

    // ─── Odtwarzanie całości ───
    const handlePlay = useCallback(async () => {
        if (!plan) return;
        playerRef.current?.stop();
        const player = new AssemblyAnimPlayer(plan, {
            onProgress: ({ stepIndex, doneSteps, totalSteps, finished }) => {
                if (finished || stepIndex < 0) {
                    setProgress(null);
                    return;
                }
                setProgress({ done: doneSteps, total: totalSteps });
            },
        });
        playerRef.current = player;
        setPlaying(true);
        setProgress(null);
        setSelectedStepIndex(null);
        try {
            await player.play();
        } finally {
            if (playerRef.current === player) playerRef.current = null;
            setPlaying(false);
            setProgress(null);
        }
    }, [plan]);

    const handleStop = useCallback(() => {
        playerRef.current?.stop();
        playerRef.current?.restore();
        stopSpeech();
        setPlaying(false);
        setProgress(null);
        setSelectedStepIndex(null);
    }, []);

    const handleReadAll = useCallback(() => {
        if (!plan) return;
        const inventory = plan.inventoryStep ? [stepLektorText(plan.inventoryStep)] : [];
        stopSpeech();
        speakText([...inventory, ...plan.steps.map((s: AssemblyStep) => stepLektorText(s))].join(' '));
    }, [plan]);

    const handleScript = useCallback(() => {
        if (!plan) return;
        downloadTextFile(
            `Instrukcja_montazu_${new Date().toISOString().slice(0, 10)}.txt`,
            buildLektorScript(plan, furnitureName),
        );
    }, [plan, furnitureName]);

    const handleSyncToCad = useCallback(() => {
        const d = ContextManager.instance?.document;
        if (!d) return;
        persistProjectSnapshot(d);
        notifyCadSync();
        showStatus('Zapisano projekt do CAD (PMI, kamera, zmiany).');
    }, [showStatus]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
            <div className="panel-header">
                <h2>{tx(instrukcjaTekst, 'panel.title', TX_NS)}</h2>
                <p className="subtitle">{furnitureName}</p>
            </div>

            {/* Pasek głównych akcji */}
            <div className="panel-section" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                    type="button"
                    style={{ ...btn, background: '#1d4ed8', borderColor: '#3b82f6', color: '#fff' }}
                    onClick={handlePlay}
                    disabled={!plan || playing}
                >
                    ▶ Odtwórz
                </button>
                <button type="button" style={btn} onClick={handleStop} disabled={!playing && selectedStepIndex === null}>
                    ⏹ Stop / Złożony
                </button>
                <button
                    type="button"
                    style={{
                        ...btn,
                        background: selectedStepIndex === null ? 'var(--bg-active, #374151)' : 'var(--bg-secondary, #252528)',
                    }}
                    onClick={() => handleSelectStep(null)}
                    title="Pokaż cały złożony mebel na scenie"
                >
                    🪑 Całość
                </button>
                <button type="button" style={btn} onClick={handleReadAll} disabled={!plan}>
                    🗣 Czytaj
                </button>
                <button type="button" style={btn} onClick={handleScript} disabled={!plan}>
                    📄 Skrypt
                </button>
                <button type="button" style={btn} onClick={handleSyncToCad} title="Zapisz PMI i zmiany z tej podstrony do projektu CAD">
                    💾 Do CAD
                </button>
                <button type="button" style={btn} onClick={() => returnToCad('instrukcja')}>
                    ← CAD
                </button>
            </div>

            {status && (
                <div style={{ fontSize: 11, color: '#6ee7b7', padding: '0 16px' }}>{status}</div>
            )}
            {playing && (
                <div style={{ fontSize: 11, color: '#93c5fd', padding: '0 16px' }}>
                    {progress ? `Animacja: Krok ${progress.done} / ${progress.total}` : 'Przygotowanie sceny…'}
                </div>
            )}

            {/* ─── Sekcja Edycji Klatki (gdy wybrano krok) ─── */}
            {selectedStepIndex !== null && selectedStepIndex > 0 && (
                <div
                    className="panel-section"
                    style={{
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: '#93c5fd' }}>
                            🎬 Edycja klatki: Krok {selectedStepIndex}
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button
                                type="button"
                                style={{ ...btn, padding: '2px 6px', fontSize: 11 }}
                                onClick={() => handleMoveStep(selectedStepIndex, -1)}
                                disabled={selectedStepIndex <= 1}
                                title="Przesuń ten krok wcześniej w sekwencji"
                            >
                                ▲ Wyżej
                            </button>
                            <button
                                type="button"
                                style={{ ...btn, padding: '2px 6px', fontSize: 11 }}
                                onClick={() => handleMoveStep(selectedStepIndex, 1)}
                                disabled={!plan || selectedStepIndex >= plan.steps.length}
                                title="Przesuń ten krok później w sekwencji"
                            >
                                ▼ Niżej
                            </button>
                        </div>
                    </div>

                    {/* Suwak pozycji montażu (wpasowanie) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span>Pozycja montażu:</span>
                            <span style={{ color: '#93c5fd', fontWeight: 600 }}>
                                {Math.round((1 - explodeRatio) * 100)}% (złożenie)
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.02"
                            value={explodeRatio}
                            onChange={(e) => handleExplodeRatioChange(parseFloat(e.target.value))}
                            style={{ width: '100%', cursor: 'pointer' }}
                        />
                    </div>

                    {/* Suwak odsunięcia (dystans w mm) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span>Dystans odsunięcia:</span>
                            <span style={{ color: '#93c5fd', fontWeight: 600 }}>{stepDistanceMm} mm</span>
                        </div>
                        <input
                            type="range"
                            min="50"
                            max="800"
                            step="10"
                            value={stepDistanceMm}
                            onChange={(e) => handleDistanceChange(parseInt(e.target.value, 10))}
                            style={{ width: '100%', cursor: 'pointer' }}
                        />
                    </div>

                    {/* Kierunek odsunięcia */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 11 }}>
                        <span>Kierunek exploda:</span>
                        <select
                            value={stepDirKey}
                            onChange={(e) => handleDirChange(e.target.value)}
                            style={{
                                background: 'var(--bg-secondary, #252528)',
                                color: 'var(--text-primary, #e2e8f0)',
                                border: '1px solid var(--border-medium, rgba(255,255,255,0.15))',
                                borderRadius: 4,
                                padding: '3px 6px',
                                fontSize: 11,
                            }}
                        >
                            {Object.entries(DIR_OPTIONS).map(([key, opt]) => (
                                <option key={key} value={key}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Zapis manualnej pozycji z gizm */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button
                            type="button"
                            style={{
                                ...btn,
                                flex: 1,
                                background: 'rgba(16, 185, 129, 0.2)',
                                borderColor: '#10b981',
                                color: '#6ee7b7',
                                padding: '4px 8px',
                            }}
                            onClick={handleSaveKeyframeFromScene}
                            title="Zapisuje pozycje ustawione narzędziami G (Move) i R (Rotate) jako klatkę startową tego kroku"
                        >
                            💾 Zapisz pozycję z gizm 3D
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Lista kroków ─── */}
            <div className="panel-section" style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                {!plan && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                        {tx(instrukcjaTekst, 'generate.no_parts', TX_NS)}
                    </div>
                )}
                {plan && (
                    <>
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
                            {plan.partsTotal} formatek · {plan.steps.length} kroków
                        </div>
                        <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {rows.map((row) => {
                                const isSelected = selectedStepIndex === row.stepIndex;
                                return (
                                    <li
                                        key={row.key}
                                        style={{
                                            fontSize: 12,
                                            lineHeight: 1.45,
                                            padding: '8px 10px',
                                            borderRadius: 6,
                                            border: isSelected
                                                ? '1px solid #3b82f6'
                                                : '1px solid var(--border-light, rgba(255,255,255,0.08))',
                                            background: isSelected
                                                ? 'rgba(59, 130, 246, 0.12)'
                                                : 'var(--bg-secondary, #252528)',
                                            cursor: 'pointer',
                                            transition: 'background 0.15s',
                                        }}
                                        onClick={() => handleSelectStep(row.stepIndex)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontWeight: 600, color: isSelected ? '#93c5fd' : 'inherit' }}>
                                                {row.title}
                                            </div>
                                            {row.stepIndex > 0 && (
                                                <div style={{ display: 'flex', gap: 2 }}>
                                                    <button
                                                        type="button"
                                                        style={{ ...btn, padding: '1px 5px', fontSize: 10 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMoveStep(row.stepIndex, -1);
                                                        }}
                                                        disabled={row.stepIndex <= 1}
                                                        title="Przesuń wyżej"
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        type="button"
                                                        style={{ ...btn, padding: '1px 5px', fontSize: 10 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMoveStep(row.stepIndex, 1);
                                                        }}
                                                        disabled={row.stepIndex >= plan.steps.length}
                                                        title="Przesuń niżej"
                                                    >
                                                        ▼
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 11, marginTop: 2 }}>
                                            {row.text}
                                        </div>
                                        {row.hwLabel && (
                                            <div style={{ color: '#93c5fd', fontSize: 11, marginTop: 2 }}>🔩 {row.hwLabel}</div>
                                        )}
                                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                            <button
                                                type="button"
                                                style={{ ...btn, padding: '2px 8px', fontSize: 10 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    speakText(row.text);
                                                }}
                                            >
                                                🗣 Czytaj krok
                                            </button>
                                            <button
                                                type="button"
                                                style={{
                                                    ...btn,
                                                    padding: '2px 8px',
                                                    fontSize: 10,
                                                    background: isSelected ? '#2563eb' : 'transparent',
                                                    color: isSelected ? '#fff' : 'inherit',
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectStep(isSelected ? null : row.stepIndex);
                                                }}
                                            >
                                                {isSelected ? '✓ Klatka aktywna' : '🎬 Edytuj klatkę'}
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                        <div style={{ fontSize: 10, color: 'var(--text-muted, #94a3b8)', marginTop: 4 }}>
                            PMI, obrót i przesuwanie: górny pasek CAD (G / R). Złącza (kołki/konfirmaty) widać w trybie wireframe/xray.
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
