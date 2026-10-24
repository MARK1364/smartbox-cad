# Podsumowanie Prac: Asocjacje Obróbek i Deduplikacja Wnęk

Dokument podsumowuje zmiany architektoniczne, refaktoryzacje oraz testy zrealizowane w projekcie CAD/CAM (`web/`), obejmujące wdrożenie **Deklaratywno-Asocjacyjnego Modelu Obróbek** oraz **Deduplikację Danych Wnęk (Lean SSOT)**.

---

## 1. Filar 1: Deklaratywno-Asocjacyjny Model Obróbek (`drivenBy` + `rule` + `generatedBy`)

### A. Problem Wyjściowy i Zmiana Paradygmatu
Dotychczas cechy obróbcze na formatkach (`features[]`) zapisywały wyłącznie chwilowe wyniki ewaluacji geometrii (np. `u: 37, v: 100, diameter: 5, depth: 12`). Skutkowało to:
- Brakiem tożsamości relacyjnej: otwór nie wiedział, jakie fizyczne okucie lub element go wymusił.
- Brakiem wspólnego mianownika: otwór pod prowadnik w boku korpusu i otwór pod puszkę zawiasu we froncie nie miały żadnego wspólnego identyfikatora okucia.
- Utratą spójności przy kopiowaniu szafki: duplikowanie mebla nie remapowało relacji z okuciem.

### B. Nowy Kontrakt DTO ([01_machining-intent.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts))
Wprowadzono kanoniczną trójcę semantyczną na głównym poziomie obiektów `MachiningHoleFeature` i `MachiningGrooveFeature`:
- **`rule`** (*Co to za obróbka?*): Semantyczny kod operacji (`mount_plate`, `cup`, `screw`, `shelf_pin`, `shelf_socket`, `drawer_runner`, `flap_bracket`, `handle_hole`, `back_groove`, `led_channel`). Umożliwia filtrowanie cech przez silniki i modele AI bez zgadywania po wymiarach.
- **`generatedBy`** (*Kto ją stworzył?*): Identyfikator modułu/generatora odpowiedzialnego za cykl życia cechy (`blok_doors`, `blok_shelves`, `blok_drawers`, `blok_flaps`, `blok_handles`).
- **`drivenBy`** (*Co nią steruje?*): Struktura `MachiningDrivenBy` przechowująca:
  - `nodeId`: ID węzła w drzewie sceny (okucie `NodeType.HARDWARE`, formatka `PART` lub kontener).
  - `role`: Kod roli bryły sterującej (`HARDWARE`, `SHELF_PANEL`, `SYSTEM_HOLES`).
  - `hardwareType`: Typ okucia (`HINGE`, `DRAWER_SLIDE`, `HANDLE`).
  - `partKey`: Logiczny klucz części w planie (`Hinge_L1`, `Polka_1`, `System_32`).
  - `containerId`: ID nadrzędnego kontenera bloku.
- **`params`**: Warstwa współrzędnych wykonawczych (w mm) dla CNC oraz pola wstecznej kompatybilności (`sourcePartId`, `sourceContainerId`).
- **Opcjonalność i rola helperów**: Pola trójcy są ściśle opcjonalne. Helpery `buildHoleMachiningIntent` i `buildGrooveMachiningIntent` umożliwiają ich przekazanie i propagują je do wynikowej cechy wyłącznie wtedy, gdy zostaną podane przez moduł wywołujący — nie nadają ich automatycznie ani odgórnie wszystkim cechom formatki.

### C. Pełny Przepływ End-to-End dla Zawiasów Drzwi
1. **Silnik Drzwi ([05_doors-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts))**:
   - Generuje cechy puszki (`cup`) i wkrętów (`screw`) we froncie z `generatedBy: 'blok_doors'`, wskazując na lokalny klucz zawiasu `hinge_left_i`.
2. **Adapter Domeny ([smartframe-adapter.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts))**:
   - Rejestruje węzły `NodeType.HARDWARE` w drzewie projektu z unikalnym ID: `${container.id}_hinge_left_${index}`.
   - W funkcji `assignPlanFeatures` prefixuje `drivenBy.nodeId` cech frontu ID kontenera, wskazując precyzyjnie na zarejestrowany węzeł okucia.
3. **Builder Nawierceń Korpusu ([05_doors-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-drilling-builder.ts))**:
   - Generuje otwory prowadników w boku korpusu (`mount_plate`) z `generatedBy: 'blok_doors'` oraz `drivenBy.nodeId = ${sbNode.id}_hinge_left_${index}`.
4. **Efekt**: Cechy w boku korpusu i we froncie drzwi wskazują na **ten sam węzeł okucia fizycznego**. `doc.findNode(feature.drivenBy.nodeId)` w obu przypadkach zwraca dokładnie ten sam węzeł zawiasu.

### D. Wzorzec Siatki System 32 w Półkach
W [04_shelves-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-drilling-builder.ts) otwory siatki System 32, które nie posiadają fizycznych modeli 3D pojedynczych kołków, otrzymały dedykowaną rolę:
`role: 'SYSTEM_HOLES'`, `partKey: 'System_32'` oraz `generatedBy: 'blok_shelves'`.

### E. Hermetyczne Klonowanie Mebli w Dokumencie
W [project-document.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L375-L425) metoda `duplicateCADNode()` implementuje 2-fazowe klonowanie:
1. Faza 1: Generowanie mapy nowych ID (`idMap`) dla wszystkich sklonowanych węzłów (kontenery, formatki, okucia `HARDWARE`).
2. Faza 2: Przejście po cechach sklonowanych płyt i przepisanie referencji: `drivenBy.nodeId`, `drivenBy.containerId` oraz `params.sourceContainerId`.
3. **Efekt**: Sklonowana szafka nie współdzieli referencji z oryginałem — otwory korpusu i frontu w nowym meblu wskazują na nowo sklonowane okucie.

---

## 2. Filar 2: Deduplikacja Danych Wnęk i Runtime Resolver (`boundary` / `detectedBay`)

### A. Diagnoza Problemu Redundancji
W plikach `.spp.json` w parametrach `generatorParams` każdego wstawionego bloku, modułu AGD oraz grupy zawieszek powielane były całe drzewa 6 ścian wnęki:
1. `generatorParams.boundary`: pełne obiekty `left`, `right`, `bottom`, `top`, `back`, `front` ze współrzędnymi i tożsamością formatek.
2. `generatorParams.detectedBay.boundary`: identyczna, dosłowna kopia całego obiektu `boundary`.
3. `generatorParams.customReferences`: trzecia reprezentacja ścian na potrzeby UI/gizma.

Powodowało to powielanie dziesiątek linii zbędnego JSON-a na każdy blok w projekcie.

### B. Wdrożenie Lean SSOT (Jedno Źródło Prawdy)
1. **Odchudzenie przy tworzeniu**:
   - W [02_bloki-bay-actions.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L510-L525) (`createBlokInDetectedBay`), [agd-bay-docking.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/agd-bay-docking.ts#L90-L105) oraz [hanger-apply.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L265-L275) do `generatorParams` przekazywany jest `slimDetectedBay` (bez zagnieżdżonego pola `boundary`).
   - `generatorParams.boundary` stanowi jedyne źródło prawdy (SSOT).
2. **Automatyczne oczyszczanie starszych projektów**:
   - W [container-model.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/container-model.ts#L44-L54) w metodzie `toJSON()` dodano sanityzację: jeśli w zapisywanym obiekcie występują jednocześnie `boundary` oraz `detectedBay.boundary`, duplikat w `detectedBay` jest usuwany przy serializacji, bez destrukcyjnej mutacji obiektu w pamięci.
   - Zakres oszczędności dotyczy usunięcia zduplikowanego bloku 6 ścian z każdego obiektu kontenera w JSON; całkowity zysk procentowy w skali pliku zależy od stopnia złożoności geometrii i liczby wkładów wnękowych w projekcie.

### C. Runtime Resolver Wnęki ([02_bloki-bay-detector.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L52-L115))
Wprowadzono czystą funkcję pomocniczą:
```ts
export function resolveDetectedBay(
    generatorParams: any,
    containerDimensionsNm?: { width: number; height: number; depth: number }
): DetectedBay | null;
```
- Jeśli `gp.detectedBay` jest odchudzony, resolver dowiązuje do niego `gp.boundary`.
- Jeśli `gp.detectedBay` w ogóle nie występuje, rekonstruuje kompletny obiekt `DetectedBay` w locie z `gp.boundary` i wymiarów kontenera.
- Zachowuje parametry skosów (`roofAngleDeg`, `heightLeftMm`, `heightRightMm`, `slopeAxis`).
- Gdy snapshot nie zawiera wysokości skosu LR, resolver wylicza je z `roofAngleDeg` i wymiarów wnęki (`heightLeftMm = h - (w/2)·tan α`, `heightRightMm = h + (w/2)·tan α`).

### D. Pełne Podłączenie Konsumentów Runtime
Wyeliminowano luki, w których kod czytał surowy obiekt `detectedBay` bez ścian:
1. **[hanger-apply.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L683-L695)**:
   Funkcja `updateSmartPartHangersGroup` wywołuje `resolveDetectedBay(gp)`, dzięki czemu `bayFrameFromDetectedBay(resolvedBay)` otrzymuje kompletny zestaw ścian wnęki.
2. **[01_bloki-ui.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx#L210-L220)**:
   Ścieżka migracji referencji ścian dla zawieszek używa `resolveDetectedBay(p)`, zapewniając bezbłędne odtworzenie `customReferences` (`xMin..zMax`).
3. **[FloatingAgdEdit.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/src/floating-edit/FloatingAgdEdit.tsx#L46-L56)**:
   Ujednolicono migrację `customReferences` dla modułów AGD za pomocą `resolveDetectedBay(gp)`.
4. **[container-view.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L149-L156)**:
   Wizualizacja skosów korpusu odczytuje wnękę przez `resolveDetectedBay(gp)`.
5. **[01_bloki-ui.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx) oraz [BlokiFloatingWindow.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/ui/BlokiFloatingWindow.tsx)**:
   Podświetlenie wnęki (`highlightBayInScene`) otrzymuje pełny obiekt z `resolveDetectedBay`, więc nie wymaga surowego `detectedBay` ani nie gubi ścian.
6. **[02_bloki-ref-plane-hint.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts)**:
   Podpowiedzi płaszczyzn referencyjnych czytają kąt i oś skosu z rozwiązanego obiektu wnęki.

---

## 3. Zestaw Testów Automatycznych

1. **Testy tożsamości i asocjacji obróbek**:
   - [machining-association.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/machining-association.test.ts) (3 testy): propagacja metadanych przez helpery, serializacja `PanelModel.toJSON()`, klonowanie w `duplicateCADNode()`.
   - [doors-hardware-association.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/doors-hardware-association.test.ts) (1 test): pełny przepływ E2E szafki z drzwiami, wspólne wskazanie prowadnika i puszki na ten sam węzeł `HARDWARE`, klonowanie.
   - [shelves-drilling-builder.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/shelves-drilling-builder.test.ts) (6 testów): weryfikacja `rule: 'shelf_pin'`, `generatedBy: 'blok_shelves'`, `role: 'SYSTEM_HOLES'` dla System 32.
   - [drawers-drilling-association.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/drawers-drilling-association.test.ts) (1 test): `drivenBy.nodeId` nawierceń szuflad wskazuje rzeczywisty węzeł prowadnicy L/P.

2. **Testy deduplikacji i przepływu runtime ([bay-deduplication.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/bay-deduplication.test.ts))** (7 testów):
   - Weryfikacja braku duplikatu `boundary` w `detectedBay` po utworzeniu bloku w `createBlokInDetectedBay`.
   - Weryfikacja odcięcia zduplikowanego pola przez `ContainerModel.toJSON()` przy zapisie starszych obiektów.
   - Weryfikacja rekonstrukcji `DetectedBay` ze zminimalizowanego snapshotu z zachowaniem kątów skosu.
   - Weryfikacja pełnej rekonstrukcji `DetectedBay` w sytuacji, gdy pole `detectedBay` w ogóle nie istnieje.
   - Weryfikacja przepływu UI: rekonstrukcja `customReferences` ze zminimalizowanego `generatorParams`.
   - Weryfikacja przepływu Hangers: wyznaczenie `bayFrame` i pomyślna aktualizacja w `updateSmartPartHangersGroup`.

---

## 4. Wyniki Bramki Weryfikacyjnej (`npm run verify`)

Polecenie zakończone kodem wyjścia `0`:
```text
> tsc --noEmit
  Exit code: 0 (0 błędów typowania w całym projekcie web/)

> vitest run
 Test Files: 200 passed (200/200)
 Tests:      1360 passed (1360/1360)

> node scripts/audit-display-name-logic.mjs
  MATCH-BY-NAME: 0
  ROLE-FALLBACK-NAME: 0
  LEGACY-PARAM-ALIAS: 0
  CORNER-DOORS-LEGACY: 0
  BLOKI-MODULE-LEGACY: 0
  UNIT-GUESS: 0
  FACE-ALIAS: 0
  BLOKI-DIMS: 0
  DEAD-API: 0
  ZERO-SMARTBOX: 0
  Naruszeń: 0 (Exit code: 0)
```

---

## 5. Zmodyfikowane i Utworzone Pliki

| Ścieżka pliku | Zakres zmian |
|---|---|
| [A2_bloki/01_machining-intent.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts) | Wprowadzenie `generatedBy`, rozszerzenie `rule` i `drivenBy`, propagacja w helperach intencji |
| [A2_bloki/05_doors-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts) | Emisja cech puszki i wkrętów z `rule`, `generatedBy` i lokalnym ID zawiasu |
| [A2_bloki/05_doors-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-drilling-builder.ts) | Generowanie nawierceń prowadników z `rule: 'mount_plate'` i wskazaniem na węzeł okucia |
| [A2_bloki/04_shelves-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-drilling-builder.ts) | Emisja `generatedBy: 'blok_shelves'`, `rule: 'shelf_pin'` oraz obsługa `role: 'SYSTEM_HOLES'` |
| [A2_bloki/09_drawers-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-drilling-builder.ts) | Emisja `generatedBy: 'blok_drawers'`, `rule: 'drawer_runner'` oraz `drivenBy.nodeId` wskazującego węzeł prowadnicy L/P |
| [A2_bloki/12_flaps-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-drilling-builder.ts) | Emisja `generatedBy: 'blok_flaps'`, `rule: 'flap_bracket'` oraz `drivenBy.nodeId` wskazującego węzeł zawiasu klapy |
| [A2_bloki/handles/handle-drilling.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-drilling.ts) | Emisja `generatedBy: 'blok_handles'`, `rule: 'handle_hole'` oraz `drivenBy.nodeId` wskazującego węzeł `HARDWARE` uchwytu (`hw_<containerId>`) |
| [A3_smartframe/smartframe-adapter.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts) | Rejestracja węzłów `HARDWARE` z ID kontenera oraz remapowanie cech frontu w `assignPlanFeatures` |
| [A1_core/project-document.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts) | Remapowanie referencji asocjacyjnych (`drivenBy.nodeId`, `containerId`) w `duplicateCADNode()` |
| [A2_bloki/02_bloki-bay-detector.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts) | Eksport typu `BayBoundary`, `SlimDetectedBay` oraz czystej funkcji `resolveDetectedBay()` |
| [A2_bloki/02_bloki-bay-actions.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts) | Zapisywanie odchudzonego `detectedBay` bez duplikatu `boundary` w `createBlokInDetectedBay` |
| [A6_agd/agd-bay-docking.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/agd-bay-docking.ts) | Zapisywanie odchudzonego `detectedBay` przy wstawianiu modułów AGD |
| [A2_bloki/hangers/hanger-apply.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts) | Zapisywanie odchudzonego `detectedBay` oraz podłączenie `resolveDetectedBay` w `updateSmartPartHangersGroup` |
| [A2_bloki/01_bloki-ui.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx) | Podłączenie `resolveDetectedBay` przy migracji `customReferences` oraz podświetleniu wnęki |
| [A2_bloki/ui/BlokiFloatingWindow.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/ui/BlokiFloatingWindow.tsx) | Podświetlenie wnęki przez `resolveDetectedBay` po zmianie modułu |
| [A2_bloki/02_bloki-ref-plane-hint.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts) | Odczyt kąta i osi skosu z rozwiązanego obiektu wnęki |
| [src/floating-edit/FloatingAgdEdit.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/src/floating-edit/FloatingAgdEdit.tsx) | Podłączenie `resolveDetectedBay` przy migracji `customReferences` dla AGD |
| [A3_smartframe/container-view.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts) | Odczyt wnęki przez `resolveDetectedBay` przy renderowaniu skosów korpusu |
| [A2_bloki/hangers/smartpart-bay-placement.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts) | Obsługa fallbacku ścian w `bayFrameFromDetectedBay` i `customReferencesFromDetectedBay` |
| [A1_core/container-model.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/container-model.ts) | Automatyczne usuwanie zduplikowanego `detectedBay.boundary` w `toJSON()` |
| [docs/WALKTHROUGH_ASOCJACJE_OBROBEK.md](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/docs/WALKTHROUGH_ASOCJACJE_OBROBEK.md) | Zaktualizowany dokument walkthrough z opisem kanonicznej trójcy i statusu wdrożenia |
| [A2_bloki/__tests__/doors-hardware-association.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/doors-hardware-association.test.ts) | Nowy test integracyjny E2E przepływu okuć zawiasowych drzwi |
| [A2_bloki/__tests__/machining-association.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/machining-association.test.ts) | Nowy test jednostkowy kontraktu asocjacji i klonowania |
| [A2_bloki/__tests__/bay-deduplication.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/bay-deduplication.test.ts) | Zestaw 7 testów jednostkowych i integracyjnych deduplikacji, resolvera runtime oraz wyliczania wysokości skosu |
| [A2_bloki/__tests__/drawers-drilling-association.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/drawers-drilling-association.test.ts) | Nowy test asocjacji nawierceń szuflad z węzłami prowadnic |
