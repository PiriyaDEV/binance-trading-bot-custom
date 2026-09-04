import type { StrategyPreset } from '@/features/profile/wizard/presets';

/** Deep-merges only the nested keys a preset actually names, onto a strategy's own default config — never a hand-built object. */
export const mergeStrategyConfig = (
  defaultConfig: unknown,
  overrides: StrategyPreset['strategyConfig'],
): Record<string, unknown> => {
  const base = defaultConfig as { buy?: object; sell?: object };
  return {
    ...base,
    buy: { ...base.buy, ...overrides.buy },
    sell: { ...base.sell, ...overrides.sell },
  };
};
