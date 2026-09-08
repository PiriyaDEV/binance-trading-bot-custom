#!/usr/bin/env bun
// Standalone Phase-0 verification for Binance Futures support: confirms a
// Futures Testnet key pair can authenticate and that `getAccount()` /
// `getPositionRisk()` return real data through `createBinanceFuturesRest`.
// Deliberately outside the app's own DB/API — this checks the REST client in
// isolation before it's wired into any live-trading path.
//
// Credentials are read from environment variables ONLY, never from a CLI
// argument (which would land in shell history) and never entered by anyone
// but the operator running this script on their own machine:
//
//   FUTURES_API_KEY=xxx FUTURES_API_SECRET=yyy bun run scripts/verify-futures-account.ts
//
// Get a Futures Testnet key pair at https://testnet.binancefuture.com — it is
// SEPARATE from a Spot Testnet key pair (a different site, different login).
// Pass FUTURES_MODE=live to check against the live venue instead (still
// requires the app's own separate `futures + live` gate to be off — this
// script itself does not enforce that, since it never touches the app's DB).

import { createBinanceFuturesRest } from '@app/binance';

const apiKey = process.env['FUTURES_API_KEY'];
const secretKey = process.env['FUTURES_API_SECRET'];
const mode = process.env['FUTURES_MODE'] === 'live' ? 'live' : 'test';

if (!apiKey || !secretKey) {
  console.error(
    'Usage: FUTURES_API_KEY=xxx FUTURES_API_SECRET=yyy bun run scripts/verify-futures-account.ts',
  );
  process.exit(1);
}

const client = createBinanceFuturesRest({ mode, credentials: { apiKey, secretKey } });

console.log(`Checking Binance Futures (${mode}) account...`);

const account = await client.getAccount();
console.log('getAccount() ok:', {
  totalWalletBalance: account.totalWalletBalance,
  availableBalance: account.availableBalance,
  totalUnrealizedProfit: account.totalUnrealizedProfit,
  openPositions: account.positions.filter((p) => Number(p.positionAmt) !== 0).length,
});

const positions = await client.getPositionRisk();
const open = positions.filter((p) => Number(p.positionAmt) !== 0);
console.log(
  `getPositionRisk() ok: ${positions.length} symbols, ${open.length} with an open position`,
);
for (const p of open) {
  console.log(`  ${p.symbol}: ${p.positionAmt} @ ${p.entryPrice} (leverage ${p.leverage}x)`);
}

console.log(
  'Phase 0 verification passed: the Futures REST client authenticates and reads real account/position data.',
);
