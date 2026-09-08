import { cookies } from 'next/headers';
import { db } from '@/referrals/db';

/**
 * The demo's stand-in for authentication.
 *
 * A cookie holding an account id, and a switcher to change it. There is no
 * password, no verification and no protection of any kind, and it is labelled
 * that way on screen.
 *
 * This is deliberate rather than lazy. The referral module never authenticates
 * anyone — it takes a `userId` and trusts its caller — so the demo has to show
 * the seam clearly instead of hiding it behind a login that would look like
 * part of what you are copying. In your app, this file is whatever you already
 * use, and the only line that matters is the one that hands a user id to
 * `<ReferralPage />`.
 */

const COOKIE = 'demo_user';

export async function currentUser() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (!id) return null;

  return db.user.findUnique({ where: { id } });
}

export async function signInAs(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, userId, { httpOnly: true, sameSite: 'lax', path: '/' });
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
