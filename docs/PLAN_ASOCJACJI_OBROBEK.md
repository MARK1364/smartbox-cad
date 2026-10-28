# Plan Architektoniczny: Deklaratywno-Asocjacyjny Model Obróbek (`drivenBy` + `rule`)

## 1. Wstęp i Cel Architektoniczny

Aktualnie formatki przechowują operacje obróbcze (`PanelModel.features[]`) z wyliczonymi współrzędnymi geometrycznymi na licu ściany:
```json
"u": 563,
"v": 2046
```
Wartości `u` i `v` są **wynikiem chwilowej ewaluacji geometrii**, a nie samą definicją relacji. Wprawdzie w parametrach istnieją pomocnicze pola `sourcePartId` i `sourceContainerId`, jednak struktura ta nie separuje czystej intencji asocjacyjnej od danych wykonawczych.

### Cel reformy:
1. **Wprowadzenie czystej intencji asocjacyjnej** na poziomie obiektu cechy:
   - `drivenBy`: wskaźnik na tożsamość węzła źródłowego (`nodeId`, `role`, `partKey`, `containerId`),
   - `rule`: semantyczny kod reguły obróbczej (np. `shelf_pin`, `mount_plate`, `cup`).
2. **Zachowanie kompatybilności wykonawczej**: pola `u`, `v`, `diameter`, `depth` (oraz ich odpowiedniki `*_mm`) w `params` pozostają jako bezpośrednie dane wykonawcze dla postprocesorów CNC, generatorów G-kodu, nestingu i wizualizacji 3D.
3. **Ścisła zgodność z zasadami `AGENTS.md`**:
   - Brak dopasowywania po nazwach wyświetlanych (`name`).
   - Identyfikacja wyłącznie po `nodeId` (UUID węzła) i kodzie `role`.

---

## 2. Kluczowe Rozstrzygnięcia Architektoniczne

### A. Zakres: Kontrakt Cechy Formatki, a nie Nowy Format Projektu
- **SSOT serializacji**: Zapis projektu `.spp.json` realizowany jest przez `ProjectDocument._serializeNode()` oraz `PanelModel.toJSON()`.
- `PanelModel.toJSON()` oraz `fromJSON()` kopiują i odtwarzają tablicę `features` z zachowaniem wszystkich pól obiektu cechy:
  ```ts
  // toJSON()
  features: this.features.map(f => ({ ...f, params: { ...f.params } }))
  // fromJSON()
  this.features = data.features.map((f: any) => ({ ...f, params: { ...(f.params || {}) } }))
  ```
  Oznacza to, że pola `drivenBy` i `rule` umieszczone na głównym poziomie obiektu cechy przechodzą przez serializację i deserializację w 100% transparentnie bez naruszania architektury dokumentu.
- **Uwaga dotycząca schematów**: Starszy plik `project-schema.ts` opisuje historyczny format interchange i **nie jest** traktowany jako SSOT dla formatu `.spp.json`.

### B. Rozstrzygnięcie Jednostek (SSOT Units)
Zgodnie z regułami `AGENTS.md`:
- **Wymiary domeny bryły** (`CADNode.domainData`, `PanelModel.width/height/thickness`) są w **nanometrach (nm)**.
- **Współrzędne cech obróbczych formatki** (`params.u`, `params.v`, `params.diameter`, `params.depth` oraz ich aliasy `*_mm`) są **zawsze w milimetrach (mm)** w lokalnym 2D układzie współrzędnych danej ściany formatki (LCS face).
- Wyjaśnienie: `PanelModel.getFace(name)` przelicza wymiary płyty na mm przed wyznaczeniem układu ściany, a moduł CAM (`C1_cnc`) i postprocesory czytają wartości `u`/`v` bezpośrednio w milimetrach. Pola cech obróbczych są więc formalnie zdefiniowane jako wielkości w **mm** i nie wymagają konwersji wewnątrz `features`.

### C. Granica Parametryczności i Cykl Reewaluacji
Samo pole `drivenBy` jest deklaratywnym opisem relacji. Mechanizm reewaluacji współrzędnych po zmianie elementu źródłowego opiera się na istniejącej infrastrukturze zdarzeniowej:
1. **Wyzwalanie reewaluacji**: Zmiana parametrów modułu (np. wysokości półki, odsunięcia zawiasów, liczby szuflad) wyzwala polecenie synchronizacji intencji (`syncMachiningIntents()` / `RebuildBayBlokiCommand`).
2. **Generowanie zaktualizowanych współrzędnych**: Buildery intencji przeliczają nowe wartości `u` i `v` [mm], zachowując to samo powiązanie `drivenBy` oraz deterministyczne ID cechy.
3. **Detekcja osieroconych obróbek (Orphan Detection)**:
   - Dzięki `drivenBy.nodeId` system może w łatwy sposób sprawdzić spójność: czy węzeł źródłowy nadal istnieje w dokumencie.
   - W przypadku usunięcia konkretnego okucia/półki (zamiast całego kontenera) polecenie czyszczące usuwa precyzyjnie tylko te obróbki, dla których `feature.drivenBy?.nodeId === removedNodeId`.

### D. Kopiowanie i Remapowanie Referencji (`duplicateCADNode`)
Przy duplikowaniu węzłów (np. kopiowanie szafki lub wnęki przez `ProjectDocument.duplicateCADNode()`):
- Klonowane dzieci otrzymują nowe identyfikatory (`newId`).
- **Wymagane rozszerzenie w `duplicateCADNode()`**:
  1. Krok 1: Wygenerowanie mapy podmiany identyfikatorów `idMap = Map<oldNodeId, newNodeId>` dla całego kopiowanego poddrzewa.
  2. Krok 2: Rekurencyjne przejście po cechach sklonowanych formatek i remapowanie referencji:
     - Jeśli `f.drivenBy?.nodeId` znajduje się w `idMap`, podmieniamy na nowy identyfikator sklonowanego elementu.
     - Jeśli `f.drivenBy?.containerId` znajduje się w `idMap`, podmieniamy na nowe ID sklonowanego kontenera.
     - Podobnie aktualizowane są pomocnicze pola w `params`: `sourceContainerId` i `sourcePartId`.
  Dzięki temu sklonowana szafka nie wskazuje na okucia z pierwotnego mebla.

### E. Punkt Emisji `drivenBy`: Bezpośrednio w Builderach Intencji (Upstream)
- Buildery intencji (`04_shelves-drilling-builder.ts`, `05_doors-drilling-builder.ts`, `09_drawers-drilling-builder.ts`, `handles/handle-drilling.ts`, itp.) mają bezpośredni dostęp do węzła modułu (`sbNode.id` / `container.id`) oraz identyfikatorów części (`hingeNodeId`, `shelfNodeId`, `handleId`).
- Dlatego obiekt `drivenBy` jest przypisywany **bezpośrednio w builderach** w momencie tworzenia intencji (`buildHoleMachiningIntent`).
- Adapter (`smartframe-adapter.ts`) pełni jedynie rolę aplikacyjną (lub weryfikacyjną), bez konieczności odgadywania tożsamości węzłów ex-post.

---

## 3. Standard Kontraktu DTO (SSOT)

W pliku `A2_bloki/01_machining-intent.ts` wprowadzamy definicje:

```ts
/**
 * Wskaźnik asocjacyjny na element napędzający obróbkę.
 */
export interface MachiningDrivenBy {
    /** Unikalne ID węzła źródłowego w drzewie CADNode (np. "panel_11", "hw_hinge_123") */
    nodeId: string;
    /** Kod taksonomii roli bryły sterującej (np. 'SHELF_PANEL', 'FRONT', 'HARDWARE') */
    role: string;
    /** Typ okucia, jeśli bryłą sterującą jest okucie (np. 'HINGE', 'SHELF_PIN', 'DRAWER_SLIDE', 'HANDLE') */
    hardwareType?: string;
    /** Logiczny klucz części w planie modułu (np. 'Polka_1', 'Hinge_L6') */
    partKey?: string;
    /** ID nadrzędnego kontenera bloku generującego */
    containerId?: string;
}

/**
 * Znormalizowany katalog reguł obróbczych w systemie.
 */
export type MachiningRule =
    | 'shelf_pin'        // Otwory w boku korpusu pod podpórkę półki
    | 'shelf_socket'     // Otwory montażowe w samej półce
    | 'mount_plate'      // Otwory w boku korpusu pod prowadnik zawiasu
    | 'cup'              // Puszka zawiasu fi35 we froncie
    | 'screw'            // Wkręty montażowe puszki zawiasu we froncie
    | 'drawer_runner'    // Otwory pod prowadnicę szuflady
    | 'flap_bracket'     // Otwory podnośnika klapy
    | 'handle_hole'      // Otwory przelotowe pod uchwyt meblowy
    | 'back_groove'      // Wpust pod plecy szafki
    | 'led_channel';     // Rowek pod profil LED

export interface MachiningHoleFeature {
    id: string;
    type: 'hole';
    face: MachiningFace;
    side?: MachiningFace;
    name?: string;
    /** Relacja asocjacyjna */
    drivenBy?: MachiningDrivenBy;
    /** Reguła semantyczna */
    rule?: MachiningRule;
    /** Kompatybilne parametry wykonawcze (wszystkie wymiary w mm) */
    params: MachiningHoleParams;
}
```

### Przykładowy format w JSON projektu (`.spp.json`):

```json
{
  "id": "hinge_plate_l_6_Prowadnik_otw_D",
  "type": "hole",
  "face": "FACE_Z_PLUS",
  "side": "FACE_Z_PLUS",
  "drivenBy": {
    "nodeId": "container_1792428023985_5_35376_hinge_left_6",
    "role": "HARDWARE",
    "hardwareType": "HINGE",
    "partKey": "Hinge_L6",
    "containerId": "container_1792428023985_5_35376"
  },
  "rule": "mount_plate",
  "params": {
    "u": 563,
    "v": 2046,
    "u_mm": 563,
    "v_mm": 2046,
    "diameter": 5,
    "diameter_mm": 5,
    "depth": 12,
    "depth_mm": 12,
    "template_id": "BLUM_110_STANDARD",
    "isDoorDrilling": true,
    "sourceContainerId": "container_1792428023985_5_35376",
    "sourcePartId": "Hinge_L6"
  }
}
```

---

## 4. Etapy Realizacji (Milestones)

- [x] **Etap 1: Kontrakt DTO i Helpery**:
  - Rozbudowa typów w `A2_bloki/01_machining-intent.ts` (`MachiningDrivenBy`, `MachiningRule`, opcjonalne pola na poziomie `MachiningFeature` oraz w `HoleMachiningIntentOptions` / `GrooveMachiningIntentOptions`).
  - Helper `buildHoleMachiningIntent` i `buildGrooveMachiningIntent` transparentnie przenoszą `drivenBy` i `rule`.
- [x] **Etap 2: Aktualizacja Builderów Intencji w `A2_bloki/` (Emisja Upstream)**:
  - `04_shelves-drilling-builder.ts`: przypisanie `rule: 'shelf_pin'`, `drivenBy` z ID półki / kontenera oraz `rule: 'shelf_socket'` dla otworów półki.
  - `05_doors-drilling-builder.ts`: przypisanie `rule: 'mount_plate'`, `drivenBy` z ID zawiasu / kontenera.
  - `05_doors-engine.ts`: przypisanie `rule: 'cup'` i `rule: 'screw'` na froncie.
  - `09_drawers-drilling-builder.ts`: przypisanie `rule: 'drawer_runner'`, `drivenBy` z ID prowadnicy / kontenera.
  - `12_flaps-engine.ts` & `12_flaps-drilling-builder.ts`: przypisanie `rule: 'flap_bracket'`, `rule: 'cup'`, `rule: 'screw'`.
  - `handles/handle-drilling.ts`: przypisanie `rule: 'handle_hole'`, `drivenBy` z ID uchwytu.
- [x] **Etap 3: Remapowanie Referencji przy Kopiowaniu (`ProjectDocument`)**:
  - Rozbudowa metody `duplicateCADNode()` w `A1_core/project-document.ts`: dwufazowe klonowanie z mapą `idMap = Map<oldId, newId>` i remapowaniem `drivenBy.nodeId`, `drivenBy.containerId` oraz parametrów pomocniczych w cechach klonowanych paneli.
- [x] **Etap 4: Testy i Weryfikacja**:
  - Test jednostkowy `A2_bloki/__tests__/machining-association.test.ts` weryfikujący `drivenBy`, `rule`, serializację `PanelModel` i remapowanie w `duplicateCADNode`.
  - Pełna bramka `npm run verify` przeszła bezbłędnie (197 test files / 1351 tests passed, 0 typecheck errors, 0 audit violations).
