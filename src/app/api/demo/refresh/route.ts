import { redirect } from 'next/navigation';
import { currentUser } from '@/demo/session';
import { refreshSubscriptionState } from '@/referrals/stripe/refresh';

export const dynamic = 'force-dynamic';

/**
 * Pull billing state from Stripe on demand.
 *
 * Exists because a laptop has no public URL for Stripe to call. In production
 * the webhook does this and nobody presses anything.
 */
export async function POST(): Promise<Response> {
  const user = await currentUser();
  if (!user) return new Response('Not signed in', { status: 401 });

  await refreshSubscriptionState(user.id);
  redirect('/dashboard');
}
