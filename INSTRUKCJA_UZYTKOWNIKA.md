# SmartPanel Web — Instrukcja Użytkownika (Dokumentacja Użytkownika)

> Wersja dokumentu: 1.0 — 2026-09-04
> Aplikacja: SmartPanel Web — interaktywny CAD stolarski (React + Babylon.js)
> Dla kogo: stolarz, projektant mebli, operator CNC, technolog

---

## Spis treści

1. [1. Wprowadzenie](#1-wprowadzenie)
2. [2. Słownik pojęć](#2-słownik-pojęć)
3. [3. Pierwsze uruchomienie](#3-pierwsze-uruchomienie)
4. [4. Przegląd interfejsu (ekran główny)](#4-przegląd-interfejsu-ekran-główny)
5. [5. Szybki start — pierwszy mebel w 10 minut](#5-szybki-start--pierwszy-mebel-w-10-minut)
6. [6. Moduł S3 — Scena / Viewport 3D](#6-moduł-s3--scena--viewport-3d)
7. [7. Moduł A1 — Jądro / Projekt (Core)](#7-moduł-a1--jądro--projekt-core)
8. [8. Moduł A3 — SmartFrame (Korpus)](#8-moduł-a3--smartframe-korpus)
9. [9. Moduł A2 — SmartBox (Wyposażenie wnętrza)](#9-moduł-a2--smartbox-wyposażenie-wnętrza)
10. [10. Moduł A4 — SmartPanel (Formatka / Płyta)](#10-moduł-a4--smartpanel-formatka--płyta)
11. [11. Moduł A7 — Materiały i Obrzeża](#11-moduł-a7--materiały-i-obrzeża)
12. [12. Moduł C2 — Złącza (Kołki, Konfirmaty, Mimośrody)](#12-moduł-c2--złącza-kołki-konfirmaty-mimośrody)
13. [13. Moduł O1 — Operacje biblioteczne (Wcięcia, Szkło)](#13-moduł-o1--operacje-biblioteczne-wcięcia-szkło)
14. [14. Moduł S1 — Sketcher (Szkic na ścianie)](#14-moduł-s1--sketcher-szkic-na-ścianie)
15. [15. Moduł S2 — Solver (Więzy / Relacje)](#15-moduł-s2--solver-więzy--relacje)
16. [16. Moduł A8 — PMI (Wymiarowanie 3D / Miarka)](#16-moduł-a8--pmi-wymiarowanie-3d--miarka)
17. [17. Moduł C1 — CNC (Programy na maszynę)](#17-moduł-c1--cnc-programy-na-maszynę)
18. [18. Moduł N1 — Nesting (Rozkrój płyt)](#18-moduł-n1--nesting-rozkrój-płyt)
19. [19. Moduł D1 — Draw (Rysunek 2D)](#19-moduł-d1--draw-rysunek-2d)
20. [20. Moduł E3 — Studio dokumentacji 3D](#20-moduł-e3--studio-dokumentacji-3d)
21. [21. Moduł E1 — Eksport prosty](#21-moduł-e1--eksport-prosty)
22. [22. Moduł R1 — Raporty i Wycena](#22-moduł-r1--raporty-i-wycena)
23. [23. Moduł Biblioteki — Okucia i Szuflady](#23-moduł-biblioteki--okucia-i-szuflady)
24. [24. Typowe przepływy pracy (od projektu do maszyny)](#24-typowe-przepływy-pracy-od-projektu-do-maszyny)
25. [25. Skróty klawiszowe i mysz (ściąga)](#25-skróty-klawiszowe-i-mysz-ściąga)
26. [26. Częste problemy i rozwiązania (FAQ)](#26-częste-problemy-i-rozwiązania-faq)

---

## 1. Wprowadzenie

### 1.1. Czym jest SmartPanel Web?

SmartPanel Web to **obiektowy CAD stolarski działający w przeglądarce**. Służy do:

- projektowania korpusów meblowych (szafki, szafy, regały),
- wyposażania wnętrz (półki, szuflady, drzwi, drążki),
- nadawania materiałów i obrzeży,
- dodawania złączy stolarskich i obróbek,
- generowania programów na maszyny CNC,
- optymalizacji rozkroju płyt (nesting),
- tworzenia rysunków technicznych 2D i dokumentacji 3D,
- liczenia wyceny (m² płyt, metry obrzeży, okucia).

Wszystko dzieje się w **jednym projekcie**, z którego dane automatycznie trafiają do widoków CNC, Nestingu, Rysunku i Raportu.

### 1.2. Dla kogo jest ta instrukcja?

Dla osoby, która umie obsługiwać komputer i przeglądarkę, ale **nie musi znać CAD-a**. Każdy moduł opisany jest osobno: do czego służy, gdzie go znaleźć, jak go użyć krok po kroku.

### 1.3. Co musisz mieć?

- Przeglądarkę Chrome / Edge / Firefox (aktualną),
- Uruchomioną aplikację (`npm run dev` lub gotowy build),
- Mysz z kółkiem (zdecydowanie zalecana).

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 1 — Ekran startowy aplikacji         │
> │ Wstaw zrzut całego okna przeglądarki po uruchomieniu.  │
> │ Widać: drzewo po lewej, widok 3D na środku, panel      │
> │ właściwości po prawej.                                 │
> └─────────────────────────────────────────────────────────┘

---

## 2. Słownik pojęć

| Pojęcie | Co to znaczy (po ludzku) |
|---|---|
| **Projekt** | Cały mebel lub zestaw mebli. Jeden plik `.spp.json`. |
| **Korpus (SmartFrame)** | „Skrzynia” mebla — boki, wieniec, dno, plecy. Rodzic całej konstrukcji. |
| **Strefa / Wnęka (Bay)** | Pusta przestrzeń wewnątrz korpusu, w którą wkładasz półki, szuflady itd. |
| **SmartBox** | Gotowy moduł wyposażenia: półki, szuflady, drzwi, drążek, przegrody. |
| **Formatka (Panel)** | Pojedyncza płyta: bok, półka, front, plecy. Ma szerokość (W), wysokość (H), grubość (T). |
| **Drzewo obiektów** | Lista po lewej stronie: Projekt → Korpus → Formatka → Operacje. Wszystko, co narysowałeś. |
| **Viewport** | Okno 3D na środku — tu oglądasz i klikasz mebel. |
| **Gizmo 3D** | Interaktywne kontrolki 3D na modelu: **Niebieskie (`move`)** na środku formatki do przesuwania, **Czerwone (`offset_x`)** do odsunięcia krawędzi w osi X, **Zielone (`offset_y`)** do odsunięcia krawędzi w osi Y. |
| **WCS** | Układ współrzędnych maszyny CNC (gdzie jest „zero” płyty na stole). |
| **PMI** | Wymiary i adnotacje wyświetlane bezpośrednio w 3D. |
| **Nesting** | Układanie formatek na całych płytach tak, żeby było jak najmniej odpadu. |
| **Obrzeże** | Taśma ABS oklejająca widoczną krawędź płyty. |
| **Złącze** | Kołek, konfirmat, mimośród — to, co trzyma płyty razem. |

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 2 — Drzewo projektu z opisem         │
> │ Rozwiń przykładowy projekt, zaznacz strzałkami:        │
> │ Projekt, Korpus, Formatka, Operacje CNC, Obrzeża.      │
> └─────────────────────────────────────────────────────────┘

---

## 3. Pierwsze uruchomienie

### 3.1. Jak uruchomić aplikację?

1. Otwórz katalog aplikacji `web/`.
2. Uruchom `npm run dev` (tryb pracy) lub otwórz gotowy build.
3. Otwórz w przeglądarce adres pokazany w terminalu (zwykle `http://localhost:5173`).
4. Zobaczysz ekran główny CAD (strona `index.html`).

Aplikacja ma **6 stron** (osobne zakładki):

| Strona / plik | Do czego służy | Jak ją otworzyć |
|---|---|---|
| `index.html` | Główny CAD 3D | Startowa, zawsze otwarta |
| `cnc.html` | Program CNC dla jednej formatki | PPM na formatce → CNC |
| `draw.html` | Rysunek techniczny 2D | Osobna zakładka / przycisk Rysunek |
| `nesting.html` | Rozkrój płyt | Osobna zakładka / przycisk Nesting |
| `report.html` | Raport / wycena | Przycisk Raport → Odśwież z CAD |
| `e3_drawing.html` | Dokumentacja 3D na arkuszach | Osobna zakładka / przycisk E3 |

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 3 — 6 zakładek / stron aplikacji     │
> │ Wstaw zrzuty miniaturek każdej strony z podpisem.      │
> └─────────────────────────────────────────────────────────┘

---

## 4. Przegląd interfejsu (ekran główny)

Ekran główny składa się z następujących dedykowanych paneli:

```
┌─────────────────────────────────────────────────────────────┐
│  PASEK MENU (#pasek-menu) - plik, edycja, moduły, cofanie   │
├──────────────┬────────────────────────────┬──────────────────┤
│  DRZEWO      │  BELKA WIDOKOWA            │  PANEL EDYCJI    │
│  OBIEKTÓW    │  (#belka-widokowa)         │  (#panel-edycji) │
│  (#drzewo-   ├────────────────────────────┤  (parametry,     │
│  obiektow)   │  VIEWPORT 3D               │  materiały,      │
│  (hierarchia │  (model 3D, kamera, gizma) │  odsunięcia)     │
│  sceny)      │                            │                  │
├──────────────┴────────────────────────────┴──────────────────┤
│  STATUS-BAR (jednostki mm, komunikaty, współrzędne CAD)     │
└─────────────────────────────────────────────────────────────┘
```

### 4.1. Główne panele i ich funkcje

| Nazwa panelu | Identyfikator | Położenie | Do czego służy i co robi |
|---|---|---|---|
| **Pasek menu** | `#pasek-menu` | Góra okna | Zarządzanie projektem (Nowy, Otwórz, Zapisz `.spp.json`), cofanie i ponawianie operacji (Undo/Redo), przełączanie modułów specjalistycznych (CNC, Nesting, Rysunek 2D, E3, Raport), ustawienia. |
| **Drzewo obiektów** | `#drzewo-obiektow` | Lewa strona | Prezentacja hierarchii projektu (Projekt → Korpus → Formatki → Wnęki → Obróbki/Złącza), szybkie wyszukiwanie, zmiana nazwy elementu (podwójny klik), sterowanie widocznością (ikona oka 👁️), mrożenie automatycznych obróbek (❄️) oraz duplikowanie (📋). |
| **Belka widokowa** | `#belka-widokowa` | Góra sceny 3D | Sterowanie trybami wyświetlania sceny (Shaded / Edges / Wireframe / Xray), przełączanie rzutowania kamery (Perspektywa / Aksonometria Ortho), szybkie widoki standardowe (Przód, Góra, Prawy bok, Izometria), włączanie/wyłączanie siatki roboczej i osi układu współrzędnych. |
| **Panel edycji** | `#panel-edycji` | Prawa strona | Kontekstowy panel parametrów aktualnie zaznaczonego obiektu. Umożliwia edycję gabarytów korpusu, podziałów wnęk SmartBox, wymiarów formatek, odsunięć krawędzi, przypisywanie płyt meblowych i obrzeży oraz zarządzanie obróbkami CNC. *(Uwaga: Panel właściwości - PropertiesPanel stanowi odrębny komponent).* |
| **Status-bar** | `#status-bar` | Dół okna | Informacje o bieżących jednostkach (mm), komunikaty podpowiedzi dla aktywnego narzędzia, współrzędne kursora oraz statusy transformacji CAD. |

### 4.2. Gizma interaktywne w 3D (Manipulatory)

Podczas zaznaczenia płyty lub korpusu na scenie 3D wyświetlane są intuicyjne kontrolki (gizma):

* 🔵 **Niebieskie gizmo (`move`)**:
  * **Położenie**: Dokładnie w **geometrycznym środku formatki** (lokalny punkt `(0, 0, 0)` układu LCS formatki).
  * **Funkcja**: Służy do **przesuwania / translacji** całej formatki (np. odsunięcie półki/przegrody) lub swobodnego pozycjonowania w przestrzeni 3D.
* 🔴 **Czerwone gizmo (`offset_x`)**:
  * **Położenie**: Kuleczki na ściankach wzdłuż osi X formatki.
  * **Funkcja**: Służy do **modyfikacji wymiaru / odsunięcia (offset) wzdłuż osi X** (wzdłuż usłojenia materiału — np. wysunięcie frontu lub cofnięcie tyłu formatki).
* 🟢 **Zielone gizmo (`offset_y`)**:
  * **Położenie**: Kuleczki na ściankach wzdłuż osi Y formatki.
  * **Funkcja**: Służy do **modyfikacji wymiaru / odsunięcia (offset) wzdłuż osi Y** (w poprzek usłojenia materiału — np. podwyższenie boku, zmiana wysokości wieńca).

Po kliknięciu i przeciągnięciu dowolnej kuleczki pojawia się pływający dymek z wartością w **mm**, w którym można również wpisać precyzyjną liczbę lub działanie matematyczne (np. `18/2`).

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 4 — Ekran główny z podpisanymi       │
> │ strefami (Pasek menu, Drzewo obiektów, Belka widokowa,   │
> │ Viewport 3D, Panel edycji, Status-bar).                 │
> └─────────────────────────────────────────────────────────┘

---

## 5. Szybki start — pierwszy mebel w 10 minut

Wykonaj po kolei. Szczegóły każdego kroku są w dalszych rozdziałach.

1. **Utwórz korpus** (rozdz. 8): kliknij `SmartFrame → Utwórz Korpus`, wpisz 600 × 720 × 560 mm, 1 strefa.
2. **Wstaw półki** (rozdz. 9): kliknij wnękę → `SmartBox → Półki`, dodaj 2 półki.
3. **Nadaj materiał** (rozdz. 11): przeciągnij materiał (np. Egger Biały 18 mm) z listy na korpus.
4. **Dodaj złącza** (rozdz. 12): pipetą kliknij styk boku z dnem → wybierz Konfirmat → Zatwierdź.
5. **Zwymiaruj** (rozdz. 16): narzędzie `Wymiaruj`, kliknij krawędź korpusu.
6. **Sprawdź rozkrój** (rozdz. 18): otwórz Nesting → auto-upakowanie.
7. **Wydrukuj raport** (rozdz. 22): otwórz Raport → `Odśwież z CAD` → Drukuj.

Gotowe — masz komplet: model, materiał, złącza, rozkrój i wycenę.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 5 — Gotowy prosty mebel (szafka      │
> │ z 2 półkami) w widoku Shaded + wymiary PMI.            │
> └─────────────────────────────────────────────────────────┘

---

## 6. Moduł S3 — Scena / Viewport 3D

### 6.1. Do czego służy?

To „stół kreślarski” — tu oglądasz mebel, zaznaczasz elementy, ustawiasz kamerę i tryb wyświetlania.

### 6.2. Gdzie to znaleźć?

Środkowa część ekranu głównego. Siatka co 100 mm, kolorowe osie (X-czerwona, Y-zielona, Z-niebieska), kostka nawigacyjna (ViewCube) w rogu.

### 6.3. Narzędzia i obsługa

| Narzędzie / czynność | Jak użyć | Do czego służy |
|---|---|---|
| Obrót (Orbit) | Środkowy przycisk myszy **lub** Alt + LPM + przeciągnij | Obejrzyj mebel dookoła |
| Przesuwanie (Pan) | Shift + ŚPM **lub** boczny przycisk + przeciągnij | Przesuń widok w bok |
| Zoom | Kółko myszy (przybliża do kursora) | Powiększ / pomniejsz |
| Centrowanie | Podwójny klik na element | Ustaw środek obrotu na meblu |
| Tryb Shaded | Pasek widoku → Shaded | Pełne bryły z cieniem (do prezentacji) |
| Tryb Edges | Pasek widoku → Edges | Bryły + czarne krawędzie (do kontroli) |
| Tryb Wireframe | Pasek widoku → Wireframe | Tylko siatka krawędzi (złącza widać!) |
| Tryb Xray | Pasek widoku → Xray | Przezierne (wnętrze, symbole złączy) |
| Ortho / Perspektywa | Przełącznik kamery | Ortho do rysunków, Perspektywa do oglądania |
| Siatka / Osie / LCS | Przełączniki widoczności | Pokaż / ukryj pomoce |
| ViewCube + Front/Top/Right | Kliknij ściankę kostki | Szybki widok z przodu / góry / boku |
| Inspector | Przycisk Inspector | Podgląd techniczny sceny (dla zaawansowanych) |

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 6a — ten sam mebel w 4 trybach:      │
> │ Shaded / Edges / Wireframe / Xray (4 miniaturki).      │
> └─────────────────────────────────────────────────────────┘
>
> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 6b — ViewCube i przyciski Front/Top/ │
> │ Right z opisem. Zaznacz kursorem kostkę.               │
> └─────────────────────────────────────────────────────────┘

### 6.4. Krok po kroku — ustawienie dobrego widoku

1. Podwójnym klikiem wycentruj mebel.
2. Ustaw `Shaded` do pracy, `Xray` gdy szukasz złączy w środku.
3. Kostką ustaw `Front`, kółkiem dopasuj wielkość.
4. Do wymiarowania przełącz na `Ortho` (wymiary się nie „rozjeżdżają”).

**Wskazówka:** symbole złączy widać **tylko** w trybie Wireframe / Xray — to celowe, żeby nie zaśmiecać widoku.

---

## 7. Moduł A1 — Jądro / Projekt (Core)

### 7.1. Do czego służy?

Pilnuje całego projektu: zapisywanie, cofanie zmian, zaznaczanie, przesuwanie elementów, jednostki. Sam nie „wie”, co to szafka — przechowuje drzewo elementów i Twoje polecenia.

### 7.2. Narzędzia

| Narzędzie | Gdzie | Opis |
|---|---|---|
| Nowy / Zapisz / Otwórz | Menu projektu | Plik `.spp.json` — cały projekt w jednym pliku |
| Cofnij / Ponów | Strzałki lub Ctrl+Z / Ctrl+Y | Cofanie każdej operacji |
| Zaznaczanie | Klik w 3D lub w drzewie | Klik = jeden element, Ctrl+klik = wiele |
| Gizmo (strzałki) | Pojawia się po zaznaczeniu | Przeciąganie = przesunięcie / obrót |
| Jednostki | Status-bar | mm / cm / m — w stolarce zostaw **mm** |
| Menu kontekstowe (PPM) | Prawy klik na element | Szybkie akcje: CNC, Duplikuj, Ukryj, Usuń |
| Tryby renderu | Pasek widoku | Patrz rozdz. 6 |

### 7.3. Krok po kroku — zapis i otwarcie projektu

1. `Menu → Zapisz projekt` — wybierz miejsce, dostaniesz plik `.spp.json`.
2. `Menu → Otwórz projekt` — wskaż ten plik.
3. Po nieudanej operacji naciśnij `Ctrl+Z`.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 7 — Menu projektu (Zapisz/Otwórz)    │
> │ + okno gizma na zaznaczonej formatce (strzałki XYZ).   │
> └─────────────────────────────────────────────────────────┘

---

## 8. Moduł A3 — SmartFrame (Korpus)

### 8.1. Do czego służy?

Tworzy „skrzynię” mebla — boki, dno, wieniec, plecy. To **zawsze pierwszy krok**. Bez korpusu nie wstawisz półek ani szuflad.

### 8.2. Gdzie to znaleźć?

Panel / pasek narzędzi → `SmartFrame → Utwórz Korpus` lub przycisk `+ Korpus`.

### 8.3. Parametry (co wpisać)

| Parametr | Co znaczy | Przykład |
|---|---|---|
| Szerokość (W) | Całkowita szerokość mebla | 600 mm |
| Wysokość (H) | Całkowita wysokość mebla | 720 mm |
| Głębokość (D) | Jak głęboka jest szafka | 560 mm |
| Liczba stref | Ile pionowych wnęk (1 / 2 / 3) | 1 (prosta szafka) |
| Wysokość dołu / środka | Wysokości poszczególnych stref (góra liczy się sama) | 360 / 360 |
| Odsunięcie pleców / Wpust | Jak cofnięte są plecy, czy jest rowek (wpust) na plecy | 18 mm / tak |

### 8.4. Krok po kroku

1. Kliknij `Utwórz Korpus`.
2. Wpisz W / H / D.
3. Wybierz liczbę stref (na początek 1).
4. Ustaw plecy (odsunięcie + wpust, jeśli potrzebny).
5. Zatwierdź — korpus pojawi się w 3D i w drzewie.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 8a — Okno „Utwórz Korpus” z          │
> │ wypełnionymi wymiarami 600×720×560.                    │
> └─────────────────────────────────────────────────────────┘
>
> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 8b — Gotowy pusty korpus w 3D        │
> │ (widok ISO, tryb Shaded) + ten sam korpus w drzewie.   │
> └─────────────────────────────────────────────────────────┘

**Typowy błąd:** korpus o grubości 0 lub ujemnej — sprawdź, czy materiał ma grubość (rozdz. 11).

---

## 9. Moduł A2 — SmartBox (Wyposażenie wnętrza)

### 9.1. Do czego służy?

Wypełnia pustą wnękę korpusu gotowymi modułami. Program sam wykrywa wnękę i wstawia moduł jako element `_SB` w drzewie.

### 9.2. Narzędzia (8 typów)

| Narzędzie | Co wstawia | Kiedy użyć |
|---|---|---|
| Półki (Shelves) | Jedna lub więcej półek | Klasyczna szafka / regał |
| Wieniec (Shelf top) | Pozioma płyta zamykająca | Podział na strefy |
| Drzwi (Doors) | Fronty nakładane / wpuszczane | Szafka zamykana |
| Drążek (Tubes) | Rura na wieszaki | Szafa ubraniowa |
| Szuflady (Drawers) | Skrzynki szuflad (Blum, Sevroll…) | Komoda, biurko |
| Przegrody (Dividers) | Pionowe podziały wnęki | Segregacja wnętrza |
| Blendy (Panels) | Maskownice / zaślepki | Estetyka, zabudowa |
| Klapy (Flaps) | Fronty uchylne do góry | Szafki wiszące |

Dodatkowo: automatyczne **nawierty systemowe co 32 mm** (pod półki / prowadnice) — nie musisz ich rysować ręcznie.

### 9.3. Krok po kroku

1. Kliknij wnękę korpusu w 3D (podświetli się).
2. Wybierz typ, np. `Półki`.
3. W panelu `smartbox-ui` ustaw liczbę półek, grubość, odsunięcia.
4. Zatwierdź — półki pojawią się w drzewie pod korpusem.
5. Kliknij półkę w drzewie, aby zmienić jej parametry.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 9a — Wykryta wnęka (podświetlenie)   │
> │ + menu wyboru typu SmartBox.                           │
> └─────────────────────────────────────────────────────────┘
>
> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 9b — Panel parametrów półek          │
> │ (liczba, grubość, rozstaw) + wynik w 3D.               │
> └─────────────────────────────────────────────────────────┘
>
> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 9c — Szuflady i drzwi — przykładowy  │
> │ mebel z frontami.                                      │
> └─────────────────────────────────────────────────────────┘

---

## 10. Moduł A4 — SmartPanel (Formatka / Płyta)

### 10.1. Do czego służy?

Edycja pojedynczej płyty: jej rozmiar, pozycja, wymiary pomocnicze. Każda formatka ma 6 ścian i 4 krawędzie do oklejenia.

### 10.2. Parametry

| Parametr | Zakres / uwagi |
|---|---|
| Szerokość W | 50–3000 mm |
| Wysokość H | 50–3000 mm |
| Grubość T | wg materiału (np. 18 mm) |
| Pozycja / obrót | gizmem w 3D |
| Wymiary asocjacyjne | 2 płaszczyzny + offset — „przyklejone” wymiary podążające za płytą |

### 10.3. Krok po kroku

1. Zaznacz formatkę (klik w 3D lub w drzewie).
2. W panelu po prawej zmień W / H / T.
3. Przeciągnij gizmo, aby przesunąć.
4. Włącz wymiary asocjacyjne, jeśli chcesz mieć je zawsze widoczne.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 10 — Panel formatki (W/H/T) +        │
> │ gizmo na płycie + oznaczenie 6 ścian / 4 krawędzi.     │
> └─────────────────────────────────────────────────────────┘

---

## 11. Moduł A7 — Materiały i Obrzeża

### 11.1. Do czego służy?

Nadaje płytom wygląd, grubość i cenę (np. Egger Biały 18 mm) oraz okleja widoczne krawędzie taśmą ABS.

### 11.2. Narzędzia

| Narzędzie | Jak użyć | Efekt |
|---|---|---|
| Lista materiałów | Przeglądaj, filtruj (kategoria, grubość), szukaj po nazwie | Znajdujesz płytę |
| Podgląd / sortowanie | Miniaturki tekstur Egger, ceny zł/m² | Wybierasz dekor |
| Przeciągnij i upuść (drag&drop) | Przeciągnij materiał na formatkę | Nadanie materiału |
| Zakres nadania | Wybierz: SINGLE (jedna płyta) / CONTAINER (cały korpus) / SMARTBOX (moduł) / PROJECT (wszystko) | Decydujesz, ile płyt zmienić |
| Obrzeże ABS | Wybierz: 0.8×22, 1×22, 2×22, 0.8×43 → kliknij krawędź +X / -X / +Y / -Y | Oklejona krawędź |

### 11.3. Krok po kroku — materiał

1. Otwórz listę materiałów.
2. Wpisz w szukajce np. „biały”, ustaw grubość 18.
3. Przeciągnij materiał na korpus, wybierz `CONTAINER`.
4. Wszystkie płyty korpusu zmienią dekor.

### 11.4. Krok po kroku — obrzeże

1. Zaznacz formatkę.
2. Wybierz grubość obrzeża (na fronty zwykle 2 mm, na niewidoczne 0.8 mm).
3. Kliknij krawędzie do oklejenia (np. tylko przód +X).
4. Zapisz — obrzeża widać w drzewie i liczą się w raporcie (mb).

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 11a — Lista materiałów (filtry,      │
> │ szukajka, miniaturki Egger) + strzałka drag&drop.      │
> └─────────────────────────────────────────────────────────┘
>
> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 11b — Okno wyboru zakresu            │
> │ SINGLE/CONTAINER/SMARTBOX/PROJECT.                     │
> └─────────────────────────────────────────────────────────┘
>
> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 11c — Wybór obrzeża i 4 krawędzi     │
> │ (+X/-X/+Y/-Y) na podglądzie płyty.                     │
> └─────────────────────────────────────────────────────────┘

---

## 12. Moduł C2 — Złącza (Kołki, Konfirmaty, Mimośrody)

### 12.1. Do czego służy?

Dodaje otwory pod okucia łączące płyty. Program **sam znajduje styk** dwóch płyt (tolerancja 0,05 mm) — nie wiercisz „w powietrzu”.

### 12.2. Narzędzia

| Narzędzie | Opis |
|---|---|
| Pipeta (start na styku) | Kliknij miejsce, gdzie dwie płyty się stykają |
| Typ złącza | Kołek / Konfirmat / Mimośród |
| Reguła `Symetrycznie` | Otwory lustrzanie po obu stronach |
| Siatka 32 mm | Rozstaw systemowy |
| `firstOffset` | Odsunięcie pierwszego otworu od krawędzi |
| Podgląd symboli | Widoczny tylko w Wireframe / Xray |

### 12.3. Krok po kroku

1. Przełącz viewport na `Xray` (żeby widzieć styki).
2. Weź pipetę, kliknij styk (np. bok + dno).
3. Wybierz typ (np. Konfirmat) i regułę (Symetrycznie, siatka 32).
4. Włącz pozycje, zatwierdź — otwory pojawią się automatycznie.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 12 — Pipeta na styku płyt + okno     │
> │ wyboru złącza + podgląd symboli w trybie Xray.         │
> └─────────────────────────────────────────────────────────┘

**Typowy błąd:** brak styku (szczelina > 0,05 mm) — dosuń płyty gizmem lub więzami (rozdz. 15).

---

## 13. Moduł O1 — Operacje biblioteczne (Wcięcia, Szkło)

### 13.1. Do czego służy?

Gotowe „ stemple” do wycięć w płycie: kieszenie (POCKET) i przeloty (THROUGH), np. pod szybę. Przeciągasz operację na płytę zamiast rysować od zera.

### 13.2. Narzędzia

| Narzędzie | Opis |
|---|---|
| Katalog operacji (`operacje.json`) | Lista gotowych wycięć |
| Drag & drop na formatkę | Przeciągnij operację na płytę |
| Wcięcia L / R / T / B | Odsunięcia od krawędzi (lewo, prawo, góra, dół) |
| Rozmiar + głębokość | Wymiary wycięcia |
| Wiązanie U / V | Do której krawędzi „przyklejone” wycięcie |
| Wypełnienie `glass / none` | Szyba w otworze lub pusty przelot |

### 13.3. Krok po kroku

1. Otwórz katalog operacji.
2. Przeciągnij wybraną operację na formatkę.
3. Ustaw wcięcia L/R/T/B i głębokość.
4. Jeśli to witryna — wybierz wypełnienie `glass`.
5. Klik w drzewie (`cad-edit-library-operation`) otwiera ponowną edycję.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 13 — Katalog operacji + przeciąganie │
> │ na płytę + panel wcięć L/R/T/B + wynik (otwór/szyba).  │
> └─────────────────────────────────────────────────────────┘

---

## 14. Moduł S1 — Sketcher (Szkic na ścianie)

### 14.1. Do czego służy?

Rysowanie punktów / przyszłych otworów bezpośrednio na ścianie płyty. Podstawa pod własne kontury i wiercenia.

### 14.2. Jak użyć?

1. Zaznacz ścianę płyty → aktywuj płaszczyznę szkicu.
2. Kamera ustawi się prostopadle, pojawi się siatka 10 / 50 mm + osie UV + marker.
3. Klikaj punkty (przyciąganie co 1 mm).
4. Wyjdź ze szkicu — punkty zostają zapisane.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 14 — Aktywny szkic: siatka, osie UV, │
> │ marker, kamera prostopadła do ściany.                  │
> └─────────────────────────────────────────────────────────┘

---

## 15. Moduł S2 — Solver (Więzy / Relacje)

### 15.1. Do czego służy?

„Skleja” płyty relacjami, żeby się nie rozjeżdżały: wyrównuje ściany, łączy narożniki, kotwiczy mebel w miejscu.

### 15.2. Narzędzia (4 typy więzów)

| Przycisk | Nazwa | Efekt |
|---|---|---|
| VERTEX | Połącz narożnikami | Dwa narożniki schodzą się w jeden punkt |
| COPLANAR | Wyrównaj ściany | Dwie ściany w jednej płaszczyźnie |
| FLUSH | Dosuń ściany | Płyty stykają się licami |
| GROUND | Kotwicz w miejscu | Element już się nie rusza |

Dodatkowo: pipeta elementów w 3D, tryb `Pokaż tylko SmartFrame`, lista `Relacje` w drzewie, alert przy konflikcie (np. dwie sprzeczne więzy).

### 15.3. Krok po kroku

1. Kliknij typ więzu (np. FLUSH).
2. Pipetą kliknij pierwszą, potem drugą ścianę / narożnik.
3. Sprawdź listę `Relacje` w drzewie.
4. Przy konflikcie — usuń jedną z relacji.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 15 — Pasek 4 więzów + pipeta         │
> │ + lista Relacje w drzewie + przykład wyrównanych ścian.│
> └─────────────────────────────────────────────────────────┘

---

## 16. Moduł A8 — PMI (Wymiarowanie 3D / Miarka)

### 16.1. Do czego służy?

Mierzy i pokazuje wymiary bezpośrednio na modelu 3D — bez wychodzenia do rysunku 2D.

### 16.2. Narzędzia

| Czynność | Jak | Efekt |
|---|---|---|
| Narzędzie `Wymiaruj` | Kliknij w pasek / klawisz | Start mierzenia |
| 1-klik na krawędź | Kliknij krawędź | Wymiar długości krawędzi |
| Punkt–punkt | Kliknij 2 punkty | Odległość między punktami |
| Wyciąganie offsetu | Przeciągnij wymiar od modelu | Linia wymiarowa odsunięta |
| Prowadnice GLOBAL (ciągłe) / LOCAL (przerywane) | Automatyczne | Pomagają równo wyciągnąć wymiar |
| Oś X / Y / Z | Przyciski osi | W którą stronę odsunąć wymiar |
| Blokada osi Shift+X / Y / Z | Przytrzymaj Shift + klawisz | Mierzysz tylko w jednej osi |
| Zatwierdź | Enter lub LPM | Wymiar zostaje |
| Cofnij / Wyjście | Esc / PPM = cofnij krok, podwójny klik = wyjście | Anulowanie |

### 16.3. Krok po kroku

1. Włącz `Wymiaruj`.
2. Kliknij krawędź korpusu.
3. Odciągnij wymiar, wybierz oś (np. X).
4. Enter — wymiar z kotwicą zostaje (trzyma się mimo obrotu modelu).

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 16 — Wymiar PMI na modelu +          │
> │ prowadnice GLOBAL/LOCAL + panel osi X/Y/Z.             │
> └─────────────────────────────────────────────────────────┘

---

## 17. Moduł C1 — CNC (Programy na maszynę)

### 17.1. Do czego służy?

Zamienia otwory i frezowania z formatki na plik dla maszyny (Homag, Biesse, SCM, Mach3/Kimla, Fanuc). Widok osobny (`cnc.html`), żeby skupić się na jednej płycie.

### 17.2. Gdzie to znaleźć?

PPM na formatce w drzewie → `CNC` — otworzy się strona CNC z tą płytą. Albo otwórz `cnc.html` i wczytaj JSON `workpiece`.

### 17.3. Narzędzia

| Narzędzie | Opis |
|---|---|
| Wybór formatki | Którą płytę programujesz |
| Operacje: Wiercenie (G81 / G83) | Otwory przelotowe i głębokie |
| Operacje: Frezowanie (G41 / G42 + leadIn/Out) | Kontury z wejściem/wyjściem narzędzia |
| Operacje: Kieszeń (Pocketing) | Wybrania pod zawiasy, szuflady |
| WCS | Ustawienie „zera” płyty na stole |
| Narzędzia / baza narzędzi | Średnice wierteł i frezów |
| Symulacja ścieżki | Podgląd ruchów narzędzia przed wysłaniem |
| Postprocesor | Homag `.mpr`, Biesse `.cix/.bpp`, SCM `.xxl/.pgm`, ISO (Mach3/Kimla), Fanuc G43 |
| Zapis programu | Program dopisuje się do formatki w drzewie |

### 17.4. Krok po kroku

1. PPM na formatce → CNC.
2. Sprawdź WCS (zero w rogu płyty).
3. Dodaj operacje (wiercenie / frezowanie / kieszeń), dobierz narzędzia.
4. Uruchom symulację — sprawdź, czy ścieżki nie wychodzą poza płytę.
5. Wybierz postprocesor Twojej maszyny → Generuj → zapisz plik.
6. Wróć do CAD — program jest zapisany przy formatce.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 17a — Okno CNC: lista operacji +     │
> │ panel WCS + wybór narzędzi.                            │
> └─────────────────────────────────────────────────────────┘
>
> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 17b — Symulacja ścieżki narzędzia    │
> │ + wybór postprocesora (Homag/Biesse/SCM/ISO/Fanuc).    │
> └─────────────────────────────────────────────────────────┘

**Ważne:** zawsze rób symulację przed wysłaniem na maszynę!

---

## 18. Moduł N1 — Nesting (Rozkrój płyt)

### 18.1. Do czego służy?

Układanie wszystkich formatek na pełnych płytach (np. 2800×2070), żeby zużyć jak najmniej materiału. Wynik: arkusze rozkroju + eksport.

### 18.2. Narzędzia

| Narzędzie | Opis |
|---|---|
| Lista formatek | Z CAD automatycznie / z CSV / JSON |
| Filtr po materiale | Osobny rozkrój dla każdej grubości/dekoru |
| Ustawienia płyty | Wymiary arkusza, rzaz (szerokość piły), odstępy |
| Auto-upakowanie | Jeden klik — program układa formatki |
| Podgląd graficzny | Arkusze z narysowanymi formatkami |
| Eksport | CSV / program do piły |

### 18.3. Krok po kroku

1. Otwórz Nesting.
2. Sprawdź listę formatek (powinna przyjść z CAD).
3. Ustaw płytę (np. 2800×2070), rzaz 4 mm, odstęp 5 mm.
4. Kliknij auto-upakowanie.
5. Przejrzyj arkusze, wyeksportuj CSV.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 18 — Panel ustawień + podgląd        │
> │ arkuszy z ułożonymi formatkami + statystyka odpadu.    │
> └─────────────────────────────────────────────────────────┘

---

## 19. Moduł D1 — Draw (Rysunek 2D)

### 19.1. Do czego służy?

Klasyczny rysunek techniczny na arkusz ISO z tabelką — do warsztatu i klienta. Nieskończone płótno + pływający arkusz.

### 19.2. Narzędzia

| Narzędzie | Jak użyć |
|---|---|
| Przeciągnij model na arkusz | Tworzy widok bazowy FRONT |
| `Rzut Pochodny` | Kliknij widok bazowy → dostaw rzut: w prawo = bok, w dół = góra, po skosie = ISO |
| `Wymiar CAD` | Kliknij punkt P1, potem P2 — gotowy wymiar |
| Format arkusza | A3 / A4… |
| Skala | 1:5 / 1:10 / 1:20 |
| Tabelka ISO 7200 | Automatyczny nagłówek rysunku |
| Druk / PDF / SVG / JPG | Eksport gotowego arkusza |
| `Delete` | Usuwa zaznaczony rzut |

### 19.3. Krok po kroku

1. Otwórz Draw.
2. Przeciągnij korpus na arkusz (powstaje FRONT).
3. Dodaj rzuty pochodne (bok, góra).
4. Zwymiaruj (P1–P2).
5. Ustaw format i skalę → Drukuj / PDF.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 19 — Arkusz z 3 rzutami (przód, bok, │
> │ góra) + wymiary + tabelka ISO.                         │
> └─────────────────────────────────────────────────────────┘

---

## 20. Moduł E3 — Studio dokumentacji 3D

### 20.1. Do czego służy?

Dokumentacja z **widokami 3D** (nie płaskimi rzutami): wiele ujęć mebla na jednym arkuszu, każde z własnym kątem. Jedno wspólne płótno + ramki z 8 uchwytami do rozciągania.

### 20.2. Narzędzia

| Narzędzie | Opis |
|---|---|
| Wielokrotny drop | Przeciągaj korpus / formatki na arkusz ile razy chcesz |
| Własny kąt każdej ramki | ViewCube + ISO dla każdego ujęcia |
| Tryb `Shaded / Edges / Wire / Xray` | Osobny wygląd każdej ramki |
| Suwak zakresu | Ile modelu widać w ramce |
| Nakładka PMI | Wymiary 3D na wydruku |
| Format papieru | A3 / A4… |
| Zapis / otwieranie arkuszy | Szablony dokumentacji |
| Druk / PDF | Eksport |

### 20.3. Krok po kroku

1. Otwórz E3.
2. Przeciągnij korpus 3 razy (przód, ISO, detal szuflady).
3. W każdej ramce ustaw kąt kostką i tryb (np. detal w Xray).
4. Włącz nakładkę PMI.
5. Drukuj / PDF.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 20 — Arkusz E3 z 3 ramkami 3D        │
> │ (różne kąty i tryby) + uchwyty ramki.                  │
> └─────────────────────────────────────────────────────────┘

---

## 21. Moduł E1 — Eksport prosty

### 21.1. Do czego służy?

Szybki eksport arkusza / dokumentacji bazowej bez studia E3. Podgląd granic eksportu widać w zakładce.

### 21.2. Jak użyć?

1. Otwórz podgląd eksportu.
2. Sprawdź granice (czy wszystko się mieści).
3. Eksportuj.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 21 — Podgląd granic eksportu.        │
> └─────────────────────────────────────────────────────────┘

---

## 22. Moduł R1 — Raporty i Wycena

### 22.1. Do czego służy?

Liczy, ile mebel kosztuje i ile materiału potrzebujesz: m² płyt, metry obrzeży, okucia. Wynik: czytelny raport HTML do druku.

### 22.2. Narzędzia

| Pozycja raportu | Skąd się bierze |
|---|---|
| Powierzchnia m² | Z formatek (automatycznie) |
| Metry obrzeży (mb) | Z modułu A7 |
| Koszty płyt | Z cennika `prices.json` |
| Koszty obrzeży + akcesoriów | Z cennika |
| Rozbicie na meble | Projekt → meble → formatki |
| `BRAK CENY` | Materiał nie ma ceny w cenniku — uzupełnij |
| `Odśwież z CAD` | Pobiera świeże dane z projektu |
| Druk | Drukowanie z `report.html` |

### 22.3. Krok po kroku

1. Otwórz Raport.
2. Kliknij `Odśwież z CAD`.
3. Sprawdź pozycje; przy `BRAK CENY` uzupełnij cennik.
4. Drukuj / zapisz PDF dla klienta.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 22 — Przykładowy raport: tabela      │
> │ m²/mb/szt + suma kosztów + rozbicie na meble.          │
> └─────────────────────────────────────────────────────────┘

---

## 23. Moduł Biblioteki — Okucia i Szuflady

### 23.1. Do czego służy?

Fabryczne dane okuć (Blum Antaro M, Tandem, Sevroll SlimBox, Merivo) — warianty wysokości i długości 300–500 mm z gotowymi pozycjami otworów boku i frontu. Używane **pośrednio**: silniki szuflad (rozdz. 9) same biorą stąd wiercenia.

Nie musisz nic klikać — wystarczy, że wybierzesz system szuflady w SmartBox, a otwory ustawią się same wg biblioteki.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 23 — Lista systemów szuflad          │
> │ (Blum/Merivo/SlimBox) + schemat otworów.               │
> └─────────────────────────────────────────────────────────┘

---

## 24. Typowe przepływy pracy (od projektu do maszyny)

### Wariant A — Szafka kuchenna (pełny cykl)

1. SmartFrame: korpus 600×720×560, 1 strefa → 2. SmartBox: 2 półki → 3. A7: Egger + obrzeża 2 mm z przodu → 4. C2: konfirmaty na stykach → 5. A8: zwymiaruj → 6. N1: rozkrój → 7. C1: programy `.mpr` → 8. D1/E3: rysunek → 9. R1: wycena.

### Wariant B — Szafa z szufladami i drzwiami

1. Korpus 1200×2000×600, 2 strefy → 2. Strefa 1: drążek + półka, strefa 2: 3 szuflady (Blum) → 3. Drzwi → 4. Solver: wyrównaj fronty (FLUSH) → 5. Dalej jak wariant A.

### Wariant C — Sama wycena dla klienta

1. Sam korpus + materiał → 2. Raport → Odśwież → PDF. Bez CNC i nestingu.

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 24 — Schemat przepływu (diagram):    │
> │ Korpus → SmartBox → Materiał → Złącza → PMI → Nesting  │
> │ → CNC → Draw/E3 → Raport.                              │
> │ Możesz narysować odręcznie i sfotografować.            │
> └─────────────────────────────────────────────────────────┘

---

## 25. Skróty klawiszowe i mysz (ściąga)

| Gdzie | Klawisze / mysz | Efekt |
|---|---|---|
| 3D | ŚPM / Alt+LPM + ruch | Obrót |
| 3D | Shift+ŚPM + ruch | Pan |
| 3D | Kółko | Zoom do kursora |
| 3D | 2×klik | Centrowanie |
| Ogólne | Ctrl+Z / Ctrl+Y | Cofnij / Ponów |
| Ogólne | Delete | Usuń zaznaczone (rzut w Draw, wymiar, relację) |
| PMI | Enter / LPM | Zatwierdź wymiar |
| PMI | Esc / PPM | Cofnij krok |
| PMI | Shift+X / Y / Z | Blokada osi pomiaru |
| PMI | 2×klik | Wyjście z narzędzia |
| Drzewo | 2×klik na nazwę | Zmień nazwę |
| Drzewo | Ctrl+klik | Zaznacz wiele |

> ┌─────────────────────────────────────────────────────────┐
> │ 🖼️ RAMKA NA ZRZUT 25 — Ściąga graficzna: mysz z        │
> │ podpisanymi przyciskami (LPM/ŚPM/PPM/kółko).           │
> └─────────────────────────────────────────────────────────┘

---

## 26. Częste problemy i rozwiązania (FAQ)

| Problem | Przyczyna | Rozwiązanie |
|---|---|---|
| Nie widać symboli złączy | Jesteś w Shaded | Przełącz na Wireframe / Xray |
| Złącza nie chcą się dodać | Brak styku (> 0,05 mm szczeliny) | Dosuń płyty gizmem lub więzami FLUSH |
| `BRAK CENY` w raporcie | Brak ceny materiału w `prices.json` | Uzupełnij cennik |
| Nesting nie układa | Mieszane materiały na jednej liście | Użyj filtra po materiale |
| Ścieżka CNC poza płytą | Złe WCS lub narzędzie za duże | Sprawdź zero, zmniejsz frez, zrób symulację |
| Model „rozjeżdża się” | Brak więzów | Dodaj FLUSH / COPLANAR / GROUND |
| Pusty ekran po otwarciu | Nieudany build / brak serwera dev | Sprawdź konsolę przeglądarki (F12), zrestartuj `npm run dev` |
| Wymiary PMI „uciekają” | Perspektywa zamiast Ortho | Przełącz kamerę na Ortho |

---

*Koniec instrukcji. Dokument wygenerowany na podstawie analizy kodu aplikacji SmartPanel Web (moduły A1–A8, C1–C2, D1, E1/E3, N1, O1, R1, S1–S3). Ramki 🖼️ uzupełnij zrzutami ekranu z aplikacji — każdy opis mówi, co ma być widać.*
