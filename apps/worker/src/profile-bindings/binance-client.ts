// Per-profile Binance REST client construction.
//
// Isolated from `index.ts` so that:
//   1. `buildProfileBindings` can be unit-tested by stubbing this single
//      factory rather than `@app/binance` at module level.
//   2. A future swap (mode override for canary testing, ratelimit
//      decorator) lands here without touching the bindings factory.

import {
  createBinanceFuturesRest,
  createBinanceRest,
  type BinanceFuturesRestClient,
  type BinanceMode,
  type BinanceRestClient,
  type OrderRateGovernor,
  type WeightGovernor,
} from '@app/binance';

/**
 * Inputs that uniquely identify a per-profile REST client. `mode` chooses
 * the URL host (live vs testnet); `apiKey`/`secretKey` are read straight
 * from the `api_keys` row and forwarded unchanged so the HMAC signature
 * stays profile-scoped at this boundary — no caching, no rewriting.
 *
 * `weightGovernor` is an optional shared admission control across every
 * profile's client. Wiring all profiles to one governor keeps the per-IP
 * Binance budget honest no matter how many profiles a single worker serves.
 *
 * `orderGovernor` is its per-ACCOUNT counterpart: Binance meters orders
 * against the UID, not the IP, so this one is shared across an account's
 * profiles but never across accounts.
 */
export interface BuildBinanceClientInput {
  readonly mode: BinanceMode;
  readonly apiKey: string;
  readonly secretKey: string;
  readonly weightGovernor?: WeightGovernor;
  readonly orderGovernor?: OrderRateGovernor;
}

/**
 * Construct a `BinanceRestClient` bound to a single profile's credentials.
 * Thin wrapper over `createBinanceRest`; exists so that callers consume a
 * narrow factory shape instead of leaking `CreateBinanceRestOptions` (with
 * its `fetchImpl`/`clock` knobs that bindings code has no business setting).
 */
export const buildBinanceClient = (input: BuildBinanceClientInput): BinanceRestClient =>
  createBinanceRest({
    mode: input.mode,
    credentials: { apiKey: input.apiKey, secretKey: input.secretKey },
    ...(input.weightGovernor ? { weightGovernor: input.weightGovernor } : {}),
    ...(input.orderGovernor ? { orderGovernor: input.orderGovernor } : {}),
  });

/**
 * Inputs that uniquely identify a per-profile FUTURES REST client. A sibling
 * to {@link BuildBinanceClientInput}, not an overload of it — a futures
 * account's credentials never construct a spot client and vice versa (see
 * `packages/binance/src/binance-futures-rest.ts`'s header comment). No
 * weight/order governor yet: Futures has its own weight table, distinct from
 * Spot's, reserved for a later pass (session plan Phase 0 scope).
 */
export interface BuildFuturesBinanceClientInput {
  readonly mode: BinanceMode;
  readonly apiKey: string;
  readonly secretKey: string;
}

/** Construct a `BinanceFuturesRestClient` bound to a single futures-mode account's credentials. */
export const buildFuturesBinanceClient = (
  input: BuildFuturesBinanceClientInput,
): BinanceFuturesRestClient =>
  createBinanceFuturesRest({
    mode: input.mode,
    credentials: { apiKey: input.apiKey, secretKey: input.secretKey },
  });
