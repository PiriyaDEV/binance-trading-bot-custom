/**
 * Regime-filter config coercion, mirroring trend-filter.ts's pattern for the
 * SAME reason: the live worker reads config unparsed, so a partial override
 * can reach the tick with `period`/`maType` undefined. Kept as a separate
 * file (not a shared helper with trendFilter) because the two blocks default
 * `period` differently — 50 here, not 200 — reflecting the real backtest
 * finding that a market-wide regime gate performs best at a much shorter
 * period than a per-symbol trend gate ever did.
 */

/** Reference-market trend-line lookback as a finite int >= 2, else the 50 default. */
export const regimePeriod = (raw: unknown): number => {
  const n = Number.parseInt(String(raw ?? 50), 10);
  return Number.isFinite(n) && n >= 2 ? n : 50;
};

/** Moving-average type; anything but 'ema' reads as 'sma'. */
export const regimeMaType = (raw: unknown): 'sma' | 'ema' => (raw === 'ema' ? 'ema' : 'sma');
