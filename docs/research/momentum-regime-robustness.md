# Momentum strategy: the search for a regime-robust config

**Status: open problem.** This log exists so we don't re-run the same failed experiments twice. It records what was tried, the real backtest numbers, and why each attempt was rejected — for the `momentum` strategy (`packages/strategy/momentum`) on a 25-symbol USDT basket, daily candles, `direction: 'both'` (flips directly between long and short on an EMA cross).

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

## Recommended next directions (not yet attempted)

1. **Market-wide regime signal, not per-symbol.** One indicator — e.g. BTC's own long-term trend, or basket breadth (% of the 25 symbols above their own trend line) — decides whether the WHOLE portfolio is biased long, biased short, or reduced/paused, instead of 25 independent per-symbol gates that happen to correlate. This is the current front-runner: reuses most of the existing plumbing, just moves the gate from "per-symbol tick" to "portfolio-level bias applied once per tick cycle."
2. **Accept regime-specificity, add a portfolio allocator.** Keep this config as a bear/chop specialist; wrap it with an allocator that reduces size or pauses trading when regime conditions are unfavorable, rather than trying to make the underlying signal itself regime-proof.
3. **A second, different strategy for bull markets** (e.g. a breakout/momentum long-only system tuned for trending-up conditions), switched by a regime classifier — genuinely different tools for genuinely different market character, instead of forcing one EMA-cross engine to do both jobs.

## Methodology notes (for whoever continues this)

- All backtests in this log were run against REAL Binance historical klines (the backtest engine always replays production market data, even though live trading in this project is testnet-only) via the app's own API: create a throwaway profile (`POST /api/accounts/:id/profiles`), launch a backtest (`POST /.../profiles/:id/backtests` with `strategyConfigOverride` for one-off variants), poll until `status:'done'`, read `result.metrics` / `result.outOfSample` / `result.dataWarnings` / `result.perSymbol` / `result.decisionBreakdown`, then delete the profile. No UI needed — this is much faster than the wizard for parameter sweeps.
- Fixed window anchor used throughout for comparability: `now = 1788614443862` (2026-09-05T13:20:43Z). Bear window = `[now − 365d, now]`; bull window = `[now − 730d, now − 365d]`.
- `momentumRequiredWindow()` (`packages/strategy/momentum/src/index.ts`) automatically extends the backfilled history to cover a trend filter's period — confirmed via `decisionBreakdown.metrics` (`momentum.skip` counts by reason) that period=200 never returned `insufficient-history`, ruling out a warmup-window bug as the cause of its failure.
- The backtest engine's leverage/margin-call gap (no liquidation model) is tracked as its own follow-up in the wider roadmap plan (`~/.claude/plans/swirling-popping-reddy.md`, Phase 2) — worth doing before trusting any future leveraged-live decision.
