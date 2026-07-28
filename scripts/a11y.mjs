/** Accessibility audit across representative pages, using axe-core. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.env.BASE || 'http://localhost:4322';
const pages = [
  '/', '/get-a-cash-offer-today/', '/how-we-buy-houses/', '/compare/',
  '/sell-your-house/', '/our-company/', '/contact-us/', '/testimonials/',
  '/faq/', '/avoiding-foreclosure/', '/resource-page/', '/blog/',
  '/blog/how-to-sell-a-house-with-liens-in-houston/', '/harris_county/',
  '/thank-you/', '/privacy/',
];

const browser = await chromium.launch();
const byRule = new Map();

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.name === 'mobile',
  });
  const page = await ctx.newPage();

  for (const path of pages) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: axeSource });
    const results = await page.evaluate(async () =>
      // @ts-ignore
      await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      }),
    );

    for (const v of results.violations) {
      const key = `${v.id} (${v.impact})`;
      if (!byRule.has(key)) byRule.set(key, { help: v.help, where: new Set(), sample: '' });
      const entry = byRule.get(key);
      entry.where.add(`${viewport.name}${path}`);
      if (!entry.sample) entry.sample = v.nodes[0]?.html?.slice(0, 140) ?? '';
    }
  }
  await ctx.close();
}

await browser.close();

if (byRule.size === 0) {
  console.log('no WCAG 2.1 A/AA violations across', pages.length, 'pages × 2 viewports');
} else {
  console.log(`${byRule.size} distinct violation(s):\n`);
  for (const [rule, info] of [...byRule].sort()) {
    console.log(`  ${rule}`);
    console.log(`    ${info.help}`);
    console.log(`    on ${info.where.size} page/viewport combos, e.g. ${[...info.where][0]}`);
    console.log(`    sample: ${info.sample}\n`);
  }
}
process.exit(byRule.size ? 1 : 0);
