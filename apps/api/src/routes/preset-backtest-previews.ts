// GET/PUT /preset-backtest-previews — the server-cached backtest preview for
// each "quick start" wizard preset (conservative/balanced/aggressive/smart).
//
// Global (no account/profile scope): the four presets' configs are fixed
// constants, identical for every operator, so ONE shared row per preset
// serves the whole install — see `packages/db/src/schema/preset-backtest-previews.ts`.
// The wizard reads this on every "New profile" visit so every browser shows
// the same "checked N ago" preview without re-running a year-long backtest
// itself; the wizard writes it back after a fresh run it had to make anyway
// (cache miss), so this row is never computed by the api directly.

import {
  ErrorEnvelope,
  PresetBacktestPreviewListResponse,
  PresetBacktestPreviewSchema,
  PresetBacktestPreviewUpsert,
} from '@app/contracts';
import { repo } from '@app/db';
import { createRoute, z } from '@hono/zod-openapi';
import type { Logger } from 'pino';

import type { DI } from 'di.js';
import { requireUser } from 'middleware/require-user.js';
import { createApiHono, type ApiHono } from 'types.js';

/** Throws on a malformed row — callers that can tolerate one bad preset (the list route) should prefer {@link toResponseLenient}. */
const toResponse = (
  row: Awaited<ReturnType<typeof repo.presetBacktestPreviews.get>>,
): ReturnType<typeof PresetBacktestPreviewSchema.parse> | null => {
  if (row === null) return null;
  return PresetBacktestPreviewSchema.parse({
    presetId: row.presetId,
    candleInterval: row.candleInterval,
    pickedSymbols: row.pickedSymbols,
    robustness: row.robustness,
    clearsGate: row.clearsGate,
    windowDays: row.windowDays,
    ranAt: row.ranAt.toISOString(),
  });
};

/**
 * Same projection, but a row whose stored `robustness` predates a schema
 * change (e.g. a field this api version now requires) degrades to "no
 * preview for this preset" instead of failing the whole list — the wizard
 * writes a fresh row for that preset on its next backtest anyway. Mirrors
 * `market-trend.ts`'s "malformed snapshot serves null" convention.
 */
const toResponseLenient = (
  row: Awaited<ReturnType<typeof repo.presetBacktestPreviews.get>>,
  logger: Logger,
): ReturnType<typeof PresetBacktestPreviewSchema.parse> | null => {
  try {
    return toResponse(row);
  } catch (err) {
    logger.warn(
      { err, presetId: row?.presetId },
      'preset-backtest-previews: malformed stored row; omitting from the list',
    );
    return null;
  }
};

const listRoute = createRoute({
  method: 'get',
  path: '/preset-backtest-previews',
  tags: ['preset-backtest-previews'],
  responses: {
    200: {
      description: 'cached preview per preset that has ever been run',
      content: { 'application/json': { schema: PresetBacktestPreviewListResponse } },
    },
  },
});

const PresetIdParam = z.object({ presetId: z.string().min(1) });

const putRoute = createRoute({
  method: 'put',
  path: '/preset-backtest-previews/{presetId}',
  tags: ['preset-backtest-previews'],
  request: {
    params: PresetIdParam,
    body: { content: { 'application/json': { schema: PresetBacktestPreviewUpsert } } },
  },
  responses: {
    200: {
      description: 'the stored preview',
      content: { 'application/json': { schema: PresetBacktestPreviewSchema } },
    },
    422: {
      description: 'VALIDATION_FAILED',
      content: { 'application/json': { schema: ErrorEnvelope } },
    },
  },
});

export const presetBacktestPreviewsRouter = (di: DI): ApiHono => {
  const app = createApiHono();
  app.use('/preset-backtest-previews', requireUser());
  app.use('/preset-backtest-previews/*', requireUser());

  app.openapi(listRoute, async (c) => {
    const logger: Logger = di.logger;
    const rows = await repo.presetBacktestPreviews.list(di.db);
    const previews = rows.map((r) => toResponseLenient(r, logger)).filter((r) => r !== null);
    return c.json({ previews }, 200);
  });

  app.openapi(putRoute, async (c) => {
    const { presetId } = c.req.valid('param');
    const body = c.req.valid('json');
    const row = await repo.presetBacktestPreviews.upsert(di.db, {
      presetId,
      candleInterval: body.candleInterval,
      pickedSymbols: body.pickedSymbols,
      robustness: body.robustness,
      clearsGate: body.robustness.clearsGate,
      windowDays: body.windowDays,
      ranAt: new Date(),
    });
    const response = toResponse(row);
    if (response === null) throw new Error('preset-backtest-previews: upsert returned no row');
    return c.json(response, 200);
  });

  return app;
};
