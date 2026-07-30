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

/**
 * Consent wording shown at the point of collection.
 *
 * IMPORTANT — this is 10DLC / A2P and TCPA infrastructure, not decoration.
 *
 * To register an A2P messaging campaign, carriers (via The Campaign Registry)
 * check that the opt-in language appears on the public form, and that the
 * linked privacy policy states mobile opt-in data is not shared for marketing.
 * Campaigns are rejected without both. Separately, TCPA statutory damages run
 * $500–$1,500 *per message*, and cash-buyer businesses are a frequent target,
 * so marketing consent must be a separate, affirmative, unticked opt-in rather
 * than a condition of submitting the form.
 *
 * `version` is stored with every lead so that if this wording is ever changed
 * we can still prove exactly what a given person agreed to.
 *
 * Do not edit the text without legal review, and bump the version if you do.
 */
export const CONSENT = {
  version: '2026-07-v1',
  /** Transactional. Shown as inline text; submitting the form is the consent. */
  transactional:
    'By submitting this form you agree that We Buy Houses Houston may contact you by phone, text message or email about your property. Consent is not a condition of any purchase. Message and data rates may apply.',
  /** Marketing. Separate, optional, unticked — never pre-selected. */
  marketing:
    'I agree to receive recurring marketing text messages from We Buy Houses Houston at the number provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.',
  /**
   * The clause carriers look for when reviewing an A2P 10DLC registration.
   *
   * Defined once because it must appear, word for word, on both the privacy
   * policy and the terms page. It was previously typed out separately in each,
   * with only a code comment asking future editors to keep them in step — which
   * is not a mechanism. Two legal pages contradicting each other on this
   * specific paragraph is exactly what gets a campaign registration rejected.
   */
  mobileDataClause:
    'No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Information sharing with subcontractors in support services, such as customer service, is permitted. All other use case categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.',
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
      { label: 'Terms & Messaging', href: '/terms/' },
    ],
  },
];

/**
 * Footer positioning statement. VERBATIM from the legacy site — this is how
 * Guillermo describes the business and it carries over unchanged.
 */
export const ABOUT_BLURB =
  'We are a real estate solutions and investment firm that specializes in helping homeowners get rid of burdensome houses fast. We are investors and problem solvers who can buy your house fast with a fair all cash offer.';
