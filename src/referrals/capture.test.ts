import { describe, expect, it } from 'vitest';


// `next/headers` is only reachable inside a request; the sanitiser is the part
// worth testing and it is pure.
const { sanitizeReferralCode } = await import('./capture');

describe('sanitizeReferralCode', () => {
  it('accepts a code this app would mint', () => {
    expect(sanitizeReferralCode('SARAH-9F3K')).toBe('SARAH-9F3K');
  });

  it('normalises case and whitespace, because codes get typed by hand', () => {
    expect(sanitizeReferralCode('  sarah-9f3k  ')).toBe('SARAH-9F3K');
  });

  it('drops anything that is not a code', () => {
    // The cookie and the query string are both writable by the visitor. A
    // forged code is harmless (crediting a referral only ever gives someone a
    // discount) but it still has no business reaching a database lookup.
    expect(sanitizeReferralCode("SARAH' OR 1=1--")).toBeNull();
    expect(sanitizeReferralCode('<script>')).toBeNull();
    expect(sanitizeReferralCode('a'.repeat(41))).toBeNull();
    expect(sanitizeReferralCode('')).toBeNull();
    expect(sanitizeReferralCode(null)).toBeNull();
    expect(sanitizeReferralCode(undefined)).toBeNull();
  });
});
