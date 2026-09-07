# Projektowe zasady agenta

## Jednostki (SSOT) — NIE ZGADUJ, NIE ZMIENIAJ

Źródło prawdy: `A1_core/cad-math/units.ts` (`mmToNm`, `nmToMm`, `rulesMToNm`, `rulesMToMm`).

### Decyzja projektowa (prosto)
- **Nowe / ręczne JSON katalogów** (okucia, uchwyty, szuflady, nawierty) → **`mm`** + pole `"units": "mm"`.
- **Silnik / domena / zapis projektu** → zawsze **`nm`** (`mmToNm` na brzegu).
- **UI** → **`mm`**.
- **CNC post** → **`mm`** (`nmToMm`).
- **Nie używaj `nm` w JSON katalogów** (nieczytelne). **Nie dodawaj nowych plików w metrach.**
- Stare pliki w **metrach** (legacy SmartBox rules / część `Biblioteki/okucia`) → zostaw; do silnika tylko `rulesMToNm`. Nie mieszaj m i mm w jednym pliku.

| Warstwa | Jednostka | Uwagi |
|--------|-----------|--------|
| Domena CAD / `CADNode` / silniki / zapis projektu | **nm** | `domainUnit === 'nm'`; wartości całkowite |
| UI / formularze / etykiety | **mm** | konwersja tylko na brzegu UI ↔ domena |
| **Nowe** JSON bibliotek / katalogów | **mm** | adapter → `mmToNm` |
| Legacy JSON rules / okucia (istniejące) | **m** | tylko `rulesMToNm` / `rulesMToMm` |
| Postprocesory CNC / G-code | **mm** (lub inch) | z domeny: `nmToMm` |

**Twarde zakazy:**
- NIE zmieniać domeny na metry ani milimetry „dla wygody”.
- NIE pisać własnych przeliczników (`* 1000`, `* 1e6`, `n < 2` → „to metry”) — tylko helpery z `units.ts`.
- NIE mieszać jednostek w jednym pliku JSON / jednym polu modelu bez jawnej konwersji na brzegu.
- NIE traktować wartości z UI (mm) jako wartości domenowych (nm) i odwrotnie.
- NIE tworzyć nowych katalogów okuć w metrach ani nanometrach — tylko **mm**.

Przeliczniki: `1 mm = 1_000_000 nm`, `1 m = 1_000_000_000 nm`.

### Biblioteka modeli (`B1_biblioteka/`)
- Nowe GLB i katalogi mm: `B1_biblioteka/{zawiasy|uchwyty|szuflady|silowniki|carga|nozki|…}/` (`catalog.json` + `models/*.glb`).
- Legacy: `Biblioteki/okucia/`, `Biblioteki/szuflady.json` — nie usuwać bez migracji; nowe pozycje preferuj w `B1_biblioteka`.

## Architektura Formatek (SmartPanel)
- Projekt odchodzi od korzystania z ciezkiego jadra OCCT (OpenCASCADE) na froncie.
- Domyślnym, aktywnym i rozwijanym silnikiem budowania siatek jest **NativePanelBuilder** (A4_smartpanel/native-panel-builder.ts oraz native_core/mesh_builder.ts).
- Klasa `OcctPanelBuilder` została przeniesiona do archiwum (`A4_smartpanel/legacy_occt/`) i **NIE NALEŻY JEEJ UŻYWAĆ ANI MODYFIKOWAĆ**, chyba że użytkownik o to bezpośrednio poprosi (np. w kontekście importu STEP).
- Do wszystkich zadań związanych z meblami używaj wyłącznie natywnego podejścia opartego na triangulacji 2D (np. `earcut`).

## Architektura CNC / CAM (Precyzja Danych)
- **Zawsze używaj dokładnych danych matematycznych B-rep (`brepPoints`) zamiast `BoundingBox`** (siatki wizualnej) przy wyliczaniu współrzędnych i głębokości (Z) w module CAM. 
- Modele 3D (np. rurki dla krawędzi) służą wyłącznie jako elementy interfejsu (hitboxy do zaznaczania). Obliczenia ścieżek CNC w `CncPanel.tsx` oraz innych modułach muszą bazować na metadanych osadzonych podczas budowy mesha (`mesh.metadata.brepPoints`), aby uniknąć przekłamań wynikających z grubości i teselacji siatki wizualnej.

## Architektura CAM CNC (`C1_cnc`) — Praca z Modułem Obróbczym
- **Standard CLData (ISO 4343)**: Generatory ścieżek CAM MUSZĄ wypluwać obojętny kod `CLDataProgram` (zdefiniowany w `C1_cnc/core/cl-data.ts`). Zabrania się generowania tekstów G-kodu bezpośrednio z cech obróbczych.
- **Wzorzec Strategii (`MachiningStrategy`)**: Algorytmy przeliczania ścieżek narzędziowych (wiercenie, konturowanie, kieszenie, trochoida) muszą dziedziczyć po interfejsie `MachiningStrategy` w `C1_cnc/strategies/base-strategy.ts`.
- **Scentralizowany Stan (`CAMStateStore`)**: Wszystkie komponenty UI oraz silniki operacji powinny odwoływać się do magazynu stanu `CAMStateStore` w `C1_cnc/core/cam-state-store.ts`.
- **Modułowość UI**: Podział zakładek UI znajduje się w `C1_cnc/ui/tabs/` (`WcsTab`, `ToolManagerTab`, `OperationsTab`, `SimulationTab`, `GCodeTab`). Szczegółowy opis architektury modułu znajduje się w [`ARCHITEKTURA_CNC.md`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ARCHITEKTURA_CNC.md).

## Zasada Współpracy: Architekt-Wykonawca (Orkiestrator)
NIGDY nie modyfikuj plików bezpośrednio po prośbie użytkownika, jeśli zadanie wymaga więcej niż jednej prostej zmiany. 
Najpierw przyjmij rolę Managera: przeanalizuj kod, przedstaw użytkownikowi plan działania (implementation_plan) i zapytaj, czy logika ma sens. 
Dopiero gdy użytkownik zatwierdzi plan (jako QA/Architekt), przejdź do modyfikacji plików zgodnie z listą zadań. Po każdej znaczącej zmianie poinformuj o potrzebie uruchomienia weryfikacji.