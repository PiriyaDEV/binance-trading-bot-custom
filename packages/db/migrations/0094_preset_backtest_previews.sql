-- One row per "quick start" wizard preset, holding the server-computed
-- backtest preview (ranked coins + in-sample/out-of-sample robustness) so
-- every operator's browser shares one cached result instead of each one
-- re-running a year-long backtest for the same fixed preset config. Global:
-- no account/profile FK, since the four presets are fixed constants
-- identical for every install.
create table if not exists preset_backtest_previews (
  preset_id       text primary key,
  candle_interval text not null,
  picked_symbols  jsonb not null,
  robustness      jsonb not null,
  clears_gate     boolean not null,
  -- How many days of candles the run covered, so a later change to the
  -- window size is visible on an old row instead of silently assumed current.
  window_days     integer not null,
  ran_at          timestamptz not null
);
