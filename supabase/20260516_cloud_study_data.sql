-- Revisio cloud study data schema.
-- Run this in Supabase SQL editor after profiles.sql.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  exam_date date,
  color text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  abbreviation text not null default '',
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  number integer not null default 1,
  title text not null,
  content text,
  completed boolean not null default false,
  tags text[] not null default '{}'::text[],
  difficulty text not null default 'medium',
  importance text not null default 'medium',
  status text not null default 'unknown',
  total_study_time integer not null default 0,
  review_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null default 0,
  type text not null default 'active_recall',
  note text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_user_id_idx on public.workspaces(user_id);
create index if not exists subjects_workspace_id_idx on public.subjects(workspace_id);
create index if not exists questions_subject_id_idx on public.questions(subject_id);
create index if not exists study_sessions_workspace_id_idx on public.study_sessions(workspace_id);
create index if not exists study_sessions_question_id_idx on public.study_sessions(question_id);

alter table public.workspaces enable row level security;
alter table public.subjects enable row level security;
alter table public.questions enable row level security;
alter table public.study_sessions enable row level security;

drop policy if exists "Users can read their workspaces" on public.workspaces;
create policy "Users can read their workspaces"
on public.workspaces for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their workspaces" on public.workspaces;
create policy "Users can create their workspaces"
on public.workspaces for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their workspaces" on public.workspaces;
create policy "Users can update their workspaces"
on public.workspaces for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their workspaces" on public.workspaces;
create policy "Users can delete their workspaces"
on public.workspaces for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read subjects in their workspaces" on public.subjects;
create policy "Users can read subjects in their workspaces"
on public.subjects for select
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = subjects.workspace_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can create subjects in their workspaces" on public.subjects;
create policy "Users can create subjects in their workspaces"
on public.subjects for insert
with check (
  exists (
    select 1 from public.workspaces
    where workspaces.id = subjects.workspace_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can update subjects in their workspaces" on public.subjects;
create policy "Users can update subjects in their workspaces"
on public.subjects for update
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = subjects.workspace_id
      and workspaces.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspaces
    where workspaces.id = subjects.workspace_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete subjects in their workspaces" on public.subjects;
create policy "Users can delete subjects in their workspaces"
on public.subjects for delete
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = subjects.workspace_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can read questions in their workspaces" on public.questions;
create policy "Users can read questions in their workspaces"
on public.questions for select
using (
  exists (
    select 1
    from public.subjects
    join public.workspaces on workspaces.id = subjects.workspace_id
    where subjects.id = questions.subject_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can create questions in their workspaces" on public.questions;
create policy "Users can create questions in their workspaces"
on public.questions for insert
with check (
  exists (
    select 1
    from public.subjects
    join public.workspaces on workspaces.id = subjects.workspace_id
    where subjects.id = questions.subject_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can update questions in their workspaces" on public.questions;
create policy "Users can update questions in their workspaces"
on public.questions for update
using (
  exists (
    select 1
    from public.subjects
    join public.workspaces on workspaces.id = subjects.workspace_id
    where subjects.id = questions.subject_id
      and workspaces.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.subjects
    join public.workspaces on workspaces.id = subjects.workspace_id
    where subjects.id = questions.subject_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete questions in their workspaces" on public.questions;
create policy "Users can delete questions in their workspaces"
on public.questions for delete
using (
  exists (
    select 1
    from public.subjects
    join public.workspaces on workspaces.id = subjects.workspace_id
    where subjects.id = questions.subject_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can read study sessions in their workspaces" on public.study_sessions;
create policy "Users can read study sessions in their workspaces"
on public.study_sessions for select
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = study_sessions.workspace_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can create study sessions in their workspaces" on public.study_sessions;
create policy "Users can create study sessions in their workspaces"
on public.study_sessions for insert
with check (
  exists (
    select 1 from public.workspaces
    where workspaces.id = study_sessions.workspace_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can update study sessions in their workspaces" on public.study_sessions;
create policy "Users can update study sessions in their workspaces"
on public.study_sessions for update
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = study_sessions.workspace_id
      and workspaces.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspaces
    where workspaces.id = study_sessions.workspace_id
      and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete study sessions in their workspaces" on public.study_sessions;
create policy "Users can delete study sessions in their workspaces"
on public.study_sessions for delete
using (
  exists (
    select 1 from public.workspaces
    where workspaces.id = study_sessions.workspace_id
      and workspaces.user_id = auth.uid()
  )
);

-- TODO: Enable Supabase Realtime on these tables later for live multi-device sync.
