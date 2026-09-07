/**
 * Regime-filter config coercion, mirroring trend-filter.ts's pattern for the
 * SAME reason: the live worker reads config unparsed, so a partial override
 * can reach the tick with `period`/`maType` undefined. Kept as a separate
 * file (not a shared helper with trendFilter) because the two blocks default
 * `period` differently — 30 here, not 200 — reflecting a real backtest
 * fine-tune sweep (30/40/50/60/70/100/200) that found the best-balanced
 * result at 30, with a bumpy, non-smooth landscape and a sharp falloff
 * beyond ~60 (see docs/research/momentum-regime-robustness.md).
 */

/** Reference-market trend-line lookback as a finite int >= 2, else the 30 default. */
export const regimePeriod = (raw: unknown): number => {
  const n = Number.parseInt(String(raw ?? 30), 10);
  return Number.isFinite(n) && n >= 2 ? n : 30;
};

/** Moving-average type; anything but 'ema' reads as 'sma'. */
export const regimeMaType = (raw: unknown): 'sma' | 'ema' => (raw === 'ema' ? 'ema' : 'sma');
