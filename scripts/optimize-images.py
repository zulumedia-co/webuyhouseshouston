#!/usr/bin/env python3
"""
Converts the localized blog images to WebP and rewrites the markdown references.

The legacy archive stores photographs as PNG — 40 files are over 300 KB, the
largest half a megabyte for an 860px-wide photo. On an SEO lead-gen site that
is a direct Core Web Vitals (and therefore ranking) cost. WebP at q82 typically
cuts these by 80-90% with no visible difference.

Animated GIFs and SVGs are left alone; converting them would either break the
animation or bloat a vector.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "public", "blog-images")
POSTS = os.path.join(ROOT, "src", "content", "blog")

CONVERTIBLE = {".png", ".jpg", ".jpeg"}
MAX_WIDTH = 1400  # Nothing in an article column needs to be wider.
QUALITY = "82"


def convert(name: str) -> tuple[str, str | None, int, int]:
    """Returns (original_name, new_name_or_None, old_bytes, new_bytes)."""
    src = os.path.join(IMG_DIR, name)
    stem, ext = os.path.splitext(name)
    if ext.lower() not in CONVERTIBLE:
        return name, None, 0, 0

    old_size = os.path.getsize(src)
    dst_name = f"{stem}.webp"
    dst = os.path.join(IMG_DIR, dst_name)

    result = subprocess.run(
        ["cwebp", "-quiet", "-q", QUALITY, "-resize", str(MAX_WIDTH), "0",
         "-metadata", "none", src, "-o", dst],
        capture_output=True,
    )
    # cwebp's -resize with a width larger than the source would upscale, so
    # only keep the resized output if it actually shrank the file.
    if result.returncode != 0 or not os.path.exists(dst):
        return name, None, old_size, old_size

    new_size = os.path.getsize(dst)
    if new_size >= old_size:
        # Not worth it — keep the original and drop the WebP.
        os.remove(dst)
        return name, None, old_size, old_size

    os.remove(src)
    return name, dst_name, old_size, new_size


def main() -> int:
    if not os.path.isdir(IMG_DIR):
        print("no blog-images directory; run localize-images.py first")
        return 1

    names = sorted(os.listdir(IMG_DIR))
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(convert, names))

    renames = {old: new for old, new, _, _ in results if new}
    old_total = sum(o for _, new, o, _ in results if new)
    new_total = sum(n for _, new, _, n in results if new)

    # Rewrite every markdown reference to a converted file.
    touched = 0
    for fn in sorted(f for f in os.listdir(POSTS) if f.endswith(".md")):
        path = os.path.join(POSTS, fn)
        body = open(path, encoding="utf-8").read()
        original = body
        for old, new in renames.items():
            body = body.replace(f"/blog-images/{old}", f"/blog-images/{new}")
        if body != original:
            open(path, "w", encoding="utf-8").write(body)
            touched += 1

    remaining = sum(
        os.path.getsize(os.path.join(IMG_DIR, f)) for f in os.listdir(IMG_DIR)
    )
    print(f"converted {len(renames)}/{len(names)} images to WebP")
    if old_total:
        saved = 100 * (1 - new_total / old_total)
        print(f"  {old_total / 1_048_576:.1f} MB -> {new_total / 1_048_576:.1f} MB "
              f"({saved:.0f}% smaller)")
    print(f"  rewrote refs in {touched} posts")
    print(f"  total image payload now: {remaining / 1_048_576:.1f} MB")

    # Nothing should still point at a file that no longer exists.
    missing = []
    for fn in os.listdir(POSTS):
        body = open(os.path.join(POSTS, fn), encoding="utf-8").read()
        for ref in re.findall(r"/blog-images/([^)\s]+)", body):
            if not os.path.exists(os.path.join(IMG_DIR, ref)):
                missing.append(f"{fn} -> {ref}")
    if missing:
        print(f"  BROKEN REFS ({len(missing)}):")
        for m in missing[:10]:
            print("   ", m)
        return 1
    print("  all image references resolve")
    return 0


if __name__ == "__main__":
    sys.exit(main())
