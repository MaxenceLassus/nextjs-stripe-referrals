import Link from 'next/link';
import { currentUser } from '@/demo/session';
import { db } from '@/referrals/db';
import { maxPercent, percentStep, maxReferrals } from '@/referrals/rules';
import { stripeEnabled } from '@/referrals/config';
import { AccountSwitcher } from '@/demo/AccountSwitcher';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [user, users] = await Promise.all([
    currentUser(),
    db.user.findMany({ orderBy: { createdAt: 'asc' }, take: 25 }),
  ]);

  return (
    <main className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">nextjs-stripe-referrals</h1>
        <p className="mt-2 max-w-prose text-slate-600">
          A referral program you can drop into a Next.js + Prisma + Stripe app. Every referral who
          becomes a paying customer takes {percentStep}% off the referrer&rsquo;s own subscription,
          up to {maxPercent}% after {maxReferrals}. The moment a referral stops paying, that share
          comes off the referrer&rsquo;s next invoice.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          This page is the demo, not the product. What you copy is{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">src/referrals/</code>.
        </p>
      </header>

      {!stripeEnabled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Stripe is not configured. Referrals are recorded and displayed, but no discount is applied.
          Set <code className="font-mono text-xs">STRIPE_SECRET_KEY</code> and{' '}
          <code className="font-mono text-xs">STRIPE_WEBHOOK_SECRET</code> to switch the billing half on.
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Try it</h2>
        <ol className="mt-4 space-y-2 text-sm text-slate-600">
          <li>1. Create an account below, open its referral page and copy the link.</li>
          <li>2. Open that link in a private window and sign up as somebody else.</li>
          <li>3. Subscribe the second account, then look at the first one&rsquo;s discount.</li>
          <li>4. Cancel the second subscription and watch the discount come back off.</li>
        </ol>

        <div className="mt-6 flex flex-wrap gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Go to the dashboard
            </Link>
          ) : (
            <Link
              href="/signup"
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Create an account
            </Link>
          )}
          <Link
            href="/signup"
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Create another account
          </Link>
        </div>
      </section>

      <AccountSwitcher users={users} currentId={user?.id ?? null} />
    </main>
  );
}
