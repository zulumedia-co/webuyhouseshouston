export const PER_PAGE = 13; // 1 feature + a clean 12-item grid.

/** Path for a given blog page. Page 1 stays at /blog/ so the legacy URL holds. */
export function blogPagePath(page: number): string {
  return page <= 1 ? '/blog/' : `/blog/page/${page}/`;
}

/**
 * Compact page list with ellipses, e.g. [1, '…', 7, 8, 9, '…', 26].
 * Keeps the control usable at 26 pages without rendering 26 links.
 */
export function pageWindow(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  if (current > 1) pages.add(current - 1);
  if (current < total) pages.add(current + 1);
  // Keep the control from collapsing at the ends.
  if (current <= 3) [2, 3, 4].forEach((n) => pages.add(n));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => pages.add(n));

  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  const out: Array<number | '…'> = [];
  let previous = 0;
  for (const n of sorted) {
    if (previous && n - previous > 1) out.push('…');
    out.push(n);
    previous = n;
  }
  return out;
}
