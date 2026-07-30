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
npm run test:a11y     # axe-core WCAG 2.1 A/AA across 21 pages × 2 viewports
npm run test:leads    # PII stays out of logs; consent is never assumed
npm run shots         # screenshot every page, desktop + mobile
```

All of these expect a server on **port 4321**, which is what `npm run dev`
starts. `test:form` specifically needs the dev server, because it exercises the
lead API; the others are happy against a static preview too. Point any of them
elsewhere with `BASE=http://localhost:1234 npm run test:a11y`.

The dev server takes ~35s to answer its first request while Vite compiles the
335 posts. `test:form` warms its routes first, so this shows up as a slow start
rather than a failure.

Current state: 352/352 URLs resolve, 12/12 form checks and 7/7 lead checks pass,
zero WCAG 2.1 A/AA violations across 21 pages.

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
for the exact form fields to create in the CRM and what to send back**, and
[`.env.example`](.env.example) for every environment variable involved —
adapter selection, CRM credentials, and the email fallback.

**This is unconfigured until you set `LEAD_ADAPTER`.** Out of the box it uses
the `console` adapter, which logs the lead and does nothing else. The site will
appear to work perfectly and no lead will reach anyone. Set this before launch.

Deliberate behaviours worth knowing:

- **Spam is accepted with a 200, not rejected.** Telling a bot it failed just
  invites a retry with the trap removed. Two signals are used: a honeypot field
  and a sub-3-second submission timer. Both are conservative — a false positive
  here is a lost customer.
- **A CRM outage returns 502, not success.** The visitor is told to call and
  given a reference to quote. If the email fallback is configured the lead is
  delivered that way instead and the visitor still sees success.
- **Customer details are never written to logs.** A delivery failure logs a
  short reference (e.g. `K3X9F2`, also shown to the visitor) plus
  non-identifying diagnostics — and nothing else, even when that means the
  enquiry cannot be recovered. Adapter error messages are scrubbed at the
  logging boundary so no provider response can smuggle contact details in.
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

## Operational notes before launch

- **Configure the email fallback** (`RESEND_API_KEY` + `LEAD_EMAIL_TO`). The most
  valuable setting after the CRM itself. If the CRM fails and no fallback is
  configured, the enquiry reaches nobody — the site does not stash it anywhere,
  by design. The visitor is told to call and given a reference to quote, but
  many will not. With the fallback configured, the lead is emailed instead and
  nothing is lost.
- **Alert on `[lead] ALERT: no delivery path succeeded`.** That line means a real
  enquiry was lost. Since the payload is deliberately not retained, noticing
  quickly is the only recovery route.
- **Restrict who can read production logs, and keep retention short.** Logs carry
  city, ZIP, a name initial and the last four digits of a phone number. Not
  enough to identify someone, but treat them as sensitive.
- **Enable STOP and HELP in the CRM before any messaging goes live.** The site
  publicly promises both, so the promise has to be true.

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

**Cloudflare Pages.** The build emits `dist/` with a `_worker.js` and a
`_routes.json` that sends only `/api/*` to the function — every page is served
as a static file.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 20 or later |

**Environment variables must be set in the Cloudflare Pages dashboard**, not in
a committed file. This matters more than it sounds: on Cloudflare, secrets are
*not* visible through `import.meta.env` — they arrive per-request on
`locals.runtime.env`. `src/pages/api/lead.ts` reads from there first for exactly
this reason. Get it wrong and every submission fails with "…is not set" while
the site looks perfectly healthy.

If the host ever changes, swap the adapter in `astro.config.mjs` and re-check
that env lookup — a Vercel or Node build resolves it differently, and the
output directory changes too.

Before going live:

- [ ] Set `LEAD_ADAPTER` and the CRM credentials, then submit a real test lead
- [ ] Set `RESEND_API_KEY` + `LEAD_EMAIL_TO` so a CRM outage cannot lose a lead
- [ ] Enable STOP and HELP handling in the CRM
- [ ] Point DNS and confirm `site` in `astro.config.mjs` matches
- [ ] Submit `/sitemap-index.xml` in Google Search Console
- [ ] Run `npm run verify:urls` against the production build one final time
