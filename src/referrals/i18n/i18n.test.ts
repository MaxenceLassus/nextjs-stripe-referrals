import { describe, expect, it } from 'vitest';
import { getReferralDictionary, REFERRAL_LOCALES, fill, isReferralLocale } from './index';
import { en } from './en';

describe('getReferralDictionary', () => {
  it('serves every advertised locale', () => {
    for (const locale of REFERRAL_LOCALES) {
      expect(getReferralDictionary(locale).title.length).toBeGreaterThan(0);
    }
  });

  it('falls back to English rather than returning nothing', () => {
    expect(getReferralDictionary('pt')).toBe(en);
    expect(getReferralDictionary(null)).toBe(en);
    expect(getReferralDictionary(undefined)).toBe(en);
    expect(getReferralDictionary('')).toBe(en);
  });

  it('reads a regional tag as its base language', () => {
    //Column values like `fr-CA` or `en-US` are what real apps store.
    expect(getReferralDictionary('fr-CA')).toBe(getReferralDictionary('fr'));
    expect(getReferralDictionary('DE-AT')).toBe(getReferralDictionary('de'));
  });

  it('has no empty string in any language', () => {
    for (const locale of REFERRAL_LOCALES) {
      const dict = getReferralDictionary(locale);
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('keeps the same placeholders in every language', () => {
    // A translation that drops `{percent}` renders a sentence with a hole in
    // it, and only for the customers who read that language.
    const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort().join(',');

    for (const locale of REFERRAL_LOCALES) {
      const dict = getReferralDictionary(locale);
      for (const key of Object.keys(en) as Array<keyof typeof en>) {
        expect(placeholders(dict[key]), `${locale}.${key}`).toBe(placeholders(en[key]));
      }
    }
  });

  it('uses no em or en dash in customer-facing copy', () => {
    // The most recognisable signature of machine-written text, in a page that
    // is asking a customer to vouch for the product to their friends.
    for (const locale of REFERRAL_LOCALES) {
      for (const [key, value] of Object.entries(getReferralDictionary(locale))) {
        expect(value, `${locale}.${key}`).not.toMatch(/[–—]/);
      }
    }
  });
});

describe('fill', () => {
  it('substitutes named placeholders', () => {
    expect(fill('{a} of {b}', { a: 2, b: 5 })).toBe('2 of 5');
  });

  it('leaves an unknown placeholder visible rather than blanking it', () => {
    expect(fill('{percent}% off', {})).toBe('{percent}% off');
  });
});

describe('isReferralLocale', () => {
  it('accepts the five and nothing else', () => {
    expect(isReferralLocale('en')).toBe(true);
    expect(isReferralLocale('es')).toBe(true);
    expect(isReferralLocale('pt')).toBe(false);
    expect(isReferralLocale(42)).toBe(false);
  });
});
