# Dokumentacja Orientacji Układów LCS i Kwaternionów Formatek

Niniejszy dokument opisuje oficjalny standard orientacji lokalnych układów współrzędnych **LCS (Local Coordinate System)** dla wszystkich formatek meblowych w projekcie CAD.

---

## 1. Układ Globalny Sceny 3D (GCS / BabylonJS)
- 🔴 **Oś X (Szerokość / Width)**: Lewo $\leftrightarrow$ Prawo
- 🟢 **Oś Y (Wysokość / Height)**: Dół $\leftrightarrow$ Góra (Wysokość pionowa)
- 🔵 **Oś Z (Głębokość / Depth)**: Przód $\leftrightarrow$ Tył

---

## 2. Standard Przypisania Osie LCS dla poszczególnych typów formatek

### A. Wieńce i Półki (`BOTTOM_PANEL`, `TOP_PANEL`, `SHELF_PANEL`, `HORIZONTAL_DIVIDER`)
Wieńce leżą płasko w meblu, a ich układ LCS jest w 100% zgodny z układem globalnym GCS:
- **LCS X (`bbWidth`)**: Szerokość formatki $W$ (np. $1000\text{ mm}$)
- **LCS Y (`bbHeight`)**: Grubość pionowa formatki $T$ (np. $18\text{ mm}$)
- **LCS Z (`bbThickness`)**: Głębokość formatki $D$ (np. $600\text{ mm}$)
- **Kwaternion rotacji (`rotQuat`)**: `Quat.IDENTITY` ($0^\circ$)

---

### B. Plecy i Fronty (`BACK_PANEL`, `FRONT_PANEL`)
Plecy stoją pionowo na tyłach mebla, z grubością ukierunkowaną w głębokość:
- **LCS X (`bbWidth`)**: Szerokość formatki $W$ (np. $1000\text{ mm}$)
- **LCS Y (`bbHeight`)**: Wysokość pionowa formatki $H$ (np. $2200\text{ mm}$)
- **LCS Z (`bbThickness`)**: Grubość formatki $T$ (np. $3\text{ mm}$)
- **Kwaternion rotacji (`rotQuat`)**: `Quat.fromEulerXYZ(Math.PI, 0, 0)` ($180^\circ$ wokół osi X)

---

### C. Boczki i Przegrody Pionowe (`LEFT_SIDE_PANEL`, `RIGHT_SIDE_PANEL`, `VERTICAL_DIVIDER`)
Boczki stoją pionowo po bokach mebla:
- **LCS X (`bbWidth`)**: Głębokość formatki $D$ (np. $600\text{ mm}$)
- **LCS Y (`bbHeight`)**: Wysokość pionowa formatki $H$ (np. $2200\text{ mm}$)
- **LCS Z (`bbThickness`)**: Grubość formatki $T$ (np. $18\text{ mm}$)
- **Kwaternion rotacji (`rotQuat`)**: `Quat.fromAxisAngle(Vec3.UNIT_Z, Math.PI / 2)` ($90^\circ$ wokół osi Z)

---

## 3. Implementacja w Kodzie
Mapowanie powyższych zasad jest realizowane w funkcji `applyPlanToContainer()` w pliku [`web/A3_smartframe/smartframe-adapter.ts`](file:///c:/Users/ADM/AppData/Roaming/Blender%20Foundation/Blender/5.0/scripts/addons/CAD/web/A3_smartframe/smartframe-adapter.ts).
