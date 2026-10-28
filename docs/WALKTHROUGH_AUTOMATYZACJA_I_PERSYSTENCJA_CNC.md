# Walkthrough: Automatyzacja Obróbki CNC i Trwała Persystencja Programów CAM Formatek

Dokument opisuje proces diagnostyki, korekty technologicznej oraz wdrożenia pełnej automatyzacji i persystencji programów CNC w łańcuchu CAD $\to$ CAM $\to$ CNC.

---

## 1. Kontekst Biznesowy i Wykryte Problemy

W ramach weryfikacji projektu szafy $2500 \times 800 \times 560\text{ mm}$ (fronty z ramki aluminiowej ze szkłem, uchwyty Easty 160, rewizja przelotowa, półki w systemie 3 otworów na półkę) przeprowadzono testy generowania kodu maszynowego CNC dla prawego boku korpusu (`Bok_P`).

W trakcie analizy wygenerowanego kodu ujawniono dwa istotne problemy:

### Problem 1: Błąd technologiczny doboru narzędzia (jedno wiertło zamiast dwóch)
W wygenerowanym pliku G-code dla prawego boku pojawiło się wyłącznie jedno narzędzie (`T2`), mimo że bok posiada dwa różne typy nawiertów:
- Otwory pod podpórki półek: $\varnothing 5\text{ mm}$ (system TRIPLE, raster $32\text{ mm}$, 3 otwory na linię front/tył),
- Otwory pod wkręty montażowe prowadników zawiasów Blum: nawiert pilotujący $\varnothing 3\text{ mm}$.

**Przyczyna źródłowa:** W katalogu okuć [B1_biblioteka/zawiasy/BLUM_71B3550.json](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawiasy/BLUM_71B3550.json) otwory w korpusie (`corpus_holes`) miały na sztywno wpisaną średnicę `"dia": 5` (odpowiadającą rzadziej stosowanemu montażowi systemowemu na eurowkręty EXPANDO), zamiast standardowego nawiertu pilotującego $\varnothing 3\text{ mm}$ pod wkręty do drewna. W efekcie silnik potraktował wszystkie 34 otwory jako $\varnothing 5\text{ mm}$ i przydzielił tylko jedno wiertło.

### Problem 2: Brak programu CNC w UI po wywołaniu `generateWardrobeDemo()`
Po wywołaniu w konsoli przeglądarki `window.generateWardrobeDemo()` i przejściu do zakładki CNC, panel boku pokazywał:
`Brak utworzonych programów CNC`.

**Przyczyny źródłowe:**
1. **Brak generowania programu CAM w generatorze:** `generateWardrobeDemo()` tworzyło węzły CAD oraz cechy geometryczne formatki (`panel.features`), ale nie tworzyło obiektu programu CNC (`panel.cncPrograms`).
2. **Brak persystencji w modelu płyty (`PanelModel`):** Metody `toJSON()` i `fromJSON()` w klasie `PanelModel` ([A4_smartpanel/panel-model.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts)) w ogóle nie uwzględniały właściwości `cncPrograms`. Każdy program CNC był jedynie ulotnym stanem w pamięci RAM i znikał po zapisie/odczycie `.spp.json`.
3. **Puste programy przy ręcznym tworzeniu w UI:** Przycisk „*Utwórz program CNC*” w [C1_cnc/ui/CncPanel.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/CncPanel.tsx) tworzył pusty program (`features: []`). Użytkownik musiał ręcznie przejść do podmenu *Operacja*, kliknąć *Wykryj cechy (otwory)* i ręcznie przypisać wiertła dla wszystkich otworów.

---

## 2. Wprowadzone Zmiany Architektoniczne

### A. Korekta średnic otworów w katalogu zawiasów Blum
W plikach katalogowych:
- [B1_biblioteka/zawiasy/BLUM_71B3550.json](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawiasy/BLUM_71B3550.json)
- [B1_biblioteka/zawiasy/BLUM_71T3550.json](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/B1_biblioteka/zawiasy/BLUM_71T3550.json)

Zaktualizowano pole `corpus_holes`:
```json
"corpus_holes": [
  { "name": "Prowadnik_otw_G", "dia": 3, "depth": 12, "front_dist": 37, "z_offset": 16, "object": "Cylinder" },
  { "name": "Prowadnik_otw_D", "dia": 3, "depth": 12, "front_dist": 37, "z_offset": -16, "object": "Cylinder" }
]
```
W korpusie generowany jest teraz nawiert $\varnothing 3\text{ mm}$, co w magazynie narzędzi natychmiast dopasowuje wiertło **T6** (`tool_6_drill_3`).

---

### B. Pełna Persystencja Programów CNC w `PanelModel`
W [A4_smartpanel/panel-model.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A4_smartpanel/panel-model.ts):

1. **Serializacja (`toJSON`)**:
   Zabezpieczono cykliczną referencję `targetPanel` i włączono programy CNC do zrzutu JSON:
   ```typescript
   ...(this.cncPrograms && this.cncPrograms.length > 0 ? {
       cncPrograms: this.cncPrograms.map(p => {
           const { targetPanel: _tp, ...rest } = p;
           try {
               return JSON.parse(JSON.stringify(rest));
           } catch {
               return {
                   id: p.id,
                   name: p.name,
                   wcsName: p.wcsName,
                   cornerIndex: p.cornerIndex,
                   postprocessor: p.postprocessor,
                   features: p.features || [],
                   toolAssignments: p.toolAssignments || {}
               };
           }
       })
   } : {})
   ```

2. **Deserializacja (`fromJSON`)**:
   Przy wczytywaniu projektu `.spp.json` programy CNC są odtwarzane i ponownie wiązane z formatką:
   ```typescript
   if (data.cncPrograms && Array.isArray(data.cncPrograms)) {
       this.cncPrograms = data.cncPrograms.map((p: any) => ({
           ...p,
           targetPanel: this,
           targetPanelId: String(this.id || p.targetPanelId || ''),
           targetPanelLabel: this.name
       }));
   }
   ```

---

### C. Moduł Automatyzacji CAM ([C1_cnc/core/cam-auto-program.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/core/cam-auto-program.ts))
Utworzono dedykowany moduł dostarczający funkcje:
- `buildDefaultCncProgramForPanel(panel, toolLib?)`:
  1. Pobiera bazę WCS formatki na podstawie jej roli w meblu (`WcsRulesMapper.getRuleForRole`).
  2. Ekstrahuje cechy geometryczne z formatki (`GeometryDataExtractor`).
  3. Automatycznie dopasowuje narzędzia z magazynu `ToolLibrary`:
     - $\varnothing 3\text{ mm}$ $\to$ `tool_6_drill_3` (**T6**),
     - $\varnothing 5\text{ mm}$ $\to$ `tool_2_drill_5` (**T2**),
     - wpust nuty $\to$ `tool_1_saw_150` / `tool_4_mill_8`.
  4. Zwraca kompletny obiekt `CNCProgramState`.
- `ensurePanelHasCncProgram(panel, toolLib?)`:
  Gwarantuje, że jeśli formatka posiada operacje obróbcze, program CNC zostanie natychmiast utworzony i przypisany do `panel.cncPrograms`.

---

### D. Automatyczne Generowanie w `generateWardrobeDemo`
W [S2_solver/demo-row.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/S2_solver/demo-row.ts):
- Ustawiono parametry półek na `wzor_nawiercen: 'TRIPLE'` i `rozstaw_potrojny_z_mm: 32`.
- Po utworzeniu szafy i zsynchronizowaniu wierceń funkcja iteruje po formatkach i dla każdej z nich wywołuje `ensurePanelHasCncProgram(pModel)`.
- Zaktualizowano produkcyjny plik projektu [szafa_2500x800x560.spp.json](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/szafa_2500x800x560.spp.json).

---

### E. Integracja z Komponentem UI CAM ([C1_cnc/ui/CncPanel.tsx](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/ui/CncPanel.tsx))
1. **Auto-inicjalizacja przy zaznaczeniu formatki (`useEffect`)**:
   Gdy użytkownik zaznaczy formatkę posiadającą cechy obróbcze (`features.length > 0`), dla której nie ma jeszcze programu CNC, system natychmiast powołuje program domyślny z dopasowanymi narzędziami.
2. **Auto-populacja przy ręcznym tworzeniu programu (`handleCreateProgramForFormatka`)**:
   Kliknięcie przycisku „*Utwórz program CNC*” nie tworzy już pustego programu — od razu wywołuje `buildDefaultCncProgramForPanel()`, uzupełniając operacje i narzędzia.

---

## 3. Wygenerowany Kod Maszynowy dla Prawego Boku (`Bok_P`)

Pliki zapisane fizycznie na dysku:
- [Bok_Prawy.tap](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/Bok_Prawy.tap)
- [Bok_Prawy.nc](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/Bok_Prawy.nc)
- [Bok_Prawy.mpr](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/Bok_Prawy.mpr)

### Wyciąg z G-Code (standard Mach3 / Fanuc / ISO):
```gcode
G55
G80 G90
(narzedzie T2 - WIERTŁO FI 5 MM: 30 OTWORÓW PODPÓREK PÓŁEK)
N10 M6 T2 D2
N20 M3 S3000
N30 F1000
N40 G81 X-220.000 Y-870.833 Z9.000 R5
N50 X-220.000 Y-838.833
N60 X-220.000 Y-806.833
N70 X-220.000 Y-457.167
N80 X-220.000 Y-425.167
N90 X-220.000 Y-393.167
N100 X-220.000 Y-43.500
N110 X-220.000 Y-11.500
N120 X-220.000 Y20.500
... (kolejne punkty wierceń półek) ...
N330 X240.000 Y-870.833
N340 G80

(narzedzie T6 - WIERTŁO FI 3 MM: 4 OTWORY PROWADNIKÓW BLUM)
N350 M6 T6 D6
N360 M3 S3000
N370 F800
N380 G81 X-243.000 Y-1128.000 Z9.000 R5
N390 X-243.000 Y-1096.000
N400 X-243.000 Y1096.000
N410 X-243.000 Y1128.000
N420 G80
N430 M2
```

---

## 4. Weryfikacja Automatyczna i Bramka Jakościowa

Wdrożono testy jednostkowe i integracyjne:
1. **[C1_cnc/\_\_tests\_\_/right-panel-cnc.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/C1_cnc/__tests__/right-panel-cnc.test.ts)**:
   - Sprawdza precyzyjne przypisanie wiertła T6 do otworów $\varnothing 3\text{ mm}$ i T2 do otworów $\varnothing 5\text{ mm}$.
   - Weryfikuje obecność obu sekcji `M6 T2` i `M6 T6` w wygenerowanym kodzie NC.
2. **[A2_bloki/\_\_tests\_\_/generate-wardrobe.test.ts](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A2_bloki/__tests__/generate-wardrobe.test.ts)**:
   - Weryfikuje roundtrip: serializację do `.spp.json` oraz ponowne wczytanie projektu przez `ProjectDocument.load()`.
   - Potwierdza przetrwanie programów CNC (`loadedRightModel.cncPrograms`) oraz poprawność 34 cykli wierceń i wpustu nuty pod plecy.
3. **Bramka `npm run verify`**:
   - `tsc --noEmit` (0 błędów typowania),
   - `vitest run` (206 zestawów testowych, 1406 testów zaliczonych),
   - `audit-display-name-logic.mjs` (0 naruszeń kontraktów architektonicznych).
