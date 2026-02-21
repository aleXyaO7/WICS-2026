-- Drop and recreate songs table (metadata + original track URL only)
drop table if exists public.songs;

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  spotify_id text,
  title text not null,
  artists text not null,
  year integer,
  metadata jsonb,
  url_original text not null,
  created_at timestamptz default now()
);

comment on table public.songs is 'Songs with original audio URL and metadata';
