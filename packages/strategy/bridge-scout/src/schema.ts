import { z } from 'zod';
import { decimalString } from '@app/contracts';

/**
 * Operator-owned bridge-scout configuration. `symbol` is deliberately absent
 * (like momentum/rebalance): the worker resolves the coin universe from the
 * profile's bound symbols, not from strategy config. Every bound symbol must
 * share the same quote asset — that quote asset is the "bridge currency"
 * (e.g. USDT) coins rotate through.
 */
export const BridgeScoutConfigSchema = z.object({
  enabled: z
    .boolean()
    .default(false)
    .describe(
      'Master switch. Off by default; turn on only after backtesting across your chosen coin set.',
    ),
  scoutMultiplier: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .describe(
      "Fee buffer, as a multiple of the round-trip trading fee. A jump must clear the fee by this many multiples before it fires, absorbing price noise around the break-even point. Ported from binance-trade-bot's SCOUT_MULTIPLIER; higher trades less often but needs a bigger edge to act.",
    ),
  assumedFeeRatePct: decimalString('assumedFeeRatePct must be in (0, 1)', { gt: 0, lt: 1 })
    .default('0.001')
    .describe(
      "@ui:percent-of Assumed per-leg trading fee. 0.1 matches Binance's standard 0.1% taker fee (less with a BNB discount). This strategy has no live per-symbol fee lookup, so it sizes its fee buffer off this single assumed rate for every coin.",
    ),
  minTradeQuote: decimalString('minTradeQuote must be a positive decimal', { gt: 0 })
    .default('10')
    .describe(
      '@ui:price Skip a jump whose sell or buy leg would fall below this many quote units, so dust and exchange minimums never block a rotation.',
    ),
});
export type BridgeScoutConfig = z.infer<typeof BridgeScoutConfigSchema>;

/**
 * Per-symbol config override: every field may differ per symbol. In practice
 * every bound symbol should share the same tuning (the fee buffer and
 * minimum trade size describe the rotation as a whole, not one coin), but
 * nothing here is profile-wide-only the way rebalance's `accountCap` is, so
 * there is no field to exclude.
 */
export const BridgeScoutOverrideConfigSchema = z
  .object({
    // `.unwrap()` drops the outer `.default()` so the override is a pure shape
    // gate — an omitted key must stay truly absent (not backfilled with the
    // schema default), or `mergeConfig`'s deep-merge would clobber the
    // profile's own value with the field's default on every save. Same
    // convention as momentum's and rebalance's override schemas.
    scoutMultiplier: BridgeScoutConfigSchema.shape.scoutMultiplier.unwrap(),
    assumedFeeRatePct: BridgeScoutConfigSchema.shape.assumedFeeRatePct.unwrap(),
    minTradeQuote: BridgeScoutConfigSchema.shape.minTradeQuote.unwrap(),
  })
  .partial()
  .strict();
export type BridgeScoutOverrideConfig = z.infer<typeof BridgeScoutOverrideConfigSchema>;

export const BRIDGE_SCOUT_STATE_SCHEMA_VERSION = '1.0.0';

/** Persisted per-(profile, symbol) state: just the held position, same shape as rebalance. */
export const BridgeScoutStateSchema = z.object({
  schemaVersion: z.literal(BRIDGE_SCOUT_STATE_SCHEMA_VERSION),
  avgEntryPrice: z.string().nullable(),
  heldQuantity: z.string().nullable(),
});
export type BridgeScoutState = z.infer<typeof BridgeScoutStateSchema>;

/** Bridge-scout reads no per-tick bundle; all cross-symbol coupling goes through profileKv. */
export const BridgeScoutBundleSchema = z.object({});
export type BridgeScoutBundle = z.infer<typeof BridgeScoutBundleSchema>;

export const initialBridgeScoutState = (): BridgeScoutState => ({
  schemaVersion: BRIDGE_SCOUT_STATE_SCHEMA_VERSION,
  avgEntryPrice: null,
  heldQuantity: null,
});

/** Schema-valid seed config the create-profile wizard pre-fills (inert: enabled off). */
export const defaultBridgeScoutConfig = (): BridgeScoutConfig => BridgeScoutConfigSchema.parse({});
