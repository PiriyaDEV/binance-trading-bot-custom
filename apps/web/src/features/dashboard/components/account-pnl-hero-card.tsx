// The Home page's own "how am I doing" headline — same idea as
// PnlHeroCard, but summed across every profile in the account instead of
// scoped to one. Reuses each profile's own equity-snapshot (all-time net
// P/L) and today's closed-trades total, the exact sources the per-profile
// hero and cards already show, so this can never disagree with them; it only
// adds the sum. Grouped by quote asset AND by live/practice — same honesty
// rule as the existing unrealised-P/L band: a testnet number is never folded
// into a real-money total.

import { useQueries, useQuery } from '@tanstack/react-query';

import { closedTradesQueryOptions } from '@/features/dashboard/api/dashboard';
import { fetchEquitySnapshots } from '@/features/dashboard/api/equity-snapshots';
import { fetchFxRateUsdThb, fxRateQueryKey } from '@/features/dashboard/api/fx-rate';
import { toSeries } from '@/features/dashboard/components/equity-pnl-card';
import { Card } from '@/shared/components/ui/card';
import { PnlValue } from '@/shared/components/pnl-value';
import { useTimezone } from '@/shared/context/timezone-context';
import { t } from '@/shared/lib/i18n';

import type { DashboardAggregateRow } from '@app/contracts';

interface QuoteSum {
  readonly quote: string;
  readonly total: number;
}

/** Sums a per-profile number into per-quote-asset buckets, dropping profiles with no usable figure yet. */
const sumByQuote = (
  rows: readonly DashboardAggregateRow[],
  valueOf: (profileId: string) => number | null,
): QuoteSum[] => {
  const byQuote = new Map<string, number>();
  for (const row of rows) {
    const v = valueOf(row.profileId);
    if (v === null) continue;
    byQuote.set(row.quoteAsset, (byQuote.get(row.quoteAsset) ?? 0) + v);
  }
  return [...byQuote.entries()]
    .map(([quote, total]) => ({ quote, total }))
    .sort((a, b) => a.quote.localeCompare(b.quote));
};

/** Quote assets treated as 1:1 with USD for the THB estimate — the same peg-as-parity approximation every retail crypto app makes here. */
const USD_PEGGED_QUOTES = new Set(['USDT', 'USD', 'USDC', 'BUSD']);

/** `1,234.56` style THB amount, sign-prefixed to match the USDT figure beside it. No currency word — the caller supplies "บาท"/"THB" so this stays locale-agnostic. */
const formatThb = (usdAmount: number, rate: number): string => {
  const thb = usdAmount * rate;
  const sign = thb > 0 ? '+' : thb < 0 ? '-' : '';
  return `${sign}${Math.abs(thb).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

function QuoteSumList({
  items,
  thbRate,
}: {
  items: readonly QuoteSum[];
  /** USD→THB rate, or null while unavailable — omits the THB estimate entirely rather than guessing. */
  thbRate: number | null;
}) {
  if (items.length === 0) return <PnlValue value={null} />;
  return (
    <>
      {items.map((q, i) => (
        <span key={q.quote}>
          {i > 0 ? <span className="text-base text-muted-fg"> · </span> : null}
          <PnlValue value={String(q.total)} unit={q.quote} />
          {thbRate !== null && USD_PEGGED_QUOTES.has(q.quote) ? (
            <span className="ml-1 font-mono text-xs text-muted-fg">
              ({formatThb(q.total, thbRate)} {t('pnl_hero.thb_unit')})
            </span>
          ) : null}
        </span>
      ))}
    </>
  );
}

/** One live/practice group: fans the two per-profile queries out across `rows` and renders its own hero block. */
function ModeGroup({
  rows,
  label,
  testId,
  thbRate,
}: {
  readonly rows: readonly DashboardAggregateRow[];
  readonly label: string;
  readonly testId: string;
  readonly thbRate: number | null;
}) {
  const timeZone = useTimezone();
  const equity = useQueries({
    queries: rows.map((r) => ({
      queryKey: ['equity-snapshots', r.profileId],
      queryFn: () => fetchEquitySnapshots(r.profileId),
      refetchInterval: 60_000,
    })),
  });
  const today = useQueries({
    queries: rows.map((r) => closedTradesQueryOptions(r.profileId, 'd', timeZone)),
  });

  if (rows.length === 0) return null;
  const isLoading = equity.some((q) => q.isPending) || today.some((q) => q.isLoading);

  const totalByProfile = new Map<string, number | null>(
    rows.map((r, i) => {
      const q = equity[i];
      if (!q || q.isPending) return [r.profileId, null];
      const { latestNetPnl } = toSeries(q.data?.points, q.data?.benchmarkMode ?? 'btc');
      return [r.profileId, latestNetPnl];
    }),
  );
  const todayByProfile = new Map<string, number | null>(
    rows.map((r, i) => {
      const q = today[i];
      if (!q?.data || q.data.tradeCount === 0) return [r.profileId, null];
      return [r.profileId, Number(q.data.totalProfit)];
    }),
  );

  const totalSums = sumByQuote(rows, (id) => totalByProfile.get(id) ?? null);
  const todaySums = sumByQuote(rows, (id) => todayByProfile.get(id) ?? null);
  const unrealisedSums = sumByQuote(rows, (id) => {
    const row = rows.find((r) => r.profileId === id);
    if (!row) return null;
    let sum = 0;
    let any = false;
    for (const p of row.positions) {
      if (p.currentPrice === null || p.quantity === null) continue;
      sum += (Number(p.currentPrice) - Number(p.avgEntryPrice)) * Number(p.quantity);
      any = true;
    }
    return any ? sum : null;
  });

  return (
    <div className="space-y-2" data-testid={testId}>
      <span className="text-xs font-medium text-muted-fg">{label}</span>
      {isLoading ? (
        <div className="h-9 w-40 animate-pulse rounded bg-surface-alt" />
      ) : (
        <div
          className="font-mono text-2xl font-semibold tabular-nums"
          data-testid={`${testId}-total`}
        >
          <QuoteSumList items={totalSums} thbRate={thbRate} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-px border border-border bg-border">
        <div className="flex flex-col gap-1 bg-bg-elevated p-3">
          <span className="text-[11px] font-semibold tracking-wider text-muted-fg uppercase">
            {t('pnl_hero.today')}
          </span>
          <div
            className="font-mono text-base font-semibold tabular-nums"
            data-testid={`${testId}-today`}
          >
            <QuoteSumList items={todaySums} thbRate={thbRate} />
          </div>
        </div>
        <div className="flex flex-col gap-1 bg-bg-elevated p-3">
          <span className="text-[11px] font-semibold tracking-wider text-muted-fg uppercase">
            {t('pnl_hero.open')}
          </span>
          <div
            className="font-mono text-base font-semibold tabular-nums"
            data-testid={`${testId}-open`}
          >
            <QuoteSumList items={unrealisedSums} thbRate={thbRate} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Account-level "how am I doing" hero, shown on the unfocused Home page above the market tape. */
export function AccountPnlHeroCard({
  rows,
}: {
  readonly rows: readonly DashboardAggregateRow[];
}): React.JSX.Element | null {
  const liveRows = rows.filter((r) => r.binanceMode === 'live');
  const testRows = rows.filter((r) => r.binanceMode === 'test');
  // Long staleTime: a fiat rate barely moves intraday, and the api's own
  // cache (`FX_RATE_TTL_S`, 6h) is the thing actually keeping it fresh — this
  // just avoids re-fetching the api on every Home mount.
  const fx = useQuery({
    queryKey: fxRateQueryKey(),
    queryFn: fetchFxRateUsdThb,
    staleTime: 30 * 60 * 1000,
  });
  const thbRate = fx.data?.rate ?? null;
  if (rows.length === 0) return null;

  return (
    <Card className="gradient-hero" data-testid="account-pnl-hero-card">
      <section aria-labelledby="account-pnl-hero-h" className="space-y-4">
        <h2
          id="account-pnl-hero-h"
          className="text-[11px] font-semibold tracking-wider text-muted-fg uppercase"
        >
          {t('pnl_hero.total')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ModeGroup
            rows={liveRows}
            label={t('home.summary.live')}
            testId="account-pnl-hero-live"
            thbRate={thbRate}
          />
          <ModeGroup
            rows={testRows}
            label={t('home.summary.practice')}
            testId="account-pnl-hero-test"
            thbRate={thbRate}
          />
        </div>
        <p className="text-xs text-muted-fg">{t('pnl_hero.footnote')}</p>
      </section>
    </Card>
  );
}
