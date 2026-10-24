# Plan Migracji: Jednolity Silnik Formatki B-rep z Profilu 2D (`outline2d`)

## 1. Wprowadzenie i Stan Rzeczywisty

### 1.1. Diagnoza obecnych generatorów w `mesh_builder.ts`
W repozytorium istnieją obecnie trzy równoległe ścieżki tworzenia geometrii płyty:
1. **Ścieżka profilowa ([`polygon-extrusion.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts))**:
   - Działa już dziś dla płyt z polem `outline2d` (wieńce L, blaty narożne, skosy).
   - Posiada przetestowaną obsługę wpustów (`splitSegmentByGrooves` w `polygon-extrusion-groove.test.ts`) oraz obrzeży (`outline-edge-banding.test.ts`).
2. **Ścieżka fazowana (`buildBeveledBox` w `edge-bevel.ts`)**:
   - Obsługuje płyty z kątowym pochyleniem boków (`cutAngle`).
3. **Ścieżka pudełkowa (`boxTopo` w `box-topology.ts` + `cap-machining.ts`)**:
   - Sztywny model 6 nominalnych ścian i 12 krawędzi prostopadłościanu.
   - Gdy pojawia się wycięcie brzegowe (dystans 0 mm, uskok narożnika), model próbuje utrzymać 6 ścian za pomocą procedur łatających: rozcinania lica na paski materiału (`subtractBoxFromPolygon`), rzutowania otworów na ścianki (`projectBoxToFace`) oraz wycinania odcinków z 12 sztywnych krawędzi („paszcze” `clipEdgesByMouths`).

### 1.2. Cel i strategia migracji
- **Nie zaczynamy od zera**: Bazujemy na działającym kodzie `polygon-extrusion.ts`.
- **Ewolucyjna unifikacja**: Formatka prostokątna to po prostu najprostszy przypadek profilu ($N = 4$ wierzchołki).
- **Zasada bezpieczeństwa**: Nie wyłączamy starych ścieżek na ślepo. Nowy kontrakt profilu wdrażamy stopniowo, weryfikując zachowanie na każdej granicy integracyjnej (hover, gizma, obrzeża, CNC).

---

## 2. Twardy Kontrakt Profilu B-rep (SSOT)

### 2.1. Jednostki (Zgodnie z regułą `AGENTS.md`)
- **Warstwa Domeny / Zapis Projektu (`CADNode.domainData`)**:
  - Pole profilu to bezwzględnie **`outline2d_nm: Array<[number, number]>`** (liczby całkowite w nanometrach).
  - Gwarantuje to brak rozjazdów skali między wymiarami płyty (`width`, `height` w nm) a punktami obrysu.
- **Granica Silnika Geometrii (`polygon-extrusion.ts`)**:
  - Adapter wejściowy konwertuje profil raz na brzegu: `nmToMm(p)`.
  - Wszystkie wewnętrzne obliczenia B-rep, triangulacja `earcut` i bufory Babylona operują na **milimetrach (`mm`)**.

### 2.2. Układ Współrzędnych LCS (Zasada Warsztatowa)
- **Punkt zerowy**: Pozostaje w **geometrycznym środku płyty `(0, 0, 0)`**.
  - Zapewnia to brak przesłaniania układu w narożnikach (gdzie formatki zachodzą na siebie) oraz symetrię operacji.
- **Kierunek osi $+Z$**: Zawsze skierowany **do wnętrza mebla**.
  - W warsztacie jest to **strona robocza formatki na stole CNC (Strona A / Naklejka)**. Płyta trafia na stół CNC stroną roboczą do góry ku wrzecionu.
- **Płaszczyzna profilu**: Profil 2D leży w płaszczyźnie płyty $UV$, zorientowany **przeciwnie do ruchu wskazówek zegara (CCW)** dla lica $Z+$.

---

## 3. Nowa Architektura Geometrii B-rep

### 3.1. Klasyfikacja ścian przez wektory normalne LCS (Zero heurystyki)
Zamiast zgadywać strony formatki po długości segmentu czy pozycji na liście, każdy odcinek profilu $A(u_1, v_1) \to B(u_2, v_2)$ o długości $L$ posiada zewnętrzny **wektor normalny**:
$$\vec{n} = \left( \frac{\Delta v}{L}, -\frac{\Delta u}{L} \right)$$

Iloczyn skalarny $\vec{n}$ z osiami LCS jednoznacznie i bezbłędnie klasyfikuje ścianę:

| Wektor normalny $\vec{n}$ w LCS | Pozycja w układzie | Przypisana tożsamość ściany (`faceName`) | Rola meblarska / Obrzeże |
| :--- | :--- | :--- | :--- |
| $\vec{n} = (+1, 0)$ | $u = +W/2$ (brzeg nominalny) | **`FACE_X_PLUS`** | **Przód (Front)** $\to$ obrzeże `edgeBanding['+X']` |
| $\vec{n} = (-1, 0)$ | $u = -W/2$ (brzeg nominalny) | **`FACE_X_MINUS`** | **Tył (Back)** $\to$ obrzeże `edgeBanding['-X']` |
| $\vec{n} = (0, +1)$ | $v = +H/2$ (brzeg nominalny) | **`FACE_Y_PLUS`** | **Góra (Top)** $\to$ obrzeże `edgeBanding['+Y']` |
| $\vec{n} = (0, -1)$ | $v = -H/2$ (brzeg nominalny) | **`FACE_Y_MINUS`** | **Dół (Bottom)** $\to$ obrzeże `edgeBanding['-Y']` |
| $\vec{n}$ równoległy do osi | Wewnątrz płyty ($u < W/2$ itp.) | **`NOTCH_${featureId}_${idx}`** | **Ścianka wcięcia / rewizji** $\to$ brak obrzeża |
| $\vec{n}$ pod kątem | Dowolna | **`SLANT_${idx}`** | **Ścianka skośna (skos dachu)** |

### 3.2. Natywne nazewnictwo krawędzi B-rep ($E = \text{Face}_A \cap \text{Face}_B$)
Krawędzie nie mają losowych ani sztucznych nazw (koniec ze słownikami typu `dol_przod` z `topology.ts`). Nazwa krawędzi w B-rep wynika wprost z par ścian, które łączy:
1. **Krawędzie lica roboczego ($Z+$)**:
   - Styk `FACE_X_PLUS` z `FACE_Z_PLUS` $\to$ **`EDGE_X_PLUS_Z_PLUS`**
   - Styk `FACE_X_MINUS` z `FACE_Z_PLUS` $\to$ **`EDGE_X_MINUS_Z_PLUS`**
2. **Krawędzie lica zewnętrznego ($Z-$)**:
   - Styk `FACE_X_PLUS` z `FACE_Z_MINUS` $\to$ **`EDGE_X_PLUS_Z_MINUS`**
3. **Pionowe narożniki formatki**:
   - Styk `FACE_X_PLUS` z `FACE_Y_PLUS` $\to$ **`EDGE_X_PLUS_Y_PLUS`**
4. **Krawędzie wcięć**:
   - Styk ścianki wcięcia z licem $\to$ **`EDGE_NOTCH_${id}_Z_PLUS`**

### 3.3. Wpusty pod plecy (HDF) i kanały LED
- Wpust biegnący wzdłuż tylnej ścianki boku szafy korzysta z istniejącej funkcji `splitSegmentByGrooves`.
- W miejscu styku z wpustem ścianka boczna rozcina się na wysokość wlotu (tworząc czysty uskok na wsunięcie płyty HDF).
- Gdy na tej samej formatce pojawi się rewizja przecinająca wpust – wpust urywa się na ściance rewizji (brak wiszących w powietrzu geometrii).

### 3.4. Zaokrąglenia (Fillet) i Fazowania (Chamfer) dla CAM i 3D
- **Kontrakt wizualny (3D)**: Łuk w narożniku profilu jest dyskretyzowany polilinią o kontrolowanej strzałce ugięcia ($\text{sagitta} \le 0.1\text{ mm}$).
- **Kontrakt maszynowy (CNC CAM)**: Segment łukowy przechowuje metadane analityczne:
  `{ type: 'ARC', center: [cx, cy], radius: R, startAngle, endAngle }`.
  Umożliwia to postprocesorom generowanie natywnych poleceń kołowych $G02 / G03$ (Homag MPR, Biesse, G-code) zamiast setek mikrokroków $G01$.

### 3.5. Obsługa sytuacji brzegowych (Rozcięcie płyty / Wiele konturów)
- **Fail-fast przy rozcięciu**: Jeśli wycięcie przecina formatkę na wylot przez całą szerokość dzieląc ją na dwie osobne części, silnik rzuca czytelny błąd walidacji: *„Operacja rozcina formatkę na osobne bryły”*. Jedna formatka = dokładnie jedna spójna bryła materiału.
- **Wycięcia wewnętrzne (otwory przelotowe)**: Zlewozmywak lub przepust kablowy wewnątrz płyty jest reprezentowany jako wewnętrzny kontur CW (dziura earcut) z wygenerowanymi ściankami wewnętrznymi.

---

## 4. Etapowy Plan Realizacji (Bezpieczna Ścieżka)

```
[Faza 1: Kontrakt profilu i klasyfikacja wektorowa w polygon-extrusion.ts]
                                │
                                ▼
[Faza 2: Walidacja nominalnego prostokąta N=4 i profilu L bez zmian w reszcie]
                                │
                                ▼
[Faza 3: Migracja pierwszej klasy operacji: wycięcie narożnika / rewizja]
                                │
                                ▼
[Faza 4: Testy integracyjne: obrzeża, hover/raycast, PMI, eksport CNC]
                                │
                                ▼
[Faza 5: Wygaszenie generatora boxTopo i pętli clipEdgesByMouths]
```

### Faza 1: Rozbudowa i standaryzacja `polygon-extrusion.ts`
1. Wdrożenie klasyfikacji ścian opartej na wektorach normalnych $\vec{n}$ w LCS zamiast heurystyk.
2. Wdrożenie natywnego nazewnictwa krawędzi $E = \text{Face}_A \cap \text{Face}_B$.
3. Przypisywanie obrzeży: segmenty o statusie ścian nominalnych (`FACE_X_PLUS` itp.) dziedziczą konfigurację z `model.edgeBanding`, segmenty `NOTCH` pozostają surowe.

### Faza 2: Walidacja ekstrudowania dla prostokąta ($N=4$)
1. Przetestowanie ścieżki profilowej dla zwykłej płyty prostokątnej `[[0,0], [W,0], [W,H], [0,H]]`.
2. Potwierdzenie, że raycast, podświetlanie ścian (hover) i gizma montażowe działają identycznie jak w starym modelu.
3. Pozostawienie formatki fazowanej (`buildBeveledBox`) i dotychczasowych formatek bez zmian.

### Faza 3: Migracja operacji wycięcia brzegowego (Narożnik / Rewizja)
1. Gdy użytkownik doda wycięcie brzegowe (dystans 0 mm lub uskok narożnika):
   - Modyfikujemy profil `outline2d` operacją boolowską 2D.
   - Płyta staje się 6-kątem lub 8-kątem i trafia do `buildPolygonPanelTopology`.
2. Ścianki wycięcia otrzymują rolę `NOTCH`, a nominalne krawędzie zachowują swoje obrzeża.
3. Całkowity brak rozcinania lica na paski materiału (zero linii widma).

### Faza 4: Weryfikacja integracyjna podsystemów
1. **Obrzeża**: Potwierdzenie w kalkulatorze i raportach, że obrzeża nie naklejają się wewnątrz wcięć.
2. **PMI i linie wymiarowe**: Potwierdzenie stabilnego kotwiczenia linii wymiarowych do krawędzi B-rep.
3. **CAM / CNC**: Weryfikacja wygenerowanego programu frezowania konturu (G-code / MPR).

### Faza 5: Wygaszenie ścieżki pudełkowej
1. Dopiero po pomyślnej weryfikacji Faz 1–4:
   - Zastąpienie wywołania `buildBoxTopology` w `mesh_builder.ts` wywołaniem profilowym dla wszystkich zwykłych płyt.
   - Usunięcie kodu łatającego paszczami (`clipEdgesByMouths`) z `cap-machining.ts`.

---

## 5. Instrukcja Rozpoczęcia Nowego Wątku

W nowym wątku podaj polecenie:
> *"Zgodnie z dokumentem `docs/PLAN_MIGRACJI_BREP_OUTLINE2D.md`, rozpoczynamy realizację Fazy 1 (wdrożenie wektorowej klasyfikacji ścian i natywnego nazewnictwa krawędzi w `polygon-extrusion.ts`)."*
