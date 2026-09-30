# Projektowe zasady agenta

## Jednostki (SSOT) — NIE ZGADUJ, NIE ZMIENIAJ

Źródło prawdy: `A1_core/cad-math/units.ts` (`mmToNm`, `nmToMm`, `rulesMToNm`, `rulesMToMm`).

### Decyzja projektowa (prosto)
- **Nowe / ręczne JSON katalogów** (okucia, uchwyty, szuflady, nawierty) → **`mm`** + pole `"units": "mm"`.
- **Silnik / domena / zapis projektu** → zawsze **`nm`** (`mmToNm` na brzegu).
- **UI** → **`mm`**.
- **CNC post** → **`mm`** (`nmToMm`).
- **Nie używaj `nm` w JSON katalogów** (nieczytelne). **Nie dodawaj nowych plików w metrach.**
- Stare pliki w **metrach** (legacy Bloki rules / część `Biblioteki/okucia`) → zostaw; do silnika tylko `rulesMToNm`. Nie mieszaj m i mm w jednym pliku.

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

## Architektura Modułów Bloki (`A2_bloki/`)
- **Funkcyjny Rdzeń (Functional Core)**: Moduły operują na czystych funkcjach `normalize{Mod}Params(raw, dims)` oraz `calculate{Mod}Plan(dims, params)`. Klasy `*Engine` pełnią wyłącznie rolę cienkich adapterów.
- **Jawne jednostki fizyczne w zmiennych**: Wszystkie zmienne i DTO wewnątrz silników MUSZĄ posiadać sufiksy jednostek (np. `grubosc_polki_mm`, `odsuniecie_przod_mm`, `liczba_polek`, `szczelina_mm`).
- **SSOT Parametrów**: Pełna dokumentacja parametrów modułów znajduje się w [`A2_bloki/BLOKI_PARAMETERS.md`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/BLOKI_PARAMETERS.md).

## Architektura Formatek (SmartPanel)
- Geometrię płyty buduje **NativePanelBuilder** (`A4_smartpanel/native-panel-builder.ts`, `native_core/mesh_builder.ts`, `polygon-extrusion.ts`).
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

## Tożsamość i Taksonomia — TWARDE ZASADY (id / rola / nazwa / purpose)

Logika NIGDY nie czyta stringów wyświetlanych. Obowiązuje trójpodział (+ intencja obróbki):

| Warstwa | Pole | Do czego | Tłumaczyć? |
|---|---|---|---|
| Tożsamość | `node.id` (UUID, `A1_core/cad-node/cad-node.ts:30`, nadawane raz, zapisywane w projekcie) | sync CAD↔CAM, matchowanie, referencje, klucze map | NIE — nigdy |
| Klasyfikacja bryły | `role` (`SHELF`, `FRONT`, `BACK_PANEL`, `HINGE_LOCATOR`, `LED`…), `nodeType` (`PART`, `ASSEMBLY`, `HARDWARE`, `FEATURE`), `report_type` | filtrowanie, strategie CNC, raporty, routing | NIE — kody |
| Intencja obróbki | `GrooveFeature.purpose` (`LED_CHANNEL`, `BACK_GROOVE`, `GENERIC`, `C1_cnc/dto/cam-dto.ts`) | dobór narzędzia/strategii dla rowków | NIE — kody |
| Wyświetlanie | `node.name`, `feat.name`, labele z `*_tekst.json` | drzewo sceny, panele UI, raporty, G-code, eksport | TAK — jedyne tłumaczone |

**Twarde zakazy:**
- NIE matchuj po `name` (`===`, `includes`, `startsWith` na nazwach) — tylko `id` / referencja.
- NIE rób fallbacków `role || name`, `id || name` — brak roli/id to błąd walidacji (fail fast), nie zgadywanie. Aplikacja niewydana: zero wstecznej kompatybilności po nazwach.
- NIE wykrywaj typu elementu po nazwie (`includes('plecy')`, `includes('led')`, `endsWith('_SB')`, `=== 'BRAK CENY'`) — tylko `role` / `nodeType` / `purpose` / flagi strukturalne (`is_blok`, `params.source`, `library_id`).
- NIE używaj polskich literałów w warunkach — statusy jako flagi/kody (`operations.length === 0`, `status: 'STOPPED'`).
- `part_id` w raportach = tożsamość (`nodeId`), nie display name.
- Strażnik: `node scripts/audit-display-name-logic.mjs` — lista miejsc do odcięcia; po refactorze ma być pusto w kategoriach MATCH-BY-NAME / ROLE-FALLBACK-NAME.

## Taksonomia elementów (PART vs HARDWARE + kody materiału)

- `PART` = element **wytwarzany** (płyta, front, lustro, pianka). `HARDWARE` = element **kupowany** (zawias, prowadnica, profil LED jako listwa — z `library_id` z `B1_biblioteka`). Zawias jako PART to błąd kategorii (trafi na piłę).
- Profil LED to DWA byty: listwa (`HARDWARE`, rola `LED`) + rowek pod nią (`FEATURE`/`GrooveFeature` z `purpose: 'LED_CHANNEL'` na formatce).
- Routing obróbki TYLKO przez `resolveProcessingPath()` (`A7_material/material-processing.ts`): `SAW_CNC` (płyty), `GLASS_SHOP` (szkło/lustra), `UPHOLSTERY` (pianki — nóż, brak obrzeża), `PURCHASE` (okucia), `UNRESOLVED` (jawny brak routingu, nie zgadywanie).
- Kategorie materiału to kody (`BOARD`, `SOLID_WOOD`, `GLASS`, `MIRROR`, `FOAM`, `OTHER`). Wolny polski tekst `category` (`"Płyta Wiórowa"`) zostaje tylko w display (filtr UI, cennik); logika mapuje go raz na brzegu przez `mapLegacyCategoryName()`.

## Dokumentacja jako kontrakt — reguły MUSZĄ być egzekwowane automatycznie

Zasada zapisana w tym pliku **bez automatycznego sprawdzenia jest prośbą, nie regułą**.
Jeśli reguła może zostać złamana i testy tego nie wykryją, to nie jest to reguła — jest to
prośba, która wygasa przy pierwszym refaktorze pod presją czasu.

Każda twarda zasada z tego pliku powinna mieć odpowiednik wykrywający naruszenie.

### Stan obecny: `npm run verify`

Jedno polecenie uruchamia całą bramkę:

```
npm run verify   # = typecheck (pełne tsc) && test && audit
```

| Etap | Co sprawdza | Skąd |
|------|-------------|------|
| `typecheck` | Cały `web/` (`tsc --noEmit`) | `package.json` |
| `typecheck:core` | A1+A2+A3+A4+A5+C1+B1+A7+S2+C2+O1 (szybsza bramka lokalna) | `scripts/typecheck-core.mjs` |
| `test` | Vitest | `vitest run` |
| `audit` | naruszenia kontraktów | `scripts/audit-display-name-logic.mjs` |

`audit` kończy się `exit 1` przy każdym naruszeniu — nie tylko loguje. Wyjątkiem
jest kategoria `NAME-FALLBACK-LITERAL`, która raportuje, ale nie blokuje.

### Reguły z automatycznym strażnikiem

| Reguła (w tym pliku) | Strażnik | Wykrywa |
|----------------------|----------|---------|
| Jednostki: NIE zgaduj po wartości | `UNIT-GUESS` | `n > 50_000 ? nmToMm(n) : n`, gołe `* 1e6` / `/ 1_000_000` |
| Wpisuj `_mm`, nie aliasy | `LEGACY-PARAM-ALIAS` | `gp.zoneCount`, `bottomHeight:`, `blindSide:` … (słownik: `A3_smartframe/smartframe-types.ts`) |
| Wejście ścian tylko `FACE_*` | `FACE-ALIAS` | `normalizeFaceName('front')`, `'+Z'`, `EDGE_X_MINUS` |
| Bloki tylko `*_mm` | `BLOKI-DIMS` | `params.width`, `gp.depth`, `dims.height` |
| Drzwi narożne tylko `*_mm` | `CORNER-DOORS-LEGACY` | `width:`/`height:` w params narożnych zamiast `width_mm` |
| Drzwi / szuflady / klapy: kanoniczne klucze | `BLOKI-MODULE-LEGACY` | `doorWidth`, `drawerCount`, `flapHeight` i podobne aliasy |
| Postprocessory tylko `CLDataProgram` | `DEAD-API` | `ProcessedCAMProject`, `inchToNm`, `TO_MICRONS`, `Microns` |
| Logika nie czyta `name` | `MATCH-BY-NAME`, `ROLE-FALLBACK-NAME`, … | `=== node.name`, `includes('plecy')` |
| Zakaz wycofanej nazwy modułu A2 | `ZERO-SMARTBOX` | całkowity zakaz używania wycofanej nazwy 'sb' w kodzie i dokumentacji |


**SSOT strażnika:** `scripts/audit-display-name-logic.mjs`. Wyjątki od reguł są
wymienione w nim jawnie (`GIZMO_OWNED`, `ALIAS_DICTIONARY_FILES`, `DEAD_API_ALLOWED`) —
nowy wyjątek musi być tam dopisany z komentarzem **dlaczego**, inaczej zostanie uznany
za ciche obejście reguły.

**Stan na dziś:** wszystkie powyższe kategorie = `0` naruszeń, `exit 0`.

### Jak dodać regułę (nie pomijaj kroków)

1. Dopisz zasadę do tego pliku.
2. Dopisz odpowiedni wzorzec do `RULES` / `LEGACY_PARAM_ALIAS` / `DEAD_API_RES` w skrypcie audytu.
3. Uruchom `npm run audit` — **musi złapać przykładowe naruszenie**, nie tylko być cicho.
4. Dopisz test jednostkowy dla kontraktu (`A3_smartframe/__tests__/canonical-params.test.ts` wzorem).
5. Bez punktów 3–4 zasada nie wchodzi do repo.

### Zasada porządku: najpierw kontrakt, potem implementacja

- Nowy kontrakt danych (DTO, parametry modułu) zaczyna się od **typu + testu odrzucającego alias**,
  a nie od migracji danych. Zero kompatybilności wstecznej: stare wejście ma rzucić czytelny błąd,
  nie zostać naprawione po cichu.
- Fail-fast jest wartością: `assertCanonicalCabinetParams` istnieje po to, żeby zły klucz
  zatrzymał build, a nie wygenerował cichej, złej geometrii.
- Wyjątek od reguły bez wpisu w strażniku = regresja, nie świadoma decyzja.

## Tłumaczenia (T1_tlumaczenia, faza 1: pl/en/de)

- Teksty UI modułu mieszkają w JEDNYM pliku obok modułu: `A2_bloki/shelves_tekst.json` (`{ "klucz": { "pl":…, "en":…, "de":… } }`). Produkcja (`*_rules_V1.json`) trzyma tylko klucze — plików produkcyjnych NIE wysyła się do tłumaczy.
- Adaptery: zero polskich stringów w JSX — tylko `tx(tekst, 'klucz', NS)` z `T1_tlumaczenia/core.ts` (fallback aktywny → en → pl) + `useLocale()` z `T1_tlumaczenia/react.tsx`. Placeholdery: `tx(d, 'section.label_template', NS, { n: 3 })`.
- Nazwy techniczne nodów (`Polka_1`, `Drazek_fi25`), klucze parametrów (`shelfCount`), role, `report_type` — NIETŁUMACZONE, stabilne we wszystkich językach.
- Niemieckie (`de`) szkice oznacza autor do weryfikacji; cyrylica (`ru/bg/uk`) później jako dopisane klucze — bez zmian kodu.