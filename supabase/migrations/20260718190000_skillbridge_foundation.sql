create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  education text,
  graduation_date date,
  interests text[] not null default '{}',
  weekly_hours integer check (weekly_hours is null or weekly_hours >= 0),
  workload_level text check (workload_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  created_at timestamptz not null default now()
);

create table public.career_goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  target_role text not null,
  target_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  created_at timestamptz not null default now()
);

create table public.student_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  level integer not null check (level between 0 and 5),
  evidence_type text not null check (evidence_type in ('claimed', 'inferred', 'assessed', 'demonstrated')),
  confidence numeric(5,2) not null default 0 check (confidence between 0 and 100),
  last_updated_at timestamptz not null default now(),
  unique(profile_id, skill_id)
);

create table public.role_competencies (
  id uuid primary key default gen_random_uuid(),
  target_role text not null,
  skill_id uuid not null references public.skills(id) on delete cascade,
  required_level integer not null check (required_level between 1 and 5),
  weight numeric(5,2) not null check (weight > 0),
  unique(target_role, skill_id)
);

create table public.career_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.career_goals(id) on delete cascade,
  readiness_score numeric(5,2) not null default 0 check (readiness_score between 0 and 100),
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now()
);

create table public.roadmap_tasks (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  title text not null,
  skill_id uuid references public.skills(id) on delete set null,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  evidence_url text,
  created_at timestamptz not null default now()
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  score numeric(5,2) not null check (score between 0 and 100),
  feedback_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index career_goals_profile_id_idx on public.career_goals(profile_id);
create index student_skills_profile_id_idx on public.student_skills(profile_id);
create index career_events_profile_id_idx on public.career_events(profile_id);
create index roadmaps_profile_id_idx on public.roadmaps(profile_id);
create index roadmap_tasks_roadmap_id_idx on public.roadmap_tasks(roadmap_id);
create index assessments_profile_id_idx on public.assessments(profile_id);

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.career_goals enable row level security;
alter table public.student_skills enable row level security;
alter table public.role_competencies enable row level security;
alter table public.career_events enable row level security;
alter table public.roadmaps enable row level security;
alter table public.roadmap_tasks enable row level security;
alter table public.assessments enable row level security;

create policy "Profiles are readable by their owner" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Profiles are created by their owner" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Profiles are updated by their owner" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Authenticated users can read skills" on public.skills for select to authenticated using (true);
create policy "Authenticated users can read role competencies" on public.role_competencies for select to authenticated using (true);

create policy "Users manage their own career goals" on public.career_goals for all to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);
create policy "Users manage their own student skills" on public.student_skills for all to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);
create policy "Users manage their own career events" on public.career_events for all to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);
create policy "Users manage their own roadmaps" on public.roadmaps for all to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);
create policy "Users manage tasks from their own roadmaps" on public.roadmap_tasks for all to authenticated using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.profile_id = (select auth.uid()))) with check (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.profile_id = (select auth.uid())));
create policy "Users manage their own assessments" on public.assessments for all to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);

insert into public.skills (name, category) values
  ('HTML', 'frontend'), ('CSS', 'frontend'), ('JavaScript', 'frontend'), ('TypeScript', 'frontend'), ('React', 'frontend'), ('Git', 'developer_tools'),
  ('SQL', 'data'), ('Excel', 'data'), ('Python', 'programming'), ('Data Visualization', 'data'), ('Statistics', 'data'),
  ('Machine Learning', 'machine_learning'), ('Data Cleaning', 'data'), ('Model Evaluation', 'machine_learning'), ('Pandas', 'data')
on conflict (name) do nothing;

insert into public.role_competencies (target_role, skill_id, required_level, weight)
select seed.target_role, s.id, seed.required_level, seed.weight
from (values
  ('Frontend Developer', 'HTML', 4, 1.0::numeric), ('Frontend Developer', 'CSS', 4, 1.0::numeric), ('Frontend Developer', 'JavaScript', 4, 1.5::numeric), ('Frontend Developer', 'TypeScript', 3, 1.1::numeric), ('Frontend Developer', 'React', 4, 1.5::numeric), ('Frontend Developer', 'Git', 3, 0.7::numeric),
  ('Data Analyst', 'SQL', 4, 1.5::numeric), ('Data Analyst', 'Excel', 4, 1.1::numeric), ('Data Analyst', 'Python', 3, 1.0::numeric), ('Data Analyst', 'Data Visualization', 4, 1.3::numeric), ('Data Analyst', 'Statistics', 3, 1.1::numeric), ('Data Analyst', 'Data Cleaning', 4, 1.2::numeric),
  ('Machine Learning Engineer', 'Python', 5, 1.5::numeric), ('Machine Learning Engineer', 'Machine Learning', 4, 1.5::numeric), ('Machine Learning Engineer', 'Statistics', 4, 1.2::numeric), ('Machine Learning Engineer', 'Model Evaluation', 4, 1.2::numeric), ('Machine Learning Engineer', 'Pandas', 4, 1.0::numeric), ('Machine Learning Engineer', 'Git', 3, 0.7::numeric)
) as seed(target_role, skill_name, required_level, weight)
join public.skills s on s.name = seed.skill_name
on conflict (target_role, skill_id) do nothing;
