import { describe, expect, it } from 'vitest';
import { bridgeScoutClientOrderId } from '../src/client-order-id.js';

describe('bridgeScoutClientOrderId', () => {
  it('is deterministic per (profile, symbol, clock, side) and distinguishes sides', () => {
    const sell = bridgeScoutClientOrderId('p1', 'BTCUSDT', 1000, 'SELL');
    const buy = bridgeScoutClientOrderId('p1', 'BTCUSDT', 1000, 'BUY');
    expect(sell).toMatch(/^bs-.*-s$/);
    expect(buy).toMatch(/^bs-.*-b$/);
    expect(sell).not.toBe(buy);
    expect(bridgeScoutClientOrderId('p1', 'BTCUSDT', 1000, 'SELL')).toBe(sell);
    expect(bridgeScoutClientOrderId('p1', 'BTCUSDT', 2000, 'SELL')).not.toBe(sell);
    expect(bridgeScoutClientOrderId('p1', 'ETHUSDT', 1000, 'SELL')).not.toBe(sell);
    expect(bridgeScoutClientOrderId('p2', 'BTCUSDT', 1000, 'SELL')).not.toBe(sell);
  });
});
