/**
 * The set of icons `Icon.astro` can render.
 *
 * Lives in a `.ts` file rather than in the component's frontmatter for two
 * reasons: Astro's frontmatter is transformed by esbuild, which rejects an
 * `export type` union there; and keeping it here lets other modules reference
 * the same list instead of re-declaring their own copy — `SITUATIONS` in
 * `data/content.ts` previously hardcoded a subset that could drift out of sync.
 *
 * `Icon.astro` asserts its path map `satisfies Record<IconName, string>`, so
 * adding a name here without adding its path data is a build error rather than
 * an invisible icon on the live site.
 */
export type IconName =
  | 'gavel'
  | 'key'
  | 'heart'
  | 'box'
  | 'wrench'
  | 'clock'
  | 'file'
  | 'home'
  | 'check'
  | 'phone'
  | 'arrow-right'
  | 'shield'
  | 'cash'
  | 'calendar'
  | 'x';
