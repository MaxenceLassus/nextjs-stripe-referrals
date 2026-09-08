import { randomBytes } from 'node:crypto';
import { db } from './db';
import { referralCodeBase } from './rules';

/**
 * Minting and resolving referral codes.
 */

/**
 * Human-typable random suffix. Excludes the characters that are easy to misread
 * off a screen or a printed card (0/O, 1/I/L), because these get read aloud and
 * typed by hand far more often than a link gets clicked.
 */
function randomSuffix(length = 4): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    // Modulo bias over 31 symbols in a 256-value space is negligible for a
    // code whose only job is to not collide with a name-based prefix.
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/**
 * This account's code, minted on first use.
 *
 * Lazily rather than at signup: most accounts never open the referral page,
 * and a code nobody was ever told about is not worth a row. Immutable once
 * set — it is the stable half of a link that may already be in circulation.
 *
 * `label` only shapes the readable prefix. Pass a display name, a company name,
 * or nothing.
 */
export async function ensureReferralCode(userId: string, label?: string | null): Promise<string> {
  const existing = await db.referralCode.findUnique({
    where: { userId },
    select: { code: true },
  });
  if (existing) return existing.code;

  const base = referralCodeBase(label ?? '');

  // A handful of attempts is plenty: the suffix is 4 characters over a
  // 31-symbol alphabet, so colliding on the very same base is rare and
  // retrying costs one wasted insert.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `${base}-${randomSuffix()}`;
    try {
      const row = await db.referralCode.create({ data: { userId, code } });
      return row.code;
    } catch (error) {
      const prismaCode = (error as { code?: string } | null)?.code;

      // Two tabs racing on the first page load: the other one won, and its
      // code is the account's code.
      if (prismaCode === 'P2002') {
        const settled = await db.referralCode.findUnique({
          where: { userId },
          select: { code: true },
        });
        if (settled) return settled.code;
        // Otherwise the collision was on `code`, not `userId`: try another.
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Could not mint a unique referral code for ${userId} after 5 attempts.`);
}

/**
 * Resolve a code into the account that should be credited for it.
 *
 * Returns null for an unknown code and for a self-referral. Both are ignored
 * by callers rather than surfaced as errors: a stale, mistyped or hand-edited
 * code must never be the reason a signup fails, and telling a visitor that a
 * code is invalid turns the signup form into an oracle for which codes exist.
 */
export async function resolveReferrer(
  code: string | null | undefined,
  newUserId: string,
): Promise<string | null> {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed) return null;

  const owner = await db.referralCode.findUnique({
    where: { code: trimmed },
    select: { userId: true },
  });

  if (!owner) return null;
  if (owner.userId === newUserId) return null;

  return owner.userId;
}
