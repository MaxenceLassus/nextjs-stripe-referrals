import 'dotenv/config';
import { db } from '../src/referrals/db';
import { ensureReferralCode } from '../src/referrals/codes';

/** A couple of accounts so the demo has something to click on. */
async function main(): Promise<void> {
  const sarah = await db.user.upsert({
    where: { email: 'sarah@example.com' },
    create: { email: 'sarah@example.com', name: "Sarah's Bakery", locale: 'en' },
    update: {},
  });

  await db.user.upsert({
    where: { email: 'tom@example.com' },
    create: { email: 'tom@example.com', name: 'Tom Garage', locale: 'fr' },
    update: {},
  });

  const code = await ensureReferralCode(sarah.id, sarah.name);
  console.log(`Seeded. Sarah's referral code: ${code}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
