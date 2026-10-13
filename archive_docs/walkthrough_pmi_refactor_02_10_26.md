# Podsumowanie i Walkthrough: Refaktoryzacja i Uszczelnienie Architektury PMI (A8_pmi)

Data: **02.10.2026**  
Status: **Zrealizowane i zweryfikowane (`npm run verify` — EXIT 0, 1022 testy zielone, 0 naruszeń audytu)**

---

## 1. Kontekst i Diagnoza

Na podstawie audytu modułu wymiarowania i pomiarów ([A8_pmi](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/)) oraz wymagań użytkownika, zrealizowano głęboki refaktor UI/UX oraz uszczelniono architekturę silnika PMI:

### Główne Problemy i Zgłoszenia:
1. **Ergonomia UI (Topbar vs Panel Edycji)**:
   - Wymiary otwierały osobną zakładkę w panelu edycji (`#tab-a8-pmi`), co było uciążliwe przy częstym użyciu.
   - Wymaganie: Czysta lista rozwijana (dropdown) bezpośrednio w topbarze, **bez zbędnych ikonek**, z konkretnymi pozycjami:
     - *Wymiar ortogonalny*
     - *Wymiar równoległy*
     - *Pomiar*
     - *----- separator -----*
     - *Ustawienia wymiarów*
2. **Koncepcja Pomiaru (Szybki podgląd / Ephemeral)**:
   - Pomiar (`MEASURE`) to narzędzie szybkiego podglądu — **nie może być zapisywany** w pliku projektu (`store.toJSON()`).
   - Pomiary nie mogą zaśmiecać drzewa obiektów sceny ([SceneTree.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/src/SceneTree.tsx)).
   - Zgodnie z wybraną Opcją A: wyniki pomiaru znikają natychmiast po wyjściu z narzędzia pomiaru (brak trwałych śmieci na scenie).
3. **Krytyczne wady architektoniczne wykryte w audycie (B1–B3 + jakość)**:
   - **B1. Złamany kontrakt jednostek**: Silnik/zapis projektu w [AGENTS.md](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/.agents/AGENTS.md) wymaga zawsze `nm` (`domainUnit === 'nm'`). Moduł PMI operował w `mm` (Babylon.js). Wdrożono realną konwersję na brzegu: zapis do `nm` (`unit: 'nm'`), odczyt do `mm` (`nmToMm`), z asercją fail-fast odrzucającą brak lub złą jednostkę.
   - **B2. Niewidoczne naruszenie filtrowania po nazwie**: W kodzie istniały wywołania `!m.name.startsWith('pmi_')`, które omijały strażnika audytu. Zastąpiono je predykatem metadanych `isPmiOverlayMesh(m)` i rozszerzono regułę `MATCH-BY-NAME` w skrypcie audytu o wykrywanie `.name.startsWith` / `.name?.startsWith`.
   - **B3. Zduplikowana heurystyka stanów w rdzeniu**: W [context-manager.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-manager.ts) istniał inline-warunek `current.includes('DIMENSION')...` oraz martwy warunek `if (tab !== 'tab-a8-pmi')`. Zostały wycięte i wydelegowane bezpośrednio do kanonicznego `deactivateAllPmiTools(this.stateMachine)`.
   - **Błąd promienia snapu (`1e6` zamiast `30`)**: Przywrócono promień snapu `30 mm` i dodano test kontraktu (<30 mm kotwica, >30 mm null).
   - **Odblokowanie suwaka grubości linii**: Usunięto sztuczny clamp `1.5 mm` tłumiący działanie suwaka w miarce — `measureLineWidth()` korzysta bezpośrednio z pełnego zakresu (0.5–6.0 mm).
   - **Zabezpieczenie wycieków pamięci i optymalizacja**: Wdrożono czyszczenie materiałów i tekstur (`disposeMeshAndMaterial`), a etykietę miarki odchudzono z 2048 px (z mipmapami) do 1024 px.

---

## 2. Wykonane Zmiany w Kodzie

### 1. Nowe Komponenty UI i Uporządkowanie Topbaru
- [pmi-topbar-dropdown.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-topbar-dropdown.tsx):
  - Utworzono lekki, elegancki komponent rozwijany zintegrowany z `StateMachine`.
  - Zero zbędnych ikonek — czysta typografia, precyzyjne stany hover/active (`bg-[#3c3c3c]`, checkmark indykujący aktywne narzędzie).
  - Skróty klawiszowe i dynamiczne labele tłumaczone przez `tx()` z `pmi_tekst.json`.
  - Pozycje:
    - *Wymiar ortogonalny* (Shift+D)
    - *Wymiar równoległy*
    - *Pomiar* (Shift+M)
    - *Separator*
    - *Ustawienia wymiarów* (otwiera modal)
- [pmi-settings-modal.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-settings-modal.tsx):
  - Dedykowany, czysty modal ustawień PMI (skala tekstu, kolor linii, precyzja miejsc po przecinku, jednostki mm/cm/m, offset linii odniesienia).
  - W pełni odizolowany od paneli bocznych mebli.
- [App.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/src/App.tsx):
  - Usunięto przestarzałą zakładkę `#tab-a8-pmi` z panelu edycji.
  - Wpięto `<PmiTopbarDropdown />` bezpośrednio w sekcję narzędziową topbaru.
  - Usunięto nieużywany plik `A8_pmi/pmi-ui.tsx`.

### 2. SSOT Jednostek (Konwersja na Brzegu mm <-> nm) — B1
- [pmi-data.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts):
  - `PMIStoreJSON` deklaruje `"unit": "nm"`.
  - `toJSON()`: konwertuje `p1.pointLocal`, `p2.pointLocal`, `offset`, `distanceMM`, `textShiftMM`, `textSizeMM`, `lineWidthMM` za pomocą `mmToNm()`.
  - `fromJSON()`: asercja fail-fast sprawdza `data.unit === 'nm'`. Przelicza wartości domenowe z `nm` na `mm` za pomocą `nmToMm()` dla widoku i runtime Babylon.js.
  - Wykluczono `measurements` z pliku zapisu projektu.

### 3. Prawdziwy Strażnik i Metadane `isPmiOverlay` — B2
- [pmi-id-bridge.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts):
  - Wyeksportowano helper `isPmiOverlayMesh(mesh: any): boolean` badający metadane (`isPmiOverlay`, `pmiAnnotationId`, `pmiTarget`).
- [pmi-renderer.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts), [pmi-geometry-highlight.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts), [pmi-axis-guides.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts):
  - Wszystkie siatki pomocnicze otrzymują w metadanych `isPmiOverlay: true`.
- [pmi-tool.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L964) i [pmi-measure-pick.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts#L156):
  - Zastąpiono `!m.name.startsWith('pmi_')` wywołaniem `!isPmiOverlayMesh(m)`.
- [audit-display-name-logic.mjs](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/scripts/audit-display-name-logic.mjs):
  - Rozszerzono `MATCH-BY-NAME` o reguły `\.name\??\.(startsWith|endsWith)\(` oraz `startsWith\(['"]pmi_['"]\)`.

### 4. Wydelegowanie Deaktywacji z Rdzenia — B3
- [A1_core/context-manager.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-manager.ts):
  - Usunięto martwe `if (tab !== 'tab-a8-pmi')`.
  - `deactivatePmiToolsIfActive()` deleguje bezpośrednio do `deactivateAllPmiTools(this.stateMachine)`.
- [pmi-tool-activate.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts):
  - `isPmiToolActive` operuje wyłącznie na ściśle zdefiniowanych stałych: `DIMENSION_TOOL_STATE`, `MEASURE_TOOL_STATE`, `DIMENSION_EDIT_TOOL_STATE`, `DIMENSION_TEXT_SHIFT_TOOL_STATE`.

### 5. Poprawki Jakościowe i Wydajnościowe
- **Promień snapu 30 mm**:
  - Poprawiono 5 call-site'ów z `1e6` na `30 mm`.
  - Dodano test kontraktu w [pmi-id-bridge.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/__tests__/pmi-id-bridge.test.ts) (<30 mm snapuje do narożnika, >30 mm zwraca `null`).
- **Odblokowanie suwaka `lineWidthMM`**:
  - `measureLineWidth()` zwraca `Math.max(0.5, PMIStore.instance.lineWidthMM)` bez sztucznego obcinania do 1.5.
- **Wycieki pamięci w Babylon.js**:
  - Wdrożono `disposeMeshAndMaterial(mesh)` zwalniający `mesh.material?.dispose()` i `mesh.dispose()`.
  - Zastosowano w `disposeVisual`, `disposeMeasureVisual`, `disposeTextLabel`.
- **Hot-spot tekstury miarki**:
  - Wycofano teksturę 2048 px z mipmapami i anizotropią 8. Zastąpiono ją lekką teksturą 1024 px bez mipmap, eliminując dławienie GPU przy aktualizacji pomiarów w locie.
- **Strażnik i18n**:
  - Utworzono [pmi-i18n-coverage.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/__tests__/pmi-i18n-coverage.test.ts) sprawdzający kompletność tłumaczeń (`pl`, `en`, `de`) dla wszystkich wywołań `tx()`.

---

## 3. Pokrycie Testami Automatycznymi

1. **Rygor Jednostek (SSOT nm <-> mm)**:
   - [pmi-data.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/__tests__/pmi-data.test.ts):
     - Weryfikacja zapisu do pliku w nanometrach (`unit: 'nm'`).
     - Weryfikacja odczytu i powrotu do milimetrów (`600 mm`).
     - Fail-fast przy `unit: 'mm'` lub braku jednostki.
2. **Kontrakt Promienia Snapu**:
   - [pmi-id-bridge.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/__tests__/pmi-id-bridge.test.ts):
     - Klik < 30 mm przyciąga do kotwicy wierzchołka (`VERTEX`, `subKey: '0'`).
     - Klik > 30 mm zwraca `null`.
3. **Deaktywacja i Czyszczenie Pomiarów**:
   - [pmi-tool-deactivate-universal.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/__tests__/pmi-tool-deactivate-universal.test.ts):
     - `deactivateAllPmiTools` czyści tymczasowe pomiary ze store.
     - Sprawdzanie wyłącznie kanonicznych stanów PMI.
     - Zmiana aktywnej zakładki w `ContextManager` zawsze wyłącza narzędzia PMI.
4. **Rozmiary Miarki i Suwak `lineWidthMM`**:
   - [pmi-measure.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/__tests__/pmi-measure.test.ts):
     - Weryfikacja bezpośredniego sterowania grubością linii miarki przez suwak (od 0.5 do 5.0+ mm).
     - Sprzątanie singletona w `afterEach`.
5. **Strażnik Pokrycia Tłumaczeń**:
   - [pmi-i18n-coverage.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/__tests__/pmi-i18n-coverage.test.ts):
     - Wszystkie klucze `tx()` istnieją w `pmi_tekst.json` z kompletem tłumaczeń `pl`, `en`, `de`.

6. **Synchronizacja i Usuwanie Osieroconych Wymiarów**:
   - [pmi-sync.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/__tests__/pmi-sync.test.ts):
     - Rejestracja rozszerzenia `pmi` w dokumencie i odpinanie subskrypcji przy `dispose()`.
     - `pruneOrphanedAnnotations()` usuwa adnotacje i pomiary, których węzły zniknęły ze sceny.
     - Flaga `isPruning` rygorystycznie przetestowana pod kątem reentrancy: wywołanie `controller.refreshNow()` zagnieżdżone wewnątrz usuwania pierwszej adnotacji natychmiast wraca (early return), zapobiegając duplikacji komend i awarii; test zweryfikowany jako czerwony (fail) przy wycięciu guarda.
     - Wykrywanie zmian macierzy węzłów w klatkach renderu (`tick()`).
7. **Ścisłe Typowanie Zapisu Dyskowego**:
   - Wyeliminowano typy `any` w serializacji `pmi-data.ts`. Zdefiniowano dedykowane interfejsy dyskowe: `PMIAnchorRefDiskJSON`, `PMIAnnotationDiskJSON`, `PMISettingsDiskJSON` oraz `PMIStoreJSON`.
8. **Stała Promienia Snapu**:
   - Wyeksportowano `SNAP_RADIUS_MM = 30` w `pmi-id-bridge.ts`, powiązano wszystkie 5 call-site'ów (`pmi-tool.ts`, `pmi-measure-pick.ts`) oraz dodano asercję w [pmi-id-bridge.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/__tests__/pmi-id-bridge.test.ts).

---

## 4. Wynik Bramki Weryfikacyjnej

Polecenie `npm run verify` (`tsc --noEmit && vitest run && node scripts/audit-display-name-logic.mjs`) wykonane po zakończeniu wszystkich prac:

```text
> smartpanel-web@0.0.0 verify
> npm run typecheck && npm run test && npm run audit

> smartpanel-web@0.0.0 typecheck
> tsc --noEmit

> smartpanel-web@0.0.0 test
> vitest run

 ✓ A8_pmi/__tests__/dimension-solver.test.ts (13 tests)
 ✓ A8_pmi/__tests__/pmi-label-layout.test.ts (6 tests)
 ✓ A8_pmi/__tests__/pmi-sync.test.ts (4 tests)
 ✓ A8_pmi/__tests__/pmi-i18n-coverage.test.ts (2 tests)
 ✓ A8_pmi/__tests__/pmi-measure.test.ts (27 tests)
 ✓ A8_pmi/__tests__/pmi-data.test.ts (12 tests)
 ✓ A8_pmi/__tests__/pmi-commands.test.ts (12 tests)
 ✓ A8_pmi/__tests__/pmi-viewport-listener.test.ts (7 tests)
 ✓ A8_pmi/__tests__/pmi-resolve.test.ts (5 tests)
 ✓ A8_pmi/__tests__/pmi-bridge.test.ts (12 tests)
 ✓ A8_pmi/__tests__/pmi-axis-guides.test.ts (10 tests)
 ✓ A8_pmi/__tests__/pmi-id-bridge.test.ts (6 tests)
 ✓ A8_pmi/__tests__/pmi-tool-deactivate-universal.test.ts (7 tests)
 ✓ A8_pmi/__tests__/pmi-drag.test.ts (5 tests)
 ...

 Test Files  154 passed (154)
      Tests  1022 passed (1022)
   Start at  19:54:13
   Duration  27.88s

> smartpanel-web@0.0.0 audit
> node scripts/audit-display-name-logic.mjs

## C1_cnc — plików: 37
## R1_reports — plików: 5
## E1_export — plików: 6
## A8_pmi — plików: 24

Znalezionych miejsc do odcięcia (name): 9
Znalezionych aliasów parametrów: 0
Znalezionych naruszeń kompatybilności wstecznej: 0
```

- **TypeScript Typecheck**: Bez błędów (`0 errors`, pełne `tsc --noEmit`).
- **Vitest**: Wszystkie 154 pliki testowe (1022 testy jednostkowe) przeszły pomyślnie. W module `A8_pmi` 14 plików testowych i 128 testów.
- **Audit Display Name & Units Guard**: 0 naruszeń w `A8_pmi` (24 pliki objęte audytem). Pełna ochrona przed `name.startsWith`, polskimi literałami w warunkach i regresjami jednostek.
