import type { ReferralCopy } from './types';

export const fr: ReferralCopy = {
  title: 'Parrainage',
  subtitle:
    'Invitez les personnes à qui ce produit sera utile. Chaque filleul qui devient client payant fait baisser votre propre abonnement, aussi longtemps qu’il reste.',

  summaryLabel: 'Votre réduction',
  activeCount: '{active} filleuls payants sur {max}',
  noneYetHint: 'Votre premier filleul payant retire {step}% de votre abonnement.',
  remainingHint: 'Encore {remaining} filleuls payants pour atteindre la réduction maximale.',
  remainingHintOne: 'Encore 1 filleul payant pour atteindre la réduction maximale.',
  maxedHint: 'Vous avez atteint la réduction maximale. Merci.',

  nextInvoice: 'Votre prochaine facture',
  discountBadge: '{percent}% de remise',
  recomputedHint:
    'Recalculée à chaque facture, selon les filleuls qui payent à ce moment-là. Un changement s’applique à votre prochaine facture, jamais rétroactivement.',
  noPlanHint:
    'Votre réduction vous attend. Elle s’appliquera à votre abonnement dès que vous en aurez un.',
  freeHint:
    'À {percent}% de remise, votre abonnement ne vous coûte rien tant que ces filleuls continuent de payer.',
  driftWarning:
    'Vous gagnez {earned}% mais votre abonnement porte actuellement {applied}%. Cela se règle en général tout seul dans l’heure.',
  stripeOffline:
    'La facturation n’est pas connectée sur ce déploiement : les parrainages sont enregistrés mais aucune remise n’est encore appliquée.',

  linkLabel: 'Votre lien de parrainage',
  copyCta: 'Copier le lien',
  copiedCta: 'Copié',
  shareHint: 'Toute personne qui s’inscrit par ce lien est comptée comme votre filleul.',

  listTitle: 'Vos filleuls',
  listTotal: '{count} au total',
  filterAll: 'Tous',
  filterActive: 'Payant',
  filterTrialing: 'En essai',
  filterPending: 'Sans abonnement',
  filterLapsed: 'Arrêté',

  statusActive: 'Payant',
  statusTrialing: 'En essai',
  statusPending: 'Sans abonnement',
  statusLapsed: 'Arrêté',

  joinedOn: 'Inscrit le {date}',
  countsHint:
    'Seuls les filleuls qui payent actuellement comptent dans votre réduction. Un essai n’a encore rien payé, et un défaut de paiement cesse de compter jusqu’à sa régularisation.',

  emptyTitle: 'Aucun filleul pour l’instant',
  emptyText: 'Partagez votre lien : les personnes qui s’inscrivent par ce lien apparaîtront ici.',
  emptyFiltered: 'Aucun filleul avec ce statut.',

  howTitle: 'Comment ça marche',
  howStepShare: 'Partagez votre lien.',
  howStepPay: 'Chaque filleul qui devient client payant retire {step}% de votre abonnement, jusqu’à {max}%.',
  howStepStop: 'Si l’un d’eux cesse de payer, sa part quitte votre réduction dès la facture suivante.',
};
