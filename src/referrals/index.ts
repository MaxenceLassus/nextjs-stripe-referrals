/**
 * The module's public surface.
 *
 * Everything your app needs is here; anything not exported from this file is an
 * internal that may change. The integration is three calls — see the README.
 */

export { config as referralConfig, stripeEnabled } from './config';

export {
  discountPercent,
  discountedAmount,
  referralLink,
  referralCodeBase,
  couponIdFor,
  maxReferrals,
  maxPercent,
  percentStep,
} from './rules';

export { ensureReferralCode, resolveReferrer } from './codes';
export { attachReferral, forgetUser, type AttachResult } from './attach';

export {
  writeReferralCookie,
  readReferralCookie,
  clearReferralCookie,
  sanitizeReferralCode,
  REFERRAL_COOKIE_NAME,
} from './capture';
export { captureReferral } from './middleware';

export {
  countActiveReferrals,
  listReferrals,
  referralSummary,
  COUNTING_STATUSES,
  type ReferralRow,
  type ReferralRowStatus,
  type ReferralSummary,
} from './queries';

export { maskEmail, accountLabel } from './labels';

export { referralCheckoutOptions } from './stripe/checkout';
export { syncDiscountFor, syncAfterBillingChange, type SyncOutcome } from './stripe/discount';
export { refreshSubscriptionState } from './stripe/refresh';
export { linkCustomer, userIdForCustomer, mapStripeStatus } from './stripe/status';
export { ensureCoupon } from './stripe/coupons';

export { reconcile, type ReconcileReport, type ReconcileOptions } from './reconcile';

export { getReferralDictionary, REFERRAL_LOCALES, type ReferralLocale } from './i18n';

export { ReferralPage } from './ui/ReferralPage';
export { CopyLink } from './ui/CopyLink';
export { ReferralTable, type TableRow } from './ui/ReferralTable';
export { formatDate, formatMoney } from './ui/format';
