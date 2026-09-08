/**
 * Ride-mode config coercion, mirroring regime-filter.ts's pattern for the
 * same reason: the live worker reads config unparsed, so a partial override
 * can reach the tick with `adxPeriod`/`adxThreshold` undefined. Kept as a
 * separate file (not folded into regime-filter.ts) because ride mode is a
 * distinct, independently-toggleable mechanism layered on top of
 * `regimeFilter`, not a variant of it.
 */

/** ADX lookback as a finite int >= 2, else the 14 (Wilder-standard) default. */
export const ridePeriod = (raw: unknown): number => {
  const n = Number.parseInt(String(raw ?? 14), 10);
  return Number.isFinite(n) && n >= 2 ? n : 14;
};

/** Minimum ADX reading to count as "strongly trending", else the 40 default. */
export const rideThreshold = (raw: unknown): number => {
  const n = Number(raw ?? 40);
  return Number.isFinite(n) && n >= 0 ? n : 40;
};
