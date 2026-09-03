# Usunięcie Sztywnych Reguł dla Nawiertów SmartBox

Ten plan ma na celu całkowite usunięcie starych, kruchych reguł wykrywania ról i nazw (np. sprawdzania czy nazwa zawiera `_l` lub czy `role === 'LEFT_SIDE_PANEL'`) podczas generowania nawiertów dla szuflad, półek, frontów i klap. Zamiast tego oprzemy się na bezwzględnej prawdzie: dokładnych identyfikatorach formatek (`nodeId`) wykrytych przez fizyczny raycasting (`probeBayFromSceneRay`), które są zapisywane w każdym SmartBoxie podczas jego wstawiania.

## Open Questions
- **Kompatybilność wsteczna:** Jeśli załadujesz stary projekt (sprzed aktualizacji), w którym SmartBox nie ma zapisanego `boundary` w swoim `generatorParams`, czy mamy pominąć generowanie dla niego nawiertów, czy raczej spróbować go odszukać używając starej, bezpieczniejszej (ale wciąż bazującej na rolach) metody scentralizowanej w `A1_core/panel-lookup.ts`? Zalecam użycie `findCabinetPanel` z `panel-lookup.ts` jako bezpiecznego "fallbacku" dla starych projektów.

## Proposed Changes

### A2_smartbox/shelves-drilling-builder.ts
- [MODIFY] Usunięcie duplikacji przestarzałego kodu zgadującego formatki po nazwie (usunięcie funkcji `collectCabinetPanels`, `getZonePrefix`, `isPanelMatchingZone`, `findPanelForWorldZ`).
- [MODIFY] Zmiana logiki szukania boku dla każdej półki: bezpośrednie pobieranie lewego i prawego boku używając `doc.findNode(sb.generatorParams.boundary.left.nodeId)` oraz `right.nodeId`.
- [MODIFY] Dodanie "fallbacku" wykorzystującego scentralizowany `findCabinetPanel`, gdy `boundary` jest niedostępne.

### A2_smartbox/drawers-drilling-builder.ts
- [MODIFY] Analogiczne usunięcie ręcznych parserów ról/nazw i przejście na bezpośrednie powiązania referencyjne zapisane we wnęce.
- [MODIFY] Bezpośrednie wyciągnięcie lewego i prawego boku przez powiązanie z `DetectedBay` w `sb.generatorParams.boundary`.

### A2_smartbox/doors-drilling-builder.ts
- [MODIFY] Usunięcie sprawdzania `role.includes('BOK')` czy `name.includes('_l')`.
- [MODIFY] Generatory nawiasów drzwi po lewej / prawej stronie będą opierać się w 100% na `sb.generatorParams.boundary.left` / `right`.

### A2_smartbox/flaps-drilling-builder.ts
- [MODIFY] Usunięcie starej metody wykrywania wieńca górnego/dolnego i boków poprzez nazwy `TOP_PANEL` / `key.endsWith('_TOP')`.
- [MODIFY] Bezpośrednie przypisanie nawiertów klapy do `sb.generatorParams.boundary.top.nodeId` lub odpowiednio boków wnęki.

## Verification Plan

### Automated Tests
- Uruchomienie `npm run typecheck:core` upewniając się, że zmiana logiki nie zepsuła zależności typów.
- Uruchomienie testów (np. `npm run test -- A2_smartbox/__tests__/shelves-drilling-builder.test.ts`), które w poprzednim kroku zostały zaktualizowane, aby symulować nowe, prawidłowe otoczenie wnęk.

### Manual Verification
- Poproszę Cię o przeciągnięcie kilku szuflad lub półek do różnych (w tym skrajnie nietypowych i własnoręcznie modyfikowanych) wnęk, abyś upewnił się, że nawierty zawsze i niezawodnie lądują na właściwych ścianach, bez względu na to, jak dziwnie te ściany są nazwane!
