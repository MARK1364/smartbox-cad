/**
 * RecorderStudioUI.tsx
 * Pływające studio do nagrywania własnych ruchów i odtwarzania sesji 1:1 w CAD.
 */

import React, { useState, useEffect, useRef } from 'react';
import { SessionRecorder } from './SessionRecorder.js';
import { SessionReplayer } from './SessionReplayer.js';
import { RecordedSession, ReplayState } from './recorder-types.js';
import { SAMPLE_CABINET_SESSION } from './sample-recordings.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSwitchTab: (tabKey: string) => void;
}

export const RecorderStudioUI: React.FC<Props> = ({ isOpen, onClose, onSwitchTab }) => {
  const recorder = SessionRecorder.instance;
  const replayer = SessionReplayer.instance;

  // Stan nagrywania
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordPaused, setIsRecordPaused] = useState(false);
  const [eventsCount, setEventsCount] = useState(0);
  const [recordTimerSec, setRecordTimerSec] = useState(0);
  const [newSessionName, setNewSessionName] = useState('Nagranie Szafki');

  // Stan odtwarzania
  const [replayState, setReplayState] = useState<ReplayState>({
    isPlaying: false,
    isPaused: false,
    currentTimeMs: 0,
    totalDurationMs: 0,
    speed: 1,
    currentPointer: null,
    activeMarker: null,
  });

  // Lista sesji
  const [savedSessions, setSavedSessions] = useState<RecordedSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(SAMPLE_CABINET_SESSION.id);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showMarkerDialog, setShowMarkerDialog] = useState<boolean>(false);
  const [markerTitle, setMarkerTitle] = useState<string>('');
  const [markerNote, setMarkerNote] = useState<string>('');

  const recordIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onSwitchTabRef = useRef(onSwitchTab);
  useEffect(() => {
    onSwitchTabRef.current = onSwitchTab;
  }, [onSwitchTab]);

  // ── Inicjalizacja subskrypcji i listy sesji ──────────────────────────────
  useEffect(() => {
    replayer.setTabSwitchHandler((tab) => {
      onSwitchTabRef.current?.(tab);
    });

    const all = [SAMPLE_CABINET_SESSION, ...recorder.getAllSavedSessions()];
    setSavedSessions(all);

    // Ładujemy sesję domyślną tylko jeśli odtwarzacz nie ma jeszcze aktywnej sesji
    if (!replayer.currentSession) {
      replayer.loadSession(SAMPLE_CABINET_SESSION);
    } else {
      setSelectedSessionId(replayer.currentSession.id);
    }

    const unsubRecorder = recorder.subscribe((rec, paused, count) => {
      setIsRecording(rec);
      setIsRecordPaused(paused);
      setEventsCount(count);
    });

    const unsubReplayer = replayer.subscribe((state) => {
      setReplayState(state);
    });

    return () => {
      unsubRecorder();
      unsubReplayer();
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, []);

  // ── Stoper nagrywania ───────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording && !isRecordPaused) {
      recordIntervalRef.current = window.setInterval(() => {
        setRecordTimerSec((s) => s + 1);
      }, 1000);
    } else {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
    }
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, [isRecording, isRecordPaused]);

  if (!isOpen) return null;

  // ── Handlery Rejestratora ────────────────────────────────────────────────
  const handleStartRecord = () => {
    replayer.stop();
    setRecordTimerSec(0);
    recorder.start(newSessionName.trim() || 'Moje Nagranie');
  };

  const handleToggleRecordPause = () => {
    if (isRecordPaused) {
      recorder.resume();
    } else {
      recorder.pause();
    }
  };

  const handleStopRecord = () => {
    const saved = recorder.stop();
    setSavedSessions([SAMPLE_CABINET_SESSION, ...recorder.getAllSavedSessions()]);
    setSelectedSessionId(saved.id);
    replayer.loadSession(saved);
  };

  const handleAddMarkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (markerTitle.trim()) {
      recorder.addMarker(markerTitle.trim(), markerNote.trim());
      setMarkerTitle('');
      setMarkerNote('');
      setShowMarkerDialog(false);
    }
  };

  // ── Handlery Odtwarzacza ─────────────────────────────────────────────────
  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id);
    const session = savedSessions.find((s) => s.id === id);
    if (session) {
      replayer.loadSession(session);
    }
  };

  const handlePlay = () => {
    setIsMinimized(true);
    replayer.play();
  };

  const handleExportJson = () => {
    const session = savedSessions.find((s) => s.id === selectedSessionId) || replayer.currentSession;
    if (!session) return;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `${session.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_nagranie.json`);
    dlAnchor.click();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string) as RecordedSession;
        if (parsed && parsed.events && Array.isArray(parsed.events)) {
          parsed.id = `rec_imported_${Date.now()}`;
          recorder.saveSession(parsed);
          setSavedSessions([SAMPLE_CABINET_SESSION, ...recorder.getAllSavedSessions()]);
          setSelectedSessionId(parsed.id);
          replayer.loadSession(parsed);
        }
      } catch (err) {
        alert('Nieprawidłowy format pliku JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatTime = (secTotal: number) => {
    const mins = Math.floor(secTotal / 60);
    const secs = Math.floor(secTotal % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMs = (msTotal: number) => {
    return formatTime(msTotal / 1000);
  };

  return (
    <>
      {/* ─── WIRTUALNY KURSOR MYSZKI W CZASIE ODTWARZANIA ───────────── */}
      {replayState.isPlaying && replayState.currentPointer && (
        <div
          id="replay-virtual-cursor"
          style={{
            position: 'fixed',
            left: replayState.currentPointer.x,
            top: replayState.currentPointer.y,
            transform: `translate(-2px, -2px) scale(${replayState.currentPointer.isClicking ? 0.85 : 1})`,
            pointerEvents: 'none',
            zIndex: 10000005,
            transition: 'transform 0.1s ease',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.8))' }}>
            <path
              d="M5.5 3.5L19 11.5L12 13.5L9 20.5L5.5 3.5Z"
              fill="#f59e0b"
              stroke="#0f172a"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>

          {replayState.currentPointer.isClicking && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '2px solid #f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.3)',
                transform: 'translate(-50%, -50%)',
                animation: 'rec-ripple 0.3s ease-out forwards',
              }}
            />
          )}

          <div
            style={{
              position: 'absolute',
              left: '22px',
              top: '4px',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid #f59e0b',
              color: '#fef3c7',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            ▶ Replay ({replayState.speed}x)
          </div>
        </div>
      )}

      {/* ─── BANER ETYKIET / MARKERÓW W CZASIE ODTWARZANIA ───────────── */}
      {replayState.isPlaying && replayState.activeMarker && (
        <div
          style={{
            position: 'fixed',
            top: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '10px 18px',
            color: '#fff',
            zIndex: 999998,
            boxShadow: '0 10px 30px rgba(0,0,0,0.7), 0 0 15px rgba(245, 158, 11, 0.3)',
            animation: 'rec-fade 0.3s ease',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>
            📌 {replayState.activeMarker.title}
          </div>
          {replayState.activeMarker.note && (
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '3px' }}>
              {replayState.activeMarker.note}
            </div>
          )}
        </div>
      )}

      {/* ─── GŁÓWNY PŁYWAJĄCY PANEL STUDIA NAGRAŃ ────────────────────── */}
      <div
        id="recorder-studio-panel"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: isMinimized ? '280px' : '480px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: isRecording ? '2px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '14px',
          padding: '12px 16px',
          color: '#f8fafc',
          boxShadow: isRecording
            ? '0 15px 40px rgba(239, 68, 68, 0.3), 0 0 20px rgba(0,0,0,0.8)'
            : '0 15px 40px rgba(0,0,0,0.8)',
          zIndex: 999999,
          fontFamily: 'Inter, system-ui, sans-serif',
          transition: 'width 0.2s ease, border 0.3s ease',
        }}
      >
        {/* Nagłówek Panelu */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMinimized ? 0 : '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isRecording ? '#ef4444' : replayState.isPlaying ? '#22c55e' : '#94a3b8',
                boxShadow: isRecording ? '0 0 8px #ef4444' : 'none',
                animation: isRecording && !isRecordPaused ? 'rec-pulse 1s infinite' : 'none',
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 700 }}>
              {isRecording
                ? `NAGRYWANIE (${formatTime(recordTimerSec)})`
                : replayState.isPlaying
                ? `ODTWARZANIE (${formatMs(replayState.currentTimeMs)} / ${formatMs(replayState.totalDurationMs)})`
                : 'Studio Ruchów & Replay'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }}
              title={isMinimized ? 'Rozwiń' : 'Zminimalizuj'}
            >
              {isMinimized ? '▲' : '▼'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}
              title="Zamknij studio"
            >
              ✕
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* ─── SEKCJA 1: NAGRYWANIE ─────────────────────────────── */}
            <div
              style={{
                background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'rgba(30, 41, 59, 0.6)',
                border: isRecording ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #334155',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: isRecording ? '#f87171' : '#94a3b8' }}>
                  {isRecording ? `Rejestracja zdarzeń: ${eventsCount}` : 'Rejestrator Twoich Działań'}
                </span>
                {!isRecording && (
                  <input
                    type="text"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    placeholder="Nazwa nagrania..."
                    style={{
                      background: '#0f172a',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '11px',
                      padding: '2px 6px',
                      width: '150px',
                    }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={handleStartRecord}
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>⏺</span> Rozpocznij nagrywanie
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleRecordPause}
                      style={{
                        background: '#334155',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {isRecordPaused ? '▶ Wznów' : '⏸ Pauza'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowMarkerDialog(true)}
                      style={{
                        background: '#334155',
                        color: '#facc15',
                        border: '1px solid #eab308',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      🏷️ Dodaj komentarz
                    </button>

                    <button
                      type="button"
                      onClick={handleStopRecord}
                      style={{
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ⏹ Zakończ i Zapisz
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ─── SEKCJA 2: ODTWARZANIE (REPLAY) ───────────────────── */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8' }}>
                  Odtwarzacz Sesji
                </span>

                <select
                  value={selectedSessionId}
                  onChange={(e) => handleSelectSession(e.target.value)}
                  disabled={isRecording}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '11px',
                    padding: '3px 6px',
                    maxWidth: '220px',
                  }}
                >
                  {savedSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatMs(s.durationMs)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pasek postępu (Scrubber) */}
              <div style={{ marginBottom: '8px' }}>
                <input
                  type="range"
                  min={0}
                  max={replayState.totalDurationMs || 100}
                  value={replayState.currentTimeMs}
                  onChange={(e) => replayer.seekTo(Number(e.target.value))}
                  disabled={isRecording}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
              </div>

              {/* Przyciski kontroli odtwarzacza */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {!replayState.isPlaying ? (
                    <button
                      type="button"
                      onClick={handlePlay}
                      disabled={isRecording}
                      style={{
                        background: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: isRecording ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ▶ Odtwórz
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => replayer.pause()}
                      style={{
                        background: '#eab308',
                        color: '#0f172a',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ⏸ Pauza
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => replayer.stop()}
                    disabled={isRecording}
                    style={{
                      background: '#334155',
                      color: '#94a3b8',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    ⏹ Stop
                  </button>

                  {/* Prędkość */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                    {[1, 1.5, 2, 4].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => replayer.setSpeed(spd)}
                        style={{
                          background: replayState.speed === spd ? '#38bdf8' : '#1e293b',
                          color: replayState.speed === spd ? '#0f172a' : '#94a3b8',
                          border: '1px solid #475569',
                          borderRadius: '3px',
                          padding: '2px 5px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Import / Eksport */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    title="Pobierz nagranie jako plik JSON"
                    style={{
                      background: '#334155',
                      color: '#f8fafc',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    💾 Eksport
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Wczytaj plik nagrania JSON z dysku"
                    style={{
                      background: '#334155',
                      color: '#f8fafc',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    📂 Import
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImportJson}
                  />
                </div>
              </div>
            </div>

            {/* ─── MODAL DODAWANIA ZNACZNIKA / KOMENTARZA ───────────── */}
            {showMarkerDialog && (
              <div
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: '#0f172a',
                  border: '1px solid #eab308',
                  borderRadius: '10px',
                  padding: '16px',
                  width: '320px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                  zIndex: 1000000,
                }}
              >
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#eab308' }}>
                  🏷️ Dodaj komentarz do nagrania
                </h4>
                <form onSubmit={handleAddMarkerSubmit}>
                  <input
                    type="text"
                    value={markerTitle}
                    onChange={(e) => setMarkerTitle(e.target.value)}
                    placeholder="Tytuł kroku (np. Wybór Systemu 32)..."
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '6px 8px',
                      fontSize: '12px',
                      marginBottom: '8px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <textarea
                    value={markerNote}
                    onChange={(e) => setMarkerNote(e.target.value)}
                    placeholder="Dodatkowy opis/wskazówka (opcjonalnie)..."
                    rows={2}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '6px 8px',
                      fontSize: '11px',
                      marginBottom: '10px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setShowMarkerDialog(false)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      style={{
                        background: '#eab308',
                        color: '#0f172a',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Zapisz znacznik
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes rec-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes rec-ripple {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }
        @keyframes rec-fade {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
};
