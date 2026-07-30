#!/usr/bin/env python3
"""
Downloads every remote image referenced by the imported posts and rewrites the
markdown to point at a local copy.

Why this matters: every image in the legacy archive is hosted on
`cdn.carrot.com` / `image-cdn.carrot.com`. The day Guillermo cancels his Carrot
subscription those URLs can disappear and 229 images across the blog would
break at once. Owning the assets removes that dependency entirely.
"""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS = os.path.join(ROOT, "src", "content", "blog")
DEST = os.path.join(ROOT, "public", "blog-images")
PUBLIC_PREFIX = "/blog-images/"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

IMG_RE = re.compile(r"!\[([^\]]*)\]\((https?://[^)\s]+)\)")
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}


def local_name(url: str) -> str:
    """Stable, collision-free filename derived from the URL."""
    path = unquote(urlparse(url).path)
    base = os.path.basename(path) or "image"
    stem, ext = os.path.splitext(base)
    if ext.lower() not in ALLOWED_EXT:
        ext = ".jpg"
    stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-_.") or "image"
    stem = stem[:70]
    # Short hash of the full URL keeps same-named files from different paths apart.
    digest = hashlib.sha1(url.encode()).hexdigest()[:8]
    return f"{stem}-{digest}{ext.lower()}"


def download(job: tuple[str, str]) -> tuple[str, bool]:
    url, name = job
    out = os.path.join(DEST, name)
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return url, True
    # -f makes curl exit non-zero on 4xx/5xx. Without it an HTML error page
    # larger than the 500-byte floor below would be accepted as a valid image
    # and shipped to production as a silently broken <img>.
    result = subprocess.run(
        ["curl", "-sfL", "--max-time", "45", "--retry", "2", "--retry-delay", "2",
         "-A", UA, url, "-o", out],
        capture_output=True,
    )
    ok = result.returncode == 0 and os.path.exists(out) and os.path.getsize(out) > 500
    if not ok and os.path.exists(out):
        os.remove(out)
    return url, ok


def main() -> int:
    os.makedirs(DEST, exist_ok=True)

    files = sorted(f for f in os.listdir(POSTS) if f.endswith(".md"))
    urls: set[str] = set()
    for fn in files:
        body = open(os.path.join(POSTS, fn), encoding="utf-8").read()
        for _, url in IMG_RE.findall(body):
            urls.add(url)

    print(f"unique remote images: {len(urls)}")
    mapping = {u: local_name(u) for u in sorted(urls)}

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(download, mapping.items()))

    failed = {u for u, ok in results if not ok}
    print(f"downloaded: {len(results) - len(failed)}   failed: {len(failed)}")
    for u in sorted(failed)[:15]:
        print("  FAIL", u)

    # Rewrite markdown. URLs that failed to download keep their original remote
    # reference rather than pointing at a file that isn't there.
    rewritten = 0
    for fn in files:
        path = os.path.join(POSTS, fn)
        body = open(path, encoding="utf-8").read()

        def sub(m: re.Match[str]) -> str:
            alt, url = m.group(1), m.group(2)
            if url in failed or url not in mapping:
                return m.group(0)
            return f"![{alt}]({PUBLIC_PREFIX}{mapping[url]})"

        new = IMG_RE.sub(sub, body)
        if new != body:
            open(path, "w", encoding="utf-8").write(new)
            rewritten += 1

    print(f"rewrote {rewritten} post files")
    size = sum(os.path.getsize(os.path.join(DEST, f)) for f in os.listdir(DEST))
    print(f"local image payload: {size / 1_048_576:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
