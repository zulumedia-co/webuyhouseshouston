/**
 * Shape of a section on the privacy and terms pages.
 *
 * Lives in a `.ts` file rather than in `LegalPage.astro`'s frontmatter because
 * esbuild rejects an `export type` union inside Astro frontmatter — the same
 * constraint that put `IconName` in `lib/icons.ts`.
 */
export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Rendered after the bullet list, when a section needs a closing note. */
  paragraphs2?: string[];
  /**
   * Draws the section as a highlighted callout. Reserved for content a reader
   * must not skim past — currently the SMS consent clause.
   */
  emphasis?: boolean;
  /** Optional anchor id, so the section can be linked to directly. */
  id?: string;
}
