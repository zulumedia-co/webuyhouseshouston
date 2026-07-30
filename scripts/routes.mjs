/**
 * The canonical list of routes the checking scripts cover.
 *
 * Single source of truth for both `a11y.mjs` and `shots.mjs`. They previously
 * kept separate lists which had already drifted — the accessibility audit was
 * skipping the property page and the 404, while the screenshot pass was
 * skipping the privacy page. Anything added here is picked up by both.
 *
 * Every non-blog page on the site is represented, plus one blog post and two
 * blog listing pages (page 1 and page 2) to cover the pagination states:
 * page 1 has no "Previous" control, page 2 has both.
 *
 * Entries are `[name, path]` — the name is used for screenshot filenames.
 */
export const ROUTES = [
  ['home', '/'],
  ['offer', '/get-a-cash-offer-today/'],
  ['how-it-works', '/how-we-buy-houses/'],
  ['sell-your-house', '/sell-your-house/'],
  ['compare', '/compare/'],
  ['our-company', '/our-company/'],
  ['testimonials', '/testimonials/'],
  ['faq', '/faq/'],
  ['foreclosure', '/avoiding-foreclosure/'],
  ['resources', '/resource-page/'],
  ['contact', '/contact-us/'],
  ['privacy', '/privacy/'],
  ['terms', '/terms/'],
  ['blog', '/blog/'],
  ['blog-page-2', '/blog/page/2/'],
  ['post', '/blog/how-to-sell-a-house-with-liens-in-houston/'],
  ['harris-county', '/harris_county/'],
  ['harris', '/harris/'],
  ['property', '/property/homes-for-sale-in-tx-houston-77034-vinita-3br/'],
  ['thank-you', '/thank-you/'],
  ['404', '/404.html'],
];

/** Just the paths, for callers that do not need a filename. */
export const ROUTE_PATHS = ROUTES.map(([, path]) => path);
