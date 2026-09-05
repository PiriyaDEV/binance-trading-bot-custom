-- Foundational plumbing for Binance Futures support (long + short, fixed
-- 1-3x leverage). `market_type` is a new account-level axis sibling to
-- `binance_mode`: a futures account is a SEPARATE row from a spot account
-- (same pattern as "create a second account for live vs test"), because
-- Futures Testnet issues its own credentials, distinct from Spot Testnet's,
-- and `api_keys.account_id` already stays unique-per-account. `leverage` is
-- profile-scoped (mirrors `quote_asset`) since Binance's leverage setting is
-- itself per-symbol and profiles are the natural "which symbols" boundary.
alter table accounts
  add column if not exists market_type text not null default 'spot';

alter table accounts
  add constraint accounts_market_type_chk check (market_type in ('spot', 'futures'));

alter table profiles
  add column if not exists leverage smallint;

alter table profiles
  add constraint profiles_leverage_chk check (leverage is null or leverage between 1 and 3);
