# Jedno Źródło Prawdy (SSOT) — Architektura Wymiany Danych (Web CAD)

Ten katalog (`A1_core`) zawiera definicje i silnik obsługi formatu wymiany danych **SSOT (Single Source of Truth)**. 
Projekt ewoluował z prototypu opartego na Blenderze w kierunku w pełni niezależnego systemu **Web CAD**, którego natywną jednostką są **MIKRONY (µm)**.

---

## 🗺️ Jak to działa (Przepływ danych)

```mermaid
graph TD
    JSON[Wspólny plik JSON (Standard SSOT w mikronach)]
    AI[Asystent AI (Gemini)] -- "Generuje/Modyfikuje" --> JSON
    JSON -- "ProjectSerializer (Import)" --> WebCAD[Przeglądarka Web (React + TS + OCCT)]
    WebCAD -- "ProjectSerializer (Zapisz)" --> JSON
    Blender[Blender SceneSerializer] -- "Import Legacy (metry)" --> WebCAD
```

---

## 📁 Główne pliki systemu SSOT

1. **[unit-system.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/smartbox/web/A1_core/unit-system.ts)**
   * **Rola:** Definicja natywnej jednostki Web CAD.
   * **Opis:** Wprowadza typ `Microns` (zawsze `integer`). Pozwala to na absolutną dokładność geometrii bez błędów zmiennoprzecinkowych, które mogą wystąpić przy użyciu milimetrów jako `float`. W tym pliku znajdują się wszystkie narzędzia konwersji (np. `unit.fromMM`, `unit.toMM`).
2. **[project_schema.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/smartbox/web/A1_core/project_schema.ts)**
   * **Rola:** Ścisły kontrakt typów w TypeScript.
   * **Opis:** Definiuje strukturę JSON. Zwróć uwagę, że wszystkie wielkości fizyczne (wymiary, pozycje) są definiowane w typie `Microns`.
3. **[project-serializer.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/smartbox/web/A1_core/project-serializer.ts)**
   * **Rola:** Warstwa tłumaczenia danych i konwersji jednostek.
   * **Opis:** Podczas importu rozpoznaje czy plik pochodzi z Blendera (`smartbox_scene` - metry) czy z nowego formatu Web CAD (`project` - mikrony) i bezbłędnie przelicza wszystko do wewnętrznego stanu przeglądarki. Eksport zawsze generuje strukturę Web CAD opartą o mikrony.

---

## 📐 Dlaczego używamy Mikronów?

Wcześniejszy prototyp oparty na Blenderze używał metrów (`float`), co przy wysokiej precyzji w Web CAD prowadzi do tzw. "floating point drift" (np. grubość płyty to `18.00000001` mm).

Przejście na system w mikronach zapisywanych jako liczby całkowite rozwiązuje najważniejsze problemy systemów inżynieryjnych:
- `18 mm` to dokładnie `18000 µm`.
- `1 cal (inch)` to dokładnie `25400 µm`.
- Porównania pozycji są binarne (`a === b`), a nie przybliżone.

*Notatka: Modele w pamięci RAM (`ProjectModel`, `PanelModel`) są w trakcie pełnej tranzycji na mikrony. Na ten moment `ProjectSerializer` nadal używa milimetrów (`float`) do zasilania OCCT, jednak sam plik JSON w spoczynku zawsze jest nieskazitelnie precyzyjny.*
