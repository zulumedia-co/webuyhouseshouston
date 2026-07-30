#!/usr/bin/env python3
"""
Verifies that every URL live on the legacy site resolves in the new build.

This is the guard on the single most important constraint of the rebuild: the
blog archive carries years of long-tail search rankings, and a rebuild that
silently drops URLs destroys the lead flow that is the entire business.

Run after `astro build`. Exits non-zero if anything is missing.
"""

from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# The Cloudflare adapter emits straight into `dist/`; some other adapters use
# `dist/client/`. Detect rather than assume, so switching host does not silently
# make this script check an empty directory and report success.
_CANDIDATES = [os.path.join(ROOT, "dist"), os.path.join(ROOT, "dist", "client")]
DIST = next(
    (d for d in _CANDIDATES if os.path.isfile(os.path.join(d, "index.html"))),
    _CANDIDATES[0],
)

# Every non-blog page that was live on the legacy site.
PAGES = [
    "/", "/get-a-cash-offer-today/", "/blog/", "/sell-your-house/",
    "/testimonials/", "/our-company/", "/contact-us/", "/resource-page/",
    "/avoiding-foreclosure/", "/thank-you/", "/faq/", "/how-we-buy-houses/",
    "/privacy/", "/compare/", "/harris_county/", "/harris/",
    "/property/homes-for-sale-in-tx-houston-77034-vinita-3br/",
]


def blog_urls() -> list[str]:
    path = os.path.join(ROOT, "scripts", "urls.txt")
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(line.replace("https://webuyhouseshouston.com", ""))
    return out


def exists(url: str) -> bool:
    rel = url.strip("/")
    candidate = os.path.join(DIST, rel, "index.html") if rel else os.path.join(DIST, "index.html")
    return os.path.isfile(candidate)


def main() -> int:
    if not os.path.isdir(DIST):
        print(f"No build found at {DIST}. Run `npm run build` first.")
        return 1

    all_urls = PAGES + blog_urls()
    # De-duplicate while preserving order.
    seen, ordered = set(), []
    for u in all_urls:
        if u not in seen:
            seen.add(u)
            ordered.append(u)

    missing = [u for u in ordered if not exists(u)]

    print(f"checked {len(ordered)} legacy URLs against dist/")
    print(f"  resolved : {len(ordered) - len(missing)}")
    print(f"  missing  : {len(missing)}")

    if missing:
        print("\nMISSING — these would 404 and lose their rankings:")
        for u in missing:
            print("   ", u)
        return 1

    # Also report anything new that the legacy site did not have, purely as
    # information — new pages are fine, silently dropped ones are not.
    built = set()
    for dirpath, _, filenames in os.walk(DIST):
        if "index.html" in filenames:
            rel = os.path.relpath(dirpath, DIST).replace(os.sep, "/")
            built.add("/" if rel == "." else f"/{rel}/")
    extra = sorted(built - seen)
    print(f"  new pages added: {len(extra)}")

    print("\nAll legacy URLs resolve.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
