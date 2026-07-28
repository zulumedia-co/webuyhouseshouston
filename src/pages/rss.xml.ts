import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE } from '@/config/site';
import { byNewest, excerpt } from '@/lib/posts';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog')).sort(byNewest);

  return rss({
    title: `${SITE.name} — Blog`,
    description:
      'Straight, practical advice on selling a house in Houston: foreclosure, probate, inherited property, repairs, liens, divorce and more.',
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: excerpt(post, 300),
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
      categories: post.data.categories,
    })),
    customData: '<language>en-us</language>',
  });
}
