import Link from 'next/link';
import { createAccount } from '@/demo/actions';
import { readReferralCookie } from '@/referrals/capture';
import { db } from '@/referrals/db';
import { REFERRAL_LOCALES } from '@/referrals/i18n';

export const dynamic = 'force-dynamic';

/**
 * The demo signup.
 *
 * Worth reading for one thing: the referral code is *shown* when there is one,
 * because a program that credits somebody invisibly is a program people
 * distrust when they later find out. It is read from the cookie the middleware
 * wrote, so it works whether the link landed here or on the home page a week ago.
 */
export default async function SignupPage() {
  const code = await readReferralCookie();

  const referrer = code
    ? await db.referralCode.findUnique({ where: { code }, select: { userId: true } })
    : null;
  const referrerUser = referrer
    ? await db.user.findUnique({ where: { id: referrer.userId }, select: { name: true, email: true } })
    : null;

  return (
    <main className="mx-auto max-w-md space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-2 text-sm text-slate-600">
          No password: this is a demo. The email only has to be unique.
        </p>
      </header>

      {code && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {referrerUser ? (
            <>
              You were invited by <strong>{referrerUser.name || referrerUser.email}</strong>. They
              will earn a discount once you become a paying customer.
            </>
          ) : (
            <>
              Referral code <code className="font-mono text-xs">{code}</code> is on this browser, but
              no account owns it. Signup carries on regardless and nobody is credited.
            </>
          )}
        </p>
      )}

      <form action={createAccount} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            placeholder="sarah@example.com"
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name <span className="font-normal text-slate-400">(shapes the referral code)</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            placeholder="Sarah's Bakery"
          />
        </div>

        <div>
          <label htmlFor="locale" className="block text-sm font-medium text-slate-700">
            Language
          </label>
          <select
            id="locale"
            name="locale"
            defaultValue="en"
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            {REFERRAL_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {locale.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Create account
        </button>
      </form>

      <Link href="/" className="block text-center text-sm text-slate-500 underline">
        Back
      </Link>
    </main>
  );
}
