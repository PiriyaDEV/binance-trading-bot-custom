import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * One row per "quick start" wizard preset (`conservative` / `balanced` /
 * `aggressive` / `smart`), holding the last backtest-preview result the
 * server computed for it. Global — not account- or profile-scoped: the four
 * presets' configs are fixed constants, identical for every operator, so one
 * shared cache serves the whole install rather than each browser re-running
 * a year-long backtest for the same preset.
 *
 * `pickedSymbols` / `robustness` are opaque jsonb here, validated at the API
 * boundary against the @app/contracts `PresetBacktestPreviewSchema` — the
 * same "db is a leaf, no @app/contracts import" convention `backtest_runs`
 * follows for its own `result` column.
 */
export const presetBacktestPreviews = pgTable('preset_backtest_previews', {
  presetId: text('preset_id').primaryKey(),
  candleInterval: text('candle_interval').notNull(),
  /** Ranked candidates from the winning run, best first — see `SmartPresetPick` on the web side. */
  pickedSymbols: jsonb('picked_symbols').notNull(),
  /** In-sample vs out-of-sample profit factor / alpha — see `SmartPresetRobustness`. */
  robustness: jsonb('robustness').notNull(),
  clearsGate: boolean('clears_gate').notNull(),
  /** How many days of candles the run covered, so a later change to the window size is visible on an old cached row instead of silently assumed current. */
  windowDays: integer('window_days').notNull(),
  ranAt: timestamp('ran_at', { withTimezone: true }).notNull(),
});

export type PresetBacktestPreviewRow = typeof presetBacktestPreviews.$inferSelect;
