import 'dotenv/config';
import { db } from '../src/referrals/db';
import { ensureReferralCode } from '../src/referrals/codes';
import { attachReferral, forgetUser } from '../src/referrals/attach';
import { countActiveReferrals, listReferrals, referralSummary } from '../src/referrals/queries';
import { discountPercent } from '../src/referrals/rules';
import type { ReferralSubscriptionStatus } from '@prisma/client';

/**
 * `pnpm referrals:verify-flow`
 *
 * Walks the whole program against a real database, with the Stripe half stubbed
 * out by writing the mirror directly — which is exactly what the webhook does
 * after reading the API.
 *
 * It exists because the unit tests mock Prisma, so they prove the rules and not
 * the queries. This proves the queries: that a referral really is counted, that
 * a failed payment really does stop counting it, and that the tier a referrer
 * sees is the tier the Stripe sync would write.
 */

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}

/** Stand in for the webhook: record what Stripe would have said. */
async function setBilling(userId: string, status: ReferralSubscriptionStatus): Promise<void> {
  await db.referralCustomer.upsert({
    where: { userId },
    create: {
      userId,
      status,
      stripeCustomerId: `cus_${userId}`,
      stripeSubscriptionId: `sub_${userId}`,
      syncedAt: new Date(),
    },
    update: { status, syncedAt: new Date() },
  });
}

async function main(): Promise<void> {
  const stamp = Date.now();
  const email = (name: string) => `${name}.${stamp}@verify.invalid`;

  const sarah = await db.user.create({ data: { email: email('sarah'), name: 'Sarah Bakery' } });
  const tom = await db.user.create({ data: { email: email('tom'), name: 'Tom Garage' } });
  const ana = await db.user.create({ data: { email: email('ana'), name: 'Ana Studio' } });
  const created = [sarah.id, tom.id, ana.id];

  try {
    console.log('\nCode minting');
    const code = await ensureReferralCode(sarah.id, sarah.name);
    check('code follows the account name', code.startsWith('SARAH-BAKERY-'), true);
    check('code is stable across calls', await ensureReferralCode(sarah.id, sarah.name), code);

    console.log('\nAttribution');
    check('a self-referral is refused', (await attachReferral(sarah.id, code)).attached, false);
    check('an unknown code is ignored', (await attachReferral(tom.id, 'NOPE-0000')).attached, false);
    check('a real code attributes the account', (await attachReferral(tom.id, code)).attached, true);
    check('a second attribution is refused', (await attachReferral(tom.id, code)).attached, false);
    await attachReferral(ana.id, code, { label: 'Ana Studio' });

    console.log('\nCounting');
    check('a signup that has not paid counts for nothing', await countActiveReferrals(sarah.id), 0);

    await setBilling(tom.id, 'TRIALING');
    check('a trial counts for nothing', await countActiveReferrals(sarah.id), 0);

    await setBilling(tom.id, 'ACTIVE');
    check('a paying referral counts', await countActiveReferrals(sarah.id), 1);

    await setBilling(ana.id, 'ACTIVE');
    check('two paying referrals count', await countActiveReferrals(sarah.id), 2);
    check('the tier follows the count', discountPercent(await countActiveReferrals(sarah.id)), 40);

    console.log('\nPayment failure');
    await setBilling(tom.id, 'PAST_DUE');
    check('a failed payment stops counting immediately', await countActiveReferrals(sarah.id), 1);
    check('the tier drops with it', discountPercent(await countActiveReferrals(sarah.id)), 20);

    await setBilling(tom.id, 'ACTIVE');
    check('a recovered payment counts again', await countActiveReferrals(sarah.id), 2);

    console.log('\nCancellation');
    await setBilling(ana.id, 'CANCELED');
    check('a cancellation stops counting', await countActiveReferrals(sarah.id), 1);

    console.log('\nWhat the referrer sees');
    const rows = await listReferrals(sarah.id);
    check('both referrals are listed', rows.length, 2);
    check('the paying one reads as paying', rows.find((r) => r.label === 'Tom Garage')?.status ?? rows[0]?.status, 'active');
    check('the cancelled one reads as stopped', rows.find((r) => r.label === 'Ana Studio')?.status, 'lapsed');
    check('only the paying one counts', rows.filter((r) => r.counts).length, 1);

    const summary = await referralSummary(sarah.id);
    check('the summary agrees with the count', summary.activeCount, 1);
    check('the summary agrees with the tier', summary.percent, 20);

    console.log('\nRetroactive attribution');
    const established = await db.user.create({ data: { email: email('established') } });
    created.push(established.id);
    await setBilling(established.id, 'ACTIVE');
    const retro = await attachReferral(established.id, code);
    check(
      'an existing customer cannot be credited after the fact',
      retro.attached ? 'attached' : retro.reason,
      'already_customer',
    );

    console.log('\nDeletion');
    await forgetUser(ana.id);
    check('a deleted referral leaves the program', (await listReferrals(sarah.id)).length, 1);
    check('the referrer keeps what is still real', await countActiveReferrals(sarah.id), 1);
  } finally {
    for (const id of created) await forgetUser(id).catch(() => undefined);
    await db.user.deleteMany({ where: { id: { in: created } } });
  }

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
