// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Every page is prerendered to static HTML. The only exception is the lead
// endpoint (`src/pages/api/lead.ts`), which opts out via `prerender = false`
// so it can forward submissions to the CRM at request time.
//
// Swapping hosts is a one-line change: replace the `vercel()` adapter with
// @astrojs/netlify or @astrojs/node. Nothing else in the codebase depends on it.
export default defineConfig({
  site: 'https://webuyhouseshouston.com',
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/thank-you'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
