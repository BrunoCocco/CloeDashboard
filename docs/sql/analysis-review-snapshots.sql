-- Applied in CloeDashboard wvwxwutjdqsktnrcdbkf through Supabase migration
-- version 20261030171301: analysis_review_snapshots (coordinator verified success).
-- Reference DDL: do not reapply to an already migrated database.
-- Existing tables and historical rows are intentionally untouched.
begin;
create table public.analysis_review_snapshots (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 ingestion_key text not null check(length(btrim(ingestion_key)) between 1 and 180),
 unique(user_id,ingestion_key),
 asset_symbol text not null check(asset_symbol in ('BTC','SOL','XRP','HBAR','XLM','VELO','SHX')),
 analysis_date date not null,
 observed_at timestamptz,
 created_at timestamptz not null default now(),
 revision_of uuid,
 snapshot jsonb not null,
 unique(id,user_id),
 foreign key(revision_of,user_id) references public.analysis_review_snapshots(id,user_id),
 check(revision_of is null or revision_of<>id),
 check(coalesce(jsonb_typeof(snapshot)='object' and snapshot->>'version'='1' and snapshot->>'standardVersion'='1.0',false)),
 check(coalesce(snapshot->>'analysisDate'=analysis_date::text,false)),
 check(coalesce(snapshot->'asset'->>'symbol'=asset_symbol,false)),
 check(coalesce(snapshot->'source' ? 'observedAt',false)),
 check(((snapshot->'source'->>'observedAt')::timestamptz) is not distinct from observed_at),
 check(octet_length(snapshot::text)<=131072)
);
create index analysis_reviews_owner_date_idx on public.analysis_review_snapshots(user_id,analysis_date desc,created_at desc,id desc);
alter table public.analysis_review_snapshots enable row level security;
create policy analysis_reviews_select_own on public.analysis_review_snapshots for select to authenticated using((select auth.uid())=user_id);
revoke all on public.analysis_review_snapshots from public,anon,authenticated;
grant select on public.analysis_review_snapshots to authenticated;
-- Administrative ingestion only. No browser INSERT/UPDATE/DELETE policy or grant.
grant select,insert on public.analysis_review_snapshots to service_role;
revoke update,delete,truncate on public.analysis_review_snapshots from service_role;
create function public.reject_analysis_review_mutation() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 raise exception 'Analysis cuts are append-only; insert a correction referencing revision_of';
end;
$$;
revoke all on function public.reject_analysis_review_mutation() from public,anon,authenticated;
create trigger analysis_review_immutable before update or delete on public.analysis_review_snapshots for each row execute function public.reject_analysis_review_mutation();
create trigger analysis_review_no_truncate before truncate on public.analysis_review_snapshots for each statement execute function public.reject_analysis_review_mutation();
create function public.stamp_analysis_review_created_at() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 new.created_at:=clock_timestamp();
 return new;
end;
$$;
revoke all on function public.stamp_analysis_review_created_at() from public,anon,authenticated;
create trigger analysis_review_created_at before insert on public.analysis_review_snapshots for each row execute function public.stamp_analysis_review_created_at();
commit;
-- After authorized application: verify two-owner RLS, admin INSERT, mutation rejection,
-- same-owner correction FK, query ordering, authenticated UI and Supabase advisors.
