-- Development only: stores the complete CashFlow app state in one JSONB row.
-- The anon policies below are intentionally open for local testing.
-- Replace them with authenticated, user-scoped policies before production use.

create table if not exists public.application_state (
    id text primary key check (id = 'cashflow'),
    state jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.application_state enable row level security;

grant select, insert, update on public.application_state to anon, authenticated;

drop policy if exists "dev read application state" on public.application_state;
create policy "dev read application state"
on public.application_state for select
to anon, authenticated
using (id = 'cashflow');

drop policy if exists "dev insert application state" on public.application_state;
create policy "dev insert application state"
on public.application_state for insert
to anon, authenticated
with check (id = 'cashflow');

drop policy if exists "dev update application state" on public.application_state;
create policy "dev update application state"
on public.application_state for update
to anon, authenticated
using (id = 'cashflow')
with check (id = 'cashflow');