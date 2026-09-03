# Architektura WebCAD — Single Source of Truth (SSOT)

Niniejszy dokument opisuje docelową i aktualnie obowiązującą architekturę systemu Web CAD. System opiera się na wzorcu **Modularnym (Domain-Driven Design)** ze ścisłą separacją danych domenowych od reprezentacji wizualnej (Babylon.js).

W toku rozwoju zrezygnowaliśmy z wykorzystania ciężkiego jądra OpenCASCADE (OCCT) na froncie na rzecz lekkiego, natywnego generatora siatek (NativePanelBuilder) oraz scentralizowanego drzewa hierarchii CAD.

## 1. Single Source of Truth: Drzewo Hierarchii (`ProjectDocument` i `CADNode`)

Rdzeniem aplikacji jest **ProjectDocument**, który przechowuje globalny stan całego projektu w formie drzewa (Scenegraph). Drzewo składa się z węzłów **CADNode**.

- **Zasada agnostycyzmu:** Węzły `CADNode` nic nie wiedzą o renderowaniu (Babylon.js) ani o interfejsie (React). Zarządzają wyłącznie matematyką przestrzenną (Macierze 4x4 lokalne i globalne) oraz hierarchią relacji (rodzic-dziecko).
- **Separacja Domeny:** Każdy `CADNode` posiada właściwość `domainData`, do której podpinane są czyste struktury meblowe (np. `PanelModel` lub `ContainerModel`).
- **Skuteczność (Dirty Flags):** System transformacji (przeliczanie lokalnego układu LCS do globalnego WCS) działa leniwie (lazy-evaluation) na podstawie brudnych flag (dirty-flag cascade), co zapobiega zbędnym przeliczeniom przy statycznej scenie.

## 2. Moduły Domenowe (Klocki Architektoniczne)

System dzieli się na centralnego zarządcę (Core) i niezależne moduły domenowe:

### `A1_core` (Orchestrator & Math)
Główny menedżer środowiska, drzewa hierarchii i interakcji. Znajdują się tu klasy takie jak `ProjectDocument`, `StateMachine`, `InteractionManager` czy `GizmoController`. Core nie posiada specyficznej wiedzy o "szafkach" czy "okleinach" – operuje na czystej abstrakcji `CADNode` i zdarzeń wejścia (Intents).

### `A3_smartframe` (Główne Złożenia / Korpusy)
Moduł odpowiedzialny za definiowanie logicznych złożeń i grup (np. szafek) bazujący na generatorach regułowych JSON.
- W modelu (domainData) posługuje się instancją `ContainerModel`.
- W widoku reprezentowany jest poprzez interfejsy grupujące w React oraz ewentualne `ContainerView` na scenie 3D (zielone bounding-boxy i gizma).

### `A4_smartpanel` (Formatki / Części)
Najniższy, produkcyjny poziom budulcowy: fizyczne płyty stolarskie.
- Reprezentowane w domenie jako `PanelModel`.
- **Budowanie geometrii (NativePanelBuilder):** System wykorzystuje własny budowniczy oparty na algorytmie triangulacji (EarCut) oraz ścieżkach 2D. Całkowicie porzucono pomysł opierania frontendu o powolny port WASM-OCCT (OpenCASCADE został odesłany do modułów legacy / importu STEP).
- Wyświetlane na scenie dzięki `PanelView` – klasie-pośrednikowi spinającej `PanelModel` z siatką `Mesh` w Babylon.js.

## 3. Architektura Interakcji (Narzędzia i Stan)

Zarządzanie zdarzeniami myszy i klawiatury działa w oparciu o centralnego zarządcę i rozdziela logikę na dwa nieprzecinające się tory:

### `InteractionManager` (Intencje)
Tłumaczy sprzętowe wejścia z przeglądarki (np. Klik LPM, Wciśnięcie Esc, Enter) na logiczne Intencje (Intents): np. `SELECT`, `CANCEL`, `CONFIRM`.

### `StateMachine` (Tor Narzędzi CAD)
Odbiera znormalizowane Intencje z `InteractionManager` i przekazuje je do aktywnego Narzędzia (Tool/State). W danej chwili aktywne może być **tylko jedno narzędzie modyfikujące CAD** (np. `SelectionTool`, `DrawLineTool`, `ExtrudeTool`).

### Tor Sterowania Kamerą (CameraController)
**Krytyczna reguła projektowa:** Obsługa kamery (np. przez Środkowy Przycisk Myszy (MMB) lub alt+mysz) znajduje się na odseparowanym kanale (nie jest wewnątrz StateMachine!). Użytkownik może przesuwać (Pan), obracać (Orbit) i przybliżać (Zoom) widok *w każdej chwili*, bez obawy o przerwanie trwającej operacji w dowolnym narzędziu CAD.

## 4. Optymalizacja Wydajności (Realtime Push/Pull Gizmo)

Interakcje zachodzące w czasie rzeczywistym – jak na przykład ciągnięcie wymiarów płyty pomarańczowym uchwytem 3D (Gizmo) – korzystają z zaawansowanych praktyk optymalizacyjnych:

1. **Bezalokacyjna aktualizacja buforów (Vertex Buffer Update):** 
   Zamiast niszczyć (`dispose()`) i tworzyć geometrię na nowo przy każdym pikselu ruchu myszy (co wywołuje spadek klatek i ogromne opóźnienia wywołane przez Garbage Collector), silnik `NativePanelBuilder` dynamicznie przelicza i podmienia punkty wewnątrz tablicy `Float32Array`. Tablica ta jest bez opóźnień wysyłana na GPU.
2. **Brak deformacji (Prawdziwy B-Rep):** 
   Podczas skalowania nie używamy parametru `mesh.scaling`, który zniekształciłby okręgi (nawierty/frezy) do postaci elipsy. System aktualizuje faktyczne, obiektywne koordynaty produkcyjne otworów i przesuwa je po płaszczyźnie twarzy, dbając, aby nawiert 8 mm zawsze pozostał okręgiem 8 mm.

## 5. Dane dla Systemów Produkcyjnych (CAM / CNC)

1. **Mesh to tylko Widok:** Elementy w renderze Babylon.js (Mesh, Bounding Box) służą wyłącznie jako podgląd wizualny i system Hitboxów (do wykrywania kliknięć).
2. **B-Rep ponad BoundingBox:** Przy generowaniu obróbek, współrzędnych maszynowych i ścieżek (CLData) w module C1_cnc/CAM zawsze odwołujemy się do precyzyjnych matematycznych danych domenowych (b-rep) przechowywanych w metadanych lub głęboko w formacie JSON (`PanelModel`), pomijając siatki wyświetlania.

---
*Status na dzień: 04.08.2026. Dokument ten konsoliduje ostatecznie odrzucone plany takie jak `PLAN_AGENTOW_WEB_CAD.txt` oraz starsze plany implementacji OCCT na froncie. Drzewo CADNode i interakcje StateMachine są od teraz Jedynym Źródłem Prawdy dla architektury aplikacji.*
