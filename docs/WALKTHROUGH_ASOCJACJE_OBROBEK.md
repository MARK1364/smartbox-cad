# Walkthrough: Deklaratywno-Asocjacyjny Model Obróbek (`drivenBy` + `rule` + `generatedBy`)

Niniejszy dokument przedstawia całościowy przegląd wdrożonego systemu asocjacji obróbek dla modułów CAD/CAM (`A2_bloki`), ze szczególnym uwzględnieniem pełnego przepływu End-to-End dla okuć zawiasowych drzwi, obsługi siatki System 32 oraz wprowadzenia kanonicznej trójcy semantycznej (`rule`, `generatedBy`, `drivenBy`).

---

## 1. Problem Wyjściowy i Zmiana Paradygmatu

Dotychczas formatki zapisywały otwory i obróbki (`features[]`) z wyliczonymi na sztywno współrzędnymi geometrycznymi:
```json
// PRZED: sam wynik chwilowej ewaluacji geometrii
{
  "id": "hinge_plate_l_1_Prowadnik_otw_D",
  "type": "hole",
  "face": "FACE_Z_MINUS",
  "params": {
    "u": 37,
    "v": 100,
    "diameter": 5,
    "depth": 12,
    "isDoorDrilling": true
  }
}
```
Wartości `u: 37` i `v: 100` były jedynie **wynikiem obliczeń**, a nie definicją relacji:
- Brak było jawnej informacji, **który element** (konkretny węzeł okucia) wymusił powstanie otworu.
- Brak było jawnej informacji, **kto stworzył** cechę (który moduł meblowy odpowiada za jej cykl życia).
- Przy kopiowaniu mebla formatka powielała referencje lub traciła powiązanie z okuciem.
- Cechy w boku korpusu (prowadnik) i we froncie (puszka zawiasu) nie miały wspólnego mianownika wskazującego na to samo okucie fizyczne.

---

## 2. Nowa Architektura: Trójca Semantyczna + Dane Wykonawcze

W modułach objętych wdrożeniem cechy obróbek otrzymują tożsamość relacyjną na głównym poziomie cechy (`rule`, `generatedBy` oraz `drivenBy`), zachowując wstecznie kompatybilne parametry wykonawcze w `params`:

```json
// PO: Trójca semantyczna (rule + generatedBy + drivenBy) + parametry wykonawcze w params
{
  "id": "hinge_plate_l_1_Prowadnik_otw_D",
  "type": "hole",
  "face": "FACE_Z_MINUS",
  "side": "FACE_Z_MINUS",

  "rule": "mount_plate",
  "generatedBy": "blok_doors",

  "drivenBy": {
    "nodeId": "container_doors_123_hinge_left_1",
    "role": "HARDWARE",
    "hardwareType": "HINGE",
    "partKey": "Hinge_L1",
    "containerId": "container_doors_123"
  },

  "params": {
    "u": 37,
    "v": 100,
    "u_mm": 37,
    "v_mm": 100,
    "diameter": 5,
    "diameter_mm": 5,
    "depth": 12,
    "depth_mm": 12,
    "isDoorDrilling": true,
    "sourceContainerId": "container_doors_123",
    "sourcePartId": "Hinge_L1"
  }
}
```

### Trójca Semantyczna (Pola Opcjonalne w Kontrakcie):
1. **`rule`** (*Co to jest?*): Semantyczny kod operacji (`'shelf_pin'`, `'cup'`, `'screw'`, `'mount_plate'`, `'drawer_runner'`). Umożliwia natychmiastowe filtrowanie np. wszystkich otworów pod podpórki półek bez analizy średnicy czy współrzędnych.
2. **`generatedBy`** (*Kto to stworzył?*): Kanoniczny identyfikator modułu/generatora odpowiedzialnego za powstanie cechy. Dozwolone wartości: `'blok_doors'`, `'blok_shelves'`, `'blok_drawers'`, `'blok_flaps'`, `'blok_handles'` oraz `'blok_led'` (zarezerwowane dla planowanej migracji LED; nie jest jeszcze emitowane).
3. **`drivenBy`** (*Co tym steruje?*): Dokładna tożsamość węzła źródłowego w drzewie sceny (`nodeId`, `role`, `partKey`, `containerId`).
4. **`params`** (*Warstwa wykonawcza i zgodności*): Współrzędne geometryczne dla CNC i renderera oraz historyczne pola `sourcePartId` i `sourceContainerId` zachowane jako warstwa legacy compatibility.

> [!NOTE]
> **Zasada opcjonalności i zakresu**: Pola `rule`, `generatedBy` oraz `drivenBy` są w kontrakcie DTO ściśle **opcjonalne**. Metadane są emitowane przez opisane niżej, zintegrowane ścieżki builderów; nie oznacza to automatycznej migracji wszystkich wariantów i starszych generatorów danego modułu. Cechy bez tych metadanych, w tym aktualne wpusty LED, pozostają poprawne. Helpery umożliwiają ich przekazanie i propagację, ale nie nadają ich samodzielnie wszystkim cechom formatki.

---

## 3. Zrealizowane Komponenty i Zmiany w Kodzie

### A. Kontrakt DTO ([`A2_bloki/01_machining-intent.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts))
- **`MachiningHoleFeature` i `MachiningGrooveFeature`**:
  ```ts
  export interface MachiningHoleFeature {
      id: string;
      type: 'hole';
      face: MachiningFace;
      side?: MachiningFace;
      name?: string;
      rule?: MachiningRule;        // Opcjonalne: co to za obróbka ('mount_plate', 'cup', 'shelf_pin')
      generatedBy?: MachiningGeneratorId; // Opcjonalne: kanoniczny identyfikator modułu emitującego
      drivenBy?: MachiningDrivenBy; // Opcjonalne: co nią steruje (węzeł NodeType.HARDWARE lub PART)
      params: MachiningHoleParams;
  }
  ```
- **`MachiningDrivenBy`**:
  ```ts
  export interface MachiningDrivenBy {
      nodeId: string;        // ID węzła w drzewie CADNode (np. węzeł NodeType.HARDWARE okucia lub PART półki)
      role: string;          // Kod roli bryły sterującej ('HARDWARE', 'SHELF_PANEL', 'SYSTEM_HOLES')
      hardwareType?: string; // Kategoria okucia ('HINGE', 'DRAWER_SLIDE', 'HANDLE')
      partKey?: string;      // Logiczny klucz części w planie ('Polka_1', 'Hinge_L1', 'System_32')
      containerId?: string;  // ID nadrzędnego kontenera bloku generującego
  }
  ```
- **`MachiningRule`**:
  ```ts
  export type MachiningRule =
      | 'shelf_pin'        // Podpórki półek w bokach korpusu (oraz siatka System 32)
      | 'shelf_socket'     // Gniazda montażowe w samej półce
      | 'mount_plate'      // Prowadniki zawiasów w bokach korpusu
      | 'cup'              // Puszka zawiasu fi35 we froncie
      | 'screw'            // Wkręty montażowe puszki zawiasu we froncie
      | 'drawer_runner'    // Prowadnice szuflad
      | 'flap_bracket'     // Podnośniki klap
      | 'handle_hole'      // Otwory przelotowe pod uchwyt
      | 'back_groove'      // Wpust pod plecy
      | 'led_channel';     // Profil LED
  ```
- **`MachiningGeneratorId`**:
  ```ts
  export type MachiningGeneratorId =
      | 'blok_doors'
      | 'blok_shelves'
      | 'blok_drawers'
      | 'blok_flaps'
      | 'blok_handles'
      | 'blok_led'; // kanoniczna nazwa dla planowanej migracji LED
  ```
- **Rola helperów budujących intencje**:
  Helpery `buildHoleMachiningIntent` oraz `buildGrooveMachiningIntent` umożliwiają przekazanie metadanych (`rule`, `generatedBy`, `drivenBy`) i **propagują je do obiektu wynikowej cechy wyłącznie wtedy, gdy zostały jawnie podane przez wywołujący moduł/builder**.
  Helpery **nie nadają tych pól samodzielnie wszystkim cechom** w systemie. Metadane otrzymują cechy z opisanych ścieżek builderów; nie jest to gwarancja pokrycia wszystkich wariantów ani starszych generatorów danego modułu. Wpusty LED nie przekazują jeszcze metadanych, a `'blok_led'` jest ustaloną nazwą dla przyszłej integracji, nie aktualnie emitowaną wartością.

---

### B. Pełny Przepływ End-to-End dla Zawiasów Drzwi

Zrealizowano i przetestowano pełne spięcie tożsamości zawiasu od silnika funkcyjnego, przez adapter, aż po builder nawierceń korpusu:

1. **Silnik Drzwi (`05_doors-engine.ts`)**:
   - Wylicza pozycje zawiasów oraz cechy frontu (`rule: 'cup'`, `rule: 'screw'`).
   - Ustawia `generatedBy: 'blok_doors'` oraz wskazuje na lokalny identyfikator okucia `partKey: 'Hinge_L1'` i `nodeId: 'hinge_left_1'`.
2. **Adapter Domeny (`smartframe-adapter.ts`)**:
   - Rejestruje rzeczywiste węzły `NodeType.HARDWARE` w drzewie projektu z pełnym, unikalnym ID:
     `hwFullId = ${container.id}_${hw.id}` (np. `${container.id}_hinge_left_1`).
   - W funkcji `assignPlanFeatures` prefixuje `drivenBy.nodeId` cech frontu identyfikatorem kontenera, tak aby wskazywały na `hwFullId`.
3. **Builder Nawierceń Korpusu (`05_doors-drilling-builder.ts`)**:
   - Generuje otwory pod prowadniki (`rule: 'mount_plate'`) w boku korpusu.
   - Ustawia `generatedBy: 'blok_doors'` oraz `drivenBy.nodeId = ${sbNode.id}_hinge_left_${hinge.index}`.
4. **Jednoznaczna Tożsamość w Drzewie Sceny**:
   - Otwory w boku korpusu i otwory we froncie drzwi mają **identyczny** `drivenBy.nodeId`.
   - Wywołanie `doc.findNode(feature.drivenBy.nodeId)` zwraca dokładnie ten sam węzeł `NodeType.HARDWARE`.

---

### C. Stan Poszczególnych Modułów (Stopniowy Zakres Prac)

| Moduł | Status wdrożenia | `rule` | `generatedBy` | Źródło powiązania (`drivenBy`) |
|---|---|---|---|---|
| **Drzwi (Zawiasy)** | **Pełne E2E** | `mount_plate`, `cup`, `screw` | `blok_doors` | `nodeId`: Węzeł `NodeType.HARDWARE` (`${container.id}_hinge_left_i`), `role: 'HARDWARE'` |
| **Półki (Formatka)** | Częściowe | `shelf_socket` | `blok_shelves` | `nodeId`: ID węzła formatki półki (`role: 'SHELF_PANEL'`) |
| **Półki (Boki / Przegrody)** | Zintegrowany builder dla obsługiwanych ścieżek; pozostałe warianty wymagają osobnej weryfikacji | `shelf_pin` | `blok_shelves` | `nodeId`: ID węzła formatki półki (`role: 'SHELF_PANEL'`) dla stałych półek |
| **Półki (System 32)** | Zintegrowany builder | `shelf_pin` | `blok_shelves` | `nodeId`: Węzeł kontenera bloku, `role: 'SYSTEM_HOLES'`, `partKey: 'System_32'`. Siatka otworów nie posiada węzłów 3D pojedynczych kołków |
| **Szuflady** | Asocjacja buildera domknięta; test wskazuje rzeczywiste węzły prowadnic L/P | `drawer_runner` | `blok_drawers` | `nodeId`: `${container.id}_drawer_${i}_rail_L/R`, `role: 'HARDWARE'` |
| **Klapy** | Asocjacja buildera domknięta; test wskazuje rzeczywiste węzły zawiasów klapy | `flap_bracket`, `cup`, `screw` | `blok_flaps` | `nodeId`: `${container.id}_hinge_hinge_${side}` (np. `_hinge_hinge_bl`), `role: 'HARDWARE'` |
| **Uchwyty** | Asocjacja buildera domknięta; test wskazuje rzeczywisty węzeł `HARDWARE` uchwytu | `handle_hole` | `blok_handles` | `nodeId`: `hw_${container.id}`, `role: 'HARDWARE'` |
| **Wpusty LED** | Gotowy kontrakt / helper | `led_channel` | — | `buildGrooveMachiningIntent` umożliwia propagację pól, lecz moduły LED (`13_led-*`) nie przekazują jeszcze tych metadanych na obecnym etapie |

---

### D. Remapowanie Referencji przy Kopiowaniu Węzłów ([`A1_core/project-document.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts))

W metodzie `ProjectDocument.duplicateCADNode()` zaimplementowano dwuetapowe klonowanie:
1. **Faza 1 — Zbieranie mapy identyfikatorów (`idMap`)**:
   Rekurencyjne skanowanie poddrzewa i generowanie nowych ID dla wszystkich klonowanych węzłów (kontenery, formatki, okucia `NodeType.HARDWARE`).
2. **Faza 2 — Remapowanie referencji asocjacyjnych**:
   Przejście po wszystkich cechach sklonowanych płyt formatowych:
   ```ts
   if (feat.drivenBy?.nodeId && idMap.has(feat.drivenBy.nodeId)) {
       feat.drivenBy.nodeId = idMap.get(feat.drivenBy.nodeId)!;
   }
   if (feat.drivenBy?.containerId && idMap.has(feat.drivenBy.containerId)) {
       feat.drivenBy.containerId = idMap.get(feat.drivenBy.containerId)!;
   }
   if (feat.params?.sourceContainerId && idMap.has(feat.params.sourceContainerId)) {
       feat.params.sourceContainerId = idMap.get(feat.params.sourceContainerId)!;
   }
   ```
   **Efekt**: Zarówno bok korpusu, jak i front w sklonowanej szafce wskazują na ten sam nowo sklonowany węzeł zawiasu. Kopia jest w 100% hermetyczna.

---

## 4. Weryfikacja i Testy Automatyczne

### Zestaw Testów Asocjacji

1. **[`A2_bloki/__tests__/machining-association.test.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/machining-association.test.ts)** (Test jednostkowy):
   - `buildHoleMachiningIntent dołącza drivenBy, rule oraz generatedBy do cechy (jeśli zostały podane)` — **PASSED**
   - `PanelModel.toJSON() i fromJSON() transparentnie zachowują drivenBy, rule i generatedBy` — **PASSED**
   - `ProjectDocument.duplicateCADNode() remapuje referencje drivenBy.nodeId oraz containerId na nowe węzły i zachowuje generatedBy` — **PASSED**

2. **[`A2_bloki/__tests__/doors-hardware-association.test.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/doors-hardware-association.test.ts)** (Test integracyjny E2E):
   - Generowanie szafki z blokiem drzwi przez `update_bloki_core(sbContainer, doc)`.
   - Weryfikacja obecności węzłów `NodeType.HARDWARE` w drzewie (`${container.id}_hinge_left_1`).
   - Weryfikacja, że cechy puszki (`cup`) i wkrętów (`screw`) we froncie posiadają `drivenBy.nodeId === ${container.id}_hinge_left_1` oraz `generatedBy === 'blok_doors'`.
   - Weryfikacja, że cechy prowadnika (`mount_plate`) w boku korpusu posiadają `drivenBy.nodeId === ${container.id}_hinge_left_1` oraz `generatedBy === 'blok_doors'`.
   - Potwierdzenie, że `doc.findNode(cupFeature.drivenBy.nodeId)` i `doc.findNode(plateFeature.drivenBy.nodeId)` zwracają dokładnie ten sam węzeł zawiasu.
   - Klonowanie całej szafki przez `doc.duplicateCADNode()` i weryfikacja, że w sklonowanym meblu oba otwory wskazują na nowo utworzony sklonowany węzeł okucia, z zachowaniem `generatedBy`.

3. **[`A2_bloki/__tests__/shelves-drilling-builder.test.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/shelves-drilling-builder.test.ts)**:
   - Weryfikacja, że nawiercenia pod podpórki półek emitują `rule: 'shelf_pin'` oraz `generatedBy: 'blok_shelves'`.
   - Weryfikacja, że wzorzec `SYSTEM_32` emituje `role: 'SYSTEM_HOLES'`, `partKey: 'System_32'` oraz `generatedBy: 'blok_shelves'`.

4. **Testy asocjacji szuflad, klap i uchwytów**:
   - [`drawers-drilling-association.test.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/drawers-drilling-association.test.ts): `drivenBy.nodeId` wskazuje rzeczywiste węzły prowadnic L/P.
   - [`flaps-drilling-builder.test.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/flaps-drilling-builder.test.ts): `drivenBy.nodeId` wskazuje węzły zawiasów klapy.
   - [`handle-engine.test.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/handle-engine.test.ts): nawierty uchwytu wskazują węzeł `HARDWARE` (`hw_<containerId>`).

### Wynik Pełnej Bramki Weryfikacyjnej (`npm run verify`):
```text
> tsc --noEmit
  Exit code: 0 (0 błędów typowania w całym projekcie)

> vitest run
  Test Files: 200 passed (200)
  Tests:      1360 passed (1360)

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

## 5. Podsumowanie i Następne Kroki

1. **Docelowy standard i stopniowy zakres wdrożenia**:
   - Trójca semantyczna (`rule`, `generatedBy`, `drivenBy`) stanowi docelowy standard opisu intencji obróbczych i jest wprowadzana moduł po module.
   - **Opcjonalność pól**: Pola te są opcjonalne w strukturze cechy. Helpery `buildHoleMachiningIntent` oraz `buildGrooveMachiningIntent` umożliwiają ich przekazanie i propagują je do wynikowej cechy wyłącznie wtedy, gdy moduł wywołujący je poda. Helpery nie nadają ich automatycznie ani odgórnie wszystkim cechom.
   - **Stan faktyczny**: Metadane przekazują opisane ścieżki builderów drzwi, półek, szuflad, klap i uchwytów. Nie jest to deklaracja pełnego pokrycia wszystkich wariantów ani starszych generatorów tych modułów. Wpusty profilowe LED nie przekazują ich jeszcze; dla przyszłej integracji ustalono kanoniczne `generatedBy: 'blok_led'`.
2. **Kolejne kroki**:
   - Rozszerzenie pełnego wzorca tożsamości okucia na szuflady (`09_drawers-drilling-builder.ts` + unifikacja z adapterem prowadnic w drzewie).
   - Rozszerzenie wzorca na podnośniki klap (`12_flaps-drilling-builder.ts` + unifikacja z adapterem siłowników).
   - Przekazanie `drivenBy`, `rule: 'led_channel'` oraz `generatedBy: 'blok_led'` w silnikach LED przy generowaniu wpustów profilowych.
