import type { ReferralCopy } from './types';

export const en: ReferralCopy = {
  title: 'Referrals',
  subtitle:
    'Invite people you think would get value from this. Every referral who becomes a paying customer takes a slice off your own subscription, for as long as they stay.',

  summaryLabel: 'Your discount',
  activeCount: '{active} of {max} paying referrals',
  noneYetHint: 'Your first paying referral takes {step}% off your subscription.',
  remainingHint: '{remaining} more paying referrals to reach the maximum discount.',
  remainingHintOne: '1 more paying referral to reach the maximum discount.',
  maxedHint: 'You have reached the maximum discount. Thank you.',

  nextInvoice: 'Your next invoice',
  discountBadge: '{percent}% off',
  recomputedHint:
    'Recalculated on every invoice from the referrals paying at that moment. A change applies to your next invoice, never retroactively.',
  noPlanHint:
    'Your discount is waiting for you. It applies to your subscription as soon as you have one.',
  freeHint:
    'At {percent}% off, your subscription costs nothing while these referrals keep paying.',
  driftWarning:
    'We are earning you {earned}% but your subscription currently carries {applied}%. This usually settles by itself within the hour.',
  stripeOffline:
    'Billing is not connected on this deployment, so referrals are being recorded but no discount is applied yet.',

  linkLabel: 'Your referral link',
  copyCta: 'Copy link',
  copiedCta: 'Copied',
  shareHint: 'Anyone who signs up through this link is counted as your referral.',

  listTitle: 'People you referred',
  listTotal: '{count} total',
  filterAll: 'All',
  filterActive: 'Paying',
  filterTrialing: 'On trial',
  filterPending: 'Not subscribed',
  filterLapsed: 'Stopped',

  statusActive: 'Paying',
  statusTrialing: 'On trial',
  statusPending: 'Not subscribed',
  statusLapsed: 'Stopped',

  joinedOn: 'Joined {date}',
  countsHint:
    'Only referrals who are currently paying count towards your discount. A trial has not paid yet, and a missed payment stops counting until it clears.',

  emptyTitle: 'No referrals yet',
  emptyText: 'Share your link and the people who sign up through it will appear here.',
  emptyFiltered: 'No referral with this status.',

  howTitle: 'How it works',
  howStepShare: 'Share your link.',
  howStepPay: 'Each referral who becomes a paying customer takes {step}% off your subscription, up to {max}%.',
  howStepStop: 'If one of them stops paying, that share comes off your discount from your next invoice.',
};
