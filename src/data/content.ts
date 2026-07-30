import type { IconName } from '@/lib/icons';

/**
 * Structured page content lifted from the legacy site.
 *
 * Copy marked VERBATIM is reproduced word-for-word — it is the client's voice
 * and their existing SEO surface. Where the legacy site had no copy at all
 * (step descriptions, situation blurbs) the wording here is new, written to
 * match the existing tone.
 */

export interface ProcessStep {
  number: string;
  title: string;
  body: string;
  duration: string;
}

/** The four steps are VERBATIM titles from /how-we-buy-houses/. */
export const PROCESS_STEPS: ProcessStep[] = [
  {
    number: '01',
    title: 'Tell us about your property',
    body: 'Share the address and a few basic details through the form or over the phone. It takes about two minutes, it is completely free, and it puts you under no obligation whatsoever.',
    duration: '2 minutes',
  },
  {
    number: '02',
    title: 'We set up a quick appointment',
    body: 'If the property meets our buying criteria, we will reach out to arrange a convenient time to take a look. No staging, no cleaning, no repairs — we see houses in every condition.',
    duration: 'Within 24 hours',
  },
  {
    number: '03',
    title: 'You receive a written offer',
    body: 'We present a fair, written, no-obligation cash offer. We walk you through exactly how we arrived at the number so you can make an informed decision — and you are free to say no.',
    duration: 'Same visit',
  },
  {
    number: '04',
    title: 'We close on your timeline',
    body: 'We close at a local, reputable title company with cash in your hands in as little as 7 days — or later, if you need more time. You choose the date, and we pay all the costs.',
    duration: 'As little as 7 days',
  },
];

export interface Situation {
  title: string;
  body: string;
  icon: IconName;
}

/**
 * The situation list is VERBATIM from /sell-your-house/; the one-line
 * explanations are new.
 */
export const SITUATIONS: Situation[] = [
  {
    title: 'Facing foreclosure',
    body: 'A fast, certain sale can stop the process and protect your credit before the bank forecloses.',
    icon: 'gavel',
  },
  {
    title: 'Inherited an unwanted property',
    body: 'We handle probate situations regularly and can work directly with your attorney and the title company.',
    icon: 'file',
  },
  {
    title: 'Going through a divorce',
    body: 'A clean, quick sale with a fixed closing date lets both parties move forward without a drawn-out listing.',
    icon: 'heart',
  },
  {
    title: 'Tired of being a landlord',
    body: 'Difficult tenants, unpaid rent, or a rental that has stopped making sense — we buy occupied properties.',
    icon: 'key',
  },
  {
    title: 'The house needs major repairs',
    body: 'Fire, water, mold, foundation, code violations. We buy as-is and pay for every repair ourselves.',
    icon: 'wrench',
  },
  {
    title: 'Relocating quickly',
    body: 'A job transfer or family move on a deadline does not leave 91 days to wait for a buyer.',
    icon: 'box',
  },
  {
    title: 'The listing expired',
    body: 'If an agent could not sell it, that does not mean it cannot be sold. We buy houses that sat on the market.',
    icon: 'clock',
  },
  {
    title: 'Vacant or costing you money',
    body: 'Every month a property sits empty costs taxes, insurance, utilities and upkeep. We take it off your hands.',
    icon: 'home',
  },
];

export interface ComparisonRow {
  label: string;
  agent: string;
  us: string;
  /** Highlights the row where the difference is most stark. */
  emphasis?: boolean;
}

/** VERBATIM from /compare/. */
export const COMPARISON: ComparisonRow[] = [
  { label: 'Commissions / Fees', agent: '6% on average is paid by you, the seller', us: 'None', emphasis: true },
  { label: 'Who pays closing costs?', agent: '2% on average is paid by you, the seller', us: 'None — we pay all costs' },
  { label: 'Inspection & financing contingency', agent: 'Yes — up to 15% of sales fall through', us: 'None' },
  { label: 'Appraisal needed', agent: 'Yes — sale is often subject to appraisal', us: 'None — we make cash offers' },
  { label: 'Average days until sold', agent: '+/- 91 days', us: 'Immediate cash offer', emphasis: true },
  { label: 'Number of showings', agent: 'It depends', us: '1 (just us)' },
  { label: 'Closing date', agent: '30–60 +/- days after accepting offer', us: 'The date of your choice', emphasis: true },
  { label: 'Who pays for repairs?', agent: 'Negotiated during inspection period', us: 'None — we pay for all repairs' },
];

export interface Faq {
  /**
   * Stable identifier. Pages select FAQs by id rather than by matching the
   * question text, so rewording a question can never silently drop it from a
   * page. Ids must not be renamed once in use.
   */
  id: string;
  question: string;
  answer: string;
}

/**
 * VERBATIM from /faq/. These answers are long and specific, which is exactly
 * what makes them credible — they have not been trimmed.
 */
export const FAQS: Faq[] = [
  {
    id: 'mls-or-buying',
    question: 'Will you be listing my house on the MLS or actually buying it?',
    answer:
      'Great question. We’re not agents, and we don’t list houses. We are professional home buyers: we buy houses in Houston that meet our purchasing criteria. From there we may repair the house and resell it to another home owner or keep it as a rental ourselves.',
  },
  {
    id: 'fair-prices',
    question: 'Do you pay fair prices for properties?',
    answer:
      'Many of the houses we purchase are below market value (we do this so we can resell it at a profit to another home owner). We are looking to get a fair discount on a property. However, in our experience, many sellers aren’t necessarily expecting a large “windfall” on the property but rather appreciate that we can offer cash, we close very quickly (no waiting for financing), and no time or effort or expense is required on your part to fix up the property or pay agent fees. If that’s what you’re looking for and you see the value in getting your house sold fast… let’s see if we can come to a fair win-win price. Besides, our no-obligation pricing commitment means that you do not have to move forward with the offer we give — but it’s good to know what we’re offering.',
  },
  {
    id: 'how-price-determined',
    question: 'How do you determine the price to offer on my house?',
    answer:
      'Great question, and we’re an open book: our process is very straightforward. We look at the location of the property, what repairs are needed, the current condition of the property, and values of comparable houses sold in the area recently. We take many pieces of information into consideration and come up with a fair price that works for us and works for you too.',
  },
  {
    id: 'fees-commissions',
    question: 'Are there any fees or commissions to work with you?',
    answer:
      'This is what makes us stand out from the traditional method of selling your house: there are NO fees or commissions when you sell your house to us. We’ll make you an offer, and if it’s a fit then we’ll buy your house (and we’ll often pay for the closing costs too). No hassle. No fees. We make our money after we pay for repairs on the house (if any) and sell it for a profit — we’re taking all of the risk on whether we can sell it for a profit or not. Once we buy the house from you, the responsibility is ours and you walk away without the burden of the property and its payments, and often with cash in your hand.',
  },
  {
    id: 'vs-agent',
    question: 'How are you different from a real estate agent?',
    answer:
      'Real estate agents list properties and hope that someone will buy them. The agent shows the properties to prospective buyers if there are any (the average time to sell a property in many markets right now is 6–12 months) and then takes a percentage of the sale price if they find a buyer. Oftentimes, the agent’s commission is 3–6% of the sale price of your house (so if it’s a $100,000 house, you’ll pay between $3,000 and $6,000 in commissions to an agent). Agents provide a great service for those that can wait 6–12 months to sell and who don’t mind giving up some of that sale price to pay the commissions. But that’s where we’re different: we’re not agents, we’re home buyers. Our company actually buys houses. We don’t list houses. Since we’re actually the one buying the house from you, and we pay with all cash, we can make a decision to buy your house within a couple of days — sometimes the same day.',
  },
  {
    id: 'obligation',
    question: 'Is there any obligation when I submit my info?',
    answer:
      'There is absolutely zero obligation for you. Once you tell us a bit about your property, we’ll take a look at things, maybe set up a call with you to find out a bit more, and make you an all-cash offer that’s fair for you and fair for us. From there, it’s 100% your decision on whether or not you’d like to sell your house to us. We won’t hassle you and we won’t harass you — it’s 100% your decision and we’ll let you decide what’s right for you.',
  },
  {
    id: 'bad-shape',
    question: 'What if the house is in really bad shape? Will you still buy it?',
    answer:
      'We buy houses in any condition or shape. You’d be amazed at some of the houses we’ve bought before. Why do we buy even rundown houses? Simple — most ugly houses just need a little TLC, and then they’re pretty houses that someone would love to live in once again. We pay for all renovations and repairs after we buy the house, so you don’t have to worry about any of that.',
  },
  {
    id: 'how-fast',
    question: 'How quickly can you actually close?',
    answer:
      'Once we get your info, we’re usually able to make you a fair all-cash offer within 24 hours. From there we can close as quickly as 7 days, or on whatever schedule suits you — sometimes we can have a check in your hand the very same day. We close at a local, reputable title company, so there is never any question about where the money is coming from.',
  },
];

/**
 * Selects FAQs by id, preserving the order requested.
 *
 * Throws on an unknown id rather than returning a short list. The whole reason
 * ids exist is that the previous approach — matching question text with a
 * regex — failed silently: a copy edit would quietly drop a question from a
 * page with nothing to indicate it. A build-time error is the point.
 */
export function pickFaqs(ids: string[]): Faq[] {
  return ids.map((id) => {
    const faq = FAQS.find((f) => f.id === id);
    if (!faq) {
      throw new Error(
        `pickFaqs: no FAQ with id "${id}". Valid ids: ${FAQS.map((f) => f.id).join(', ')}`,
      );
    }
    return faq;
  });
}

export interface Resource {
  title: string;
  body: string;
  href: string;
  external: boolean;
}

/** VERBATIM link set and descriptions from /resource-page/. */
export const RESOURCES: Resource[] = [
  {
    title: 'Washington Post: Selling a home to a real estate investor',
    body: 'A solid article that walks through how it works to sell to a real estate investor. They’re spot on with their recommendation to make sure you look for an investor who can deliver on their promise — some investors may not be able to actually close on their offer. Every offer we make, we back up by being able to close on it.',
    href: 'https://www.washingtonpost.com/blogs/where-we-live/post/selling-a-home-to-a-real-estate-investor/2012/12/11/5907944e-40bb-11e2-a2d9-822f58ac9fd5_blog.html',
    external: true,
  },
  {
    title: 'FDIC Foreclosure Prevention Information',
    body: 'The FDIC is a government entity and has created a great resource and “Foreclosure Prevention Toolkit”. If you’re in foreclosure, check it out.',
    href: 'https://www.fdic.gov/consumer-resource-center',
    external: true,
  },
  {
    title: 'HUD-Approved Housing Counseling',
    body: 'Free, government-approved counseling for homeowners facing foreclosure. A HUD counselor can review your situation with you at no cost and is not trying to buy your house.',
    href: 'https://www.hud.gov/i_want_to/talk_to_a_housing_counselor',
    external: true,
  },
  {
    title: 'Texas Department of Housing & Community Affairs',
    body: 'State-level assistance programs, including help for homeowners who have fallen behind on mortgage payments in Texas.',
    href: 'https://www.tdhca.texas.gov/',
    external: true,
  },
];

/** Trust points shown across the site. All are claims the legacy site makes. */
export const TRUST_POINTS = [
  { stat: '24 hours', label: 'To a fair cash offer' },
  { stat: '7 days', label: 'Fastest possible closing' },
  { stat: '$0', label: 'Fees, commissions or repairs' },
  { stat: 'Any', label: 'Condition, any price range' },
];
