'use client';

import { useId, useRef, useState } from 'react';
import { kitFor } from '@/components/illustrations';
import { useToast } from '@/components/toast';
import { photoUrl } from '@/lib/http';
import { resizePhoto } from '@/lib/photo';

/**
 * A player's photo with a way to add, change or remove it: the organiser on a player's card, a
 * player on their own profile. Without a photo it's their kit-coloured initial, as everywhere
 * else. The photo is made small on the phone before it's sent.
 */
export function PhotoPicker({
  name,
  photoKey,
  onUpload,
  onRemove,
  size = 'w-20 h-20 text-2xl',
  you = false,
}: {
  name: string;
  photoKey?: string | null;
  /** Sends the prepared photo; resolves with the new key. */
  onUpload: (image: string) => Promise<string>;
  onRemove: () => Promise<void>;
  size?: string;
  /** Said to the player themselves ("your photo") rather than about them. */
  you?: boolean;
}) {
  const toast = useToast();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(photoKey ?? null);
  const [busy, setBusy] = useState<'up' | 'off' | null>(null);
  const src = photoUrl(key);
  const kit = kitFor(name);
  const first = name.split(' ')[0];

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy('up');
    try {
      const image = await resizePhoto(file);
      setKey(await onUpload(image));
      toast.success(you ? 'Your photo is up' : `Photo added for ${first}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The photo didn’t upload. Try again.');
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setBusy('off');
    try {
      await onRemove();
      setKey(null);
      toast.success(you ? 'Your photo is removed' : `Photo removed for ${first}`);
    } catch {
      toast.error('The photo wasn’t removed. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label htmlFor={inputId} className={`press relative shrink-0 ${size} rounded-full cursor-pointer`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={you ? 'Your photo' : `${name}’s photo`} className="w-full h-full rounded-full object-cover bg-chalk" />
        ) : (
          <span className={`w-full h-full rounded-full ${kit.bg} ${kit.fg} flex items-center justify-center font-extrabold font-display`} aria-hidden>
            {name.charAt(0)}
          </span>
        )}
        {/* A small camera on the corner: this picture can be changed */}
        <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-ink text-volt-300 border-2 border-white flex items-center justify-center" aria-hidden>
          {busy === 'up' ? (
            <span className="w-3 h-3 rounded-full border-2 border-volt-300 border-t-transparent animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          )}
        </span>
      </label>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={!!busy}
        onChange={(e) => pick(e.target.files?.[0])}
        aria-label={key ? (you ? 'Change your photo' : `Change ${first}’s photo`) : you ? 'Add your photo' : `Add a photo of ${first}`}
      />
      <div className="flex flex-col items-start">
        <label htmlFor={inputId} className="min-h-11 inline-flex items-center text-[14px] font-bold text-pitch-700 cursor-pointer hover:text-ink">
          {busy === 'up' ? 'Uploading…' : key ? 'Change photo' : you ? 'Add your photo' : 'Add a photo'}
        </label>
        {key && (
          <button onClick={remove} disabled={!!busy} className="-mt-2 min-h-11 text-[13px] font-semibold text-gray-500 hover:text-kit-600 disabled:opacity-50">
            {busy === 'off' ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The photo control as a camera button on a player card's portrait: tap to add a photo, or (when
 * there is one) to change or remove it. `onChange` gets the new key, or null when removed, so
 * the card can redraw.
 */
export function CardPhotoButton({
  name,
  photoKey,
  onUpload,
  onRemove,
  onChange,
  you = false,
}: {
  name: string;
  photoKey?: string | null;
  onUpload: (image: string) => Promise<string>;
  onRemove: () => Promise<void>;
  onChange: (key: string | null) => void;
  you?: boolean;
}) {
  const toast = useToast();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'up' | 'off' | null>(null);
  const [menu, setMenu] = useState(false);
  const first = name.split(' ')[0];

  async function pick(file: File | undefined) {
    setMenu(false);
    if (!file) return;
    setBusy('up');
    try {
      onChange(await onUpload(await resizePhoto(file)));
      toast.success(you ? 'Your photo is up' : `Photo added for ${first}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The photo didn’t upload. Try again.');
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setMenu(false);
    setBusy('off');
    try {
      await onRemove();
      onChange(null);
      toast.success(you ? 'Your photo is removed' : `Photo removed for ${first}`);
    } catch {
      toast.error('The photo wasn’t removed. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const camera = (
    <span className="w-8 h-8 rounded-full bg-volt-300 text-ink border-2 border-ink flex items-center justify-center shadow-lift">
      {busy ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-ink border-t-transparent animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
        </svg>
      )}
    </span>
  );

  return (
    <>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={!!busy}
        onChange={(e) => pick(e.target.files?.[0])}
        aria-label={photoKey ? (you ? 'Change your photo' : `Change ${first}’s photo`) : you ? 'Add your photo' : `Add a photo of ${first}`}
      />
      {photoKey ? (
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          disabled={!!busy}
          aria-expanded={menu}
          aria-label={you ? 'Your photo: change or remove' : `${first}’s photo: change or remove`}
          className="press w-11 h-11 flex items-center justify-center"
        >
          {camera}
        </button>
      ) : (
        <label htmlFor={inputId} className="press w-11 h-11 flex items-center justify-center cursor-pointer" title={you ? 'Add your photo' : `Add a photo of ${first}`}>
          {camera}
        </label>
      )}
      {menu && (
        <span className="absolute z-20 bottom-12 left-1 w-40 rounded-2xl bg-white text-ink shadow-lift border border-gray-100 overflow-hidden animate-pop-in">
          <label htmlFor={inputId} className="block min-h-11 px-3.5 py-3 text-[14px] font-bold cursor-pointer hover:bg-chalk">
            Change photo
          </label>
          <button type="button" onClick={remove} className="block w-full min-h-11 px-3.5 py-3 text-left text-[14px] font-bold text-kit-600 hover:bg-chalk border-t border-gray-100">
            Remove photo
          </button>
        </span>
      )}
    </>
  );
}
