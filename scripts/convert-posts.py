#!/usr/bin/env python3
"""
Converts the downloaded legacy WordPress/Carrot blog HTML into clean markdown
files for Astro's content collection.

Design notes:
- Slugs are taken from the original URL and never changed. Preserving the URL
  1:1 is the whole point of the import; these posts carry years of long-tail
  search rankings.
- The article body is located structurally (the `div.entry-content` element)
  rather than by regex, so nested divs inside the post don't truncate it.
- Content is copied verbatim. The only edits are mechanical: absolute internal
  links become relative, and Carrot's chrome (forms, scripts, share widgets)
  is dropped.
- Legacy slugs containing unreplaced Carrot merge tags (market_city,
  customer_mrket_city, ...) keep their broken slug for SEO but get a cleaned-up
  human title, and are flagged in the report.
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
OUT = os.path.join(ROOT, "src", "content", "blog")

VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}
# Elements whose entire subtree is dropped — Carrot's page furniture.
DROP = {"script", "style", "noscript", "form", "iframe", "svg", "button", "select", "textarea"}

# Chrome that lives *inside* entry-content but isn't article content: the
# Facebook/Twitter share rail, post meta, related-post rails. Dropped by class.
DROP_CLASSES = {
    "entry-share", "entry-share-btns", "entry-share-btn", "sharedaddy",
    "entry-meta", "entry-footer", "post-navigation", "related-posts",
    "addtoany_share_save_container", "jp-relatedposts",
}

# Merge tags Carrot never substituted, which leaked into live slugs, titles and
# body copy (857 occurrences of `market_city` alone across the archive).
# Order matters: the longest, most specific patterns must match first, and each
# tag resolves to the right *kind* of value — a state tag must not become a city.
MERGE_TAG_SUBS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"customer[_-]market[_-]state", re.I), "Texas"),
    (re.compile(r"customer[_-]market[_-]zip(code)?", re.I), "Houston"),
    (re.compile(r"cutomer[_-]market[_-]city", re.I), "Houston"),
    (re.compile(r"customer[_-]mrket[_-]city", re.I), "Houston"),
    (re.compile(r"customer[_-]market[_-]city", re.I), "Houston"),
    (re.compile(r"market[_-]zipcode", re.I), "Houston"),
    (re.compile(r"\[?market[_-]zip\]?", re.I), "Houston"),
    (re.compile(r"market[_-]state", re.I), "Texas"),
    (re.compile(r"market[_-]city", re.I), "Houston"),
]

# Used only to *detect* damage (for slug flagging and reporting).
MERGE_TAG_RE = re.compile(
    "|".join(p.pattern for p, _ in MERGE_TAG_SUBS), re.I
)


def fix_merge_tags(s: str) -> str:
    """Replace every leaked Carrot merge tag with the value it should have had.

    Only ever applied to *visible text*. Applying it to markup would rewrite
    hrefs pointing at legacy slugs like
    `/blog/...-inherited-home-customer_market_zip/`, breaking the very URLs the
    import exists to preserve.
    """
    for pattern, value in MERGE_TAG_SUBS:
        s = pattern.sub(value, s)
    return s


# Parentheticals and trailing fragments that exist purely to hold a zip merge
# tag, e.g. "... in Houston ([market_zip] Zip Code)". Substituting the tag would
# leave nonsense like "(Houston Zip Code)", so the whole fragment is removed.
ZIP_FRAGMENT_RES = [
    # A complete parenthetical containing the tag anywhere inside it, e.g.
    # "(Info For [market_zip] Zip Code Sellers)".
    re.compile(r"\s*\([^)]*\[?market[_-]zip\]?[^)]*\)", re.I),
    # An unclosed parenthetical, e.g. "... in Houston ([market_zip]".
    re.compile(r"\s*\([^)]*\[?market[_-]zip\]?[^)]*$", re.I),
    # A trailing dash fragment, e.g. "... Inherited Home? – [market_zip]".
    re.compile(r"\s*[–—-]\s*\[?market[_-]zip\]?", re.I),
]


def clean_title(t: str) -> str:
    for pattern in ZIP_FRAGMENT_RES:
        t = pattern.sub("", t)
    t = fix_merge_tags(t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return re.sub(r"[\s–—\-|]+$", "", t).strip()


class Node:
    __slots__ = ("tag", "attrs", "children")

    def __init__(self, tag: str, attrs: dict[str, str] | None = None):
        self.tag = tag
        self.attrs = attrs or {}
        self.children: list = []


class DomBuilder(HTMLParser):
    """Minimal, forgiving HTML -> tree parser. Good enough for WP output."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, {k: (v or "") for k, v in attrs})
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, {k: (v or "") for k, v in attrs}))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return
        # Unmatched close tag: ignore rather than corrupt the tree.

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def find(node: Node, pred) -> Node | None:
    if isinstance(node, Node):
        if pred(node):
            return node
        for c in node.children:
            if isinstance(c, Node):
                got = find(c, pred)
                if got:
                    return got
    return None


def has_class(node: Node, name: str) -> bool:
    return name in node.attrs.get("class", "").split()


def text_of(node) -> str:
    if isinstance(node, str):
        return node
    if is_dropped(node):
        return ""
    return "".join(text_of(c) for c in node.children)


# --------------------------------------------------------------------------
# Markdown rendering
# --------------------------------------------------------------------------

def is_dropped(node: Node) -> bool:
    """True for page furniture that should not become article content."""
    if node.tag in DROP:
        return True
    classes = set(node.attrs.get("class", "").split())
    return bool(classes & DROP_CLASSES)


def esc(s: str) -> str:
    # Text nodes are the only place merge tags get repaired — see fix_merge_tags.
    s = fix_merge_tags(s)
    # Only escape what would actually change meaning in prose.
    return s.replace("\\", "\\\\").replace("<", "&lt;").replace(">", "&gt;")


def rel(url: str) -> str:
    """Absolute links back to the site become relative so they survive a domain move."""
    url = url.strip()
    for prefix in ("https://webuyhouseshouston.com", "http://webuyhouseshouston.com",
                   "https://www.webuyhouseshouston.com"):
        if url.startswith(prefix):
            rest = url[len(prefix):]
            return rest if rest.startswith("/") else "/" + rest
    return url


def inline(node, out: list[str]) -> None:
    """Render inline content (and anything we don't treat as a block)."""
    if isinstance(node, str):
        out.append(esc(re.sub(r"\s+", " ", node)))
        return
    if is_dropped(node):
        return

    t = node.tag
    if t in ("strong", "b"):
        inner = render_inline(node.children).strip()
        if inner:
            out.append(f"**{inner}**")
    elif t in ("em", "i"):
        inner = render_inline(node.children).strip()
        if inner:
            out.append(f"*{inner}*")
    elif t == "code":
        out.append(f"`{text_of(node).strip()}`")
    elif t == "a":
        href = rel(node.attrs.get("href", ""))
        inner = render_inline(node.children).strip()
        if not inner:
            return
        if not href or href.startswith("#"):
            out.append(inner)
        else:
            out.append(f"[{inner}]({href})")
    elif t == "img":
        src = node.attrs.get("src", "")
        alt = node.attrs.get("alt", "").replace("]", "")
        if src:
            out.append(f"![{alt}]({src})")
    elif t == "br":
        out.append("\n")
    else:
        for c in node.children:
            inline(c, out)


def render_inline(children) -> str:
    out: list[str] = []
    for c in children:
        inline(c, out)
    s = "".join(out)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def render_table(node: Node) -> str:
    rows: list[list[str]] = []
    for tr in iter_tag(node, "tr"):
        cells = [render_inline(c.children) or " " for c in tr.children
                 if isinstance(c, Node) and c.tag in ("td", "th")]
        if cells:
            rows.append(cells)
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [" "] * (width - len(r)) for r in rows]
    head, *body = rows
    lines = ["| " + " | ".join(head) + " |",
             "| " + " | ".join(["---"] * width) + " |"]
    lines += ["| " + " | ".join(r) + " |" for r in body]
    return "\n".join(lines)


def iter_tag(node: Node, tag: str):
    for c in node.children:
        if isinstance(c, Node):
            if c.tag == tag:
                yield c
            else:
                yield from iter_tag(c, tag)


def render_list(node: Node, depth: int = 0) -> str:
    ordered = node.tag == "ol"
    lines: list[str] = []
    n = 0
    for li in node.children:
        if not isinstance(li, Node) or li.tag != "li":
            continue
        n += 1
        marker = f"{n}." if ordered else "-"
        # Split the item's own text from any nested lists.
        own, nested = [], []
        for c in li.children:
            if isinstance(c, Node) and c.tag in ("ul", "ol"):
                nested.append(c)
            else:
                own.append(c)
        text = render_inline(own)
        pad = "  " * depth
        if text:
            lines.append(f"{pad}{marker} {text}")
        for sub in nested:
            lines.append(render_list(sub, depth + 1))
    return "\n".join(l for l in lines if l.strip())


def render_blocks(node: Node, blocks: list[str]) -> None:
    for c in node.children:
        if isinstance(c, str):
            if c.strip():
                blocks.append(render_inline([c]))
            continue
        if is_dropped(c):
            continue
        t = c.tag
        if t in ("h1", "h2", "h3", "h4", "h5", "h6"):
            level = int(t[1])
            # The post's own h1 is the page title; demote stray h1s to h2.
            level = max(2, level)
            txt = render_inline(c.children)
            if txt:
                blocks.append("#" * level + " " + txt)
        elif t == "p":
            txt = render_inline(c.children)
            if txt:
                blocks.append(txt)
        elif t in ("ul", "ol"):
            txt = render_list(c)
            if txt:
                blocks.append(txt)
        elif t == "blockquote":
            inner: list[str] = []
            render_blocks(c, inner)
            body = "\n\n".join(inner)
            if body.strip():
                blocks.append("\n".join("> " + l if l else ">" for l in body.split("\n")))
        elif t == "table":
            txt = render_table(c)
            if txt:
                blocks.append(txt)
        elif t == "hr":
            blocks.append("---")
        elif t == "pre":
            blocks.append("```\n" + text_of(c).strip() + "\n```")
        elif t == "img":
            out: list[str] = []
            inline(c, out)
            if out:
                blocks.append("".join(out))
        elif t in ("figure", "figcaption", "div", "section", "article", "main",
                   "header", "footer", "aside", "span"):
            render_blocks(c, blocks)
        else:
            txt = render_inline([c])
            if txt:
                blocks.append(txt)


# --------------------------------------------------------------------------
# Field extraction
# --------------------------------------------------------------------------

def meta(raw: str, prop: str, kind: str = "property") -> str | None:
    m = re.search(rf'<meta {kind}="{re.escape(prop)}" content="(.*?)"', raw, re.S)
    return html.unescape(m.group(1)).strip() if m else None


def yaml_str(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def titleize(slug: str) -> str:
    words = re.sub(r"[-_]+", " ", slug).split()
    small = {"a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on",
             "or", "the", "to", "vs", "with", "your"}
    out = []
    for i, w in enumerate(words):
        out.append(w if (i and w.lower() in small) else w.capitalize())
    return " ".join(out)


def convert(path: str, slug: str, report: dict) -> bool:
    raw = open(path, encoding="utf-8", errors="replace").read()

    dom = DomBuilder()
    try:
        dom.feed(raw)
    except Exception as e:  # pragma: no cover
        report["errors"].append(f"{slug}: parse failed ({e})")
        return False

    body_el = find(dom.root, lambda n: has_class(n, "entry-content"))
    if body_el is None:
        report["errors"].append(f"{slug}: no entry-content element")
        return False

    blocks: list[str] = []
    render_blocks(body_el, blocks)
    blocks = [b for b in (b.strip() for b in blocks) if b]
    body = "\n\n".join(blocks)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()

    if len(body) < 200:
        report["thin"].append(slug)

    # --- title -------------------------------------------------------------
    h1 = find(dom.root, lambda n: has_class(n, "entry-title"))
    title = html.unescape(text_of(h1)).strip() if h1 else ""
    if not title:
        title = meta(raw, "og:title") or titleize(slug)

    # --- date --------------------------------------------------------------
    m = re.search(r'<time[^>]*class="[^"]*updated[^"]*"[^>]*datetime="([^"]+)"', raw)
    if not m:
        m = re.search(r'<time[^>]*datetime="([^"]+)"', raw)
    date = m.group(1)[:10] if m else None
    if not date:
        report["errors"].append(f"{slug}: no date")
        date = "2020-01-01"

    description = meta(raw, "og:description") or meta(raw, "description", "name") or ""
    description = re.sub(r"\s+", " ", description).strip()

    seo_title = meta(raw, "og:title") or title

    # --- category ----------------------------------------------------------
    cats: list[str] = []
    art = find(dom.root, lambda n: n.tag == "article")
    if art:
        for cls in art.attrs.get("class", "").split():
            if cls.startswith("category-"):
                cats.append(cls[len("category-"):])
    cats = [c for c in cats if not MERGE_TAG_RE.search(c)]

    # --- merge-tag damage --------------------------------------------------
    broken_slug = bool(MERGE_TAG_RE.search(slug))
    if broken_slug:
        report["broken_slugs"].append(slug)

    display_title = clean_title(title)
    if display_title != title:
        report["fixed_titles"].append(f"{slug}: {title!r} -> {display_title!r}")

    # esc() already repaired text nodes during rendering; this only records it.
    if MERGE_TAG_RE.search(raw):
        report["fixed_bodies"].append(slug)

    description = clean_title(description) if MERGE_TAG_RE.search(description) else description
    seo_title = clean_title(seo_title)

    report["images"] += len(re.findall(r"!\[[^\]]*\]\(", body))

    fm = [
        "---",
        f"title: {yaml_str(display_title)}",
        f"description: {yaml_str(description)}",
        f"pubDate: {date}",
        f"seoTitle: {yaml_str(seo_title)}",
    ]
    if cats:
        fm.append("categories:")
        fm += [f"  - {yaml_str(c)}" for c in cats]
    if broken_slug:
        fm.append("legacySlug: true")
    fm.append("---")

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f"{slug}.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(fm) + "\n\n" + body + "\n")
    return True


def main() -> int:
    report = {"errors": [], "thin": [], "broken_slugs": [], "fixed_titles": [],
              "fixed_bodies": [], "images": 0}
    files = sorted(f for f in os.listdir(RAW) if f.endswith(".html"))
    ok = 0
    for fn in files:
        slug = fn[:-5]
        if convert(os.path.join(RAW, fn), slug, report):
            ok += 1

    print(f"converted {ok}/{len(files)} posts -> src/content/blog/")
    print(f"  images referenced : {report['images']}")
    print(f"  legacy merge-tag slugs kept for SEO : {len(report['broken_slugs'])}")
    print(f"  titles repaired  : {len(report['fixed_titles'])}")
    print(f"  bodies repaired  : {len(report['fixed_bodies'])}")
    print(f"  thin (<200 chars): {len(report['thin'])} {report['thin'][:10]}")
    if report["errors"]:
        print(f"  ERRORS ({len(report['errors'])}):")
        for e in report["errors"][:25]:
            print("    -", e)

    with open(os.path.join(ROOT, "scripts", "import-report.json"), "w") as f:
        json.dump(report, f, indent=2)
    return 0 if not report["errors"] else 1


if __name__ == "__main__":
    sys.exit(main())
