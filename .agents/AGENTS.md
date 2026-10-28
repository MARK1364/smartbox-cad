# Projektowe zasady agenta

## 0. KROK ZERO: Wczytanie Mapy Aplikacji i Szybka Nawigacja (BEZWZGLĘDNY PIERWSZY PUNKT)

Przed przystąpieniem do jakichkolwiek prac, czytania plików czy przeszukiwania repozytorium **AGENT MA BEZWZGLĘDNY OBOWIĄZEK** skorzystać z map architektury jako pierwszego punktu wyjścia:
1. **SSOT Mapy Architektury**: [`docs/ARCHITECTURE_GRAPH.md`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/docs/ARCHITECTURE_GRAPH.md) — zawiera tabelę szybkiego namierzania (*"Gdy problem dotyczy... → Plik z logiką źródłową → Powiązany test"*), diagramy przepływu danych i powiązania modułów.
2. **Indeks Symboli AST**: [`docs/REPO_MAP.md`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/docs/REPO_MAP.md) — pozwala natychmiast zlokalizować dokładny plik, sygnaturę, typ i numer linii bez przeszukiwania kodu na ślepo.
- **Twardy zakaz marnowania czasu**: BEZWZGLĘDNY ZAKAZ czytania dużych plików na raty po 100–150 linii i zgadywania struktury. Używaj mapy repozytorium, precyzyjnego `grep` oraz bezpośredniej edycji w jednym podejściu, aby zadania trwały 1–2 minuty, a nie kilkanaście.

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
- Nowe GLB i katalogi mm: `B1_biblioteka/{zawiasy|uchwyty|szuflady|silowniki|carga|nozki|zawieszki|…}/` (`catalog.json` + `models/*.glb`).
- **Zasada Trójki Plików (Identyczna Nazwa Bazowa)**: W katalogach biblioteki każdy element opiera się na plikach o DOKŁADNIE TEJ SAMEJ nazwie bazowej leżących w tym samym folderze:
  1. `{Nazwa}.json` — parametry, wymiary w mm (`"units": "mm"`), definicja brył.
  2. `{Nazwa}.png` — ikona / miniatura do UI katalogu.
  3. `{Nazwa}.glb` — model siatki 3D (jeśli element posiada plik GLB; w przypadku braku GLB silnik buduje parametryczne bryły z JSON-a).
- Legacy: `Biblioteki/okucia/`, `Biblioteki/szuflady.json` — nie usuwać bez migracji; nowe pozycje preferuj w `B1_biblioteka`.

## Architektura Modułów Bloki (`A2_bloki/`)
- **Numeracja plików (prefiks = rodzina)**: Każdy plik w katalogu głównym `A2_bloki/` ma prefiks `NN_` będący numerem RODZINY bloku (nie kolejnym numerem pliku). Dzięki temu pliki jednej rodziny sortują się razem, a dodanie nowego pliku do istniejącej rodziny nie zmienia numeracji. Rodziny:
  - `01_*` — rdzeń współdzielony (`base-engine`, `bloki-core`, `bloki-types`, `bloki-module-types`, `bloki-ui`, `module-plans`, `machining-intent`, `machining-sync`, `register`, `smartparts-catalog`, `smartparts-ui.css`, `BLOKI_PARAMETERS.md` …)
  - `02_*` — wnęka (bay): `bloki-bay-*`, `bay-reference-walls-panel`, `bloki-offset-gizmo`, `bloki-ref-plane-hint`
  - `03_shelf` · `04_shelves` · `05_doors` · `06_skosne-doors` · `07_corner-doors` · `08_tubes` · `09_drawers` · `10_dividers` · `11_panels` · `12_flaps` · `13_led-internal` · `14_led-external` · `15_led-external-channel` · `16_led` · `17_hangers`
  - **Nowa rodzina** = następny wolny numer (np. `18_...`). Pliki w podfolderach (`commands/`, `handles/`, `hangers/`, `plugins/`, `core/`, `ui/`, `__tests__/`) NIE dostają numeru — są już pogrupowane.
  - **Wyjątki bez numeru**: `index.ts` (barrel, importy katalogowe `../A2_bloki`), zasoby niebędące modułami (`123.PNG`). Referencje do nazw trzymaj w `scripts/audit-display-name-logic.mjs` zsynchronizowane — brak wpisu w `requirePath` to cicho wyłączona reguła.
- **Funkcyjny Rdzeń (Functional Core)**: Moduły operują na czystych funkcjach `normalize{Mod}Params(raw, dims)` oraz `calculate{Mod}Plan(dims, params)`. Klasy `*Engine` pełnią wyłącznie rolę cienkich adapterów.
- **Jawne jednostki fizyczne w zmiennych**: Wszystkie zmienne i DTO wewnątrz silników MUSZĄ posiadać sufiksy jednostek (np. `grubosc_polki_mm`, `odsuniecie_przod_mm`, `liczba_polek`, `szczelina_mm`).
- **SSOT Parametrów**: Pełna dokumentacja parametrów modułów znajduje się w [`A2_bloki/01_BLOKI_PARAMETERS.md`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_BLOKI_PARAMETERS.md).
- **Unifikacja Cech Obróbczych (Machining Intent SSOT)**:
  Wszystkie otwory obróbcze na płytach i frontach (korpus, półki, drzwi, klapy) MUSZĄ być tworzone wyłącznie przez `buildHoleMachiningIntent(opts)` z `A2_bloki/01_machining-intent.ts`.
  - **Twardy zakaz**: NIE tworzyć manualnych literałów `features.push({ ... })` ani ad-hoc struktur cech otworów.
  - **Otwory frontowe (drzwi standardowe, skośne, narożne, klapy)**:
    - Otwory puszki zawiasu: `rule: 'cup'`. Otwory wkrętów montażowych puszki: `rule: 'screw'`.
    - Asocjacja sprzętowa: `drivenBy: { nodeId: hingeKey, role: 'HARDWARE' }` (wskazuje węzeł zawiasu/podnośnika).
    - Metadane i flagi domenowe przekazywać w `extraParams` (np. `{ isDoorCup: true, isCup: true, side: 'INTERIOR' }`).
    - **Twardy zakaz używania `ownerTag` dla otworów frontowych**: NIE nadawać `ownerTag: 'isDoorDrilling'` ani `'isFlapDrilling'` otworom frontu! Tag ten oznacza otwory korpusu czyszczone dynamicznie przez `SyncDoorDrillingsCommand` / `SyncFlapDrillingsCommand`. Otwory na froncie są integralną częścią bryły frontu i nie mogą być usuwane przez synchronizator korpusu.
  - **Otwory korpusu (prowadniki, podpórki)**:
    - Zawsze posiadać właściwy `ownerTag` (`'isDoorDrilling'`, `'isFlapDrilling'`, `'isShelfDrilling'`), `targetNodeId` formatki oraz `drivenBy` wskazujący okucie. Umożliwia to bezpieczną synchronizację i deduplikację otworów korpusu.

## Procedura Tworzenia Nowych Bloków / Okuć (SmartParts / Studio Workflow)

**OBOWIĄZKOWY PRZEPŁYW PRACY (Studio → JSON → Silnik):**
Kiedy użytkownik poprosi o dodanie nowego rodzaju bloków lub okuć (np. nowe zawieszki, uchwyty, cargi, podpórki, szuflady itp.), **AGENT MA BEZWZGLĘDNY OBOWIĄZEK PRZYPOMNIEĆ O TYM WORKFLOWIE** i oprzeć implementację na JSON-ie wygenerowanym przez wizualny edytor Studio:

1. **Krok 1: Konfiguracja w wizualnym edytorze STUDIO (`S5_studio/`)**:
   - Element (kontener główny, ściany referencyjne montażu, bryła okucia, cięcia typu `HOLE` / `POCKET`) jest konfigurowany w wizualnym edytorze **Studio** (`studio.html` / `start_studio.bat`).
   - Studio generuje ustandaryzowany plik **JSON** z parametrami w milimetrach (`"units": "mm"`).
   - **Główna zaleta i SSOT:** Struktura JSON wygenerowana przez Studio jest **ZAWSZE TAKA SAMA, powtarzalna i przewidywalna** w całym systemie. Bezwzględny zakaz wymyślania ad-hoc formatów JSON od zera.

2. **Krok 2: Silnik Obliczający na bazie JSON ze Studio**:
   - Na bazie wygenerowanego JSON-a ze Studio tworzony jest silnik obliczający (`*Engine`) w `A2_bloki/` (lub odpowiedni adapter w bibliotece).
   - Silnik implementuje czyste funkcje funkcyjnego rdzenia:
     `normalize{Mod}Params(raw, dims)` oraz `calculate{Mod}Plan(dims, params)`.
   - Wszystkie zmienne w silniku muszą mieć jawne sufiksy jednostek fizycznych (`*_mm`).

3. **Krok 3: Zasada Trójki Plików w Bibliotece (`B1_biblioteka/`)**:
   - W folderze kategorii (`zawieszki/`, `uchwyty/`, itp.) element zapisywany jest pod identyczną nazwą bazową:
     1. `{Nazwa}.json` — wygenerowany ze Studio (parametry w mm, definicja bryły i cięć).
     2. `{Nazwa}.png` — miniatura do UI katalogu.
     3. `{Nazwa}.glb` — siatka 3D (jeśli element posiada plik siatki).

**Instrukcja dla agenta na przyszłość:** Jeśli użytkownik poprosi o stworzenie nowego bloku lub rodzaju okucia (np. *"dodajmy nowy rodzaj zawieszek"*):
Agent natychmiast przypomina:
> *"Zgodnie z procedurą tworzenia bloków, punktem wyjścia jest konfiguracja w wizualnym edytorze STUDIO (`studio.html`), który generuje znormalizowany JSON o stałej strukturze. Na jego bazie budujemy silnik obliczający. Czy posiadasz już wygenerowany JSON ze Studio, czy przygotowujemy go według standardu Studio?"*

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

## Zasada Współpracy: Działanie Bezpośrednie vs Duże Zadania Architektoniczne
- **Bieżące zadania, poprawki, optymalizacje, UI i codzienna praca**: Wdrażaj BEZPOŚREDNIO i sprawnie bez wymuszania planów, pytań o zatwierdzenie czy blokowania pracy.
- **Tylko przy dużych, przekrojowych zmianach architektonicznych** (nowy moduł od zera, zmiana formatu całego projektu, duży refaktor wielu podsystemów naraz): przedstaw ogólny zarys koncepcyjny i plan działania.
- Nie twórz zbędnych planów blokujących dla pojedynczych funkcji, poprawek błędów czy dostosowań wizualnych.

## Twardy Zakaz Samowolnego Dodawania Przycisków i Narzędzi
- **BEZWZGLĘDNY ZAKAZ dodawania nieproszonych przycisków, narzędzi, opcji menu ani akcji UI**, o które użytkownik wprost nie prosił.
- Nadmiarowe „inwencje” (np. dodawanie dodatkowych trybów 3D, kolejnych przycisków na toolbarach czy nowych akcji kontekstowych) powodują regresje matematyczne i rozpraszają workflow użytkownika.
- Implementuj WYŁĄCZNIE dokładnie te przyciski i zachowania, o które użytkownik poprosił.

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

## Taksonomia Cech Obróbczych Płytowych (`A1_core/project-schema.ts`)

Wszystkie cechy geometryczne formatki podlegają ścisłemu podziałowi na 4 typy (`SUPPORTED_FEATURE_TYPES`):
- `hole`: obróbka punktowa (wiercenie walcowe o średnicy $\varnothing$ i głębokości $Z$).
- `groove`: liniowy wpust / rowek prowadzony wzdłuż ścieżki (automaty meblowe: nuta pod plecy, kanał LED).
- `pocket`: wybranie materiału / kieszeń / ramka z dnem (obszar 2D o głębokości $< T$, frezowanie z dnem).
- `cutout`: wycięcie przelotowe / ramiak witryny na wylot / rewizja pod rury (`through: true`, brak siatki dna).

**Twarde reguły:**
- Zakaz nazywania ramki, przetłoczenia i rewizji typem `groove`. Wpust `groove` jest wyłącznie wąską ścieżką liniową.
- Ramka/przetłoczenie bez dna pod szybę witrynową (`through: true`, opcjonalnie `fill: 'glass'`) oraz rewizja MUSZĄ mieć typ `cutout`.
- Silnik 3D (`cap-machining.ts`) dla `cutout` generuje otwór przelotowy bez siatki dna (`feature_${id}_bottom`), natomiast dla `pocket` generuje dno wgłębienia.

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

- Teksty UI modułu mieszkają w JEDNYM pliku obok modułu: `A2_bloki/04_shelves_tekst.json` (`{ "klucz": { "pl":…, "en":…, "de":… } }`). Produkcja (`*_rules_V1.json`) trzyma tylko klucze — plików produkcyjnych NIE wysyła się do tłumaczy.
- Adaptery: zero polskich stringów w JSX — tylko `tx(tekst, 'klucz', NS)` z `T1_tlumaczenia/core.ts` (fallback aktywny → en → pl) + `useLocale()` z `T1_tlumaczenia/react.tsx`. Placeholdery: `tx(d, 'section.label_template', NS, { n: 3 })`.
- Nazwy techniczne nodów (`Polka_1`, `Drazek_fi25`), klucze parametrów (`shelfCount`), role, `report_type` — NIETŁUMACZONE, stabilne we wszystkich językach.
- Niemieckie (`de`) szkice oznacza autor do weryfikacji; cyrylica (`ru/bg/uk`) później jako dopisane klucze — bez zmian kodu.

## Szybka Nawigacja i Cykl Pracy (Fast Feedback Loop)
- **SSOT Mapy Architektury**: Przed przeszukiwaniem repozytorium zajrzyj do [`docs/ARCHITECTURE_GRAPH.md`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/docs/ARCHITECTURE_GRAPH.md) — zawiera diagramy przepływu danych i tabelę szybkiego namierzania plików dla szafek, bloków, paneli i CNC.
- **Zakaz pełnego `npm run verify` przy drobnych zmianach**: W trakcie pracy odpalaj wyłącznie testy powiązane (`npx vitest related --run <plik>` lub `npx vitest run <plik.test.ts>`) oraz szybką kompilację (`npm run typecheck` z `incremental: true`).
- Pełną bramkę `npm run verify` uruchamiaj wyłącznie po zatwierdzeniu przez użytkownika lub na sam koniec dużego zadania.