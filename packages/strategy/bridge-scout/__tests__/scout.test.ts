import { describe, expect, it } from 'vitest';
import { Decimal } from '@app/money';
import { bestJump, combinedRoundTripFee, scoutScore, type ScoutQuote } from '../src/scout.js';

const q = (symbol: string, price: string, refPrice: string): ScoutQuote => ({
  symbol,
  price: new Decimal(price),
  refPrice: new Decimal(refPrice),
});

describe('combinedRoundTripFee', () => {
  it('doubles a small per-leg fee minus the second-order overlap', () => {
    // f + f - f*f, at f=0.001: 0.002 - 0.000001 = 0.001999
    expect(combinedRoundTripFee(new Decimal('0.001')).toString()).toBe('0.001999');
  });

  it('is exact at the boundaries', () => {
    expect(combinedRoundTripFee(new Decimal('0')).toString()).toBe('0');
    // f=1: 1 + 1 - 1 = 1
    expect(combinedRoundTripFee(new Decimal('1')).toString()).toBe('1');
  });
});

describe('scoutScore', () => {
  const noFee = new Decimal('0');

  it('is zero when held and candidate have moved identically since reference (no edge)', () => {
    const held = q('A', '100', '100');
    const candidate = q('B', '50', '50');
    const score = scoutScore({ held, candidate, combinedFee: noFee, scoutMultiplier: 1 });
    // liveRatio = 100/50 = 2, referenceRatio = 100/50 = 2, score = 2 - 2 = 0
    expect(score.toString()).toBe('0');
  });

  it('is positive when the candidate has fallen relative to held since reference', () => {
    // Held unchanged (100 -> 100), candidate fell (50 -> 40): held is now
    // relatively STRONGER against candidate than at reference time, so
    // jumping INTO the candidate (buying low) scores positive.
    const held = q('A', '100', '100');
    const candidate = q('B', '40', '50');
    const score = scoutScore({ held, candidate, combinedFee: noFee, scoutMultiplier: 1 });
    // liveRatio = 100/40 = 2.5, referenceRatio = 100/50 = 2, score = 0.5
    expect(score.toString()).toBe('0.5');
  });

  it('is negative when the candidate has risen relative to held since reference', () => {
    const held = q('A', '100', '100');
    const candidate = q('B', '60', '50');
    const score = scoutScore({ held, candidate, combinedFee: noFee, scoutMultiplier: 1 });
    // liveRatio = 100/60 = 1.666..., referenceRatio = 2, score < 0
    expect(score.lt(0)).toBe(true);
  });

  it('fees eat into an otherwise-positive score, and scale with scoutMultiplier', () => {
    const held = q('A', '100', '100');
    const candidate = q('B', '40', '50');
    const fee = new Decimal('0.01');
    const unfee = scoutScore({ held, candidate, combinedFee: noFee, scoutMultiplier: 1 });
    const fee1x = scoutScore({ held, candidate, combinedFee: fee, scoutMultiplier: 1 });
    const fee5x = scoutScore({ held, candidate, combinedFee: fee, scoutMultiplier: 5 });
    expect(fee1x.lt(unfee)).toBe(true);
    expect(fee5x.lt(fee1x)).toBe(true);
  });

  it('a large enough fee buffer can turn a nominally-positive edge negative', () => {
    const held = q('A', '100', '100');
    const candidate = q('B', '49', '50'); // a thin 2% edge
    const thin = scoutScore({ held, candidate, combinedFee: noFee, scoutMultiplier: 1 });
    expect(thin.gt(0)).toBe(true);
    const buffered = scoutScore({
      held,
      candidate,
      combinedFee: new Decimal('0.05'),
      scoutMultiplier: 5,
    });
    expect(buffered.lt(0)).toBe(true);
  });
});

describe('bestJump', () => {
  const opts = { combinedFee: new Decimal('0'), scoutMultiplier: 1 };

  it('returns null when no candidate scores above zero', () => {
    const held = q('A', '100', '100');
    const candidates = [q('B', '50', '50'), q('C', '60', '50')]; // 0 and negative
    expect(bestJump(held, candidates, opts)).toBeNull();
  });

  it('returns null on an empty candidate list', () => {
    const held = q('A', '100', '100');
    expect(bestJump(held, [], opts)).toBeNull();
  });

  it('picks the highest-scoring candidate among several positive ones', () => {
    const held = q('A', '100', '100');
    const candidates = [
      q('B', '45', '50'), // decent edge
      q('C', '40', '50'), // bigger edge — should win
      q('D', '48', '50'), // small edge
    ];
    const best = bestJump(held, candidates, opts);
    expect(best?.symbol).toBe('C');
    expect(best?.score.gt(0)).toBe(true);
  });

  it('never selects itself even if present in the candidate list', () => {
    const held = q('A', '100', '90'); // A has "moved" relative to its own stale reference
    const candidates = [held, q('B', '200', '90')]; // B scores negative
    expect(bestJump(held, candidates, opts)).toBeNull();
  });

  it('a tie keeps the first-seen candidate (strict greater-than comparison)', () => {
    const held = q('A', '100', '100');
    const candidates = [q('B', '40', '50'), q('C', '40', '50')]; // identical scores
    const best = bestJump(held, candidates, opts);
    expect(best?.symbol).toBe('B');
  });
});
