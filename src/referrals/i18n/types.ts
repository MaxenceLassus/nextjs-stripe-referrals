/**
 * Every string the referral UI shows, in one shape.
 *
 * A `Record<ReferralLocale, ReferralCopy>` rather than five loose objects: a
 * missing key is then a compile error, not a blank space discovered by a German
 * customer. Adding a language means adding one entry and being told exactly what
 * is missing from it.
 *
 * Placeholders are `{named}` and filled by `fill()`. They are not string
 * concatenation on purpose — word order differs between these five languages,
 * and a sentence assembled from fragments can only be correct in the one it was
 * written in.
 */
export interface ReferralCopy {
  title: string;
  subtitle: string;

  summaryLabel: string;
  /** "{active} of {max} paying referrals" */
  activeCount: string;
  noneYetHint: string;
  remainingHint: string;
  remainingHintOne: string;
  maxedHint: string;

  nextInvoice: string;
  discountBadge: string;
  recomputedHint: string;
  noPlanHint: string;
  freeHint: string;
  /** Shown when what Stripe was told differs from what is currently earned. */
  driftWarning: string;
  stripeOffline: string;

  linkLabel: string;
  copyCta: string;
  copiedCta: string;
  shareHint: string;

  listTitle: string;
  listTotal: string;
  filterAll: string;
  filterActive: string;
  filterTrialing: string;
  filterPending: string;
  filterLapsed: string;

  statusActive: string;
  statusTrialing: string;
  statusPending: string;
  statusLapsed: string;

  joinedOn: string;
  countsHint: string;

  emptyTitle: string;
  emptyText: string;
  emptyFiltered: string;

  howTitle: string;
  howStepShare: string;
  howStepPay: string;
  howStepStop: string;
}

export const REFERRAL_LOCALES = ['en', 'fr', 'de', 'it', 'es'] as const;

export type ReferralLocale = (typeof REFERRAL_LOCALES)[number];

/** English is the fallback for anything unrecognised. */
export const DEFAULT_REFERRAL_LOCALE: ReferralLocale = 'en';

export function isReferralLocale(value: unknown): value is ReferralLocale {
  return typeof value === 'string' && (REFERRAL_LOCALES as readonly string[]).includes(value);
}

/**
 * Replace `{name}` placeholders.
 *
 * An unknown placeholder is left as-is rather than blanked: "{percent}% off" on
 * screen is an obvious bug someone reports, an empty "% off" is one nobody
 * notices.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
