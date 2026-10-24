# Walkthrough: Unifikacja Otworów Frontowych (Drzwi, Klapy, Drzwi Skośne i Narożne) przez `buildHoleMachiningIntent`

Dokument opisuje migrację tworzenia cech obróbczych puszki (`cup`) i wkrętów montażowych (`screw`) w silnikach:
- drzwi standardowych (`05_doors-engine.ts`),
- klap (`12_flaps-engine.ts`),
- drzwi skośnych (`06_skosne-doors-engine.ts`),
- drzwi narożnych (`07_corner-doors-engine.ts`),

do wspólnego punktu produkcji intencji obróbczych `buildHoleMachiningIntent` (`01_machining-intent.ts`).

---

## 1. Kontekst i Problem Wyjściowy

W architekturze modułów Bloki (`A2_bloki`) cechy obróbcze pod prowadniki zawiasów w bokach korpusu oraz podpórki półek były już budowane przez kanoniczny helper `buildHoleMachiningIntent()`. 

Jednak w silnikach frontowych:
- **`05_doors-engine.ts`** (`buildHingeFeatures`),
- **`12_flaps-engine.ts`** (`buildHingeFeatures`),
- **`06_skosne-doors-engine.ts`** (`buildHingeFeaturesForSide`),
- **`07_corner-doors-engine.ts`** (`buildHingeFeatures`),

otwory puszki zawiasu (`cup`) oraz wkrętów mocujących puszki (`screw`) nadal były generowane manualnie przez literał obiektu i bezpośrednie `features.push({ ... })`. 

Mimo że cechy te posiadały już asocjację `drivenBy`, regułę semantyczną `rule` oraz identyfikator generatora `generatedBy`, omijały centralny punkt konstrukcji:
- Brak gwarancji spójności serializacji (np. automatyczne duplikaty `*_mm` dla CNC),
- Brak jednolitej struktury parametrów,
- Ręczne sklejanie obiektów cech zamiast użycia fabryki intencji.

---

## 2. Architektura i Zmiany w Rdzeniu (`01_machining-intent.ts`)

Aby fabryka `buildHoleMachiningIntent` mogła obsłużyć otwory na formatkach frontowych, rozszerzono kontrakt `HoleMachiningIntentOptions` i `MachiningHoleParams`:

### A. Opcjonalność `targetNodeId`
Podczas fazy planowania w silniku (`calculateDoorsPlan`, `calculateFlapsPlan`) węzeł formatki CAD w drzewie sceny (`CADNode`) nie musi jeszcze fizycznie istnieć (jest powoływany dopiero w adapterze podczas materializacji planu).
- Pole `targetNodeId?: string` stało się opcjonalne.
- Przy braku podania stosowany jest domyślny fallback `opts.targetNodeId ?? ''`.

### B. Opcjonalność `ownerTag` i Separacja Odpowiedzialności
W module obróbczym `ownerTag` (`isDoorDrilling`, `isFlapDrilling`, `isShelfDrilling` itp.) służy **komendom synchronizacji korpusu** (`SyncDoorDrillingsCommand`, `syncMachiningHoles`) do odróżniania i czyszczenia tymczasowych automatów wygenerowanych na formatkach korpusu (np. boki szafki).
- **Otwory frontowe** (`cup`, `screw`) są integralną częścią definicji geometrycznej samego skrzydła drzwi/klapy, wyliczaną na stałe przez silnik modułu.
- Uczyniono `ownerTag?: MachiningHoleOwnerTag` opcjonalnym (`...(opts.ownerTag ? { [opts.ownerTag]: true } : {})`).
- Dzięki temu otwory frontowe **nie są błędnie kwalifikowane jako automaty korpusu**, co zapobiega ich przypadkowemu wyczyszczeniu podczas synchronizacji prowadników w korpusie szafki.

### C. Obsługa `extraParams`
Otwory frontów niosą specyficzne metadane domenowe (np. `isDoorCup`, `isDoorScrew`, `isFlapCup`, `isFlapScrew`, `orientation: 'top' | 'bottom'`, `hinge_id`, `hingeIndex`, `hardwareId`, `side`).
- Dodano `extraParams?: Record<string, any>` w `HoleMachiningIntentOptions`.
- Wzbogacono interfejs `MachiningHoleParams` o indeks `[key: string]: any`.
- W `buildHoleMachiningIntent` parametry te są bezpiecznie domieszkowywane: `...(opts.extraParams ? opts.extraParams : {})`.

---

## 3. Implementacja w Silnikach Modułów

### A. Silnik Drzwi (`05_doors-engine.ts`)
W funkcji `buildHingeFeatures` literał obiektu zastąpiono wywołaniem `buildHoleMachiningIntent`:

```typescript
const intent = buildHoleMachiningIntent({
    targetNodeId: side === 'left' ? 'Drzwi_Lewe' : 'Drzwi_Prawe',
    id: `hinge_${kind}_${side}_${hinge.index}${suffix}`,
    face: 'FACE_Z_PLUS',
    side: 'FACE_Z_PLUS',
    template_id: templateId,
    drivenBy: {
        nodeId: `hinge_${side}_${hinge.index}`,
        role: 'HARDWARE',
        hardwareType: 'HINGE',
        partKey: `Hinge_${side === 'left' ? 'L' : 'R'}${hinge.index}`,
    },
    rule: hole.isCup ? 'cup' : 'screw',
    generatedBy: 'blok_doors',
    u,
    v: vCenter + hole.yOffset,
    diameter: hole.dia,
    depth: hole.depth,
    sourcePartId: `Hinge_${side === 'left' ? 'L' : 'R'}${hinge.index}`,
    extraParams: {
        hinge_id: hingeId,
        isDoorCup: hole.isCup,
        isDoorScrew: !hole.isCup,
        hingeIndex: hinge.index,
        side: side,
        hardwareId: `hinge_${side}_${hinge.index}`,
    },
});
features.push(intent.feature);
```

### B. Silnik Klap (`12_flaps-engine.ts`)
W funkcji `buildHingeFeatures` dla klap:

```typescript
const intent = buildHoleMachiningIntent({
    targetNodeId: 'Klapa',
    id: isCup ? `flap_cup_${hingeKey}` : `flap_screw_${hingeKey}_${hole.name || 's'}`,
    face: 'FACE_Z_PLUS',
    side: 'FACE_Z_PLUS',
    template_id: templateId,
    drivenBy: {
        nodeId: `hinge_${hingeKey.toLowerCase()}`,
        role: 'HARDWARE',
        hardwareType: 'HINGE',
        partKey: hingeKey,
    },
    rule: isCup ? 'cup' : 'screw',
    generatedBy: 'blok_flaps',
    u,
    v,
    diameter: hole.dia,
    depth: hole.depth,
    sourcePartId: hingeKey,
    extraParams: {
        hinge_id: hingeId,
        isFlapCup: isCup,
        isFlapScrew: !isCup,
        hingeKey: hingeKey,
        hingeSide: side,
        side: side,
        orientation: isTop ? 'top' : 'bottom',
        hardwareId: `hinge_${hingeKey.toLowerCase()}`,
    },
});
features.push(intent.feature);
```

### C. Silnik Drzwi Skośnych (`06_skosne-doors-engine.ts`)
W funkcji `buildHingeFeaturesForSide`:

```typescript
const intent = buildHoleMachiningIntent({
    targetNodeId: side === 'left' ? 'Drzwi_Lewe' : 'Drzwi_Prawe',
    id: `hinge_${kind}_${side}_${hinge.index}${suffix}`,
    face: 'FACE_Z_PLUS',
    side: 'FACE_Z_PLUS',
    template_id: templateId,
    drivenBy: {
        nodeId: `hinge_${side}_${hinge.index}`,
        role: 'HARDWARE',
        hardwareType: 'HINGE',
        partKey: `Hinge_${side === 'left' ? 'L' : 'R'}${hinge.index}`,
    },
    rule: hole.isCup ? 'cup' : 'screw',
    generatedBy: 'blok_doors',
    u,
    v: vCenter + hole.yOffset,
    diameter: hole.dia,
    depth: hole.depth,
    sourcePartId: `Hinge_${side === 'left' ? 'L' : 'R'}${hinge.index}`,
    extraParams: {
        hinge_id: hingeId,
        isDoorCup: hole.isCup,
        isDoorScrew: !hole.isCup,
        hingeIndex: hinge.index,
        side,
        hardwareId: `hinge_${side}_${hinge.index}`,
    },
});
features.push(intent.feature);
```

### D. Silnik Drzwi Narożnych (`07_corner-doors-engine.ts`)
W funkcji `buildHingeFeatures`:

```typescript
const hwSide = side === 'left' ? 'lewe' : 'prawe';
const intent = buildHoleMachiningIntent({
    targetNodeId: side === 'left' ? 'Drzwi_Lewe' : 'Drzwi_Prawe',
    id: `hinge_${kind}_${side}_${hinge.index}${suffix}`,
    face: 'FACE_Z_PLUS',
    side: 'FACE_Z_PLUS',
    template_id: templateId,
    drivenBy: {
        nodeId: `hinge_gap_${hwSide}_${hinge.index}`,
        role: 'HARDWARE',
        hardwareType: 'HINGE',
        partKey: `Hinge_${side === 'left' ? 'L' : 'R'}${hinge.index}`,
    },
    rule: hole.isCup ? 'cup' : 'screw',
    generatedBy: 'blok_doors',
    u,
    v: vCenter + hole.yOffset,
    diameter: hole.dia,
    depth: hole.depth,
    sourcePartId: `Hinge_${side === 'left' ? 'L' : 'R'}${hinge.index}`,
    extraParams: {
        hinge_id: hingeId,
        isDoorCup: hole.isCup,
        isDoorScrew: !hole.isCup,
        hingeIndex: hinge.index,
        side,
        hingeInGap: true,
        hardwareId: `hinge_gap_${side}_${hinge.index}`,
    },
});
features.push(intent.feature);
```

### 3.5. Moduł Szuflad (`09_drawers-engine.ts`)

W `buildFrontHoles`:
```typescript
const railNodeId = `drawer_${slot.index}_rail_${side}`;
const intent = buildHoleMachiningIntent({
    id: `drawer_${slot.index}_front_${side}_${zIdx}`,
    name: `Otwór montażowy szuflady ${slot.index + 1} (${side})`,
    face: 'FACE_Z_PLUS',
    u_mm: u,
    v_mm: v,
    diameter_mm: dia,
    depth_mm: depth,
    rule: 'screw',
    drivenBy: { nodeId: railNodeId, role: 'HARDWARE', hardwareType: 'RAIL' },
    sourcePartId: railNodeId,
    generatedBy: 'blok_drawers',
    extraParams: {
        template_id: drill.id || 'STANDARD_DRAWER_DRILL',
        isDrawerFrontHole: true
    }
});
features.push(intent.feature);
```

### 3.6. Moduł Półek (`04_shelves-engine.ts`)

W `buildShelfSupportHoles`:
```typescript
const hwId = pinSuffix ? `shelf_${indeks_polki}_pin_${pinSuffix}` : undefined;
const intent = buildHoleMachiningIntent({
    id,
    name,
    face: face as any,
    u_mm: u,
    v_mm: v,
    diameter_mm: srednica_otworu_mm,
    depth_mm: glebokosc_otworu_mm,
    rule: 'shelf_pin',
    ownerTag: 'isShelfDrilling',
    drivenBy: hwId ? { nodeId: hwId, role: 'HARDWARE', hardwareType: 'SHELF_PIN' } : undefined,
    sourcePartId: hwId,
    generatedBy: 'blok_shelves',
    extraParams: {
        template_id: 'SINGLE',
        clearance,
        shelfZ: srodek_z_mm,
        holeZ: holeZ_mm,
        is_assembly_drilling: true
    }
});
const feat = intent.feature as any;
feat.is_assembly_drilling = true;
feat.visible = false;
features.push(feat);
```

---

## 4. Weryfikacja i Testy

### Testy Jednostkowe i Integracyjne
1. **`A2_bloki/__tests__/machining-holes.test.ts`**:
   - `obsługuje extraParams i opcjonalny targetNodeId` — potwierdza poprawne domieszkowywanie parametrów i domyślny `targetNodeId: ''`.
   - `silnik drzwi (calculateDoorsPlan)` — sprawdza obecność cech `cup` i `screw`, duplikatów `_mm`, reguł, relacji `drivenBy` oraz `generatedBy: 'blok_doors'`.
   - `silnik klap (calculateFlapsPlan)` — sprawdza poprawność cech klap, orientację `top/bottom` i flagi `isFlapCup`.
   - `silnik drzwi skośnych (calculateSkosneDoorsPlan)` — sprawdza poprawność cech drzwi skośnych.
   - `silnik drzwi narożnych (calculateCornerDoorsPlan)` — sprawdza powiązania `drivenBy` do `hinge_gap_*` oraz flagę `hingeInGap`.
   - `silnik szuflad (calculateDrawersPlan)` — sprawdza otwory montażowe frontu szuflad powiązane z prowadnicami `drivenBy: { hardwareType: 'RAIL' }`.
   - `silnik półek (calculateShelvesPlan)` — sprawdza otwory podpórek z `rule: 'shelf_pin'`, `ownerTag: 'isShelfDrilling'` i `drivenBy: { hardwareType: 'SHELF_PIN' }`.
2. **`A2_bloki/__tests__/doors-hardware-association.test.ts` i `drawers-drilling-association.test.ts`**:
   - Sprawdza asocjację sprzętową w całym łańcuchu.
3. **`npm run verify`**:
   - Pełna bramka (`typecheck` + 200 plików testowych / 1368 testów + `audit`) przechodzi z kodem 0.

---

## 5. Podsumowanie Korzyści

1. **Jeden punkt prawdy dla otworów**: Zarówno otwory w formatkach korpusu (prowadniki, podpórki półek), jak i otwory we wszystkich rodzajach frontów (drzwi standardowe, klapy, drzwi skośne, drzwi narożne, fronty szuflad) przechodzą przez tę samą fabrykę `buildHoleMachiningIntent`.
2. **Pełna spójność formatu CNC**: Gwarantowane automatyczne zasilanie pól `u_mm`, `v_mm`, `diameter_mm`, `depth_mm` oraz `side = face`.
3. **Czysta semantyka**: Precyzyjny podział na tożsamość relacyjną (`drivenBy`), intencję obróbczą (`rule`) i moduł źródłowy (`generatedBy`), bez naruszania logiki synchronizatorów korpusu.
4. **100% zunifikowanych silników modułów w `A2_bloki`**: Wszystkie silniki Bloki tworzące otwory działają w oparciu o ten sam SSOT.
