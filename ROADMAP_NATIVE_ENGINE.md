# DROGOWSKAZ ARCHITEKTONICZNY: NATYWNY SILNIK CAD (FILOZOFIA SOLVESPACE)
## Bezkompromisowa wydajność meblarska na sprzęcie warsztatowym stolarza

---

## 1. WIZJA I FILOZOFIA ROZWOJU

### 1.1. Kontekst i Grupa Docelowa
Aplikacja meblarska nie może być tworzona z myślą o stacjach roboczych za 10 000 zł z kartami RTX. Docelowy użytkownik to **stolarz, technolog lub projektant pracujący na typowym laptopie biurowym** (4-rdzeniowy procesor, 8–16 GB RAM, zintegrowana grafika Intel UHD / Iris Xe / AMD Vega).

### 1.2. Wzorzec Architektoniczny: SolveSpace
Program **SolveSpace** udowodnił, że pełny, precyzyjny parametryczny CAD może:
- Ważyć **poniżej 3 MB** (zamiast setek megabajtów),
- Działać w **60–120 FPS na 10-letnim sprzęcie biurowym**,
- Nie posiadać **żadnych ciężkich zależności zewnętrznych** (brak OpenCASCADE, Boost, CGAL),
- Opierać się w 100% na **własnych, zwięzłych, wyspecjalizowanych algorytmach**.

### 1.3. Specyfika Meblarstwa (98% Geometrii to 2.5D)
Mebel meblarski nie potrzebuje generycznych jąder bryłowych operujących na zaawansowanych powierzchniach swobodnych (NURBS). 
Struktura mebla to:
1. **Płyty prostopadłościenne** (6 ścian ortogonalnych),
2. **Cechy 2.5D**: otwory walcowe (nawierty przelotowe/nieprzelotowe), rowki/nuty, felce, kieszenie i zaciosy,
3. **Okucia powtarzalne**: kołki, mimośrody, konfirmaty, zawiasy, prowadnice,
4. **Więzy kinematyczne**: przyleganie płaszczyzn (*Coplanar / Flush*), dystans, współosiowość otworów (*Coaxial*).

Dedykowany algorytm meblarski zoptymalizowany pod tę specyfikę jest **20x–50x szybszy** niż uniwersalne silniki CAD.

---

## 2. GŁÓWNE CELE I WSKAŹNIKI WYDAJNOŚCI (KPI)

| Obszar | Stan obecny (JS / V8) | Cel docelowy (Natywny WASM) | Krotność przyspieszenia |
|---|---|---|---|
| **Generowanie geometrii szafy** (20 płyt + 150 nawierceń) | 40 – 90 ms (widoczne przycięcie) | **< 1.5 ms** | **~30x – 50x** |
| **Krok solvera więzów** (ruch modułu w czasie rzeczywistym) | 8 – 20 ms | **< 0.2 ms** | **~40x – 80x** |
| **Raycast kursora myszy** (FacePicker / wykrywanie wnęk) | 3 – 8 ms na klatkę | **< 0.04 ms** | **~100x** |
| **Liczba wywołań rysowania GPU** (Draw Calls) | 200 – 500 wywołań | **< 5 wywołań (Single Buffer + Instancing)** | **~50x mniej obciążenia GPU** |
| **Zarządzanie pamięcią** (Garbage Collection) | Ciągłe alokacje obiektów w pętli | **Zero alokacji na klatkę (Zero GC)** | Brak mikro-zacięć (Zero-Stutter) |
| **Rozmiar binarny rdzenia** | Zależności NPM (wiele MB) | **< 500 KB (skompilowany WASM)** | Błyskawiczny start (< 50 ms) |

---

## 3. PIĘĆ FILARÓW ARCHITEKTURY AUTORSKIEJ

```
+---------------------------------------------------------------------------------+
|                                PRZEGLĄDARKA (UI)                               |
|   React (Zarządzanie stanem, drzewo obiektów, formularze wymiarów w mm)         |
+---------------------------------------------------------------------------------+
                                        | (Zdarzenia wejścia / Wymiary)
                                        v
+---------------------------------------------------------------------------------+
|                  NATYWNY RDZEŃ CAD (Rust / C++ -> WASM Worker)                 |
|                                                                                 |
|  [Filar 1] Autorski B-Rep 2.5D     [Filar 2] Własny Solver (SolveSpace-style)  |
|  - 6 ścian bazowych + cechy        - Równania analityczne, wektoryzacja SIMD   |
|  - Własny sweep-line triangulator  - Układ równań: Sparse QR / Gradienty        |
|                                                                                 |
|  [Filar 3] Własne Drzewo BVH       [Filar 4] Zero-Copy Memory Manager           |
|  - Błyskawiczny Raycast myszy      - Zapis wprost do SharedArrayBuffer          |
|  - Wykrywanie wnęk i krawędzi      - Zero serializacji JSON i zero Garbage Coll |
+---------------------------------------------------------------------------------+
                                        | (Pamięć współdzielona bez kopiowania)
                                        v
+---------------------------------------------------------------------------------+
|                    SILNIK PREZENTACJI 3D (WebGL2 / WebGPU)                      |
|                                                                                 |
|  [Filar 5] Low-End GPU Architecture:                                            |
|  - Single Combined Vertex Buffer (Cała szafa w 1-2 Draw Calls)                  |
|  - Hardware Instancing (500 kołków/wkrętów w 1 wywołaniu GPU)                   |
|  - Lekki shader studyjny (MatCap / Flat Edge) przyjazny karcie Intel UHD        |
|  - Render-on-Demand (0% zużycia CPU/GPU w spoczynku)                            |
+---------------------------------------------------------------------------------+
```

---

### Filar 1: Własny B-Rep Płytowy 2.5D i Natywny Triangulator
* **Problem**: Gotowe biblioteki triangulacji alokują setki tablic dynamicznych i gubią się na współliniowych wierzchołkach otworów.
* **Rozwiązanie**:
  - Dedykowana struktura danych: `PlateMeshBuilder`.
  - Ściany pełne (bez otworów) generowane są bezpośrednio jako 2 trójkąty (prosta matematyka narożników).
  - Ściany z otworami: autorski algorytm podziału prostokąta na pasy (*Sweep-line 2D*) lub triangulacja *Constrained Delaunay* zoptymalizowana ściśle pod regularne okręgi i prostokąty.
  - Wygenerowane współrzędne w nanometrach (`nm`) przeliczane są bezpośrednio na bufor wierzchołków GPU.

### Filar 2: Własny Solver Więzów Kinematycznych (wzorem SolveSpace)
* **Problem**: Generyczne biblioteki algebry w JS operują na dynamicznych macierzach, powodując masę alokacji i wolne iteracje.
* **Rozwiązanie**:
  - Płaski stan wektorowy w pamięci ciągłej (pozycje i kwaterniony węzłów).
  - Wektory reszt (*residuals*) i macierz Jacobiego liczone **analitycznie** w Rust:
    - Więz `COPLANAR` / `ALIGN`: iloczyn skalarny normalnych i różnica rzutów punktów.
    - Więz `DISTANCE`: odległość ze znakiem wzdłuż osi normalnej.
    - Więz `COAXIAL`: zgodność osi symetrii otworów.
  - Rozwiązywanie metodą najmniejszych kwadratów (Levenberg-Marquardt lub zmodyfikowany Gauss-Newton) z dekompozycją QR operującą bezpośrednio na rejestrach SIMD procesora.

### Filar 3: Autorskie Drzewo Przestrzenne BVH (AABB Tree)
* **Problem**: Funkcja `scene.pick()` w silnikach 3D iteruje po siatkach trójkątów na głównym wątku, dławiąc kursor myszy na słabszych laptopach.
* **Rozwiązanie**:
  - Własna hierarchia brył brzegowych (drzewo AABB):
    - Poziom 1: Korpusy / Szafy (duże prostopadłościany).
    - Poziom 2: Formatki meblowe.
    - Poziom 3: Poszczególne ściany i krawędzie B-Rep.
  - Test promienia myszy (*Ray-AABB intersection*) ogranicza się do kilkunastu operacji zmiennoprzecinkowych.
  - Wynik: podświetlanie ścian, wykrywanie wnęk i przyciąganie magnesem (snapping) działają z zerowym opóźnieniem.

### Filar 4: Pamięć Dzielona i Architektura Zero-Copy (`SharedArrayBuffer`)
* **Problem**: Przesyłanie geometrii przez `postMessage(json)` w JS tworzy kopie danych w pamięci i wymusza parsowanie.
* **Rozwiązanie**:
  - Silnik Rust/WASM pisze bezpośrednio do pre-alokowanego bloku pamięci `SharedArrayBuffer`.
  - Render 3D po stronie przeglądarki pobiera widok `TypedArray` i natychmiast wysyła go do bufora GPU za pomocą `gl.bufferSubData`.
  - Zero narzutu serializacji, zero alokacji pamięci na stercie V8.

### Filar 5: Minimalistyczny Rendering GPU dla Układów Zintegrowanych
* **Problem**: Zintegrowane karty Intel UHD dławią się przy setkach wywołań rysowania (Draw Calls) i ciężkich shaderach PBR.
* **Rozwiązanie**:
  - **Single Combined Buffer**: Geometria wszystkich formatek mebla jest łączona w jeden ciągły bufor wierzchołków. Cała szafa to **1 Draw Call**.
  - **Hardware Instancing**: Wszystkie powtarzalne złącza (kołki, mimośrody) renderowane są w **1 Draw Callu** na dany typ okucia.
  - **Shader Warsztatowy**: Wyrazisty, techniczny styl CAD (czyste cieniowanie krawędziowe, MatCap, subtelna okluzja) – doskonała czytelność mebla przy minimalnym obciążeniu GPU.
  - **Render-on-Demand**: Silnik renderuje klatkę wyłącznie wtedy, gdy kamera się porusza lub zmieniają się wymiary mebla. Gdy użytkownik myśli lub wprowadza dane w formularzu, zużycie procesora i karty graficznej wynosi **dokładnie 0%**.

---

## 4. PLAN WDROŻENIA – DROGA DOSTĘPNOŚCI (ETAPY)

### ETAP 1: Fundament i Niskie Koszty (Low-Hanging Fruits w obecnym kodzie)
*Czas realizacji: 1–2 tygodnie*
- [ ] Wymuszenie **Render-on-Demand** na całej scenie (koniec z ciągłym pętlami `requestAnimationFrame` w spoczynku).
- [ ] Wdrożenie **GPU Instancing** dla elementów złącznych w `C2_connectors` (zastąpienie pojedynczych meshy kołków wspólnym instancjonowaniem).
- [ ] Odciążenie wątku UI: debouncing i optymalizacja re-renderów komponentów React przy przesuwaniu myszą.

### ETAP 2: Prototyp Autorskiego Meshera w Rust/WASM (Proof-of-Concept)
*Czas realizacji: 3–4 tygodnie*
- [ ] Utworzenie dedykowanego crate: `crates/cad_native_core`.
- [ ] Implementacja natywnej struktury danych formatki: wymiary całkowite `nm` (SSOT), 6 ścian, lista nawierceń `(x, y, d, depth)`.
- [ ] Autorski algorytm generowania trójkątów płyty z otworami bez bibliotek zewnętrznych.
- [ ] Benchmark: Porównanie wydajności generowania 50 płyt z otworami: stary `NativePanelBuilder` (JS) vs nowy moduł Rust/WASM. Oczekiwany wynik: **> 10x szybciej**.

### ETAP 3: Autorskie Drzewo BVH i Raycasting w WASM
*Czas realizacji: 3 tygodnie*
- [ ] Implementacja drzewa AABB w module `cad_native_core`.
- [ ] Przeniesienie logiki badania promienia myszy (FacePicker, wykrywanie wnęk) do WASM.
- [ ] Zapewnienie natychmiastowego czasu odpowiedzi na ruch kursora (< 0.05 ms).

### ETAP 4: Własny Solver Więzów (Filozofia SolveSpace)
*Czas realizacji: 4–6 tygodni*
- [ ] Przeniesienie formuł matematycznych więzów (`S2_solver`) do formatu wektorowego w Rust.
- [ ] Implementacja prostego, analitycznego algorytmu najmniejszych kwadratów bez zewnętrznych frameworków algebry.
- [ ] Współdzielenie stanu węzłów przez `SharedArrayBuffer` – płynne rozwiązywanie więzów łańcuchowych w ułamkach milisekundy.

### ETAP 5: Autorski Silnik Ścieżek CAM i Postprocesory
*Czas realizacji: 4 tygodnie*
- [ ] Generowanie geometrii ścieżek frezowania, kieszeniowania i trochoid w Rust w standardzie CLData (ISO 4343).
- [ ] Błyskawiczna symulacja ubytkowa i eksport G-kodu bezpośrednio z natywnego B-Repu.

---

## 5. ZASADY ŻELAZNE ARCHITEKTURY (KODEKS INŻYNIERSKI)

1. **Niezmienność SSOT Jednostek**: Wewnętrzny rdzeń Rust operuje wyłącznie na liczbach całkowitych w **nanometrach (`nm`)**. Zero błędów zmiennoprzecinkowych przy pozycjonowaniu i sprawdzaniu kolizji. Konwersja na `mm` następuje wyłącznie w widoku UI i w kodzie G-code CNC.
2. **Zero Ciężkich Bibliotek Generycznych**: Zakaz dołączania generycznych silników CAD, ciężkich parserów czy kombajnów matematycznych. Każdy algorytm ma być napisany z myślą o prostocie geometrii meblarskiej.
3. **Przyjazność dla Słabego Sprzętu**: Każda zmiana w kodzie musi być weryfikowana pod kątem działania na zintegrowanej karcie graficznej (niska liczba wywołań rysowania, zero wycieków pamięci, chłodny procesor).
4. **Ciągłość Działania Projektu**: Migracja odbywa się modułowo (wzorzec *Strangler Fig*). Nowe moduły WASM zastępują stare komponenty JS krok po kroku, bez zatrzymywania rozwoju funkcji biznesowych aplikacji.
