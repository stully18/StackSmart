-- Unlimited UUID-based generation audit. Run after 003 and 004.
-- Apply before deploying the new backend. Existing rows and RLS remain intact.
begin;

alter table public.ai_plan_generations
  drop constraint if exists ai_plan_generations_user_day_unique;
alter table public.ai_plan_generations
  drop constraint if exists ai_plan_generations_user_day_number_unique;
alter table public.ai_plan_generations
  drop constraint if exists ai_plan_generations_generation_number_check;
-- Keep the deprecated column for rollout/rollback compatibility. UUID is the identity.
drop index if exists public.ai_plan_generations_user_day_status_idx;
alter table public.ai_plan_generations add column if not exists generation_number integer;
alter table public.ai_plan_generations alter column generation_number drop not null;
alter table public.ai_plan_generations alter column generation_number drop default;
alter table public.ai_plan_generations alter column provider set default 'openrouter';

-- Supports authenticated status count/latest queries without loading all history.
create index if not exists ai_plan_generations_user_day_created_at_idx
  on public.ai_plan_generations (user_id, generated_on, created_at desc)
  where status in ('pending', 'completed');

alter table public.ai_plan_generations enable row level security;
revoke all on table public.ai_plan_generations from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_plan_generations to service_role;
drop policy if exists "Service role can manage AI generations" on public.ai_plan_generations;
create policy "Service role can manage AI generations" on public.ai_plan_generations
  for all to service_role using (true) with check (true);

-- Older financial payload snapshots are preserved for an explicit retention decision.
-- New audit rows contain metadata only; saved financial_data plans stay canonical.
commit;
