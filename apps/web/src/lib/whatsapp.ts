import { formatCurrency, type GroupAccount } from './api';

/**
 * WhatsApp is where groups talk, and the one channel that reaches players who never turned on
 * notifications (or were added by hand and have never opened the app). Everything the app sends
 * there is worded here, so the messages read the same wherever they're sent from.
 */

/**
 * A number as WhatsApp wants it: digits with the country code. Nigerian numbers come in every
 * shape ("0803 123 4567", "803 123 4567", "+234 803 123 4567", "+234 0803 123 4567"): all of
 * them read "2348031234567". A number from elsewhere keeps its own code when it starts with +.
 * Anything too short to be a phone number is null (no link rather than a broken one).
 */
export function whatsappNumber(phone?: string | null) {
  const raw = (phone ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('2340') && digits.length === 14) return `234${digits.slice(4)}`;
  if (digits.startsWith('234') && digits.length === 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (/^[789]\d{9}$/.test(digits)) return `234${digits}`;
  if (raw.startsWith('+') && digits.length >= 8) return digits;
  if (digits.startsWith('00') && digits.length >= 10) return digits.slice(2);
  return null;
}

/** "+234 803 123 4567": a number written the same way everywhere, or the number as typed if it isn't one we know. */
export function prettyPhone(phone?: string | null) {
  const n = whatsappNumber(phone);
  if (!n) return phone?.trim() || '';
  if (n.startsWith('234') && n.length === 13) return `+234 ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;
  return `+${n}`;
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

/** A game's link for the group chat the day before: the first call, or the last one. */
export function groupInviteMessage(g: Parameters<typeof gameInviteMessage>[0] & { last?: boolean }) {
  const left = g.places ? g.places - g.inCount : null;
  if (!g.last) return gameInviteMessage(g);
  return [
    `⏰ Last call for ${g.when.split(' · ')[0]}`,
    `⚽ ${g.groupName} · ${g.when}${g.where ? ` at ${g.where}` : ''}`,
    left === null
      ? `${g.inCount} in so far.`
      : left > 0
        ? `${g.inCount} of ${g.places} in, ${left} place${left === 1 ? '' : 's'} left.`
        : `Full (${g.places} of ${g.places}). Say you're in to go on the waiting list.`,
    `Say you're in here: ${g.link}`,
  ].join('\n');
}

/** The vote link for the group chat: at full time, or as the last call before it closes. */
export function groupVoteMessage(v: { groupName: string; link: string; ballots: number; squadSize: number; closes?: string | null; closing?: boolean }) {
  if (v.closing) {
    return [
      `⏳ Voting closes${v.closes ? ` ${v.closes}` : ' soon'}. ${v.ballots} of ${v.squadSize} have voted.`,
      `${v.groupName}: pick Player of the Match and your Best VII (about a minute):`,
      v.link,
    ].join('\n');
  }
  return [
    `🏆 Full time, ${v.groupName}!`,
    `Vote for Player of the Match and your Best VII (about a minute):`,
    v.link,
    v.closes ? `Voting closes ${v.closes}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
