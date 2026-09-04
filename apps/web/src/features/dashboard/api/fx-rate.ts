import { FxRateResponseSchema, type FxRateResponse } from '@app/contracts';

import { apiFetch } from '@/shared/lib/api';

/** Query key for the cached USD→THB rate poll. */
export const fxRateQueryKey = (): readonly unknown[] => ['fx-rate', 'usdthb'];

/**
 * GET /fx-rate/usdthb. `rate` is null while the api has never successfully
 * reached the upstream feed; the caller renders the USDT figure alone then,
 * never a guessed conversion.
 */
export const fetchFxRateUsdThb = (): Promise<FxRateResponse> =>
  apiFetch(`/fx-rate/usdthb`, FxRateResponseSchema, { method: 'GET' });
