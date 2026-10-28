# Instrukcja Montażu — moduł I1_instrukcja (podstrona jak CNC)

Implementacja planu "animowane instrukcje montażu" — fazy 1..3. Silnik 3D: **Babylon.js**
(S3_scena CAD). Kod wydzielony z E1_export (tam rozjeżdżał eksport) jako **samodzielny
moduł-produkcja `I1_instrukcja`**: podstrona `instrukcja.html` (jak CNC/nesting),
wywoływana z drzewa **PPM → Produkcja → Instrukcja montażu** dla pojedynczego korpusu /
bloku / projektu (`openInstrukcjaFromCad`). Podstrona nie czyta ProjectDocument — dostaje
payload sesji; animację odtwarza okno CAD na żywej scenie (`MODULE_PLAY_MSG`).

| Plan (Hassan / Together AI) | Rzeczywista implementacja |
|---|---|
| Silnik Reguł: uniwersalne priorytety (kołki/mimośrody → boki → plecy → fronty) | `assembly-sequence-rules.json` — kolejność fazy + role + tryb; funkcja `buildAssemblySequence()` |
| BOM → sekwencja | `AssemblyPlan` (steps + hardwareCounts) — z `collectAssemblyPartRefs(document, { containerId })` i złączy `ConnectorStore.instance.groups` (moduł C2 — kołki/konfirmat/minifix, siatka 32) |
| Renderowanie 3D (zamiast Three.js — własny Babylon viewport) | **animacja na żywej scenie CAD**: `AssemblyAnimPlayer.play()`; wariant kadrów PDF (`SavedExportView`) zostaje w E1 na przyszłość |
| Dynamiczne przeliczanie (zmiana wymiarów → nowe liczności) | plan liczony **za każdym razem** z SSOT dokumentu w nm; reguły niezależne od geometrii |

## Kroki użytkownika (UI)

1. **PPM na korpusie / bloku / projekcie** w drzewie → Produkcja → **Instrukcja montażu korpusu/bloku/projektu** — otwiera podstronę `instrukcja.html`. PPM na formatce w korpusie używa **korpusu-rodzica** (instrukcja dotyczy zawsze korpusu).
2. **Podstrona**: lista kroków (krok 0 = inwentarz), 🔩 liczność łączników/okuć, **Czytaj krok (TTS)**, **Czytaj całość**, **Skrypt lektora (.txt)**.
3. **▶ Odtwórz animację w CAD** — BroadcastChannel (`MODULE_PLAY_MSG`) do okna CAD; plan liczony od zera z żywego dokumentu w scope klikniętego korpusu, animacja gra na meshe żywej sceny i wraca do stanu złożonego (`restore()`).

## Struktura plików (wzorzec modułu, engine 100% PURE / testowalne w Vitest)

```
assembly-sequence-rules.json  — reguły: kolejność faza, roles, mode (single/joint)
assembly-sequence-engine.ts   — silnik reguł: plan kroków z parts + cfg → kroki (PURE)
assembly-scene-adapter.ts     — document + ConnectorStore → AssemblyPlan (scope: containerId) + fingerprint/prune
assembly-lektor.ts            — tekst kroku + skrypt lektora + TTS (i18n, hook na LLM)
assembly-anim.ts              — player animacji złożenia na żywej scenie (Babylon), WebM recorder
instruction-app.tsx           — podstrona instrukcja.html (kroki / TTS / ▶ w CAD)
instruction-playback.ts       — CAD-side mostek MODULE_PLAY_MSG → AssemblyAnimPlayer
instrukcja_tekst.json         — texts pl/en/de (ModuleTexts, T1_tlumaczenia)
__tests__/assembly-sequence.test.ts
__tests__/assembly-scope.test.ts  — scope pojedynczego korpusu (fingerprint/staleness)
```

Integracja w `src/`: `module-data/{types,session,cad-extract,open-modules,tree-context-menu}.ts`,
`src/instrukcja-entry.tsx`, `instrukcja.html`, `vite.config.ts` (multi-page), `App.tsx`
(installInstructionPlaybackBridge).

## Kluczowe koncepty

- **krok** = grupa części danej fazy (single: 1 formatka, joint: wszystkie formatki roli
  w jednej ramce, np. wieńce).
- **łączniki (kołki / konfirmat / minifix)** nie mają własnych węzłów sceny — liczność
  w kroku pochodzi z `ConnectorGroup.connectors` i jest dołącza do kroku, w którym
  pojawia się **ostatni** z paneli złącza ("najpierw kołki w dnie, potem dołączysz bok").
- **okuca avatarowe** (zawiasy, podpórki, prowadnice) → krok **pierwszej** formatki
  ich rodzica (bloku).
- **widoczność w kroku jest kumulatywna** — w kroku n widoczne wszystko do n, reszta
  ukryta: dokładnie ten stan sceny kadr eksportu (`restoreExportNodeVisibility`).

## Przypisanie planu/kadrów do szafek i projektu (anti-bug: usunięty korpus)

Plan (a w starym wariancie E1 także kadry `asm_*`) jest **przypięty do konkretnych korpusów (szafek) i fingerprintu zawartości**:
- `plan.meta` = `assemblyScopeFingerprint(doc)` = `{ scopeContainerIds, partsHash, partsCount }`
  (hash djb2 spisu `${nodeType}:${nodeId}:${role}:${parentId}:hardware=${hardwareId}`),
- każdy `SavedExportView` z `id === 'asm_*'` ma tag `assembly: { scopeContainerIds, partsHash }`,
- **`isPlanStale()`** przy odtwarzaniu animacji/zapisie: plan bez meta, usunięta szafka
  lub zmieniona zawartość → „wygeneruj sekwencję ponownie",
- **`pruneAssemblyViews()`** czyści martwe kadry: przy montażu sekcji UI, przy zapisie kadrów
  oraz **automatycznie przy otwarciu projektu** (`drawings-document-extension.ts → loadDrawings`).
  Kadry non-asm (normalne rzuty użytkownika) nigdy nie są kasowane; `asm_*` bez tagu
  (stary format) są usuwane — prościej wygenerować od nowa.

## Fazy podejścia (Krok 2/3 w planie)

- **Łączniki C2 w animacji (kołki/konfirmaty)**: silnik zapisuje w kroku `connectorGroupIds`
  (krok ostatniego panelu złącza); meshe-instancje złączy z `ConnectorVisualizer` mają metadata
  `c2Connector { groupId, instanceIndex, normalMm }` — player animuje je w kroku: wbiegają
  w otwór wzdłuż normalnej styku. Fingerprint planu uwzględnia złącza (`assemblyConnectorHash`):
  dodanie/usunięcie kolka unieważnia plan. Symbole łączy są widoczne w trybach wireframe/xray.
- **Kierunki exploda (zasady montażu; CAD: −Y = przód, +Y = tył, Z = pion)**:
  wieńce na osi Z (dno → −Z, góra → +Z), boki → ±X (lewy z lewej, prawy z prawej),
  plecy → +Y (do tyłu), fronty → −Y (do przodu), wszystko WEWNĄTRZ (półki, działki,
  nieznane role) → wysuwa się do przodu (−Y), jak szuflada. Kierunek kroku = rola
  pierwszej formatki w kroku (okuca dziedziczą). Mapa: `explodeDirForRole()` /
  `EXPLODE_ROLE_DIRS` w `assembly-anim.ts` — jedna tabela do korekt.
- Rozkrok/offset unassembled części (poses + offset eksploda) — wejście:
  `nodePoses` w `SavedExportView` (silnik już obsługuje zmiany pozycji).
- Animacja demo: `AssemblyAnimPlayer.play()` + nagrywanie WebM w rozdzielczości
  docelowej (`engine.setSize(720p/1080p/1440p/4K)` + MediaRecorder).
- Lektor przez LLM (GPT-4o / Llama): `stepLektorText()` jest strukturalny —
  nadpisujesz jedną funkcję, reszta (kadry, druk, .txt, TTS) zostaje.
- Bot wizyjny (kamera → porównanie z modelem) — oddzielne API modułu.
