// Wraps the whole app so a locale switch takes effect everywhere at once.
//
// Most `t()` call sites read it directly during render, not through a hook
// (see the doc comment on `shared/lib/i18n.ts`), so swapping the active
// catalog alone would not re-render any already-mounted component. Keying
// this wrapper's child on the current locale sidesteps that: React tears
// down and remounts the whole subtree on a locale change, so every
// descendant's `t()` call re-evaluates fresh against the new catalog. A full
// remount is a deliberate trade-off for a rare, deliberate operator action —
// same cost profile as a page reload, and it is the one thing the shim's
// module doc names as the reactivity seam a future real i18n library would
// replace.

import { useLocale } from '@/shared/hooks/use-locale';

export function LocaleRoot({ children }: { readonly children: React.ReactNode }) {
  const { locale } = useLocale();
  // `display: contents` so this wrapper never participates in layout — the
  // app shell below still sees itself as `#root`'s effective direct child
  // for its `h-svh` sizing. Only `key` is load-bearing here.
  return (
    <div key={locale} className="contents">
      {children}
    </div>
  );
}
