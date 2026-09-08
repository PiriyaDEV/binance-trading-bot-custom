/*
 * i18n shim: typed t(key, vars?) conforming to ICU MessageFormat key shape.
 *
 * Ships English + Thai catalogs, switched at runtime by locale (see
 * `useLocale` / `LocaleRoot`). This shim has a typed signature so a future
 * swap to formatjs / lingui / @lingui/core is a one-line provider injection
 * at `setI18nProvider(impl)`. See apps/web/README.md ("i18n provider swap").
 *
 * ICU key shape: dot.namespaced.snake_case identifiers.
 *
 * Reactivity: `t()` itself is a plain function — most call sites read it
 * directly at render time, not through a hook, so swapping `provider` alone
 * would not re-render an already-mounted component. `LocaleRoot` (see
 * `use-locale.ts`) forces the fix at the root instead: it keys its child
 * subtree on the current locale, so a locale change remounts every
 * descendant from scratch and every `t()` call re-evaluates against the new
 * provider — no call site needs to change.
 */

import { th } from './i18n-th';

export type I18nVars = Readonly<Record<string, string | number>>;
export type I18nKey = `${string}.${string}`;
export type I18nProvider = (key: I18nKey, vars?: I18nVars) => string;
export type Locale = 'en' | 'th';
export const LOCALES: readonly Locale[] = ['en', 'th'];

const en: Readonly<Record<string, string>> = {
  'app.title': 'BOT',
  'breadcrumb.label': 'Breadcrumb',
  'common.cancel': 'Cancel',
  'common.loading': 'Loading…',
  'demo.advisor_unavailable':
    'Asking the AI for config ideas is turned off in the live demo — each request spends the operator\u2019s own AI credit. Suggestions already saved to a run stay readable below.',
  'demo.banner': 'Live demo · testnet · resets nightly',
  'demo.investigate_unavailable':
    'Investigations are turned off in the live demo — they run against the operator\u2019s own engine.',
  'demo.reconcile_fees_unavailable':
    'Fee reconciliation is turned off in the live demo — it pulls trade history from the operator\u2019s own Binance account.',
  'nav.home': 'Home',
  'nav.profiles': 'Profiles',
  'nav.account': 'Account',
  'nav.skip_to_content': 'Skip to content',
  'nav.overview': 'Overview',
  'nav.history': 'History',
  'nav.backtest': 'Backtest',
  'nav.past_runs': 'Past runs',
  'nav.settings': 'Settings',
  'nav.section.monitor': 'Monitor',
  'nav.section.profiles': 'Profiles',
  'nav.section.account': 'Account',
  'nav.section.system': 'System',
  'nav.manage_account': 'Account',
  'nav.dust_transfer': 'Dust transfer',
  'nav.orphan_orders': 'Orphan orders',
  'nav.new_profile': 'New profile',
  'nav.backup_restore': 'Backup & restore',
  'nav.collapse': 'Collapse sidebar',
  'nav.expand': 'Expand sidebar',
  'theme.toggle.to_light': 'Switch to light theme',
  'theme.toggle.to_dark': 'Switch to dark theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'locale.toggle.to_th': 'เปลี่ยนเป็นภาษาไทย',
  'locale.toggle.to_en': 'Switch to English',
  'locale.th': 'ไทย',
  'locale.en': 'English',
  'error.title': 'Something went wrong',
  'error.retry': 'Retry',
  'error.unknown': 'An unknown error occurred. Try again.',
  'form.errors.blocked':
    'Some fields need attention. Open the sections below to find and fix them.',
  'auth.field.email': 'Email',
  'auth.field.password': 'Password',
  'auth.field.password.help': 'At least 12 characters.',
  'auth.field.email.placeholder': 'you@example.com',
  'auth.field.password.placeholder': '••••••••••••',
  'auth.error.generic': 'Could not complete the request. Try again.',
  'onboarding.title': 'Create master account',
  'onboarding.subtitle': 'First-run setup. This screen is shown once.',
  'onboarding.warning.title': 'Lost-password recovery requires host shell access',
  'onboarding.warning.body':
    'There is no in-app password recovery. If this password is lost, the operator must run `bun run reset-password` on the host. Store this password in a password manager now.',
  'onboarding.submit': 'Create account',
  'onboarding.submitting': 'Creating account…',
  'onboarding.error.password_too_short': 'Password must be at least 12 characters.',
  'onboarding.error.invalid_email': 'Enter a valid email address.',
  'onboarding.error.closed': 'Onboarding is already complete. Redirecting to sign in…',
  'login.title': 'Sign in',
  'login.subtitle': 'Operator access only.',
  'login.session_expired': 'Your session expired. Sign in again to pick up where you left off.',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in…',
  'login.error.invalid': 'Email or password is incorrect.',
  'login.error.rate_limited.with_retry': 'Too many attempts. Try again in {seconds} seconds.',
  'login.error.rate_limited.no_retry': 'Too many attempts. Try again later.',
  'login.error.invalid_email': 'Enter a valid email address.',
  'login.error.password_required': 'Password is required.',
  'profile.switcher.label': 'Active profile',
  'profile.switcher.placeholder': 'Search profiles…',
  'profile.switcher.empty': 'No profiles found.',
  'profile.switcher.no_active': 'Select a profile',
  'profile.switcher.all': 'All profiles',
  'profile.switcher.kill_switch': 'Kill switch active on at least one profile',
  'home.heading': 'Home',
  'home.summary.unrealised': 'Unrealised P/L',
  'home.summary.practice': 'Testnet (practice)',
  'home.summary.live': 'Live',
  'home.summary.positions': 'Open positions',
  'home.summary.open_orders': 'Open orders',
  'home.profiles.title': 'Profiles',
  'home.activity.title': 'Recent activity',
  'home.activity.empty': 'Nothing has happened yet.',
  'home.activity.error': 'Could not load recent activity.',
  'home.activity.partial': 'Some profiles’ activity could not be loaded.',
  'home.empty.title': 'No profiles yet',
  'home.empty.body': 'Create a profile to start trading on Binance.',
  'home.empty.cta': 'Create your first profile',
  'home.card.enabled': 'Enabled',
  'home.card.disabled': 'Disabled',
  'home.card.testnet': 'Testnet',
  'home.card.last_tick': 'Last tick',
  'home.card.last_tick.never': 'Never',
  'home.card.last_tick.ago.seconds': '{seconds}s ago',
  'home.card.last_tick.ago.minutes': '{minutes}m ago',
  'home.card.last_tick.ago.hours': '{hours}h ago',
  'home.card.last_tick.ago.days': '{days}d ago',
  'home.card.last_tick.awaiting': 'Awaiting first tick',
  'home.card.last_tick.configure_key': 'configure API key',
  'home.card.last_tick.check_permissions': 'check API key permissions',
  'home.card.latency': 'Latency',
  'home.card.latency.unknown': '—',
  'home.card.latency.ms': '{ms} ms',
  'symbol.tick.last_tick': 'Last tick',
  'symbol.tick.latency': 'Latency',
  'symbol.tick.awaiting': '— · awaiting first tick',
  'symbol.tick.configure_key': 'Set API key if not configured',
  'symbol.tick.configure_key.aria': 'Set API key for profile {profileName}',
  'home.card.pnl': 'PnL',
  'home.card.kill_switch': 'Kill switch',
  'home.card.exposure_warning': 'Orders or position still live',
  'home.card.open_orders': 'Open orders',
  'home.card.positions': 'Positions',
  'home.symbols.title': 'Symbols',
  'home.symbols.filter': 'Filter symbols',
  'home.symbols.empty': 'No symbols configured yet.',
  'home.symbols.no_match': 'No symbols match the filter.',
  'home.symbols.error': 'Could not load symbols.',
  'home.symbols.partial': 'Some profiles’ symbols could not be loaded.',
  'home.symbols.held': '{qty} held',
  'home.symbols.flat': 'no position',
  'home.symbols.order': '{count} order',
  'home.symbols.orders': '{count} orders',
  'home.symbols.disabled': 'disabled',
  'home.symbols.dot.held': 'Holding a position',
  'home.symbols.dot.flat': 'No open position',
  'home.symbols.dot.disabled': 'Symbol paused — strategy not trading it',
  'home.symbols.col.symbol': 'Symbol',
  'home.symbols.col.status': 'Status',
  'home.symbols.col.profile': 'Profile',
  'home.symbols.col.position': 'Position',
  'home.symbols.col.price': 'Price',
  'home.symbols.col.pnl': 'Unreal. P/L',
  'home.symbols.col.orders': 'Orders',
  'home.symbols.configure': 'Config',
  'home.symbols.configure.aria': 'Configure {symbol} on {profile}',
  'grid.status.holding': 'Holding',
  'grid.status.watching': 'Watching',
  'grid.status.blocked': 'Blocked',
  'grid.status.unprotected': 'No stop',
  'grid.status.stopStale': 'Old stop',
  'grid.status.paused': 'Paused',
  'grid.status.notHeld': 'Not held',
  'grid.status.notHeld.title':
    'Not held — nothing sellable backs this cost basis, so the bot has no position here and the figure is a note you left yourself.',
  'home.scoped.title': 'Profile',
  'home.scoped.discovery_title': 'Discovery',
  'home.scoped.deployed': 'Deployed',
  'home.scoped.exposure_cap': 'Exposure cap',
  'home.scoped.auto_symbols': 'In rotation',
  'home.scoped.holdings': 'Open positions',
  'home.scoped.realised': 'P/L',
  'home.scoped.realised_7d': '7-day P/L',
  'home.scoped.win_rate': 'Win rate',
  'home.scoped.trades': 'Trades',
  'home.scoped.now_tag': 'now',
  'home.scoped.by_source_title': 'P/L by source',
  'home.scoped.by_source_desc':
    'Where each coin came from for this period: discovery found it, you added it, or the bot recovered it after finding coins it was not tracking. Pinning a coin does not change this — it only stops discovery rotating it out. Win% is winners over trades; PF (profit factor) is gross wins over gross losses — above 1 makes money.',
  'home.balances.title': 'Balances',
  'home.balances.error': "Couldn't load balances. Retry shortly.",
  'profile.controls.rename': 'Rename profile',
  'profile.controls.bulk_order': 'Bulk manual order',
  'profile.controls.cancel': 'Cancel',
  'profile.controls.working': 'Working…',
  'profile.controls.notifier_gap': 'Live trading with no notifications enabled.',
  'profile.controls.kill_engage': 'Stop trading',
  'profile.controls.kill_release': 'Resume trading',
  'profile.controls.kill_engage_title': 'Stop trading on this profile?',
  'profile.controls.kill_release_title': 'Resume trading on this profile?',
  'profile.controls.kill_engage_body':
    'All decisions for this profile freeze immediately. Open orders are unaffected.',
  'profile.controls.kill_release_body':
    'Decisions will resume on the next tick. Open orders are unaffected.',
  'profile.controls.kill_failed': 'Could not change the emergency stop. Try again.',
  'profile.controls.save': 'Save',
  'profile.controls.saved': 'Saved.',
  'profile.controls.rename_title': 'Rename profile',
  'profile.controls.rename_body':
    'Letters, numbers, spaces, dashes, and underscores; up to 64 characters.',
  'profile.controls.rename_failed': 'Could not rename the profile. Try again.',
  'profile.controls.quote': 'Quote currency',
  'profile.controls.quote_title': 'Change quote currency',
  'profile.controls.quote_body':
    'Quote currency for this profile (e.g. USDT, BTC). Applies to every symbol. Changing it re-points discovery to the new markets and keeps any coins you already hold until they exit. Buy/grid amounts are set in this currency — review them after changing.',
  'profile.controls.quote_failed': 'Could not change the quote currency. Try again.',
  'profile.controls.enable': 'Enable profile',
  'profile.controls.disable': 'Disable profile',
  'profile.controls.enable_title': 'Enable this profile?',
  'profile.controls.disable_title': 'Disable this profile?',
  'profile.controls.enable_body':
    'The profile starts ticking and trades per its config — auto-buy, discovery, and sells. On a live profile this places real orders.',
  'profile.controls.disable_body':
    'The profile stops ticking; it will not open or manage positions. Resting exchange-side orders (e.g. a protective stop) stay until cancelled.',
  'profile.controls.enable_failed': 'Could not change the profile state. Try again.',
  'profile.controls.delete': 'Delete profile',
  'profile.controls.delete_title': 'Delete this profile?',
  'profile.controls.delete_body':
    'This permanently removes “{name}” and all its records (orders, history, settings). This cannot be undone. Coins you already hold on the exchange are not sold — only the bot’s record of them is removed.',
  'profile.controls.delete_confirm': 'Delete profile',
  'profile.controls.delete_cancel': 'Keep profile',
  'profile.controls.delete_failed': 'Could not delete the profile. Try again.',
  'profile.controls.delete_exposure_title': 'This profile is still active',
  'profile.controls.delete_exposure_body':
    'It still has {orders} live order(s) on the exchange and {positions} open position(s) (coins you currently hold). The bot can cancel those orders on Binance for you and then delete the profile — your coins stay in your wallet as plain holdings.',
  'profile.controls.delete_dispose': 'Cancel its orders and delete',
  'profile.controls.delete_disposition_cancel': 'Cancel its resting orders, then delete',
  'profile.controls.delete_disposition_handoff': 'Hand the position to another profile',
  'profile.controls.delete_handoff_label': 'Profile to receive the position',
  'profile.controls.delete_handoff_placeholder': 'Choose a profile…',
  'profile.controls.delete_handoff_confirm': 'Hand off and delete',
  'topbar.health.live': 'Bot live',
  'topbar.health.down': 'Bot down',
  'topbar.health.restart': 'Restart needed',
  'topbar.ticker.positions': 'Positions',
  'topbar.ticker.orders': 'Open orders',
  'topbar.ticker.unrealised': 'Unrealised P/L',
  'topbar.ticker.realised': 'Today',
  'topbar.ticker.label': 'Live trading summary',
  'topbar.kill.button': 'Stop all',
  'topbar.kill.all_stopped': 'All stopped',
  'topbar.kill.title': 'Stop all trading?',
  'topbar.kill.body':
    'This flips the kill switch (an emergency stop) on every profile below. The bot stops placing and managing orders immediately. Open positions and resting orders are left untouched.',
  'topbar.kill.confirm': 'Stop all trading',
  'topbar.kill.cancel': 'Cancel',
  'topbar.kill.failed': 'Could not stop {name} — try again.',
  'topbar.kill.resume_hint': 'Resume each profile from its own page when you are ready.',
  'home.error.title': 'Could not load profiles',
  'home.stats.title': 'At a glance',
  'home.stats.profiles': 'Profiles',
  'home.stats.open_orders': 'Open orders',
  'home.stats.positions': 'Positions',
  'notfound.title': 'Page not found',
  'notfound.body': 'The page you are looking for does not exist or has moved.',
  'notfound.cta': 'Go to home',
  'wizard.title': 'New profile',
  'wizard.subtitle': 'Create a profile that trades a Binance symbol set with one strategy.',
  'wizard.progress.step': 'Step {current} of {total}',
  'wizard.progress.label': 'Wizard progress',
  'wizard.nav.back': 'Back',
  'wizard.nav.next': 'Next',
  'wizard.nav.submit': 'Create profile',
  'wizard.nav.submitting': 'Creating profile…',
  'wizard.error.generic': 'Could not save the profile. Try again.',
  'wizard.error.server_validation': 'Server rejected the input. Adjust and retry.',
  'wizard.step1.title': 'Profile name',
  'wizard.step1.field.name': 'Profile name',
  'wizard.step1.field.name.placeholder': 'btc-grid',
  'wizard.step1.field.name.help':
    'Letters, numbers, spaces, dashes, and underscores. Must be unique within the account.',
  'wizard.step1.error.name_required': 'Profile name is required.',
  'wizard.step1.error.name_too_long': 'Profile name must be 64 characters or fewer.',
  'wizard.step1.error.name_invalid':
    'Profile name can only contain letters, numbers, spaces, dashes, and underscores.',
  'wizard.step2.title': 'Strategy',
  'wizard.step2.subtitle': 'Pick the trading strategy this profile will run.',
  'wizard.step2.empty': 'No strategies are registered on the server.',
  'wizard.step2.error.required': 'Select a strategy to continue.',
  'wizard.step2.version': 'v{version}',
  // Shared API-key safety guidance, rendered by <ApiKeyGuidance/> on the
  // standalone api-key form. Two operator actions that the bot's security
  // model depends on (docs/architecture/auth.md).
  'apiKey.guidance.title': 'Before you paste: secure the key on Binance',
  'apiKey.guidance.permissions':
    'Enable only “Enable Reading” and “Enable Spot & Margin Trading”. Leave “Enable Withdrawals” OFF — the bot never withdraws, so a leaked key without it cannot move funds off the exchange.',
  'apiKey.guidance.ipAllowlist':
    'Restrict the key to this server’s IP on the Binance console. Keys are stored unencrypted, so the IP allowlist is what stops a stolen key from trading elsewhere.',
  'history.tab.archive': 'Archive',
  'history.tab.audit': 'Audit',
  'history.tab.logs': 'Logs',
  'history.tab.activity': 'Activity',
  'activity.filter.all': 'All',
  'activity.filter.trades': 'Trades',
  'activity.filter.discovery': 'Discovery',
  'activity.filter.errors': 'Errors',
  'workspace.close': 'Close workspace',
  'edit.bulk_order.title': 'Bulk order',
  'edit.symbol_config.title': 'Symbol config',
  'edit.profile_config.title': 'Strategy',
  'edit.api_key.title': 'API key',
  'edit.notifications.title': 'Notifications',
  'edit.add_symbol.title': 'Add symbol',
  'edit.discovery.title': 'Discovery',
  'edit.risk.title': 'Risk',
  'edit.gate.title': 'Live gate',
  // Not plain "Settings": that is the operator-global page in the same nav, and
  // the rule here is that no label may name two destinations. The nav row and
  // this page's <h1> read the same either way, which was the actual defect.
  'edit.general.title': 'Profile settings',
  'profile.controls.config': 'Strategy config',
  'profile.controls.api_key': 'API key',
  'profile.controls.notifications': 'Notifications',
  'profile.controls.discovery': 'Discovery',
  'profile.controls.risk': 'Risk controls',
  'profile.controls.history': 'History',
  'profile.controls.backtest': 'Backtest',
  'home.symbols.add': 'Add symbol',
  'technicals.loading': 'Technicals compute health loading',
  'technicals.unavailable_title': 'Health unavailable: {errMsg}',
  'technicals.unavailable_aria': 'Technicals compute health unavailable: {reason}',
  'technicals.unavailable_label': 'technicals (health unavailable: {reason})',
  'technicals.silent_title': 'No recent compute batch — the cron may not be running.',
  'technicals.silent_aria':
    'Technicals compute silent — no recent batch; the cron may not be running',
  'technicals.silent_label': 'technicals silent',
  'technicals.healthy': 'technicals',
  'technicals.degraded': 'technicals degraded',
  'technicals.outage': 'technicals outage',
  'technicals.word_healthy': 'healthy',
  'technicals.word_degraded': 'degraded',
  'technicals.word_outage': 'outage',
  'technicals.fresh_ago': 'fresh {age} ago',
  'technicals.never_fresh': 'never fresh',
  'technicals.aria': 'Technicals {word}; last fetch {ageLabel} ago{freshSuffix}',
  'technicals.age_suffix': '{ageLabel} ago',
  'investigate.button.idle': 'Investigate',
  'investigate.button.running': 'Investigating',
  'manage.button': 'Manage profile',
  'manage.title': 'Manage profile',
  'manage.description': 'Run a diagnosis or reconcile fees for this profile.',
  'manage.reconcile_fees.button': 'Reconcile fees',
  'manage.reconcile_fees.success':
    'Reconciling fees from Binance — check History again in a moment.',
  'manage.reconcile_fees.error': 'Could not start fee reconciliation.',
  'market_trend.title': 'Market trend',
  'market_trend.error': 'Market trend unavailable.',
  'market_trend.warming': 'Getting the latest market data…',
  'market_trend.next_update': 'Next update in ~{seconds}s',
  'market_trend.updates_stopped': 'Updates stopped. Restart the worker.',
  'market_trend.checking': 'Checking…',
  'market_trend.regime.bull': 'Bull',
  'market_trend.regime.bear': 'Bear',
  'market_trend.regime.neutral': 'Neutral',
  'market_trend.vs_sma50.above': '{pct}% above 50-day avg',
  'market_trend.vs_sma50.below': '{pct}% below 50-day avg',
  'market_trend.verdict.weak':
    'Weak market — Bitcoin and Ethereum are both falling and most coins are down today.',
  'market_trend.verdict.strong':
    'Strong market — Bitcoin and Ethereum are both rising and most coins are up today.',
  'market_trend.verdict.cautious': 'Mixed and cautious — most coins are down today.',
  'market_trend.verdict.mixed': 'Mixed — no clear direction right now.',
  'market_trend.breadth.title': 'Coins rising (24h)',
  'market_trend.breadth.rising': '{pct}% rising',
  'market_trend.breadth.cautious': 'Cautious',
  'market_trend.breadth.upbeat': 'Upbeat',
  'market_trend.breadth.aria': 'Market breadth: {upCount} of {total} pairs up over 24 hours',
  'market_trend.footnote':
    "The overall market mood. It's context, not a buy or sell signal — your bot still decides each coin on its own.",
  'realised_pnl.period.day': 'D',
  'realised_pnl.period.week': 'W',
  'realised_pnl.period.month': 'M',
  'realised_pnl.period.all': 'All',
  'realised_pnl.period_group': 'Period',
  'realised_pnl.heading': 'Recorded P/L',
  'realised_pnl.all_time': 'All time',
  'realised_pnl.no_trades': 'No closed trades · {period}',
  'realised_pnl.trade_count.one': '{count} closed trade · {period}',
  'realised_pnl.trade_count.other': '{count} closed trades · {period}',
  'realised_pnl.unavailable': 'Realised P/L unavailable.',
  'pnl_hero.total': 'Total P/L (all time)',
  'pnl_hero.today': 'Today',
  'pnl_hero.open': 'Open now',
  'pnl_hero.footnote':
    'Total is net of fees since your first trade. Today and Open now are the pieces it is made of.',
  'pnl_hero.thb_unit': 'THB',
  'recent_trades.title': 'Recent trades',
  'recent_trades.view_all': 'View all →',
  'recent_trades.empty': 'No closed trades yet.',
  'recent_trades.col.symbol': 'Symbol',
  'recent_trades.col.closed_because': 'Closed because',
  'recent_trades.col.pnl': 'P/L',
  'recent_trades.col.when': 'When',
  'wizard.preset.title': 'Quick start',
  'wizard.preset.subtitle':
    'Pick a ready-made setup. Every option previews a real backtest against a basket of major coins before it creates anything, so you see how it actually performed first.',
  'wizard.preset.recommended': 'Recommended',
  'wizard.preset.submit': 'Create & start trading',
  'wizard.preset.manual_link': 'Advanced: pick a strategy and configure it manually instead',
  'wizard.preset.conservative.name': 'Conservative',
  'wizard.preset.conservative.description':
    'Smaller trades, tighter stop-loss, only 2 coins at once. Lower risk, lower reward.',
  'wizard.preset.balanced.name': 'Balanced',
  'wizard.preset.balanced.description':
    "The strategy's own tuned defaults, up to 5 coins at once. A reasonable middle ground.",
  'wizard.preset.aggressive.name': 'Aggressive',
  'wizard.preset.aggressive.description':
    'Bigger trades, more room before a stop-loss cuts, up to 8 coins at once. Higher risk, higher reward.',
  'wizard.preset.smart.name': 'Smart',
  'wizard.preset.smart.badge': 'Backtest-picked',
  'wizard.preset.smart.description':
    'Backtests a basket of major coins at a couple of trading frequencies over the last 45 days, then binds whichever coins and interval actually performed best. Takes a couple of minutes.',
  'wizard.preset.smart.submit': 'Run backtest & create',
  'wizard.preset.smart.phase.creating': 'Creating the profile…',
  'wizard.preset.smart.phase.backtesting': 'Backtesting ({completed}/{total} done)…',
  'wizard.preset.smart.phase.binding': 'Applying the result…',
  'wizard.preset.smart.wait_note':
    'This runs real backtests over the last 45 days, so it can take a couple of minutes — do not close this page.',
  'wizard.preset.smart.done': 'Backtest picked {interval} candles and {count} coins:',
  'wizard.preset.smart.from_cache': '(reused a previously cached preview, not a fresh run)',
  'wizard.preset.smart.trades': '{count} trades',
  'wizard.preset.smart.robustness.clears':
    'Clears the Live-gate’s own bar — the pick held up out-of-sample, not just on the window it was picked from.',
  'wizard.preset.smart.robustness.misses':
    'Below the Live-gate’s bar out-of-sample — it looked good on the window tested, but that is not proof it holds up going forward. Consider backtesting further before enabling live.',
  'wizard.preset.smart.robustness.detail':
    'Total return {totalReturn}% over the window. In-sample: profit factor {inPf}, alpha {inAlpha}%. Out-of-sample (most recent slice): profit factor {oosPf}, alpha {oosAlpha}%.',
  'wizard.preset.smart.view': 'View profile',
  'wizard.preset.enable_toggle.label': 'Enable trading immediately',
  'wizard.preset.enable_toggle.help_on':
    'The bot starts trading as soon as this is created, with real orders on your account.',
  'wizard.preset.enable_toggle.help_off':
    'The profile is created and its coins are bound, but stays paused — nothing trades until you enable it yourself.',
  'wizard.preset.smart.done.enabled': 'Enabled — the bot is now trading this profile.',
  'wizard.preset.smart.done.disabled':
    'Created but not enabled — review the numbers above, then enable it from the profile page when ready.',
  'wizard.preset.preview.clears':
    'Checked {ago} · {totalReturn}% return · profit factor {pf} · clears the Live-gate',
  'wizard.preset.preview.misses':
    'Checked {ago} · {totalReturn}% return · profit factor {pf} · below the Live-gate',
  'wizard.smart.error.no_result':
    'Every backtest failed or timed out, so nothing could be picked. Try again, or use one of the fixed presets instead.',
  'wizard.smart.error.all_conflicted':
    "Every backtested coin's base asset is already traded by another profile on this account, so none could be bound. Free one up, or use one of the fixed presets on a different coin instead.",
};

function interpolate(template: string, vars?: I18nVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : undefined;
    return v === undefined || v === null ? `{${name}}` : String(v);
  });
}

const catalogs: Readonly<Record<Locale, Readonly<Record<string, string>>>> = { en, th };

/** Locale-aware provider: looks up `locale`'s catalog, falling back to `en` for any key that catalog has not (yet) translated, and to the raw key as a last resort so an unknown key never renders blank. */
function catalogProvider(locale: Locale): I18nProvider {
  return (key, vars) => {
    const catalog = catalogs[locale];
    const tmpl = Object.prototype.hasOwnProperty.call(catalog, key)
      ? catalog[key]
      : Object.prototype.hasOwnProperty.call(en, key)
        ? en[key]
        : undefined;
    return interpolate(tmpl ?? key, vars);
  };
}

let provider: I18nProvider = catalogProvider('en');

/** Escape hatch for a future real i18n library — bypasses the built-in catalogs entirely. */
export function setI18nProvider(p: I18nProvider): void {
  provider = p;
}

/** Switches `t()` to read from `locale`'s catalog. Called by `useLocale`; not reactive on its own — see the module doc comment and `LocaleRoot`. */
export function setActiveLocale(locale: Locale): void {
  provider = catalogProvider(locale);
}

export function t(key: I18nKey, vars?: I18nVars): string {
  return provider(key, vars);
}
