import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/demo/session';
import { ReferralPage } from '@/referrals/ui/ReferralPage';

export const dynamic = 'force-dynamic';

/**
 * The referral page, mounted.
 *
 * This whole file is the integration: resolve your user however you already do,
 * hand the id over. Everything else is the module's.
 */
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/signup');

  return (
    <main className="space-y-6">
      <Link href="/dashboard" className="text-sm text-slate-500 underline">
        Back to dashboard
      </Link>

      <ReferralPage
        userId={user.id}
        locale={user.locale}
        label={user.name ?? user.email}
        // Your real plan price. Given one, the page quotes the actual next
        // invoice instead of only a percentage.
        price={{ amount: 2900, currency: 'eur' }}
      />
    </main>
  );
}
