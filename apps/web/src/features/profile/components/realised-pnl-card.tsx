// Realised-P/L card — closed-trades total for a profile with a D/W/M/All period
// selector backed by the closed-trades endpoint. Number math is display-only and
// safe here: apps/web is barred from decimal.js and none of these values feed an
// order.
//
// The period is controlled by the parent so one toggle can drive both this card
// and the sibling KPI cards.

import { useQuery } from '@tanstack/react-query';

import { closedTradesQueryOptions } from '@/features/dashboard/api/dashboard';
import { Card } from '@/shared/components/ui/card';
import { LoadingRows } from '@/shared/components/page-skeleton';
import { PnlPercent, PnlValue } from '@/shared/components/pnl-value';
import { Button } from '@/shared/components/ui/button';
import { useTimezone } from '@/shared/context/timezone-context';
import { formatDate } from '@/shared/lib/format-time';
import { t, type I18nKey } from '@/shared/lib/i18n';

import type { ClosedTradesPeriod } from '@app/contracts';

// `labelKey`, not resolved text: kept as a module-level constant like the
// rest of the file's static shape, resolved with `t()` at render time below.
const PERIODS: readonly { readonly code: ClosedTradesPeriod; readonly labelKey: I18nKey }[] = [
  { code: 'd', labelKey: 'realised_pnl.period.day' },
  { code: 'w', labelKey: 'realised_pnl.period.week' },
  { code: 'm', labelKey: 'realised_pnl.period.month' },
  { code: 'a', labelKey: 'realised_pnl.period.all' },
];

function periodLabel(
  period: ClosedTradesPeriod,
  from: string,
  to: string,
  timeZone: string,
): string {
  if (period === 'a') return t('realised_pnl.all_time');
  // Same zone the server used to cut the period, so the label can never name a
  // different day than the total it captions.
  const fromLabel = formatDate(from, timeZone);
  const toLabel = formatDate(to, timeZone);
  // The 'd' period always has from===to, and 'w'/'m' collapse to one date
  // when the period starts today (e.g. on the 1st of the month). A repeated
  // `2026-12-01 – 2026-12-01` reads as a display bug; collapse to one date.
  return fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`;
}

/**
 * Realised-P/L card with a D/W/M/All period selector backed by the closed-trades
 * endpoint. The selected period is controlled by the parent (the scoped-KPI
 * strip) so the same toggle re-filters the sibling KPI cards.
 */
export function RealisedPnlCard({
  profileId,
  period,
  onPeriodChange,
}: {
  readonly profileId: string;
  readonly period: ClosedTradesPeriod;
  readonly onPeriodChange: (period: ClosedTradesPeriod) => void;
}): React.JSX.Element {
  const timeZone = useTimezone();
  const query = useQuery(closedTradesQueryOptions(profileId, period, timeZone));
  const data = query.data;

  return (
    <Card className="gradient-hero">
      <section aria-labelledby="realised-pnl-heading" className="space-y-3">
        <h2 id="realised-pnl-heading" className="text-sm font-semibold text-fg">
          {t('realised_pnl.heading')}
        </h2>
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label={t('realised_pnl.period_group')}
        >
          {PERIODS.map((p) => (
            <Button
              key={p.code}
              type="button"
              variant={p.code === period ? 'default' : 'outline'}
              className="min-h-11 min-w-11 flex-1"
              aria-pressed={p.code === period}
              data-testid={`realised-period-${p.code}`}
              onClick={() => onPeriodChange(p.code)}
            >
              {t(p.labelKey)}
            </Button>
          ))}
        </div>
        {data ? (
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              {data.tradeCount === 0 ? (
                // Zero closed trades has no denominator — a "0 / 0.00%" readout
                // reads as "broke even on N trades" rather than "no trades".
                <span
                  className="text-3xl font-semibold text-muted-fg tabular-nums"
                  data-testid="realised-total-profit"
                >
                  —
                </span>
              ) : (
                <>
                  <PnlValue
                    value={data.totalProfit}
                    className="text-3xl font-semibold tabular-nums"
                    testId="realised-total-profit"
                  />
                  <PnlPercent value={data.totalProfitPercent} testId="realised-percent" />
                </>
              )}
            </div>
            <p className="text-sm text-muted-fg" data-testid="realised-trade-count">
              {data.tradeCount === 0
                ? t('realised_pnl.no_trades', {
                    period: periodLabel(period, data.from, data.to, timeZone),
                  })
                : t(
                    data.tradeCount === 1
                      ? 'realised_pnl.trade_count.one'
                      : 'realised_pnl.trade_count.other',
                    {
                      count: data.tradeCount,
                      period: periodLabel(period, data.from, data.to, timeZone),
                    },
                  )}
            </p>
          </div>
        ) : query.isLoading ? (
          // The headline figure and the trade-count line under it.
          <LoadingRows rows={2} />
        ) : (
          <p className="text-sm text-muted-fg">{t('realised_pnl.unavailable')}</p>
        )}
      </section>
    </Card>
  );
}
