alter table public.profiles
  add column college_university text,
  add column degree text,
  add column graduation_year integer check (graduation_year is null or graduation_year between 2000 and 2100),
  add column current_semester integer check (current_semester is null or current_semester > 0);

alter table public.career_goals
  add column learning_style text check (learning_style in ('videos', 'reading', 'building_projects', 'mixed'));

alter table public.student_skills
  alter column skill_id drop not null,
  add column custom_skill_name text,
  add constraint student_skills_has_skill check (skill_id is not null or custom_skill_name is not null);

alter table public.roadmaps
  drop constraint roadmaps_status_check,
  add constraint roadmaps_status_check check (status in ('draft', 'active', 'archived', 'not_generated'));

create table public.career_twins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  career_goal_id uuid references public.career_goals(id) on delete set null,
  personal_profile jsonb not null default '{}'::jsonb,
  current_skills jsonb not null default '[]'::jsonb,
  weekly_hours integer check (weekly_hours is null or weekly_hours >= 0),
  interests text[] not null default '{}',
  current_readiness_score numeric(5,2) not null default 0 check (current_readiness_score between 0 and 100),
  missing_skills jsonb not null default '[]'::jsonb,
  roadmap_status text not null default 'not_generated' check (roadmap_status in ('not_generated', 'generated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.career_twins enable row level security;
create policy "Users manage their own career twin" on public.career_twins for all to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);
