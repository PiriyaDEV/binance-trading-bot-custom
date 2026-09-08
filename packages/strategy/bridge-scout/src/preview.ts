import type { PreviewInput, PreviewModel, PreviewRow, PreviewSection } from '@app/strategy-core';

import type { BridgeScoutConfig, BridgeScoutState } from './schema.js';

const str = (raw: unknown): string | null => (typeof raw === 'string' && raw !== '' ? raw : null);

/**
 * Bridge-scout is PRICE-LESS like rebalance: it trades on a cross-coin ratio
 * threshold, not a price level, so no row carries a price and no row arms a
 * price trigger. Pure, reads the config DEFENSIVELY (the live worker may pass
 * it unparsed). Renders the tuning as informational rows — there is no
 * basket/target list to show, since the coin universe is the profile's bound
 * symbols, not something this config declares.
 */
export const bridgeScoutPreviewLevels = (
  input: PreviewInput<BridgeScoutConfig, BridgeScoutState>,
): PreviewModel => {
  const { config, state } = input;
  const c = config as {
    enabled?: unknown;
    scoutMultiplier?: unknown;
    assumedFeeRatePct?: unknown;
    minTradeQuote?: unknown;
  };
  const held = state !== null && str(state.heldQuantity) !== null;

  const rows: PreviewRow[] = [
    {
      code: 'status',
      tone: 'neutral',
      trigger: held,
      note: held
        ? 'This symbol is (or may be) the currently held coin — its tick scouts for a better coin to jump to.'
        : 'This symbol is a jump candidate — it is scored whenever the held coin scouts.',
    },
    {
      code: 'scout-multiplier',
      label: 'Fee buffer',
      tone: 'neutral',
      note: `A jump must clear the round-trip fee by ${String(c.scoutMultiplier ?? '')}x before it fires.`,
    },
    {
      code: 'assumed-fee',
      label: 'Assumed fee',
      tone: 'neutral',
      note: `${String(c.assumedFeeRatePct ?? '')} per leg (no live fee-tier lookup).`,
    },
    {
      code: 'min-trade',
      label: 'Minimum trade',
      tone: 'neutral',
      note: `Jumps below ${String(c.minTradeQuote ?? '')} quote units are skipped.`,
    },
  ];
  if (c.enabled !== true) {
    rows.unshift({
      code: 'disabled',
      tone: 'neutral',
      note: 'Disabled: this profile publishes its price to the cross-symbol store but places no orders.',
    });
  }
  const section: PreviewSection = { title: 'Bridge scout', rows };
  return { sections: [section] };
};

/** Bridge-scout reads only the tick's current price; the preview needs no extra history. */
export const bridgeScoutPreviewDataNeeds = (
  _config: BridgeScoutConfig,
): readonly { readonly interval: string; readonly frames: number }[] => [];
