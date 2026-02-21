# Supabase setup for songs

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. In **Project Settings → API**, copy:
   - **Project URL** → use as `SUPABASE_URL`
   - **service_role** key (secret) → use as `SUPABASE_SERVICE_ROLE_KEY` (for server-side backend)

## 2. Create the `songs` table

In the Supabase **SQL Editor**, run the migration:

```sql
-- From supabase/migrations/001_create_songs_table.sql
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artists text not null,
  year integer,
  genre text,
  url_original text not null,
  url_drum text,
  url_bass text,
  url_piano text,
  url_guitar text,
  url_other text,
  created_at timestamptz default now()
);
```

Or paste the contents of `supabase/migrations/001_create_songs_table.sql`.

## 3. Configure the backend

1. Copy `.env.example` to `.env` in the project root.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
3. Restart the Flask backend. `GET /api/songs` will then return rows from Supabase.

## 4. Storing audio files (URLs)

The table stores **URLs** to audio files, not the files themselves. You can:

- **Supabase Storage**: Upload files to a Storage bucket, make them public or use signed URLs, and store those URLs in `url_original`, `url_drum`, etc.
- **External hosting**: Use any public URLs (e.g. CDN, S3, etc.) in the columns.

Example insert (SQL or via Supabase client):

```sql
insert into public.songs (title, artists, year, genre, url_original, url_drum, url_bass, url_piano, url_guitar, url_other)
values (
  'Song Title',
  'Artist One, Artist Two',
  2024,
  'Rock',
  'https://example.com/audio/original.mp3',
  'https://example.com/audio/drum.mp3',
  'https://example.com/audio/bass.mp3',
  'https://example.com/audio/piano.mp3',
  'https://example.com/audio/guitar.mp3',
  'https://example.com/audio/other.mp3'
);
```

## 5. Without Supabase

If you don’t set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, the app keeps using the local `backend/downloads/` folder and the existing file-based behavior.
