import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { NavBar } from '@/features/profile/wizard/steps/NavBar';
import type { StepProps } from '@/features/profile/wizard/reducer';
import {
  DEFAULT_PRESET_ID,
  STRATEGY_PRESETS,
  type StrategyPreset,
} from '@/features/profile/wizard/presets';
import { mergeStrategyConfig } from '@/features/profile/wizard/use-preset-submit';
import {
  useSmartPresetSubmit,
  type SmartPresetProgress,
} from '@/features/profile/wizard/use-smart-preset-submit';
import {
  PRESET_TIER_INTERVALS,
  SMART_PRESET_INTERVALS,
  SMART_PRESET_MAX_SYMBOLS,
} from '@/features/profile/wizard/smart-preset';
import {
  fetchPresetBacktestPreviews,
  presetBacktestPreviewsQueryKey,
} from '@/features/profile/wizard/api/preset-backtest-previews';
import { formatLastTick } from '@/shared/lib/format-tick';
import { Panel } from '@/shared/components/panel';
import { LoadingRows } from '@/shared/components/page-skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { PnlValue } from '@/shared/components/pnl-value';
import { t } from '@/shared/lib/i18n';

import type { PresetBacktestPreview, StrategyDescriptor } from '@app/contracts';

/**
 * Step 2 (final): pick the strategy plugin that drives the profile. Confirming
 * creates the profile with the strategy's default config; the operator tunes it
 * afterward on the profile's config page.
 */
export function Step2Strategy({
  state,
  dispatch,
  strategies,
  loading,
  error,
  onSubmit,
}: StepProps & {
  strategies: readonly StrategyDescriptor[];
  loading: boolean;
  error: unknown;
  onSubmit: (
    config: unknown,
    strategy?: NonNullable<StepProps['state']['strategy']>,
  ) => Promise<void>;
}): ReactNode {
  const [pickError, setPickError] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<StrategyPreset['id'] | 'smart'>(
    DEFAULT_PRESET_ID,
  );
  // Whether picking a preset also enables it for live trading right away, vs.
  // creating it paused for the operator to review first. `null` means the
  // operator has not touched the checkbox: the EFFECTIVE value then derives
  // from the selected preset's cached backtest preview each render ("clears
  // the gate" -> on, "misses" or unknown -> off), so switching presets keeps
  // tracking the new preset's own verdict. The moment the operator touches
  // the checkbox their choice is stored here and sticks across preset
  // switches instead of being silently overridden — computed during render
  // rather than synced via an effect, so there is no cascading re-render.
  const [enableOverride, setEnableOverride] = useState<boolean | null>(null);
  // Manual strategy picker starts collapsed: presets are the primary path,
  // full per-field configuration is the escape hatch for an operator who
  // already knows they want a different strategy or their own tuning.
  const [showManual, setShowManual] = useState(false);
  const onlyStrategy = strategies.length === 1 ? strategies[0] : undefined;
  const selectedStrategy = state.strategy ?? onlyStrategy;
  const trailingTrade = strategies.find((s) => s.name === 'trailing-trade');
  const smart = useSmartPresetSubmit(state, dispatch);
  // Server-shared preview cache (one row per preset — see the api route's own
  // doc comment): fetched once here and looked up per card below, rather than
  // once per card, so picking a preset does not fire four separate requests.
  const previews = useQuery({
    queryKey: presetBacktestPreviewsQueryKey(),
    queryFn: fetchPresetBacktestPreviews,
  });
  const previewFor = (presetId: string) =>
    previews.data?.previews.find((p) => p.presetId === presetId) ?? null;
  // Effective value: the operator's own choice once they have made one,
  // otherwise the selected preset's own cached verdict (see the state doc
  // comment above) — derived here during render, not synced via an effect.
  const enableImmediately =
    enableOverride ?? previewFor(selectedPresetId)?.robustness.clearsGate ?? true;

  const onSubmitPreset = (): void => {
    if (!trailingTrade) return;
    if (selectedPresetId === 'smart') {
      const balanced = STRATEGY_PRESETS.find((p) => p.id === 'balanced');
      if (!balanced) return;
      void smart.run(
        'smart',
        trailingTrade,
        mergeStrategyConfig(trailingTrade.defaultConfig, balanced.strategyConfig),
        SMART_PRESET_INTERVALS,
        { maxSymbols: SMART_PRESET_MAX_SYMBOLS },
        { enableAfterBind: enableImmediately },
      );
      return;
    }
    const preset = STRATEGY_PRESETS.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    // Every risk tier now backtests (single fixed interval, no sweep) and
    // binds its own top-ranked coins immediately — the same mechanism Smart
    // uses, just with the tier's own risk config and symbol cap — so picking
    // a tier starts the bot trading right away instead of waiting on the
    // next Discovery scan cycle (when `enableImmediately` is on; otherwise it
    // is bound but left paused for review, same as Smart).
    void smart.run(
      preset.id,
      trailingTrade,
      mergeStrategyConfig(trailingTrade.defaultConfig, preset.strategyConfig),
      PRESET_TIER_INTERVALS,
      { maxSymbols: preset.discoveryConfig.maxAutoSymbols },
      { enableAfterBind: enableImmediately },
    );
  };

  const onSelect = (descriptor: StrategyDescriptor): void => {
    dispatch({
      type: 'set-strategy',
      strategy: {
        name: descriptor.name,
        version: descriptor.version,
        displayName: descriptor.displayName,
        defaultConfig: descriptor.defaultConfig,
        configSchema: descriptor.configSchema,
      },
    });
    setPickError(null);
  };

  const onNext = (): void => {
    if (!selectedStrategy) {
      setPickError(t('wizard.step2.error.required'));
      return;
    }
    // Create with the strategy's shipped defaults; the operator edits them on
    // the profile's config page. Pass the config explicitly — submit reads its
    // argument, not wizard state.
    void onSubmit(selectedStrategy.defaultConfig, selectedStrategy);
  };

  if (loading) {
    // The step is the whole page body here, so its placeholder has to carry the
    // panel chrome and the strategy cards the operator is about to choose from.
    return (
      // Its own id, not the loaded step's: `wizard-step-2` is what the wizard
      // tests wait on to mean "step 2 is interactive", and the placeholder
      // renders none of the controls that follows.
      <div className="space-y-5" data-testid="wizard-step-2-loading">
        <Panel title={t('wizard.step2.title')} description={t('wizard.step2.subtitle')}>
          <LoadingRows rows={3} />
        </Panel>
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="danger">
        <AlertTitle>{t('error.title')}</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : t('error.unknown')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5" data-testid="wizard-step-2">
      {trailingTrade && !showManual ? (
        <Panel title={t('wizard.preset.title')} description={t('wizard.preset.subtitle')}>
          {smart.progress.phase !== 'idle' ? (
            <SmartPresetProgressView progress={smart.progress} onViewProfile={smart.goToProfile} />
          ) : (
            <div className="space-y-4">
              <ul
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                data-testid="wizard-preset-list"
              >
                {STRATEGY_PRESETS.map((p) => {
                  const picked = p.id === selectedPresetId;
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex h-full cursor-pointer flex-col gap-1 rounded-xs border p-3 ${
                          picked ? 'border-accent bg-accent/5' : 'border-border'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="preset"
                            checked={picked}
                            onChange={() => setSelectedPresetId(p.id)}
                            data-testid={`wizard-preset-${p.id}`}
                          />
                          <span className="text-sm font-medium">{t(p.nameKey)}</span>
                          {p.recommended ? (
                            <Badge variant="secondary">{t('wizard.preset.recommended')}</Badge>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-fg">{t(p.descriptionKey)}</span>
                        <PresetPreviewBadge preview={previewFor(p.id)} />
                      </label>
                    </li>
                  );
                })}
                <li>
                  <label
                    className={`flex h-full cursor-pointer flex-col gap-1 rounded-xs border p-3 ${
                      selectedPresetId === 'smart' ? 'border-accent bg-accent/5' : 'border-border'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="preset"
                        checked={selectedPresetId === 'smart'}
                        onChange={() => setSelectedPresetId('smart')}
                        data-testid="wizard-preset-smart"
                      />
                      <span className="text-sm font-medium">{t('wizard.preset.smart.name')}</span>
                      <Badge variant="outline">{t('wizard.preset.smart.badge')}</Badge>
                    </span>
                    <span className="text-xs text-muted-fg">
                      {t('wizard.preset.smart.description')}
                    </span>
                    <PresetPreviewBadge preview={previewFor('smart')} />
                  </label>
                </li>
              </ul>
              {state.error ? (
                <p role="alert" className="text-xs text-danger">
                  {state.error}
                </p>
              ) : null}
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={enableImmediately}
                  onChange={(e) => setEnableOverride(e.target.checked)}
                  data-testid="wizard-preset-enable-toggle"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{t('wizard.preset.enable_toggle.label')}</span>
                  <span className="text-xs text-muted-fg">
                    {t(
                      enableImmediately
                        ? 'wizard.preset.enable_toggle.help_on'
                        : 'wizard.preset.enable_toggle.help_off',
                    )}
                  </span>
                </span>
              </label>
              <NavBar
                onBack={() => dispatch({ type: 'goto', step: 1 })}
                onNext={onSubmitPreset}
                nextLabel={
                  state.creating ? t('wizard.nav.submitting') : t('wizard.preset.smart.submit')
                }
                nextDisabled={state.creating}
                nextVariant="primary"
                backDisabled={state.creating}
              />
              <p>
                <button
                  type="button"
                  className="text-xs text-muted-fg underline"
                  onClick={() => setShowManual(true)}
                  data-testid="wizard-show-manual"
                >
                  {t('wizard.preset.manual_link')}
                </button>
              </p>
            </div>
          )}
        </Panel>
      ) : null}

      {showManual || !trailingTrade ? (
        <>
          <Panel title={t('wizard.step2.title')} description={t('wizard.step2.subtitle')}>
            <div className="space-y-4">
              {strategies.length === 0 ? (
                <Alert>
                  <AlertDescription>{t('wizard.step2.empty')}</AlertDescription>
                </Alert>
              ) : (
                <ul
                  aria-invalid={!!pickError}
                  className={`space-y-2 ${pickError ? 'rounded-xs border border-danger p-2' : ''}`}
                  data-testid="wizard-strategy-list"
                >
                  {strategies.map((s) => {
                    const picked =
                      selectedStrategy?.name === s.name && selectedStrategy.version === s.version;
                    return (
                      <li key={`${s.name}@${s.version}`}>
                        <label
                          className={`flex cursor-pointer items-start gap-3 rounded-xs border p-3 ${
                            picked ? 'border-accent bg-accent/5' : 'border-border'
                          }`}
                        >
                          <input
                            type="radio"
                            name="strategy"
                            checked={picked}
                            onChange={() => onSelect(s)}
                            className="mt-0.5"
                            data-testid={`wizard-strategy-${s.name}`}
                          />
                          <span className="flex flex-1 flex-col gap-1">
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-medium">{s.displayName}</span>
                              <Badge variant="secondary">
                                {t('wizard.step2.version', { version: s.version })}
                              </Badge>
                            </span>
                            <span className="text-xs text-muted-fg">{s.description}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {pickError ? (
                <p role="alert" className="text-xs text-danger">
                  {pickError}
                </p>
              ) : null}
            </div>
          </Panel>

          <NavBar
            onBack={() => dispatch({ type: 'goto', step: 1 })}
            onNext={onNext}
            nextLabel={state.creating ? t('wizard.nav.submitting') : t('wizard.nav.submit')}
            nextDisabled={state.creating}
            nextVariant="primary"
            backDisabled={state.creating}
          />
        </>
      ) : null}
    </div>
  );
}

/**
 * A preset card's server-shared preview summary — "checked N ago, profit
 * factor X, clears/misses the gate" — one shared row per preset, the same
 * for every operator (see `apps/api/src/routes/preset-backtest-previews.ts`).
 * `preview` is looked up once by the caller from a single fetch covering all
 * four cards. Renders nothing when this preset has never been run anywhere,
 * so a cold install sees plain cards; the first successful run fills every
 * later visit's badge in, on any browser.
 */
function PresetPreviewBadge({
  preview,
}: {
  readonly preview: PresetBacktestPreview | null;
}): ReactNode {
  if (preview === null) return null;
  const pf = preview.robustness.outOfSample?.profitFactor;
  return (
    <span
      className={`text-[11px] ${preview.robustness.clearsGate ? 'text-success' : 'text-warning'}`}
      data-testid={`wizard-preset-preview-${preview.presetId}`}
    >
      {t(
        preview.robustness.clearsGate
          ? 'wizard.preset.preview.clears'
          : 'wizard.preset.preview.misses',
        {
          ago: formatLastTick(preview.ranAt),
          totalReturn: preview.robustness.totalReturnPct.toFixed(1),
          pf: pf?.toFixed(2) ?? '—',
        },
      )}
    </span>
  );
}

/**
 * The "smart" preset's own progress panel, swapped in for the picker while
 * `useSmartPresetSubmit` walks through creating the profile, running the
 * candidate backtests, and binding the winners. Unlike the other presets this
 * can take real time (two full backtest runs), so it gets a phase-by-phase
 * status instead of a single spinner.
 */
function SmartPresetProgressView({
  progress,
  onViewProfile,
}: {
  progress: SmartPresetProgress;
  onViewProfile: () => void;
}): ReactNode {
  if (progress.phase === 'idle') return null;

  if (progress.phase === 'error') {
    return (
      <Alert variant="danger" data-testid="wizard-smart-error">
        <AlertTitle>{t('error.title')}</AlertTitle>
        <AlertDescription>{progress.message}</AlertDescription>
      </Alert>
    );
  }

  if (progress.phase === 'done') {
    return (
      <div className="space-y-4" data-testid="wizard-smart-done">
        <p className="text-sm text-fg">
          {t('wizard.preset.smart.done', {
            interval: progress.interval,
            count: progress.picks.length,
          })}
          {progress.fromCache ? (
            <span className="ml-1 text-xs text-muted-fg" data-testid="wizard-smart-from-cache">
              {t('wizard.preset.smart.from_cache')}
            </span>
          ) : null}
        </p>
        <div
          className={`border p-3 text-sm ${
            progress.robustness.clearsGate
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-warning/40 bg-warning/10 text-warning'
          }`}
          data-testid="wizard-smart-robustness"
        >
          <p className="font-medium">
            {t(
              progress.robustness.clearsGate
                ? 'wizard.preset.smart.robustness.clears'
                : 'wizard.preset.smart.robustness.misses',
            )}
          </p>
          <p className="mt-1 text-xs text-muted-fg">
            {t('wizard.preset.smart.robustness.detail', {
              totalReturn: progress.robustness.totalReturnPct.toFixed(1),
              inPf: progress.robustness.inSample.profitFactor?.toFixed(2) ?? '—',
              inAlpha: progress.robustness.inSample.alphaVsHoldPct.toFixed(1),
              oosPf: progress.robustness.outOfSample?.profitFactor?.toFixed(2) ?? '—',
              oosAlpha: progress.robustness.outOfSample?.alphaVsHoldPct.toFixed(1) ?? '—',
            })}
          </p>
        </div>
        <p
          className={`text-sm ${progress.enabled ? 'text-success' : 'text-muted-fg'}`}
          data-testid="wizard-smart-enabled-status"
        >
          {t(
            progress.enabled
              ? 'wizard.preset.smart.done.enabled'
              : 'wizard.preset.smart.done.disabled',
          )}
        </p>
        {progress.picks.length > 0 ? (
          <ul
            className="divide-y divide-border border border-border"
            data-testid="wizard-smart-picks"
          >
            {progress.picks.map((p) => (
              <li key={p.symbol} className="flex items-center justify-between gap-2 p-2 text-sm">
                <span className="font-medium">{p.symbol}</span>
                <span className="text-xs text-muted-fg">
                  {t('wizard.preset.smart.trades', { count: p.tradeCount })}
                </span>
                <PnlValue value={p.pnlQuote} testId={`wizard-smart-pick-${p.symbol}`} />
              </li>
            ))}
          </ul>
        ) : null}
        <Button
          type="button"
          variant="primary"
          onClick={onViewProfile}
          data-testid="wizard-smart-view"
        >
          {t('wizard.preset.smart.view')}
        </Button>
      </div>
    );
  }

  const label =
    progress.phase === 'creating-profile'
      ? t('wizard.preset.smart.phase.creating')
      : progress.phase === 'backtesting'
        ? t('wizard.preset.smart.phase.backtesting', {
            completed: progress.completed,
            total: progress.total,
          })
        : t('wizard.preset.smart.phase.binding');

  return (
    <div className="space-y-3" data-testid="wizard-smart-progress">
      <div className="flex items-center gap-2">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"
          aria-hidden
        />
        <span className="text-sm text-fg">{label}</span>
      </div>
      <p className="text-xs text-muted-fg">{t('wizard.preset.smart.wait_note')}</p>
    </div>
  );
}
