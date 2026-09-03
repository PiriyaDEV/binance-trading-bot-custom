import { describe, expect, it } from 'vitest';
import type { PreviewModel, PreviewRow } from '@app/strategy-core';

import { bridgeScoutPreviewLevels, bridgeScoutPreviewDataNeeds } from '../src/preview.js';
import {
  BridgeScoutConfigSchema,
  initialBridgeScoutState,
  type BridgeScoutConfig,
} from '../src/schema.js';

const rows = (model: PreviewModel): PreviewRow[] => model.sections.flatMap((s) => s.rows);

const cfg = (over: Record<string, unknown> = {}): BridgeScoutConfig =>
  BridgeScoutConfigSchema.parse({ enabled: true, ...over });

describe('bridgeScoutPreviewLevels', () => {
  it('is price-less: no row carries a price, and none arms a price trigger', () => {
    const model = bridgeScoutPreviewLevels({
      config: cfg(),
      state: null,
      entryPrice: null,
      currentPrice: null,
    });
    const all = rows(model);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((r) => r.price === undefined)).toBe(true);
    expect(all.some((r) => r.trigger === true && r.price !== undefined)).toBe(false);
  });

  it('marks the status row as trigger:true when the symbol currently holds a position', () => {
    const held = bridgeScoutPreviewLevels({
      config: cfg(),
      state: { ...initialBridgeScoutState(), heldQuantity: '2' },
      entryPrice: '100',
      currentPrice: '110',
    });
    const flat = bridgeScoutPreviewLevels({
      config: cfg(),
      state: initialBridgeScoutState(),
      entryPrice: null,
      currentPrice: '110',
    });
    expect(rows(held).find((r) => r.code === 'status')?.trigger).toBe(true);
    expect(rows(flat).find((r) => r.code === 'status')?.trigger).toBe(false);
  });

  it('flags state:null the same as a flat position (not held)', () => {
    const model = bridgeScoutPreviewLevels({
      config: cfg(),
      state: null,
      entryPrice: null,
      currentPrice: null,
    });
    expect(rows(model).find((r) => r.code === 'status')?.trigger).toBe(false);
  });

  it('surfaces a disabled row only when the config is off', () => {
    const off = bridgeScoutPreviewLevels({
      config: cfg({ enabled: false }),
      state: null,
      entryPrice: null,
      currentPrice: null,
    });
    const on = bridgeScoutPreviewLevels({
      config: cfg({ enabled: true }),
      state: null,
      entryPrice: null,
      currentPrice: null,
    });
    expect(rows(off).some((r) => r.code === 'disabled')).toBe(true);
    expect(rows(on).some((r) => r.code === 'disabled')).toBe(false);
  });

  it('reads the config defensively when unparsed', () => {
    const model = bridgeScoutPreviewLevels({
      config: { enabled: true, scoutMultiplier: 7 } as unknown as BridgeScoutConfig,
      state: null,
      entryPrice: null,
      currentPrice: null,
    });
    expect(rows(model).find((r) => r.code === 'scout-multiplier')?.note).toContain('7x');
  });

  it('reads a missing scoutMultiplier as blank, not a crash', () => {
    const model = bridgeScoutPreviewLevels({
      config: { enabled: true } as unknown as BridgeScoutConfig,
      state: null,
      entryPrice: null,
      currentPrice: null,
    });
    expect(rows(model).find((r) => r.code === 'scout-multiplier')?.note).toBe(
      'A jump must clear the round-trip fee by x before it fires.',
    );
  });
});

describe('bridgeScoutPreviewDataNeeds', () => {
  it('needs no extra candle history', () => {
    expect(bridgeScoutPreviewDataNeeds(cfg())).toEqual([]);
  });
});
