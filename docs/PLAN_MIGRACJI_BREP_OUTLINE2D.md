# Plan Migracji: Jednolity Silnik Formatki B-rep z Profilu 2D (`outline2d`)

## 1. Wprowadzenie i Stan Rzeczywisty

### 1.1. Diagnoza obecnych generatorów w `mesh_builder.ts`
W repozytorium istnieją obecnie trzy równoległe ścieżki tworzenia geometrii płyty:
1. **Ścieżka profilowa ([`polygon-extrusion.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts))**:
   - Działa już dziś dla płyt z polem `outline2d` (wieńce L, blaty narożne, skosy).
   - Posiada obsługę wpustów (`splitSegmentByGrooves`) oraz przypisywania obrzeży.
2. **Ścieżka fazowana (`buildBeveledBox` w `edge-bevel.ts`)**:
   - Obsługuje płyty z kątowym pochyleniem boków (`cutAngle`).
3. **Ścieżka pudełkowa (`boxTopo` w `box-topology.ts` + `cap-machining.ts`)**:
   - Sztywny model 6 nominalnych ścian i 12 krawędzi prostopadłościanu.
   - Gdy pojawia się wycięcie brzegowe (dystans 0 mm, uskok narożnika), model próbuje utrzymać 6 ścian za pomocą procedur łatających: rozcinania lica na paski materiału (`subtractBoxFromPolygon`), rzutowania otworów na ścianki (`projectBoxToFace`) oraz wycinania odcinków z 12 sztywnych krawędzi („paszcze” `clipEdgesByMouths`). Powoduje to artefakty wizualne (linie widma na szwach pasów) i problemy z kotwiczeniem wymiarów.

### 1.2. Cel i strategia migracji
- **Nie zaczynamy od zera**: Migracja zaczyna się od istniejącego i działającego kodu `polygon-extrusion.ts`, rozwijając go w jednolity fundament geometrii płyty.
- **Płyta prostokątna to profil o $N = 4$ wierzchołkach**: Zwykła formatka to po prostu szczególny przypadek profilu 2D.
- **Ewolucyjny, bezpieczny rollout**: Podział na małe, odizolowane fazy. W Fazie 1 nie zmieniamy globalnego nazewnictwa krawędzi ani konsumentów PMI/gizm, a stare procedury usuwamy dopiero na samym końcu po pełnej weryfikacji.

---

## 2. Kontrakt Geometryczny i Układy Współrzędnych (SSOT)

### 2.1. Jednostki (Zgodnie z regułą `AGENTS.md`)
- **Warstwa Domeny / Zapis Projektu (`CADNode.domainData`)**:
  - Pole profilu to bezwzględnie **`outline2d_nm: Array<[number, number]>`** (liczby całkowite w nanometrach).
  - Gwarantuje to spójność skali z wymiarami formatki (`width`, `height`, `thickness` w nm).
- **Granica Silnika Geometrii (`polygon-extrusion.ts`)**:
  - Adapter wejściowy konwertuje profil raz na brzegu: `nmToMm(p)`.
  - Wewnętrzne obliczenia B-rep, triangulacja `earcut` i bufory Babylona operują wyłącznie na **milimetrach (`mm`)**.

### 2.2. Relacja Płaszczyzny Profilu UV do LCS Formatki 3D (Adapter SSOT)
Występuje precyzyjny podział odpowiedzialności między płaszczyzną profilu 2D a lokalnym układem współrzędnych 3D (LCS):

1. **Płaszczyzna profilu 2D ($UV$ w mm)**:
   - Punkty profilu `(u, v)` leżą w płaszczyźnie lica roboczego **`FACE_Z_PLUS`**.
   - Zakres współrzędnych profilu nominalnego to $[0, W] \times [0, H]$, gdzie $(0, 0)$ to lewy-dolny narożnik płyty.
   - Orientacja wierzchołków obrysu zewnętrznego: **przeciwnie do ruchu wskazówek zegara (CCW)**.

2. **Układ współrzędnych formatki 3D (LCS w mm - Zasada Warsztatowa)**:
   - **Punkt zerowy**: Geometryczny środek bryły płyty `(0, 0, 0)`. Zapobiega to przesłanianiu osi w narożnikach mebla, gdzie formatki nakładają się na siebie.
   - **Oś $+Z$**: Zawsze skierowana **do wnętrza mebla**. W warsztacie jest to **strona robocza płyty na stole CNC (Strona A / Naklejka)** — formatka kładziona jest naklejkami do góry w stronę wrzeciona maszyny.
   - **Oś $+X$**: Wzdłuż szerokości formatki $W$.
   - **Oś $+Y$**: Wzdłuż wysokości formatki $H$.

3. **Jawny adapter współrzędnych (`face-lcs.ts` $\leftrightarrow$ `polygon-extrusion.ts`)**:
   Dla punktu profilu $(u, v) \in [0, W] \times [0, H]$:
   - Na licu roboczym $Z+$:
     $$X_{LCS} = u - \frac{W}{2}, \quad Y_{LCS} = v - \frac{H}{2}, \quad Z_{LCS} = +\frac{T}{2}$$
   - Na licu przeciwnym $Z-$:
     $$X_{LCS} = u - \frac{W}{2}, \quad Y_{LCS} = v - \frac{H}{2}, \quad Z_{LCS} = -\frac{T}{2}$$
   (realizowane deterministycznie przez funkcję `localTo3D(computeFaceData('FACE_Z_PLUS', W, H, T), u, v, 0)`).

---

## 3. Semantyka Ścian i Topologia Krawędzi B-rep

### 3.1. Klasyfikacja segmentów obrysu (Wektor + Położenie + Provenance)
Wektor normalny 2D $\vec{n} = (\Delta v/L, -\Delta u/L)$ rozróżnia kierunek ściany (osiowa vs skośna), ale nie rozstrzyga samodzielnie, czy segment jest brzegiem meblarskim, czy ścianką wcięcia. 

Klasyfikacja semantyczna segmentu profilu bazuje na koniunkcji trzech kryteriów:
1. **Zewnętrzny wektor normalny 2D $\vec{n}$** segmentu zorientowanego CCW.
2. **Położenie na nominalnej granicy formatki** (z tolerancją $\epsilon = 0.01\text{ mm}$):
   - $u_0 \approx W \land u_1 \approx W \implies$ granica $+X$
   - $u_0 \approx 0 \land u_1 \approx 0 \implies$ granica $-X$
   - $v_0 \approx H \land v_1 \approx H \implies$ granica $+Y$
   - $v_0 \approx 0 \land v_1 \approx 0 \implies$ granica $-Y$
3. **Pochodzenie segmentu (`provenance`)**:
   - `NOMINAL`: odcinek oryginalnej krawędzi formatki.
   - `CUTOUT` / `FEATURE`: odcinek powstały w wyniku operacji wycięcia/rewizji.

| Wektor normalny $\vec{n}$ | Położenie w UV | Pochodzenie | Identyfikator ściany (`faceName`) | Przypisanie obrzeża |
| :--- | :--- | :--- | :--- | :--- |
| $(+1, 0)$ | $u \approx W$ | `NOMINAL` | **`FACE_X_PLUS`** | Tak: `edgeBanding['+X']` |
| $(-1, 0)$ | $u \approx 0$ | `NOMINAL` | **`FACE_X_MINUS`** | Tak: `edgeBanding['-X']` |
| $(0, +1)$ | $v \approx H$ | `NOMINAL` | **`FACE_Y_PLUS`** | Tak: `edgeBanding['+Y']` |
| $(0, -1)$ | $v \approx 0$ | `NOMINAL` | **`FACE_Y_MINUS`** | Tak: `edgeBanding['-Y']` |
| Dowolny osiowy | $0 < u < W \lor 0 < v < H$ | `CUTOUT` | **`OUTLINE_SIDE_${i}` (rola `NOTCH`)** | **Brak (krawędź surowa)** |
| $\vec{n}$ pod kątem | Dowolne | `NOMINAL` / `CUTOUT` | **`OUTLINE_SIDE_${i}` (rola `SLANT`)** | Opcjonalne (jeśli skos dachu) |

### 3.2. Identyfikacja Krawędzi B-rep i Ochrona Konsumentów (PMI, Gizma, Selekcja)
Aby uniknąć kolizji nazw krawędzi przy wielu wycięciach oraz zapobiec zerwaniu istniejących podsystemów (linie wymiarowe PMI, gizma ofsetu, selekcja w 3D):
1. **Unikalne identyfikatory krawędzi**:
   - Każda fizyczna krawędź B-rep otrzymuje unikalny klucz:
     `outline_top_${segmentId}_${subIdx}`, `outline_bottom_${segmentId}_${subIdx}`, `outline_vert_${vertexId}`.
2. **Relacje sąsiedztwa B-rep (Topology Graph)**:
   - Każda krawędź przechowuje tablicę łączonych ścian:
     `{ key: string, faces: [string, string], points: [Vec3, Vec3], edgeKey?: string }`.
3. **Stabilne aliasy dla 12 nominalnych krawędzi prostopadłościanu**:
   - Krawędzie leżące na segmentach sklasyfikowanych jako nominalne (`FACE_X_PLUS` itp.) otrzymują aliasy zgodne z dotychczasowym słownikiem (np. `dol_przod`, `gora_przod`, `lewo_tyl`).
   - Konsumenci PMI i gizma szukający krawędzi po znanych nazwach działają bez żadnych modyfikacji. Globalny refaktor nazw krawędzi nie jest częścią etapu początkowego.

### 3.3. Obsługa Otworów Przelotowych (Wycięcia Wewnętrzne / Wyspy)
Gdy formatka posiada wycięcie wewnętrzne (np. pod zlewozmywak w blacie lub przepust w plecach):
1. **Lica poziome ($Z+$ i $Z-$)**: Triangulowane przez `earcut` z przekazaniem konturów otworów (hole indices).
2. **Pobocznice otworu (Ściany wewnętrzne)**:
   - Generator ekstruzji tworzy zamknięte pasy czworościanów łączących kontur otworu na licu górnym $Z+$ z konturem na licu dolnym $Z-$.
   - Każda wewnętrzna ścianka otrzymuje nazwę `HOLE_WALL_${featureId}_${segIdx}` i rolę `INTERNAL_CUTOUT`.
   - Generowane są krawędzie górne, dolne i pionowe otworu, gwarantując **zamkniętą bryłę 2-rozmaitościową (watertight 2-manifold)**.

### 3.4. Kontrakt Krzywych i Łuków dla CNC CAM
Dla narożników zaokrąglonych (fillet) i fazowań (chamfer):
1. **Reprezentacja w `outline2d`**:
   Segmenty profilu posiadają dyskryminator typu:
   - `type: 'LINE'` z punktami start/end $[u, v]$.
   - `type: 'ARC'` z punktami start/end $[u, v]$, środkiem $[cu, cv]$, promieniem $R$ i kierunkiem `CW`/`CCW`.
2. **Ścieżka 3D (Wizualizacja)**:
   - Do renderingu siatki w Babylon.js łuk jest teselowany odcinkami liniowymi z kontrolowaną strzałką ugięcia ($\text{sagitta} \le 0.1\text{ mm}$).
3. **Ścieżka CAM (CLData i Postprocesory)**:
   - Generator operacji konturu w `C1_cnc` odczytuje analityczny łuk i emituje rozkaz `CLArcCommand` w formacie ISO 4343.
   - Postprocesory (G-code, Homag MPR, WoodWOP, Biesse) emitują natywne kołowe polecenia interpolacji ($G02 / G03$) zamiast setek aproksymujących mikrolinii $G01$.

---

## 4. Etapowy Plan Wdrożenia

```
[Faza 1: Kontrakt profilu UV↔LCS, units nm, klasyfikacja wektor+nominal w polygon-extrusion.ts]
                                      │
                                      ▼
[Faza 2: Walidacja nominalnego prostokąta N=4 i profilu L w istniejącej ścieżce]
                                      │
                                      ▼
[Faza 3: Migracja wycięcia brzegowego (Notch/Rewizja) do outline2d — likwidacja pasków lica]
                                      │
                                      ▼
[Faza 4: Zamknięta bryła B-rep dla wycięć wewnętrznych (wyspy / otwory przelotowe)]
                                      │
                                      ▼
[Faza 5: Analityczne łuki CAM (Fillet/Chamfer w CLData G02/G03)]
                                      │
                                      ▼
[Faza 6: Wygaszenie generatora boxTopo i pętli clipEdgesByMouths]
```

### Faza 1: Kontrakt i Ujednolicona Klasyfikacja w `polygon-extrusion.ts`
- **Zakres**: Mały i bezpieczny. Brak zmian w globalnych nazwach krawędzi, brak zmian w konsumentach PMI/gizm.
- **Zadania**:
  1. Zapewnienie wejścia w domenie jako `outline2d_nm` (nm) z konwersją na brzegu silnika do `mm`.
  2. Uściślenie adaptera UV $\to$ LCS 3D w `polygon-extrusion.ts`: profil w UV $[0, W] \times [0, H]$ na `FACE_Z_PLUS` mapowany na LCS wycentrowany w `(0, 0, 0)`.
  3. Zastąpienie heurystyki w `classifyOutlineSegmentEdge` klasyfikacją opartą na wektorze $\vec{n} = (\Delta v/L, -\Delta u/L)$ + sprawdzeniu leżenia na nominalnych granicach formatki ($u \approx 0, W$, $v \approx 0, H$).
  4. Generowanie stabilnych aliasów dla 12 nominalnych krawędzi mebla w tablicy `edges` (kompatybilność wsteczna).
- **Kryterium akceptacji**: Kompilacja `npm run typecheck:core` bez błędów.

### Faza 2: Walidacja Ekstrudowania Prostokąta ($N=4$) i Profilu L
- **Zakres**: Porównanie ścieżki profilowej z pudełkową dla zwykłych formatek.
- **Zadania**:
  1. Przekazanie prostokątnego konturu `[[0,0], [W,0], [W,H], [0,H]]` do `buildPolygonPanelTopology`.
  2. Sprawdzenie zgodności podświetlania ścian (hover raycast), nakładania obrzeży i pozycjonowania otworów z `cap-machining.ts`.
  3. Potwierdzenie, że istniejący profil L zachowuje dotychczasowe zachowanie dla wpustów HDF.
- **Kryterium akceptacji**: Formatka prostokątna wygenerowana z profilu zachowuje się w scenie 3D identycznie jak ze starego `boxTopo`.

### Faza 3: Migracja Wycięcia Brzegowego (Uskok Narożnika / Rewizja)
- **Zakres**: Likwidacja głównego problemu geometrii: rozcinania lica na paski i linii widma.
- **Zadania**:
  1. Gdy formatka posiada wycięcie brzegowe (dystans $X=0$ lub $Y=0$):
     - Wycięcie modyfikuje 2D profil zewnętrzny formatki (np. 6-kąt z uskokiem).
     - Formatka jest budowana przez `buildPolygonPanelTopology`.
  2. Ścianki wycięcia otrzymują rolę `NOTCH` (brak obrzeża), a ścianki zewnętrzne zachowują obrzeża nominalne.
  3. Lico płyty stanowi jeden spójny poligon triangulowany `earcut` — całkowity brak sztucznych szwów i linii widma w 3D.
  4. Linie wymiarowe PMI i gizma ofsetu kotwiczą się stabilnie do wierzchołków uskoku.
- **Kryterium akceptacji**: Rewizja przy brzegu formatki nie tworzy żadnych poziomych linii przecinających lico, a krawędzie są stabilnie wymiarowane.

### Faza 4: Bryła Zamknięta dla Wycięć Wewnętrznych (Otwory Przelotowe)
- **Zakres**: Obsługa wycięć przelotowych leżących całkowicie wewnątrz formatki.
- **Zadania**:
  1. Triangulacja lic $Z+$ i $Z-$ z uwzględnieniem otworów wewnętrznych (dziury w `earcut`).
  2. Wytłoczenie pionowych ścianek wewnętrznych otworu łączących górne i dolne lico (`HOLE_WALL`).
  3. Dodanie krawędzi otworu do B-rep.
- **Kryterium akceptacji**: Zamknięta, spójna bryła 2-rozmaitościowa dla blatu ze zlewem lub formatki z przepustem.

### Faza 5: Analityczne Łuki CAM (Fillet / Chamfer)
- **Zakres**: Natywna obsługa promieni w profilu 2D dla CNC.
- **Zadania**:
  1. Definicja kontraktu segmentu `ARC` w `outline2d`.
  2. Adapter dyskretyzacji 3D z kontrolowaną sagittą dla wizualizacji.
  3. Implementacja ścieżki w `C1_cnc`: emisja poleceń `CLArcCommand` i generowanie natywnego $G02 / G03$ w postprocesorach.
- **Kryterium akceptacji**: Wygenerowany program CNC na wycięciu z promieniem zawiera rozkazy $G02 / G03$ z dokładnym promieniem narzędzia.

### Faza 6: Wygaszenie i Sprzątanie Kodu Legacy
- **Zakres**: Usunięcie długu technologicznego po zakończeniu i przetestowaniu Faz 1–5.
- **Zadania**:
  1. Przełączenie wszystkich formatek w `mesh_builder.ts` na `buildPolygonPanelTopology`.
  2. Usunięcie procedur łatających paszczami (`clipEdgesByMouths`) z `cap-machining.ts`.
  3. Usunięcie `boxTopo` i procedury `subtractBoxFromPolygon` dla wycięć brzegowych.
- **Kryterium akceptacji**: Czysty, jednolity fundament B-rep dla 100% formatek w projekcie.

---

## 5. Instrukcja Rozpoczęcia Nowego Wątku

W nowym oknie czatu podaj polecenie:
> *"Zgodnie z dokumentem `docs/PLAN_MIGRACJI_BREP_OUTLINE2D.md`, rozpoczynamy realizację Fazy 1: wdrożenie ujednoliconego kontraktu UV↔LCS, obsługi `outline2d_nm` oraz wektorowej i nominalnej klasyfikacji segmentów w `polygon-extrusion.ts`."*
