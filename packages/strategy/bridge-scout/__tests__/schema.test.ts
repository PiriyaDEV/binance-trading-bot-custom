import { describe, expect, it } from 'vitest';
import {
  BridgeScoutConfigSchema,
  BridgeScoutOverrideConfigSchema,
  BridgeScoutStateSchema,
  defaultBridgeScoutConfig,
  initialBridgeScoutState,
} from '../src/schema.js';

describe('bridge-scout schema', () => {
  it('default config is disabled with the ported ccxt defaults', () => {
    const c = defaultBridgeScoutConfig();
    expect(c.enabled).toBe(false);
    expect(c.scoutMultiplier).toBe(5);
    expect(c.assumedFeeRatePct).toBe('0.001');
    expect(c.minTradeQuote).toBe('10');
  });

  it('parses a fully custom config', () => {
    const c = BridgeScoutConfigSchema.parse({
      enabled: true,
      scoutMultiplier: 3,
      assumedFeeRatePct: '0.0004',
      minTradeQuote: '25',
    });
    expect(c).toEqual({
      enabled: true,
      scoutMultiplier: 3,
      assumedFeeRatePct: '0.0004',
      minTradeQuote: '25',
    });
  });

  it('rejects an out-of-range scoutMultiplier', () => {
    expect(BridgeScoutConfigSchema.safeParse({ scoutMultiplier: 0 }).success).toBe(false);
    expect(BridgeScoutConfigSchema.safeParse({ scoutMultiplier: 51 }).success).toBe(false);
    expect(BridgeScoutConfigSchema.safeParse({ scoutMultiplier: 1.5 }).success).toBe(false);
  });

  it('rejects an out-of-range assumedFeeRatePct', () => {
    expect(BridgeScoutConfigSchema.safeParse({ assumedFeeRatePct: '0' }).success).toBe(false);
    expect(BridgeScoutConfigSchema.safeParse({ assumedFeeRatePct: '1' }).success).toBe(false);
    expect(BridgeScoutConfigSchema.safeParse({ assumedFeeRatePct: 'nope' }).success).toBe(false);
  });

  it('rejects a non-positive minTradeQuote', () => {
    expect(BridgeScoutConfigSchema.safeParse({ minTradeQuote: '0' }).success).toBe(false);
    expect(BridgeScoutConfigSchema.safeParse({ minTradeQuote: '-1' }).success).toBe(false);
  });

  it('override accepts a partial config and rejects unknown keys', () => {
    expect(BridgeScoutOverrideConfigSchema.parse({ scoutMultiplier: 3 })).toEqual({
      scoutMultiplier: 3,
    });
    expect(BridgeScoutOverrideConfigSchema.parse({})).toEqual({});
    expect(BridgeScoutOverrideConfigSchema.safeParse({ nope: 1 }).success).toBe(false);
  });

  it('initial state is flat at the current schema version', () => {
    const s = initialBridgeScoutState();
    expect(s).toEqual({ schemaVersion: '1.0.0', avgEntryPrice: null, heldQuantity: null });
    expect(BridgeScoutStateSchema.parse(s)).toEqual(s);
  });

  it('state schema rejects a stale schemaVersion', () => {
    expect(
      BridgeScoutStateSchema.safeParse({
        schemaVersion: '0.0.1',
        avgEntryPrice: null,
        heldQuantity: null,
      }).success,
    ).toBe(false);
  });
});
