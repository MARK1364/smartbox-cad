# Analiza: Czy realne jest przeniesienie aplikacji na Rust/WASM?

## TL;DR — Brutalna odpowiedź

**Częściowo tak, ale pełne przepisanie — zdecydowanie nie.**

Roadmap jest napisany bardzo kompetentnie od strony inżynierskiej, ale zawiera kilka kluczowych błędów w ocenie kosztów i zysków. Poniżej rozbijam to na twarde fakty.

---

## 1. Stan faktyczny projektu

| Metryka | Wartość |
|---------|---------|
| Plików TS/TSX | ~2 481 |
| Linii kodu (bez node_modules/dist/testów) | **~86 000** |
| Silnik 3D | Babylon.js (WebGL2 / WebGPU) |
| Zależności runtime | `earcut`, `react`, `react-dom` |
| Architektura | Moduły domenowe (A1-A8, S1-S3, C1-C2, itp.) |
| Solver | Własny, czysty TS ([solver-bridge.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/solver-bridge.ts)) |
| Mesh builder | Własny, TS + earcut ([mesh_builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/native_core/mesh_builder.ts)) |

---

## 2. Co Roadmap obiecuje słusznie ✅

### 2.1. Render-on-Demand (Etap 1)
**Totalnie realne i natychmiastowe.** Babylon.js posiada wbudowany mechanizm — wystarczy wyłączyć ciągły render loop:
```typescript
engine.stopRenderLoop();
// renderuj tylko na żądanie:
scene.render(); // wywoływane z obserwatora kamery / zmiany modelu
```
To **zero Rusta**, czyste 2h pracy w TS, a zysk na słabym laptopie jest ogromny (z 60 FPS ciągłego → 0% CPU w spoczynku).

### 2.2. GPU Instancing (Etap 1)
**Totalnie realne.** Babylon.js ma natywne [hardware instancing](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances). 500 kołków w 1 draw call — to kwestia 1-2 dni refaktoringu `C2_connectors`, zero Rusta.

### 2.3. Triangulacja w WASM (Etap 2 — częściowo)
**Realne, ale zysk mniejszy niż deklarowany.** V8 kompiluje hot-path TS do natywnego kodu maszynowego (TurboFan JIT). Dla prostej matematyki (2 trójkąty na ścianę, earcut na otwory) różnica Rust WASM vs zoptymalizowany TS to **raczej 2-5x, nie 30-50x.** Prawdziwy bottleneck to *nie* CPU — to alokacje obiektów i GC, które da się wyeliminować w TS (object pooling, pre-alokowane TypedArrays).

### 2.4. SharedArrayBuffer / Zero-Copy (Filar 4)
**Architektonicznie słuszne**, ale SharedArrayBuffer wymaga specjalnych nagłówków HTTP (`Cross-Origin-Isolation`) i nie działa w parts of Safari / iOS. Trzeba mieć plan awaryjny.

---

## 3. Co Roadmap obiecuje nierealistycznie ❌

### 3.1. Czasy deklarowane w KPI są fikcyjne

| Obietnica | Realność |
|-----------|----------|
| Generowanie geometrii < 1.5 ms (z 40-90 ms) | ⚠️ Możliwe, ale **nie dzięki Rustowi** — prawdziwy bottleneck to kopiowanie danych do GPU, alokacje w pętli i brak poolingu. Profilowanie TS pokaże, że czysta matematyka to <5% czasu. |
| Raycast < 0.04 ms (z 3-8 ms) | ⚠️ Babylon.js `scene.pick()` jest wolne bo iteruje po WSZYSTKICH meshach. Rozwiązanie: [mesh.isPickable = false](https://doc.babylonjs.com/features/featuresDeepDive/mesh/interactions/picking_collisions) na nieistotnych meshach + octree picking. To zmiana w TS, nie Rust. |
| Solver < 0.2 ms (z 8-20 ms) | ⚠️ Solver ma ~600 linii TS. V8 JIT kompiluje to do natywnego kodu. Zysk z Rusta: ~2-3x realnie, nie 40-80x. |
| Draw Calls < 5 | ✅ Realne — ale to feature Babylon.js (merge meshes / instancing), nie Rusta. |

### 3.2. Czas wdrożenia jest drastycznie zaniżony

| Etap | Deklaracja | Realność (1 developer) |
|------|------------|------------------------|
| Etap 2 (Crate Rust + WASM mesher) | 3-4 tyg | **8-16 tygodni** — konfiguracja toolchaina (wasm-pack, wasm-bindgen), nauka Rusta jeśli nie znasz, integracja z Vite, debugowanie pamięci, testy |
| Etap 3 (BVH + raycast w WASM) | 3 tyg | **6-10 tygodni** — drzewo BVH w Ruście to ~2000 linii, a integracja z systemem eventów Babylon.js to piekło |
| Etap 4 (Solver w Rust) | 4-6 tyg | **10-16 tygodni** — to rdzeń aplikacji, migracja musi być bezbłędna |
| Etap 5 (CAM w Rust) | 4 tyg | **8-12 tygodni** |

**Łącznie roadmap deklaruje ~14-17 tygodni. Realnie: 32-54 tygodnie (8-13 miesięcy) dla JEDNEGO doświadczonego dewelopera Rusta.**

### 3.3. „Zero ciężkich bibliotek" — romantyczna fantazja

> [!WARNING]
> Pisanie własnego Constrained Delaunay Triangulation, BVH, i solvera LM od zera w Ruście to **ogromne ryzyko.** SolveSpace rozwijany jest od 2008 roku przez Jonathana Westhuesta. Ma ~50 000 linii C++ dopieszczonego kodu. Reimplement tych algorytmów od zera to projekt badawczy, nie feature na sprint.

---

## 4. Co NAPRAWDĘ warto zrobić (ranking ROI)

### 🏆 Tier 1 — Natychmiast, zero Rusta, ogromny zysk (1-2 tygodnie)

| Zmiana | Zysk | Trudność |
|--------|------|----------|
| **Render-on-Demand** w Babylon.js | CPU 0% w spoczynku | 2h |
| **GPU Instancing** dla kołków/okuć | 50-100x mniej draw calls | 2 dni |
| **Wyłączenie pickingu** na nieistotnych meshach | Raycast 5-10x szybszy | 1 dzień |
| **Object pooling** w mesh_builder (reuse tablic) | Eliminacja GC stutters | 2-3 dni |
| **Debouncing** re-renderów React (throttle hover) | Płynny UI | 1 dzień |

### 🥈 Tier 2 — Średni koszt, dobry zysk (3-6 tygodni)

| Zmiana | Zysk | Trudność |
|--------|------|----------|
| **Merge meshes** (łączenie formatek w 1 bufor) | 1-3 draw calls na szafę | 1-2 tyg |
| **Pre-alokowane TypedArrays** zamiast tablic JS | Zero GC w hot path | 1 tyg |
| **Octree** dla sceny (wbudowany w Babylon.js!) | Raycast O(log n) | 2-3 dni |
| **OffscreenCanvas + Worker** dla renderingu | UI thread nigdy nie blokowany | 1-2 tyg |

### 🥉 Tier 3 — Rust/WASM, duży koszt, marginalny zysk (3-6 mies.)

| Zmiana | Zysk | Trudność |
|--------|------|----------|
| **Mesh builder w WASM** | 2-5x szybsza triangulacja | 2-3 mies. |
| **Solver w WASM** | 2-3x szybszy solve | 3-4 mies. |
| **Własny BVH w WASM** | < wartość — Babylon octree wystarczy | 2-3 mies. |

---

## 5. Rekomendacja architektoniczna

### Strategia „80/20"

```
┌─────────────────────────────────────────────────────────────┐
│  Warstwa UI + logika biznesowa: TypeScript (86k LOC)        │
│  ✅ ZOSTAJE — nie przepisywać                               │
├─────────────────────────────────────────────────────────────┤
│  Warstwa renderingu: Babylon.js + optymalizacje             │
│  ✅ ZOSTAJE — Render-on-Demand, Instancing, Merge, Octree   │
├─────────────────────────────────────────────────────────────┤
│  Hot-path numeryczny (OPCJONALNIE, Tier 3):                 │
│  🟡 mesh_builder → WASM worker (jeśli profiling pokaże >50%│
│     czasu w triangulacji po optymalizacjach TS)             │
│  🟡 solver core → WASM worker (j.w.)                        │
└─────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Zasada: NAJPIERW profilowanie i optymalizacja TS (Tier 1+2), POTEM — i TYLKO JEŚLI — profiling pokaże, że CPU jest bottleneckiem, wchodzenie w WASM (Tier 3).**

---

## 6. Dlaczego SolveSpace to zły wzorzec do naśladowania

| SolveSpace | Twój projekt |
|------------|-------------|
| Desktop C++ z bezpośrednim dostępem do OpenGL | Web app z warstwą abstrakcji (przeglądarka → WebGL/WebGPU) |
| Własny renderer od zera (~5000 linii) | Babylon.js — dojrzały silnik z tysiącami optymalizacji |
| Jeden developer, 15+ lat rozwoju | Projekt produkcyjny potrzebujący stałego dostarczania wartości |
| Brak UI framework — surowy C | React + złożony system komponentów |
| Użytkownik akceptuje spartański UX | Stolarz oczekuje ładnego, intuicyjnego UI |

SolveSpace to arcydzieło inżynierskie, ale jego architektura **nie przenosi się** na ekosystem webowy. W webie bottlenecki są inne:
- **Nie CPU** (V8 JIT jest szybki), ale **przesyłanie danych** (main thread ↔ GPU, main thread ↔ Worker)
- **Nie algorytmy**, ale **DOM / React re-renders / GC pauses**
- **Nie brak Rusta**, ale **brak profiling-driven optimization**

---

## 7. Konkretny plan działania

### Faza 0 (Tydzień 0): PROFILOWANIE
Przed **jakąkolwiek** optymalizacją:
1. `chrome://tracing` lub Performance tab w Chrome DevTools
2. Zmierz REALNIE gdzie idzie czas przy:
   - Generowaniu szafy z 20 płytami
   - Ruchu kursora nad sceną
   - Rozwiązywaniu więzów
3. Wynik → tabelka z % czasu na każdy komponent

### Faza 1 (Tygodnie 1-2): Tier 1 — „Darmowe" zyski
- Render-on-Demand
- GPU Instancing
- Picking optimization
- Object pooling
- React throttling

### Faza 2 (Tygodnie 3-6): Tier 2 — Solidne usprawnienia
- Merge meshes
- Pre-alokowane TypedArrays
- Octree w Babylon.js
- Worker rendering

### Faza 3 (opcjonalnie, po Fazie 2): Ponowne profilowanie
Jeśli po Tier 1+2 nadal jest problem wydajnościowy:
- Zbadać czy bottleneck to CPU (→ wtedy WASM ma sens) czy transfer danych
- Jeśli CPU → wycinkowy port mesh_builder do Rust/WASM

---

## 8. Odpowiedź na pytanie

> **Czy to realne przeniesienie aplikacji na Rust z TS aby poprawić wydajność?**

**Pełne przeniesienie 86 000 linii TS na Rusta: NIE — to 1-2 lata pracy i zatrzymanie rozwoju produktu.**

**Selektywny port hot-path (mesh builder, solver) do Rust/WASM: TAK — ale dopiero po wyczerpaniu optymalizacji w TS, i realny zysk to 2-5x, nie 30-50x jak deklaruje roadmap.**

**Najlepszy ROI: optymalizacje czysto TypeScriptowe (Tier 1+2) dadzą Ci 80% deklarowanego zysku w 10% deklarowanego czasu.**
