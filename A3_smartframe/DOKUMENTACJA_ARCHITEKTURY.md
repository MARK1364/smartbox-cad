# Architektura Systemu Bloki / SmartFrame
*Zasady przełożenia systemu Python/Blender na środowisko Web/TypeScript.*

Ten dokument podsumowuje kluczowe zasady integracji oparte na "Single Source of Truth", jakie wypracowaliśmy przy przenoszeniu dodatku CAD z Blendera.

---

## 1. Nazewnictwo i Taksonomia (Naming & Identity Conventions)
- **Tożsamość i Typy Bloków**: Moduł Bloki (Półki, Szuflady, Drzwi itd.) jest reprezentowany przez kontener o typie węzła `NodeType.ASSEMBLY` z flagą domenową `is_blok: true` oraz odpowiednią rolą (`role: 'SHELF'`, `role: 'DOOR'` itp.). Logika nigdy nie odpytuje stringów wyświetlanych ani nie wymaga specjalnych sufiksów w nazwach.
- **Klucze Płyt (`part_key` / `key`)**: Każda wygenerowana część fizyczna, która wychodzi z silnika korpusu (np. boki, wieńce) otrzymuje unikalny klucz oraz rolę (np. `LEFT_SIDE_PANEL`, `BOTTOM_PANEL`, `BACK_PANEL`). Pozwala to Blokowi identyfikować ściany bez polegania na indeksowaniu czy nazwach wyświetlanych.

## 2. Hierarchia Obiektów i Dziedziczenie 3D
- **Korpus (SmartFrame) jako rodzic**: Zawsze istnieje jeden bazowy element nadrzędny, stanowiący układ odniesienia dla reszty.
- **Bloki to Dziecko**: Kontenery modułów Bloki są fizycznymi elementami potomnymi wybranego Korpusu w drzewie `CADNode`.
- **Półki / Panele to Wnuki**: Pojedyncze części np. półki czy szuflady znajdują się wewnątrz swojego nadrzędnego kontenera Bloku. Dopiero to ustawienie gwarantuje, że obrys Bloku zarządza dziećmi i aktualizuje ich wymiary w przestrzeni korpusu.

## 3. Dynamiczne Ściany Referencyjne (Auto-References)
Jest to serce elastycznego łączenia modułów. Zamiast zaszywać w kodzie sztywną matematykę (np. *szerokość_wnetrza = szerokosc - 2 * 18mm*), system robi to dynamicznie:
- **Kaskadowe dziedziczenie referencji**: 
  1. Najpierw ładowane są globalne zasady dla całego mebla z `reference_contract_smartframe.json` (który określa abstrakcyjne limity całego mebla, np. dla Blend czy Paneli nachodzących na zewnątrz - `OUTER`).
  2. Następnie wpisy te są nadpisywane przez dedykowany dla konkretnego mebla plik z regułami, np. `korpus3_3_rules.json`, który dzieli wnętrze na konkretne strefy (np. wpis `B_side.X_MIN_INNER`).
  3. Jeśli podczas czytania silnik nie znajdzie detali dla strefy (np. brakuje wpisu z przedrostkiem `B_side.`), bezpiecznie "cofa się poziom wyżej" i używa wpisu z bazy.
- **Odnajdywanie Fizyczne (`component`)**: Jeśli reguła wskazuje na konkretną płytę (np. `B_BOK_L`), silnik Web przeczesuje drzewo korpusu. Gdy ją znajdzie, wyciąga jej aktualne rozmiary oraz przesunięcie (grubość, pozycję w scenie) i **opiera** ścianę Bloku dokładnie na wyznaczonym brzegu (`INNER` - wewnątrz mebla, `OUTER` - obrys zewnętrzny). Jeśli użytkownik np. pogrubi lewy bok mebla, całe wnętrze automatycznie ulegnie zawężeniu.
- **Typ `symbolic` (np. Y_MIN_INNER)**: Zdarza się, że obrys mebla nie ma fizycznej ściany (jak przód otwartego korpusu). W takim przypadku JSON oznacza ten parametr jako `symbolic`. Parser wie wtedy, by zignorować skanowanie w poszukiwaniu obiektu, używając skrajnej obwiedni wirtualnej ("fallback matematyczny" = np. pozycja - Głębokość / 2).

## 4. JSON to Szablony, a nie tylko liczby
Kluczem architektonicznym przepisywania kodu na TS jest świadomość, że pliki takie jak `shelves_3_rules_V1.json` **nie są** zwykłymi plikami z parametrami - są to pełnoprawne Szablony Modułowe.
- Silnik (Web/Python) z założenia musi być głupi ("dumb engine"). Powinien opierać logikę o to, co przetrawi ze słownika.
- Maksymalna liczba półek, ich nazwy (np. iteracja od `SHELF_1` do `SHELF_8`), tolerancje grubości czy obecność definicji otworów `features` (takich jak nawierty `SINGLE`, rzędy otworów `ROW_HOLES_32`) **powinny pochodzić wyłącznie** ze ścisłego czytania tego co wypluł parser z pola `model_tree.root_assembly.subcomponents`.
- Dzięki temu architekt i stolarz tworzący modyfikację w plikach JSON, automatycznie aktualizuje możliwości środowiska webowego i blendera w dokładnie tym samym stopniu.

## 5. Układ Współrzędnych Formatki (Pivot = Geometryczny Środek)
- **Złota zasada (LCS)**: Punkt zerowy `(0,0,0)` każdej płyty (LCS_Origin) MUSI znajdować się dokładnie w jej **geometrycznym środku** (współrzędne od `-wymiar/2` do `wymiar/2`). 
- **Dlaczego?**: Jak ustaliliśmy, dzięki temu matematyka jest powtarzalna i prosta. Nie trzeba zastanawiać się, w którym narożniku znajduje się początek układu odniesienia. Operacje symetrii, obracania czy ustawiania wymiarów są naturalne i niezależne od roli płyty w korpusie (np. lewy czy prawy bok mebla mają spójną mechanikę obrotu). Narzędzia obróbcze CNC i tak relatywnie bazują WCS w zadanym narożniku (za pomocą `WcsCornerSolver`), ale sama geometria natywnie w 3D zawsze promieniuje ze swojego środka.
