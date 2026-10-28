# Crevo CAD — Indeks Architektury i Symboli (Repo-Map)

> Automatycznie wygenerowana mapa symboli AST (`scripts/generate-repo-map.mjs`).
> Pozwala agentom AI oraz programistom na natychmiastowe lokalizowanie funkcji, sygnatur, klas i typów bez konieczności przeszukiwania całych plików.

### Statystyka Repo:
- **Zindeksowanych plików TS/TSX**: 457
- **Eksportowanych funkcji**: 1761
- **Klas domenowych**: 166
- **Typów, Interfejsów i Enumów**: 821
- **Czas generowania**: 1438 ms

---

## Spis Modułów

- [A1 Core (CAD Node, Math, B-Rep, Units, Scheme)](#a1_core) (70 plików)
- [A2 Bloki (Szafki, Moduły Wnętrz, Okucia, Intent Obróbek)](#a2_bloki) (108 plików)
- [A3 SmartFrame (Generatory Korpusów, Ściany Referencyjne)](#a3_smartframe) (23 plików)
- [A4 SmartPanel (Natywny Silnik Płyt, Obróbki, Wycięcia)](#a4_smartpanel) (15 plików)
- [A6 AGD (Sprzęt AGD, Modele 3D, Wymiary Montażowe)](#a6_agd) (5 plików)
- [A7 Material (Cenniki, Obrzeża, Routing Obróbczy)](#a7_material) (7 plików)
- [A8 PMI (Wymiarowanie, Adnotacje 3D, Etykiety)](#a8_pmi) (25 plików)
- [B1 Biblioteka (Katalogi Okuć mm, Uchwyty, Zawiasy, Prowadnice)](#b1_biblioteka) (10 plików)
- [C1 CNC / CAM (CLData, Postprocesory, WCS, Strategie Frezowania)](#c1_cnc) (36 plików)
- [C2 Connectors (Połączenia Meblowe, Mimośrody, Kołki)](#c2_connectors) (16 plików)
- [D1 Draw (Silnik Rysunkowy 2D)](#d1_draw) (6 plików)
- [E1 Export (G-code, CSV, JSON, DXF)](#e1_export) (5 plików)
- [N1 Nesting (Układ Rozkroju Płyt, Algorytmy Pakowania)](#n1_nesting) (10 plików)
- [O1 Operacje (Przetłoczenia, Wycięcia Przelotowe, Rewizje, Ramki)](#o1_operacji) (7 plików)
- [R1 Raporty (Zestawienia Materiałowe, Formatki, Etykiety)](#r1_reports) (9 plików)
- [R2 Rys (Rysunki Warsztatowe, Rzuty, Przekroje)](#r2_rys) (15 plików)
- [S1 Sketcher (Szkicownik Parametryczny 2D)](#s1_sketcher) (30 plików)
- [S2 Solver (Rozkład Sił, Mostek Symulacji)](#s2_solver) (25 plików)
- [S3 Scena (Zarządzanie Środowiskiem 3D)](#s3_scena) (3 plików)
- [S4 Ściany (Ściany Pomieszczeń, Układ Wnętrz)](#s4_sciany) (15 plików)
- [S5 Studio (Wizualny Edytor SmartParts / Komponentów)](#s5_studio) (13 plików)
- [T1 Tłumaczenia (Wielojęzyczność PL/EN/DE)](#t1_tlumaczenia) (4 plików)

---

## <a id="a1_core"></a>A1 Core (CAD Node, Math, B-Rep, Units, Scheme)

### [A1_core/cabinet-port.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cabinet-port.ts)

**Funkcje:**
- `export` `registerCabinetModule(mod: CabinetModule): void` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cabinet-port.ts#L52)
- `export` `getCabinetModule(): CabinetModule | null` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cabinet-port.ts#L56)
- `export` `registerKorpusRebuiltListener(fn: (doc: ProjectDocument, containerId: string) => ...): void` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cabinet-port.ts#L60)
- `export` `notifyKorpusRebuilt(doc: ProjectDocument, containerId: string): void` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cabinet-port.ts#L66)
- `export` `resetCabinetPortForTests(): void` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cabinet-port.ts#L70)

**Typy i Modele Danych:**
- `interface KorpusCreateParams` { szerokosc_mm, wysokosc_mm, glebokosc_mm, liczba_stref, wysokosc_strefy_dolnej_mm, wysokosc_strefy_srodkowej_mm, cofniecie_plecow_mm, szerokosc_blendy_mm, +10 more } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cabinet-port.ts#L15)
- `interface CabinetModule` { rebuild, createKorpus, createSyncBackGroovesCommand, createSetTopPanelConfigCommand } [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cabinet-port.ts#L38)
- `type TopPanelMode` = `'FULL' | 'TRAVERSE_H' | 'TRAVERSE_V'` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cabinet-port.ts#L36)

### [A1_core/cad-math/coord-system.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts)

**Funkcje:**
- `export` `cadToRender(v: Vec3): Vec3` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L63)
- `export` `renderToCAD(v: Vec3): Vec3` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L74)
- `export` `cadMatrixToRenderMatrix(m: Mat4): Mat4` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L88)
- `export` `renderMatrixToCADMatrix(m: Mat4): Mat4` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L96)
- `export` `cadAxisKeyToRenderDirection(key: string): Vec3` [L123](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L123)
- `export` `dominantCadAxisFromRenderDelta(dx: number, dy: number, dz: number): 'X' | 'Y' | 'Z'` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L132)
- `export` `lockCadDelta(cadDelta: Vec3, axis: CadAxisKey | 'none'): Vec3` [L145](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L145)
- `export` `cadAxesFromRenderMatrix(matrixWorld: Float64Array | number[]): Record<'X' | 'Y' | 'Z', Vec3>` [L160](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L160)

**Typy i Modele Danych:**
- `type CadAxisKey` = `'X' | 'Y' | 'Z' | 'x' | 'y' | 'z'` [L115](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L115)

**Stałe i Słowniki:**
- `const CAD_AXIS_WIDTH` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L107)
- `const CAD_AXIS_DEPTH` [L109](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L109)
- `const CAD_AXIS_HEIGHT` [L111](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/coord-system.ts#L111)

### [A1_core/cad-math/mat4.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts)

**Klasy:**
- `class Mat4` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L26)
  - `constructor(data?: Float64Array | number[]): void` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L30)
  - `identity(): Mat4` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L40)
  - `fromTranslation(x: number, y: number, z: number): Mat4` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L50)
  - `fromScale(sx: number, sy: number, sz: number): Mat4` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L57)
  - `fromQuaternion(q?: Quat): Mat4` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L72)
  - `fromTRS(translation: Vec3, rotation: Quat, scale: Vec3): Mat4` [L108](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L108)
  - `multiply(other: Mat4): Mat4` [L141](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L141)
  - `invert(): Mat4` [L165](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L165)
  - `transpose(): Mat4` [L223](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L223)
  - `transformPoint(v: Vec3): Vec3` [L241](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L241)
  - `transformDirection(v: Vec3): Vec3` [L258](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L258)
  - `decompose(): { translation: Vec3; rotation: Quat; scale: Vec3 }` [L274](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L274)
  - `getTranslation(): Vec3` [L309](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L309)
  - `equals(other: Mat4, eps: number): boolean` [L315](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L315)
  - `clone(): Mat4` [L322](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L322)
  - `toString(): string` [L330](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/mat4.ts#L330)

### [A1_core/cad-math/quat.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts)

**Klasy:**
- `class Quat` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L14)
  - `constructor(x: number, y: number, z: number, w: number): void` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L22)
  - `fromEulerXYZ(rx: number, ry: number, rz: number): Quat` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L36)
  - `fromAxisAngle(axis: Vec3, angle: number): Quat` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L55)
  - `fromMat4(m: import('./mat4.js').Mat4): Quat` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L66)
  - `multiply(other: Quat): Quat` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L107)
  - `inverse(): Quat` [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L116)
  - `conjugate(): Quat` [L121](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L121)
  - `lengthSquared(): number` [L125](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L125)
  - `length(): number` [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L129)
  - `normalize(): Quat` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L133)
  - `rotateVec3(v: Vec3): Vec3` [L141](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L141)
  - `toEulerXYZ(): { x: number; y: number; z: number }` [L152](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L152)
  - `slerp(other: Quat, t: number): Quat` [L177](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L177)
  - `equals(other: Quat, eps: number): boolean` [L215](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L215)
  - `clone(): Quat` [L224](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L224)
  - `toArray(): [number, number, number, number]` [L228](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L228)
  - `toPlain(): { x: number; y: number; z: number; w: number }` [L232](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L232)
  - `toString(): string` [L236](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/quat.ts#L236)

### [A1_core/cad-math/units.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts)

**Funkcje:**
- `export` `mmToNm(mm: number): number` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts#L50)
- `export` `nmToMm(nm: number): number` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts#L57)
- `export` `rulesMToNm(meters: number | undefined | null, fallbackNm): number` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts#L65)
- `export` `rulesMToMm(meters: number | undefined | null, fallback): number` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts#L74)

**Stałe i Słowniki:**
- `const MM_TO_NM_FACTOR` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts#L23)
- `const NM_TO_MM_FACTOR` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts#L26)
- `const M_TO_MM_FACTOR` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts#L29)
- `const M_TO_NM_FACTOR` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts#L32)
- `const INCH_TO_NM_FACTOR` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts#L40)
- `const NM_TO_INCH_FACTOR` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/units.ts#L43)

### [A1_core/cad-math/vec3.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts)

**Klasy:**
- `class Vec3` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L12)
  - `constructor(x: number, y: number, z: number): void` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L23)
  - `from(v: { x: number; y: number; z: number }): Vec3` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L31)
  - `fromArray(arr: [number, number, number] | number[]): Vec3` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L35)
  - `add(other: Vec3): Vec3` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L41)
  - `sub(other: Vec3): Vec3` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L45)
  - `scale(s: number): Vec3` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L49)
  - `negate(): Vec3` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L53)
  - `dot(other: Vec3): number` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L59)
  - `cross(other: Vec3): Vec3` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L63)
  - `lengthSquared(): number` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L71)
  - `length(): number` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L75)
  - `normalize(): Vec3` [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L79)
  - `distanceTo(other: Vec3): number` [L85](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L85)
  - `distanceSquaredTo(other: Vec3): number` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L89)
  - `transformByMat4(m: import('./mat4.js').Mat4): Vec3` [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L99)
  - `transformDirectionByMat4(m: import('./mat4.js').Mat4): Vec3` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L107)
  - `equals(other: Vec3, eps: number): boolean` [L113](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L113)
  - `clone(): Vec3` [L123](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L123)
  - `toArray(): [number, number, number]` [L127](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L127)
  - `toPlain(): { x: number; y: number; z: number }` [L131](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L131)
  - `toString(): string` [L135](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-math/vec3.ts#L135)

### [A1_core/cad-module-context.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-module-context.ts)

**Typy i Modele Danych:**
- `interface CadModuleContext` { canvas, document, viewport, panelViews, containerViews, facePicker, sketchPlane, ui, +3 more } [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-module-context.ts#L27)

### [A1_core/cad-node/cad-node.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts)

**Klasy:**
- `class CADNode` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L28)
  - `constructor(id: string, name: string, nodeType: NodeType): void` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L57)
  - `create(nodeType: NodeType, name: string, id?: string): CADNode` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L67)
  - `addChild(child: CADNode): void` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L92)
  - `removeChild(child: CADNode): void` [L120](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L120)
  - `detach(): void` [L127](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L127)
  - `setLocalTransform(translation: Vec3, rotation: Quat, scale: Vec3): void` [L150](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L150)
  - `setLocalMatrix(m: Mat4): void` [L159](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L159)
  - `setTranslation(t: Vec3): void` [L175](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L175)
  - `setRotation(q: Quat): void` [L183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L183)
  - `getWorldMatrix(): Mat4` [L194](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L194)
  - `onWorldMatrixChanged(callback: WorldMatrixChangedCallback): () => void` [L224](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L224)
  - `findByType(type: NodeType): CADNode[]` [L245](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L245)
  - `findAll(): CADNode[]` [L261](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L261)
  - `findById(id: string): CADNode | null` [L277](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L277)
  - `localToWorld(localPoint: Vec3): Vec3` [L291](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L291)
  - `worldToLocal(worldPoint: Vec3): Vec3` [L298](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L298)
  - `toJSON(): object` [L304](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L304)
  - `toString(): string` [L319](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L319)

**Typy i Modele Danych:**
- `type WorldMatrixChangedCallback` = `(node: CADNode, worldMatrix: Mat4) => void` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/cad-node.ts#L24)

### [A1_core/cad-node/node-type.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/node-type.ts)

**Typy i Modele Danych:**
- `enum NodeType` { ROOM, ASSEMBLY, PART, FEATURE, WCS_FRAME, HARDWARE } [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/node-type.ts#L8)

### [A1_core/cad-node/part-shape.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/part-shape.ts)

**Funkcje:**
- `export` `readPartRole(model: PartShapeSource | null | undefined): string` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/part-shape.ts#L45)
- `export` `readPartShape(model: PartShapeSource | null | undefined): string` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/part-shape.ts#L50)
- `export` `isCylindricalPart(model: PartShapeSource | null | undefined): boolean` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/part-shape.ts#L59)
- `export` `isTubeRodPart(model: PartShapeSource | null | undefined): boolean` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/part-shape.ts#L73)

**Typy i Modele Danych:**
- `interface PartShapeSource` { role, nodeType, hardwareType, custom_properties, customProperties } [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/part-shape.ts#L35)

**Stałe i Słowniki:**
- `const CYLINDER_SHAPE` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/part-shape.ts#L18)

### [A1_core/cad-node/scene-sync-adapter.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts)

**Klasy:**
- `class SceneSyncAdapter` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts#L49)
  - `bind(node: CADNode, mesh: any): void` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts#L64)
  - `debugDumpTrees(): string` [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts#L98)
  - `unbind(node: CADNode): void` [L167](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts#L167)
  - `unbindById(nodeId: string): void` [L172](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts#L172)
  - `unbindAll(): void` [L181](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts#L181)
  - `getMeshForNodeId(nodeId: string | null | undefined): any | null` [L191](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts#L191)
  - `syncFromMesh(mesh: any): void` [L234](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts#L234)
  - `syncNodeToMesh(nodeOrId: CADNode | string): void` [L257](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts#L257)

**Typy i Modele Danych:**
- `interface Binding` { node, mesh, unsubscribe } [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-node/scene-sync-adapter.ts#L41)

### [A1_core/cad-translate-gizmo.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-translate-gizmo.ts)

**Klasy:**
- `class CadTranslateGizmo` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-translate-gizmo.ts#L16)
  - `constructor(scene: any): void` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-translate-gizmo.ts#L25)
  - `onDragStart(handler: CadGizmoDragHandler): void` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-translate-gizmo.ts#L68)
  - `onDrag(handler: CadGizmoDragHandler): void` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-translate-gizmo.ts#L74)
  - `onDragEnd(handler: CadGizmoDragHandler): void` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-translate-gizmo.ts#L80)
  - `setEnabled(enabled: boolean): void` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-translate-gizmo.ts#L86)
  - `dispose(): void` [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-translate-gizmo.ts#L94)

**Typy i Modele Danych:**
- `type CadGizmoDragHandler` = `() => void` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/cad-translate-gizmo.ts#L14)

### [A1_core/commands/add-node-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/add-node-command.ts)

**Klasy:**
- `class AddNodeCommand` *implements Command* [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/add-node-command.ts#L11)
  - `constructor(parentId: string, node: CADNode, index?: number, label: string): void` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/add-node-command.ts#L21)
  - `execute(document: ProjectDocument): void` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/add-node-command.ts#L31)
  - `undo(document: ProjectDocument): void` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/add-node-command.ts#L35)

### [A1_core/commands/command-history.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command-history.ts)

**Klasy:**
- `class CommandHistory` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command-history.ts#L17)
  - `constructor(document: ProjectDocument, options: CommandHistoryOptions): void` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command-history.ts#L25)
  - `execute(command: Command): void` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command-history.ts#L72)
  - `undo(): boolean` [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command-history.ts#L94)
  - `redo(): boolean` [L112](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command-history.ts#L112)
  - `clear(): void` [L134](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command-history.ts#L134)
  - `onChange(subscriber: HistoryChangeSubscriber): () => void` [L143](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command-history.ts#L143)

**Typy i Modele Danych:**
- `interface CommandHistoryOptions` { maxEntries } [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command-history.ts#L11)
- `type HistoryChangeSubscriber` = `() => void` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command-history.ts#L15)

### [A1_core/commands/command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command.ts)

**Typy i Modele Danych:**
- `interface Command` { id, label, timestamp, affectedNodeIds, execute, undo, redo } [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/command.ts#L10)

### [A1_core/commands/feature-commands.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts)

**Klasy:**
- `class AddFeatureCommand` *implements Command* [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L11)
  - `constructor(panelId: string, featureData: any, index?: number, label: string): void` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L21)
  - `execute(document: ProjectDocument): void` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L31)
  - `undo(document: ProjectDocument): void` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L46)
- `class RemoveFeatureCommand` *implements Command* [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L61)
  - `constructor(4 params): void` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L71)
  - `execute(document: ProjectDocument): void` [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L90)
  - `undo(document: ProjectDocument): void` [L100](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L100)
- `class UpdateFeatureCommand` *implements Command* [L110](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L110)
  - `constructor(5 params): void` [L121](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L121)
  - `execute(document: ProjectDocument): void` [L138](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L138)
  - `undo(document: ProjectDocument): void` [L142](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/feature-commands.ts#L142)

### [A1_core/commands/macro-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/macro-command.ts)

**Klasy:**
- `class MacroCommand` *implements Command* [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/macro-command.ts#L10)
  - `constructor(commands: Command[], label: string): void` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/macro-command.ts#L18)
  - `execute(document: ProjectDocument): void` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/macro-command.ts#L35)
  - `undo(document: ProjectDocument): void` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/macro-command.ts#L47)
  - `redo(document: ProjectDocument): void` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/macro-command.ts#L54)

### [A1_core/commands/remove-node-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/remove-node-command.ts)

**Klasy:**
- `class RemoveNodeCommand` *implements Command* [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/remove-node-command.ts#L12)
  - `constructor(document: ProjectDocument, nodeId: string, label: string): void` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/remove-node-command.ts#L26)
  - `execute(document: ProjectDocument): void` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/remove-node-command.ts#L41)
  - `undo(document: ProjectDocument): void` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/remove-node-command.ts#L49)

### [A1_core/commands/reparent-node-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/reparent-node-command.ts)

**Klasy:**
- `class ReparentNodeCommand` *implements Command* [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/reparent-node-command.ts#L10)
  - `constructor(4 params): void` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/reparent-node-command.ts#L23)
  - `execute(document: ProjectDocument): void` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/reparent-node-command.ts#L45)
  - `undo(document: ProjectDocument): void` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/reparent-node-command.ts#L49)

### [A1_core/commands/set-dimensions-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/set-dimensions-command.ts)

**Klasy:**
- `class SetDimensionsCommand` *implements Command* [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/set-dimensions-command.ts#L18)
  - `constructor(4 params): void` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/set-dimensions-command.ts#L30)
  - `execute(document: ProjectDocument): void` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/set-dimensions-command.ts#L47)
  - `undo(document: ProjectDocument): void` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/set-dimensions-command.ts#L51)

**Typy i Modele Danych:**
- `interface DimensionValues` { width, height, depth, thickness } [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/set-dimensions-command.ts#L11)

### [A1_core/commands/transform-node-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/transform-node-command.ts)

**Klasy:**
- `class TransformNodeCommand` *implements Command* [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/transform-node-command.ts#L12)
  - `constructor(4 params): void` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/transform-node-command.ts#L22)
  - `execute(document: ProjectDocument): void` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/transform-node-command.ts#L37)
  - `undo(document: ProjectDocument): void` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/commands/transform-node-command.ts#L44)

### [A1_core/constraint-drag-port.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/constraint-drag-port.ts)

**Funkcje:**
- `export` `registerConstraintDragPort(p: ConstraintDragPort): void` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/constraint-drag-port.ts#L20)
- `export` `getConstraintDragPort(): ConstraintDragPort | null` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/constraint-drag-port.ts#L24)
- `export` `resetConstraintDragPortForTests(): void` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/constraint-drag-port.ts#L28)

**Typy i Modele Danych:**
- `interface ConstraintDragPort` { begin, propagateTransform, buildTransformCommands, restoreInitial, end, getAffectedNodeIds } [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/constraint-drag-port.ts#L9)

### [A1_core/container-model.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/container-model.ts)

**Klasy:**
- `class ContainerModel` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/container-model.ts#L25)
  - `constructor(1 params): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/container-model.ts#L34)
  - `toJSON(): Record<string, any>` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/container-model.ts#L44)
  - `fromJSON(data: any): void` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/container-model.ts#L63)
  - `fromJSON(data: any): ContainerModel` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/container-model.ts#L74)

**Typy i Modele Danych:**
- `interface ContainerModelOptions` { width, height, depth, name } [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/container-model.ts#L8)
- `interface GeneratorParams` { type, zoneCount, thickness, backOffset } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/container-model.ts#L15)

### [A1_core/context-manager.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-manager.ts)

**Klasy:**
- `class ContextManager` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-manager.ts#L42)
  - `deactivatePmiToolsIfActive(): void` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-manager.ts#L78)

**Typy i Modele Danych:**
- `interface IAppAPI` { addSmartPanel, createNewKorpus, rebuildContainer, undo, redo, newProject, forceResetProject, openProject, +14 more } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-manager.ts#L12)

### [A1_core/context-menu-handler.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu-handler.ts)

**Klasy:**
- `class ContextMenuHandler` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu-handler.ts#L15)
  - `init(6 params): void` [L232](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu-handler.ts#L232)

### [A1_core/context-menu.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu.ts)

**Klasy:**
- `class ContextMenu` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu.ts#L32)
  - `constructor(): void` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu.ts#L38)
  - `show(x: number, y: number, items: CtxMenuItem[], title?: string): void` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu.ts#L45)
  - `hide(): void` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu.ts#L132)
  - `onAction(fn: Function): void` [L144](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu.ts#L144)
  - `_handleOutsideClick(e: Event): void` [L244](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu.ts#L244)
  - `_handleKeydown(e: KeyboardEvent): void` [L251](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu.ts#L251)

**Funkcje:**
- `shortCaption(item: CtxMenuItem): string` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu.ts#L23)

**Typy i Modele Danych:**
- `type CtxMenuItem` = `{ label?: string; /** Krótki podpis pod ikoną (gdy brak —...` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/context-menu.ts#L8)

### [A1_core/domain-data.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-data.ts)

**Funkcje:**
- `export` `isContainerModel(data: DomainData): data is ContainerModel` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-data.ts#L15)
- `export` `isHardwareModel(data: DomainData): data is HardwareModel` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-data.ts#L19)

**Typy i Modele Danych:**
- `type DomainData` = `ContainerModel | PanelLike | HardwareModel` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-data.ts#L11)

### [A1_core/domain-registry.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-registry.ts)

**Funkcje:**
- `export` `registerDefaultHydrator(nodeType: string, hydrator: DomainHydrator): void` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-registry.ts#L14)
- `export` `registerDefaultFactory(nodeType: string, factory: DomainFactory): void` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-registry.ts#L18)
- `export` `applyDefaultDomainHandlers(host: DomainHandlerHost): void` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-registry.ts#L27)

**Typy i Modele Danych:**
- `interface DomainHandlerHost` { registerHydrator, registerFactory } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-registry.ts#L22)
- `type DomainHydrator` = `(raw: any, nodeJson: any) => any` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-registry.ts#L8)
- `type DomainFactory` = `(options?: any) => any` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/domain-registry.ts#L9)

### [A1_core/export-session-storage.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts)

**Funkcje:**
- `readJsonArray(key: string): any[]` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L28)
- `export` `readLegacyE1Sheets(): any[]` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L40)
- `export` `readLegacyE3Views(): any[]` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L48)
- `export` `readLegacyE3MultiSheets(): any[]` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L52)
- `export` `readLegacyE3CurrentSheetId(): string | null` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L56)
- `export` `clearLegacyExportStorage(): void` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L65)

**Stałe i Słowniki:**
- `const LEGACY_E1_SHEETS_KEYS` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L10)
- `const LEGACY_E3_VIEWS_KEY` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L17)
- `const LEGACY_E3_MULTI_SHEETS_KEY` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L18)
- `const LEGACY_E3_CURRENT_SHEET_KEY` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L19)
- `const LEGACY_EXPORT_STORAGE_KEYS` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/export-session-storage.ts#L21)

### [A1_core/face-name.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-name.ts)

**Funkcje:**
- `export` `normalizeFaceName(name: string): FaceName` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-name.ts#L23)

**Typy i Modele Danych:**
- `type FaceName` = `| 'FACE_X_PLUS' | 'FACE_X_MINUS' | 'FACE_Y_PLUS' | 'FACE_...` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-name.ts#L6)

**Stałe i Słowniki:**
- `const FACE_NAMES: FaceName[]` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-name.ts#L14)

### [A1_core/face-picker.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts)

**Klasy:**
- `class FacePicker` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L83)
  - `constructor(scene: any, canvas: any, panelViews: Map<any, any>, document: any): void` [L115](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L115)
  - `selectFaceExplicit(5 params): void` [L332](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L332)
  - `pickAllFacesUnderCursor(pointerX?: number, pointerY?: number): QuickPickCandidate[]` [L342](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L342)
  - `handlePointerDown(pointerX: number, pointerY: number, evt: any): void` [L348](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L348)
  - `resetAllFaceHighlights(): void` [L957](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L957)
  - `clearSelection(): void` [L975](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L975)
  - `onPick(fn: Function): () => void` [L981](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L981)
  - `setVertexPickPreview(on: boolean): void` [L1017](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L1017)
  - `dispose(): void` [L1135](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L1135)

**Funkcje:**
- `shouldPromotePickToActiveEntity(): boolean` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L20)
- `isPickingReference(): boolean` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L28)
- `sortFaceHitsForPick(hits: any[]): any[]` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L32)
- `isMeshHierarchicallyEnabled(mesh: any): boolean` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L55)
- `findGrooveFeatureAtUv(panel: any, faceName: string, uv: { u: number; v: number } | null): any | null` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/face-picker.ts#L65)

### [A1_core/geometry-detector.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/geometry-detector.ts)

**Klasy:**
- `class GeometryDetector` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/geometry-detector.ts#L32)
  - `constructor(scene: any): void` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/geometry-detector.ts#L35)
  - `selectGeometry(3 params): DetectionResult` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/geometry-detector.ts#L42)

**Typy i Modele Danych:**
- `interface DetectionResult` { hit, geometryType, pickedPoint, normal, faceName, cornerIndex, edgeKey, smartId, +2 more } [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/geometry-detector.ts#L19)
- `enum GeometryType` { VERTEX, EDGE, PLANE, FEATURE, OBJECT } [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/geometry-detector.ts#L11)

### [A1_core/gizmo-controller.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts)

**Klasy:**
- `class GizmoController` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L25)
  - `constructor(): void` [L109](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L109)
  - `isEntityVisible(entity: any): boolean` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L122)
  - `init(): void` [L151](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L151)
  - `createFloatingInput(): void` [L287](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L287)
  - `toggleTopPanelWidget(): void` [L506](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L506)
  - `closeTopPanelWidget(): void` [L522](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L522)
  - `createTopPanelWidget(): void` [L530](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L530)
  - `updateTopPanelWidgetUI(): void` [L671](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L671)
  - `setTopPanelMode(newMode: TopPanelMode): void` [L704](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L704)
  - `setTopPanelTraverseWidth(newWidth: number): void` [L731](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L731)
  - `clearFaceGizmos(): void` [L758](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L758)
  - `showTranslateGizmo(entity?: any): void` [L797](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L797)
  - `showRotateGizmo(entity?: any): void` [L875](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L875)
  - `updateFaceGizmo(): void` [L960](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/gizmo-controller.ts#L960)

### [A1_core/groove-params.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/groove-params.ts)

**Funkcje:**
- `export` `getGrooveParamsMm(params: any): { u: number; v: number; width: number; length: ...` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/groove-params.ts#L7)

### [A1_core/hardware-model.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/hardware-model.ts)

**Klasy:**
- `class HardwareModel` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/hardware-model.ts#L32)
  - `constructor(options: HardwareModelOptions): void` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/hardware-model.ts#L52)
  - `toJSON(): Record<string, any>` [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/hardware-model.ts#L79)
  - `fromJSON(data: any): void` [L111](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/hardware-model.ts#L111)
  - `fromJSON(data: any): HardwareModel` [L137](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/hardware-model.ts#L137)

**Funkcje:**
- `export` `hydrateHardware(raw: any, nodeJson: any): HardwareModel` [L163](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/hardware-model.ts#L163)

**Typy i Modele Danych:**
- `interface HardwareModelOptions` { id, name, role, hardwareType, hardwareId, side, loc, dim, +8 more } [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/hardware-model.ts#L11)

### [A1_core/id-manager.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts)

**Klasy:**
- `class SmartID` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L26)
  - `constructor(entityType: string, uid: string, parent): void` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L29)
  - `fromString(path: string): SmartID` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L38)
  - `child(entityType: string, uid: string): SmartID` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L64)
  - `toString(): string` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L68)
- `class IDManager` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L71)
  - `constructor(): void` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L75)
  - `getInstance(): IDManager` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L83)
  - `_generateUID(): string` [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L90)
  - `register(entityType: string, parentId, role, metadata): SmartID` [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L94)
  - `registerStable(entityType: string, parentId, role, metadata): SmartID` [L125](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L125)
  - `lookup(idString: string): any` [L142](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L142)
  - `unregister(idString: string): boolean` [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L146)
  - `clear(): void` [L150](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/id-manager.ts#L150)

### [A1_core/interaction/interaction-manager.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/interaction-manager.ts)

**Klasy:**
- `class InteractionManager` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/interaction-manager.ts#L7)
  - `constructor(scene: any, onIntentCallback: IntentCallback): void` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/interaction-manager.ts#L11)
  - `dispose(): void` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/interaction-manager.ts#L63)

**Typy i Modele Danych:**
- `type IntentCallback` = `(intent: Intent) => void` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/interaction-manager.ts#L5)

### [A1_core/interaction/interaction-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/interaction-types.ts)

**Typy i Modele Danych:**
- `interface Intent` { type, pointerInfo, keyboardInfo } [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/interaction-types.ts#L10)
- `enum IntentType` { CANCEL, CONFIRM, SELECT, CONTEXT_MENU, DELETE } [L1](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/interaction-types.ts#L1)

### [A1_core/interaction/state-machine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/state-machine.ts)

**Klasy:**
- `class StateMachine` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/state-machine.ts#L5)
  - `constructor(ctx: CadModuleContext): void` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/state-machine.ts#L14)
  - `registerState(name: string, state: BaseState): void` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/state-machine.ts#L21)
  - `getState(name: string): BaseState | undefined` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/state-machine.ts#L28)
  - `changeState(name: string): void` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/state-machine.ts#L35)
  - `getCurrentStateName(): string` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/state-machine.ts#L53)
  - `handleIntent(intent: Intent): void` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/state-machine.ts#L60)
  - `onStateChange(listener: (newStateName: string) => void): () => void` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/state-machine.ts#L70)

### [A1_core/interaction/states/base-state.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts)

**Klasy:**
- `class BaseState` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts#L5)
  - `constructor(ctx: CadModuleContext, stateMachine: StateMachine): void` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts#L9)
  - `onEnter(): void` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts#L17)
  - `onExit(): void` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts#L24)
  - `handleIntent(intent: Intent): void` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts#L33)
  - `onSelect(intent: Intent): void` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts#L57)
  - `onContextMenu(intent: Intent): void` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts#L58)
  - `onCancel(intent: Intent): void` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts#L59)
  - `onConfirm(intent: Intent): void` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts#L60)
  - `onDelete(_intent: Intent): void` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/base-state.ts#L61)

### [A1_core/interaction/states/draw-line-tool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/draw-line-tool.ts)

**Klasy:**
- `class DrawLineTool` *extends BaseState* [L4](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/draw-line-tool.ts#L4)
  - `onEnter(): void` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/draw-line-tool.ts#L6)
  - `onExit(): void` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/draw-line-tool.ts#L11)
  - `onSelect(intent: Intent): void` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/draw-line-tool.ts#L16)
  - `onContextMenu(intent: Intent): void` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/draw-line-tool.ts#L20)
  - `onCancel(intent: Intent): void` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/draw-line-tool.ts#L24)
  - `onConfirm(intent: Intent): void` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/draw-line-tool.ts#L29)

### [A1_core/interaction/states/extrude-tool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/extrude-tool.ts)

**Klasy:**
- `class ExtrudeTool` *extends BaseState* [L4](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/extrude-tool.ts#L4)
  - `onEnter(): void` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/extrude-tool.ts#L6)
  - `onExit(): void` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/extrude-tool.ts#L11)
  - `onSelect(intent: Intent): void` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/extrude-tool.ts#L16)
  - `onContextMenu(intent: Intent): void` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/extrude-tool.ts#L20)
  - `onCancel(intent: Intent): void` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/extrude-tool.ts#L24)
  - `onConfirm(intent: Intent): void` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/extrude-tool.ts#L29)

### [A1_core/interaction/states/selection-tool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/selection-tool.ts)

**Klasy:**
- `class SelectionTool` *extends BaseState* [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/selection-tool.ts#L6)
  - `onSelect(intent: Intent): void` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/selection-tool.ts#L8)
  - `onContextMenu(intent: Intent): void` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/selection-tool.ts#L28)
  - `onCancel(intent: Intent): void` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/selection-tool.ts#L33)
  - `onConfirm(intent: Intent): void` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/selection-tool.ts#L43)
  - `onDelete(_intent: Intent): void` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/interaction/states/selection-tool.ts#L48)

### [A1_core/modal-transform.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts)

**Klasy:**
- `class ModalTransformManager` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L24)
  - `init(): void` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L62)
  - `updateLiveValues(): void` [L120](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L120)
  - `startTransform(mode: ModalTransformMode): void` [L174](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L174)
  - `confirmTransform(): void` [L341](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L341)
  - `cancelTransform(): void` [L370](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L370)
  - `onStateChange(listener: (info: string | null) => void): () => void` [L403](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L403)
  - `subscribe(listener: (mode: ModalTransformMode) => void): () => void` [L408](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L408)
  - `toggleTransform(mode: ModalTransformMode): void` [L418](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L418)

**Typy i Modele Danych:**
- `type ModalTransformMode` = `'none' | 'translate' | 'rotate'` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L21)
- `type LockedAxis` = `'none' | 'x' | 'y' | 'z'` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/modal-transform.ts#L22)

### [A1_core/module-open-port.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/module-open-port.ts)

**Funkcje:**
- `export` `registerModuleOpenHandler(h: ModuleOpenHandler): void` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/module-open-port.ts#L22)
- `export` `getModuleOpenHandler(): ModuleOpenHandler | null` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/module-open-port.ts#L26)
- `export` `resetModuleOpenHandlerForTests(): void` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/module-open-port.ts#L30)

**Typy i Modele Danych:**
- `interface ModuleOpenHandler` { openCnc, openReport, openNesting, openSmartPartsStudio } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/module-open-port.ts#L12)
- `type ModuleOpenScope` = `{ type: 'CONTAINER' | 'PANEL' | 'PROJECT'; id: string; na...` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/module-open-port.ts#L6)

### [A1_core/node-cleanup-port.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/node-cleanup-port.ts)

**Funkcje:**
- `export` `registerNodeCleanupHandler(handler: NodeCleanupHandler): void` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/node-cleanup-port.ts#L17)
- `export` `collectNodeCleanupCommands(node: CADNode): Command[]` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/node-cleanup-port.ts#L23)
- `export` `resetNodeCleanupHandlersForTests(): void` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/node-cleanup-port.ts#L37)

**Typy i Modele Danych:**
- `interface NodeCleanupHandler` { id, collectIds, createClearCommand } [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/node-cleanup-port.ts#L9)

### [A1_core/offset-gizmo-port.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/offset-gizmo-port.ts)

**Funkcje:**
- `export` `registerOffsetGizmoHandler(handler: OffsetGizmoHandler): void` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/offset-gizmo-port.ts#L27)
- `export` `findOffsetGizmoHandler(role: string): OffsetGizmoHandler | null` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/offset-gizmo-port.ts#L33)
- `export` `resetOffsetGizmoHandlersForTests(): void` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/offset-gizmo-port.ts#L41)

**Typy i Modele Danych:**
- `interface OffsetShiftSpec` { paramSuffix, cadAxis, sign } [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/offset-gizmo-port.ts#L8)
- `interface OffsetGizmoHandler` { id, getFaceMapping, getShift, resolveContainer, resolveFrontParam, readOffsetMm, previewOffset, commitOffset } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/offset-gizmo-port.ts#L14)
- `type CadAxis` = `'X' | 'Y' | 'Z'` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/offset-gizmo-port.ts#L6)

### [A1_core/panel-like.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-like.ts)

**Funkcje:**
- `export` `isManualPanel(panel: any): boolean` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-like.ts#L20)
- `export` `isPanelLike(data: any): data is PanelLike` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-like.ts#L24)

**Typy i Modele Danych:**
- `interface PanelLike` { type, id, name, role, zoneId, width, height, thickness, +3 more } [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-like.ts#L5)

### [A1_core/panel-lookup.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-lookup.ts)

**Funkcje:**
- `isBlokiSubtree(node: CADNode): boolean` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-lookup.ts#L58)
- `export` `findCabinetPanels(2 params): PanelLookupCandidate[]` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-lookup.ts#L75)
- `export` `findCabinetPanel(cabinetNode: CADNode | null | undefined, query: PanelLookupQuery): PanelLookupResult` [L130](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-lookup.ts#L130)

**Typy i Modele Danych:**
- `interface PanelLookupQuery` { role, zoneId } [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-lookup.ts#L29)
- `interface PanelLookupCandidate` { node, panel } [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-lookup.ts#L38)
- `interface PanelLookupResult` { status, node, panel, candidatesCount, candidateKeys, candidateZoneIds, candidateNames, message } [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-lookup.ts#L43)
- `type CabinetPanelRole` = `| 'LEFT_SIDE_PANEL' | 'RIGHT_SIDE_PANEL' | 'BOTTOM_PANEL'...` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-lookup.ts#L22)
- `type PanelLookupStatus` = `'OK' | 'NOT_FOUND' | 'MULTIPLE_FOUND' | 'INVALID_ZONE'` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/panel-lookup.ts#L36)

### [A1_core/performance-config.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts)

**Klasy:**
- `class PerformanceConfigManager` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L36)
  - `getConfig(): PerformanceConfigData` [L135](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L135)
  - `subscribe(listener: (config: PerformanceConfigData) => void): () => void` [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L139)
  - `getActiveProfile(): string` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L157)
  - `setProfile(profileKey: 'low' | 'medium' | 'high' | 'auto', save: boolean): void` [L161](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L161)
  - `updateCurrent(partial: Partial<PerformanceConfigData['current']>, save: boolean): void` [L173](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L173)
  - `getHardwareScalingLevel(): number` [L188](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L188)
  - `getThrottleHoverMs(): number` [L192](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L192)
  - `getAntialias(): boolean` [L196](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L196)
  - `getPowerPreference(): 'high-performance' | 'default' | 'low-power'` [L200](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L200)
  - `getRenderOnDemand(): boolean` [L204](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L204)
  - `getPreferredEngine(): 'webgl2' | 'webgpu'` [L208](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L208)
  - `applyToEngine(engine: any): void` [L212](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L212)
  - `resetToDefaults(): void` [L220](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L220)

**Typy i Modele Danych:**
- `interface PerformanceProfile` { name, hardwareScalingLevel, antialias, throttleHoverMs, maxFps, renderOnDemand, powerPreference } [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L10)
- `interface PerformanceConfigData` { _v, activeProfile, profiles, current } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L20)

**Stałe i Słowniki:**
- `const PERF_CONFIG_STORAGE_KEY` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/performance-config.ts#L34)

### [A1_core/project-document.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts)

**Klasy:**
- `class ProjectDocument` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L86)
  - `constructor(options: ProjectDocumentOptions): void` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L107)
  - `isDirty(): boolean` [L135](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L135)
  - `markSaved(): void` [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L139)
  - `setActiveEntity(entity: DomainData | null): void` [L143](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L143)
  - `getTransformableTarget(entity: DomainData | null): { target: DomainData | null; isChildPanel: bool...` [L148](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L148)
  - `findNode(id: string): CADNode | null` [L192](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L192)
  - `getNodesByType(type: NodeType): CADNode[]` [L199](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L199)
  - `getPanels(): CADNode[]` [L206](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L206)
  - `getContainers(): CADNode[]` [L213](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L213)
  - `addNode(parentId: string, node: CADNode, index?: number): void` [L222](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L222)
  - `removeNode(nodeId: string): CADNode | null` [L258](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L258)
  - `reparentNode(3 params): void` [L278](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L278)
  - `createAssembly(options: Record<string, unknown>, parentId?: string): DomainData` [L328](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L328)
  - `createPanel(options: any, parentId?: string): DomainData` [L347](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L347)
  - `duplicateCADNode(sourceNodeId: string, offsetMm: { x: number; y: number; z: number }): CADNode | null` [L367](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L367)
  - `on(eventName: string, subscriber: Function): () => void` [L447](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L447)
  - `off(eventName: string, subscriber: Function): void` [L457](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L457)
  - `emit(eventName: string, args: any[]): void` [L461](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L461)
  - `onDocumentChanged(subscriber: DocumentChangeSubscriber): () => void` [L470](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L470)
  - `notifyDocumentChanged(affectedNodeIds?: string[]): void` [L475](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L475)
  - `emitChange(type: DocumentChangeType, affectedNodeIds?: string[]): void` [L479](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L479)
  - `registerExtension(key: string, extension: DocumentExtension): () => void` [L497](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L497)
  - `registerHydrator(nodeType: string, hydrator: DomainHydrator): () => void` [L502](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L502)
  - `registerFactory(nodeType: string, factory: DomainFactory): () => void` [L507](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L507)
  - `serialize(options?: SerializeOptions): ProjectDocumentJSON` [L546](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L546)
  - `reset(name): void` [L608](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L608)
  - `load(data: any, options?: LoadOptions): void` [L623](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L623)

**Typy i Modele Danych:**
- `interface DocumentChangeEvent` { type, affectedNodeIds, revision } [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L52)
- `interface ProjectDocumentOptions` { id, name, domainUnit } [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L60)
- `interface DocumentExtension` { serialize, load, includeInSnapshots } [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L71)
- `interface SerializeOptions` { snapshot } [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L78)
- `interface LoadOptions` { snapshot } [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L82)
- `type DocumentChangeType` = `'structure' | 'transform' | 'dimensions' | 'features' | '...` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L50)
- `type DocumentChangeSubscriber` = `(event: DocumentChangeEvent) => void` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L58)

**Stałe i Słowniki:**
- `const PROJECT_APP_VERSION` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-document.ts#L48)

### [A1_core/project-file-format.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-format.ts)

**Funkcje:**
- `export` `migrateProjectToCurrent(data: any): ProjectDocumentJSON` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-format.ts#L37)

**Typy i Modele Danych:**
- `interface ProjectMetadataJSON` { savedAt, appVersion } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-format.ts#L12)
- `interface ProjectDocumentJSON` { format, version, domainUnit, id, name, metadata, rootNode, extensions } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-format.ts#L18)

**Stałe i Słowniki:**
- `const PROJECT_FORMAT` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-format.ts#L8)
- `const PROJECT_FORMAT_VERSION` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-format.ts#L9)
- `const PROJECT_DOMAIN_UNIT` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-format.ts#L10)

### [A1_core/project-file-io.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts)

**Klasy:**
- `class ProjectFileIO` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L93)
  - `clearHandle(): void` [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L104)
  - `save(document: ProjectDocument): Promise<ProjectSaveMode>` [L108](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L108)
  - `saveAs(document: ProjectDocument): Promise<ProjectSaveMode>` [L136](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L136)
  - `open(): Promise<{ data: any; fileName: string } | null>` [L141](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L141)
  - `openFromFile(file: File): Promise<{ data: any; fileName: string }>` [L161](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L161)

**Funkcje:**
- `export` `suggestedProjectFileName(projectName?: string): string` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L35)
- `export` `stampProjectFileMetadata(json: ProjectDocumentJSON): ProjectDocumentJSON` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L40)
- `hasSavePicker(): boolean` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L50)
- `hasOpenPicker(): boolean` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L54)
- `export` `isUserAbort(err: unknown): boolean` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L58)
- `downloadTextFile(text: string, filename: string): void` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L62)
- `pickFileWithInput(): Promise<File | null>` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L75)
- `writeHandle(handle: NativeFileHandle, text: string): Promise<void>` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L87)

**Typy i Modele Danych:**
- `interface NativeFileHandle` { name, getFile, createWritable } [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L24)
- `type ProjectSaveMode` = `'native' | 'download'` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-file-io.ts#L33)

### [A1_core/project-schema.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts)

**Funkcje:**
- `export` `isSupportedFeatureType(type: string): type is SupportedFeatureType` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L40)
- `export` `validateFeatureType(feat: { type?: string; id?: number | string }): void` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L48)
- `export` `validatePanelFeatures(features: any[] | undefined): void` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L57)

**Typy i Modele Danych:**
- `interface Vector3D` { x, y, z } [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L23)
- `interface TransformJSON` { loc, rot } [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L29)
- `interface FeatureJSON` { id, type, name, visible, face, params } [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L64)
- `interface PartJSON` { id, parent_id, name, type, role, thickness, dims, transform, +2 more } [L91](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L91)
- `interface SmartFrameJSON` { id, parent_id, name, type, subtype, properties, transform, children } [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L107)
- `interface ProjectStateJSON` { project } [L126](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L126)
- `type NM` = `Nanometers` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L21)
- `type SupportedFeatureType` = `typeof SUPPORTED_FEATURE_TYPES[number]` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L37)
- `type PanelFeatureType` = `SupportedFeatureType` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L38)

**Stałe i Słowniki:**
- `const SUPPORTED_FEATURE_TYPES` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/project-schema.ts#L36)

### [A1_core/properties.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts)

**Klasy:**
- `class PropertiesManager` [L150](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L150)
  - `showProperties(data: PropertiesData): void` [L176](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L176)
  - `inspectMesh(5 params): PropertiesData | null` [L189](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L189)
  - `inspectFeature(7 params): PropertiesData | null` [L240](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L240)
  - `inspectPanel(panelModel: any, panelViews: Map<any, any>, emitEvent: boolean): PropertiesData | null` [L380](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L380)
  - `inspectContainer(container: any, emitEvent: boolean): PropertiesData | null` [L451](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L451)
  - `getContextMenuItems(data: PropertiesData, iconSvg?: string): any[]` [L513](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L513)
  - `addCustomProperty(4 params): void` [L534](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L534)
  - `removeCustomProperty(objectId: string, key: string): void` [L550](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L550)
  - `getCustomProperties(objectId: string): CustomProperty[]` [L563](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L563)
  - `updateCustomProperty(objectId: string, key: string, value: string): void` [L570](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L570)
  - `serializeCustomProperties(): Record<string, CustomProperty[]>` [L583](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L583)
  - `loadCustomProperties(data: Record<string, CustomProperty[]>): void` [L596](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L596)

**Funkcje:**
- `export` `safeMm(val: any, defaultVal): number` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L26)
- `modelNmToMm(val: any, defaultVal): number` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L34)

**Typy i Modele Danych:**
- `interface Vec3` { x, y, z } [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L42)
- `interface ItemTransform` { loc, worldLoc, rot, scale } [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L49)
- `interface HoleProperties` { diameter, depth, face, u, v } [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L57)
- `interface GrooveProperties` { width, length, depth, face, u, v, frameMm, frameHMm, +13 more } [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L66)
- `interface PanelProperties` { width, height, thickness } [L91](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L91)
- `interface ContainerProperties` { width, height, depth, panelCount } [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L98)
- `interface CustomProperty` { key, value, type } [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L106)
- `interface PropertiesData` { name, objectType, kind, parentName, featureId, panelId, containerId, transform, +5 more } [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L116)
- `type ObjectKind` = `'hole' | 'panel' | 'container' | 'fillet' | 'edge' | 'gro...` [L113](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/properties.ts#L113)

### [A1_core/quick-pick/quick-pick-detector.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-detector.ts)

**Funkcje:**
- `isMeshHierarchicallyEnabled(mesh: any): boolean` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-detector.ts#L10)
- `export` `formatFaceLabels(rawFaceName: string): { label: string; badge: string }` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-detector.ts#L19)
- `export` `findFacesAlongRay(scene: any, pointerX: number, pointerY: number): QuickPickCandidate[]` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-detector.ts#L45)

### [A1_core/quick-pick/quick-pick-events.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-events.ts)

**Funkcje:**
- `export` `openQuickPick(request: QuickPickRequest): void` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-events.ts#L12)
- `export` `closeQuickPick(): void` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-events.ts#L17)

**Stałe i Słowniki:**
- `const CAD_OPEN_QUICK_PICK` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-events.ts#L9)
- `const CAD_CLOSE_QUICK_PICK` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-events.ts#L10)

### [A1_core/quick-pick/quick-pick-preview.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-preview.ts)

**Klasy:**
- `class QuickPickPreview` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-preview.ts#L24)
  - `highlightCandidate(2 params): void` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-preview.ts#L41)
  - `clear(): void` [L185](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-preview.ts#L185)

**Typy i Modele Danych:**
- `interface SavedMeshState` { mesh, visibility, emissiveColor, diffuseColor, edgesWidth, edgesColor, edgesEnabled } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-preview.ts#L14)

### [A1_core/quick-pick/quick-pick-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-types.ts)

**Typy i Modele Danych:**
- `interface QuickPickCandidate` { index, mesh, distanceMm, deltaDistanceMm, worldPoint, worldNormal, faceName, faceLabel, +5 more } [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-types.ts#L7)
- `interface QuickPickRequest` { screenX, screenY, candidates, onSelect, onCancel } [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/quick-pick/quick-pick-types.ts#L36)

### [A1_core/selection-highlight.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-highlight.ts)

**Funkcje:**
- `export` `syncSelectionHighlights(ctx: CadModuleContext): void` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-highlight.ts#L15)
- `export` `setSelectionHighlightSuppressed(suppressed: boolean, ctx: CadModuleContext): void` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-highlight.ts#L41)
- `export` `applyTabSelectionPolicy(tabId?: string | null): void` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-highlight.ts#L50)

### [A1_core/selection-mode.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-mode.ts)

**Funkcje:**
- `export` `setConnectorsPlanePickActive(active: boolean): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-mode.ts#L34)
- `export` `isConnectorsPlanePickActive(): boolean` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-mode.ts#L38)
- `export` `getSelectionModeForTab(tabId: string | null | undefined): SelectionMode` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-mode.ts#L42)
- `export` `shouldPromoteSubgeometryToEntity(tabId: string | null | undefined): boolean` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-mode.ts#L53)
- `export` `shouldSuppressEntitySelectionHighlight(tabId: string | null | undefined): boolean` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-mode.ts#L64)

**Typy i Modele Danych:**
- `type SelectionMode` = `'object' | 'subgeometry'` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-mode.ts#L14)

**Stałe i Słowniki:**
- `const MODULE_SELECTION_MODES: Record<string, SelectionMode>` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-mode.ts#L16)

### [A1_core/selection-path.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-path.ts)

**Funkcje:**
- `export` `findFeatureOwner(doc: ProjectDocument, featureId: string | null | undefined): FeatureOwner | null` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-path.ts#L22)
- `export` `resolveFeatureId(doc: ProjectDocument, featureId: string | null | undefined): string | null` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-path.ts#L38)
- `export` `buildSelectionChain(doc: ProjectDocument, featureId: string | null | undefined): SelectionChain` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-path.ts#L50)

**Typy i Modele Danych:**
- `type FeatureOwner` = `{ node: CADNode; feature: any }` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-path.ts#L10)
- `type SelectionChain` = `{ /** Przodkowie od najwyższego złożenia do panelu włączn...` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-path.ts#L12)

### [A1_core/selection-tool-hooks-port.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-tool-hooks-port.ts)

**Funkcje:**
- `export` `registerSelectionToolHooks(partial: SelectionToolHooks): void` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-tool-hooks-port.ts#L15)
- `export` `getSelectionToolHooks(): SelectionToolHooks` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-tool-hooks-port.ts#L19)
- `export` `resetSelectionToolHooksForTests(): void` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-tool-hooks-port.ts#L23)

**Typy i Modele Danych:**
- `interface SelectionToolHooks` { deleteActiveAnnotation, cancelActivePick } [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/selection-tool-hooks-port.ts#L6)

### [A1_core/tooltip-manager.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/tooltip-manager.ts)

**Klasy:**
- `class TooltipManager` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/tooltip-manager.ts#L18)
  - `constructor(): void` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/tooltip-manager.ts#L31)
  - `registerTooltip(id: string, hint: ToolHint): void` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/tooltip-manager.ts#L57)
  - `getTooltip(id: string): ToolHint | undefined` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/tooltip-manager.ts#L64)
  - `setActiveHint(hint: ToolHint | string | null): void` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/tooltip-manager.ts#L71)
  - `clearActiveHint(): void` [L95](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/tooltip-manager.ts#L95)
  - `onChange(listener: (hint: ToolHint | null) => void): () => void` [L103](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/tooltip-manager.ts#L103)

**Typy i Modele Danych:**
- `interface ToolHint` { id, title, description, shortcut, confirmKey, cancelKey, category } [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/tooltip-manager.ts#L8)

### [A1_core/translations.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/translations.ts)

**Funkcje:**
- `export` `translateToPL(key: string): string` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/translations.ts#L45)

**Stałe i Słowniki:**
- `const TRANSLATIONS: Record<string, string>` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/translations.ts#L5)

### [A1_core/ui-controller.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts)

**Klasy:**
- `class UIController` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L26)
  - `constructor(document: ProjectDocument): void` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L64)
  - `_syncInputsFromActive(): void` [L95](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L95)
  - `handleInputChange(width: number, height: number, thickness: number): void` [L128](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L128)
  - `setStatus(text: string, active, kind: 'info' | 'error' | 'warning'): void` [L155](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L155)
  - `setConsole(msg: string): void` [L162](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L162)
  - `showSelectedFace(4 params): void` [L167](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L167)
  - `clearSelectedFace(): void` [L208](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L208)
  - `showSketchMode(_face?: any): void` [L212](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L212)
  - `hideSketchMode(): void` [L216](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L216)
  - `updateCursorCoords(uv: any): void` [L220](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L220)
  - `refreshFeatures(): void` [L230](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L230)
  - `onAddFillet(fn: () => void): void` [L234](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L234)
  - `onReset(fn: () => void): void` [L235](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L235)
  - `triggerAddFillet(): void` [L237](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L237)
  - `triggerReset(): void` [L238](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L238)
  - `onTreeAction(fn: (action: string, data: any) => void): void` [L240](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L240)
  - `emitTree(action: string, data: any): void` [L245](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L245)

**Funkcje:**
- `uiTx(key: string, vars?: Record<string, string | number>): string` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L11)

**Typy i Modele Danych:**
- `type UiTekstBag` = `Record<string, { pl?: string; en?: string; de?: string }>` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L7)

**Stałe i Słowniki:**
- `const PANEL_DIM_MIN_MM` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L23)
- `const PANEL_DIM_MAX_MM` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui-controller.ts#L24)

### [A1_core/ui/SmartNumericInput.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui/SmartNumericInput.tsx)

**Funkcje:**
- `export` `SmartNumericInput(1 params): any` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui/SmartNumericInput.tsx#L30)

**Typy i Modele Danych:**
- `interface SmartNumericInputProps` { value, onChange, min, max, step, decimals, style, className, +6 more } [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/ui/SmartNumericInput.tsx#L3)

### [A1_core/unit-system.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/unit-system.ts)

**Typy i Modele Danych:**
- `type Nanometers` = `number` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/unit-system.ts#L18)

**Stałe i Słowniki:**
- `const TO_NM` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/unit-system.ts#L21)

### [A1_core/view-port.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts)

**Funkcje:**
- `export` `registerContainerViewAdapter(2 params): void` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L33)
- `export` `registerPanelViewAdapter(adapter: PanelViewAdapter): void` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L49)
- `export` `registerGeometryUpdateHandler(handler: GeometryUpdateHandler): () => void` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L53)
- `export` `resetViewPort(): void` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L63)
- `export` `getGeometryUpdateHandlersCount(): number` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L69)
- `export` `createContainerView(scene: any, container: any): any` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L73)
- `export` `createPanelView(scene: any, panel: any): any` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L86)
- `export` `notifyBeforeRebuildGeometry(doc: any, containers: any[]): void` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L93)

**Typy i Modele Danych:**
- `interface ContainerViewAdapter` { createView } [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L6)
- `interface PanelViewAdapter` { createView } [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L10)
- `interface GeometryUpdateHandler` { updateBeforeRebuild } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L14)
- `interface RegisteredContainerView` { adapter, match } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L20)
- `type ContainerViewMatch` = `(container: any) => boolean` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/view-port.ts#L18)

### [A1_core/zone-helper.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/zone-helper.ts)

**Funkcje:**
- `export` `tryNormalizeToCanonicalZoneId(zoneInput?: string | null): CanonicalZoneId | null` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/zone-helper.ts#L19)
- `export` `normalizeToCanonicalZoneId(zoneInput?: string | null, fallback: CanonicalZoneId): CanonicalZoneId` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/zone-helper.ts#L66)
- `export` `getCanonicalZonePrefix(zoneInput?: string | null): CanonicalZonePrefix` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/zone-helper.ts#L74)

**Typy i Modele Danych:**
- `type CanonicalZoneId` = `'SEKCJA_B' | 'SEKCJA_M' | 'SEKCJA_T'` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/zone-helper.ts#L11)
- `type CanonicalZonePrefix` = `'B_' | 'M_' | 'T_'` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A1_core/zone-helper.ts#L12)

## <a id="a2_bloki"></a>A2 Bloki (Szafki, Moduły Wnętrz, Okucia, Intent Obróbek)

### [A2_bloki/01_base-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_base-engine.ts)

**Funkcje:**
- `export` `toDimensionsMm(dims: ModuleDims): BlokiDimensions_mm` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_base-engine.ts#L23)

**Typy i Modele Danych:**
- `type ModuleDims` = `BlokiDimensions_mm` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_base-engine.ts#L20)

### [A2_bloki/01_bloki-core.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts)

**Funkcje:**
- `export` `ensure_bloki_name(container: any, docTarget?: any): any` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L82)
- `findNodeById(root: any, nodeId: string): any | null` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L133)
- `findNodeByKey(root: any, partKey: string): any | null` [L148](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L148)
- `export` `getPanelFaceCoordinate(8 params): number` [L168](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L168)
- `export` `findPanelNodeByRef(refConfig: any, cabinetNode: any, doc: any): any` [L403](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L403)
- `export` `isOutlineFaceName(faceName: string | null | undefined): boolean` [L425](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L425)
- `export` `canonicalizeRefFaceName(faceName: string | null | undefined): string` [L429](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L429)
- `getOutline2dMm(panel: any): number[][] | null` [L439](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L439)
- `parseOutlineSideIndex(faceName: string): number | null` [L445](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L445)
- `distPointToSegment2d(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number` [L452](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L452)
- `outlineRotXDeg(panel: any): number` [L467](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L467)
- `panelOriginInCabinetMm(panelNode: any, cabinetNode: any): { x: number; y: number; z: number }` [L472](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L472)
- `outlineUvFlips(panel: any): { flipU: boolean; flipV: boolean }` [L487](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L487)
- `outlineUvToCabinetMm(panel: any, panelNode: any, cabinetNode: any, u: number, v: number): { x: number; y: number; z: number }` [L497](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L497)
- `getOutlineSegmentCabinetMm(panel: any, panelNode: any, cabinetNode: any, faceName: string): { mid: { x: number; y: number; z: number }; nor...` [L515](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L515)
- `transformLocalDirToCabinet(panel: any, panelNode: any, cabinetNode: any, localDir: Vec3): Vec3 | null` [L541](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L541)
- `dominantAxisFromDir(dir: Vec3): 'x' | 'y' | 'z'` [L578](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L578)
- `worldPickNormalToCabinetDir(2 params): Vec3 | null` [L587](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L587)
- `export` `getOutlineFaceCoordinate(5 params): number | null` [L599](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L599)
- `outlineUvFromPickedFace(3 params): { u: number; v: number } | null` [L613](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L613)
- `findClosestOutlineSideForSlot(5 params): string | null` [L629](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L629)
- `export` `getPanelFaceDominantAxis(5 params): 'x' | 'y' | 'z' | null` [L672](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L672)
- `getPanelFaceNormalInCabinet(panel: any, panelNode: any, cabinetNode: any, faceName: string): Vec3 | null` [L735](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L735)
- `isDominantAxisValidForSideKey(axis: 'x' | 'y' | 'z' | null, sideKey: string): boolean` [L773](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L773)
- `scoreFaceNormalAlignment(faceNormal: Vec3 | null, pickNormalCabinet: Vec3 | null): number` [L779](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L779)
- `isSlopedTopRef(panel: any, panelNode: any, cabinetNode: any, faceName?: string): boolean` [L787](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L787)
- `export` `resolveManualReferenceFace(7 params): { face: string; mapped: boolean }` [L807](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L807)
- `export` `validateReferenceFaceOrientation(7 params): { valid: boolean; errorMsg?: string; dominantAx...` [L882](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L882)
- `export` `resolveModulePlugin(boxType: BlokiModuleId | string): SmartModulePlugin<object> | null` [L1024](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L1024)
- `export` `update_bloki_core(container: any, docTarget: any): boolean` [L1041](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L1041)

**Typy i Modele Danych:**
- `type ReferenceValidationOptions` = `{ /** Ręczny pick — pomija kolizje z auto-ref z bay (pary...` [L724](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-core.ts#L724)

### [A2_bloki/01_bloki-height-h.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-height-h.ts)

**Funkcje:**
- `export` `isBlokiHeightHLocked(2 params): boolean` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-height-h.ts#L9)

**Stałe i Słowniki:**
- `const HEIGHT_H_LOCKED_HINT` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-height-h.ts#L5)

### [A2_bloki/01_bloki-module-param-guards.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts)

**Funkcje:**
- `assertNoLegacyKeys(3 params): void` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L122)
- `export` `assertCanonicalDoorsParams(raw: object | null | undefined): void` [L307](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L307)
- `export` `assertCanonicalSkosneDoorsParams(raw: object | null | undefined): void` [L311](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L311)
- `export` `assertCanonicalDrawersParams(raw: object | null | undefined): void` [L315](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L315)
- `export` `assertCanonicalFlapsParams(raw: object | null | undefined): void` [L319](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L319)
- `export` `assertCanonicalShelvesParams(raw: object | null | undefined): void` [L323](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L323)
- `export` `assertCanonicalCornerShelvesParams(raw: object | null | undefined): void` [L327](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L327)
- `export` `assertCanonicalShelfParams(raw: object | null | undefined): void` [L331](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L331)
- `export` `assertCanonicalDividersParams(raw: object | null | undefined): void` [L335](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L335)
- `export` `assertCanonicalPanelsParams(raw: object | null | undefined): void` [L339](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L339)
- `export` `assertCanonicalTubesParams(raw: object | null | undefined): void` [L343](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L343)
- `export` `assertCanonicalLedInternalParams(raw: object | null | undefined): void` [L347](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L347)
- `export` `assertCanonicalLedExternalParams(raw: object | null | undefined): void` [L351](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L351)
- `export` `readOptionalNumber(raw: object, key: string): number | undefined` [L355](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L355)
- `export` `isHingeEnabled(raw: object, index: number, defaultEnabled: boolean): boolean` [L362](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L362)

**Stałe i Słowniki:**
- `const LEGACY_DOORS_PARAM_ALIASES: Readonly<Record<string, string>>` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L52)
- `const LEGACY_SKOSNE_DOORS_PARAM_ALIASES: Readonly<Record<string, string>>` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L60)
- `const LEGACY_DRAWERS_PARAM_ALIASES: Readonly<Record<string, string>>` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L78)
- `const LEGACY_FLAPS_PARAM_ALIASES: Readonly<Record<string, string>>` [L102](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L102)
- `const LEGACY_SHELVES_PARAM_ALIASES: Readonly<Record<string, string>>` [L141](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L141)
- `const LEGACY_CORNER_SHELVES_PARAM_ALIASES: Readonly<Record<string, string>>` [L172](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L172)
- `const LEGACY_SHELF_PARAM_ALIASES: Readonly<Record<string, string>>` [L197](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L197)
- `const LEGACY_DIVIDERS_PARAM_ALIASES: Readonly<Record<string, string>>` [L213](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L213)
- `const LEGACY_PANELS_PARAM_ALIASES: Readonly<Record<string, string>>` [L223](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L223)
- `const LEGACY_TUBES_PARAM_ALIASES: Readonly<Record<string, string>>` [L261](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L261)
- `const LEGACY_LED_INTERNAL_PARAM_ALIASES: Readonly<Record<string, string>>` [L273](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L273)
- `const LEGACY_LED_EXTERNAL_PARAM_ALIASES: Readonly<Record<string, string>>` [L296](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-param-guards.ts#L296)

### [A2_bloki/01_bloki-module-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts)

**Funkcje:**
- `export` `isBlokiGeneratorParams(raw: unknown): raw is BlokiGeneratorParams` [L443](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L443)

**Typy i Modele Danych:**
- `interface DoorsPlanParams` { rodzaj_drzwi, grubosc_frontu_mm, szczelina_mm, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_lewe_mm, nalozenie_prawe_mm, domyslny_zawias_id, +19 more } [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L9)
- `interface SkosneDoorsPlanParams` { rodzaj_drzwi, grubosc_frontu_mm, szczelina_mm, dach_kat_deg, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_lewe_mm, nalozenie_prawe_mm, +56 more } [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L47)
- `interface DrawerRailConfig` { system, length } [L117](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L117)
- `interface DrawersPlanParams` { liczba_szuflad, grubosc_frontu_mm, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_lewe_mm, nalozenie_prawe_mm, dystans_lewy_mm, dystans_prawy_mm, +7 more } [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L122)
- `interface FlapsPlanParams` { kierunek_klapy, grubosc_frontu_mm, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_lewe_mm, nalozenie_prawe_mm, odsuniecie_zawiasu_lewe_mm, odsuniecie_zawiasu_prawe_mm, +6 more } [L140](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L140)
- `interface CornerDoorsPlanParams` { grubosc_frontu_mm, szczelina_srodkowa_mm, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_prawe_mm, nalozenie_lewe_mm, otwieranie, szablon_zawiasu_domyslny, +20 more } [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L157)
- `interface ShelvesPlanParams` { liczba_polek, grubosc_polki_mm, odsuniecie_przod_mm, luz_boczny_mm, wzor_nawiercen, odstep_otworow_przod_mm, odstep_otworow_tyl_mm, otwory_przod_aktywne, +8 more } [L190](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L190)
- `interface CornerShelvesPlanParams` { liczba_polek, grubosc_polki_mm, odsuniecie_przod_mm, luz_boczny_mm, bok_lewy_mm, bok_prawy_mm, wzor_nawiercen, odstep_otworow_przod_mm, +12 more } [L209](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L209)
- `interface ShelfPlanParams` { grubosc_wienca_mm, odsuniecie_przod_mm, odsuniecie_tyl_mm, luz_boczny_mm, baza_odniesienia, odstep_gora_mm, odstep_dol_mm } [L232](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L232)
- `interface DividersPlanParams` { liczba_przegrod, grubosc_przegrody_mm, tryb_rozstawu, szerokosci_wnek_mm } [L242](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L242)
- `interface PanelsPlanParams` { grubosc_blendy_mm, tryb_paneli_bocznych, wlacz_lewy, wlacz_prawy, wlacz_gorny, wlacz_dolny, auto_glebokosc_lewy, auto_glebokosc_prawy, +10 more } [L251](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L251)
- `interface TubesPlanParams` { odstep_gora_mm, pokaz_polke, przestrzen_nad_polka_mm, grubosc_polki_mm, srednica_drazka_mm } [L272](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L272)
- `interface LedInternalPlanParams` { wariant_led, profil_lewy, profil_prawy, profil_tyl, odsuniecie_od_przodu_lewe_mm, odsuniecie_od_przodu_prawe_mm, odsuniecie_tyl_od_srodka_mm, odsuniecie_od_przodu_mm, +4 more } [L288](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L288)
- `interface LedExternalPlanParams` { odsuniecie_od_przodu_mm, szerokosc_wpustu_mm, glebokosc_wpustu_mm, frezuj_boki } [L303](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L303)
- `interface BlokiModuleTypeById` { SHELVES, DOORS, SKOSNE_DOORS, CORNER_DOORS, CORNER_SHELVES, DRAWERS, FLAPS, DIVIDERS, +7 more } [L341](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L341)
- `interface BlokiPanelReference` { panelId, nodeId, partKey, nodeName, face, faceName } [L359](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L359)
- `interface BlokiGeneratorMetadata` { parentContainerId, boundary, detectedBay, targetZone, side_references_bloki, customReferences, disabledReferences, cornerAt, +7 more } [L370](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L370)
- `interface BlokiModuleParamsById` { SHELVES, DOORS, SKOSNE_DOORS, CORNER_DOORS, CORNER_SHELVES, DRAWERS, FLAPS, DIVIDERS, +7 more } [L388](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L388)
- `type HandlePlanParams` = `Partial<HandleParamsMm>` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L5)
- `type HingeIndex` = `1 | 2 | 3 | 4 | 5 | 6` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L7)
- `type SkosneDoorType` = `'LEFT' | 'RIGHT' | 'DOUBLE'` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L39)
- `type ShelfHolePattern` = `'NONE' | 'SINGLE' | 'TRIPLE' | 'ROW' | 'SYSTEM_32'` [L188](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L188)
- `type SidePanelMode` = `'FULL' | 'KORPUS_BLENDA_G' | 'COKOL_KORPUS' | 'KORPUS'` [L249](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L249)
- `type LedInternalVariant` = `| 'VERTICAL_BOTH_SIDES' | 'VERTICAL_LEFT_SIDE' | 'VERTICA...` [L280](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L280)
- `type LedPlanParams` = `| (LedInternalPlanParams & { category?: 'internal'; boxTy...` [L310](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L310)
- `type BlokiModuleId` = `| 'SHELVES' | 'DOORS' | 'SKOSNE_DOORS' | 'CORNER_DOORS' |...` [L324](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L324)
- `type BlokiReferenceSide` = `'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax'` [L368](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L368)
- `type BlokiGeneratorParams` = `BlokiGeneratorMetadata & { boxType: 'EMPTY'; type: 'blok_...` [L406](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L406)
- `type BlokiGeneratorParamsPatch` = `Partial<BlokiGeneratorMetadata> & ( | { boxType?: 'EMPTY'...` [L415](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-module-types.ts#L415)

### [A2_bloki/01_bloki-rules-helper.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-rules-helper.ts)

**Funkcje:**
- `export` `resolveRuleThicknessMm(4 params): number` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-rules-helper.ts#L18)

### [A2_bloki/01_bloki-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-types.ts)

**Typy i Modele Danych:**
- `interface BlokiDimensions_mm` { width_mm, height_mm, depth_mm } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-types.ts#L12)
- `interface BlokiLcsDefinition` { mapping, rotation, faces } [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-types.ts#L43)
- `interface BlokiPart` { id, key, name, role, nodeType, material, materialName, materialCode, +9 more } [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-types.ts#L49)
- `interface BlokiHardware` { id, name, role, hardwareType, hardwareId, side, loc, rotation, +3 more } [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-types.ts#L69)
- `interface BlokiPlanResult` { parts, hardware } [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-types.ts#L83)
- `type BlokiPartRole` = `| 'FRONT' // Front meblowy (drzwi, front szuflady) | 'FLA...` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-types.ts#L18)

### [A2_bloki/01_bloki-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx)

**Funkcje:**
- `boxTypeFromParams(p: any): string` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx#L34)
- `isApplianceContainer(model: any): boolean` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx#L58)
- `isBlokiOrHangersContainer(model: any): boolean` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx#L66)
- `isHangersGroupContainer(model: any): boolean` [L77](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx#L77)
- `isHandleContainer(model: any): boolean` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx#L84)
- `export` `BlokiUI({ projectModel }: Props): any` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx#L93)

**Typy i Modele Danych:**
- `interface Props` { projectModel } [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bloki-ui.tsx#L30)

### [A2_bloki/01_bootstrap-bloki-modules.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bootstrap-bloki-modules.ts)

**Funkcje:**
- `export` `registerAllBlokiModules(): void` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_bootstrap-bloki-modules.ts#L25)

### [A2_bloki/01_hinge-brand-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_hinge-brand-ui.tsx)

**Funkcje:**
- `export` `HingeBrandFilter(props: { value: string; label: string; onChange: (bran...): React.ReactElement` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_hinge-brand-ui.tsx#L28)
- `export` `hingeOptionsForBrand(brand: string, scope: HingeCatalogScope): HardwareItem[]` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_hinge-brand-ui.tsx#L56)
- `export` `firstHingeIdForBrand(brand: string, scope: HingeCatalogScope, fallbackId: string): string` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_hinge-brand-ui.tsx#L60)
- `export` `renderHingeSelectOptions(brand: string, scope: HingeCatalogScope): React.ReactNode` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_hinge-brand-ui.tsx#L65)

### [A2_bloki/01_machining-intent.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts)

**Funkcje:**
- `export` `buildGrooveMachiningIntent(opts: GrooveMachiningIntentOptions): MachiningIntent<MachiningGrooveFeature>` [L200](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L200)
- `export` `isOwnedGroove(feature: any, source: MachiningGrooveSource, channelId: string): boolean` [L233](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L233)
- `export` `buildHoleMachiningIntent(opts: HoleMachiningIntentOptions): MachiningIntent<MachiningHoleFeature>` [L273](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L273)
- `export` `isOwnedHole(feature: any, ownerTag: MachiningHoleOwnerTag): boolean` [L316](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L316)

**Typy i Modele Danych:**
- `interface MachiningDrivenBy` { nodeId, role, hardwareType, partKey, containerId } [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L35)
- `interface MachiningGrooveParams` { source, channel_id, u, v, width, length, depth, sourceContainerId, +1 more } [L76](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L76)
- `interface MachiningGrooveFeature` { id, type, face, name, drivenBy, rule, generatedBy, params } [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L93)
- `interface MachiningHoleParams` { template_id, u, v, u_mm, v_mm, diameter, diameter_mm, depth, +12 more } [L126](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L126)
- `interface MachiningHoleFeature` { id, type, face, side, name, drivenBy, rule, generatedBy, +1 more } [L154](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L154)
- `interface MachiningIntent` { targetNodeId, feature } [L170](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L170)
- `interface GrooveMachiningIntentOptions` { targetNodeId, id, source, channelId, sourceContainerId, face, name, drivenBy, +7 more } [L176](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L176)
- `interface HoleMachiningIntentOptions` { targetNodeId, id, face, side, template_id, name, drivenBy, rule, +14 more } [L239](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L239)
- `type MachiningKind` = `'groove' | 'hole' | 'pocket'` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L21)
- `type MachiningFace` = `| 'FACE_X_PLUS' | 'FACE_X_MINUS' | 'FACE_Y_PLUS' | 'FACE_...` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L23)
- `type MachiningGeneratorId` = `| 'blok_doors' | 'blok_shelves' | 'blok_corner_shelves' |...` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L49)
- `type MachiningRule` = `| 'shelf_pin' // Otwory w boku korpusu pod podpórkę półki...` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L61)
- `type MachiningGrooveSource` = `'BLOKI_LED' | 'assembly_led_channel'` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L74)
- `type MachiningFeature` = `MachiningGrooveFeature | MachiningHoleFeature` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L107)
- `type MachiningHoleOwnerTag` = `| 'isDoorDrilling' | 'isFlapDrilling' | 'isShelfDrilling'...` [L117](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-intent.ts#L117)

### [A2_bloki/01_machining-sync.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-sync.ts)

**Funkcje:**
- `export` `syncMachiningHoles(5 params): Set<string>` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-sync.ts#L28)
- `export` `syncMachiningGroovePlans(4 params): Set<string>` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-sync.ts#L87)
- `export` `emitMachiningFeatures(panels: any[], changedNodeIds: Set<string>): void` [L112](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-sync.ts#L112)
- `export` `restoreMachiningFeatures(document: ProjectDocument, oldFeatures: Map<string, any[]>): void` [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-sync.ts#L129)

**Typy i Modele Danych:**
- `interface MachiningSyncIntent` { targetNodeId, feature } [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_machining-sync.ts#L16)

### [A2_bloki/01_module-plans.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts)

**Funkcje:**
- `export` `buildShelvesPlan(params: ShelvesPlanParams, dims: ModuleDims): BlokiPlanResult` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L48)
- `export` `buildShelfPlan(params: ShelfPlanParams, dims: ModuleDims): BlokiPlanResult` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L54)
- `export` `buildDoorsPlan(params: DoorsPlanParams, dims: ModuleDims): BlokiPlanResult` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L60)
- `export` `buildSkosneDoorsPlan(params: SkosneDoorsPlanParams, dims: ModuleDims): BlokiPlanResult` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L66)
- `export` `buildCornerDoorsPlan(params: CornerDoorsPlanParams, dims: ModuleDims): BlokiPlanResult` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L73)
- `export` `buildCornerShelvesPlan(params: CornerShelvesPlanParams, dims: ModuleDims): BlokiPlanResult` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L80)
- `export` `buildTubesPlan(params: TubesPlanParams, dims: ModuleDims): BlokiPlanResult` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L86)
- `export` `buildDrawersPlan(params: DrawersPlanParams, dims: ModuleDims): BlokiPlanResult` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L92)
- `export` `buildDividersPlan(params: DividersPlanParams, dims: ModuleDims): BlokiPlanResult` [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L98)
- `export` `buildPanelsPlan(params: PanelsPlanParams, dims: ModuleDims): BlokiPlanResult` [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L104)
- `export` `buildFlapsPlan(params: FlapsPlanParams, dims: ModuleDims): BlokiPlanResult` [L110](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L110)
- `export` `buildLedInternalPlan(params: LedInternalPlanParams, dims: ModuleDims): BlokiPlanResult` [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L116)
- `export` `buildLedExternalPlan(params: LedExternalPlanParams, dims: ModuleDims): BlokiPlanResult` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L122)
- `export` `buildLedPlan(params: LedPlanParams, dims: ModuleDims): BlokiPlanResult` [L128](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L128)
- `export` `buildHangersPlan(params: HangersPlanParams, dims: ModuleDims): BlokiPlanResult` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_module-plans.ts#L133)

### [A2_bloki/01_register.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_register.ts)

**Funkcje:**
- `collectHangerCleanupEntries(node: CADNode): Array<{ sourceId: string; meshIds: string[] }>` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_register.ts#L40)
- `hydrateFeatureDomain(raw: any, nodeJson: any): any` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_register.ts#L52)
- `export` `registerBlokiModule(): void` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_register.ts#L71)

### [A2_bloki/01_smartparts-catalog.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts)

**Funkcje:**
- `barBaseTemplate(): HandleTemplateItem` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L92)
- `export` `buildHandleCatalog(): HandleCatalogItem[]` [L97](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L97)
- `buildHandleCatalogFromB1(): HandleCatalogItem[]` [L174](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L174)
- `export` `handleCatalogSizeKey(item: HandleCatalogItem): number` [L210](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L210)
- `matchesHandleFilters(3 params): boolean` [L221](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L221)
- `ensureNoneOption(options: T[]): T[]` [L237](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L237)
- `ensureCurrentOption(3 params): { id: string; label: string }[]` [L243](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L243)
- `export` `listHandleTypeFilterOptions(opts: Omit<HandleCatalogFilters, 'type'>, current?: HandleTypeFilter): { id: string; label: string }[]` [L253](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L253)
- `export` `listHandleProducerFilterOptions(2 params): { id: string; label: string }[]` [L265](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L265)
- `export` `listHandleModelFilterOptions(opts: Omit<HandleCatalogFilters, 'model'>, current?: HandleModelFilter): { id: string; label: string }[]` [L277](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L277)
- `export` `listHandleSizeFilterOptions(opts: Omit<HandleCatalogFilters, 'sizeMm'>, current?: HandleSizeFilter): { id: string; label: string }[]` [L299](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L299)
- `export` `filterHandleCatalog(opts: HandleCatalogFilters & { searchQuery: string }): HandleCatalogItem[]` [L322](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L322)
- `export` `handleItemToTemplate(2 params): HandleTemplateItem` [L336](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L336)
- `export` `hangerCatalogDedupKey(id: string, name?: string): string` [L386](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L386)
- `export` `buildHangerCatalog(): HangerCatalogItem[]` [L400](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L400)
- `export` `filterHangerCatalog(opts: { searchQuery: string }): HangerCatalogItem[]` [L447](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L447)
- `export` `hangerItemToTemplate(item: HangerCatalogItem): HangerTemplateItem` [L458](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L458)
- `export` `filterHookCatalog(opts: { hookKind: string; producer: string; model: st...): HookCatalogItem[]` [L512](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L512)
- `export` `filterLightCatalog(opts: { lightKind: string; producer: string; searchQu...): LightCatalogItem[]` [L550](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L550)
- `export` `filterSwitchCatalog(opts: { switchKind: string; producer: string; model: ...): SwitchCatalogItem[]` [L595](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L595)

**Typy i Modele Danych:**
- `interface HandleCatalogItem` { id, name, subtitle, badge, type, producerId, seriesId, holeDistanceMm, +7 more } [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L42)
- `interface HookCatalogItem` { id, name, subtitle, badge, hookKind, producerId, modelId, dragEnabled } [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L60)
- `interface LightCatalogItem` { id, name, subtitle, badge, lightKind, producerId, dragEnabled } [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L71)
- `interface SwitchCatalogItem` { id, name, subtitle, badge, switchKind, producerId, modelId, dragEnabled } [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L81)
- `interface HandleCatalogFilters` { type, producer, model, sizeMm } [L214](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L214)
- `interface HangerCatalogItem` { id, name, subtitle, badge, brand, seriesId, glbModelPath, fromTopMm, +11 more } [L361](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L361)
- `type SmartPartSection` = `'HANDLES' | 'HANGERS' | 'HOOKS' | 'LIGHTS' | 'SWITCHES'` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L23)
- `type HandleFilterNone` = `typeof HANDLE_FILTER_NONE` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L34)
- `type HandleTypeFilter` = `HandleType | HandleFilterNone` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L36)
- `type HandleProducerFilter` = `HandleProducerId | HandleFilterNone` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L37)
- `type HandleModelFilter` = `string | HandleFilterNone` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L38)
- `type HandleSizeFilter` = `number | HandleFilterNone` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L39)

**Stałe i Słowniki:**
- `const SMARTPART_SECTIONS: { id: SmartPartSection; label: string }[]` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L25)
- `const HANDLE_FILTER_NONE` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L33)
- `const HOOK_TYPE_FILTERS` [L481](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L481)
- `const HOOK_PRODUCER_FILTERS` [L488](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L488)
- `const HOOK_MODEL_FILTERS` [L493](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L493)
- `const LIGHT_TYPE_FILTERS` [L530](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L530)
- `const LIGHT_PRODUCER_FILTERS` [L537](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L537)
- `const SWITCH_TYPE_FILTERS` [L566](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L566)
- `const SWITCH_PRODUCER_FILTERS` [L573](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L573)
- `const SWITCH_MODEL_FILTERS` [L578](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/01_smartparts-catalog.ts#L578)

### [A2_bloki/02_bay-reference-walls-panel.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bay-reference-walls-panel.tsx)

**Funkcje:**
- `export` `BayReferenceWallsPanel(1 params): React.JSX.Element | null` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bay-reference-walls-panel.tsx#L44)

**Typy i Modele Danych:**
- `interface BayReferenceWallsPanelProps` { container, defaultOpen, onParamsPatch } [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bay-reference-walls-panel.tsx#L27)
- `type BayRefsParamsPatch` = `{ customReferences?: Record<string, any>; disabledReferen...` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bay-reference-walls-panel.tsx#L20)

### [A2_bloki/02_bloki-bay-actions.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts)

**Klasy:**
- `class InsertBlokiCommand` *implements Command* [L324](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L324)
  - `constructor(targetParentId: string, sbNode: CADNode, label: string): void` [L335](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L335)
  - `execute(document: ProjectDocument): void` [L346](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L346)
  - `undo(document: ProjectDocument): void` [L351](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L351)
  - `redo(document: ProjectDocument): void` [L361](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L361)

**Funkcje:**
- `createBlokiGeneratorParams(5 params): BlokiGeneratorParams` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L83)
- `export` `createBlokInDetectedBay(4 params): CADNode | null` [L367](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L367)

**Typy i Modele Danych:**
- `interface BlokiModalParams` { liczba_polek, odsuniecie_przod_mm, luz_boczny_mm, grubosc_polki_mm, podporka_id, wzor_nawiercen, rozstaw_potrojny_z_mm, otwory_przod_aktywne, +67 more } [L218](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L218)
- `type BlokiCategory` = `'internal' | 'external' | 'panel'` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L33)
- `type BlokiOption` = `{ [ModuleId in BlokiModuleId]: { id: ModuleId; type: Blok...` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L35)

**Stałe i Słowniki:**
- `const BLOKI_INTERNAL_OPTIONS: BlokiOption[]` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L53)
- `const BLOKI_EXTERNAL_OPTIONS: BlokiOption[]` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L67)
- `const BLOKI_PANEL_OPTIONS: BlokiOption[]` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L72)
- `const BLOKI_ALL_OPTIONS: BlokiOption[]` [L77](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L77)
- `const BLOKI_CATEGORY_NAMES: Record<string, string>` [L298](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-actions.ts#L298)

### [A2_bloki/02_bloki-bay-controller.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts)

**Klasy:**
- `class BlokiBayController` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L23)
  - `setActiveHandleTemplate(tpl: Partial<HandleParamsMm> | null): void` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L42)
  - `setPickerMode(mode: BlokiPickerMode): void` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L46)
  - `setLastDetectedBay(bay: DetectedBay | null): void` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L63)
  - `setLastDetectedSurface(surface: DetectedPanelSurface | null): void` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L71)
  - `startPicker(pendingType?: string, mode?: BlokiPickerMode): void` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L75)
  - `stopPicker(keepHighlight: boolean): void` [L95](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L95)
  - `togglePicker(pendingType?: string, mode: BlokiPickerMode): void` [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L106)
  - `subscribePicker(callback: BayPickerListener): () => void` [L114](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L114)
  - `startDrag(blokType: string, mode?: BlokiPickerMode): void` [L148](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L148)
  - `endDrag(keepHighlight: boolean): void` [L161](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L161)
  - `setPendingBlokType(type: string | null): void` [L171](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L171)
  - `isBayDrag(): boolean` [L177](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L177)
  - `onPointerMoveOnScene(scene: any, pointerX: number, pointerY: number, doc: ProjectDocument): DetectedBay | null` [L181](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L181)
  - `onDropOnScene(): void` [L231](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L231)
  - `notifyBayDetected(bay: DetectedBay, keepHighlight: boolean): void` [L252](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L252)
  - `subscribeBayDetected(callback: BayDetectedListener): () => void` [L265](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L265)
  - `notifyPanelDetected(surface: DetectedPanelSurface): void` [L272](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L272)
  - `subscribePanelDetected(callback: PanelDetectedListener): () => void` [L286](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L286)

**Typy i Modele Danych:**
- `type BlokiPickerMode` = `'internal' | 'external' | 'panel'` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L18)
- `type BayPickerListener` = `(isActive: boolean, mode?: BlokiPickerMode) => void` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L19)
- `type BayDetectedListener` = `(bay: DetectedBay) => void` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L20)
- `type PanelDetectedListener` = `(surface: DetectedPanelSurface) => void` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-controller.ts#L21)

### [A2_bloki/02_bloki-bay-detector.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts)

**Funkcje:**
- `withDerivedLrSlopeHeights(bay: DetectedBay): DetectedBay` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L69)
- `export` `resolveDetectedBay(2 params): DetectedBay | null` [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L106)
- `findKorpusContainer(start: CADNode | null, document: ProjectDocument): CADNode | null` [L175](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L175)
- `isNodeUnderCabinet(node: CADNode | null, cabinetId: string | undefined): boolean` [L194](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L194)
- `extractRoofAngleDeg(3 params): number | undefined` [L204](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L204)
- `smartFrameFrontPlaneYMm(cabNode: CADNode, depthMm: number): number` [L231](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L231)
- `export` `isBayDividingPanel(role?: string, name?: string): boolean` [L240](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L240)
- `collectScenePanelFaces(document: ProjectDocument): PanelFaceInfo[]` [L260](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L260)
- `export` `probeBayFromCADPoint(3 params): DetectedBay | null` [L777](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L777)
- `export` `detectCabinetOuterHull(2 params): DetectedBay | null` [L1129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L1129)
- `export` `probeBayFromSceneRay(4 params): DetectedBay | null` [L1384](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L1384)

**Typy i Modele Danych:**
- `interface FaceHitRef` { nodeId, nodeName, face, faceName, worldPointMm, planeCoordMm, slopeAngleDeg } [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L16)
- `interface DetectedBay` { boundsMm, boundsNm, centerWorldMm, parentCabinetId, roofAngleDeg, slopeAxis, roofAngleDepthDeg, heightLeftMm, +4 more } [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L36)
- `interface PanelFaceInfo` { node, panel, face, worldCenterMm, worldNormal, minBoundsMm, maxBoundsMm } [L164](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L164)
- `type BayBoundary` = `{ left: FaceHitRef; right: FaceHitRef; bottom: FaceHitRef...` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L26)
- `type SlimDetectedBay` = `Omit<DetectedBay, 'boundary'>` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-detector.ts#L63)

### [A2_bloki/02_bloki-bay-visualizer.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-visualizer.ts)

**Funkcje:**
- `export` `highlightBayInScene(scene: any, bay: DetectedBay): void` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-visualizer.ts#L28)
- `export` `clearBayHighlight(scene?: any): void` [L243](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-bay-visualizer.ts#L243)

### [A2_bloki/02_bloki-offset-gizmo.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-offset-gizmo.ts)

**Funkcje:**
- `export` `registerBlokiOffsetGizmo(): void` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-offset-gizmo.ts#L52)

### [A2_bloki/02_bloki-ref-plane-hint.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts)

**Funkcje:**
- `getBabylon(): any` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts#L35)
- `export` `clearBlokiRefPlaneHint(): void` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts#L39)
- `export` `getBlokiRefFacePlacement(7 params): FacePlacement` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts#L72)
- `resolveRefForSide(3 params): { partKey?: string; face?: string; panelId?: st...` [L141](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts#L141)
- `highlightAssignedPanelFace(ref: { partKey?: string; face?: string; panelId?: st...): void` [L159](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts#L159)
- `export` `highlightBlokiRefSide(3 params): void` [L201](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts#L201)

**Typy i Modele Danych:**
- `type BlokiRefSideKey` = `'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax'` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts#L12)
- `type FacePlacement` = `{ planeW: number; planeH: number; lx: number; ly: number;...` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts#L60)

**Stałe i Słowniki:**
- `const BLOKI_REF_SIDE_LABELS: Record<BlokiRefSideKey, string>` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/02_bloki-ref-plane-hint.ts#L14)

### [A2_bloki/03_shelf-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/03_shelf-adapter.tsx)

**Funkcje:**
- `getContainerHeightMm(container: any): number` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/03_shelf-adapter.tsx#L26)
- `export` `ShelfSubModule(1 params): any` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/03_shelf-adapter.tsx#L39)

### [A2_bloki/03_shelf-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/03_shelf-engine.ts)

**Funkcje:**
- `export` `normalizeShelfParams(raw: ShelfPlanParams, dims?: BlokiDimensions_mm): NormalizedShelfParams` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/03_shelf-engine.ts#L44)
- `export` `calculateShelfPlan(dims: BlokiDimensions_mm, params: NormalizedShelfParams): BlokiPlanResult` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/03_shelf-engine.ts#L82)

**Typy i Modele Danych:**
- `interface NormalizedShelfParams` { grubosc_wienca_mm, odsuniecie_przod_mm, odsuniecie_tyl_mm, luz_boczny_mm, baza_odniesienia, odstep_gora_mm, odstep_dol_mm } [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/03_shelf-engine.ts#L29)

### [A2_bloki/04_shelves-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-adapter.tsx)

**Funkcje:**
- `export` `ShelvesSubModule(1 params): any` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-adapter.tsx#L27)

### [A2_bloki/04_shelves-drilling-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-drilling-builder.ts)

**Funkcje:**
- `export` `buildShelvesDrillings(document: ProjectDocument, cabinetContainerId?: string): ShelvesDrillingIntent[]` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-drilling-builder.ts#L20)

### [A2_bloki/04_shelves-drilling-intent.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-drilling-intent.ts)

**Typy i Modele Danych:**
- `type ShelvesDrillingFeature` = `MachiningHoleFeature` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-drilling-intent.ts#L14)
- `type ShelvesDrillingIntent` = `MachiningIntent<ShelvesDrillingFeature>` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-drilling-intent.ts#L16)
- `type ShelvesDrillingFace` = `MachiningHoleFeature['face']` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-drilling-intent.ts#L18)

### [A2_bloki/04_shelves-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-engine.ts)

**Funkcje:**
- `export` `equalShelfBay(3 params): number` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-engine.ts#L55)
- `export` `equalShelfCenterZ(4 params): number` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-engine.ts#L65)
- `export` `normalizeShelvesParams(raw: ShelvesPlanParams, dims?: BlokiDimensions_mm): NormalizedShelvesParams` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-engine.ts#L78)
- `export` `calculateShelvesPlan(dims: BlokiDimensions_mm, params: NormalizedShelvesParams): BlokiPlanResult` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-engine.ts#L132)

**Typy i Modele Danych:**
- `interface NormalizedShelvesParams` { liczba_polek, grubosc_polki_mm, odsuniecie_przod_mm, luz_boczny_mm, wzor_nawiercen, odstep_otworow_przod_mm, odstep_otworow_tyl_mm, otwory_przod_aktywne, +8 more } [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-engine.ts#L33)
- `type HolePatternType` = `'NONE' | 'SINGLE' | 'TRIPLE' | 'ROW' | 'SYSTEM_32'` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/04_shelves-engine.ts#L31)

### [A2_bloki/05_doors-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-adapter.tsx)

**Funkcje:**
- `toNum(val: string | number | undefined, fallback): number` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-adapter.tsx#L35)
- `dimToMm(raw: number | undefined): number` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-adapter.tsx#L40)
- `calculateDoorWeightAndHinges(opts: { sbWidth: number; sbHeight: number; doorType: ...): { weightKg: number; suggestedHingesPerLeaf: num...` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-adapter.tsx#L45)
- `export` `countActiveDoorHingesPerLeaf(p: DoorsPlanParams): number` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-adapter.tsx#L81)
- `isDoorHingeOutOfPanel(opts: { posMm: number; fromTop: boolean; sbHeight: nu...): boolean` [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-adapter.tsx#L98)
- `export` `normalizeDoorType(val: string | undefined): 'LEFT' | 'RIGHT' | 'DOUBLE'` [L121](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-adapter.tsx#L121)
- `export` `DoorsSubModule(1 params): any` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-adapter.tsx#L132)

### [A2_bloki/05_doors-drilling-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-drilling-builder.ts)

**Funkcje:**
- `export` `buildDoorsDrillings(document: ProjectDocument, cabinetContainerId?: string): DoorsDrillingIntent[]` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-drilling-builder.ts#L20)

### [A2_bloki/05_doors-drilling-intent.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-drilling-intent.ts)

**Typy i Modele Danych:**
- `type DoorsDrillingFeature` = `MachiningHoleFeature` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-drilling-intent.ts#L15)
- `type DoorsDrillingIntent` = `MachiningIntent<DoorsDrillingFeature>` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-drilling-intent.ts#L17)
- `type DoorsDrillingFace` = `MachiningHoleFeature['face']` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-drilling-intent.ts#L19)

### [A2_bloki/05_doors-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts)

**Funkcje:**
- `export` `suggestHingesPerLeaf(doorHeight_mm: number, leafWeightKg: number): number` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts#L69)
- `export` `resolveActiveHinges(raw: DoorsPlanParams, wysokosc_strefy_mm: number): ActiveHingeConfig[]` [L76](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts#L76)
- `export` `normalizeDoorsParams(raw: DoorsPlanParams, dims: BlokiDimensions_mm): NormalizedDoorsParams` [L91](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts#L91)
- `export` `resolveHingeId(3 params): string` [L140](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts#L140)
- `export` `calculateDoorsPlan(dims: BlokiDimensions_mm, params: NormalizedDoorsParams): BlokiPlanResult` [L163](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts#L163)

**Typy i Modele Danych:**
- `interface ActiveHingeConfig` { index, pozycja_lokalna_z_mm, szablon_id } [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts#L34)
- `interface NormalizedDoorsParams` { rodzaj_drzwi, grubosc_frontu_mm, szczelina_mm, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_lewe_mm, nalozenie_prawe_mm, domyslny_zawias_id, +2 more } [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts#L40)
- `type DoorType` = `'LEFT' | 'RIGHT' | 'DOUBLE'` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/05_doors-engine.ts#L32)

### [A2_bloki/06_skosne-doors-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-adapter.tsx)

**Funkcje:**
- `export` `normalizeSkosneDoorType(val: string | undefined): SkosneDoorType` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-adapter.tsx#L46)
- `dimToMm(raw: number | undefined): number` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-adapter.tsx#L53)
- `export` `isHingeSideAllowed(side: SkosneDoorType, dach_kat_deg: number | undefined): boolean` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-adapter.tsx#L59)
- `export` `resolveCarcassRoofAngle(containerId?: string): number | undefined` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-adapter.tsx#L69)
- `export` `resolveCarcassRails(containerId?: string): { tBot?: number; tTop?: number }` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-adapter.tsx#L86)
- `export` `SkosneDoorsSubModule(1 params): any` [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-adapter.tsx#L106)

### [A2_bloki/06_skosne-doors-drilling-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-drilling-builder.ts)

**Funkcje:**
- `export` `buildSkosneDoorsDrillings(document: ProjectDocument, cabinetContainerId?: string): SkosneDoorsDrillingIntent[]` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-drilling-builder.ts#L28)

### [A2_bloki/06_skosne-doors-drilling-intent.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-drilling-intent.ts)

**Typy i Modele Danych:**
- `type SkosneDoorsDrillingFeature` = `MachiningHoleFeature` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-drilling-intent.ts#L14)
- `type SkosneDoorsDrillingIntent` = `MachiningIntent<SkosneDoorsDrillingFeature>` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-drilling-intent.ts#L16)
- `type SkosneDoorsDrillingFace` = `MachiningHoleFeature['face']` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-drilling-intent.ts#L18)

### [A2_bloki/06_skosne-doors-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts)

**Funkcje:**
- `assertHingeOnVerticalEdge(type: SkosneDoorType, dach_kat_deg: number): void` [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L90)
- `export` `areSkosneDoorLeavesEqual(roofAngleDeg: number | undefined, width_mm: number): boolean` [L105](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L105)
- `export` `normalizeSkosneDoorsParams(raw: SkosneDoorsPlanParams, dims: BlokiDimensions_mm): NormalizedSkosneDoorsParams | null` [L119](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L119)
- `export` `skosneHeightAtX(5 params): number` [L295](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L295)
- `export` `skosneDoorHeightAt(8 params): number` [L309](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L309)
- `export` `skosBetaRad(dach_kat_deg: number): number` [L329](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L329)
- `export` `skosRailVerticalSpanMm(grubosc_wience_mm: number, dach_kat_deg: number): number` [L336](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L336)
- `export` `skosTopOverlapRiseMm(nalozenie_gora_mm: number, dach_kat_deg: number): number` [L351](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L351)
- `export` `skosTopOverlapRunMm(nalozenie_gora_mm: number, dach_kat_deg: number): number` [L364](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L364)
- `buildEdgeBanding(): Record<string, any>` [L379](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L379)
- `export` `calculateSkosneDoorsPlan(dims_mm: BlokiDimensions_mm, params: NormalizedSkosneDoorsParams): BlokiPlanResult` [L390](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L390)

**Typy i Modele Danych:**
- `interface ActiveHingeConfig` { index, pozycja_lokalna_z_mm, szablon_id } [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L51)
- `interface NormalizedSkosneDoorsParams` { rodzaj_drzwi, grubosc_frontu_mm, szczelina_mm, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_lewe_mm, nalozenie_prawe_mm, dach_kat_deg, +8 more } [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L57)
- `type SkosneDoorType` = `'LEFT' | 'RIGHT' | 'DOUBLE'` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L49)

**Stałe i Słowniki:**
- `const DEFAULT_HINGE_POS_MM: Record<number, number>` [L77](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/06_skosne-doors-engine.ts#L77)

### [A2_bloki/07_corner-doors-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-adapter.tsx)

**Funkcje:**
- `export` `normalizeCornerOtwieranie(val: string | undefined): CornerOtwieranie` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-adapter.tsx#L23)
- `export` `CornerDoorsSubModule(1 params): any` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-adapter.tsx#L34)

**Typy i Modele Danych:**
- `type CornerOtwieranie` = `'jednostronna' | 'dwustronna_lewy' | 'dwustronna_prawy'` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-adapter.tsx#L21)

### [A2_bloki/07_corner-doors-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts)

**Funkcje:**
- `export` `assertCanonicalCornerDoorsParams(raw: object | null | undefined): void` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L82)
- `readOptionalMm(raw: object, key: string): number | undefined` [L97](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L97)
- `requireParamMm(raw: object, key: string, label: string): number | null` [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L104)
- `isHingeEnabled(raw: object, index: number, defaultEnabled: boolean): boolean` [L113](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L113)
- `computeInnerLFromBloki(6 params): CornerPlacement` [L144](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L144)
- `export` `normalizeCornerDoorsParams(raw: CornerDoorsPlanParams, dims: BlokiDimensions_mm): NormalizedCornerDoorsParams | null` [L208](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L208)
- `export` `calculateCornerDoorsPlan(dims_mm: BlokiDimensions_mm, params: NormalizedCornerDoorsParams): BlokiPlanResult` [L270](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L270)

**Typy i Modele Danych:**
- `interface CornerHingeConfig` { index, localZ } [L190](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L190)
- `interface NormalizedCornerDoorsParams` { grubosc_frontu_mm, szczelina_srodkowa_mm, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_prawe_mm, nalozenie_lewe_mm, otwieranie, szablon_zawiasu_domyslny, +2 more } [L195](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L195)
- `type CornerDoorsParams` = `CornerDoorsPlanParams` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L43)
- `type CornerPlacement` = `{ drzwiPraweSzerokosc: number; drzwiLeweSzerokosc: number...` [L120](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L120)

**Stałe i Słowniki:**
- `const LEGACY_CORNER_DOORS_PARAM_ALIASES: Readonly<Record<string, string>>` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-engine.ts#L46)

### [A2_bloki/07_corner-doors-refs.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts)

**Funkcje:**
- `isBlokiSubtree(node: CADNode): boolean` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L27)
- `findRogowyPanel(cabinetNode: CADNode, keySuffixes: string[]): CADNode | null` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L38)
- `export` `isRogowy90Cabinet(node: CADNode): boolean` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L61)
- `makeRef(panelNode: CADNode, face: FaceName): CornerDoorsRefSlot` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L67)
- `isVerticalSegment(a: number[], b: number[]): boolean` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L75)
- `findNotchWallRefs(wieniec: CADNode, cabinetNode: CADNode): { xMin: CornerDoorsRefSlot; yMax: CornerDoorsRe...` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L88)
- `export` `buildRogowy90CornerDoorsReferences(cabinetNode: CADNode): CornerDoorsCustomReferences | null` [L168](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L168)
- `export` `applyCornerDoorsDefaultRefs(cabinetNode: CADNode): { customReferences: CornerDoorsCustomReferences...` [L195](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L195)
- `export` `buildCornerDoorsAutoRefsPatch(container: any, document: any): { customReferences: Record<string, CornerDoorsR...` [L211](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L211)
- `export` `applyCornerDoorsTrialPreset(cabinetNode: CADNode, _presetIndex?: number): { customReferences: CornerDoorsCustomReferences...` [L240](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L240)

**Typy i Modele Danych:**
- `type CornerAt` = `'innerL_wieniec'` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L10)
- `type CornerDoorsRefSlot` = `{ partKey: string; face: FaceName; panelId: string; }` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L12)
- `type CornerDoorsCustomReferences` = `{ xMin?: CornerDoorsRefSlot; xMax: CornerDoorsRefSlot; yM...` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/07_corner-doors-refs.ts#L18)

### [A2_bloki/08_tubes-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-adapter.tsx)

**Funkcje:**
- `export` `TubesSubModule(1 params): any` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-adapter.tsx#L26)

### [A2_bloki/08_tubes-drilling-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-drilling-builder.ts)

**Funkcje:**
- `dimToMm(raw: number | undefined, fallback): number` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-drilling-builder.ts#L19)
- `export` `buildTubesDrillings(document: ProjectDocument, cabinetContainerId?: string): TubesDrillingIntent[]` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-drilling-builder.ts#L24)

### [A2_bloki/08_tubes-drilling-intent.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-drilling-intent.ts)

**Typy i Modele Danych:**
- `type TubesDrillingFeature` = `MachiningHoleFeature` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-drilling-intent.ts#L14)
- `type TubesDrillingIntent` = `MachiningIntent<TubesDrillingFeature>` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-drilling-intent.ts#L16)
- `type TubesDrillingFace` = `MachiningHoleFeature['face']` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-drilling-intent.ts#L18)

### [A2_bloki/08_tubes-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-engine.ts)

**Funkcje:**
- `export` `normalizeTubesParams(raw: TubesPlanParams, _dims?: BlokiDimensions_mm | ModuleDims): NormalizedTubesParams` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-engine.ts#L47)
- `export` `calculateTubesPlan(dims: BlokiDimensions_mm, params: NormalizedTubesParams): BlokiPlanResult` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-engine.ts#L78)

**Typy i Modele Danych:**
- `interface NormalizedTubesParams` { odstep_gora_mm, pokaz_polke, przestrzen_nad_polka_mm, grubosc_polki_mm, srednica_drazka_mm } [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/08_tubes-engine.ts#L34)

### [A2_bloki/09_drawers-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-adapter.tsx)

**Funkcje:**
- `fallbackRailSystem(systems: { id: string }[]): string` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-adapter.tsx#L31)
- `toNum(val: string | number | undefined, fallback): number` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-adapter.tsx#L35)
- `dimToMm(raw: number | undefined): number` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-adapter.tsx#L40)
- `emptyHeights(): number[]` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-adapter.tsx#L45)
- `emptyGaps(): number[]` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-adapter.tsx#L48)
- `export` `DrawersSubModule(1 params): any` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-adapter.tsx#L81)

### [A2_bloki/09_drawers-drilling-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-drilling-builder.ts)

**Funkcje:**
- `dimToMm(raw: number | undefined, fallback): number` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-drilling-builder.ts#L19)
- `export` `buildDrawersDrillings(document: ProjectDocument, cabinetContainerId?: string): DrawersDrillingIntent[]` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-drilling-builder.ts#L24)

### [A2_bloki/09_drawers-drilling-intent.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-drilling-intent.ts)

**Typy i Modele Danych:**
- `type DrawersDrillingFeature` = `MachiningHoleFeature` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-drilling-intent.ts#L14)
- `type DrawersDrillingIntent` = `MachiningIntent<DrawersDrillingFeature>` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-drilling-intent.ts#L16)
- `type DrawersDrillingFace` = `MachiningHoleFeature['face']` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-drilling-intent.ts#L18)

### [A2_bloki/09_drawers-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts)

**Funkcje:**
- `railsForBrand(brand?: string): HardwareItem[]` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L56)
- `export` `listRailBrands(): string[]` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L60)
- `export` `listRailSeriesForBrand(brand: string): string[]` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L68)
- `export` `listRailSystemsForBrand(brand: string, series?: string): { id: string; name: string; corpusHeightMm: num...` [L76](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L76)
- `export` `listRailLengthsForBrand(brand: string): string[]` [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L90)
- `defaultRailId(params: DrawersPlanParams): string` [L159](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L159)
- `defaultLength(item: HardwareItem | undefined, requested?: string, depthMm?: number): string` [L167](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L167)
- `export` `normalizeDrawersParams(raw: DrawersPlanParams, dims?: BlokiDimensions_mm | ModuleDims): NormalizedDrawersParams` [L179](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L179)
- `export` `resolveDrawerLayout(params: DrawersPlanParams, dims: BlokiDimensions_mm | ModuleDims): DrawerLayout` [L237](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L237)
- `buildFrontHoles(slot: DrawerSlot, frontW: number, frontH: number): any[]` [L340](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L340)
- `export` `calculateDrawersPlan(dims: BlokiDimensions_mm, params: NormalizedDrawersParams): BlokiPlanResult` [L387](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L387)

**Typy i Modele Danych:**
- `interface DrawerSlot` { index, frontH, zFrontBottom, zInternalBottom, zFrontCenter, railId, lengthMm, rail, +2 more } [L100](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L100)
- `interface DrawerLayout` { liczba_szuflad, width_mm, height_mm, depth_mm, grubosc_frontu_mm, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_lewe_mm, +6 more } [L125](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L125)
- `interface NormalizedDrawersParams` { liczba_szuflad, grubosc_frontu_mm, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_lewe_mm, nalozenie_prawe_mm, dystans_lewy_mm, dystans_prawy_mm, +6 more } [L142](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/09_drawers-engine.ts#L142)

### [A2_bloki/10_dividers-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-adapter.tsx)

**Funkcje:**
- `toNum(val: string | number | undefined, fallback): number` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-adapter.tsx#L31)
- `dimToMm(raw: number | undefined): number` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-adapter.tsx#L36)
- `emptySections(): number[]` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-adapter.tsx#L41)
- `readSectionsFromParams(p: any): number[]` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-adapter.tsx#L45)
- `export` `DividersSubModule(1 params): any` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-adapter.tsx#L78)

### [A2_bloki/10_dividers-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-engine.ts)

**Funkcje:**
- `defaultThicknessMm(): number` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-engine.ts#L36)
- `readSectionWidths(params: Record<string, unknown>, count: number): number[]` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-engine.ts#L70)
- `export` `equalBayWidth(3 params): number` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-engine.ts#L84)
- `export` `normalizeDividersParams(raw: DividersPlanParams, dims?: BlokiDimensions_mm | ModuleDims): NormalizedDividersParams` [L97](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-engine.ts#L97)
- `export` `resolveDividerLayout(params: DividersPlanParams, dims: BlokiDimensions_mm | ModuleDims): DividerLayout` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-engine.ts#L122)
- `export` `calculateDividersPlan(dims: BlokiDimensions_mm, params: NormalizedDividersParams): BlokiPlanResult` [L179](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-engine.ts#L179)

**Typy i Modele Danych:**
- `interface DividerSlot` { index, xCenter, bayBefore } [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-engine.ts#L42)
- `interface DividerLayout` { liczba_przegrod, width_mm, height_mm, depth_mm, grubosc_przegrody_mm, tryb_rozstawu, szerokosci_wnek_mm, ostatnia_wneka_mm, +2 more } [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-engine.ts#L48)
- `interface NormalizedDividersParams` { liczba_przegrod, grubosc_przegrody_mm, tryb_rozstawu, szerokosci_wnek_mm } [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/10_dividers-engine.ts#L61)

### [A2_bloki/11_panels-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-adapter.tsx)

**Funkcje:**
- `toNum(val: string | number | undefined, fallback): number` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-adapter.tsx#L21)
- `mmParam(v: unknown, fallback: number): number` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-adapter.tsx#L26)
- `asMode(raw: unknown): SidePanelMode` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-adapter.tsx#L32)
- `export` `PanelsSubModule(1 params): any` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-adapter.tsx#L60)

### [A2_bloki/11_panels-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts)

**Funkcje:**
- `edgeFor(role: string): any` [L77](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L77)
- `export` `calcSideSpan(5 params): any` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L81)
- `asMode(raw: unknown): SidePanelMode` [L97](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L97)
- `flag(params: Record<string, unknown>, key: string, defaultValue): boolean` [L103](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L103)
- `export` `normalizePanelsParams(raw: PanelsPlanParams, dims?: BlokiDimensions_mm): NormalizedPanelsParams` [L108](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L108)
- `export` `calculatePanelsPlan(dims_mm: BlokiDimensions_mm, params: NormalizedPanelsParams): BlokiPlanResult` [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L158)

**Typy i Modele Danych:**
- `interface NormalizedPanelsParams` { grubosc_blendy_mm, tryb_paneli_bocznych, wlacz_lewy, wlacz_prawy, wlacz_gorny, wlacz_dolny, auto_glebokosc_lewy, auto_glebokosc_prawy, +10 more } [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L56)

**Stałe i Słowniki:**
- `const PANEL_FRONT_LCS` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L32)
- `const PANEL_SHELF_LCS` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L38)
- `const PANEL_SIDE_L_LCS` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L44)
- `const PANEL_SIDE_R_LCS` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/11_panels-engine.ts#L50)

### [A2_bloki/12_flaps-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-adapter.tsx)

**Funkcje:**
- `dimToMm(raw: number | undefined): number` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-adapter.tsx#L36)
- `calculateFlapWeightAndHinges(opts: { sbWidth: number; sbHeight: number; ovTop: num...): { weightKg: number; suggestedHinges: number }` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-adapter.tsx#L41)
- `export` `FlapsSubModule(1 params): any` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-adapter.tsx#L67)

### [A2_bloki/12_flaps-drilling-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-drilling-builder.ts)

**Funkcje:**
- `hingeLocalX(4 params): number` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-drilling-builder.ts#L19)
- `pushPlateHoles(11 params): void` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-drilling-builder.ts#L25)
- `export` `buildFlapsDrillings(document: ProjectDocument, cabinetContainerId?: string): FlapsDrillingIntent[]` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-drilling-builder.ts#L83)

**Typy i Modele Danych:**
- `type HingeSide` = `'left' | 'right' | 'center'` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-drilling-builder.ts#L17)

### [A2_bloki/12_flaps-drilling-intent.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-drilling-intent.ts)

**Typy i Modele Danych:**
- `type FlapsDrillingFeature` = `MachiningHoleFeature` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-drilling-intent.ts#L15)
- `type FlapsDrillingIntent` = `MachiningIntent<FlapsDrillingFeature>` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-drilling-intent.ts#L17)
- `type FlapsDrillingFace` = `MachiningHoleFeature['face']` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-drilling-intent.ts#L19)

### [A2_bloki/12_flaps-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-engine.ts)

**Funkcje:**
- `export` `normalizeFlapsParams(raw: FlapsPlanParams, dims?: BlokiDimensions_mm): NormalizedFlapsParams` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-engine.ts#L52)
- `export` `calculateFlapsPlan(dims_mm: BlokiDimensions_mm, params: NormalizedFlapsParams): BlokiPlanResult` [L91](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-engine.ts#L91)

**Typy i Modele Danych:**
- `interface NormalizedFlapsParams` { kierunek_klapy, grubosc_frontu_mm, nalozenie_gora_mm, nalozenie_dol_mm, nalozenie_lewe_mm, nalozenie_prawe_mm, odsuniecie_zawiasu_lewe_mm, odsuniecie_zawiasu_prawe_mm, +5 more } [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-engine.ts#L36)
- `type FlapHingeSide` = `'left' | 'right' | 'center'` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-engine.ts#L34)

**Stałe i Słowniki:**
- `const FLAP_FRONT_LCS` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/12_flaps-engine.ts#L28)

### [A2_bloki/13_led-internal-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-adapter.tsx)

**Funkcje:**
- `export` `LedInternalSubModule(1 params): any` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-adapter.tsx#L41)

### [A2_bloki/13_led-internal-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts)

**Funkcje:**
- `export` `normalizeLedInternalParams(raw: LedInternalPlanParams, dims?: BlokiDimensions_mm): NormalizedLedInternalParams` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L56)
- `export` `calculateLedInternalPlan(dims_mm: BlokiDimensions_mm, params: NormalizedLedInternalParams): BlokiPlanResult` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L96)
- `rebuildPanelMesh(panel: PanelModel): void` [L196](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L196)
- `getContainerZOffsetOnPanel(containerNode: any, panelNode: any): number` [L214](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L214)
- `buildSideGrooveIntent(8 params): MachiningIntent<MachiningGrooveFeature>` [L281](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L281)
- `buildBackGrooveIntent(7 params): MachiningIntent<MachiningGrooveFeature>` [L307](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L307)
- `export` `buildBlokiLedInternalGroovePlan(containerNode: any, doc: any): BlokiLedInternalGroovePlan | null` [L335](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L335)
- `export` `buildBlokiLedInternalGrooveIntents(containerNode: any, doc: any): MachiningIntent<MachiningGrooveFeature>[]` [L430](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L430)
- `export` `applyBlokiLedInternalGroovePlan(doc: any, plan: BlokiLedInternalGroovePlan): void` [L446](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L446)
- `export` `syncBlokiLedInternalGrooves(containerNode: any, doc: any): void` [L473](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L473)

**Typy i Modele Danych:**
- `interface NormalizedLedInternalParams` { wariant_led, profil_lewy, profil_prawy, profil_tyl, odsuniecie_od_przodu_lewe_mm, odsuniecie_od_przodu_prawe_mm, odsuniecie_tyl_od_srodka_mm, odsuniecie_od_przodu_mm, +4 more } [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L41)
- `interface BlokiLedInternalPanelPlan` { targetNodeId, scope, upsert } [L269](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L269)
- `interface BlokiLedInternalGroovePlan` { ownerId, panels } [L275](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/13_led-internal-engine.ts#L275)

### [A2_bloki/14_led-external-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/14_led-external-adapter.tsx)

**Funkcje:**
- `export` `LedExternalSubModule(1 params): any` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/14_led-external-adapter.tsx#L41)

### [A2_bloki/14_led-external-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/14_led-external-engine.ts)

**Funkcje:**
- `export` `normalizeLedExternalParams(raw: LedExternalPlanParams, dims?: BlokiDimensions_mm): NormalizedLedExternalParams` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/14_led-external-engine.ts#L26)
- `export` `calculateLedExternalPlan(dims_mm: BlokiDimensions_mm, params: NormalizedLedExternalParams): BlokiPlanResult` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/14_led-external-engine.ts#L42)
- `export` `syncBlokiLedExternalGrooves(containerNode: any, doc: any): void` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/14_led-external-engine.ts#L83)

**Typy i Modele Danych:**
- `interface NormalizedLedExternalParams` { odsuniecie_od_przodu_mm, szerokosc_wpustu_mm, glebokosc_wpustu_mm, frezuj_boki } [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/14_led-external-engine.ts#L19)

### [A2_bloki/15_led-external-channel-apply.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-apply.ts)

**Funkcje:**
- `export` `rebuildMesh(panel: PanelModel): void` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-apply.ts#L18)
- `export` `applyLedChannelToDocument(doc: any, def: LedChannelDefinition): number` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-apply.ts#L39)
- `export` `removeLedChannelFromDocument(doc: any, channelId: string): void` [L100](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-apply.ts#L100)

### [A2_bloki/15_led-external-channel-math.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts)

**Funkcje:**
- `export` `resolvePlaneWorld(doc: any, ref: AssocPlaneRef | null): { point: Vec3; normal: Vec3 } | null` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L26)
- `export` `getNodeWorldCornersMm(node: any): Vec3[]` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L43)
- `export` `getContainerBoundsWorldMm(doc: any, containerNode: any): { min: Vec3; max: Vec3; panels: any[] } | null` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L65)
- `export` `detectCabinetRow(doc: any, targetId: string): DetectedCabinetRow | null` [L136](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L136)
- `export` `computeLedChannelWorldBox(doc: any, def: LedChannelDefinition): WorldCutBox | null` [L313](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L313)
- `export` `computeFaceData(rawFaceName: string, w: number, h: number, t: number): any` [L361](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L361)
- `export` `meshPointToFaceUVD(faceData: any, p: [number, number, number]): { u: number; v: number; d: number }` [L380](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L380)
- `export` `calculatePanelLedGroove(node: any, panel: any, box: WorldCutBox, def: LedChannelDefinition): LedGrooveFeatureDto | null` [L413](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L413)

**Typy i Modele Danych:**
- `interface WorldCutBox` { xMin, xMax, yMin, yMax, zMin, zMax } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L17)
- `interface DetectedCabinetRow` { refLeft, refRight, refBottom, refFront, refTop, refBack, cabinetIds, cabinetCount, +5 more } [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L116)
- `interface LedGrooveFeatureDto` { id, type, name, face, params } [L392](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-math.ts#L392)

### [A2_bloki/15_led-external-channel-preview.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-preview.ts)

**Klasy:**
- `class LedChannelPreview` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-preview.ts#L13)
  - `update(channelId: string, box: WorldCutBox | null): void` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-preview.ts#L19)
  - `remove(channelId: string): void` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-preview.ts#L81)
  - `clearAll(): void` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-preview.ts#L92)

### [A2_bloki/15_led-external-channel-store.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts)

**Klasy:**
- `class LedChannelStore` *implements DocumentExtension* [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L23)
  - `subscribe(listener: LedChannelListener): () => void` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L54)
  - `setActiveChannelId(id: string | null): void` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L80)
  - `getOrCreateDefault(): LedChannelDefinition` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L88)
  - `addChannel(name?: string): LedChannelDefinition` [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L99)
  - `updateChannel(id: string, updates: Partial<LedChannelDefinition>): void` [L109](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L109)
  - `removeChannel(id: string): void` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L118)
  - `deleteChannel(id: string): void` [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L129)
  - `toggleVisibility(id: string): void` [L136](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L136)
  - `toggleFreeze(id: string): void` [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L146)
  - `syncChannel(def: LedChannelDefinition): void` [L159](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L159)
  - `syncAll(): void` [L182](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L182)
  - `serialize(): any` [L207](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L207)
  - `load(data: any): void` [L215](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L215)

**Funkcje:**
- `export` `stopGuidedLedPick(): void` [L233](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L233)
- `export` `startGuidedLedPick(3 params): void` [L251](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L251)
- `export` `handleLedChannelDrop(pick: any, channelId?: string): boolean` [L323](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L323)

**Typy i Modele Danych:**
- `type LedChannelListener` = `() => void` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-store.ts#L21)

### [A2_bloki/15_led-external-channel-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-types.ts)

**Funkcje:**
- `export` `createDefaultLedChannel(id?: string): LedChannelDefinition` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-types.ts#L55)

**Typy i Modele Danych:**
- `interface LedChannelDefinition` { id, name, enabled, visible, frozen, refLeft, refRight, refFront, +14 more } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-types.ts#L15)

**Stałe i Słowniki:**
- `const LED_CHANNEL_SOURCE` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-types.ts#L88)

### [A2_bloki/15_led-external-channel-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-ui.tsx)

**Funkcje:**
- `export` `LedChannelUI(): any` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-ui.tsx#L40)

**Typy i Modele Danych:**
- `type SideKey` = `'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax'` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/15_led-external-channel-ui.tsx#L14)

### [A2_bloki/16_led-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/16_led-adapter.tsx)

**Funkcje:**
- `export` `LedSubModule(1 params): any` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/16_led-adapter.tsx#L22)

### [A2_bloki/16_led-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/16_led-engine.ts)

**Funkcje:**
- `export` `calculateLedPlan(dims_mm: BlokiDimensions_mm, params: LedPlanParams): BlokiPlanResult` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/16_led-engine.ts#L31)
- `export` `syncBlokiLedGrooves(containerNode: any, doc: any): void` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/16_led-engine.ts#L43)

**Typy i Modele Danych:**
- `type LedModuleParams` = `LedPlanParams` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/16_led-engine.ts#L29)

### [A2_bloki/17_hangers-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-adapter.tsx)

**Funkcje:**
- `export` `HangersSubModule(1 params): any` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-adapter.tsx#L16)

### [A2_bloki/17_hangers-drilling-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-drilling-builder.ts)

**Funkcje:**
- `export` `buildHangersDrillings(document: ProjectDocument, cabinetContainerId?: string): HangersDrillingIntentItem[]` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-drilling-builder.ts#L36)

**Typy i Modele Danych:**
- `interface HangersDrillingIntentItem` { targetNodeId, feature } [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-drilling-builder.ts#L28)

### [A2_bloki/17_hangers-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-engine.ts)

**Funkcje:**
- `export` `normalizeHangersParams(2 params): Required<HangersPlanParams>` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-engine.ts#L15)
- `resolvePartPosInBayMm(3 params): { x: number; y: number; z: number }` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-engine.ts#L31)
- `export` `calculateHangersPlan(3 params): BlokiPlanResult` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-engine.ts#L67)

### [A2_bloki/17_hangers-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-types.ts)

**Funkcje:**
- `export` `extractHangerSets(definition: any, fallbackId): HangerSetDefinition[]` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-types.ts#L46)
- `export` `resolveActiveHangerSet(definition: any, setId?: string, fallbackId): HangerSetDefinition | null` [L95](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-types.ts#L95)

**Typy i Modele Danych:**
- `interface HangerSetDefinition` { id, name, description, brand, mainContainer, parts, cuts, parameters, +3 more } [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-types.ts#L11)
- `interface HangersPlanParams` { szablon_id, zestaw_id, odsuniecie_bok_mm, odsuniecie_tyl_mm, odsuniecie_gora_mm, parametry_zestawu } [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/17_hangers-types.ts#L34)

### [A2_bloki/18_corner-shelves-adapter.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/18_corner-shelves-adapter.tsx)

**Funkcje:**
- `export` `CornerShelvesSubModule(1 params): any` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/18_corner-shelves-adapter.tsx#L22)

### [A2_bloki/18_corner-shelves-drilling-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/18_corner-shelves-drilling-builder.ts)

**Funkcje:**
- `isBlokiSubtree(node: any): boolean` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/18_corner-shelves-drilling-builder.ts#L18)
- `findRogowyPanel(cabinetNode: any, candidates: string[]): any | null` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/18_corner-shelves-drilling-builder.ts#L29)
- `export` `buildCornerShelvesDrillings(document: ProjectDocument, cabinetContainerId?: string): ShelvesDrillingIntent[]` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/18_corner-shelves-drilling-builder.ts#L53)

### [A2_bloki/18_corner-shelves-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/18_corner-shelves-engine.ts)

**Funkcje:**
- `export` `normalizeCornerShelvesParams(raw: CornerShelvesPlanParams, dims?: BlokiDimensions_mm): NormalizedCornerShelvesParams` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/18_corner-shelves-engine.ts#L57)
- `export` `calculateCornerShelvesPlan(dims: BlokiDimensions_mm, params: NormalizedCornerShelvesParams): BlokiPlanResult` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/18_corner-shelves-engine.ts#L118)

**Typy i Modele Danych:**
- `interface NormalizedCornerShelvesParams` { liczba_polek, grubosc_polki_mm, odsuniecie_przod_mm, luz_boczny_mm, bok_lewy_mm, bok_prawy_mm, wzor_nawiercen, rozstaw_potrojny_z_mm, +12 more } [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/18_corner-shelves-engine.ts#L32)

### [A2_bloki/commands/clear-blok-drillings-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/clear-blok-drillings-command.ts)

**Klasy:**
- `class ClearBlokiDrillingsCommand` *implements Command* [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/clear-blok-drillings-command.ts#L59)
  - `constructor(blokContainerId: string, notifyViews: boolean): void` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/clear-blok-drillings-command.ts#L69)
  - `execute(document: ProjectDocument): void` [L77](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/clear-blok-drillings-command.ts#L77)
  - `undo(document: ProjectDocument): void` [L124](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/clear-blok-drillings-command.ts#L124)

**Funkcje:**
- `export` `isBlokiNode(node: CADNode): boolean` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/clear-blok-drillings-command.ts#L24)
- `export` `collectBlokiIds(node: CADNode): string[]` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/clear-blok-drillings-command.ts#L37)

### [A2_bloki/commands/set-blok-params-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/set-blok-params-command.ts)

**Klasy:**
- `class SetBlokiParamsCommand` *implements Command* [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/set-blok-params-command.ts#L13)
  - `constructor(3 params): void` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/set-blok-params-command.ts#L19)
  - `execute(document: ProjectDocument): void` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/set-blok-params-command.ts#L30)
  - `undo(document: ProjectDocument): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/set-blok-params-command.ts#L34)

**Funkcje:**
- `cloneParams(params: any): Record<string, any>` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/set-blok-params-command.ts#L9)

### [A2_bloki/commands/sync-door-drillings-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-door-drillings-command.ts)

**Klasy:**
- `class SyncDoorDrillingsCommand` *implements Command* [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-door-drillings-command.ts#L18)
  - `constructor(cabinetContainerId?: string): void` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-door-drillings-command.ts#L27)
  - `execute(document: ProjectDocument): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-door-drillings-command.ts#L34)
  - `undo(document: ProjectDocument): void` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-door-drillings-command.ts#L78)

### [A2_bloki/commands/sync-drawer-drillings-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-drawer-drillings-command.ts)

**Klasy:**
- `class SyncDrawerDrillingsCommand` *implements Command* [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-drawer-drillings-command.ts#L18)
  - `constructor(cabinetContainerId?: string): void` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-drawer-drillings-command.ts#L27)
  - `execute(document: ProjectDocument): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-drawer-drillings-command.ts#L34)
  - `undo(document: ProjectDocument): void` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-drawer-drillings-command.ts#L78)

### [A2_bloki/commands/sync-flaps-drillings-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-flaps-drillings-command.ts)

**Klasy:**
- `class SyncFlapsDrillingsCommand` *implements Command* [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-flaps-drillings-command.ts#L18)
  - `constructor(cabinetContainerId?: string): void` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-flaps-drillings-command.ts#L27)
  - `execute(document: ProjectDocument): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-flaps-drillings-command.ts#L34)
  - `undo(document: ProjectDocument): void` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-flaps-drillings-command.ts#L70)

### [A2_bloki/commands/sync-hangers-drillings-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-hangers-drillings-command.ts)

**Klasy:**
- `class SyncHangersDrillingsCommand` *implements Command* [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-hangers-drillings-command.ts#L18)
  - `constructor(cabinetContainerId?: string): void` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-hangers-drillings-command.ts#L27)
  - `execute(document: ProjectDocument): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-hangers-drillings-command.ts#L34)
  - `undo(document: ProjectDocument): void` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-hangers-drillings-command.ts#L75)

### [A2_bloki/commands/sync-led-machining-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-led-machining-command.ts)

**Klasy:**
- `class SyncLedMachiningCommand` *implements Command* [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-led-machining-command.ts#L43)
  - `constructor(ownerId?: string): void` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-led-machining-command.ts#L53)
  - `execute(document: ProjectDocument): void` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-led-machining-command.ts#L60)
  - `undo(document: ProjectDocument): void` [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-led-machining-command.ts#L90)

**Funkcje:**
- `findBlokContainers(document: ProjectDocument, ownerId?: string): any[]` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-led-machining-command.ts#L24)

### [A2_bloki/commands/sync-shelf-drillings-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-shelf-drillings-command.ts)

**Klasy:**
- `class SyncShelfDrillingsCommand` *implements Command* [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-shelf-drillings-command.ts#L19)
  - `constructor(cabinetContainerId?: string): void` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-shelf-drillings-command.ts#L28)
  - `execute(document: ProjectDocument): void` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-shelf-drillings-command.ts#L35)
  - `undo(document: ProjectDocument): void` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-shelf-drillings-command.ts#L82)

### [A2_bloki/commands/sync-skosne-doors-drillings-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-skosne-doors-drillings-command.ts)

**Klasy:**
- `class SyncSkosneDoorsDrillingsCommand` *implements Command* [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-skosne-doors-drillings-command.ts#L19)
  - `constructor(cabinetContainerId?: string): void` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-skosne-doors-drillings-command.ts#L28)
  - `execute(document: ProjectDocument): void` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-skosne-doors-drillings-command.ts#L35)
  - `undo(document: ProjectDocument): void` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-skosne-doors-drillings-command.ts#L71)

### [A2_bloki/commands/sync-tubes-drillings-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-tubes-drillings-command.ts)

**Klasy:**
- `class SyncTubesDrillingsCommand` *implements Command* [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-tubes-drillings-command.ts#L18)
  - `constructor(cabinetContainerId?: string): void` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-tubes-drillings-command.ts#L27)
  - `execute(document: ProjectDocument): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-tubes-drillings-command.ts#L34)
  - `undo(document: ProjectDocument): void` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/commands/sync-tubes-drillings-command.ts#L70)

### [A2_bloki/core/smart-module-plugin.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-plugin.ts)

**Typy i Modele Danych:**
- `interface SmartModuleMeta` { label, labelKey, description, category, subCategory, order, renderIcon } [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-plugin.ts#L23)
- `interface SmartModulePlugin` { id, meta, enabled, buildPlan, syncDrillings, getDefaultParams, UIComponent } [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-plugin.ts#L33)

### [A2_bloki/core/smart-module-registry.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-registry.ts)

**Klasy:**
- `class SmartModuleRegistryImpl` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-registry.ts#L11)
  - `register(plugin: SmartModulePlugin<TParams>): void` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-registry.ts#L15)
  - `unregister(id: BlokiModuleId): void` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-registry.ts#L20)
  - `get(id: BlokiModuleId | string): SmartModulePlugin<TParams> | undefined` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-registry.ts#L25)
  - `isModuleEnabled(id: BlokiModuleId | string): boolean` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-registry.ts#L30)
  - `getActiveModules(): SmartModulePlugin<object>[]` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-registry.ts#L38)
  - `clear(): void` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/core/smart-module-registry.ts#L48)

### [A2_bloki/handles/commands/clear-handle-drillings-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/commands/clear-handle-drillings-command.ts)

**Klasy:**
- `class ClearHandleDrillingsCommand` *implements Command* [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/commands/clear-handle-drillings-command.ts#L43)
  - `constructor(handleId: string): void` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/commands/clear-handle-drillings-command.ts#L51)
  - `execute(document: ProjectDocument): boolean` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/commands/clear-handle-drillings-command.ts#L58)
  - `undo(document: ProjectDocument): boolean` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/commands/clear-handle-drillings-command.ts#L84)

**Funkcje:**
- `export` `isHandleNode(node: CADNode): boolean` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/commands/clear-handle-drillings-command.ts#L13)
- `export` `collectHandleIds(node: CADNode): string[]` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/commands/clear-handle-drillings-command.ts#L21)

### [A2_bloki/handles/handle-apply.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-apply.ts)

**Funkcje:**
- `export` `createSmartPartHandle(4 params): CADNode | null` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-apply.ts#L35)

### [A2_bloki/handles/handle-catalog-browser.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-catalog-browser.tsx)

**Funkcje:**
- `export` `handleTemplateToParams(t: HandleTemplateItem): Partial<HandleParamsMm>` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-catalog-browser.tsx#L33)
- `export` `HandleCatalogBrowser({ onSelectHandle, compact }: HandleCatalogBrowserProps): React.JSX.Element` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-catalog-browser.tsx#L54)

**Typy i Modele Danych:**
- `interface HandleCatalogBrowserProps` { onSelectHandle, compact } [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-catalog-browser.tsx#L49)

### [A2_bloki/handles/handle-commands.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-commands.ts)

**Klasy:**
- `class AddSmartPartHandleCommand` *implements Command* [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-commands.ts#L16)
  - `constructor(7 params): void` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-commands.ts#L24)
  - `execute(document: ProjectDocument): void` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-commands.ts#L38)
  - `undo(document: ProjectDocument): void` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-commands.ts#L64)
  - `redo(document: ProjectDocument): void` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-commands.ts#L87)

### [A2_bloki/handles/handle-controller.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-controller.ts)

**Klasy:**
- `class HandleDragController` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-controller.ts#L22)
  - `startDrag(template: HandleTemplateItem): void` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-controller.ts#L49)
  - `endDrag(): void` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-controller.ts#L55)
  - `onPointerMoveOnScene(scene: any, pointerX: number, pointerY: number, doc: ProjectDocument): DetectedPanelSurface | null` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-controller.ts#L65)
  - `onDropOnScene(doc: ProjectDocument): CADNode | null` [L111](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-controller.ts#L111)

### [A2_bloki/handles/handle-detector.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-detector.ts)

**Funkcje:**
- `export` `probePanelSurfaceFromRay(scene: any, pickResult: any, document: ProjectDocument): DetectedPanelSurface | null` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-detector.ts#L33)

**Typy i Modele Danych:**
- `interface DetectedPanelSurface` { panelNode, panelModel, widthMm, heightMm, thicknessMm, suggestedPreset, localCoordMm, faceZ, +4 more } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-detector.ts#L15)

### [A2_bloki/handles/handle-dim-gizmo.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-dim-gizmo.ts)

**Klasy:**
- `class HandleDimGizmo` [L76](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-dim-gizmo.ts#L76)
  - `attach(container: any): void` [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-dim-gizmo.ts#L99)
  - `detach(): void` [L115](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-dim-gizmo.ts#L115)
  - `update(): void` [L130](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-dim-gizmo.ts#L130)

**Funkcje:**
- `getBabylon(): any` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-dim-gizmo.ts#L47)
- `facePoint(faceData: any, u: number, v: number, normalOffset: number): any` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-dim-gizmo.ts#L53)
- `uvFromWorld(worldPos: any, invWorld: any, faceData: any): { u: number; v: number }` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-dim-gizmo.ts#L63)

### [A2_bloki/handles/handle-drilling.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-drilling.ts)

**Funkcje:**
- `export` `resolvePanelThicknessMm(panelModel: any): number` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-drilling.ts#L49)
- `export` `generateHandleDrillingFeatures(planParams: HandleDrillingPlanParams): HandleDrillingFeatureDto[]` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-drilling.ts#L66)
- `export` `syncHandleDrillings(6 params): void` [L131](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-drilling.ts#L131)
- `export` `removeHandleDrillings(document: any, containerId: string): void` [L180](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-drilling.ts#L180)

**Typy i Modele Danych:**
- `interface HandleDrillingPlanParams` { layout, panelWMm, panelHMm, panelTMm, containerId, drillDiameterMm, drillingEnabled, normalZ } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-drilling.ts#L15)
- `interface HandleDrillingFeatureDto` { id, type, face, side, name, params } [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-drilling.ts#L26)

### [A2_bloki/handles/handle-edit-panel.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-edit-panel.tsx)

**Funkcje:**
- `paramsFromContainer(container: any): HandleParamsMm` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-edit-panel.tsx#L43)
- `export` `HandleEditPanel({ container }: { container: any }): React.JSX.Element | null` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-edit-panel.tsx#L72)

### [A2_bloki/handles/handle-layout.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-layout.ts)

**Funkcje:**
- `export` `computeHandleCenterFromUV(8 params): { x: number; y: number }` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-layout.ts#L49)
- `export` `computeUVFromCenter(8 params): { uMm: number; vMm: number }` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-layout.ts#L86)
- `export` `computeRefHolePosition(6 params): { x: number; y: number }` [L125](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-layout.ts#L125)
- `export` `rebindHandleEdge(5 params): number` [L147](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-layout.ts#L147)
- `export` `computeHandleCenterMm(6 params): { x: number; y: number }` [L164](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-layout.ts#L164)
- `export` `ensureHandleUvMm(params: HandleParamsMm, panelWMm: number, panelHMm: number): HandleParamsMm` [L223](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-layout.ts#L223)
- `export` `computeHandleLayout(params: HandleParamsMm, panelWMm: number, panelHMm: number): HandleComputedLayoutMm` [L266](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-layout.ts#L266)

**Typy i Modele Danych:**
- `interface HandleComputedLayoutMm` { center, holes, overhangMm, bbox, depthMm, thicknessMm, orientation } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-layout.ts#L18)

### [A2_bloki/handles/handle-mesh.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts)

**Funkcje:**
- `degToRad(deg: number): number` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L56)
- `export` `buildHandleGlbQuaternion(B: any, orientation: 'HORIZONTAL' | 'VERTICAL', normalZ: number): any` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L64)
- `export` `resolveHandleGlbRotationRad(orientation: 'HORIZONTAL' | 'VERTICAL', normalZ: number): { x: number; y: number; z: number }` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L88)
- `export` `findPanelRootMesh(scene: any, panelId: string): any | null` [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L106)
- `disposeHandleVisual(scene: any, cntNodeId: string): void` [L130](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L130)
- `resolveGlbId(params: HandleParamsMm): string | null` [L152](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L152)
- `applyHandleColorToTree(root: any, params: HandleParamsMm, B: any): void` [L159](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L159)
- `placeHandleRoot(8 params): void` [L179](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L179)
- `export` `buildHandleParametricMesh(5 params): void` [L224](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L224)
- `buildProceduralHandleMesh(8 params): void` [L279](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L279)

**Stałe i Słowniki:**
- `const HANDLE_GLB_ORIENT` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L28)
- `const HANDLE_GLB_ROTATION_DEG` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L45)
- `const HANDLE_GLB_OUTWARD_FLIP_DEG` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-mesh.ts#L51)

### [A2_bloki/handles/handle-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts)

**Funkcje:**
- `export` `resolveHandleColor(colorId?: HandleColorId | null): { id: HandleColorId; color: { r: number; g: num...` [L109](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L109)
- `export` `computeHandleOverhang(params: Pick<HandleParamsMm, 'totalLengthMm' | 'holeDis...): number` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L118)
- `sizesFromCc(ccs: number[], overhangMm): RejsHandleSize[]` [L215](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L215)
- `export` `resolveHandleGlbFile(3 params): string | undefined` [L279](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L279)
- `export` `getRejsSeries(seriesId: string | undefined | null): RejsHandleSeries` [L297](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L297)
- `export` `resolveRejsSize(seriesId: string | undefined | null, holeDistanceMm: number): RejsHandleSize` [L301](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L301)
- `export` `totalLengthFromCcMm(holeDistanceMm: number, seriesId?: string): number` [L312](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L312)
- `export` `listStandardHandleTemplates(): HandleTemplateItem[]` [L318](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L318)
- `export` `getHandleTemplateById(id: string): HandleTemplateItem | undefined` [L322](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L322)
- `export` `resolveHandleTemplate(type: HandleType, producerId: HandleProducerId): HandleTemplateItem | undefined` [L330](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L330)
- `export` `listProducersForType(type: HandleType): typeof HANDLE_PRODUCER_OPTIONS` [L337](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L337)
- `export` `isCenterLockPreset(preset: HandlePlacementPreset | undefined | null): boolean` [L352](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L352)
- `export` `getCenterLockAxes(preset: HandlePlacementPreset | undefined | null): { lockU: boolean; lockV: boolean }` [L358](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L358)

**Typy i Modele Danych:**
- `interface HandleParamsMm` { totalLengthMm, holeDistanceMm, depthMm, thicknessMm, footDiameterMm, offsetEdgeXMm, offsetEdgeYMm, orientation, +15 more } [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L42)
- `interface HandleTemplateItem` { id, name, type, producerId, totalLengthMm, holeDistanceMm, depthMm, thicknessMm, +7 more } [L125](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L125)
- `interface RejsHandleSize` { holeDistanceMm, totalLengthMm } [L204](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L204)
- `interface RejsHandleSeries` { id, name, sizes } [L209](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L209)
- `type HandleType` = `'BAR' | 'EDGE' | 'KNOB' | 'PROFILE'` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L13)
- `type HandleProducerId` = `'rejs'` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L15)
- `type HandleOrientation` = `'HORIZONTAL' | 'VERTICAL'` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L17)
- `type HandlePlacementPreset` = `| 'TOP_CENTER' | 'CENTER' | 'CENTER_HORIZONTAL' | 'CENTER...` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L19)
- `type EdgeU` = `'FACE_X_MINUS' | 'FACE_X_PLUS'` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L31)
- `type EdgeV` = `'FACE_Y_MINUS' | 'FACE_Y_PLUS'` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L32)
- `type HandleColorId` = `| 'black' | 'anthracite' | 'chrome' | 'steel' | 'gold' | ...` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L34)

**Stałe i Słowniki:**
- `const SMARTPART_HANDLE_TYPE` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L8)
- `const CAD_EDIT_SMARTPART` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L11)
- `const HANDLE_COLOR_OPTIONS: { id: HandleColorId; label: string; color: { r:...` [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L98)
- `const DEFAULT_HANDLE_COLOR_ID: HandleColorId` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L107)
- `const HANDLE_TYPE_OPTIONS: { id: HandleType; label: string }[]` [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L146)
- `const HANDLE_PRODUCER_OPTIONS: { id: HandleProducerId; label: string }[]` [L152](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L152)
- `const DEFAULT_HANDLE_TEMPLATES: HandleTemplateItem[]` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L157)
- `const REJS_BAR_SERIES: RejsHandleSeries[]` [L222](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L222)
- `const DEFAULT_REJS_SERIES_ID` [L295](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L295)
- `const HANDLE_PLACEMENT_OPTIONS: { id: HandlePlacementPreset; label: string }[]` [L345](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L345)
- `const DEFAULT_HANDLE_PARAMS: HandleParamsMm` [L371](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-types.ts#L371)

### [A2_bloki/handles/handle-visualizer.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-visualizer.ts)

**Funkcje:**
- `export` `highlightPanelSurface(3 params): void` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-visualizer.ts#L19)
- `export` `clearPanelHighlight(scene?: any): void` [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/handles/handle-visualizer.ts#L98)

### [A2_bloki/hangers/commands/clear-smartpart-features-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/commands/clear-smartpart-features-command.ts)

**Klasy:**
- `class ClearSmartPartFeaturesCommand` *implements Command* [L101](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/commands/clear-smartpart-features-command.ts#L101)
  - `constructor(sourceId: string, meshNodeIds: string[]): void` [L110](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/commands/clear-smartpart-features-command.ts#L110)
  - `execute(document: ProjectDocument): boolean` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/commands/clear-smartpart-features-command.ts#L118)
  - `undo(document: ProjectDocument): boolean` [L149](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/commands/clear-smartpart-features-command.ts#L149)

**Funkcje:**
- `export` `isHangersGroupNode(node: CADNode): boolean` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/commands/clear-smartpart-features-command.ts#L11)
- `export` `isHangerPartNode(node: CADNode): boolean` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/commands/clear-smartpart-features-command.ts#L19)
- `export` `collectSmartPartSourceIds(node: CADNode): string[]` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/commands/clear-smartpart-features-command.ts#L27)
- `disposeSceneVisualsForNodeIds(nodeIds: string[]): void` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/commands/clear-smartpart-features-command.ts#L51)
- `export` `collectSubtreeNodeIds(node: CADNode): string[]` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/commands/clear-smartpart-features-command.ts#L88)

### [A2_bloki/hangers/hanger-apply.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts)

**Funkcje:**
- `export` `computeHangerCornerPoses(bay: DetectedBay, tpl: HangerTemplateItem, _document?: any | null): HangerCornerPoseMm[]` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L74)
- `export` `smartPartBodies(definition: any): any[]` [L131](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L131)
- `export` `smartPartCutsForPart(definition: any, partId: string | undefined, partIndex: number): any[]` [L140](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L140)
- `cutDomainDimsNm(cut: any): { width: number; height: number; depth: number }` [L151](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L151)
- `export` `computeSmartPartPartPoses(3 params): HangerCornerPoseMm[]` [L170](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L170)
- `export` `createSmartPartHangersInBay(document: any, bay: DetectedBay, template: HangerTemplateItem): CADNode | null` [L198](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L198)
- `export` `applySmartPartCutsToBay(4 params): boolean` [L464](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L464)
- `panelRoleText(node: any): string` [L476](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L476)
- `isHorizontalBayPanel(node: any): boolean` [L481](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L481)
- `findCrownPanel(cabinetNode: any, which: 'top' | 'bottom'): { node: any; face: string } | null` [L497](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L497)
- `export` `resolveHangersReferenceBoxMm(3 params): { widthMm: number; heightMm: number; depthMm: n...` [L542](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L542)
- `cabinetLocalToWorldMm(cabinetNode: any, x: number, y: number, z: number): any` [L659](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L659)
- `export` `updateSmartPartHangersGroup(groupNode: CADNode, document: any): boolean` [L670](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L670)
- `export` `syncHangerDefinitionFromParams(groupContainer: any): boolean` [L921](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L921)
- `createHangerCutNode(container: any, childGp: any, cut: any): CADNode` [L952](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L952)
- `createHangerPartChildNode(groupContainer: any, part: any): CADNode | null` [L994](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L994)
- `export` `updateHangerSmartPartParams(document: any, groupContainer: any, nextValues: SmartPartParamValues): boolean` [L1078](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L1078)

**Typy i Modele Danych:**
- `interface HangerCornerPoseMm` { side, worldMm, faces, part } [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-apply.ts#L51)

### [A2_bloki/hangers/hanger-controller.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-controller.ts)

**Klasy:**
- `class HangerDragController` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-controller.ts#L13)
  - `startDrag(template: HangerTemplateItem): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-controller.ts#L34)
  - `endDrag(): void` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-controller.ts#L40)
  - `onPointerMoveOnScene(scene: any, x: number, y: number, doc: ProjectDocument): DetectedBay | null` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-controller.ts#L47)
  - `onDropOnScene(doc: ProjectDocument): CADNode | null` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-controller.ts#L84)

### [A2_bloki/hangers/hanger-library-sync.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts)

**Funkcje:**
- `dedupKey(id: string, name?: string): string` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts#L18)
- `looksLikeFolderSmartPart(hw: any): boolean` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts#L26)
- `export` `getLastLiveZawieszkiSnapshot(): LiveZawieszkiSnapshot | null` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts#L60)
- `keysForFile(f: LiveZawieszkaFile): string[]` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts#L64)
- `export` `fetchLiveZawieszki(): Promise<LiveZawieszkiSnapshot>` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts#L74)
- `export` `deleteHangerFromLibrary(idOrName: string): Promise<{ ok: boolean; error?: string }>` [L147](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts#L147)
- `export` `isLiveDiskPresent(id: string, name?: string): boolean | null` [L176](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts#L176)
- `export` `subscribeHangerLibrarySync(onChange: () => void): () => void` [L187](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts#L187)

**Typy i Modele Danych:**
- `type LiveZawieszkaFile` = `{ baseName: string; relPath: string; id: string; name: st...` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts#L39)
- `type LiveZawieszkiSnapshot` = `{ ok: boolean; files: LiveZawieszkaFile[]; /** dedup keys...` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-library-sync.ts#L47)

### [A2_bloki/hangers/hanger-mesh.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-mesh.ts)

**Funkcje:**
- `disposeHangerVisual(scene: any, cntNodeId: string): void` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-mesh.ts#L16)
- `findSceneNode(scene: any, nodeId: string): any | null` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-mesh.ts#L38)
- `export` `buildHangerGlbMesh(cntNode: CADNode, params: HangerParamsMm): void` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-mesh.ts#L61)
- `buildParametricSmartPartMesh(scene: any, cntNode: CADNode, params: HangerParamsMm): void` [L130](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-mesh.ts#L130)
- `addCutMesh(7 params): void` [L286](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-mesh.ts#L286)
- `export` `syncHangerMeshesFromDocument(document: any): void` [L380](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-mesh.ts#L380)
- `export` `purgeOrphanHangerMeshes(document: any, liveHangerIds?: Set<string>): void` [L421](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-mesh.ts#L421)

### [A2_bloki/hangers/hanger-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-types.ts)

**Typy i Modele Danych:**
- `interface HangerTemplateItem` { id, name, brand, seriesId, glbModelPath, fromTopMm, fromBackMm, fromSideMm, +6 more } [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-types.ts#L13)
- `interface HangerParamsMm` { hardwareId, side, fromTopMm, fromBackMm, fromSideMm, widthMm, heightMm, depthMm, +3 more } [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-types.ts#L30)
- `type HangerSide` = `'L' | 'R'` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-types.ts#L11)

**Stałe i Słowniki:**
- `const SMARTPART_HANGER_TYPE` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-types.ts#L7)
- `const SMARTPART_HANGERS_GROUP_TYPE` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/hanger-types.ts#L9)

### [A2_bloki/hangers/smartpart-bay-placement.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts)

**Funkcje:**
- `buildFrame(7 params): SmartPartBayFrameMm` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L86)
- `export` `bayFrameFromDetectedBay(bay: DetectedBay, boundaryFallback?: any): SmartPartBayFrameMm` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L107)
- `isPanelLike(dd: any): boolean` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L132)
- `export` `panelFacePlaneCoordMm(node: any, face: string, axis: 'x' | 'y' | 'z'): number | null` [L144](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L144)
- `export` `panelExtremeWorldCoordMm(node: any, axis: 'x' | 'y' | 'z', which: 'min' | 'max'): number | null` [L177](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L177)
- `export` `liveLooksLikeMidSpan(live: number, endA: number, endB: number): boolean` [L196](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L196)
- `export` `recoverCollapsedBayHeightMm(live: SmartPartBayFrameMm, detected: SmartPartBayFrameMm): SmartPartBayFrameMm` [L207](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L207)
- `export` `bayFrameFromDocument(document: any, refs: BayWallRefs): SmartPartBayFrameMm | null` [L244](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L244)
- `export` `customReferencesFromDetectedBay(bay: DetectedBay, boundaryFallback?: any): Record<string, { partKey: string; face: string;...` [L316](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L316)
- `export` `bayWallRefsFromCustomReferences(3 params): BayWallRefs` [L377](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L377)
- `upper(v: unknown): string` [L433](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L433)
- `wallOffsetMm(offset: unknown, abs: unknown, wallRef: string): number` [L437](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L437)
- `export` `resolveStudioPlacementLocalMm(frame: SmartPartBayFrameMm, item: StudioPlacedItem): BayLocalMm` [L453](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L453)
- `export` `bayLocalToWorldMm(frame: SmartPartBayFrameMm, p: BayLocalMm): { x: number; y: number; z: number }` [L472](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L472)
- `export` `resolveStudioPlacementWorldMm(frame: SmartPartBayFrameMm, item: StudioPlacedItem): any` [L480](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L480)
- `export` `resolveStudioPlacementInContainerMm(2 params): { x: number; y: number; z: number }` [L491](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L491)
- `export` `resolveClassicHangerInContainerMm(3 params): { x: number; y: number; z: number }` [L513](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L513)
- `export` `resolveCutWorldMm(3 params): { x: number; y: number; z: number }` [L534](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L534)
- `export` `resolveCutPlacementInPartLcsMm(part: StudioPlacedItem | null | undefined, cut: any): { xMm: number; yMm: number; zMm: number }` [L552](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L552)
- `export` `resolveCutPlacementLocalMm(3 params): BayLocalMm` [L600](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L600)
- `export` `resolveCutCenterLocalMm(3 params): BayLocalMm` [L616](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L616)
- `cutHalfExtentsStudio(cut: any): { x: number; y: number; z: number } | null` [L638](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L638)
- `export` `computeCutProtrusionInBayMm(frame: SmartPartBayFrameMm, cut: any, part?: StudioPlacedItem | null): Record<BaySide, number> | null` [L670](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L670)
- `sidePanelVFromWorldZ(panelNode: any, worldZ: number): number | null` [L703](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L703)
- `panelWorldCenterMm(panelNode: any): { x: number; y: number; z: number } | null` [L718](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L718)
- `backFrontPanelUvFromWorld(3 params): { u: number; v: number } | null` [L750](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L750)
- `resolveCutFaceName(panelNode: any, refFace: string, side: BaySide): string` [L774](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L774)
- `holeUvOnPanel(4 params): { u: number; v: number } | null` [L782](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L782)
- `export` `computeSmartPartCutIntents(4 params): SmartPartCutIntent[]` [L804](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L804)
- `round3(v: number): number` [L921](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L921)
- `projectOntoSide(frame: SmartPartBayFrameMm, p: BayLocalMm, side: BaySide): BayLocalMm` [L926](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L926)
- `sectionCornersLocal(p: BayLocalMm, e: { x: number; y: number; z: number }, side: BaySide): BayLocalMm[]` [L940](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L940)
- `export` `applySmartPartCutIntents(4 params): boolean` [L969](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L969)

**Typy i Modele Danych:**
- `interface BayWallRef` { nodeId, face, planeCoordMm } [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L39)
- `interface SmartPartBayFrameMm` { xL, xR, zBottom, zTop, backY, frontY, backToFront, widthMm, +3 more } [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L48)
- `interface StudioPlacedItem` { widthMm, heightMm, depthMm, xMm, yMm, zMm, refX, refY, +4 more } [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L64)
- `interface BayLocalMm` { x, h, d } [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L80)
- `interface SmartPartCutIntent` { targetNodeId, feature } [L690](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L690)
- `type BaySide` = `'left' | 'right' | 'bottom' | 'top' | 'back' | 'front'` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L34)
- `type BayWallRefs` = `Partial<Record<BaySide, BayWallRef>>` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L45)

**Stałe i Słowniki:**
- `const BAY_SIDES: readonly BaySide[]` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-bay-placement.ts#L36)

### [A2_bloki/hangers/smartpart-cut-model.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-cut-model.ts)

**Klasy:**
- `class SmartPartCutModel` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-cut-model.ts#L6)
  - `constructor(opts: { id: string; name: string; cutType?: string; w...): void` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-cut-model.ts#L17)
  - `toJSON(): Record<string, any>` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-cut-model.ts#L35)
  - `fromJSON(data: any): SmartPartCutModel` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-cut-model.ts#L49)

**Funkcje:**
- `export` `isSmartPartCutDomain(data: any): boolean` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/hangers/smartpart-cut-model.ts#L63)

### [A2_bloki/ui/BlokiFloatingWindow.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/ui/BlokiFloatingWindow.tsx)

**Funkcje:**
- `cloneParams(params: any): Record<string, any>` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/ui/BlokiFloatingWindow.tsx#L74)
- `export` `BlokiFloatingWindow({ container, projectModel, onClose, isDocked, onNewBloki }: Props): any` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/ui/BlokiFloatingWindow.tsx#L78)

**Typy i Modele Danych:**
- `interface Props` { container, projectModel, onClose, isDocked, onNewBloki } [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/ui/BlokiFloatingWindow.tsx#L66)

**Stałe i Słowniki:**
- `const MODULE_TYPES: Record<string, { type: string; label: string; c...` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/ui/BlokiFloatingWindow.tsx#L43)
- `const INTERNAL_MODULE_TYPES` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/ui/BlokiFloatingWindow.tsx#L62)
- `const EXTERNAL_MODULE_TYPES` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/ui/BlokiFloatingWindow.tsx#L63)
- `const PANEL_MODULE_TYPES` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/ui/BlokiFloatingWindow.tsx#L64)

## <a id="a3_smartframe"></a>A3 SmartFrame (Generatory Korpusów, Ściany Referencyjne)

### [A3_smartframe/back-groove-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts)

**Funkcje:**
- `isCornerNailer(panel: PanelState): boolean` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L31)
- `translationOf(panel: PanelState): Vec3` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L48)
- `roleUpper(panel: PanelState): string` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L52)
- `backThicknessAxis(back: PanelState): Axis` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L57)
- `backWorldBox(back: PanelState): WorldBox` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L66)
- `isHorizontalHost(role: string): boolean` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L86)
- `isVerticalHost(role: string): boolean` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L96)
- `isGrooveHost(role: string): boolean` [L108](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L108)
- `verticalHostBox(panel: PanelState): WorldBox` [L114](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L114)
- `horizontalHostBox(panel: PanelState): WorldBox` [L135](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L135)
- `hostWorldBox(panel: PanelState): WorldBox` [L147](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L147)
- `boxesOverlap(a: WorldBox, b: WorldBox): boolean` [L153](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L153)
- `pickMarginNm(back: PanelState, target: PanelState): number` [L161](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L161)
- `perpendicularBackBoxes(back: PanelState, allPanels?: PanelState[]): WorldBox[]` [L183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L183)
- `clipGroove(6 params): { u_nm: number; v_nm: number; width_nm: number;...` [L194](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L194)
- `grooveOnVertical(4 params): GrooveIntent | null` [L214](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L214)
- `horizontalMeshVPointsToWorldBack(target: PanelState): boolean` [L289](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L289)
- `horizontalMeshUPointsToWorldRight(target: PanelState): boolean` [L296](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L296)
- `grooveOnHorizontal(5 params): GrooveIntent | null` [L302](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L302)
- `isTraverseVTop(panel: PanelState): boolean` [L487](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L487)
- `isRearTraverseV(panel: PanelState): boolean` [L498](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L498)
- `standingTraverseVHostBox(panel: PanelState): WorldBox` [L509](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L509)
- `isGrooveOpenToEdge(6 params): boolean` [L521](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L521)
- `grooveOnRearTraverseV(4 params): GrooveIntent | null` [L542](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L542)
- `export` `buildBackGrooves(panels: PanelState[]): GrooveIntent[]` [L590](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L590)

**Typy i Modele Danych:**
- `interface PanelState` { id, role, key, name, isCornerNailer, customProperties, dim_nm, localMatrix, +3 more } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L15)
- `interface WorldBox` { x0, x1, y0, y1, z0, z1 } [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L42)
- `type Axis` = `'X' | 'Y' | 'Z'` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-groove-builder.ts#L40)

### [A3_smartframe/back-overlap.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-overlap.ts)

**Funkcje:**
- `export` `defaultBackOverlapMm(rules: any): number` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-overlap.ts#L10)
- `export` `defaultBackEdgeOverlapMm(paramName: string, cabinetType?: string, rules?: any): number` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-overlap.ts#L20)
- `export` `defaultBackOverlapForCabinetMm(cabinetType?: string, rules?: any): number` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-overlap.ts#L41)
- `export` `defaultBackOverlapNm(rules: any): number` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-overlap.ts#L45)
- `export` `isBackPanelEdgeParam(paramName: string, role?: string): boolean` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-overlap.ts#L51)
- `export` `readOffsetMm(5 params): number` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-overlap.ts#L56)
- `export` `readBackEdgeOffset(5 params): number` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/back-overlap.ts#L81)

### [A3_smartframe/commands/create-korpus-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/create-korpus-command.ts)

**Klasy:**
- `class CreateKorpusCommand` *implements Command* [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/create-korpus-command.ts#L16)
  - `constructor(params: KorpusCreateParams): void` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/create-korpus-command.ts#L25)
  - `execute(document: ProjectDocument): void` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/create-korpus-command.ts#L33)
  - `undo(document: ProjectDocument): void` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/create-korpus-command.ts#L133)

### [A3_smartframe/commands/set-korpus-offset-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-offset-command.ts)

**Klasy:**
- `class SetKorpusOffsetCommand` *implements Command* [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-offset-command.ts#L10)
  - `constructor(4 params): void` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-offset-command.ts#L16)
  - `execute(document: ProjectDocument): void` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-offset-command.ts#L28)
  - `undo(document: ProjectDocument): void` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-offset-command.ts#L32)

### [A3_smartframe/commands/set-korpus-top-panel-config-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-top-panel-config-command.ts)

**Klasy:**
- `class SetKorpusTopPanelConfigCommand` *implements Command* [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-top-panel-config-command.ts#L17)
  - `constructor(3 params): void` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-top-panel-config-command.ts#L23)
  - `execute(document: ProjectDocument): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-top-panel-config-command.ts#L34)
  - `undo(document: ProjectDocument): void` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-top-panel-config-command.ts#L38)

**Typy i Modele Danych:**
- `interface TopPanelConfig` { mode, width } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-top-panel-config-command.ts#L12)
- `type TopPanelMode` = `'FULL' | 'TRAVERSE_H' | 'TRAVERSE_V'` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/set-korpus-top-panel-config-command.ts#L10)

### [A3_smartframe/commands/sync-back-grooves-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/sync-back-grooves-command.ts)

**Klasy:**
- `class SyncBackGroovesCommand` *implements Command* [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/sync-back-grooves-command.ts#L13)
  - `constructor(containerId: string): void` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/sync-back-grooves-command.ts#L22)
  - `execute(document: ProjectDocument): void` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/sync-back-grooves-command.ts#L29)
  - `undo(document: ProjectDocument): void` [L178](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/commands/sync-back-grooves-command.ts#L178)

### [A3_smartframe/container-view.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts)

**Klasy:**
- `class ContainerView` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L19)
  - `constructor(scene: any, containerModel: any): void` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L27)
  - `_isBlokiContainer(): boolean` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L46)
  - `_isApplianceContainer(): boolean` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L53)
  - `_isHandleContainer(): boolean` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L57)
  - `_isHangerContainer(): boolean` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L62)
  - `_isHangersGroupContainer(): boolean` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L67)
  - `_isStudioSmartPartGhost(): boolean` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L72)
  - `_meshMetadataType(): string` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L81)
  - `_defaultEdgeColor(): void` [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L90)
  - `_defaultEmissiveColor(): void` [L115](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L115)
  - `_getSlopedInfo(): { isSloped: boolean; yTopLeft: number; yTopRigh...` [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L139)
  - `_createSlopedVertexData(3 params): void` [L235](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L235)
  - `_buildWireframe(): void` [L282](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L282)
  - `update(): void` [L400](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L400)
  - `setSelected(isSelected: boolean): void` [L438](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L438)
  - `dispose(): void` [L471](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/container-view.ts#L471)

### [A3_smartframe/geometry/cabinet-thickness.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/cabinet-thickness.ts)

**Funkcje:**
- `export` `getRootSubcomponents(rules: any): Record<string, any>` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/cabinet-thickness.ts#L13)
- `findThicknessInRules(rules: any, candidates: string[]): number | undefined` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/cabinet-thickness.ts#L32)
- `export` `resolveCarcassBoardThicknessFromRules(rules: any): number | undefined` [L76](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/cabinet-thickness.ts#L76)
- `export` `resolveCabinetPartThickness(3 params): number | undefined` [L97](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/cabinet-thickness.ts#L97)
- `export` `requireCabinetPartThickness(4 params): number` [L176](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/cabinet-thickness.ts#L176)

**Typy i Modele Danych:**
- `interface CabinetThicknessLookupContext` { rules, baseRules, thicknessOverrides, targetContainer, document } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/cabinet-thickness.ts#L20)

### [A3_smartframe/geometry/corner90-geometry.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/corner90-geometry.ts)

**Funkcje:**
- `export` `resolveCorner90Geometry(matchedKey: string, role: string, ctx: Corner90GeometryContext): Partial<CabinetGeometryPart> | null` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/corner90-geometry.ts#L52)

**Typy i Modele Danych:**
- `interface Corner90GeometryContext` { W, H, D, thickness, backOffset, shiftX, shiftY, shiftZ, +17 more } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/corner90-geometry.ts#L22)

### [A3_smartframe/geometry/skosny-geometry.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/skosny-geometry.ts)

**Funkcje:**
- `export` `resolveSkosnyGeometry(matchedKey: string, role: string, o: SkosnyFbGeometryContext): Partial<CabinetGeometryPart> | null` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/skosny-geometry.ts#L63)
- `export` `resolveSkosnyDachGeometry(matchedKey: string, role: string, o: SkosnyFbGeometryContext): Partial<CabinetGeometryPart> | null` [L169](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/skosny-geometry.ts#L169)
- `export` `resolveSkosnyLrGeometry(matchedKey: string, role: string, o: SkosnyLrGeometryContext): Partial<CabinetGeometryPart> | null` [L274](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/skosny-geometry.ts#L274)
- `export` `resolveSkosnyLrUcGeometry(matchedKey: string, role: string, o: SkosnyLrGeometryContext): Partial<CabinetGeometryPart> | null` [L437](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/skosny-geometry.ts#L437)

**Typy i Modele Danych:**
- `interface SkosnyFbGeometryContext` { W, D, hF, hB, maxH, thickness, backOffset, shiftX, +10 more } [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/skosny-geometry.ts#L13)
- `interface SkosnyLrGeometryContext` { W_mm, D_mm, wysokosc_lewy_mm, wysokosc_prawy_mm, max_wysokosc_mm, grubosc_mm, grubosc_dolny_mm, grubosc_gorny_mm, +12 more } [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/skosny-geometry.ts#L34)

### [A3_smartframe/geometry/standard-geometry.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/standard-geometry.ts)

**Funkcje:**
- `resolveTopOccupyHeightMm(2 params): number` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/standard-geometry.ts#L63)
- `export` `resolveCabinetPartGeometry(key: string, comp: any, ctx: CabinetPartGeometryContext): Partial<CabinetGeometryPart> | null` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/standard-geometry.ts#L73)

**Typy i Modele Danych:**
- `interface CabinetPartGeometryContext` { szerokosc_mm, wysokosc_mm, glebokosc_mm, cofniecie_plecow_mm, wpuszczenie_plecow_mm, zonePrefix, zoneId, tryb_wienca_gornego, +16 more } [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/standard-geometry.ts#L24)

### [A3_smartframe/geometry/subcomponents-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/subcomponents-builder.ts)

**Funkcje:**
- `export` `buildCabinetSubcomponents(6 params): void` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/subcomponents-builder.ts#L13)
- `export` `collectCabinetGeometry(6 params): CabinetGeometryPart[]` [L105](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/geometry/subcomponents-builder.ts#L105)

### [A3_smartframe/groove-intent.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/groove-intent.ts)

**Typy i Modele Danych:**
- `interface GrooveFeatureLCS` { type, face, params } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/groove-intent.ts#L12)
- `interface GrooveIntent` { targetNodeId, dimensionsOverride_nm, positionOverride_nm, feature } [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/groove-intent.ts#L47)

### [A3_smartframe/korpus-defaults.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-defaults.ts)

**Funkcje:**
- `rulesForType(type: KorpusDefaultsCabinetType): any` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-defaults.ts#L40)
- `export` `korpusDefaultDimsMm(rules: any): KorpusDefaultsMm` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-defaults.ts#L48)
- `export` `korpusDefaultsForTypeMm(type: KorpusDefaultsCabinetType): KorpusDefaultsMm` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-defaults.ts#L60)

**Typy i Modele Danych:**
- `interface KorpusDefaultsMm` { szerokosc_mm, wysokosc_mm, glebokosc_mm, liczba_stref, wysokosc_strefy_dolnej_mm, wysokosc_strefy_srodkowej_mm, szerokosc_blendy_mm, strona_blendy, +7 more } [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-defaults.ts#L19)
- `type KorpusDefaultsCabinetType` = `CabinetType` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-defaults.ts#L16)

### [A3_smartframe/korpus-offset-gizmo.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-offset-gizmo.ts)

**Funkcje:**
- `isPlecyXPanel(panel: any): boolean` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-offset-gizmo.ts#L64)
- `export` `resolveBackPanelFaceMapping(panel?: any): Record<string, string>` [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-offset-gizmo.ts#L79)
- `export` `isTraverseVPanel(panel?: any): boolean` [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-offset-gizmo.ts#L90)
- `export` `resolveTopPanelFaceMapping(panel?: any): Record<string, string>` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-offset-gizmo.ts#L107)
- `export` `findOwningKorpus(doc: any, entityId: string): any | null` [L114](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-offset-gizmo.ts#L114)
- `export` `resolveBackPanelFrontParam(panel: any): { kind: 'backOffset' | 'shiftX' | 'shiftY'; par...` [L134](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-offset-gizmo.ts#L134)
- `ensureOffsets(container: any): Record<string, number>` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-offset-gizmo.ts#L157)
- `export` `registerKorpusOffsetGizmo(): void` [L242](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/korpus-offset-gizmo.ts#L242)

### [A3_smartframe/register.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/register.ts)

**Funkcje:**
- `export` `registerSmartFrameModule(): void` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/register.ts#L35)

### [A3_smartframe/rogowy90-bay.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts)

**Funkcje:**
- `isRogowy90Cabinet(node: CADNode): boolean` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L22)
- `isBlokiSubtree(node: CADNode): boolean` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L28)
- `panelThicknessMm(node: CADNode | null, fallback: number): number` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L39)
- `findRogowyPanel(cabinetNode: CADNode, keySuffixes: string[]): CADNode | null` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L46)
- `cabLocalToWorldMm(cab: CADNode, lx: number, ly: number, lz: number): { x: number; y: number; z: number }` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L69)
- `probeToCabLocalMm(cab: CADNode, probeMm: { x: number; y: number; z: number }): { x: number; y: number; z: number }` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L74)
- `findRogowy90CabinetAtPoint(doc: ProjectDocument, probeMm: { x: number; y: number; z: number }): CADNode | null` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L80)
- `makeFaceRef(4 params): FaceHitRef` [L127](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L127)
- `resolveArm(localPx: number, cornerX: number): RogowyArm` [L143](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L143)
- `export` `probeRogowy90BayFromCADPoint(2 params): DetectedBay | null` [L151](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L151)

**Typy i Modele Danych:**
- `type RogowyArm` = `'X' | 'Y'` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/rogowy90-bay.ts#L20)

### [A3_smartframe/skosny-back-grooves.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/skosny-back-grooves.ts)

**Funkcje:**
- `export` `buildSkosnyBackGrooves(cntNode: any): GrooveIntent[]` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/skosny-back-grooves.ts#L22)

### [A3_smartframe/smartframe-adapter.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts)

**Funkcje:**
- `resolveCabinetRulesForType(type?: string): any` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L20)
- `export` `resolveBlindPanelEdgeBanding(blindSide?: string): Record<string, { active: boolean; type_id: stri...` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L41)
- `export` `resolveCabinetType(raw?: string): AdapterCabinetType` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L53)
- `export` `getActiveContainer(docTarget: any): any | null` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L65)
- `export` `calcTopHeight(4 params): number` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L96)
- `export` `isBlokiHoleFeature(f: any): boolean` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L107)
- `applyPartCustomProperties(panel: any, part: any): any` [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L116)
- `applyPartClassification(panel: any, part: any): any` [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L146)
- `rebuildPanelView(panel: any): any` [L151](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L151)
- `assignPlanFeatures(4 params): any` [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L158)
- `findLcsInModelTree(modelTree: any, role?: string, name?: string): any` [L186](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L186)
- `export` `applyPlanToContainer(container: any, operationPlan: any): any` [L210](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L210)
- `export` `runEngineAndApply(9 params): any` [L516](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L516)
- `export` `initializeSmartFrameEngine(): Promise<void>` [L594](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L594)
- `export` `rebuildSmartFrameContainer(container: any): boolean` [L600](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L600)
- `buildCabinetGeneratorParams(input: { type: string; typ_korpusu?: AdapterCabinetTyp...): Record<string, any>` [L689](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L689)
- `export` `applyRealtimeUpdate(docTarget: any, params: KorpusParams, targetContainer?: any): any` [L740](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L740)
- `export` `updateContainerPosition(container: any, x: number, y: number, z: number): any` [L835](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L835)

**Typy i Modele Danych:**
- `interface KorpusParams` { szerokosc_mm, wysokosc_mm, glebokosc_mm, liczba_stref, wysokosc_strefy_dolnej_mm, wysokosc_strefy_srodkowej_mm, cofniecie_plecow_mm, grubosc_plecow_mm, +16 more } [L648](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L648)
- `type AdapterCabinetType` = `'korpus3' | 'korpus_rogowy1' | 'korpus_rogowy90' | 'korpu...` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts#L51)

### [A3_smartframe/smartframe-drag-controller.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-drag-controller.ts)

**Klasy:**
- `class SmartFrameDragController` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-drag-controller.ts#L38)
  - `startDrag(liczba_stref: 1 | 2 | 3, params: DraggedKorpusParams): void` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-drag-controller.ts#L54)
  - `startDragTemplate(template: any): void` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-drag-controller.ts#L64)
  - `endDrag(): void` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-drag-controller.ts#L78)
  - `onPointerMoveOnScene(scene: any, pointerX: number, pointerY: number): { x: number; y: number } | null` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-drag-controller.ts#L132)
  - `onDropOnScene(docTarget?: any): boolean` [L176](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-drag-controller.ts#L176)

**Typy i Modele Danych:**
- `interface DraggedKorpusParams` { szerokosc_mm, wysokosc_mm, glebokosc_mm, liczba_stref, wysokosc_strefy_dolnej_mm, wysokosc_strefy_srodkowej_mm, cofniecie_plecow_mm, szerokosc_blendy_mm, +9 more } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-drag-controller.ts#L18)

### [A3_smartframe/smartframe-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts)

**Funkcje:**
- `export` `normalizeCabinetParams(raw: CabinetPlanParams): NormalizedCabinetParams` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L67)
- `export` `calculateStandardCabinetPlan(3 params): CabinetPlanResult` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L132)
- `export` `calculateRogowy1CabinetPlan(3 params): CabinetPlanResult` [L165](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L165)
- `export` `calculateRogowy90CabinetPlan(3 params): CabinetPlanResult` [L192](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L192)
- `export` `calculateSkosnyCabinetPlan(3 params): CabinetPlanResult` [L221](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L221)
- `export` `calculateCabinetPlan(3 params): CabinetPlanResult` [L251](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L251)
- `export` `applyLcsMapping(dim: { x: number; y: number; z: number }, lcs?: any): { x: number; y: number; z: number }` [L276](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L276)
- `export` `computeCabinetZoneLayout(5 params): ZoneLayout[]` [L296](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L296)
- `export` `selectCabinetBaseRules(cabinetType?: CabinetType | string): any` [L355](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L355)
- `filterRulesForZoneCount(baseRules: any, liczba_stref: number): any` [L378](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L378)
- `flattenSingleZone(zoneNode: any): Record<string, any>` [L411](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L411)
- `resolveCabinetTypeFromRaw(rawType: unknown): CabinetType` [L429](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L429)
- `export` `planCabinet(rawParams: CabinetPlanParams): CabinetPlanResult` [L444](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts#L444)

### [A3_smartframe/smartframe-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts)

**Funkcje:**
- `export` `assertCanonicalCabinetParams(raw: Record<string, any> | null | undefined): void` [L229](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L229)

**Typy i Modele Danych:**
- `interface CabinetDimensions_mm` { szerokosc_mm, wysokosc_mm, glebokosc_mm } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L20)
- `interface CabinetEdgeBandingRule` { active, type_id, cutAngle, cutAnchor } [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L26)
- `interface CabinetLcsDefinition` { mapping, rotation, faces } [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L33)
- `interface CabinetGeometryPart` { key, name, role, material, materialName, materialCode, thickness, dim, +6 more } [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L39)
- `interface ZoneLayout` { zoneKey, size, baseOffset } [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L56)
- `interface CabinetPlanResult` { parts, zones } [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L62)
- `interface NormalizedCabinetParams` { typ_korpusu, szerokosc_mm, wysokosc_mm, glebokosc_mm, liczba_stref, wysokosc_strefy_dolnej_mm, wysokosc_strefy_srodkowej_mm, cofniecie_plecow_mm, +16 more } [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L67)
- `interface CabinetPlanParams` { szerokosc_mm, wysokosc_mm, glebokosc_mm, liczba_stref, wysokosc_strefy_dolnej_mm, wysokosc_strefy_srodkowej_mm, cofniecie_plecow_mm, grubosc_plecow_mm, +16 more } [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L104)
- `type CabinetType` = `| 'korpus3' | 'korpus_rogowy1' | 'korpus_rogowy90' | 'kor...` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L11)

**Stałe i Słowniki:**
- `const GIZMO_EXCEPTED_CABINET_PARAM_KEYS: readonly string[]` [L140](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L140)
- `const LEGACY_CABINET_PARAM_ALIASES: Readonly<Record<string, string>>` [L144](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L144)
- `const CANONICAL_CABINET_PARAM_KEYS: readonly string[]` [L210](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-types.ts#L210)

### [A3_smartframe/smartframe-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-ui.tsx)

**Funkcje:**
- `uiToEngineType(t: CabinetUiType): 'korpus3' | 'korpus_rogowy1' | 'korpus_rogowy90...` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-ui.tsx#L23)
- `export` `SmartFrameUI({ projectModel }: Props): any` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-ui.tsx#L41)

**Typy i Modele Danych:**
- `interface Props` { projectModel } [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-ui.tsx#L37)
- `type CabinetUiType` = `'KORPUS3' | 'KORPUS_ROGOWY1' | 'KORPUS_ROGOWY90' | 'KORPU...` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-ui.tsx#L20)
- `type BlindSide` = `'LEFT' | 'RIGHT'` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-ui.tsx#L21)

## <a id="a4_smartpanel"></a>A4 SmartPanel (Natywny Silnik Płyt, Obróbki, Wycięcia)

### [A4_smartpanel/alu-frame-manager.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/alu-frame-manager.ts)

**Klasy:**
- `class AluFrameManager` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/alu-frame-manager.ts#L55)
  - `getTemplates(): Record<string, AluFrameTemplate>` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/alu-frame-manager.ts#L65)
  - `getTemplateList(): AluFrameTemplate[]` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/alu-frame-manager.ts#L69)
  - `getTemplate(templateId?: string): AluFrameTemplate` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/alu-frame-manager.ts#L74)
  - `computeComponents(4 params): AluFrameComponent[]` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/alu-frame-manager.ts#L84)

**Typy i Modele Danych:**
- `interface AluProfileConfig` { width_mm, depth_mm, lip_depth_mm, lip_thickness_mm, corner_joint, finish, color } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/alu-frame-manager.ts#L15)
- `interface AluGlassConfig` { thickness_mm, type, name, color, alpha, clearance_mm } [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/alu-frame-manager.ts#L25)
- `interface AluFrameTemplate` { id, name, description, profile, glass } [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/alu-frame-manager.ts#L34)
- `interface AluFrameComponent` { id, type, name, lengthMm, widthMm, thicknessMm, cutAngle, materialName, +2 more } [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/alu-frame-manager.ts#L42)

### [A4_smartpanel/associative-dim-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim-ui.tsx)

**Funkcje:**
- `persist(panel: PanelModel, axis: AssocAxis, next: AssociativeDim | null): any` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim-ui.tsx#L20)
- `export` `AssociativeDimInputs({ panel, axis }: Props): any` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim-ui.tsx#L37)

**Typy i Modele Danych:**
- `interface Props` { panel, axis } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim-ui.tsx#L15)

### [A4_smartpanel/associative-dim.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts)

**Funkcje:**
- `resyncSolver(): void` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L11)
- `export` `emptyAssocDim(): AssociativeDim` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L34)
- `export` `isAssocComplete(dim?: AssociativeDim | null): boolean` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L38)
- `export` `faceShortLabel(face: string): string` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L42)
- `export` `planeRefLabel(ref: AssocPlaneRef | null): string` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L53)
- `resolvePlaneWorld(doc: any, ref: AssocPlaneRef | null): { point: Vec3; normal: Vec3 } | null` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L59)
- `export` `distanceBetweenPlanesMm(doc: any, a: AssocPlaneRef | null, b: AssocPlaneRef | null): number | null` [L77](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L77)
- `export` `measureAssocDimMm(doc: any, dim?: AssociativeDim | null): number | null` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L88)
- `export` `applyAssociativeDim(doc: any, panel: PanelModel, axis: AssocAxis): boolean` [L95](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L95)
- `export` `applyAllAssociativeDims(doc: any): void` [L110](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L110)

**Typy i Modele Danych:**
- `interface AssocPlaneRef` { nodeId, face, label } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L17)
- `interface AssociativeDim` { planeA, planeB, offsetMm } [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L23)
- `type AssocAxis` = `'width' | 'height'` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L15)
- `type AssociativeDims` = `{ width?: AssociativeDim | null; height?: AssociativeDim ...` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/associative-dim.ts#L29)

### [A4_smartpanel/native_core/box-topology.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/box-topology.ts)

**Funkcje:**
- `resolveCoord(c: Coord, w: number, h: number, t: number, axis: 'x' | 'y' | 'z'): number` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/box-topology.ts#L9)
- `export` `buildBoxTopology(w: number, h: number, t: number): { vertices: number[][]; edges: Array<{ key: str...` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/box-topology.ts#L24)

**Typy i Modele Danych:**
- `type Coord` = `number | 'X' | 'Y' | 'Z'` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/box-topology.ts#L7)

### [A4_smartpanel/native_core/cap-machining.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts)

**Funkcje:**
- `export` `parseFeatureFaceKey(faceName: string): { featureId: string; subType: string } | null` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L33)
- `export` `featureIdFromBrepEdgeKey(edgeKey: string): string | null` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L50)
- `emptyMesh(): FaceMeshData` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L68)
- `signedArea2D(poly: number[][]): number` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L72)
- `clipPolygonByConvex(subject: number[][], convexClip: number[][]): number[][]` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L86)
- `cleanDuplicatePoints(poly: number[][]): number[][]` [L120](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L120)
- `clipPolygonByHalfPlane(poly: number[][], axis: 'u' | 'v', bound: number, keepLess: boolean): number[][]` [L136](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L136)
- `subtractBoxFromPolygon(poly: number[][], u0: number, u1: number, v0: number, v1: number): number[][][]` [L176](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L176)
- `clipHolesToContour(holes2D: number[][][], outerContour: number[][]): number[][][]` [L215](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L215)
- `clipIntervals(start: number, end: number, holes: Array<[number, number]>): Array<[number, number]>` [L235](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L235)
- `appendQuad(5 params): any` [L262](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L262)
- `appendTriangle(mesh: FaceMeshData, pA: number[], pB: number[], pC: number[]): any` [L268](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L268)
- `export` `generateCircle(cx: number, cy: number, r: number, segments: number): any` [L274](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L274)
- `export` `isFeatureSkipped(feat: any): boolean` [L283](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L283)
- `projectBoxToFace(6 params): any` [L290](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L290)
- `export` `collectExtraHoles2D(features: any[] | undefined, w: number, h: number, t: number): Record<string, number[][][]>` [L332](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L332)
- `mergeOverlappingRectHoles(holes: number[][][]): number[][][]` [L392](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L392)
- `export` `detectLGrooveUnion(grooves: any[] | undefined, w?: number, h?: number): LGrooveUnion | null` [L496](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L496)
- `export` `featuresOnFace(features: any[] | undefined, face: string): any[]` [L612](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L612)
- `isEdgeOnContour(p0: [number, number], p1: [number, number], contour: number[][], eps): boolean` [L621](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L621)
- `export` `buildFaceMeshWithFeatures(opts: { faceData: ReturnType<typeof computeFaceData>;...): FaceBuildResult` [L649](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L649)
- `clipEdgesByMouths(2 params): CadEdge[]` [L1069](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L1069)
- `export` `appendFeatureEdges(7 params): void` [L1179](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L1179)
- `export` `isPointInPolygon2D(x: number, y: number, poly: [number, number][]): boolean` [L1346](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L1346)
- `export` `buildProfileMeshWithFeatures(opts: { pts2D: [number, number][]; zFront: number; zB...): { mesh: FaceMeshData; edges: CadEdge[] }` [L1357](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L1357)

**Typy i Modele Danych:**
- `interface LGrooveUnion` { gA, gB, polygon, innerCorner, depth, face } [L487](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L487)
- `type FaceMeshData` = `{ positions: number[]; indices: number[] }` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L15)
- `type CadEdge` = `{ key: string; points: number[][] }` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L16)
- `type FaceBuildResult` = `{ mesh: FaceMeshData; /** Osobne płaszczyzny B-rep operac...` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/cap-machining.ts#L18)

### [A4_smartpanel/native_core/edge-bevel.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts)

**Funkcje:**
- `defaultSpec(): EdgeCutSpec` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L24)
- `parseAnchor(raw: unknown): CutAnchor` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L28)
- `export` `readEdgeCutConfig(edgeBanding: Record<string, any> | null | undefined): EdgeCutConfig` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L38)
- `export` `readEdgeCutAngles(edgeBanding: Record<string, any> | null | undefined): EdgeCutAngles` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L55)
- `export` `hasEdgeCut(angles: EdgeCutAngles): boolean` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L65)
- `export` `hasEdgeCutConfig(config: EdgeCutConfig): boolean` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L69)
- `export` `bevelInsetMm(thickness: number, angleDeg: number): number` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L74)
- `isLegacyAngles(input: EdgeCutConfig | EdgeCutAngles): input is EdgeCutAngles` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L87)
- `normalizeConfig(input: EdgeCutConfig | EdgeCutAngles): EdgeCutConfig` [L91](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L91)
- `applyXEdge(6 params): void` [L105](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L105)
- `applyYEdge(6 params): void` [L128](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L128)
- `export` `buildBeveledBox(w: number, h: number, t: number, config: EdgeCutConfig | EdgeCutAngles): BeveledBox` [L155](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L155)

**Typy i Modele Danych:**
- `interface EdgeCutSpec` { angle, anchor } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L15)
- `interface BeveledBox` { top, bottom, edges, sides } [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L78)
- `type EdgeKey` = `'+X' | '-X' | '+Y' | '-Y'` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L9)
- `type CutAnchor` = `'Z_PLUS' | 'Z_MINUS'` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L11)
- `type EdgeCutAngles` = `Record<EdgeKey, number>` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L13)
- `type EdgeCutConfig` = `Record<EdgeKey, EdgeCutSpec>` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/edge-bevel.ts#L20)

### [A4_smartpanel/native_core/face-lcs.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts)

**Funkcje:**
- `export` `computeFaceData(rawFaceName: string, w: number, h: number, t: number): any` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts#L6)
- `export` `localTo3D(4 params): number[]` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts#L22)
- `export` `local3DToFaceUV(2 params): { u: number; v: number }` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts#L34)
- `export` `point3DToFaceUV(3 params): { u: number; v: number } | null` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts#L56)
- `export` `calcFaceUFromFront(5 params): number` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts#L96)
- `export` `calcFaceUFromBack(5 params): number` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts#L118)
- `export` `calcFaceVFromFront(4 params): number` [L142](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts#L142)

**Stałe i Słowniki:**
- `const PANEL_FACE_NAMES: FaceName[]` [L159](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/face-lcs.ts#L159)

### [A4_smartpanel/native_core/feature-uv.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/feature-uv.ts)

**Funkcje:**
- `export` `readFeatureUV(2 params): FeatureUV` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/feature-uv.ts#L12)
- `export` `hasFeatureParamsUV(params?: { u?: number; x?: number } | null): boolean` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/feature-uv.ts#L24)

**Typy i Modele Danych:**
- `type FeatureUV` = `{ u: number; v: number }` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/feature-uv.ts#L7)

### [A4_smartpanel/native_core/mesh_builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/mesh_builder.ts)

**Funkcje:**
- `export` `buildAluFrameMeshData(model: any): any` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/mesh_builder.ts#L20)
- `export` `buildMeshFromPanel(model: any): any` [L180](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/mesh_builder.ts#L180)

### [A4_smartpanel/native_core/panel-dimensions.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/panel-dimensions.ts)

**Funkcje:**
- `export` `validatePanelDimensionsNm(2 params): PanelDimsMm` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/panel-dimensions.ts#L18)

**Typy i Modele Danych:**
- `interface PanelDimsMm` { widthMm, heightMm, thicknessMm } [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/panel-dimensions.ts#L8)

### [A4_smartpanel/native_core/polygon-extrusion.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts)

**Funkcje:**
- `export` `classifyOutlineSegmentEdge(6 params): OutlineSegmentEdgeKey` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L12)
- `extractGrooveBoxes(features?: any[]): ExtrusionGrooveBox[]` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L57)
- `splitSegmentByGrooves(5 params): OutlineSubSegment[]` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L78)
- `export` `computeOutlineCapVertices(4 params): OutlineCapVertices` [L170](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L170)
- `buildOutlineWalls(5 params): any` [L188](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L188)
- `export` `buildPolygonPanelTopology(input: PolygonExtrusionInput): Record<string, any>` [L294](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L294)

**Typy i Modele Danych:**
- `interface OutlineSubSegment` { u0, v0, u1, v1, depthPlus, depthMinus } [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L41)
- `interface ExtrusionGrooveBox` { fu0, fu1, fv0, fv1, depth, isPlus } [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L48)
- `interface OutlineCapVertices` { topPts, bottomPts } [L165](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L165)
- `interface PolygonExtrusionInput` { outline2d, plateW, plateD, thickness, features } [L286](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L286)
- `type OutlineSegmentEdgeKey` = `'+X' | '-X' | '+Y' | '-Y' | 'NOTCH'` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/polygon-extrusion.ts#L10)

### [A4_smartpanel/native_core/topology.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts)

**Funkcje:**
- `export` `scianyKrawedzi(krawedz: string): [string, string] | undefined` [L109](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L109)
- `export` `krawedzieSciany(sciana: string): string[]` [L114](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L114)

**Typy i Modele Danych:**
- `interface FrameDefinition` { corners, u, v } [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L49)
- `type Coord` = `number | "X" | "Y" | "Z"` [L127](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L127)

**Stałe i Słowniki:**
- `const NAROZNIKI` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L13)
- `const KRAWEDZIE: Record<string, [number, number]>` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L24)
- `const SCIANY: Record<string, [number, number, number, number]>` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L40)
- `const SCIANA_RAMKA: Record<string, FrameDefinition>` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L57)
- `const KRAWEDZ_ALIASY: Record<string, string>` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L66)
- `const LISTA_SCIAN` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L75)
- `const KRAWEDZ_SCIANY: Record<string, [string, string]>` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L84)
- `const SCIANA_NORMALNA: Record<string, [number, number, number]>` [L100](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L100)
- `const NAROZNIK_WSPOLRZEDNE: [Coord, Coord, Coord][]` [L128](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/topology.ts#L128)

### [A4_smartpanel/native-panel-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native-panel-builder.ts)

**Klasy:**
- `class NativePanelBuilder` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native-panel-builder.ts#L7)
  - `build(model: any): void` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native-panel-builder.ts#L8)

### [A4_smartpanel/panel-model.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts)

**Klasy:**
- `class PanelModel` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L70)
  - `constructor(1 params): void` [L113](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L113)
  - `setDimensions(width, height, thickness): void` [L222](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L222)
  - `getLCS(): void` [L239](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L239)
  - `setLcsVisible(visible: boolean): void` [L251](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L251)
  - `isAluFrame(): boolean` [L259](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L259)
  - `convertToAluFrame(templateId: string): void` [L263](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L263)
  - `convertToSolid(): void` [L274](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L274)
  - `getFrameComponents(): AluFrameComponent[]` [L281](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L281)
  - `normalizeEdgeKey(key: string): '+X' | '-X' | '+Y' | '-Y'` [L296](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L296)
  - `setEdgeBand(2 params): void` [L310](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L310)
  - `removeEdgeBand(edgeKey: string): void` [L337](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L337)
  - `clearAllEdgeBanding(): void` [L357](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L357)
  - `setAllEdges(config: any): void` [L378](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L378)
  - `setEdgeBanding(edgeBandingMap: Record<string, any>): void` [L417](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L417)
  - `getFace(name: string): void` [L432](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L432)
  - `getAllFaces(): void` [L443](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L443)
  - `addFeature({ type, face, params }: { type: string, face: string, params: any }): void` [L458](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L458)
  - `removeFeature(id): void` [L473](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L473)
  - `getFeaturesOnFace(faceName): void` [L484](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L484)
  - `clearFeatures(): void` [L491](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L491)
  - `setFeatures(features): void` [L500](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L500)
  - `toJSON(): void` [L511](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L511)
  - `fromJSON(data: any): void` [L553](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L553)
  - `fromJSON(data: any): void` [L590](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L590)
  - `loadFromJSON(data): void` [L612](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L612)
  - `onChange(fn): void` [L659](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L659)
  - `offChange(fn): void` [L664](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L664)
  - `_emit(type, data): void` [L668](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L668)

**Funkcje:**
- `allocPanelId(): string` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L33)
- `computeFaceData(rawFaceName: string, w: number, h: number, t: number): any` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L51)
- `export` `isPanelModel(data: any): data is PanelModel` [L676](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts#L676)

### [A4_smartpanel/panel-view.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts)

**Klasy:**
- `class PanelView` [L131](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L131)
  - `constructor(scene: any, model: any): void` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L157)
  - `dispose(): void` [L199](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L199)
  - `_updateTransform(): void` [L221](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L221)
  - `rebuildGeometry(): void` [L234](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L234)
  - `updateMesh(meshData): void` [L244](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L244)
  - `_disposeVertexSpheres(): void` [L652](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L652)
  - `_disposeCurrentMeshes(): void` [L664](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L664)
  - `_updateMaterialAppearance(): void` [L676](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L676)
  - `_rebuildMeshes(): void` [L806](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L806)
  - `_rebuildAluFrame(): void` [L876](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L876)
  - `getPickableMeshes(): void` [L1026](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1026)
  - `getMaterial(faceName): void` [L1033](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1033)
  - `getBaseColor(faceName): void` [L1040](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1040)
  - `getBrepFacePositions(faceName: string): Float64Array | null` [L1051](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1051)
  - `getBrepFaceIndices(faceName: string): Uint32Array | null` [L1059](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1059)
  - `getBrepVertexLocal(): Vec3[]` [L1066](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1066)
  - `getBrepFaceOriginLocal(faceName: string): Vec3 | null` [L1074](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1074)
  - `getBrepFaceNormalLocal(faceName: string): Vec3 | null` [L1082](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1082)
  - `getBrepEdgePoints(): number[][][]` [L1089](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1089)
  - `highlightEdgeFace(edgeKey: string, highlight: boolean): void` [L1096](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1096)
  - `highlightFeature(target: any, highlight: boolean): boolean` [L1139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1139)
  - `clearFeatureHighlights(): void` [L1217](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1217)
  - `renderFeatures(): void` [L1244](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1244)
  - `_renderHole(feature): void` [L1284](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1284)
  - `_renderPocket(feature): void` [L1471](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1471)
  - `_renderCutout(feature): void` [L1483](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1483)
  - `_renderEdgeDimLines(feature, faceData, u, v, w, len, grooveMesh): void` [L1495](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1495)
  - `_createDimLine(name, p0, p1): void` [L1522](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1522)
  - `_createDimSnapHandle(feature, faceData, slot, endPos): void` [L1540](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1540)
  - `_worldToFaceUv(faceData, worldPos): void` [L1610](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1610)
  - `_updateDimLine(lineMesh, p0, p1): void` [L1626](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1626)
  - `_wireDimSnapHandle(handle, feature, faceData, slot, rect, lines, live, offset, grooveMesh): void` [L1637](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1637)
  - `_renderPoint(feature): void` [L1746](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1746)
  - `_renderGroove(feature): void` [L1763](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1763)
  - `_facePoint(faceData, u, v, normalOffset): void` [L1781](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1781)
  - `_orientToFace(mesh, faceData): void` [L1798](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1798)
  - `_disposeFeatureMarkers(): void` [L1820](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1820)
  - `_buildLCSNode(): void` [L1833](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1833)
  - `setLcsVisible(visible: boolean): void` [L1923](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1923)
  - `setSelected(isSelected: boolean): void` [L1935](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1935)
  - `setPanelVisible(visible: boolean): void` [L1953](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L1953)

**Funkcje:**
- `computePlaneFromMeshData(positions: number[], indices: number[]): MeshPlaneBasis | null` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L30)
- `getOrCreatePanelTexture(url: string, scene: any, onFailed?: () => void): any` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L83)

**Typy i Modele Danych:**
- `interface MeshPlaneBasis` { origin, normal } [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-view.ts#L21)

## <a id="a6_agd"></a>A6 AGD (Sprzęt AGD, Modele 3D, Wymiary Montażowe)

### [A6_agd/agd-bay-docking.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/agd-bay-docking.ts)

**Funkcje:**
- `export` `createSmartApplianceInDetectedBay(3 params): CADNode | null` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/agd-bay-docking.ts#L36)

**Typy i Modele Danych:**
- `interface DockApplianceOptions` { kind, name, params, template } [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/agd-bay-docking.ts#L29)

### [A6_agd/appliance-library-store.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/appliance-library-store.ts)

**Klasy:**
- `class ApplianceLibraryStore` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/appliance-library-store.ts#L44)
  - `getAll(): ApplianceTemplateItem[]` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/appliance-library-store.ts#L56)
  - `getById(id: string): ApplianceTemplateItem | undefined` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/appliance-library-store.ts#L60)
  - `registerItem(item: ApplianceTemplateItem): void` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/appliance-library-store.ts#L64)
  - `subscribe(cb: () => void): () => void` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/appliance-library-store.ts#L74)
  - `instantiate(3 params): any` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/appliance-library-store.ts#L86)

**Stałe i Słowniki:**
- `const DEFAULT_APPLIANCE_TEMPLATES: ApplianceTemplateItem[]` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/appliance-library-store.ts#L11)

### [A6_agd/microwave-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/microwave-engine.ts)

**Funkcje:**
- `export` `planMicrowave(params: MicrowaveParamsMm): { parts: AppliancePartPlanMm[]; corpusHeight: n...` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/microwave-engine.ts#L42)

**Typy i Modele Danych:**
- `interface AppliancePartPlanMm` { key, name, role, loc, dim, rotationDeg, lcs, color, +1 more } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/microwave-engine.ts#L14)

**Stałe i Słowniki:**
- `const APPLIANCE_LCS` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/microwave-engine.ts#L30)
- `const APPLIANCE_FRONT_COLOR` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/microwave-engine.ts#L37)
- `const APPLIANCE_CORPUS_COLOR` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/microwave-engine.ts#L40)

### [A6_agd/smart-appliance-core.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-core.ts)

**Funkcje:**
- `export` `ensureSmartApplianceGeneratorParams(container: ContainerModel, kind: ApplianceKind): void` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-core.ts#L33)
- `export` `getApplianceParamsMm(container: ContainerModel): MicrowaveParamsMm` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-core.ts#L49)
- `export` `rebuildSmartAppliance(container: ContainerModel, docTarget?: any): boolean` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-core.ts#L82)
- `export` `createSmartAppliance(options: CreateApplianceOptions, docTarget?: any): CADNode | null` [L211](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-core.ts#L211)
- `export` `syncApplianceBayFromRefs(container: ContainerModel, docTarget?: any): boolean` [L285](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-core.ts#L285)

**Typy i Modele Danych:**
- `interface CreateApplianceOptions` { kind, name, position, params, targetCabinetId } [L200](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-core.ts#L200)

### [A6_agd/smart-appliance-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts)

**Funkcje:**
- `export` `isSmartApplianceContainer(container: any): boolean` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts#L83)
- `export` `isAppliancePart(panel: any): boolean` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts#L89)

**Typy i Modele Danych:**
- `interface MicrowaveParamsMm` { frontHeight, nalGoraMicro, nalDolneMicro, frontWidth, frontDepth, corpusWidth, corpusDepth, bayDepth } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts#L12)
- `interface OvenParamsMm` { frontHeight, nalGoraOven, nalDolneOven, frontWidth, frontDepth, corpusWidth, corpusDepth, bayDepth } [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts#L31)
- `interface ApplianceTemplateItem` { id, name, kind, source, description, thumbnail, glbPath, defaultParams } [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts#L52)
- `type ApplianceKind` = `'MICROWAVE' | 'OVEN' | 'DISHWASHER' | 'HOB' | 'FRIDGE' | ...` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts#L10)
- `type ApplianceParamsMm` = `MicrowaveParamsMm | OvenParamsMm | Record<string, any>` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts#L50)

**Stałe i Słowniki:**
- `const SMART_APPLIANCE_TYPE` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts#L8)
- `const DEFAULT_MICROWAVE_PARAMS: MicrowaveParamsMm` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts#L63)
- `const DEFAULT_OVEN_PARAMS: OvenParamsMm` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A6_agd/smart-appliance-types.ts#L73)

## <a id="a7_material"></a>A7 Material (Cenniki, Obrzeża, Routing Obróbczy)

### [A7_material/material-commands.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts)

**Klasy:**
- `class AssignMaterialCommand` *implements Command* [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L51)
  - `constructor(targetNodeId: string, newMaterial: MaterialItem, scope: MaterialScope): void` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L64)
  - `execute(document: ProjectDocument): void` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L73)
  - `undo(document: ProjectDocument): void` [L237](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L237)
- `class SetEdgeBandingCommand` *implements Command* [L368](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L368)
  - `constructor(4 params): void` [L380](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L380)
  - `execute(document: ProjectDocument): void` [L390](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L390)
  - `undo(document: ProjectDocument): void` [L474](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L474)

**Funkcje:**
- `isBlokiFrontModule(gp: Record<string, any> | undefined | null): boolean` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L27)
- `isFrontLikePanel(p: { role?: string; name?: string }): boolean` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L44)

**Typy i Modele Danych:**
- `interface PanelMaterialSnapshot` { panelId, materialId, materialName, materialCode, thickness, color } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L12)
- `interface BlokiFrontThicknessSnapshot` { containerId, grubosc_frontu_mm } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-commands.ts#L22)

### [A7_material/material-database.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts)

**Klasy:**
- `class MaterialDatabase` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L82)
  - `constructor(): void` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L86)
  - `getAllMaterials(): MaterialItem[]` [L180](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L180)
  - `getMaterialById(id: string): MaterialItem | undefined` [L184](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L184)
  - `getMaterialInfo(rawInput?: string, fallbackThickness?: number): MaterialInfo` [L193](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L193)
  - `getEdgeBandingTypes(): EdgeBandingType[]` [L294](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L294)
  - `getEdgeBandingById(id: string): EdgeBandingType | undefined` [L298](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L298)
  - `mergeOverlay(overlay: { materials?: MaterialItem[]; edgeBandings?: Ed...): void` [L307](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L307)
  - `getCategories(): string[]` [L331](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L331)
  - `getAvailableThicknesses(): number[]` [L339](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L339)
  - `filterMaterials(filters: MaterialFilters): MaterialItem[]` [L347](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L347)

**Funkcje:**
- `export` `resolveCatalogThicknessMm(3 params): number` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-database.ts#L59)

### [A7_material/material-pricing.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-pricing.ts)

**Klasy:**
- `class MaterialPricingCalculator` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-pricing.ts#L5)
  - `calculatePanel(panel: any): PanelPricingCalculation | null` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-pricing.ts#L9)
  - `calculateProject(document: any): ProjectPricingSummary` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-pricing.ts#L88)

### [A7_material/material-processing.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-processing.ts)

**Funkcje:**
- `export` `mapLegacyCategoryName(name: string | null | undefined): MaterialCategoryCode` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-processing.ts#L31)
- `export` `resolveProcessingPath(node: RoutableNode | null | undefined): ProcessingPath` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-processing.ts#L56)

**Typy i Modele Danych:**
- `interface RoutableNode` { nodeType, role, materialCategory, library_id } [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-processing.ts#L43)
- `type MaterialCategoryCode` = `| 'BOARD' // płyta meblowa (wiórowa, MDF, laminowana) -> ...` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-processing.ts#L11)
- `type ProcessingPath` = `| 'SAW_CNC' // piła + centrum CNC (płyty) | 'GLASS_SHOP' ...` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-processing.ts#L20)

### [A7_material/material-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-types.ts)

**Typy i Modele Danych:**
- `interface MaterialItem` { id, name, code, category, thickness_mm, density_kg_m3, color, hexColor, +8 more } [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-types.ts#L7)
- `interface EdgeBandingType` { id, name, thickness_mm, width_mm, price_per_mb, color } [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-types.ts#L26)
- `interface PanelPricingCalculation` { panelId, panelName, materialName, materialCode, thickness_mm, area_m2, volume_m3, weight_kg, +4 more } [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-types.ts#L35)
- `interface ProjectPricingSummary` { totalArea_m2, totalVolume_m3, totalWeight_kg, totalEdgeBanding_mb, totalMaterialCost, totalEdgeBandingCost, totalCost, panelsCount, +1 more } [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-types.ts#L50)
- `interface MaterialFilters` { category, thickness, searchQuery, sortMode } [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-types.ts#L69)
- `interface MaterialInfo` { id, code, name, thickness_mm, fullLabel, category } [L76](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-types.ts#L76)
- `type MaterialScope` = `'SINGLE' | 'CONTAINER' | 'BLOKI' | 'PROJECT'` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/material-types.ts#L5)

### [A7_material/materials-document-extension.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-document-extension.ts)

**Funkcje:**
- `stubFromPanelData(data: { materialId: string; materialName?: string; ma...): MaterialItem` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-document-extension.ts#L23)
- `rememberMaterial(4 params): void` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-document-extension.ts#L42)
- `export` `collectUsedMaterials(document: ProjectDocument, database): MaterialsExtensionJSON` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-document-extension.ts#L57)
- `export` `attachMaterialsExtension(document: ProjectDocument): () => void` [L102](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-document-extension.ts#L102)

**Typy i Modele Danych:**
- `interface MaterialsExtensionJSON` { version, materials, edgeBandings } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-document-extension.ts#L17)

**Stałe i Słowniki:**
- `const MATERIALS_DOCUMENT_SECTION` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-document-extension.ts#L14)
- `const MATERIALS_EXTENSION_VERSION` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-document-extension.ts#L15)

### [A7_material/materials-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-ui.tsx)

**Funkcje:**
- `export` `MaterialsUI({ projectModel: _projectModel }: Props): any` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-ui.tsx#L9)

**Typy i Modele Danych:**
- `interface Props` { projectModel } [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A7_material/materials-ui.tsx#L5)

## <a id="a8_pmi"></a>A8 PMI (Wymiarowanie, Adnotacje 3D, Etykiety)

### [A8_pmi/dimension-solver.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts)

**Funkcje:**
- `export` `v3(x, y, z): Vec3` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L20)
- `export` `v3Copy(v: Vec3): Vec3` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L21)
- `export` `v3Add(a: Vec3, b: Vec3): Vec3` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L22)
- `export` `v3Sub(a: Vec3, b: Vec3): Vec3` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L23)
- `export` `v3Scale(v: Vec3, s: number): Vec3` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L24)
- `export` `v3Negate(v: Vec3): Vec3` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L25)
- `export` `v3Dot(a: Vec3, b: Vec3): number` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L26)
- `export` `v3Cross(a: Vec3, b: Vec3): Vec3` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L27)
- `export` `v3Len(v: Vec3): number` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L30)
- `export` `v3LenSq(v: Vec3): number` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L31)
- `export` `v3Normalize(v: Vec3): Vec3` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L32)
- `export` `v3Lerp(a: Vec3, b: Vec3, t: number): Vec3` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L36)
- `export` `mat4Identity(): Mat4` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L47)
- `export` `mat4FromAxes(ax: Vec3, ay: Vec3, az: Vec3, t: Vec3): Mat4` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L58)
- `export` `mat4TransformPoint(m: Mat4, p: Vec3): Vec3` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L69)
- `export` `mat4TransformDir(m: Mat4, d: Vec3): Vec3` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L78)
- `export` `mat4Invert(m: Mat4): Mat4 | null` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L87)
- `export` `computeTextMetrics(textValue: string, fontSizeWorld: number, charAspect): [number, number]` [L258](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L258)
- `export` `solveArrowPlacement(opts: { dimP1World: Vec3; dimP2World: Vec3; fwdWorld:...): ArrowPlacementResult` [L273](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L273)
- `toLocalPoint(frame: ProjectionFrame, pWorld: Vec3): Vec3` [L327](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L327)
- `toLocalDir(frame: ProjectionFrame, dirWorld: Vec3 | null): Vec3 | null` [L331](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L331)
- `toWorldPoint(frame: ProjectionFrame, pLocal: Vec3): Vec3` [L338](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L338)
- `export` `isFrameDegenerate(frame: ProjectionFrame, cfg: SolverConfig): boolean` [L342](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L342)
- `export` `orthoBendPoint(anchorLocal: Vec3, dimPtLocal: Vec3): Vec3` [L349](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L349)
- `export` `buildOrthoSegments(anchorLocal: Vec3, dimPtLocal: Vec3): Vec3[]` [L353](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L353)
- `export` `solveHelperSide(opts: { anchorLocal: Vec3; edgeDirLocal: Vec3 | null;...): HelperSolve` [L358](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L358)
- `resolveForceStraight(policy: HelperPolicy): [boolean, boolean]` [L457](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L457)
- `resolveDimLineZ(a1z: number, a2z: number, fp1: boolean, fp2: boolean): number` [L466](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L466)
- `composeStatus(s1: HelperSolve, s2: HelperSolve): StatusCode` [L472](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L472)
- `export` `orthoElbowNeeded(anchor: Vec3, dim: Vec3, eps: number): boolean` [L487](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L487)
- `helperRenderBroken(side: HelperSolve, forceStraight: boolean, eps): boolean` [L494](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L494)
- `export` `solveDimension(3 params): SolverResult` [L506](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L506)

**Typy i Modele Danych:**
- `interface Vec3` { x, y, z } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L14)
- `interface ProjectionFrame` { originWorld, axisXWorld, axisYWorld, axisZWorld, matrixWorld, matrixWorldInv, source } [L164](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L164)
- `interface SelectionInput` { anchor1World, anchor2World, helperAnchor1World, helperAnchor2World, edgeDir1World, edgeDir2World, faceNormal1World, faceNormal2World, +3 more } [L174](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L174)
- `interface SolverConfig` { epsLen, epsAng, epsParallel, minEscapeLen, minConnectorLen, preferOrthoWhenEdgeParallelToMeasureAxis, forcebrokenWhenOffsetCrosses, clampNegativeTPolicy, +8 more } [L188](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L188)
- `interface ArrowPlacementResult` { mode, arrowLen, arrowWid, dimLineP1, dimLineP2 } [L226](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L226)
- `interface SolverResult` { valueLength, dimLineWorld, helper1SegmentsWorld, helper2SegmentsWorld, bend1World, bend2World, textOriginWorld, textTangentWorld, +9 more } [L234](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L234)
- `interface HelperSolve` { segmentsLocal, bendLocal, usedBroken, usedNormalFallback, usedOrthoFallback, reason } [L318](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L318)
- `type Mat4` = `number[]` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L45)
- `enum FrameSource` { GLOBAL, LOCAL_OBJECT, CUSTOM_PLANE } [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L116)
- `enum HelperPolicy` { BOTH_AUTO, P1_STRAIGHT_P2_AUTO, P1_AUTO_P2_STRAIGHT, BOTH_STRAIGHT } [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L122)
- `enum ArrowMode` { INSIDE, OUTSIDE, SPLIT } [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L129)
- `enum StatusCode` { OK_STRAIGHT, OK_BROKEN_P1, OK_BROKEN_P2, OK_BROKEN_BOTH, FALLBACK_NORMAL_P1, FALLBACK_NORMAL_P2, FALLBACK_NORMAL_BOTH, FALLBACK_ORTHO_P1, FALLBACK_ORTHO_P2, FALLBACK_ORTHO_BOTH, ERR_DEGENERATE_FRAME, ERR_ZERO_LENGTH } [L135](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L135)
- `enum FallbackReason` { NONE, EDGE_MISSING, EDGE_PARALLEL_TO_MEASURE, EDGE_PARALLEL_TO_OFFSET, NEGATIVE_T_CLAMPED, NORMAL_MISSING, NORMAL_PARALLEL_TO_MEASURE } [L150](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L150)

**Stałe i Słowniki:**
- `const DEFAULT_SOLVER_CONFIG: SolverConfig` [L207](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/dimension-solver.ts#L207)

### [A8_pmi/pmi-axis-guide-pick.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts)

**Funkcje:**
- `export` `distancePointToSegment2D(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L30)
- `screenDistanceToGuide(4 params): number | null` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L46)
- `preferGlobal(a: GuidePickHit, b: GuidePickHit): GuidePickHit` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L61)
- `export` `pickOffsetGuide(5 params): GuidePickHit | null` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L69)
- `export` `createWorldToScreen(scene: any): WorldToScreen | null` [L115](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L115)

**Typy i Modele Danych:**
- `interface ScreenPoint` { x, y, visible } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L17)
- `interface GuidePickHit` { candidate, distPx } [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L25)
- `type WorldToScreen` = `(point: Vec3) => ScreenPoint | null` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L23)

**Stałe i Słowniki:**
- `const GUIDE_PICK_PX` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L13)
- `const GUIDE_HOLD_PX` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L14)
- `const GUIDE_SWITCH_MARGIN_PX` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guide-pick.ts#L15)

### [A8_pmi/pmi-axis-guides.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts)

**Klasy:**
- `class PMIAxisGuides` [L184](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L184)
  - `constructor(scene: any): void` [L189](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L189)
  - `update(candidates: OffsetGuideCandidate[], activeId: string | null): void` [L193](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L193)
  - `hide(): void` [L213](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L213)
  - `dispose(): void` [L222](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L222)

**Funkcje:**
- `export` `guideCandidateId(space: GuideSpace, axisKey: CadAxisKey): string` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L44)
- `export` `globalAxisDirections(): Record<CadAxisKey, Vec3>` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L48)
- `export` `localAxisDirections(matrixWorld: number[] | null): Record<CadAxisKey, Vec3> | null` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L58)
- `export` `isGuideParallelToMeasure(guideDir: Vec3, measureDir: Vec3 | null): boolean` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L73)
- `formatGuideLabel(3 params): string` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L80)
- `export` `buildOffsetGuideCandidates(opts: BuildGuideOptions): OffsetGuideCandidate[]` [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L99)
- `export` `estimateGuideLength(scene: any, origin: Vec3): number` [L165](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L165)
- `export` `axisGuideOrigin(a: Vec3, b: Vec3): Vec3` [L392](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L392)

**Typy i Modele Danych:**
- `interface OffsetGuideCandidate` { id, space, axisKey, directionWorld, originWorld, length, valid, overlapped, +2 more } [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L30)
- `interface BuildGuideOptions` { origin, length, localMatrix, measureDirWorld } [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L92)
- `interface AxisLabelVisual` { plane, texture, material, cacheKey } [L177](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L177)
- `type CadAxisKey` = `(typeof AXIS_KEYS)[number]` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L14)
- `type GuideSpace` = `'GLOBAL' | 'LOCAL'` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L15)

**Stałe i Słowniki:**
- `const AXIS_KEYS` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L13)
- `const AXIS_COLORS: Record<CadAxisKey, [number, number, number]>` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L18)
- `const GUIDE_OVERLAP_DOT` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L25)
- `const GUIDE_PARALLEL_DOT` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-axis-guides.ts#L28)

### [A8_pmi/pmi-bridge.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts)

**Funkcje:**
- `export` `iterHelperLineSegments(opts: { p1Anchor: Vec3; p1Bend: Vec3; p1Dim: Vec3; us...): Generator<HelperSegment>` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L68)
- `export` `helperSegmentsFromRenderData(rd: BridgeRenderData): HelperSegment[]` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L86)
- `export` `helperSegmentsFromSolved(solved: SolverResult, p1AnchorWorld: Vec3, p2AnchorWorld: Vec3): HelperSegment[]` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L93)
- `normalizedOrFallback(vec: Vec3 | null, fallback: Vec3, eps): Vec3` [L113](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L113)
- `export` `axesMapWorld(axisSpace: string, matrixWorld: Mat4 | any | null): Record<string, Vec3>` [L119](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L119)
- `projectPointOnPlane(point: Vec3, planeOrigin: Vec3, planeNormal: Vec3): Vec3` [L135](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L135)
- `canonicalMeasureAnchors(opts: { anchor1World: Vec3; anchor2World: Vec3; axisS...): { anchor1World: Vec3; anchor2World: Vec3 }` [L145](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L145)
- `export` `computeAvailableMeasureAxes(opts: { anchor1World: Vec3; anchor2World: Vec3; axisS...): AvailableMeasureAxes` [L189](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L189)
- `orthonormalAxes(axisX: Vec3, axisYSeed: Vec3): [Vec3, Vec3, Vec3] | null` [L233](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L233)
- `dominantMeasureAxisKey(delta: Vec3, axisSpace: string, axisMap: Record<string, Vec3>): string` [L248](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L248)
- `axisKeyAlongDirection(dirWorld: Vec3 | null, axisMap: Record<string, Vec3>): string | null` [L275](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L275)
- `planeNormalMeasureAxis(normalWorld: Vec3 | null, delta: Vec3, axisMap: Record<string, Vec3>): string | null` [L299](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L299)
- `offsetAxisSeed(4 params): Vec3` [L311](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L311)
- `export` `resolveMeasureAxis(opts: { axisSpace: string; matrixWorld: Mat4 | null; ...): MeasureAxisResolution | null` [L364](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L364)
- `export` `solveDimensionBridge(opts: { axisSpace: string; matrixWorld: Mat4 | null; ...): BridgeSolveResult | null` [L463](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L463)
- `export` `getRenderData(opts: { axisSpace: string; matrixWorld: Mat4 | null; ...): BridgeRenderData | null` [L594](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L594)

**Typy i Modele Danych:**
- `interface BridgeSolveResult` { solved, frame, axisXWorld, axisYWorld, axisZWorld, requestedOffset } [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L27)
- `interface BridgeRenderData` { p1DimWorld, p2DimWorld, p1AnchorWorld, p2AnchorWorld, p1BendWorld, p2BendWorld, useBrokenP1, useBrokenP2, +13 more } [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L36)
- `interface AxisDistanceInfo` { axisKey, lengthMM, available } [L172](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L172)
- `interface AvailableMeasureAxes` { axes, distance3DMM, isDiagonal, availableCount } [L178](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L178)
- `interface MeasureAxisResolution` { measureAxisKey, axisXWorld, lengthMM, axisMap } [L348](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L348)
- `type HelperSegment` = `[Vec3, Vec3]` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-bridge.ts#L62)

### [A8_pmi/pmi-commands.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts)

**Klasy:**
- `class AddDimensionCommand` *implements Command* [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L69)
  - `constructor(store: PMIStore, init: PMIAnnotationInit, label): void` [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L79)
  - `execute(document?: ProjectDocument): void` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L86)
  - `undo(document?: ProjectDocument): void` [L101](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L101)
- `class RemoveDimensionCommand` *implements Command* [L117](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L117)
  - `constructor(store: PMIStore, annotationId: string, label): void` [L128](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L128)
  - `execute(document?: ProjectDocument): void` [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L139)
  - `undo(document?: ProjectDocument): void` [L148](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L148)
- `class ClearDimensionsCommand` *implements Command* [L160](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L160)
  - `constructor(store: PMIStore, label): void` [L169](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L169)
  - `execute(document?: ProjectDocument): void` [L174](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L174)
  - `undo(document?: ProjectDocument): void` [L180](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L180)
- `class SetDimensionOffsetCommand` *implements Command* [L193](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L193)
  - `constructor(6 params): void` [L210](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L210)
  - `execute(document?: ProjectDocument): void` [L236](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L236)
  - `undo(document?: ProjectDocument): void` [L246](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L246)
- `class SetDimensionTextShiftCommand` *implements Command* [L261](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L261)
  - `constructor(store: PMIStore, annotationId: string, nextShiftMM: number, label): void` [L272](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L272)
  - `execute(document?: ProjectDocument): void` [L290](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L290)
  - `undo(document?: ProjectDocument): void` [L295](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L295)
- `class SetDimensionAffixesCommand` *implements Command* [L305](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L305)
  - `constructor(5 params): void` [L318](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L318)
  - `execute(document?: ProjectDocument): void` [L339](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L339)
  - `undo(document?: ProjectDocument): void` [L344](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L344)
- `class SetDimensionVisibilityCommand` *implements Command* [L354](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L354)
  - `constructor(store: PMIStore, annotationId: string, nextVisible: boolean): void` [L365](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L365)
  - `execute(document?: ProjectDocument): void` [L378](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L378)
  - `undo(document?: ProjectDocument): void` [L383](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L383)
- `class AddMeasurementCommand` *implements Command* [L393](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L393)
  - `constructor(store: PMIStore, init: PMIMeasurementInit, label): void` [L403](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L403)
  - `execute(): void` [L410](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L410)
  - `undo(): void` [L418](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L418)
- `class RemoveMeasurementCommand` *implements Command* [L428](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L428)
  - `constructor(store: PMIStore, measurementId: string, label): void` [L439](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L439)
  - `execute(): void` [L450](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L450)
  - `undo(): void` [L457](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L457)
- `class ClearMeasurementsCommand` *implements Command* [L463](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L463)
  - `constructor(store: PMIStore, label): void` [L472](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L472)
  - `execute(): void` [L477](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L477)
  - `undo(): void` [L481](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L481)
- `class SetMeasurementVisibilityCommand` *implements Command* [L486](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L486)
  - `constructor(store: PMIStore, measurementId: string, nextVisible: boolean): void` [L497](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L497)
  - `execute(): void` [L510](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L510)
  - `undo(): void` [L514](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L514)

**Funkcje:**
- `export` `executePMICommand(command: Command): void` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L25)
- `notifyDocumentChanged(document?: ProjectDocument, affectedNodeIds?: string[]): void` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L35)
- `export` `deleteActiveDimension(store: PMIStore): boolean` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L41)
- `nextCommandId(kind: string): string` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L55)
- `affectedNodesOf(ann: Pick<PMIAnnotation, 'anchor1' | 'anchor2'>): string[]` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L61)
- `affectedNodesOfMeasurement(item: Pick<PMIMeasurement, 'anchor1' | 'anchor2'>): string[]` [L389](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-commands.ts#L389)

### [A8_pmi/pmi-data.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts)

**Klasy:**
- `class PMIStore` [L233](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L233)
  - `onChange(listener: PMIChangeListener): () => void` [L290](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L290)
  - `notifyChanged(): void` [L295](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L295)
  - `onDerivedChange(listener: PMIChangeListener): () => void` [L306](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L306)
  - `notifyDerivedChanged(): void` [L311](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L311)
  - `onToolLiveChange(listener: PMIChangeListener): () => void` [L316](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L316)
  - `notifyToolLiveChanged(): void` [L321](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L321)
  - `addAnnotation(data: PMIAnnotationInit): PMIAnnotation` [L331](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L331)
  - `insertAnnotation(ann: PMIAnnotation, index: number): void` [L362](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L362)
  - `removeAnnotation(id: string): { annotation: PMIAnnotation; index: number } | ...` [L369](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L369)
  - `getAnnotation(id: string): PMIAnnotation | null` [L381](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L381)
  - `clearAll(): PMIAnnotation[]` [L385](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L385)
  - `replaceAll(annotations: PMIAnnotation[]): void` [L393](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L393)
  - `selectAnnotation(index: number): void` [L400](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L400)
  - `selectById(id: string): void` [L413](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L413)
  - `deselectAll(): void` [L417](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L417)
  - `setVisibility(id: string, visible: boolean): void` [L425](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L425)
  - `toggleAllVisibility(): void` [L432](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L432)
  - `addMeasurement(data: PMIMeasurementInit): PMIMeasurement` [L440](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L440)
  - `insertMeasurement(item: PMIMeasurement, index: number): void` [L454](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L454)
  - `removeMeasurement(id: string): { measurement: PMIMeasurement; index: number } ...` [L461](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L461)
  - `getMeasurement(id: string): PMIMeasurement | null` [L472](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L472)
  - `clearAllMeasurements(): PMIMeasurement[]` [L476](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L476)
  - `replaceAllMeasurements(items: PMIMeasurement[]): void` [L484](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L484)
  - `selectMeasurement(index: number): void` [L491](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L491)
  - `selectMeasurementById(id: string): void` [L504](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L504)
  - `setMeasurementVisibility(id: string, visible: boolean): void` [L508](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L508)
  - `applyMeasurementValue(item: PMIMeasurement, p1: Vec3, p2: Vec3, via: Vec3 | null): boolean` [L515](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L515)
  - `setOffset(id: string, offset: Vec3, offsetSpace: OffsetSpace): void` [L523](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L523)
  - `setPlacement(id: string, fields: { offset?: Vec3; offsetSpace?: OffsetSpace; axi...): void` [L527](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L527)
  - `setTextShift(id: string, textShiftMM: number): void` [L545](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L545)
  - `setAffixes(id: string, prefix: string, suffix: string): void` [L553](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L553)
  - `formatAnnotationText(ann: PMIAnnotation): string` [L564](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L564)
  - `updateAllTexts(): void` [L569](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L569)
  - `applyMeasuredValue(ann: PMIAnnotation, distanceMM: number, resolvedAxis: string): boolean` [L580](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L580)
  - `toJSON(): PMIStoreJSON` [L596](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L596)
  - `fromJSON(data: PMIStoreJSON | null | undefined): void` [L615](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L615)

**Funkcje:**
- `export` `formatDistance(valueMM: number, unitMode: UnitMode, showUnits): string` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L36)
- `export` `formatMeasureText(p1: Vec3, p2: Vec3, unitMode: UnitMode, showUnits): string` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L51)
- `export` `computeMeasurementDerived(5 params): { distanceMM: number; text: string }` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L64)
- `serializeAnchorToNm(anchor: PMIAnchorRef): PMIAnchorRefDiskJSON` [L690](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L690)
- `serializeAnnotationToNm(a: PMIAnnotation): PMIAnnotationDiskJSON` [L706](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L706)
- `readVec(raw: any, fallback: Vec3 | null): Vec3 | null` [L732](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L732)
- `deserializeVecToMm(raw: any, fallback: Vec3 | null): Vec3 | null` [L739](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L739)
- `normalizeAnchor(raw: any): PMIAnchorRef` [L748](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L748)
- `normalizeAnnotation(raw: any): PMIAnnotation` [L764](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L764)

**Typy i Modele Danych:**
- `interface PMIAnnotation` { id, smartIdPath, anchor1, anchor2, offset, offsetSpace, edgeDir1Local, edgeDir2Local, +13 more } [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L86)
- `interface PMIMeasurement` { id, anchor1, anchor2, viaAnchor, distanceMM, text, visible, selected } [L138](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L138)
- `interface PMIAnchorRefDiskJSON` { nodeId, smartIdPath, kind, subKey, subIndex, pointLocal, pointWorldFallback } [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L157)
- `interface PMIAnnotationDiskJSON` { id, smartIdPath, anchor1, anchor2, offset, offsetSpace, edgeDir1Local, edgeDir2Local, +13 more } [L174](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L174)
- `interface PMISettingsDiskJSON` { unitMode, showUnits, textSizeMM, lineWidthMM, alignTextToLine, dimColor, selectedColor, edgeSnapPx, +1 more } [L201](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L201)
- `interface PMIStoreJSON` { version, unit, settings, annotations } [L215](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L215)
- `type UnitMode` = `'AUTO' | 'METRIC_MM' | 'METRIC_M' | 'IMPERIAL'` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L30)
- `type AxisSpace` = `'GLOBAL' | 'LOCAL' | 'ALIGNED'` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L82)
- `type MeasureAxisKey` = `'AUTO' | 'X' | 'Y' | 'Z'` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L83)
- `type OffsetSpace` = `'LOCAL' | 'WORLD'` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L84)
- `type PMIAnnotationInit` = `Pick<PMIAnnotation, 'anchor1' | 'anchor2' | 'offset' | 'o...` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L133)
- `type PMIMeasurementInit` = `Pick<PMIMeasurement, 'anchor1' | 'anchor2'> & Partial<PMI...` [L150](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L150)
- `type PMIToolPhase` = `'idle' | 'PICK_P1' | 'PICK_P2' | 'DRAG_OFFSET'` [L223](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L223)
- `type PMIChangeListener` = `() => void` [L231](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-data.ts#L231)

### [A8_pmi/pmi-drag.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts)

**Funkcje:**
- `export` `measureMidpoint(anchor1World: Vec3, anchor2World: Vec3): Vec3` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L33)
- `export` `perpendicularToDimension(vector: Vec3, anchor1World: Vec3, anchor2World: Vec3): Vec3` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L38)
- `export` `computeFreeDragBias(4 params): Vec3` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L53)
- `dragPlaneNormal(scene: any): Vec3 | null` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L65)
- `export` `projectRayOntoAxis(scene: any, startPos: Vec3, axisDir: Vec3): number | null` [L95](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L95)
- `export` `pointerOnDragPlane(scene: any, planePoint: Vec3): Vec3 | null` [L126](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L126)
- `export` `computeOffsetFromPointer(input: OffsetDragInput): Vec3 | null` [L160](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L160)
- `export` `beginOffsetDragState(4 params): { dragStartHitWorld: Vec3; dragStartOffsetWorld...` [L205](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L205)
- `export` `axisVectorWorld(axisKey: string, axisSpace: string, matrixWorld: number[] | null): Vec3 | null` [L231](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L231)

**Typy i Modele Danych:**
- `interface OffsetDragInput` { scene, anchor1World, anchor2World, axisConstraintWorld, dragStartHitWorld, dragStartOffsetWorld, freeDragBiasWorld } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L18)

**Stałe i Słowniki:**
- `const MAX_OFFSET_DRAG_DISTANCE` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L88)
- `const PMI_OFFSET_DRAG_MULTIPLIER` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-drag.ts#L89)

### [A8_pmi/pmi-edge-pick.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts)

**Funkcje:**
- `isSelectableEdgeMesh(mesh: any): boolean` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L57)
- `isSelectableVertexMesh(mesh: any): boolean` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L70)
- `closestParam2D(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L83)
- `coincidenceKey(a: Vec3, b: Vec3): string` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L93)
- `createProjector(scene: any): ((point: any) => any) | null` [L101](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L101)
- `isOccluderMesh(mesh: any, exclude: any): boolean` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L118)
- `publishOcclusionStats(): void` [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L139)
- `export` `isPointOccluded(5 params): boolean` [L153](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L153)
- `export` `findEdgeSegmentsNearPointer(scene: any, pointerX: number, pointerY: number, maxPx: number): EdgeSegmentCandidate[]` [L198](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L198)
- `export` `findVerticesNearPointer(scene: any, pointerX: number, pointerY: number, maxPx: number): VertexCandidate[]` [L287](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L287)

**Typy i Modele Danych:**
- `interface VertexCandidate` { mesh, world, distPx, depth } [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L35)
- `interface EdgeSegmentCandidate` { mesh, p1World, p2World, p1Local, p2Local, index1, index2, closestWorld, +2 more } [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L42)

**Stałe i Słowniki:**
- `const EDGE_SNAP_PX` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L17)
- `const VERTEX_SNAP_PX` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L20)
- `const OCCLUSION_EPS_MM` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L27)
- `const SELF_PANEL_OCCLUSION_EPS_MM` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edge-pick.ts#L33)

### [A8_pmi/pmi-edit-tool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts)

**Klasy:**
- `class PMIEditOffsetTool` *extends BaseState* [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts#L32)
  - `constructor(4 params): void` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts#L59)
  - `beginEdit(annotationId: string): void` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts#L73)
  - `onEnter(): void` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts#L81)
  - `onExit(): void` [L123](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts#L123)
  - `onSelect(_intent: Intent): void` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts#L157)
  - `onConfirm(_intent: Intent): void` [L161](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts#L161)
  - `onContextMenu(intent: Intent): void` [L165](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts#L165)
  - `onCancel(_intent: Intent): void` [L169](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts#L169)
  - `onDelete(_intent: Intent): void` [L174](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-edit-tool.ts#L174)

### [A8_pmi/pmi-geometry-highlight.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts)

**Klasy:**
- `class PMIGeometryHighlighter` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L118)
  - `constructor(scene: any): void` [L135](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L135)
  - `labelOf(type: GeometryType): string` [L141](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L141)
  - `update(pointerX: number, pointerY: number): DetectionResult` [L190](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L190)
  - `showEdgeOverlays(segments: EdgeSegmentCandidate[]): void` [L333](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L333)
  - `clearHighlight(): void` [L419](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L419)
  - `dispose(): void` [L465](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L465)

**Funkcje:**
- `getPanelViewFromMesh(mesh: any): any` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L37)
- `isPmiSelectableMesh(mesh: any): boolean` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L52)
- `createDetectionFromBrepPick(brepPick: ResolvedBrepPick, hit: any): DetectionResult` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L64)
- `geometryTypeFromBrepKind(kind: string): GeometryType` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L82)
- `segmentKeyOf(segment: EdgeSegmentCandidate): string` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L92)

**Typy i Modele Danych:**
- `interface SavedMeshState` { kind, visibility, alpha, originalMaterial, diffuse, emissive, lineColor, edgesWidth, +1 more } [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-geometry-highlight.ts#L106)

### [A8_pmi/pmi-id-bridge.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts)

**Funkcje:**
- `export` `isPmiOverlayMesh(mesh: any): boolean` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L33)
- `transformNormalByMat4Data(d: ArrayLike<number>, nx: number, ny: number, nz: number): Vec3 | null` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L46)
- `export` `planeNormalWorldFromMesh(mesh: any): Vec3 | null` [L85](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L85)
- `export` `beginResolveBatch(): void` [L150](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L150)
- `export` `endResolveBatch(): void` [L154](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L154)
- `lookupNodeEntry(scene: any, nodeId: string): NodeEntry | null` [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L158)
- `findNodeEntry(scene: any, nodeId: string): NodeEntry | null` [L200](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L200)
- `export` `findNodeRoot(scene: any, nodeId: string): any` [L215](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L215)
- `export` `meshLocalToRootLocal(mesh: any, pointMeshLocal: Vec3): Vec3` [L232](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L232)
- `isRootLocalOverride(kind: PMIAnchorKind): boolean` [L247](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L247)
- `isInsideBBox(point: Vec3, min: Vec3, max: Vec3, margin: number): boolean` [L251](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L251)
- `resolveFaceAnchorLocal(scene: any, ref: PMIAnchorRef, entry: NodeEntry): Vec3 | null` [L262](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L262)
- `currentLocalPoint(scene: any, ref: PMIAnchorRef): Vec3 | null` [L310](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L310)
- `readNodeId(mesh: any): string` [L344](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L344)
- `readKindAndKey(mesh: any): { kind: PMIAnchorKind; subKey: string }` [L350](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L350)
- `anchorRootOf(mesh: any): any` [L367](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L367)
- `export` `buildAnchorRef(mesh: any, worldPoint: Vec3, localOverride?: Vec3 | null, subIndex): PMIAnchorRef` [L379](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L379)
- `export` `freeAnchorRef(worldPoint: Vec3): PMIAnchorRef` [L424](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L424)
- `export` `snapWorldPointToPanelGeometry(scene: any, mesh: any, worldPoint: Vec3, snapRadiusMM: number): { anchor: PMIAnchorRef; worldPos: Vec3 } | null` [L449](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L449)
- `projectPointOnPlaneWorld(point: Vec3, planeOrigin: Vec3, planeNormal: Vec3): Vec3` [L522](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L522)
- `export` `resolveFaceHelperWorld(5 params): Vec3 | null` [L533](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L533)
- `export` `resolveFaceHelperWorlds(opts: { scene: any; anchor1Ref: PMIAnchorRef | null; ...): { helper1World: Vec3; helper2World: Vec3 }` [L607](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L607)
- `helperTargetWorld(4 params): Vec3` [L639](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L639)
- `export` `snapToNearestEdgeEndpoint(edgeMesh: any, worldPoint: Vec3): { anchor: PMIAnchorRef; worldPos: Vec3; subInde...` [L655](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L655)
- `export` `tryBuildEdgeAnchorsFromRootPoints(7 params): EdgeAnchorPair | null` [L704](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L704)
- `export` `getBrepGeometryForPanel(scene: any, nodeId: string, faceName?: string): BrepGeometryData | null` [L788](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L788)
- `export` `resolveBrepGeometryPick(scene: any, hit: any, panelView: any): ResolvedBrepPick | null` [L831](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L831)
- `resolveLocalToBrepPick(6 params): ResolvedBrepPick` [L893](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L893)
- `export` `localToWorldFromBrep(nodeId: string, localPos: Vec3, panelView?: any): Vec3` [L933](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L933)
- `worldToLocalFromBrep(nodeId: string, worldRenderMm: Vec3, panelView?: any): Vec3` [L955](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L955)
- `buildAnchorRefForBrep(5 params): PMIAnchorRef` [L981](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L981)
- `snapToLocalEdge(brep: BrepGeometryData, p0: Vec3, p1: Vec3, hitPoint: Vec3 | null): Vec3 | null` [L1004](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L1004)
- `projectOnPlaneLocal(4 params): Vec3 | null` [L1029](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L1029)
- `export` `getWorldMatrixArray(node: any): number[] | null` [L1045](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L1045)
- `export` `resolveAnchorMatrix(scene: any, ref: PMIAnchorRef | null): number[] | null` [L1054](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L1054)
- `export` `resolveAnchorWorld(scene: any, ref: PMIAnchorRef | null): Vec3 | null` [L1067](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L1067)
- `export` `resolveDirectionWorld(scene: any, ref: PMIAnchorRef | null, dirLocal: Vec3 | null): Vec3 | null` [L1096](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L1096)
- `export` `directionToLocal(scene: any, ref: PMIAnchorRef | null, dirWorld: Vec3 | null): Vec3 | null` [L1115](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L1115)
- `export` `registerDimensionSmartId(dimensionId: string, ownerRef: PMIAnchorRef | null): string` [L1139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L1139)
- `export` `unregisterDimensionSmartId(smartIdPath: string): void` [L1150](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L1150)

**Typy i Modele Danych:**
- `interface PMIAnchorRef` { nodeId, smartIdPath, kind, subKey, subIndex, pointLocal, pointWorldFallback } [L119](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L119)
- `interface NodeEntry` { root, meshes } [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L139)
- `interface EdgeAnchorPair` { anchor1, anchor2, p1World, p2World, edgeMesh } [L692](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L692)
- `interface BrepGeometryData` { facePositions, faceIndices, vertexLocal, edgePoints, faceOriginLocal, faceNormalLocal } [L762](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L762)
- `interface ResolvedBrepPick` { kind, nodeId, subKey, worldPos, localPos, anchorRef } [L771](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L771)
- `type PMIAnchorKind` = `'VERTEX' | 'EDGE' | 'FACE' | 'FEATURE' | 'FREE'` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L27)

**Stałe i Słowniki:**
- `const SNAP_RADIUS_MM` [L436](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L436)
- `const FACE_HELPER_SNAP_RADIUS_MM` [L443](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-id-bridge.ts#L443)

### [A8_pmi/pmi-label-layout.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-label-layout.ts)

**Funkcje:**
- `export` `boxesOverlap(a: ScreenLabel, b: ScreenLabel, pad): boolean` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-label-layout.ts#L19)
- `overlapAmounts(a: ScreenLabel, b: ScreenLabel, pad: number): { x: number; y: number }` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-label-layout.ts#L24)
- `export` `resolveLabelOverlaps(labels: ScreenLabel[], pad): ScreenLabel[]` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-label-layout.ts#L36)

**Typy i Modele Danych:**
- `interface ScreenLabel` { id, x, y, w, h } [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-label-layout.ts#L8)

**Stałe i Słowniki:**
- `const LABEL_OVERLAP_PAD_PX` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-label-layout.ts#L17)

### [A8_pmi/pmi-measure-pick.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts)

**Funkcje:**
- `getPanelViewFromMesh(mesh: any): any` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts#L30)
- `export` `findMeasureElementPick(ctx: MeasurePickContext): MeasureElementPick | null` [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts#L79)
- `mapBrepKindToMeasureKind(kind: string): MeasureElementKind` [L154](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts#L154)
- `brepEdgeSegment(mesh: any, brepPick: { worldPos: Vec3 }, panelView: any): EdgeSegmentCandidate | null` [L166](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts#L166)
- `export` `findPlaneHit(lastDetection: GeometryDetectionSnapshot | null): MeasureElementPick | null` [L188](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts#L188)
- `edgePickToMeasure(edge: EdgeSegmentCandidate): MeasureElementPick` [L213](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts#L213)

**Typy i Modele Danych:**
- `interface MeasureElementPick` { worldPos, anchor, mesh, kind, edge, planeNormal } [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts#L46)
- `interface GeometryDetectionSnapshot` { hit, geometryType, pickedPoint, mesh, normal } [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts#L55)
- `interface MeasurePickContext` { scene, pointerX, pointerY, ctrl, vertexSnapPx, edgeSnapPx, lastDetection, hoveredSegment } [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-pick.ts#L63)

### [A8_pmi/pmi-measure-tool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts)

**Klasy:**
- `class MeasureTool` *extends BaseState* [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L42)
  - `constructor(3 params): void` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L54)
  - `onEnter(): void` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L81)
  - `onExit(): void` [L120](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L120)
  - `onSelect(intent: Intent): void` [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L146)
  - `onContextMenu(intent: Intent): void` [L154](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L154)
  - `onCancel(_intent: Intent): void` [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L158)
  - `onDelete(_intent: Intent): void` [L174](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L174)

**Funkcje:**
- `toElement(pick: MeasureElementPick): MeasureElement` [L424](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L424)
- `reanchorPick(pick: MeasureElementPick, worldPos: Vec3): MeasureElementPick` [L435](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L435)
- `reanchorAt(mesh: any, worldPos: Vec3): PMIAnchorRef` [L443](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure-tool.ts#L443)

### [A8_pmi/pmi-measure.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts)

**Funkcje:**
- `export` `planesAreParallel(normal1: Vec3, normal2: Vec3, angleTolRad): boolean` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L25)
- `export` `cadDeltasFromRender(p1: Vec3, p2: Vec3): MeasureDeltas` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L65)
- `export` `significantDeltaAxes(deltas: MeasureDeltas, eps): Array<'X' | 'Y' | 'Z'>` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L72)
- `export` `shouldShowDeltas(deltas: MeasureDeltas, eps): boolean` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L84)
- `export` `measureDeltaSegments(p1: Vec3, p2: Vec3, eps): MeasureDeltaSegment[]` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L92)
- `export` `closestPointOnSegment(p: Vec3, a: Vec3, b: Vec3): Vec3` [L103](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L103)
- `export` `projectPointOnPlane(p: Vec3, origin: Vec3, normal: Vec3): Vec3` [L111](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L111)
- `export` `closestPointsOnSegments(a1: Vec3, a2: Vec3, b1: Vec3, b2: Vec3): { pa: Vec3; pb: Vec3 }` [L119](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L119)
- `isVertexLike(kind: MeasureElementKind): boolean` [L167](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L167)
- `export` `verticesCoincide(a: Vec3, b: Vec3, eps): boolean` [L181](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L181)
- `export` `connectedEdgeChain(e1a: Vec3, e1b: Vec3, e2a: Vec3, e2b: Vec3, eps): { path: Vec3[]; length: number; junction: Vec3 ...` [L188](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L188)
- `export` `measureTwoEdges(e1a: Vec3, e1b: Vec3, e2a: Vec3, e2b: Vec3): TwoEdgeMeasureResult` [L212](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L212)
- `export` `pathLength(path: Vec3[]): number` [L231](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L231)
- `export` `measurementPathLength(p1: Vec3, p2: Vec3, via: Vec3 | null): number` [L240](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L240)
- `export` `projectMeasureElements(first: MeasureElement, second: MeasureElement): { p1: Vec3; p2: Vec3 }` [L249](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L249)
- `export` `closestPointsOnPlanes(6 params): { p1: Vec3; p2: Vec3 }` [L301](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L301)
- `export` `closestPointsOnSegmentAndPlane(a: Vec3, b: Vec3, origin: Vec3, normal: Vec3): { onSegment: Vec3; onPlane: Vec3 }` [L326](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L326)

**Typy i Modele Danych:**
- `interface MeasureDeltas` { length, dX, dY, dZ } [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L39)
- `interface MeasureDeltaSegment` { axis, a, b } [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L46)
- `interface MeasureElement` { kind, worldPos, edgeA, edgeB, planeOrigin, planeNormal } [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L52)
- `interface TwoEdgeMeasureResult` { mode, path, length, junction } [L174](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L174)
- `type MeasureElementKind` = `'point' | 'vertex' | 'edge' | 'plane'` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L37)

**Stałe i Słowniki:**
- `const MEASURE_DELTA_EPS` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L12)
- `const PLANE_PARALLEL_ANGLE_RAD` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L15)
- `const PLANE_PARALLEL_ANGLE_DEG` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L18)
- `const EDGE_VERTEX_EPS` [L172](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-measure.ts#L172)

### [A8_pmi/pmi-renderer.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts)

**Klasy:**
- `class PMIRenderer` [L227](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L227)
  - `constructor(scene: any): void` [L235](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L235)
  - `setVisible(v: boolean): void` [L250](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L250)
  - `renderAll(store: PMIStore): void` [L269](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L269)
  - `renderPreview(renderData: BridgeRenderData | null): void` [L336](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L336)
  - `clearPreview(): void` [L358](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L358)
  - `renderMeasurePreview(path: Vec3[] | null, store: PMIStore): void` [L366](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L366)
  - `clearMeasurePreview(): void` [L386](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L386)
  - `dispose(): void` [L398](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L398)

**Funkcje:**
- `export` `computeMeasureLabelDimensions(lines: string[]): { textHWorld: number; planeW: number; planeH: n...` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L49)
- `export` `computeMeasureScreenScale(7 params): number` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L68)
- `measureLabelLineColor(line: string, selected: boolean): string` [L115](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L115)
- `paintLabelBackground(ctx: CanvasRenderingContext2D, w: number, h: number, radius): void` [L123](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L123)
- `sharpenLabelTexture(dt: any): void` [L145](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L145)
- `makeLabelMaterial(visId: string, dt: any, tag: 'pmi' | 'msr', scene: any): any` [L160](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L160)
- `toHexColor(rgba: Rgba): string` [L179](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L179)
- `drawRoundedRect(6 params): void` [L1419](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L1419)
- `export` `measureLineWidth(): number` [L1441](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L1441)
- `export` `measurePointDiameter(minDist?: number): number` [L1445](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L1445)
- `export` `measurePointDiameterAt(scene: any, worldPos: Vec3, userMM: number, minDist?: number): number` [L1460](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L1460)

**Typy i Modele Danych:**
- `interface DimVisual` { id, dimLineParts, helperLineParts, arrowMesh1, arrowMesh2, textPlane, textTexture, textCacheKey, +3 more } [L190](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L190)
- `interface MeasureVisual` { id, mainLineParts, deltaLines, points, textPlane, textTexture, textCacheKey, labelPreferredWorld, +6 more } [L205](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L205)
- `type Rgba` = `[number, number, number, number]` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L33)

**Stałe i Słowniki:**
- `const MEASURE_BASE_TEXT_H` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-renderer.ts#L44)

### [A8_pmi/pmi-resolve.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts)

**Funkcje:**
- `export` `resolveOffsetWorld(scene: any, ann: PMIAnnotation): Vec3` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts#L40)
- `export` `storeOffsetFromWorld(scene: any, anchor: PMIAnchorRef, offsetWorld: Vec3): { offset: Vec3; offsetSpace: 'LOCAL' | 'WORLD' }` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts#L49)
- `export` `resolveAnnotation(scene: any, ann: PMIAnnotation, offsetWorldOverride?: Vec3 | null): ResolvedAnnotation | null` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts#L67)
- `export` `buildAnnotationRenderData(4 params): BridgeRenderData | null` [L117](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts#L117)
- `export` `buildMeasureRenderData(scene: any, item: PMIMeasurement, store: PMIStore): MeasureRenderData | null` [L193](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts#L193)
- `export` `resolvePMIForRender(scene: any, store: PMIStore): PMIResolvedFrame` [L217](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts#L217)

**Typy i Modele Danych:**
- `interface ResolvedAnnotation` { anchor1World, anchor2World, helperAnchor1World, helperAnchor2World, offsetWorld, matrixWorld, edgeDir1World, edgeDir2World, +2 more } [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts#L24)
- `interface MeasureRenderData` { path, labelText, distanceMM } [L170](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts#L170)
- `interface ResolvedPMIEntry` { id, visible, selected, renderData } [L176](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts#L176)
- `interface PMIResolvedFrame` { annotations, measurements, derivedChanged } [L183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-resolve.ts#L183)

### [A8_pmi/pmi-screen-scale.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts)

**Funkcje:**
- `export` `pixelsPerMM(params: PixelsPerMMParams): number` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L27)
- `export` `worldSizeForPx(desiredPx: number, pxPerMM: number, fallbackMM: number): number` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L42)
- `export` `clampWorldDiameter(desiredMM: number, pxPerMM: number, minPx: number, maxPx: number): number` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L54)
- `cameraParamsAt(scene: any, worldPos: { x: number; y: number; z: number }): PixelsPerMMParams | null` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L72)
- `export` `pixelsPerMMAtScene(scene: any, worldPos: { x: number; y: number; z: number }): number` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L96)
- `export` `worldDiameterForPxAt(4 params): number` [L103](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L103)
- `export` `measureDiameterAt(5 params): number` [L113](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L113)
- `export` `attachScreenConstantScale(4 params): void` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L132)

**Typy i Modele Danych:**
- `interface PixelsPerMMParams` { renderH, cameraMode, orthoH, distanceToCamera, cameraFov } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L14)

**Stałe i Słowniki:**
- `const HIGHLIGHT_DIAMETER_PX` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L67)
- `const VERTEX_DIAMETER_PX` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L68)
- `const MEASURE_MIN_PX` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L69)
- `const MEASURE_MAX_PX` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-screen-scale.ts#L70)

### [A8_pmi/pmi-settings-modal.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-settings-modal.tsx)

**Funkcje:**
- `rgbaToHex(rgba: [number, number, number, number]): string` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-settings-modal.tsx#L17)
- `hexToRgba(hex: string, alpha): [number, number, number, number]` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-settings-modal.tsx#L22)
- `export` `PmiSettingsModal({ isOpen, onClose }: PmiSettingsModalProps): any` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-settings-modal.tsx#L33)

**Typy i Modele Danych:**
- `interface PmiSettingsModalProps` { isOpen, onClose } [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-settings-modal.tsx#L28)

### [A8_pmi/pmi-sync.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-sync.ts)

**Klasy:**
- `class PMISyncController` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-sync.ts#L44)
  - `constructor(scene: any, renderer: PMIRenderer, store: PMIStore): void` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-sync.ts#L55)
  - `attach(document: ProjectDocument | null): void` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-sync.ts#L65)
  - `dispose(): void` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-sync.ts#L84)
  - `requestRefresh(): void` [L102](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-sync.ts#L102)
  - `refreshNow(): void` [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-sync.ts#L106)

**Funkcje:**
- `nodeTransformSignature(scene: any, nodeId: string): string` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-sync.ts#L32)

**Stałe i Słowniki:**
- `const PMI_DOCUMENT_SECTION` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-sync.ts#L22)

### [A8_pmi/pmi-text-shift-tool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts)

**Klasy:**
- `class PMITextShiftTool` *extends BaseState* [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts#L25)
  - `constructor(4 params): void` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts#L40)
  - `beginEdit(annotationId: string): void` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts#L51)
  - `onEnter(): void` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts#L55)
  - `onExit(): void` [L97](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts#L97)
  - `onPointerMove(): void` [L124](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts#L124)
  - `onPointerUp(): void` [L183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts#L183)
  - `onSelect(_intent: any): void` [L192](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts#L192)
  - `onCancel(_intent: any): void` [L200](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts#L200)

**Stałe i Słowniki:**
- `const PMI_TEXT_SHIFT_STATE` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-text-shift-tool.ts#L23)

### [A8_pmi/pmi-tool-activate.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts)

**Funkcje:**
- `export` `getDimensionTool(sm: StateMachine): DimensionTool | null` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L24)
- `export` `isDimensionToolActive(sm: StateMachine): boolean` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L28)
- `export` `isMeasureToolActive(sm: StateMachine): boolean` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L32)
- `export` `activateDimensionTool(sm: StateMachine): void` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L37)
- `export` `activateMeasureTool(sm: StateMachine): void` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L45)
- `export` `isPmiToolActive(sm?: StateMachine | null): boolean` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L49)
- `export` `deactivateDimensionTool(sm: StateMachine): void` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L56)
- `export` `deactivateAllPmiTools(sm?: StateMachine | null): void` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L62)
- `export` `toggleDimensionTool(sm: StateMachine): void` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L71)

**Stałe i Słowniki:**
- `const DIMENSION_TOOL_STATE` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L10)
- `const MEASURE_TOOL_STATE` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L11)
- `const DIMENSION_EDIT_TOOL_STATE` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L12)
- `const DIMENSION_TEXT_SHIFT_TOOL_STATE` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool-activate.ts#L13)

### [A8_pmi/pmi-tool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts)

**Klasy:**
- `class DimensionTool` *extends BaseState* [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L94)
  - `constructor(3 params): void` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L132)
  - `onEnter(): void` [L166](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L166)
  - `onExit(): void` [L223](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L223)
  - `onSelect(intent: Intent): void` [L293](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L293)
  - `onContextMenu(intent: Intent): void` [L300](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L300)
  - `openContextMenu(screenX: number, screenY: number): void` [L308](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L308)
  - `setMeasureAxisExplicit(key: 'X' | 'Y' | 'Z'): void` [L390](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L390)
  - `onCancel(_intent: Intent): void` [L410](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L410)
  - `onConfirm(_intent: Intent): void` [L424](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L424)
  - `onDelete(_intent: Intent): void` [L430](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L430)
  - `setAxisSpace(space: AxisSpace): void` [L1437](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L1437)
  - `getAxisSpace(): AxisSpace` [L1447](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L1447)
  - `setMeasureAxis(axis: MeasureAxisKey): void` [L1451](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L1451)
  - `getMeasureAxis(): MeasureAxisKey` [L1458](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L1458)
  - `getPhase(): ToolPhase` [L1462](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L1462)
  - `getOffsetAxisKey(): string` [L1466](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L1466)

**Funkcje:**
- `localMatrixFromPicks(p1: PickPoint, p2: PickPoint): number[] | null` [L1471](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L1471)

**Typy i Modele Danych:**
- `interface PickPoint` { worldPos, anchor, edgeDirWorld, faceNormalWorld, meshMatrix } [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L75)
- `interface DetectedEdge` { p1, p2 } [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L83)
- `type ToolPhase` = `'PICK_P1' | 'PICK_P2' | 'DRAG_OFFSET'` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-tool.ts#L73)

### [A8_pmi/pmi-topbar-dropdown.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-topbar-dropdown.tsx)

**Funkcje:**
- `export` `PmiTopbarDropdown({ activeTab, onTabChange }: PmiTopbarDropdownProps): any` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-topbar-dropdown.tsx#L26)

**Typy i Modele Danych:**
- `interface PmiTopbarDropdownProps` { activeTab, onTabChange } [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-topbar-dropdown.tsx#L21)

### [A8_pmi/pmi-viewport-listener.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-viewport-listener.ts)

**Klasy:**
- `class PMIViewportListener` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-viewport-listener.ts#L35)
  - `constructor(scene: any, stateMachine: StateMachine, store: PMIStore): void` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-viewport-listener.ts#L56)
  - `attach(initialStateName): void` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-viewport-listener.ts#L67)
  - `dispose(): void` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-viewport-listener.ts#L92)

**Stałe i Słowniki:**
- `const PMI_EDIT_STATE` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/A8_pmi/pmi-viewport-listener.ts#L27)

## <a id="b1_biblioteka"></a>B1 Biblioteka (Katalogi Okuć mm, Uchwyty, Zawiasy, Prowadnice)

### [B1_biblioteka/hardware-loader.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts)

**Klasy:**
- `class HardwareLoader` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L31)
  - `loadTemplate(id: string, scene: any): Promise<any>` [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L98)
  - `hasTemplate(id: string): boolean` [L238](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L238)
  - `createHingeInstance(id: string, scene: any): any` [L245](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L245)
  - `createHandleInstance(id: string, _scene?: any): any` [L252](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L252)
  - `createShelfPinInstance(id: string, _scene?: any, side: 'left' | 'right'): any` [L269](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L269)
  - `createTubeRodMesh(lengthMm: number, diameterMm: number, scene: any): any` [L296](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L296)
  - `createTubeSocketMesh(4 params): any` [L320](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L320)
  - `createDrawerSideInstance(id: string, scene: any, side: 'left' | 'right', lengthMm?: number): any` [L402](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L402)
  - `setHardwareFrozen(instance: any, frozen: boolean): void` [L453](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L453)
  - `setHardwareVisible(instance: any, visible: boolean): void` [L457](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L457)
  - `alignHinge(3 params): void` [L465](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L465)
  - `setHingeFrozen(instance: any, frozen: boolean): void` [L493](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L493)
  - `setHingeVisible(instance: any, visible: boolean): void` [L538](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hardware-loader.ts#L538)

### [B1_biblioteka/hinge-align.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hinge-align.ts)

**Funkcje:**
- `neg(v: [number, number, number]): [number, number, number]` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hinge-align.ts#L14)
- `cross(a: [number, number, number], b: [number, number, number]): [number, number, number]` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hinge-align.ts#L18)
- `dot(a: [number, number, number], b: [number, number, number]): number` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hinge-align.ts#L26)
- `export` `hingeArmDir(axes: HingeAlignAxes): [number, number, number]` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hinge-align.ts#L31)
- `export` `resolveHingeAlignAxes(4 params): HingeAlignAxes` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hinge-align.ts#L35)
- `export` `hingeAlignHandedness(axes: HingeAlignAxes): number` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hinge-align.ts#L63)

**Typy i Modele Danych:**
- `interface HingeAlignAxes` { xDir, yDir, zDir } [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hinge-align.ts#L8)
- `type HingeAlignOrientation` = `'left' | 'right' | 'top' | 'bottom'` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/hinge-align.ts#L6)

### [B1_biblioteka/index.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts)

**Funkcje:**
- `export` `getHardware(id: string | undefined | null): HardwareItem | undefined` [L324](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L324)
- `export` `listByType(type: HardwareType): HardwareItem[]` [L329](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L329)
- `export` `listHingesByBrand(brand: string, scope?: HingeCatalogScope): HardwareItem[]` [L347](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L347)
- `export` `hingeListLabel(hw: HardwareItem): string` [L358](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L358)
- `export` `resolveHingeBrand(raw?: string | null): string` [L362](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L362)
- `export` `listHandles(): HardwareItem[]` [L369](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L369)
- `export` `getHandleOrUndefined(id?: string | null): HardwareItem | undefined` [L373](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L373)
- `export` `listHangers(): HardwareItem[]` [L379](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L379)
- `export` `getHangerOrUndefined(id?: string | null): HardwareItem | undefined` [L383](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L383)
- `export` `listShelfPins(): HardwareItem[]` [L391](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L391)
- `export` `getShelfPinOrDefault(id?: string | null): HardwareItem` [L395](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L395)
- `export` `listTubeSockets(): HardwareItem[]` [L412](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L412)
- `export` `getTubeSocketOrDefault(id?: string | null): HardwareItem` [L416](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L416)
- `export` `getDrawerDrill(id?: string | null): DrawerDrill` [L433](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L433)
- `export` `getHingeOrDefault(id?: string | null): HardwareItem` [L450](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L450)
- `export` `hingeTemplateId(id?: string | null): string` [L454](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L454)
- `export` `isParallelHinge(id?: string | null): boolean` [L458](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L458)
- `export` `hingeFrontHolesNm(id?: string | null): HingeFrontHoleNm[]` [L487](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L487)
- `export` `hingeCorpusHolesNm(id?: string | null): HingeCorpusHoleNm[]` [L517](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L517)
- `export` `hingeFrontHolesMm(id?: string | null): HingeFrontHoleMm[]` [L544](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L544)
- `export` `hingeCorpusHolesMm(id?: string | null): HingeCorpusHoleMm[]` [L554](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L554)

**Typy i Modele Danych:**
- `interface MachiningHole` { name, dia, depth, edge_dist, y_offset, front_dist, z_offset, z_from_bottom, +1 more } [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L25)
- `interface HardwareVisual` { glb, origin, units, png } [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L37)
- `interface HardwareItem` { id, type, definition, name, brand, series, seriesId, handleType, +13 more } [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L44)
- `interface DrawerDrill` { id, corpus_hole, front_hole } [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L81)
- `interface HingeFrontHoleNm` { name, dia, depth, edgeDist, yOffset, isCup } [L465](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L465)
- `interface HingeCorpusHoleNm` { name, dia, depth, frontDist, zOffset } [L476](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L476)
- `type HardwareType` = `'HINGE' | 'RAIL' | 'HANDLE' | 'HANGER' | 'SHELF_PIN' | 'T...` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L21)
- `type HingeCatalogScope` = `'DOORS' | 'FLAPS'` [L344](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L344)
- `type HingeFrontHoleMm` = `HingeFrontHoleNm` [L474](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L474)
- `type HingeCorpusHoleMm` = `HingeCorpusHoleNm` [L484](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L484)

**Stałe i Słowniki:**
- `const DEFAULT_HINGE_ID` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L87)
- `const DEFAULT_HINGE_CUP_EDGE_DIST_MM` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L89)
- `const HINGE_BRAND_OPTIONS: ReadonlyArray<{ id: string; enabled: boolean }>` [L334](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L334)
- `const DEFAULT_HINGE_BRAND` [L342](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L342)
- `const DEFAULT_SHELF_PIN_ID` [L388](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L388)
- `const DEFAULT_TUBE_SOCKET_ID` [L409](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/index.ts#L409)

### [B1_biblioteka/korpusy/cabinet-instantiator.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-instantiator.ts)

**Funkcje:**
- `export` `instantiateCabinetTemplate(options: InstantiateCabinetOptions, docTarget?: ProjectDocument): CADNode | null` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-instantiator.ts#L29)
- `instantiateSubmodule(4 params): any` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-instantiator.ts#L122)

**Typy i Modele Danych:**
- `interface InstantiateCabinetOptions` { template, position, overrideDims } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-instantiator.ts#L20)

### [B1_biblioteka/korpusy/cabinet-library-store.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts)

**Klasy:**
- `class CabinetLibraryStore` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L14)
  - `subscribe(cb: () => void): () => void` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L18)
  - `getAll(): CabinetTemplate[]` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L32)
  - `getById(id: string): CabinetTemplate | undefined` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L60)
  - `save(template: CabinetTemplate): void` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L67)
  - `remove(id: string): boolean` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L83)
  - `resetToDefaults(): void` [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L98)
  - `exportToJsonFile(template: CabinetTemplate): void` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L107)
  - `exportAllToJsonFile(): void` [L125](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L125)
  - `importFromJson(jsonStr: string): { success: boolean; count: number; error?: stri...` [L143](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L143)

**Stałe i Słowniki:**
- `const DEFAULT_TEMPLATES: CabinetTemplate[]` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-library-store.ts#L12)

### [B1_biblioteka/korpusy/cabinet-serializer.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-serializer.ts)

**Funkcje:**
- `export` `sanitizeBlokiParams(rawParams: any): Record<string, any>` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-serializer.ts#L14)
- `export` `serializeActiveCabinet(2 params): CabinetTemplate | null` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/cabinet-serializer.ts#L44)

### [B1_biblioteka/korpusy/types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/types.ts)

**Typy i Modele Danych:**
- `interface CabinetDimensionsMm` { szerokosc_mm, wysokosc_mm, glebokosc_mm, cokolHeight } [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/types.ts#L11)
- `interface CabinetFrameParamsMm` { liczba_stref, wysokosc_strefy_dolnej_mm, wysokosc_strefy_srodkowej_mm, cofniecie_plecow_mm, offsets } [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/types.ts#L19)
- `interface CabinetSubmoduleRecipe` { id, type, boxType, label, zoneIndex, params } [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/types.ts#L27)
- `interface CabinetTemplate` { id, name, category, units, description, thumbnail, createdAt, dimensions, +2 more } [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/types.ts#L36)
- `type CabinetCategory` = `'dolne' | 'gorne' | 'slupki' | 'inne'` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/korpusy/types.ts#L8)

### [B1_biblioteka/szuflady/szuflady-from-konfig.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/szuflady/szuflady-from-konfig.ts)

**Funkcje:**
- `export` `railsFromKonfig(konfig: { szuflady?: any[] }): any[]` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/szuflady/szuflady-from-konfig.ts#L15)

**Stałe i Słowniki:**
- `const DEFAULT_RAIL_ID` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/szuflady/szuflady-from-konfig.ts#L13)

### [B1_biblioteka/uchwyty/handles-from-catalog.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/uchwyty/handles-from-catalog.ts)

**Funkcje:**
- `export` `handlesFromCatalog(raw: HandleCatalogFile | null | undefined, brandFallback): HandleHardwareItem[]` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/uchwyty/handles-from-catalog.ts#L56)
- `variantToItem(2 params): HandleHardwareItem | null` [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/uchwyty/handles-from-catalog.ts#L94)
- `export` `handleGlbTemplateId(glbOrPath: string | undefined | null): string | null` [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/uchwyty/handles-from-catalog.ts#L129)

**Typy i Modele Danych:**
- `interface HandleVariantJson` { id, name, holeDistanceMm, totalLengthMm, depthMm, thicknessMm, footDiameterMm, drillDiameterMm, +1 more } [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/uchwyty/handles-from-catalog.ts#L6)
- `interface HandleSeriesJson` { id, name, handleType, variants } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/uchwyty/handles-from-catalog.ts#L18)
- `interface HandleCatalogFile` { id, brand, units, type, series, items } [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/uchwyty/handles-from-catalog.ts#L25)
- `interface HandleHardwareItem` { id, type, name, brand, series, seriesId, handleType, art_no, +3 more } [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/uchwyty/handles-from-catalog.ts#L34)

### [B1_biblioteka/zawieszki/hangers-from-catalog.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawieszki/hangers-from-catalog.ts)

**Funkcje:**
- `export` `isSmartPartDefinition(raw: any): boolean` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawieszki/hangers-from-catalog.ts#L68)
- `export` `smartPartToHangerItem(raw: any, fileBaseId?: string): HangerHardwareItem | null` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawieszki/hangers-from-catalog.ts#L78)
- `export` `hangersFromCatalog(raw: HangerCatalogFile | any, brandFallback, fileBaseId?: string): HangerHardwareItem[]` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawieszki/hangers-from-catalog.ts#L122)
- `variantToItem(2 params): HangerHardwareItem | null` [L165](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawieszki/hangers-from-catalog.ts#L165)
- `export` `hangerGlbTemplateId(glbOrPath: string | undefined | null): string | null` [L200](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawieszki/hangers-from-catalog.ts#L200)

**Typy i Modele Danych:**
- `interface HangerMountJson` { from_top_mm, from_back_mm, from_side_mm, pair, sides } [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawieszki/hangers-from-catalog.ts#L6)
- `interface HangerVariantJson` { id, name, art_no, widthMm, heightMm, depthMm, mount, machining, +2 more } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawieszki/hangers-from-catalog.ts#L14)
- `interface HangerCatalogFile` { id, brand, units, type, name, series, items, mainContainer, +5 more } [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawieszki/hangers-from-catalog.ts#L29)
- `interface HangerHardwareItem` { id, type, name, brand, series, seriesId, art_no, price_id, +4 more } [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawieszki/hangers-from-catalog.ts#L45)

## <a id="c1_cnc"></a>C1 CNC / CAM (CLData, Postprocesory, WCS, Strategie Frezowania)

### [C1_cnc/core/cam-auto-program.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-auto-program.ts)

**Funkcje:**
- `export` `buildDefaultCncProgramForPanel(panel: any, toolLib?: ToolLibrary): CNCProgramState | null` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-auto-program.ts#L21)
- `export` `ensurePanelHasCncProgram(panel: any, toolLib?: ToolLibrary): CNCProgramState | null` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-auto-program.ts#L82)

### [C1_cnc/core/cam-state-store.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts)

**Klasy:**
- `class CAMStateStore` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L54)
  - `getInstance(): CAMStateStore` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L73)
  - `getState(): CAMStoreState` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L80)
  - `subscribe(listener: Listener): () => void` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L84)
  - `setPrograms(programs: CNCProgramState[]): void` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L96)
  - `setActiveProgramId(id: string | null): void` [L101](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L101)
  - `getActiveProgram(): CNCProgramState | null` [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L106)
  - `updateActiveProgram(updater: (program: CNCProgramState) => CNCProgramState): void` [L111](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L111)
  - `setActiveSubTab(subTab: SubTabType): void` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L122)
  - `setSelectedFeatureIds(ids: string[]): void` [L127](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L127)
  - `setSimulationState(4 params): void` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L132)
  - `setWarningMessage(msg: string | null): void` [L140](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L140)
  - `setShowToolpaths(show: boolean): void` [L145](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L145)

**Typy i Modele Danych:**
- `interface CNCProgramState` { id, name, targetPanel, targetPanelId, targetPanelLabel, wcsName, cornerIndex, postprocessor, +14 more } [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L11)
- `interface CAMStoreState` { programs, activeProgramId, activeSubTab, selectedFeatureIds, isSimulating, simulationSpeed, simStatusText, simProgressPercent, +2 more } [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L39)
- `type SubTabType` = `'wcs' | 'tool' | 'operation' | 'simulate' | 'generate'` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L37)
- `type Listener` = `(state: CAMStoreState) => void` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-state-store.ts#L52)

### [C1_cnc/core/cam-sync-service.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts)

**Klasy:**
- `class CAMSyncService` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts#L55)
  - `getInstance(): CAMSyncService` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts#L59)
  - `comparePanelWithProgram(3 params): PanelSyncReport` [L130](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts#L130)
  - `validateScope(3 params): ScopeValidationReport` [L233](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts#L233)
  - `autoSynchronizeProgram(3 params): CNCProgramState` [L273](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts#L273)
  - `autoSynchronizeScope(3 params): { updatedCount: number; createdCount: number }` [L348](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts#L348)
  - `resolvePanelsForScope(scope: { type: string; id: string; name: string }, doc: any): any[]` [L374](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts#L374)

**Typy i Modele Danych:**
- `interface DiscrepancyItem` { type, feature, description, suggestedToolName } [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts#L24)
- `interface PanelSyncReport` { panelId, panelName, containerName, hasProgram, activeProgramId, isSynced, missingInCam, orphanedInCam, +2 more } [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts#L31)
- `interface ScopeValidationReport` { scopeName, scopeType, totalPanels, panelsWithFeatures, panelsWithPrograms, hasDiscrepancies, totalDiscrepancyCount, panelReports } [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-sync-service.ts#L44)

### [C1_cnc/core/cl-data.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cl-data.ts)

**Typy i Modele Danych:**
- `interface CLPoint` *extends Vector3D* { i, j, k } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cl-data.ts#L22)
- `interface CLCommand` { type, point, feedRate, spindleRpm, spindleDirection, toolId, toolDiameter, toolName, +5 more } [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cl-data.ts#L28)
- `interface CLDataProgram` { projectName, wcsName, wcsOrigin, commands, totalLengthMm, estimatedTimeSec, toolIdsUsed, workpieceDimensions } [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cl-data.ts#L57)
- `type CLCommandType` = `| 'GOTO' // Szybki lub roboczy ruch liniowy [x, y, z] | '...` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cl-data.ts#L10)

### [C1_cnc/core/cnc-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cnc-engine.ts)

**Klasy:**
- `class CNCEngine` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cnc-engine.ts#L19)
  - `getInstance(): CNCEngine` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cnc-engine.ts#L47)
  - `initializeIfNeeded(scene: any): void` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cnc-engine.ts#L54)
  - `getDimensionsMM(panel: any): { width: number; height: number; thickness: num...` [L237](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cnc-engine.ts#L237)
  - `startSimulation(speed: number): void` [L253](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cnc-engine.ts#L253)
  - `pauseSimulation(): void` [L298](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cnc-engine.ts#L298)
  - `stopSimulation(): void` [L303](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cnc-engine.ts#L303)

### [C1_cnc/dto/cam-dto.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts)

**Typy i Modele Danych:**
- `interface Vector3D` { x, y, z } [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L8)
- `interface HoleFeature` { name, position, positions, panelPosition, panelPositions, holeCount, diameter, depth, +9 more } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L20)
- `interface GrooveFeature` { name, purpose, startPoint, endPoint, panelStartPoint, panelEndPoint, normal, panelNormal, +10 more } [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L65)
- `interface ContourFeature` { name, points, panelPoints, depth, objectName, featureId, toolId, leadIn, +7 more } [L102](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L102)
- `interface PocketFeature` { name, featureId, objectName, face, width, length, depth, boundaryPoints, +5 more } [L134](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L134)
- `interface CAMStrategyParams` { feedRate, spindleRpm, stepoverPercent, stepdownMm, leadInMm, leadOutMm, compensation, peckStepMm, +1 more } [L164](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L164)
- `interface ToolParameters` { feedRate, spindleRpm, thickness } [L176](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L176)
- `interface Tool` { id, name, diameter, type, parameters, allowedAxes } [L183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L183)
- `interface CAMProject` { wcsOrigin, wcsName, features, toolAssignments, projectName, postprocessor, strategyId, strategyParams, +1 more } [L192](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L192)
- `interface CNCMove` { type, endPoint } [L204](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L204)
- `interface CNCOperationParameters` { diameter, depth, feedRate, spindleRpm, retractR, width, moves, approachPoint, +4 more } [L210](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L210)
- `interface CNCOperation` { type, toolId, position, parameters } [L225](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L225)
- `interface CAMData` { objectName, features, wcsOffset, isDirty } [L239](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L239)
- `type GroovePurpose` = `'LED_CHANNEL' | 'BACK_GROOVE' | 'GENERIC'` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L63)
- `type CAMFeature` = `HoleFeature | GrooveFeature | ContourFeature | PocketFeature` [L162](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/dto/cam-dto.ts#L162)

### [C1_cnc/geometry/cnc-geometry-utils.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts)

**Funkcje:**
- `export` `createVector3D(x, y, z): Vector3D` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L15)
- `export` `vecLength(v: Vector3D): number` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L19)
- `export` `vecNormalize(v: Vector3D): Vector3D` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L23)
- `export` `vecAdd(a: Vector3D, b: Vector3D): Vector3D` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L29)
- `export` `vecSub(a: Vector3D, b: Vector3D): Vector3D` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L33)
- `export` `vecScale(v: Vector3D, s: number): Vector3D` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L37)
- `export` `vecDot(a: Vector3D, b: Vector3D): number` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L41)
- `export` `vecCross(a: Vector3D, b: Vector3D): Vector3D` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L45)
- `export` `vecDistance(a: Vector3D, b: Vector3D): number` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L53)
- `export` `aabbIntersects(a: AABB, b: AABB, eps): boolean` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L57)
- `export` `calculateRadiusOffsetPath(5 params): Vector3D[]` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L68)
- `export` `generateEffectiveContourPath(6 params): Vector3D[]` [L189](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L189)
- `export` `chainEdgeSegments(edgeSegments: { points: Vector3D[] }[]): Vector3D[]` [L268](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L268)
- `export` `calculateOpenPathLength(points: Vector3D[], startPoint: Vector3D): number` [L354](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L354)
- `export` `optimizePath2Opt(4 params): T[]` [L375](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L375)

**Typy i Modele Danych:**
- `interface AABB` { min, max } [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/cnc-geometry-utils.ts#L10)

### [C1_cnc/geometry/geometry-extractor.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/geometry-extractor.ts)

**Klasy:**
- `class GeometryDataExtractor` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/geometry-extractor.ts#L29)
  - `extractPanelFeatures(3 params): CAMData` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/geometry-extractor.ts#L36)

**Typy i Modele Danych:**
- `interface FaceData3D` { origin, uAxis, vAxis, normal, width, height } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/geometry/geometry-extractor.ts#L20)

### [C1_cnc/inputs/dxf-importer.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts)

**Funkcje:**
- `extractNumberFromLayer(layer: string, prefixRegex: RegExp): number | null` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L87)
- `export` `parseDxfLayerParams(layer: string, panelThicknessMm?: number): any` [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L94)
- `export` `parseDxfAscii(dxfContent: string): DxfParseResult` [L143](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L143)
- `export` `parseDxf(dxfContent: string): DxfEntity[]` [L351](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L351)
- `export` `importDxfToWorkpiece(dxfContent: string, fileName: string, options: DxfImportOptions): CncModulePayload` [L358](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L358)
- `export` `inspectDxf(dxfContent: string): DxfMetadataSummary` [L608](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L608)

**Typy i Modele Danych:**
- `interface DxfCircle` { type, layer, x, y, z, radius } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L15)
- `interface DxfLine` { type, layer, x1, y1, z1, x2, y2, z2 } [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L24)
- `interface DxfVertex` { x, y, z, bulge } [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L35)
- `interface DxfPolyline` { type, layer, closed, vertices } [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L42)
- `interface DxfArc` { type, layer, x, y, z, radius, startAngle, endAngle } [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L49)
- `interface DxfParseResult` { entities, layers, headerExtMin, headerExtMax } [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L62)
- `interface DxfImportOptions` { defaultThicknessMm, defaultThickness, defaultDrillDepthMm, defaultGrooveWidthMm, defaultGrooveDepthMm, normalizeToOrigin } [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L69)
- `interface DxfPair` { code, value } [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L129)
- `interface DxfRecord` { type, pairs } [L134](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L134)
- `interface DxfMetadataSummary` { widthMm, heightMm, suggestedThicknessMm, holesCount, groovesCount, contoursCount, layers } [L594](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L594)
- `type DxfEntity` = `DxfCircle | DxfLine | DxfPolyline | DxfArc` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/inputs/dxf-importer.ts#L60)

### [C1_cnc/interaction/arcball-camera-session.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts)

**Klasy:**
- `class ArcballObjectSession` *implements CameraRotationSession* [L294](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L294)
  - `constructor(5 params): void` [L305](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L305)
  - `begin(screenX: number, screenY: number): void` [L316](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L316)
  - `move(screenX: number, screenY: number): void` [L383](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L383)
  - `end(): void` [L429](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L429)

**Funkcje:**
- `vNorm(x: number, y: number, z: number): Vec3` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L62)
- `cameraBasis(camera: any): { right: Vec3; up: Vec3; forward: Vec3 }` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L68)
- `aabbCenterAndRadius(root: any): { center: Vec3; radius: number; extentsMm: numb...` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L92)
- `export` `getRingRadiusMm(model: any | undefined, extentsMm?: number[]): number` [L114](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L114)
- `projectWorldToScreen(point: Vec3, canvas: HTMLCanvasElement, camera: any, scene: any): { x: number; y: number } | null` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L133)
- `pivotOnScreen(canvas: HTMLCanvasElement, camera: any, pivot: Vec3, scene: any): { x: number; y: number }` [L166](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L166)
- `computeScreenRadiusPx(6 params): number` [L176](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L176)
- `pointerToSphereUnit(12 params): Vec3` [L202](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L202)
- `babylonQuatFromAxisAngle(axis: Vec3, angleRad: number): any` [L241](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L241)
- `cubeQuatFromCamera(camera: any): any` [L252](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L252)
- `readInitialCubeQuat(camera: any): any` [L261](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L261)
- `quatToCssMatrix3d(q: any): string` [L271](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L271)
- `syncViewCubeWithPanel(deltaQuat: any, initialCubeQuat: any): void` [L284](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L284)
- `export` `createArcballCameraFactory(2 params): CameraRotationFactory` [L624](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L624)

**Typy i Modele Danych:**
- `interface CameraRotationSession` { begin, move, end } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L20)
- `interface DragState` { pivot, radiusWorld, screenRadiusPx, pivotScreenX, pivotScreenY, cameraRight, cameraUp, cameraForward, +4 more } [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L46)
- `type CameraRotationFactory` = `( camera: any, scene: any, canvas: HTMLCanvasElement ) =>...` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L26)
- `type PanelViewGetter` = `() => { root: any; model?: any } | null | undefined` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-camera-session.ts#L32)

### [C1_cnc/interaction/arcball-math.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts)

**Funkcje:**
- `export` `vec3(x: number, y: number, z: number): Vec3` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L12)
- `export` `vAdd(a: Vec3, b: Vec3): Vec3` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L16)
- `export` `vScale(a: Vec3, s: number): Vec3` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L20)
- `export` `vDot(a: Vec3, b: Vec3): number` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L24)
- `export` `vCross(a: Vec3, b: Vec3): Vec3` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L28)
- `export` `vLen(a: Vec3): number` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L36)
- `export` `vNormalize(a: Vec3): Vec3` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L40)
- `export` `quatIdentity(): Quat` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L49)
- `export` `quatFromAxisAngle(axis: Vec3, angleRad: number): Quat` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L54)
- `export` `quatRotateVec(q: Quat, v: Vec3): Vec3` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L66)
- `export` `projectPointerToSphere(8 params): Vec3` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L82)
- `export` `raySphereNearestHit(rayOrigin: Vec3, rayDir: Vec3, center: Vec3, radius: number): Vec3 | null` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L118)
- `export` `unitFromSphereHit(center: Vec3, hit: Vec3): Vec3` [L152](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L152)
- `export` `computeArcballDelta(startUnit: Vec3, currUnit: Vec3, snapAngleDeg: number): ArcballDelta | null` [L170](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L170)
- `export` `generateChordArcPoints(6 params): Vec3[]` [L199](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L199)

**Typy i Modele Danych:**
- `interface Vec3` { x, y, z } [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L6)
- `interface ArcballDelta` { axis, angleRad, quat } [L160](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L160)
- `type Quat` = `{ x: number; y: number; z: number; w: number }` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/arcball-math.ts#L47)

### [C1_cnc/interaction/select-profile-tool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/select-profile-tool.ts)

**Klasy:**
- `class SelectProfileTool` *extends BaseState* [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/select-profile-tool.ts#L89)
  - `onEnter(): void` [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/select-profile-tool.ts#L99)
  - `onExit(): void` [L141](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/select-profile-tool.ts#L141)
  - `onSelect(intent: Intent): void` [L164](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/select-profile-tool.ts#L164)
  - `onConfirm(intent: Intent): void` [L172](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/select-profile-tool.ts#L172)
  - `onCancel(intent: Intent): void` [L182](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/select-profile-tool.ts#L182)
  - `forceConfirm(): void` [L187](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/select-profile-tool.ts#L187)
  - `forceCancel(): void` [L192](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/select-profile-tool.ts#L192)

**Funkcje:**
- `export` `chainEdgeSegments(edgeSegments: { points: {x: number, y: number, z: number}[] }[]): any` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/interaction/select-profile-tool.ts#L6)

### [C1_cnc/postprocessors/base-postprocessor.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/base-postprocessor.ts)

**Klasy:**
- `class Postprocessor` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/base-postprocessor.ts#L12)
  - `generateNcCode(program: CLDataProgram): string` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/base-postprocessor.ts#L13)
  - `getSupportedOperations(): string[]` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/base-postprocessor.ts#L14)
  - `requireWorkpieceDimensions(program: CLDataProgram, postName: string): { width: number; height: number; thickness: num...` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/base-postprocessor.ts#L20)
  - `generateFromCLData(clProgram: CLDataProgram): string` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/base-postprocessor.ts#L35)

### [C1_cnc/postprocessors/biesse-postprocessor.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/biesse-postprocessor.ts)

**Klasy:**
- `class BiessePostprocessor` *extends Postprocessor* [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/biesse-postprocessor.ts#L10)
  - `generateNcCode(program: CLDataProgram): string` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/biesse-postprocessor.ts#L11)
  - `getSupportedOperations(): string[]` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/biesse-postprocessor.ts#L45)

### [C1_cnc/postprocessors/fanuc-postprocessor.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/fanuc-postprocessor.ts)

**Klasy:**
- `class FanucPostprocessor` *extends Postprocessor* [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/fanuc-postprocessor.ts#L10)
  - `generateNcCode(program: CLDataProgram): string` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/fanuc-postprocessor.ts#L11)
  - `getSupportedOperations(): string[]` [L102](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/fanuc-postprocessor.ts#L102)

### [C1_cnc/postprocessors/mach3-postprocessor.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/mach3-postprocessor.ts)

**Klasy:**
- `class Mach3Postprocessor` *extends Postprocessor* [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/mach3-postprocessor.ts#L11)
  - `generateNcCode(program: CLDataProgram): string` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/mach3-postprocessor.ts#L21)
  - `getSupportedOperations(): string[]` [L109](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/mach3-postprocessor.ts#L109)

### [C1_cnc/postprocessors/scm-postprocessor.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/scm-postprocessor.ts)

**Klasy:**
- `class SCMPostprocessor` *extends Postprocessor* [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/scm-postprocessor.ts#L11)
  - `generateNcCode(program: CLDataProgram): string` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/scm-postprocessor.ts#L12)
  - `getSupportedOperations(): string[]` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/scm-postprocessor.ts#L40)

### [C1_cnc/postprocessors/woodwop-postprocessor.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/woodwop-postprocessor.ts)

**Klasy:**
- `class WoodWOPPostprocessor` *extends Postprocessor* [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/woodwop-postprocessor.ts#L11)
  - `generateNcCode(program: CLDataProgram): string` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/woodwop-postprocessor.ts#L12)
  - `getSupportedOperations(): string[]` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/postprocessors/woodwop-postprocessor.ts#L62)

### [C1_cnc/processor/cam-processor.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts)

**Klasy:**
- `class CAMProcessor` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L44)
  - `registerStrategy(strategy: MachiningStrategy): void` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L59)
  - `getStrategy(id: string): MachiningStrategy | undefined` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L63)
  - `constructor(toolLibrary?: ToolLibrary): void` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L67)
  - `getLastAssignmentIssues(): AssignmentIssues` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L71)
  - `processProject(project: CAMProject, strategyId?: string): CNCOperation[]` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L81)
  - `buildCLProgram(project: CAMProject, strategyId?: string): CLDataProgram` [L101](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L101)
  - `assignToolsToFeatures(features: CAMFeature[]): CAMFeature[]` [L275](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L275)
  - `optimizeOperations(operations: CNCOperation[], wcsOrigin: Vector3D): CNCOperation[]` [L318](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L318)
  - `optimizeFeatureOrder(features: CAMFeature[]): CAMFeature[]` [L363](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L363)

**Typy i Modele Danych:**
- `interface AssignmentIssues` { unassignedHolesMm, unassignedGrooves, unassignedContours, unassignedPockets, totalUnassigned } [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/cam-processor.ts#L36)

### [C1_cnc/processor/tool-library.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/tool-library.ts)

**Klasy:**
- `class ToolLibrary` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/tool-library.ts#L84)
  - `constructor(initialTools: Tool[]): void` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/tool-library.ts#L87)
  - `getAllTools(): Tool[]` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/tool-library.ts#L93)
  - `getTool(id: string): Tool | undefined` [L97](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/tool-library.ts#L97)
  - `addOrUpdateTool(tool: Tool): void` [L101](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/tool-library.ts#L101)
  - `removeTool(id: string): boolean` [L105](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/tool-library.ts#L105)
  - `findBestHoleTool(diameterMm: number, toleranceMm: number): Tool | null` [L112](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/tool-library.ts#L112)
  - `findBestGrooveTool(): Tool | null` [L131](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/tool-library.ts#L131)

**Stałe i Słowniki:**
- `const DEFAULT_CNC_TOOLS: Tool[]` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/processor/tool-library.ts#L9)

### [C1_cnc/rules/machining-rule-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/rules/machining-rule-engine.ts)

**Klasy:**
- `class MachiningRuleEngine` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/rules/machining-rule-engine.ts#L25)
  - `getInstance(): MachiningRuleEngine` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/rules/machining-rule-engine.ts#L28)
  - `resolveFeatureMachining(feat: CAMFeature, toolLibrary: ToolLibrary): MachiningResolution` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/rules/machining-rule-engine.ts#L38)

**Typy i Modele Danych:**
- `interface MachiningResolution` { tool, strategyId, parameters, warning } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/rules/machining-rule-engine.ts#L18)

### [C1_cnc/strategies/base-strategy.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/base-strategy.ts)

**Typy i Modele Danych:**
- `interface MachiningStrategy` { id, name, description, targetFeatureTypes, generateCLCommands } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/base-strategy.ts#L12)
- `type StrategyParams` = `CAMStrategyParams` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/base-strategy.ts#L10)

### [C1_cnc/strategies/drilling-strategy.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/drilling-strategy.ts)

**Klasy:**
- `class DrillingStrategy` *implements MachiningStrategy* [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/drilling-strategy.ts#L11)
  - `generateCLCommands(4 params): CLCommand[]` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/drilling-strategy.ts#L17)

### [C1_cnc/strategies/pocketing-strategy.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/pocketing-strategy.ts)

**Klasy:**
- `class PocketingStrategy` *implements MachiningStrategy* [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/pocketing-strategy.ts#L16)
  - `generateCLCommands(4 params): CLCommand[]` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/pocketing-strategy.ts#L22)

### [C1_cnc/strategies/profiling-strategy.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/profiling-strategy.ts)

**Klasy:**
- `class ProfilingStrategy` *implements MachiningStrategy* [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/profiling-strategy.ts#L18)
  - `generateCLCommands(4 params): CLCommand[]` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/strategies/profiling-strategy.ts#L24)

### [C1_cnc/ui/CncPanel.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/CncPanel.tsx)

**Funkcje:**
- `export` `getPanelDimensionsMM(panel: any): any` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/CncPanel.tsx#L50)
- `export` `chainEdgeSegments(edgeSegments: { points: {x: number, y: number, z: number}[] }[]): any` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/CncPanel.tsx#L67)
- `export` `CncPanel({ activePanel, scene, onClose, isEmbedded = false }): any` [L180](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/CncPanel.tsx#L180)

**Typy i Modele Danych:**
- `interface CncPanelProps` { activePanel, scene, onClose, isEmbedded } [L150](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/CncPanel.tsx#L150)
- `interface CNCProgram` { id, name, targetPanel, targetPanelId, targetPanelLabel, wcsName, cornerIndex, wcsOffsetX, +10 more } [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/CncPanel.tsx#L157)
- `type SubTab` = `'wcs' | 'tool' | 'operation' | 'simulate' | 'generate'` [L178](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/CncPanel.tsx#L178)

### [C1_cnc/ui/tabs/GCodeTab.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/GCodeTab.tsx)

**Funkcje:**
- `export` `GCodeTab({ program, onUpdateProgram }): any` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/GCodeTab.tsx#L27)

**Typy i Modele Danych:**
- `interface GCodeTabProps` { program, onUpdateProgram } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/GCodeTab.tsx#L22)

### [C1_cnc/ui/tabs/OperationsTab.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/OperationsTab.tsx)

**Funkcje:**
- `export` `OperationsTab(1 params): any` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/OperationsTab.tsx#L35)

**Typy i Modele Danych:**
- `interface OperationsTabProps` { program, toolLibrary, isSelectingProfile, onToggleSelectingProfile, onUpdateProgram, onGenerateCLData } [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/OperationsTab.tsx#L26)

### [C1_cnc/ui/tabs/SimulationTab.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/SimulationTab.tsx)

**Funkcje:**
- `export` `SimulationTab(1 params): any` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/SimulationTab.tsx#L26)

**Typy i Modele Danych:**
- `interface SimulationTabProps` { program, simStatusText, simProgressPercent, simProgress, onStartSimulation, onStopSimulation } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/SimulationTab.tsx#L17)

### [C1_cnc/ui/tabs/ToolManagerTab.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/ToolManagerTab.tsx)

**Funkcje:**
- `export` `ToolManagerTab({ toolLibrary, onUpdateLibrary }): any` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/ToolManagerTab.tsx#L23)

**Typy i Modele Danych:**
- `interface ToolManagerTabProps` { toolLibrary, onUpdateLibrary } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/ToolManagerTab.tsx#L18)

### [C1_cnc/ui/tabs/WcsTab.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/WcsTab.tsx)

**Funkcje:**
- `export` `WcsTab(1 params): any` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/WcsTab.tsx#L27)

**Typy i Modele Danych:**
- `interface WcsTabProps` { program, panelDimensions, isPickingWcsCorner, onTogglePickingWcsCorner, onUpdateProgram, onViewNormal, onToggleIsolation } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/tabs/WcsTab.tsx#L17)

### [C1_cnc/visualization/cam-visualizer.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts)

**Klasy:**
- `class CAMVisualizer` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L15)
  - `constructor(scene: any): void` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L23)
  - `clear(): void` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L36)
  - `renderWcsGizmo(wcsManager: any, parentNode: any, panelObj: any): void` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L61)
  - `renderFeatures(features: CAMFeature[], wcsManager: any, parentNode: any): void` [L153](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L153)
  - `renderAllPivots(panelViews: Map<any, any>): void` [L403](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L403)
  - `highlightFeature(feature: any, parentNode: any): void` [L435](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L435)
  - `showToolPreview(tool: Tool, position?: Vector3D, parentNode?: any): void` [L530](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L530)
  - `clearToolPreview(): void` [L549](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L549)
  - `clearHighlight(): void` [L556](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L556)
  - `renderToolpaths(operations: CNCOperation[], wcsManager: any, parentNode: any): void` [L569](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L569)
  - `clearToolpaths(): void` [L721](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cam-visualizer.ts#L721)

### [C1_cnc/visualization/cnc-simulator.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts)

**Klasy:**
- `class CNCSimulator` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L31)
  - `constructor(scene: any, toolLibrary?: ToolLibrary): void` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L67)
  - `setWcsTransform(wcsManager: any, parentNode: any): void` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L75)
  - `loadOperations(operations: CNCOperation[]): void` [L124](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L124)
  - `onStatus(cb: (info: SimStatusUpdate) => void): void` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L133)
  - `setSpeed(multiplier: number): void` [L137](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L137)
  - `start(): void` [L141](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L141)
  - `pause(): void` [L178](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L178)
  - `stop(): void` [L184](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L184)

**Typy i Modele Danych:**
- `interface SimStatusUpdate` { statusText, opIndex, totalOps, progressPercent, state, running } [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L21)
- `type SimState` = `'MOVE' | 'DOWN' | 'CUT' | 'UP'` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/cnc-simulator.ts#L19)

### [C1_cnc/visualization/tool-mesh-factory.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/tool-mesh-factory.ts)

**Klasy:**
- `class CNCToolMeshFactory` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/tool-mesh-factory.ts#L12)
  - `getColorForDiameter(diameterMm: number): any` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/tool-mesh-factory.ts#L16)
  - `createToolMesh(tool: Tool, scene: any): any` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/visualization/tool-mesh-factory.ts#L31)

### [C1_cnc/wcs/wcs-manager.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts)

**Klasy:**
- `class WcsManager` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L16)
  - `constructor(wcsName: string): void` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L33)
  - `getWcsName(): string` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L37)
  - `setWcsName(name: string): void` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L41)
  - `setRule(rule: WcsRule): void` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L48)
  - `setManualOffset(offset: Vector3D): void` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L55)
  - `setManualRotation(rot: { x: number, y: number, z: number }): void` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L62)
  - `updateForPanelDimensions(width: number, height: number, thickness: number): void` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L69)
  - `getRotation(): { x: number, y: number, z: number }` [L76](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L76)
  - `getDirections(): { x: number, y: number, z: number }` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L87)
  - `getOrigin(): Vector3D` [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L99)
  - `toWcsCoordinates(point: Vector3D): Vector3D` [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L116)
  - `toPanelCoordinates(wcsPoint: Vector3D): Vector3D` [L128](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L128)
  - `toPanelVector(wcsVector: Vector3D): Vector3D` [L166](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L166)
  - `transformVector(vec: Vector3D): Vector3D` [L201](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L201)

**Funkcje:**
- `export` `retransformFeaturesToWcs(features: CAMFeature[], wcsManager: WcsManager): CAMFeature[]` [L232](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-manager.ts#L232)

### [C1_cnc/wcs/wcs-rules-mapper.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-rules-mapper.ts)

**Klasy:**
- `class WcsRulesMapper` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-rules-mapper.ts#L36)
  - `getRuleForRole(role: string): WcsRule | null` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-rules-mapper.ts#L37)

**Funkcje:**
- `export` `cornerIndexToOriginCorner(cornerIndex: number): { X: string; Y: string; Z: string }` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-rules-mapper.ts#L20)

**Typy i Modele Danych:**
- `interface WcsRule` { origin_corner, directions, rotation } [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/wcs/wcs-rules-mapper.ts#L9)

## <a id="c2_connectors"></a>C2 Connectors (Połączenia Meblowe, Mimośrody, Kołki)

### [C2_connectors/commands/sync-connector-drillings-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/commands/sync-connector-drillings-command.ts)

**Klasy:**
- `class SyncConnectorDrillingsCommand` *implements Command* [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/commands/sync-connector-drillings-command.ts#L12)
  - `constructor(): void` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/commands/sync-connector-drillings-command.ts#L20)
  - `execute(document: ProjectDocument): void` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/commands/sync-connector-drillings-command.ts#L26)
  - `undo(document: ProjectDocument): void` [L85](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/commands/sync-connector-drillings-command.ts#L85)

### [C2_connectors/connector-commands.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts)

**Klasy:**
- `class AddConnectorGroupCommand` *implements Command* [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L23)
  - `constructor(store: ConnectorStore, group: ConnectorGroup, label): void` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L31)
  - `execute(): void` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L38)
  - `undo(): void` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L44)
- `class RemoveConnectorGroupCommand` *implements Command* [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L49)
  - `constructor(store: ConnectorStore, group: ConnectorGroup, label): void` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L57)
  - `execute(): void` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L64)
  - `undo(): void` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L68)
- `class ReplaceConnectorGroupCommand` *implements Command* [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L75)
  - `constructor(4 params): void` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L84)
  - `execute(): void` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L92)
  - `undo(): void` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L96)

**Funkcje:**
- `nextCommandId(kind: string): string` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L10)
- `export` `executeConnectorCommand(command: Command): void` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-commands.ts#L14)

### [C2_connectors/connector-controller.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-controller.ts)

**Funkcje:**
- `scheduleDrillingSync(): void` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-controller.ts#L17)
- `export` `attachConnectorsExtension(document: ProjectDocument): () => void` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-controller.ts#L31)

### [C2_connectors/connector-picker.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts)

**Funkcje:**
- `cameraRayCad(): { origin: Vec3; dir: Vec3 } | null` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L44)
- `toLocal(node: CADNode, world: Vec3Tuple): Vec3Tuple` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L55)
- `export` `buildGroupFromContact(7 params): ConnectorGroup | null` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L59)
- `export` `regenerateGroup(6 params): ConnectorGroup | null` [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L139)
- `rescan(): void` [L178](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L178)
- `placeFace(face: EligibleContactFace): void` [L192](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L192)
- `finishPick(): void` [L210](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L210)
- `detachObservers(): void` [L223](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L223)
- `export` `isConnectorPickActive(): boolean` [L235](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L235)
- `export` `getConnectorPickCount(): number` [L239](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L239)
- `export` `stopConnectorPick(): void` [L243](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L243)
- `export` `startConnectorPick(): void` [L247](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L247)
- `export` `confirmConnectorPick(): void` [L305](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L305)
- `export` `applyRuleToGroup(6 params): boolean` [L309](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L309)

**Typy i Modele Danych:**
- `interface ConnectorPickState` { active, count } [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-picker.ts#L32)

### [C2_connectors/connector-positions-editor.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-positions-editor.tsx)

**Funkcje:**
- `export` `ConnectorPositionsEditor(1 params): any` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-positions-editor.tsx#L17)

### [C2_connectors/connector-presets.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts)

**Klasy:**
- `class ConnectorPresetStore` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L89)
  - `onChange(listener: ConnectorPresetListener): () => void` [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L104)
  - `notifyChanged(): void` [L109](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L109)
  - `load(): void` [L131](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L131)
  - `get(id: string): ConnectorPreset | null` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L157)
  - `add(input: Omit<ConnectorPreset, 'id'> & { id?: string }): ConnectorPreset` [L161](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L161)
  - `update(id: string, patch: Partial<Omit<ConnectorPreset, 'id'>>): ConnectorPreset | null` [L179](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L179)
  - `remove(id: string): boolean` [L206](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L206)
  - `replaceAll(presets: ConnectorPreset[], nextId): void` [L216](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L216)
  - `clear(): void` [L223](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L223)

**Funkcje:**
- `export` `normalizePositionsActive(placementRule: string, mask?: boolean[] | null): boolean[]` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L22)
- `export` `normalizePositionTypes(placementRule: string, types?: string[] | null): string[]` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L35)
- `export` `summarizePresetMask(preset: Pick<ConnectorPreset, 'placementRule' | 'positi...): string` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L48)
- `revivePreset(raw: any): ConnectorPreset | null` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L69)

**Typy i Modele Danych:**
- `type ConnectorPresetListener` = `() => void` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L20)

**Stałe i Słowniki:**
- `const CONNECTOR_PRESETS_STORAGE_KEY` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-presets.ts#L18)

### [C2_connectors/connector-store.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts)

**Klasy:**
- `class ConnectorStore` [L85](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L85)
  - `onChange(listener: ConnectorChangeListener): () => void` [L112](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L112)
  - `notifyChanged(): void` [L117](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L117)
  - `nextGroupId(): string` [L127](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L127)
  - `addGroup(group: ConnectorGroup): ConnectorGroup` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L133)
  - `get(id: string): ConnectorGroup | null` [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L139)
  - `updateGroup(id: string, patch: Partial<ConnectorGroup>): boolean` [L143](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L143)
  - `removeGroup(id: string): boolean` [L151](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L151)
  - `replaceGroup(id: string, next: ConnectorGroup): boolean` [L160](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L160)
  - `setEditing(id: string): void` [L168](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L168)
  - `setPlacementRule(ruleKey: string): void` [L186](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L186)
  - `setPositionsActive(mask: boolean[]): void` [L193](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L193)
  - `setPositionTypes(types: string[]): void` [L198](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L198)
  - `togglePosition(index: number): void` [L203](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L203)
  - `setPositionType(index: number, type: string): void` [L211](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L211)
  - `applyPreset(preset: ConnectorPreset): void` [L219](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L219)
  - `copyRuleFrom(id: string): boolean` [L228](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L228)
  - `pruneMissingNodes(existingIds: Set<string>): number` [L245](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L245)
  - `clear(): void` [L258](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L258)
  - `toJSON(): ConnectorStoreJSON` [L274](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L274)
  - `fromJSON(data: ConnectorStoreJSON | null | undefined): void` [L293](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L293)
  - `attachTo(document: ProjectDocument): () => void` [L328](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L328)

**Funkcje:**
- `parseFirstOffsetMm(raw: unknown, fallback: number): number` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L31)
- `isTuple(raw: unknown): raw is Vec3Tuple` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L38)
- `reviveGroup(raw: any): ConnectorGroup | null` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L42)

**Typy i Modele Danych:**
- `interface ConnectorStoreJSON` { version, nextId, groups, clipboardRule, clipboardFirstOffsetMm, clipboardPositionsActive, clipboardPositionTypes } [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L21)
- `type ConnectorChangeListener` = `() => void` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-store.ts#L36)

### [C2_connectors/connector-tree-row.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-tree-row.tsx)

**Funkcje:**
- `export` `ConnectorTreeRow({ group: g, document }: Props): any` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-tree-row.tsx#L22)

**Typy i Modele Danych:**
- `interface Props` { group, document } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-tree-row.tsx#L17)

### [C2_connectors/connector-visualizer.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts)

**Klasy:**
- `class ConnectorVisualizer` [L67](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts#L67)
  - `attach(): void` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts#L87)
  - `setEligibleFaces(faces: EligibleContactFace[], hover: EligibleContactFace | null): void` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts#L92)
  - `setHover(face: EligibleContactFace | null): void` [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts#L98)
  - `clearEligible(): void` [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts#L104)
  - `setSymbolsVisible(visible: boolean): void` [L112](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts#L112)
  - `refreshConnectors(): void` [L119](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts#L119)

**Funkcje:**
- `colorForType(type: string): any` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts#L29)
- `inflatePolygonMm(verts: Vec3[], amountMm: number): Vec3[]` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts#L36)
- `quatAlignY(dir: any): any` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connector-visualizer.ts#L57)

### [C2_connectors/connectors-drilling-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts)

**Funkcje:**
- `cadToPanelLocal(cad: Vec3Tuple): Vec3Tuple` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L48)
- `holeName(connectorType: string): string` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L52)
- `normalToFace(normal: Vec3Tuple): CanonicalFace` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L64)
- `contactFaceOnPanelB(normalInB: Vec3Tuple): CanonicalFace` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L81)
- `getPanelDims(panelData: any): PanelDims` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L93)
- `localPointToFaceUV(localPoint: Vec3Tuple, face: CanonicalFace, dims: PanelDims): { u: number; v: number }` [L121](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L121)
- `getFaceExtents(face: CanonicalFace, dims: PanelDims): { maxU: number; maxV: number }` [L151](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L151)
- `isWithinBounds(5 params): boolean` [L165](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L165)
- `snapEdgeUv(5 params): { u: number; v: number } | null` [L175](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L175)
- `nextFeatureId(groupId: string, connIndex: number, suffix: string): string` [L204](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L204)
- `export` `buildConnectorDrillings(document: ProjectDocument): ConnectorDrillingIntent[]` [L216](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L216)
- `processGroup(3 params): void` [L234](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L234)
- `processConnector(12 params): void` [L281](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L281)
- `emitHole(6 params): void` [L359](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L359)
- `computeHousingPosition(4 params): Vec3Tuple` [L405](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L405)
- `makeFeature(12 params): ConnectorDrillingFeature` [L432](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L432)

**Typy i Modele Danych:**
- `interface PanelDims` { widthMm, heightMm, thickMm } [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L87)
- `interface PanelSide` { node, dims, face, local } [L274](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-builder.ts#L274)

### [C2_connectors/connectors-drilling-intent.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-intent.ts)

**Typy i Modele Danych:**
- `interface ConnectorDrillingFeature` { id, type, face, name, side, params } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-intent.ts#L18)
- `interface ConnectorDrillingIntent` { targetNodeId, feature } [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-intent.ts#L52)
- `type CanonicalFace` = `| 'FACE_Z_PLUS' | 'FACE_Z_MINUS' | 'FACE_X_PLUS' | 'FACE_...` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-drilling-intent.ts#L10)

### [C2_connectors/connectors-embedment.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts)

**Funkcje:**
- `export` `isParentFaceContact(normalLocalMm: Vec3Tuple, faceName?: string): boolean` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L49)
- `faceSpecOf(type: string): DrillSpec | undefined` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L60)
- `edgeSpecOf(type: string): DrillSpec | undefined` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L66)
- `export` `isThroughFaceType(type: string): boolean` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L70)
- `validateFaceThicknessMm(faceThicknessMm: number, context: string): number` [L76](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L76)
- `export` `getSymbolSegments(type: string, hardwareLengthMm: number, faceThicknessMm: number): SymbolSegments` [L91](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L91)
- `export` `getFaceHoleDepthMm(type: string, faceThicknessMm: number): number` [L121](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L121)
- `export` `getEdgeHoleDepthMm(type: string): number` [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L129)
- `export` `getFaceHoleDiameterMm(type: string): number` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L133)
- `export` `getEdgeHoleDiameterMm(type: string): number` [L137](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L137)
- `export` `nearestEndFace(localX: number, localY: number, widthMm: number, heightMm: number): ConnectorEndFace` [L144](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L144)
- `export` `resolveEdgeFace(5 params): ConnectorEndFace` [L167](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L167)

**Typy i Modele Danych:**
- `interface DrillSpec` { diameter_mm, depth_mm, face_type, offset_from_edge_mm, through } [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L13)
- `interface ConnectorDrillSpecs` { panel_a, panel_b, panel_b_bolt, panel_b_housing } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L22)
- `interface SymbolSegments` { faceMm, edgeMm, faceDiaMm, edgeDiaMm, throughFace } [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L32)
- `type ConnectorEndFace` = `'FACE_X_PLUS' | 'FACE_X_MINUS' | 'FACE_Y_PLUS' | 'FACE_Y_...` [L141](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L141)

**Stałe i Słowniki:**
- `const DRILLING_SPECS: Record<string, ConnectorDrillSpecs>` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-embedment.ts#L29)

### [C2_connectors/connectors-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts)

**Funkcje:**
- `asTuple(v: Vec3): Vec3Tuple` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L29)
- `vec(t: Vec3Tuple | Vec3): Vec3` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L33)
- `resolveRules(rules?: ConnectorsRules): ConnectorsRules` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L38)
- `export` `quatFromTo(from: Vec3, to: Vec3): Quat` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L43)
- `export` `countRulePositions(rule: PlacementRuleDef | null | undefined): number` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L63)
- `export` `getConnectorDefinition(connectorType: string, rules?: ConnectorsRules): any` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L68)
- `export` `getPlacementRuleDefinition(ruleKey: string, rules?: ConnectorsRules): PlacementRuleDef | null` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L72)
- `export` `getPlacementRuleKeys(rules?: ConnectorsRules): string[]` [L77](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L77)
- `export` `getDefaultPlacementRule(rules?: ConnectorsRules): string` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L81)
- `export` `getConnectorTypeKeys(rules?: ConnectorsRules): string[]` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L86)
- `export` `getRulePositionTypes(placementRule: string, rules?: ConnectorsRules): string[]` [L91](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L91)
- `export` `shortConnectorTypeLabel(type: string, rules?: ConnectorsRules): string` [L102](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L102)
- `export` `orientAlongFormatkaDepth(edgeDir: Vec3, along?: Vec3 | null): Vec3` [L114](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L114)
- `export` `getFaceParams(faceVerts: Vec3[], along?: Vec3 | null): { center: Vec3; direction: Vec3; length: number }` [L127](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L127)
- `calculatePositionsByRule(6 params): any` [L151](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L151)
- `export` `generateConnectors(8 params): ConnectorPlacement[]` [L213](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-engine.ts#L213)

### [C2_connectors/connectors-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts)

**Funkcje:**
- `export` `isConnectorFromFront(direction: string): boolean` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L12)
- `export` `normalizeConnectorSide(direction: string): ConnectorDirection` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L16)
- `export` `canonicalPlacementRule(ruleKey: string): string` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L61)
- `export` `ruleEdgeOffsetMm(rule: PlacementRuleDef | null | undefined): number` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L65)
- `export` `applyFirstHoleOffset(3 params): number` [L76](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L76)

**Typy i Modele Danych:**
- `interface ConnectorTypeDef` { name, description, diameter, length, price } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L20)
- `interface ConnectorPositionDef` { offset_mm, type } [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L30)
- `interface ConnectorSideDef` { direction, positions } [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L35)
- `interface PlacementRuleDef` { name, description, sides } [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L40)
- `interface ConnectorsRules` { connector_types, placement_rules, default_settings } [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L46)
- `interface ConnectorInstance` { type, index, offsetMm, side, positionLocalMm, normalLocalMm, diameterMm, lengthMm } [L85](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L85)
- `interface ConnectorGroup` { id, name, parentObjectId, otherObjectId, faceName, placementRule, firstOffsetMm, positionsActive, +4 more } [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L98)
- `interface ConnectorPreset` { id, name, placementRule, firstOffsetMm, positionsActive, positionTypes } [L117](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L117)
- `interface ConnectorPlacement` { positionMm, type, index, offsetMm, side, diameterMm, lengthMm, rotationEuler } [L126](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L126)
- `interface EligibleContactFace` { panelId, otherPanelId, faceName, centerWorldMm, normalWorldMm, clippedVertsWorldMm } [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L139)
- `type Vec3Tuple` = `[number, number, number]` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L7)
- `type ConnectorDirection` = `'front' | 'back' | 'left' | 'right'` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L10)

**Stałe i Słowniki:**
- `const DEFAULT_FIRST_OFFSET_MM` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L56)
- `const LEGACY_SYMMETRY2_RULE` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L57)
- `const SYMMETRY_RULE` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L58)
- `const LEGACY_SYMMETRY2_FIRST_OFFSET_MM` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L59)
- `const CONNECTORS_DOCUMENT_SECTION` [L148](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L148)
- `const CONNECTORS_SCHEMA_VERSION` [L149](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L149)
- `const CONTACT_BACKOFF_MM` [L152](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L152)
- `const CONTACT_TOLERANCE_MM` [L153](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L153)
- `const CONTACT_MIN_OVERLAP_MM` [L154](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L154)
- `const PARALLEL_DOT_THRESHOLD` [L155](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L155)
- `const OPPOSING_NORMAL_DOT` [L156](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L156)
- `const PICK_EDGE_SLACK_MM` [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-types.ts#L158)

### [C2_connectors/connectors-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-ui.tsx)

**Funkcje:**
- `openDrzewoZlaczaTab(): any` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-ui.tsx#L32)
- `showIdleHint(): any` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-ui.tsx#L36)
- `clearOwnHint(): any` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-ui.tsx#L45)
- `export` `ConnectorsUI({ projectModel }: Props): any` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-ui.tsx#L52)

**Typy i Modele Danych:**
- `interface Props` { projectModel } [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-ui.tsx#L28)

**Stałe i Słowniki:**
- `const CONNECTORS_PANEL_TITLE` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/connectors-ui.tsx#L24)

### [C2_connectors/contact-scanner.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts)

**Funkcje:**
- `asTuple(v: Vec3): Vec3Tuple` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L45)
- `fromTuple(t: SolverVec3 | Vec3Tuple): Vec3` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L49)
- `export` `isCabinetPartForConnectors(node: CADNode | null): boolean` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L53)
- `export` `panelThicknessAxisWorld(node: CADNode): Vec3` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L70)
- `export` `connectorPartsArePerpendicular(a: CADNode, b: CADNode): boolean` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L86)
- `worldDirToLocal(node: CADNode, dir: Vec3): Vec3` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L92)
- `localDirToWorld(node: CADNode, dir: SolverVec3): Vec3` [L97](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L97)
- `boxCornersWorld(node: CADNode): Vec3[]` [L102](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L102)
- `faceCornersWorld(node: CADNode, faceName: string): Vec3[] | null` [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L116)
- `export` `rayAabb(origin: Vec3, dir: Vec3, min: Vec3, max: Vec3, maxDist: number): { t: number; normal: Vec3 } | null` [L137](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L137)
- `projectToPlane2d(p: Vec3, planeCo: Vec3, uAx: Vec3, vAx: Vec3): [number, number]` [L186](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L186)
- `aabbOverlap2d(2 params): { minX: number; maxX: number; minY: number; max...` [L196](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L196)
- `bounds2d(pts: Array<[number, number]>): any` [L210](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L210)
- `export` `collectConnectorParts(document: { getPanels?: () => CADNode[] } | null): CADNode[]` [L219](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L219)
- `export` `scanEligibleConnectorFaces(document: { getPanels?: () => CADNode[] } | null): EligibleContactFace[]` [L224](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L224)
- `export` `pointInPolygon2d(px: number, py: number, poly: Array<[number, number]>): boolean` [L317](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L317)
- `export` `distanceToSegment(p: Vec3, a: Vec3, b: Vec3): number` [L332](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L332)
- `export` `pickEligibleFace(faces: EligibleContactFace[], rayOrigin: Vec3, rayDir: Vec3): EligibleContactFace | null` [L340](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/C2_connectors/contact-scanner.ts#L340)

## <a id="d1_draw"></a>D1 Draw (Silnik Rysunkowy 2D)

### [D1_draw/draw-dimensions.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-dimensions.ts)

**Klasy:**
- `class DrawDimensionsEngine` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-dimensions.ts#L9)
  - `generateAutoDimensions(5 params): void` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-dimensions.ts#L13)
  - `renderDimensionSVG(dim: Draw2DDimension, viewX: number, viewY: number, scale: number): string` [L202](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-dimensions.ts#L202)

### [D1_draw/draw-hlr-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-hlr-engine.ts)

**Klasy:**
- `class DrawHLREngine` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-hlr-engine.ts#L61)
  - `computeHLR(parts: ProjectablePart[], projection: DrawProjectionAngle): { segments: Draw2DSegment[]; widthMm: number; h...` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-hlr-engine.ts#L62)

**Typy i Modele Danych:**
- `interface Point3D` { x, y, z } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-hlr-engine.ts#L18)
- `interface ProjectedPoint` { u, v, depth } [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-hlr-engine.ts#L24)
- `interface OccluderFace` { polygon, minU, maxU, minV, maxV, a, b, c, +2 more } [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-hlr-engine.ts#L30)
- `interface ProjectedEdge` { p1, p2, i1, i2, partId } [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-hlr-engine.ts#L44)
- `interface Interval` { start, end } [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-hlr-engine.ts#L52)

### [D1_draw/draw-projection.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts)

**Klasy:**
- `class DrawProjectionEngine` [L130](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L130)
  - `modelItemToProjectable(item: DrawModelItem): ProjectableCabinet` [L134](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L134)
  - `snapshotToProjectable(snapshot: E3GeometrySnapshot, customName?: string): ProjectableCabinet` [L231](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L231)
  - `generateSingleView(5 params): Draw2DView` [L306](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L306)
  - `generateViewsForCabinet(cabinet: ProjectableCabinet, scale: number): { views: Draw2DView[]; bomRows: BOMRow[] }` [L400](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L400)
  - `projectFront(4 params): Draw2DRect[]` [L419](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L419)
  - `projectTop(4 params): Draw2DRect[]` [L551](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L551)
  - `projectSide(4 params): Draw2DRect[]` [L599](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L599)
  - `projectIsometric(parts: ProjectablePart[]): Draw2DPolygon[]` [L645](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L645)
  - `generateBOM(parts: ProjectablePart[]): BOMRow[]` [L729](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L729)

**Funkcje:**
- `rotateVectorByQuat(2 params): { x: number; y: number; z: number }` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L50)
- `export` `getProjectedAngleFromSource(2 params): DrawProjectionAngle` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L70)

**Typy i Modele Danych:**
- `interface ProjectablePart` { id, name, role, material, thickness, dim, loc, vertices3D, +2 more } [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L24)
- `interface ProjectableCabinet` { id, width, height, depth, parts, name } [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-projection.ts#L38)

### [D1_draw/draw-sheet-svg.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts)

**Klasy:**
- `class DrawSheetSVGGenerator` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L72)
  - `constructor(paperFormat: PaperFormat): void` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L89)
  - `setPaperFormat(format: PaperFormat): void` [L112](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L112)
  - `generateSvg(): string` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L133)
  - `toRasterDataUrl(format: 'image/jpeg' | 'image/png', quality, scale): Promise<string>` [L515](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L515)
  - `downloadSvg(filename?: string): void` [L549](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L549)
  - `downloadJpg(filename?: string): Promise<void>` [L563](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L563)
  - `printSheet(): void` [L574](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L574)

**Funkcje:**
- `v(val: number): string` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L22)
- `svgRect(8 params): string` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L26)
- `svgLine(7 params): string` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L42)
- `svgText(8 params): string` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-sheet-svg.ts#L55)

### [D1_draw/draw-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts)

**Typy i Modele Danych:**
- `interface PaperDimensions` { width, height, label, description } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L14)
- `interface Draw2DPoint` { x, y } [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L40)
- `interface Draw2DHole` { x, y, diameter, depth } [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L45)
- `interface Draw2DGroove` { x, y, width, height, depth } [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L52)
- `interface Draw2DRect` { id, name, role, x, y, width, height, thickness, +7 more } [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L60)
- `interface Draw2DPolygon` { id, name, role, points, fillColor, strokeColor, strokeWidth } [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L78)
- `interface Draw2DDimension` { id, x1, y1, x2, y2, valueMm, text, offsetMm, +2 more } [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L88)
- `interface Draw2DSegment` { id, x1, y1, x2, y2, isHidden, strokeColor, strokeWidth, +1 more } [L101](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L101)
- `interface Draw2DView` { id, title, sourceNodeId, sourceNodeName, projection, scale, scaleText, x, +10 more } [L113](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L113)
- `interface TitleBlockInfo` { projectName, furnitureName, author, date, scale, sheetNumber, drawingNumber, remarks } [L136](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L136)
- `interface BOMRow` { name, material, length, width, thickness, qty } [L147](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L147)
- `interface DrawModelItem` { id, name, type, icon, width, height, depth, thickness, +5 more } [L156](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L156)
- `type PaperFormat` = `| 'A4_LANDSCAPE' | 'A4_PORTRAIT' | 'A3_LANDSCAPE' | 'A3_P...` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L6)
- `type DrawProjectionAngle` = `'FRONT' | 'TOP' | 'LEFT' | 'RIGHT' | 'BACK' | 'BOTTOM' | ...` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L38)

**Stałe i Słowniki:**
- `const PAPER_FORMATS: Record<PaperFormat, PaperDimensions>` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L21)
- `const MARGIN_LEFT` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L30)
- `const MARGIN_RIGHT` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L31)
- `const MARGIN_TOP` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L32)
- `const MARGIN_BOTTOM` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L33)
- `const TITLE_BLOCK_WIDTH` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L35)
- `const TITLE_BLOCK_HEIGHT` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/draw-types.ts#L36)

### [D1_draw/DrawStudio.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx)

**Funkcje:**
- `getViewSize(v: { widthMm: number; heightMm: number; scale: num...): any` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L38)
- `getViewCenter(v: { x: number; y: number; widthMm: number; height...): any` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L42)
- `collectDescendantIds(views: Draw2DView[], parentId: string): string[]` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L47)
- `AlignmentCenterline(1 params): any` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L52)
- `cadNodeToDrawItem(node: CADTreeNode): DrawModelItem` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L81)
- `findDrawItemById(items: DrawModelItem[], id?: string | null): DrawModelItem | undefined` [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L104)
- `findCadNodeById(node: CADTreeNode | null | undefined, id: string): CADTreeNode | null` [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L116)
- `resolveDroppedDrawItem(e: React.DragEvent): { item: DrawModelItem; angle: DrawProjectionAng...` [L126](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L126)
- `export` `DrawStudio({ initialTargetId, initialTreeRoot }): any` [L171](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L171)

**Typy i Modele Danych:**
- `type ActiveTool` = `'select' | 'projected_view' | 'smart_dim'` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L35)
- `type ViewAlignment` = `'HORIZONTAL' | 'VERTICAL' | 'DIAGONAL'` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/D1_draw/DrawStudio.tsx#L36)

## <a id="e1_export"></a>E1 Export (G-code, CSV, JSON, DXF)

### [E1_export/drawing-sheet.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts)

**Klasy:**
- `class DrawingSheet` [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L79)
  - `constructor(paperFormat: PaperFormat): void` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L96)
  - `setProjectInfo(info: Partial<TitleBlockInfo>): void` [L120](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L120)
  - `setViewportImage(base64Png: string | null): void` [L124](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L124)
  - `setVectorDrawing(svgCode: string | null): void` [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L129)
  - `addSvgOverlay(svgCode: string): void` [L134](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L134)
  - `clearSvgOverlays(): void` [L138](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L138)
  - `setBomData(rows: BOMRow[]): void` [L142](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L142)
  - `getAvailableDrawingArea(): { x: number; y: number; width: number; height: ...` [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L146)
  - `generateSvg(): string` [L156](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L156)
  - `toRasterDataUrl(format: 'image/jpeg' | 'image/png', quality, scale): Promise<string>` [L406](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L406)
  - `downloadJpg(filename?: string, quality): Promise<void>` [L475](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L475)
  - `downloadPng(filename?: string): Promise<void>` [L486](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L486)
  - `copySvgToClipboard(): Promise<void>` [L497](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L497)
  - `printSvg(): void` [L502](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L502)
  - `toSvgString(): string` [L545](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L545)
  - `downloadSvg(filename?: string): void` [L549](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L549)
  - `downloadRaster(formatOrFilename: string, filenameOrFormat?: string, quality): Promise<void>` [L563](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L563)
  - `printOrSavePdf(): void` [L584](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L584)
  - `printMultiSheet(sheets: DrawingSheet[]): void` [L588](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L588)

**Funkcje:**
- `v(val: number): string` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L29)
- `svgRect(8 params): string` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L33)
- `svgLine(7 params): string` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L49)
- `svgText(8 params): string` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/drawing-sheet.ts#L62)

### [E1_export/export-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts)

**Klasy:**
- `class ExportEngine` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L66)
  - `setPreviewSvg(svg: string | null): void` [L102](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L102)
  - `constructor(): void` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L107)
  - `subscribe(listener: () => void): () => void` [L121](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L121)
  - `setPaperFormat(format: PaperFormat): void` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L132)
  - `setRenderStyle(style: ExportRenderStyle): void` [L138](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L138)
  - `setShowGrid(visible: boolean): void` [L144](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L144)
  - `setProjectionType(type: ProjectionType): void` [L153](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L153)
  - `setShowBounds(show: boolean): void` [L173](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L173)
  - `applyVisualSettings(): void` [L180](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L180)
  - `applyRenderStyleToScene(style: ExportRenderStyle): void` [L198](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L198)
  - `setIncludeBOM(include: boolean): void` [L260](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L260)
  - `setIncludePMI(include: boolean): void` [L265](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L265)
  - `setNotes(notes: string): void` [L270](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L270)
  - `setTitleBlock(info: Partial<TitleBlockInfo>): void` [L277](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L277)
  - `calculateSheetLayout(): SheetScreenLayout` [L285](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L285)
  - `updatePassepartout(): void` [L358](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L358)
  - `setCameraPreset(preset: 'front' | 'back' | 'top' | 'bottom' | 'left' | ...): void` [L485](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L485)
  - `zoomFit(): void` [L527](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L527)
  - `captureCroppedViewport(sheet: DrawingSheet): Promise<string>` [L536](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L536)
  - `projectPMIToSvg(sheet: DrawingSheet): void` [L647](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L647)
  - `extractBOMRows(): BOMRow[]` [L747](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L747)
  - `generateCurrentDrawingSheet(): Promise<DrawingSheet>` [L784](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L784)
  - `saveCurrentViewWithThumbnail(customName?: string, description?: string): Promise<SavedExportView>` [L811](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L811)
  - `saveCurrentView(customName?: string): SavedExportView` [L852](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L852)
  - `updateSavedViewWithCurrent(id: string): Promise<SavedExportView | null>` [L886](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L886)
  - `clearSavedViews(): void` [L936](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L936)
  - `replaceSavedViews(views: SavedExportView[]): void` [L942](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L942)
  - `duplicateSavedView(id: string): SavedExportView | null` [L956](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L956)
  - `applySavedView(view: SavedExportView): void` [L975](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L975)
  - `deleteSavedView(id: string): void` [L1016](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L1016)
  - `renameSavedView(id: string, newName: string): void` [L1022](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L1022)
  - `updateSavedViewFormat(id: string, newFormat: PaperFormat): void` [L1031](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L1031)
  - `printAllSheetsMultiPage(): Promise<void>` [L1042](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L1042)
  - `batchExportAllViews(): Promise<number>` [L1061](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L1061)

**Typy i Modele Danych:**
- `interface SheetScreenLayout` { sheetPixelX, sheetPixelY, sheetPixelW, sheetPixelH, scale, framePixelX, framePixelY, framePixelW, +9 more } [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-engine.ts#L46)

### [E1_export/export-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts)

**Typy i Modele Danych:**
- `interface PaperDimensions` { width, height, label, description } [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L16)
- `interface TitleBlockInfo` { projectName, furnitureName, author, date, scale, sheetNumber, drawingNumber, remarks } [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L45)
- `interface SavedExportView` { id, name, createdAt, paperFormat, projectionType, renderStyle, showGrid, cameraAlpha, +12 more } [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L56)
- `interface BOMRow` { name, material, length, width, thickness, qty, edge_config } [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L80)
- `interface ExportConfig` { paperFormat, projectionType, showBounds, includeBOM, includePMI, notes, titleBlock } [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L90)
- `type PaperFormat` = `| 'A4_LANDSCAPE' | 'A4_PORTRAIT' | 'A3_LANDSCAPE' | 'A3_P...` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L8)
- `type ProjectionType` = `'ORTHO' | 'PERSP'` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L42)
- `type ExportRenderStyle` = `'technical' | 'shaded' | 'mono' | 'wireframe'` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L43)

**Stałe i Słowniki:**
- `const PAPER_FORMATS: Record<PaperFormat, PaperDimensions>` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L23)
- `const MARGIN_LEFT` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L33)
- `const MARGIN_RIGHT` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L34)
- `const MARGIN_TOP` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L35)
- `const MARGIN_BOTTOM` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L36)
- `const TITLE_BLOCK_WIDTH` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L39)
- `const TITLE_BLOCK_HEIGHT` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-types.ts#L40)

### [E1_export/export-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-ui.tsx)

**Funkcje:**
- `export` `ExportUI(): any` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-ui.tsx#L11)

### [E1_export/export-view-state.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts)

**Funkcje:**
- `shouldCapturePose(node: CADNode): boolean` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L24)
- `shouldCaptureVisibility(node: CADNode): boolean` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L33)
- `readNodeVisible(node: CADNode): boolean` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L41)
- `writeNodeVisible(node: CADNode, visible: boolean): void` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L47)
- `featureMatchesHardware(feat: any, hwNodeId: string): boolean` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L56)
- `syncHardwareFeatureVisibility(document: ProjectDocument, hwNodeId: string, visible: boolean): void` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L84)
- `poseOf(node: CADNode): ExportNodePose` [L101](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L101)
- `export` `collectExportNodePoses(document: ProjectDocument | null | undefined): ExportNodePose[]` [L111](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L111)
- `export` `cloneExportNodePoses(poses: ExportNodePose[] | undefined | null): ExportNodePose[]` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L122)
- `export` `restoreExportNodePoses(2 params): string[]` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L132)
- `export` `collectExportNodeVisibility(document: ProjectDocument | null | undefined): ExportNodeVisibility[]` [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L158)
- `export` `cloneExportNodeVisibility(items: ExportNodeVisibility[] | undefined | null): ExportNodeVisibility[]` [L173](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L173)
- `export` `restoreExportNodeVisibility(2 params): string[]` [L183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L183)
- `export` `notifyExportSceneRebuild(message): void` [L206](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L206)

**Typy i Modele Danych:**
- `interface ExportNodePose` { nodeId, translationNm, rotationQuat, scale } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L12)
- `interface ExportNodeVisibility` { nodeId, visible } [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/E1_export/export-view-state.ts#L19)

## <a id="n1_nesting"></a>N1 Nesting (Układ Rozkroju Płyt, Algorytmy Pakowania)

### [n1_nesting/core/bin-packer.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/bin-packer.ts)

**Klasy:**
- `class BinPacker` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/bin-packer.ts#L14)
  - `constructor(width: number, height: number): void` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/bin-packer.ts#L19)
  - `insert(w: number, h: number, canRotate: boolean): InsertResult` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/bin-packer.ts#L31)

**Typy i Modele Danych:**
- `interface InsertResult` { node, rotated } [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/bin-packer.ts#L9)

### [n1_nesting/core/cut-plan.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/cut-plan.ts)

**Funkcje:**
- `export` `partInstanceKey(p: PackedPart): string` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/cut-plan.ts#L37)
- `r1(v: number): number` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/cut-plan.ts#L56)
- `export` `buildBoardCutPlan(board: PackedBoard, onlyPartKey?: string): BoardCutPlan | null` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/cut-plan.ts#L64)
- `export` `releasedPartIds(plan: BoardCutPlan, stepCount: number): Set<string>` [L222](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/cut-plan.ts#L222)

**Typy i Modele Danych:**
- `interface CutStep` { order, kind, dir, x1, y1, x2, y2, label, +3 more } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/cut-plan.ts#L22)
- `interface BoardCutPlan` { boardIndex, axis, usableX, usableY, usableW, usableH, bands, totalCuts, +2 more } [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/cut-plan.ts#L41)
- `type CutKind` = `'trim' | 'rip' | 'cross'` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/cut-plan.ts#L18)
- `type CutAxis` = `'horizontal' | 'vertical'` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/cut-plan.ts#L19)
- `type ShelfAxis` = `'horizontal' | 'vertical'` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/cut-plan.ts#L20)

### [n1_nesting/core/guillotine-packer.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts)

**Funkcje:**
- `shuffle(arr: T[]): void` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L64)
- `orient(5 params): Oriented | null` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L75)
- `sortRects(rects: GuillotineRect[], axis: ShelfAxis, order: ShelfOrder): GuillotineRect[]` [L102](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L102)
- `export` `packGuillotine(6 params): GuillotinePlacement[][]` [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L129)
- `toPlacement(p: RawPlacement, axis: ShelfAxis): GuillotinePlacement` [L212](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L212)

**Typy i Modele Danych:**
- `interface GuillotineRect` { id, partId, originalName, sourceNodeId, containerId, blokId, furnitureName, material, +8 more } [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L13)
- `interface GuillotinePlacement` { rect, x_nm, y_nm, w_nm, h_nm, rotated, band } [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L38)
- `interface Oriented` { along, stack, rotated } [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L48)
- `interface RawPlacement` { rect, posAlong, posStack, alongSize, stackSize, rotated, band } [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L54)
- `type ShelfAxis` = `'horizontal' | 'vertical'` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L33)
- `type ShelfOrder` = `'stack' | 'area' | 'along' | 'longest' | 'random'` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/guillotine-packer.ts#L36)

### [n1_nesting/core/nesting-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts)

**Funkcje:**
- `export` `getDefaultKerf(machineType: MachineType): number` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L52)
- `export` `getDefaultKerfNm(machineType: MachineType): number` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L59)
- `export` `getMaterialInfo(part: { material?: string; thickness?: number }): any` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L66)
- `export` `resolveMaterialName(rawMaterial?: string, thickness?: number): string` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L73)
- `export` `getMaterialKey(part: { material?: string; thickness?: number }): string` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L82)
- `export` `getMaterialLabel(part: { material?: string; thickness?: number }): string` [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L99)
- `export` `runNesting(3 params): Promise<NestingResult>` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L107)
- `optimizePacking(10 params): Promise<PackedBoard[]>` [L357](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L357)
- `optimizeSawPacking(10 params): Promise<PackedBoard[]>` [L459](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L459)
- `buildSawBoards(10 params): PackedBoard[]` [L536](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L536)
- `packRectangles(9 params): PackedBoard[]` [L630](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L630)
- `shuffleArray(array: T[]): void` [L736](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L736)

**Typy i Modele Danych:**
- `interface InternalRect` { id, partId, originalName, sourceNodeId, containerId, blokId, furnitureName, material, +12 more } [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-engine.ts#L26)

### [n1_nesting/core/nesting-snap.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-snap.ts)

**Funkcje:**
- `export` `getPartAABB(p: PackedPart, overrideX?: number, overrideY?: number): PartAABB` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-snap.ts#L27)
- `export` `getPartAABBNm(p: PackedPart, overrideXNm?: number, overrideYNm?: number): PartAABB` [L91](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-snap.ts#L91)
- `export` `checkPartsOverlap(10 params): boolean` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-snap.ts#L157)
- `export` `checkPartsOverlapNm(10 params): boolean` [L175](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-snap.ts#L175)
- `export` `isPositionColliding(9 params): boolean` [L193](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-snap.ts#L193)
- `findValidX(9 params): number` [L230](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-snap.ts#L230)
- `findValidY(9 params): number` [L295](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-snap.ts#L295)
- `export` `resolveClampedMovePosition(10 params): { x: number; y: number }` [L363](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-snap.ts#L363)

**Typy i Modele Danych:**
- `interface PartAABB` { minX, minY, maxX, maxY, w, h } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-snap.ts#L14)

### [n1_nesting/core/nesting-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts)

**Funkcje:**
- `export` `getPartLabelLines(part: { name: string; furnitureName?: string }): { project: string; panel: string }` [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L90)

**Typy i Modele Danych:**
- `interface ContainerScopeInfo` { id, name, type, partsCount } [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L10)
- `interface NestingPart` { id, name, width, height, thickness, width_nm, height_nm, thickness_nm, +10 more } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L17)
- `interface SheetConfig` { width, height, thickness, width_nm, height_nm, thickness_nm, kerf, trimMargin, +4 more } [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L38)
- `interface Rect2D` { x, y, w, h } [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L53)
- `interface PackedPart` { partId, instanceId, name, x, y, w, h, realW, +17 more } [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L60)
- `interface PackedBoard` { boardIndex, boardIndexInGroup, material, thickness, thickness_nm, materialLabel, machineType, width, +11 more } [L110](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L110)
- `interface NestingOptions` { mode, iterations, allowRotation, stopOnFirstFit, selectedMaterial, machineType, scope, targetContainerId, +1 more } [L134](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L134)
- `interface MaterialGroupSummary` { materialKey, materialName, thickness, materialLabel, partsCount, boardsCount, totalUsedArea, totalBoardArea, +3 more } [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L146)
- `interface NestingResult` { boards, materialGroups, unplacedParts, machineType, scope, totalPartsPlaced, totalPartsCount, totalBoardsCount, +5 more } [L160](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L160)
- `type GrainDirection` = `'horizontal' | 'vertical' | 'none'` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L5)
- `type RotationRule` = `'any' | 'none' | 'prefer_length'` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L6)
- `type MachineType` = `'saw' | 'cnc'` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L7)
- `type NestingScope` = `'PROJECT' | 'CONTAINER' | 'BLOKI'` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L8)
- `type NestingMode` = `'fast' | 'pro'` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/core/nesting-types.ts#L132)

### [n1_nesting/export/nesting-exporter.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/export/nesting-exporter.ts)

**Klasy:**
- `class NestingExporter` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/export/nesting-exporter.ts#L10)
  - `generatePrintableHtml(result: NestingResult, config: SheetConfig, autoPrint): string` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/export/nesting-exporter.ts#L14)
  - `generateBoardSvgString(board: PackedBoard, config: SheetConfig): string` [L230](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/export/nesting-exporter.ts#L230)
  - `downloadHtmlReport(result: NestingResult, config: SheetConfig, filename): void` [L299](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/export/nesting-exporter.ts#L299)
  - `printHtmlReport(result: NestingResult, config: SheetConfig): void` [L308](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/export/nesting-exporter.ts#L308)
  - `printBoardSvg(board: PackedBoard, config: SheetConfig): void` [L316](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/export/nesting-exporter.ts#L316)
  - `downloadBoardSvg(board: PackedBoard, config: SheetConfig, filename?: string): void` [L325](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/export/nesting-exporter.ts#L325)

### [n1_nesting/ui/NestingPanel.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingPanel.tsx)

**Funkcje:**
- `checkPartCollision(5 params): boolean` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingPanel.tsx#L50)
- `nestingPartKey(p: NestingPart): string` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingPanel.tsx#L55)
- `preserveFrozen(prev: NestingPart[], next: NestingPart[]): NestingPart[]` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingPanel.tsx#L60)
- `export` `NestingPanel(1 params): any` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingPanel.tsx#L73)
- `extractPartsFrom3DScene(): { parts: NestingPart[]; containers: ContainerSc...` [L1381](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingPanel.tsx#L1381)

**Typy i Modele Danych:**
- `interface NestingPanelProps` { initialParts, initialSelectedMaterial, scopeLabel, isStandaloneWindow } [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingPanel.tsx#L65)

### [n1_nesting/ui/NestingSidebarTab.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingSidebarTab.tsx)

**Funkcje:**
- `export` `NestingSidebarTab({ projectModel }): any` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingSidebarTab.tsx#L32)

**Typy i Modele Danych:**
- `interface NestingSidebarTabProps` { projectModel } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingSidebarTab.tsx#L22)
- `interface SelectedTarget` { type, id, name } [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingSidebarTab.tsx#L26)

### [n1_nesting/ui/NestingVisualizer.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingVisualizer.tsx)

**Funkcje:**
- `checkPartCollision(5 params): boolean` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingVisualizer.tsx#L46)
- `export` `NestingVisualizer({
    result,
    config,
    selectedPartId,
    onSelectPart
}): any` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingVisualizer.tsx#L50)

**Typy i Modele Danych:**
- `interface NestingVisualizerProps` { result, config, selectedPartId, onSelectPart } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingVisualizer.tsx#L15)
- `interface BoardZoom` { scale, originX, originY } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingVisualizer.tsx#L22)
- `interface DragState` { boardIndex, partId, startX, startY, initialPartX, initialPartY, svgWidth, svgHeight, +2 more } [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/n1_nesting/ui/NestingVisualizer.tsx#L28)

## <a id="o1_operacji"></a>O1 Operacje (Przetłoczenia, Wycięcia Przelotowe, Rewizje, Ramki)

### [o1_operacji/operacje-apply.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts)

**Funkcje:**
- `findPanelView(panel: PanelModel): any | null` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L27)
- `rebuildPanelMesh(panel: PanelModel): void` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L37)
- `notifyPanelGeometry(panel?: PanelModel | null): void` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L49)
- `panelFromDocItem(item: any): PanelModel | null` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L64)
- `export` `collectPanelsWithLibraryOperation(doc: any, libraryId: string): PanelModel[]` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L70)
- `export` `isLibraryOperation(f: any): boolean` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L83)
- `export` `isEngineGroove(f: any): boolean` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L88)
- `export` `featureOperationLabel(f: any): string` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L93)
- `export` `featureOperationDetails(f: any): string` [L101](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L101)
- `export` `mergeEngineAndLibraryFeatures(2 params): any[]` [L126](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L126)
- `writeFeatures(panel: PanelModel, features: any[]): void` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L132)
- `export` `refreshLibraryOperation(panel: PanelModel, feature: any): any` [L140](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L140)
- `export` `refreshLibraryOperationsOnPanel(panel: PanelModel | null | undefined): boolean` [L149](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L149)
- `export` `applyAllLibraryOperations(doc: any): void` [L170](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L170)
- `export` `resolveOperationFace(3 params): FaceName` [L183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L183)
- `export` `syncGlassPanelForCutout(panel: PanelModel, feature: OperationFeature | null, doc?: any): any | null` [L206](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L206)
- `export` `applyLibraryOperation(4 params): OperationFeature | null` [L319](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L319)
- `export` `updateLibraryOperationsById(libraryId: string, overrides: OperationApplyOverrides): number` [L348](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L348)
- `export` `updateLibraryOperationParams(4 params): OperationFeature | null` [L364](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L364)
- `export` `applyLibraryOperationFromPick(3 params): OperationFeature | null` [L373](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L373)
- `export` `bindOperationEdge(5 params): OperationFeature | null` [L392](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-apply.ts#L392)

### [o1_operacji/operacje-builder.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts)

**Funkcje:**
- `export` `uniformInsetsMm(frameMm: number): OperationInsetsMm` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts#L39)
- `defaultEdge(recipe: OperationRecipe): OperationEdgeRefs` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts#L44)
- `export` `recipeWithOverrides(3 params): OperationRecipe` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts#L53)
- `export` `faceHintToFace(hint: OperationRecipe['face_hint']): FaceName` [L144](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts#L144)
- `export` `operationFeatureId(libraryId: string, face: FaceName): string` [L149](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts#L149)
- `faceSizeMm(panel: PanelModel, face: FaceName): { width: number; height: number }` [L153](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts#L153)
- `export` `pocketRectMm(faceW: number, faceH: number, insets: OperationInsetsMm): { u: number; v: number; width: number; length: ...` [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts#L158)
- `export` `resolveOperationDepthMm(recipe: OperationRecipe, panel: PanelModel): number` [L171](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts#L171)
- `export` `buildOperationFeature(4 params): OperationFeature | null` [L180](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts#L180)

**Typy i Modele Danych:**
- `interface OperationApplyOverrides` { frameMm, frameWMm, frameHMm, insetLMm, insetRMm, insetTMm, insetBMm, depthMm, +9 more } [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-builder.ts#L19)

### [o1_operacji/operacje-catalog.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts)

**Funkcje:**
- `parseKind(raw: string | undefined): OperationKind` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts#L38)
- `parseFill(raw: string | undefined): OperationFill` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts#L42)
- `parseHint(raw: string | undefined): OperationFaceHint` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts#L46)
- `parsePlacement(raw: string | undefined): OperationPlacement` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts#L52)
- `parseRecipe(id: string, raw: RawItem): OperationRecipe` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts#L56)
- `cloneRecipe(r: OperationRecipe): OperationRecipe` [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts#L98)
- `export` `listOperations(): OperationRecipe[]` [L107](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts#L107)
- `export` `getOperation(id: string | null | undefined): OperationRecipe | null` [L111](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts#L111)

**Typy i Modele Danych:**
- `interface RawFrom` { u, v, du, dv } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts#L17)
- `interface RawItem` { id, name, kind, face_hint, placement, insets, size, from, +3 more } [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-catalog.ts#L24)

### [o1_operacji/operacje-controller.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-controller.ts)

**Funkcje:**
- `export` `attachOperacjeExtension(document: ProjectDocument): () => void` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-controller.ts#L9)

### [o1_operacji/operacje-placement.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts)

**Funkcje:**
- `export` `tryNormalizeFace(face: string | null | undefined): FaceName | null` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L14)
- `export` `isUEdge(face: string | null | undefined): face is EdgeU` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L23)
- `export` `isVEdge(face: string | null | undefined): face is EdgeV` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L28)
- `export` `parseSideToken(raw: string | undefined, axis: 'u' | 'v'): EdgeU | EdgeV` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L33)
- `export` `edgeShortLabel(face: string): string` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L43)
- `export` `edgeKeyToPanelFace(edgeKey: string | null | undefined, slot?: 'u' | 'v' | 'auto'): FaceName | null` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L53)
- `export` `pocketFromEdgeDims(4 params): { u: number; v: number; width: number; length: ...` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L84)
- `export` `distanceToUEdge(opFace: string, uEdge: EdgeU, u: number, width: number, faceW: number): number` [L123](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L123)
- `export` `distanceToVEdge(vEdge: EdgeV, v: number, length: number, faceH: number): number` [L138](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L138)
- `export` `rebindUEdge(4 params): { uEdge: EdgeU; uMm: number }` [L149](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L149)
- `export` `rebindVEdge(rect: { v: number; length: number }, faceH: number, next: EdgeV): { vEdge: EdgeV; vMm: number }` [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L158)
- `export` `uvOnUEdge(opFace: string, uEdge: EdgeU, faceW: number): number` [L166](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L166)
- `export` `uvOnVEdge(vEdge: EdgeV, faceH: number): number` [L172](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L172)
- `export` `dimHandleUv(7 params): { u: number; v: number }` [L176](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L176)
- `export` `snapDimHandleToEdge(7 params): { uEdge?: EdgeU; vEdge?: EdgeV; handleU: number...` [L196](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L196)
- `export` `dragHandleAlongAxis(7 params): { handleU: number; handleV: number }` [L223](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L223)
- `export` `magnetEdgeIfAtBound(6 params): { uEdge?: EdgeU; vEdge?: EdgeV } | null` [L248](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L248)
- `export` `isEdgeDimHandleMesh(mesh: any): boolean` [L266](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L266)

**Typy i Modele Danych:**
- `type EdgeU` = `'FACE_X_MINUS' | 'FACE_X_PLUS'` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L11)
- `type EdgeV` = `'FACE_Y_MINUS' | 'FACE_Y_PLUS'` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-placement.ts#L12)

### [o1_operacji/operacje-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts)

**Typy i Modele Danych:**
- `interface OperationInsetsM` { l, r, t, b } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L12)
- `interface OperationInsetsMm` { l, r, t, b } [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L19)
- `interface OperationEdgeRefs` { uEdge, vEdge, uMm, vMm } [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L28)
- `interface OperationEdgePlacement` *extends OperationEdgeRefs* { widthMm, heightMm } [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L35)
- `interface OperationRecipe` { id, name, kind, face_hint, placement, insets, sizeMm, edge, +3 more } [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L40)
- `interface OperationFeatureParams` { u, v, width, length, depth, library_id, source, insets, +8 more } [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L54)
- `interface OperationFeature` { id, type, name, face, params } [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L73)
- `type OperationKind` = `'POCKET' | 'THROUGH'` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L8)
- `type OperationFill` = `'none' | 'glass'` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L9)
- `type OperationFaceHint` = `'OUTER' | 'INNER' | 'ANY'` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L10)
- `type OperationPlacement` = `'frame' | 'edge_dims'` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L26)

**Stałe i Słowniki:**
- `const OPERACJE_DRAG_MIME` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L81)
- `const OPERACJE_PANEL_TITLE` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L82)
- `const LIBRARY_SOURCE` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L83)
- `const CAD_EDIT_LIBRARY_OPERATION` [L85](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-types.ts#L85)

### [o1_operacji/operacje-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-ui.tsx)

**Funkcje:**
- `resolveActivePanel(): any` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-ui.tsx#L21)
- `resolveTargetPanel(libraryId: string, editPanelId?: string | null): any` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-ui.tsx#L27)
- `instanceOnPanel(4 params): any` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-ui.tsx#L39)
- `firstInstance(libraryId: string): any` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-ui.tsx#L51)
- `renderOperationIcon(id: string): any` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-ui.tsx#L71)
- `export` `OperacjeUI(): any` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/o1_operacji/operacje-ui.tsx#L92)

## <a id="r1_reports"></a>R1 Raporty (Zestawienia Materiałowe, Formatki, Etykiety)

### [R1_reports/global-reports-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts)

**Klasy:**
- `class GlobalReportsEngineWeb` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L51)
  - `constructor(): void` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L55)
  - `resolveMaterialName(materialId: string): string` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L82)
  - `getMaterialPricePerM2(materialId: string): number | null` [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L94)
  - `getEdgeBandPricePerM(edgeTypeId: string): number | null` [L110](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L110)
  - `calculatePartPricing(panel: CuttingPanelContract): PanelPricingResult` [L156](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L156)
  - `calculateAccessoryPricing(acc: AccessoryItem): AccessoryPricingResult` [L221](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L221)
  - `calculateGlobalSummary(panels: PanelPricingResult[], accessories: AccessoryPricingResult[]): GlobalProjectSummary` [L276](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L276)

**Typy i Modele Danych:**
- `interface PanelPricingResult` { part_id, role, material_id, material_name, thickness_mm, length_mm, width_mm, area_m2, +9 more } [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L6)
- `interface AccessoryPricingResult` { id, name, role, library_id, qty, unit_price_pln, total_price_pln, furniture_name } [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L26)
- `interface GlobalProjectSummary` { Liczba_elementow, Calkowite_powierzchnia_m2, Calkowite_cena_plyt_PLN, Calkowite_dlugosc_obrzezy_mb, Calkowite_cena_obrzezy_PLN, SUMA_PLYTY_PLN, Calkowite_liczba_akcesorii_szt, Calkowite_cena_akcesorii_PLN, +3 more } [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/global-reports-engine.ts#L37)

### [R1_reports/html-reports-generator.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts)

**Klasy:**
- `class HtmlReportsGeneratorWeb` [L4](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts#L4)
  - `constructor(engine?: GlobalReportsEngineWeb): void` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts#L7)
  - `getEdgeCode(edgeConfig: any, direction: 'length' | 'width', is_x_longer): string` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts#L14)
  - `formatThickness(th: number): string` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts#L47)
  - `generateMaterialCuttingTabsHtml(panels: CuttingPanelContract[], prefix): { buttonsHtml: string; contentHtml: string }` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts#L54)
  - `generateFullProjectReport(4 params): string` [L188](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts#L188)
  - `generateOrderReportHtml(moduleName: string, panels: CuttingPanelContract[]): string` [L629](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts#L629)
  - `generateCsv(panels: CuttingPanelContract[]): string` [L801](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts#L801)
  - `downloadFile(content: string, filename: string, mimeType): void` [L833](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts#L833)
  - `openHtmlInNewTab(htmlContent: string): void` [L848](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/html-reports-generator.ts#L848)

### [R1_reports/price-store.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts)

**Klasy:**
- `class PriceStore` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L38)
  - `defaults(): PriceDatabase` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L61)
  - `subscribe(listener: () => void): PricesUnsubscribe` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L70)
  - `setPrices(db: unknown): void` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L78)
  - `applyPrices(db: unknown, persist): void` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L86)
  - `reset(): void` [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L94)

**Funkcje:**
- `clone(value: T): T` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L20)
- `readOverride(): PriceDatabase | null` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L24)

**Typy i Modele Danych:**
- `type PricesUnsubscribe` = `() => void` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L36)

**Stałe i Słowniki:**
- `const PRICES_OVERRIDE_KEY` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L16)
- `const PRICES_CHANNEL_NAME` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L17)
- `const PRICES_UPDATED_MESSAGE` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/price-store.ts#L18)

### [R1_reports/prices-api-client.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-api-client.ts)

**Funkcje:**
- `export` `fetchPricesFromServer(): Promise<PriceDatabase | null>` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-api-client.ts#L15)
- `export` `savePricesToServer(prices: PriceDatabase): Promise<PricesApiResult>` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-api-client.ts#L28)

**Typy i Modele Danych:**
- `interface PricesApiResult` { ok, error } [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-api-client.ts#L10)

### [R1_reports/prices-csv.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-csv.ts)

**Funkcje:**
- `csvEscape(value: string): string` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-csv.ts#L27)
- `export` `toCsv(db: PriceDatabase): string` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-csv.ts#L35)
- `detectDelimiter(text: string): string` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-csv.ts#L59)
- `parseCsv(text: string, delimiter: string): string[][]` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-csv.ts#L66)
- `export` `fromCsv(text: string): PriceDatabase` [L108](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-csv.ts#L108)

### [R1_reports/prices-filter.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-filter.ts)

**Funkcje:**
- `entryString(value: PriceValue, field: EntryField): string` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-filter.ts#L23)
- `export` `collectBrands(entries: [string, PriceValue][]): string[]` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-filter.ts#L29)
- `export` `collectKategorie(entries: [string, PriceValue][]): string[]` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-filter.ts#L38)
- `export` `collectUnits(entries: [string, PriceValue][]): string[]` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-filter.ts#L47)
- `export` `filterPriceEntries(entries: [string, PriceValue][], filter: PriceFilter): [string, PriceValue][]` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-filter.ts#L56)

**Typy i Modele Danych:**
- `interface PriceFilter` { query, brand, unit, kategoria } [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-filter.ts#L10)
- `type PriceValue` = `number | PriceEntry` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-filter.ts#L8)
- `type EntryField` = `'name' | 'opis' | 'unit' | 'brand' | 'kategoria' | 'indeks'` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-filter.ts#L21)

### [R1_reports/prices-validate.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-validate.ts)

**Funkcje:**
- `export` `validatePriceDatabase(db: any): asserts db is PriceDatabase` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-validate.ts#L31)
- `export` `serializePriceDatabase(db: any): string` [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-validate.ts#L81)

**Typy i Modele Danych:**
- `interface PriceEntry` { price, unit, name, opis, brand, kategoria, indeks } [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-validate.ts#L11)
- `type PriceSection` = `(typeof PRICE_SECTIONS)[number]` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-validate.ts#L9)
- `type PriceDatabase` = `Partial<Record<PriceSection, Record<string, number | Pric...` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-validate.ts#L24)

**Stałe i Słowniki:**
- `const PRICE_SECTIONS` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/prices-validate.ts#L7)

### [R1_reports/report-data-normalizer.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts)

**Klasy:**
- `class ReportDataNormalizer` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L68)
  - `nmValToMm(val: any, defaultVal): number` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L73)
  - `normalizeEdgeConfig(edgeBanding: any): EdgeBandingConfig` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L84)
  - `buildContractFromPanel(5 params): CuttingPanelContract | null` [L124](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L124)
  - `extractProjectData(documentTarget: any): { panels: CuttingPanelContract[]; accessories: ...` [L196](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L196)
  - `resolveAccessoryDisplayName(item: AccessoryItem): string | null` [L511](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L511)
  - `aggregateAccessories(items: AccessoryItem[]): AccessoryItem[]` [L532](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L532)
  - `aggregateContractRows(rows: CuttingPanelContract[]): Record<string, CuttingPanelContract>` [L575](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L575)

**Funkcje:**
- `defaultProjectName(): string` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L15)

**Typy i Modele Danych:**
- `interface EdgeBandInfo` { active, type_id } [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L19)
- `interface EdgeBandingConfig` { '+X', '-X', '+Y', '-Y' } [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L24)
- `interface CuttingPanelContract` { part_id, node_id, container_id, blok_id, role, material, thickness_mm, length_mm, +5 more } [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L32)
- `interface ContainerScopeItem` { id, name, type, partsCount } [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L48)
- `interface AccessoryItem` { id, name, role, library_id, qty, furniture_name, container_id, blok_id, +2 more } [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/report-data-normalizer.ts#L55)

### [R1_reports/reports-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/reports-ui.tsx)

**Funkcje:**
- `export` `ReportsUI({ document: propDoc, initialPayload, isStandalone = false }): any` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/reports-ui.tsx#L31)

**Typy i Modele Danych:**
- `interface ReportsUIProps` { document, initialPayload, isStandalone } [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/reports-ui.tsx#L9)
- `interface SelectedTarget` { type, id, name } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R1_reports/reports-ui.tsx#L22)

## <a id="r2_rys"></a>R2 Rys (Rysunki Warsztatowe, Rzuty, Przekroje)

### [R2_rys/drawing-project-extractor.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts)

**Klasy:**
- `class DrawingProjectExtractor` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L69)
  - `syncLiveSceneTree(): ProjectDrawingTree` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L82)
  - `extractPMIDimensions(): DrawingPMIDimension[]` [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L104)
  - `extractProjectTree(): ProjectDrawingTree` [L154](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L154)
  - `generateVectorSvgForNode(4 params): { svg: string; widthMm: number; heightMm: number }` [L621](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L621)

**Funkcje:**
- `mmVal(val: any, defaultVal: number): number` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L33)
- `modelNmToMm(val: any, defaultVal: number): number` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L44)
- `mapGrooveFeature(f: any, fallbackHeight: number): GrooveFeature2D` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L51)

**Stałe i Słowniki:**
- `const LIVE_PROJECT_STORAGE_KEY` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L21)
- `const LIVE_PMI_STORAGE_KEY` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L27)
- `const SYNC_CHANNEL_NAME` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-project-extractor.ts#L28)

### [R2_rys/drawing-sheet.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts)

**Klasy:**
- `class DrawingSheet` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L73)
  - `constructor(paperFormat: PaperFormat): void` [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L90)
  - `setProjectInfo(info: Partial<TitleBlockInfo>): void` [L114](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L114)
  - `setViewportImage(base64Png: string | null): void` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L118)
  - `setVectorDrawing(svgCode: string | null): void` [L123](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L123)
  - `addSvgOverlay(svgCode: string): void` [L128](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L128)
  - `clearSvgOverlays(): void` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L132)
  - `setBomData(rows: BOMRow[]): void` [L136](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L136)
  - `getAvailableDrawingArea(): { x: number; y: number; width: number; height: ...` [L140](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L140)
  - `generateSvg(): string` [L150](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L150)
  - `toRasterDataUrl(format: 'image/jpeg' | 'image/png', quality, scale): Promise<string>` [L400](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L400)
  - `downloadJpg(filename?: string, quality): Promise<void>` [L469](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L469)
  - `downloadPng(filename?: string): Promise<void>` [L480](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L480)
  - `copySvgToClipboard(): Promise<void>` [L491](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L491)
  - `printSvg(): void` [L496](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L496)
  - `toSvgString(): string` [L539](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L539)
  - `downloadSvg(filename?: string): void` [L543](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L543)
  - `downloadRaster(formatOrFilename: string, filenameOrFormat?: string, quality): Promise<void>` [L557](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L557)
  - `printOrSavePdf(): void` [L578](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L578)
  - `printMultiSheet(sheets: DrawingSheet[]): void` [L582](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L582)

**Funkcje:**
- `v(val: number): string` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L23)
- `svgRect(8 params): string` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L27)
- `svgLine(7 params): string` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L43)
- `svgText(8 params): string` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-sheet.ts#L56)

### [R2_rys/drawing-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts)

**Typy i Modele Danych:**
- `interface HoleFeature2D` { id, x, y, diameter, depth, face, frozen } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L14)
- `interface GrooveFeature2D` { id, x, y, width, height, depth, name, source, +4 more } [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L24)
- `interface CADTreeNode` { id, name, type, icon, width, height, depth, thickness, +14 more } [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L42)
- `interface PartDrawingGeometry` { id, name, role, material, width, height, thickness, colorHex, +4 more } [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L68)
- `interface ContainerDrawingGeometry` { id, name, width, height, depth, parts } [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L83)
- `interface ProjectDrawingTree` { projectName, rootNode, containers, standaloneParts } [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L92)
- `interface DrawingPMIDimension` { id, text, distanceMM, x1, y1, x2, y2, z1, +9 more } [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L99)
- `interface DrawingView2D` { id, title, scope, targetEntityId, targetEntityName, targetNode, projection, scale, +9 more } [L119](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L119)
- `interface DrawingDimension2D` { id, viewId, x1, y1, x2, y2, valueMm, text, +2 more } [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L139)
- `interface DrawingSheetModel` { id, name, paperFormat, titleBlock, views, dimensions, showBOM } [L154](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L154)
- `type DrawingModelScope` = `'PROJECT' | 'CONTAINER' | 'SUBASSEMBLY' | 'PART'` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L10)
- `type ProjectionAngle` = `'FRONT' | 'TOP' | 'LEFT' | 'RIGHT' | 'BACK' | 'BOTTOM' | ...` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L11)
- `type DisplayStyle` = `'HIDDEN_REMOVED' | 'SHADED' | 'MONO'` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L12)
- `type CADNodeType` = `'PROJECT' | 'CONTAINER' | 'ASSEMBLY' | 'SUBASSEMBLY' | 'D...` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/drawing-types.ts#L40)

### [R2_rys/e3-3d-scene-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts)

**Klasy:**
- `class E3SceneEngine` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L26)
  - `subscribe(listener: () => void): () => void` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L58)
  - `init(canvas: HTMLCanvasElement): void` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L70)
  - `setPaperFormat(format: E3PaperFormat): void` [L151](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L151)
  - `setActiveModel(id: string | null): void` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L157)
  - `addModel3DFromItem(item: E3LibraryItem, angle: E3ProjectionAngle): E3ModelInstance` [L178](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L178)
  - `rotateModelToAngle(modelId: string, angle: E3ProjectionAngle): void` [L318](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L318)
  - `rotateActiveModel(angle: E3ProjectionAngle): void` [L352](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L352)
  - `removeModel(modelId: string): void` [L360](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L360)
  - `clearAllModels(): void` [L374](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L374)
  - `updatePassepartout(): void` [L387](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L387)
  - `downloadJpgScreenshot(): Promise<void>` [L486](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L486)
  - `printSheet(): Promise<void>` [L514](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L514)

**Typy i Modele Danych:**
- `interface E3ModelInstance` { id, name, type, transformNode, rootMesh, width, height, depth, +2 more } [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-3d-scene-engine.ts#L13)

### [R2_rys/e3-drawing-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts)

**Klasy:**
- `class E3DrawingEngine` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L29)
  - `subscribe(listener: () => void): () => void` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L56)
  - `setPaperFormat(format: E3PaperFormat): void` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L65)
  - `setTitleBlock(info: Partial<E3TitleBlock>): void` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L70)
  - `setActiveViewId(id: string | null): void` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L75)
  - `addViewFromLibraryItem(item: E3LibraryItem, angle: E3ProjectionAngle): E3PlacedView` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L83)
  - `updateViewAngle(viewId: string, angle: E3ProjectionAngle): void` [L125](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L125)
  - `updateViewPosition(viewId: string, sheetX: number, sheetY: number): void` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L133)
  - `updateViewScale(viewId: string, scale: number): void` [L142](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L142)
  - `removeView(viewId: string): void` [L150](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L150)
  - `clearAllViews(): void` [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L158)
  - `generateSvg(): string` [L166](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L166)
  - `printSheet(): void` [L369](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L369)
  - `downloadJpg(filename?: string): Promise<void>` [L414](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L414)
  - `downloadSvg(filename?: string): void` [L456](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L456)

**Funkcje:**
- `v(n: number): string` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-drawing-engine.ts#L25)

### [R2_rys/e3-geometry-snapshot.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts)

**Funkcje:**
- `cadMatrixToBabylonPose(localCad: Mat4): { pos: [number, number, number]; rotq: [number,...` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L40)
- `matrixFromSerializedNode(json: any): Mat4` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L52)
- `dimsFromDomain(domain: any, isPanel: boolean): { width: number; height: number; depth: number;...` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L63)
- `collectCadParts(node: CADNode, acc: CADNode[]): void` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L71)
- `snapshotFromCadNode(root: CADNode): E3GeometrySnapshot` [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L79)
- `findSerializedNode(json: any, id: string): any | null` [L119](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L119)
- `collectSerializedParts(json: any, acc: any[]): void` [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L129)
- `worldMatrixOfSerialized(json: any, ancestors: any[]): Mat4` [L138](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L138)
- `snapshotFromSerialized(rootJson: any): E3GeometrySnapshot` [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L146)
- `export` `extractAllGeometrySnapshots(): Record<string, E3GeometrySnapshot>` [L200](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L200)
- `export` `syncGeometrySnapshots(): Record<string, E3GeometrySnapshot>` [L232](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L232)
- `export` `loadGeometrySnapshots(): Record<string, E3GeometrySnapshot>` [L240](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L240)
- `export` `resolveGeometrySnapshot(nodeId: string): E3GeometrySnapshot | null` [L250](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L250)

**Typy i Modele Danych:**
- `interface E3PartPose` { id, name, role, width, height, thickness, pos, rotq } [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L19)
- `interface E3GeometrySnapshot` { id, name, type, width, height, depth, parts } [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L30)

**Stałe i Słowniki:**
- `const E3_GEOMETRY_STORAGE_KEY` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-geometry-snapshot.ts#L16)

### [R2_rys/e3-library-extractor.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-extractor.ts)

**Klasy:**
- `class E3LibraryExtractor` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-extractor.ts#L25)
  - `syncLibrary(): E3LibraryItem[]` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-extractor.ts#L35)
  - `loadLibrary(): E3LibraryItem[]` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-extractor.ts#L57)
  - `extractItems(): E3LibraryItem[]` [L110](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-extractor.ts#L110)

**Funkcje:**
- `export` `modelNmToMm(val: any, defaultVal: number): number` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-extractor.ts#L18)

**Stałe i Słowniki:**
- `const E3_LIBRARY_STORAGE_KEY` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-extractor.ts#L14)
- `const E3_SYNC_CHANNEL_NAME` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-extractor.ts#L15)

### [R2_rys/e3-library-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-types.ts)

**Typy i Modele Danych:**
- `interface E3PaperDimensions` { width, height, label, description } [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-types.ts#L16)
- `interface E3LibraryItem` { id, uid, name, type, width, height, depth, materialName, +8 more } [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-types.ts#L32)
- `interface E3PlacedView` { id, sourceItemId, sourceItemName, itemType, dimX, dimY, dimZ, sheetX, +8 more } [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-types.ts#L51)
- `interface E3TitleBlock` { projectName, furnitureName, author, date, scale, sheetNumber, drawingNumber, remarks } [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-types.ts#L80)
- `interface E3SavedModelSnapshot` { id, item, name, type, sheetX, sheetY, frameWidth, frameHeight, +9 more } [L91](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-types.ts#L91)
- `interface E3SavedSheet` { id, name, createdAt, updatedAt, paperFormat, titleBlock, models, activeModelId } [L111](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-types.ts#L111)
- `type E3ProjectionAngle` = `'front' | 'top' | 'right' | 'left' | 'back' | 'bottom' | ...` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-types.ts#L6)
- `type E3PaperFormat` = `| 'A4_LANDSCAPE' | 'A4_PORTRAIT' | 'A3_LANDSCAPE' | 'A3_P...` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-types.ts#L8)

**Stałe i Słowniki:**
- `const E3_PAPER_FORMATS: Record<E3PaperFormat, E3PaperDimensions>` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-library-types.ts#L23)

### [R2_rys/e3-multi-viewport-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts)

**Klasy:**
- `class E3MultiViewportEngine` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L56)
  - `constructor(): void` [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L94)
  - `subscribe(cb: () => void): () => void` [L100](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L100)
  - `setActiveModel(modelId: string | null): void` [L115](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L115)
  - `setPaperFormat(format: E3PaperFormat): void` [L121](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L121)
  - `setTool(tool: 'select_move' | 'rotate'): void` [L127](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L127)
  - `updateModelPosition(modelId: string, x: number, y: number): void` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L132)
  - `resizeModelFrame(modelId: string, width: number, height: number, x?: number, y?: number): void` [L142](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L142)
  - `initSheetScene(canvas: HTMLCanvasElement): void` [L154](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L154)
  - `hitModelAtSheet(x: number, y: number): E3SheetModel | null` [L280](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L280)
  - `zoomModelToward(5 params): void` [L422](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L422)
  - `addModelFromItem(4 params): E3SheetModel` [L571](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L571)
  - `wrapFrameAroundModel(modelId: string, notify: boolean): void` [L644](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L644)
  - `fitModelToFrame(modelId: string): void` [L691](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L691)
  - `fitActiveViewToFrame(): void` [L695](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L695)
  - `setModelAngle(modelId: string, angle: E3ProjectionAngle, notify: boolean): void` [L973](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L973)
  - `setActiveModelAngle(angle: E3ProjectionAngle): void` [L1022](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1022)
  - `setActiveModelRenderMode(mode: E3RenderMode): void` [L1028](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1028)
  - `applyRenderMode(model: E3SheetModel): void` [L1037](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1037)
  - `setModelScale(modelId: string, scale: number): void` [L1072](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1072)
  - `toggleProjection(): void` [L1080](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1080)
  - `toggleActiveModelPMI(): void` [L1085](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1085)
  - `deleteActiveModel(): void` [L1093](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1093)
  - `removeModel(modelId: string): void` [L1099](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1099)
  - `clearAllModels(): void` [L1116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1116)
  - `printSheet(): void` [L1127](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1127)
  - `setSheetName(name: string): void` [L1131](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1131)
  - `saveCurrentSheet(name?: string): E3SavedSheet` [L1136](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1136)
  - `newSheet(): void` [L1165](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1165)
  - `loadSheet(sheetId: string): boolean` [L1183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1183)
  - `deleteSavedSheet(sheetId: string): void` [L1194](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L1194)

**Typy i Modele Danych:**
- `interface E3SheetModel` { id, item, name, type, sheetX, sheetY, frameWidth, frameHeight, +12 more } [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L33)
- `type E3RenderMode` = `'shaded' | 'edges' | 'wireframe' | 'xray'` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L22)
- `type E3ProjectionType` = `'perspective' | 'ortho'` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-multi-viewport-engine.ts#L23)

### [R2_rys/e3-sheets-snapshot.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-sheets-snapshot.ts)

**Funkcje:**
- `cloneSheets(sheets: E3SavedSheet[] | undefined | null): E3SavedSheet[]` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-sheets-snapshot.ts#L18)
- `readSnapshotJson(): any | null` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-sheets-snapshot.ts#L27)
- `export` `readE3MultiFromSnapshot(projectId?: string | null): E3MultiSheetsPayload | null` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-sheets-snapshot.ts#L37)
- `export` `writeE3MultiToSnapshot(3 params): void` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-sheets-snapshot.ts#L52)
- `export` `broadcastE3SheetsUpdated(sheets: E3SavedSheet[], currentSheetId: string | null): void` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-sheets-snapshot.ts#L80)

**Typy i Modele Danych:**
- `interface E3MultiSheetsPayload` { present, sheets, currentSheetId } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-sheets-snapshot.ts#L12)

**Stałe i Słowniki:**
- `const E3_SHEETS_UPDATED_MSG` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/e3-sheets-snapshot.ts#L10)

### [R2_rys/E3MultiStudio.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/E3MultiStudio.tsx)

**Funkcje:**
- `export` `E3MultiStudio(): any` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/E3MultiStudio.tsx#L18)

**Typy i Modele Danych:**
- `interface CubeFaceProps` { title, transform, onClick } [L973](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/E3MultiStudio.tsx#L973)

### [R2_rys/E3Studio.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/E3Studio.tsx)

**Funkcje:**
- `export` `E3Studio(): any` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/E3Studio.tsx#L13)

### [R2_rys/export-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts)

**Klasy:**
- `class ExportEngineV3` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L52)
  - `setPreviewSvg(svg: string | null): void` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L87)
  - `constructor(): void` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L92)
  - `subscribe(listener: () => void): () => void` [L105](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L105)
  - `setPaperFormat(format: PaperFormat): void` [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L116)
  - `setRenderStyle(style: ExportRenderStyle): void` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L122)
  - `setShowGrid(visible: boolean): void` [L128](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L128)
  - `setProjectionType(type: ProjectionType): void` [L137](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L137)
  - `setShowBounds(show: boolean): void` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L157)
  - `applyVisualSettings(): void` [L164](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L164)
  - `applyRenderStyleToScene(style: ExportRenderStyle): void` [L178](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L178)
  - `setIncludeBOM(include: boolean): void` [L237](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L237)
  - `setIncludePMI(include: boolean): void` [L242](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L242)
  - `setNotes(notes: string): void` [L247](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L247)
  - `setTitleBlock(info: Partial<TitleBlockInfo>): void` [L254](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L254)
  - `calculateSheetLayout(): SheetScreenLayout` [L262](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L262)
  - `updatePassepartout(): void` [L329](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L329)
  - `setCameraPreset(preset: 'front' | 'back' | 'top' | 'bottom' | 'left' | ...): void` [L442](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L442)
  - `zoomFit(): void` [L484](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L484)
  - `captureCroppedViewport(sheet: DrawingSheet): Promise<string>` [L491](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L491)
  - `projectPMIToSvg(sheet: DrawingSheet): void` [L593](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L593)
  - `extractBOMRows(): BOMRow[]` [L692](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L692)
  - `generateCurrentDrawingSheet(): Promise<DrawingSheet>` [L727](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L727)
  - `saveCurrentViewWithThumbnail(customName?: string, description?: string): Promise<SavedExportView>` [L749](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L749)
  - `saveCurrentView(customName?: string): SavedExportView` [L785](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L785)
  - `clearSavedViews(): void` [L811](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L811)
  - `replaceSavedViews(views: SavedExportView[]): void` [L817](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L817)
  - `duplicateSavedView(id: string): SavedExportView | null` [L829](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L829)
  - `applySavedView(view: SavedExportView): void` [L846](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L846)
  - `deleteSavedView(id: string): void` [L876](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L876)
  - `renameSavedView(id: string, newName: string): void` [L882](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L882)
  - `updateSavedViewFormat(id: string, newFormat: PaperFormat): void` [L891](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L891)
  - `printAllSheetsMultiPage(): Promise<void>` [L902](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L902)
  - `batchExportAllViews(): Promise<number>` [L921](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L921)

**Typy i Modele Danych:**
- `interface SheetScreenLayout` { sheetPixelX, sheetPixelY, sheetPixelW, sheetPixelH, scale, framePixelX, framePixelY, framePixelW, +9 more } [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-engine.ts#L32)

### [R2_rys/export-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts)

**Typy i Modele Danych:**
- `interface PaperDimensions` { width, height, label, description } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L14)
- `interface TitleBlockInfo` { projectName, furnitureName, author, date, scale, sheetNumber, drawingNumber, remarks } [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L43)
- `interface SavedExportView` { id, name, createdAt, paperFormat, projectionType, renderStyle, showGrid, cameraAlpha, +10 more } [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L54)
- `interface BOMRow` { name, material, length, width, thickness, qty, edge_config } [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L75)
- `interface ExportConfig` { paperFormat, projectionType, showBounds, includeBOM, includePMI, notes, titleBlock } [L85](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L85)
- `type PaperFormat` = `| 'A4_LANDSCAPE' | 'A4_PORTRAIT' | 'A3_LANDSCAPE' | 'A3_P...` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L6)
- `type ProjectionType` = `'ORTHO' | 'PERSP'` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L40)
- `type ExportRenderStyle` = `'technical' | 'shaded' | 'mono' | 'wireframe'` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L41)

**Stałe i Słowniki:**
- `const PAPER_FORMATS: Record<PaperFormat, PaperDimensions>` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L21)
- `const MARGIN_LEFT` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L31)
- `const MARGIN_RIGHT` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L32)
- `const MARGIN_TOP` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L33)
- `const MARGIN_BOTTOM` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L34)
- `const TITLE_BLOCK_WIDTH` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L37)
- `const TITLE_BLOCK_HEIGHT` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-types.ts#L38)

### [R2_rys/export-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-ui.tsx)

**Funkcje:**
- `export` `ExportUIv3(): any` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/R2_rys/export-ui.tsx#L11)

## <a id="s1_sketcher"></a>S1 Sketcher (Szkicownik Parametryczny 2D)

### [S1_sketcher/sketch-plane.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts)

**Klasy:**
- `class SketchPlane` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L12)
  - `constructor(scene: any, panelModel: any, viewport: any): void` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L25)
  - `activate(faceName, animateCamera): void` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L60)
  - `deactivate(): void` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L92)
  - `_buildGrid(faceData): void` [L120](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L120)
  - `_buildAxes(faceData): void` [L174](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L174)
  - `_buildCursorMarker(faceData): void` [L202](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L202)
  - `updateCursor(worldPoint, uv): void` [L222](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L222)
  - `addPoint(uv): void` [L253](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L253)
  - `_facePoint(origin, uAxis, vAxis, normal, u, v, normalOffset): void` [L287](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L287)
  - `_animateCameraToFace(faceName, faceData): void` [L295](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L295)
  - `onSketch(fn): void` [L312](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L312)
  - `_emit(type, data): void` [L317](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L317)
  - `dispose(): void` [L323](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/sketch-plane.ts#L323)

### [S1_sketcher/webcad-2d-mobile/src/App.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/App.tsx)

**Funkcje:**
- `export` `App(): any` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/App.tsx#L89)

### [S1_sketcher/webcad-2d-mobile/src/components/CadCanvas.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/CadCanvas.tsx)

**Funkcje:**
- `export` `CadCanvas(1 params): any` [L267](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/CadCanvas.tsx#L267)

**Typy i Modele Danych:**
- `interface CadCanvasProps` { elements, layers, activeTool, activeLayerId, snapSettings, orthoMode, onAddElement, onSelectElements, +29 more } [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/CadCanvas.tsx#L21)
- `type DimensionDraft` = `| { kind: 'linear-start'; point: Point; elementId: string...` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/CadCanvas.tsx#L64)
- `type ConstraintDraft` = `{ type: Constraint['type']; elementIds: string[]; pointIn...` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/CadCanvas.tsx#L71)

### [S1_sketcher/webcad-2d-mobile/src/components/DimensionsPanel.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/DimensionsPanel.tsx)

**Funkcje:**
- `export` `DimensionsPanel(1 params): any` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/DimensionsPanel.tsx#L57)

**Typy i Modele Danych:**
- `interface DimensionsPanelProps` { constraints, elements, selectedElementIds, onUpdateConstraint, onDeleteConstraint, onAddDimension, activeDimTool } [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/DimensionsPanel.tsx#L5)

### [S1_sketcher/webcad-2d-mobile/src/components/HelpModal.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/HelpModal.tsx)

**Funkcje:**
- `export` `HelpModal({ isOpen, onClose }: HelpModalProps): any` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/HelpModal.tsx#L9)

**Typy i Modele Danych:**
- `interface HelpModalProps` { isOpen, onClose } [L4](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/HelpModal.tsx#L4)

### [S1_sketcher/webcad-2d-mobile/src/components/LayersPanel.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/LayersPanel.tsx)

**Funkcje:**
- `export` `LayersPanel(1 params): any` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/LayersPanel.tsx#L28)

**Typy i Modele Danych:**
- `interface LayersPanelProps` { layers, activeLayerId, onSetActiveLayer, onToggleVisible, onToggleLocked, onAddLayer, onDeleteLayer, onUpdateLayerColor } [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/LayersPanel.tsx#L5)

### [S1_sketcher/webcad-2d-mobile/src/components/PropertiesInspector.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/PropertiesInspector.tsx)

**Funkcje:**
- `export` `PropertiesInspector(1 params): any` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/PropertiesInspector.tsx#L23)

**Typy i Modele Danych:**
- `interface PropertiesInspectorProps` { selectedElements, layers, onUpdateElement, onDeleteElements } [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/components/PropertiesInspector.tsx#L5)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/coincident.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/coincident.ts)

**Funkcje:**
- `export` `build(4 params): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/coincident.ts#L3)
- `buildArcCoincident(6 params): Equation[]` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/coincident.ts#L56)
- `buildEllipseCoincident(7 params): Equation[]` [L113](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/coincident.ts#L113)
- `buildEllipseEllipseCoincident(7 params): Equation[]` [L214](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/coincident.ts#L214)
- `buildArcArcCoincident(6 params): Equation[]` [L327](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/coincident.ts#L327)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/concentric.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/concentric.ts)

**Funkcje:**
- `export` `build(c: { targetElements: string[] }, getParamIdx: GetParamIdx, N: number): Equation[]` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/concentric.ts#L7)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/distance.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/distance.ts)

**Funkcje:**
- `export` `build(3 params): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/distance.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/drivingDims.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/drivingDims.ts)

**Funkcje:**
- `export` `build(3 params): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/drivingDims.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/equalLength.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/equalLength.ts)

**Funkcje:**
- `export` `build(c: { targetElements: string[] }, getParamIdx: GetParamIdx, N: number): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/equalLength.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/equalRadius.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/equalRadius.ts)

**Funkcje:**
- `export` `build(c: { targetElements: string[] }, getParamIdx: GetParamIdx, N: number): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/equalRadius.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/horizontal.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/horizontal.ts)

**Funkcje:**
- `export` `build(c: { targetElements: string[] }, getParamIdx: GetParamIdx, N: number): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/horizontal.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/parallel.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/parallel.ts)

**Funkcje:**
- `export` `build(c: { targetElements: string[] }, getParamIdx: GetParamIdx, N: number): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/parallel.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/perpendicular.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/perpendicular.ts)

**Funkcje:**
- `export` `build(c: { targetElements: string[] }, getParamIdx: GetParamIdx, N: number): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/perpendicular.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/pointOnLine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/pointOnLine.ts)

**Funkcje:**
- `export` `build(4 params): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/pointOnLine.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/radius.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/radius.ts)

**Funkcje:**
- `export` `build(3 params): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/radius.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/tangent.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/tangent.ts)

**Funkcje:**
- `export` `build(3 params): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/tangent.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/types.ts)

**Typy i Modele Danych:**
- `interface Equation` { eval, grad } [L1](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/types.ts#L1)
- `type GetParamIdx` = `( elementId: string, paramType: 'x' | 'y' | 'r' | 'w' | '...` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/types.ts#L6)
- `type EquationBuilder` = `( c: { type: string; targetElements: string[]; targetPoin...` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/types.ts#L12)

### [S1_sketcher/webcad-2d-mobile/src/constraint/equations/vertical.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/vertical.ts)

**Funkcje:**
- `export` `build(c: { targetElements: string[] }, getParamIdx: GetParamIdx, N: number): Equation[]` [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/equations/vertical.ts#L3)

### [S1_sketcher/webcad-2d-mobile/src/constraint/vec.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/vec.ts)

**Funkcje:**
- `export` `create(dim: number): number[]` [L4](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/vec.ts#L4)
- `export` `_matrix(m: number, n: number): number[][]` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/vec.ts#L10)
- `export` `clone(v: T): T` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/constraint/vec.ts#L21)

### [S1_sketcher/webcad-2d-mobile/src/tools/moveTool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/moveTool.ts)

**Funkcje:**
- `export` `startMove(5 params): void` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/moveTool.ts#L24)
- `export` `continueMove(4 params): boolean` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/moveTool.ts#L52)
- `export` `endMove(refs: MoveRefs, deps: MoveDeps): void` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/moveTool.ts#L78)

**Typy i Modele Danych:**
- `interface MoveDragState` { startMouse, lastDx, lastDy, ids } [L4](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/moveTool.ts#L4)
- `interface MoveDeps` { selectedElementIds, onSelectElements, onShiftSelected, onEndMoveDrag } [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/moveTool.ts#L11)
- `interface MoveRefs` { moveDragRef, moveRafRef, wasDraggingRef } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/moveTool.ts#L18)

### [S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts)

**Funkcje:**
- `infiniteLineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null` [L4](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts#L4)
- `lineCircleIntersection(p1: Point, p2: Point, cx: number, cy: number, r: number): Point[]` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts#L17)
- `circleCircleIntersection(c1: Point, r1: number, c2: Point, r2: number): Point[]` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts#L37)
- `export` `getElementEndpoints(el: CadElement): [Point, Point] | null` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts#L50)
- `export` `createOffsetElement(4 params): CadElement | null` [L65](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts#L65)
- `decomposeIntoChains(elements: CadElement[]): Chain[]` [L215](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts#L215)
- `export` `createOffsetChain(5 params): { newElements: CadElement[]; newConstraints: Om...` [L302](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts#L302)

**Typy i Modele Danych:**
- `interface ChainNode` { el, flipped, startPt, endPt } [L203](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts#L203)
- `interface Chain` { nodes, isClosed } [L210](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/offsetTool.ts#L210)

### [S1_sketcher/webcad-2d-mobile/src/tools/rotateTool.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/rotateTool.ts)

**Funkcje:**
- `export` `startRotate(5 params): void` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/rotateTool.ts#L24)
- `export` `continueRotate(4 params): boolean` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/rotateTool.ts#L63)
- `export` `endRotate(refs: RotateRefs, deps: RotateDeps): void` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/rotateTool.ts#L84)

**Typy i Modele Danych:**
- `interface RotateDeps` { selectedElementIds, onSelectElements, onRotateSelected, onEndRotateDrag, commandFeedback, setPromptText } [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/rotateTool.ts#L9)
- `interface RotateRefs` { rotateDraftRef, rotateRafRef, wasDraggingRef } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/rotateTool.ts#L18)
- `type RotateDraft` = `| { kind: 'awaiting-center'; ids: string[] } | { kind: 'a...` [L4](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/rotateTool.ts#L4)

### [S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts)

**Funkcje:**
- `segmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): any` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L25)
- `getSegments(el: CadElement): { p1: Point; p2: Point; len: number }[]` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L44)
- `isAngleOnArc(angleDeg: number, startAngle: number, sweep: number): boolean` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L69)
- `getArcParamAtAngle(angleDeg: number, startAngle: number, sweep: number): number` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L74)
- `lineArcIntersectParams(7 params): number[]` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L84)
- `arcArcIntersectParams(10 params): number[]` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L118)
- `getArcSweep(el: { type: string; startAngle?: number; endAngle?:...): number` [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L146)
- `lineEllipseIntersectParams(8 params): number[]` [L165](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L165)
- `buildEllipsePointsForRange(3 params): Point[]` [L202](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L202)
- `getPointAtT(el: CadElement, t: number): Point` [L221](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L221)
- `pointIsLeftOfLine(pt: Point, a: Point, b: Point): boolean` [L255](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L255)
- `buildClosedShapeRemovalIntervals(2 params): Array<{ start: number; end: number }>` [L259](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L259)
- `ellipseArcIntersectParams(2 params): number[]` [L294](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L294)
- `ellipseEllipseIntersectParams(2 params): number[]` [L342](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L342)
- `findElementBoundaries(el: CadElement, elements: CadElement[]): number[]` [L365](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L365)
- `buildPolylinePointsForRange(3 params): Point[]` [L540](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L540)
- `buildEndpointReferenceMap(el: CadElement, plannedSegments: PlannedSegment[]): Map<number, EndpointReference | null>` [L558](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L558)
- `planEndpointConstraintUpdates(3 params): { deleteIds: string[]; addConstraints: Omit<Con...` [L581](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L581)
- `removeElementFromConstraints(elementId: string, constraints: Constraint[]): any` [L664](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L664)
- `cloneElement(el: CadElement): CadElement` [L701](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L701)
- `pointsEqual(a: Point, b: Point): boolean` [L708](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L708)
- `getEndpointIndices(el: CadElement): number[]` [L712](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L712)
- `getElementPoint(el: CadElement, pointIndex: number): Point | null` [L719](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L719)
- `isPointOnLineRobust(el: CadElement, pt: Point, tol: number): boolean` [L736](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L736)
- `isPointOnArcRobust(el: CadElement, pt: Point, tol: number): boolean` [L752](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L752)
- `export` `runSketchTrim(pathPts: Point[], deps: SketchTrimDeps): void` [L769](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L769)

**Typy i Modele Danych:**
- `interface SketchTrimDeps` { elements, constraints, scale, onUpdateElement, onAddElement, onDeleteElements, onDeleteConstraints, onAddConstraint, +3 more } [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L5)
- `interface PlannedSegment` { startT, endT, elementId, points } [L528](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L528)
- `interface EndpointReference` { elementId, pointIndex } [L535](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L535)
- `interface TrimEndpointCandidate` *extends EndpointReference* { point } [L765](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/tools/sketchTrim.ts#L765)

### [S1_sketcher/webcad-2d-mobile/src/types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts)

**Typy i Modele Danych:**
- `interface Point` { x, y } [L1](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L1)
- `interface BaseElement` { id, type, layerId, color, strokeWidth, isSelected } [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L8)
- `interface LineElement` *extends BaseElement* { type, x1, y1, x2, y2 } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L17)
- `interface RectElement` *extends BaseElement* { type, x, y, width, height } [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L25)
- `interface PolylineElement` *extends BaseElement* { type, points, isClosed } [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L33)
- `interface CircleElement` *extends BaseElement* { type, cx, cy, r } [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L40)
- `interface EllipseElement` *extends BaseElement* { type, cx, cy, rx, ry, startAngle, endAngle } [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L47)
- `interface ArcElement` *extends BaseElement* { type, cx, cy, r, startAngle, endAngle } [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L57)
- `interface TextElement` *extends BaseElement* { type, x, y, text, size } [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L66)
- `interface DimensionElement` *extends BaseElement* { type, x1, y1, x2, y2, offsetX, offsetY, label, +4 more } [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L74)
- `interface Layer` { id, name, color, visible, locked, strokeWidth } [L103](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L103)
- `interface SnapSetting` { endpoint, midpoint, center, intersection, nearest, grid } [L134](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L134)
- `interface SnapPoint` { x, y, type, elementId, pointIndex } [L143](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L143)
- `interface CommandHistoryItem` { command, response, type, timestamp } [L151](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L151)
- `interface Constraint` { id, type, targetElements, targetPoints, value, isDriving, offsetX, offsetY } [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L158)
- `interface SketchDOFInfo` { totalParams, numEquations, dof, status } [L170](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L170)
- `type ElementType` = `'line' | 'polyline' | 'circle' | 'ellipse' | 'arc' | 'tex...` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L6)
- `type CadElement` = `| LineElement | PolylineElement | CircleElement | Ellipse...` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L93)
- `type CadTool` = `| 'select' | 'line' | 'polyline' | 'rect' | 'circle' | 'e...` [L112](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/types.ts#L112)

### [S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts)

**Funkcje:**
- `export` `distance(p1: Point, p2: Point): number` [L4](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L4)
- `export` `pointToSegmentDistance(p: Point, a: Point, b: Point): { dist: number; point: Point }` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L9)
- `export` `projectPointToLine(p: Point, a: Point, b: Point): Point` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L25)
- `export` `lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L36)
- `export` `lineIntersectionInfinite(p1: Point, p2: Point, p3: Point, p4: Point): Point | null` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L55)
- `export` `angleBetweenPoints(a: Point, b: Point): number` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L68)
- `export` `rotatePoint(p: Point, center: Point, angleDeg: number): Point` [L76](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L76)
- `export` `scalePoint(p: Point, center: Point, factor: number): Point` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L89)
- `export` `applyOrtho(start: Point, current: Point): Point` [L97](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L97)
- `export` `getSnapPoints(elements: CadElement[], layers: Layer[]): SnapPoint[]` [L108](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L108)
- `export` `findSnapPoint(5 params): SnapPoint | null` [L185](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L185)
- `export` `getNearestPoint(4 params): { point: Point; element: CadElement } | null` [L218](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L218)
- `isAngleInArc(angle: number, start: number, end: number): boolean` [L327](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L327)
- `export` `isPointInSelection(p: Point, x1: number, y1: number, x2: number, y2: number): boolean` [L337](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L337)
- `export` `isElementInSelection(6 params): boolean` [L346](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L346)
- `pointToBoxDistance(p: Point, xmin: number, ymin: number, xmax: number, ymax: number): number` [L445](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L445)
- `export` `exportToSvg(elements: CadElement[], layers: Layer[]): string` [L452](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L452)
- `export` `exportToDxf(elements: CadElement[], layers: Layer[]): string` [L560](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L560)
- `export` `computeDimValue(c: Constraint, elements: CadElement[]): number | null` [L626](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L626)
- `export` `isDrivingDimension(c: Constraint, allConstraints: Constraint[]): boolean` [L711](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L711)
- `export` `smoothCatmullRomPath(pts: Point[]): string` [L726](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L726)
- `export` `calculateArcFrom3Points(p1: Point, p2: Point, p3: Point): { cx: number, cy: number, r: number } | null` [L750](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/cadUtils.ts#L750)

### [S1_sketcher/webcad-2d-mobile/src/utils/solver2d.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/solver2d.ts)

**Funkcje:**
- `export` `solveConstraints(8 params): CadElement[]` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/solver2d.ts#L42)
- `solveLinearSystem(A: number[][], B: number[]): number[]` [L350](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/solver2d.ts#L350)
- `export` `computeSketchDOF(elements: CadElement[], constraints: Constraint[]): SketchDOFInfo` [L384](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/solver2d.ts#L384)

**Typy i Modele Danych:**
- `interface Param` { elementId, paramType, pointIndex, value } [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/solver2d.ts#L19)

### [S1_sketcher/webcad-2d-mobile/src/utils/templates.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/templates.ts)

**Typy i Modele Danych:**
- `interface CadTemplate` { name, description, layers, elements } [L3](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/templates.ts#L3)

**Stałe i Słowniki:**
- `const CAD_TEMPLATES: CadTemplate[]` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S1_sketcher/webcad-2d-mobile/src/utils/templates.ts#L10)

## <a id="s2_solver"></a>S2 Solver (Rozkład Sił, Mostek Symulacji)

### [S2_solver/constraint-commands.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts)

**Klasy:**
- `class AddConstraintCommand` *implements Command* [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts#L17)
  - `constructor(3 params): void` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts#L26)
  - `execute(document: ProjectDocument): void` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts#L47)
  - `undo(document: ProjectDocument): void` [L53](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts#L53)
  - `redo(document: ProjectDocument): void` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts#L60)
- `class RemoveConstraintCommand` *implements Command* [L81](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts#L81)
  - `constructor(constraint: SolverConstraint, label: string): void` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts#L89)
  - `execute(_document: ProjectDocument): void` [L100](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts#L100)
  - `undo(_document: ProjectDocument): void` [L105](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts#L105)
  - `redo(_document: ProjectDocument): void` [L111](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-commands.ts#L111)

### [S2_solver/constraint-dof.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts)

**Funkcje:**
- `export` `orthonormalize(axes: Vec3[], eps: number): Vec3[]` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L52)
- `export` `mergeAxes(a: Vec3[], b: Vec3[]): Vec3[]` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L69)
- `export` `projectOntoFreeSpace(delta: Vec3, constrained: Vec3[]): Vec3` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L74)
- `export` `projectOntoConstrainedSpace(delta: Vec3, constrained: Vec3[]): Vec3` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L84)
- `export` `rotationBetween(from: Vec3, to: Vec3): Quat` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L88)
- `export` `perpendicular(v: Vec3): Vec3` [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L106)
- `export` `worldDeltaRotation(from: Quat, to: Quat): Quat` [L121](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L121)
- `export` `swingTwistDecompose(q: Quat, axis: Vec3): { swing: Quat; twist: Quat }` [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L129)
- `export` `applyWorldRotation(base: Quat, worldDelta: Quat): Quat` [L137](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L137)
- `localMmToNm(localMm: readonly [number, number, number] | undefined): Vec3` [L141](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L141)
- `worldNormalOf(node: CADNode, localNormal: readonly [number, number, number]): Vec3` [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L146)
- `resolveOnNode(document: ProjectDocument, node: CADNode, anchor: ConstraintAnchor): any` [L151](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L151)
- `export` `buildGroundLocks(document: ProjectDocument, constraints: SolverConstraint[]): GroundLock[]` [L160](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L160)
- `export` `buildConstraintFrames(document: ProjectDocument, constraints: SolverConstraint[]): ConstraintFrame[]` [L214](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L214)
- `export` `otherNodeId(frame: ConstraintFrame, nodeId: string): string | null` [L276](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L276)
- `export` `localPointOn(frame: ConstraintFrame, nodeId: string): Vec3` [L286](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L286)
- `export` `rotationConstrainedDelta(deltaRot: Quat, twistAxis: Vec3 | null): Quat` [L290](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L290)

**Typy i Modele Danych:**
- `interface ConstrainedSpace` { translationConstrainedBasis, rotationConstrainedBasis } [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L21)
- `interface ConstraintFrame` { constraintId, bindType, kind, aId, bId, worldNormal, localPointANm, localPointBNm, +2 more } [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L26)
- `interface GroundLock` { nodeId, mode, localPointNm, worldNormal, twistAxis, translationConstrainedBasis } [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L43)
- `type MateKind` = `'plane' | 'point' | 'full'` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L19)

**Stałe i Słowniki:**
- `const AXIS_EPS` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-dof.ts#L16)

### [S2_solver/constraint-drag-group.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts)

**Klasy:**
- `class ConstraintDragGroup` [L316](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L316)
  - `begin(3 params): void` [L357](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L357)
  - `propagateTranslation(document: ProjectDocument, draggedNodeId: string): void` [L410](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L410)
  - `propagateTransform(document: ProjectDocument, draggedNodeId: string): void` [L414](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L414)
  - `buildTransformCommands(document: ProjectDocument, label: string): TransformNodeCommand[]` [L504](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L504)
  - `restoreInitial(document: ProjectDocument): void` [L519](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L519)
  - `end(): void` [L526](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L526)

**Funkcje:**
- `export` `getGroundFixedNodeIds(constraints: SolverConstraint[]): Set<string>` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L43)
- `export` `buildNonGroundConstraintEdges(constraints: SolverConstraint[]): Record<string, string[]>` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L55)
- `export` `getConstraintDragGroup(nodeId: string, constraints: SolverConstraint[]): Set<string>` [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L79)
- `export` `projectTranslationDelta(delta: Vec3, blockedAxes: Vec3[]): Vec3` [L88](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L88)
- `export` `constrainedTranslationDelta(delta: Vec3, constrainedAxes: Vec3[]): Vec3` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L92)
- `poseFromTRS(translation: Vec3, rotation: Quat, scale: Vec3): WorldPose` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L96)
- `poseFromMatrix(m: Mat4): WorldPose` [L101](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L101)
- `setWorldPose(node: CADNode, pose: WorldPose): void` [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L106)
- `worldPoint(pose: WorldPose, localNm: Vec3): Vec3` [L114](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L114)
- `applyGroundLock(lock: GroundLock, initial: WorldPose, current: WorldPose): WorldPose` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L118)
- `clampDraggedAgainstGrounded(7 params): WorldPose` [L145](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L145)
- `transferPoseToNeighbor(6 params): WorldPose` [L233](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L233)

**Typy i Modele Danych:**
- `interface WorldPose` { translation, rotation, scale, matrix } [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-drag-group.ts#L35)

### [S2_solver/constraint-geometry.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts)

**Funkcje:**
- `export` `getLocalBoxMm(node: CADNode | null): LocalBoxMm | null` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L32)
- `export` `resolveCornerLocalMm(node: CADNode | null, cornerIndex: number): SolverVec3 | null` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L68)
- `faceAxisSpec(node: CADNode | null, canonical: string): { axis: 0 | 1 | 2; positive: boolean } | null` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L96)
- `canonicalFaceName(faceName: string): string | null` [L115](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L115)
- `export` `resolveFaceLocalMm(node: CADNode | null, faceName: string): [SolverVec3, SolverVec3] | null` [L131](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L131)
- `projectPointOntoPlane(point: SolverVec3, planePoint: SolverVec3, normal: SolverVec3): SolverVec3` [L164](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L164)
- `export` `namedFaceFromPick(node: CADNode, faceName: string, pickPointMm?: SolverVec3 | null): { localPointMm: SolverVec3; localNormalMm: Solv...` [L184](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L184)
- `export` `resolveFaceQuadMm(node: CADNode | null, faceName: string): FaceQuadMm | null` [L212](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L212)
- `export` `faceNameFromLocalNormal(normal: SolverVec3, nodeType?: string): string` [L255](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L255)
- `storedFaceNameFromBoxFace(boxFaceName: string, nodeType?: string): string` [L281](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L281)
- `export` `faceAxisTag(faceName: string): string | null` [L323](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L323)
- `export` `faceAnchorLabel(faceName: string, nodeType?: string): string` [L335](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L335)
- `export` `nearestSmartFrameFace(box: LocalBoxMm, point: SolverVec3, viewDirCad?: SolverVec3 | null): string` [L361](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L361)
- `export` `nearestSmartFrameCorner(box: LocalBoxMm, point: SolverVec3): number` [L399](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L399)
- `export` `snapPickToSmartFrame(5 params): { faceName: string; cornerIndex: number; localP...` [L427](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L427)
- `export` `babylonPickToLocalMm(3 params): { localPointMm: SolverVec3; localNormalMm: Solv...` [L469](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L469)
- `export` `findDescendant(node: CADNode, id: string): CADNode | null` [L501](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L501)
- `export` `resolveGeomNode(body: CADNode, anchor: ConstraintAnchor): CADNode` [L515](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L515)
- `nodeOriginMm(node: CADNode): Vec3` [L522](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L522)
- `export` `localMmToWorldMm(node: CADNode, localMm: SolverVec3): Vec3` [L527](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L527)
- `export` `worldMmToLocalMm(node: CADNode, worldMm: Vec3): SolverVec3` [L532](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L532)
- `export` `mapLocalDirToNode(fromNode: CADNode, toNode: CADNode, localDir: SolverVec3): SolverVec3` [L539](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L539)
- `export` `mapLocalMmToNode(4 params): { localPointMm: SolverVec3; localNormalMm: Solv...` [L554](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L554)
- `liveFaceNameFromSnapshot(4 params): string` [L592](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L592)
- `resolveLiveFaceAnchor(4 params): ResolvedAnchor | null` [L617](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L617)
- `export` `resolveAnchor(3 params): ResolvedAnchor | null` [L644](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L644)
- `normalizeDir(v: SolverVec3): SolverVec3` [L740](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L740)
- `perpendicularDir(n: SolverVec3): SolverVec3` [L748](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L748)
- `crossDir(a: SolverVec3, b: SolverVec3): SolverVec3` [L761](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L761)
- `boxExtentAlong(box: LocalBoxMm, dir: SolverVec3): number` [L770](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L770)
- `overlayCenterMm(5 params): SolverVec3` [L782](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L782)
- `export` `resolveAnchorQuadMm(3 params): FaceQuadMm | null` [L815](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L815)

**Typy i Modele Danych:**
- `interface LocalBoxMm` { min, max } [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L26)
- `interface FaceQuadMm` { center, normal, uAxis, vAxis, width, height } [L199](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L199)
- `interface ResolvedAnchor` { localPointMm, localNormal } [L578](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L578)

**Stałe i Słowniki:**
- `const SMARTFRAME_FACE_LABEL: Record<string, string>` [L301](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L301)
- `const PANEL_FACE_LABEL: Record<string, string>` [L311](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-geometry.ts#L311)

### [S2_solver/constraint-highlight.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-highlight.ts)

**Klasy:**
- `class ConstraintHighlightOverlay` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-highlight.ts#L31)
  - `setHighlighted(ids: Iterable<string>): void` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-highlight.ts#L56)
  - `toggle(id: string): boolean` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-highlight.ts#L62)
  - `clear(): void` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-highlight.ts#L73)
  - `refresh(): void` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-highlight.ts#L82)
  - `startVertexRubberBand(constraintId: string): void` [L503](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-highlight.ts#L503)
  - `stopVertexRubberBand(): void` [L521](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-highlight.ts#L521)

### [S2_solver/constraint-pick-flow.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts)

**Funkcje:**
- `notifyPickChanged(): void` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L18)
- `export` `getActiveConstraintPick(): ActiveConstraintPick | null` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L25)
- `export` `openDrzewoRelacjeTab(constraintId?: string): void` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L29)
- `export` `expectedKindForBind(bindType: BindType, groundKind: AnchorKind): AnchorKind` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L35)
- `warnConflict(): void` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L41)
- `export` `beginConstraintSlotPick(opts: { constraintId: string; slot: 'A' | 'B'; expect...): void` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L48)
- `export` `removeIncompleteConstraintDrafts(): string[]` [L190](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L190)
- `export` `addConstraintDraft(bindType: BindType, autoPick: boolean): SolverConstraint` [L209](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L209)
- `export` `addConstraintWithPick(bindType: BindType, _groundKind: AnchorKind): SolverConstraint` [L234](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L234)

**Typy i Modele Danych:**
- `type ActiveConstraintPick` = `{ constraintId: string; slot: 'A' | 'B' }` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L22)

**Stałe i Słowniki:**
- `const DRZEWO_TAB_EVENT` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L15)
- `const SOLVER_PICK_EVENT` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-pick-flow.ts#L16)

### [S2_solver/constraint-picker.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts)

**Funkcje:**
- `export` `getActiveConstraintPicker(): ActiveConstraintPicker | null` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L38)
- `export` `resolveBindingTarget(node: CADNode | null): CADNode | null` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L43)
- `export` `resolveRigidBody(node: CADNode | null): CADNode | null` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L55)
- `export` `bindAnchorToRigidBody(geomNode: CADNode, anchor: ConstraintAnchor): ConstraintAnchor` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L75)
- `cameraViewDirCad(): [number, number, number] | null` [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L104)
- `matrixNormal(m: number[], x: number, y: number, z: number): { x: number; y: number; z: number }` [L114](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L114)
- `quadFromPickMesh(node: CADNode, mesh: any): Pick< ConstraintAnchor, 'localUAxisMm' | 'local...` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L122)
- `quadFromNamedFace(node: CADNode, faceName: string): Pick< ConstraintAnchor, 'localUAxisMm' | 'local...` [L163](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L163)
- `buildFaceAnchor(targetNode: CADNode, data: any): ConstraintAnchor | null` [L183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L183)
- `buildVertexAnchor(targetNode: CADNode, data: any): ConstraintAnchor | null` [L273](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L273)
- `nodeFromPickData(data: any): CADNode | null` [L294](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L294)
- `clearPickerHighlights(): void` [L303](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L303)
- `export` `stopConstraintPick(restoreSelectionMode: boolean): void` [L317](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L317)
- `export` `startConstraintPick(picker: ActiveConstraintPicker): void` [L342](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L342)
- `export` `pickActiveObjectAnchor(): ConstraintAnchor | null` [L390](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L390)
- `export` `handleConstraintPickEvent(type: string, data: any): boolean` [L408](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L408)

**Typy i Modele Danych:**
- `interface ActiveConstraintPicker` { label, expectedKind, onPick, onCancel } [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-picker.ts#L31)

### [S2_solver/constraint-store.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts)

**Klasy:**
- `class ConstraintStore` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L47)
  - `onChange(listener: ConstraintChangeListener): () => void` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L63)
  - `notifyChanged(): void` [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L68)
  - `add(init: Partial<SolverConstraint> & { bindType: BindType }): SolverConstraint` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L82)
  - `get(id: string): SolverConstraint | null` [L95](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L95)
  - `remove(id: string): boolean` [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L99)
  - `update(id: string, patch: Partial<SolverConstraint>): boolean` [L110](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L110)
  - `setAnchor(id: string, slot: 'A' | 'B', anchor: ConstraintAnchor | null): boolean` [L120](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L120)
  - `clear(): void` [L124](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L124)
  - `pruneMissingNodes(existingNodeIds: Set<string>): number` [L138](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L138)
  - `getIssues(constraintId: string): ConstraintValidationIssue[]` [L161](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L161)
  - `setValidationIssues(issues: ConstraintValidationIssue[]): void` [L165](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L165)
  - `resetSolveResults(): void` [L183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L183)
  - `toJSON(): ConstraintStoreJSON` [L190](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L190)
  - `fromJSON(data: ConstraintStoreJSON | null | undefined): void` [L206](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L206)
  - `attachTo(document: ProjectDocument): () => void` [L239](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L239)

**Funkcje:**
- `reviveAnchor(raw: ConstraintAnchor | null | undefined): ConstraintAnchor | null` [L248](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L248)
- `reviveVec3(raw: Vec3 | null | undefined): Vec3 | null` [L263](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L263)
- `issueMapsEqual(2 params): boolean` [L270](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L270)

**Typy i Modele Danych:**
- `interface ConstraintStoreJSON` { version, constraints } [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L31)
- `type ConstraintChangeListener` = `() => void` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L45)

**Stałe i Słowniki:**
- `const CONSTRAINT_DOCUMENT_SECTION` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-store.ts#L28)

### [S2_solver/constraint-tree-row.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-tree-row.tsx)

**Funkcje:**
- `typeLabel(c: SolverConstraint): string` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-tree-row.tsx#L20)
- `usesAngularResidual(bindType: BindType, groundKind?: AnchorKind): boolean` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-tree-row.tsx#L24)
- `formatResidual(3 params): string` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-tree-row.tsx#L28)
- `TrashIcon(): any` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-tree-row.tsx#L37)
- `EyeIcon({ hidden }: { hidden: boolean }): any` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-tree-row.tsx#L46)
- `export` `ConstraintTreeRow({ constraint: c, document, highlighted, issues, onHighlight }: Props): any` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-tree-row.tsx#L71)
- `ElementSlot(1 params): any` [L248](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-tree-row.tsx#L248)
- `GroundSlot(1 params): any` [L291](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-tree-row.tsx#L291)

**Typy i Modele Danych:**
- `interface Props` { constraint, document, highlighted, issues, onHighlight } [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-tree-row.tsx#L63)

### [S2_solver/constraint-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-types.ts)

**Funkcje:**
- `export` `makeAnchor(init: Partial<ConstraintAnchor> & { nodeId: string; k...): ConstraintAnchor` [L85](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-types.ts#L85)
- `export` `makeSolverConstraint(init: Partial<SolverConstraint> & { id: string; bindT...): SolverConstraint` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-types.ts#L93)
- `export` `constraintHasGeometry(constraint: SolverConstraint): boolean` [L110](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-types.ts#L110)
- `export` `constraintNodeIds(constraint: SolverConstraint): string[]` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-types.ts#L118)

**Typy i Modele Danych:**
- `interface ConstraintAnchor` { nodeId, kind, faceName, cornerIndex, sourceNodeId, localPointMm, localNormalMm, localUAxisMm, +4 more } [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-types.ts#L30)
- `interface SolverConstraint` { id, bindType, enabled, anchorA, anchorB, groundPosMm, groundNormal, offsetMm, +2 more } [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-types.ts#L64)
- `type AnchorKind` = `'OBJECT' | 'VERTEX' | 'FACE' | 'DATUM'` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-types.ts#L21)

**Stałe i Słowniki:**
- `const CORNER_COUNT` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-types.ts#L28)

### [S2_solver/constraint-ui-labels.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-ui-labels.ts)

**Funkcje:**
- `export` `geomNodeForAnchor(anchor: ConstraintAnchor, document: any): any` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-ui-labels.ts#L8)
- `elementIndexLabel(anchor: ConstraintAnchor, document: any): string` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-ui-labels.ts#L15)
- `export` `anchorPartLabel(anchor: ConstraintAnchor | null, document: any): string` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-ui-labels.ts#L38)
- `export` `anchorFullLabel(anchor: ConstraintAnchor | null, document: any): string` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-ui-labels.ts#L49)
- `export` `anchorShortLabel(anchor: ConstraintAnchor | null, document: any): string` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-ui-labels.ts#L61)

### [S2_solver/constraint-validation.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts)

**Funkcje:**
- `isFaceBind(type: SolverConstraint['bindType']): boolean` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts#L39)
- `samePair(a: SolverConstraint, b: SolverConstraint): boolean` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts#L43)
- `sameVertexGeometry(a: SolverConstraint, b: SolverConstraint): boolean` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts#L57)
- `sameFaceGeometry(a: SolverConstraint, b: SolverConstraint): boolean` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts#L75)
- `hasStaleSource(document: ProjectDocument | null, anchor: ConstraintAnchor | null): boolean` [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts#L99)
- `anchorResolves(document: ProjectDocument | null, anchor: ConstraintAnchor | null): boolean` [L109](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts#L109)
- `export` `validateConstraints(constraints: SolverConstraint[], document: ProjectDocument | null): ConstraintValidationResult` [L133](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts#L133)

**Typy i Modele Danych:**
- `interface ConstraintValidationIssue` { constraintId, severity, code, message } [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts#L16)
- `interface ConstraintValidationResult` { issues, skipIds } [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts#L33)
- `type ValidationSeverity` = `'error' | 'warning'` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/constraint-validation.ts#L14)

### [S2_solver/core/contract.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts)

**Funkcje:**
- `export` `emptyConstraintResidual(): ConstraintResidual` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts#L22)
- `export` `makeConstraintItem(init: Pick<ConstraintItem, 'constraintId' | 'bindType...): ConstraintItem` [L73](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts#L73)
- `export` `makeSolverContract(init: Partial<SolverContract>): SolverContract` [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts#L94)
- `export` `makeObjectState(init: Pick<ObjectState, 'id' | 'location' | 'rotation...): ObjectState` [L103](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts#L103)

**Typy i Modele Danych:**
- `interface ConstraintResidual` { linearMm, angularRad } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts#L17)
- `interface ConstraintItem` { constraintId, bindType, enabled, objAId, objBId, vertA, vertB, faceA, +7 more } [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts#L26)
- `interface SolverContract` { constraintOrder, constraints, groundDistanceMap, lockedIds } [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts#L49)
- `interface ObjectState` { id, location, rotation, localVertices, localFaces } [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts#L61)
- `type BindType` = `'VERTEX' | 'COPLANAR' | 'FLUSH' | 'GROUND'` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts#L13)
- `type GroundMode` = `'OBJECT' | 'VERTEX' | 'FACE'` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/contract.ts#L14)

### [S2_solver/core/graph.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/graph.ts)

**Klasy:**
- `class ConstraintGraph` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/graph.ts#L5)
  - `computeGroundDistances(groundIds: Set<string>, edges: Record<string, string[]>): Record<string, number>` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/graph.ts#L10)
  - `getDistance(objId: string): number` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/graph.ts#L38)
  - `getConnectedComponent(3 params): Set<string>` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/graph.ts#L46)

### [S2_solver/core/math3d.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts)

**Funkcje:**
- `vecLen(v: Vec3): number` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L16)
- `export` `quatNormTo(q: Quat, out: Quat): Quat` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L20)
- `export` `quatNorm(q: Quat): Quat` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L36)
- `export` `quatDot(a: Quat, b: Quat): number` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L40)
- `export` `quatSlerp(a: Quat, b: Quat, t: number): Quat` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L44)
- `export` `safeNormalize(vec: Vec3, fallback: Vec3): Vec3` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L80)
- `export` `averageQuaternions(quats: Quat[]): Quat` [L92](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L92)
- `export` `quatMulTo(a: Quat, b: Quat, out: Quat): Quat` [L109](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L109)
- `export` `quatMul(a: Quat, b: Quat): Quat` [L119](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L119)
- `export` `quatConjugateTo(q: Quat, out: Quat): Quat` [L123](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L123)
- `export` `quatConjugate(q: Quat): Quat` [L131](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L131)
- `export` `rotateVec3ByQuatTo(v: Vec3, q: Quat, out: Vec3): Vec3` [L136](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L136)
- `export` `rotateVec3ByQuat(v: Vec3, q: Quat): Vec3` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L157)
- `export` `localToWorldPointTo(localPoint: Vec3, location: Vec3, rotation: Quat, out: Vec3): Vec3` [L161](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L161)
- `export` `localToWorldPoint(localPoint: Vec3, location: Vec3, rotation: Quat): Vec3` [L169](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L169)
- `export` `localToWorldNormalTo(normal: Vec3, rotation: Quat, out: Vec3): Vec3` [L173](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L173)
- `export` `localToWorldNormal(normal: Vec3, rotation: Quat): Vec3` [L177](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L177)
- `export` `vec3SubTo(a: Vec3, b: Vec3, out: Vec3): Vec3` [L181](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L181)
- `export` `vec3Sub(a: Vec3, b: Vec3): Vec3` [L188](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L188)
- `export` `vec3AddTo(a: Vec3, b: Vec3, out: Vec3): Vec3` [L192](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L192)
- `export` `vec3Add(a: Vec3, b: Vec3): Vec3` [L199](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L199)
- `export` `vec3ScaleTo(v: Vec3, s: number, out: Vec3): Vec3` [L203](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L203)
- `export` `vec3Scale(v: Vec3, s: number): Vec3` [L210](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L210)
- `export` `vec3Dot(a: Vec3, b: Vec3): number` [L214](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L214)
- `export` `vec3Len(v: Vec3): number` [L218](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L218)
- `export` `vec3NormalizeTo(v: Vec3, out: Vec3): Vec3` [L222](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L222)
- `export` `vec3Normalize(v: Vec3): Vec3` [L236](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L236)
- `export` `rotationBetweenNormalsTo(fromN: Vec3, toN: Vec3, out: Quat, tmpV0?: Vec3, tmpV1?: Vec3): Quat` [L252](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L252)
- `export` `rotationBetweenNormals(fromN: Vec3, toN: Vec3): Quat` [L300](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L300)
- `export` `findPerpendicularTo(v: Vec3, out: Vec3): Vec3` [L305](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L305)
- `export` `findPerpendicular(v: Vec3): Vec3` [L325](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L325)
- `export` `scaledQuatTo(q: Quat, frac: number, out: Quat): Quat` [L333](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L333)
- `export` `scaledQuat(q: Quat, frac: number): Quat` [L374](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L374)
- `export` `applyRotationToQuatTo(objRot: Quat, deltaRot: Quat, out: Quat): Quat` [L378](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L378)
- `export` `applyRotationToQuat(objRot: Quat, deltaRot: Quat): Quat` [L383](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L383)
- `export` `rotationsCompatiblePure(rotA: Quat, rotB: Quat, toleranceDegrees: number): boolean` [L387](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L387)

**Typy i Modele Danych:**
- `type Vec3` = `[number, number, number]` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L13)
- `type Quat` = `[number, number, number, number]` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/math3d.ts#L14)

### [S2_solver/core/solver-core.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts)

**Funkcje:**
- `export` `getVertexWorldPositionTo(state: ObjectState, vertIdx: number, out: Vec3): Vec3` [L97](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L97)
- `export` `getVertexWorldPosition(state: ObjectState, vertIdx: number): Vec3` [L108](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L108)
- `export` `getFaceWorldDataTo(state: ObjectState, faceIdx: number, outCenter: Vec3, outNormal: Vec3): void` [L112](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L112)
- `export` `getFaceWorldData(state: ObjectState, faceIdx: number): [Vec3, Vec3]` [L134](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L134)
- `sortConstraints(constraints: ConstraintItem[], groundDistMap: Record<string, number>): ConstraintItem[]` [L146](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L146)
- `moveShares(5 params): { wa: number; wb: number }` [L162](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L162)
- `export` `solveConstraintsPure(4 params): boolean` [L193](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L193)
- `export` `residualExceedsTolerance(residual: ConstraintResidual, tol: SolverTolerance): boolean` [L393](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L393)
- `export` `computeConstraintResidual(bind: ConstraintItem, states: Map<string, ObjectState>): ConstraintResidual` [L404](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L404)
- `relativeObjectPair(bind: ConstraintItem): Set<string>` [L465](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L465)
- `sameRelativePair(a: ConstraintItem, b: ConstraintItem): boolean` [L475](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L475)
- `snapshotPoses(states: Map<string, ObjectState>): Map<string, PoseSnapshot>` [L500](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L500)
- `restorePoses(states: Map<string, ObjectState>, snap: Map<string, PoseSnapshot>): void` [L511](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L511)
- `detectAndSuppressConflicts(3 params): boolean` [L533](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L533)
- `export` `solveWithConflictResolution(5 params): [boolean, number]` [L594](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L594)

**Typy i Modele Danych:**
- `interface SolverTolerance` { linearMm, angularRad } [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L69)
- `type PoseSnapshot` = `{ location: Vec3; rotation: Quat }` [L498](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L498)

**Stałe i Słowniki:**
- `const RELAX` [L51](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L51)
- `const BIND_PRIORITY: Record<BindType, number>` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L54)
- `const IMPLEMENTED_BIND_TYPES: ReadonlySet<BindType>` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L62)
- `const DEFAULT_TOLERANCE: SolverTolerance` [L77](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L77)
- `const RESIDUAL_TOLERANCE: SolverTolerance` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L80)
- `const CONFLICT_RESIDUAL_THRESHOLD_MM` [L496](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/core/solver-core.ts#L496)

### [S2_solver/datum-planes.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts)

**Funkcje:**
- `export` `isDatumNodeId(nodeId: string | null | undefined): boolean` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts#L23)
- `export` `isDatumAnchor(anchor: ConstraintAnchor | null | undefined): boolean` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts#L27)
- `export` `datumNameFromNodeId(nodeId: string): DatumPlaneName | null` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts#L31)
- `export` `datumNodeId(name: DatumPlaneName): string` [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts#L38)
- `export` `parseDatumPlaneName(raw: string | null | undefined): DatumPlaneName | null` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts#L42)
- `export` `getDatumWorldPose(name: DatumPlaneName): { pointMm: SolverVec3; normalMm: SolverVec3; }` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts#L52)
- `export` `makeDatumAnchor(name: DatumPlaneName): ConstraintAnchor` [L90](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts#L90)
- `export` `setDatumPlanesPickable(pickable: boolean): void` [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts#L104)

**Typy i Modele Danych:**
- `type DatumPlaneName` = `'Top' | 'Front' | 'Right'` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts#L12)

**Stałe i Słowniki:**
- `const DATUM_NODE_PREFIX` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/datum-planes.ts#L14)

### [S2_solver/demo-row.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/demo-row.ts)

**Funkcje:**
- `export` `generate10CabinetsRow(widths_mm: number[]): any[]` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/demo-row.ts#L24)
- `export` `expandCabinet(index: number, delta_mm: number): void` [L103](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/demo-row.ts#L103)
- `export` `generateWardrobeDemo(options?: { szerokosc_mm?: number; wysokosc_mm?: number; ...): any` [L139](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/demo-row.ts#L139)

### [S2_solver/panel-relations-edit.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/panel-relations-edit.tsx)

**Funkcje:**
- `anchorTouchesPanel(anchor: SolverConstraint['anchorA'], panelId: string): boolean` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/panel-relations-edit.tsx#L16)
- `constraintTouchesPanel(c: SolverConstraint, panelId: string): boolean` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/panel-relations-edit.tsx#L21)
- `export` `PanelRelationsEdit({ panelId }: Props): React.JSX.Element` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/panel-relations-edit.tsx#L29)

**Typy i Modele Danych:**
- `interface Props` { panelId } [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/panel-relations-edit.tsx#L25)

### [S2_solver/solve-constraints-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solve-constraints-command.ts)

**Klasy:**
- `class SolveConstraintsCommand` *implements Command* [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solve-constraints-command.ts#L21)
  - `constructor(deltas: NodeTransformDelta[], label: string): void` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solve-constraints-command.ts#L29)
  - `execute(document: ProjectDocument): void` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solve-constraints-command.ts#L45)
  - `undo(document: ProjectDocument): void` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solve-constraints-command.ts#L49)

**Typy i Modele Danych:**
- `interface NodeTransformDelta` { nodeId, localBefore, localAfter } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solve-constraints-command.ts#L15)

### [S2_solver/solver-bridge.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts)

**Funkcje:**
- `export` `solverQuatFromCad(q: Quat): SolverQuat` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L87)
- `export` `cadQuatFromSolver(q: SolverQuat): Quat` [L91](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L91)
- `worldTransformMm(node: CADNode): { location: SolverVec3; rotation: SolverQuat; s...` [L95](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L95)
- `isUnitScale(scale: Vec3): boolean` [L104](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L104)
- `fmt3(v: ConstraintAnchor['localPointMm'] | undefined): string` [L112](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L112)
- `anchorKey(anchor: ConstraintAnchor): string` [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L116)
- `export` `buildSolverInput(document: ProjectDocument, constraints: SolverConstraint[]): SolverInput` [L125](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L125)
- `export` `isBlokiContainer(node: CADNode | null): boolean` [L386](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L386)
- `export` `isBlokiComponent(node: CADNode | null): boolean` [L400](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L400)
- `export` `isSmartFrameContainer(node: CADNode | null): boolean` [L407](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L407)
- `export` `isSmartFrameEngineComponent(node: CADNode | null): boolean` [L418](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L418)
- `export` `isSmartPanel(node: CADNode | null): boolean` [L427](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L427)
- `domainOf(node: CADNode): any` [L435](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L435)
- `export` `isSmartWallAssembly(node: CADNode | null): boolean` [L440](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L440)
- `export` `isSmartWallPart(node: CADNode | null): boolean` [L446](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L446)
- `export` `isSmartFloorAssembly(node: CADNode | null): boolean` [L453](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L453)
- `export` `isSmartFloorPart(node: CADNode | null): boolean` [L459](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L459)
- `export` `isRoomArchitecture(node: CADNode | null): boolean` [L467](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L467)
- `export` `getNodeGroundingPriority(node: CADNode | null): number` [L481](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L481)
- `export` `computeReferenceLockedIds(constraints: SolverConstraint[], document?: ProjectDocument): Set<string>` [L500](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L500)
- `resolveGroundTarget(constraint: SolverConstraint, state: ObjectState, item: ConstraintItem): GroundTarget` [L635](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L635)
- `nodeDepth(node: CADNode): number` [L684](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L684)
- `export` `collectTransformDeltas(input: SolverInput, toleranceNm: number): AppliedTransform[]` [L703](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L703)
- `matricesClose(a: Mat4, b: Mat4, toleranceNm: number): boolean` [L759](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L759)

**Typy i Modele Danych:**
- `interface CapturedGroundTarget` { constraintId, groundPosMm, groundNormal } [L68](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L68)
- `interface SolverInput` { contract, states, nodes, localBefore, captured, warnings, constraintById } [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L74)
- `interface GroundTarget` { groundPosMm, groundNormal, wasCaptured } [L625](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L625)
- `interface AppliedTransform` { nodeId, localBefore, localAfter } [L678](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts#L678)

### [S2_solver/solver-controller.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-controller.ts)

**Klasy:**
- `class SolverController` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-controller.ts#L25)
  - `constructor(store: ConstraintStore): void` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-controller.ts#L37)
  - `attach(document: ProjectDocument, history: CommandHistory): () => void` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-controller.ts#L41)
  - `detach(): void` [L57](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-controller.ts#L57)
  - `beginInteractiveTransform(): void` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-controller.ts#L71)
  - `endInteractiveTransform(): void` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-controller.ts#L80)
  - `requestSolve(): void` [L96](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-controller.ts#L96)
  - `solveNow(scope?: { nodeIds?: Set<string>; onCommand?: (deltas: N...): boolean` [L116](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-controller.ts#L116)

**Funkcje:**
- `issuesFromBridgeWarnings(warnings: string[]): ConstraintValidationIssue[]` [L307](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-controller.ts#L307)

### [S2_solver/solver-ui-config.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui-config.ts)

**Typy i Modele Danych:**
- `interface AddButtonDef` { bindType, label, title, icon } [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui-config.ts#L12)

**Stałe i Słowniki:**
- `const SOLVER_PANEL_TITLE` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui-config.ts#L8)
- `const CONFLICT_REJECT_MESSAGE` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui-config.ts#L10)
- `const ADD_BUTTONS: AddButtonDef[]` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui-config.ts#L20)
- `const BIND_TYPE_ICON: Record<BindType, string>` [L47](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui-config.ts#L47)
- `const BIND_TYPE_LABEL: Record<BindType, string>` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui-config.ts#L54)
- `const GROUND_MODE_OPTIONS: Array<{ kind: AnchorKind; label: string }>` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui-config.ts#L61)

### [S2_solver/solver-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui.tsx)

**Funkcje:**
- `export` `SolverUI({ projectModel }: Props): any` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui.tsx#L27)

**Typy i Modele Danych:**
- `interface Props` { projectModel } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-ui.tsx#L20)

### [S2_solver/solver-visibility.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-visibility.ts)

**Funkcje:**
- `export` `getSolverShowOnlySmartFrame(): boolean` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-visibility.ts#L12)
- `export` `setSolverShowOnlySmartFrame(value: boolean): void` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-visibility.ts#L16)
- `export` `isSolverTabActive(): boolean` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-visibility.ts#L21)
- `export` `isSolverPickActive(): boolean` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-visibility.ts#L25)
- `export` `isSolverSmartFrameIsolationActive(): boolean` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-visibility.ts#L30)
- `export` `notifySolverVisibilityChanged(): void` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-visibility.ts#L34)
- `export` `resolveSolverPanelVisibility(options: { modelVisible: boolean; smartFrameOnly: boolea...): { enabled: boolean; visibility: number; isVisib...` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-visibility.ts#L48)
- `export` `applyMeshSolverVisibility(mesh: any, state: ReturnType<typeof resolveSolverPanelVisibility>): void` [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-visibility.ts#L79)
- `export` `applyPanelViewSolverVisibility(3 params): void` [L94](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-visibility.ts#L94)

## <a id="s3_scena"></a>S3 Scena (Zarządzanie Środowiskiem 3D)

### [S3_scena/named-camera-view.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/named-camera-view.ts)

**Funkcje:**
- `export` `namedCameraView(view: string): { alpha: number; beta: number; up: CameraUp }` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/named-camera-view.ts#L20)
- `export` `orthoParallaxMm(heightDeltaMm: number, betaFromVerticalRad: number): number` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/named-camera-view.ts#L40)

**Typy i Modele Danych:**
- `type NamedSceneView` = `'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/named-camera-view.ts#L9)
- `type CameraUp` = `{ x: number; y: number; z: number }` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/named-camera-view.ts#L11)

**Stałe i Słowniki:**
- `const WORLD_Y_UP: CameraUp` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/named-camera-view.ts#L13)
- `const TOP_BETA` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/named-camera-view.ts#L16)
- `const BOTTOM_BETA` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/named-camera-view.ts#L18)

### [S3_scena/viewport-document-extension.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport-document-extension.ts)

**Funkcje:**
- `export` `serializeViewport(viewport: Viewport): ViewportExtensionJSON` [L26](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport-document-extension.ts#L26)
- `export` `applyViewport(viewport: Viewport, data: ViewportExtensionJSON | null | undefined): void` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport-document-extension.ts#L42)
- `export` `attachViewportExtension(document: ProjectDocument, viewport: Viewport): () => void` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport-document-extension.ts#L60)

**Typy i Modele Danych:**
- `interface ViewportCameraJSON` { alpha, beta, radius, target } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport-document-extension.ts#L14)
- `interface ViewportExtensionJSON` { version, camera } [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport-document-extension.ts#L21)

**Stałe i Słowniki:**
- `const VIEWPORT_DOCUMENT_SECTION` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport-document-extension.ts#L11)
- `const VIEWPORT_EXTENSION_VERSION` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport-document-extension.ts#L12)

### [S3_scena/viewport.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts)

**Klasy:**
- `class Viewport` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L29)
  - `shouldSuppressContextMenu(): boolean` [L69](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L69)
  - `requestRender(frames: number): void` [L77](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L77)
  - `applyCameraPose(4 params): void` [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L87)
  - `create(canvas: any): void` [L124](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L124)
  - `constructor(canvas: any, engine: any): void` [L167](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L167)
  - `toggleInspector(): void` [L591](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L591)
  - `_createGroundGrid(): void` [L612](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L612)
  - `toggleGrid(visible): void` [L733](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L733)
  - `setRenderMode(mode: 'shaded' | 'edges' | 'wireframe' | 'xray'): void` [L757](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L757)
  - `applyRenderModeToMeshes(): void` [L765](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L765)
  - `applyRenderModeToMesh(mesh: any, mode?: string): void` [L784](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L784)
  - `toggleCameraProjection(): void` [L839](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L839)
  - `_updateOrthographicBounds(): void` [L863](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L863)
  - `zoomToFit(): void` [L884](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L884)
  - `zoomToWindow(startX: number, startY: number, endX: number, endY: number): void` [L892](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L892)
  - `animateCameraTo(alpha, beta, radius, target, up?: CameraUp): void` [L941](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L941)
  - `_applyCameraUp(up: CameraUp): void` [L969](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L969)
  - `setPanToolActive(active: boolean): void` [L998](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L998)
  - `togglePanTool(): boolean` [L1005](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L1005)
  - `dispose(): void` [L1010](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L1010)
  - `setViewCubeCssTransform(cssTransform: string): void` [L1021](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L1021)
  - `getViewCubeBaseCssFromCamera(): string` [L1029](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L1029)
  - `getViewCubeCssTransform(): string | null` [L1036](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L1036)
  - `clearViewCubeOverride(): void` [L1040](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L1040)
  - `_syncViewCube(): void` [L1052](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L1052)

**Typy i Modele Danych:**
- `interface CameraRotationSession` { begin, move, end } [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L17)
- `type CameraRotationFactory` = `( camera: any, scene: any, canvas: HTMLCanvasElement ) =>...` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S3_scena/viewport.ts#L23)

## <a id="s4_sciany"></a>S4 Ściany (Ściany Pomieszczeń, Układ Wnętrz)

### [S4_sciany/commands/add-wall-pillar-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/add-wall-pillar-command.ts)

**Klasy:**
- `class AddWallPillarCommand` *implements Command* [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/add-wall-pillar-command.ts#L11)
  - `constructor(3 params): void` [L19](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/add-wall-pillar-command.ts#L19)
  - `execute(document: ProjectDocument): void` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/add-wall-pillar-command.ts#L33)
  - `undo(document: ProjectDocument): void` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/add-wall-pillar-command.ts#L37)

### [S4_sciany/commands/create-smartfloor-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartfloor-command.ts)

**Klasy:**
- `class CreateSmartFloorCommand` *implements Command* [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartfloor-command.ts#L23)
  - `constructor(params: CreateSmartFloorParamsMm): void` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartfloor-command.ts#L32)
  - `execute(document: ProjectDocument): void` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartfloor-command.ts#L40)
  - `undo(document: ProjectDocument): void` [L84](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartfloor-command.ts#L84)

**Typy i Modele Danych:**
- `interface CreateSmartFloorParamsMm` *extends SmartFloorDragPayload* { position } [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartfloor-command.ts#L18)

### [S4_sciany/commands/create-smartwall-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartwall-command.ts)

**Klasy:**
- `class CreateSmartWallCommand` *implements Command* [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartwall-command.ts#L35)
  - `constructor(params: CreateSmartWallParamsMm): void` [L44](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartwall-command.ts#L44)
  - `execute(document: ProjectDocument): void` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartwall-command.ts#L52)
  - `undo(document: ProjectDocument): void` [L126](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartwall-command.ts#L126)

**Typy i Modele Danych:**
- `interface CreateSmartWallParamsMm` { name, preset, roomWidth, roomDepth, wallHeight, wallThickness, singleLength, uskokGapStart, +7 more } [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/create-smartwall-command.ts#L16)

### [S4_sciany/commands/set-smartfloor-params-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartfloor-params-command.ts)

**Klasy:**
- `class SetSmartFloorParamsCommand` *implements Command* [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartfloor-params-command.ts#L36)
  - `constructor(3 params): void` [L46](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartfloor-params-command.ts#L46)
  - `snapshotFrom(container: any): SmartFloorParamsSnapshotMm` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartfloor-params-command.ts#L56)
  - `execute(document: ProjectDocument): void` [L71](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartfloor-params-command.ts#L71)
  - `undo(document: ProjectDocument): void` [L75](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartfloor-params-command.ts#L75)

**Funkcje:**
- `readSnapshotMm(container: any): SmartFloorParamsSnapshotMm` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartfloor-params-command.ts#L13)
- `writeSnapshotNm(container: any, snap: SmartFloorParamsSnapshotMm): void` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartfloor-params-command.ts#L25)

**Typy i Modele Danych:**
- `type SmartFloorParamsSnapshotMm` = `SmartFloorParamsMm` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartfloor-params-command.ts#L11)

### [S4_sciany/commands/set-smartwall-params-command.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartwall-params-command.ts)

**Klasy:**
- `class SetSmartWallParamsCommand` *implements Command* [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartwall-params-command.ts#L79)
  - `constructor(3 params): void` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartwall-params-command.ts#L89)
  - `snapshotFrom(container: any): SmartWallParamsSnapshotMm` [L99](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartwall-params-command.ts#L99)
  - `execute(document: ProjectDocument): void` [L114](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartwall-params-command.ts#L114)
  - `undo(document: ProjectDocument): void` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartwall-params-command.ts#L118)

**Funkcje:**
- `readSnapshotMm(container: any): SmartWallParamsSnapshotMm` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartwall-params-command.ts#L27)
- `writeSnapshotNm(container: any, snap: SmartWallParamsSnapshotMm): void` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartwall-params-command.ts#L49)

**Typy i Modele Danych:**
- `interface SmartWallParamsSnapshotMm` { preset, roomWidth, roomDepth, wallHeight, wallThickness, singleLength, uskokGapStart, uskokGapEnd, +5 more } [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/commands/set-smartwall-params-command.ts#L11)

### [S4_sciany/pillars-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/pillars-engine.ts)

**Funkcje:**
- `defSideMm(): number` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/pillars-engine.ts#L10)
- `defHeightMm(): number` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/pillars-engine.ts#L15)
- `export` `planPillars(fills: SmartWallFillMm[] | undefined, defaultHeightMm?: number): { parts: SmartWallPartPlanMm[] }` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/pillars-engine.ts#L20)
- `export` `defaultPillarFillMm(key): SmartWallFillMm` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/pillars-engine.ts#L55)

### [S4_sciany/register.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/register.ts)

**Funkcje:**
- `export` `registerScianyModule(): void` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/register.ts#L11)
- `export` `unregisterScianyModule(): void` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/register.ts#L24)

### [S4_sciany/sciany-ui.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/sciany-ui.tsx)

**Funkcje:**
- `executeCmd(cmd: { execute: (doc: any) => void }): void` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/sciany-ui.tsx#L25)
- `getActiveSmartWall(): any | null` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/sciany-ui.tsx#L35)
- `getDragController(): SmartWallDragController` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/sciany-ui.tsx#L48)
- `CardIcon({ kind }: { kind: 'rect' | 'single' | 'skos' }): any` [L64](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/sciany-ui.tsx#L64)
- `export` `ScianyUI(_props: Props): any` [L115](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/sciany-ui.tsx#L115)

**Typy i Modele Danych:**
- `interface Props` { projectModel } [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/sciany-ui.tsx#L21)

### [S4_sciany/skos-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/skos-engine.ts)

**Funkcje:**
- `export` `skosOutline2dMm(4 params): number[][]` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/skos-engine.ts#L37)
- `export` `planSkos(params: SkosPlanParamsMm): { parts: SmartWallPartPlanMm[] }` [L58](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/skos-engine.ts#L58)

**Typy i Modele Danych:**
- `interface SkosPlanParamsMm` { skosLength, skosHeightLeft, skosHeightRight, wallThickness, skosSlant } [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/skos-engine.ts#L20)
- `type SkosSlant` = `'top' | 'bottom'` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/skos-engine.ts#L18)

**Stałe i Słowniki:**
- `const SKOS_DEFAULTS_MM` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/skos-engine.ts#L28)

### [S4_sciany/smartfloor-core.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-core.ts)

**Funkcje:**
- `export` `ensureSmartFloorGeneratorParams(container: any): void` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-core.ts#L23)
- `gpMm(container: any): SmartFloorParamsMm` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-core.ts#L28)
- `applyFloorToPanel(panel: PanelModel, p: SmartFloorParamsMm): void` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-core.ts#L41)
- `export` `rebuildSmartFloor(container: any, doc?: any): boolean` [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-core.ts#L63)
- `export` `syncAllSmartFloors(doc: any, containers: any[]): void` [L123](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-core.ts#L123)

### [S4_sciany/smartfloor-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-types.ts)

**Funkcje:**
- `export` `isSmartFloorContainer(container: any): boolean` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-types.ts#L31)
- `export` `isFloorPart(panel: any): boolean` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-types.ts#L35)

**Typy i Modele Danych:**
- `interface SmartFloorParamsMm` { floorWidth, floorDepth, floorThickness } [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-types.ts#L14)
- `interface SmartFloorDragPayload` { name, floorWidth, floorDepth, floorThickness } [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-types.ts#L21)
- `type FloorPartRole` = `'FLOOR'` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-types.ts#L11)

**Stałe i Słowniki:**
- `const SMARTFLOOR_TYPE` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-types.ts#L6)
- `const SMARTFLOOR_DRAG_MIME` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-types.ts#L9)
- `const FLOOR_DEFAULT_COLOR` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartfloor-types.ts#L29)

### [S4_sciany/smartwall-core.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-core.ts)

**Funkcje:**
- `export` `ensureSmartWallGeneratorParams(container: any): void` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-core.ts#L25)
- `gpMm(container: any): any` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-core.ts#L32)
- `buildCombinedPlan(container: any): SmartWallPartPlanMm[]` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-core.ts#L55)
- `applyPartToPanel(panel: PanelModel, part: SmartWallPartPlanMm): void` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-core.ts#L80)
- `resolvePanelDimsMm(part: SmartWallPartPlanMm): { bbWidth: number; bbHeight: number; bbThicknes...` [L106](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-core.ts#L106)
- `rotFromPart(part: SmartWallPartPlanMm): Quat` [L118](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-core.ts#L118)
- `export` `rebuildSmartWall(container: any, doc?: any): boolean` [L132](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-core.ts#L132)
- `export` `syncAllSmartWalls(doc: any, containers: any[]): void` [L216](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-core.ts#L216)

### [S4_sciany/smartwall-drag-controller.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-drag-controller.ts)

**Klasy:**
- `class SmartWallDragController` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-drag-controller.ts#L60)
  - `startDrag(payload: SmartWallDragPayload): void` [L83](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-drag-controller.ts#L83)
  - `startDragFloor(payload: SmartFloorDragPayload): void` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-drag-controller.ts#L93)
  - `endDrag(): void` [L100](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-drag-controller.ts#L100)
  - `onPointerMoveOnScene(scene: any, pointerX: number, pointerY: number): { x: number; y: number } | null` [L147](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-drag-controller.ts#L147)
  - `onDropOnScene(docTarget?: any): boolean` [L183](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-drag-controller.ts#L183)

**Funkcje:**
- `dimsForPreset(payload: SmartWallDragPayload): GhostDims` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-drag-controller.ts#L28)
- `dimsForFloor(payload: SmartFloorDragPayload): GhostDims` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-drag-controller.ts#L52)

**Typy i Modele Danych:**
- `interface GhostDims` { width, depth, height } [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-drag-controller.ts#L22)

### [S4_sciany/smartwall-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts)

**Funkcje:**
- `export` `isSmartWallContainer(container: any): boolean` [L74](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L74)
- `export` `isWallPart(panel: any): boolean` [L78](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L78)
- `export` `isExcludedFromProduction(panel: any): boolean` [L86](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L86)

**Typy i Modele Danych:**
- `interface SmartWallFillMm` { key, name, x, y, z, length, thickness, height, +1 more } [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L15)
- `interface SmartWallPlacementMm` { x, y, z } [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L28)
- `interface SmartWallDragPayload` { preset, name, roomWidth, roomDepth, wallHeight, wallThickness, singleLength, uskokGapStart, +6 more } [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L35)
- `interface SmartWallPartPlanMm` { key, name, role, loc, dim, rotationDeg, lcs, edge_banding, +2 more } [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L52)
- `type SmartWallPreset` = `'rect' | 'empty' | 'single' | 'uskok' | 'skos'` [L10](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L10)
- `type WallPartRole` = `'WALL' | 'WALL_PILLAR' | 'FLOOR' | 'SKOS'` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L12)

**Stałe i Słowniki:**
- `const SMARTWALL_TYPE` [L5](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L5)
- `const SMARTWALL_DRAG_MIME` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/smartwall-types.ts#L8)

### [S4_sciany/walls-engine.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts)

**Funkcje:**
- `defMm(2 params): number` [L42](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L42)
- `wallPart(7 params): SmartWallPartPlanMm` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L72)
- `floorPart(roomWidth: number, roomDepth: number, thickness: number): SmartWallPartPlanMm` [L129](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L129)
- `export` `planWalls(params: WallsPlanParamsMm): { parts: SmartWallPartPlanMm[] }` [L158](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L158)

**Typy i Modele Danych:**
- `interface WallsPlanParamsMm` { preset, roomWidth, roomDepth, wallHeight, wallThickness, singleLength, uskokGapStart, uskokGapEnd } [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L48)
- `type WallAlong` = `'FRONT' | 'BACK' | 'LEFT' | 'RIGHT'` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L59)

**Stałe i Słowniki:**
- `const WALL_FRONT_LCS` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L16)
- `const WALL_BACK_LCS` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L22)
- `const WALL_ALONG_X_LCS` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L28)
- `const WALL_LEFT_LCS` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L31)
- `const WALL_RIGHT_LCS` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L37)
- `const WALL_SURFACE_EDGE_BANDING` [L62](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L62)
- `const WALL_DEFAULT_COLOR` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S4_sciany/walls-engine.ts#L70)

## <a id="s5_studio"></a>S5 Studio (Wizualny Edytor SmartParts / Komponentów)

### [S5_studio/custom-smartpart-apply.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/custom-smartpart-apply.ts)

**Funkcje:**
- `export` `computeAnalyticalBaseUv(5 params): { u: number; v: number }` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/custom-smartpart-apply.ts#L48)
- `buildFeaturesFromDefinition(2 params): any[]` [L80](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/custom-smartpart-apply.ts#L80)
- `replaceSmartPartFeaturesOnPanel(panelModel: any, containerId: string, nextFeatures: any[]): void` [L157](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/custom-smartpart-apply.ts#L157)
- `export` `applyCustomSmartPartToPanel(document: any, params: CustomSmartPartApplyParams): CADNode | null` [L177](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/custom-smartpart-apply.ts#L177)
- `export` `updateCustomSmartPartParams(document: any, container: any, nextValues: SmartPartParamValues): boolean` [L257](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/custom-smartpart-apply.ts#L257)
- `export` `isCustomSmartPartModel(model: any): boolean` [L305](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/custom-smartpart-apply.ts#L305)
- `export` `isHangerSmartPartGroup(model: any): boolean` [L321](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/custom-smartpart-apply.ts#L321)

**Typy i Modele Danych:**
- `interface CustomSmartPartApplyParams` { definition, targetPanelNode, pickUvMm, faceName, paramValues } [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/custom-smartpart-apply.ts#L35)

**Stałe i Słowniki:**
- `const SMARTPART_CUSTOM_TYPE` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/custom-smartpart-apply.ts#L33)

### [S5_studio/floating-smartpart-dialog.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/floating-smartpart-dialog.tsx)

**Funkcje:**
- `export` `FloatingSmartPartDialog(): null` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/floating-smartpart-dialog.tsx#L9)

**Stałe i Słowniki:**
- `const CAD_CLOSE_FLOATING_SMARTPART` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/floating-smartpart-dialog.tsx#L6)

### [S5_studio/smartpart-custom-store.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts)

**Funkcje:**
- `export` `allocSmartPartPackageId(name?: string): string` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L21)
- `export` `allocSmartPartBodyId(parentSpId: string, role): string` [L29](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L29)
- `export` `allocSmartPartCutId(parentSpId: string, cutType): string` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L36)
- `export` `allocSmartPartSetId(parentSpId: string, role): string` [L43](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L43)
- `export` `createEmptySmartPartPackage(name): SmartPartPackageDefinition` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L50)
- `getStorage(): Storage | null` [L177](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L177)
- `export` `listSmartPartPackages(): SmartPartPackageDefinition[]` [L190](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L190)
- `export` `saveSmartPartPackage(def: SmartPartPackageDefinition): void` [L231](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L231)
- `export` `deleteSmartPartPackage(idOrName: string): void` [L268](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L268)
- `export` `clearCustomSmartPartPackages(): void` [L296](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L296)
- `export` `exportSmartPartPackageJson(def: SmartPartPackageDefinition): void` [L312](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L312)
- `export` `exportSmartPartIconPng(iconDataUrl: string, name: string): void` [L347](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L347)
- `export` `importSmartPartPackageJson(jsonStr: string): SmartPartPackageDefinition` [L381](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L381)

**Stałe i Słowniki:**
- `const SMARTPARTS_STORAGE_KEY` [L13](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L13)
- `const SMARTPARTS_CUSTOM_STORAGE_KEY` [L14](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L14)
- `const CAD_SMARTPARTS_CHANGED` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L15)
- `const CAD_CUSTOM_SMARTPARTS_CHANGED` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L16)
- `const DEFAULT_HANGER_SMARTPART: SmartPartPackageDefinition` [L82](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-custom-store.ts#L82)

### [S5_studio/smartpart-driver-clipboard.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-driver-clipboard.ts)

**Funkcje:**
- `notify(): void` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-driver-clipboard.ts#L23)
- `export` `copyDrivingParameter(opts: { targetType?: SmartPartTargetType; targetId?: ...): DrivingFieldClipboard` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-driver-clipboard.ts#L28)
- `export` `getDrivingParameterClipboard(): DrivingFieldClipboard | null` [L50](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-driver-clipboard.ts#L50)
- `export` `clearDrivingParameterClipboard(): void` [L54](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-driver-clipboard.ts#L54)
- `export` `subscribeDrivingParameterClipboard(listener: () => void): () => void` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-driver-clipboard.ts#L60)

**Typy i Modele Danych:**
- `type DrivingFieldClipboard` = `{ targetType: SmartPartTargetType; targetId: string; fiel...` [L8](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-driver-clipboard.ts#L8)

### [S5_studio/smartpart-edit-panel.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-edit-panel.tsx)

**Funkcje:**
- `resolveEditContainer(container: any, doc: any): any` [L23](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-edit-panel.tsx#L23)
- `export` `SmartPartEditPanel({ container }: { container: any }): React.JSX.Element | null` [L40](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-edit-panel.tsx#L40)

### [S5_studio/smartpart-object-link-clipboard.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-object-link-clipboard.ts)

**Funkcje:**
- `notify(): void` [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-object-link-clipboard.ts#L16)
- `export` `copyObjectLink(opts: { targetType: 'PART' | 'CUT'; targetId: string;...): ObjectLinkClipboard` [L21](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-object-link-clipboard.ts#L21)
- `export` `getObjectLinkClipboard(): ObjectLinkClipboard | null` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-object-link-clipboard.ts#L35)
- `export` `clearObjectLinkClipboard(): void` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-object-link-clipboard.ts#L39)
- `export` `subscribeObjectLinkClipboard(listener: () => void): () => void` [L45](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-object-link-clipboard.ts#L45)

**Typy i Modele Danych:**
- `type ObjectLinkClipboard` = `{ targetType: 'PART' | 'CUT'; targetId: string; /** Nazwa...` [L6](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-object-link-clipboard.ts#L6)

### [S5_studio/smartpart-param-panel.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-param-panel.tsx)

**Funkcje:**
- `clampToParam(p: Extract<SmartPartParameter, { type: 'number' }>, v: number): number` [L22](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-param-panel.tsx#L22)
- `export` `SmartPartParamPanel(1 params): React.JSX.Element | null` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-param-panel.tsx#L32)

**Typy i Modele Danych:**
- `interface SmartPartParamPanelProps` { parameters, values, onChange } [L16](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-param-panel.tsx#L16)

### [S5_studio/smartpart-params.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts)

**Funkcje:**
- `export` `isSmartPartCheckOn(raw: unknown): boolean` [L41](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L41)
- `export` `applyFrozenBindings(def: SmartPartPackageDefinition, values: SmartPartParamValues): SmartPartPackageDefinition` [L49](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L49)
- `export` `defaultSmartPartParamValues(def: Pick<SmartPartPackageDefinition, 'parameters'>): SmartPartParamValues` [L98](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L98)
- `export` `resolveBindingTarget(b: SmartPartBinding): { targetType: SmartPartTargetType; targetId: st...` [L109](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L109)
- `export` `assertValidSmartPartParams(def: SmartPartPackageDefinition): void` [L119](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L119)
- `clampNumber(p: Extract<SmartPartParameter, { type: 'number' }>, v: number): number` [L177](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L177)
- `getTargetFieldValue(def: SmartPartPackageDefinition, b: SmartPartBinding): number | undefined` [L185](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L185)
- `export` `syncParameterDefaultsFromBindings(def: SmartPartPackageDefinition): SmartPartPackageDefinition` [L202](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L202)
- `export` `initialSmartPartParamValues(def: SmartPartPackageDefinition): SmartPartParamValues` [L224](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L224)
- `export` `resolveSmartPartParams(def: SmartPartPackageDefinition, values: SmartPartParamValues): SmartPartPackageDefinition` [L239](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L239)
- `export` `getBinding(4 params): SmartPartBinding | undefined` [L366](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L366)
- `export` `getPartFieldBinding(3 params): SmartPartBinding | undefined` [L379](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L379)
- `export` `makeNumberParamKey(label: string): string` [L388](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L388)
- `export` `upsertBinding(3 params): SmartPartPackageDefinition` [L399](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L399)
- `export` `upsertPartFieldBinding(4 params): SmartPartPackageDefinition` [L421](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L421)
- `export` `removeBinding(4 params): SmartPartPackageDefinition` [L431](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L431)
- `export` `removePartFieldBinding(3 params): SmartPartPackageDefinition` [L445](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L445)
- `export` `addNumberParameter(2 params): SmartPartPackageDefinition` [L454](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L454)
- `export` `makeCheckParamKey(label: string): string` [L477](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L477)
- `export` `addCheckParameter(2 params): SmartPartPackageDefinition` [L488](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L488)
- `export` `addListParameter(2 params): SmartPartPackageDefinition` [L509](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L509)
- `export` `reorderParameters(def: SmartPartPackageDefinition, fromIndex: number, toIndex: number): SmartPartPackageDefinition` [L542](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L542)
- `export` `removeParameter(def: SmartPartPackageDefinition, paramKey: string): SmartPartPackageDefinition` [L555](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L555)

**Typy i Modele Danych:**
- `type SmartPartParamValues` = `Record<string, number | string | boolean>` [L25](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-params.ts#L25)

### [S5_studio/smartpart-studio-scene.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts)

**Klasy:**
- `class SmartPartStudioScene` [L70](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L70)
  - `constructor(3 params): void` [L121](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L121)
  - `setPanToolActive(active: boolean): void` [L366](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L366)
  - `togglePanTool(): boolean` [L373](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L373)
  - `getPanToolActive(): boolean` [L378](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L378)
  - `setTransformTool(tool: TransformToolMode): void` [L494](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L494)
  - `getTransformTool(): TransformToolMode` [L499](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L499)
  - `updateDefinition(def: SmartPartPackageDefinition, selectedId?: string | null): void` [L685](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L685)
  - `captureThumbnail(targetWidth: number, targetHeight: number): string` [L1462](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1462)
  - `setView(view: string): void` [L1502](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1502)
  - `animateCameraTo(5 params): void` [L1511](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1511)
  - `setViewPreset(preset: CameraViewPreset): void` [L1580](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1580)
  - `toggleProjection(): boolean` [L1598](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1598)
  - `isOrthographic(): boolean` [L1617](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1617)
  - `resetCamera(): void` [L1622](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1622)
  - `setGridVisible(visible: boolean): void` [L1632](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1632)
  - `setLcsVisible(visible: boolean): void` [L1638](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1638)
  - `setRenderMode(mode: string): void` [L1661](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1661)
  - `dispose(): void` [L1699](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L1699)

**Funkcje:**
- `collectActiveWallRefs(def: SmartPartPackageDefinition): Set<ActiveWallRef>` [L37](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L37)
- `cadPosToBabylon(xMm: number, yMm: number, zMm: number): { x: number; y: number; z: number }` [L55](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L55)

**Typy i Modele Danych:**
- `interface TransformUpdateEvent` { xMm, yMm, zMm, axis } [L63](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L63)
- `type ActiveWallRef` = `'LEFT' | 'RIGHT' | 'FRONT' | 'BACK' | 'TOP' | 'BOTTOM'` [L35](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L35)
- `type CameraViewPreset` = `'ISO' | 'TOP' | 'FRONT' | 'SIDE'` [L60](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L60)
- `type TransformToolMode` = `'select' | 'translate' | 'rotate'` [L61](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-scene.ts#L61)

### [S5_studio/smartpart-studio-types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts)

**Funkcje:**
- `export` `computeAbsoluteFromReference(7 params): { xMm: number; yMm: number; zMm: number }` [L171](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L171)
- `export` `computeReferenceFromAbsolute(7 params): { offsetX_mm: number; offsetY_mm: number; offse...` [L208](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L208)
- `export` `ensurePackageSets(pkg: SmartPartPackageDefinition): SmartPartPackageDefinition` [L345](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L345)
- `export` `holeOutwardDirectionForRef(axis: CutAxis, refX?: string, refY?: string, refZ?: string): 1 | -1 | null` [L382](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L382)
- `export` `cutOrientFromRefs(cut: { axis?: CutAxis; direction?: 1 | -1; refX?: st...): { axis: CutAxis; direction: 1 | -1 }` [L405](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L405)
- `export` `holeCenterFromOriginCad(cut: { xMm: number; yMm: number; zMm: number; length...): { xMm: number; yMm: number; zMm: number }` [L436](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L436)
- `export` `pocketCenterFromOriginCad(pocket: { xMm: number; yMm: number; zMm: number; widthM...): { xMm: number; yMm: number; zMm: number }` [L455](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L455)
- `export` `calculateCutProtrusion(3 params): CutProtrusionInfo` [L480](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L480)
- `export` `partDimsAsMain(part: { widthMm: number; heightMm: number; depthMm: n...): MainContainerDims` [L556](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L556)
- `export` `findPartForCut(2 params): SmartPartBodyItem | undefined` [L568](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L568)
- `cutInsidePartLocal(2 params): boolean` [L587](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L587)
- `export` `cutsOwnedByLiveParts(def: { parts?: SmartPartBodyItem[]; partBody?: Smart...): SmartPartCut[]` [L603](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L603)
- `export` `orphanSmartPartCuts(def: { parts?: SmartPartBodyItem[]; partBody?: Smart...): SmartPartCut[]` [L630](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L630)
- `export` `sanitizeSmartPartCuts(def: SmartPartPackageDefinition): SmartPartPackageDefinition` [L651](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L651)
- `export` `cutAbsoluteInMain(2 params): { xMm: number; yMm: number; zMm: number }` [L658](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L658)
- `isLegacyStudioCoords(item: { refY?: string; refZ?: string } | null | undef...): boolean` [L673](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L673)
- `migratePlacedItemYZX(item: T): T` [L681](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L681)
- `cutsAlreadyPartLocal(def: SmartPartPackageDefinition): boolean` [L703](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L703)
- `migrateCutsToPartLocal(def: SmartPartPackageDefinition): SmartPartPackageDefinition` [L720](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L720)
- `syncWallAbsolute(item: T, dims: MainContainerDims): T` [L769](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L769)
- `export` `normalizeSmartPartToCadCoords(def: SmartPartPackageDefinition): SmartPartPackageDefinition` [L796](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L796)

**Typy i Modele Danych:**
- `interface SmartPartHoleCut` { id, name, type, diameterMm, lengthMm, xMm, yMm, zMm, +11 more } [L38](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L38)
- `interface SmartPartPocketCut` { id, name, type, widthMm, heightMm, depthMm, xMm, yMm, +12 more } [L79](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L79)
- `interface MainContainerDims` { widthMm, heightMm, depthMm } [L125](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L125)
- `interface SmartPartSetItem` { id, name, description, visible } [L131](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L131)
- `interface SmartPartBodyItem` { id, name, setId, widthMm, heightMm, depthMm, xMm, yMm, +11 more } [L140](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L140)
- `interface CutProtrusionInfo` { cutId, cutName, type, leftXMinusMm, rightXPlusMm, bottomYMinusMm, topYPlusMm, backZMinusMm, +1 more } [L237](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L237)
- `interface SmartPartListOption` { key, label, glbPath } [L251](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L251)
- `interface SmartPartBinding` { paramKey, targetType, targetId, field, partId } [L300](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L300)
- `interface SmartPartPackageDefinition` { parameters, bindings, id, name, units, version, type, coordSystem, +8 more } [L312](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L312)
- `type CutType` = `'HOLE' | 'POCKET'` [L18](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L18)
- `type CutAxis` = `'X' | 'Y' | 'Z'` [L20](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L20)
- `type SmartPartCoordSystem` = `'CAD'` [L27](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L27)
- `type XRefWall` = `'LEFT' | 'RIGHT' | 'CENTER'` [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L30)
- `type YRefWall` = `'BACK' | 'FRONT' | 'CENTER'` [L33](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L33)
- `type ZRefWall` = `'BOTTOM' | 'TOP' | 'CENTER'` [L36](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L36)
- `type SmartPartCut` = `SmartPartHoleCut | SmartPartPocketCut` [L122](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L122)
- `type PartBodyConfig` = `SmartPartBodyItem` [L166](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L166)
- `type SmartPartParameter` = `| { key: string; type: 'number'; label?: string; default_...` [L260](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L260)
- `type SmartPartTargetType` = `'PART' | 'CUT' | 'MAIN'` [L284](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L284)
- `type SmartPartBindingField` = `| 'offsetX_mm' | 'offsetY_mm' | 'offsetZ_mm' | 'widthMm' ...` [L287](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/smartpart-studio-types.ts#L287)

### [S5_studio/SmartPartStudioModal.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/SmartPartStudioModal.tsx)

**Funkcje:**
- `export` `SmartPartStudioModal(1 params): React.JSX.Element | null` [L93](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/SmartPartStudioModal.tsx#L93)

**Typy i Modele Danych:**
- `interface SmartPartStudioModalProps` { isOpen, onClose, initialDefinition } [L87](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/SmartPartStudioModal.tsx#L87)

### [S5_studio/studio-panel-tab.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/studio-panel-tab.tsx)

**Funkcje:**
- `export` `StudioPanelTab(1 params): React.JSX.Element` [L59](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/studio-panel-tab.tsx#L59)

**Typy i Modele Danych:**
- `interface StudioPanelTabProps` { def, previewValues, onDefChange, onPreviewChange, selectedTargetId } [L30](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/studio-panel-tab.tsx#L30)
- `type PaletteType` = `'number' | 'list' | 'check'` [L39](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/studio-panel-tab.tsx#L39)

### [S5_studio/StudioApp.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/StudioApp.tsx)

**Funkcje:**
- `resolveInitialDefinition(): SmartPartPackageDefinition` [L102](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/StudioApp.tsx#L102)
- `export` `StudioApp(): React.JSX.Element` [L173](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/StudioApp.tsx#L173)

**Typy i Modele Danych:**
- `type SelectionTarget` = `'main_container' | string` [L171](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/S5_studio/StudioApp.tsx#L171)

## <a id="t1_tlumaczenia"></a>T1 Tłumaczenia (Wielojęzyczność PL/EN/DE)

### [T1_tlumaczenia/core.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/core.ts)

**Funkcje:**
- `detectInitialLocale(): LocaleCode` [L31](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/core.ts#L31)
- `export` `getLocale(): LocaleCode` [L48](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/core.ts#L48)
- `export` `getSupportedLocales(): readonly LocaleCode[]` [L52](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/core.ts#L52)
- `export` `setLocale(code: LocaleCode): void` [L56](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/core.ts#L56)
- `export` `onLocaleChange(fn: Listener): () => void` [L66](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/core.ts#L66)
- `export` `resolveEntry(entry: LocalizedString | string | null | undefined, debugKey): string` [L72](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/core.ts#L72)
- `export` `tx(4 params): string` [L89](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/core.ts#L89)
- `export` `__resetWarnCacheForTests(): void` [L113](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/core.ts#L113)

**Typy i Modele Danych:**
- `type Listener` = `(locale: LocaleCode) => void` [L28](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/core.ts#L28)

### [T1_tlumaczenia/LanguageSelector.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/LanguageSelector.tsx)

**Funkcje:**
- `export` `LanguageSelector({ compact = false }: { compact?: boolean }): any` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/LanguageSelector.tsx#L17)

### [T1_tlumaczenia/react.tsx](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/react.tsx)

**Funkcje:**
- `export` `useLocale(): LocaleCode` [L11](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/react.tsx#L11)

### [T1_tlumaczenia/types.ts](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/types.ts)

**Funkcje:**
- `export` `isLocaleCode(v: unknown): v is LocaleCode` [L34](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/types.ts#L34)

**Typy i Modele Danych:**
- `type LocaleCode` = `'pl' | 'en' | 'de'` [L7](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/types.ts#L7)
- `type LocalizedString` = `{ pl: string; en?: string; de?: string; [extraLang: strin...` [L24](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/types.ts#L24)
- `type ModuleTexts` = `Record<string, LocalizedString>` [L32](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/types.ts#L32)

**Stałe i Słowniki:**
- `const SUPPORTED_LOCALES: readonly LocaleCode[]` [L9](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/types.ts#L9)
- `const DEFAULT_LOCALE: LocaleCode` [L12](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/types.ts#L12)
- `const FALLBACK_LOCALE: LocaleCode` [L15](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/types.ts#L15)
- `const LOCALE_STORAGE_KEY` [L17](file:///C:/Users/ADM/AppData/Roaming/Blender Foundation/Blender/5.0/scripts/addons/CAD/web/T1_tlumaczenia/types.ts#L17)
