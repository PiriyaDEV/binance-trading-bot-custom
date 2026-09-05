import { useCallback, useEffect, useState } from 'react';

import { setActiveLocale, type Locale } from '@/shared/lib/i18n';

const STORAGE_KEY = 'locale';
const CHANNEL = 'locale';
const DEFAULT_LOCALE: Locale = 'th';

function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'th';
}

function readInitialLocale(): Locale {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.lang;
    if (isLocale(attr)) return attr;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode); fall through.
  }
  // No `navigator.language` sniff: an operator opening the app from an
  // unfamiliar browser (a shared machine, a colleague's laptop) should not
  // have their own accounts's language guessed for them — the explicit
  // toggle is the only way in, same policy as the theme default.
  return DEFAULT_LOCALE;
}

function applyLocale(locale: Locale): void {
  setActiveLocale(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

/*
 * Cross-tab sync via BroadcastChannel('locale'), same shape as `useTheme`.
 * Falls back to the `storage` event for Safari <=14.
 */
export function useLocale(): {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
} {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  // Runs on every render that carries a new `locale`, INCLUDING the initial
  // one and StrictMode's double-invoke — both idempotent, so double-applying
  // is harmless. Not deferred to an effect: `LocaleRoot` remounts the whole
  // app subtree on locale change (see its own doc comment), and those newly
  // mounted descendants call `t()` synchronously during THEIR first render,
  // which happens in the same pass as this one. An effect would run after
  // that render, one tick too late — the remounted subtree would flash the
  // previous language.
  applyLocale(locale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage write rejected (quota / private mode); applied in-memory only.
    }
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHANNEL);
      ch.postMessage(next);
      ch.close();
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'th' : 'en');
  }, [locale, setLocale]);

  useEffect(() => {
    const supportsBroadcast = typeof BroadcastChannel !== 'undefined';

    let bc: BroadcastChannel | null = null;
    if (supportsBroadcast) {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (ev: MessageEvent) => {
        const v: unknown = ev.data;
        if (isLocale(v)) setLocaleState(v);
      };
    }

    const onStorage = (ev: StorageEvent): void => {
      if (ev.key !== STORAGE_KEY) return;
      if (isLocale(ev.newValue)) setLocaleState(ev.newValue);
    };
    window.addEventListener('storage', onStorage);

    return () => {
      bc?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { locale, setLocale, toggleLocale };
}
