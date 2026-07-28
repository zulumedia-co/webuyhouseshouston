#!/usr/bin/env bash
# Downloads the raw HTML of every legacy blog post so the import can run offline
# and be re-run deterministically without hammering the live site.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW="$DIR/raw"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

mkdir -p "$RAW"

grab() {
  local url="$1"
  local slug
  slug="$(echo "$url" | sed -E 's#https://webuyhouseshouston.com/blog/##; s#/$##')"
  local out="$RAW/$slug.html"
  # Skip anything already downloaded and non-trivial in size.
  if [ -s "$out" ] && [ "$(wc -c <"$out")" -gt 20000 ]; then
    return 0
  fi
  curl -sL --max-time 45 --retry 2 --retry-delay 2 -A "$UA" "$url" -o "$out"
  if [ ! -s "$out" ]; then
    echo "FAIL $url" >>"$RAW/_failures.log"
  fi
}
export -f grab
export RAW UA

: >"$RAW/_failures.log"
# 8 at a time: fast enough to finish in a couple of minutes, gentle enough
# not to look like an attack to their host.
xargs -P 8 -I{} bash -c 'grab "$@"' _ {} <"$DIR/scripts/urls.txt"

echo "downloaded: $(ls -1 "$RAW"/*.html 2>/dev/null | wc -l | tr -d ' ')"
echo "failures:   $(grep -c . "$RAW/_failures.log" 2>/dev/null || echo 0)"
