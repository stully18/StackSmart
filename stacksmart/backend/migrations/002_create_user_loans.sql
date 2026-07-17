-- ============================================================================
-- Migration 002: Create public.user_loans + app_events, loan-lifecycle RPCs
-- ============================================================================
-- Purpose: Persist each signed-in StackSmart user's Debt Optimizer loan list
--          as one row per loan, so loans survive refresh/navigation instead of
--          living only in React state. Also adds an append-only public.app_events
--          log and SECURITY INVOKER RPCs (log_app_event, add_user_loan,
--          remove_user_loan) for loan lifecycle + event tracking.
--
-- Runs after 001_create_schema.sql. DDL uses IF NOT EXISTS / CREATE OR
-- REPLACE / DROP ... IF EXISTS where PostgreSQL supports it, so the file is
-- safe to re-run idempotently.
-- The whole change is wrapped in a single transaction for atomicity.
--
-- Decisions (from .hermes/plans/2026-07-16_220852-persist-user-loans-composio-mcp.md
-- and .hermes/plans/2026-07-16_232209-fratfinance-loan-procedures-events.md):
--   * Dedicated public.user_loans table (normalized, one row per loan).
--   * interest_rate stored as the UI percent value (e.g. 7.5), NOT decimal 0.075,
--     because DebtOptimizerPage converts to decimal only when building the request.
--   * NO UNIQUE(user_id, loan_name): real users may hold multiple loans with the
--     same servicer/name. Adding that constraint is deferred to a future migration.
--   * RLS enabled, scoped to auth.uid() = user_id for CRUD by authenticated users.
--   * anon gets no grants; authenticated + service_role get explicit grants.
--   * sort_order preserves the user-visible loan order.
--   * updated_at maintained by a BEFORE UPDATE trigger (NOT SECURITY DEFINER).
--   * public.app_events: append-only event log (user_id nullable for system events).
--   * log_app_event / add_user_loan / remove_user_loan: all SECURITY INVOKER,
--     set search_path = public; RLS on the underlying tables still governs every
--     write, so ownership cannot be forged.
-- ============================================================================

begin;

create table if not exists public.user_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_type text not null check (loan_type in ('student_loan', 'car_loan', 'credit_card', 'personal_loan', 'other')),
  loan_name text not null,
  principal numeric(14, 2) not null check (principal >= 0),
  interest_rate_percent numeric(7, 4) not null check (interest_rate_percent >= 0 and interest_rate_percent <= 100),
  minimum_payment numeric(14, 2) not null check (minimum_payment >= 0),
  term_months integer check (term_months is null or term_months > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_loans_user_id_sort_order_idx
  on public.user_loans(user_id, sort_order, created_at);

alter table public.user_loans enable row level security;

-- Data API reachability. RLS below still restricts which rows a role can see/touch.
grant select, insert, update, delete on table public.user_loans to authenticated;
grant select, insert, update, delete on table public.user_loans to service_role;
revoke all on table public.user_loans from anon;

-- Owner policies: authenticated users can only CRUD their own rows.
drop policy if exists "Users can read own loans" on public.user_loans;
create policy "Users can read own loans"
  on public.user_loans
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own loans" on public.user_loans;
create policy "Users can insert own loans"
  on public.user_loans
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own loans" on public.user_loans;
create policy "Users can update own loans"
  on public.user_loans
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own loans" on public.user_loans;
create policy "Users can delete own loans"
  on public.user_loans
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Trigger to keep updated_at current on every UPDATE.
-- Defined as a plain plpgsql function (NOT SECURITY DEFINER) so it never bypasses RLS.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

drop trigger if exists set_user_loans_updated_at on public.user_loans;
create trigger set_user_loans_updated_at
  before update on public.user_loans
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- Loan lifecycle RPCs + app event log
-- (from approved FratFinance plan 2026-07-16_232209-fratfinance-loan-procedures-events)
--   Adds: public.app_events table, public.log_app_event(),
--         public.add_user_loan(), public.remove_user_loan().
--
-- Security model (consistent with the rest of this migration):
--   * All three functions are SECURITY INVOKER (the safe default) so they run
--     with the caller's privileges and RLS on user_loans / app_events still
--     governs which rows may be written or read. They never bypass RLS.
--   * Each function takes p_user_id defaulting to auth.uid(); the underlying
--     RLS WITH CHECK / USING clauses reject any attempt to touch another
--     user's rows, so a caller cannot forge ownership.
--   * set search_path = public on every function to prevent search_path
--     injection.
--   * anon gets no grants; authenticated + service_role get explicit grants.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- app_events: append-only log of notable app events, optionally per user.
-- user_id is nullable so service-level / system events can be recorded too.
-- ----------------------------------------------------------------------------
create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'account_created',
    'sign_in',
    'sign_out',
    'loan_added',
    'loan_removed',
    'loan_saved',
    'report_spawned',
    'report_generated',
    'feedback_submitted'
  )),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- Backfill/repair early deployments of this migration that used payload/created_at.
alter table public.app_events add column if not exists occurred_at timestamptz not null default now();
alter table public.app_events add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_events drop constraint if exists app_events_user_id_fkey;
alter table public.app_events
  add constraint app_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_events'
      and column_name = 'payload'
  ) then
    update public.app_events
    set metadata = payload
    where metadata = '{}'::jsonb;
  end if;
end;
$$;
alter table public.app_events drop column if exists payload;
alter table public.app_events drop column if exists created_at;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_events_event_type_check'
      and conrelid = 'public.app_events'::regclass
  ) then
    alter table public.app_events
      add constraint app_events_event_type_check
      check (event_type in (
        'account_created',
        'sign_in',
        'sign_out',
        'loan_added',
        'loan_removed',
        'loan_saved',
        'report_spawned',
        'report_generated',
        'feedback_submitted'
      ));
  end if;
end;
$$;

create index if not exists app_events_user_id_occurred_at_idx
  on public.app_events(user_id, occurred_at desc);

create index if not exists app_events_event_type_occurred_at_idx
  on public.app_events(event_type, occurred_at desc);

alter table public.app_events enable row level security;

-- Data API reachability. Clients may insert events, but may not read/update/delete them.
grant insert on table public.app_events to authenticated;
grant select, insert, update, delete on table public.app_events to service_role;
revoke all on table public.app_events from anon;
revoke select, update, delete on table public.app_events from authenticated;

-- Authenticated users can only insert their own events.
drop policy if exists "Users can insert own events" on public.app_events;
drop policy if exists "Users can read own events" on public.app_events;
create policy "Users can insert own events"
  on public.app_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- log_app_event(p_event_type, p_payload, p_user_id): record one app event.
-- SECURITY INVOKER -> RLS on app_events governs the write.
-- ----------------------------------------------------------------------------
create or replace function public.log_app_event(
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  insert into public.app_events (user_id, event_type, metadata)
  values ((select auth.uid()), p_event_type, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_event_id;

  return v_event_id;
end;
$$;

drop function if exists public.log_app_event(text, jsonb, uuid);
revoke execute on function public.log_app_event(text, jsonb) from anon, public;
grant execute on function public.log_app_event(text, jsonb) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- add_user_loan(...): insert one loan for the caller, then log the event.
-- SECURITY INVOKER -> RLS on user_loans (WITH CHECK auth.uid() = user_id)
-- prevents forging ownership even if p_user_id is supplied explicitly.
-- ----------------------------------------------------------------------------
create or replace function public.add_user_loan(
  p_loan_type text,
  p_loan_name text,
  p_principal numeric,
  p_interest_rate_percent numeric,
  p_minimum_payment numeric,
  p_term_months integer default null,
  p_sort_order integer default null
)
returns public.user_loans
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.user_loans;
  v_sort_order integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(p_sort_order, coalesce(max(sort_order) + 1, 0))
    into v_sort_order
  from public.user_loans
  where user_id = (select auth.uid());

  insert into public.user_loans (
    user_id, loan_type, loan_name, principal,
    interest_rate_percent, minimum_payment, term_months, sort_order
  )
  values (
    (select auth.uid()), p_loan_type, nullif(trim(p_loan_name), ''), p_principal,
    p_interest_rate_percent, p_minimum_payment, p_term_months, v_sort_order
  )
  returning * into v_row;

  perform public.log_app_event(
    'loan_added',
    jsonb_build_object(
      'loan_id', v_row.id,
      'loan_type', v_row.loan_type,
      'loan_name', v_row.loan_name,
      'source', 'add_user_loan_rpc'
    )
  );

  return v_row;
end;
$$;

drop function if exists public.add_user_loan(text, text, numeric, numeric, numeric, integer, uuid);
revoke execute on function public.add_user_loan(text, text, numeric, numeric, numeric, integer, integer) from anon, public;
grant execute on function public.add_user_loan(text, text, numeric, numeric, numeric, integer, integer) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- remove_user_loan(p_loan_id): delete one of the caller's loans, then log it.
-- SECURITY INVOKER -> the delete is restricted by RLS to the caller's rows,
-- so a caller can only remove loans they own.
-- ----------------------------------------------------------------------------
create or replace function public.remove_user_loan(
  p_loan_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deleted public.user_loans;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_loans
  where id = p_loan_id
    and user_id = (select auth.uid())
  returning * into v_deleted;

  if v_deleted.id is null then
    raise exception 'Loan not found';
  end if;

  perform public.log_app_event(
    'loan_removed',
    jsonb_build_object(
      'loan_id', v_deleted.id,
      'loan_type', v_deleted.loan_type,
      'loan_name', v_deleted.loan_name,
      'source', 'remove_user_loan_rpc'
    )
  );

  return v_deleted.id;
end;
$$;

drop function if exists public.remove_user_loan(uuid, uuid);
revoke execute on function public.remove_user_loan(uuid) from anon, public;
grant execute on function public.remove_user_loan(uuid) to authenticated, service_role;

commit;
