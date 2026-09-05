// The "smart" quick-start path: instead of a fixed risk tier, backtest a
// candidate coin basket at a couple of candle intervals over a recent window
// and let the actual result pick both which coins to bind and how often to
// trade (the interval) — literally the ccxt/binance-trade-bot-style "just
// run it and see" the user asked for, built entirely on the app's own
// existing backtest engine (packages this repo already ships and tests), not
// a new simulator.

import { asDecimalString } from '@app/contracts';
import type { BacktestInterval, BacktestParams } from '@app/contracts';

/**
 * A fixed, liquid USDT-major universe — not a live scan. Avoids
 * re-implementing Discovery's own liquidity/spread screening just to pick a
 * candidate set; every one of these is deeply liquid on Binance by
 * construction.
 */
export const SMART_PRESET_CANDIDATES: readonly string[] = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'LINKUSDT',
  'AVAXUSDT',
  'DOTUSDT',
];

/**
 * The interval choices tested; "how often to trade" per the user's own
 * framing. Empirically, on this candidate basket, 1h trades so often that
 * fees alone drag the profit factor well under 1 — 4h and 1d are the two
 * that hold up.
 */
export const SMART_PRESET_INTERVALS: readonly BacktestInterval[] = ['4h', '1d'];

/**
 * The single interval a risk-tier preset's backtest PREVIEW runs at. Daily —
 * NOT `defaultTTConfig`'s own 1h — because 1h's trade frequency on this
 * candidate basket eats its own edge in fees before the Live-gate's
 * thresholds are anywhere close to reach; see `SMART_PRESET_INTERVALS`. No
 * sweep: unlike Smart, a risk tier does not pick its own interval, so
 * testing more than one would answer a question the preset itself never
 * asks.
 */
export const PRESET_TIER_INTERVALS: readonly BacktestInterval[] = ['1d'];

/** How many of the best-backtested candidates to actually bind, at most. */
export const SMART_PRESET_MAX_SYMBOLS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * A full year: enough history to cover more than one market regime (not just
 * whatever the last month and a half happened to look like), which is also
 * what makes the out-of-sample holdout (the most recent ~30% the run carves
 * off) a genuinely different stretch of market than the in-sample portion
 * instead of a few adjacent weeks of the same trend.
 */
export const SMART_PRESET_WINDOW_DAYS = 365;

/**
 * A detail interval strictly finer than each strategy interval this module
 * ever requests — `detailInterval === strategyInterval` is legal (the schema
 * only requires finer-or-equal) but the engine flags it as a data-quality
 * warning ("intra-candle fill ordering is assumed favorably"), which alone
 * fails the Live-gate's data-coverage check regardless of how the strategy
 * performs. A few steps finer (not the finest available) keeps the extra
 * simulated candles bounded on a 365-day run.
 */
const FINER_DETAIL: Readonly<Record<BacktestInterval, BacktestInterval>> = {
  '1m': '1m',
  '3m': '1m',
  '5m': '1m',
  '15m': '5m',
  '30m': '5m',
  '1h': '15m',
  '2h': '15m',
  '4h': '1h',
  '6h': '1h',
  '8h': '1h',
  '12h': '1h',
  '1d': '4h',
  '3d': '4h',
  '1w': '1d',
};

/** One backtest request for the given interval, testing every candidate at once. */
export const smartPresetBacktestParams = (
  interval: BacktestInterval,
  strategyConfigOverride: Record<string, unknown>,
): BacktestParams => {
  const toMs = Date.now();
  const fromMs = toMs - SMART_PRESET_WINDOW_DAYS * DAY_MS;
  return {
    symbols: [...SMART_PRESET_CANDIDATES],
    fromMs,
    toMs,
    strategyInterval: interval,
    detailInterval: FINER_DETAIL[interval],
    initialQuoteBalance: asDecimalString('1000'),
    // Binance's standard (non-BNB-discounted) spot maker/taker; a deliberately
    // unflattering assumption so the picked coins clear a real cost bar.
    fees: { makerBps: 10, takerBps: 10 },
    slippageBps: 5,
    // A modest, non-zero spread and participation cap — not zero (the
    // engine's own "no spread/volume-cap modeled" warnings), not aggressive
    // enough to swamp the signal. Clears the data-coverage gate check
    // honestly rather than by picking the friendliest (zero-friction)
    // simulation.
    spreadBps: 5,
    volumeCapPct: 2,
    strategyConfigOverride,
    // These are picked by backtested performance, not live Discovery adds —
    // the discovery-entry exit regime does not apply here.
    discoveryMode: false,
  };
};
