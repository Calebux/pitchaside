'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'pa_player_group';
const EVENT = 'pitchaside:player-group';

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function write(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered on this phone: it still holds for this visit.
  }
}

/**
 * The group a player is looking at, shared by Home, Games and Club like the organiser's group
 * switch: null is all their groups. A link with ?group= opens on that group; otherwise it's the
 * last one they picked on this phone. A group they're no longer in counts as all.
 */
export function usePlayerGroup(groups: { id: string }[] | null | undefined) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('group');
    if (fromLink) write(fromLink);
    setId(fromLink ?? read());
    // Picked on another screen (or tab): follow it.
    const follow = () => setId(read());
    window.addEventListener(EVENT, follow);
    window.addEventListener('storage', follow);
    return () => {
      window.removeEventListener(EVENT, follow);
      window.removeEventListener('storage', follow);
    };
  }, []);

  const pick = useCallback((next: string | null) => {
    write(next);
    setId(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('group', next);
    else url.searchParams.delete('group');
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const current = id && groups?.some((g) => g.id === id) ? id : null;
  return [current, pick] as const;
}
