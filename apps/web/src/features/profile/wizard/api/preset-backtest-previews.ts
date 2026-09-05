import {
  PresetBacktestPreviewListResponse,
  PresetBacktestPreviewSchema,
  type PresetBacktestPreview,
  type PresetBacktestPreviewListResponse as PresetBacktestPreviewListResponseType,
  type PresetBacktestPreviewUpsert,
} from '@app/contracts';

import { apiFetch } from '@/shared/lib/api';

/** Query key for the shared, server-cached preset previews (global — no account scope). */
export const presetBacktestPreviewsQueryKey = (): readonly unknown[] => [
  'preset-backtest-previews',
];

/** GET /preset-backtest-previews — every preset that has ever been run, server-wide. */
export const fetchPresetBacktestPreviews = (): Promise<PresetBacktestPreviewListResponseType> =>
  apiFetch('/preset-backtest-previews', PresetBacktestPreviewListResponse, { method: 'GET' });

/** PUT /preset-backtest-previews/:presetId — called once after a fresh (cache-miss) run finishes, so every later visit reads the shared result instead of re-running. */
export const savePresetBacktestPreview = (
  presetId: string,
  body: PresetBacktestPreviewUpsert,
): Promise<PresetBacktestPreview> =>
  apiFetch(`/preset-backtest-previews/${presetId}`, PresetBacktestPreviewSchema, {
    method: 'PUT',
    body,
  });
