-- Separate real Spot holdings from Futures simulation and preserve historical records.

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

alter table public.portfolio_accounts enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.portfolio_snapshots enable row level security;

create policy "portfolio_accounts_select_own" on public.portfolio_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "portfolio_positions_select_own" on public.portfolio_positions for select to authenticated using ((select auth.uid()) = user_id);
create policy "portfolio_snapshots_select_own" on public.portfolio_snapshots for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.portfolio_accounts, public.portfolio_positions, public.portfolio_snapshots from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on table public.portfolio_accounts, public.portfolio_positions, public.portfolio_snapshots to authenticated;
