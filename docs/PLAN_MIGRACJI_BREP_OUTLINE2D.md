# Plan Migracji: Jednolity Silnik Formatki B-rep z Profilu 2D (`outline2d`)

## 1. Wprowadzenie i Diagnoza

### 1.1. Problem obecnego silnika (`mesh_builder.ts` + `boxTopo`)
Obecny silnik paneli opiera się na **sztywnej strukturze prostopadłościanu** z 6 nominalnymi ścianami i tabelą 12 krawędzi prostych (`topology.ts`). 
Gdy na formatce pojawia się operacja brzegowa (wycięcie narożnika pod rurę, uskok, rewizja dosunięta do krawędzi na 0 mm lub skos poddasza):
- Formatka fizycznie przestaje być prostopadłościanem, stając się graniastosłupem wielokątnym.
- Stary silnik próbował utrzymać strukturę 6 ścian za pomocą procedur łatających:
  1. Rzutowanie geometrii na ścianki boczne (`projectBoxToFace`).
  2. Rozcinanie lica płyty 4 półpłaszczyznami na osobne paski materiału (`subtractBoxFromPolygon`), co generowało sztuczne poziome linie widma w poprzek płyty.
  3. Wycinanie odcinków z 12 nominalnych krawędzi za pomocą tzw. „paszcz” (`clipEdgesByMouths`).
  4. Blokowanie operacji zaokrągleń narożników (`fillet`), ponieważ nie mieściły się w tabeli 12 prostych krawędzi.

### 1.2. Cel migracji
Przejście na **jednolity standard B-rep (Boundary Representation) oparty na profilu 2D**:
Każda płyta meblowa (zarówno prosta, jak i z wycięciami czy skosami) jest definiowana przez **dwuwymiarowy profil obrysu (`outline2d`) wytłaczany o grubość płyty $T$**.
- Prostopadłościan staje się po prostu najprostszym przypadkiem profilu ($N = 4$ wierzchołki).
- Wycięcie brzegowe to zwykła operacja różnicy na profilu 2D ($\text{Outline}_{\text{new}} = \text{Outline}_{\text{old}} \setminus \text{Cutout}$).
- Wszystkie ścianki boczne, lica oraz krawędzie 3D powstają automatycznie z profilu.
- Całkowite wygaszenie i usunięcie kodu łatającego (`clipEdgesByMouths`, paski półpłaszczyzn).

---

## 2. Twarde Niezmienniki Domenowe (Hard Invariants)

Te zasady **nie podlegają żadnym modyfikacjom** podczas migracji:

1. **Układ współrzędnych LCS formatki (Zasada Warsztatowa)**:
   - **Punkt zerowy**: Środek formatki w centrum geometrycznym `(0, 0, 0)` płyty (zapewnia brak kolizji w narożnikach i czystą symetrię).
   - **Kierunek osi $+Z$**: Zawsze skierowany **do wnętrza szafki**.
     - Odpowiada to **stronie roboczej formatki na stole frezarki CNC** (strona z nawiertami, naklejką produkcyjną z kodem kreskowym, skierowana do góry ku wrzecionu).
   - **Wymiary nominalne**: $W$ (szerokość wzdłuż osi X mebla/LCS), $H$ (wysokość/długość wzdłuż osi Y), $T$ (grubość wzdłuż osi Z).

2. **Jednostki (SSOT)**:
   - W geometrii wewnętrznej profilu 2D i w UI: **milimetry (`mm`)**.
   - W węzłach `CADNode`, zapisie `.spp.json` i macierzach: **nanometry (`nm`)** (`mmToNm`, `nmToMm`).

3. **Kompatybilność semantyczna ścian (Zero zmian dla reszty systemu)**:
   - Ściany obwodu profilu **muszą nadal raportować semantyczne nazwy meblarskie**:
     - Przód płyty $\to$ `edgeKey: '+X'` / `faceName: 'FACE_X_PLUS'`
     - Tył płyty $\to$ `edgeKey: '-X'` / `faceName: 'FACE_X_MINUS'`
     - Góra płyty $\to$ `edgeKey: '+Y'` / `faceName: 'FACE_Y_PLUS'`
     - Dół płyty $\to$ `edgeKey: '-Y'` / `faceName: 'FACE_Y_MINUS'`
     - Lico wewnętrzne $\to$ `FACE_Z_PLUS`
     - Lico zewnętrzne $\to$ `FACE_Z_MINUS`
     - Ścianki wewnątrz wycięć $\to$ `edgeKey: 'NOTCH'` / `faceName: 'OUTLINE_SIDE_${i}'`
   - Dzięki temu raycasting (klikanie myszą), selekcja ścian, przypisywanie obrzeży i gizma montażowe działają bez jakiejkolwiek zmiany w ich kodzie.

---

## 3. Architektura Danych Nowego Silnika

### 3.1. Profil 2D formatki (`outline2d`)
Każda formatka posiada profil 2D zdefiniowany w układzie lica płyty (współrzędne $u, v$ w milimetrach):
- Dla zwykłego prostokąta:
  ```ts
  const defaultOutline = [
      [0, 0],
      [plateW, 0],
      [plateW, plateH],
      [0, plateH]
  ];
  ```
- Profil jest zawsze zamkniętą pętlą punktów zorientowaną **przeciwnie do ruchu wskazówek zegara (CCW)**.

### 3.2. Podział cech formatki:
1. **Cechy obrysu płyty (Profile Features)**:
   - Modyfikują `outline2d`: wycięcie narożnika pod rurę, uskok, rewizja na krawędzi, skos dachowy, zaokrąglenie narożnika (promień $R$).
   - Wykonywane są na poziomie 2D przed budową bryły 3D.
2. **Cechy powierzchniowe (Surface Features - 2.5D)**:
   - Otwory walcowe (mimośrody, podpórki półek, zawiasy, kołki).
   - Kieszenie i wybrania materiału z dnem (`pocket`).
   - Wpusty pod plecy HDF i kanały LED (`groove`).
   - Otwory wewnętrzne przelotowe (np. przepust kablowy w środku blatu) – przekazywane do triangulatora `earcut` jako wewnętrzne pętle (dziury).

---

## 4. Szczegółowy Plan Wdrożenia (4 Fazy)

### Faza 1: Rozbudowa i stabilizacja `polygon-extrusion.ts`
Plik `polygon-extrusion.ts` jest fundamentem – obsługuje już wieńce L i blaty. W tej fazie przygotowujemy go do roli **jedynego silnika dla wszystkich płyt**:

1. **Semantyczna klasyfikacja ścian bocznych (`classifyOutlineSegmentEdge`)**:
   - Upewnienie się, że każdy segment profilu otrzymuje właściwe `edgeKey`: `+X`, `-X`, `+Y`, `-Y` lub `NOTCH`.
   - Zapewnienie, że w `result.sides[faceName]` oraz w metadanych mesha Babylon:
     - `mesh.metadata.faceName` jest mapowane na `FACE_X_PLUS`, `FACE_X_MINUS`, `FACE_Y_PLUS`, `FACE_Y_MINUS` dla głównych ścian.
2. **Automatyczne mapowanie obrzeży (`edgeBanding`)**:
   - Ścianka oznaczona jako `+X` dziedziczy konfigurację obrzeża z `model.edgeBanding['+X']`.
   - Ścianki typu `NOTCH` domyślnie mają status braku obrzeża (`type_id: 'none'`).
3. **Utrzymanie obsługi wpustów pod plecy (`splitSegmentByGrooves`)**:
   - Wpust biegnący wzdłuż tylnej ścianki boku szafy automatycznie rozcina ściankę na wlocie, tworząc uskok na wsunięcie płyty HDF.

### Faza 2: Moduł operacji na profilu 2D (`outline-operations.ts`)
Stworzenie dedykowanego, czystego modułu operacji boolowskich na wielokątach 2D formatki:

1. **Różnica wielokątów (`subtractBoxFromOutline`)**:
   - Wejście: `outline2d: number[][]`, `cutoutBox: { u0, u1, v0, v1 }`.
   - Wyjście: zaktualizowany `outline2d` (np. 6-kąt lub 8-kąt).
   - Zero dzielenia na paski materiału – czyste odcięcie narożnika lub boku.
2. **Zaokrąglenia narożników (`filletOutlineCorner`)**:
   - Wstawienie łuku o zadanym promieniu $R$ w dowolnym narożniku profilu.
   - Odblokowanie typu `fillet` dla maszyn CNC i wizualizacji 3D.
3. **Fazowanie narożników (`chamferOutlineCorner`)**:
   - Ścięcie narożnika formatki pod zadanym kątem/wymiarem.

### Faza 3: Przełączenie głównego generatora (`mesh_builder.ts`)
1. **Unifikacja ścieżki generowania**:
   - Jeśli formatka nie ma zdefiniowanego `outline2d`, inicjalizujemy profil prostokątny `[[0,0], [W,0], [W,H], [0,H]]`.
   - Jeśli na formatce znajdują się cechy przelotowe dotykające brzegu (`cutout` z dystansem 0, narożnik), profil jest modyfikowany przez `subtractBoxFromOutline`.
   - Wszystkie formatki trafiają bezpośrednio do `buildPolygonPanelTopology`.
2. **Wygaszenie starego generatora**:
   - Odcięcie wywołań `buildBoxTopology` i starych 12 krawędzi.
   - Usunięcie łatania paszczami (`clipEdgesByMouths`) w `cap-machining.ts`.

### Faza 4: Weryfikacja i Testy Integracyjne
1. **Bramka kompilacji**: `npm run typecheck:core` (zero błędów typowania).
2. **Weryfikacja wizualna i interaktywna na scenie Babylon**:
   - Standardowa szafa (boki, wieńce, półki, plecy HDF w nucie).
   - Bok z wycięciem rewizyjnym dosuniętym do 0 mm (brak pasków, brak linii widma).
   - Półka z wycięciem narożnym pod rurę / uskok.
   - Klikalność ścian (hover, raycast), działanie gizmo offsetów i dialogu operacji.
3. **Weryfikacja CAM / CNC**:
   - Upewnienie się, że postprocesory CNC (Homag MPR, Biesse, G-code) generują poprawny kontur frezowania z `outline2d`.

---

## 5. Macierz Wpływu i Zgodności

| Podsystem | Stan po migracji | Wpływ / Zmiany |
| :--- | :--- | :--- |
| **Babylon 3D Mesh** | Lica Z+/Z- + ścianki obwodu | Szybsze renderowanie, brak wewnętrznych szwów |
| **Raycast / Hover** | Identyczny (`FACE_X_PLUS` itd.) | Brak zmian – pełna zgodność wsteczna |
| **Gizma przesunięć** | Działają na skrajnych płaszczyznach B-rep | Brak zmian – pełna zgodność |
| **Wymiarowanie PMI** | Pobiera krawędzie z B-rep | Brak zmian – linie podpinają się pod krawędzie |
| **Obrzeża (Kalkulator)** | Przypisane do segmentów głównych | Brak zmian dla 4 głównych ścian, obsługa wycięć |
| **Wpust pod plecy** | Nuta z uskokiem na ściance | Czysta geometria, brak konfliktów z rewizjami |
| **CNC CAM** | Kontur 2D pobierany wprost z `outline2d` | Uproszczenie kodu CAM, 100% precyzji |

---

## 6. Instrukcja Rozpoczęcia Nowego Wątku

W nowym wątku wystarczy podać polecenie:
> *"Rozpoczynamy migrację B-rep zgodnie z dokumentem `docs/PLAN_MIGRACJI_BREP_OUTLINE2D.md`. Przejdźmy do Fazy 1 (rozbudowa i stabilizacja `polygon-extrusion.ts`)."*
