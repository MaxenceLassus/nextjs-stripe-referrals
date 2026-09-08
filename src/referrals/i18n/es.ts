import type { ReferralCopy } from './types';

export const es: ReferralCopy = {
  title: 'Recomendaciones',
  subtitle:
    'Invita a las personas a las que este producto les sea útil. Cada recomendado que se convierte en cliente de pago reduce tu propia suscripción, mientras siga con nosotros.',

  summaryLabel: 'Tu descuento',
  activeCount: '{active} de {max} recomendados que pagan',
  noneYetHint: 'Tu primer recomendado que pague resta un {step}% de tu suscripción.',
  remainingHint: '{remaining} recomendados de pago más para alcanzar el descuento máximo.',
  remainingHintOne: '1 recomendado de pago más para alcanzar el descuento máximo.',
  maxedHint: 'Has alcanzado el descuento máximo. Gracias.',

  nextInvoice: 'Tu próxima factura',
  discountBadge: '{percent}% de descuento',
  recomputedHint:
    'Se recalcula en cada factura según los recomendados que estén pagando en ese momento. Un cambio se aplica a tu próxima factura, nunca de forma retroactiva.',
  noPlanHint:
    'Tu descuento te está esperando. Se aplicará a tu suscripción en cuanto tengas una.',
  freeHint:
    'Con un {percent}% de descuento, tu suscripción no te cuesta nada mientras estos recomendados sigan pagando.',
  driftWarning:
    'Estás generando un {earned}% pero tu suscripción lleva actualmente un {applied}%. Suele resolverse solo en menos de una hora.',
  stripeOffline:
    'La facturación no está conectada en esta instalación: las recomendaciones se registran pero todavía no se aplica ningún descuento.',

  linkLabel: 'Tu enlace de recomendación',
  copyCta: 'Copiar enlace',
  copiedCta: 'Copiado',
  shareHint: 'Cualquier persona que se registre con este enlace cuenta como recomendado tuyo.',

  listTitle: 'Personas que has recomendado',
  listTotal: '{count} en total',
  filterAll: 'Todos',
  filterActive: 'Pagando',
  filterTrialing: 'En prueba',
  filterPending: 'Sin suscripción',
  filterLapsed: 'Ha dejado de pagar',

  statusActive: 'Pagando',
  statusTrialing: 'En prueba',
  statusPending: 'Sin suscripción',
  statusLapsed: 'Ha dejado de pagar',

  joinedOn: 'Se registró el {date}',
  countsHint:
    'Solo cuentan para tu descuento los recomendados que están pagando ahora mismo. Una prueba todavía no ha pagado, y un pago fallido deja de contar hasta que se regularice.',

  emptyTitle: 'Todavía no hay recomendados',
  emptyText: 'Comparte tu enlace: quienes se registren con él aparecerán aquí.',
  emptyFiltered: 'Ningún recomendado con este estado.',

  howTitle: 'Cómo funciona',
  howStepShare: 'Comparte tu enlace.',
  howStepPay: 'Cada recomendado que se convierta en cliente de pago resta un {step}% de tu suscripción, hasta el {max}%.',
  howStepStop: 'Si alguno deja de pagar, su parte sale de tu descuento a partir de tu próxima factura.',
};
