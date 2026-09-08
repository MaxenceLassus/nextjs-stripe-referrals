import type { ReferralCopy } from './types';

export const it: ReferralCopy = {
  title: 'Inviti',
  subtitle:
    'Invita le persone a cui questo prodotto sarà utile. Ogni invitato che diventa cliente pagante riduce il tuo abbonamento, per tutto il tempo in cui resta.',

  summaryLabel: 'Il tuo sconto',
  activeCount: '{active} invitati paganti su {max}',
  noneYetHint: 'Il tuo primo invitato pagante toglie il {step}% dal tuo abbonamento.',
  remainingHint: 'Ancora {remaining} invitati paganti per raggiungere lo sconto massimo.',
  remainingHintOne: 'Ancora 1 invitato pagante per raggiungere lo sconto massimo.',
  maxedHint: 'Hai raggiunto lo sconto massimo. Grazie.',

  nextInvoice: 'La tua prossima fattura',
  discountBadge: '{percent}% di sconto',
  recomputedHint:
    'Ricalcolato a ogni fattura, in base agli invitati che stanno pagando in quel momento. Una variazione si applica alla fattura successiva, mai retroattivamente.',
  noPlanHint:
    'Il tuo sconto ti aspetta. Si applicherà al tuo abbonamento non appena ne avrai uno.',
  freeHint:
    'Con il {percent}% di sconto, il tuo abbonamento non ti costa nulla finché questi invitati continuano a pagare.',
  driftWarning:
    'Stai maturando il {earned}% ma il tuo abbonamento riporta attualmente il {applied}%. Di solito si sistema da solo entro un’ora.',
  stripeOffline:
    'La fatturazione non è collegata in questa installazione: gli inviti vengono registrati ma nessuno sconto è ancora applicato.',

  linkLabel: 'Il tuo link di invito',
  copyCta: 'Copia il link',
  copiedCta: 'Copiato',
  shareHint: 'Chiunque si registri tramite questo link viene conteggiato come tuo invitato.',

  listTitle: 'Le persone che hai invitato',
  listTotal: '{count} in totale',
  filterAll: 'Tutti',
  filterActive: 'Pagante',
  filterTrialing: 'In prova',
  filterPending: 'Senza abbonamento',
  filterLapsed: 'Interrotto',

  statusActive: 'Pagante',
  statusTrialing: 'In prova',
  statusPending: 'Senza abbonamento',
  statusLapsed: 'Interrotto',

  joinedOn: 'Registrato il {date}',
  countsHint:
    'Solo gli invitati che stanno pagando contano per il tuo sconto. Una prova non ha ancora pagato, e un pagamento non riuscito smette di contare finché non viene regolarizzato.',

  emptyTitle: 'Ancora nessun invitato',
  emptyText: 'Condividi il tuo link: chi si registra tramite quel link comparirà qui.',
  emptyFiltered: 'Nessun invitato con questo stato.',

  howTitle: 'Come funziona',
  howStepShare: 'Condividi il tuo link.',
  howStepPay: 'Ogni invitato che diventa cliente pagante toglie il {step}% dal tuo abbonamento, fino al {max}%.',
  howStepStop: 'Se uno di loro smette di pagare, la sua quota lascia il tuo sconto dalla fattura successiva.',
};
