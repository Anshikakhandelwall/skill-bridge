-- Phase 5: Career Planner Agent
-- Adds the milestone grouping the original architecture doc planned
-- (roadmap_milestones was listed in the schema design but never created)
-- and the explainability fields the roadmap UI needs on each task:
-- a description, what proves completion, and why the task matters.

-- Stores the deterministic skill gap matrix used to generate each roadmap,
-- so the roadmap UI can render the exact evidence behind it instead of
-- recomputing (and potentially drifting from) it on every page load.
alter table public.roadmaps
  add column skill_gap_snapshot jsonb not null default '[]'::jsonb,
  add column summary text,
  add column rationale text;

create table public.roadmap_milestones (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  title text not null,
  sequence integer not null check (sequence > 0),
  weeks_label text not null,
  objective text not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  unique (roadmap_id, sequence)
);

create index roadmap_milestones_roadmap_id_idx on public.roadmap_milestones(roadmap_id);

alter table public.roadmap_milestones enable row level security;

create policy "Users manage milestones from their own roadmaps"
  on public.roadmap_milestones for all to authenticated
  using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.profile_id = (select auth.uid())))
  with check (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.profile_id = (select auth.uid())));

alter table public.roadmap_tasks
  add column milestone_id uuid references public.roadmap_milestones(id) on delete cascade,
  add column description text,
  add column evidence_required text,
  add column why_it_matters text;

create index roadmap_tasks_milestone_id_idx on public.roadmap_tasks(milestone_id);
