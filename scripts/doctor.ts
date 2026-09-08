import 'dotenv/config';
import { config, stripeEnabled } from '../src/referrals/config';
import { stripe } from '../src/referrals/stripe/client';
import { couponIdFor } from '../src/referrals/rules';
import { db } from '../src/referrals/db';

/**
 * `pnpm referrals:doctor`
 *
 * Answers "is this deployment actually going to apply discounts?" from the
 * server, which is the only place the answer exists. Every failure this checks
 * for is invisible from a browser: a missing webhook secret, a key pointing at
 * the wrong Stripe account, a coupon id colliding with something hand-made in
 * the dashboard. All of them look, from the outside, exactly like a program
 * where nobody has referred anybody yet.
 */
async function main(): Promise<void> {
  let failures = 0;
  const ok = (message: string) => console.log(`  ok    ${message}`);
  const bad = (message: string) => {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  };
  const note = (message: string) => console.log(`        ${message}`);

  console.log('\nConfiguration');
  ok(`app url: ${config.APP_URL}`);
  ok(
    `tiers: ${config.REFERRAL_PERCENT_STEP}% x ${config.REFERRAL_MAX_REFERRALS} = ` +
      `${config.REFERRAL_PERCENT_STEP * config.REFERRAL_MAX_REFERRALS}% maximum`,
  );
  console.log(
    `  ${config.REFERRAL_COUNT_TRIALING ? 'WARN  trials count towards the discount' : 'ok    trials do not count'}`,
  );
  if (config.REFERRAL_COUNT_TRIALING) {
    note('Anyone can start trials without paying. Read the README abuse section.');
  }

  console.log('\nDatabase');
  try {
    const [codes, referrals, customers] = await Promise.all([
      db.referralCode.count(),
      db.referral.count(),
      db.referralCustomer.count(),
    ]);
    ok(`reachable: ${codes} codes, ${referrals} referrals, ${customers} mirrored customers`);
  } catch (error) {
    bad(`unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\nStripe');
  if (!config.STRIPE_SECRET_KEY) {
    bad('STRIPE_SECRET_KEY is not set: no discount can ever be applied.');
  } else if (!config.STRIPE_WEBHOOK_SECRET) {
    bad(
      'STRIPE_WEBHOOK_SECRET is not set: the endpoint rejects everything, so nothing will ever ' +
        'tell this app that a referral started or stopped paying.',
    );
  } else {
    try {
      const account = await stripe().accounts.retrieve();
      ok(`key works: account ${account.id}${account.settings?.dashboard?.display_name ? ` (${account.settings.dashboard.display_name})` : ''}`);
      ok(`mode: ${config.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE' : 'test'}`);
    } catch (error) {
      bad(`key rejected: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (stripeEnabled) {
    console.log('\nCoupons');
    for (let tier = 1; tier <= config.REFERRAL_MAX_REFERRALS; tier += 1) {
      const percent = tier * config.REFERRAL_PERCENT_STEP;
      const id = couponIdFor(percent);
      try {
        const coupon = await stripe().coupons.retrieve(id);
        if (coupon.percent_off !== percent) {
          bad(`${id} exists but is ${coupon.percent_off}% off, not ${percent}%.`);
        } else if (coupon.duration !== 'forever') {
          bad(`${id} has duration "${coupon.duration}", not "forever".`);
          note('A `once` coupon falls off after one invoice and the discount silently stops.');
        } else {
          ok(`${id}: ${percent}% off, forever`);
        }
      } catch {
        ok(`${id}: not created yet (it is created the first time a referrer earns it)`);
      }
    }
  }

  console.log(
    failures === 0
      ? '\nAll good.\n'
      : `\n${failures} problem(s) above. Discounts will not work correctly until they are fixed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
