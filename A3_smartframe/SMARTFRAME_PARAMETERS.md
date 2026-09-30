# Parametry Korpusów SmartFrame (SSOT Parametrów)

Dokumentacja wszystkich parametrów modułu SmartFrame (`A3_smartframe`).
Każdy parametr posiada ściśle określoną jednostkę fizyczną w nazwie (`_mm`, `_deg`, `_count`, `_mode`, `_id`), typ oraz wartość domyślną.

---

## Architektura Jednostek i Granice Konwersji (SSOT)

W całym systemie SmartFrame obowiązuje ścisły podział jednostek:

1. **Wnętrze SmartFrame (Planowanie, Matematyka, Geometria Formatek)**:
   - **Wyłącznie milimetry (`mm`)** i stopnie kątowe (`deg`).
   - Wszystkie zmienne, parametry, DTO (`CabinetDimensions_mm`, `CabinetGeometryPart`), wymiary formatek (`dim`), pozycje (`loc`) oraz skosy (`cutAngle`) operują w milimetrach.
   - Wewnątrz modułów planowania korpusów zabronione jest operowanie na metrach (`m`) lub nanometrach (`nm`).

2. **Granica Konwersji SmartFrame ↔ Drzewo Sceny CAD (`smartframe-adapter.ts`)**:
   - `CADNode`, `domainData` i macierze transformacji CAD operują w **nanometrach (`nm`)** zgodnie z regułą SSOT (`A1_core/cad-math/units.ts`).
   - Konwersja zachodzi wyłącznie na brzegu w `smartframe-adapter.ts`:
     - **Wejście**: gabaryty kontenera korpusu z CAD w `nm` są konwertowane przez `nmToMm()` na `CabinetDimensions_mm`.
     - **Wyjście**: po wyliczeniu planu przez silnik SmartFrame, pozycje (`loc`), wymiary (`dim`) formatek są przeliczane przez `mmToNm()` i zapisywane do węzłów `CADNode` jako `PanelModel`.

3. **Granica CAM / CNC Postprocesor**:
   - Postprocesory CNC pobierają dane z domeny CAD (`nm`) i konwertują je przez `nmToMm()` do milimetrów dla maszyn obróbczych.

---

## Typy Korpusów (`cabinetType`)

| Kod typu | Opis architektoniczny | Dedykowane reguły JSON |
|---|---|---|
| `korpus3` | Standardowy korpus szafki stojącej / wiszącej (1, 2 lub 3 strefy pionowe) | `korpus3_3_rules.json` |
| `korpus_rogowy1` | Szafka narożna prosta z blendą / panelem zaślepiającym (z lewej lub prawej) | `korpus_rogowy1_rules.json` |
| `korpus_rogowy90` | Szafka narożna w kształcie litery L (kąt 90° z wieńcami narożnymi) | `korpus_rogowy90_rules.json` |
| `korpus_skosny` | Szafka skośna (skos przód-tył, np. poddasze o zróżnicowanej wysokości przód/tył) | `korpus_skosny_rules.json` |
| `korpus_skosny_dach` | Szafka ze ściętym dachem poddasza | `korpus_skosny_rules.json` |
| `korpus_skosny_lr` | Szafka skośna lewo-prawo (różne wysokości boków: lewy niski, prawy wysoki) | `korpus_skosny_rules.json` |
| `korpus_skosny_lr_uc` | Szafka skośna lewo-prawo z klinem ucięcia | `korpus_skosny_rules.json` |

---

## 1. Parametry Ogólne (Wspólne dla wszystkich korpusów)

Pliki: [smartframe-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-engine.ts), [smartframe-adapter.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka | Krótki opis |
|---|---|---|---|---|---|
| `szerokosc_mm` | `width`, `width_mm` | `number` | `600` | `mm` | Zewnętrzna szerokość gabarytowa korpusu (oś X) |
| `wysokosc_mm` | `height`, `height_mm` | `number` | `720` | `mm` | Zewnętrzna wysokość gabarytowa korpusu (oś Z) |
| `glebokosc_mm` | `depth`, `depth_mm` | `number` | `560` | `mm` | Zewnętrzna głębokość gabarytowa korpusu (oś Y) |
| `liczba_stref` | `zoneCount`, `zone_count` | `1 \| 2 \| 3` | `1` | szt. | Liczba stref podziału pionowego w szafce |
| `typ_korpusu` | `cabinetType`, `type` | `CabinetType` | `'korpus3'` | enum | Identyfikator wariantu geometrycznego korpusu |

---

## 2. Podział na Strefy i Półki Konstrukcyjne

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka | Krótki opis |
|---|---|---|---|---|---|
| `wysokosc_strefy_dolnej_mm` | `bottomHeight`, `bottom_height` | `number` | `300` | `mm` | Światło lub wysokość dolnej strefy B (dla `zoneCount >= 2`) |
| `wysokosc_strefy_srodkowej_mm` | `middleHeight`, `middle_height` | `number` | `300` | `mm` | Światło lub wysokość środkowej strefy M (dla `zoneCount === 3`) |

---

## 3. Plecy Szafki i Wpuszczenie / Nut

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka | Krótki opis |
|---|---|---|---|---|---|
| `cofniecie_plecow_mm` | `backOffsetMm`, `back_offset_mm` | `number` | `20` | `mm` | Odsunięcie lica płyty pleców od tylnej krawędzi boków |
| `grubosc_plecow_mm` | `backThickness`, `back_thickness` | `number` | `3` | `mm` | Grubość formatki pleców (standardowo HDF 3 mm) |
| `wpuszczenie_plecow_mm` | `backOverlap`, `back_overlap` | `number` | `10` | `mm` | Głębokość wejścia pleców w rowek/felc formatek obwodowych |

---

## 4. Wieniec Górny / Trawersy

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka | Krótki opis |
|---|---|---|---|---|---|
| `tryb_wienca_gornego` | `topPanelMode`, `top_panel_mode` | `'FULL' \| 'TRAVERSE_H' \| 'TRAVERSE_V'` | `'FULL'` | enum | Pełny wieniec górny lub para trawersów (poziome/pionowe) |
| `szerokosc_trawersu_mm` | `traverseWidth`, `traverse_width` | `number` | `80` | `mm` | Szerokość listew trawersowych (przedniej i tylnej) |

---

## 5. Korpus Narożny Prosty z Blendą (`korpus_rogowy1`)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka | Krótki opis |
|---|---|---|---|---|---|
| `szerokosc_blendy_mm` | `blindWidth`, `blind_width` | `number` | `100` | `mm` | Szerokość panelu zaślepiającego (blendy bocznej) |
| `strona_blendy` | `blindSide`, `blind_side` | `'LEFT' \| 'RIGHT'` | `'LEFT'` | enum | Strona montażu blendy (ślepy bok szafki) |

---

## 6. Korpus Narożny L 90° (`korpus_rogowy90`)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka | Krótki opis |
|---|---|---|---|---|---|
| `glebokosc_boku_lewego_mm` | `bokLewy`, `armDepth`, `armDepthX` | `number` | `560` | `mm` | Głębokość lewego skrzydła korpusu (od −X do wewnętrznego narożnika) |
| `glebokosc_boku_prawego_mm` | `bokPrawy`, `armDepthY` | `number` | `560` | `mm` | Głębokość prawego skrzydła korpusu (od +Y do wewnętrznego narożnika) |

---

## 7. Korpusy Skośne Poddaszowe (`korpus_skosny*`)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka | Krótki opis |
|---|---|---|---|---|---|
| `wysokosc_przod_mm` | `heightFront`, `height_front` | `number` | `wysokosc_mm` | `mm` | Wysokość przedniej krawędzi boków (dla skosu przód/tył) |
| `wysokosc_tyl_mm` | `heightBack`, `height_back` | `number` | `wysokosc_mm` | `mm` | Wysokość tylnej krawędzi boków (dla skosu przód/tył) |
| `wysokosc_lewy_mm` | `heightLeft`, `height_left` | `number` | `wysokosc_mm` | `mm` | Wysokość lewego boku (dla skosu lewo/prawo) |
| `wysokosc_prawy_mm` | `heightRight`, `height_right` | `number` | `wysokosc_mm` | `mm` | Wysokość prawego boku (dla skosu lewo/prawo) |
| `kat_skosu_deg` | `cutAngle`, `cut_angle_deg` | `number` | `0` | `deg` | Kąt nachylenia skosu formatki w stopniach |

---

## Standard Ról Formatek Korpusu (SSOT Taksonomii)

Zgodnie z `.agents/AGENTS.md`, elementy korpusu są klasyfikowane za pomocą stałych kodów ról (`role`):
- `BODY` / `LEFT_SIDE_PANEL` — lewy bok korpusu (np. `B_BOK_L`, `M_BOK_L`, `T_BOK_L`)
- `BODY` / `RIGHT_SIDE_PANEL` — prawy bok korpusu (np. `B_BOK_P`, `M_BOK_P`, `T_BOK_P`)
- `BOTTOM_PANEL` / `SHELF_BOARD` — wieniec dolny (`B_WIENIEC_D`)
- `TOP_PANEL` / `SHELF_BOARD` — wieniec górny (`B_WIENIEC_G`, `T_WIENIEC_G`)
- `BACK_PANEL` — plecy szafki (`B_PLECY`)
- `DIVIDER_PLATE` — przegroda pionowa / trawers konstrukcyjny
- `SPACER` / `PANEL` — blenda zaślepiająca narożna (`PANEL_ZASLEPIAJACY`)
