-- Cloe Dashboard v0.2 — authenticated read model.
-- Writes are server-only; authenticated users can only read their own rows.

create table if not exists public.assets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, symbol),
  unique (id, user_id)
);

create table if not exists public.candles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id bigint not null,
  timeframe text not null check (timeframe in ('15m', '1h', '4h', '1d')),
  opened_at timestamptz not null,
  open numeric(30, 12) not null,
  high numeric(30, 12) not null,
  low numeric(30, 12) not null,
  close numeric(30, 12) not null,
  volume numeric(38, 12) not null,
  source text not null,
  retrieved_at timestamptz not null default now(),
  constraint candles_asset_owner_fk foreign key (asset_id, user_id)
    references public.assets (id, user_id) on delete cascade,
  constraint candles_ohlc_check check (high >= greatest(open, close, low) and low <= least(open, close, high)),
  unique (asset_id, timeframe, opened_at, source)
);

create index if not exists candles_user_asset_time_idx on public.candles (user_id, asset_id, timeframe, opened_at desc);
create index if not exists candles_asset_owner_idx on public.candles (asset_id, user_id);

create table if not exists public.technical_analyses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id bigint not null,
  timeframe text not null check (timeframe in ('15m', '1h', '4h', '1d')),
  as_of timestamptz not null,
  bias text not null check (bias in ('bullish', 'neutral', 'bearish', 'insufficient_data')),
  structure text not null,
  wyckoff_reading text,
  elliott_reading text,
  price_action_reading text,
  volume_reading text,
  support_levels jsonb not null default '[]'::jsonb,
  resistance_levels jsonb not null default '[]'::jsonb,
  indicators jsonb not null default '{}'::jsonb,
  confirmation text,
  invalidation text,
  confidence numeric(5, 2) check (confidence between 0 and 100),
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint technical_asset_owner_fk foreign key (asset_id, user_id)
    references public.assets (id, user_id) on delete cascade
);

create index if not exists technical_user_asset_time_idx on public.technical_analyses (user_id, asset_id, timeframe, as_of desc);
create index if not exists technical_asset_owner_idx on public.technical_analyses (asset_id, user_id);

create table if not exists public.macro_observations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  metric_key text not null,
  observed_at timestamptz not null,
  value numeric(38, 12),
  text_value text,
  unit text,
  direction text check (direction in ('rising', 'flat', 'falling', 'mixed', 'unknown')),
  source_name text not null,
  source_url text,
  retrieved_at timestamptz not null default now(),
  unique (user_id, metric_key, observed_at, source_name)
);

create index if not exists macro_user_metric_time_idx on public.macro_observations (user_id, metric_key, observed_at desc);

create table if not exists public.fundamental_analyses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  as_of timestamptz not null,
  regime text not null check (regime in ('favorable', 'neutral', 'negative', 'insufficient_data')),
  liquidity_bias text not null,
  sentiment_reading text,
  summary text not null,
  evidence jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  confidence numeric(5, 2) check (confidence between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists fundamental_user_time_idx on public.fundamental_analyses (user_id, as_of desc);

create table if not exists public.market_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_at timestamptz,
  title text not null,
  category text not null,
  status text not null check (status in ('rumor', 'announced', 'confirmed', 'completed', 'cancelled')),
  importance text not null check (importance in ('low', 'medium', 'high', 'critical')),
  affected_assets text[] not null default '{}',
  source_name text not null,
  source_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists events_user_schedule_idx on public.market_events (user_id, scheduled_at asc);

create table if not exists public.news_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  published_at timestamptz,
  title text not null,
  summary text,
  verification_status text not null check (verification_status in ('unverified', 'official', 'corroborated', 'discarded')),
  importance text not null check (importance in ('low', 'medium', 'high', 'critical')),
  affected_assets text[] not null default '{}',
  source_name text not null,
  source_url text,
  topic_key text,
  created_at timestamptz not null default now()
);

create index if not exists news_user_published_idx on public.news_items (user_id, published_at desc);

create table if not exists public.daily_syntheses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_date date not null,
  general_regime text not null check (general_regime in ('favorable', 'neutral', 'negative', 'insufficient_data')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'unknown')),
  technical_result jsonb not null default '{}'::jsonb,
  fundamental_result jsonb not null default '{}'::jsonb,
  dates_result jsonb not null default '{}'::jsonb,
  agreements jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  conclusion text not null,
  operator_action text not null default 'no_operation',
  information_cutoff timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, analysis_date)
);

create index if not exists syntheses_user_date_idx on public.daily_syntheses (user_id, analysis_date desc);

alter table public.assets enable row level security;
alter table public.candles enable row level security;
alter table public.technical_analyses enable row level security;
alter table public.macro_observations enable row level security;
alter table public.fundamental_analyses enable row level security;
alter table public.market_events enable row level security;
alter table public.news_items enable row level security;
alter table public.daily_syntheses enable row level security;

create policy "assets_select_own" on public.assets for select to authenticated using ((select auth.uid()) = user_id);
create policy "candles_select_own" on public.candles for select to authenticated using ((select auth.uid()) = user_id);
create policy "technical_select_own" on public.technical_analyses for select to authenticated using ((select auth.uid()) = user_id);
create policy "macro_select_own" on public.macro_observations for select to authenticated using ((select auth.uid()) = user_id);
create policy "fundamental_select_own" on public.fundamental_analyses for select to authenticated using ((select auth.uid()) = user_id);
create policy "events_select_own" on public.market_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "news_select_own" on public.news_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "syntheses_select_own" on public.daily_syntheses for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.assets, public.candles, public.technical_analyses, public.macro_observations,
  public.fundamental_analyses, public.market_events, public.news_items, public.daily_syntheses from anon, authenticated;

revoke all on all sequences in schema public from anon, authenticated;

grant select on table public.assets, public.candles, public.technical_analyses, public.macro_observations,
  public.fundamental_analyses, public.market_events, public.news_items, public.daily_syntheses to authenticated;

create table if not exists public.portfolio_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('spot', 'futures')),
  mode text not null check (mode in ('real', 'simulation')),
  base_currency text not null default 'EUR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table if not exists public.portfolio_positions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  portfolio_account_id bigint not null,
  symbol text not null,
  quantity numeric(38, 12) not null check (quantity >= 0),
  average_entry numeric(30, 12) not null check (average_entry >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  information_date date not null,
  source text not null,
  notes text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint portfolio_positions_account_owner_fk foreign key (portfolio_account_id, user_id)
    references public.portfolio_accounts (id, user_id) on delete cascade,
  unique (portfolio_account_id, symbol, status)
);

create table if not exists public.portfolio_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  portfolio_account_id bigint not null,
  observed_at timestamptz not null,
  equity numeric(30, 12) not null,
  invested_capital numeric(30, 12) not null,
  realized_pnl numeric(30, 12) not null default 0,
  unrealized_pnl numeric(30, 12),
  source text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint portfolio_snapshots_account_owner_fk foreign key (portfolio_account_id, user_id)
    references public.portfolio_accounts (id, user_id) on delete cascade,
  unique (portfolio_account_id, observed_at, source)
);

create index if not exists portfolio_accounts_user_type_idx on public.portfolio_accounts (user_id, account_type);
create index if not exists portfolio_positions_user_account_idx on public.portfolio_positions (user_id, portfolio_account_id, status);
create index if not exists portfolio_snapshots_user_account_time_idx on public.portfolio_snapshots (user_id, portfolio_account_id, observed_at desc);
create index if not exists portfolio_positions_account_owner_idx on public.portfolio_positions (portfolio_account_id, user_id);
create index if not exists portfolio_snapshots_account_owner_idx on public.portfolio_snapshots (portfolio_account_id, user_id);

alter table public.portfolio_accounts enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.portfolio_snapshots enable row level security;

create policy "portfolio_accounts_select_own" on public.portfolio_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "portfolio_positions_select_own" on public.portfolio_positions for select to authenticated using ((select auth.uid()) = user_id);
create policy "portfolio_snapshots_select_own" on public.portfolio_snapshots for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.portfolio_accounts, public.portfolio_positions, public.portfolio_snapshots from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on table public.portfolio_accounts, public.portfolio_positions, public.portfolio_snapshots to authenticated;
