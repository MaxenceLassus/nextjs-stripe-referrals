import { en } from './en';
import { fr } from './fr';
import { de } from './de';
import { it } from './it';
import { es } from './es';
import {
  DEFAULT_REFERRAL_LOCALE,
  REFERRAL_LOCALES,
  isReferralLocale,
  type ReferralCopy,
  type ReferralLocale,
} from './types';

/**
 * The five dictionaries.
 *
 * Typed as `Record<ReferralLocale, ReferralCopy>` so that adding a language, or
 * adding a string to `ReferralCopy`, fails to compile until every language has
 * it. A blank string discovered by a customer is the alternative.
 */
const dictionaries: Record<ReferralLocale, ReferralCopy> = { en, fr, de, it, es };

/**
 * Copy for a locale, falling back to English.
 *
 * Accepts anything — a raw `Accept-Language` fragment, a column from your users
 * table, undefined — because the caller is your app and it should not have to
 * learn this module's enum to render a page. `fr-CA` resolves to `fr`.
 */
export function getReferralDictionary(locale?: string | null): ReferralCopy {
  if (!locale) return dictionaries[DEFAULT_REFERRAL_LOCALE];

  const normalized = locale.toLowerCase().split('-')[0]!;
  return isReferralLocale(normalized)
    ? dictionaries[normalized]
    : dictionaries[DEFAULT_REFERRAL_LOCALE];
}

export {
  REFERRAL_LOCALES,
  DEFAULT_REFERRAL_LOCALE,
  isReferralLocale,
  fill,
} from './types';
export type { ReferralCopy, ReferralLocale } from './types';
