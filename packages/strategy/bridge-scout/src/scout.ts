// Pure ratio-scouting math, ported from ccxt/binance-trade-bot's
// `AutoTrader._get_ratios` / `_jump_to_best_coin` (auto_trader.py, USE_MARGIN
// == "no" branch — the project's default). No I/O, no Decimal rounding beyond
// what the inputs already carry; every money value is a Decimal.
//
// The strategy holds exactly ONE non-bridge coin at a time. On every tick for
// the HELD coin it scores every other bound coin ("candidates") and jumps
// (sells held, buys the winner) when a candidate clears the fee-adjusted
// reference ratio by more than zero. The winner is whichever candidate scores
// highest, mirroring `max(ratio_dict, key=ratio_dict.get)`.
//
// Reference-ratio design note (deliberate deviation from ccxt): the upstream
// bot keeps one ratio PER ORDERED PAIR, timestamped to whenever that pair's
// "to" coin was last bought — so two pairs can carry reference snapshots from
// different points in time. This port keeps one reference PRICE per coin
// instead, and refreshes EVERY coin's reference to its current live price at
// the moment of any jump (see tick.ts `refreshAllReferences`). This is
// simpler to reason about (one consistent snapshot instant, not N stale ones)
// and cannot systematically bias jumps toward or away from any coin, but it
// is not a byte-for-byte port of ccxt's bookkeeping — flag this if exact
// parity with the upstream bot's trade log matters to you.

import { Decimal } from '@app/money';

/** A coin's live price and its reference-ratio baseline price. */
export interface ScoutQuote {
  readonly symbol: string;
  readonly price: Decimal;
  readonly refPrice: Decimal;
}

export interface ScoutedJump {
  readonly symbol: string;
  readonly score: Decimal;
}

/**
 * Combined round-trip fee for a sell-then-buy pair, from a single assumed
 * per-leg rate — ccxt's `from_fee + to_fee - from_fee*to_fee` specialised to
 * two equal legs (this port has no live per-symbol fee lookup, see
 * `BridgeScoutConfig.assumedFeeRatePct`).
 */
export const combinedRoundTripFee = (perLegFeeRate: Decimal): Decimal =>
  perLegFeeRate.plus(perLegFeeRate).minus(perLegFeeRate.mul(perLegFeeRate));

/**
 * Fee-adjusted attractiveness of jumping from `held` to one `candidate`.
 * Positive means the candidate is worth jumping to; the strategy jumps to
 * whichever candidate scores highest among the positive scores.
 *
 * Ported 1:1 from ccxt's non-margin formula:
 *   liveRatio      = heldPrice / candidatePrice
 *   feeAdjusted    = liveRatio - combinedFee * scoutMultiplier * liveRatio
 *   referenceRatio = heldRefPrice / candidateRefPrice
 *   score          = feeAdjusted - referenceRatio
 */
export const scoutScore = (params: {
  readonly held: ScoutQuote;
  readonly candidate: ScoutQuote;
  readonly combinedFee: Decimal;
  readonly scoutMultiplier: number;
}): Decimal => {
  const { held, candidate, combinedFee, scoutMultiplier } = params;
  const liveRatio = held.price.div(candidate.price);
  const feeAdjusted = liveRatio.minus(combinedFee.mul(scoutMultiplier).mul(liveRatio));
  const referenceRatio = held.refPrice.div(candidate.refPrice);
  return feeAdjusted.minus(referenceRatio);
};

/**
 * Score every candidate against the held coin and return the highest-scoring
 * one, or `null` when no candidate scores above zero — mirrors ccxt's
 * `_jump_to_best_coin`: filter to positive scores, then pick the max.
 */
export const bestJump = (
  held: ScoutQuote,
  candidates: readonly ScoutQuote[],
  opts: { readonly combinedFee: Decimal; readonly scoutMultiplier: number },
): ScoutedJump | null => {
  let best: ScoutedJump | null = null;
  for (const candidate of candidates) {
    if (candidate.symbol === held.symbol) continue;
    const score = scoutScore({ held, candidate, ...opts });
    if (score.gt(0) && (best === null || score.gt(best.score))) {
      best = { symbol: candidate.symbol, score };
    }
  }
  return best;
};
