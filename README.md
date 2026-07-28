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

Forms post to `/api/lead`, which validates, filters spam, then hands off to a
CRM adapter chosen by the `LEAD_ADAPTER` environment variable. See
`.env.example`.

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

## Things the client needs to supply

These are gaps in the source material, not oversights. Nothing has been invented
to fill them:

1. **Real testimonials.** The legacy testimonials page had *zero* customer
   reviews — only a generic Forbes industry quote presented as if it were one.
   `src/data/testimonials.ts` is intentionally empty; add entries and the page
   switches from the "share your experience" state to a review grid.
2. **An email address.** None is published anywhere on the legacy site.
   `CONTACT.email` is `null` and the UI hides every email affordance until it is
   set.
3. **Social profiles.** The legacy site's only "social" links were Facebook and
   Twitter *share* buttons. `CONTACT.social` is empty; the footer renders the
   block only when it is populated.
4. **A decision on the Vinita St listing.** `/property/homes-for-sale-in-tx-houston-77034-vinita-3br/`
   was published in February 2017 and was still rendering as an active "For
   Sale" listing. It is presented here as an archived past project and set to
   `noindex`. Flip `archived` to `false` in that page if it is genuinely
   available.
5. **A lawyer's read of the privacy policy.** It is carried over verbatim
   because a privacy policy is a legal document, but it predates current
   CCPA/GDPR-style expectations.

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
