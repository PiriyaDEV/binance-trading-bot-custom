import { Decimal, roundToStep } from '@app/money';
import { log, metric, parseFilters, finalise } from '@app/strategy-core';
import type { Decision, LogEntry, MetricEntry, TickInput, TickOutput } from '@app/strategy-core';

import type { BridgeScoutBundle, BridgeScoutConfig, BridgeScoutState } from './schema.js';
import { bestJump, combinedRoundTripFee, type ScoutQuote } from './scout.js';
import { bridgeScoutClientOrderId } from './client-order-id.js';

/** KV namespace: this symbol's live price, published every tick by every symbol. */
export const KV_PRICE_PREFIX = 'bridgescout:price:';
/** KV namespace: this symbol's reference-ratio baseline price (see scout.ts design note). */
export const KV_REF_PREFIX = 'bridgescout:ref:';
/** KV key: the symbol currently held, or absent/empty when the bot sits in bridge cash. */
export const KV_HELD_KEY = 'bridgescout:held';
/** KV key: the symbol a sell just targeted, awaiting its buy leg once cash settles. */
export const KV_PENDING_BUY_KEY = 'bridgescout:pendingBuy';

type BridgeScoutInput = TickInput<BridgeScoutConfig, BridgeScoutState, BridgeScoutBundle>;
type BridgeScoutOutput = TickOutput<BridgeScoutState>;

/** Tolerant decimal parse — the live worker passes RAW (unparsed) config/KV values. */
const dec = (v: unknown, fallback: string): Decimal => {
  try {
    return new Decimal(typeof v === 'string' ? v : fallback);
  } catch {
    return new Decimal(fallback);
  }
};

// `kv` is always a defined object at every call site below (`computeTick`
// resolves `input.profileKv ?? {}` exactly once, at its own top), so none of
// these three helpers need their own `| undefined` / `?? {}` fallback — a
// second layer of the same defensiveness would be untestable dead code (v8
// branch coverage would never see the "undefined" side fire).
const strKv = (kv: Readonly<Record<string, unknown>>, key: string): string | null => {
  const v = kv[key];
  return typeof v === 'string' && v !== '' ? v : null;
};

/** Every OTHER symbol with both a live price and a reference price published — the scoreable candidate set. */
const candidateQuotes = (kv: Readonly<Record<string, unknown>>, self: string): ScoutQuote[] => {
  const out: ScoutQuote[] = [];
  for (const [key, value] of Object.entries(kv)) {
    if (!key.startsWith(KV_PRICE_PREFIX)) continue;
    const symbol = key.slice(KV_PRICE_PREFIX.length);
    if (symbol === self) continue;
    const refValue = kv[`${KV_REF_PREFIX}${symbol}`];
    if (typeof refValue !== 'string') continue; // not yet comparable — no reference snapshot yet
    const price = dec(value, '0');
    const refPrice = dec(refValue, '0');
    if (price.gt(0) && refPrice.gt(0)) out.push({ symbol, price, refPrice });
  }
  return out;
};

/** Every symbol with a published live price, self included when `selfPrice` is given. */
const allPrices = (
  kv: Readonly<Record<string, unknown>>,
  self: string,
  selfPrice: Decimal,
): ReadonlyMap<string, Decimal> => {
  const out = new Map<string, Decimal>([[self, selfPrice]]);
  for (const [key, value] of Object.entries(kv)) {
    if (!key.startsWith(KV_PRICE_PREFIX)) continue;
    const symbol = key.slice(KV_PRICE_PREFIX.length);
    if (symbol === self) continue;
    const price = dec(value, '0');
    if (price.gt(0)) out.set(symbol, price);
  }
  return out;
};

/**
 * One bridge-scout tick. Always publishes this symbol's live price to the
 * cross-symbol KV store. When this symbol is the currently HELD coin, scores
 * every other bound coin and sells (starting a jump) once one clears the
 * fee-adjusted reference ratio. When this symbol is the PENDING jump target,
 * buys with the now-available bridge cash and refreshes every coin's
 * reference price (see scout.ts design note). Otherwise, does nothing beyond
 * publishing its price. Pure: all money math is Decimal, no I/O.
 */
export const computeTick = (input: BridgeScoutInput): BridgeScoutOutput => {
  const { market, config, state, account, profile, clock } = input;
  const kv: Readonly<Record<string, unknown>> = input.profileKv ?? {};
  const symbol = market.symbol;
  const price = new Decimal(market.currentPrice);
  const quoteAsset = market.symbolInfo.quoteAsset;
  const bal = account.balances[quoteAsset];
  const minTradeQuote = dec(config.minTradeQuote, '10');

  const decisions: Decision[] = [
    { type: 'set-kv', key: `${KV_PRICE_PREFIX}${symbol}`, value: price.toFixed() },
  ];
  const logs: LogEntry[] = [];
  const metrics: MetricEntry[] = [];

  if (config.enabled !== true) {
    metrics.push(metric('bridgescout.decision', { symbol, reason: 'disabled' }));
    return { nextState: state, decisions, logs, metrics };
  }

  const heldSymbol = strKv(kv, KV_HELD_KEY);
  const pendingBuySymbol = strKv(kv, KV_PENDING_BUY_KEY);
  const heldQty = state.heldQuantity ? dec(state.heldQuantity, '0') : new Decimal(0);

  // Bootstrap: nobody is recorded as held yet, but this symbol's own
  // wallet-reconciled position is non-zero — claim it and seed its own
  // reference price. Siblings backfill their own reference lazily (see
  // `candidateQuotes`'s "not yet comparable" skip) as they next tick.
  if (heldSymbol === null && heldQty.gt(0)) {
    decisions.push({ type: 'set-kv', key: KV_HELD_KEY, value: symbol });
    decisions.push({ type: 'set-kv', key: `${KV_REF_PREFIX}${symbol}`, value: price.toFixed() });
    logs.push(log('info', 'bridge-scout: adopting existing holding as the held coin', { symbol }));
    metrics.push(metric('bridgescout.decision', { symbol, reason: 'adopted-held' }));
    return { nextState: state, decisions, logs, metrics };
  }

  if (heldSymbol === symbol) {
    const ownRefRaw = kv[`${KV_REF_PREFIX}${symbol}`];
    const ownRef = typeof ownRefRaw === 'string' ? dec(ownRefRaw, price.toFixed()) : price;
    if (typeof ownRefRaw !== 'string') {
      decisions.push({ type: 'set-kv', key: `${KV_REF_PREFIX}${symbol}`, value: price.toFixed() });
    }

    const candidates = candidateQuotes(kv, symbol);
    const combinedFee = combinedRoundTripFee(dec(config.assumedFeeRatePct, '0.001'));
    const best = bestJump({ symbol, price, refPrice: ownRef }, candidates, {
      combinedFee,
      scoutMultiplier: config.scoutMultiplier,
    });

    if (best !== null && heldQty.gt(0) && heldQty.mul(price).gte(minTradeQuote)) {
      const filters = parseFilters(market.symbolInfo.filters);
      // Floor to step before the epilogue: `finalise` only FORMATS to the
      // step's decimal places (it rounds, it does not floor), so an
      // un-aligned heldQty must be floored first or the sell could ask for
      // more base asset than the wallet actually holds.
      const sized = filters ? finalise(roundToStep(heldQty, filters.step), price, filters) : null;
      if (sized !== null && 'quantity' in sized) {
        decisions.push({
          type: 'place-order',
          intent: {
            symbol,
            side: 'SELL',
            reason: 'bridge-scout-jump',
            clientOrderId: bridgeScoutClientOrderId(profile.id, symbol, clock.nowMs(), 'SELL'),
          },
          params: { type: 'MARKET', quantity: sized.quantity },
        });
        decisions.push({ type: 'set-kv', key: KV_HELD_KEY, value: '' });
        decisions.push({ type: 'set-kv', key: KV_PENDING_BUY_KEY, value: best.symbol });
        logs.push(
          log('info', 'bridge-scout: jumping to a better-ranked coin', {
            from: symbol,
            to: best.symbol,
            score: best.score.toFixed(),
          }),
        );
        metrics.push(metric('bridgescout.jump', { from: symbol, to: best.symbol }));
      } else {
        metrics.push(
          metric('bridgescout.decision', {
            symbol,
            reason: sized === null ? 'invalid-filters' : sized.skip,
          }),
        );
      }
    } else {
      metrics.push(
        metric('bridgescout.decision', {
          symbol,
          reason: best === null ? 'hold' : 'below-min-trade',
        }),
      );
    }
    return { nextState: state, decisions, logs, metrics };
  }

  if (pendingBuySymbol === symbol) {
    const available = bal ? bal.free : new Decimal(0);
    const filters = parseFilters(market.symbolInfo.filters);
    if (filters === null) {
      metrics.push(metric('bridgescout.decision', { symbol, reason: 'invalid-filters' }));
    } else if (!available.gte(minTradeQuote)) {
      // Bridge cash not yet settled (the sell leg hasn't filled) or too small — wait.
      metrics.push(metric('bridgescout.decision', { symbol, reason: 'awaiting-cash' }));
    } else {
      const rawQty = roundToStep(available.div(price), filters.step);
      const sized = finalise(rawQty, price, filters);
      if ('quantity' in sized) {
        decisions.push({
          type: 'place-order',
          intent: {
            symbol,
            side: 'BUY',
            reason: 'bridge-scout-jump',
            clientOrderId: bridgeScoutClientOrderId(profile.id, symbol, clock.nowMs(), 'BUY'),
          },
          params: { type: 'MARKET', quantity: sized.quantity },
        });
        decisions.push({ type: 'set-kv', key: KV_HELD_KEY, value: symbol });
        decisions.push({ type: 'delete-kv', key: KV_PENDING_BUY_KEY });
        // Full reference refresh (see scout.ts design note): every coin's
        // reference resets to its current live price at this jump instant.
        for (const [sib, sibPrice] of allPrices(kv, symbol, price)) {
          decisions.push({
            type: 'set-kv',
            key: `${KV_REF_PREFIX}${sib}`,
            value: sibPrice.toFixed(),
          });
        }
        logs.push(log('info', 'bridge-scout: buying the jump target', { symbol }));
        metrics.push(metric('bridgescout.jump-complete', { symbol }));
      } else {
        metrics.push(metric('bridgescout.decision', { symbol, reason: sized.skip }));
      }
    }
    return { nextState: state, decisions, logs, metrics };
  }

  metrics.push(metric('bridgescout.decision', { symbol, reason: 'candidate' }));
  return { nextState: state, decisions, logs, metrics };
};
