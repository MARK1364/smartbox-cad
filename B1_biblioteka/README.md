# B1_biblioteka

Modele GLB + katalogi JSON okuć (web).

## Jednostki
- JSON katalogów: **mm** (`"units": "mm"`)
- Silnik CAD: **nm** (przez `mmToNm` / adapter)
- GLB: tylko wizualizacja — nawierty i `art_no` z JSON, nie z mesha

## Układ
```
B1_biblioteka/
  zawiasy/          — HINGE
  uchwyty/          — HANDLE
  szuflady/         — systemy skrzynek (Antaro, Tandem, …) + BOM art_no
  prowadnice/       — RAIL jeśli osobno od systemu szuflady
  silowniki/        — GAS_SPRING (Aventos / podnośniki)
  carga/            — CARGO (kosze wysuwane)
  nozki/            — LEG (nóżki meblowe)
  polki_akcesoria/  — wsporniki, relingi półek
  zawieszki/        — niski priorytet
```

W każdej kategorii:
- `catalog.json` — dane produkcyjne (LCS, otwory, art_no / BOM)
- `models/*.glb` — 1 wariant / `id` → 1 plik GLB (lazy load)

## Nazwy plików GLB
`{BRAND}_{ID}.glb` np. `BLUM_71B3550.glb`, `REJS_12345.glb`

Ścieżka w katalogu: `"glb": "models/BLUM_71B3550.glb"` (względna od folderu kategorii).
