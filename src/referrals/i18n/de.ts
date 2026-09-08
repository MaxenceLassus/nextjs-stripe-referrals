import type { ReferralCopy } from './types';

export const de: ReferralCopy = {
  title: 'Empfehlungen',
  subtitle:
    'Laden Sie Menschen ein, denen dieses Produkt nützt. Jede Empfehlung, die zahlende Kundin oder zahlender Kunde wird, senkt Ihr eigenes Abonnement, solange sie bleibt.',

  summaryLabel: 'Ihr Rabatt',
  activeCount: '{active} von {max} zahlenden Empfehlungen',
  noneYetHint: 'Ihre erste zahlende Empfehlung senkt Ihr Abonnement um {step}%.',
  remainingHint: 'Noch {remaining} zahlende Empfehlungen bis zum maximalen Rabatt.',
  remainingHintOne: 'Noch 1 zahlende Empfehlung bis zum maximalen Rabatt.',
  maxedHint: 'Sie haben den maximalen Rabatt erreicht. Vielen Dank.',

  nextInvoice: 'Ihre nächste Rechnung',
  discountBadge: '{percent}% Rabatt',
  recomputedHint:
    'Wird bei jeder Rechnung neu berechnet, nach den Empfehlungen, die zu diesem Zeitpunkt zahlen. Eine Änderung gilt ab Ihrer nächsten Rechnung, nie rückwirkend.',
  noPlanHint:
    'Ihr Rabatt wartet auf Sie. Er gilt für Ihr Abonnement, sobald Sie eines haben.',
  freeHint:
    'Mit {percent}% Rabatt kostet Sie Ihr Abonnement nichts, solange diese Empfehlungen weiter zahlen.',
  driftWarning:
    'Sie verdienen {earned}%, Ihr Abonnement trägt derzeit aber {applied}%. Das klärt sich in der Regel innerhalb einer Stunde von selbst.',
  stripeOffline:
    'Die Abrechnung ist in dieser Installation nicht verbunden. Empfehlungen werden erfasst, ein Rabatt wird noch nicht angewendet.',

  linkLabel: 'Ihr Empfehlungslink',
  copyCta: 'Link kopieren',
  copiedCta: 'Kopiert',
  shareHint: 'Wer sich über diesen Link registriert, zählt als Ihre Empfehlung.',

  listTitle: 'Ihre Empfehlungen',
  listTotal: '{count} insgesamt',
  filterAll: 'Alle',
  filterActive: 'Zahlend',
  filterTrialing: 'Testphase',
  filterPending: 'Kein Abo',
  filterLapsed: 'Beendet',

  statusActive: 'Zahlend',
  statusTrialing: 'Testphase',
  statusPending: 'Kein Abo',
  statusLapsed: 'Beendet',

  joinedOn: 'Registriert am {date}',
  countsHint:
    'Nur Empfehlungen, die aktuell zahlen, zählen für Ihren Rabatt. Eine Testphase hat noch nichts gezahlt, und eine fehlgeschlagene Zahlung zählt bis zur Klärung nicht mehr.',

  emptyTitle: 'Noch keine Empfehlungen',
  emptyText: 'Teilen Sie Ihren Link. Wer sich darüber registriert, erscheint hier.',
  emptyFiltered: 'Keine Empfehlung mit diesem Status.',

  howTitle: 'So funktioniert es',
  howStepShare: 'Teilen Sie Ihren Link.',
  howStepPay: 'Jede Empfehlung, die zahlende Kundschaft wird, senkt Ihr Abonnement um {step}%, bis zu {max}%.',
  howStepStop: 'Hört eine davon auf zu zahlen, entfällt ihr Anteil ab Ihrer nächsten Rechnung.',
};
