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

/** The interval choices tested; "how often to trade" per the user's own framing. */
export const SMART_PRESET_INTERVALS: readonly BacktestInterval[] = ['1h', '4h'];

/**
 * The single interval a risk-tier preset's backtest PREVIEW runs at —
 * `defaultTTConfig`'s own candle interval (see
 * `packages/strategy/trailing-trade/src/schema.ts`). No sweep: unlike Smart,
 * a risk tier does not pick its own interval, so testing more than one would
 * answer a question the preset itself never asks.
 */
export const PRESET_TIER_INTERVALS: readonly BacktestInterval[] = ['1h'];

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
    detailInterval: interval,
    initialQuoteBalance: asDecimalString('1000'),
    // Binance's standard (non-BNB-discounted) spot maker/taker; a deliberately
    // unflattering assumption so the picked coins clear a real cost bar.
    fees: { makerBps: 10, takerBps: 10 },
    slippageBps: 5,
    strategyConfigOverride,
    // These are picked by backtested performance, not live Discovery adds —
    // the discovery-entry exit regime does not apply here.
    discoveryMode: false,
  };
};
