/**
 * Real customer testimonials.
 *
 * INTENTIONALLY EMPTY. The legacy site's /testimonials/ page carried no
 * customer reviews at all — only a generic Forbes industry quote presented as
 * if it were one. Nothing here is invented: fake reviews are both a FTC
 * problem and the fastest way to destroy the credibility this design is built
 * to create.
 *
 * To publish real ones, add entries below and the page switches automatically
 * from the "share your experience" state to a testimonial grid. Ask Guillermo
 * for names, cities, and ideally the situation each seller was in — specific
 * testimonials ("we closed 9 days after my father passed") convert far better
 * than generic praise.
 */
export interface Testimonial {
  quote: string;
  name: string;
  location: string;
  /** e.g. "Inherited property", "Foreclosure" — shown as a small label. */
  situation?: string;
}

export const TESTIMONIALS: Testimonial[] = [];

/**
 * Industry context, NOT a customer review. Attributed to Forbes and labeled
 * as such so no reader mistakes it for social proof from a seller.
 */
export const INDUSTRY_QUOTE = {
  quote:
    'Quite often investors are willing to pay cash for a home and with the recent tightening of financial restrictions, coupled with the growing number of complaints about low appraisals, having a cash buyer has become even more appealing.',
  source: 'Forbes',
};
