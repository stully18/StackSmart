-- ============================================================================
-- Migration 003: Track daily AI financial plan generations
-- ============================================================================
-- Purpose: Enforce one successful/pending AI financial plan generation per user
--          per UTC calendar day. Backend service_role writes rows; clients do
--          not read or write this table directly.
--
-- Security model (consistent with 002_create_user_loans.sql):
--   * RLS enabled. Only service_role gets grants + an ALL policy.
--   * anon and authenticated get NO grants and NO policies, so clients cannot
--     touch this table via the Data API; they reach it only through the
--     FastAPI backend using the service-role key (kept server-side).
--   * No SECURITY DEFINER functions are needed here.
--   * A unique (user_id, generated_on) constraint enforces the one-per-day
--     limit atomically at insert time.
--
-- Runs after 002_create_user_loans.sql. Safe to re-run idempotently.
-- Wrapped in a single transaction for atomicity.
-- ============================================================================

begin;

create table if not exists public.ai_plan_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_on date not null default (timezone('utc', now())::date),
  status text not null check (status in ('pending', 'completed', 'failed')),
  provider text not null default 'gemini',
  model text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_plan_generations_user_day_unique unique (user_id, generated_on)
);

create index if not exists ai_plan_generations_user_created_at_idx
  on public.ai_plan_generations(user_id, created_at desc);

alter table public.ai_plan_generations enable row level security;

-- Backend service role manages the table. Authenticated users access it only via
-- FastAPI endpoints, so API keys and internals stay server-side. anon and
-- authenticated get no grants at all.
grant select, insert, update, delete on table public.ai_plan_generations to service_role;
revoke all on table public.ai_plan_generations from anon;
revoke all on table public.ai_plan_generations from authenticated;

drop policy if exists "Service role can manage AI generations" on public.ai_plan_generations;
create policy "Service role can manage AI generations"
  on public.ai_plan_generations
  for all
  to service_role
  using (true)
  with check (true);

commit;
