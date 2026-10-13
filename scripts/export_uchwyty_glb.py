"""
Blender: eksport uchwytów do osobnych plików GLB.

Nazwa obiektu (np. AS01-96) = nazwa pliku → AS01-96.glb

Użycie:
  1. Ustaw COLLECTION_NAME (albo zostaw "" = cała scena / Scene Collection).
  2. Scripting → Run Script.

Jeśli nie znasz nazwy kolekcji — odpal skrypt z LIST_COLLECTIONS_ONLY = True.
"""

from __future__ import annotations

import os
import re
from typing import Iterable, List, Optional, Set

import bpy

# ── Konfiguracja ─────────────────────────────────────────────────────────────
# "" = Scene Collection (cała scena). Albo dokładna nazwa z Outlinera.
COLLECTION_NAME = ""
OUTPUT_DIR = r"C:\Users\ADM\Desktop\projekt kostka\modele 3d do cad\glb"
# Tylko wypisz nazwy kolekcji (bez eksportu) — włącz gdy nie wiesz jak się nazywa
LIST_COLLECTIONS_ONLY = False
# Eksport tylko zaznaczonych obiektów
EXPORT_SELECTED_ONLY = False
# True: każda PODKOLEKCJA = jeden GLB; False: każdy obiekt-korzeń = jeden GLB
# Dla nazw typu AS01-96 na obiektach ustaw False
PREFER_SUBCOLLECTIONS = False
# Opcjonalny filtr nazwy (regex). "" = wszystkie. Np. r"^AS\d+" albo r".*-\d+$"
NAME_FILTER = r""
# ─────────────────────────────────────────────────────────────────────────────


def sanitize_filename(name: str) -> str:
    name = name.strip()
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    name = name.rstrip(" .")
    return name or "unnamed"


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def deselect_all() -> None:
    bpy.ops.object.select_all(action="DESELECT")


def select_hierarchy(root: bpy.types.Object) -> List[bpy.types.Object]:
    selected: List[bpy.types.Object] = []

    def walk(obj: bpy.types.Object) -> None:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
        selected.append(obj)
        for child in obj.children:
            walk(child)

    walk(root)
    bpy.context.view_layer.objects.active = root
    return selected


def list_all_collections() -> List[str]:
    names = sorted(c.name for c in bpy.data.collections)
    print("=== Kolekcje w pliku ===")
    for n in names:
        col = bpy.data.collections[n]
        print(f"  - {n!r}  (obiektów: {len(col.objects)}, podkolekcji: {len(col.children)})")
    print(f"  - Scene Collection: {bpy.context.scene.collection.name!r}")
    return names


def find_collection(name: str) -> Optional[bpy.types.Collection]:
    if not name:
        return bpy.context.scene.collection
    exact = bpy.data.collections.get(name)
    if exact:
        return exact
    # dopasowanie bez wielkości liter
    lower = name.lower()
    for col in bpy.data.collections:
        if col.name.lower() == lower:
            return col
    # częściowe dopasowanie
    partial = [c for c in bpy.data.collections if lower in c.name.lower()]
    if len(partial) == 1:
        print(f'[INFO] Użyto kolekcji {partial[0].name!r} (częściowe dopasowanie do {name!r})')
        return partial[0]
    return None


def name_ok(name: str) -> bool:
    if not NAME_FILTER:
        return True
    return re.search(NAME_FILTER, name) is not None


def export_glb(filepath: str) -> None:
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
    )


def export_roots(roots: Iterable[bpy.types.Object], out_dir: str) -> List[str]:
    written: List[str] = []
    for root in roots:
        if not name_ok(root.name):
            print(f"[SKIP] {root.name} — filtr NAME_FILTER")
            continue
        path = os.path.join(out_dir, sanitize_filename(root.name) + ".glb")
        deselect_all()
        select_hierarchy(root)
        if not any(o.type == "MESH" for o in bpy.context.selected_objects):
            print(f"[SKIP] {root.name} — brak meshy")
            continue
        export_glb(path)
        written.append(path)
        print(f"[OK] {path}")
    return written


def root_objects_from_collection(col: bpy.types.Collection) -> List[bpy.types.Object]:
    """Korzenie hierarchii: obiekt bez rodzica w tej kolekcji (rekurencyjnie all_objects)."""
    members: Set[bpy.types.Object] = set(col.all_objects)
    roots: List[bpy.types.Object] = []
    for obj in members:
        parent = obj.parent
        if parent is None or parent not in members:
            roots.append(obj)
    roots.sort(key=lambda o: o.name)
    return roots


def main() -> None:
    if LIST_COLLECTIONS_ONLY:
        list_all_collections()
        print("\nSkopiuj nazwę do COLLECTION_NAME i ustaw LIST_COLLECTIONS_ONLY = False")
        return

    ensure_dir(OUTPUT_DIR)
    written: List[str] = []

    if EXPORT_SELECTED_ONLY:
        sel = set(bpy.context.selected_objects)
        roots = [o for o in sel if o.parent is None or o.parent not in sel]
        if not roots:
            roots = list(sel)
        print(f"Eksport zaznaczonych korzeni: {len(roots)}")
        written = export_roots(roots, OUTPUT_DIR)
    else:
        col = find_collection(COLLECTION_NAME)
        if col is None:
            list_all_collections()
            raise RuntimeError(
                f'Nie znaleziono kolekcji {COLLECTION_NAME!r}. '
                f'Ustaw COLLECTION_NAME na jedną z powyższych, albo "" dla całej sceny.'
            )

        label = COLLECTION_NAME or "Scene Collection"
        if PREFER_SUBCOLLECTIONS and col.children:
            print(f'Kolekcja {label!r}: {len(col.children)} podkolekcji')
            for sub in sorted(col.children, key=lambda c: c.name):
                if not name_ok(sub.name):
                    print(f"[SKIP] {sub.name} — filtr NAME_FILTER")
                    continue
                roots = root_objects_from_collection(sub)
                if not roots:
                    print(f"[SKIP] {sub.name} — pusta")
                    continue
                deselect_all()
                has_mesh = False
                for root in roots:
                    select_hierarchy(root)
                    if any(o.type == "MESH" for o in bpy.context.selected_objects):
                        has_mesh = True
                if not has_mesh:
                    print(f"[SKIP] {sub.name} — brak meshy")
                    continue
                path = os.path.join(OUTPUT_DIR, sanitize_filename(sub.name) + ".glb")
                export_glb(path)
                written.append(path)
                print(f"[OK] {path}")
        else:
            roots = root_objects_from_collection(col)
            print(f'Kolekcja {label!r}: {len(roots)} obiektów-korzeni → osobne GLB')
            written = export_roots(roots, OUTPUT_DIR)

    deselect_all()
    print(f"\nGotowe: {len(written)} plików → {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
