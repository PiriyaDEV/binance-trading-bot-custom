import type { Strategy } from '@app/strategy-core';

import {
  defaultBridgeScoutConfig,
  initialBridgeScoutState,
  BridgeScoutBundleSchema,
  BridgeScoutConfigSchema,
  BridgeScoutOverrideConfigSchema,
  BridgeScoutStateSchema,
  type BridgeScoutBundle,
  type BridgeScoutConfig,
  type BridgeScoutState,
} from './schema.js';
import { computeTick } from './tick.js';
import { bridgeScoutPositionAdapter } from './position-adapter.js';
import { bridgeScoutPreviewLevels, bridgeScoutPreviewDataNeeds } from './preview.js';

export { bridgeScoutPositionAdapter } from './position-adapter.js';
export { bridgeScoutPreviewLevels, bridgeScoutPreviewDataNeeds } from './preview.js';
export {
  BridgeScoutBundleSchema,
  BridgeScoutConfigSchema,
  BridgeScoutOverrideConfigSchema,
  BridgeScoutStateSchema,
  BRIDGE_SCOUT_STATE_SCHEMA_VERSION,
  defaultBridgeScoutConfig,
  initialBridgeScoutState,
  type BridgeScoutBundle,
  type BridgeScoutConfig,
  type BridgeScoutOverrideConfig,
  type BridgeScoutState,
} from './schema.js';
export {
  computeTick,
  KV_PRICE_PREFIX,
  KV_REF_PREFIX,
  KV_HELD_KEY,
  KV_PENDING_BUY_KEY,
} from './tick.js';
export {
  scoutScore,
  bestJump,
  combinedRoundTripFee,
  type ScoutQuote,
  type ScoutedJump,
} from './scout.js';
export { bridgeScoutClientOrderId } from './client-order-id.js';

/**
 * Bridge scout: rotates the ENTIRE position between the profile's bound
 * coins, always holding at most one at a time, jumping to whichever coin's
 * fee-adjusted price ratio against the held coin has improved the most since
 * the reference snapshot. Ported from ccxt/binance-trade-bot's core "scout"
 * algorithm (`AutoTrader._jump_to_best_coin`) — see `scout.ts` for the ratio
 * math and its documented deviation from upstream's per-pair reference
 * bookkeeping. Cross-symbol (needs `needsProfileKv`), like rebalance.
 * Disabled by default — the operator backtests it before turning it on.
 */

/**
 * No `attributeOrder`, deliberately, for the same reason as rebalance: every
 * order this strategy places is a `MARKET` order that fills or is rejected
 * immediately, so it can never leave a resting order behind for the orphan
 * detector to find. Its clientOrderId also folds `clock.nowMs()`, unbounded
 * runtime data not re-derivable from the order alone.
 *
 * If bridge-scout ever grows a resting order type, it MUST gain an
 * `attributeOrder` in the same change (see rebalance's `index.ts` for the
 * full rationale).
 */
export const bridgeScout: Strategy<BridgeScoutConfig, BridgeScoutState, BridgeScoutBundle> = {
  name: 'bridge-scout',
  version: '1.0.0',
  displayName: 'Bridge Scout',
  description:
    'Hold one coin at a time and jump to whichever bound coin has pulled ahead on a fee-adjusted price ratio. Cross-symbol; off by default.',
  capabilities: {
    // No candle interval: this strategy reads only the tick's current price,
    // never a candle window.
    candleIntervals: [],
    needsUserDataStream: true,
    needsMiniTicker: true,
    needsProfileKv: true,
    bundleProviders: [],
    operatorActions: [],
  },
  configSchema: BridgeScoutConfigSchema,
  overrideConfigSchema: BridgeScoutOverrideConfigSchema,
  stateSchema: BridgeScoutStateSchema,
  bundleSchema: BridgeScoutBundleSchema,
  events: {},
  defaultConfig: defaultBridgeScoutConfig(),
  position: bridgeScoutPositionAdapter,
  initialState: initialBridgeScoutState,
  previewDataNeeds: bridgeScoutPreviewDataNeeds,
  previewLevels: bridgeScoutPreviewLevels,
  tick: computeTick,
};
