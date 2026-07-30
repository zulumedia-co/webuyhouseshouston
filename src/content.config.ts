import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * The imported legacy archive. Filenames are the original URL slugs and must
 * never be renamed — see the URL-preservation rule in the README.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    pubDate: z.coerce.date(),
    /** Original <title> from the legacy site, kept for SEO continuity. */
    seoTitle: z.string().optional(),
    categories: z.array(z.string()).default([]),
    /**
     * True when the slug still contains an unreplaced Carrot merge tag. The
     * ugly slug stays live for SEO; this flag lets us surface a clean canonical
     * alias and exclude the post from "you might also like" rails.
     */
    legacySlug: z.boolean().default(false),
    /** Set on posts we have rewritten, so they can be featured. */
    featured: z.boolean().default(false),
  }),
});

export const collections = { blog };
