import { describe, expect, it } from 'vitest';
import { bridgeScout } from '../src/index.js';

describe('bridgeScout strategy descriptor', () => {
  it('is named and versioned', () => {
    expect(bridgeScout.name).toBe('bridge-scout');
    expect(bridgeScout.version).toBe('1.0.0');
    expect(bridgeScout.displayName).toBe('Bridge Scout');
  });

  it('declares the cross-symbol KV capability, like rebalance', () => {
    expect(bridgeScout.capabilities.needsProfileKv).toBe(true);
    expect(bridgeScout.capabilities.needsUserDataStream).toBe(true);
    expect(bridgeScout.capabilities.bundleProviders).toEqual([]);
    expect(bridgeScout.capabilities.operatorActions).toEqual([]);
  });

  it('needs no candle window (reads only the tick price)', () => {
    expect(bridgeScout.capabilities.candleIntervals).toEqual([]);
  });

  it('exposes a position adapter (single-position-per-symbol capability)', () => {
    expect(bridgeScout.position).toBeDefined();
  });

  it('declares no domain events', () => {
    expect(bridgeScout.events).toEqual({});
  });

  it('defaultConfig is schema-valid and disabled', () => {
    expect(bridgeScout.configSchema.parse(bridgeScout.defaultConfig)).toEqual(
      bridgeScout.defaultConfig,
    );
    expect(bridgeScout.defaultConfig.enabled).toBe(false);
  });

  it('initialState is schema-valid and flat', () => {
    const s = bridgeScout.initialState(bridgeScout.defaultConfig);
    expect(bridgeScout.stateSchema.parse(s)).toEqual(s);
    expect(s.heldQuantity).toBeNull();
  });

  it('declares no attributeOrder, matching rebalance (both place only MARKET orders)', () => {
    expect(bridgeScout.attributeOrder).toBeUndefined();
  });
});
