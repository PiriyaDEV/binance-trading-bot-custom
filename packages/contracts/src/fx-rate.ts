import { z } from 'zod';

/**
 * Cached USD→THB rate for the Thai-locale P/L readout on the Home hero card.
 * `rate` is how many THB one USD buys; `null` while the api has never
 * successfully fetched one (cold start, or the upstream provider has been
 * down since boot) — the SPA renders the USDT figure alone in that case,
 * never a guessed conversion. `asOf` is the fetch time, ISO 8601, so the SPA
 * can gray out a rate old enough to distrust; absent alongside a null rate.
 */
export const FxRateResponseSchema = z.object({
  rate: z.number().positive().nullable(),
  asOf: z.iso.datetime().nullable(),
});
export type FxRateResponse = z.infer<typeof FxRateResponseSchema>;
