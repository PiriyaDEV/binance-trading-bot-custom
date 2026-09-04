// Ready-made strategy presets for the wizard's "quick start" path: pick one,
// and the wizard creates the profile, turns on auto-discovery (so the bot
// picks its own coins — see docs/concepts/discovery.md) with a preset-sized
// symbol cap, and enables the profile. No manual per-field setup, no manual
// symbol binding.
//
// All three presets ride `trailing-trade` — the flagship, most-tested
// strategy — and only vary knobs that are directly documented on the
// strategy's own schema (see packages/strategy/trailing-trade/src/schema.ts
// around `defaultTTConfig` and the `sell.*` field comments): a bigger
// `entrySizing.amount` risks more per trade, a wider `stopLossPercentage` /
// `trailingStopPercentage` gives a trade more room before it is cut, and
// `discovery.maxAutoSymbols` caps how many coins run at once. Deliberately
// NOT varying `discovery.enterOnAdd` — the schema's own description says to
// "leave off until a net-of-cost backtest justifies it", and a preset a
// first-time operator picks sight-unseen should not silently pick the
// riskier entry mode for them.

import type { I18nKey } from '@/shared/lib/i18n';

export interface StrategyPreset {
  readonly id: 'conservative' | 'balanced' | 'aggressive';
  readonly nameKey: I18nKey;
  readonly descriptionKey: I18nKey;
  readonly recommended: boolean;
  /** Deep-merged onto the trailing-trade strategy's own `defaultConfig` (never hand-built from scratch). */
  readonly strategyConfig: {
    readonly buy: { readonly entrySizing: { readonly mode: 'fixed'; readonly amount: string } };
    readonly sell: {
      readonly stopLossPercentage: string;
      readonly triggerPercentage: string;
      readonly trailingStopPercentage: string;
    };
  };
  /** Deep-merged onto the fully-defaulted discovery config the API returns for a fresh profile. */
  readonly discoveryConfig: { readonly maxAutoSymbols: number };
}

export const STRATEGY_PRESETS: readonly StrategyPreset[] = [
  {
    id: 'conservative',
    nameKey: 'wizard.preset.conservative.name',
    descriptionKey: 'wizard.preset.conservative.description',
    recommended: false,
    strategyConfig: {
      buy: { entrySizing: { mode: 'fixed', amount: '10' } },
      sell: {
        stopLossPercentage: '0.98', // cut a loss at 2% below entry
        triggerPercentage: '1.03', // start protecting profit once 3% up
        trailingStopPercentage: '0.99', // lock it in after a 1% pullback from the high
      },
    },
    discoveryConfig: { maxAutoSymbols: 2 },
  },
  {
    id: 'balanced',
    nameKey: 'wizard.preset.balanced.name',
    descriptionKey: 'wizard.preset.balanced.description',
    recommended: true,
    // The strategy's own shipped defaults (defaultTTConfig) — the codebase's
    // own comments call this "the balanced posture ratified for discovery",
    // and the trailing-trade defaults it pairs with are the same seed the
    // manual wizard path has always created profiles with.
    strategyConfig: {
      buy: { entrySizing: { mode: 'fixed', amount: '15' } },
      sell: {
        stopLossPercentage: '0.97', // 3% below entry
        triggerPercentage: '1.05', // arm at 5% up
        trailingStopPercentage: '0.98', // 2% pullback from the high
      },
    },
    discoveryConfig: { maxAutoSymbols: 5 },
  },
  {
    id: 'aggressive',
    nameKey: 'wizard.preset.aggressive.name',
    descriptionKey: 'wizard.preset.aggressive.description',
    recommended: false,
    strategyConfig: {
      buy: { entrySizing: { mode: 'fixed', amount: '25' } },
      sell: {
        stopLossPercentage: '0.95', // more room: cut at 5% below entry
        triggerPercentage: '1.08', // let a winner run to 8% before arming
        trailingStopPercentage: '0.95', // 5% pullback allowed before selling
      },
    },
    discoveryConfig: { maxAutoSymbols: 8 },
  },
];

/** The preset the wizard pre-selects — the balanced/recommended one. */
export const DEFAULT_PRESET_ID: StrategyPreset['id'] = 'balanced';
