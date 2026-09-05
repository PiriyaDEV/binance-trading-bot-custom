import { eq } from 'drizzle-orm';
import {
  presetBacktestPreviews,
  type PresetBacktestPreviewRow,
} from '../schema/preset-backtest-previews.js';
import type { Database } from './_db.js';

// Global, not account/profile-scoped: the four wizard presets are fixed
// constants, identical for every operator — see the schema's own doc comment.

export async function list(db: Database): Promise<PresetBacktestPreviewRow[]> {
  return db.select().from(presetBacktestPreviews);
}

export async function get(
  db: Database,
  presetId: string,
): Promise<PresetBacktestPreviewRow | null> {
  const rows = await db
    .select()
    .from(presetBacktestPreviews)
    .where(eq(presetBacktestPreviews.presetId, presetId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsert(
  db: Database,
  input: {
    presetId: string;
    candleInterval: string;
    pickedSymbols: unknown;
    robustness: unknown;
    clearsGate: boolean;
    windowDays: number;
    ranAt: Date;
  },
): Promise<PresetBacktestPreviewRow> {
  const [row] = await db
    .insert(presetBacktestPreviews)
    .values(input)
    .onConflictDoUpdate({
      target: presetBacktestPreviews.presetId,
      set: {
        candleInterval: input.candleInterval,
        pickedSymbols: input.pickedSymbols,
        robustness: input.robustness,
        clearsGate: input.clearsGate,
        windowDays: input.windowDays,
        ranAt: input.ranAt,
      },
    })
    .returning();
  if (!row) throw new Error('preset-backtest-previews.upsert: insert returned no row');
  return row;
}
