# Parametry Modułów Bloki (SSOT Parametrów)

Dokumentacja wszystkich parametrów modułów Bloki. 
Każdy parametr posiada ściśle określoną jednostkę fizyczną w nazwie (`_mm`, `_count`, `_deg`, `_id`), typ oraz wartość domyślną.

## Architektura Jednostek i Granice Konwersji (SSOT)

W całym systemie Bloki obowiązuje ścisły podział jednostek:

1. **Wnętrze Bloki (Planowanie, Matematyka, UI, Geometria Modułów)**:
   - **Wyłącznie milimetry (`mm`)**.
   - Wszystkie zmienne, parametry, DTO (`BlokiPart`, `BlokiHardware`), wymiary (`width_mm`, `height_mm`, `depth_mm`) oraz parametry operacji otworów (`u_mm`, `v_mm`, `diameter_mm`, `depth_mm`) operują w milimetrach.
   - W modułach Bloki zabronione jest używanie metrów (`m`) lub nanometrów (`nm`).

2. **Granica Konwersji Bloki ↔ Drzewo Sceny CAD (`bloki-core.ts`)**:
   - `CADNode`, `domainData` i macierze transformacji CAD operują w **nanometrach (`nm`)** zgodnie z regułą SSOT (`A1_core/cad-math/units.ts`).
   - Konwersja zachodzi wyłącznie na brzegu w `bloki-core.ts`:
     - **Wejście**: gabaryty kontenera z CAD w `nm` są konwertowane przez `nmToMm()` na `BlokiDimensions_mm` / `ModuleDims`.
     - **Wyjście**: po wyliczeniu planu przez silnik Bloki, pozycje (`loc`), wymiary (`dim`) formatek i okuć są przeliczane przez `mmToNm()` i zapisywane do węzłów `CADNode`.

3. **Granica CAM / CNC Postprocesor**:
   - Postprocesory CNC (np. c-code, biesse, heidenhain) pobierają dane z domeny CAD (`nm`) i konwertują je przez `nmToMm()` do milimetrów dla maszyny.

---

## 1. Moduł: DRZWI (`blok_doors`)

Pliki: [doors-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/doors-engine.ts), [doors-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/doors-adapter.tsx), [doors-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/doors-drilling-builder.ts)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `rodzaj_drzwi` | `door_type`, `doorType` | `'LEFT' \| 'RIGHT' \| 'DOUBLE'` | `'LEFT'` | enum | Typ drzwi: lewe pojedyncze, prawe pojedyncze lub dwuskrzydłowe |
| `grubosc_frontu_mm` | `thickness`, `front_thickness` | `number` | `18` | `mm` | Grubość płyty frontowej |
| `szczelina_mm` | `gap` | `number` | `4` | `mm` | Szczelina pionowa między skrzydłami (dla `DOUBLE`) |
| `nalozenie_gora_mm` | `ov_top` | `number` | `14` | `mm` | Nałożenie frontu na górny wieniec/belkę korpusu |
| `nalozenie_dol_mm` | `ov_bottom` | `number` | `15` | `mm` | Nałożenie frontu na dolny wieniec korpusu |
| `nalozenie_lewe_mm` | `ov_left` | `number` | `16` | `mm` | Nałożenie frontu na lewy bok korpusu |
| `nalozenie_prawe_mm` | `ov_right` | `number` | `16` | `mm` | Nałożenie frontu na prawy bok korpusu |
| `domyslny_zawias_id` | `hinge_template`, `hingeTemplate` | `string` | `'BLUM_71B3550'` | id z katalogu | ID okucia zawiasu (z `B1_biblioteka`) |
| `uzyj_zawias_1` | `use_hinge_1` | `boolean` | `true` | bool | Czy aktywny dolny zawias 1 |
| `pozycja_zawias_1_mm` | `nalozenie_zawias_1_mm`, `hinge_1_pos` | `number` | `120` | `mm` | Pozycja Z zawiasu 1 mierzona od spodu strefy |
| `uzyj_zawias_2` | `use_hinge_2` | `boolean` | `false` | bool | Czy aktywny zawias 2 |
| `pozycja_zawias_2_mm` | `nalozenie_zawias_2_mm`, `hinge_2_pos` | `number` | `570` | `mm` | Pozycja Z zawiasu 2 mierzona od spodu strefy |
| `uzyj_zawias_3` | `use_hinge_3` | `boolean` | `false` | bool | Czy aktywny zawias 3 |
| `pozycja_zawias_3_mm` | `nalozenie_zawias_3_mm`, `hinge_3_pos` | `number` | `910` | `mm` | Pozycja Z zawiasu 3 mierzona od spodu strefy |
| `uzyj_zawias_4` | `use_hinge_4` | `boolean` | `false` | bool | Czy aktywny zawias 4 |
| `pozycja_zawias_4_mm` | `nalozenie_zawias_4_mm`, `hinge_4_pos` | `number` | `1230` | `mm` | Pozycja Z zawiasu 4 mierzona od spodu strefy |
| `uzyj_zawias_5` | `use_hinge_5` | `boolean` | `false` | bool | Czy aktywny zawias 5 |
| `pozycja_zawias_5_mm` | `nalozenie_zawias_5_mm`, `hinge_5_pos` | `number` | `1580` | `mm` | Pozycja Z zawiasu 5 mierzona od spodu strefy |
| `uzyj_zawias_6` | `use_hinge_6` | `boolean` | `true` | bool | Czy aktywny górny zawias 6 |
| `pozycja_zawias_6_mm` | `nalozenie_zawias_6_mm`, `hinge_6_pos` | `number` | `120` | `mm` | Pozycja zawiasu 6 mierzona **od góry** strefy w dół |

---

## 1a. Moduł: DRZWI SKOŚNE (`blok_skosne_drzwi`)

Pliki: [skosne-doors-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/skosne-doors-engine.ts), [skosne-doors-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/skosne-doors-adapter.tsx), [skosne-doors-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/skosne-doors-drilling-builder.ts)

Front **trapezowy**: spód prosty, góra pochylona — geometria tego samego typu co `korpus_skosny_lr`. Skrzydło jest jedno i jednokierunkowe.

**Różnica względem `DOORS`:** zawias może być tylko na **krawędzi pionowej** trapezu. Druga krawędź jest pochylona, więc zawias po tamtej stronie jest fizycznie niemożliwy. `rodzaj_drzwi` nie jest więc dowolnym wyborem — niespójność z kątem dachu to błąd fail-fast.

**Kąt dachu odczytywany bezpośrednio z korpusu:** nachylenie wieńca górnego (`dach_kat_deg`) odczytywane jest prosto z `TOP_PANEL` (`-lcs.rotation[2]`), a bazowa wysokość wnęki to światło na środku korpusu (`dims.height_mm`). Zero zgadywania i zero wpisywania wymiarów boków korpusu. Brak wieńca górnego w korpusie to błąd (fail-fast).

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `rodzaj_drzwi` | `door_type`, `doorType` | `'LEFT' \| 'RIGHT'` | `'LEFT'` | enum | Strona zawiasu = strona krawędzi pionowej. `RIGHT` dla `dach_kat_deg >= 0`, `LEFT` dla `dach_kat_deg < 0` |
| `grubosc_frontu_mm` | `thickness`, `front_thickness` | `number` | `18` (z reguł) | `mm` | Grubość płyty frontowej |
| `dach_kat_deg` | `heightLeft`, `heightRight`, `wysokosc_lewy_mm`, `wysokosc_prawy_mm` | `number` | z `TOP_PANEL` | `deg` | Kąt nachylenia wieńca górnego korpusu względem poziomu |
| `nalozenie_gora_mm` | `ov_top` | `number` | `14` | `mm` | Nałożenie mierzone **prostopadle do skosu**: podniesienie pionowe `·cos β`. Przy `0` góra frontu idealnie licuje się ze spodem wieńca |
| `nalozenie_dol_mm` | `ov_bottom` | `number` | `15` | `mm` | Nałożenie **zawsze pionowe** — dół skrzydła jest prosty |
| `nalozenie_lewe_mm` | `ov_left` | `number` | `16` | `mm` | Nałożenie na lewy bok korpusu |
| `nalozenie_prawe_mm` | `ov_right` | `number` | `16` | `mm` | Nałożenie na prawy bok korpusu |
| `domyslny_zawias_id` | `hinge_template`, `hingeTemplate` | `string` | `'BLUM_71B3550'` | catalog ID | Domyślne okucie (parowanie 71B/71T wspólne z `DOORS`) |
| `uzyj_zawias_1` | `use_hinge_1` | `boolean` | `true` | bool | Zawias dolny |
| `pozycja_zawias_1_mm` | `hinge_1_pos` | `number` | `120` | `mm` | Pozycja Z od spodu wnęki |
| `uzyj_zawias_6` | `use_hinge_6` | `boolean` | `true` | bool | Zawias górny |
| `pozycja_zawias_6_mm` | `hinge_6_pos` | `number` | `120` | `mm` | Pozycja Z **od góry** wnęki (od krawędzi pionowej) |

Zawiasy 2–5 mają te same klucze co w module `DOORS` (`uzyj_zawias_2..5`, `pozycja_zawias_2..5_mm`), domyślnie wyłączone.

## Wzór na wysokość skrzydła

Wysokość wnęki w środku korpusu to `H_wnęki = dims.height_mm` (od góry wieńca dolnego do dołu wieńca górnego).
Kąt nachylenia wieńca to `β = dach_kat_deg`.

Krawędzie skrzydła w układzie środka wnęki:
- `x_L = -W_wnęki / 2 - nalozenie_lewe_mm`
- `x_P = +W_wnęki / 2 + nalozenie_prawe_mm`

Wysokość skrzydła w punkcie `x`:
```
H_skrzydła(x) = H_wnęki + x · tan(β) + nalozenie_dol_mm + nalozenie_gora_mm · cos(β)
```

Gdy `nalozenie_gora_mm = 0`:
Górna krawędź skrzydła dokładnie licuje się ze spodem wieńca górnego na całej szerokości (odchylenie 0.00 mm), niezależnie od wartości nałożeń bocznych.

**Obrzeża:** okleinowane `-X`, `+X`, `-Y` (trzy proste krawędzie). Krawędź pochylona klasyfikuje się jako `+Y` w `classifyOutlineSegmentEdge` i **nie dostaje automatycznej okleiny** — obrzeże na krawędzi skośnej wymaga świadomego włączenia.

---

## 2. Moduł: PÓŁKI (`blok_shelves`)

Pliki: [shelves-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/shelves-engine.ts), [shelves-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/shelves-adapter.tsx), [shelves-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/shelves-drilling-builder.ts)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `liczba_polek` | `shelfCount` | `number` | `3` | szt. | Liczba równomiernie rozmieszczonych półek ruchomych |
| `grubosc_polki_mm` | `thickness` | `number` | `18` | `mm` | Grubość płyty półki |
| `odsuniecie_przod_mm` | `shelfOffsetFront`, `offset_front` | `number` | `10` | `mm` | Cofnięcie przedniej krawędzi półki od lica korpusu |
| `luz_boczny_mm` | `shelfOffsetSide`, `offset_side` | `number` | `0.5` | `mm` | Luz montażowy z każdej strony (szerokość = W − 2×luz) |
| `wzor_nawiercen` | `holePattern` | `'NONE' \| 'SINGLE' \| 'TRIPLE' \| 'ROW' \| 'SYSTEM_32'` | `'SINGLE'` | enum | Wzór otworów pod podpórki półki |
| `odstep_otworow_przod_mm` | `frontInset`, `hole_offset_front` | `number` | `40` | `mm` | Odsunięcie przedniego rzędu otworów od frontu (domyślnie 40 mm) |
| `odstep_otworow_tyl_mm` | `backInset`, `hole_offset_back` | `number` | `40` | `mm` | Odsunięcie tylnego rzędu otworów od tyłu (domyślnie 40 mm) |
| `rozstaw_potrojny_z_mm` | `tripleZOffset`, `triple_z_offset` | `number` | `32` | `mm` | Rozstaw otworów regulacyjnych w pionie (dla `TRIPLE`) |
| `otwory_przod_aktywne` | `frontHoles`, `front_holes_enabled` | `boolean` | `false` | bool | Dodatkowe podparcie na środku od przodu |
| `przesuniecie_otworow_przod_x_mm` | `frontOffsetX`, `front_holes_offset_x` | `number` | `0` | `mm` | Przesunięcie X przedniego środkowego podparcia |
| `otwory_tyl_aktywne` | `backHoles`, `back_holes_enabled` | `boolean` | `false` | bool | Dodatkowe podparcie na środku od tyłu |
| `przesuniecie_otworow_tyl_x_mm` | `backOffsetX`, `back_holes_offset_x` | `number` | `0` | `mm` | Przesunięcie X tylnego środkowego podparcia |
| `rozstaw_system32_mm` | `system32Spacing`, `system_32_spacing` | `number` | `32` | `mm` | Skok siatki System 32 w pionie |
| `start_system32_z_mm` | `system32StartOffset`, `system_32_start_offset` | `number` | `150` | `mm` | Wysokość startowa pierwszego otworu System 32 |
| `liczba_otworow_system32` | `system32HoleCount`, `system_32_hole_count` | `number` | `10` | szt. | Liczba otworów w rzędzie System 32 |

---

## 3. Moduł: WIENIEC POJEDYNCZY (`blok_shelf`)

Pliki: [shelf-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/shelf-engine.ts), [shelf-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/shelf-adapter.tsx)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `grubosc_wienca_mm` | `thickness` | `number` | `18` | `mm` | Grubość pojedynczego wieńca konstrukcyjnego |
| `odsuniecie_przod_mm` | `offsetFront`, `offset_front` | `number` | `0` | `mm` | Cofnięcie przedniej krawędzi wieńca |
| `odsuniecie_tyl_mm` | `offsetBack`, `offset_back` | `number` | `0` | `mm` | Cofnięcie tylnej krawędzi wieńca |
| `luz_boczny_mm` | `offsetSide`, `offset_side` | `number` | `0` | `mm` | Luz boczny wieńca |
| `baza_odniesienia` | `referenceFrom` | `'bottom' \| 'top'` | `'bottom'` | enum | Baza pozycjonowania Z: od spodu (`bottom`) czy sufitu (`top`) |
| `odstep_dol_mm` | `offsetBottom`, `offset_bottom` | `number` | `100` | `mm` | Dystans od dołu strefy do dolnego lica wieńca |
| `odstep_gora_mm` | `offsetTop`, `offset_top` | `number` | `100` | `mm` | Dystans od góry strefy do górnego lica wieńca |

---

## 4. Moduł: SZUFLADY (`blok_drawers`)

Pliki: [drawers-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/drawers-engine.ts), [drawers-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/drawers-adapter.tsx), [drawers-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/drawers-drilling-builder.ts)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `liczba_szuflad` | `count`, `drawerCount` | `number` | `3` | szt. (0–5) | Liczba szuflad w strefie Bloki |
| `grubosc_frontu_mm` | `thickness` | `number` | `18` | `mm` | Grubość płyt frontów szuflad |
| `nalozenie_gora_mm` | `ovTop`, `overlap_top` | `number` | `15` | `mm` | Nałożenie górnego frontu na wieniec górny |
| `nalozenie_dol_mm` | `ovBottom`, `overlap_bottom` | `number` | `15` | `mm` | Nałożenie dolnego frontu na wieniec dolny |
| `nalozenie_lewe_mm` | `ovLeft`, `overlap_left` | `number` | `15` | `mm` | Nałożenie frontów na lewy bok korpusu |
| `nalozenie_prawe_mm` | `ovRight`, `overlap_right` | `number` | `15` | `mm` | Nałożenie frontów na prawy bok korpusu |
| `dystans_lewy_mm` | `spacerL` | `number` | `0` | `mm` | Grubość listwy dystansowej z lewej strony (np. pod zawias) |
| `dystans_prawy_mm` | `spacerR` | `number` | `0` | `mm` | Grubość listwy dystansowej z prawej strony |
| `auto_wysokosc_frontu` | `frontHeightAuto`, `front_height_auto` | `boolean` | `true` | bool | Czy wysokości frontów dzielone automatycznie po równo |
| `szczelina_wspolna_mm` | `commonGap`, `common_gap` | `number` | `3` | `mm` | Szczelina pozioma między frontami (dla trybu auto) |
| `wysokosci_frontow_mm` | `frontHeights`, `front_heights` | `number[]` | `[]` | lista `mm` | Indywidualne wysokości kolejnych frontów od dołu do góry |
| `szczeliny_indywidualne_mm` | `individualGaps`, `individual_gaps` | `number[]` | `[]` | lista `mm` | Indywidualne szczeliny między kolejnymi frontami |
| `konfiguracje_prowadnic` | `railConfigs`, `rail_configs` | `Record<number, RailSlotConfig>` | `{}` | obiekt mapy | Konfiguracja per szuflada: system prowadnicy i długość w mm |

---

## 5. Moduł: PRZEGRODY PIONOWE (`blok_dividers`)

Pliki: [dividers-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/dividers-engine.ts), [dividers-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/dividers-adapter.tsx)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `liczba_przegrod` | `count`, `dividerCount` | `number` | `2` | szt. (0–5) | Liczba pionowych przegród dzielących strefę w osi X |
| `grubosc_przegrody_mm` | `thickness` | `number` | `18` | `mm` | Grubość pojedynczej płyty przegrody |
| `tryb_rozstawu` | `spacingMode`, `spacing_mode` | `'EQUAL' \| 'CUSTOM'` | `'EQUAL'` | enum | Tryb rozmieszczenia: równe światła wnęk (`EQUAL`) lub własne szerokości (`CUSTOM`) |
| `szerokosci_wnek_mm` | `sectionWidths`, `section_widths`, `section_{i}_width` | `number[]` | `[200, 200, 200, 200, 200]` | lista `mm` | Szerokości kolejnych wnęk od lewej strony (w trybie `CUSTOM`) |

---

## 6. Moduł: DRĄŻEK UBRANIOWY (`blok_tubes`)

Pliki: [tubes-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/tubes-engine.ts), [tubes-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/tubes-adapter.tsx)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `odstep_gora_mm` | `offsetTop`, `offset_top` | `number` | `70` | `mm` | Dystans osi drążka od góry strefy (lub od spodu półki nad nim) |
| `pokaz_polke` | `showShelf`, `show_shelf` | `boolean` | `false` | bool | Czy nad drążkiem ma pojawić się półka zabezpieczająca |
| `przestrzen_nad_polka_mm` | `spaceAboveShelf`, `space_above_shelf` | `number` | `100` | `mm` | Prześwit między sufitem szafy a górnym licem półki |
| `grubosc_polki_mm` | `shelfThickness`, `shelf_thickness` | `number` | `18` | `mm` | Grubość płyty półki nad drążkiem |
| `srednica_drazka_mm` | `rodDiameter` | `number` | `25` | `mm` | Średnica zewnętrzna rury drążka (standard fi 25) |

---

## 7. Moduł: KLAPY UCHYLNE (`blok_flaps`)

Pliki: [flaps-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/flaps-engine.ts), [flaps-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/flaps-adapter.tsx), [flaps-drilling-builder.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/flaps-drilling-builder.ts)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `kierunek_klapy` | `flap_type`, `type` | `'TOP' \| 'BOTTOM'` | `'TOP'` | enum | Kierunek otwierania klapy: podnoszona do góry (`TOP`) lub opuszczana w dół (`BOTTOM`) |
| `grubosc_frontu_mm` | `thickness`, `front_thickness` | `number` | `18` | `mm` | Grubość płyty frontowej klapy |
| `nalozenie_gora_mm` | `ov_top`, `ovTop` | `number` | `14` | `mm` | Nałożenie frontu klapy na wieniec górny |
| `nalozenie_dol_mm` | `ov_bottom`, `ovBottom` | `number` | `15` | `mm` | Nałożenie frontu klapy na dół |
| `nalozenie_lewe_mm` | `ov_left`, `ovLeft` | `number` | `16` | `mm` | Nałożenie frontu klapy na lewy bok korpusu |
| `nalozenie_prawe_mm` | `ov_right`, `ovRight` | `number` | `16` | `mm` | Nałożenie frontu klapy na prawy bok korpusu |
| `odsuniecie_zawiasu_lewe_mm` | `hinge_left_offset`, `hingeLeftOffset` | `number` | `80` | `mm` | Odsunięcie osi zawiasu lewego od lewej krawędzi frontu |
| `odsuniecie_zawiasu_prawe_mm` | `hinge_right_offset`, `hingeRightOffset` | `number` | `80` | `mm` | Odsunięcie osi zawiasu prawego od prawej krawędzi frontu |
| `zawias_srodkowy` | `use_center_hinge`, `useCenterHinge` | `boolean` | `false` | bool | Czy umieścić 3. zawias na środku szerokości klapy |
| `szablon_zawiasu_domyslny` | `hinge_template`, `library_id` | `string` | `DEFAULT_HINGE_ID` | catalog ID | Domyślny model zawiasu z biblioteki |
| `szablon_zawiasu_lewy` | `hinge_left_template` | `string` | opcjonalny | catalog ID | Dedykowany model zawiasu lewego |
| `szablon_zawiasu_prawy` | `hinge_right_template` | `string` | opcjonalny | catalog ID | Dedykowany model zawiasu prawego |
| `szablon_zawiasu_srodkowy` | `hinge_center_template` | `string` | opcjonalny | catalog ID | Dedykowany model zawiasu środkowego |

---

## 8. Moduł: BLENDY I PANELE ZEWNĘTRZNE (`blok_panels`)

Pliki: [panels-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/panels-engine.ts), [panels-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/panels-adapter.tsx)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `grubosc_blendy_mm` | `thickness` | `number` | `18` | `mm` | Grubość płyt paneli zewnętrznych i cokołu |
| `tryb_paneli_bocznych` | `sidePanelMode`, `side_panel_mode` | `'FULL' \| 'KORPUS_BLENDA_G' \| 'COKOL_KORPUS' \| 'KORPUS'` | `'FULL'` | enum | Zasięg bocznych blend: od posadzki do góry (`FULL`), od dołu korpusu (`KORPUS_BLENDA_G`), wieniec górny przykrywa boki (`KORPUS`) |
| `wlacz_lewy` | `enableLeft`, `enable_left` | `boolean` | `true` | bool | Czy generować lewą blendę boczną |
| `wlacz_prawy` | `enableRight`, `enable_right` | `boolean` | `true` | bool | Czy generować prawą blendę boczną |
| `wlacz_gorny` | `enableTop`, `enable_top` | `boolean` | `true` | bool | Czy generować górny panel maskujący |
| `wlacz_dolny` | `enableBottom`, `enable_bottom` | `boolean` | `true` | bool | Czy generować blendę cokołową |
| `auto_glebokosc_lewy` | `autoDepthLeft`, `override_rear_left` | `boolean` | `true` | bool | Jeśli true: głębokość blendy lewej równa głębokości korpusu |
| `auto_glebokosc_prawy` | `autoDepthRight`, `override_rear_right` | `boolean` | `true` | bool | Jeśli true: głębokość blendy prawej równa głębokości korpusu |
| `auto_glebokosc_gorny` | `autoDepthTop`, `override_rear_top` | `boolean` | `true` | bool | Jeśli true: głębokość blendy górnej równa głębokości korpusu |
| `glebokosc_blendy_lewa_mm` | `panelDepthLeft`, `panel_depth_left` | `number` | `100` | `mm` | Szerokość/głębokość listwy blendy lewej (gdy nie jest na całą głębokość) |
| `glebokosc_blendy_prawa_mm` | `panelDepthRight`, `panel_depth_right` | `number` | `100` | `mm` | Szerokość/głębokość listwy blendy prawej (gdy nie jest na całą głębokość) |
| `glebokosc_blendy_gora_mm` | `panelDepthTop`, `panel_depth_top` | `number` | `100` | `mm` | Szerokość/głębokość listwy blendy górnej (gdy nie jest na całą głębokość) |
| `wysokosc_cokolu_mm` | `plinthHeight`, `plinth_height` | `number` | `97` | `mm` | Wysokość cokołu dolnego |
| `szczelina_cokolu_mm` | `plinthGap`, `plinth_gap` | `number` | `3` | `mm` | Szczelina dylatacyjna między cokołem a dołem korpusu |
| `cofniecie_cokolu_mm` | `plinthRecess`, `plinth_recess` | `number` | `20` | `mm` | Wycofanie cokołu w głąb szafy względem frontu korpusu |
| `luz_lewy_mm` | `clearanceLeft`, `clearance_left` | `number` | `0` | `mm` | Odsunięcie montażowe lewej blendy |
| `luz_prawy_mm` | `clearanceRight`, `clearance_right` | `number` | `0` | `mm` | Odsunięcie montażowe prawej blendy |
| `luz_gorny_mm` | `clearanceTop`, `clearance_top` | `number` | `0` | `mm` | Odsunięcie montażowe górnej blendy |

---

## 9. Moduł: KANAŁ LED WEWNĘTRZNY (`blok_led_internal`)

Pliki: [led-internal-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/led-internal-engine.ts), [led-internal-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/led-internal-adapter.tsx)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `wariant_led` | `variant` | `string` | `'VERTICAL_BOTH_SIDES'` | enum | Układ profili: `VERTICAL_BOTH_SIDES`, `VERTICAL_LEFT_SIDE`, `VERTICAL_RIGHT_SIDE`, `VERTICAL_BACK`, `VERTICAL_SIDES_AND_BACK`, `HORIZONTAL_TOP` |
| `profil_lewy` | `hasLeft` | `boolean` | zależnie od wariantu | bool | Ręczne włączenie profilu na lewym boku |
| `profil_prawy` | `hasRight` | `boolean` | zależnie od wariantu | bool | Ręczne włączenie profilu na prawym boku |
| `profil_tyl` | `hasBack` | `boolean` | zależnie od wariantu | bool | Ręczne włączenie profilu na plecach |
| `odsuniecie_od_przodu_lewe_mm` | `offsetFromFrontLeftMm`, `offset_from_front_left_mm` | `number` | `50` | `mm` | Odsunięcie lewego profilu pionowego od przedniej krawędzi |
| `odsuniecie_od_przodu_prawe_mm` | `offsetFromFrontRightMm`, `offset_from_front_right_mm` | `number` | `150` | `mm` | Odsunięcie prawego profilu pionowego od przedniej krawędzi |
| `odsuniecie_tyl_od_srodka_mm` | `offsetBackFromCenterMm`, `offset_back_from_center_mm` | `number` | `125` | `mm` | Odsunięcie profilu na plecach w osi X względem środka szafy |
| `odsuniecie_od_przodu_mm` | `offsetFromFrontMm`, `offset_from_front_mm` | `number` | `50` | `mm` | Odsunięcie poziomego profilu górnego od frontu |
| `szerokosc_wpustu_mm` | `grooveWidthMm`, `groove_width_mm` | `number` | `14` | `mm` | Szerokość frezowanego rowka pod profil LED |
| `glebokosc_wpustu_mm` | `grooveDepthMm`, `groove_depth_mm` | `number` | `9` | `mm` | Głębokość frezowanego rowka pod profil LED |
| `odstep_gora_mm` | `insetTopMm`, `inset_top_mm` | `number` | `20` | `mm` | Prześwit profilu pionowego od wieńca górnego |
| `odstep_dol_mm` | `insetBottomMm`, `inset_bottom_mm` | `number` | `20` | `mm` | Prześwit profilu pionowego od spodu strefy |

---

## 10. Moduł: KANAŁ LED PODSZAFKOWY (`blok_led_external`)

Pliki: [led-external-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/led-external-engine.ts), [led-external-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/led-external-adapter.tsx)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `odsuniecie_od_przodu_mm` | `offsetFromFrontMm`, `offset_from_front_mm` | `number` | `50` | `mm` | Dystans osi profilu podszafkowego od przedniej krawędzi wieńca dolnego |
| `szerokosc_wpustu_mm` | `grooveWidthMm`, `groove_width_mm` | `number` | `14` | `mm` | Szerokość frezowania przelotowego wpustu LED |
| `glebokosc_wpustu_mm` | `grooveDepthMm`, `groove_depth_mm` | `number` | `9` | `mm` | Głębokość frezowania wpustu LED w wieńcu dolnym i bokach |
| `frezuj_boki` | `cutSides`, `cut_sides` | `boolean` | `true` | bool | Czy kontynuować frezowanie wpustu przez dolne krawędzie boków szafek dla linii światła |

---

## 11. Moduł: DRZWI NAROŻNE L (`blok_corner_doors`)

Pliki: [corner-doors-engine.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/corner-doors-engine.ts), [corner-doors-adapter.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/corner-doors-adapter.tsx)

| Parametr (nowy, czysty) | Aliasy wejściowe | Typ | Domyślnie | Jednostka / Format | Krótki opis |
|---|---|---|---|---|---|
| `grubosc_frontu_mm` | `thickness`, `front_thickness` | `number` | wymagany | `mm` | Grubość płyt frontowych w narożniku |
| `szczelina_srodkowa_mm` | `szcz_srodkowa` | `number` | wymagany | `mm` | Szczelina pionowa w narożniku między lewym a prawym skrzydłem |
| `nalozenie_gora_mm` | `ov_top` | `number` | wymagany | `mm` | Nałożenie frontów na wieniec górny |
| `nalozenie_dol_mm` | `ov_bottom` | `number` | wymagany | `mm` | Nałożenie frontów na wieniec dolny |
| `nalozenie_lewe_mm` | `nalozenie_lewe` | `number` | wymagany | `mm` | Nałożenie lewego skrzydła na bok korpusu |
| `nalozenie_prawe_mm` | `nalozenie_prawe` | `number` | wymagany | `mm` | Nałożenie prawego skrzydła na bok korpusu |
| `otwieranie` | `otwieranie` | `'jednostronna' \| 'dwustronna_lewy' \| 'dwustronna_prawy'` | `'jednostronna'` | enum | Sposób otwierania skrzydeł narożnych (fuga lub osobne) |
| `szablon_zawiasu_domyslny` | `hinge_template`, `hingeTemplate` | `string` | `DEFAULT_HINGE_ID` | catalog ID | Domyślny model zawiasu narożnego z biblioteki |



