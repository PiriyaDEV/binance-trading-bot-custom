// Apply the persisted locale to <html lang> before paint, mirroring
// theme-init.js. Without this, `readInitialLocale()` in use-locale.ts reads
// `document.documentElement.lang` FIRST (before it ever checks
// localStorage) — and since the static shell below always ships a valid
// `lang="en"`, that check would win on every fresh load/reload regardless of
// what locale is actually stored, silently reverting the operator's choice.
// Served from the same origin so the strict CSP (script-src 'self') allows
// it; an inline <script> would be blocked in production.
(function () {
  try {
    var l = localStorage.getItem('locale');
    if (l === 'en' || l === 'th') document.documentElement.lang = l;
  } catch (_) {}
})();
