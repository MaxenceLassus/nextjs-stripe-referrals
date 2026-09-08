import { describe, expect, it } from 'vitest';
import {
  discountPercent,
  discountedAmount,
  referralCodeBase,
  referralLink,
  couponIdFor,
  maxPercent,
  maxReferrals,
  percentStep,
} from './rules';

describe('discountPercent', () => {
  it('gives nothing away without a paying referral', () => {
    expect(discountPercent(0)).toBe(0);
  });

  it('walks the tiers one referral at a time', () => {
    expect(discountPercent(1)).toBe(20);
    expect(discountPercent(2)).toBe(40);
    expect(discountPercent(3)).toBe(60);
    expect(discountPercent(4)).toBe(80);
    expect(discountPercent(5)).toBe(100);
  });

  it('caps rather than going past the maximum', () => {
    // A percentage above 100 has no coupon behind it, so an uncapped count
    // would fall through to "no discount at all" for the account that earned
    // the most. That failure is silent and lands on an invoice.
    expect(discountPercent(6)).toBe(maxPercent);
    expect(discountPercent(5000)).toBe(maxPercent);
  });

  it('never turns a bad count into a surcharge', () => {
    expect(discountPercent(-1)).toBe(0);
    expect(discountPercent(Number.NaN)).toBe(0);
  });

  it('keeps the tiers and the cap in step', () => {
    expect(percentStep * maxReferrals).toBe(maxPercent);
    expect(maxPercent).toBeLessThanOrEqual(100);
  });
});

describe('discountedAmount', () => {
  it('leaves the price alone at zero percent', () => {
    expect(discountedAmount(2900, 0)).toBe(2900);
  });

  it('applies a tier', () => {
    expect(discountedAmount(2900, 20)).toBe(2320);
    expect(discountedAmount(2900, 60)).toBe(1160);
  });

  it('reaches exactly free at the top tier', () => {
    expect(discountedAmount(2900, 100)).toBe(0);
  });

  it('rounds to a whole minor unit rather than emitting fractions of a cent', () => {
    expect(Number.isInteger(discountedAmount(999, 20))).toBe(true);
    expect(discountedAmount(999, 20)).toBe(799);
  });
});

describe('referralCodeBase', () => {
  it('folds accents instead of dropping the letter', () => {
    expect(referralCodeBase('Café des Chartrons')).toBe('CAFE-DES-CHARTRONS');
  });

  it('collapses punctuation and trims the edges', () => {
    expect(referralCodeBase("L'Atelier - Bordeaux!")).toBe('L-ATELIER-BORDEAUX');
  });

  it('falls back rather than returning an empty code', () => {
    expect(referralCodeBase('')).toBe('FRIEND');
    expect(referralCodeBase('!!!')).toBe('FRIEND');
  });

  it('stays short enough to be read out loud', () => {
    expect(referralCodeBase('a'.repeat(80)).length).toBeLessThanOrEqual(20);
  });

  it('produces only characters the capture filter accepts', () => {
    // The cookie sanitiser rejects anything outside [A-Z0-9-]; a code this
    // function can mint but that filter would drop is a referral that can
    // never be credited.
    expect(referralCodeBase('Ökobäckerei Süd')).toMatch(/^[A-Z0-9-]+$/);
    expect(referralCodeBase('日本のパン屋')).toMatch(/^[A-Z0-9-]+$/);
  });
});

describe('referralLink', () => {
  it('points at the signup page of the configured origin', () => {
    expect(referralLink('SARAH-3F2A')).toBe('https://tests.invalid/signup?ref=SARAH-3F2A');
  });

  it('honours a custom landing path', () => {
    expect(referralLink('SARAH-3F2A', '/join')).toBe('https://tests.invalid/join?ref=SARAH-3F2A');
  });

  it('escapes a code so it cannot open a second query parameter', () => {
    expect(referralLink('A&b=c')).toBe('https://tests.invalid/signup?ref=A%26b%3Dc');
  });
});

describe('couponIdFor', () => {
  it('names the percentage in the id', () => {
    // Stripe coupons are immutable. Without the percentage in the id, raising
    // REFERRAL_PERCENT_STEP would keep applying the old, smaller discount
    // while the config claimed otherwise.
    expect(couponIdFor(20)).toBe('referral_off_20');
    expect(couponIdFor(100)).toBe('referral_off_100');
  });
});
