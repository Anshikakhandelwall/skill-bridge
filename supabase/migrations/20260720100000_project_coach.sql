-- Phase 8: Project Coach Agent
-- Stores AI-generated portfolio project plans and their completion state.
-- roadmap_id is nullable + ON DELETE SET NULL so a project's history
-- survives even after the roadmap that inspired it is archived/regenerated.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  roadmap_id uuid references public.roadmaps(id) on delete set null,
  title text not null,
  target_role text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  estimated_hours numeric(6,2) not null check (estimated_hours > 0),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  project_json jsonb not null default '{}'::jsonb,
  github_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index projects_profile_id_idx on public.projects(profile_id);
create index projects_profile_id_status_idx on public.projects(profile_id, status);

alter table public.projects enable row level security;

create policy "Users manage their own projects"
  on public.projects for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
