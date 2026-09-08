import { describe, expect, it } from 'vitest';
import { Decimal } from '@app/money';
import type { TickInput } from '@app/strategy-core';
import {
  computeTick,
  KV_HELD_KEY,
  KV_PENDING_BUY_KEY,
  KV_PRICE_PREFIX,
  KV_REF_PREFIX,
} from '../src/tick.js';
import {
  initialBridgeScoutState,
  type BridgeScoutBundle,
  type BridgeScoutConfig,
  type BridgeScoutState,
} from '../src/schema.js';

type BInput = TickInput<BridgeScoutConfig, BridgeScoutState, BridgeScoutBundle>;

const symbolInfo = {
  symbol: 'BTCUSDT',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  filters: { stepSize: '0.001', minQty: '0', minNotional: '0', tickSize: '0.01' },
} as unknown as BInput['market']['symbolInfo'];

const mkInput = (over: {
  config?: Partial<BridgeScoutConfig>;
  state?: Partial<BridgeScoutState>;
  profileKv?: Record<string, unknown>;
  freeQuote?: string | null;
  symbol?: string;
  price?: string;
  nowMs?: number;
}): BInput =>
  ({
    clock: { nowMs: () => over.nowMs ?? 0 },
    rng: { next: () => 0 },
    trigger: { kind: 'tick' },
    profile: {
      id: 'p1',
      userId: 'u1',
      binanceMode: 'test',
      status: 'running',
      strategyVersion: '1.0.0',
    },
    config: {
      enabled: true,
      scoutMultiplier: 1,
      assumedFeeRatePct: '0',
      minTradeQuote: '10',
      ...over.config,
    } as BridgeScoutConfig,
    state: { ...initialBridgeScoutState(), ...over.state },
    market: {
      symbol: over.symbol ?? 'BTCUSDT',
      currentPrice: over.price ?? '100',
      candlesByInterval: {},
      symbolInfo,
    } as unknown as BInput['market'],
    account: {
      balances:
        over.freeQuote === null
          ? {}
          : {
              USDT: {
                asset: 'USDT',
                free: new Decimal(over.freeQuote ?? '10000'),
                locked: new Decimal(0),
              },
            },
    } as unknown as BInput['account'],
    openOrders: [],
    bundle: {},
    limits: { weightUsed1m: 0, weightLimit1m: 1200, headroomBps: 10_000 },
    ...(over.profileKv ? { profileKv: over.profileKv } : {}),
  }) as unknown as BInput;

describe('computeTick', () => {
  it('always publishes its own price to the KV store', () => {
    const out = computeTick(mkInput({ price: '123.45' }));
    expect(out.decisions).toContainEqual({
      type: 'set-kv',
      key: `${KV_PRICE_PREFIX}BTCUSDT`,
      value: '123.45',
    });
  });

  it('when disabled, publishes price but makes no other decisions', () => {
    const out = computeTick(mkInput({ config: { enabled: false }, state: { heldQuantity: '1' } }));
    expect(out.decisions).toHaveLength(1);
    expect(out.decisions[0]?.type).toBe('set-kv');
    expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
      reason: 'disabled',
    });
  });

  it('bootstraps: adopts an unclaimed held coin from a non-zero wallet-reconciled position', () => {
    const out = computeTick(mkInput({ state: { heldQuantity: '2' }, price: '100' }));
    expect(out.decisions).toContainEqual({ type: 'set-kv', key: KV_HELD_KEY, value: 'BTCUSDT' });
    expect(out.decisions).toContainEqual({
      type: 'set-kv',
      key: `${KV_REF_PREFIX}BTCUSDT`,
      value: '100',
    });
    expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
  });

  it('does not bootstrap a flat symbol (nothing to adopt)', () => {
    const out = computeTick(mkInput({ state: { heldQuantity: null } }));
    expect(out.decisions.some((d) => d.type === 'set-kv' && d.key === KV_HELD_KEY)).toBe(false);
    expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
      reason: 'candidate',
    });
  });

  describe('as the held coin', () => {
    it('holds when no candidate is comparable (no reference published yet)', () => {
      const out = computeTick(
        mkInput({
          state: { heldQuantity: '1' },
          profileKv: { [KV_HELD_KEY]: 'BTCUSDT', [`${KV_PRICE_PREFIX}ETHUSDT`]: '50' }, // no ref for ETH
        }),
      );
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'hold',
      });
    });

    it('holds when no candidate scores above zero', () => {
      const out = computeTick(
        mkInput({
          state: { heldQuantity: '1' },
          profileKv: {
            [KV_HELD_KEY]: 'BTCUSDT',
            [`${KV_REF_PREFIX}BTCUSDT`]: '100',
            [`${KV_PRICE_PREFIX}ETHUSDT`]: '55', // ETH rose relative to reference → negative score
            [`${KV_REF_PREFIX}ETHUSDT`]: '50',
          },
        }),
      );
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'hold',
      });
    });

    it('sells and marks a pending buy when a candidate clears the threshold', () => {
      const out = computeTick(
        mkInput({
          state: { heldQuantity: '1' },
          price: '100',
          profileKv: {
            [KV_HELD_KEY]: 'BTCUSDT',
            [`${KV_REF_PREFIX}BTCUSDT`]: '100',
            [`${KV_PRICE_PREFIX}ETHUSDT`]: '40', // ETH fell relative to reference → positive score
            [`${KV_REF_PREFIX}ETHUSDT`]: '50',
          },
        }),
      );
      const order = out.decisions.find((d) => d.type === 'place-order');
      expect(order).toMatchObject({
        type: 'place-order',
        intent: { symbol: 'BTCUSDT', side: 'SELL', reason: 'bridge-scout-jump' },
        params: { type: 'MARKET', quantity: '1.000' },
      });
      expect((order as { intent: { clientOrderId: string } }).intent.clientOrderId).toMatch(
        /^bs-.*-s$/,
      );
      expect(out.decisions).toContainEqual({ type: 'set-kv', key: KV_HELD_KEY, value: '' });
      expect(out.decisions).toContainEqual({
        type: 'set-kv',
        key: KV_PENDING_BUY_KEY,
        value: 'ETHUSDT',
      });
    });

    it('ignores its own published price/ref and a zero-or-negative-price sibling as candidates', () => {
      const out = computeTick(
        mkInput({
          state: { heldQuantity: '1' },
          price: '100',
          profileKv: {
            [KV_HELD_KEY]: 'BTCUSDT',
            [`${KV_REF_PREFIX}BTCUSDT`]: '100',
            // Self also appears in the KV price broadcast (as every symbol's
            // own tick publishes it) — must never be scored as a candidate.
            [`${KV_PRICE_PREFIX}BTCUSDT`]: '100',
            // A sibling with a non-positive live price — filtered out, not scored.
            [`${KV_PRICE_PREFIX}JUNKUSDT`]: '0',
            [`${KV_REF_PREFIX}JUNKUSDT`]: '1',
            // A sibling with a non-positive reference price — also filtered out.
            [`${KV_PRICE_PREFIX}ZEROREFUSDT`]: '10',
            [`${KV_REF_PREFIX}ZEROREFUSDT`]: '0',
          },
        }),
      );
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'hold',
      });
    });

    it('treats a non-string candidate price as zero (tolerant parse)', () => {
      // A numeric KV value (not a decimal-string) falls back to 0 → filtered
      // out by the price > 0 gate, so it never becomes a candidate.
      const out = computeTick(
        mkInput({
          state: { heldQuantity: '1' },
          price: '100',
          profileKv: {
            [KV_HELD_KEY]: 'BTCUSDT',
            [`${KV_REF_PREFIX}BTCUSDT`]: '100',
            [`${KV_PRICE_PREFIX}ETHUSDT`]: 40 as unknown as string,
            [`${KV_REF_PREFIX}ETHUSDT`]: '50',
          },
        }),
      );
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'hold',
      });
    });

    it('picks the highest-scoring candidate among several winners', () => {
      const out = computeTick(
        mkInput({
          state: { heldQuantity: '1' },
          price: '100',
          profileKv: {
            [KV_HELD_KEY]: 'BTCUSDT',
            [`${KV_REF_PREFIX}BTCUSDT`]: '100',
            [`${KV_PRICE_PREFIX}ETHUSDT`]: '48',
            [`${KV_REF_PREFIX}ETHUSDT`]: '50',
            [`${KV_PRICE_PREFIX}SOLUSDT`]: '40', // bigger edge — should win
            [`${KV_REF_PREFIX}SOLUSDT`]: '50',
          },
        }),
      );
      expect(out.decisions.find((d) => d.type === 'place-order')).toMatchObject({
        intent: { symbol: 'BTCUSDT', side: 'SELL' },
      });
      expect(out.decisions).toContainEqual({
        type: 'set-kv',
        key: KV_PENDING_BUY_KEY,
        value: 'SOLUSDT',
      });
    });

    it('does not sell below the minimum trade size', () => {
      const out = computeTick(
        mkInput({
          config: { minTradeQuote: '1000' },
          state: { heldQuantity: '1' },
          price: '100', // notional 100 < minTradeQuote 1000
          profileKv: {
            [KV_HELD_KEY]: 'BTCUSDT',
            [`${KV_REF_PREFIX}BTCUSDT`]: '100',
            [`${KV_PRICE_PREFIX}ETHUSDT`]: '40',
            [`${KV_REF_PREFIX}ETHUSDT`]: '50',
          },
        }),
      );
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'below-min-trade',
      });
    });

    it('skips with invalid-filters when stepSize is non-positive', () => {
      const badSymbolInfo = {
        ...symbolInfo,
        filters: { ...symbolInfo.filters, stepSize: '0' },
      } as unknown as BInput['market']['symbolInfo'];
      const input = mkInput({
        state: { heldQuantity: '1' },
        profileKv: {
          [KV_HELD_KEY]: 'BTCUSDT',
          [`${KV_REF_PREFIX}BTCUSDT`]: '100',
          [`${KV_PRICE_PREFIX}ETHUSDT`]: '40',
          [`${KV_REF_PREFIX}ETHUSDT`]: '50',
        },
      });
      const out = computeTick({
        ...input,
        market: { ...input.market, symbolInfo: badSymbolInfo },
      } as BInput);
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'invalid-filters',
      });
    });

    it("skips with the sizing epilogue's own reason (min-qty) when the sell falls below it", () => {
      const tinyMinQtySymbolInfo = {
        ...symbolInfo,
        filters: { ...symbolInfo.filters, minQty: '10' }, // held qty (1) never clears this
      } as unknown as BInput['market']['symbolInfo'];
      const input = mkInput({
        state: { heldQuantity: '1' },
        price: '100',
        profileKv: {
          [KV_HELD_KEY]: 'BTCUSDT',
          [`${KV_REF_PREFIX}BTCUSDT`]: '100',
          [`${KV_PRICE_PREFIX}ETHUSDT`]: '40',
          [`${KV_REF_PREFIX}ETHUSDT`]: '50',
        },
      });
      const out = computeTick({
        ...input,
        market: { ...input.market, symbolInfo: tinyMinQtySymbolInfo },
      } as BInput);
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'min-qty',
      });
    });

    it('treats a malformed config decimal (assumedFeeRatePct) as a safe fallback', () => {
      // The live worker passes RAW config; dec() must catch, not throw, on an
      // unparseable decimal string.
      const out = computeTick(
        mkInput({
          config: { assumedFeeRatePct: 'not-a-number' as unknown as string },
          state: { heldQuantity: '1' },
          price: '100',
          profileKv: {
            [KV_HELD_KEY]: 'BTCUSDT',
            [`${KV_REF_PREFIX}BTCUSDT`]: '100',
            [`${KV_PRICE_PREFIX}ETHUSDT`]: '40',
            [`${KV_REF_PREFIX}ETHUSDT`]: '50',
          },
        }),
      );
      // Falls back to the documented default (0.001), which still lets this
      // (large, fee-free-noise) edge clear the threshold.
      expect(out.decisions.find((d) => d.type === 'place-order')).toMatchObject({
        intent: { side: 'SELL' },
      });
    });

    it('seeds its own reference price on first tick as the held coin', () => {
      const out = computeTick(
        mkInput({
          state: { heldQuantity: '1' },
          price: '77',
          profileKv: { [KV_HELD_KEY]: 'BTCUSDT' }, // no ref yet
        }),
      );
      expect(out.decisions).toContainEqual({
        type: 'set-kv',
        key: `${KV_REF_PREFIX}BTCUSDT`,
        value: '77',
      });
    });
  });

  describe('as the pending-buy target', () => {
    it('buys with available bridge cash and refreshes every reference price', () => {
      const out = computeTick(
        mkInput({
          symbol: 'ETHUSDT',
          price: '40',
          state: { heldQuantity: null },
          freeQuote: '400',
          profileKv: {
            [KV_PENDING_BUY_KEY]: 'ETHUSDT',
            [`${KV_PRICE_PREFIX}BTCUSDT`]: '100',
            // Self's own price broadcast — must not overwrite the map's
            // seeded self-entry (already `price`, the live tick price) with a
            // possibly-stale KV echo.
            [`${KV_PRICE_PREFIX}ETHUSDT`]: '39',
            // A non-positive sibling price is filtered out of the refresh.
            [`${KV_PRICE_PREFIX}JUNKUSDT`]: '0',
          },
        }),
      );
      const order = out.decisions.find((d) => d.type === 'place-order');
      expect(order).toMatchObject({
        intent: { symbol: 'ETHUSDT', side: 'BUY', reason: 'bridge-scout-jump' },
        params: { type: 'MARKET', quantity: '10.000' },
      });
      expect((order as { intent: { clientOrderId: string } }).intent.clientOrderId).toMatch(
        /^bs-.*-b$/,
      );
      expect(out.decisions).toContainEqual({ type: 'set-kv', key: KV_HELD_KEY, value: 'ETHUSDT' });
      expect(out.decisions).toContainEqual({ type: 'delete-kv', key: KV_PENDING_BUY_KEY });
      // Reference refresh covers both the bought coin and every sibling price seen in KV.
      expect(out.decisions).toContainEqual({
        type: 'set-kv',
        key: `${KV_REF_PREFIX}ETHUSDT`,
        value: '40',
      });
      expect(out.decisions).toContainEqual({
        type: 'set-kv',
        key: `${KV_REF_PREFIX}BTCUSDT`,
        value: '100',
      });
      expect(
        out.decisions.some((d) => d.type === 'set-kv' && d.key === `${KV_REF_PREFIX}JUNKUSDT`),
      ).toBe(false);
    });

    it('waits when bridge cash has not settled yet', () => {
      const out = computeTick(
        mkInput({
          symbol: 'ETHUSDT',
          state: { heldQuantity: null },
          freeQuote: '1', // below minTradeQuote
          profileKv: { [KV_PENDING_BUY_KEY]: 'ETHUSDT' },
        }),
      );
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'awaiting-cash',
      });
    });

    it('waits when the account balance is entirely absent', () => {
      const out = computeTick(
        mkInput({
          symbol: 'ETHUSDT',
          state: { heldQuantity: null },
          freeQuote: null,
          profileKv: { [KV_PENDING_BUY_KEY]: 'ETHUSDT' },
        }),
      );
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'awaiting-cash',
      });
    });

    it('skips with invalid-filters when stepSize is non-positive', () => {
      const badSymbolInfo = {
        ...symbolInfo,
        filters: { ...symbolInfo.filters, stepSize: '0' },
      } as unknown as BInput['market']['symbolInfo'];
      const input = mkInput({
        symbol: 'ETHUSDT',
        state: { heldQuantity: null },
        freeQuote: '400',
        profileKv: { [KV_PENDING_BUY_KEY]: 'ETHUSDT' },
      });
      const out = computeTick({
        ...input,
        market: { ...input.market, symbolInfo: badSymbolInfo },
      } as BInput);
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'invalid-filters',
      });
    });

    it("skips with the sizing epilogue's own reason (min-notional) when the buy falls below it", () => {
      const highMinNotionalSymbolInfo = {
        ...symbolInfo,
        filters: { ...symbolInfo.filters, minNotional: '100000' }, // far above what $400 buys
      } as unknown as BInput['market']['symbolInfo'];
      const input = mkInput({
        symbol: 'ETHUSDT',
        price: '40',
        state: { heldQuantity: null },
        freeQuote: '400',
        profileKv: { [KV_PENDING_BUY_KEY]: 'ETHUSDT' },
      });
      const out = computeTick({
        ...input,
        market: { ...input.market, symbolInfo: highMinNotionalSymbolInfo },
      } as BInput);
      expect(out.decisions.some((d) => d.type === 'place-order')).toBe(false);
      expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
        reason: 'min-notional',
      });
    });
  });

  it('is a no-op candidate when neither held nor the pending-buy target', () => {
    const out = computeTick(
      mkInput({
        symbol: 'SOLUSDT',
        state: { heldQuantity: null },
        profileKv: { [KV_HELD_KEY]: 'BTCUSDT', [KV_PENDING_BUY_KEY]: 'ETHUSDT' },
      }),
    );
    expect(out.decisions).toHaveLength(1); // just the price publish
    expect(out.metrics.find((m) => m.name === 'bridgescout.decision')?.tags).toMatchObject({
      reason: 'candidate',
    });
  });
});

// Same retry-model invariant as rebalance: at most one place-order per tick,
// so a re-emitted retry on unadvanced state never double-places.
describe('computeTick — at most one place-order per tick', () => {
  const scenarios: BInput[] = [
    mkInput({
      state: { heldQuantity: '1' },
      price: '100',
      profileKv: {
        [KV_HELD_KEY]: 'BTCUSDT',
        [`${KV_REF_PREFIX}BTCUSDT`]: '100',
        [`${KV_PRICE_PREFIX}ETHUSDT`]: '40',
        [`${KV_REF_PREFIX}ETHUSDT`]: '50',
      },
    }),
    mkInput({
      symbol: 'ETHUSDT',
      price: '40',
      state: { heldQuantity: null },
      freeQuote: '400',
      profileKv: { [KV_PENDING_BUY_KEY]: 'ETHUSDT' },
    }),
    mkInput({ config: { enabled: false }, state: { heldQuantity: '1' } }),
    mkInput({ state: { heldQuantity: '2' } }), // bootstrap-adopt, no order
  ];

  it('emits at most one place-order across representative scenarios', () => {
    const placementsPerTick = scenarios.map(
      (input) => computeTick(input).decisions.filter((d) => d.type === 'place-order').length,
    );
    expect(placementsPerTick.some((n) => n === 1)).toBe(true);
    expect(Math.max(...placementsPerTick)).toBeLessThanOrEqual(1);
  });
});
