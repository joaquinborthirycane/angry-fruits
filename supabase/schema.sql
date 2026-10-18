create table if not exists public.scores (
  id bigint generated always as identity primary key,
  name varchar(16) not null check (
    char_length(trim(name)) between 2 and 16
    and name ~ '^[[:alnum:] ._-]+$'
  ),
  score integer not null check (score between 1 and 1000000),
  created_at timestamptz not null default now()
);

alter table public.scores drop constraint if exists scores_name_format_check;
alter table public.scores add constraint scores_name_format_check
  check (name ~ '^[[:alnum:] ._-]+$');

create index if not exists scores_ranking_idx on public.scores (score desc, created_at asc);
alter table public.scores enable row level security;
revoke all on table public.scores from anon, authenticated;
grant select, insert on table public.scores to anon, authenticated;
grant usage, select on sequence public.scores_id_seq to anon, authenticated;

drop policy if exists "ranking_publico" on public.scores;
create policy "ranking_publico" on public.scores for select to anon, authenticated using (true);

drop policy if exists "guardar_puntuacion" on public.scores;
create policy "guardar_puntuacion" on public.scores for insert to anon, authenticated
with check (
  score between 1 and 1000000
  and char_length(trim(name)) between 2 and 16
  and name ~ '^[[:alnum:] ._-]+$'
);
