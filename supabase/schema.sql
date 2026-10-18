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
revoke all on sequence public.scores_id_seq from anon, authenticated;
grant select on table public.scores to anon, authenticated;

drop policy if exists "ranking_publico" on public.scores;
create policy "ranking_publico" on public.scores for select to anon, authenticated using (true);

drop policy if exists "guardar_puntuacion" on public.scores;

create or replace function public.submit_score(p_name text, p_score integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := trim(regexp_replace(p_name, '\s+', ' ', 'g'));
begin
  if char_length(clean_name) not between 2 and 16
    or clean_name !~ '^[[:alnum:] ._-]+$'
    or p_score not between 1 and 1000000 then
    raise exception 'Puntuacion invalida' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('super-frutas-score-submit'));

  if (select count(*) from public.scores where created_at > now() - interval '1 minute') >= 12 then
    raise exception 'Demasiados envios. Espera un momento.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.scores
    where lower(name) = lower(clean_name)
      and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Espera un minuto antes de volver a guardar.' using errcode = 'P0001';
  end if;

  if (select count(*) from public.scores) >= 10000 then
    raise exception 'El ranking alcanzo su capacidad maxima.' using errcode = 'P0001';
  end if;

  insert into public.scores (name, score) values (clean_name, p_score);
end;
$$;

revoke all on function public.submit_score(text, integer) from public;
grant execute on function public.submit_score(text, integer) to anon, authenticated;
