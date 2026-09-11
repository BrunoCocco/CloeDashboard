create index if not exists candles_asset_owner_idx on public.candles (asset_id, user_id);
create index if not exists technical_asset_owner_idx on public.technical_analyses (asset_id, user_id);
