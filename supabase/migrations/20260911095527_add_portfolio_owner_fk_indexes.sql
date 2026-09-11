create index if not exists portfolio_positions_account_owner_idx
  on public.portfolio_positions (portfolio_account_id, user_id);

create index if not exists portfolio_snapshots_account_owner_idx
  on public.portfolio_snapshots (portfolio_account_id, user_id);
