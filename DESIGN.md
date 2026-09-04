---
version: v4
name: Operator Terminal
description: >-
  Dark trading terminal for a single solo operator, softened from v2/v3's Bauhaus-square language toward a cleaner, more fluid geometry — hairline 1px borders and a single loud accent still do the separation work, but corners are gently rounded and elevation is a soft blurred shadow instead of a hard offset. Amber yellow for selection, primary action, and active nav; signal green = positive/go, signal red = negative/stop, orange = warning. IBM Plex Sans Thai for UI text (one family, matched metrics for English and Thai), IBM Plex Mono for numbers. Dense on desktop with a collapsible left sidebar; still fully usable on a 375px phone via the bottom tab nav.

colors:
  canvas: '#0e0e0e'
  surface: '#141414'
  surface-alt: '#1a1a1a'
  border: '#2a2a2a'
  border-strong: '#3a3a3a'
  skeleton: '#303030'
  text: '#e8e8e8'
  text-emphasis: '#ffffff'
  text-muted: '#9a9aa0'
  accent: '#ffcc00'
  on-accent: '#000000'
  primary: '#00e070'
  on-primary: '#001509'
  danger: '#ef4f3c'
  on-danger: '#ffffff'
  up: '#00e070'
  down: '#ff6257'
  warning: '#ff8c00'
  on-warning: '#1a0f00'
  focus: '#ffcc00'
typography:
  hero:
    fontFamily: IBM Plex Mono
    fontSize: 32px
    fontWeight: 700
    fontFeature: '"tnum" 1, "zero" 1'
  heading:
    fontFamily: IBM Plex Sans Thai
    fontSize: 18px
    fontWeight: 700
  title:
    fontFamily: IBM Plex Sans Thai
    fontSize: 14px
    fontWeight: 600
  body:
    fontFamily: IBM Plex Sans Thai
    fontSize: 14px
    fontWeight: 400
  label:
    fontFamily: IBM Plex Sans Thai
    fontSize: 12px
    fontWeight: 500
  data:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: 400
    fontFeature: '"tnum" 1, "zero" 1'
rounded:
  none: 0px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 20px
  3xl: 28px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  button:
    radius: '{rounded.sm}'
    case: uppercase
    fontWeight: 600
    letterSpacing: 0.05em
  input:
    background: '{colors.surface-alt}'
    border: '{colors.border}'
    radius: '{rounded.sm}'
    focusBorder: '{colors.focus}'
  card:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.lg}'
  badge:
    radius: '{rounded.xs}'
    case: uppercase
    style: 1px solid border in the semantic colour, tinted fill
  sidebar:
    width: 208px
    collapsedWidth: 52px
    activeRule: 2px left border in accent
---

# Operator Terminal — DESIGN.md (v4)

The canonical visual system for the binance-trading-bot web app (`apps/web`). Token values live in `apps/web/src/styles/app.css` (the `[data-theme='dark']` block) — that file is the source of truth; the values above mirror it.

**v4 "Fluid Terminal"** keeps v3's information architecture and behavioural rules unchanged and softens the **visual geometry**: v2/v3's flat 0px corners become a modest rounded scale (crisp on dense surfaces — tables, inputs, badges — softer on cards and modals), the modal's hard offset shadow becomes a blurred elevation shadow, and the two self-hosted type families move from Space Grotesk / JetBrains Mono to **IBM Plex Sans Thai** / **IBM Plex Mono** — the Sans Thai family adds first-class Thai-script support (matched metrics with its own Latin glyphs, so an English/Thai mixed string never mixes x-heights) alongside the same numeric mono. See "What changed from v3" below for the full list; everything under Colours/Layout/Do's and Don'ts that isn't called out there is unchanged from v3.

**v3 "Unified Terminal"** kept the v2 visual language unchanged (colours, typography, cards, tables below) and changed the **information architecture**: an overview dashboard at `/` plus a dedicated route per surface. A selected symbol opens its workspace at `/profiles/:id/symbols/:SYMBOL` (a full-width view with a symbol switch rail, `?tab` selecting trade/orders/market/logs); every per-profile editor (config, api-key, notifications, discovery, risk, bulk-order) and history, and backtest are their own routes, reached with `‹ Back`. Plus the new-profile wizard, login/onboarding, and the System utility pages. See the Layout section.

## What changed from v3

- **Corners:** flat 0px → a modest rounded scale (`xs` 4px badges, `sm` 6px buttons/inputs, `md` 8px, `lg` 12px cards, `xl` 16px, `2xl`/`3xl` for larger surfaces). Dots, pills, and switches keep `rounded-full` as before — nothing there changed.
- **Shadow:** the modal's hard offset (`6px 6px 0 #000`) → a soft blurred elevation shadow (two stacked low-opacity blurred layers). Still the only shadow in the system — one deliberate elevation signal, not per-surface tuning.
- **Type:** Space Grotesk Variable / JetBrains Mono Variable → **IBM Plex Sans Thai** / **IBM Plex Mono**, both self-hosted via `@fontsource` (per-weight static files, not variable — IBM Plex doesn't ship variable builds). IBM Plex Sans Thai's weight files each bundle Latin + Thai (+ cyrillic-ext) glyphs as separate `@font-face` `unicode-range` blocks under one family name, so importing it is enough for both scripts — no separate Thai stack, no mismatched metrics when a string mixes English and Thai.
- **Density and behaviour are unchanged.** This is a corner-and-shadow-and-type pass, not a re-architecture — colours, layout, panels, tables, and every product rule below carry forward from v3 as-is.

v2 superseded **v1 "Operator Console"**; v1's _behavioural_ rules carry forward unchanged. v2 replaced the _visual language_ with a Bauhaus-inspired terminal aesthetic (reference: a TRADEX terminal mock and PRD supplied by the operator — used as a direction, not copied).

## What changed from v1, and what deliberately did not

**Changed (visual language):**

- Palette: blue/mint accents → a single **amber-yellow accent** (`#ffcc00`, always with black text/icons on it) for selection, commit, active nav, and focus. Signal green `#00e070` for positive/go, signal red for negative/stop, orange for warnings.
- Canvas: `#0c0d10` → a flatter near-black `#0e0e0e` ramp with **hairline 1px borders** doing more of the separation work.
- Corners: **square** (0px radius) everywhere except dots, pills, and switches (`rounded-full` survives). Density over softness.
- Type: system sans → **Space Grotesk Variable** for UI text; JetBrains Mono (now self-hosted) stays for numbers. Buttons, badges, table headers, and micro-labels are uppercase with letter-spacing.
- Chrome: the header gains a 2px accent bottom rule and an accent wordmark block; desktop gains a **collapsible left sidebar** (global nav; collapses to an icon rail, persisted in localStorage). The slim bottom status bar stays.
- Top bar status cluster: the header carries the global monitoring readout — live unrealised P/L per quote, a worker-health LED, and the **global kill switch** (see Layout). The operator never leaves the current view to know, or stop, what the bot is doing.
- Modals: 2px accent border + hard offset shadow (`6px 6px 0 #000`) — no soft shadows, no blur, no gradients.

**Kept from v1 (these are product invariants, not aesthetics):**

- **Mobile-first usability.** Every view remains fully usable at 375×667. The sidebar is desktop-only; mobile keeps the bottom tab nav. Density never costs a tap target (≥44px) or forces horizontal scrolling of prose.
- **Plain language + glosses.** The operator is not a finance professional; trading terms keep their inline gloss the first time they appear.
- **Colour means something.** Yellow = selection/action, green = positive/go, red = negative/stop, orange = warning. Grey otherwise. Every colour is paired with a glyph or word (`+`/`−`, `▲`/`▼`) for colour-blind safety.
- **Honest numbers.** Real-money and testnet figures stay separate; partial sums are labelled partial.
- **No feature loss.** v2 restyles and re-chromes; it does not remove screens, actions, or data. (The reference mock's TRADEX branding is **not** adopted: the app keeps its own name. The account-wide kill switch, first rejected, **is** adopted per the operator's unified-terminal PRD — but only in the stop direction: it confirm-gates, then fans the per-profile kill switch out to every profile still trading. It lives on the Account settings page, and resuming stays a deliberate per-profile act.)

## Colours

| Token | Hex | Role |
| --- | --- | --- |
| `canvas` | `#0e0e0e` | App background. |
| `surface` | `#141414` | Card / panel fill, one step up. |
| `surface-alt` | `#1a1a1a` | Raised input fill, zebra row, hover. |
| `border` | `#2a2a2a` | Hairline panel borders / dividers. |
| `border-strong` | `#3a3a3a` | Emphasised dividers, off-track switch. |
| `skeleton` | `#303030` | Loading-placeholder fill. Separate from `surface-alt`, which also paints zebra rows and hover — a placeholder only has to be perceivable, not readable. |
| `text` | `#e8e8e8` | Default body and numeric text. |
| `text-emphasis` | `#ffffff` | Emphasised values. |
| `text-muted` | `#9a9aa0` | Labels, captions, metadata. (Lifted vs the mock's `#888` for legibility.) |
| `accent` | `#ffcc00` | THE terminal accent: active nav, selected row rule, SAVE / commit, focus. Black ink on it. |
| `primary` | `#00e070` | Positive + irreversible "go": RUN, BUY, positive P/L. Black ink on it. |
| `danger` | `#ef4f3c` | Destructive + stop: kill-switch, delete. (Slightly lifted vs the mock's `#e63b2e` for text contrast on near-black.) |
| `up` / `down` | `#00e070` / `#ff6257` | P/L direction text. |
| `warning` | `#ff8c00` | Caution badges/banners. Dark ink on it. |
| `focus` | `#ffcc00` | Keyboard focus ring / focused input border. |

Light theme remains a functional fallback (`[data-theme='light']`): same semantics, amber accent darkened for contrast on white.

## Typography

Two self-hosted static families (`@fontsource/*`, no CDN — IBM Plex doesn't ship variable builds, so each weight is its own imported file: 400/500/600/700 for each family): **IBM Plex Sans Thai** for everything readable — prose, labels, headings, buttons. One family renders both English and Thai with matched metrics, so a mixed-language string (e.g. a Thai label next to an English ticker) never mixes x-heights or baselines. **IBM Plex Mono** for numbers and code — prices, amounts, P/L, timestamps, ids — always with `"tnum" 1, "zero" 1` via the `.font-mono` utility.

Terminal case rules: buttons, badges, table column headers, nav items, and panel micro-labels are **uppercase, 11–12px, letter-spaced**. Page headings and body prose stay sentence case — a wall of caps is hostile to a non-pro reader.

## Layout

- **App chrome.** Desktop: header (accent wordmark block + profile switcher + status cluster + account/theme controls) over a `sidebar | main` split, with the slim status bar at the bottom. The sidebar groups global destinations under uppercase section labels (Monitor / Profiles / System), marks the active route with a 2px accent left rule, and collapses to a 52px icon rail (state persisted). Mobile: top bar + bottom tab nav, unchanged structure from v1.
- **Top bar status cluster** (`TopBarStatus`). Right side of the header: unrealised P/L per quote (live profiles only — practice funds never sum into the headline), a health LED (`Bot live` green / `Restart needed` amber on build skew or migration lag / `Bot down` red when the worker heartbeat is missing), and the kill switch. P/L + LED are `md+`; the kill switch renders at every size — an emergency stop must work from a phone. The kill switch opens a confirm dialog listing every profile still trading (live profiles flagged red), then fans the per-profile `disable-all` endpoint out to all of them; failures stay listed in the dialog, and when everything is stopped the button gives way to an `All stopped` badge.
- **Single dashboard, three zones (v3).** `/` is the only monitoring surface. Its state is the URL, so every view is deep-linkable and back-button-correct:
  - **Overview** (base layer, always present): a thin KPI band then the cross-profile symbol grid. On `md+` each row is an aligned data-grid line (dot · symbol · status · profile · position · orders · price · unrealised P/L · CONFIG) under uppercase column headers; when the table's own box is narrow (a container query, not the viewport — so it also collapses inside the workspace's sidebar inset) the same DOM collapses to the two-line stacked row that fits 375px. The symbol name is the row's stretched navigation link to the symbol workspace route; a CONFIG action routes to that symbol's config page.
  - **Workspace** (`/profiles/:id/symbols/:SYMBOL`): the tabbed symbol detail (trade / orders / market / logs via `?tab`) is a full-width route — a compact cross-profile **switch rail** (`md+`) beside the workspace, so every other symbol is one click away. The view fills `main` only: the top-bar kill switch must stay reachable while a symbol is open, so it never covers the header. Below `md` the rail hides and the workspace is full-bleed (the header switcher covers hopping). Each zone scrolls on its own; the shell drops `main`'s scroll+padding for this route (matched by leaf route id) and for `/`.
  - **Per-profile editor pages.** config, api-key, notifications, discovery, risk, and bulk-order are each their own route under `/profiles/:id/…`, reached from the sidebar's expanded profile or, on a phone, the **Profiles** sheet. The symbol-config editor is `/profiles/:id/symbols/:SYMBOL/config`, nested under the workspace route and returning to it via the breadcrumb's symbol rung. History (archive/audit/activity tabs) and backtest are likewise routes.
- **Route model.** Every surface is a TanStack route; the only dashboard-side search param is the workspace's `?tab` (`.catch(undefined)` → the default trade tab). Old `/profiles/:id/{config,api-key,…}` and `?sym`/`?edit` bookmarks have been replaced by these routes.
- **Importance tiers** (what lives where, by how often the operator needs it):

  | Tier | Surface | Reached by |
  | --- | --- | --- |
  | 1 — monitor | Overview grid + KPI band | `/` |
  | 2 — act on a symbol | Workspace (trade/orders/market/logs) | `/profiles/:id/symbols/:SYMBOL` |
  | 3 — review/history | History (archive/audit/activity), discovery, balances | their routes |
  | 4 — edit config | config / api-key / notifications / risk / bulk-order | their routes |
  | 5 — occasional | Backtest, new-profile wizard | their routes |
  | System | Account, Dust transfer, Backup & restore, Orphan orders | side nav |

- **Page shell.** Every non-overview surface shares one shell: `Page` (vertical rhythm; the app shell owns the padding) + `PageHeader` (title, optional profile-name meta, optional `‹ Back`). No "back to terminal" wording. Login, onboarding, and the new-profile wizard are full-screen flows.
- **Panels.** Every editor/settings section is one `Panel` (`shared/components/panel.tsx`): a `bg-elevated` box, 1px `border`, **`rounded-lg` corners**, then a header (title + optional one-line description) over a `border` hairline, then the body at `p-4`. Depth = border + fill ramp; no shadow except the modal elevation. This is the single section container across config, risk, notifications, gate, discovery, and the account pages. Panels stack in a `space-y-4`/`space-y-6` column and span the surface full width — no `max-w-*` cap on editor pages, and no page-level box wrapping a stack of panels (the panel border is the only section chrome).
  - **Collapsible only if it already was.** A panel shows a chevron and renders a `<details>` disclosure ONLY when its content was already collapsible; content that was always visible stays a static `<section>` header. The chevron must never lie about what a click does.
  - **Open by default.** A collapsible panel holding live/enabled config opens on first render (`defaultOpen`) so the operator reads its values without a click. The deliberately-tucked "Advanced settings" fold is the one exception and stays collapsed.
  - **Generated forms.** The config `AutoForm` is the reference: object groups are collapsible panels, loose top-level fields bucket into one static "Core settings" panel, and `@ui:advanced` fields fold under one closed "Advanced settings" disclosure.
- **Cards.** `Card` (`ui/card`) remains only for dashboard tiles and other non-settings surfaces. Do not reach for it to box a settings section — that is the `Panel`.
- **Tables.** Uppercase 11px letter-spaced muted column headers; tabular mono cells; zebra rows; hover fill; selected row = 2px accent left rule + `surface-alt` fill. Numeric columns right-aligned.
- **Tabs.** The workspace tab strip uses a 2px accent bottom border on the active item — the in-page analogue of the reference's panel tabs. In-page toggles (history's archive/audit/activity, and the Net/Gross and period filters) share the one `ui/tabs` segmented control. (The old per-profile `ProfileSectionsNav` strip is gone with the standalone profile pages.)
- **Scrollbars.** Thin (6px), surface track, `border-strong` thumb.

## Do's and Don'ts

**Do**

- Put black ink on yellow/green fills — never white.
- Keep yellow exclusive to selection/action; green exclusive to positive/go.
- Use hairline borders for separation before reaching for whitespace.
- Keep every tap target ≥44px even where the visual density tightens.
- Pair colour with a glyph or word; gloss trading terms inline.
- Wrap every settings section in the shared `Panel` with a title and a one-line description; let its content default to open.

**Don't**

- Don't reach past the `rounded` scale — badges/inputs/buttons stay tight (`xs`/`sm`), cards and modals stay `lg`/`xl`. No ad hoc radius values, and no fully-rounded surfaces beyond dots, pills, and switch thumbs.
- Don't add gradients or a second shadow; the only shadow is the elevation blur on modals, and it isn't reused elsewhere.
- Don't uppercase prose or page headings.
- Don't nest a `Panel` in a `Card`, wrap a column of panels in a page-level box, or give a collapse chevron to content that was never collapsible.
- Don't sum test and live funds into one number.
- Don't let the top-bar kill switch do anything but stop: it is a one-way emergency brake. Resuming a profile is a deliberate act on that profile's own page — no global resume, ever.
