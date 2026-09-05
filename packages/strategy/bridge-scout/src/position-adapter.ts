import {
  asStringOrNull,
  currentSchemaBody,
  type AdoptedFill,
  type PositionStateAdapter,
  type PositionView,
} from '@app/strategy-core';
import { BRIDGE_SCOUT_STATE_SCHEMA_VERSION, type BridgeScoutState } from './schema.js';

const asCurrentBody = (state: unknown): Record<string, unknown> | null =>
  currentSchemaBody(BRIDGE_SCOUT_STATE_SCHEMA_VERSION, state);

/**
 * Bridge-scout's position capability: maps its persisted body onto the
 * generic `PositionStateAdapter` the worker's boot reconcilers and
 * fill-adopter drive. Every method returns `null` (no-op) on a foreign /
 * un-migrated body, never throwing. Same shape as rebalance's adapter
 * (`avgEntryPrice`, `heldQuantity`) — bridge-scout holds one long position
 * per symbol just like rebalance does, it just holds at most one non-zero
 * position across the whole profile at a time (enforced by the tick logic,
 * not by this adapter).
 */
export const bridgeScoutPositionAdapter: PositionStateAdapter<BridgeScoutState> = {
  readPosition(state): PositionView | null {
    const body = asCurrentBody(state);
    if (body === null) return null;
    const avgEntryPrice = asStringOrNull(body['avgEntryPrice']);
    const heldQuantity = asStringOrNull(body['heldQuantity']);
    if (avgEntryPrice === undefined || heldQuantity === undefined) return null;
    return { avgEntryPrice, heldQuantity };
  },

  applyFill(state, fill: AdoptedFill): BridgeScoutState | null {
    const body = asCurrentBody(state);
    if (body === null) return null;
    switch (fill.kind) {
      case 'buy':
        return {
          ...(body as unknown as BridgeScoutState),
          avgEntryPrice: fill.avgEntryPrice,
          heldQuantity: fill.heldQuantity,
        };
      case 'sell-reduce':
        return { ...(body as unknown as BridgeScoutState), heldQuantity: fill.heldQuantity };
      // Bridge-scout never opens a short — see the strategy's own header
      // comment ("holds exactly ONE non-bridge coin at a time", a spot long
      // rotation). These kinds cannot occur for this strategy's own orders;
      // returned as a no-op rather than thrown so an unrelated future fill
      // source cannot crash the adapter on a kind it does not use.
      case 'sell-open':
      case 'buy-reduce':
        return null;
      case 'empty': {
        if (
          body['avgEntryPrice'] === null &&
          (body['heldQuantity'] === null || body['heldQuantity'] === undefined)
        ) {
          return null;
        }
        return {
          ...(body as unknown as BridgeScoutState),
          avgEntryPrice: null,
          heldQuantity: null,
        };
      }
    }
  },

  setHeldQuantity(state, heldQuantity): BridgeScoutState | null {
    const body = asCurrentBody(state);
    if (body === null) return null;
    return { ...(body as unknown as BridgeScoutState), heldQuantity };
  },

  setAvgEntryPrice(state, avgEntryPrice): BridgeScoutState | null {
    const body = asCurrentBody(state);
    if (body === null) return null;
    return { ...(body as unknown as BridgeScoutState), avgEntryPrice };
  },

  clearPosition(state): BridgeScoutState | null {
    const body = asCurrentBody(state);
    if (body === null) return null;
    return { ...(body as unknown as BridgeScoutState), avgEntryPrice: null };
  },
};
