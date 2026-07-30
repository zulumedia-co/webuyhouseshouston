// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// Every page is prerendered to static HTML. The only exception is the lead
// endpoint (`src/pages/api/lead.ts`), which opts out via `prerender = false`
// so it can forward submissions to the CRM at request time.
//
// Deployment target is Cloudflare Pages, so the adapter must be the Cloudflare
// one — a Vercel build emits `.vercel/output/functions/*.func`, which Cloudflare
// cannot execute. Pages would serve fine and every form submission would 404.
//
// Note for anyone changing host again: on Cloudflare, runtime secrets are NOT
// available through `import.meta.env`. They arrive per-request on
// `locals.runtime.env`, which is why `pages/api/lead.ts` reads from there first.
export default defineConfig({
  site: 'https://webuyhouseshouston.com',
  output: 'static',
  adapter: cloudflare({
    // Lets `astro dev` see the same bindings and secrets Cloudflare injects in
    // production, so the lead endpoint behaves identically in both.
    platformProxy: { enabled: true },
  }),
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
