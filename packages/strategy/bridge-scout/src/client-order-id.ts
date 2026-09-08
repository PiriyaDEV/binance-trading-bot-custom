import { assertClientOrderId, djb2Hex } from '@app/strategy-core';

/**
 * Deterministic clientOrderId for a bridge-scout jump leg. Folds the tick's
 * clock reading so a retried tick within the same millisecond coalesces at
 * Binance rather than double-placing, while two distinct jumps (necessarily
 * at different times) get distinct ids. `bs` = bridge-scout.
 */
export const bridgeScoutClientOrderId = (
  profileId: string,
  symbol: string,
  nowMs: number,
  side: 'BUY' | 'SELL',
): string =>
  assertClientOrderId(
    `bs-${djb2Hex(`${profileId}|${symbol}|${nowMs}|${side}`)}-${side === 'BUY' ? 'b' : 's'}`,
  );
