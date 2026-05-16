alter table public.study_sessions
add column if not exists session_date date;

update public.study_sessions
set session_date = started_at::date
where session_date is null;

alter table public.study_sessions
alter column session_date set default current_date;

alter table public.study_sessions
alter column session_date set not null;

create index if not exists study_sessions_session_date_idx on public.study_sessions(session_date);
