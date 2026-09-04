import { useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { createBacktest, fetchBacktestRun } from '@/features/backtest/api/backtest';
import { createProfile, patchProfile } from '@/features/profile/api/profiles-mutations';
import { addProfileSymbol } from '@/features/symbol/api/symbols-mutations';
import {
  smartPresetBacktestParams,
  SMART_PRESET_WINDOW_DAYS,
} from '@/features/profile/wizard/smart-preset.js';
import {
  fetchPresetBacktestPreviews,
  presetBacktestPreviewsQueryKey,
  savePresetBacktestPreview,
} from '@/features/profile/wizard/api/preset-backtest-previews.js';
import type { WizardAction, WizardState } from '@/features/profile/wizard/reducer';
import { useActiveAccountId } from '@/shared/lib/account-scope';
import { ApiError } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

import { EnablementPolicy, ProfileCreate } from '@app/contracts';
import type {
  BacktestInterval,
  BacktestResult,
  BacktestRunDetail,
  StrategyDescriptor,
} from '@app/contracts';

/**
 * The same defaults `EnablementPolicy` ships (`minProfitFactor: 1.1`,
 * `minTrades: 100`, `minAlphaVsHoldPct: 0`, `minOutOfSampleTrades: 20`) —
 * parsed rather than re-typed as magic numbers, so this can never drift from
 * the real Live-gate's own bar.
 */
const GATE_DEFAULTS = EnablementPolicy.parse({});

/**
 * Whether a run clears every bar the real Live-gate checks (see
 * `packages/contracts/src/enablement-gate.ts` `gateThresholdChecks`, the
 * single source this mirrors): data coverage, in-sample profit factor /
 * trade count / alpha, AND the same three out-of-sample. A run that only
 * looks good on the holdout but not on the window as a whole (or vice versa)
 * does not clear — matching the real gate exactly is the whole point of
 * showing this badge before the operator ever reaches the real one.
 */
const clearsGate = (result: BacktestResult): boolean => {
  const m = result.metrics;
  const oos = result.outOfSample;
  return (
    result.dataWarnings.length === 0 &&
    m.profitFactor !== null &&
    m.profitFactor >= GATE_DEFAULTS.minProfitFactor &&
    m.totalTrades >= GATE_DEFAULTS.minTrades &&
    m.alphaVsHoldPct >= GATE_DEFAULTS.minAlphaVsHoldPct &&
    oos !== null &&
    oos.trades >= GATE_DEFAULTS.minOutOfSampleTrades &&
    oos.profitFactor !== null &&
    oos.profitFactor >= GATE_DEFAULTS.minProfitFactor &&
    oos.alphaVsHoldPct >= GATE_DEFAULTS.minAlphaVsHoldPct
  );
};

export interface SmartPresetPick {
  readonly symbol: string;
  readonly pnlQuote: string;
  readonly tradeCount: number;
}

/**
 * In-sample vs out-of-sample profit factor and alpha for the winning
 * basket run — the same two figures the profile's own Live-gate checks later
 * ("profit factor >= 1.1", "alpha vs hold >= 0%"), so the wizard can tell the
 * operator up front whether the pick looks likely to clear that gate, rather
 * than only finding out after enabling. `outOfSample` is null when the run's
 * window was too short to carve a holdout.
 */
export interface SmartPresetRobustness {
  /** The whole run's plain "how much money did this make" figure, net of fees — distinct from alpha (return relative to buy-and-hold). */
  readonly totalReturnPct: number;
  readonly inSample: { readonly profitFactor: number | null; readonly alphaVsHoldPct: number };
  readonly outOfSample: {
    readonly profitFactor: number | null;
    readonly alphaVsHoldPct: number;
    readonly trades: number;
  } | null;
  /** Whether the run clears every bar the real Live-gate checks — in-sample AND out-of-sample profit factor/alpha, trade counts, data coverage (see `clearsGate`). */
  readonly clearsGate: boolean;
}

export type SmartPresetProgress =
  | { readonly phase: 'idle' }
  | { readonly phase: 'creating-profile' }
  | { readonly phase: 'backtesting'; readonly completed: number; readonly total: number }
  | { readonly phase: 'binding' }
  | {
      readonly phase: 'done';
      readonly profileId: string;
      readonly interval: BacktestInterval;
      readonly picks: readonly SmartPresetPick[];
      readonly robustness: SmartPresetRobustness;
      /** Whether this result came from a cached preview instead of a fresh run — the caller labels it with the cache's age. */
      readonly fromCache: boolean;
    }
  | { readonly phase: 'error'; readonly message: string };

const POLL_MS = 2000;
const MAX_POLL_MS = 10 * 60 * 1000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls one run until it leaves queued/running, or the poll budget runs out. */
const awaitRun = async (
  profileId: string,
  runId: string,
  onTick?: () => void,
): Promise<BacktestRunDetail> => {
  const deadline = Date.now() + MAX_POLL_MS;
  for (;;) {
    const run = await fetchBacktestRun(profileId, runId);
    if (run.status !== 'queued' && run.status !== 'running') return run;
    onTick?.();
    if (Date.now() > deadline) return run; // still running: caller treats as unusable
    await sleep(POLL_MS);
  }
};

/**
 * Best interval among finished runs. Prefers a run that clears every bar the
 * real Live-gate checks (see `clearsGate`) — a candidate with a great
 * in-sample return but a losing holdout, or vice versa, is the classic
 * curve-fit trap the wizard should not hand the operator. Among
 * gate-clearing runs, picks the higher total return; with none clearing it,
 * falls back to the higher out-of-sample profit factor (closest to robust)
 * so the pick is still the LEAST curve-fit of the options tried, and the
 * caller can tell the operator it didn't clear the bar. Null if none
 * finished with a result at all.
 */
const pickBestRun = (
  runs: readonly { readonly interval: BacktestInterval; readonly run: BacktestRunDetail }[],
): { readonly interval: BacktestInterval; readonly run: BacktestRunDetail } | null => {
  const finished = runs.filter(
    (e): e is typeof e & { run: { result: NonNullable<BacktestRunDetail['result']> } } =>
      e.run.status === 'done' && e.run.result !== null && e.run.result !== undefined,
  );
  if (finished.length === 0) return null;

  const gateClearing = finished.filter((e) => clearsGate(e.run.result));
  const pool = gateClearing.length > 0 ? gateClearing : finished;
  const rank = (e: (typeof finished)[number]): number =>
    gateClearing.length > 0
      ? e.run.result.metrics.totalReturnPct
      : (e.run.result.outOfSample?.profitFactor ?? -Infinity);

  return pool.reduce((best, e) => (rank(e) > rank(best) ? e : best), pool[0]!);
};

/** The winning run's in-sample vs out-of-sample robustness figures, for the wizard's result screen. */
const robustnessOf = (run: BacktestRunDetail): SmartPresetRobustness => {
  const m = run.result!.metrics;
  const oos = run.result!.outOfSample;
  return {
    totalReturnPct: m.totalReturnPct,
    inSample: { profitFactor: m.profitFactor, alphaVsHoldPct: m.alphaVsHoldPct },
    outOfSample:
      oos === null
        ? null
        : {
            profitFactor: oos.profitFactor,
            alphaVsHoldPct: oos.alphaVsHoldPct,
            trades: oos.trades,
          },
    clearsGate: clearsGate(run.result!),
  };
};

/** Rank a run's per-symbol results by profit, best first — the pool both a fresh run and a cached one bind from. */
const rankedPicksOf = (run: BacktestRunDetail): SmartPresetPick[] =>
  [...run.result!.perSymbol]
    .sort((a, b) => Number(b.pnlQuote) - Number(a.pnlQuote))
    .map((c) => ({ symbol: c.symbol, pnlQuote: c.pnlQuote, tradeCount: c.tradeCount }));

/**
 * Binds ranked candidates to a freshly-created profile in order, skipping any
 * the account can't take right now (most commonly: its base asset is already
 * bound to another profile — this account enforces one profile per base
 * asset) — a conflict costs one slot, not the whole run, and re-checks live
 * against the CURRENT account even when `ranked` came from yesterday's cache
 * (a symbol another profile held then may be free now, or vice versa).
 */
const bindTopPicks = async (
  profileId: string,
  ranked: readonly SmartPresetPick[],
  maxSymbols: number,
): Promise<SmartPresetPick[]> => {
  const picks: SmartPresetPick[] = [];
  for (const candidate of ranked) {
    if (picks.length >= maxSymbols) break;
    try {
      await addProfileSymbol(profileId, { symbol: candidate.symbol });
      picks.push(candidate);
    } catch {
      // Conflict or any other per-symbol refusal — try the next-ranked one.
    }
  }
  return picks;
};

/**
 * How the run's result is applied once the backtest preview is done: rank
 * `perSymbol` by profit and bind the top `maxSymbols` candidates directly.
 * Every quick-start preset uses this now (Smart across its interval sweep,
 * the three risk tiers at their own fixed interval and cap) — the backtest
 * always picks the coins, so choosing a preset starts the bot trading
 * immediately instead of waiting on Discovery's next scan.
 */
export interface PresetBindMode {
  readonly maxSymbols: number;
}

/**
 * Shared backtest-preview-then-apply submit path for every "quick start"
 * preset — Smart AND the three risk tiers alike. A fixed preset's config
 * never changes between runs, so the FIRST successful run for a given
 * `presetId` is cached server-side (`preset_backtest_previews`, one row per
 * preset, shared by every operator — see `apps/api/src/routes/preset-backtest-previews.ts`)
 * and every later pick of the same preset, on any browser, applies it
 * instantly instead of re-running a now-year-long backtest. Creates the profile, backtests the
 * fixed candidate basket at each of `intervals` on a cache miss (Smart tests
 * two and picks the better; the risk tiers test just their own fixed
 * interval), shows the in-sample vs out-of-sample robustness so the operator
 * sees whether the config held up before committing, then binds the top
 * `bindMode.maxSymbols` candidates. Reports progress through `progress` so
 * the caller can show a live status instead of a single opaque spinner — a
 * cache miss can genuinely take several minutes over a year of candles.
 */
export function useSmartPresetSubmit(
  state: WizardState,
  dispatch: (a: WizardAction) => void,
): {
  readonly progress: SmartPresetProgress;
  readonly run: (
    presetId: string,
    trailingTrade: StrategyDescriptor,
    baseConfig: Record<string, unknown>,
    intervals: readonly BacktestInterval[],
    bindMode: PresetBindMode,
    options?: { readonly forceRefresh?: boolean },
  ) => Promise<void>;
  readonly goToProfile: () => void;
} {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accountId = useActiveAccountId() ?? '';
  const [progress, setProgress] = useState<SmartPresetProgress>({ phase: 'idle' });
  const inFlight = useRef(false);

  const run = async (
    presetId: string,
    trailingTrade: StrategyDescriptor,
    baseConfig: Record<string, unknown>,
    intervals: readonly BacktestInterval[],
    bindMode: PresetBindMode,
    options?: { readonly forceRefresh?: boolean },
  ): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: 'set-error', error: null });
    setProgress({ phase: 'creating-profile' });

    try {
      const body = ProfileCreate.parse({
        name: state.name,
        strategyName: trailingTrade.name,
        strategyVersion: trailingTrade.version,
        config: baseConfig,
      });
      const created = await createProfile(body);
      const profileId = created.id;
      dispatch({ type: 'set-profile-id', profileId });

      const cached = options?.forceRefresh
        ? null
        : ((await fetchPresetBacktestPreviews()).previews.find((p) => p.presetId === presetId) ??
          null);

      let interval: BacktestInterval;
      let ranked: readonly SmartPresetPick[];
      let robustness: SmartPresetRobustness;
      let fromCache: boolean;

      if (cached !== null) {
        interval = cached.candleInterval as BacktestInterval;
        ranked = cached.pickedSymbols;
        robustness = cached.robustness;
        fromCache = true;
      } else {
        setProgress({ phase: 'backtesting', completed: 0, total: intervals.length });
        const launched = await Promise.all(
          intervals.map(async (iv) => {
            const params = smartPresetBacktestParams(iv, baseConfig);
            const { runId } = await createBacktest(profileId, params);
            return { interval: iv, runId };
          }),
        );

        let completed = 0;
        const finished = await Promise.all(
          launched.map(async ({ interval: iv, runId }) => {
            const run = await awaitRun(profileId, runId, () => {
              // Best-effort tick; a run finishing early still only counts once
              // it actually returns, so this just keeps the bar honest meanwhile.
            });
            completed += 1;
            setProgress({ phase: 'backtesting', completed, total: intervals.length });
            return { interval: iv, run };
          }),
        );

        const best = pickBestRun(finished);
        if (best === null) {
          setProgress({ phase: 'error', message: t('wizard.smart.error.no_result') });
          return;
        }
        interval = best.interval;
        ranked = rankedPicksOf(best.run);
        robustness = robustnessOf(best.run);
        fromCache = false;

        if (ranked.length === 0) {
          setProgress({ phase: 'error', message: t('wizard.smart.error.no_result') });
          return;
        }
        await savePresetBacktestPreview(presetId, {
          candleInterval: interval,
          pickedSymbols: [...ranked],
          robustness,
          windowDays: SMART_PRESET_WINDOW_DAYS,
        });
        await queryClient.invalidateQueries({ queryKey: presetBacktestPreviewsQueryKey() });
      }

      setProgress({ phase: 'binding' });
      const picks = await bindTopPicks(profileId, ranked, bindMode.maxSymbols);
      if (picks.length === 0) {
        setProgress({ phase: 'error', message: t('wizard.smart.error.all_conflicted') });
        return;
      }
      await patchProfile(profileId, {
        config: { ...baseConfig, candleInterval: interval },
        enabled: true,
      });

      await queryClient.invalidateQueries({ queryKey: ['dashboard-aggregate', accountId] });
      setProgress({ phase: 'done', profileId, interval, picks, robustness, fromCache });
    } catch (cause) {
      const message =
        cause instanceof ApiError && cause.message ? cause.message : t('wizard.error.generic');
      setProgress({ phase: 'error', message });
    } finally {
      inFlight.current = false;
    }
  };

  const goToProfile = (): void => {
    if (progress.phase !== 'done') return;
    void router.navigate({
      to: '/accounts/$accountId/profiles/$profileId',
      params: { accountId, profileId: progress.profileId },
    });
  };

  return { progress, run, goToProfile };
}
