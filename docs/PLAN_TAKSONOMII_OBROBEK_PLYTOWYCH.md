# Plan Architektoniczny: Taksonomia Obróbek Płytowych (`hole`, `groove`, `pocket`, `cutout`)

## 1. Wstęp i Problem Wyjściowy

W dotychczasowej architekturze systemu wszystkie operacje obróbcze na płytach niebędące otworami punktowymi były zapisywane pod jednym typem:
```typescript
type: 'groove'
```

### Dlaczego to był problem?
Wrzucenie wszystkich wycięć do worka `groove` było skrótem myślowym z czasów wczesnego prototypowania geometrii 3D. W praktyce meblarskiej i inżynierii CAD/CAM te operacje są zupełnie czymś innym:

1. **Wycięcie rewizyjne (np. 150 × 200 mm na rury w plecach)** to NIE jest żaden „rowek” (*groove*). Jest to **wycięcie przelotowe (cutout)**.
2. **Front ramiakowy witryny (np. ramiak 60 mm wycięty na wylot pod szybę)** to również nie jest rowek, tylko **wycięcie na wylot (cutout)** z opcją wstawienia tafli szkła.
3. **Przetłoczenie ozdobne / płycina (np. 400 × 500 mm frezowane na 3 mm głębokości)** to technologicznie **kieszeń (pocket)** z dnem.
4. **Nuta pod plecy (3,2 mm) lub kanał pod profil LED (14 mm)** to klasyczny, wąski **wpust / rowek liniowy (groove)**.

### Różne drogi wprowadzania danych (Input Pipelines):
Operacje te różnią się fundamentalnie także źródłem pochodzenia danych:
- **Automatyczne z projektu / szafki**:
  - *Rowek pod plecy*: generowany automatycznie z gabarytów i konstrukcji korpusu (`A3_smartframe`).
  - *Kanał pod LED*: wyliczany z modułu Bloki LED (`A2_bloki`).
- **Parametryczne od użytkownika (interaktywne)**:
  - *Ramka*: użytkownik podaje wygodne odsadzenia od brzegów ($L, R, T, B$, np. po 60 mm).
  - *Rewizja*: użytkownik wskazuje krawędzie i podaje wymiary $W \times H$ oraz odsunięcia $U, V$ od wybranej krawędzi formatki.

---

## 2. Nowa, Czysta Taksonomia 4 Typów Obróbek (`PanelFeatureType`)

Wprowadzamy jednoznaczny, 4-elementowy podział zgodny z profesjonalnymi systemami CAD (SolidWorks, Inventor) i oprogramowaniem CAM:

```typescript
export type PanelFeatureType = 'hole' | 'groove' | 'pocket' | 'cutout';
```

| Typ (`type`) | Nazwa meblarska | Kształt geometryczny | Dno | Źródło danych | Obróbka na maszynie CNC |
|---|---|---|---|---|---|
| **`hole`** | Otwór punktowy | Walec (średnica $\varnothing$, głębokość) | Tak / Nie | Okucia / Bloki (`buildHoleMachiningIntent`) | Cykl wiertarski (G81 / wiertło) |
| **`groove`** | Wpust / Rowek | Liniowy wąski kanał (szerokość 3–14 mm) | **TAK** | Automat konstrukcyjny szafki (plecy, profil LED) | Agregat piłowy (piła nutująca) lub jedno przejście frezem |
| **`pocket`** | Kieszeń / Przetłoczenie | Obszar 2D o określonym polu powierzchni ($W \times H$) | **TAK** (głębokość $< T$) | Użytkownik z UI (`o1_operacji`: odsadzenia ramiaka lub wymiary od krawędzi) | Wierszowanie kieszeni (zygzak frezem wybierający materiał dna) |
| **`cutout`** | Wycięcie / Rewizja / Ramiak na wylot | Obszar 2D wycięty na wylot płyty ($W \times H$) | **NIE** (na wylot, `through: true`) | Użytkownik z UI (`o1_operacji`: rewizja na rury lub ramiak witryny bez dna) | Kontur wewnętrzny (objechanie obwodu frezem rozkrojowym) |

---

## 3. Specyfika Ramki i Rewizji (`o1_operacji`)

Aby nie dublować kodu i zachować wygodę pracy dla stolarza, rozdzielamy **sposób zadawania geometrii** od **rezultatu technologicznego**:

### A. Sposób zadawania geometrii (Pozycjonowanie w UI):
1. **Tryb Ramki (`placement: 'frame'`)**:
   - Szybkie zadawanie ramiaka: odsadzenia od 4 krawędzi formatki (`insets: { l, r, t, b }`, np. po 60 mm).
   - Użytkownik nie musi liczyć współrzędnych ani środka płyty.
2. **Tryb Od Krawędzi (`placement: 'edge_dims'`)**:
   - Wymiary prostokąta $W \times H$ oraz odległości $U, V$ od wskazanej krawędzi (np. od lewej 100 mm, od dołu 80 mm).

### B. Rezultat technologiczny (Głębokość i Typ Cechy):
W obu trybach (zarówno dla ramki, jak i dla rewizji) użytkownik ma przełącznik:

```
[ ] Na wylot (bez dna)    Głębokość: [ 3 mm ]
[ ] Wstaw szybę (szkło 4mm)
```

1. **Gdy `through: false` (z dnem) ➔ `type: 'pocket'`**:
   - Powstaje kieszeń o zadanej głębokości (np. 3 mm pod wklejenie lustra, ozdobna płycina).
2. **Gdy `through: true` (BEZ DNA / na wylot) ➔ `type: 'cutout'`**:
   - Środek zostaje wycięty na wylot (odpad wypada).
   - **Ramiak witrynowy pod szybę**: Użytkownik używa szybkich suwaków ramki (np. 60 mm), zaznacza „Na wylot” i otrzymuje czyste wycięcie pod witrynę (`type: 'cutout'`).
3. **Opcja Wypełnienia (`fill: 'glass'`)**:
   - Jeśli zaznaczono opcję szyby, system wstawia w to wycięcie taflę szkła (`PART` o roli `GLASS_PANEL`).

---

## 4. Architektura Konsumpcji Danych (Silnik 3D i Moduł CAM)

Dzięki wyczyszczeniu taksonomii każdy konsument danych zyskuje prosty, bezbłędny kod:

### A. Silnik Geometrii 3D (`A4_smartpanel/native_core/cap-machining.ts`):
```typescript
if (feat.type === 'cutout') {
    // 1. Zarejestruj otwór w earcut (obrys wycięty na wylot lica)
    // 2. Wygeneruj 4 ścianki wewnętrzne przelotowe
    // 3. ZERO generowania siatki dna (optymalizacja wydajności)
} else if (feat.type === 'pocket') {
    // 1. Zarejestruj wybranie w earcut
    // 2. Wygeneruj ścianki boczne
    // 3. Zbuduj siatkę dna na zadanej głębokości (feature_..._bottom)
} else if (feat.type === 'groove') {
    // Liniowy wpust wzdłuż wektora ścieżki
}
```

### B. Moduł CAM / CNC (`C1_cnc/geometry/geometry-extractor.ts`):
- `feat.type === 'groove'` ➔ `GrooveFeature`: agregat piłowy lub frez liniowy.
- `feat.type === 'cutout'` ➔ `ContourFeature` (wewnętrzny): objechanie obrysu frezem rozkrojowym (opcjonalnie z mostkami technologicznymi).
- `feat.type === 'pocket'` ➔ `PocketFeature`: pełne wierszowanie dna kieszeni (pocketing).

---

## 5. Plan Implementacji Krok po Kroku

### Krok 1: Definicje Typów i Kontraktów
- Rozszerzenie typu `PanelFeatureType` w [`A1_core/project-schema.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts).
- Aktualizacja interfejsu `OperationFeature` w [`o1_operacji/operacje-types.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts).

### Krok 2: Generator Operacji Formatki (`o1_operacji`)
- W [`o1_operacji/operacje-builder.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts):
  - Wyliczenie typu: `const type: PanelFeatureType = isThrough ? 'cutout' : 'pocket';`
  - Zwracanie poprawnego `type: 'pocket' | 'cutout'`.
  - Zagwarantowanie, że ramka z `through: true` generuje `type: 'cutout'`.

### Krok 3: Silnik Siatki 3D (`A4_smartpanel`)
- W [`cap-machining.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts) oraz [`cap-holes.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-holes.ts):
  - Obsługa `feat.type === 'pocket'` oraz `feat.type === 'cutout'`.
  - Zachowanie kompatybilności wstecznej dla starszych projektów mających `type: 'groove'` z parametrem `through`.

### Krok 4: Testy Jednostkowe
- Aktualizacja i rozszerzenie testów w [`o1_operacji/__tests__/operacje-builder.test.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/__tests__/operacje-builder.test.ts):
  - Test: Ramka z dnem generuje `type: 'pocket'`.
  - Test: Ramka bez dna pod szybę generuje `type: 'cutout'`.
  - Test: Rewizja od krawędzi generuje `type: 'cutout'`.
  - Test: Zachowanie właściwości `fill: 'glass'`.

### Krok 5: Zasady Architektoniczne Agenta
- Zapisanie reguły taksonomii w [`.agents/AGENTS.md`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/.agents/AGENTS.md).
- Uruchomienie pełnej weryfikacji bramki: `npm run verify` (`tsc` + `vitest` + `audit`).

---

## 6. Status Wdrożenia i Zrealizowane Rozszerzenia

Wszystkie założenia planu zostały w 100% zrealizowane:
1. **SSOT Schematu Danych**: 4 typy (`hole`, `groove`, `pocket`, `cutout`) w `A1_core/project-schema.ts`.
2. **Silnik Siatki 3D**: `cap-machining.ts` obsługuje `pocket` (z dnem) i `cutout` (bez dna).
3. **Ekstrakcja CAM (`C1_cnc`)**:
   - `PocketFeature` z 4 narożnikami obrysu 2D `boundaryPoints` dla `pocket`.
   - `ContourFeature` z zamkniętą pętlą 5 punktów, pełną głębokością płyty i `isInnerContour: true` dla `cutout`.
   - Liniowy `GrooveFeature` wyłącznie dla wpustów `groove`.
   - Obsługa `PocketFeature` w `PocketingStrategy`.
4. **Wstawianie i Synchronizacja Szkła (`GLASS_PANEL`)**:
   - Wycięcie ramiaka z `fill: 'glass'` automatycznie powołuje węzeł potomny `CADNode` typu `PART` o roli `GLASS_PANEL` i grubości 4 mm.
   - Kategoria materiału `'GLASS'` kieruje taflę bezpośrednio do zakładu szklarskiego (`GLASS_SHOP`) przez `resolveProcessingPath()`.
   - Zmiana wymiarów wycięcia automatycznie aktualizuje taflę szkła, a usunięcie opcji szkła usuwa taflę z projektu.
5. **Weryfikacja**:
   - Testy CAM: `C1_cnc/__tests__/geometry-extractor.test.ts`.
   - Testy Szkła: `o1_operacji/__tests__/glass-panel.test.ts`.
   - Testy Taksonomii: `o1_operacji/__tests__/taxonomy.test.ts`.
   - Bramka `npm run verify` — status: PASS.
