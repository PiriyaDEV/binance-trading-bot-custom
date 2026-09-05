// GET /fx-rate/usdthb.
//
// Serves a cached USD→THB rate for the Home hero card's Thai-locale readout
// (USDT is treated as 1:1 with USD — a stablecoin peg, not a live market
// rate, which is the same approximation every retail crypto app makes for
// this exact conversion). Cache-miss fetches the free, keyless
// open.er-api.com rate feed server-side and writes it to Redis WITH a TTL
// (`FX_RATE_TTL_S`), unlike `market-trend`'s cron-fed, TTL-less key — nothing
// else keeps this one warm, so the key itself is the refresh schedule.
//
// Global data (no profile/account scope), but still behind `requireUser` —
// the whole app is single-operator and authenticated. The browser's CSP
// (`connect-src 'self'`) blocks it from reaching a third-party API directly,
// so this fetch has to happen server-side regardless.

import { ErrorEnvelope, FxRateResponseSchema } from '@app/contracts';
import { FX_RATE_TTL_S } from '@app/db';
import { createRoute } from '@hono/zod-openapi';
import type { Logger } from 'pino';

import type { DI } from 'di.js';
import { requireUser } from 'middleware/require-user.js';
import { createApiHono, type ApiHono } from 'types.js';

const RATE_PROVIDER_URL = 'https://open.er-api.com/v6/latest/USD';

interface CachedRate {
  readonly rate: number;
  readonly asOf: string;
}

/** Parses the upstream response defensively — an unexpected shape yields `null`, never a throw. */
const parseProviderResponse = (body: unknown): number | null => {
  if (typeof body !== 'object' || body === null) return null;
  const rates = (body as { rates?: unknown }).rates;
  if (typeof rates !== 'object' || rates === null) return null;
  const thb = (rates as { THB?: unknown }).THB;
  return typeof thb === 'number' && Number.isFinite(thb) && thb > 0 ? thb : null;
};

const route = createRoute({
  method: 'get',
  path: '/fx-rate/usdthb',
  tags: ['fx-rate'],
  responses: {
    200: {
      description: 'Cached USD→THB rate, or null while the upstream feed has never succeeded',
      content: { 'application/json': { schema: FxRateResponseSchema } },
    },
    500: {
      description: 'INTERNAL',
      content: { 'application/json': { schema: ErrorEnvelope } },
    },
  },
});

export const fxRateRouter = (di: DI): ApiHono => {
  const app = createApiHono();
  app.use('/fx-rate/usdthb', requireUser());

  app.openapi(route, async (c) => {
    const logger: Logger = di.logger;
    const cached = await di.redis.forGlobal().get('fxUsdThb');
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached) as CachedRate;
        return c.json({ rate: parsed.rate, asOf: parsed.asOf }, 200);
      } catch (err) {
        logger.warn({ err }, 'fx-rate: malformed cache entry; refetching');
      }
    }

    try {
      const res = await fetch(RATE_PROVIDER_URL);
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const rate = parseProviderResponse(await res.json());
      if (rate === null) throw new Error('unparseable upstream body');

      const asOf = new Date().toISOString();
      await di.redis
        .forGlobal()
        .set('fxUsdThb', JSON.stringify({ rate, asOf }), { ttlSeconds: FX_RATE_TTL_S });
      return c.json({ rate, asOf }, 200);
    } catch (err) {
      logger.warn({ err }, 'fx-rate: upstream fetch failed; serving null');
      return c.json({ rate: null, asOf: null }, 200);
    }
  });

  return app;
};
