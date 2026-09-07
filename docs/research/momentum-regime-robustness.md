# Momentum strategy: the search for a regime-robust config

**Status: meaningful progress, not fully solved.** `regimeFilter` at period 50 (see below) is the best-known config so far — genuinely better than every prior attempt, still not a full fix. This log exists so we don't re-run the same failed experiments twice. It records what was tried, the real backtest numbers, and why each attempt was rejected — for the `momentum` strategy (`packages/strategy/momentum`) on a 25-symbol USDT basket, daily candles, `direction: 'both'` (flips directly between long and short on an EMA cross).

## The goal

A config that stays profitable (or at least doesn't badly lose to buy-and-hold) across **both** bull and bear regimes, since the bot is meant to run 24/7 without knowing in advance which regime is coming. Ultimately: real futures execution (long _and_ short, leveraged) that wins in any market condition — not just a backtest that looks good on one lucky window.

## Baseline: the "both direction" discovery

Symbols: `BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT, ADAUSDT, DOGEUSDT, TRXUSDT, AVAXUSDT, LINKUSDT, DOTUSDT, LTCUSDT, BCHUSDT, UNIUSDT, ATOMUSDT, ETCUSDT, XLMUSDT, NEARUSDT, FILUSDT, APTUSDT, ARBUSDT, OPUSDT, INJUSDT, SUIUSDT, TONUSDT` (top-liquidity USDT pairs; TONUSDT has a known data gap — 298/365 candles, ~82% coverage, flag it whenever it shows up in a result).

Config: `momentum`, `direction: 'both'`, `ema: {fast: 5, slow: 13}`, `trailingStopPct: '0.05'`, `entrySizing: {mode:'fixed', amount:'15'}`, `candleInterval: '1d'`. Backtest params: `initialQuoteBalance: '1000'`, `fees: {makerBps:10, takerBps:10}`, `slippageBps:5`, `spreadBps:5`, `volumeCapPct:10`, `detailInterval:'1h'`.

On the trailing 365 days (a bear year for this basket, hold return −57.6%), this config clears all 7 live-enablement gate criteria: +13.7% return, PF 2.47 in-sample / 3.18 out-of-sample, 244 trades / 33 OOS trades, alpha +71.3% / +3.6%, max drawdown −4.9%.

**This result does NOT generalize.** See below.

## The core finding: it's regime-specific, not robust

Same exact config, same basket, tested on the PRIOR 365-day window (a bull year for this basket, hold return +70.4%):

| Metric                | Bear year (already-tested) | Bull year (prior 365d) |
| --------------------- | -------------------------- | ---------------------- |
| Total return          | +13.7%                     | +17.1%                 |
| Alpha vs. basket-hold | **+71.3%**                 | **−53.2%**             |
| OOS alpha             | +3.6%                      | −5.7%                  |
| Profit factor         | 2.47                       | 1.82                   |
| Trades                | 244                        | 283                    |

In the bull year the strategy still returns +17% in absolute terms, but **loses to simply holding the basket by 53 percentage points** — the `direction: 'both'` EMA-flip gets whipsawed into repeated bad shorts against a sustained uptrend (the EMA cross alone can't distinguish a real reversal from a pullback). A gate that only ever saw the bear year would never catch this: the live-enablement gate's out-of-sample check only guards against curve-fitting _within_ one window, not against a strategy that is simply regime-specific.

**Combining both years (2-year window) still "passes" the gate** (alpha +44.8% in-sample, +14.6% OOS) — the bear year's edge drags the average up and hides the bull-year failure. This is the dangerous case: a config that looks fine on a multi-year backtest but would have badly underperformed if deployed live at the start of the bull year specifically.

## Leverage findings (orthogonal, still valid)

Tested 1x/2x/3x/10x/20x (entrySizing scaled to $15/$30/$45/$150/$300) on the bear-year window only:

| Leverage | Return  | Max DD | OOS alpha | OOS PF | Gate      |
| -------- | ------- | ------ | --------- | ------ | --------- |
| 1x       | +13.7%  | −4.9%  | +3.6%     | 3.18   | clears    |
| 2x       | +27.4%  | −9.7%  | +5.7%     | 3.18   | clears    |
| 3x       | +41.0%  | −14.3% | +7.5%     | 3.18   | clears    |
| 10x      | +150.9% | −43.8% | +4.4%     | 3.10   | clears    |
| **20x**  | +292.1% | −77.8% | **−1.1%** | 1.92   | **fails** |

Return/drawdown scale together almost linearly up to 10x; at 20x the out-of-sample edge genuinely breaks (not just bigger losses — the strategy stops working). Separately: this backtest engine has **no margin-call / liquidation model** — leverage here is just a bigger cash-funded order, capped only by a flat `MAX_LEVERAGE = 3` constant on the short side (`packages/strategy/backtest/src/ohlcv-fill.ts`). A real leveraged futures position would likely be forcibly liquidated intraday, at a worse price than this daily-close simulation ever sees — treat 10x/20x numbers as optimistic.

## Failed fix attempts (all tested on both the bear and bull windows)

Every one of these was a real backtest, not a guess. None solved the regime-dependency problem; several made it worse.

| Attempt | Bear result | Bull result | Verdict |
| --- | --- | --- | --- |
| **Long-only** (`direction:'long'`) | Return **−30.0%**, PF 0.24 (real loss) | Return +28.0%, alpha −42.4% | Worse — loses money in the regime it should protect |
| **Margin-band** (`entryMarginPct: 0.02`) | Alpha +71.4% (looks OK) but OOS PF 0.10 | Return −42.4%, alpha **−112.8%**, DD −80% | Catastrophic in bull year |
| **Slow EMA** (20/50 instead of 5/13) | Alpha +79.5% but OOS trades 14 (< 20 min) | Alpha **−74.4%**, worse than baseline | Fails OOS trade-count gate too |
| **Trend gate, period=200** (symmetric long+short macro filter, see below) | Return **−4.9%**, PF **0.085** | Return **−91.7%**, alpha **−162%**, DD **−136.8%** | Catastrophic both ways |
| Trend gate period=200 + `accountCap` 20% | Return −0.4%, PF 0.11 | _(not re-tested — bear alone showed no meaningful fix)_ | Confirms the failure is trade **quality**, not position concentration |
| **Trend gate, period=50** | Return **+15.5%**, PF **3.09** (beats baseline) | Alpha **−89.4%**, DD −50.6% | Best of the trend-gate variants, still fails the actual goal |
| **Trend gate, period=100** | Return +4.8%, PF 0.36 | Alpha **−121.6%**, DD −71.5% | Worse than both 50 and baseline |

### The trend-gate feature (implemented, committed, off by default)

`packages/strategy/momentum/src/tick.ts` + `schema.ts`: extended the existing long-only `trendFilter` block to gate the SHORT leg symmetrically — a short may only open below the trend line (mirror of the long gate's "only above the line"), with a symmetric slope veto (`requireRising` now checks the line is _falling_ for a short). Fully tested (`packages/strategy/momentum/__tests__/momentum.test.ts`, new `describe` blocks for the short leg and for `direction:'both'` symmetry), typechecked, and **committed** (`feat(momentum): extend macro trend filter to gate the short leg symmetrically`) since the mechanism itself is correct and doesn't change any existing config's behavior (`trendFilter` stays `enabled: false` by default).

**The mechanism works as designed. It does not fix the regime problem.** Across three tested periods (50/100/200), every single one made the bull-year alpha worse than not filtering at all, and the damage scales monotonically with period length (both in the bull year AND the bear year — longer periods are strictly worse in both regimes). Root cause understood: gating a fast EMA(5,13) signal with a much slower, single-symbol SMA crossing tends to admit only late/exhausted entries once the slow line finally catches up — and per-symbol gating on a shared macro turning point correlates entries across the whole basket (confirmed via per-symbol P&L: 23/25 symbols lost money together in the period=200 bull-year blowup, not one broken symbol).

## Why `accountCap` didn't help

`packages/strategy/momentum/src/sizing.ts` already wires `accountCap` into BOTH long and short entry paths (`tick.ts:356` and `tick.ts:714`) — it is not a long-only mechanism, despite the "deployed cost basis" naming. But it caps **cost-basis at entry**, never revalued — `packages/strategy/core/src/balances.ts`'s `accountEquity()` is `cash + Σ(entry-price × qty)`, fixed at each position's entry value. The real mark-to-market equity (`BacktestExecutor.equityInQuote()`, `packages/strategy/backtest/src/executor.ts`) marks every open position at the CURRENT price, including deeply-underwater shorts. A basket of correlated shorts can be fully within cap at entry and still craters equity as they move against you — the cap has no feedback loop to real P&L, so it does not prevent the concentration blowup, it just delays it slightly (bear-year PF only moved from 0.085 to 0.11 with the cap on — still broken).

## Conclusion (as of this writing)

A single per-symbol technical filter — trend gate at any tested period, long-only, wider confirmation margin, slower EMA — **cannot** make this fast EMA-cross strategy regime-robust. The failure mode is structural: the strategy has no way to know "the market has changed character," only "this one symbol crossed this one line," and by the time enough symbols cross together to look like a regime shift, the move is often already exhausted or the correlated entries compound risk instead of diversifying it.

## `regimeFilter`: a market-wide (BTC-anchored) gate — meaningful progress, not a full fix

Implemented as the first of the three "next directions" below: a NEW, independently-toggleable config block (`regimeFilter`, alongside the existing `trendFilter`) that gates every symbol's entries off ONE shared reference market's own trend — BTC — instead of 25 per-symbol decisions that happen to correlate. Mechanically: `Strategy.capabilities.referenceSymbol` (new, static per plugin) tells the worker/backtest engine to also supply BTC's own candles on every tick via a new `TickInput.reference` field, regardless of which symbol is being evaluated; `regimeGate()` (`packages/strategy/momentum/src/tick.ts`) compares BTC's OWN price to BTC's OWN trend line, and blocks whichever side (long/short) disagrees with it. Backtest-only for now — the live worker does not yet stream a pinned BTC feed, so `regimeFilter.enabled: true` on a LIVE profile fails every entry closed (safe, not silently wrong, but not tradeable yet either).

Full period sweep, same bear/bull windows as every other experiment above:

| Period | Bear return | Bear alpha | Bear PF | Bear OOS (alpha/PF/trades) | Bull return | Bull alpha | Bull PF | Bull OOS (alpha/PF/trades) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _no filter (baseline)_ | +13.7% | +71.3% | 2.47 | +3.6% / 3.18 / 33 | +17.1% | −53.2% | 1.82 | −5.7% / 1.82\* / 283\* |
| **50** | **+18.7%** | **+74.5%** | **3.01** | −1.5% / 2.51 / 12 | **+23.0%** | **−47.4%** | **1.35** | **−4.5% / 2.94 / 34** |
| 100 | +3.5% | +59.3% | 1.09 | +9.5% / 0 / 2 | −24.4% | −94.7% | 0.45 | +3.3% / 3.34 / 37 |
| 200 | −15.9% | +40.0% | 0.52 | +24.7% / — / 0 | −30.6% | −101.0% | 0.30 | −3.3% / 4.79 / 19 |

_(\*baseline bull-year OOS profit factor/trade count shown is the overall figure; see the Failed fix attempts table above for the exact baseline row)_

**Period 50 is the clear, unambiguous winner** — coincidentally (or not) the same period that was also the best-of-a-bad-lot for the old per-symbol `trendFilter` sweep. 100 and 200 both fail badly in BOTH years, the same non-monotonic "50 good, 100 bad, 200 worse" pattern seen before, now confirmed on a structurally different mechanism — worth treating as a real property of this basket/EMA(5,13) pairing, not a coincidence to wave away.

**Honest assessment of period=50:** this is the best result of the entire investigation, and a genuine, meaningful improvement — not a full fix.

- Bear year: beats the no-filter baseline outright (higher return, higher alpha, higher PF, half the trades for the same or better edge).
- Bull year: total return is POSITIVE (+23.0%) for the first time on any gated variant, and out-of-sample finally has a trustworthy sample size (34 trades, clearing the 20-trade minimum for the first time in a bull window) with alpha nearly flat (−4.5%) and PF a healthy 2.94.
- **But full-window bull alpha is still negative (−47.4%)** — better than baseline's −53.2% and dramatically better than every per-symbol attempt (−89% to −162%), but still a real underperformance against a fee-free +70%-return buy-and-hold. This is a large bar: no risk-managed active strategy should be expected to fully close a 70%-in-one-year gap. The practical read is that `regimeFilter` at period 50 converts "loses badly in a strong bull year" into "makes real money in a strong bull year, just less than doing nothing would have" — a materially different, much more defensible risk profile, not a solved problem.

## Recommended next directions

1. ~~Market-wide regime signal, not per-symbol~~ — **done, see above.** `regimeFilter` at period 50 is now the best-known config; further tuning of ITS OWN parameters (`requireRising` slope veto untested, `maType:'ema'` untested) is a natural next cheap experiment before moving to something structurally new.
2. **Wire it live.** The mechanism is proven in backtest; the live worker still needs a pinned BTCUSDT subscription (`apps/worker/src/market-data/subscriptions-manager.ts`) to actually populate `TickInput.reference` outside a backtest — see the wider roadmap plan (`~/.claude/plans/swirling-popping-reddy.md`) for where this fits alongside the Futures execution work.
3. **Accept the remaining gap, add a portfolio allocator.** period=50 narrows but doesn't close the bull-year underperformance; a size-reducing or pausing allocator layered on top (rather than a pure entry-time gate) could close more of the remaining gap without another architecture change.
4. **A second, different strategy for strong bull markets**, switched by a regime classifier — still viable if 1–3 plateau, but no longer the only path forward now that (1) has shown real, measurable progress.

## Methodology notes (for whoever continues this)

- All backtests in this log were run against REAL Binance historical klines (the backtest engine always replays production market data, even though live trading in this project is testnet-only) via the app's own API: create a throwaway profile (`POST /api/accounts/:id/profiles`), launch a backtest (`POST /.../profiles/:id/backtests` with `strategyConfigOverride` for one-off variants), poll until `status:'done'`, read `result.metrics` / `result.outOfSample` / `result.dataWarnings` / `result.perSymbol` / `result.decisionBreakdown`, then delete the profile. No UI needed — this is much faster than the wizard for parameter sweeps.
- Fixed window anchor used throughout for comparability: `now = 1788614443862` (2026-09-05T13:20:43Z). Bear window = `[now − 365d, now]`; bull window = `[now − 730d, now − 365d]`.
- `momentumRequiredWindow()` (`packages/strategy/momentum/src/index.ts`) automatically extends the backfilled history to cover a trend filter's period — confirmed via `decisionBreakdown.metrics` (`momentum.skip` counts by reason) that period=200 never returned `insufficient-history`, ruling out a warmup-window bug as the cause of its failure.
- The backtest engine's leverage/margin-call gap (no liquidation model) is tracked as its own follow-up in the wider roadmap plan (`~/.claude/plans/swirling-popping-reddy.md`, Phase 2) — worth doing before trusting any future leveraged-live decision.
