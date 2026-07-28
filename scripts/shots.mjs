import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = process.env.OUT || '/tmp/shots';
mkdirSync(OUT, { recursive: true });

const pages = [
  ['home', '/'],
  ['offer', '/get-a-cash-offer-today/'],
  ['how-it-works', '/how-we-buy-houses/'],
  ['compare', '/compare/'],
  ['sell-your-house', '/sell-your-house/'],
  ['our-company', '/our-company/'],
  ['contact', '/contact-us/'],
  ['testimonials', '/testimonials/'],
  ['faq', '/faq/'],
  ['foreclosure', '/avoiding-foreclosure/'],
  ['resources', '/resource-page/'],
  ['blog', '/blog/'],
  ['post', '/blog/how-to-sell-a-house-with-liens-in-houston/'],
  ['harris', '/harris_county/'],
  ['thank-you', '/thank-you/'],
  ['property', '/property/homes-for-sale-in-tx-houston-77034-vinita-3br/'],
  ['404', '/404.html'],
];

const browser = await chromium.launch();
const errors = [];

for (const [viewport, size] of [
  ['desktop', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const ctx = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    isMobile: viewport === 'mobile',
  });
  const page = await ctx.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${viewport}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${viewport}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    // Ignore favicon/apple-touch noise that we deliberately do not ship.
    if (!/apple-touch-icon/.test(r.url())) {
      errors.push(`[${viewport}] failed: ${r.url()} (${r.failure()?.errorText})`);
    }
  });

  for (const [name, path] of pages) {
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
    if (!res || res.status() >= 400) errors.push(`[${viewport}] ${path} -> ${res?.status()}`);
    // Let fonts settle so text is not captured mid-swap.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `${OUT}/${viewport}-${name}.png`,
      fullPage: viewport === 'desktop' ? false : false,
    });
  }
  await ctx.close();
}

await browser.close();

if (errors.length) {
  console.log('ISSUES:');
  for (const e of [...new Set(errors)]) console.log(' -', e);
} else {
  console.log('no console errors, no failed requests, no bad status codes');
}
