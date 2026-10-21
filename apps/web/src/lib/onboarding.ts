/*
 * What the onboarding says, the "Did you know?" tips and the tips on loading screens. Every line
 * here is checked against what the app and server really do (money most of all): change the
 * product, change these words.
 *
 * Remembered per phone (localStorage): whether someone has seen their walkthrough, which tips
 * they've seen and when the last one showed. Blocked storage just means "not remembered".
 */

export type Side = 'organiser' | 'player';
export type SceneKey = 'welcome' | 'kit' | 'bank' | 'invite' | 'ticket' | 'matchday' | 'vote' | 'card' | 'payout';

export interface TourStep {
  scene: SceneKey;
  eyebrow: string;
  title: string;
  /** Two or three short lines, said plainly. */
  lines: string[];
}

export const TOURS: Record<Side, TourStep[]> = {
  organiser: [
    {
      scene: 'welcome',
      eyebrow: 'Welcome to PitchAside',
      title: 'Run your 5-a-side without the chasing',
      lines: ['Who’s in, who’s paid and who won, all in one place.', 'Here’s how a week goes, up to match day.'],
    },
    {
      scene: 'kit',
      eyebrow: 'Step 1 · Your group',
      title: 'Start with a group',
      lines: [
        'Name it, set the price per player and how often they pay: each game, or weekly, monthly, quarterly or yearly dues.',
        'Pick your bibs and how long each game lasts. You can change any of it later.',
      ],
    },
    {
      scene: 'bank',
      eyebrow: 'Step 2 · Money',
      title: 'Your group gets its own account',
      lines: [
        'Open it on the Money page with your BVN. Players then send their money there by bank transfer.',
        'Each player puts their payment code in the transfer description, so they’re marked paid by themselves.',
        'Money with no name waits for you to say who sent it. Extra money waits for you too: nothing is spent without you.',
      ],
    },
    {
      scene: 'invite',
      eyebrow: 'Step 3 · Players',
      title: 'Bring your players in',
      lines: [
        'Share the group link on WhatsApp, or let players scan the QR code at the pitch.',
        'Each player gets their own payment code. You can also add players yourself, even ones without the app.',
      ],
    },
    {
      scene: 'ticket',
      eyebrow: 'Step 4 · Games',
      title: 'Put games on the calendar',
      lines: [
        'Add a game, or repeat it every week. Players tap “I’m in”; when it’s full, the rest wait on a waitlist.',
        'Reminders go out the evening before and 2 hours before kick-off. Tap Remind to nudge who still owes.',
      ],
    },
    {
      scene: 'matchday',
      eyebrow: 'Step 5 · Match day',
      title: 'Match day in four steps',
      lines: [
        'Players, Teams, Scores, Full time. Make fair teams in one tap and run the timer.',
        'Add each score and who scored. The day’s captains can keep score from their own phones.',
      ],
    },
    {
      scene: 'vote',
      eyebrow: 'Step 6 · Full time',
      title: 'End the game, open the vote',
      lines: [
        'Untick anyone who didn’t show: they won’t owe anything.',
        'Players who came get a vote link for 36 hours: Player of the Match, Best VII and awards. The table updates.',
      ],
    },
    {
      scene: 'payout',
      eyebrow: 'Step 7 · Pay the pitch',
      title: 'Pay out from the app',
      lines: ['Set a 4-digit PIN, save the pitch owner once, then send.', 'Collecting is free. Each withdrawal costs ₦350.'],
    },
  ],
  player: [
    {
      scene: 'welcome',
      eyebrow: 'Welcome to PitchAside',
      title: 'You’re on the team sheet',
      lines: ['Your games, what you owe, your player card and the table, all here.', 'Here’s how it works, up to match day.'],
    },
    {
      scene: 'ticket',
      eyebrow: 'Step 1 · Games',
      title: 'Say you’re in',
      lines: ['Tap “I’m in” on the next game on Home or Games.', 'Full? You join the waitlist and move up by yourself when a place frees.'],
    },
    {
      scene: 'bank',
      eyebrow: 'Step 2 · Paying',
      title: 'Pay with your code',
      lines: [
        'On the Pay tab, transfer to your group’s account and put your payment code in the description.',
        'That’s how you’re marked paid by yourself. Paid too much? It waits with your organiser; it isn’t spent without them.',
      ],
    },
    {
      scene: 'matchday',
      eyebrow: 'Step 3 · Match day',
      title: 'On the day',
      lines: ['Pick the bib you’re in and follow the scores and timer live.', 'Captain today? You can keep the score from your phone.'],
    },
    {
      scene: 'vote',
      eyebrow: 'Step 4 · Full time',
      title: 'Vote after the game',
      lines: ['When the game ends you get a vote link, open for 36 hours.', 'Pick Player of the Match and your Best VII. You can’t pick yourself.'],
    },
    {
      scene: 'card',
      eyebrow: 'Step 5 · Your card',
      title: 'Make your card yours',
      lines: ['Add your photo and nickname on the Me tab. They show on the table, team sheets and the vote.', 'Your rating grows with results, stats and teammates’ votes.'],
    },
  ],
};

/** Where the last step of each walkthrough takes people. */
export const TOUR_END: Record<Side, { label: string; href: string }> = {
  organiser: { label: 'Create my group', href: '/groups/new' },
  player: { label: 'Add my photo', href: '/me/profile' },
};

/** What a page knows that makes a tip worth showing now. */
export interface TipContext {
  /** Organiser: players still to pay for the next or live game. */
  owing?: number;
  /** Organiser: transfers with no name yet. */
  unnamed?: number;
  /** Organiser: the group has no bank account yet. */
  noAccount?: boolean;
  /** A vote is open (organiser: for their game; player: one they haven't voted in). */
  voteOpen?: boolean;
  /** Player: they owe money now. */
  owes?: boolean;
  /** Player: no photo on their card yet. */
  noPhoto?: boolean;
}

export interface Tip {
  id: string;
  side: Side | 'both';
  scene: SceneKey;
  /** "Did you know…" question, short. */
  q: string;
  a: string;
  action?: { label: string; href: string };
  /** Only when this is true for the page; no `when` means it's always fair to show. */
  when?: (c: TipContext) => boolean;
}

export const TIPS: Tip[] = [
  // Organisers, when it matters now
  {
    id: 'o-remind',
    side: 'organiser',
    scene: 'ticket',
    q: 'Did you know you can remind everyone who owes in one tap?',
    a: 'Open the game and tap Remind. Each player is asked for what they still owe.',
    action: { label: 'Open games', href: '/sessions' },
    when: (c) => (c.owing ?? 0) > 0,
  },
  {
    id: 'o-unnamed',
    side: 'organiser',
    scene: 'bank',
    q: 'Money came in with no name?',
    a: 'Tap it on Money and pick who sent it. Their due clears straight away.',
    action: { label: 'Open Money', href: '/money' },
    when: (c) => (c.unnamed ?? 0) > 0,
  },
  {
    id: 'o-account',
    side: 'organiser',
    scene: 'bank',
    q: 'Did you know players can pay without you chasing them?',
    a: 'Open your group’s account on the Money page with your BVN. Transfers with a payment code mark players paid by themselves.',
    action: { label: 'Open Money', href: '/money' },
    when: (c) => !!c.noAccount,
  },
  {
    id: 'o-vote',
    side: 'organiser',
    scene: 'vote',
    q: 'Did you know the vote closes early?',
    a: 'Once everyone who came has voted, it closes and the winners show. You can nudge who hasn’t voted from the game.',
    when: (c) => !!c.voteOpen,
  },
  // Organisers, any time
  {
    id: 'o-captains',
    side: 'organiser',
    scene: 'matchday',
    q: 'Did you know captains can keep the score?',
    a: 'Make someone captain on the Teams step. On match day they add each score and who scored from their own phone.',
  },
  {
    id: 'o-fair',
    side: 'organiser',
    scene: 'kit',
    q: 'Did you know PitchAside can pick fair teams?',
    a: 'On the Teams step, tap “Make fair teams”. It balances the sides by rating and keeps captains on their side.',
  },
  {
    id: 'o-qr',
    side: 'organiser',
    scene: 'invite',
    q: 'Did you know players can scan to join?',
    a: 'Open Invite and show the QR code. Players standing next to you scan it and join the group.',
  },
  {
    id: 'o-noshow',
    side: 'organiser',
    scene: 'ticket',
    q: 'Someone said they were in and didn’t show?',
    a: 'At full time, untick them in “Who came?”. They won’t owe anything for that game.',
  },
  {
    id: 'o-payout',
    side: 'organiser',
    scene: 'payout',
    q: 'Did you know you can pay the pitch from PitchAside?',
    a: 'Set a PIN, save the pitch owner once, and send from Money. Each withdrawal costs ₦350.',
  },
  {
    id: 'o-share',
    side: 'organiser',
    scene: 'vote',
    q: 'Did you know you can share the table?',
    a: 'Tap the share icon on Squad › Table to send it to WhatsApp as an image.',
  },
  // Players, when it matters now
  {
    id: 'p-code',
    side: 'player',
    scene: 'bank',
    q: 'Did you know your payment code marks you paid?',
    a: 'Put it in the transfer description when you pay. It’s on the Pay tab, under your group’s account number.',
    action: { label: 'Open Pay', href: '/me/pay' },
    when: (c) => !!c.owes,
  },
  {
    id: 'p-vote',
    side: 'player',
    scene: 'vote',
    q: 'Did you know your vote picks Player of the Match?',
    a: 'Only players who came can vote, for 36 hours after full time. It takes about a minute.',
    when: (c) => !!c.voteOpen,
  },
  {
    id: 'p-photo',
    side: 'player',
    scene: 'card',
    q: 'Did you know your face can be on the team sheet?',
    a: 'Add a photo and nickname on the Me tab. They show on the table, the teams and the vote.',
    action: { label: 'Add my photo', href: '/me/profile' },
    when: (c) => !!c.noPhoto,
  },
  // Players, any time
  {
    id: 'p-waitlist',
    side: 'player',
    scene: 'ticket',
    q: 'Game full?',
    a: 'Join the waitlist. When someone drops out, the first person waiting gets the place by themselves.',
  },
  {
    id: 'p-live',
    side: 'player',
    scene: 'matchday',
    q: 'Did you know you can follow the score live?',
    a: 'On match day, your game card shows the timer, the scores and who scored as they’re added.',
  },
  {
    id: 'p-card',
    side: 'player',
    scene: 'card',
    q: 'Did you know you can share your player card?',
    a: 'Tap the share icon on your card on the Me tab to send it to WhatsApp as an image.',
  },
  {
    id: 'p-extra',
    side: 'player',
    scene: 'bank',
    q: 'Paid too much by mistake?',
    a: 'The extra waits with your organiser. They keep it for a later game, pass it on or send it back; it isn’t spent without them.',
  },
];

/** Tips that make sense for anyone, any time: for loading screens. */
export function loadingTips(side: Side | null) {
  return TIPS.filter((t) => !t.when && (!side || t.side === side || t.side === 'both'));
}

// ── Memory (this phone) ──

const KEY_TOUR = (side: Side) => `pa_tour_seen_${side}`;
const KEY_TIPS = 'pa_tips_seen';
const KEY_LAST = 'pa_tip_last';
const KEY_NOW = 'pa_tip_now';
/** At most one "Did you know?" every this many days. */
const TIP_GAP_DAYS = 3;

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered: fine.
  }
}

export const tourSeen = (side: Side) => !!read(KEY_TOUR(side));
export const markTourSeen = (side: Side) => write(KEY_TOUR(side), String(Date.now()));

function seenTips(): string[] {
  try {
    return JSON.parse(read(KEY_TIPS) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * The tip to show on a home screen now, or null: one at most every few days, never in the first
 * day after the walkthrough, the ones that fit what's happening first, never the same one twice
 * until they've all been seen. One that's showing stays up for the day until put away; one that
 * was never put away still counts as shown, so it doesn't come back on every visit.
 */
export function pickTip(side: Side, context: TipContext, now = Date.now()): Tip | null {
  const last = Number(read(KEY_LAST) ?? 0);
  const mine = TIPS.filter((t) => t.side === side || t.side === 'both');
  const showing = mine.find((t) => t.id === read(KEY_NOW));
  if (showing && now - last < 86_400_000) return showing;
  if (now - last < TIP_GAP_DAYS * 86_400_000) return null;
  const tour = Number(read(KEY_TOUR(side)) ?? 0);
  if (tour && now - tour < 86_400_000) return null;
  let seen = new Set(seenTips());
  if (mine.every((t) => seen.has(t.id))) seen = new Set();
  const fresh = mine.filter((t) => !seen.has(t.id));
  const tip = fresh.find((t) => t.when?.(context)) ?? fresh.find((t) => !t.when) ?? null;
  if (tip) {
    write(KEY_NOW, tip.id);
    write(KEY_LAST, String(now));
  }
  return tip;
}

export function markTipSeen(id: string, now = Date.now()) {
  const seen = seenTips().filter((x) => x !== id);
  write(KEY_TIPS, JSON.stringify([...seen, id]));
  write(KEY_LAST, String(now));
  write(KEY_NOW, '');
}

/** Open someone's walkthrough from anywhere (a menu item); the host on that side listens. */
export const TOUR_EVENT = 'pitchaside:tour';
export function openTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}
