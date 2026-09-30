# Dokumentacja Orientacji Układów LCS i Kwaternionów Formatek

Niniejszy dokument opisuje oficjalny standard orientacji lokalnych układów współrzędnych **LCS (Local Coordinate System)** dla wszystkich formatek meblowych w projekcie CAD.

## Gdzie jest „opcja” (SSOT)

W JSON rules — blok **`lcs`** przy każdej formatce, np. `B_WIENIEC_D` w:
- `korpus3_3_rules.json`
- `korpus_rogowy1_rules.json`
- `korpus_rogowy90_rules.json`

```json
"lcs": {
  "mapping": { "X": "x", "Y": "y", "Z": "z" },
  "rotation": [90, 180, 0],
  "faces": { "INNER": "FACE_Z_PLUS", "OUTER": "FACE_Z_MINUS" }
}
```

- `mapping` — które `dim.x/y/z` → szerokość / wysokość / grubość PanelModel  
- **`rotation`** — Euler XYZ ° → `Quat.fromEulerXYZ` w `smartframe-adapter.ts`  
- `faces.INNER` / `OUTER` — zwykle `FACE_Z_PLUS` / `FACE_Z_MINUS`

---

## 1. Układ Globalny CAD (Z-up)
- 🔴 **X**: Lewo ↔ Prawo  
- 🟢 **Y**: Przód (−Y) ↔ **Tył (+Y)**  
- 🔵 **Z**: Dół ↔ Góra  

Babylon (Y-up): zamiana Y↔Z w `cad-math/coord-system.ts`.

---

## 2. Zasada LCS formatek

**+Y formatki (strzałka zielona) ma wskazywać tył korpusu (+CAD Y).**  
`FACE_Y_PLUS` = tył, `FACE_Y_MINUS` = przód.

### Wieńce
| Rola | `rotation` | Skutek |
|------|------------|--------|
| Wieniec **dolny** | `[90, 180, 0]` | Rx=90 + **180° wokół grubości** (niebieska LCS Z na ekranie = Ry) → **+Y → tył** |
| Wieniec **górny** | `[-90, 0, 0]` | INNER w dół; **+Y_LCS → tył** |

> W JSON Euler to `[Rx, Ry, Rz]`. Obrót 180° wokół widocznej osi Z płyty (grubość) = **`Ry = 180`**, czyli `[90, 180, 0]` — nie trzeci kąt.

### Boczki / plecy
- Boki: `[0, 0, ±90]`  
- Plecy: zwykle `[180, 0, 0]` + mapping grubości

---

## 3. Implementacja
- Aplikacja: `applyPlanToContainer()` → `smartframe-adapter.ts`  
- Strzałki: `PanelView._buildLCSNode()`  
- Wieniec L (Rogowy90): UV w `_resolveCorner90Geometry` — przy `Ry=180` lustro **U** (bez lustra V)
