-- ============================================================================
-- Migration 004: Raise AI financial plan generations to 10 per user/day
-- ============================================================================
-- Purpose: Replace the original one-row-per-user-per-day unique constraint with
--          10 numbered generation slots per user per UTC day.
--
-- Security model is unchanged from 003:
--   * RLS remains enabled.
--   * service_role remains the only role with table grants/policy.
--   * anon/authenticated still have no direct table access.
-- ============================================================================

begin;

alter table public.ai_plan_generations
  add column if not exists generation_number integer not null default 1;

alter table public.ai_plan_generations
  drop constraint if exists ai_plan_generations_generation_number_check;

alter table public.ai_plan_generations
  add constraint ai_plan_generations_generation_number_check
  check (generation_number between 1 and 10);

alter table public.ai_plan_generations
  drop constraint if exists ai_plan_generations_user_day_unique;

alter table public.ai_plan_generations
  drop constraint if exists ai_plan_generations_user_day_number_unique;

alter table public.ai_plan_generations
  add constraint ai_plan_generations_user_day_number_unique
  unique (user_id, generated_on, generation_number);

create index if not exists ai_plan_generations_user_day_status_idx
  on public.ai_plan_generations(user_id, generated_on, status, generation_number);

commit;
