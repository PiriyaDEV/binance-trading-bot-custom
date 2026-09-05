// The "how am I doing" headline the operator opens the app to answer, in one
// legible block instead of three separate cards the reader has to hunt down
// and add up themselves (the KPI strip, the equity chart, the closed-trades
// card). Reuses each of their own data sources verbatim — no new P/L math is
// invented here, only the presentation is new — so the numbers can never
// disagree with what those cards already show.

import { useQuery } from '@tanstack/react-query';

import { closedTradesQueryOptions } from '@/features/dashboard/api/dashboard';
import { fetchEquitySnapshots } from '@/features/dashboard/api/equity-snapshots';
import { toSeries } from '@/features/dashboard/components/equity-pnl-card';
import type { QuotePnl } from '@/features/dashboard/lib/aggregate-pnl';
import { Card } from '@/shared/components/ui/card';
import { PnlPercent, PnlValue } from '@/shared/components/pnl-value';
import { useTimezone } from '@/shared/context/timezone-context';
import { t } from '@/shared/lib/i18n';

/**
 * Account-level "how am I doing" hero. `unrealised` is passed in rather than
 * fetched here: the caller (the overview panel) already holds the
 * dashboard-aggregate row this profile came from, and re-deriving it from a
 * second query risks a moment where the two disagree.
 */
export function PnlHeroCard({
  profileId,
  unrealised,
  quoteAsset,
}: {
  readonly profileId: string;
  readonly unrealised: readonly QuotePnl[];
  readonly quoteAsset: string;
}): React.JSX.Element {
  const timeZone = useTimezone();

  const today = useQuery(closedTradesQueryOptions(profileId, 'd', timeZone));
  const equity = useQuery({
    queryKey: ['equity-snapshots', profileId],
    queryFn: () => fetchEquitySnapshots(profileId),
    refetchInterval: 60_000,
  });
  const { latestNetPnl } = toSeries(equity.data?.points, equity.data?.benchmarkMode ?? 'btc');

  const isLoading = today.isLoading || equity.isPending;

  return (
    <Card className="gradient-hero" data-testid="pnl-hero-card">
      <section aria-labelledby="pnl-hero-h" className="space-y-4">
        <h2
          id="pnl-hero-h"
          className="text-[11px] font-semibold tracking-wider text-muted-fg uppercase"
        >
          {t('pnl_hero.total')}
        </h2>
        {isLoading ? (
          <div className="h-9 w-40 animate-pulse rounded bg-surface-alt" />
        ) : (
          <PnlValue
            value={latestNetPnl === null ? null : String(latestNetPnl)}
            unit={quoteAsset}
            className="text-3xl font-semibold tabular-nums"
            testId="pnl-hero-total"
          />
        )}
        <div className="grid grid-cols-2 gap-px border border-border bg-border">
          <div className="flex flex-col gap-1 bg-bg-elevated p-3">
            <span className="text-[11px] font-semibold tracking-wider text-muted-fg uppercase">
              {t('pnl_hero.today')}
            </span>
            {today.isLoading ? (
              <div className="h-6 w-24 animate-pulse rounded bg-surface-alt" />
            ) : today.data && today.data.tradeCount > 0 ? (
              <div className="flex items-baseline gap-2">
                <PnlValue
                  value={today.data.totalProfit}
                  unit={quoteAsset}
                  className="text-lg font-semibold tabular-nums"
                  testId="pnl-hero-today"
                />
                <PnlPercent value={today.data.totalProfitPercent} className="text-xs" />
              </div>
            ) : (
              <span className="font-mono text-lg text-muted-fg" data-testid="pnl-hero-today">
                —
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1 bg-bg-elevated p-3">
            <span className="text-[11px] font-semibold tracking-wider text-muted-fg uppercase">
              {t('pnl_hero.open')}
            </span>
            {unrealised.length === 0 ? (
              <PnlValue value={null} className="text-lg font-semibold" testId="pnl-hero-open" />
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-2" data-testid="pnl-hero-open">
                {unrealised.map((q) => (
                  <PnlValue
                    key={q.quote}
                    value={q.pnl}
                    unit={q.quote}
                    className="text-lg font-semibold tabular-nums"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-fg">{t('pnl_hero.footnote')}</p>
      </section>
    </Card>
  );
}
