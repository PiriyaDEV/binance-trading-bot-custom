// /accounts/new — create a Binance account: a name plus the environment its API
// key pair talks to (testnet vs live). The environment is fixed at create
// because a key pair cannot switch environments. On success the operator lands
// on the new account's dashboard; the API key itself is added afterwards on the
// account's api-key page.

import { AccountCreate } from '@app/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRoute, Link, useRouter } from '@tanstack/react-router';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Page, PageHeader } from '@/shared/components/page';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { accountsQueryKey, createAccount } from '@/features/account/api/accounts';
import { setActiveAccountId } from '@/shared/lib/account-scope';
import { errorMessage } from '@/shared/lib/api';
import { rootRoute } from '@/app/__root';
import { t } from '@/shared/lib/i18n';

function AccountNewPage(): ReactNode {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'test' | 'live'>('test');
  const [marketType, setMarketType] = useState<'spot' | 'futures'>('spot');
  const [nameError, setNameError] = useState<string | null>(null);

  // Futures is testnet-only in this app (same standing rule as everything
  // else — no real money). Switching to Futures forces the environment back
  // to Testnet rather than just disabling submit, so the two controls never
  // sit in a combination the server would reject.
  const onMarketTypeChange = (next: 'spot' | 'futures'): void => {
    setMarketType(next);
    if (next === 'futures') setMode('test');
  };

  const create = useMutation({
    mutationFn: () => createAccount({ name: name.trim(), binanceMode: mode, marketType }),
    onSuccess: async (account) => {
      await queryClient.invalidateQueries({ queryKey: accountsQueryKey });
      setActiveAccountId(account.id);
      await router.navigate({
        to: '/accounts/$accountId',
        params: { accountId: account.id },
      });
    },
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const parsed = AccountCreate.safeParse({
      name: name.trim(),
      binanceMode: mode,
      marketType,
    });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    setNameError(null);
    create.mutate();
  };

  return (
    <Page>
      <PageHeader title="New account" />
      <form className="space-y-5" onSubmit={onSubmit} data-testid="account-new-form">
        <Panel title="Account">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="account-name">Name</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main, Alt, Testnet"
                aria-invalid={nameError !== null}
                autoFocus
              />
              {nameError ? (
                <p role="alert" className="text-xs text-danger">
                  {nameError}
                </p>
              ) : null}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">Market</legend>
              <MarketTypeOption
                value="spot"
                checked={marketType === 'spot'}
                onChange={onMarketTypeChange}
                label="Spot"
                help="Buy and hold coins. No leverage, no shorting."
              />
              <MarketTypeOption
                value="futures"
                checked={marketType === 'futures'}
                onChange={onMarketTypeChange}
                label="Futures"
                help="Long or short with fixed 1x-3x leverage. Testnet only — needs a separate Futures Testnet API key from testnet.binancefuture.com."
              />
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">Environment</legend>
              <ModeOption
                value="test"
                checked={mode === 'test'}
                onChange={setMode}
                label="Testnet"
                help="Practice funds on the Binance testnet. No real money."
              />
              <ModeOption
                value="live"
                checked={mode === 'live'}
                onChange={setMode}
                label="Live"
                help={
                  marketType === 'futures'
                    ? 'Not available for Futures accounts — testnet only.'
                    : 'Real funds on the live Binance exchange.'
                }
                disabled={marketType === 'futures'}
              />
            </fieldset>

            {create.isError ? (
              <p role="alert" className="text-xs text-danger" data-testid="account-new-error">
                {errorMessage(create.error)}
              </p>
            ) : null}
          </div>
        </Panel>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create account'}
          </Button>
          {/* This route hangs directly off the root, so it has only one nameable rung and renders no breadcrumb. Without an explicit cancel the form would have no in-page way out at all. */}
          <Link
            to="/"
            className="rounded px-2 py-2.5 text-sm text-muted-fg hover:text-fg focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          >
            {t('common.cancel')}
          </Link>
        </div>
      </form>
    </Page>
  );
}

function ModeOption({
  value,
  checked,
  onChange,
  label,
  help,
  disabled,
}: {
  value: 'test' | 'live';
  checked: boolean;
  onChange: (next: 'test' | 'live') => void;
  label: string;
  help: string;
  disabled?: boolean;
}): ReactNode {
  return (
    <label
      className={`flex items-start gap-3 rounded-xs border border-border p-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <input
        type="radio"
        name="binance-mode"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
        className="mt-0.5"
        data-testid={`account-mode-${value}`}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-fg">{help}</span>
      </span>
    </label>
  );
}

function MarketTypeOption({
  value,
  checked,
  onChange,
  label,
  help,
}: {
  value: 'spot' | 'futures';
  checked: boolean;
  onChange: (next: 'spot' | 'futures') => void;
  label: string;
  help: string;
}): ReactNode {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xs border border-border p-3">
      <input
        type="radio"
        name="market-type"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-0.5"
        data-testid={`account-market-type-${value}`}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-fg">{help}</span>
      </span>
    </label>
  );
}

export const accountNewRoute = createRoute({
  staticData: { title: 'New account' },
  getParentRoute: () => rootRoute,
  path: '/accounts/new',
  component: AccountNewPage,
});
