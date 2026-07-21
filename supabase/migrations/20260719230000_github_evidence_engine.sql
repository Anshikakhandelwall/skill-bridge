-- Phase 7: GitHub Evidence Engine
-- Stores the fetched public profile/repo data and the AI evidence analysis
-- derived from it, mirroring the resumes table's shape (raw + analysis).

create table public.github_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  profile_json jsonb not null default '{}'::jsonb,
  analysis_json jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id)
);

create index github_profiles_profile_id_idx on public.github_profiles(profile_id);

alter table public.github_profiles enable row level security;

create policy "Users manage their own GitHub profile"
  on public.github_profiles for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
