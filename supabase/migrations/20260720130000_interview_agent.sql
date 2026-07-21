-- Phase 9: Interview Agent
-- Stores generated interview questions, the student's answers, and the
-- structured evaluation feedback, mirroring the resumes/projects pattern
-- (raw content + AI analysis in one row).

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  roadmap_id uuid references public.roadmaps(id) on delete set null,
  target_role text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  overall_score numeric(5,2) check (overall_score is null or overall_score between 0 and 100),
  questions_json jsonb not null default '[]'::jsonb,
  answers_json jsonb not null default '[]'::jsonb,
  feedback_json jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index interview_sessions_profile_id_idx on public.interview_sessions(profile_id);
create index interview_sessions_profile_id_status_idx on public.interview_sessions(profile_id, status);

alter table public.interview_sessions enable row level security;

create policy "Users manage their own interview sessions"
  on public.interview_sessions for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
