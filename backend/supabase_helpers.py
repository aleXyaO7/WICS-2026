import os

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
    """
    Query the songs table by spotify_id and return that row's metadata as JSON.

    Parameters
    ----------
    spotify_id : str
        Spotify track ID (e.g. "0VjIjW4GlUZAMYd2vXMi3b").

    Returns
    -------
    dict | None
        The `metadata` column (JSON) for the matching row, or None if not found.
    """
    client = _client()
    r = client.table("songs").select("metadata").eq("spotify_id", spotify_id).execute()
    rows = r.data or []
    if not rows:
        return None
    return rows[0].get("metadata")


def get_elo_rating(user_id: str):
    """
    Get elo_rating for a user by their uuid.

    Parameters
    ----------
    user_id : str
        User uuid (primary key of public.users).

    Returns
    -------
    int | None
        The user's elo_rating, or None if not found.
    """
    client = _client()
    r = client.table("users").select("elo_rating").eq("id", user_id).execute()
    rows = r.data or []
    if not rows:
        return None
    return rows[0].get("elo_rating")


def set_elo_rating(user_id: str, elo_rating: int):
    """
    Set elo_rating for a user by their uuid. updated_at is set automatically by trigger.

    Parameters
    ----------
    user_id : str
        User uuid (primary key of public.users).
    elo_rating : int
        New ELO rating (typically 1200 default).

    Returns
    -------
    int | None
        The updated elo_rating, or None if no row was updated.
    """
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
    """
    Insert a row into the songs table.

    Parameters
    ----------
    spotify_id : str | None
        Spotify track ID (optional).
    title : str
        Song title.
    artists : str
        Artist name(s); can be comma-separated.
    year : int | None
        Release year (optional).
    metadata : dict | None
        JSON metadata (e.g. audio features from ReccoBeats).
    url_original : str
        URL of the original audio (required).

    Returns
    -------
    dict | None
        The inserted row, or None on failure.
    """
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


if __name__ == "__main__":
    spotify_id = "0VjIjW4GlUZAMYd2vXMi3b"
    print(f"Testing get_metadata_by_spotify_id({spotify_id!r})")
    result = get_metadata_by_spotify_id(spotify_id)
    print("Result:", result)
