-- Songs table: metadata + original audio URL + 5 isolated stem URLs
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artists text not null,           -- comma-separated or single artist
  year integer,
  genre text,
  url_original text not null,      -- original full audio
  url_drum text,
  url_bass text,
  url_piano text,
  url_guitar text,
  url_other text,
  created_at timestamptz default now()
);

-- Optional: enable RLS and add policies (adjust as needed for your auth)
-- alter table public.songs enable row level security;

-- Example policy: allow public read (no auth)
-- create policy "Allow public read" on public.songs for select using (true);

-- Optional: allow insert/update/delete only for authenticated users
-- create policy "Allow authenticated write" on public.songs for all using (auth.role() = 'authenticated');

comment on table public.songs is 'Songs with original and stem audio URLs (drum, bass, piano, guitar, other)';
