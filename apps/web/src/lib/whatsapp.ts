import { formatCurrency, type GroupAccount } from './api';

/**
 * WhatsApp is where groups talk, and the one channel that reaches players who never turned on
 * notifications (or were added by hand and have never opened the app). Everything the app sends
 * there is worded here, so the messages read the same wherever they're sent from.
 */

/** A Nigerian number as WhatsApp wants it: digits with the country code ("0803 123 4567" → "2348031234567"). */
export function whatsappNumber(phone?: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  return digits.length >= 10 ? digits : null;
}

/** Opens WhatsApp with the message ready: to that person when we have their number, else to pick a chat. */
export function openWhatsApp(text: string, phone?: string | null) {
  const to = whatsappNumber(phone);
  window.open(`https://wa.me/${to ?? ''}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

/** Everything one player needs to pay: who to pay, how much, for what, and the code that matches it to them. */
export function paymentDetailsMessage(p: {
  firstName: string;
  groupName: string;
  account: GroupAccount;
  code?: string | null;
  amount?: number;
  /** "Sat 24 Oct": what it's for. */
  forWhat?: string;
}) {
  return [
    `Hi ${p.firstName} 👋 ${p.groupName}${p.forWhat ? ` · ${p.forWhat}` : ''}`,
    p.amount ? `${formatCurrency(p.amount)} to pay, by transfer to:` : 'Pay by transfer to:',
    `${p.account.bankName}`,
    `${p.account.accountNumber}`,
    `${p.account.accountName}`,
    p.code ? `Put your payment code ${p.code} in the transfer description, so it's matched to you straight away.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** A game to share in the group chat: when, where, how full, and the link to say you're in. */
export function gameInviteMessage(g: {
  groupName: string;
  /** "Sat 24 Oct · 8am". */
  when: string;
  where?: string | null;
  inCount: number;
  places?: number;
  link: string;
}) {
  const left = g.places ? g.places - g.inCount : 0;
  return [
    `⚽ ${g.groupName} · ${g.when}${g.where ? ` at ${g.where}` : ''}`,
    g.places ? `${g.inCount} of ${g.places} in${left > 0 ? `, ${left} place${left === 1 ? '' : 's'} left` : ', full'}.` : `${g.inCount} in so far.`,
    `Say you're in here: ${g.link}`,
  ].join('\n');
}
