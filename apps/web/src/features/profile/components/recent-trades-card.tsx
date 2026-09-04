// Recent-trades recap for the profile Overview — the five most recent closed
// trades, read-only (no delete, no basis toggle, no pagination). The full
// archive with all of that already lives on the History page; this answers
// "what did the bot just do" without leaving Overview for it.

import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { fetchProfileArchive } from '@/features/profile/api/archive';
import { rowPnl } from '@/features/profile/lib/archive-view-model';
import { Card } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { PnlValue, UnavailablePnl } from '@/shared/components/pnl-value';
import { LoadingRows } from '@/shared/components/page-skeleton';
import { useActiveAccountId } from '@/shared/lib/account-scope';
import { useTimezone } from '@/shared/context/timezone-context';
import { formatInstant } from '@/shared/lib/format-time';
import { exitIntentLabel } from '@/shared/lib/gloss-exit-intent';
import {
  unavailablePnlGlyph,
  unavailablePnlLabel,
} from '@/features/profile/lib/archive-view-model';
import { t } from '@/shared/lib/i18n';

const RECENT_COUNT = 5;

export function RecentTradesCard({ profileId }: { readonly profileId: string }): React.JSX.Element {
  const accountId = useActiveAccountId() ?? '';
  const timeZone = useTimezone();
  const query = useQuery({
    queryKey: ['trade-archive-recent', profileId],
    queryFn: () => fetchProfileArchive(profileId, 'a', null, timeZone),
  });

  const rows = (query.data?.items ?? []).slice(0, RECENT_COUNT);

  return (
    <Card data-testid="recent-trades-card">
      <section aria-labelledby="recent-trades-h" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="recent-trades-h"
            className="text-[11px] font-semibold tracking-wider text-muted-fg uppercase"
          >
            {t('recent_trades.title')}
          </h2>
          <Link
            to="/accounts/$accountId/profiles/$profileId/history"
            params={{ accountId, profileId }}
            search={{ section: 'archive' }}
            className="text-xs text-accent hover:underline"
            data-testid="recent-trades-view-all"
          >
            {t('recent_trades.view_all')}
          </Link>
        </div>

        {query.isLoading ? (
          <LoadingRows rows={3} />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-fg" data-testid="recent-trades-empty">
            {t('recent_trades.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table data-testid="recent-trades-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('recent_trades.col.symbol')}</TableHead>
                  <TableHead>{t('recent_trades.col.closed_because')}</TableHead>
                  <TableHead className="text-right">{t('recent_trades.col.pnl')}</TableHead>
                  <TableHead className="text-right">{t('recent_trades.col.when')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  // Fixed to the Net basis (post-fee) — the simplest honest
                  // "did this actually make money" read; the operator reaches
                  // for the History page's basis toggle when they want Recorded.
                  const pnl = rowPnl(row, 'net');
                  return (
                    <TableRow key={row.id} data-testid={`recent-trades-row-${row.id}`}>
                      <TableCell className="font-medium">{row.symbol}</TableCell>
                      <TableCell className="text-muted-fg">
                        {exitIntentLabel(row.exitIntent)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {pnl.available ? (
                          <PnlValue value={pnl.pnl} unit={row.quoteAsset} />
                        ) : (
                          <UnavailablePnl
                            glyph={unavailablePnlGlyph(pnl.reason)}
                            description={unavailablePnlLabel(pnl.reason)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs whitespace-nowrap text-muted-fg tabular-nums">
                        {formatInstant(row.archivedAt, timeZone)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </Card>
  );
}
