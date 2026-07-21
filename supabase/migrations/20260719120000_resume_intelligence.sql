-- Phase 4: Resume Intelligence Engine
-- Adds resume storage/metadata and evidence fields on the Career Twin.

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  extracted_text text,
  analysis_json jsonb,
  created_at timestamptz not null default now()
);

create index resumes_profile_id_idx on public.resumes(profile_id);
create index resumes_profile_id_created_at_idx on public.resumes(profile_id, created_at desc);

alter table public.resumes enable row level security;

create policy "Users manage their own resumes"
  on public.resumes for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

-- Career Twin gains an evidence summary produced by the Resume Analyst
-- and a timestamp for the most recent AI analysis.
alter table public.career_twins
  add column evidence_summary jsonb not null default '{}'::jsonb,
  add column last_analyzed_at timestamptz;

-- Private storage bucket for uploaded resume PDFs.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Objects are stored under `${auth.uid()}/...`, so folder-scoped policies
-- keep each student's resume file private to them.
create policy "Users can upload their own resume files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can read their own resume files"
  on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own resume files"
  on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own resume files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
