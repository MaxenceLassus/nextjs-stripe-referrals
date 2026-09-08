import { ensureReferralCode } from '../codes';
import { listReferrals, referralSummary } from '../queries';
import { referralLink, discountedAmount } from '../rules';
import { stripeEnabled } from '../config';
import { getReferralDictionary, fill, isReferralLocale, type ReferralLocale } from '../i18n';
import { formatDate, formatMoney } from './format';
import { CopyLink } from './CopyLink';
import { ReferralTable, type TableRow } from './ReferralTable';

/**
 * The whole referral page, as one server component.
 *
 * Drop it into a route of your own:
 *
 *   export default async function Page() {
 *     const user = await requireUser()
 *     return <ReferralPage userId={user.id} locale={user.locale} label={user.name} />
 *   }
 *
 * It takes a `userId` and never works out who is signed in, because it must
 * not: authentication is your app's, and a component that resolved the session
 * itself would be a component that could be mounted on a route where nobody
 * checked. Whoever's id you pass is whose referrals are shown.
 *
 * `price` is optional. Given one, the page can quote the actual next invoice,
 * which is the number people want; without it, the discount is shown as a
 * percentage and nothing is invented.
 */
export async function ReferralPage({
  userId,
  locale: rawLocale,
  label,
  price,
  signupPath,
}: {
  userId: string;
  locale?: string | null;
  /** Shapes the readable half of the code, e.g. "SARAH-9F3K". */
  label?: string | null;
  /** The account's list price, so the page can show what it will actually pay. */
  price?: { amount: number; currency: string } | null;
  /** Where referral links land. Defaults to `/signup`. */
  signupPath?: string;
}) {
  const locale: ReferralLocale = isReferralLocale(rawLocale?.toLowerCase().split('-')[0])
    ? (rawLocale!.toLowerCase().split('-')[0] as ReferralLocale)
    : 'en';
  const copy = getReferralDictionary(locale);

  const [code, referrals, summary] = await Promise.all([
    ensureReferralCode(userId, label),
    listReferrals(userId),
    referralSummary(userId),
  ]);

  const link = referralLink(code, signupPath);

  const rows: TableRow[] = referrals.map((referral) => ({
    id: referral.id,
    label: referral.label,
    meta: fill(copy.joinedOn, { date: formatDate(referral.joinedAt, locale) }),
    status: referral.status,
  }));

  // The struck-through pair is only honest for an account that actually has a
  // subscription to discount. One that has none is told its discount is waiting,
  // rather than being quoted a price it does not pay.
  const showPrice = Boolean(price && summary.hasSubscription);
  const discounted = price ? discountedAmount(price.amount, summary.percent) : null;

  const gaugeHint =
    summary.activeCount === 0
      ? fill(copy.noneYetHint, { step: summary.percentStep })
      : summary.remainingToMax === 0
        ? copy.maxedHint
        : summary.remainingToMax === 1
          ? copy.remainingHintOne
          : fill(copy.remainingHint, { remaining: summary.remainingToMax });

  // Shown only when it is true. What the referrals earn and what Stripe was
  // last told agree in every normal state; when they do not, saying so on the
  // page is what turns an invisible billing bug into a visible one.
  const drifted = stripeEnabled && summary.hasSubscription && summary.percent !== summary.appliedPercent;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{copy.title}</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600">{copy.subtitle}</p>
      </header>

      {!stripeEnabled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {copy.stripeOffline}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {copy.summaryLabel}
        </p>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-3xl font-semibold text-slate-900">
              {fill(copy.activeCount, {
                active: summary.activeCount,
                max: summary.maxReferrals,
              })}
            </p>
            <p className="mt-2 text-sm text-slate-600">{gaugeHint}</p>
          </div>

          {showPrice && price && discounted !== null && (
            <div className="text-right">
              <p className="text-sm text-slate-500">{copy.nextInvoice}</p>
              <p className="mt-1 flex items-baseline justify-end gap-2.5">
                {summary.percent > 0 && (
                  <span className="text-sm text-slate-400 line-through">
                    {formatMoney(price.amount, price.currency, locale)}
                  </span>
                )}
                <span className="text-3xl font-semibold text-slate-900">
                  {formatMoney(discounted, price.currency, locale)}
                </span>
                {summary.percent > 0 && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {fill(copy.discountBadge, { percent: summary.percent })}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <div aria-hidden className="mt-6 flex gap-2">
          {Array.from({ length: summary.maxReferrals }, (_, index) => (
            <span
              key={index}
              className={`h-2.5 flex-1 rounded-full ${
                index < summary.activeCount ? 'bg-brand-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <p className="mt-3 max-w-prose text-xs leading-relaxed text-slate-500">
          {!summary.hasSubscription
            ? copy.noPlanHint
            : summary.percent >= 100
              ? fill(copy.freeHint, { percent: summary.percent })
              : copy.recomputedHint}
        </p>

        {drifted && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {fill(copy.driftWarning, {
              earned: summary.percent,
              applied: summary.appliedPercent,
            })}
          </p>
        )}

        <div className="mt-6 border-t border-slate-100 pt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {copy.linkLabel}
          </p>
          <div className="mt-3">
            <CopyLink link={link} copyLabel={copy.copyCta} copiedLabel={copy.copiedCta} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{copy.shareHint}</p>
        </div>
      </section>

      <ReferralTable rows={rows} copy={copy} />

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{copy.howTitle}</h2>
        <ol className="mt-4 space-y-2.5 text-sm text-slate-600">
          {[
            copy.howStepShare,
            fill(copy.howStepPay, { step: summary.percentStep, max: summary.maxPercent }),
            copy.howStepStop,
          ].map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {index + 1}
              </span>
              <span className="max-w-prose">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
