import type { ReferralLocale } from '../i18n';

/**
 * Dates and money, formatted on the server.
 *
 * On the server specifically, and passed to the client already as strings. The
 * browser's own locale is not the account's: someone whose dashboard is in
 * French reading it on a machine set to US English would get "5/4/2026" beside
 * a French sentence, and 5 April would be read as 4 May. Formatting where the
 * account's locale is known removes the question.
 */

const LOCALE_TAGS: Record<ReferralLocale, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  es: 'es-ES',
};

export function formatDate(date: Date, locale: ReferralLocale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    dateStyle: 'long',
    // The server runs in UTC. Without naming a zone, a signup recorded at
    // 00:30 UTC is shown as the previous day to anyone west of London, which
    // reads as the page being wrong rather than as a timezone.
    timeZone: 'UTC',
  }).format(date);
}

/** `amount` is in the currency's smallest unit, as Stripe reports it. */
export function formatMoney(amount: number, currency: string, locale: ReferralLocale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'currency',
    currency: currency.toUpperCase(),
    // Zero-decimal currencies (JPY, KRW) would otherwise be shown multiplied
    // by 100 — Intl knows which they are, so the divisor has to ask it.
    ...(isZeroDecimal(currency) ? {} : {}),
  }).format(isZeroDecimal(currency) ? amount : amount / 100);
}

/**
 * Currencies Stripe treats as having no minor unit, so the "cents" are whole
 * units. Getting this wrong shows ¥500 as ¥50,000.
 */
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

function isZeroDecimal(currency: string): boolean {
  return ZERO_DECIMAL.has(currency.toLowerCase());
}
