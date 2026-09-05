// Minimal Binance USDT-M Futures REST client — the futures sibling of
// `binance-rest.ts`. A separate file, not a mode flag on the Spot client: per
// that file's own design note, "a client built for one [environment] cannot
// reach the other so mode is a constructor input" — the same reasoning
// extends to market type, since Futures is a different host family
// (`fapi.binance.com` / `testnet.binancefuture.com`), different credentials
// (Futures Testnet issues its own key pair, separate from Spot Testnet's),
// different order-side vocabulary (`positionSide`, `reduceOnly`), and a
// margin-account response shape instead of a wallet-balance one.
//
// Scope (Phase 0/1 of the futures rollout — see the session plan): account +
// position reads, leverage/position-mode setup, and order placement/cancel.
// Deliberately NOT included yet: a weight governor (Futures has its own
// weight table, distinct from Spot's — reserved for a later pass once real
// call volume justifies it) and the Spot client's -1021 clock-resync /
// bounded-GET-retry sophistication. Both are additive, not breaking, to add
// later; starting without them keeps this file reviewable on its own.
//
// Binance Futures REST docs: https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info

import { createHmac } from 'node:crypto';
import { BINANCE_FUTURES_HOSTS, type BinanceMode } from './endpoints.js';
import {
  BinanceApiError,
  BinanceNonJsonBodyError,
  type BinanceCredentials,
} from './binance-rest.js';

export {
  BINANCE_FUTURES_HOSTS,
  BINANCE_FUTURES_WS_HOSTS,
  BINANCE_FUTURES_USER_WS_HOSTS,
} from './endpoints.js';

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_RECV_WINDOW_MS = 5_000;

export type FuturesPositionSide = 'LONG' | 'SHORT';
export type FuturesOrderSide = 'BUY' | 'SELL';
/** Futures order-type vocabulary — distinct from Spot's `STOP_LOSS`/`STOP_LOSS_LIMIT`, which the Futures API rejects. */
export type FuturesOrderType = 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';

/** One asset's margin-wallet line from `GET /fapi/v2/account`. */
export interface FuturesAssetDto {
  readonly asset: string;
  readonly walletBalance: string;
  readonly availableBalance: string;
  readonly unrealizedProfit: string;
}

/** One symbol's open position from `GET /fapi/v2/account` or `/fapi/v2/positionRisk`. */
export interface FuturesPositionDto {
  readonly symbol: string;
  /** Signed by Binance (positive = long, negative = short) in One-way mode; this client normalises callers to `positionSide` + a positive `quantity` instead of propagating the sign inward — see `packages/db/src/schema/avg-entry-prices.ts`. */
  readonly positionAmt: string;
  readonly entryPrice: string;
  readonly markPrice: string;
  readonly unRealizedProfit: string;
  readonly liquidationPrice: string;
  readonly leverage: string;
  readonly positionSide: FuturesPositionSide | 'BOTH';
  readonly isolated: boolean;
}

export interface FuturesAccountDto {
  readonly totalWalletBalance: string;
  readonly totalUnrealizedProfit: string;
  readonly totalMarginBalance: string;
  readonly availableBalance: string;
  readonly assets: readonly FuturesAssetDto[];
  readonly positions: readonly FuturesPositionDto[];
}

export interface FuturesPlaceOrderParams {
  readonly symbol: string;
  readonly side: FuturesOrderSide;
  readonly positionSide: FuturesPositionSide;
  readonly type: FuturesOrderType;
  readonly quantity: string;
  readonly price?: string;
  readonly stopPrice?: string;
  /** True for a closing order (covering a short / exiting a long) so Binance rejects it rather than flipping or opening the opposite side on a sizing mistake. */
  readonly reduceOnly?: boolean;
  readonly timeInForce?: 'GTC' | 'IOC' | 'FOK';
  readonly newClientOrderId: string;
}

export interface FuturesPlaceOrderDto {
  readonly orderId: number;
  readonly symbol: string;
  readonly status: string;
  readonly clientOrderId: string;
  readonly side: FuturesOrderSide;
  readonly positionSide: FuturesPositionSide | 'BOTH';
  readonly type: FuturesOrderType;
  readonly origQty: string;
  readonly executedQty: string;
  readonly avgPrice: string;
  readonly reduceOnly: boolean;
}

export interface FuturesCancelOrderDto {
  readonly orderId: number;
  readonly symbol: string;
  readonly status: string;
  readonly clientOrderId: string;
}

export interface FuturesOpenOrderDto extends FuturesPlaceOrderDto {
  readonly price: string;
  readonly stopPrice: string;
}

export interface FuturesExchangeSymbolDto {
  readonly symbol: string;
  readonly status: string;
  readonly baseAsset: string;
  readonly quoteAsset: string;
  readonly filters: readonly Record<string, unknown>[];
}

export interface FuturesExchangeInfoDto {
  readonly symbols: readonly FuturesExchangeSymbolDto[];
}

export interface FuturesKlineRow {
  readonly openMs: number;
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
  readonly volume: string;
  readonly closeMs: number;
}

export interface BinanceFuturesRestClient {
  getAccount(): Promise<FuturesAccountDto>;
  getPositionRisk(symbol?: string): Promise<readonly FuturesPositionDto[]>;
  getExchangeInfo(): Promise<FuturesExchangeInfoDto>;
  getKlines(symbol: string, interval: string, limit?: number): Promise<readonly FuturesKlineRow[]>;
  /** Clamps to 1–3 before calling Binance — the app's fixed low-leverage policy, enforced here so no caller can bypass it by constructing the request differently. */
  setLeverage(symbol: string, leverage: number): Promise<{ symbol: string; leverage: number }>;
  /** One-way position mode (`dualSidePosition: false`) is the only mode this app supports — see the session plan's cross-cutting decision #1. */
  setPositionMode(dualSidePosition: false): Promise<void>;
  placeOrder(params: FuturesPlaceOrderParams): Promise<FuturesPlaceOrderDto>;
  cancelOrder(params: { symbol: string; orderId: number }): Promise<FuturesCancelOrderDto>;
  getOrder(params: { symbol: string; orderId: number }): Promise<FuturesOpenOrderDto>;
  getOpenOrders(symbol?: string): Promise<readonly FuturesOpenOrderDto[]>;
}

export interface CreateBinanceFuturesRestOptions {
  readonly mode: BinanceMode;
  readonly credentials: BinanceCredentials;
  readonly fetchImpl?: typeof fetch;
  readonly recvWindow?: number;
  readonly clock?: { nowMs(): number };
}

type QsParams = Record<string, string | number | boolean | undefined>;

const MIN_LEVERAGE = 1;
const MAX_LEVERAGE = 3;

const classifyRetryable = (status: number): boolean => status === 429 || status >= 500;

export const createBinanceFuturesRest = (
  opts: CreateBinanceFuturesRestOptions,
): BinanceFuturesRestClient => {
  const host = BINANCE_FUTURES_HOSTS[opts.mode];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const recvWindow = opts.recvWindow ?? DEFAULT_RECV_WINDOW_MS;
  const clock = opts.clock ?? { nowMs: () => Date.now() };

  const sign = (qs: string): string =>
    createHmac('sha256', opts.credentials.secretKey).update(qs).digest('hex');

  const buildQs = (params: QsParams): string => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      sp.append(k, String(v));
    }
    return sp.toString();
  };

  const call = async <T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    params: QsParams,
    needsSignature: boolean,
  ): Promise<T> => {
    const merged: QsParams = { ...params };
    if (needsSignature) {
      merged['recvWindow'] = recvWindow;
      merged['timestamp'] = clock.nowMs();
    }
    let qs = buildQs(merged);
    if (needsSignature) {
      qs = `${qs}&signature=${sign(qs)}`;
    }
    const url =
      method === 'GET' || method === 'DELETE'
        ? `${host}${path}${qs ? `?${qs}` : ''}`
        : `${host}${path}`;
    const headers: Record<string, string> = needsSignature
      ? { 'X-MBX-APIKEY': opts.credentials.apiKey }
      : {};
    let body: string | undefined;
    if (method === 'POST' || method === 'PUT') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = qs;
    }
    const res = await fetchImpl(url, {
      method,
      headers,
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      let payload = { status: res.status, code: 0, msg: res.statusText };
      let codeRead = false;
      try {
        const j = (await res.json()) as { code?: number; msg?: string };
        if (typeof j.code === 'number') {
          payload = { ...payload, code: j.code };
          codeRead = true;
        }
        if (typeof j.msg === 'string') payload = { ...payload, msg: j.msg };
      } catch {
        // body wasn't JSON; ignore
      }
      throw new BinanceApiError(
        payload,
        classifyRetryable(payload.status),
        // A POST/PUT/DELETE whose response we never read could have executed;
        // a read code means Binance answered, so nothing executed.
        codeRead ? 'rejected' : 'ambiguous',
      );
    }
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      const excerpt = text.length > 200 ? `${text.slice(0, 200)}…` : text;
      throw new BinanceNonJsonBodyError(
        `Binance Futures ${method} ${path}: response body was not JSON (${err instanceof Error ? err.message : String(err)}); body=${JSON.stringify(excerpt)}`,
      );
    }
  };

  return {
    async getAccount() {
      return call<FuturesAccountDto>('GET', '/fapi/v2/account', {}, true);
    },
    async getPositionRisk(symbol) {
      return call<readonly FuturesPositionDto[]>(
        'GET',
        '/fapi/v2/positionRisk',
        symbol ? { symbol } : {},
        true,
      );
    },
    async getExchangeInfo() {
      return call<FuturesExchangeInfoDto>('GET', '/fapi/v1/exchangeInfo', {}, false);
    },
    async getKlines(symbol, interval, limit) {
      const rows = await call<readonly unknown[]>(
        'GET',
        '/fapi/v1/klines',
        { symbol, interval, limit },
        false,
      );
      return rows.map((r) => {
        const row = r as readonly unknown[];
        return {
          openMs: row[0] as number,
          open: row[1] as string,
          high: row[2] as string,
          low: row[3] as string,
          close: row[4] as string,
          volume: row[5] as string,
          closeMs: row[6] as number,
        };
      });
    },
    async setLeverage(symbol, leverage) {
      const clamped = Math.min(MAX_LEVERAGE, Math.max(MIN_LEVERAGE, Math.round(leverage)));
      return call<{ symbol: string; leverage: number }>(
        'POST',
        '/fapi/v1/leverage',
        { symbol, leverage: clamped },
        true,
      );
    },
    async setPositionMode(dualSidePosition) {
      await call<{ code: number; msg: string }>(
        'POST',
        '/fapi/v1/positionSide/dual',
        { dualSidePosition },
        true,
      );
    },
    async placeOrder(params) {
      return call<FuturesPlaceOrderDto>(
        'POST',
        '/fapi/v1/order',
        {
          symbol: params.symbol,
          side: params.side,
          positionSide: params.positionSide,
          type: params.type,
          quantity: params.quantity,
          price: params.price,
          stopPrice: params.stopPrice,
          reduceOnly: params.reduceOnly,
          timeInForce: params.timeInForce,
          newClientOrderId: params.newClientOrderId,
        },
        true,
      );
    },
    async cancelOrder(params) {
      return call<FuturesCancelOrderDto>(
        'DELETE',
        '/fapi/v1/order',
        { symbol: params.symbol, orderId: params.orderId },
        true,
      );
    },
    async getOrder(params) {
      return call<FuturesOpenOrderDto>(
        'GET',
        '/fapi/v1/order',
        { symbol: params.symbol, orderId: params.orderId },
        true,
      );
    },
    async getOpenOrders(symbol) {
      return call<readonly FuturesOpenOrderDto[]>(
        'GET',
        '/fapi/v1/openOrders',
        symbol ? { symbol } : {},
        true,
      );
    },
  };
};
