-- Phase 6: Adaptive Career Engine
-- Extends the existing (previously unused) assessments table to support a
-- two-step start/submit flow. career_events already has profile_id,
-- event_type, payload_json, and created_at, so no schema change is needed
-- there — it already satisfies the event engine's persistence requirements.

alter table public.assessments
  add column assessment_type text not null default 'technical_quiz'
    check (assessment_type in ('technical_quiz', 'project_evaluation', 'mock_coding', 'knowledge_check')),
  add column confidence numeric(5,2) check (confidence is null or confidence between 0 and 100),
  add column passed boolean,
  add column status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  add column completed_at timestamptz;

create index assessments_profile_id_status_idx on public.assessments(profile_id, status);
