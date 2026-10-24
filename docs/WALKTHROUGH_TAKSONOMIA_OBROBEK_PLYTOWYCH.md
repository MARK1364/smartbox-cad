# Walkthrough: Taksonomia Obróbek Płytowych (`hole`, `groove`, `pocket`, `cutout`)

Dokument podsumowuje wdrożenie ścisłej 4-elementowej taksonomii cech obróbczych formatki meblowej w całym systemie (od schematu projektu, przez bibliotekę operacji, po silnik triangulacji 2.5D i ekstrakcję rysunkową).

---

## 1. Kontekst i Problem Wyjściowy

Dotychczas w systemie wszystkie operacje obróbcze na płytach, które nie były wierceniami punktowymi (`hole`), były oznaczane jednym generycznym typem:
```typescript
type: 'groove'
```

Prowadziło to do niebezpiecznych uproszczeń i zacierania różnic semantycznych:
- **Nuta pod plecy** (wąski wpust 4×8 mm biegnący wzdłuż krawędzi korpusu) była oznaczana jako `'groove'`.
- **Kanał pod profil LED** (wąski liniowy frez na listwę oświetleniową) był oznaczany jako `'groove'`.
- **Przetłoczenie / ramka ozdobna z dnem** (obszar 2D frezowany na głębokość np. 3 mm w płycie 18 mm) było oznaczane jako `'groove'`.
- **Rewizja instalacyjna pod rury na wylot** (wycięcie przelotowe bez dna) było oznaczane jako `'groove'` z parametrem `through: true`.
- **Ramiak witrynowy bez dna pod szybę** (np. `fill: 'glass'`) również traktowany był jako `'groove'` z `through: true`.

### Główne konsekwencje braku rozróżnienia:
1. **Brak czytelnej intencji geometrycznej**: Silnik 3D musiał odgadywać, czy generować dno wgłębienia (`feature_${id}_bottom`), sprawdzając flagi parametrów `params.through` lub `params.cutout`.
2. **Ryzyko regresji w CAM / CNC**: Postprocesory i strategie frezowania kieszeniowego (pocketing) wymagały innego podejścia niż liniowe frezowanie rowków piłą / frezem palcowym w osi ścieżki.
3. **Niespójność danych wejściowych**: Podczas gdy wpusty pod plecy i LED wynikają automatycznie z geometrii szafki, ramki i rewizje są definiowane przez użytkownika lub bibliotekę operacji.

---

## 2. Kanoniczny Podział Taksonomiczny (SSOT w `A1_core/project-schema.ts`)

Zgodnie z ustaleniami zlikwidowano nadużywanie typu `'groove'`. Wprowadzono precyzyjną, 4-elementową taksonomię cech:

| Typ | Semantyka | Dno wgłębienia | Źródło danych / Workflow |
|---|---|---|---|
| **`hole`** | Wiercenie walcowe punktowe $\varnothing \times Z$ | Ślepe lub przelotowe | Automaty silników okuć (`cup`, `screw`, kołki, mimośrody) |
| **`groove`** | Liniowy wpust / rowek wzdłuż ścieżki 1D/2D | **Z dnem** | Automaty z konstrukcji mebla (nuta pleców `isBackGroove`, kanał LED) |
| **`pocket`** | Wybranie materiału 2D / ramka z dnem ($Z < T$) | **Posiada dno** (`feature_${id}_bottom`) | Biblioteka operacji (`przetloczenie`, odsadzenia $L, R, T, B$) |
| **`cutout`** | Wycięcie przelotowe / rewizja / ramiak witrynowy | **Brak dna** (otwór na wylot) | Edytor rewizji (`edge_dims`) lub ramka witrynowa z `through: true` |

---

## 3. Zmiany w Poszczególnych Modułach

### A. Kontrakt Danych i Schemat Projektu (`A1_core/project-schema.ts`)
Rozszerzono zbiór dopuszczalnych typów cech i wyeksportowano predykat typów:

```typescript
export const SUPPORTED_FEATURE_TYPES = ['hole', 'groove', 'pocket', 'cutout'] as const;
export type SupportedFeatureType = typeof SUPPORTED_FEATURE_TYPES[number];
export type PanelFeatureType = SupportedFeatureType;

export function isSupportedFeatureType(type: string): type is SupportedFeatureType {
    return SUPPORTED_FEATURE_TYPES.includes(type as any);
}
```

Dzięki temu walidatory `validateFeatureType()` oraz `validatePanelFeatures()` pilnują (fail-fast), aby żaden nieobsługiwany typ (np. `fillet`, `chamfer`) nie uszkodził danych projektu.

### B. Biblioteka Operacji Panelowych (`o1_operacji/`)
1. **Typy operacji (`o1_operacji/operacje-types.ts`)**:
   Zaktualizowano kontrakt cechy operacji:
   ```typescript
   export interface OperationFeature {
       id: string;
       type: 'pocket' | 'cutout' | 'groove';
       ...
   }
   ```
2. **Budowa cechy (`o1_operacji/operacje-builder.ts`)**:
   Funkcja `buildOperationFeature()` automatycznie decyduje o typie na podstawie przelotowości:
   ```typescript
   const isThrough = Boolean(recipe.through || recipe.kind === 'THROUGH');
   const featureType: 'pocket' | 'cutout' = isThrough ? 'cutout' : 'pocket';

   return {
       id,
       type: featureType,
       name: recipe.name,
       face: faceName,
       params: {
           source: LIBRARY_SOURCE,
           library_id: recipe.id,
           u: rect.u,
           v: rect.v,
           width: rect.width,
           length: rect.length,
           depth: isThrough ? panelThickMm : (recipe.depthMm ?? 3),
           through: isThrough,
           ...(recipe.fill ? { fill: recipe.fill } : {}),
           ...(recipe.placement === 'edge_dims' ? { edge: { ...recipe.edge } } : {}),
       },
   };
   ```

### C. Silnik Triangulacji 2.5D i Geometrii 3D (`A4_smartpanel/native_core/cap-machining.ts`)
Silnik natywny `cap-machining.ts` w procesie triangulacji ścian zewnętrznych:
1. Rozpoznaje otwory w płaszczyźnie 2D formatki (`collectExtraHoles2D`) dla cech typu `'groove' | 'pocket' | 'cutout'`.
2. Buduje ściany wewnętrzne wgłębienia (krawędzie ścianek bocznych).
3. **Zarządzanie dnem geometrycznym**:
   ```typescript
   const isGrooveThrough = feat.type === 'cutout' || feat.params?.through === true || feat.params?.cutout === true;
   // Siatka dna `feature_${fid}_bottom` generowana jest WYŁĄCZNIE gdy !isGrooveThrough (czyli dla 'pocket' i 'groove')
   ```
   Dzięki temu dla `cutout` (rewizja, witryna) powstaje czysty otwór na wylot, a dla `pocket` powstaje dno wgłębienia na zadanej głębokości.

### D. Wstawianie, Fizyczne Pozycjonowanie i Synchronizacja Tafli Szkła (`GLASS_PANEL`)
W module `o1_operacji/operacje-apply.ts` wprowadzono pełny mechanizm `syncGlassPanelForCutout(panel, feature, doc)`:
1. Gdy użytkownik nanosi wycięcie ramiaka z opcją `fill: 'glass'`:
   - System tworzy węzeł potomny `CADNode` typu `NodeType.PART` o roli `GLASS_PANEL`.
   - Wymiary tafli odpowiadają dokładnie światłu wycięcia (`width`, `height`), a grubość wynosi `4 mm`.
   - **Pozycjonowanie 3D w przestrzeni formatki**: Środek wycięcia $(u_c, v_c) = (u + W/2, v + L/2)$ jest rzutowany na układ 3D formatki przez dane geometryczne ściany (`panel.getFace()`):
     $$P_{center} = \text{origin} + u_c \cdot \vec{u} + v_c \cdot \vec{v} - \vec{n} \cdot \frac{T}{2}$$
     Tafla szkła jest precyzyjnie centrowana w otworze (nawet przy asymetrycznych odsadzeniach ramki) oraz osadzana w środku grubości płyty. Pozycja lokalna zapisywana jest w `glassNode.setTranslation(posNm)` oraz `glassPanel.position`.
   - Nadana kategoria materiału to `'GLASS'`, dzięki czemu `resolveProcessingPath()` kieruje taflę bezpośrednio do zakładu szklarskiego (**`GLASS_SHOP`**), eliminując ryzyko błędnego skierowania na piłę/CNC.
2. Przy zmianie wymiarów wycięcia (odsadzenia ramiaka $L, R, T, B$) tafla automatycznie przelicza swoje wymiary oraz aktualizuje pozycję 3D.
3. Przy wyłączeniu opcji szkła lub usunięciu wycięcia węzeł `GLASS_PANEL` jest automatycznie usuwany z drzewa dokumentu.

### E. Semantyka, Geometria i Przetwarzanie CAM (`C1_cnc`)
Wyeliminowano wszelkie niejednoznaczności i degradację kieszeni oraz wycięć do pojedynczego liniowego rowka:
1. **Rozszerzenie DTO (`C1_cnc/dto/cam-dto.ts`)**:
   - Wprowadzono `PocketFeature` z parametrami 2D (`width`, `length`, `depth`), 4 narożnikami obrysu `boundaryPoints`, kopią lokalną `panelBoundaryPoints` oraz wektorem normalnym `normal`.
   - Dodano `isInnerContour?: boolean` do `ContourFeature`.
   - Rozszerzono `CNCOperation.type` o `'pocket'`.
   - Rozszerzono `CAMFeature = HoleFeature | GrooveFeature | ContourFeature | PocketFeature`.
2. **Ekstraktor Geometrii (`C1_cnc/geometry/geometry-extractor.ts`)**:
   - **`pocket`** -> generuje `PocketFeature` z rzeczywistym obszarem wybrania materiału. Obsługuje transformację `boundaryPoints` oraz `normal` przez aktywny `wcsManager`.
   - **`cutout`** -> generuje `ContourFeature` z zamkniętą pętlą 5 punktów, flagą `isInnerContour: true` oraz **bezwzględną docelową współrzędną poziomu Z cięcia uwzględniającą zwrot normalnej**:
     $$\text{depth} = p_0.z - \text{normal}_z \cdot T$$
     Dla `FACE_Z_PLUS` ($n_z = 1$) frez idzie z $+T/2$ do $-T/2$.
     Dla `FACE_Z_MINUS` ($n_z = -1$) frez idzie z $-T/2$ do $+T/2$.
     Gwarantuje to prawidłowy przelot przez całą grubość płyty w dół lub w górę w zależności od obrabianej płaszczyzny.
   - **`groove`** -> pozostaje wąskim liniowym `GrooveFeature` (ścieżka 1D od `startPoint` do `endPoint`).
3. **Zaawansowana Strategia Kieszeni (`C1_cnc/strategies/pocketing-strategy.ts`)**:
   - **Obsługa Wektora Normalnego w 3D**: Skrawanie w głąb materiału ($P_{\text{cut}} = P - \vec{n} \cdot \text{depth}$) oraz bezpieczny odjazd ($P_{\text{safe}} = P + \vec{n} \cdot 10.0$) są wyznaczane wektorowo wzdłuż jednostkowej normalnej $\vec{n}$, dzięki czemu kieszenie na `FACE_Z_PLUS` zagłębiają się w $-Z$, a na `FACE_Z_MINUS` w $+Z$.
   - **Priorytet Parametrów Narzędzia**: `stepoverPercent` jest pobierany kaskadowo: `customParams?.stepoverPercent ?? tool.parameters?.stepoverPercent ?? 65`.
   - **Czyszczenie Narożników (Corner Clean-Out Moves)**: W pętli zewnętrznej frez po dojechaniu do każdego narożnika $q_k$ wykonuje najazd wzdłuż dwusiecznej w stronę wierzchołka $C_k$ o odległość $\Delta = R(\sqrt{2} - 1)$, dzięki czemu okrąg krawędzi tnącej frezu sięga dokładnie wierzchołka kieszeni, usuwając pozostałości materiału z naroży.
4. **Procesor CAM (`C1_cnc/processor/cam-processor.ts`)**:
   - W `buildCLProgram()` rozpoznaje `featureType: 'pocket'` na podstawie obecności `boundaryPoints`.
   - W `collectAssignmentIssues()` zlicza `unassignedPockets` i uwzględnia je w statystykach przygotowania projektu.
   - W `createCncOperations()` obsługuje strategię `pocketing_concentric` dla kieszeni oraz generuje operacje CNC dla symulatora 3D i postprocesorów.

### F. Ekstrakcja Rysunkowa i Wybór Ścian
- **`R2_rys/drawing-project-extractor.ts`**:
  W metodach `_mapCadNodeToTreeNode` oraz `_mapPanelModelToTreeNode` warunki zbierające cechy powierzchniowe rozszerzono o `pocket` i `cutout`.
- **`A1_core/face-picker.ts`**:
  Obsługa selekcji ścian i cech `pocket` i `cutout`.

---

## 4. Nowa Reguła Architektoniczna w `.agents/AGENTS.md`

Do kontraktu projektowego dodano twardy zapis:

```markdown
## Taksonomia Cech Obróbczych Płytowych (`A1_core/project-schema.ts`)

Wszystkie cechy geometryczne formatki podlegają ścisłemu podziałowi na 4 typy (`SUPPORTED_FEATURE_TYPES`):
- `hole`: obróbka punktowa (wiercenie walcowe o średnicy ⌀ i głębokości Z).
- `groove`: liniowy wpust / rowek prowadzony wzdłuż ścieżki (automaty meblowe: nuta pod plecy, kanał LED).
- `pocket`: wybranie materiału / kieszeń / ramka z dnem (obszar 2D o głębokości < T, frezowanie z dnem).
- `cutout`: wycięcie przelotowe / ramiak witryny na wylot / rewizja pod rury (`through: true`, brak siatki dna).

Twarde reguły:
- Zakaz nazywania ramki, przetłoczenia i rewizji typem `groove`. Wpust `groove` jest wyłącznie wąską ścieżką liniową.
- Ramka/przetłoczenie bez dna pod szybę witrynową (`through: true`, opcjonalnie `fill: 'glass'`) oraz rewizja MUSZĄ mieć typ `cutout`.
- Silnik 3D (`cap-machining.ts`) dla `cutout` generuje otwór przelotowy bez siatki dna (`feature_${id}_bottom`), natomiast dla `pocket` generuje dno wgłębienia.
```

---

## 5. Weryfikacja i Testy Jednostkowe

1. **Nowy zestaw testów taksonomii (`o1_operacji/__tests__/taxonomy.test.ts`)**:
   - Weryfikacja predykatu `isSupportedFeatureType()` dla 4 typów.
   - Weryfikacja generowania `pocket` dla przetłoczenia z dnem i `cutout` dla rewizji/witryny.
2. **Testy Tafli Szkła (`o1_operacji/__tests__/glass-panel.test.ts`)**:
   - Sprawdzenie fizycznej obecności węzła `GLASS_PANEL` o grubości 4 mm w drzewie projektu pod formatką frontu.
   - Weryfikacja routingu szklarskiego: `resolveProcessingPath() === 'GLASS_SHOP'`.
   - Sprawdzenie automatycznego usuwania tafli przy rezygnacji z opcji szkła oraz aktualizacji wymiarów.
   - Weryfikacja wyliczania pozycji 3D `(loc.x, loc.y, loc.z)` dla asymetrycznego wycięcia witryny.
3. **Testy Ekstrakcji CAM i WCS (`C1_cnc/__tests__/geometry-extractor.test.ts`)**:
   - Potwierdzenie ekstrakcji `PocketFeature` z 4 narożnikami obrysu 2D dla `pocket` i ich transformacji w WCS.
   - Potwierdzenie ekstrakcji `ContourFeature` z 5 punktami pętli zamkniętej i bezwzględnym docelowym poziomem $Z$ dla `cutout` na `FACE_Z_MINUS` (przejście od $-9$ do $+9$).
   - Pełna transformacja WCS dla `ContourFeature`: `cf.panelDepth` przeliczane do `cf.depth` w WCS przez `wcsManager.toWcsCoordinates()`, a wektor `cf.normal` przez `wcsManager.transformVector()`.
   - Potwierdzenie liniowego `GrooveFeature` dla `groove`.
4. **Testy Strategii Frezowania Kieszeni (`C1_cnc/__tests__/pocketing-strategy.test.ts`)**:
   - Weryfikacja generowania koncentrycznych pętli czyszczących materiał ze `stepover` dla `PocketFeature` na `FACE_Z_PLUS` oraz `FACE_Z_MINUS4. **Testy Strategii Frezowania Kieszeni (`C1_cnc/__tests__/pocketing-strategy.test.ts`)**:
   - Weryfikacja generowania koncentrycznych pętli czyszczących materiał ze `stepover` dla `PocketFeature` na `FACE_Z_PLUS` oraz `FACE_Z_MINUS`.
   - Weryfikacja odczytu `stepoverPercent` z definicji narzędzia (40% = 4 mm).
   - Weryfikacja ochrony ścianek bocznych kieszeni: usunięto ruchy nadcinające narożniki, frez zachowuje odległość $\ge R$ od wszystkich ścian bocznych ($x \ge 5$, $y \ge 5$).
   - Weryfikacja raportowania `unassignedPockets` w procesorze CAM.
   - **Bramka fail-fast**:
     - Test odrzucenia obróconej normalnej kieszeni (np. oś Y).
     - Test odrzucenia małego odchylenia normalnej $\approx 1.7^\circ$ przy ścisłej tolerancji $10^{-4}$.
     - Test odrzucenia nieprawidłowej długości normalnej (zerowej `[0, 0, 0]` oraz niejednostkowej `[0, 0, 0.5]`).
     - Test bezwzględnego odrzucenia niepłaskich punktów w osi Z (nawet przy podanej poprawnej normalnej `[0, 0, 1]`).
     - Test odrzucenia rowka ze ścianki bocznej, rowka o niejednostkowej normalnej oraz rowka o zmiennym Z ($startPoint.z \ne endPoint.z$).
5. **Testy Strategii Konturu Wycięć (`C1_cnc/__tests__/profiling-strategy.test.ts`)**:
   - Dwustronne frezowanie przelotowe (bi-directional Z): obsługa wycięć zaczynających się na `FACE_Z_PLUS` ($z = +9 \to -9$) oraz `FACE_Z_MINUS` ($z = -9 \to +9$).
   - Prawidłowe wyliczanie `safeZ` po stronie wejścia narzędzia ($+19$ dla `+Z`, $-19$ dla `-Z`).
   - Wieloetapowe zagłębianie na bazie `tool.parameters.stepDown` oraz `customParams.stepdownMm`.
   - **Bramka fail-fast**:
     - Test odrzucenia obróconej normalnej konturu (np. oś X).
     - Test odrzucenia małego odchylenia normalnej $\approx 1.7^\circ$ przy ścisłej tolerancji $10^{-4}$.
     - Test odrzucenia nieprawidłowej długości normalnej (zerowej `[0, 0, 0]` oraz niejednostkowej `[0, 0, 0.5]`).
     - Test bezwzględnego odrzucenia niepłaskich punktów w osi Z (nawet przy podanej poprawnej normalnej `[0, 0, 1]`).
     - Test odrzucenia rowka ze ścianki bocznej, rowka o niejednostkowej normalnej oraz rowka o zmiennym Z ($startPoint.z \ne endPoint.z$).
6. **Aktualizacja testów fail-fast (`A4_smartpanel/__tests__/cap-machining-failfast.test.ts`)**:
   - Potwierdzenie, że `pocket` i `cutout` są w pełni legalnymi typami akceptowanymi przez `validatePanelFeatures()`.
7. **Wynik pełnej bramki (`npm run verify`)**:
   - `typecheck` (`tsc --noEmit`): **0 błędów**.
   - `vitest run`: **204 pliki testowe, 1404 testy zaliczone (100% pass)**.
   - `audit`: **0 naruszeń kontraktów (exit code 0)**.

---

## 6. Ograniczenia i Założenia Architektoniczne (WCS i Frezowanie 2.5D)

### Założenie Płaszczyzny Roboczej XY (Standard Obróbki Płytowej 2.5D)
1. **Obróbka meblowa 3-osiowa**:
   - `ProfilingStrategy` oraz `PocketingStrategy` operują w paradygmacie obróbki płytowej 2.5D, w którym formatka leży płasko na stole roboczym w płaszczyźnie $XY$ bazowego układu WCS.
   - Normalna obrabianego lica formatki musi być równoległa do osi pionowej wrzeciona: $[0, 0, 1]$ (`FACE_Z_PLUS`) lub $[0, 0, -1]$ (`FACE_Z_MINUS`).
   - W tym układzie interpolacja konturu i pętli czyszczących odbywa się w płaszczyźnie $XY$, a poziomy `SafeZ`, zagłębiania roboczego i dna wyznaczane są wzdłuż osi $Z$.
2. **Kompletna i ścisła bramka fail-fast w kodzie**:
   - Zgodnie z zasadą, że kontrakt musi być wymuszany przez kod we wszystkich ścieżkach wykonania:
     - **Jednostkowość i kierunek normalnej w osi Z ($10^{-4}$)**: w obu strategiach sprawdzany jest warunek:
       ```typescript
       Math.hypot(normal.x, normal.y) <= 1e-4 && Math.abs(Math.abs(normal.z) - 1.0) <= 1e-4
       ```
       Odrzucane są zarówno odchylenia kątowe powyżej $0.0057^\circ$, jak i wektory zdegenerowane: zerowe `[0, 0, 0]` oraz niejednostkowe `[0, 0, 0.5]`.
     - **Bezwzględna kontrola koplanarności**: niezależnie od tego, czy normalna została podana, czy nie, strategie weryfikują stały poziom $Z$ wszystkich punktów (`points.every(p => Math.abs(p.z - p0.z) <= 1e-4)`). Geometrie o zmiennym poziomie $Z$ (np. rampy 3D) są bezwzględnie odrzucane.
     - **Ścieżka rowków (`GrooveFeature`)**: weryfikowana jest jednostkowość normalnej w osi Z oraz poziomość toru (`Math.abs(startPoint.z - endPoint.z) <= 1e-4`). Rowki na ściankach bocznych formatki oraz rowki pochyłe rzucają błąd fail-fast.
   - Każda próba wygenerowania ścieżki dla formatki zorientowanej pod kątem w przestrzeni WCS lub z niepłaskimi punktami natychmiast przerywa generowanie kodu błędem (*fail-fast*), uniemożliwiając wygenerowanie wadliwego toru CNC.
   - Dla zaawansowanych obróbek wieloosiowych w obróconym WCS przewidziana jest przyszła rozbudowa o transformację płaszczyzny roboczej (np. cykl płaszczyzny uchylnej `G68.2` / `PLANE SPATIAL`).


