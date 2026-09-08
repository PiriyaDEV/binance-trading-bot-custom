// Operator-facing Technicals compute-job health indicator. Used in two
// places: the dashboard header (zoomed-out: "is the compute job healthy
// right now?") and the symbol-detail Technicals panel (zoomed-in: "is
// this symbol's signal fresh?"). Both consume the same
// `/api/technicals/health` endpoint and the same three-tier classification,
// so the component lives here rather than being duplicated.
//
// `clock` is injected so tests can pin a deterministic age in the
// "technicals 12s ago" suffix. The tooltip carries the per-interval
// breakdown so an operator hovering can see exactly which intervals
// failed their last batch.

import { useQuery } from '@tanstack/react-query';
import type React from 'react';

import {
  fetchTechnicalsHealth,
  technicalsHealthQueryKey,
} from '@/features/technicals/api/technicals';
import { friendlyErrorLabel } from '@/features/technicals/lib/friendly-error-label';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { humaniseAge } from '@/shared/lib/format-time';
import { t } from '@/shared/lib/i18n';
import type { TechnicalsFetchStatus } from '@app/contracts';

/**
 * Poll cadence for the health endpoint. Set to half the worker
 * `technicals-compute` cron cadence (30s) so a recovered batch surfaces
 * in the dashboard pill within ~15s instead of up to a full cadence.
 */
const POLL_MS = 15_000;

function intervalDetail(i: TechnicalsFetchStatus, nowMs: number): string {
  const freshTail =
    i.lastFreshAtMs !== null && i.error !== null
      ? ` (last fresh ${humaniseAge(nowMs - i.lastFreshAtMs)} ago)`
      : '';
  if (i.error) return `${i.interval}: ${friendlyErrorLabel(i.error)}${freshTail}`;
  if (i.skippedErrored > 0) {
    return `${i.interval}: ${i.skippedErrored}/${i.requested} symbols failed (latency ${i.latencyMs}ms)`;
  }
  // Healthy row — expose the per-batch `latencyMs` so an operator can spot
  // a degrading compute path before it tips into a hard failure.
  return `${i.interval}: ${i.written}/${i.requested} fresh (latency ${i.latencyMs}ms)`;
}

export interface TechnicalsHealthPillProps {
  /** Wall-clock source for the "N seconds ago" suffix. Injected so tests can pin a fixed value. */
  readonly clock: () => number;
  /** Test-id; defaults to the dashboard variant. The symbol panel passes its own. */
  readonly testId?: string;
}

/**
 * Render the Technicals compute-job health as a single compact pill —
 * `● technicals 12s ago`. Polls `/api/technicals/health`. The three tone
 * tiers mirror the operator's mental triage order; the label changes per
 * tier so the headline conveys severity without requiring the colour cue:
 *
 *  - `text-danger` — every interval reports a hard `error`
 *    (red = total outage; label "technicals outage")
 *  - `text-warning` — at least one interval has an `error` or per-
 *    symbol `skippedErrored > 0` (amber = partial degradation;
 *    label "technicals degraded")
 *  - `text-success` — all fresh, no errors
 *    (green = healthy; label "technicals")
 */
export function TechnicalsHealthPill({
  clock,
  testId = 'tv-technicals-health',
}: TechnicalsHealthPillProps): React.JSX.Element | null {
  const q = useQuery({
    queryKey: technicalsHealthQueryKey(),
    queryFn: fetchTechnicalsHealth,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
  });
  if (q.isLoading) {
    // Inline chrome, not a page-height placeholder, so it stays out of a live
    // region: `role="status"` here would have a screen reader announce this
    // poll on every refetch, on top of whatever the surrounding surface is
    // already saying. The bar is `aria-hidden`, and `aria-label` on a plain
    // span is not exposed (ARIA prohibits naming `role="generic"`), so the
    // name has to be real text held off-screen.
    return (
      <span className="inline-block min-w-[85px] align-middle" data-testid={testId}>
        <span className="sr-only">{t('technicals.loading')}</span>
        <Skeleton className="h-3 w-full" />
      </span>
    );
  }
  if (q.error) {
    const errMsg = (q.error as Error).message;
    const reason = friendlyErrorLabel(errMsg);
    return (
      <span
        className="text-xs text-warning"
        title={t('technicals.unavailable_title', { errMsg })}
        aria-label={t('technicals.unavailable_aria', { reason })}
        data-testid={testId}
      >
        ● {t('technicals.unavailable_label', { reason })}
      </span>
    );
  }
  const intervals = q.data?.intervals ?? [];
  if (intervals.length === 0) {
    return (
      <span
        className="text-xs text-warning"
        title={t('technicals.silent_title')}
        aria-label={t('technicals.silent_aria')}
        data-testid={testId}
      >
        ● {t('technicals.silent_label')}
      </span>
    );
  }
  const allErrored = intervals.every((i) => i.error !== null);
  const anyDegraded = intervals.some((i) => i.error !== null || i.skippedErrored > 0);
  let tone: string;
  let label: string;
  // Single word for the aria-label so it doesn't read "Technicals technicals
  // outage" — the aria text already starts with "Technicals", duplicating it
  // in `label` was a screen-reader copy bug.
  let healthWord: string;
  if (allErrored) {
    tone = 'text-danger';
    label = t('technicals.outage');
    healthWord = t('technicals.word_outage');
  } else if (anyDegraded) {
    tone = 'text-warning';
    label = t('technicals.degraded');
    healthWord = t('technicals.word_degraded');
  } else {
    tone = 'text-success';
    label = t('technicals.healthy');
    healthWord = t('technicals.word_healthy');
  }
  const nowMs = clock();
  const newestMs = Math.max(...intervals.map((i) => i.fetchedAtMs));
  const ageS = Math.max(0, Math.floor((nowMs - newestMs) / 1_000));
  const ageLabel = ageS < 60 ? `${ageS}s` : `${Math.floor(ageS / 60)}m`;
  const detail = intervals.map((i) => intervalDetail(i, nowMs)).join('\n');

  // For degraded/outage tiers, also surface the worst (oldest) per-
  // interval `lastFreshAtMs` inline as "fresh Nm ago". Operator gets the
  // outage duration at a glance without expanding the tooltip. Healthy
  // (green) tier stays clean since every interval is by definition fresh
  // within the cron's window. When no interval has ever recorded a
  // `lastFreshAtMs` (cold-start failure — the compute has never produced
  // a successful row) the suffix flips to "never fresh".
  const isDegradedTier = allErrored || anyDegraded;
  const freshes = intervals.map((i) => i.lastFreshAtMs).filter((m): m is number => m !== null);
  const oldestFreshMs = freshes.length > 0 ? Math.min(...freshes) : null;
  // The core phrase without its leading separator, so the label (` · `) and
  // the aria sentence (`; `) can each punctuate it their own way without
  // duplicating the translated text.
  let freshCore = '';
  if (isDegradedTier) {
    if (oldestFreshMs !== null) {
      freshCore = t('technicals.fresh_ago', { age: humaniseAge(nowMs - oldestFreshMs) });
    } else if (allErrored) {
      freshCore = t('technicals.never_fresh');
    }
  }
  const freshSuffix = freshCore === '' ? '' : ` · ${freshCore}`;
  const ariaLabel = t('technicals.aria', {
    word: healthWord,
    ageLabel,
    freshSuffix: freshCore === '' ? '' : `; ${freshCore}`,
  });

  return (
    <span
      className={`text-xs ${tone}`}
      title={detail}
      // `aria-live="polite"` so screen-reader users hear the headline when
      // the compute job transitions tiers (e.g. outage → healthy) without
      // re-focusing the element. Polite avoids interrupting the user
      // mid-sentence; the pill is informational, not urgent input.
      aria-live="polite"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      ● {label} {t('technicals.age_suffix', { ageLabel })}
      {freshSuffix}
    </span>
  );
}
