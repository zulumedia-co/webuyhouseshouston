import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'blog'>;

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Rough reading time. 225 wpm is the usual comfortable-prose figure. */
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 225));
}

/**
 * Pulls the first image out of the post body to use as a card thumbnail.
 * The legacy archive has no dedicated featured-image field — the lead image is
 * simply the first one in the markdown.
 */
export function leadImage(post: Post): string | null {
  const match = (post.body ?? '').match(/!\[[^\]]*\]\((\/blog-images\/[^)\s]+)\)/);
  return match ? match[1] : null;
}

/**
 * A clean plain-text summary. Prefers the post's own meta description, and
 * otherwise strips markdown out of the opening prose.
 */
export function excerpt(post: Post, max = 150): string {
  const described = post.data.description?.trim();
  if (described) return truncate(described, max);

  const text = (post.body ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // links -> label
    .replace(/^#{1,6}\s+.*$/gm, '')             // headings
    .replace(/^>\s?/gm, '')                     // quotes
    .replace(/[*_`]/g, '')                      // emphasis
    .replace(/^\s*[-*]\s+/gm, '')               // bullets
    .replace(/\s+/g, ' ')
    .trim();

  return truncate(text, max);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).replace(/[.,;:—-]$/, '')}…`;
}

/** Newest first — the ordering used everywhere posts are listed. */
export function byNewest(a: Post, b: Post): number {
  return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

/**
 * Picks related posts, preferring shared categories and falling back to
 * recency so the rail is never short. Legacy merge-tag slugs are excluded —
 * their URLs look broken and we don't want to advertise them.
 */
export function relatedPosts(current: Post, all: Post[], limit = 3): Post[] {
  const pool = all.filter((p) => p.id !== current.id && !p.data.legacySlug);
  const categories = new Set(current.data.categories);

  const scored = pool
    .map((p) => ({
      post: p,
      shared: p.data.categories.filter((c) => categories.has(c)).length,
    }))
    .sort((a, b) => b.shared - a.shared || byNewest(a.post, b.post));

  return scored.slice(0, limit).map((s) => s.post);
}
