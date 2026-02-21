-- Drop and recreate songs table (metadata + original + 5 stem URLs)
drop table if exists public.songs;

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artists text not null,
  year integer,
  metadata jsonb,
  url_original text not null,
  url_drum text,
  url_bass text,
  url_piano text,
  url_guitar text,
  url_other text,
  created_at timestamptz default now()
);

comment on table public.songs is 'Songs with original and stem audio URLs (drum, bass, piano, guitar, other)';
