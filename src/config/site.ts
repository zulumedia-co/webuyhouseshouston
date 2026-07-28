/**
 * Single source of truth for every brand-specific fact on the site.
 *
 * Nothing else in the codebase should hardcode a phone number, address, or
 * company name. When we clone this build for Guillermo's next site, this file
 * plus the palette in `global.css` is the bulk of what changes.
 *
 * Values marked VERBATIM were taken exactly from the live legacy site and must
 * not be reworded. Values marked PENDING are confirmed absent from the legacy
 * site and are waiting on the client — they are intentionally null rather than
 * invented, and the UI hides anything that is null.
 */

export const SITE = {
  url: 'https://webuyhouseshouston.com',
  name: 'We Buy Houses Houston', // VERBATIM
  legalName: 'We Buy Houses Houston',
  tagline: 'Sell Your House Fast In Houston, TX', // VERBATIM
  description:
    'Get a fair all-cash offer on your Houston house in 24 hours. No fees, no commissions, no repairs. You pick the closing date — we can close in as little as 7 days.',
  locale: 'en_US',
  region: 'Houston, TX',
} as const;

export const CONTACT = {
  phone: '713-730-9000', // VERBATIM — the only channel promoted on the legacy site
  phoneHref: 'tel:+17137309000',
  /** PENDING: no email address is published anywhere on the legacy site. */
  email: null as string | null,
  address: {
    street: '2950 North Loop West',
    suite: 'Suite 500',
    city: 'Houston',
    state: 'Texas',
    stateAbbr: 'TX',
    zip: '77092',
  },
  /** Formatted one-line address for schema.org and the footer. */
  get addressLine(): string {
    const a = this.address;
    return `${a.street}, ${a.suite}, ${a.city}, ${a.state} ${a.zip}`;
  },
  /**
   * PENDING: the legacy site has no social profiles — only Facebook/Twitter
   * *share* buttons, which are not the same thing. Add real profile URLs here
   * and the footer will render them automatically.
   */
  social: [] as Array<{ name: string; url: string }>,
} as const;

/** The promise the whole business rests on. Used across hero, CTAs and schema. */
export const PROMISE = {
  offerWindow: '24 hours',
  fastestClose: '7 days',
  fees: 'No fees',
  commissions: 'No commissions',
  repairs: 'No repairs',
} as const;

export const NAV: Array<{ label: string; href: string }> = [
  { label: 'How It Works', href: '/how-we-buy-houses/' },
  { label: 'Sell Your House', href: '/sell-your-house/' },
  { label: 'Compare', href: '/compare/' },
  { label: 'Our Company', href: '/our-company/' },
  { label: 'Resources', href: '/resource-page/' },
  { label: 'Blog', href: '/blog/' },
];

export const FOOTER_NAV: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: 'Sell Your House',
    links: [
      { label: 'Get A Cash Offer Today', href: '/get-a-cash-offer-today/' },
      { label: 'How It Works', href: '/how-we-buy-houses/' },
      { label: 'Sell Your House', href: '/sell-your-house/' },
      { label: 'Compare Your Options', href: '/compare/' },
      { label: 'Avoiding Foreclosure', href: '/avoiding-foreclosure/' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Our Company', href: '/our-company/' },
      { label: 'Testimonials', href: '/testimonials/' },
      { label: 'Contact Us', href: '/contact-us/' },
      { label: 'FAQ', href: '/faq/' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { label: 'Blog', href: '/blog/' },
      { label: 'Free Resources', href: '/resource-page/' },
      { label: 'Harris County', href: '/harris_county/' },
      { label: 'Privacy Policy', href: '/privacy/' },
    ],
  },
];

/**
 * Footer positioning statement. VERBATIM from the legacy site — this is how
 * Guillermo describes the business and it carries over unchanged.
 */
export const ABOUT_BLURB =
  'We are a real estate solutions and investment firm that specializes in helping homeowners get rid of burdensome houses fast. We are investors and problem solvers who can buy your house fast with a fair all cash offer.';
