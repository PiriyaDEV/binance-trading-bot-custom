import { z } from 'zod';

/** One ranked candidate from the winning basket run, best profit first. */
export const PresetPickSchema = z.object({
  symbol: z.string(),
  pnlQuote: z.string(),
  tradeCount: z.number().int().nonnegative(),
});
export type PresetPick = z.infer<typeof PresetPickSchema>;

/**
 * In-sample vs out-of-sample profit factor and alpha — the same figures the
 * Live-gate checks. `outOfSample` is null when the run's window was too
 * short to carve a holdout.
 */
export const PresetRobustnessSchema = z.object({
  inSample: z.object({
    profitFactor: z.number().nullable(),
    alphaVsHoldPct: z.number(),
  }),
  outOfSample: z
    .object({
      profitFactor: z.number().nullable(),
      alphaVsHoldPct: z.number(),
      trades: z.number().int().nonnegative(),
    })
    .nullable(),
  clearsGate: z.boolean(),
});
export type PresetRobustness = z.infer<typeof PresetRobustnessSchema>;

/**
 * One "quick start" preset's server-computed backtest preview — shared by
 * every operator (see `packages/db/src/schema/preset-backtest-previews.ts`
 * for why this is global, not per-account).
 */
export const PresetBacktestPreviewSchema = z.object({
  presetId: z.string(),
  candleInterval: z.string(),
  pickedSymbols: z.array(PresetPickSchema),
  robustness: PresetRobustnessSchema,
  clearsGate: z.boolean(),
  windowDays: z.number().int().positive(),
  ranAt: z.iso.datetime(),
});
export type PresetBacktestPreview = z.infer<typeof PresetBacktestPreviewSchema>;

export const PresetBacktestPreviewListResponse = z.object({
  previews: z.array(PresetBacktestPreviewSchema),
});
export type PresetBacktestPreviewListResponse = z.infer<typeof PresetBacktestPreviewListResponse>;

/** Body for `PUT /preset-backtest-previews/:presetId` — everything but `presetId` (from the path) and `clearsGate` (server-derived from `robustness`, never trusted from the caller). */
export const PresetBacktestPreviewUpsert = z.object({
  candleInterval: z.string().min(1),
  pickedSymbols: z.array(PresetPickSchema),
  robustness: PresetRobustnessSchema,
  windowDays: z.number().int().positive(),
});
export type PresetBacktestPreviewUpsert = z.infer<typeof PresetBacktestPreviewUpsert>;
