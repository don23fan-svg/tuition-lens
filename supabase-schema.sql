-- ============================================================================
-- Tuition Lens — Supabase Database Schema
-- Run this once in the Supabase SQL Editor (see SUPABASE_SETUP.md Step 2)
-- ============================================================================

-- A single key-value table, scoped per user.
-- We store the app's state blobs (settings, 529 funds, selected schools, saved
-- scenarios) as JSON, keyed the same way the app already keys localStorage.
-- This keeps the app's storage logic nearly identical between anonymous mode
-- and logged-in mode.

create table if not exists public.user_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Enable Row Level Security: without policies, no one can read/write anything.
alter table public.user_data enable row level security;

-- Policy: users can SELECT only their own rows.
create policy "Users can read own data"
  on public.user_data for select
  using (auth.uid() = user_id);

-- Policy: users can INSERT rows only for themselves.
create policy "Users can insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

-- Policy: users can UPDATE only their own rows.
create policy "Users can update own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policy: users can DELETE only their own rows.
create policy "Users can delete own data"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- Helpful index for the per-user lookups the app does constantly.
create index if not exists user_data_user_id_idx on public.user_data(user_id);

-- Auto-update the updated_at timestamp on any change.
create or replace function public.handle_user_data_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_data_updated_at on public.user_data;
create trigger user_data_updated_at
  before update on public.user_data
  for each row execute function public.handle_user_data_updated_at();
