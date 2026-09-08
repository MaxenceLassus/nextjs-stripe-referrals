'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/referrals/db';
import { attachReferral } from '@/referrals/attach';
import { readReferralCookie, clearReferralCookie } from '@/referrals/capture';
import { accountLabel } from '@/referrals/labels';
import { refreshSubscriptionState } from '@/referrals/stripe/refresh';
import { signInAs, signOut, currentUser } from './session';

/**
 * The demo's own server actions.
 *
 * The only one worth reading as documentation is `createAccount`: it shows the
 * exactly three lines an app needs to add to its real signup path.
 */

export async function createAccount(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const name = String(formData.get('name') ?? '').trim() || null;
  const locale = String(formData.get('locale') ?? 'en');

  if (!email) return;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await signInAs(existing.id);
    redirect('/dashboard');
  }

  const user = await db.user.create({ data: { email, name, locale } });

  // ---- The integration, in full ------------------------------------------
  // Read whatever the visitor arrived with, attribute the account, forget the
  // code. `attachReferral` never throws, so nothing here can break a signup.
  const code = await readReferralCookie();
  await attachReferral(user.id, code, { label: accountLabel({ name, email }) });
  await clearReferralCookie();
  // ------------------------------------------------------------------------

  await signInAs(user.id);
  redirect('/dashboard');
}

export async function switchAccount(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  if (userId) await signInAs(userId);
  revalidatePath('/', 'layout');
}

export async function signOutAction(): Promise<void> {
  await signOut();
  revalidatePath('/', 'layout');
}

/**
 * Pull this account's billing state from Stripe now.
 *
 * The webhook does this on its own; the button exists because a local machine
 * has no public URL for Stripe to call, and `stripe listen` is one more thing
 * to have running. It is the same function the webhook calls.
 */
export async function refreshBilling(): Promise<void> {
  const user = await currentUser();
  if (!user) return;

  await refreshSubscriptionState(user.id);
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/referrals');
}
