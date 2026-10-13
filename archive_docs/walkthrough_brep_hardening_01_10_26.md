# Podsumowanie i Walkthrough: Uszczelnienie B-rep 2.5D (Hardening & Feature Preservation)

Data: **01.10.2026**  
Status: **Zrealizowane i zweryfikowane (`npm run verify` — EXIT 0, 990 testów zielonych)**

---

## 1. Kontekst i Diagnoza

Na podstawie szczegółowego audytu architektury uproszczonego kernela B-rep 2.5D w domenie meblarskiej ([ROADMAP_NATIVE_ENGINE.md](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/ROADMAP_NATIVE_ENGINE.md)), zidentyfikowano i zaadresowano kluczowe luki kontraktowe, utratę geometrii oraz problem stabilności viewportu 3D:

1. **Bevel gubił wszystkie obróbki (Cichy błąd krytyczny na licach i ścianach bocznych)**:
   - W [mesh_builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/mesh_builder.ts) przy aktywnym fazowaniu krawędzi (`edgeBanding` z `cutAngle`), funkcja natychmiast zwracała `buildBeveledBox`, zupełnie omijając triangulację cech formatki.
   - Zarówno lica główne (`FACE_Z_PLUS`, `FACE_Z_MINUS`), jak i ściany boczne (`FACE_X_PLUS`, `FACE_X_MINUS`, `FACE_Y_PLUS`, `FACE_Y_MINUS`) traciły otwory pod zawiasy, nawierty krawędziowe pod kołki/konfirmaty oraz wyloty wpustów przelotowych.
2. **Architektura Fail-Fast vs Stabilność Viewportu ("Czarny ekran")**:
   - Twardy `throw new Error` wewnątrz pętli generowania siatek (`PanelView.updateMesh` / `NativePanelBuilder`) powodował wysypanie całego widoku 3D w Babylon.js przy napotkaniu nieobsługiwanego typu cechy (np. `fillet`).
   - Prawidłowy wzorzec architektoniczny:
     - **Granica wejścia (Import / Schema / UI Actions):** `Fail-Fast` z jasnym komunikatem błędu ([validateFeatureType](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L43)).
     - **Silnik geometrii (Mesh Engine):** `Graceful Degradation` — zalogowanie `console.warn`, pominięcie uszkodzonej cechy i poprawne wyrenderowanie całej reszty mebla.

---

## 2. Wykonane Zmiany w Kodzie

### 1. Pełny Feature-Preserving Bevel dla Wszystkich 6 Ścian Formatki
- [mesh_builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/mesh_builder.ts):
  - **Ścieżka szybka (zero narzutu):** Jeśli formatka nie ma zdefiniowanych obróbek (`features.length === 0`), generowany jest czysty `BeveledBox`.
  - **Lica główne (`FACE_Z_PLUS`, `FACE_Z_MINUS`):**
    - Wierzchołki podstawy górnej i dolnej (`box.top` oraz zorientowane CCW `box.bottom`) są rzutowane na płaszczyznę ściany przez [local3DToFaceUV](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts#L34).
    - Triangulacja z wycinaniem otworów i wpustów realizowana jest przez [buildFaceMeshWithFeatures](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L267).
  - **Ściany boczne (`FACE_X_PLUS`, `FACE_X_MINUS`, `FACE_Y_PLUS`, `FACE_Y_MINUS`):**
    - Zdefiniowano zorientowane czworokąty 3D CCW dla każdego boku.
    - Jeśli ściana boczna nie zawiera cech ani wylotów wpustów (`extraHoles2D`), zwracany jest szybki quad `box.sides[edgeKey]`.
    - Jeśli ściana boczna **zawiera obróbki** (np. nawierty pod kołki na boku płyty z fazowanym podchwytem, lub wylot wpustu pleców):
      - Zamiast rzutu na płaszczyznę ortogonalną nominalną $x = \pm W/2$ (który spłaszczał fazę 45° do 0/5 mm), wyliczana jest **naturalna baza ortonormalna bezpośrednio z czworokąta 3D** (`p0`, `uAxis` wzdłuż krawędzi, `normal` płaszczyzny fazy, `vAxis`).
      - Dzięki temu wierzchołki ściany bocznej i nawiertu po rekonstrukcji w 3D zachowują **pełną rozpiętość fazy (18 mm w osi X)**.
      - **Rozdzielenie bazy geometrycznej od interpretacji parametrów cechy (Kluczowa poprawka pozycji otworu)**:
        - Parametry $(u, v)$ z UI/modelu są wyznaczane w nominalnym układzie ściany ([computeFaceData](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts#L6)).
        - Punkt nominalny $p_{\text{nominal}}$ jest rzutowany wzdłuż normalnej ściany na rzeczywistą płaszczyznę fazy $p_{\text{surface}}$, a następnie transformowany do bazy $(u', v')$ czworokąta.
        - Gwarantuje to, że **otwór leży dokładnie w miejscu wskazanym przez użytkownika (identyczne współrzędne Y i Z)**, leżąc jednocześnie idealnie w płaszczyźnie 45° w osi X, a głębokość wiercenia podąża za normalną fazy.
  - Wszystkie siatki B-rep operacji (`featureMeshes`) są dołączane do obiektu formatki, a krawędzie B-rep są zasilane przez [appendFeatureEdges](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L443) z przekazaniem `sideFaceDataMap`.

### 2. Graceful Degradation w Silniku Renderującym
- [cap-machining.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts):
  - W funkcjach `buildFaceMeshWithFeatures`, `collectExtraHoles2D` oraz `appendFeatureEdges` nieobsługiwane typy cech logują precyzyjny `console.warn` z ID cechy i typem, po czym są bezpiecznie pomijane (`continue`).
  - Gwarantuje to brak awarii renderowania w Babylon.js i brak czarnego ekranu.

### 3. Walidacja Wejściowa (Fail-Fast) i Uszczelnienie Schematu
- [project-schema.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts):
  - Wyeksportowano stałą `SUPPORTED_FEATURE_TYPES = ['hole', 'groove'] as const`.
  - Dodano funkcje walidujące:
    - `validateFeatureType(feat)`: rzuca błąd w przypadku nieznanego lub niewspieranego typu cechy.
    - `validatePanelFeatures(features)`: walidacja tablicy cech formatki przy wczytywaniu/imporcie projektu.

---

## 3. Pokrycie Testami Automatycznymi

### 1. Testy Bevel + Features na Licach i Krawędziach Bocznych
- [edge-bevel.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/__tests__/edge-bevel.test.ts):
  - Test 1: Zachowanie otworów puszkowych i wpustów na licu `FACE_Z_PLUS` formatki ze ścięciem 45°.
  - Test 2: Zachowanie nawiertów pod kołki/konfirmaty na ścianie bocznej `FACE_X_PLUS` formatki z fazowanym podchwytem `+Y`.
  - Test 3: Weryfikacja geometryczna — zachowanie pełnej rozpiętości 18 mm w osi X w 3D dla ściany fazowanej z otworem (eliminacja spłaszczenia fazy).
  - Test 4: **Niezmiennik pozycjonowania otworu** — środek otworu na ścianie fazowanej 45° zachowuje bit-identyczne współrzędne Y i Z jak na ścianie płaskiej 0° ([100, -10, 3] -> [94, -10, 3]).

### 2. Testy Walidatora i Bezpiecznej Degradacji
- [cap-machining-failfast.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/__tests__/cap-machining-failfast.test.ts):
  - Test 1: `validateFeatureType` rzuca czytelny błąd przy próbie użycia typu `fillet`.
  - Test 2: `validatePanelFeatures` rzuca błąd przy nieznanym typie `pocket`.
  - Test 3: `buildMeshFromPanel` stosuje graceful degradation (loguje `console.warn`, nie crashuje i poprawnie buduje resztę geometrii panelu).

---

## 4. Wyniki Bramki Weryfikacyjnej (`npm run verify`)

```bash
npm run verify
```

Wynik:
```
1. Typecheck:
   tsc --noEmit -> 0 błędów.

2. Testy jednostkowe (Vitest):
   Test Files: 151 passed (151)
   Tests:      1003 passed (1003)
   Duration:   32.25s

3. Audyt Kontraktowy (audit-display-name-logic.mjs):
   - MATCH-BY-NAME:             0 naruszeń
   - ROLE-FALLBACK-NAME:        0 naruszeń
   - NAME-FALLBACK-LITERAL:     raportowane 9 miejsc w warstwie UI/raportów (OK)
   - LEGACY-PARAM-ALIAS:        0 naruszeń
   - CORNER-DOORS-LEGACY:       0 naruszeń
   - BLOKI-MODULE-LEGACY:       0 naruszeń
   - UNIT-GUESS:                0 naruszeń
   - FACE-ALIAS:                0 naruszeń
   - BLOKI-DIMS:                0 naruszeń
   - DEAD-API:                  0 naruszeń
   - ZERO-SMARTBOX:             0 naruszeń
   EXIT CODE: 0
```

---

## 5. Dalsza Mapa Drogowa Uszczelniania B-rep (Krok 3)

1. **Determinizm tożsamości krawędzi i wierzchołków dla PMI**:
   - Zastąpienie pary `edgeKey + subIndex` w [pmi-id-bridge.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts) unikalnymi identyfikatorami topologicznymi wierzchołków.
2. **Topologiczne pętle ścian (`outerLoop`)**:
   - Rozbudowa [topology.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts) o zorientowane krawędzie CCW (half-edges), ułatwiające operacje przycinania i offsetu.
