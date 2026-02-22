import os
import re

try:
    from dotenv import load_dotenv
    load_dotenv()
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
_supabase = None


def _client():
    global _supabase
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set")
        from supabase import create_client
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase


def get_metadata_by_spotify_id(spotify_id: str):
    client = _client()
    r = client.table("songs").select("metadata").eq("spotify_id", spotify_id).execute()
    rows = r.data or []
    if not rows:
        return None
    return rows[0].get("metadata")


def get_elo_rating(user_id: str):
    client = _client()
    r = client.table("users").select("elo_rating").eq("id", user_id).execute()
    rows = r.data or []
    if not rows:
        return None
    return rows[0].get("elo_rating")


def set_elo_rating(user_id: str, elo_rating: int):
    client = _client()
    r = client.table("users").update({"elo_rating": elo_rating}).eq("id", user_id).execute()
    rows = r.data or []
    if not rows:
        return None
    return rows[0].get("elo_rating")


def insert_song(
    *,
    spotify_id: str | None = None,
    title: str,
    artists: str,
    year: int | None = None,
    metadata: dict | None = None,
    url_original: str,
):
    client = _client()
    row = {
        "title": title,
        "artists": artists,
        "url_original": url_original,
    }
    if spotify_id is not None:
        row["spotify_id"] = spotify_id
    if year is not None:
        row["year"] = year
    if metadata is not None:
        row["metadata"] = metadata
    r = client.table("songs").insert(row).execute()
    rows = r.data or []
    if not rows:
        return None
    return rows[0]


def load_songs_from_txt(txt_path: str, bucket: str | None = None):
    from download_song import download_and_upload_to_s3
    from recco_beats import get_metadata_for_track

    if bucket is None:
        bucket = os.environ.get("AWS_S3_BUCKET") or os.environ.get("S3_BUCKET")
    if not bucket:
        raise RuntimeError("S3 bucket required: set AWS_S3_BUCKET or S3_BUCKET or pass bucket=")

    inserted = []
    with open(txt_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.rsplit(",", 3)]
            if len(parts) != 4:
                continue
            title, artist, year_str, spotify_id = parts
            try:
                year = int(year_str)
            except ValueError:
                continue
            song_name = f"{title} {artist}"
            # object_name = f"{spotify_id}.wav"
            slug = re.sub(r"[^a-z0-9-]", "", title.lower().replace(" ", "-"))
            object_name = f"{slug}.wav" if slug else f"{spotify_id}.wav"
            url_original = download_and_upload_to_s3(song_name, bucket, object_name)
            if url_original is None:
                continue
            metadata = get_metadata_for_track(spotify_id)
            row = insert_song(
                spotify_id=spotify_id,
                title=title,
                artists=artist,
                year=year,
                metadata=metadata,
                url_original=url_original,
            )
            if row is not None:
                inserted.append(row)
    return inserted


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python supabase_helpers.py <filename>", file=sys.stderr)
        print("  e.g. python supabase_helpers.py downloads/songs.txt", file=sys.stderr)
        sys.exit(1)
    filename = sys.argv[1]
    bucket = "wics-2026-audio"
    inserted = load_songs_from_txt(filename, bucket=bucket)
    print(f"Inserted {len(inserted)} songs")
