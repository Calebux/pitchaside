'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { KeepHyphens } from '@/components/brand';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { JerseyBadge } from '@/components/illustrations';
import { GroupMoney } from '@/components/money/group-money';
import { NewSessionSheet } from '@/components/new-session-sheet';
import { frequencyLabel } from '@/lib/billing';
import { GroupSwitch } from '@/components/group-switch';
import { useCurrentGroup } from '@/lib/current-group';
import { GroupSquad } from '@/components/squad/group-squad';
import { GroupTable } from '@/components/squad/group-table';
import { AccountDetailsSheet, daysFromToday, gameDay, useGroupMoney } from '@/components/money-card';
import { InviteSheet } from '@/components/home/invite-sheet';
import { InviteIcon, ICON_PATHS, icon } from '@/components/home/quick-actions';
import { SheetTitle } from '@/components/home/sheet-title';
import { Sheet } from '@/components/sheet';
import { GamesBrowser } from '@/components/group/games-list';
import { GroupEditSheet, type GroupEditData } from '@/components/group/group-edit-sheet';
import { useAuth } from '@/lib/auth';
import {
  getGroup,
  getGroups,
  getSessionsPaginated,
  deleteGroup,
  updateGroup,
  formatCurrency,
  type IGroupWithMembers,
  type ISessionWithDetails,
} from '@/lib/api';
import { PaymentType, UserRole } from '@pitchaside/shared';

type Tab = 'members' | 'games' | 'table' | 'money';

/** Old links (?tab=sessions / transfers / payouts, e.g. Withdraw on the home) still land in the right place. */
function tabFromUrl(t: string | null): { tab: Tab; money: 'transfers' | 'payouts' } {
  if (t === 'sessions' || t === 'games') return { tab: 'games', money: 'transfers' };
  if (t === 'table') return { tab: 'table', money: 'transfers' };
  if (t === 'transfers' || t === 'money') return { tab: 'money', money: 'transfers' };
  if (t === 'payouts') return { tab: 'money', money: 'payouts' };
  return { tab: 'members', money: 'transfers' };
}

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [group, setGroup] = useState<IGroupWithMembers | null>(null);
  // For the group switch at the top; opening a group makes it the current one everywhere.
  const [allGroups, setAllGroups] = useState<IGroupWithMembers[]>([]);
  const { setGroupId: setCurrentGroup } = useCurrentGroup();
  useEffect(() => {
    setCurrentGroup(id);
    getGroups().then(setAllGroups).catch(() => setAllGroups([]));
  }, [id, setCurrentGroup]);
  const [sessions, setSessions] = useState<ISessionWithDetails[]>([]);
  // The API sends the newest games first, 20 at a time (100 at most per call); "Show older games" asks for more.
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => tabFromUrl(searchParams.get('tab')).tab);
  const [moneyView, setMoneyView] = useState<'transfers' | 'payouts'>(() => tabFromUrl(searchParams.get('tab')).money);
  const [wantEdit, setWantEdit] = useState(false);
  // Balance, account and transfers, kept fresh the same way as on the home.
  const money = useGroupMoney(id, null);
  const billing = money.billing;
  const [focusTransfer, setFocusTransfer] = useState<string | null>(searchParams.get('transfer'));
  const [showMenu, setShowMenu] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  // The tabs pin to the top once the page scrolls past them; this marks when they're pinned (for the shadow).
  const tabTopRef = useRef<HTMLDivElement>(null);
  const [tabsPinned, setTabsPinned] = useState(false);
  useEffect(() => {
    const el = tabTopRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setTabsPinned(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [loading]);


  // Create session state
  const [showCreateSession, setShowCreateSession] = useState(false);

  // Edit group state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<GroupEditData>({
    name: '',
    description: '',
    location: '',
    schedule: '',
    kickoffTime: '',
    targetPlayers: 10,
    feePerPlayer: 10,
    paymentType: PaymentType.PER_SESSION as string,
    requireRsvp: false,
    contributionsVisibility: 'private',
  });
  const [saving, setSaving] = useState(false);

  // Confirm dialog state
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'default';
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    Promise.all([getGroup(id), getSessionsPaginated(1, 20, id)])
      .then(([g, s]) => {
        setGroup(g);
        setSessions(s.data);
      })
      .catch(() => {
        toast.error('That group couldn’t be opened. It may have been deleted, or you’re offline.');
        router.replace('/groups');
      })
      .finally(() => setLoading(false));
    // Opened from the home's "Group settings": go straight to editing.
    if (searchParams.get('edit') === '1') setWantEdit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  // ?edit=1 waits for the group to load, then opens the edit form once.
  useEffect(() => {
    if (wantEdit && group) {
      setWantEdit(false);
      startEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantEdit, group]);

  async function refreshPayments() {
    const [s] = await Promise.all([getSessionsPaginated(1, 20, id), money.reload()]);
    setSessions(s.data);
  }

  /** Switch section; if the tabs have been scrolled under the top, bring the new section's start into view. */
  function openTab(t: Tab, view?: 'transfers' | 'payouts') {
    setTab(t);
    if (view) setMoneyView(view);
    // The tab lives in the URL, so a refresh, a shared link or coming Back from a game lands here again.
    const urlTab = t === 'money' ? ((view ?? moneyView) === 'payouts' ? 'payouts' : 'money') : t;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${urlTab === 'members' ? '' : `?tab=${urlTab}`}`);
    const bar = document.getElementById('group-tabs');
    if (bar && bar.getBoundingClientRect().top <= 1) {
      requestAnimationFrame(() => document.getElementById('group-tab-top')?.scrollIntoView({ block: 'start' }));
    }
  }

  function startEdit() {
    if (!group) return;
    setEditData({
      name: group.name,
      description: group.description || '',
      location: group.location || '',
      schedule: group.schedule || '',
      kickoffTime: group.kickoffTime || '',
      targetPlayers: group.targetPlayers,
      feePerPlayer: group.feePerPlayer,
      paymentType: group.paymentType,
      requireRsvp: !!group.requireRsvp,
      contributionsVisibility: group.contributionsVisibility ?? 'private',
    });
    setEditing(true);
  }

  async function handleSaveEdit(editData: GroupEditData) {
    setSaving(true);
    try {
      await updateGroup(id, {
        name: editData.name,
        description: editData.description || undefined,
        location: editData.location || undefined,
        schedule: editData.schedule || undefined,
        kickoffTime: editData.kickoffTime || undefined,
        targetPlayers: editData.targetPlayers,
        feePerPlayer: editData.feePerPlayer,
        paymentType: editData.paymentType as PaymentType,
        requireRsvp: editData.requireRsvp,
        contributionsVisibility: editData.contributionsVisibility,
      });
      const updated = await getGroup(id);
      setGroup(updated);
      setEditing(false);
      toast.success('Changes saved');
      refreshPayments().catch(() => {});
    } catch {
      toast.error('The changes didn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup() {
    setShowMenu(false);
    setConfirm({
      title: 'Delete this group?',
      message: `Are you sure you want to delete "${group?.name}"? This can't be undone.`,
      confirmLabel: 'Delete group',
      variant: 'danger',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await deleteGroup(id);
          toast.success('Group deleted');
          router.push('/groups');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'The group wasn’t deleted. Try again.');
        }
      },
    });
  }


  if (loading || !group) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse" aria-busy="true" aria-label="Loading the group">
          <div className="h-8 w-28 bg-gray-100 rounded-full mb-4" />
          <div className="h-[244px] bg-ink/90 rounded-[28px]" />
          <div className="mt-3 h-[52px] bg-gray-100 rounded-2xl" />
          <div className="mt-6 h-5 w-24 bg-gray-100 rounded" />
          <div className="mt-3 h-64 bg-gray-100 rounded-3xl" />
        </div>
      </div>
    );
  }

  const memberCount = group.memberships?.length || 0;
  const canManage = user?.role !== UserRole.TREASURER;
  const unmatched = billing?.unmatchedTransfers ?? 0;
  const perGame = group.paymentType === PaymentType.PER_SESSION;
  // Still building the squad (fewer members than places in a game): inviting is the main job here.
  const recruiting = memberCount < group.targetPlayers;
  const nextGame = sessions
    .filter((s) => s.kind !== 'dues' && s.status === 'upcoming' && daysFromToday(s.date) >= 0)
    .sort((a, b) => gameDay(a.date).getTime() - gameDay(b.date).getTime())[0];

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'members', label: 'Players' },
    { key: 'games', label: perGame ? 'Games' : 'Dues' },
    { key: 'table', label: 'Table' },
    { key: 'money', label: 'Money', badge: unmatched },
  ];


  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Switch to another group's page, keeping the tab; All groups and New group are in the sheet */}
      <div className="mb-4">
        <GroupSwitch
          groups={allGroups.length ? allGroups : [group]}
          currentId={group.id}
          onPick={(next) => next !== group.id && router.push(`/groups/${next}?tab=${tab}`)}
        />
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.variant}
        onConfirm={confirm?.onConfirm ?? (() => {})}
        onCancel={() => setConfirm(null)}
      />
      {showMenu && (
        <GroupMenuSheet
          name={group.name}
          onEdit={() => {
            setShowMenu(false);
            startEdit();
          }}
          onDelete={handleDeleteGroup}
          onClose={() => setShowMenu(false)}
        />
      )}
      {showInvite && billing && (
        <InviteSheet group={group} billing={billing} canManage={canManage} onBilling={money.setBilling} onClose={() => setShowInvite(false)} />
      )}
      {showAccount && billing && <AccountDetailsSheet group={group} billing={billing} onClose={() => setShowAccount(false)} />}

      {/* Header */}
      {editing && (
        <GroupEditSheet initial={editData} saving={saving} onSave={handleSaveEdit} onClose={() => setEditing(false)} />
      )}
      {(
        <section aria-label={group.name} className="relative rounded-[28px] bg-ink text-white overflow-hidden shadow-lift">
          <div className="absolute inset-0 turf-stripes-soft" />
          <div className="relative p-5">
            {/* Who: the club's shirt and name, like the cover of a match programme */}
            <div className="flex items-start gap-3.5">
              <JerseyBadge label={group.name.charAt(0).toUpperCase()} name={group.name} className="w-14 h-14 shrink-0 -mt-1" />
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-[26px] leading-[1.1] font-extrabold text-white line-clamp-2">
                  <KeepHyphens text={group.name} />
                </h1>
                {group.location && <p className="mt-1 text-[13px] font-semibold leading-snug text-white/65 line-clamp-2">{group.location}</p>}
              </div>
              <button
                onClick={() => setShowMenu(true)}
                aria-label="Group options"
                aria-haspopup="dialog"
                className="press w-11 h-11 -mr-1.5 -mt-1.5 shrink-0 rounded-full flex items-center justify-center text-white/80 hover:text-white"
              >
                <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </span>
              </button>
            </div>

            {/* The three facts an organiser checks, each a way into its tab (the same strip as the home card) */}
            <div className="mt-5 grid grid-cols-3 rounded-2xl bg-white/[0.06] divide-x divide-white/[0.08]">
              {[
                {
                  key: 'games' as Tab,
                  value: nextGame ? gameDay(nextGame.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '') : 'None yet',
                  label: 'Next game',
                },
                { key: 'members' as Tab, value: formatCurrency(group.feePerPlayer), label: perGame ? 'Per player' : `Per player, ${frequencyLabel(group.paymentType).toLowerCase()}` },
                {
                  key: 'money' as Tab,
                  value:
                    billing && !billing.account
                      ? 'Set up'
                      : money.balance
                        ? formatCurrency(Number(money.balance.available))
                        : money.balanceFailed
                          ? 'Not loaded'
                          : '₦…',
                  label: 'Balance',
                  money: true,
                },
              ].map((f) => (
                <button
                  key={f.label}
                  onClick={() => {
                    openTab(f.key, f.key === 'money' ? 'transfers' : undefined);
                    requestAnimationFrame(() => document.getElementById('group-tab-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                  }}
                  className="press min-w-0 flex flex-col px-2.5 py-2.5 text-left hover:bg-white/[0.05] first:rounded-l-2xl last:rounded-r-2xl transition-colors"
                >
                  <span className={`block text-[15px] font-bold tabular-nums tracking-tight whitespace-nowrap ${f.money ? 'text-volt-300' : 'text-white'}`}>
                    {f.value}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold leading-tight text-white/65 truncate">
                    {f.money && unmatched > 0 && <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-sun-400 animate-pulse-soft" aria-label={`${unmatched} with no name`} />}
                    {f.label}
                  </span>
                </button>
              ))}
            </div>

            {billing && (
              <button
                onClick={() => setShowInvite(true)}
                className={`press mt-3 w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl text-[15px] transition-colors ${
                  recruiting ? 'bg-volt-400 text-ink font-extrabold hover:bg-volt-300' : 'bg-white/10 text-white font-bold hover:bg-white/15'
                }`}
              >
                <InviteIcon />
                Invite players
              </button>
            )}
          </div>
        </section>
      )}

      {/* Tabs: they stay at the top while a long list scrolls */}
      <div id="group-tab-top" ref={tabTopRef} />
      <div
        id="group-tabs"
        className={`sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-[max(8px,env(safe-area-inset-top))] pb-2 mt-3 mb-3 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 transition-shadow duration-200 ${
          tabsPinned ? 'shadow-[0_6px_16px_-10px_rgba(15,26,20,0.35)]' : ''
        }`}
      >
        <div role="tablist" aria-label={`${group.name} sections`} className="flex p-1 bg-white border border-gray-200 rounded-2xl">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              id={`group-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="group-panel"
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => openTab(t.key)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const i = tabs.findIndex((x) => x.key === t.key);
                const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].key;
                openTab(next);
                document.getElementById(`group-tab-${next}`)?.focus();
              }}
              className={`press relative flex-1 min-h-11 px-1 text-[13px] sm:text-sm font-bold whitespace-nowrap rounded-xl transition-colors duration-200 ${
                tab === t.key ? 'bg-ink text-volt-300' : 'text-gray-500 hover:text-ink'
              }`}
            >
              {t.label}
              {!!t.badge && (
                <span
                  className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-kit-500 text-ink text-[10px] font-extrabold flex items-center justify-center"
                  aria-label={`${t.badge} with no name`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div id="group-panel" role="tabpanel" aria-labelledby={`group-tab-${tab}`}>
      {tab === 'table' && <GroupTable groupId={group.id} />}

      {/* Money: what's come in, and what's gone out (the same as the Money tab) */}
      {tab === 'money' && (
        <GroupMoney
          group={group}
          money={money}
          sessions={sessions}
          canManage={canManage}
          view={moneyView}
          onView={(v) => openTab('money', v)}
          focusTransfer={focusTransfer}
          onFocusTransfer={setFocusTransfer}
          onRefresh={refreshPayments}
          onGroupChanged={async () => setGroup(await getGroup(id))}
          onAddPlayers={() => openTab('members')}
          onOpenAccount={() => setShowAccount(true)}
        />
      )}

      {tab === 'members' && (
        <GroupSquad
          group={group}
          sessions={sessions}
          billing={billing}
          canManage={canManage}
          onGroupChanged={setGroup}
          onPaymentsChanged={() => refreshPayments().catch(() => {})}
        />
      )}

      {/* Games Tab: the same list as the Games page, for this group */}
      {tab === 'games' && (
        <GamesBrowser
          groups={[{ id: group.id, name: group.name, targetPlayers: group.targetPlayers, kickoffTime: group.kickoffTime, location: group.location }]}
          groupId={group.id}
          canSchedule
          onNew={() => setShowCreateSession(true)}
        />
      )}
      </div>
      {showCreateSession && <NewSessionSheet groups={[group]} onClose={() => setShowCreateSession(false)} />}
    </div>
  );
}

/** The ⋯ menu: change the group's details, or delete it (behind a confirm). */
function GroupMenuSheet({
  name,
  onEdit,
  onDelete,
  onClose,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const row = 'press w-full flex items-center gap-3 min-h-12 px-2 py-1.5 rounded-xl text-left transition-colors';
  return (
    <Sheet titleId={titleId} onClose={onClose} align="left">
      <SheetTitle id={titleId} title={name} onClose={onClose} />
      <ul className="mt-3 -mx-2">
        <li>
          <button onClick={onEdit} className={`${row} hover:bg-chalk`}>
            <span className="w-8 h-8 shrink-0 rounded-lg bg-chalk text-ink flex items-center justify-center">{icon(ICON_PATHS.pencil)}</span>
            <span className="flex-1 text-[15px] font-semibold text-ink">Edit group details</span>
          </button>
        </li>
        <li>
            <button onClick={onDelete} className={`${row} hover:bg-kit-500/10`}>
              <span className="w-8 h-8 shrink-0 rounded-lg bg-kit-500/10 text-kit-600 flex items-center justify-center">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </span>
              <span className="flex-1 text-[15px] font-semibold text-kit-600">Delete group</span>
            </button>
          </li>
      </ul>
    </Sheet>
  );
}
