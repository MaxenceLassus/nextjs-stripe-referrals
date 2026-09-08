import 'dotenv/config';
import { reconcile } from '../src/referrals/reconcile';

/**
 * `pnpm referrals:reconcile [--dry-run]`
 *
 * Run this on a schedule. Hourly is plenty. It is the thing that makes a missed
 * webhook a delay instead of a wrong invoice.
 */
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const report = await reconcile({ dryRun });

  console.log(`refreshed from Stripe: ${report.refreshed}`);
  console.log(`referrers checked:     ${report.checked}`);
  console.log(`discounts ${dryRun ? 'that would be repaired' : 'repaired'}: ${report.repaired.length}`);

  for (const item of report.repaired) {
    console.log(`  ${item.userId}: ${item.from}% -> ${item.to}%`);
  }

  if (report.failures.length > 0) {
    console.log(`still failing: ${report.failures.length}`);
    for (const failure of report.failures) {
      console.log(`  ${failure.userId}: ${failure.error}`);
    }
  }

  // A non-zero exit so a cron that mails on failure actually mails.
  process.exit(report.failures.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
