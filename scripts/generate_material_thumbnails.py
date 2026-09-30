#!/usr/bin/env python3
"""
Skrypt generujący lekkie miniaturki tekstur (WebP / JPG) z wysokiej rozdzielczości
map Albedo dla bazy materiałów płyt meblowych.
"""

import os
import sys
import re
from pathlib import Path
from PIL import Image

THUMBNAIL_SIZE = (96, 96)
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "textures" / "thumbnails"

DEFAULT_SOURCE_DIRS = [
    Path(r"C:\Users\ADM\Desktop\render_konfigurator\asety_eger"),
    Path(__file__).resolve().parent.parent.parent / "asset_materials",
]

def center_crop_square(im: Image.Image) -> Image.Image:
    w, h = im.size
    min_dim = min(w, h)
    left = (w - min_dim) // 2
    top = (h - min_dim) // 2
    right = left + min_dim
    bottom = top + min_dim
    return im.crop((left, top, right, bottom))

def extract_code(filename: str) -> str:
    """
    Wyciąga kod dekoru z nazwy pliku, np.:
    'H1180_ST37_Dab Halifax naturalny_Albedo.png' -> 'H1180_ST37'
    'W1100_ST9_Albedo.png' -> 'W1100_ST9'
    'U999_ST9_Czarny_Albedo.png' -> 'U999_ST9'
    """
    base = re.sub(r'(_Albedo|_albedo)\.(png|jpg|jpeg|webp)$', '', filename, flags=re.IGNORECASE)
    # Sprawdź typowy kod Eggera: [WUH]\d{3,4}_ST\d+ lub F\d{3}_ST\d+
    match = re.match(r'^([A-Z]\d{3,4}_ST\d+)', base, flags=re.IGNORECASE)
    if match:
        return match.group(1).upper()
    return base.replace(' ', '_')

def process_image(src_path: Path, out_dir: Path) -> list[Path]:
    results = []
    try:
        with Image.open(src_path) as im:
            if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
                im = im.convert('RGBA')
            else:
                im = im.convert('RGB')
            
            sq = center_crop_square(im)
            thumb = sq.resize(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            
            filename = src_path.name
            code = extract_code(filename)
            safe_base = re.sub(r'(_Albedo|_albedo)\.(png|jpg|jpeg|webp)$', '', filename, flags=re.IGNORECASE).replace(' ', '_')

            # 1. Zapis z głównym kodem dekoru (np. H1180_ST37.webp)
            target1 = out_dir / f"{code}.webp"
            thumb.save(target1, format="WEBP", quality=85, method=6)
            results.append(target1)

            # 2. Zapis z pełną nazwą dekoru jeśli jest inna (np. H1180_ST37_Dab_Halifax_naturalny.webp)
            if safe_base.upper() != code.upper():
                target2 = out_dir / f"{safe_base}.webp"
                thumb.save(target2, format="WEBP", quality=85, method=6)
                results.append(target2)

    except Exception as e:
        print(f"  [BŁĄD] Nie udało się przetworzyć {src_path.name}: {e}", file=sys.stderr)
    return results

def main():
    source_dirs = []
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            p = Path(arg)
            if p.exists():
                source_dirs.append(p)
    else:
        for d in DEFAULT_SOURCE_DIRS:
            if d.exists():
                source_dirs.append(d)

    if not source_dirs:
        print("[!] Brak istniejących katalogów źródłowych. Sprawdź ścieżki.")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"=== Generowanie miniaturek tekstur ===")
    print(f"Folder docelowy: {OUTPUT_DIR}")

    found_files = []
    for sdir in source_dirs:
        print(f"Skanowanie: {sdir}")
        for root, _, files in os.walk(sdir):
            for f in files:
                if re.search(r'albedo\.(png|jpg|jpeg|webp)$', f, re.IGNORECASE):
                    found_files.append(Path(root) / f)

    if not found_files:
        print("[!] Nie znaleziono plików *_Albedo.* w podanych katalogach.")
        sys.exit(0)

    print(f"Znaleziono {len(found_files)} plików tekstur albedo. Rozpoczynanie generowania...\n")

    count = 0
    for f in found_files:
        created = process_image(f, OUTPUT_DIR)
        for c in created:
            size_kb = c.stat().st_size / 1024.0
            print(f"  [+] {c.name} ({size_kb:.1f} KB)")
            count += 1

    print(f"\nGotowe! Wygenerowano {count} miniaturek w {OUTPUT_DIR}.")

if __name__ == "__main__":
    # Wymuś UTF-8 na stdout dla konsoli Windows
    if sys.stdout.encoding != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    main()
