-- Myanmar Claims History Checking System schema
create extension if not exists pgcrypto;

create type app_role as enum ('admin', 'viewer');
create type database_version_status as enum ('staging', 'active', 'archived', 'failed');
create type match_status as enum ('Matched', 'No history');

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role app_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table database_versions (
  id uuid primary key default gen_random_uuid(),
  version_name text not null,
  source_file_name text,
  coverage_date date not null,
  uploaded_by uuid references profiles(user_id),
  uploaded_at timestamptz not null default now(),
  total_members integer not null default 0,
  total_claims integer not null default 0,
  status database_version_status not null default 'staging'
);

create table members (
  id uuid primary key default gen_random_uuid(),
  historical_member_id text not null,
  full_name text not null,
  normalized_name text not null,
  nrc text,
  normalized_nrc text,
  date_of_birth date,
  gender text,
  database_version_id uuid not null references database_versions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(historical_member_id, database_version_id)
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  claim_number text not null,
  incurred_date date,
  discharge_date date,
  diagnosis_code text,
  diagnosis_description text,
  database_version_id uuid not null references database_versions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(claim_number, database_version_id)
);

create table census_upload_batches (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  uploaded_by uuid references profiles(user_id),
  uploaded_at timestamptz not null default now(),
  total_members integer not null default 0,
  matched_count integer not null default 0,
  no_history_count integer not null default 0
);

create table census_upload_members (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references census_upload_batches(id) on delete cascade,
  name text not null,
  nrc text,
  date_of_birth date,
  gender text,
  match_status match_status not null,
  matched_member_id uuid references members(id),
  historical_member_id text
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(user_id),
  action text not null,
  timestamp timestamptz not null default now(),
  search_type text,
  search_parameters jsonb,
  census_batch_id uuid references census_upload_batches(id),
  database_version_id uuid references database_versions(id),
  relevant_member_id uuid references members(id)
);

alter table profiles enable row level security;
alter table database_versions enable row level security;
alter table members enable row level security;
alter table claims enable row level security;
alter table census_upload_batches enable row level security;
alter table census_upload_members enable row level security;
alter table audit_logs enable row level security;

create or replace function is_admin() returns boolean language sql stable as $$
  select exists(select 1 from profiles where user_id = auth.uid() and role = 'admin' and active = true);
$$;
create or replace function is_active_user() returns boolean language sql stable as $$
  select exists(select 1 from profiles where user_id = auth.uid() and active = true);
$$;

create policy "active users read active versions" on database_versions for select using (is_active_user());
create policy "admins manage versions" on database_versions for all using (is_admin()) with check (is_admin());
create policy "active users search members" on members for select using (is_active_user());
create policy "admins manage members" on members for all using (is_admin()) with check (is_admin());
create policy "active users read claims through app" on claims for select using (is_active_user());
create policy "admins manage claims" on claims for all using (is_admin()) with check (is_admin());
create policy "users read own profile" on profiles for select using (auth.uid() = user_id or is_admin());
create policy "admins manage profiles" on profiles for all using (is_admin()) with check (is_admin());
create policy "active users insert own census batches" on census_upload_batches for insert with check (is_active_user());
create policy "active users read census batches" on census_upload_batches for select using (is_active_user());
create policy "active users manage census rows" on census_upload_members for all using (is_active_user()) with check (is_active_user());
create policy "active users insert audit logs" on audit_logs for insert with check (is_active_user());
create policy "admins read audit logs" on audit_logs for select using (is_admin());

-- Automatically provision a `profiles` row whenever a new Supabase Auth
-- user is created (e.g. via the Auth dashboard or the admin script). New
-- accounts default to the least-privileged 'viewer' role and must be
-- promoted to 'admin' explicitly (see scripts/create-admin-user.mjs).
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (user_id, full_name, email, role, active)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, 'viewer', true)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
