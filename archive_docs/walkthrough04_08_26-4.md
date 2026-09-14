# Ostateczna Poprawka Błędów Niewidocznych Elementów (SmartFrame, SmartBox)

Podczas procesu refaktoryzacji wprowadziliśmy `SceneSyncAdapter`, który elegancko tłumaczy układy współrzędnych:
- **Domena CAD**: `Z-up` (X = szerokość, Y = głębokość, Z = wysokość)
- **Babylon.js**: `Y-up` (X = szerokość, Z = głębokość, Y = wysokość)

Wszystkie obiekty tworzone przez `ProjectDocument` są natywnie w przestrzeni domenowej CAD, a adapter ma za zadanie podczas renderowania przeliczyć te punkty do Babylon.js.

## Przyczyna dzisiejszej awarii (Dług Legacy)
Wewnątrz rdzenia generatorów `smartframe-adapter.ts` i `smartbox-core.ts` pozostały stare przeliczenia, które ręcznie konwertowały osie (tzw. _hardcoded swaps_), np.:
```typescript
localCenterY = part.loc.z;   // CAD Z (wysokość) -> Babylon Y (Up)
```
Gdy te podwójnie zamienione współrzędne trafiały do węzła `CADNode`, a następnie były ponownie przetwarzane przez zaufany `SceneSyncAdapter`, osie zostały poplątane - `Y` (głębokość) zostało permanentnie nadpisane przez `Z` (wysokość). Oznacza to, że płyty miały grubość/rozmiar 0 w jednym wymiarze lub były zlokalizowane tak daleko, że nie mogły być wyrenderowane i stąd nie były widoczne na scenie mimo ich fizycznej obecności w drzewie `ProjectDocument`.

## Wdrożona Koncepcja (Fix)

Wycięliśmy stare "ręczne" transformacje w generatorach - teraz budujemy kontener i płyty wyłącznie w natywnym układzie CAD:

1. **Poprawka w `smartframe-adapter.ts`**:
   - Usunięto kod:
     ```typescript
     localCenterX = part.loc.x;
     localCenterY = part.loc.z;
     const cornerX = localCenterX;
     const cornerY = localCenterY;
     const cornerZ = localCenterZ;
     ```
   - Wdrożono:
     ```typescript
     const cornerX = part.loc.x; // Szerokość
     const cornerY = part.loc.y; // Głębokość
     const cornerZ = part.loc.z; // Wysokość
     ```

2. **Poprawka w `smartbox-core.ts`**:
   - Usunięto wadliwe obliczanie Y/Z SmartBoxa na podstawie `zMinVal` i `yMinVal`.
   - Zmapowano wprost wymiary CAD do domenowego wektora lokalnego:
     ```typescript
     const sbPosX = nmToMm(cabinetPos.x) + (xMinVal + xMaxVal) / 2;
     const sbPosY = nmToMm(cabinetPos.y) + (yMinVal + yMaxVal) / 2; // Głębokość
     const sbPosZ = nmToMm(cabinetPos.z) + zMinVal; // Wysokość
     ```

Skompilowałem zaktualizowany kod narzędziem `npm run build`. 
System powinien już natychmiast działać, obiekty **SmartFrame** oraz **Korpus 3** powinny renderować się prawidłowo w swoim rzeczywistym miejscu.
