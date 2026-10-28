# ARCHITECTURAL RFC: Zero-Allocation B-Rep & Geometry Engine (Typed Arrays)

**Status:** Plan architektoniczny (Gotowy do wdrożenia Fazy 1)  
**Obszar zmian:** `A4_smartpanel` (Natywna synteza geometrii formatki meblarskiej)  
**Główna zasada:** Najpierw natychmiastowe przejście na płaskie tablice binarne (`TypedArray`) w wątku głównym (Zero-GC), z architekturą przygotowaną na Web Worker / `SharedArrayBuffer` w przyszłości.

---

## 1. Cele i Wymagania

### 1.1. Cel Bieżący (Etap 1: Wątek Główny, Płaskie Tablice)
1. **Eliminacja narzutu Garbage Collectora silnika V8 (Zero-GC)**:
   - Zastąpienie tysięcy małych obiektów (`{ positions: [...], indices: [...] }`) i dynamicznych tablic (`Array.push([x,y,z])`) prealokowanymi, płaskimi buforami `TypedArray`.
   - Czas generowania pojedynczej formatki: spadek z $0.27\text{ ms}$ do **$< 0.02\text{ ms}$** (0 bajtów narzutu na stercie V8).
2. **Jasny podział typów pamięci (Precyzja CAD vs Render GPU)**:
   - **`Float32Array` (w mm)** – dedykowany wyłącznie dla siatki renderu Babylon.js (pozycje, normalne, współrzędne UV). Przy gabarytach szaf do 3000 mm zapewnia dokładność do **$0.1\ \mu\text{m}$ ($0.0001\text{ mm}$)**, pasując w 100% do formatu VRAM karty graficznej (WebGL / WebGPU).
   - **`Float64Array` (w mm / nm)** – dedykowany dla ścisłej geometrii B-Rep (`_brepFacePositions`, wyznaczanie płaszczyzn bazowych, FacePicker, PMI, kolizje i strategie CAM). Eliminuje błędy zaokrągleń przy operacjach geometrycznych (iloczyny wektorowe, współpłaszczyznowość, orientacje).
   - **`Uint32Array`** – indeksy trójkątów siatki.
   - **`Int32Array`** – 6-elementowa tabela rekordów ścian (Slot Map) zamiast obiektów JS.

### 1.2. Cel Przyszłościowy (Etap 2: Web Worker & Współdzielona Pamięć)
Gdy geometria jest już generowana w płaskich buforach, przeniesienie kodu do Workera w przyszłości będzie zmianą czysto transportową (bez przepisywania matematyki):
- **Opcja A (Transferable Objects z Buffer Pool)**: Użycie Puli Buforów (Buffer Pool) – Worker oddaje wskaźnik bufora w **$0.005\text{ ms}$**, wątek główny po przesłaniu danych do GPU odsyła pusty bufor z powrotem do puli Workera. Rozwiązuje to w 100% problem *neuteringu* (unieważniania) buforów bez konieczności ciągłych alokacji w pętli.
- **Opcja B (SharedArrayBuffer)**: Przy nagłówkach COOP/COEP wątki współdzielą ten sam bufor w RAM (czas wymiany **$0.0\text{ ms}$**, brak jakiegokolwiek transferu).

---

## 2. Podział Pamięci i Typy Danych (SSOT)

Każda generowana formatka opisana jest zestawem 4 płaskich buforów binarnych:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PlateGeometryBuffers                                 │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Render Vertex Buffer (Float32Array)                                 │
│    [X, Y, Z,  Nx, Ny, Nz,  U, V] ... (Stride = 8 floatów = 32 bajty)  │
│    -> Bezpośrednio zasilany do Babylon.js VertexBuffer                 │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Index Buffer (Uint32Array)                                          │
│    [i0, i1, i2,  i3, i4, i5, ...]                                      │
│    -> Trójkąty siatki 3D (dla drawElements WebGL)                      │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Exact B-Rep Buffer (Float64Array)                                   │
│    [X, Y, Z] dla nominalnych wierzchołków i krawędzi ścian             │
│    -> Podstawa dla PMI, FacePicker, pomiarów i strategii CAM           │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Topology & Submesh Buffer (Int32Array)                              │
│    Tabela rekordów ścian (Slot Map) - 6 intów per ściana:              │
│    [FACE_CODE, INDEX_START, INDEX_COUNT, ROLE_FLAGS, EDGE_MASK, FEAT] │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Specyfikacja Rekordu Topologii (`TopologyBuffer: Int32Array`)
Zamiast obiektów JS z kluczami tekstowymi (`'FACE_Z_PLUS'`, `'alu_prof_bottom'`), każda ściana/podsiatka formatki ma stały 6-elementowy rekord:

| Pole | Typ | Wartość / Zastosowanie |
|---|---|---|
| `FACE_CODE` | `Int32` | `1: Z+ (Lico przód)`, `2: Z- (Lico tył)`, `3: X+ (Prawy bok)`, `4: X- (Lewy bok)`, `5: Y+ (Wieniec góra)`, `6: Y- (Wieniec dół)`, `100+: Cecha/Kieszeń` |
| `INDEX_START` | `Int32` | Offset w `IndexBuffer` (początek trójkątów danej ściany) |
| `INDEX_COUNT` | `Int32` | Liczba indeksów należących do ściany (musi być podzielna przez 3) |
| `ROLE_FLAGS` | `Int32` | Bity semantyczne: `0x01` = Lico, `0x02` = Wąska krawędź (obrzeże), `0x04` = Otwór, `0x08` = Kieszeń |
| `EDGE_MASK` | `Int32` | Maska przypisanych obrzeży / krawędzi nominalnych formatki |
| `FEATURE_ID` | `Int32` | Numeryczny identyfikator cechy obróbczej powiązanej z CAM/okuciem |

---

## 3. Cykl Życia Pamięci (Zero-GC w Wątku Głównym)

W etapie 1 (praca w wątku głównym) stosujemy wzorzec **Scratch Arena Allocator**:

```
[Start Aplikacji]
   │
   ▼
Alokacja statycznego bufora roboczego ScratchBuffer (np. 1–2 MB):
  - scratchVertices = new Float32Array(65536 * 8)
  - scratchIndices  = new Uint32Array(65536)
  - scratchBRep     = new Float64Array(16384 * 3)
  - scratchTopology = new Int32Array(256 * 6)
   │
   ├─► [Budowa Formatki N]
   │     1. Wskaźniki zapisu resetowane do zera (vPtr = 0, iPtr = 0, tPtr = 0).
   │     2. Analityczny zapis ścian bezpośrednio do tablic roboczych.
   │     3. earcut zasilany bezpośrednio wycinkiem `scratchVertices.subarray(...)`.
   │     4. Zwrócenie geometrii: `buffer.slice(0, ptr)` (lub podpięcie subarray pod Babylon Mesh).
   │     5. Zero alokacji obiektów pośrednich na stercie V8.
   │
   └─► [Budowa Formatki N+1] -> Ponowne użycie dokładnie tych samych tablic.
```

---

## 4. Architektura Przyszłościowa: Gotowość na Web Worker

Gdy w przyszłości zapadnie decyzja o przeniesieniu obliczeń do osobnego wątku (np. przy generowaniu całych zestawów kuchennych po 50–100 formatek):

```
                       ARCHITEKTURA PRZYSZŁOŚCIOWA
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
   [WARIANT 1: Transferable Objects]             [WARIANT 2: SharedArrayBuffer]
   - Zastosowanie: Dowolna przeglądarka          - Zastosowanie: Środowisko z COOP/COEP
   - Koszt transferu: 0.005 ms                   - Koszt transferu: 0.0 ms (RAM współdzielony)
   - Mechanizm: Buffer Pool (Pula buforów):      - Mechanizm: Stała Shared Arena:
       Worker pobiera bufor z puli                  Worker pisze do segmentu SharedArrayBuffer,
       -> wysyła postMessage(..., [buf])            wysyła mały event { offset, count },
       -> Główny wątek ładuje do GPU                Główny wątek czyta bezpośrednio z RAM.
       -> Główny wątek odsyła pusty bufor           Brak unieważniania buforów (no neutering).
          z powrotem do puli Workera.
```

---

## 5. Fazy Realizacji

### Faza 1: Płaskie Tablice dla Płyty Prostopadłościennej (Wątek Główny)
- **Cel:** Zastąpienie dynamicznego generowania 6 ścian w `mesh_builder.ts` funkcją zapisu analitycznego do `Float32Array` / `Uint32Array` / `Float64Array`.
- **Zakres:**
  - Utworzenie modułu `A4_smartpanel/native_core/plate-buffer-builder.ts`.
  - Analityczna synteza 6 ścian (12 trójkątów, 24 wierzchołki ze zwielokrotnionymi normalnymi ścian dla ostrego cieniowania, 36 indeksów).
  - Testy porównawcze A/B z obecnym `mesh_builder.ts`: zgodność wierzchołków i indeksów co do bita.

### Faza 2: Obsługa Nawiertów i Otworów Walcowych w `TypedArray`
- **Cel:** Triangulacja lica z otworami (`earcut` zasilany bezpośrednio tablicą `Float32Array` bez tablic obiektów `[[x,y], ...]`).
- **Zakres:**
  - Wektoryzowany zapis pobocznicy cylindra otworu (quady) bezpośrednio do bufora roboczego.
  - Zapis den otworów ślepych.
  - Weryfikacja testami `polygon-extrusion.test.ts` i `feature-planes-pick.test.ts`.

### Faza 3: Skosy, Wycięcia Krawędziowe i Witryny
- **Cel:** Obsługa profili `outline2d` oraz wycięć `cutout` bezpośrednio w buforze binarnym.
- **Zakres:**
  - Przełączenie domyślnej implementacji w `NativePanelBuilder` na nowy silnik buforowy.
  - Zachowanie kompatybilności wstecznej dla `panel-view.ts` (`getBrepFacePositions` czytające bezpośrednio z `Float64Array`).

### Faza 4 (Opcjonalna / Przyszłościowa): Aktywacja Web Workera
- **Cel:** Wydzielenie generatora do `smartpanel.worker.ts`.
- **Zakres:**
  - Implementacja komunikacji `Buffer Pool` (dla Transferable) z automatycznym wykrywaniem `SharedArrayBuffer` w środowiskach wspierających nagłówki izolacji krzyżowej.

---

## 6. Oczekiwane Zyski Wydajnościowe

| Operacja | Obecnie (Obiekty JS) | Po Fazie 1–3 (Typed Arrays) | Po Fazie 4 (Web Worker) |
|---|---|---|---|
| **Czysta płyta korpusu** | 0.009 ms | **< 0.002 ms** | 0.005 ms transfer / 0.0 ms shared |
| **Bok z 16 nawiertami** | 0.274 ms | **< 0.020 ms** | 0.005 ms transfer / 0.0 ms shared |
| **Kompletna szafka (10 płyt)** | 3.500 ms | **< 0.200 ms** | **Przeniesione poza wątek UI** |
| **Narzut Garbage Collectora** | Tysiące obiektów na stercie | **Zero alokacji (0 B)** | **Zero alokacji w wątku UI** |
| **FPS podczas przeciągania suwaka wymiaru** | Chwilowe spadki (GC drop) | **Stabilne 60 FPS** | **Stabilne 60/120 FPS** |
