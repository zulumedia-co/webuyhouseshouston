# We Buy Houses Houston

A ground-up rebuild of webuyhouseshouston.com, replacing the InvestorCarrot
template with a fast, self-owned site.

- **Stack:** Astro 5 · Tailwind v4 · TypeScript, statically built
- **Design:** "Trust & Authority" — deep navy, brass accent, Fraunces display
  over Inter body
- **Content:** all 335 legacy blog posts imported verbatim at their original URLs

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static build + one serverless function for leads
```

**Performance:** the homepage is 26.3 KB gzipped on first load (15.3 KB HTML +
11 KB CSS) and ships 3.3 KB of inline JavaScript — no framework runtime, no
external requests. A blog post is 9.9 KB gzipped.

## Verifying

```bash
npm run verify:urls   # every legacy URL still resolves (352/352)
npm run test:form     # end-to-end lead form in a real browser
npm run test:a11y     # axe-core WCAG 2.1 A/AA across 16 pages × 2 viewports
npm run shots         # screenshot every page, desktop + mobile
```

`test:form` and `test:a11y` need a server running. `test:form` needs the dev
server (`npm run dev`, port 4322) because it exercises the lead API;
`test:a11y` and `shots` can point at any server via `BASE=`.

Current state: 352/352 URLs resolve, all 10 form checks pass, zero WCAG 2.1
A/AA violations.

---

## The one rule: never change a URL

Every URL that was live on the old site resolves at the same path here. That is
not a preference — the blog archive carries years of accumulated long-tail
search rankings, and that organic traffic *is* the lead flow. Changing blog URLs
is the most common way a rebuild destroys a client's traffic.

`scripts/verify-urls.py` enforces this. Run it after every build:

```bash
npm run build && python3 scripts/verify-urls.py
# checked 352 legacy URLs against dist/ → 352 resolved, 0 missing
```

If a URL genuinely has to move, it needs a 301 — never a 404.

### Legacy slugs that look broken

Eleven live URLs contain Carrot merge tags that were never substituted, e.g.
`/blog/using-tax-liens-cutomer_market_city/` (note the typo — it is in the live
URL). These slugs are **kept exactly as they are**, because they are indexed.
The visible titles and body copy have been repaired. They are flagged with
`legacySlug: true` in frontmatter and excluded from "related reading" rails so
we do not advertise them.

---

## Where things live

| Path | What it is |
|---|---|
| `src/config/site.ts` | **Every brand fact.** Phone, address, nav, footer. Nothing else hardcodes these. |
| `src/styles/global.css` | Design tokens and component classes. The palette lives in `@theme`. |
| `src/data/content.ts` | Structured page copy — FAQs, comparison table, process steps, situations. |
| `src/data/testimonials.ts` | Real reviews. Currently empty on purpose — see below. |
| `src/content/blog/*.md` | The 335 imported posts. Filenames are the URL slugs. |
| `src/lib/leads.ts` | Validation, spam filtering, and the CRM adapters. |
| `src/pages/api/lead.ts` | The only non-static route on the site. |

To reskin this for Guillermo's next site, the bulk of the work is
`src/config/site.ts` plus the palette block in `global.css`.

---

## Lead capture

Forms post to `/api/lead/`, which validates, filters spam, then hands off to a
CRM adapter chosen by the `LEAD_ADAPTER` environment variable.

**Production target is `flowtrack`** — app.zulumedia.co, a FlowTrack/CloseGPT
white-label. The adapter is written. **See [`docs/crm-integration.md`](docs/crm-integration.md)
for the exact form fields to create in the CRM and what to send back.**

**This is unconfigured until you set `LEAD_ADAPTER`.** Out of the box it uses
the `console` adapter, which logs the lead and does nothing else. The site will
appear to work perfectly and no lead will reach anyone. Set this before launch.

Deliberate behaviours worth knowing:

- **Spam is accepted with a 200, not rejected.** Telling a bot it failed just
  invites a retry with the trap removed. Two signals are used: a honeypot field
  and a sub-3-second submission timer. Both are conservative — a false positive
  here is a lost customer.
- **A CRM outage returns 502, not success.** The visitor is told to call
  instead, and the full lead is written to the server log prefixed
  `[lead] DELIVERY FAILED` so it can be recovered manually.
- **Forms work without JavaScript.** They are real `<form>` elements with a real
  action. Without JS both steps submit at once and the endpoint 303-redirects.
  Leads are the business; they must not depend on a bundle loading.

---

## Content import

The import is reproducible from scratch:

```bash
npm run import:fetch      # download raw HTML for all 335 posts
npm run import:convert    # HTML -> markdown with frontmatter
python3 scripts/localize-images.py   # pull images off Carrot's CDN
python3 scripts/optimize-images.py   # convert to WebP
```

**Images are self-hosted on purpose.** Every image in the legacy archive was
served from `cdn.carrot.com`. The day Guillermo cancels that subscription those
URLs can disappear and 208 images break at once. They now live in
`public/blog-images/`, converted to WebP — 40.8 MB of PNGs became 6.8 MB with no
visible difference.

---

## Open items

### Decided

- **Testimonials: none exist, and none are invented.** The legacy page carried
  zero customer reviews — only a generic Forbes industry quote presented as if
  it were one. `src/data/testimonials.ts` is intentionally empty. Rather than
  leave an apologetic gap, `/testimonials/` now leads with *how to vet any cash
  buyer, including us* — six concrete checks. That is more useful than
  testimonials and no competitor does it. **Add entries to
  `src/data/testimonials.ts` and the page automatically switches to a review
  grid**; the vetting content stays below it.
- **Social profiles: deliberately none.** A page with four followers and no
  posts reads as abandoned, which is the exact signal a distressed seller is
  watching for. `CONTACT.social` is empty and the footer omits the block
  entirely. Revisit when there is something real to post.
- **The Vinita St listing is archived.** `/property/homes-for-sale-in-tx-houston-77034-vinita-3br/`
  was published February 2017 and still rendered as an active "For Sale"
  listing. It is now presented as a past project and set `noindex`. Flip
  `archived` to `false` in that page if it is genuinely available.

### Still needed

1. **The CRM endpoint.** See [`docs/crm-integration.md`](docs/crm-integration.md).
   Nothing reaches Guillermo until this is set.
2. **An email address on the domain**, e.g. `offers@webuyhouseshouston.com`.
   Set `CONTACT.email` in `src/config/site.ts` and every email affordance
   appears automatically. Note `g@fastcashoffers.com` is already public on the
   property page — a different domain, which reads as a disconnect.
3. **A Google Business Profile.** The highest-leverage trust and local-SEO asset
   for this business, and the right place to accumulate reviews — it feeds the
   Maps pack that sits above organic results, and the `LocalBusiness` schema in
   `BaseLayout.astro` is already built to support it.
4. **A lawyer's read of the privacy policy.** Carried over verbatim because a
   privacy policy is a legal document, but it predates current CCPA/GDPR-style
   expectations.

---

## Deployment

Built for Vercel. Swapping hosts is a one-line change in `astro.config.mjs` —
replace the `vercel()` adapter with `@astrojs/netlify` or `@astrojs/node`.
Nothing else in the codebase depends on it.

Before going live:

- [ ] Set `LEAD_ADAPTER` and its credentials, then submit a real test lead
- [ ] Point DNS and confirm `site` in `astro.config.mjs` matches
- [ ] Submit `/sitemap-index.xml` in Google Search Console
- [ ] Run `python3 scripts/verify-urls.py` one final time against the production build
